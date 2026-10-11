import type {CanonicalNetwork} from '../../domain/model/network';
import type {CalculationResult} from '../../domain/results/types';
import type {AnalysisSettings} from '../../domain/calculation/analysis-settings';

export interface ControlEvidence {
  numericalSolved:boolean;
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
  const station=result.diagnostics.stationControllerSummary as {unsupported?:number;unsupportedProfile?:number;stationSourceFidelity?:string}|undefined;
  const convergence=result.diagnostics.convergence as {activeBalance?:string;stationControl?:string;sourceFidelity?:string}|undefined;
  const fallback=result.diagnostics.stationControlFallback as {occurred?:boolean}|undefined;
  const numericalSolved=result.converged&&result.buses.length>0&&typeof result.maxMismatchMw==='number'&&Number.isFinite(result.maxMismatchMw);
  const reasons:string[]=[];
  if(!numericalSolved)reasons.push('NUMERICAL_SOLUTION_NOT_VERIFIED');
  if(network.stationControllers.some(c=>c.inService)&&stationMode==='off')reasons.push('STATION_CONTROL_OFF_LOCAL_PV_PROFILE');
  if(stationMode!=='off'){
    if(network.stationControllers.some(c=>c.inService)&&!station)reasons.push('STATION_SUPPORT_EVIDENCE_MISSING');
    if((station?.unsupported??0)>0||(station?.unsupportedProfile??0)>0)reasons.push('UNSUPPORTED_STATION_CONTROL');
    if(convergence?.stationControl==='STATION_CONTROL_PARTIAL')reasons.push('STATION_CONTROL_NOT_CONVERGED');
    if(fallback?.occurred)reasons.push('STATION_CONTROL_BASELINE_FALLBACK');
    if(station?.stationSourceFidelity==='PARTIAL_SOURCE_FIDELITY'||convergence?.sourceFidelity==='PARTIAL_SOURCE_FIDELITY')reasons.push('MISSING_SOURCE_REACTIVE_LIMIT');
  }
  if(activeBalancingMode==='DISTRIBUTED_ADJUSTABLE_LOADS'&&convergence?.activeBalance!=='ACTIVE_BALANCE_CONVERGED')reasons.push(convergence?.activeBalance==='ACTIVE_BALANCE_PARTIAL'?'ACTIVE_BALANCE_PARTIAL':'ACTIVE_BALANCE_EVIDENCE_MISSING');
  return {numericalSolved,fidelity:!numericalSolved?'NUMERICAL_UNVERIFIED':reasons.length?'CONTROL_FIDELITY_PARTIAL':'CONTROL_VERIFIED',reasons,stationMode,activeBalancingMode,stationSupport:station??null,convergence:convergence??null};
}
