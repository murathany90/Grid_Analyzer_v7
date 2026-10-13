import type {Feeder,StationTopologyGraph} from '../../domain/model/station-topology';
import {feederDrawingPath} from './feeder-drawing-graph';
/** A source-native bar-to-bar circuit, never a name-based or guessed sequence.
 * Bays with an outgoing equipment/leaf remain ordinary feeders. */
export function nativeBarCircuit(graph:StationTopologyGraph,f:Feeder){
 const bars=new Set(f.busSectionIds),edges=graph.switches.filter(s=>f.switchIds.includes(s.id)&&s.from!==s.to);
 if(bars.size<2||f.equipmentKeys.length||f.terminalIds.some(id=>!bars.has(id)&&edges.filter(s=>s.from===id||s.to===id).length===1))return null;
 // A transfer selector at the outgoing DS is not evidence that an otherwise
 // unmodelled outgoing bay is a coupler. Keep its proven DS-CB-DS feeder axis.
 const main=feederDrawingPath(graph,f),last=edges.find(s=>s.id===main?.switchIds.at(-1));
 if(bars.size>=3&&last?.kind==='isolator')return null;
 const candidates:{terminals:string[];switchIds:string[]}[]=[];
 for(const start of [...bars].sort()){const paths=new Map([[start,{terminals:[start],switchIds:[] as string[]}]]),queue=[start];for(let i=0;i<queue.length;i++)for(const sw of edges){const next=sw.from===queue[i]?sw.to:sw.to===queue[i]?sw.from:null;if(!next||paths.has(next))continue;const path=paths.get(queue[i])!,p={terminals:[...path.terminals,next],switchIds:[...path.switchIds,sw.id]};paths.set(next,p);if(bars.has(next))candidates.push(p);else queue.push(next);}}
 return candidates.sort((a,b)=>b.switchIds.length-a.switchIds.length||a.terminals.join('|').localeCompare(b.terminals.join('|')))[0]??null;
}
