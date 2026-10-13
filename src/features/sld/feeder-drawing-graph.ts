import type {Feeder,StationTopologyGraph} from '../../domain/model/station-topology';

export interface FeederDrawingPath {terminals:string[];switchIds:string[];branchSwitchIds:string[]}
/** A presentation path through real switch endpoints. Position and FID sorting never
 * establish device sequence. A short transfer bypass is kept separate from the
 * longer proven series path; equal paths use a stable source identity tie-break. */
export function feederDrawingPath(graph:StationTopologyGraph,feeder:Feeder):FeederDrawingPath|null {
 const bars=new Set(feeder.busSectionIds),local=new Set(feeder.terminalIds),edges=graph.switches.filter(s=>feeder.switchIds.includes(s.id)&&s.from!==s.to&&local.has(s.from)&&local.has(s.to));
 let targets=[...new Set(graph.equipment.filter(e=>feeder.equipmentKeys.includes(e.sourceClass+'|'+e.id)).flatMap(e=>e.terminals).filter(id=>local.has(id)&&!bars.has(id)))];
 // A source bay may end at native switch terminals without a canonical branch
 // object (e.g. MV feeders or a coupler). Internal degree, not a name or a fake
 // equipment object, identifies the endpoints of these real source paths.
 if(!targets.length)targets=[...local].filter(id=>!bars.has(id)&&edges.filter(s=>!bars.has(s.from)&&!bars.has(s.to)&&(s.from===id||s.to===id)).length<=1);
 const candidates:{terminals:string[];switchIds:string[]}[]=[];
 for(const bar of [...bars].sort()){
  const paths=new Map([[bar,{terminals:[bar],switchIds:[] as string[]}]]),queue=[bar];
  for(let i=0;i<queue.length;i++)for(const s of edges){const id=s.from===queue[i]?s.to:s.to===queue[i]?s.from:null;if(!id||paths.has(id)||bars.has(id))continue;const p=paths.get(queue[i])!;paths.set(id,{terminals:[...p.terminals,id],switchIds:[...p.switchIds,s.id]});queue.push(id);}
  for(const target of targets){const p=paths.get(target);if(p)candidates.push(p);}
 }
 const main=candidates.sort((a,b)=>b.switchIds.length-a.switchIds.length||a.terminals.join('|').localeCompare(b.terminals.join('|')))[0];
 return main?{...main,branchSwitchIds:edges.filter(s=>!main.switchIds.includes(s.id)).map(s=>s.id)}:null;
}
