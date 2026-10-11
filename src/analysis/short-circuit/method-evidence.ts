import type {ScSourceContext} from './source-adapter';
import type {ScProfile,ScFaultResult} from './index';

export const IEC_2016='IEC60909-0:2016' as const;
export const IEC_2016_BLOCKERS=[
  'AUTHORITATIVE_2016_EQUATIONS_AND_APPLICABILITY_NOT_ACCEPTED',
  'INDEPENDENT_NORMATIVE_EXAMPLES_NOT_ACCEPTED',
  'IEC_SOURCE_EQUIVALENTS_KT_KG_KKW_NOT_IMPLEMENTED',
  'MOTOR_MACHINE_DECAY_AND_MESHED_KAPPA_NOT_IMPLEMENTED',
] as const;
export type ScQuantity='ikssKa'|'skssMva'|'ipKa'|'ibKa'|'ithKa';
export type ScQuantitySupport=Record<ScQuantity,{status:'ENGINE_CALCULATED'|'BLOCKED';unit:string;reason:string}>;
/** Code-owned evidence gate. A profile, imported PF result or screenshot cannot certify an engine. */
export function scMethodPreflight(profile:ScProfile,context:ScSourceContext){
  const families:Record<string,{active:number;native:number;assumed:number;missing:number}>={};
  for(const source of context.sources.filter(s=>s.inService)){
    const f=families[source.sourceClass]??={active:0,native:0,assumed:0,missing:0};f.active++;
    if(source.reason||source.parameterStatus==='UNSUPPORTED')f.missing++;else if(source.parameterStatus==='ASSUMED')f.assumed++;else f.native++;
  }
  const requestedNormative=profile.edition===IEC_2016;
  return {schemaVersion:2 as const,engineVersion:'GA_SC_NETWORK_V2',requestedEdition:profile.edition,normativeStatus:'BLOCKED' as const,requestedNormative,
    sourceStatus:context.sources.some(s=>s.inService&&(s.reason||s.parameterStatus==='ASSUMED'||s.parameterStatus==='UNSUPPORTED'))||context.assumptions?.length?'PARTIAL' as const:'SOURCE_INPUTS_AVAILABLE' as const,
    sourceFamilies:families,corrections:{KT:'NOT_IMPLEMENTED',KG:'NOT_IMPLEMENTED',KKW:'NOT_IMPLEMENTED'},
    blockers:[...IEC_2016_BLOCKERS,...(requestedNormative&&profile.frequencyHz!==50?['REQUESTED_50_HZ_PROFILE_NOT_RECORDED']:[]),...(profile.faultType!=='3PH'?['SEQUENCE_AND_GROUNDING_MODEL_NOT_IMPLEMENTED']:[])],
    times:{breakerOpeningTimeS:profile.breakerOpeningTimeS??null,thermalClearingTimeS:profile.thermalClearingTimeS??null},
    interpretation:requestedNormative?'BLOCKED; no numerical normative result produced':'NETWORK_APPROXIMATION; numerical network solution is not normative IEC or PF parity'};
}
export function scQuantitySupport(fault:ScFaultResult):ScQuantitySupport{
  const solved=fault.status==='CALCULATED_NETWORK_APPROXIMATION';
  return {
    ikssKa:{status:solved?'ENGINE_CALCULATED':'BLOCKED',unit:'kA',reason:solved?'POSITIVE_SEQUENCE_NETWORK_APPROXIMATION':fault.reasons.join('; ')},
    skssMva:{status:solved?'ENGINE_CALCULATED':'BLOCKED',unit:'MVA',reason:solved?'DERIVED_FROM_NETWORK_IKSS; NOT_NORMATIVE_VERIFICATION':fault.reasons.join('; ')},
    ipKa:{status:'BLOCKED',unit:'kA',reason:'KAPPA_RADIAL_MESHED_AND_SOURCE_CONTRIBUTIONS_UNVERIFIED'},
    ibKa:{status:'BLOCKED',unit:'kA',reason:'SOURCE_DECAY_NEAR_FAR_CLASSIFICATION_AND_BREAKER_OPENING_TIME_UNVERIFIED'},
    ithKa:{status:'BLOCKED',unit:'kA',reason:'AC_DC_THERMAL_FACTORS_AND_THERMAL_CLEARING_TIME_UNVERIFIED'},
  };
}
