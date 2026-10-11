export interface EquipmentScRatings {ratedKv:number|null;interruptingKa:number|null;makingPeakKa:number|null;thermalKa:number|null;thermalTimeS:number|null;provenance:string}
export function scEquipmentCheck(actual:{nominalKv:number|null;ibKa:number|null;ipKa:number|null;ithKa:number|null;thermalTimeS:number|null},rating:EquipmentScRatings){
  const check=(value:number|null,limit:number|null,context=true)=>value===null||limit===null||!Number.isFinite(value)||!Number.isFinite(limit)||value<0||limit<=0||!context?{status:'BLOCKED' as const,value,limit,reason:'MISSING_OR_INCOMPATIBLE_QUANTITY_RATING_OR_CONTEXT'}:{status:value>limit?'EXCEEDED' as const:'WITHIN_RATING' as const,value,limit,reason:rating.provenance};
  const voltage=check(actual.nominalKv,rating.ratedKv,!!rating.provenance),voltageCompatible=voltage.status==='WITHIN_RATING';
  return {voltage,interrupting:check(actual.ibKa,rating.interruptingKa,voltageCompatible),making:check(actual.ipKa,rating.makingPeakKa,voltageCompatible),thermal:check(actual.ithKa,rating.thermalKa,voltageCompatible&&actual.thermalTimeS!==null&&actual.thermalTimeS===rating.thermalTimeS)};
}
