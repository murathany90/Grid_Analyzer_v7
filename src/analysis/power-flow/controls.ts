import type { Generator } from '../../domain/model/network';
export function reactiveParticipation(units: readonly Pick<Generator,'pMw'>[]): number[] {
  const weights=units.map(g=>Math.max(0,g.pMw)),sum=weights.reduce((a,b)=>a+b,0);return sum>1e-9?weights.map(w=>w/sum):units.map(()=>1/Math.max(1,units.length));
}
export function redistributeReactivePower(units:readonly Generator[],totalQ:number):{q:number[];hits:string[];residual:number}{
  const q=units.map(u=>u.qMvar),active=new Set(units.map((_,i)=>i)),hits:string[]=[];
  for(let round=0;round<units.length+2&&active.size;round++){
    const residual=totalQ-q.reduce((a,b)=>a+b,0);if(Math.abs(residual)<1e-7)break;
    const ids=[...active],weights=reactiveParticipation(ids.map(i=>units[i]));let saturated=false;
    for(let k=0;k<ids.length;k++){const i=ids[k],u=units[i],proposal=q[i]+residual*weights[k];if(u.qMin!=null&&proposal<u.qMin){q[i]=u.qMin;active.delete(i);hits.push(u.id);saturated=true;}else if(u.qMax!=null&&proposal>u.qMax){q[i]=u.qMax;active.delete(i);hits.push(u.id);saturated=true;}}
    if(!saturated){const left=totalQ-q.reduce((a,b)=>a+b,0),ix=[...active],w=reactiveParticipation(ix.map(i=>units[i]));for(let k=0;k<ix.length;k++)q[ix[k]]+=left*w[k];break;}
  }
  return{q,hits,residual:totalQ-q.reduce((a,b)=>a+b,0)};
}
