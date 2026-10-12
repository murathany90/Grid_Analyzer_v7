import type {StationTopologyGraph} from '../../domain/model/station-topology';
import {layoutStation} from '../../domain/model/station-topology';
import type {VoltageBand} from '../../domain/model/voltage-band';
export interface PortPosition {x:number;y:number;terminalId:string;semantics:'busbar-section'|'bay-terminal'|'equipment-terminal'}
/** Presentation only. Each wire references an existing native terminal pair, never a power-system edge. */
export function physicalStationLayout(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>,compact=false){
  const base=layoutStation(graph,bands),ports=new Map<string,PortPosition>();
  const sections=new Set(graph.busSections.map(s=>s.id));
  const placed=new Set<string>();
  for(const level of base.levels){
    const bars=base.sections.filter(s=>s.section.voltageKv===level.kv),feeders=base.feeders.filter(p=>p.feeder.voltageKv===level.kv);
    const bottom=Math.max(level.y+30,...bars.map(b=>b.y));
    for(const p of feeders){
      const ids=p.feeder.terminalIds.filter(id=>!sections.has(id)&&graph.terminals.some(t=>t.id===id&&t.vnKv===level.kv));
      const distance=new Map(bars.map(b=>[b.section.id,0])),queue=[...distance.keys()];
      if(!bars.length){const root=ids.find(id=>graph.equipment.some(e=>['generator','load','externalGrid'].includes(e.kind)&&e.terminals.includes(id)))??ids[0];if(root){distance.set(root,0);queue.push(root);}}
      for(let i=0;i<queue.length;i++)for(const sw of graph.switches.filter(s=>p.feeder.switchIds.includes(s.id)&&s.from!==s.to)){
        const next=sw.from===queue[i]?sw.to:sw.to===queue[i]?sw.from:null;
        if(next&&ids.includes(next)&&!distance.has(next)){distance.set(next,distance.get(queue[i])!+1);queue.push(next);}
      }
      const ranks=new Map<number,number>();
      for(const id of ids){if(placed.has(id))continue;const depth=distance.get(id)??Math.max(1,...distance.values())+1,count=ranks.get(depth)??0;ranks.set(depth,count+1);
        const row=bars.length?depth:Math.max(...distance.values())-depth+1;
        ports.set(id,{x:p.x+count*30,y:bottom+row*(compact?36:48),terminalId:id,semantics:graph.equipment.some(e=>e.terminals.includes(id))?'equipment-terminal':'bay-terminal'});placed.add(id);
      }
    }
    // Isolated native terminals remain visible; no guessed connection is made.
    let extra=0;for(const t of graph.terminals.filter(t=>t.vnKv===level.kv&&!sections.has(t.id)&&!ports.has(t.id)))ports.set(t.id,{x:260+extra++*100,y:bottom+60,terminalId:t.id,semantics:'equipment-terminal'});
  }
  // A barless GSU/generator circuit follows its source-connected HV bay. Move the
  // entire LV switch component together; shared ports remain one physical point.
  const aligned=new Set<string>();
  for(const e of graph.equipment.filter(e=>e.kind==='transformer'&&e.terminals.length===2)){
    const a=ports.get(e.terminals[0]),b=ports.get(e.terminals[1]),kv=graph.terminals.find(t=>t.id===e.terminals[1])?.vnKv;
    if(!a||!b||aligned.has(b.terminalId)||graph.busSections.some(s=>s.voltageKv===kv))continue;
    const component=new Set([b.terminalId]),queue=[b.terminalId];for(let i=0;i<queue.length;i++)for(const sw of graph.switches){const next=sw.from===queue[i]?sw.to:sw.to===queue[i]?sw.from:null;if(next&&ports.has(next)&&graph.terminals.find(t=>t.id===next)?.vnKv===kv&&!component.has(next)){component.add(next);queue.push(next);}}
    const mainBay=graph.terminals.find(t=>t.id===b.terminalId)?.parentId;
    for(const id of component){const p=ports.get(id)!,bay=graph.terminals.find(t=>t.id===id)?.parentId;p.x=a.x+(bay&&bay!==mainBay&&graph.feeders.some(f=>f.id===bay)?70:0);aligned.add(id);}
  }
  for(const b of base.sections)ports.set(b.section.id,{x:b.x1,y:b.y,terminalId:b.section.id,semantics:'busbar-section'});
  const routes=graph.switches.map((sw,i)=>{
    const a=ports.get(sw.from),b=ports.get(sw.to);if(!a||!b||sw.from===sw.to)return {sw,a,b,points:[] as [number,number][]};
    const aa=sections.has(sw.from)?{...a,x:sections.has(sw.to)?235+i*5:b.x}:a,bb=sections.has(sw.to)?{...b,x:aa.x}:b;
    const mid=(aa.y+bb.y)/2;
    return {sw,a:aa,b:bb,points:[[aa.x,aa.y],[aa.x,mid],[bb.x,mid],[bb.x,bb.y]] as [number,number][]};
  });
  const transformers=graph.equipment.filter(e=>e.kind==='transformer').map(e=>({equipment:e,ports:e.terminals.map(id=>ports.get(id)).filter((p):p is PortPosition=>!!p)}));
  const maxY=Math.max(base.height,...[...ports.values()].map(p=>p.y+140));
  return {...base,height:maxY,ports,routes,transformers};
}
