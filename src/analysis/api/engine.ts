import type { CanonicalNetwork, ModelCapabilities } from '../../domain/model/network';
import type { ScenarioOverlay } from '../../domain/scenario/overlay';
import type { CalculationIdentity } from '../../domain/calculation/identity';
import type { CalculationResult } from '../../domain/results/types';
export type ProgressStage='MODEL'|'TOPOLOGY'|'YBUS'|'INIT'|'INNER_NR'|'Q_LIMIT'|'OUTER_CONTROL'|'RESULT';
export type Progress=(stage:ProgressStage,detail?:Record<string,unknown>)=>void;
export type StationControlMode='off'|'ownership'|'zeroDroop'|'droop';
export type StationControlImplementation='SENSITIVITY'|'INTEGRATED_EXPERIMENTAL';
export interface AnalysisRequest { network:CanonicalNetwork;scenario:ScenarioOverlay;identity:CalculationIdentity;/** Production defaults to local PV; station control is an explicit experimental override. */stationControlMode?:StationControlMode;/** Explicit station-control experiments default to SENSITIVITY; direct Newton remains experimental. */stationControlImplementation?:StationControlImplementation }
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
