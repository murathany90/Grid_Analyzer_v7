import type { CanonicalNetwork } from '../domain/model/network';
import type { AnalysisType } from '../domain/calculation/identity';
import type { ResultStore } from '../domain/results/store';
import type { ScenarioStore, StatusKey } from '../domain/scenario/overlay';
import type { SettingsStore } from '../persistence/settings';
export interface CatalogQuery { className: string; search?: string; siteId?: string; areaId?: string; voltage?: number; page?: number; pageSize?: number; sort?: string; descending?: boolean }
export interface CatalogRow { id: string; name: string; siteIds: string[]; attributes: Record<string, unknown> }
export interface CatalogPage { rows: CatalogRow[]; total: number; attributes: string[] }
export interface AppContext {
  network: CanonicalNetwork | null;
  resultStore: ResultStore; scenario: ScenarioStore; settings: SettingsStore;
  selection: { id: string; sourceClass: string } | null;
  filters: { areaId: string; siteId: string; voltages: Set<number>; search: string };
  busy: boolean; status: string; view: string;
  subscribe(fn: () => void): () => void;
  notify(): void; setView(view: string): void;
  loadFiles(files: FileList | File[]): Promise<void>;
  run(type: AnalysisType): Promise<void>; cancel(): void;
  catalog(query: CatalogQuery): Promise<CatalogPage>;
  select(id: string, sourceClass: string, view?: string): void;
  setStatus(key: StatusKey, id: string, value: boolean, source: boolean, calculate?: boolean): Promise<void>;
  resetScenario(): void; undoScenario(): void;
  setMessage(message: string): void;
}
export interface Feature { element: HTMLElement; render(): void; dispose?(): void }
