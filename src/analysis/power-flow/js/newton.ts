import { abs, finite } from './math';
import { buildY } from './ybus';
import { calcPQ, fillJacobian, makeLayout } from './jacobian';
import { solveLinear } from './linear-solver';
import type { AdmittanceMatrix, LinearSolution, NumericalModel, PowerFlowResult, ProgressCallback } from './types';

export function solveNR(model: NumericalModel, progress?: ProgressCallback, options: { maxQLimitRounds?: number } = {}): PowerFlowResult {
 const t0=performance.now?.()||Date.now(),n=model.n,base=model.baseMVA||100,slack=model.slack;if(!(Number.isInteger(slack)&&slack>=0&&slack<n))return{status:'NO_SLACK',converged:false,iterations:0,rounds:0,maxMismatchMW:null,elapsedMs:(performance.now?.()||Date.now())-t0};const Y=buildY(model);progress?.('YBUS_READY',{buses:n,nnz:Y.colIdx.length});
 const pSpec=Float64Array.from(model.pSpec,v=>v/base),qSpec=Float64Array.from(model.qSpec,v=>v/base),busType=Int8Array.from(model.busType),Vm=new Float64Array(n).fill(1),Va=new Float64Array(n),P=new Float64Array(n),Q=new Float64Array(n);
 Vm[slack]=model.slackVm||1;for(let i=0;i<n;i++)if(busType[i]===1)Vm[i]=model.vmSet?.[i]||1;
 const qMin=model.qMinNet||[],qMax=model.qMaxNet||[],pvToPq:Array<{bus:number;qRequired:number;qLimit:number}>=[],warnings:string[]=[];let totalIter=0,lastLinear:LinearSolution|null=null,maxMismatch=Infinity,round=0;
 const qLimitRoundLimit=Math.max(1,Math.floor(options.maxQLimitRounds??8));
 for(round=0;round<qLimitRoundLimit;round++){
  const L=makeLayout(Y,busType,slack),Jvals=new Float64Array(L.colIdx.length),rhs=new Float64Array(L.N);let converged=false,nrReason='';
  for(let it=0;it<30;it++){
   calcPQ(Y,Vm,Va,P,Q);let mx=0,ss=0;
   for(let k=0;k<L.ang.length;k++){const i=L.ang[k],d=pSpec[i]-P[i];rhs[k]=d;mx=Math.max(mx,abs(d));ss+=d*d;}
   for(let k=0;k<L.pq.length;k++){const i=L.pq[k],d=qSpec[i]-Q[i];rhs[L.nang+k]=d;mx=Math.max(mx,abs(d));ss+=d*d;}
   maxMismatch=mx;progress?.('INNER_ITERATION',{round:round+1,iteration:it+1,maxMismatchMW:mx*base});
   if(mx<1e-6){converged=true;break;}
   fillJacobian(Y,L,Vm,Va,P,Q,Jvals);const A={N:L.N,rowPtr:L.rowPtr,colIdx:L.colIdx,values:Jvals,pos:L.pos,diagPos:L.diagPos};let lin;
   try{lin=solveLinear(A,rhs);}catch(e){nrReason='LINEAR_SOLVER_FAILED:'+(e instanceof Error?e.message:String(e));lin=null;}
   if(!lin){nrReason='LINEAR_SOLVER_FAILED';break;}lastLinear=lin;const dx=lin.x,oldVm=Float64Array.from(Vm),oldVa=Float64Array.from(Va),baseNorm=Math.sqrt(ss);let accepted=false;
   for(let scale=1;scale>=1/256;scale/=2){
    Vm.set(oldVm);Va.set(oldVa);
    for(let k=0;k<L.ang.length;k++){const i=L.ang[k];let d=dx[k];if(d>.35)d=.35;else if(d<-.35)d=-.35;Va[i]+=d*scale;}
    for(let k=0;k<L.pq.length;k++){const i=L.pq[k];let d=dx[L.nang+k];if(d>.16)d=.16;else if(d<-.16)d=-.16;Vm[i]+=d*scale;}
    let bad=false;for(let i=0;i<n;i++)if(!(Vm[i]>.35&&Vm[i]<1.85&&finite(Vm[i]))){bad=true;break;}if(bad)continue;
    calcPQ(Y,Vm,Va,P,Q);let ss2=0,mx2=0;
    for(let k=0;k<L.ang.length;k++){const i=L.ang[k],d=pSpec[i]-P[i];ss2+=d*d;mx2=Math.max(mx2,abs(d));}
    for(let k=0;k<L.pq.length;k++){const i=L.pq[k],d=qSpec[i]-Q[i];ss2+=d*d;mx2=Math.max(mx2,abs(d));}
    if(Math.sqrt(ss2)<baseNorm*(1-1e-5*scale)||mx2<1e-6){accepted=true;break;}
   }
   if(!accepted){Vm.set(oldVm);Va.set(oldVa);nrReason='NR_LINE_SEARCH_FAILED';break;}totalIter++;
  }
  if(!converged){return {status:nrReason||'NR_MAX_ITERATION',converged:false,iterations:totalIter,rounds:round+1,maxMismatchMW:maxMismatch*base,linear:lastLinear,elapsedMs:(performance.now?.()||Date.now())-t0};}
  calcPQ(Y,Vm,Va,P,Q);let changed=false;
  for(let i=0;i<n;i++)if(busType[i]===1){const lo=qMin[i],hi=qMax[i];if(lo==null||hi==null||!finite(lo)||!finite(hi))continue;const q=Q[i]*base;let lim=null;if(q<lo-0.02)lim=lo;else if(q>hi+0.02)lim=hi;if(lim!==null){qSpec[i]=lim/base;busType[i]=0;pvToPq.push({bus:i,qRequired:q,qLimit:lim});changed=true;progress?.('Q_LIMIT_UPDATE',{bus:i,qRequired:q,qLimit:lim});}}
  if(!changed)break;
  if(round===qLimitRoundLimit-1)return {status:'Q_LIMIT_MAX_ROUNDS',converged:false,iterations:totalIter,rounds:qLimitRoundLimit,maxMismatchMW:maxMismatch*base,linear:lastLinear,elapsedMs:(performance.now?.()||Date.now())-t0,warnings};
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
 return {status:'CONVERGED_FULL_NR',converged:true,iterations:totalIter,rounds:round+1,maxMismatchMW:maxMismatch*base,linear:lastLinear,pvToPq,Vm:Array.from(Vm),Va:Array.from(Va),P:Array.from(P,v=>v*base),Q:Array.from(Q,v=>v*base),branches:branchResults,minV,maxV,elapsedMs:(performance.now?.()||Date.now())-t0,warnings};
}
