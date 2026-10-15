import type {Feeder,StationTopologyGraph} from '../../domain/model/station-topology';
import type {SldResultOverlay} from './result-overlay';
import {feederDrawingPath} from './feeder-drawing-graph';
import {labelValues,lfPowerRows} from './result-labels';

/** Native equipment terminals, never a reduced-bus injection or a guessed -FROM. */
export function feederReadout(graph:StationTopologyGraph,feeder:Feeder,overlay:SldResultOverlay|undefined){
 const mainEnd=feederDrawingPath(graph,feeder)?.terminals.at(-1)??feeder.terminalIds.find(id=>!feeder.busSectionIds.includes(id))??feeder.terminalIds[0];
 const candidates=graph.equipment.filter(e=>feeder.equipmentKeys.includes(e.sourceClass+'|'+e.id)).map(e=>{
  const local=e.terminals.filter(id=>feeder.terminalIds.includes(id)),terminal=local.includes(mainEnd)?mainEnd:local.length===1?local[0]:null;
  return {key:e.sourceClass+'|'+e.id,terminal};
 }).filter((e):e is {key:string;terminal:string}=>!!e.terminal);
 const available=candidates.find(c=>{const v=labelValues(overlay?.entries.get(c.key));return ['pFromMw','pToMw','pMw','qFromMvar','qToMvar','qMvar'].some(k=>typeof v[k]==='number'&&Number.isFinite(v[k]));}),selected=available??candidates[0],key=selected?.key,terminal=selected?.terminal??mainEnd,entry=key?overlay?.entries.get(key):undefined,rows=lfPowerRows(overlay,key,terminal),v=labelValues(entry);
 const shown=rows.some(row=>!row.includes('—')),side=v.toTerminal===terminal?'TO':'FROM';
 const reason=shown?'VALIDATED_NATIVE_EQUIPMENT_RESULT':!feeder.equipmentKeys.length?'NO_RESULT_BEARING_EQUIPMENT':!entry?'NO_EQUIPMENT_RESULT_IN_SNAPSHOT':/^(?:NOT_RUN|STALE|BLOCKED|UNSUPPORTED)/.test(entry.status)?entry.status:'NO_VALIDATED_NATIVE_QUANTITY';
 return {key,terminal,entry,rows,shown,side,reason};
}
