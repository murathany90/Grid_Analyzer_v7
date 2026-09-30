import { abs, finite } from './math';
import { buildY } from './ybus';
import { calcPQ, fillJacobian, makeLayout } from './jacobian';
import { solveLinear,solveLinearFill1 } from './linear-solver';
import type { AdmittanceMatrix, IntegratedStationControl, JacobianLayout, LinearSolution, NumericalFailureDiagnostic, NumericalModel, PowerFlowResult, ProgressCallback } from './types';

/** Armijo decrease is proportional to the step actually applied after capping. */
export function acceptsNewtonStep(baseNorm:number,nextNorm:number,stepFraction:number,maxMismatch:number):boolean {
 return nextNorm<baseNorm*(1-1e-5*stepFraction)||maxMismatch<1e-6;
}

function topologyCounts(model:NumericalModel):{islandCount:number;unsuppliedBusCount:number}{
 const adjacency:number[][]=Array.from({length:model.n},()=>[]);for(const e of model.branches){if(e.i<0||e.j<0||e.i>=model.n||e.j>=model.n)continue;adjacency[e.i].push(e.j);adjacency[e.j].push(e.i);}
 const seen=new Uint8Array(model.n);let islandCount=0;for(let i=0;i<model.n;i++)if(!seen[i]){islandCount++;seen[i]=1;const q=[i];while(q.length){for(const j of adjacency[q.pop()!]||[])if(!seen[j]){seen[j]=1;q.push(j);}}}
 const supplied=new Uint8Array(model.n);if(Number.isInteger(model.slack)&&model.slack>=0&&model.slack<model.n){supplied[model.slack]=1;const q=[model.slack];while(q.length){for(const j of adjacency[q.pop()!]||[])if(!supplied[j]){supplied[j]=1;q.push(j);}}}
 return{islandCount,unsuppliedBusCount:model.n-supplied.reduce((a,b)=>a+b,0)};
}

export function solveNR(model: NumericalModel, progress?: ProgressCallback, options: { maxQLimitRounds?: number;initialVm?:ArrayLike<number>;initialVa?:ArrayLike<number>;initialControlDqPu?:ArrayLike<number>;stationControls?:readonly IntegratedStationControl[];admittance?:AdmittanceMatrix;layoutCache?:Map<string,JacobianLayout>;linearFill?:0|1;busIds?:readonly string[];controlIds?:readonly string[] } = {}): PowerFlowResult {
 const t0=performance.now?.()||Date.now(),n=model.n,base=model.baseMVA||100,slack=model.slack,counts=topologyCounts(model),elapsed=()=>((performance.now?.()||Date.now())-t0);
 const failure=(failureStage:NumericalFailureDiagnostic['failureStage'],message:string,iteration:number|null,controlRound:number,maxMismatchMw:number|null,extra:Partial<NumericalFailureDiagnostic>={})=>({failureStage,iteration,controlRound,maxMismatchMw,minPivot:null,islandCount:counts.islandCount,unsuppliedBusCount:counts.unsuppliedBusCount,referenceBus:Number.isInteger(slack)&&slack>=0&&slack<n?slack:null,message,...extra});
 if(!(Number.isInteger(slack)&&slack>=0&&slack<n)){const diagnostic=failure('NO_SLACK','Geçerli referans bara bulunamadı.',null,0,null);return{status:'NO_SLACK',converged:false,iterations:0,rounds:0,maxMismatchMW:null,failure:diagnostic,elapsedMs:elapsed()};}
 let Y:AdmittanceMatrix;try{Y=options.admittance??buildY(model);}catch(e){const message=e instanceof Error?e.message:String(e),diagnostic=failure('YBUS_BUILD',message,null,0,null);return{status:'MODEL_INVALID',converged:false,iterations:0,rounds:0,maxMismatchMW:null,failure:diagnostic,elapsedMs:elapsed()};}progress?.('YBUS_READY',{buses:n,nnz:Y.colIdx.length});
 const pSpec=Float64Array.from(model.pSpec,v=>v/base),qSpec=Float64Array.from(model.qSpec,v=>v/base),busType=Int8Array.from(model.busType),Vm=options.initialVm?.length===n?Float64Array.from(options.initialVm,v=>finite(v)&&v>.35&&v<1.85?v:1):new Float64Array(n).fill(1),Va=options.initialVa?.length===n?Float64Array.from(options.initialVa,v=>finite(v)?v:0):new Float64Array(n),P=new Float64Array(n),Q=new Float64Array(n);
 const controls=options.stationControls??[],controlDq=options.initialControlDqPu?.length===controls.length?Float64Array.from(options.initialControlDqPu,v=>finite(v)?v:0):new Float64Array(controls.length),effectiveQ=new Float64Array(n);
 const refreshEffectiveQ=()=>{effectiveQ.set(qSpec);controls.forEach((control,index)=>{for(const actuator of control.actuators)effectiveQ[actuator.bus]+=actuator.participation*controlDq[index];});};
 Vm[slack]=model.slackVm||1;for(let i=0;i<n;i++)if(busType[i]===1)Vm[i]=model.vmSet?.[i]||1;
 for(const control of controls)Vm[control.remoteBus]=control.targetVmPu;
 const qMin=model.qMinNet||[],qMax=model.qMaxNet||[],pvToPq:Array<{bus:number;qRequired:number;qLimit:number}>=[],warnings:string[]=[];let totalIter=0,lastLinear:LinearSolution|null=null,maxMismatch=Infinity,round=0;
 const qLimitRoundLimit=Math.max(1,Math.floor(options.maxQLimitRounds??8));
 for(round=0;round<qLimitRoundLimit;round++){
  const layoutCache=controls.length?undefined:options.layoutCache,layoutKey=layoutCache?Array.from(busType).join('')+'|'+slack:'';let L:JacobianLayout;
  try{L=layoutCache?.get(layoutKey)??makeLayout(Y,busType,slack,controls);if(layoutCache&&!layoutCache.has(layoutKey))layoutCache.set(layoutKey,L);}
  catch(error){const message=error instanceof Error?error.message:String(error),diagnostic=failure('LINEAR_SOLVE',message,null,round+1,null);return{status:'INTEGRATED_LAYOUT_FAILED',converged:false,iterations:totalIter,rounds:round+1,maxMismatchMW:null,failure:diagnostic,elapsedMs:elapsed()};}
  const Jvals=new Float64Array(L.colIdx.length),rhs=new Float64Array(L.N);let converged=false,nrReason='',nrFailure:NumericalFailureDiagnostic|undefined,lastMinPivot:number|null=null,lastLinearStage:string|undefined;
  for(let it=0;it<30;it++){
   calcPQ(Y,Vm,Va,P,Q);refreshEffectiveQ();let mx=0,ss=0;
   for(let k=0;k<L.ang.length;k++){const i=L.ang[k],d=pSpec[i]-P[i];rhs[k]=d;mx=Math.max(mx,abs(d));ss+=d*d;}
   for(let k=0;k<L.pq.length;k++){const i=L.pq[k],d=effectiveQ[i]-Q[i];rhs[L.nang+k]=d;mx=Math.max(mx,abs(d));ss+=d*d;}
   maxMismatch=mx;progress?.('INNER_ITERATION',{round:round+1,iteration:it+1,maxMismatchMW:mx*base});
   if(mx<1e-6){converged=true;break;}
   fillJacobian(Y,L,Vm,Va,P,Q,Jvals,controls);const A={N:L.N,rowPtr:L.rowPtr,colIdx:L.colIdx,values:Jvals,pos:L.pos,diagPos:L.diagPos};let lin;
   const linearDiagnostics={minPivot:null as number|null,stage:'START',pivotSource:undefined as NumericalFailureDiagnostic['pivotSource']};try{lin=(options.linearFill===1?solveLinearFill1:solveLinear)(A,rhs,linearDiagnostics);}catch(e){nrReason='LINEAR_SOLVER_FAILED';nrFailure=failure('LINEAR_SOLVE',e instanceof Error?e.message:String(e),it+1,round+1,mx*base,{minPivot:linearDiagnostics.minPivot,linearStage:linearDiagnostics.stage,pivotSource:linearDiagnostics.pivotSource});lin=null;}lastMinPivot=linearDiagnostics.minPivot;lastLinearStage=linearDiagnostics.stage;
   if(!lin){nrReason='LINEAR_SOLVER_FAILED';nrFailure??=failure('LINEAR_SOLVE',`Lineer çözücü yakınsamadı (${linearDiagnostics.stage}).`,it+1,round+1,mx*base,{minPivot:linearDiagnostics.minPivot,linearStage:linearDiagnostics.stage,pivotSource:linearDiagnostics.pivotSource});break;}lastLinear=lin;const dx=lin.x,oldVm=Float64Array.from(Vm),oldVa=Float64Array.from(Va),oldDq=Float64Array.from(controlDq),baseNorm=Math.sqrt(ss);let accepted=false;
   let stepCap=1;for(let k=0;k<L.nang;k++)stepCap=Math.min(stepCap,.35/Math.max(Math.abs(dx[k]),1e-15));for(const bus of L.vm)stepCap=Math.min(stepCap,.16/Math.max(Math.abs(dx[L.vIndex[bus]]),1e-15));
    let bestNorm=Infinity,firstInvalidCandidate:NumericalFailureDiagnostic['firstInvalidCandidate'];
    for(let scale=1;scale>=1/256;scale/=2){
    Vm.set(oldVm);Va.set(oldVa);controlDq.set(oldDq);
    for(let k=0;k<L.ang.length;k++){const i=L.ang[k];Va[i]+=dx[k]*stepCap*scale;}
    for(const i of L.vm)Vm[i]+=dx[L.vIndex[i]]*stepCap*scale;
    for(let k=0;k<controls.length;k++)controlDq[k]+=dx[L.controlIndex[k]]*stepCap*scale;
    let bad=false;for(let i=0;i<n;i++)if(!(Vm[i]>.35&&Vm[i]<1.85&&finite(Vm[i]))){bad=true;firstInvalidCandidate??={bus:i,busId:options.busIds?.[i]??null,oldVm:oldVm[i],candidateVm:Vm[i],scale,stateUpdated:L.vIndex[i]>=0};break;}if(bad)continue;
    calcPQ(Y,Vm,Va,P,Q);refreshEffectiveQ();let ss2=0,mx2=0;
    for(let k=0;k<L.ang.length;k++){const i=L.ang[k],d=pSpec[i]-P[i];ss2+=d*d;mx2=Math.max(mx2,abs(d));}
    for(let k=0;k<L.pq.length;k++){const i=L.pq[k],d=effectiveQ[i]-Q[i];ss2+=d*d;mx2=Math.max(mx2,abs(d));}
     const nextNorm=Math.sqrt(ss2);bestNorm=Math.min(bestNorm,nextNorm);
     if(acceptsNewtonStep(baseNorm,nextNorm,stepCap*scale,mx2)){accepted=true;break;}
    }
   if(!accepted){Vm.set(oldVm);Va.set(oldVa);controlDq.set(oldDq);nrReason='NR_LINE_SEARCH_FAILED';
    let maxDxVm=0,maxDxVmBus=-1,maxDxTheta=0,maxDxThetaBus=-1,maxDxControlDq=0,maxDxControlIndex=-1;
    for(const bus of L.vm){const value=Math.abs(dx[L.vIndex[bus]]);if(value>maxDxVm){maxDxVm=value;maxDxVmBus=bus;}}
    for(const bus of L.ang){const value=Math.abs(dx[L.angIndex[bus]]);if(value>maxDxTheta){maxDxTheta=value;maxDxThetaBus=bus;}}
    for(let k=0;k<controls.length;k++){const value=Math.abs(dx[L.controlIndex[k]]);if(value>maxDxControlDq){maxDxControlDq=value;maxDxControlIndex=k;}}
    nrFailure=failure('LINE_SEARCH',firstInvalidCandidate&&bestNorm===Infinity?'All line-search candidates violated voltage bounds.':'Newton adımının hiçbir azaltılmış ölçeği mismatch değerini düşürmedi.',it+1,round+1,mx*base,{minPivot:linearDiagnostics.minPivot,linearStage:lin.method||linearDiagnostics.stage,pivotSource:linearDiagnostics.pivotSource,lineSearchAccepted:false,lineSearchStepCap:stepCap,lineSearchBestNormRatio:bestNorm/baseNorm,maxDxVm,maxDxVmBus,maxDxVmBusId:options.busIds?.[maxDxVmBus]??null,maxDxTheta,maxDxThetaBus,maxDxThetaBusId:options.busIds?.[maxDxThetaBus]??null,maxDxControlDq,maxDxControlIndex,maxDxControlId:options.controlIds?.[maxDxControlIndex]??null,oldMinVm:Math.min(...oldVm),oldMaxVm:Math.max(...oldVm),firstInvalidCandidate});break;}totalIter++;
  }
  if(!converged){nrFailure??=failure('NEWTON_ITERATION',nrReason||'Newton iteration limit reached.',30,round+1,maxMismatch*base,{minPivot:lastMinPivot,linearStage:lastLinear?.method||lastLinearStage});return {status:nrReason||'NR_MAX_ITERATION',converged:false,iterations:totalIter,rounds:round+1,maxMismatchMW:maxMismatch*base,linear:lastLinear,failure:nrFailure,elapsedMs:elapsed()};}
  calcPQ(Y,Vm,Va,P,Q);let changed=false;
  for(let i=0;i<n;i++)if(busType[i]===1){const lo=qMin[i],hi=qMax[i];if(lo==null||hi==null||!finite(lo)||!finite(hi))continue;const q=Q[i]*base;let lim=null;if(q<lo-0.02)lim=lo;else if(q>hi+0.02)lim=hi;if(lim!==null){qSpec[i]=lim/base;busType[i]=0;pvToPq.push({bus:i,qRequired:q,qLimit:lim});changed=true;progress?.('Q_LIMIT_UPDATE',{bus:i,qRequired:q,qLimit:lim});}}
  if(!changed)break;
  if(round===qLimitRoundLimit-1){const diagnostic=failure('Q_LIMIT','Reactive power limits continued to change at the control-round limit.',null,qLimitRoundLimit,maxMismatch*base);return {status:'Q_LIMIT_MAX_ROUNDS',converged:false,iterations:totalIter,rounds:qLimitRoundLimit,maxMismatchMW:maxMismatch*base,linear:lastLinear,failure:diagnostic,elapsedMs:elapsed(),warnings};}
 }
 calcPQ(Y,Vm,Va,P,Q);
 const branchResults=model.branches.map((e,idx)=>{
  const i=e.i,j=e.j,r=+e.r,x=+e.x,bch=+e.bch||0,tap=+e.tap||1,ph=+e.phase||0,den=r*r+x*x,g=r/den,b=-x/den,c=Math.cos(Va[i]-Va[j]-ph),s=Math.sin(Va[i]-Va[j]-ph),vi=Vm[i],vj=Vm[j];
  // Equivalent branch powers using same off-nominal tap convention, phase included in angle difference.
  const pf=(vi*vi*g/(tap*tap)-vi*vj/tap*(g*c+b*s))*base;
  const qf=(-vi*vi*(b+bch/2)/(tap*tap)-vi*vj/tap*(g*s-b*c))*base;
  const pt=(vj*vj*g-vi*vj/tap*(g*c-b*s))*base;
  const qt=(-vj*vj*(b+bch/2)+vi*vj/tap*(g*s+b*c))*base;
  return {index:idx,pf,qf,pt,qt};
 });
 const minV=Math.min(...Vm),maxV=Math.max(...Vm);
 return {status:'CONVERGED_FULL_NR',converged:true,iterations:totalIter,rounds:round+1,maxMismatchMW:maxMismatch*base,linear:lastLinear,pvToPq,Vm:Array.from(Vm),Va:Array.from(Va),P:Array.from(P,v=>v*base),Q:Array.from(Q,v=>v*base),controlDqPu:Array.from(controlDq),branches:branchResults,minV,maxV,elapsedMs:elapsed(),warnings};
}
