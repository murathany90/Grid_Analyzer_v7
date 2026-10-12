import type {CanonicalNetwork} from '../../domain/model/network';
import type {CalculationResult} from '../../domain/results/types';
import type {AnalysisSettings} from '../../domain/calculation/analysis-settings';
import {unsupportedFullAcSettings,unsupportedSharedSettings} from '../../domain/calculation/analysis-settings';

export interface ControlModelEvidence {kind:string;status:'SUPPORTED'|'PARTIAL'|'UNSUPPORTED'|'INVALID_INPUT'|'NOT_APPLICABLE';count:number;reason:string}

export interface ControlEvidence {
  numericalSolved:boolean;
  maxMismatchMw?:number|null;
  fidelity:'CONTROL_VERIFIED'|'CONTROL_FIDELITY_PARTIAL'|'NUMERICAL_UNVERIFIED';
  reasons:string[];
  stationMode:string;
  activeBalancingMode:string;
  stationSupport:unknown;
  convergence:unknown;
  models?:ControlModelEvidence[];
}
/** Read existing LF evidence; never change the operating point or infer a missing limit. */
export function n1ControlEvidence(network:CanonicalNetwork,result:CalculationResult,settings?:AnalysisSettings):ControlEvidence {
  const stationMode=settings?.powerFlow.stationControlMode??'off',activeBalancingMode=settings?.powerFlow.activeBalancingMode??'SINGLE_REFERENCE';
  const station=result.diagnostics.stationControllerSummary as {unsupported?:unknown;unsupportedProfile?:unknown;stationSourceFidelity?:unknown}|undefined;
  const convergence=result.diagnostics.convergence as {activeBalance?:unknown;stationControl?:unknown;sourceFidelity?:unknown}|undefined;
  const fallback=result.diagnostics.stationControlFallback as {occurred?:boolean}|undefined;
  const toleranceMw=(settings?.powerFlow.nodalToleranceKva??5)/1000;
  const numericalSolved=result.converged&&result.buses.length>0&&typeof result.maxMismatchMw==='number'&&Number.isFinite(result.maxMismatchMw)&&result.maxMismatchMw>=0&&Number.isFinite(toleranceMw)&&toleranceMw>0&&result.maxMismatchMw<=toleranceMw;
  const reasons:string[]=[];
  const models:ControlModelEvidence[]=[];
  const record=(kind:string,status:ControlModelEvidence['status'],count:number,reason:string)=>{models.push({kind,status,count,reason});if(['PARTIAL','UNSUPPORTED','INVALID_INPUT'].includes(status))reasons.push(reason);};
  if(!numericalSolved)reasons.push('NUMERICAL_SOLUTION_NOT_VERIFIED');
  if(!['off','zeroDroop','droop'].includes(stationMode))record('STATION_MODE','INVALID_INPUT',1,'UNKNOWN_STATION_CONTROL_MODE');
  if(!['SINGLE_REFERENCE','DISTRIBUTED_ADJUSTABLE_LOADS'].includes(activeBalancingMode))record('ACTIVE_BALANCE','UNSUPPORTED',1,'UNKNOWN_ACTIVE_BALANCING_MODE');
  // These fields are persisted for provenance but the LF engine does not consume them.
  // Default inert options do not alter legacy acceptance; an explicit request must fail closed.
  if(settings){
    for(const key of unsupportedFullAcSettings())if(typeof settings.powerFlow[key]==='boolean'&&settings.powerFlow[key]===true)record(key,'UNSUPPORTED',1,'REQUESTED_UNIMPLEMENTED_CONTROL:'+key);
    for(const key of unsupportedSharedSettings())if(settings.shared[key]!==100)record(key,Number.isFinite(settings.shared[key])?'UNSUPPORTED':'INVALID_INPUT',1,'REQUESTED_UNIMPLEMENTED_SCALING:'+key);
  }
  const fidelity=result.diagnostics.sourceFidelity as {fidelity?:string}|undefined;
  if(fidelity?.fidelity==='PARTIAL')record('SOURCE_PHYSICS','PARTIAL',1,'PARTIAL_NATIVE_SOURCE_PHYSICS');
  const reactive=result.diagnostics.reactiveLimitClasses as {fidelity?:string}|undefined;
  if(reactive?.fidelity==='PARTIAL')record('REACTIVE_LIMIT_MODES','PARTIAL',1,'UNSUPPORTED_REACTIVE_LIMIT_MODES');
  const transformers=network.transformers.filter(e=>e.inService),invalidTaps=transformers.filter(e=>!Number.isFinite(e.tap)||e.tap<=0||!Number.isFinite(e.phase)||e.tapResolution?.startsWith('FALLBACK'));
  record('FIXED_TRANSFORMER_TAP_PHASE',invalidTaps.length?'INVALID_INPUT':transformers.length?'SUPPORTED':'NOT_APPLICABLE',transformers.length,invalidTaps.length?'INVALID_OR_SUBSTITUTED_FIXED_TAP_PHASE':'NATIVE_FIXED_TAP_PHASE; AUTOMATIC_CONTROL_NOT_CLAIMED');
  const shunts=network.shunts.filter(e=>e.inService),invalidShunts=shunts.filter(e=>!Number.isFinite(e.gPu)||!Number.isFinite(e.bPu)||e.stepProvenance?.startsWith('INVALID'));
  record('FIXED_SHUNT',invalidShunts.length?'INVALID_INPUT':shunts.length?'SUPPORTED':'NOT_APPLICABLE',shunts.length,invalidShunts.length?'INVALID_FIXED_SHUNT_MODEL':'NATIVE_FIXED_ADMITTANCE; AUTOMATIC_CONTROL_NOT_CLAIMED');
  const activeStations=network.stationControllers.some(c=>c.inService);
  if(activeStations&&stationMode==='off')reasons.push('STATION_CONTROL_OFF_LOCAL_PV_PROFILE');
  if(stationMode!=='off'){
    if(activeStations&&!station)reasons.push('STATION_SUPPORT_EVIDENCE_MISSING');
    if(activeStations&&!convergence?.stationControl)reasons.push('STATION_CONVERGENCE_EVIDENCE_MISSING');
    const count=(v:unknown):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=0;
    if(activeStations&&(!count(station?.unsupported)||!count(station?.unsupportedProfile)))reasons.push('STATION_SUPPORT_EVIDENCE_UNVERIFIED');
    if(count(station?.unsupported)&&station.unsupported>0||count(station?.unsupportedProfile)&&station.unsupportedProfile>0)reasons.push('UNSUPPORTED_STATION_CONTROL');
    // Runtime diagnostics may be missing, corrupt or from a future implementation.
    // Only the accepted convergence/source states can certify active controls.
    if(activeStations&&convergence?.stationControl!=='STATION_CONTROL_CONVERGED')reasons.push('STATION_CONTROL_NOT_CONVERGED');
    if(fallback?.occurred)reasons.push('STATION_CONTROL_BASELINE_FALLBACK');
    if(station?.stationSourceFidelity==='PARTIAL_SOURCE_FIDELITY'||convergence?.sourceFidelity==='PARTIAL_SOURCE_FIDELITY')reasons.push('MISSING_SOURCE_REACTIVE_LIMIT');
    if(activeStations&&(station?.stationSourceFidelity!=='SOURCE_BOUNDED'||convergence?.sourceFidelity!=='SOURCE_BOUNDED'))reasons.push('STATION_SOURCE_FIDELITY_UNVERIFIED');
  }
  if(activeBalancingMode==='DISTRIBUTED_ADJUSTABLE_LOADS'&&convergence?.activeBalance!=='ACTIVE_BALANCE_CONVERGED')reasons.push(convergence?.activeBalance==='ACTIVE_BALANCE_PARTIAL'?'ACTIVE_BALANCE_PARTIAL':'ACTIVE_BALANCE_EVIDENCE_MISSING');
  return {numericalSolved,maxMismatchMw:typeof result.maxMismatchMw==='number'&&Number.isFinite(result.maxMismatchMw)?result.maxMismatchMw:null,fidelity:!numericalSolved?'NUMERICAL_UNVERIFIED':reasons.length?'CONTROL_FIDELITY_PARTIAL':'CONTROL_VERIFIED',reasons,stationMode,activeBalancingMode,stationSupport:station??null,convergence:convergence??null,models};
}
