import type { DcIsland, DcIslandEdge, DcIslandResult } from './types';

export function solveIslandDC(input: DcIsland, options: {maxLinearIterations?:number;relativeResidualTolerance?:number} = {}): DcIslandResult{const n=input.busIds.length,slack=input.slack,base=input.baseMVA||100,maxIterations=Math.max(1,Math.floor(options.maxLinearIterations??Math.max(500,n*10))),relativeTolerance=options.relativeResidualTolerance??1e-7;if(!(n>1&&slack>=0&&slack<n))return {status:'NO_SLACK',n};
 const adj=Array.from({length:n},():Array<[number,number]>=>[]),diag=new Float64Array(n),edgeList:Array<{e:DcIslandEdge;b:number}>=[];
 for(const e of input.edges){const X=Number(e.x);if(!(X>0&&Number.isFinite(X))||!(e.a>=0&&e.b>=0&&e.a<n&&e.b<n))return {status:'INVALID_BRANCH',id:e.id,x:e.x,n};if(e.a===e.b)continue;const b=1/X;diag[e.a]+=b;diag[e.b]+=b;adj[e.a].push([e.b,b]);adj[e.b].push([e.a,b]);edgeList.push({e,b});}
 const b=new Float64Array(n);for(let i=0;i<n;i++)b[i]=Number(input.injections[i][0])/base;
 const x=new Float64Array(n),r=Float64Array.from(b),p=new Float64Array(n),z=new Float64Array(n),q=new Float64Array(n),mul=(vec:ArrayLike<number>,out:Float64Array)=>{for(let i=0;i<n;i++){if(i===slack){out[i]=vec[i];continue;}let w=diag[i]*vec[i];for(const [j,g] of adj[i])w-=g*vec[j];out[i]=w;}};
 r[slack]=0;for(let i=0;i<n;i++){if(i===slack)continue;if(!(diag[i]>0))return {status:'SINGULAR',id:input.busIds[i],n};z[i]=r[i]/diag[i];p[i]=z[i];}
 let rho=0;for(let i=0;i<n;i++)rho+=r[i]*z[i];const norm=()=>Math.max(...r.map(Math.abs));const bnorm=Math.max(1e-10,...b.map(Math.abs));let iterations=0;
 for(;iterations<maxIterations;iterations++){
  if(norm()<=Math.max(1e-10,bnorm*relativeTolerance))break;
  mul(p,q);let den=0;for(let i=0;i<n;i++)den+=p[i]*q[i];if(!(den>0))return {status:'SINGULAR_PCG',iterations,n};const alpha=rho/den;
  for(let i=0;i<n;i++){x[i]+=alpha*p[i];r[i]-=alpha*q[i];z[i]=i===slack?0:r[i]/diag[i];}
  let rhoNew=0;for(let i=0;i<n;i++)rhoNew+=r[i]*z[i];const beta=rho>0?rhoNew/rho:0;for(let i=0;i<n;i++)p[i]=z[i]+beta*p[i];rho=rhoNew;
 }
 let residual=norm(),limits=Math.max(1e-10,bnorm*relativeTolerance);if(!(residual<=limits))return{status:'NOT_CONVERGED',residualPU:residual,iterations,n};
 const branches=edgeList.map(({e,b})=>({id:e.id,cls:e.cls,from:input.busIds[e.a],to:input.busIds[e.b],pMW:(x[e.a]-x[e.b])*b*base}));
 return {status:'CONVERGED_DC',iterations,residualPU:residual,n,slackBus:input.busIds[slack],angles:input.busIds.map((id,i)=>({id,angleRad:x[i]})),branches,remarks:'Kayıplar, Q, gerilim büyüklüğü ve faz kaydırma atlanır; 66 kV+ indirgenmiş model.'};
}
