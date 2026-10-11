import type {CanonicalNetwork} from '../../domain/model/network';
import type {CalculationResult} from '../../domain/results/types';
import type {AnalysisSettings} from '../../domain/calculation/analysis-settings';

export interface ControlEvidence {
  numericalSolved:boolean;
  maxMismatchMw?:number|null;
  fidelity:'CONTROL_VERIFIED'|'CONTROL_FIDELITY_PARTIAL'|'NUMERICAL_UNVERIFIED';
  reasons:string[];
  stationMode:string;
  activeBalancingMode:string;
  stationSupport:unknown;
  convergence:unknown;
}
/** Read existing LF evidence; never change the operating point or infer a missing limit. */
export function n1ControlEvidence(network:CanonicalNetwork,result:CalculationResult,settings?:AnalysisSettings):ControlEvidence {
  const stationMode=settings?.powerFlow.stationControlMode??'off',activeBalancingMode=settings?.powerFlow.activeBalancingMode??'SINGLE_REFERENCE';
  const station=result.diagnostics.stationControllerSummary as {unsupported?:unknown;unsupportedProfile?:unknown;stationSourceFidelity?:unknown}|undefined;
  const convergence=result.diagnostics.convergence as {activeBalance?:unknown;stationControl?:unknown;sourceFidelity?:unknown}|undefined;
  const fallback=result.diagnostics.stationControlFallback as {occurred?:boolean}|undefined;
  const numericalSolved=result.converged&&result.buses.length>0&&typeof result.maxMismatchMw==='number'&&Number.isFinite(result.maxMismatchMw);
  const reasons:string[]=[];
  if(!numericalSolved)reasons.push('NUMERICAL_SOLUTION_NOT_VERIFIED');
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
  return {numericalSolved,maxMismatchMw:typeof result.maxMismatchMw==='number'&&Number.isFinite(result.maxMismatchMw)?result.maxMismatchMw:null,fidelity:!numericalSolved?'NUMERICAL_UNVERIFIED':reasons.length?'CONTROL_FIDELITY_PARTIAL':'CONTROL_VERIFIED',reasons,stationMode,activeBalancingMode,stationSupport:station??null,convergence:convergence??null};
}
