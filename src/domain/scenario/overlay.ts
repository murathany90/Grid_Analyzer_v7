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
export interface ManeuverEvent { readonly id:string; readonly operationId:string; readonly order:number; readonly source:string; readonly action:string; readonly equipmentId:string; readonly before:unknown; readonly after:unknown; readonly timestamp:string }
export interface ScenarioSnapshot { readonly id:string; readonly name:string; readonly parentId:string|null; readonly modelHash:string; readonly studyCase:string; readonly createdAt:string; readonly scenarioHash:string; readonly overlay:ScenarioOverlay; readonly events:readonly ManeuverEvent[] }
function freezeOverlay(value:ScenarioOverlay):ScenarioOverlay { const copy=structuredClone(value);const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};freeze(copy);return copy; }
export class ScenarioStore {
  private value: ScenarioOverlay = freezeOverlay(emptyScenario());
  private records=new Map<string,ScenarioSnapshot>();
  private serial=0;
  readonly selectedId='working';
  commandSource='OPERATING';
  constructor(readonly modelHash='',readonly studyCase=''){const base=Object.freeze({id:'B0',name:'Baz',parentId:null,modelHash,studyCase,createdAt:new Date().toISOString(),scenarioHash:scenarioSignature(this.value),overlay:this.value,events:Object.freeze([])});this.records.set('B0',base);this.records.set('working',Object.freeze({...base,id:'working',name:'Senaryo',parentId:'B0'}));}
  get snapshots():readonly ScenarioSnapshot[]{return [...this.records.values()];}
  exportState(){return {version:2,modelHash:this.modelHash,studyCase:this.studyCase,selectedId:this.selectedId,snapshots:this.snapshots,history:this.history,serial:this.serial};}
  restoreState(value:ReturnType<ScenarioStore['exportState']>):boolean{
    if(value.version!==2||value.selectedId!=='working'||value.snapshots?.length!==2||!Array.isArray(value.history)||value.modelHash!==this.modelHash||value.studyCase!==this.studyCase)return false;
    const ids=new Set(value.snapshots.map(s=>s.id)),base=value.snapshots.find(s=>s.id==='B0');if(ids.size!==value.snapshots.length||!ids.has(value.selectedId)||!base||scenarioChanged(base.overlay)||base.parentId!==null)return false;
    if(!Number.isSafeInteger(value.serial)||value.serial<0||[...value.snapshots,...value.history].some(s=>s.modelHash!==this.modelHash||s.studyCase!==this.studyCase||s.scenarioHash!==scenarioSignature(s.overlay)||!Array.isArray(s.events)||s.parentId!==null&&!ids.has(s.parentId))||value.history.some(s=>s.id!=='working'||s.parentId!=='B0'))return false;
    if(!ids.has('working')||value.snapshots.find(s=>s.id==='working')?.parentId!=='B0')return false;
    const freeze=(s:ScenarioSnapshot):ScenarioSnapshot=>Object.freeze({...s,overlay:freezeOverlay(s.overlay),events:Object.freeze(structuredClone(s.events).map((e:ManeuverEvent)=>Object.freeze(e)))});
    this.records=new Map(value.snapshots.map(s=>[s.id,freeze(s)]));this.history=value.history.map(freeze);this.serial=value.serial;this.value=this.selected.overlay;this.revision++;return true;
  }

  get selected():ScenarioSnapshot{return this.records.get(this.selectedId)!;}
  private record(value:ScenarioOverlay,switchOrder:readonly string[]=[]):ScenarioSnapshot{const parent=this.selected,id=this.selectedId,operationId='maneuver-'+(++this.serial),timestamp=new Date().toISOString(),events:ManeuverEvent[]=[...parent.events];
    for(const key of ['lineStatus','transformerStatus','switchState','busOrTerminalStatus','generatorDispatch','loadAdjustments'] as const){for(const equipmentId of new Set([...(key==='switchState'?switchOrder:[]),...Object.keys(parent.overlay[key]),...Object.keys(value[key])])){const before=parent.overlay[key][equipmentId],after=value[key][equipmentId];if(JSON.stringify(before)!==JSON.stringify(after))events.push(Object.freeze({id:operationId+':'+events.length,operationId,order:events.length+1,source:this.commandSource,action:key,equipmentId,before,after,timestamp}));}}
    for(const equipmentId of new Set([...parent.overlay.restoredTerminals,...value.restoredTerminals])){const before=parent.overlay.restoredTerminals.includes(equipmentId),after=value.restoredTerminals.includes(equipmentId);if(before!==after)events.push(Object.freeze({id:operationId+':'+events.length,operationId,order:events.length+1,source:this.commandSource,action:'restoredTerminals',equipmentId,before,after,timestamp}));}
    this.history.push(parent);const snapshot=Object.freeze({...parent,createdAt:timestamp,scenarioHash:scenarioSignature(value),overlay:freezeOverlay(value),events:Object.freeze(events)});this.records.set(id,snapshot);this.value=snapshot.overlay;return snapshot;}

  private history: ScenarioSnapshot[] = [];
  revision = 0;
  get historyLength(): number { return this.history.length; }
  get canUndo(): boolean { return this.history.length>0; }
  get current(): ScenarioOverlay { return this.value; }
  replace(value: ScenarioOverlay): void { if(JSON.stringify(value)===JSON.stringify(this.value))return;this.record(value); this.revision++; }
  setStatus(key: StatusKey, id: string, value: boolean, source: boolean): void {
    if(key==='lineStatus' && value===source && this.value.energizations?.[id]) { this.rollbackEnergization(id); return; }
    const energizations=this.releaseOwnership(key,id);
    const values = { ...this.value[key] };
    if (value === source) delete values[id]; else values[id] = value;
    this.replace({ ...this.value, energizations, [key]: values, ...(key==='busOrTerminalStatus'?{restoredTerminals:this.value.restoredTerminals.filter(term=>term!==id)}:{}) });
  }
  setSwitchStates(switches:readonly {id:string;source:boolean}[],value:boolean|'source'):void {
    const states={...this.value.switchState};let energizations=this.value.energizations;
    for(const sw of switches){energizations=this.releaseOwnership('switchState',sw.id,energizations);const desired=value==='source'?sw.source:value;if(desired===sw.source)delete states[sw.id];else states[sw.id]=desired;}
    if(JSON.stringify(states)===JSON.stringify(this.value.switchState)&&JSON.stringify(energizations)===JSON.stringify(this.value.energizations))return;
    this.record({...this.value,energizations,switchState:states},switches.map(s=>s.id));this.revision++;
  }
  private releaseOwnership(key: StatusKey,id: string, operations=this.value.energizations) {
    const next=structuredClone(operations||{});
    for(const op of Object.values(next)) {
      if(key==='switchState'){op.switches=op.switches.filter(x=>x!==id);delete op.previousSwitches[id];}
      if(key==='busOrTerminalStatus'){op.terminals=op.terminals.filter(x=>x!==id);op.introducedTerminals=op.introducedTerminals.filter(x=>x!==id);delete op.previousTerminalStatus[id];}
    }
    return Object.keys(next).length?next:undefined;
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
  undo(): void { const previous = this.history.pop(); if (previous) { this.records.set(this.selectedId,previous);this.value=previous.overlay;this.revision++; } }
  reset(): void { this.history=[];this.serial=0;const base=this.records.get('B0')!;const current=Object.freeze({...base,id:this.selectedId,name:'Senaryo',parentId:'B0'});this.records.set(this.selectedId,current);this.value=current.overlay;this.revision++; }
}
