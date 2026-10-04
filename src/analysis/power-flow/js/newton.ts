import { abs, finite } from './math';
import { buildY } from './ybus';
import { calcPQ, fillJacobian, makeLayout } from './jacobian';
import { solveLinear,solveLinearFill1 } from './linear-solver';
import { KluSparseDirectFactorization } from './sparse-direct';
import type { AdmittanceMatrix, IntegratedStationControl, JacobianLayout, LinearSolution, NumericalFailureDiagnostic, NumericalModel, PowerFlowResult, ProgressCallback } from './types';
export type { NumericalModel } from './types';

export interface FullAcSolverSettings {
  maxInnerIterations:number; maxOuterIterations:number; nodalToleranceKva:number;
  modelEquationTolerancePercent:number; maxNoImprovementIterations:number;
  repeatedReactiveLimitDetection:number; reactiveLimitsEnabled:boolean; qLimitToleranceMvar:number;
  /** Effective bound of the reactive active-set (Q-limit) round loop. */
  maxQLimitRounds?:number;
}
const DEFAULT_SOLVER_SETTINGS:FullAcSolverSettings={maxInnerIterations:30,maxOuterIterations:8,nodalToleranceKva:.1,modelEquationTolerancePercent:.01,maxNoImprovementIterations:20,repeatedReactiveLimitDetection:3,reactiveLimitsEnabled:true,qLimitToleranceMvar:.02,maxQLimitRounds:8};
export function nodalToleranceKvaToPu(toleranceKva:number,baseMva:number):number{return toleranceKva/1000/baseMva;}

/**
 * Armijo decrease is proportional to the step actually applied after capping.
 *
 * `convergenceTolerancePu` is the nodal convergence tolerance in pu. The previous
 * fixed `1e-6` mismatch acceptance contradicted the configured `nodalToleranceKva`
 * (default 5 kVA => 5e-5 pu), so a step could be accepted as "converged enough"
 * while the nodal criterion was still violated. The default keeps the historical
 * behaviour for direct callers that pass no tolerance.
 */
export function acceptsNewtonStep(baseNorm:number,nextNorm:number,stepFraction:number,maxMismatch:number,convergenceTolerancePu=1e-6):boolean {
  return nextNorm<baseNorm*(1-1e-5*stepFraction)||maxMismatch<convergenceTolerancePu;
}

function topologyCounts(model:NumericalModel):{islandCount:number;unsuppliedBusCount:number}{
 const adjacency:number[][]=Array.from({length:model.n},()=>[]);for(const e of model.branches){if(e.i<0||e.j<0||e.i>=model.n||e.j>=model.n)continue;adjacency[e.i].push(e.j);adjacency[e.j].push(e.i);}
 const seen=new Uint8Array(model.n);let islandCount=0;for(let i=0;i<model.n;i++)if(!seen[i]){islandCount++;seen[i]=1;const q=[i];while(q.length){for(const j of adjacency[q.pop()!]||[])if(!seen[j]){seen[j]=1;q.push(j);}}}
 const supplied=new Uint8Array(model.n);if(Number.isInteger(model.slack)&&model.slack>=0&&model.slack<model.n){supplied[model.slack]=1;const q=[model.slack];while(q.length){for(const j of adjacency[q.pop()!]||[])if(!supplied[j]){supplied[j]=1;q.push(j);}}}
 return{islandCount,unsuppliedBusCount:model.n-supplied.reduce((a,b)=>a+b,0)};
}

export function solveNR(model: NumericalModel, progress?: ProgressCallback, options: { settings?:Partial<FullAcSolverSettings>; maxQLimitRounds?: number;initialVm?:ArrayLike<number>;initialVa?:ArrayLike<number>;initialLimitedBuses?:PowerFlowResult['pvToPq'];initialControlDqPu?:ArrayLike<number>;stationControls?:readonly IntegratedStationControl[];admittance?:AdmittanceMatrix;layoutCache?:Map<string,JacobianLayout>;linearFill?:0|1;busIds?:readonly string[];controlIds?:readonly string[];workCounters?:{fullNrSolves:number;kluNewtonFactorizations:number;totalNewtonIterations?:number} } = {}): PowerFlowResult {
 const t0=performance.now?.()||Date.now(),n=model.n,base=model.baseMVA||100,slack=model.slack,counts=topologyCounts(model),elapsed=()=>((performance.now?.()||Date.now())-t0);
 if(options.workCounters)options.workCounters.fullNrSolves++;
 const settings={...DEFAULT_SOLVER_SETTINGS,...options.settings},tolerancePu=nodalToleranceKvaToPu(settings.nodalToleranceKva,base);
 const failure=(failureStage:NumericalFailureDiagnostic['failureStage'],message:string,iteration:number|null,controlRound:number,maxMismatchMw:number|null,extra:Partial<NumericalFailureDiagnostic>={})=>({failureStage,iteration,controlRound,maxMismatchMw,minPivot:null,islandCount:counts.islandCount,unsuppliedBusCount:counts.unsuppliedBusCount,referenceBus:Number.isInteger(slack)&&slack>=0&&slack<n?slack:null,message,...extra});
 if(!(Number.isInteger(slack)&&slack>=0&&slack<n)){const diagnostic=failure('NO_SLACK','Geçerli referans bara bulunamadı.',null,0,null);return{status:'NO_SLACK',converged:false,iterations:0,rounds:0,maxMismatchMW:null,failure:diagnostic,elapsedMs:elapsed()};}
 let Y:AdmittanceMatrix;try{Y=options.admittance??buildY(model);}catch(e){const message=e instanceof Error?e.message:String(e),diagnostic=failure('YBUS_BUILD',message,null,0,null);return{status:'MODEL_INVALID',converged:false,iterations:0,rounds:0,maxMismatchMW:null,failure:diagnostic,elapsedMs:elapsed()};}progress?.('YBUS_READY',{buses:n,nnz:Y.colIdx.length});
 const pSpec=Float64Array.from(model.pSpec,v=>v/base),qSpec=Float64Array.from(model.qSpec,v=>v/base),busType=Int8Array.from(model.busType),Vm=options.initialVm?.length===n?Float64Array.from(options.initialVm,v=>finite(v)&&v>.35&&v<1.85?v:1):new Float64Array(n).fill(1),Va=options.initialVa?.length===n?Float64Array.from(options.initialVa,v=>finite(v)?v:0):new Float64Array(n),P=new Float64Array(n),Q=new Float64Array(n);
 const controls=options.stationControls??[],controlDq=options.initialControlDqPu?.length===controls.length?Float64Array.from(options.initialControlDqPu,v=>finite(v)?v:0):new Float64Array(controls.length),effectiveQ=new Float64Array(n);
 const refreshEffectiveQ=()=>{effectiveQ.set(qSpec);controls.forEach((control,index)=>{for(const actuator of control.actuators)effectiveQ[actuator.bus]+=actuator.participation*controlDq[index];});};
 const seededLimits:Array<{bus:number;qRequired:number;qLimit:number;state?:'QMIN_LIMITED'|'QMAX_LIMITED'}>=[];
 for(const limited of options.initialLimitedBuses??[]){const bus=limited.bus;if(!Number.isInteger(bus)||bus<0||bus>=n||!finite(limited.qLimit)||!(busType[bus]===1||bus===slack&&busType[bus]===2))continue;
   busType[bus]=0;qSpec[bus]=limited.qLimit/base;seededLimits.push({...limited});}
 if(busType[slack]===2)Vm[slack]=model.slackVm||1;
 for(let i=0;i<n;i++)if(busType[i]===1)Vm[i]=model.vmSet?.[i]||1;
 for(const control of controls)Vm[control.remoteBus]=control.targetVmPu;
 const qMin=model.qMinNet||[],qMax=model.qMaxNet||[],refQMin=model.referenceQMinNet||[],refQMax=model.referenceQMaxNet||[],pvToPq:Array<{bus:number;qRequired:number;qLimit:number;state?:'QMIN_LIMITED'|'QMAX_LIMITED'}>=seededLimits,qLimitRounds:NonNullable<PowerFlowResult['qLimitRounds']>=[],warnings:string[]=[];let totalIter=0,lastLinear:LinearSolution|null=null,maxMismatch=Infinity,round=0;
// Reactive active-set rounds are independent of station-controller outer rounds.
  // The bound is a typed setting so provenance can report the value actually used.
  const qLimitRoundLimit=Math.max(1,Math.floor(options.maxQLimitRounds??settings.maxQLimitRounds??8));
 for(round=0;round<qLimitRoundLimit;round++){
  const layoutCache=controls.length?undefined:options.layoutCache,layoutKey=layoutCache?Array.from(busType).join('')+'|'+slack:'';let L:JacobianLayout;
  try{L=layoutCache?.get(layoutKey)??makeLayout(Y,busType,slack,controls);if(layoutCache&&!layoutCache.has(layoutKey))layoutCache.set(layoutKey,L);}
  catch(error){const message=error instanceof Error?error.message:String(error),diagnostic=failure('LINEAR_SOLVE',message,null,round+1,null);return{status:'INTEGRATED_LAYOUT_FAILED',converged:false,iterations:totalIter,rounds:round+1,maxMismatchMW:null,failure:diagnostic,elapsedMs:elapsed()};}
  const Jvals=new Float64Array(L.colIdx.length),rhs=new Float64Array(L.N);let converged=false,nrReason='',nrFailure:NumericalFailureDiagnostic|undefined,lastMinPivot:number|null=null,lastLinearStage:string|undefined,bestMismatch=Infinity,noImprovement=0;
   // Direct-solve acceptance is a linear-accuracy criterion, not the nodal convergence
   // criterion. It must stay at least three orders of magnitude tighter than the nodal
   // tolerance so an accepted Newton direction cannot carry a residual that the nodal
   // test would then treat as progress. Previously a fixed 1e-8 with no stated relation
   // to `nodalToleranceKva`.
   const directResidualLimitPu=Math.min(1e-8,tolerancePu*1e-3);
  for(let it=0;it<settings.maxInnerIterations;it++){
   calcPQ(Y,Vm,Va,P,Q);refreshEffectiveQ();let mx=0,ss=0;
   for(let k=0;k<L.ang.length;k++){const i=L.ang[k],d=pSpec[i]-P[i];rhs[k]=d;mx=Math.max(mx,abs(d));ss+=d*d;}
   for(let k=0;k<L.pq.length;k++){const i=L.pq[k],d=effectiveQ[i]-Q[i];rhs[L.nang+k]=d;mx=Math.max(mx,abs(d));ss+=d*d;}
   maxMismatch=mx;progress?.('INNER_ITERATION',{round:round+1,iteration:it+1,maxMismatchMW:mx*base});
   if(mx<tolerancePu){converged=true;break;}
   if(mx<bestMismatch*(1-1e-10)){bestMismatch=mx;noImprovement=0;}else noImprovement++;
   if(noImprovement>=settings.maxNoImprovementIterations){nrReason='NR_STAGNATION';break;}
   fillJacobian(Y,L,Vm,Va,P,Q,Jvals,controls);const A={N:L.N,rowPtr:L.rowPtr,colIdx:L.colIdx,values:Jvals,pos:L.pos,diagPos:L.diagPos};let lin:LinearSolution|null=null;
   const linearDiagnostics={minPivot:null as number|null,stage:'START',pivotSource:undefined as NumericalFailureDiagnostic['pivotSource']};
   const tryDirect=()=>{const direct=new KluSparseDirectFactorization();
    try{direct.factorize(A);if(options.workCounters)options.workCounters.kluNewtonFactorizations++;const solved=direct.solve(rhs);if(solved.success&&solved.x&&solved.trueResidual!=null&&solved.trueResidual<=directResidualLimitPu){lin={x:solved.x,iterations:0,residual:solved.trueResidual,method:'KLU_DIRECT'};linearDiagnostics.stage='KLU_DIRECT';}}
    catch{/* Preserve the other method's failure diagnostic. */}
    finally{direct.dispose();}};
   // ILU is inexpensive on small matrices; direct factorization avoids long Krylov tails on large grids.
   if(A.N>=512)tryDirect();
   if(!lin)try{lin=(options.linearFill===1?solveLinearFill1:solveLinear)(A,rhs,linearDiagnostics);}catch(e){nrReason='LINEAR_SOLVER_FAILED';nrFailure=failure('LINEAR_SOLVE',e instanceof Error?e.message:String(e),it+1,round+1,mx*base,{minPivot:linearDiagnostics.minPivot,linearStage:linearDiagnostics.stage,pivotSource:linearDiagnostics.pivotSource});}lastMinPivot=linearDiagnostics.minPivot;lastLinearStage=linearDiagnostics.stage;
   if(!lin&&A.N<512)tryDirect();
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
     if(acceptsNewtonStep(baseNorm,nextNorm,stepCap*scale,mx2,tolerancePu)){accepted=true;break;}
    }
   if(!accepted){Vm.set(oldVm);Va.set(oldVa);controlDq.set(oldDq);nrReason='NR_LINE_SEARCH_FAILED';
    let maxDxVm=0,maxDxVmBus=-1,maxDxTheta=0,maxDxThetaBus=-1,maxDxControlDq=0,maxDxControlIndex=-1;
    for(const bus of L.vm){const value=Math.abs(dx[L.vIndex[bus]]);if(value>maxDxVm){maxDxVm=value;maxDxVmBus=bus;}}
    for(const bus of L.ang){const value=Math.abs(dx[L.angIndex[bus]]);if(value>maxDxTheta){maxDxTheta=value;maxDxThetaBus=bus;}}
    for(let k=0;k<controls.length;k++){const value=Math.abs(dx[L.controlIndex[k]]);if(value>maxDxControlDq){maxDxControlDq=value;maxDxControlIndex=k;}}
    nrFailure=failure('LINE_SEARCH',firstInvalidCandidate&&bestNorm===Infinity?'All line-search candidates violated voltage bounds.':'Newton adımının hiçbir azaltılmış ölçeği mismatch değerini düşürmedi.',it+1,round+1,mx*base,{minPivot:linearDiagnostics.minPivot,linearStage:lin.method||linearDiagnostics.stage,pivotSource:linearDiagnostics.pivotSource,lineSearchAccepted:false,lineSearchStepCap:stepCap,lineSearchBestNormRatio:bestNorm/baseNorm,maxDxVm,maxDxVmBus,maxDxVmBusId:options.busIds?.[maxDxVmBus]??null,maxDxTheta,maxDxThetaBus,maxDxThetaBusId:options.busIds?.[maxDxThetaBus]??null,maxDxControlDq,maxDxControlIndex,maxDxControlId:options.controlIds?.[maxDxControlIndex]??null,oldMinVm:Math.min(...oldVm),oldMaxVm:Math.max(...oldVm),firstInvalidCandidate});break;}totalIter++;if(options.workCounters)options.workCounters.totalNewtonIterations=(options.workCounters.totalNewtonIterations??0)+1;
  }
  if(!converged){nrFailure??=failure('NEWTON_ITERATION',nrReason||'Newton iteration limit reached.',settings.maxInnerIterations,round+1,maxMismatch*base,{minPivot:lastMinPivot,linearStage:lastLinear?.method||lastLinearStage});return {status:nrReason||'NR_MAX_ITERATION',converged:false,iterations:totalIter,rounds:round+1,maxMismatchMW:maxMismatch*base,linear:lastLinear,failure:nrFailure,elapsedMs:elapsed()};}
  calcPQ(Y,Vm,Va,P,Q);let changed=false,limitedThisRound=0;
  if(settings.reactiveLimitsEnabled){
   const qTolerance=settings.qLimitToleranceMvar??.02;
   for(let i=0;i<n;i++)if(busType[i]===1||(i===slack&&busType[i]===2)){const lo=i===slack?refQMin[i]:qMin[i],hi=i===slack?refQMax[i]:qMax[i];if(lo==null||hi==null||!finite(lo)||!finite(hi))continue;const q=Q[i]*base;let lim:number|null=null,state:'QMIN_LIMITED'|'QMAX_LIMITED'|undefined;if(q<lo-qTolerance){lim=lo;state='QMIN_LIMITED';}else if(q>hi+qTolerance){lim=hi;state='QMAX_LIMITED';}if(lim!==null){qSpec[i]=lim/base;busType[i]=0;pvToPq.push({bus:i,qRequired:q,qLimit:lim,state});changed=true;limitedThisRound++;progress?.('Q_LIMIT_UPDATE',{bus:i,qRequired:q,qLimit:lim,referenceBus:i===slack?1:0});}}
  }
  const modelErrorPercent=controls.length?Math.max(...controls.map(control=>Math.abs(Vm[control.remoteBus]-control.targetVmPu)/Math.max(1e-9,Math.abs(control.targetVmPu))*100)):null;
  qLimitRounds.push({round:round+1,changedUnits:limitedThisRound,limitedUnits:pvToPq.length,releasedUnits:0,maxBusMismatchKva:Number.isFinite(maxMismatch)?maxMismatch*base*1000:null,maxModelEquationErrorPercent:modelErrorPercent});
  if(!changed)break;
  if(round===qLimitRoundLimit-1){const diagnostic=failure('Q_LIMIT','Reactive power limits continued to change at the control-round limit.',null,qLimitRoundLimit,maxMismatch*base);return {status:'Q_LIMIT_MAX_ROUNDS',converged:false,iterations:totalIter,rounds:qLimitRoundLimit,maxMismatchMW:maxMismatch*base,linear:lastLinear,failure:diagnostic,elapsedMs:elapsed(),warnings};}
 }
 calcPQ(Y,Vm,Va,P,Q);
 const branchResults=model.branches.map((e,idx)=>{
  const i=e.i,j=e.j,r=+e.r,x=+e.x,bch=+e.bch||0,tap=+e.tap||1,ph=+e.phase||0,den=r*r+x*x,g=r/den,b=-x/den,c=Math.cos(Va[i]-Va[j]-ph),s=Math.sin(Va[i]-Va[j]-ph),vi=Vm[i],vj=Vm[j];
  // Equivalent branch powers using same off-nominal tap convention, phase included in angle difference.
  // Transformer magnetizing admittance is placed at the from/HV bus in Ybus.
  // Include that same shunt in the reported from-terminal power so branch flows
  // reconcile with the solved bus injection and transformer losses.
  const pf=(vi*vi*g/(tap*tap)-vi*vj/tap*(g*c+b*s)+vi*vi*(e.gMagPu||0))*base;
  const qf=(-vi*vi*(b+bch/2)/(tap*tap)-vi*vj/tap*(g*s-b*c)-vi*vi*(e.bMagPu||0))*base;
  const pt=(vj*vj*g-vi*vj/tap*(g*c-b*s))*base;
  const qt=(-vj*vj*(b+bch/2)+vi*vj/tap*(g*s+b*c))*base;
  return {index:idx,pf,qf,pt,qt};
 });
 const minV=Math.min(...Vm),maxV=Math.max(...Vm);
 return {status:'CONVERGED_FULL_NR',converged:true,iterations:totalIter,rounds:round+1,maxMismatchMW:maxMismatch*base,linear:lastLinear,pvToPq,qLimitRounds,Vm:Array.from(Vm),Va:Array.from(Va),P:Array.from(P,v=>v*base),Q:Array.from(Q,v=>v*base),controlDqPu:Array.from(controlDq),branches:branchResults,minV,maxV,elapsedMs:elapsed(),warnings};
}
