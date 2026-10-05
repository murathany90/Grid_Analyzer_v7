import type { CanonicalNetwork, ModelCapabilities } from '../../domain/model/network';
import type { ScenarioOverlay } from '../../domain/scenario/overlay';
import type { CalculationIdentity } from '../../domain/calculation/identity';
import type { CalculationResult } from '../../domain/results/types';
import type { AnalysisSettings } from '../../domain/calculation/analysis-settings';
export type ProgressStage='MODEL'|'TOPOLOGY'|'YBUS'|'INIT'|'INNER_NR'|'Q_LIMIT'|'OUTER_CONTROL'|'RESULT';
export type Progress=(stage:ProgressStage,detail?:Record<string,unknown>)=>void;
export type StationControlMode='off'|'ownership'|'zeroDroop'|'droop';
export type StationControlImplementation='SENSITIVITY'|'INTEGRATED_EXPERIMENTAL'|'INTEGRATED';
export interface AnalysisRequest { network:CanonicalNetwork;scenario:ScenarioOverlay;identity:CalculationIdentity;analysisSettings?:AnalysisSettings;/** Defaults to the selected Full AC profile; omit for local PV when settings are absent. */stationControlMode?:StationControlMode;/** Integrated sparse Newton is the station-control default; other modes remain diagnostic. */stationControlImplementation?:StationControlImplementation }
export interface AnalysisEngine {
  readonly name:string;readonly version:string;
  capabilities(network:CanonicalNetwork):ModelCapabilities;
  runPowerFlow(request:AnalysisRequest,onProgress?:Progress):Promise<CalculationResult>;
  runDcPowerFlow(request:AnalysisRequest,onProgress?:Progress):Promise<CalculationResult>;
  runFastAc(request:AnalysisRequest,onProgress?:Progress):Promise<CalculationResult>;
}
export interface FutureAnalysisEngine extends AnalysisEngine {
  runShortCircuit?(request:unknown):Promise<unknown>;
  runContingency?(request:unknown):Promise<unknown>;
}
