import type {AppContext} from '../../app/contracts';
import {VOLTAGE_BANDS,allVoltageBands,voltageMatches,type VoltageBand} from '../model/voltage-band';
import type {CompactRow} from '../../features/analysis/compact-rows';
/** Display scope shared by map, Lightning and Analysis; nominal kV and solver inputs stay native. */
export const scNodeFilter=(ctx:AppContext)=>ctx.resultView.scNodeKind??'PHYSICAL_BUS';
export function voltageGroupValue(ctx:AppContext){const bands=ctx.filters.voltages;return bands.size===VOLTAGE_BANDS.length?'':bands.size===1?[...bands][0]:'__selection';}
export function voltageGroupLabel(ctx:AppContext){return ctx.filters.voltages.size===VOLTAGE_BANDS.length?'Tümü':VOLTAGE_BANDS.filter(b=>ctx.filters.voltages.has(b.id)).map(b=>b.label).join(' + ')||'Seçim yok';}
export function selectVoltageGroup(ctx:AppContext,value:string){if(value==='__selection')return;ctx.filters.voltages=value?new Set([value as VoltageBand]):allVoltageBands();if(ctx.benchmarkMap?.analysis==='SC')ctx.benchmarkMap={...ctx.benchmarkMap,voltageKv:undefined};}
export function populateVoltageGroups(select:HTMLSelectElement,ctx:AppContext){const options=[['','Tümü'],...VOLTAGE_BANDS.map(b=>[b.id,b.label])];if(voltageGroupValue(ctx)==='__selection')options.push(['__selection',voltageGroupLabel(ctx)]);const key=JSON.stringify(options);if(select.dataset.groups!==key){select.dataset.groups=key;select.replaceChildren(...options.map(([v,label])=>new Option(label,v)));}select.value=voltageGroupValue(ctx);}
export function scScopeRows<T extends Pick<CompactRow,'kv'|'raw'>>(ctx:AppContext,rows:readonly T[],kind=scNodeFilter(ctx)){return rows.filter(r=>voltageMatches(r.kv,ctx.filters.voltages)&&(!kind||r.raw.nodeKind===kind));}
