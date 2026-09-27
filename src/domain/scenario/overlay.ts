import type { CanonicalNetwork } from '../model/network';

export interface ScenarioOverlay {
  /** Provenance only: deliberately excluded from calculation identity. */
  readonly energizations?: Readonly<Record<string, EnergizationOperation>>;
  readonly lineStatus: Readonly<Record<string, boolean>>;
  readonly transformerStatus: Readonly<Record<string, boolean>>;
  readonly switchState: Readonly<Record<string, boolean>>;
  readonly busOrTerminalStatus: Readonly<Record<string, boolean>>;
  readonly generatorDispatch: Readonly<Record<string, { pMw: number; qMvar?: number }>>;
  readonly loadAdjustments: Readonly<Record<string, { pMw: number; qMvar: number }>>;
  readonly restoredTerminals: readonly string[];
}
export interface EnergizationOperation {
  type: 'energization'; lineId: string; previousLineStatus?: boolean;
  terminals: string[]; switches: string[];
  introducedTerminals: string[]; previousSwitches: Record<string, boolean | null>;
  previousTerminalStatus: Record<string, boolean | null>;
}
export const emptyScenario = (): ScenarioOverlay => ({ lineStatus: {}, transformerStatus: {}, switchState: {}, busOrTerminalStatus: {}, generatorDispatch: {}, loadAdjustments: {}, restoredTerminals: [] });
export function scenarioChanged(s: ScenarioOverlay): boolean { return Object.entries(s).some(([k,v]) => k !== 'energizations' && Object.keys(v).length > 0); }
export function calculationScenario(s: ScenarioOverlay, role: 'base'|'scenario'): ScenarioOverlay { return role === 'base' ? emptyScenario() : structuredClone(s); }
export function scenarioSignature(s: ScenarioOverlay): string {
  return JSON.stringify(Object.entries(s).filter(([k])=>k!=='energizations').sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key,
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
    if(key==='lineStatus' && value===source && this.value.energizations?.[id]) { this.rollbackEnergization(id); return; }
    const energizations=this.releaseOwnership(key,id);
    const values = { ...this.value[key] };
    if (value === source) delete values[id]; else values[id] = value;
    this.replace({ ...this.value, energizations, [key]: values, ...(key==='busOrTerminalStatus'?{restoredTerminals:this.value.restoredTerminals.filter(term=>term!==id)}:{}) });
  }
  private releaseOwnership(key: StatusKey,id: string, operations=this.value.energizations) {
    const next=structuredClone(operations||{});
    for(const op of Object.values(next)) {
      if(key==='switchState'){op.switches=op.switches.filter(x=>x!==id);delete op.previousSwitches[id];}
      if(key==='busOrTerminalStatus'){op.terminals=op.terminals.filter(x=>x!==id);op.introducedTerminals=op.introducedTerminals.filter(x=>x!==id);delete op.previousTerminalStatus[id];}
    }
    return next;
  }
  private rollbackEnergization(id:string) {
    const next=structuredClone(this.value),operations:Record<string,EnergizationOperation>=structuredClone(next.energizations||{}),op=operations[id];delete operations[id];
    const lines={...next.lineStatus},switches={...next.switchState},termStatus={...next.busOrTerminalStatus},restored=new Set(next.restoredTerminals);
    if(op.previousLineStatus===undefined)delete lines[id];else lines[id]=op.previousLineStatus;
    for(const term of new Set([...op.introducedTerminals,...Object.keys(op.previousTerminalStatus)])){const dependent=Object.values(operations).find(o=>o.terminals.includes(term));if(dependent){if(op.introducedTerminals.includes(term))dependent.introducedTerminals.push(term);dependent.previousTerminalStatus[term]=op.previousTerminalStatus[term];}else{if(op.introducedTerminals.includes(term))restored.delete(term);if(op.previousTerminalStatus[term]==null)delete termStatus[term];else termStatus[term]=op.previousTerminalStatus[term]!;}}
    for(const [sw,previous] of Object.entries(op.previousSwitches)){const dependent=Object.values(operations).find(o=>o.switches.includes(sw));if(dependent)dependent.previousSwitches[sw]=previous;else if(previous==null)delete switches[sw];else switches[sw]=previous;}
    this.replace({...next,lineStatus:lines,switchState:switches,busOrTerminalStatus:termStatus,restoredTerminals:[...restored],energizations:operations});
  }
  restoreTerminals(ids: readonly string[]): void { let energizations=this.value.energizations;for(const id of ids)energizations=this.releaseOwnership('busOrTerminalStatus',id,energizations);this.replace({ ...this.value, energizations, restoredTerminals: [...new Set([...this.value.restoredTerminals, ...ids])] }); }
  setBusStatus(terminals: readonly { id: string; source: boolean }[], value: boolean | 'source'): void {
    const values = { ...this.value.busOrTerminalStatus };
    let energizations=this.value.energizations;
    for (const terminal of terminals) {
      energizations=this.releaseOwnership('busOrTerminalStatus',terminal.id,energizations);
      const desired = value === 'source' ? terminal.source : value;
      if (desired === terminal.source) delete values[terminal.id]; else values[terminal.id] = desired;
    }
    const ids=new Set(terminals.map(terminal=>terminal.id));
    this.replace({ ...this.value, energizations, busOrTerminalStatus: values,restoredTerminals:this.value.restoredTerminals.filter(id=>!ids.has(id)) });
  }
  undo(): void { const previous = this.history.pop(); if (previous) { this.value = previous; this.revision++; } }
  reset(): void { this.replace(emptyScenario()); }
}
