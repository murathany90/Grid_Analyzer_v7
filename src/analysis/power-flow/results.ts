import type { PreparedModel } from './preparation';
import type { PowerFlowResult } from './js/types';
import type { CalculationIdentity } from '../../domain/calculation/identity';
import type { CalculationResult, GeneratorResult } from '../../domain/results/types';
import { redistributeReactivePower } from './controls';
export function mapResults(built:PreparedModel,r:PowerFlowResult,identity:CalculationIdentity):CalculationResult{
  const result:CalculationResult={identity,status:r.status,converged:r.converged,iterations:r.iterations,rounds:r.rounds,maxMismatchMw:r.maxMismatchMW,elapsedMs:r.elapsedMs,buses:[],branches:[],generators:[],diagnostics:{...built.diagnostics,pvToPq:r.pvToPq||[],linear:r.linear?{method:r.linear.method,iterations:r.linear.iterations,residual:r.linear.residual}:null},warnings:[...built.warnings,...(r.warnings||[])],quality:{numericalStatus:r.converged?'CONVERGED':'NOT_CONVERGED',controlFidelity:'PARTIAL',referenceValidation:'NOT_AVAILABLE'}};
  if(!r.converged||!r.Vm||!r.Va||!r.P||!r.Q||!r.branches)return result;
  result.buses=built.buses.map((b,i)=>({id:b.id,name:b.name,terms:b.terms,siteIds:b.siteIds,vnKv:b.vnKv,vmPu:r.Vm![i],angleRad:r.Va![i],pMw:r.P![i],qMvar:r.Q![i]}));
  result.branches=r.branches.map((e,k)=>{const m=built.branches[k],sf=Math.hypot(e.pf,e.qf),st=Math.hypot(e.pt,e.qt),vf=r.Vm![m.i]*built.buses[m.i].vnKv,vt=r.Vm![m.j]*built.buses[m.j].vnKv;
    return{id:m.id,name:m.name,sourceClass:m.sourceClass,from:m.from,to:m.to,siteIds:m.siteIds,vnKv:m.vnKv,pf:e.pf,qf:e.qf,pt:e.pt,qt:e.qt,ifA:vf>0?sf*1000/(Math.sqrt(3)*vf):NaN,itA:vt>0?st*1000/(Math.sqrt(3)*vt):NaN,loading:m.ratingMva&&m.ratingMva>0?Math.max(sf,st)/m.ratingMva*100:null,pLoss:e.pf+e.pt,qLoss:e.qf+e.qt};});
  const byBus=new Map<number,typeof built.generators>();for(const g of built.generators){if(!byBus.has(g.index))byBus.set(g.index,[]);byBus.get(g.index)!.push(g);}
  for(const[index,gs]of byBus){const controlled=gs.filter(g=>g.voltageControl);const fixed=built.model.qSpec[index]-controlled.reduce((s,g)=>s+g.qMvar,0),dist=redistributeReactivePower(controlled,r.Q[index]-fixed);
    for(const g of gs){const i=controlled.indexOf(g);const row:GeneratorResult={id:g.id,name:g.name,pMw:g.pMw,qMvar:i<0?g.qMvar:dist.q[i],qState:i<0?'DISPATCH_FIXED':dist.hits.includes(g.id)?'LIMIT':'CONTROLLED',bus:g.bus};result.generators.push(row);}
    if(controlled.length&&Math.abs(dist.residual)>1e-4)result.warnings.push(`${built.buses[index].name}: Q paylaşımı artık değeri ${dist.residual.toFixed(4)} MVAr.`);
  }
  return result;
}
