import type {ScSourceContext} from './source-adapter';
import type {ScProfile,ScFaultResult} from './index';
import type {CanonicalNetwork} from '../../domain/model/network';
import {effectiveNetwork,scenarioSignature,type ScenarioOverlay} from '../../domain/scenario/overlay';

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
export function scMethodPreflight(profile:ScProfile,context:ScSourceContext,network?:CanonicalNetwork,scenario?:ScenarioOverlay){
  const families:Record<string,{active:number;native:number;assumed:number;missing:number;expectedCanonical:number;observedCanonical:number;missingAdapter:number}>={};
  const family=(cls:string)=>families[cls]??={active:0,native:0,assumed:0,missing:0,expectedCanonical:0,observedCanonical:0,missingAdapter:0};
  const active=context.sources.filter(s=>s.inService),observed=new Map<string,number>();
  for(const source of active){
    const f=family(source.sourceClass);f.active++;const key=source.sourceClass+':'+source.fid;observed.set(key,(observed.get(key)??0)+1);
    const validInputs=source.currentKa!==undefined?Number.isFinite(source.currentKa)&&source.currentKa>=0&&Number.isFinite(source.currentAngleDeg):source.rOhm!==null&&Number.isFinite(source.rOhm)&&source.rOhm>=0&&source.rOhm!==99999&&source.xOhm!==null&&Number.isFinite(source.xOhm)&&source.xOhm>0&&source.xOhm!==99999;
    if(source.reason||source.parameterStatus==='UNSUPPORTED'||source.parameterStatus!==undefined&&!['NATIVE','ASSUMED'].includes(source.parameterStatus)||!validInputs)f.missing++;else if(source.parameterStatus==='ASSUMED')f.assumed++;else f.native++;
  }
  const n=network&&scenario?effectiveNetwork(network,scenario):network,expected=n?[...n.generators,...n.externalGrids].filter(s=>s.inService):[],missingAdapters:{sourceClass:string;fid:string}[]=[];
  for(const source of expected){const f=family(source.sourceClass);f.expectedCanonical++;if(observed.has(source.sourceClass+':'+source.sourceId))f.observedCanonical++;else{f.missingAdapter++;missingAdapters.push({sourceClass:source.sourceClass,fid:source.sourceId});}}
  const duplicateAdapters=[...observed].filter(([,count])=>count>1).map(([key,count])=>({key,count})),identityMatched=network?network.modelHash===context.modelHash:null;
  const partial=missingAdapters.length>0||duplicateAdapters.length>0||Object.values(families).some(f=>f.assumed>0||f.missing>0)||!!context.assumptions?.length;
  const sequenceAvailable=!!context.sequenceData&&active.filter(s=>s.currentKa!==0).every(s=>context.sequenceData!.negativeSources.has(s.fid)&&context.sequenceData!.zeroSources.has(s.fid));
  const requestedNormative=profile.edition===IEC_2016;
  return {schemaVersion:2 as const,engineVersion:'GA_SC_NETWORK_V2',requestedEdition:profile.edition,normativeStatus:'BLOCKED' as const,requestedNormative,
    sourceStatus:identityMatched===false?'SOURCE_IDENTITY_UNVERIFIED' as const:partial?'PARTIAL' as const:!active.length?'SOURCE_UNAVAILABLE' as const:'ADAPTER_FIELDS_PRESENT' as const,
    sourceCoverage:{scope:'CANONICAL_GENERATORS_AND_EXTERNAL_GRIDS_ONLY',adapterOnlyFamiliesAreNotCompleteNativeInventory:true,modelHash:network?.modelHash??null,scenarioHash:scenario?scenarioSignature(scenario):null,identityMatched,expected:expected.length,observed:active.length,missingAdapters,duplicateAdapters,canonicalComplete:network?identityMatched===true&&!missingAdapters.length&&!duplicateAdapters.length:null},
    sourceFamilies:families,corrections:{KT:'NOT_IMPLEMENTED',KG:'NOT_IMPLEMENTED',KKW:'NOT_IMPLEMENTED'},
    correctionEvidence:['KT','KG','KKW'].map(kind=>({kind,equationSource:null,applicability:'2016_EDITION_AND_NETWORK_OR_POWER_STATION_CLASSIFICATION_UNVERIFIED',inputs:kind==='KT'?['transformer rated power/voltage/impedance','tap reference','network vs power-station unit']:kind==='KG'?['machine rated power/voltage/power factor','subtransient reactance','unit classification']:['generator-transformer unit identity','tap/control range','unit impedance and ratings'],units:'dimensionless factor; source impedances must retain their own bases',calculatedFactor:null,assumptions:[] as string[],verificationStatus:'BLOCKED',appliedToNetwork:false})),
    sequenceEvidence:{positive:'NETWORK_APPROXIMATION_ONLY',negative:'NETWORK_APPROXIMATION_ONLY',zero:'NETWORK_APPROXIMATION_ONLY',grounding:'PROVENANCE_AND_DGS_MAPPED',faultTypes:{'3PH':'NETWORK_APPROXIMATION_ONLY',LL:'BLOCKED','1LG':sequenceAvailable?'NETWORK_APPROXIMATION_ONLY':'BLOCKED','2LG':'BLOCKED'}},
    equipmentDutyEvidence:{nativeRatingAdapter:'NOT_IMPLEMENTED',automaticVerdict:'UNVERIFIED_METHOD',reason:'IB_IP_ITH_METHODS_AND_PHYSICAL_RATING_CONNECTION_NOT_VERIFIED'},
    blockers:[...IEC_2016_BLOCKERS,...(requestedNormative&&profile.frequencyHz!==50?['REQUESTED_50_HZ_PROFILE_NOT_RECORDED']:[]),...(profile.faultType!=='3PH'&&profile.faultType!=='1LG'?['SEQUENCE_AND_GROUNDING_MODEL_NOT_IMPLEMENTED']:[])],
    times:{breakerOpeningTimeS:profile.breakerOpeningTimeS??null,thermalClearingTimeS:profile.thermalClearingTimeS??null},
    interpretation:requestedNormative?'BLOCKED; no numerical normative result produced':'NETWORK_APPROXIMATION; numerical network solution is not normative IEC or PF parity'};
}
export function scQuantitySupport(fault:ScFaultResult):ScQuantitySupport{
  const solved=fault.status==='CALCULATED_NETWORK_APPROXIMATION';
  return {
    ikssKa:{status:solved?'ENGINE_CALCULATED':'BLOCKED',unit:'kA',reason:solved?'NETWORK_SEQUENCE_APPROXIMATION':fault.reasons.join('; ')},
    skssMva:{status:solved?'ENGINE_CALCULATED':'BLOCKED',unit:'MVA',reason:solved?'DERIVED_FROM_NETWORK_IKSS; NOT_NORMATIVE_VERIFICATION':fault.reasons.join('; ')},
    ipKa:{status:'BLOCKED',unit:'kA',reason:'KAPPA_RADIAL_MESHED_AND_SOURCE_CONTRIBUTIONS_UNVERIFIED'},
    ibKa:{status:'BLOCKED',unit:'kA',reason:'SOURCE_DECAY_NEAR_FAR_CLASSIFICATION_AND_BREAKER_OPENING_TIME_UNVERIFIED'},
    ithKa:{status:'BLOCKED',unit:'kA',reason:'AC_DC_THERMAL_FACTORS_AND_THERMAL_CLEARING_TIME_UNVERIFIED'},
  };
}
