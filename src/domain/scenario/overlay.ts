import type { CanonicalNetwork } from '../model/network';

export interface ScenarioOverlay {
  readonly lineStatus: Readonly<Record<string, boolean>>;
  readonly transformerStatus: Readonly<Record<string, boolean>>;
  readonly switchState: Readonly<Record<string, boolean>>;
  readonly busOrTerminalStatus: Readonly<Record<string, boolean>>;
  readonly generatorDispatch: Readonly<Record<string, { pMw: number; qMvar?: number }>>;
  readonly loadAdjustments: Readonly<Record<string, { pMw: number; qMvar: number }>>;
  readonly restoredTerminals: readonly string[];
}
export const emptyScenario = (): ScenarioOverlay => ({ lineStatus: {}, transformerStatus: {}, switchState: {}, busOrTerminalStatus: {}, generatorDispatch: {}, loadAdjustments: {}, restoredTerminals: [] });
export function scenarioChanged(s: ScenarioOverlay): boolean { return Object.values(s).some(v => Object.keys(v).length > 0); }
export function scenarioSignature(s: ScenarioOverlay): string {
  return JSON.stringify(Object.entries(s).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key,
    Array.isArray(value) ? [...value].sort() : Object.entries(value).sort(([a], [b]) => a.localeCompare(b))]));
}
export function effectiveNetwork(n: CanonicalNetwork, s: ScenarioOverlay): CanonicalNetwork {
  const restored = new Set(s.restoredTerminals);
  return { ...n,
    lines: n.lines.map(e => e.id in s.lineStatus ? { ...e, inService: s.lineStatus[e.id] } : e),
    transformers: n.transformers.map(e => e.id in s.transformerStatus ? { ...e, inService: s.transformerStatus[e.id] } : e),
    switches: n.switches.map(e => e.id in s.switchState ? { ...e, closed: s.switchState[e.id] } : e),
    buses: n.buses.map(e => e.id in s.busOrTerminalStatus ? { ...e, inService: s.busOrTerminalStatus[e.id] } : restored.has(e.id) ? { ...e, inService: true } : e),
    generators: n.generators.map(e => s.generatorDispatch[e.id] ? { ...e, ...s.generatorDispatch[e.id] } : e),
    loads: n.loads.map(e => s.loadAdjustments[e.id] ? { ...e, ...s.loadAdjustments[e.id] } : e),
  };
}
export type StatusKey = 'lineStatus' | 'transformerStatus' | 'busOrTerminalStatus' | 'switchState';
export class ScenarioStore {
  private value: ScenarioOverlay = emptyScenario();
  private history: ScenarioOverlay[] = [];
  get current(): ScenarioOverlay { return this.value; }
  replace(value: ScenarioOverlay): void { this.history.push(this.value); this.value = structuredClone(value); }
  setStatus(key: StatusKey, id: string, value: boolean, source: boolean): void {
    const values = { ...this.value[key] };
    if (value === source) delete values[id]; else values[id] = value;
    this.replace({ ...this.value, [key]: values });
  }
  restoreTerminals(ids: readonly string[]): void { this.replace({ ...this.value, restoredTerminals: [...new Set([...this.value.restoredTerminals, ...ids])] }); }
  undo(): void { this.value = this.history.pop() ?? this.value; }
  reset(): void { this.replace(emptyScenario()); }
}
