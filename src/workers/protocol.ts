import type { CanonicalNetwork } from '../domain/model/network';
import type { ScenarioOverlay } from '../domain/scenario/overlay';
import type { CalculationIdentity } from '../domain/calculation/identity';
import type { CatalogQuery } from '../app/contracts';
import type { N1ScreenOptions } from '../domain/n1';
import type { CapacitySeason } from '../domain/model/capacity';
import type { AnalysisSettings } from '../domain/calculation/analysis-settings';
export type WorkerRequest = {id:number}&(
  {type:'LOAD_MODEL';file:File} | {type:'PREPARE';network:CanonicalNetwork} |
  {type:'RUN_AC'|'RUN_DC'|'RUN_FAST';scenario:ScenarioOverlay;identity:CalculationIdentity;analysisSettings?:AnalysisSettings} |
  {type:'CATALOG';query:CatalogQuery} | {type:'RUN_MODEL_QUALITY';scenario:ScenarioOverlay} |
  {type:'BUILD_N1_CATALOG';scenario:ScenarioOverlay;capacitySeason:CapacitySeason} |
  {type:'RUN_N1_SCREEN';scenario:ScenarioOverlay;options:N1ScreenOptions} |
  {type:'RUN_N1_DETAIL';scenario:ScenarioOverlay;candidateId:string;options:N1ScreenOptions} |
  {type:'CANCEL'} | {type:'SELF_TEST'});
export interface WorkerResponse {id:number;type:'RESULT'|'PROGRESS'|'ERROR';value?:unknown;stage?:string;detail?:Record<string,unknown>;error?:string}
