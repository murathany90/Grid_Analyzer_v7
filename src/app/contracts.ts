import type { CanonicalNetwork } from '../domain/model/network';
import type { AnalysisType } from '../domain/calculation/identity';
import type { ResultStore } from '../domain/results/store';
import type { ScenarioStore, StatusKey } from '../domain/scenario/overlay';
import type { SettingsStore } from '../persistence/settings';
import type { VoltageBand } from '../domain/model/voltage-band';
import type { EngineeringContext } from '../domain/dgs-semantics/context';
import type { ModelQualityAuditResult } from '../domain/model-quality';
import type { N1Progress, N1ScreenOptions, N1ScreenResult } from '../domain/n1';
import type { N1CandidateCatalog } from '../domain/n1/catalog';
import type { CapacitySeason } from '../domain/model/capacity';
export interface CatalogQuery { className: string; search?: string; siteId?: string; areaId?: string; voltage?: number; voltageBands?: VoltageBand[]; page?: number; pageSize?: number; sort?: string; descending?: boolean }
export interface CatalogRow { id: string; name: string; siteIds: string[]; attributes: Record<string, unknown>; context?: EngineeringContext }
export interface CatalogPage { rows: CatalogRow[]; total: number; attributes: string[] }
export interface AppContext {
  network: CanonicalNetwork | null;
  modelQualityResult: ModelQualityAuditResult | null;
  modelQualityScenarioHash: string | null;
  modelQualityAnalysisScope: 'base'|'scenario'|null;
  n1Result: N1ScreenResult | null;
  n1Progress: N1Progress | null;
  n1CatalogResult: N1CandidateCatalog | null;
  n1CatalogIdentity: { modelHash:string; scenarioHash:string; analysisScope:'base'|'scenario'; capacitySeason:CapacitySeason } | null;
  resultStore: ResultStore; scenario: ScenarioStore; settings: SettingsStore;
  selection: { id: string; sourceClass: string } | null;
  filters: { areaId: string; siteId: string; voltages: Set<VoltageBand>; search: string };
  busy: boolean; status: string; view: string;
  subscribe(fn: () => void): () => void;
  notify(): void; setView(view: string): void;
  loadFiles(files: FileList | File[]): Promise<void>;
  run(type: AnalysisType, requestedRole?: 'base'|'scenario'): Promise<void>; cancel(): void;
  runModelQuality(scope:'base'|'scenario'): Promise<void>;
  loadN1Catalog(scope:'base'|'scenario',season:CapacitySeason):Promise<void>;
  runN1Screen(options:N1ScreenOptions):Promise<void>;
  catalog(query: CatalogQuery): Promise<CatalogPage>;
  select(id: string, sourceClass: string, view?: string): void;
  setStatus(key: StatusKey, id: string, value: boolean, source: boolean, calculate?: boolean): Promise<void>;
  setBusStatus(termIds: readonly string[], value: boolean | 'source', calculate?: boolean): Promise<void>;
  clearModel(): void;
  resetScenario(): void; undoScenario(): void;
  setMessage(message: string): void;
}
export interface Feature { element: HTMLElement; render(): void; dispose?(): void }
