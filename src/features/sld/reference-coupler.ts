import type {StationTopologyGraph} from '../../domain/model/station-topology';
import type {FeederCompartment,Point,PortPosition,SwitchSlot,WireSegment} from './physical-layout';
/** Proven bar-to-bar circuits are vertical bays below a compact rail bundle.
 * Every glyph uses the original switch and original native terminal identities. */
export function referenceCoupler(graph:StationTopologyGraph,feeder:StationTopologyGraph['feeders'][number],circuit:{terminals:string[];switchIds:string[]},ports:Map<string,PortPosition>,routes:SwitchSlot[],cell:FeederCompartment,rails:readonly {section:{id:string};y:number;x1:number;x2:number}[]){
 const bars=new Set(graph.busSections.map(b=>b.id)),edges=graph.switches.filter(s=>feeder.switchIds.includes(s.id)),levelBars=new Set(graph.busSections.filter(b=>b.voltageKv===feeder.voltageKv).map(b=>b.id)),ownRails=rails.filter(r=>levelBars.has(r.section.id)),origin=Math.max(...ownRails.map(r=>r.y)),axis=cell.axis;
 const nodes=circuit.terminals.filter(id=>!bars.has(id));
 const laneFor=(id:string,wanted:number,switchId:string,reserved:readonly number[]=[])=>{const rail=rails.find(r=>r.section.id===id)!,lo=rail.x1+24,hi=rail.x2-24,base=Math.max(lo,Math.min(hi,wanted)),other=routes.filter(r=>r.sw.id!==switchId),used=[...reserved,...other.filter(r=>r.sw.bayId!==feeder.id).flatMap(r=>[r.a,r.b].filter(p=>p?.semantics==='busbar-section'&&p.terminalId===id).map(p=>p!.x)),...other.filter(r=>(r.ordering==='INTERBUS_CIRCUIT'||r.ordering==='BAR_ATTACHMENT')&&Math.abs(r.y-origin-40)<36).map(r=>r.x)];
  for(let n=0;n<=Math.ceil((hi-lo)/32);n++)for(const x of n?[base+n*32,base-n*32]:[base])if(x>=lo&&x<=hi&&used.every(u=>Math.abs(u-x)>=30))return x;
  return base;
 };
 if(!nodes.length&&edges.length===1){const r=routes.find(r=>r.sw.id===edges[0].id)!,from=rails.find(b=>b.section.id===r.sw.from)!,to=rails.find(b=>b.section.id===r.sw.to)!;
  // A real section breaker joins side-by-side rails through their gap. It is
  // never routed back through another feeder or around the station envelope.
  const gapClear=!rails.some(r=>r!==from&&r!==to&&r.y===from.y&&r.x1<Math.max(from.x1,to.x1)&&r.x2>Math.min(from.x2,to.x2));
  const gapCenter=(Math.min(from.x2,to.x2)+Math.max(from.x1,to.x1))/2,glyphClear=!routes.some(o=>o.sw.id!==r.sw.id&&o.ordering==='INTERBUS_CIRCUIT'&&Math.abs(o.x-gapCenter)<36&&Math.abs(o.y-from.y)<30);
  if(from.y===to.y&&gapClear&&glyphClear&&(from.x2<to.x1||to.x2<from.x1)){const forward=from.x2<to.x1,sign=forward?1:-1,start:Point=[forward?from.x2:from.x1,from.y],end:Point=[forward?to.x1:to.x2,to.y];
   r.x=(start[0]+end[0])/2;r.y=from.y;r.rotation=sign>0?-90:90;r.inline=false;r.fixedCell=true;r.ordering='INTERBUS_CIRCUIT';r.a={...ports.get(r.sw.from)!,x:start[0]};r.b={...ports.get(r.sw.to)!,x:end[0]};r.contactFrom=[r.x-sign*16,r.y];r.contactTo=[r.x+sign*16,r.y];r.wires=[{points:[start,r.contactFrom],terminalId:r.sw.from,side:'FROM',contact:r.contactFrom},{points:[r.contactTo,end],terminalId:r.sw.to,side:'TO',contact:r.contactTo}];r.points=r.wires.flatMap(w=>w.points);return;
  }
  const lane=laneFor(from.section.id,axis,r.sw.id),returnLane=laneFor(to.section.id,axis+32,r.sw.id,[lane]);
  r.x=lane;r.y=origin+40;r.rotation=0;r.inline=false;r.fixedCell=true;r.ordering='INTERBUS_CIRCUIT';r.a={...ports.get(r.sw.from)!,x:lane};r.b={...ports.get(r.sw.to)!,x:returnLane};r.contactFrom=[lane,origin+24];r.contactTo=[lane,origin+56];r.wires=[{points:[[lane,from.y],r.contactFrom],terminalId:r.sw.from,side:'FROM',contact:r.contactFrom},{points:[r.contactTo,[lane,origin+72],[returnLane,origin+72],[returnLane,to.y]],terminalId:r.sw.to,side:'TO',contact:r.contactTo}];r.points=r.wires.flatMap(w=>w.points);return;
 }
 nodes.forEach((id,i)=>{const p=ports.get(id)!;p.x=axis;p.y=origin+66+i*48;p.direction=1;p.seriesFeeder=feeder.id;p.seriesRank=i+1;});
 const switches=circuit.switchIds.map(id=>edges.find(e=>e.id===id)!);
 // Each real selector has its own return lane. Both selectors at the upper
 // source fork meet that exact fork; the outgoing selector meets the lower one.
 let branch=0;for(const s of edges){const r=routes.find(r=>r.sw.id===s.id)!;if(!r)continue;
  r.a={...ports.get(s.from)!};r.b={...ports.get(s.to)!};r.fixedCell=true;r.inline=false;r.ordering='INTERBUS_CIRCUIT';
  const fromBar=bars.has(s.from),toBar=bars.has(s.to),bar=fromBar?r.a:toBar?r.b:null,node=fromBar?r.b:toBar?r.a:null;
  if(bar&&node){const first=s.id===switches[0].id,lane=laneFor(bar.terminalId,first?axis:axis+32*++branch,s.id),sign=fromBar?1:-1;
   bar.x=lane;r.x=lane;r.y=origin+40;r.rotation=sign>0?0:180;r.contactFrom=[lane,r.y-sign*16];r.contactTo=[lane,r.y+sign*16];
   const lead:Point[]=[[lane,bar.y],[lane,origin+24]],tail:Point[]=[[lane,origin+56],[lane,node.y],[node.x,node.y]];
   const w=(points:Point[],terminalId:string,side:'FROM'|'TO'):WireSegment=>({points,terminalId,side,contact:side==='FROM'?points.at(-1)!:points[0]});
   r.wires=fromBar?[w(lead,s.from,'FROM'),w(tail,s.to,'TO')]:[w([...tail].reverse(),s.from,'FROM'),w([...lead].reverse(),s.to,'TO')];
  }else{
   const sign=r.b.y>=r.a.y?1:-1;r.x=axis;r.y=(r.a.y+r.b.y)/2;r.rotation=sign>0?0:180;r.inline=true;
   r.contactFrom=[axis,r.y-sign*16];r.contactTo=[axis,r.y+sign*16];
   r.wires=[{points:[[r.a.x,r.a.y],r.contactFrom],terminalId:s.from,contact:r.contactFrom,side:'FROM'},{points:[r.contactTo,[r.b.x,r.b.y]],terminalId:s.to,contact:r.contactTo,side:'TO'}];
  }
  r.points=r.wires.flatMap(w=>w.points);
 }
}
