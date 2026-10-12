export interface EquipmentScRatings {ratedKv:number|null;interruptingKa:number|null;makingPeakKa:number|null;thermalKa:number|null;thermalTimeS:number|null;provenance:string}
export function scEquipmentCheck(actual:{nominalKv:number|null;ibKa:number|null;ipKa:number|null;ithKa:number|null;thermalTimeS:number|null},rating:EquipmentScRatings){
  const check=(value:number|null,limit:number|null,context=true)=>value===null||limit===null||!Number.isFinite(value)||!Number.isFinite(limit)||value<0||limit<=0||!context?{status:'BLOCKED' as const,value,limit,reason:'MISSING_OR_INCOMPATIBLE_QUANTITY_RATING_OR_CONTEXT'}:{status:value>limit?'EXCEEDED' as const:'WITHIN_RATING' as const,value,limit,reason:rating.provenance};
  const voltage=check(actual.nominalKv,rating.ratedKv,!!rating.provenance),voltageCompatible=voltage.status==='WITHIN_RATING';
  return {voltage,interrupting:check(actual.ibKa,rating.interruptingKa,voltageCompatible),making:check(actual.ipKa,rating.makingPeakKa,voltageCompatible),thermal:check(actual.ithKa,rating.thermalKa,voltageCompatible&&actual.thermalTimeS!==null&&actual.thermalTimeS===rating.thermalTimeS)};
}

export type EquipmentDutyStatus='PASS'|'FAIL'|'INSUFFICIENT_RATING_DATA'|'UNVERIFIED_METHOD'|'NOT_APPLICABLE';
export interface EquipmentDutyContext {
  applicable:boolean;
  /** Both identities must name the same physical connection, not merely a nearby bus. */
  faultConnectionId:string|null;ratingConnectionId:string|null;
  quantityVerification:{ibKa:boolean;ipKa:boolean;ithKa:boolean};
  methodProvenance:string;
}
/** Engineering verdict layered over the existing raw quantity comparisons.
 * No Ikss substitution, time extrapolation, inferred nameplate, or automatic native rating adapter. */
export function scEquipmentDuty(actual:Parameters<typeof scEquipmentCheck>[0],rating:EquipmentScRatings,context:EquipmentDutyContext){
  const raw=scEquipmentCheck(actual,rating);
  const verdict=(quantity:'ibKa'|'ipKa'|'ithKa',limit:number|null,comparison:typeof raw.interrupting)=>{
    const finish=(status:EquipmentDutyStatus,reason:string)=>({status,reason,value:actual[quantity],limit});
    if(!context.applicable)return finish('NOT_APPLICABLE','NO_APPLICABLE_EQUIPMENT_DUTY');
    if(!context.methodProvenance.trim()||!context.quantityVerification[quantity]||actual[quantity]===null||!Number.isFinite(actual[quantity])||actual[quantity]!<0)return finish('UNVERIFIED_METHOD','QUANTITY_METHOD_NOT_VERIFIED');
    if(!context.faultConnectionId||context.faultConnectionId!==context.ratingConnectionId)return finish('INSUFFICIENT_RATING_DATA','PHYSICAL_CONNECTION_UNMATCHED');
    if(!rating.provenance.trim()||limit===null||!Number.isFinite(limit)||limit<=0||rating.ratedKv===null||!Number.isFinite(rating.ratedKv)||rating.ratedKv<=0)return finish('INSUFFICIENT_RATING_DATA','MISSING_VALID_SOURCED_NAMEPLATE');
    if(actual.nominalKv===null||!Number.isFinite(actual.nominalKv)||actual.nominalKv<=0)return finish('UNVERIFIED_METHOD','NOMINAL_VOLTAGE_UNVERIFIED');
    if(actual.nominalKv>rating.ratedKv)return finish('FAIL','RATED_VOLTAGE_EXCEEDED');
    if(quantity==='ithKa'){
      if(rating.thermalTimeS===null||!Number.isFinite(rating.thermalTimeS)||rating.thermalTimeS<=0)return finish('INSUFFICIENT_RATING_DATA','RATING_DURATION_MISSING');
      if(actual.thermalTimeS===null||!Number.isFinite(actual.thermalTimeS)||actual.thermalTimeS<=0||actual.thermalTimeS!==rating.thermalTimeS)return finish('UNVERIFIED_METHOD','THERMAL_DURATIONS_NOT_IDENTICAL; NO_EXTRAPOLATION');
    }
    return finish(comparison.status==='EXCEEDED'?'FAIL':comparison.status==='WITHIN_RATING'?'PASS':'UNVERIFIED_METHOD',rating.provenance);
  };
  return {interrupting:verdict('ibKa',rating.interruptingKa,raw.interrupting),making:verdict('ipKa',rating.makingPeakKa,raw.making),thermal:verdict('ithKa',rating.thermalKa,raw.thermal)};
}
