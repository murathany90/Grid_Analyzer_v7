/** Reactive sharing for the inspected imode=0 profile: dispatched active-power participation. */
export interface ReactiveUnitState {id:string;bus:number;pMw:number;qMvar:number;qMin:number;qMax:number}
export interface ReactiveAllocation {qByUnit:Map<string,number>;appliedDelta:number;remainingDelta:number;saturated:boolean}
const EPS=1e-9;
export function dispatchedPWeights(units:readonly Pick<ReactiveUnitState,'id'|'pMw'>[]):Map<string,number>|null {
  if(!units.length||units.some(unit=>!Number.isFinite(unit.pMw)||unit.pMw<0))return null;
  const total=units.reduce((sum,unit)=>sum+unit.pMw,0);
  return total>EPS?new Map(units.map(unit=>[unit.id,unit.pMw/total])):null;
}
export function stationParticipation(units:readonly Pick<ReactiveUnitState,'id'|'pMw'>[],cvqq?:readonly (number|null)[]):{weights:Map<string,number>;source:'SOURCE_CVQQ'|'DERIVED_DISPATCHED_ACTIVE_POWER'}|null {
  if(cvqq!==undefined){
    if(cvqq.length!==units.length||cvqq.some(value=>value==null||!Number.isFinite(value)||value<0))return null;
    const total=cvqq.reduce<number>((sum,value)=>sum+value!,0);
    return total>EPS?{weights:new Map(units.map((unit,index)=>[unit.id,cvqq[index]!/total])),source:'SOURCE_CVQQ'}:null;
  }
  const weights=dispatchedPWeights(units);
  return weights?{weights,source:'DERIVED_DISPATCHED_ACTIVE_POWER'}:null;
}
export function activeParticipation(units:readonly ReactiveUnitState[],direction:1|-1):Map<string,number>|null {
  return dispatchedPWeights(units.filter(unit=>unit.pMw>0&&(direction>0?unit.qMvar<unit.qMax-EPS:unit.qMvar>unit.qMin+EPS)));
}
/** Units at either Q limit are excluded from the unrestricted participation set. */
export function interiorParticipation(units:readonly ReactiveUnitState[]):Map<string,number>|null {
  return dispatchedPWeights(units.filter(unit=>unit.qMvar>unit.qMin+EPS&&unit.qMvar<unit.qMax-EPS));
}
/** Bounded weighted water-fill; units at a limit leave the directional active set. */
export function allocateReactiveDelta(units:readonly ReactiveUnitState[],requestedDelta:number):ReactiveAllocation {
  const qByUnit=new Map(units.map(unit=>[unit.id,unit.qMvar]));
  if(!Number.isFinite(requestedDelta)||Math.abs(requestedDelta)<=EPS)return{qByUnit,appliedDelta:0,remainingDelta:requestedDelta,saturated:false};
  let remaining=requestedDelta;
  const direction:1|-1=requestedDelta>0?1:-1;
  for(let round=0;round<=units.length&&Math.abs(remaining)>EPS;round++){
    const eligible=units.filter(unit=>unit.pMw>0&&(direction>0?qByUnit.get(unit.id)!<unit.qMax-EPS:qByUnit.get(unit.id)!>unit.qMin+EPS));
    const weights=dispatchedPWeights(eligible);if(!weights)break;
    const prior=remaining;let applied=0;
    for(const unit of eligible){const q=qByUnit.get(unit.id)!,share=prior*weights.get(unit.id)!;
      const next=Math.max(unit.qMin,Math.min(unit.qMax,q+share));qByUnit.set(unit.id,next);applied+=next-q;
    }
    remaining-=applied;if(Math.abs(applied)<=EPS)break;
  }
  return{qByUnit,appliedDelta:requestedDelta-remaining,remainingDelta:remaining,saturated:Math.abs(remaining)>EPS};
}
