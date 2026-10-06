/** Reactive sharing for the inspected imode=0 profile: dispatched active-power participation. */
/**
 * Availability of a unit's reactive limits in the source.
 *
 * `SOURCE_BOUNDED` is the only case in which a limit may be enforced. A source that
 * supplies no limit must not be turned into an unlimited reactive source: the
 * capability is unknown, and PF resolves such a unit from its control equation rather
 * than from a bound. `MISSING` therefore keeps the unit controllable while forbidding
 * the solver from claiming a limit was enforced.
 */
export type QLimitAvailability='SOURCE_BOUNDED'|'MISSING';
export interface ReactiveUnitState {
  id:string;bus:number;pMw:number;qMvar:number;
  /** Effective numeric band used for arithmetic. `MISSING` units carry sentinels that are never reported as enforced limits. */
  qMin:number;qMax:number;qDispatchMvar?:number;
  qLimitAvailability?:QLimitAvailability;
  /** The source-provided band, or null when the source supplies no limit. */
  sourceQMin?:number|null; sourceQMax?:number|null;
}
export const UNKNOWN_Q_LIMIT_LOW=-Number.MAX_VALUE;
export const UNKNOWN_Q_LIMIT_HIGH=Number.MAX_VALUE;
export const qLimitAvailabilityOf=(unit:Pick<ReactiveUnitState,'sourceQMin'|'sourceQMax'>):QLimitAvailability=>unit.sourceQMin!=null&&unit.sourceQMax!=null&&Number.isFinite(unit.sourceQMin)&&Number.isFinite(unit.sourceQMax)?'SOURCE_BOUNDED':'MISSING';
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
function eligibleWeights(units:readonly Pick<ReactiveUnitState,'id'|'pMw'>[],sourceWeights?:ReadonlyMap<string,number>):Map<string,number>|null {
  if(!sourceWeights)return dispatchedPWeights(units);
  const total=units.reduce((sum,unit)=>sum+(sourceWeights.get(unit.id)??0),0);
  return total>EPS?new Map(units.map(unit=>[unit.id,(sourceWeights.get(unit.id)??0)/total])):null;
}
export function activeParticipation(units:readonly ReactiveUnitState[],direction:1|-1,sourceWeights?:ReadonlyMap<string,number>):Map<string,number>|null {
  return eligibleWeights(units.filter(unit=>(sourceWeights?(sourceWeights.get(unit.id)??0)>EPS:unit.pMw>0)&&(direction>0?unit.qMvar<unit.qMax-EPS:unit.qMvar>unit.qMin+EPS)),sourceWeights);
}
/** Units at either Q limit are excluded from the unrestricted participation set. */
export function interiorParticipation(units:readonly ReactiveUnitState[],sourceWeights?:ReadonlyMap<string,number>):Map<string,number>|null {
  return eligibleWeights(units.filter(unit=>(sourceWeights?(sourceWeights.get(unit.id)??0)>EPS:true)&&unit.qMvar>unit.qMin+EPS&&unit.qMvar<unit.qMax-EPS),sourceWeights);
}
/** Bounded weighted water-fill; units at a limit leave the directional active set. */
export function allocateReactiveDelta(units:readonly ReactiveUnitState[],requestedDelta:number,sourceWeights?:ReadonlyMap<string,number>):ReactiveAllocation {
  const qByUnit=new Map(units.map(unit=>[unit.id,unit.qMvar]));
  if(!Number.isFinite(requestedDelta)||Math.abs(requestedDelta)<=EPS)return{qByUnit,appliedDelta:0,remainingDelta:requestedDelta,saturated:false};
  let remaining=requestedDelta;
  const direction:1|-1=requestedDelta>0?1:-1;
  for(let round=0;round<=units.length&&Math.abs(remaining)>EPS;round++){
    const eligible=units.filter(unit=>(sourceWeights?(sourceWeights.get(unit.id)??0)>EPS:unit.pMw>0)&&(direction>0?qByUnit.get(unit.id)!<unit.qMax-EPS:qByUnit.get(unit.id)!>unit.qMin+EPS));
    const weights=eligibleWeights(eligible,sourceWeights);if(!weights)break;
    const prior=remaining;let applied=0;
    for(const unit of eligible){const q=qByUnit.get(unit.id)!,share=prior*weights.get(unit.id)!;
      const next=Math.max(unit.qMin,Math.min(unit.qMax,q+share));qByUnit.set(unit.id,next);applied+=next-q;
    }
    remaining-=applied;if(Math.abs(applied)<=EPS)break;
  }
  return{qByUnit,appliedDelta:requestedDelta-remaining,remainingDelta:remaining,saturated:Math.abs(remaining)>EPS};
}
