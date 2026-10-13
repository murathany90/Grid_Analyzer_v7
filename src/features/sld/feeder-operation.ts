import type {Feeder,StationTopologyGraph} from '../../domain/model/station-topology';
import {feederDrawingPath} from './feeder-drawing-graph';

/** Operate only the proven main circuit. Alternative bus selectors, transfer
 * bypasses, earthing branches and ambiguous multi-breaker bays stay untouched. */
export function feederOperation(graph:StationTopologyGraph,feeder:Feeder,effective?:ReadonlyMap<string,{closed:boolean;inService:boolean}>){
 const path=feederDrawingPath(graph,feeder),chain=path?.switchIds.map(id=>graph.switches.find(s=>s.id===id)!)??[],breakers=chain.filter(s=>s.kind==='breaker');
 const end=path?.terminals.at(-1),target=graph.equipment.some(e=>feeder.equipmentKeys.includes(e.sourceClass+'|'+e.id)&&e.terminals.includes(end??'')),endDegree=graph.switches.filter(s=>feeder.switchIds.includes(s.id)&&s.from!==s.to&&(s.from===end||s.to===end)).length;
 const excludedSwitchIds=feeder.switchIds.filter(id=>!chain.some(s=>s.id===id)),unsafe=effective&&excludedSwitchIds.some(id=>{const sw=graph.switches.find(s=>s.id===id),state=effective.get(id);return !sw?.stateKnown||!state||state.inService&&state.closed;});
 const reason=!path?'Ana devre kaynak uçları çözümlenemedi':breakers.length!==1?'Tek ana kesici kanıtı yok':!target&&endDegree!==1?'Fider çıkışı / kuplaj işletme yolu tekil değil; cihaz manevrasını kullanın':chain.some(s=>!s.stateKnown)?'Ana devrede bilinmeyen cihaz konumu var':chain.some(s=>!['breaker','isolator','load-break-disconnector'].includes(s.kind))?'Ana devrede toplu işletme kapsamı belirsiz cihaz var':unsafe?'BLOCKED / UNKNOWN: alternatif besleme veya bypass konumu güvenli toplu sıra için yeterince kanıtlı değil':null;
 return {ready:reason===null,reason,switches:reason?[]:chain,excludedSwitchIds};
}
/** Atomic scenario simulation with an explicit, auditable operation sequence. */
export function feederCommandIds(plan:ReturnType<typeof feederOperation>,value:boolean|'source',source:ReadonlyMap<string,{closed:boolean}>){
 const rank=(s:typeof plan.switches[number])=>{const close=value==='source'?source.get(s.id)?.closed:value;return close===false?(s.kind==='breaker'?0:1):(s.kind==='breaker'?3:2);};
 return [...plan.switches].sort((a,b)=>rank(a)-rank(b)).map(s=>s.id);
}
