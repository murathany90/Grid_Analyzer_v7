import type {StationTopologyGraph} from '../../domain/model/station-topology';
const cache=new WeakMap<StationTopologyGraph,StationTopologyGraph>();
/** Build an immutable drawing projection. The original graph remains available
 * to analysis, navigation, scenario commands and the source evidence panel. */
export function sldDrawingGraph(graph:StationTopologyGraph):StationTopologyGraph{
 const prior=cache.get(graph);if(prior)return prior;
 const decisions=graph.sourceAudit?.switchDrawing??[],hidden=new Set(decisions.filter(r=>r.classification==='HIDE_NONFUNCTIONAL_SOURCE_LEAF').map(r=>r.switchId));
 if(!hidden.size){cache.set(graph,graph);return graph;}
 const switches=graph.switches.filter(s=>!hidden.has(s.id)),used=new Set([...switches.flatMap(s=>[s.from,s.to]),...graph.equipment.flatMap(e=>e.terminals),...graph.busSections.map(b=>b.id)]),remove=new Set(graph.switches.filter(s=>hidden.has(s.id)).flatMap(s=>[s.from,s.to]).filter(id=>!used.has(id)));
 const result={...graph,switches,terminals:graph.terminals.filter(t=>!remove.has(t.id)),feeders:graph.feeders.map(f=>({...f,switchIds:f.switchIds.filter(id=>!hidden.has(id)),terminalIds:f.terminalIds.filter(id=>!remove.has(id))}))};cache.set(graph,result);return result;
}
