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
  revision = 0;
  get historyLength(): number { return this.history.length; }
  get current(): ScenarioOverlay { return this.value; }
  replace(value: ScenarioOverlay): void { this.history.push(this.value); this.value = structuredClone(value); this.revision++; }
  setStatus(key: StatusKey, id: string, value: boolean, source: boolean): void {
    const values = { ...this.value[key] };
    if (value === source) delete values[id]; else values[id] = value;
    this.replace({ ...this.value, [key]: values, ...(key==='busOrTerminalStatus'?{restoredTerminals:this.value.restoredTerminals.filter(term=>term!==id)}:{}) });
  }
  restoreTerminals(ids: readonly string[]): void { this.replace({ ...this.value, restoredTerminals: [...new Set([...this.value.restoredTerminals, ...ids])] }); }
  setBusStatus(terminals: readonly { id: string; source: boolean }[], value: boolean | 'source'): void {
    const values = { ...this.value.busOrTerminalStatus };
    for (const terminal of terminals) {
      const desired = value === 'source' ? terminal.source : value;
      if (desired === terminal.source) delete values[terminal.id]; else values[terminal.id] = desired;
    }
    const ids=new Set(terminals.map(terminal=>terminal.id));
    this.replace({ ...this.value, busOrTerminalStatus: values,restoredTerminals:this.value.restoredTerminals.filter(id=>!ids.has(id)) });
  }
  undo(): void { const previous = this.history.pop(); if (previous) { this.value = previous; this.revision++; } }
  reset(): void { this.replace(emptyScenario()); }
}
