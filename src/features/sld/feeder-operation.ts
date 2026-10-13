import type {Feeder,StationTopologyGraph} from '../../domain/model/station-topology';
import {feederDrawingPath} from './feeder-drawing-graph';

/** Operate only the proven main circuit. Alternative bus selectors, transfer
 * bypasses, earthing branches and ambiguous multi-breaker bays stay untouched. */
export function feederOperation(graph:StationTopologyGraph,feeder:Feeder){
 const path=feederDrawingPath(graph,feeder),chain=path?.switchIds.map(id=>graph.switches.find(s=>s.id===id)!)??[],breakers=chain.filter(s=>s.kind==='breaker');
 const end=path?.terminals.at(-1),target=graph.equipment.some(e=>feeder.equipmentKeys.includes(e.sourceClass+'|'+e.id)&&e.terminals.includes(end??'')),endDegree=graph.switches.filter(s=>feeder.switchIds.includes(s.id)&&s.from!==s.to&&(s.from===end||s.to===end)).length;
 const reason=!path?'Ana devre kaynak uçları çözümlenemedi':breakers.length!==1?'Tek ana kesici kanıtı yok':!target&&endDegree!==1?'Fider çıkışı / kuplaj işletme yolu tekil değil; cihaz manevrasını kullanın':chain.some(s=>!s.stateKnown)?'Ana devrede bilinmeyen cihaz konumu var':chain.some(s=>!['breaker','isolator','load-break-disconnector'].includes(s.kind))?'Ana devrede toplu işletme kapsamı belirsiz cihaz var':null;
 return {ready:reason===null,reason,switches:reason?[]:chain,excludedSwitchIds:feeder.switchIds.filter(id=>!chain.some(s=>s.id===id))};
}
