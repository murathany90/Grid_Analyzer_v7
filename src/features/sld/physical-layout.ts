import type {StationLayout,StationTopologyGraph} from '../../domain/model/station-topology';
import {voltageMatches,type VoltageBand} from '../../domain/model/voltage-band';
import {assignYtbsSlot,resolveBarArrangements} from './ytbs-slotting';
export type Point=readonly [number,number];
export interface PortPosition {x:number;y:number;terminalId:string;semantics:'busbar-section'|'bay-terminal'|'equipment-terminal';direction?:-1|0|1;slot?:string}
export interface WireSegment {points:Point[];terminalId:string;contact:Point;side:'FROM'|'TO'}
export interface SwitchSlot {sw:StationTopologyGraph['switches'][number];a:PortPosition|undefined;b:PortPosition|undefined;x:number;y:number;rotation?:number;contactFrom:Point;contactTo:Point;wires:WireSegment[];points:Point[];ordering:'NATIVE_ENDPOINTS'|'CUBICLE_ATTACHMENT'|'SOURCE_ORDER_UNAVAILABLE'}
export interface EquipmentPort {terminalId:string;side:number;point:Point;wires:WireSegment[];boundaryKv:number|null}
export interface EquipmentGeometry {equipment:StationTopologyGraph['equipment'][number];x:number;y:number;direction:-1|1;ports:EquipmentPort[];nativePorts:PortPosition[];boundary:boolean}
/** Orthogonal paths terminate at physical contacts; the renderer consumes them unchanged. */
export function routeOrthogonalEdges(start:Point,end:Point):Point[]{return start[0]===end[0]||start[1]===end[1]?[start,end]:[start,[start[0],end[1]],end];}
function wire(start:Point,end:Point,terminalId:string,side:'FROM'|'TO'):WireSegment{return {points:routeOrthogonalEdges(start,end),terminalId,contact:end,side};}
const pt=(p:PortPosition):Point=>[p.x,p.y];
/** Native endpoints own one glyph; cubicle self-loops attach only to their source equipment lead. */
export function buildSwitchDeviceChain(graph:StationTopologyGraph,ports:Map<string,PortPosition>,barLanes:Map<string,number>,equipment:EquipmentGeometry[]):SwitchSlot[]{
 const sections=new Set(graph.busSections.map(b=>b.id)),routes:SwitchSlot[]=[],loops=new Map<string,StationTopologyGraph['switches']>();
 for(const sw of graph.switches){
  if(sw.from===sw.to){const k=sw.from+'|'+(sw.equipmentId??'');loops.set(k,[...(loops.get(k)??[]),sw]);continue;}
  let a=ports.get(sw.from),b=ports.get(sw.to);
  if(a&&sections.has(sw.from))a={...a,x:barLanes.get(sw.id)??b?.x??a.x};
  if(b&&sections.has(sw.to))b={...b,x:barLanes.get(sw.id)??a?.x??b.x};
  const bothBars=sections.has(sw.from)&&sections.has(sw.to),horizontal=!!a&&!!b&&a.y===b.y&&!bothBars,x=horizontal?(a!.x+b!.x)/2:a?.x??b?.x??0,y=a&&b?(bothBars?Math.max(a.y,b.y)+60:(a.y+b.y)/2):a?.y??b?.y??0,sign=horizontal?(b!.x<a!.x?-1:1):a&&b&&b.y<a.y&&!bothBars?-1:1,half=sw.kind==='breaker'?8:sw.kind==='isolator'?12:9;
  if(bothBars&&b)b={...b,x:b.x+36};
  const contactFrom:Point=horizontal?[x-sign*half,y]:[x,y-sign*half],contactTo:Point=horizontal?[x+sign*half,y]:[x,y+sign*half],wires=a&&b?[wire(pt(a),contactFrom,sw.from,'FROM'),wire(contactTo,pt(b),sw.to,'TO')]:[];
  if(bothBars&&b)wires[1].points=[contactTo,[x,y+30],[b.x,y+30],[b.x,b.y]];
  routes.push({sw,a,b,x,y,rotation:horizontal?90:0,contactFrom,contactTo,wires,points:wires.flatMap(w=>w.points),ordering:'NATIVE_ENDPOINTS'});
 }
 for(const switches of loops.values()){
  const sw0=switches[0],a=ports.get(sw0.from),target=equipment.find(e=>e.equipment.id===sw0.equipmentId&&e.ports.some(p=>p.terminalId===sw0.from)),port=target?.ports.find(p=>p.terminalId===sw0.from);
  const ordered=switches.length===1||switches.every(s=>s.sourceOrder!=null)&&new Set(switches.map(s=>s.sourceOrder)).size===switches.length;
  if(!ordered&&a){for(const [i,sw]of switches.entries())routes.push({sw,a,b:a,x:a.x+50+i*36,y:a.y+36,contactFrom:[a.x+50+i*36,a.y+24],contactTo:[a.x+50+i*36,a.y+48],wires:[],points:[],ordering:'SOURCE_ORDER_UNAVAILABLE'});continue;}
  if(a&&port){const sign=port.point[1]<a.y?-1:1;let start=pt(a);switches.sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
   switches.sort((a,b)=>(a.sourceOrder??0)-(b.sourceOrder??0));
   for(const [i,sw]of switches.entries()){const x=port.point[0],y=a.y+sign*(28+i*38),half=sw.kind==='breaker'?8:sw.kind==='isolator'?12:9,cf:Point=[x,y-sign*half],ct:Point=[x,y+sign*half];routes.push({sw,a,b:a,x,y,contactFrom:cf,contactTo:ct,wires:[wire(start,cf,sw.from,'FROM')],points:routeOrthogonalEdges(start,cf),ordering:switches.length===1?'CUBICLE_ATTACHMENT':'SOURCE_ORDER_UNAVAILABLE'});start=ct;}
   port.wires=[wire(start,port.point,port.terminalId,port.side===1?'TO':'FROM')];
  }else for(const sw of switches)routes.push({sw,a,b:a,x:a?.x??0,y:a?.y??0,contactFrom:[a?.x??0,a?.y??0],contactTo:[a?.x??0,a?.y??0],wires:[],points:[],ordering:'SOURCE_ORDER_UNAVAILABLE'});
 }
 return routes.sort((a,b)=>a.sw.id.localeCompare(b.sw.id));
}
/** Presentation only: roles -> voltage zones -> V4 slots -> native chains -> orthogonal wires. */
export function physicalStationLayout(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>,compact=false){
 const ports=new Map<string,PortPosition>(),sections=new Set(graph.busSections.map(b=>b.id)),terminal=new Map(graph.terminals.map(t=>[t.id,t]));
 const step=compact?58:72,lane=200,blockWidth=14*lane+180;
 const slots=graph.voltageLevels.filter(kv=>voltageMatches(kv,bands)).flatMap(kv=>assignYtbsSlot(graph,graph.feeders.filter(f=>f.voltageKv===kv)));
 const maxBlock=Math.max(0,...slots.map(s=>s.block)),unknownCount=Math.max(0,...graph.voltageLevels.map(kv=>slots.filter(s=>s.feeder.voltageKv===kv&&s.side===null).length));
 const knownRight=Math.max(1200,...slots.filter(s=>s.side).map(s=>260+s.block*blockWidth+(s.column+(s.side==='B'?.5:0))*lane));
 const width=knownRight+Math.max(250,unknownCount?700:0),base:StationLayout={width,height:0,sections:[],feeders:[],levels:[],omitted:0,pageCount:maxBlock+1},barLanes=new Map<string,number>(),slotMap=new Map(slots.map(s=>[s.feeder.id,s]));let top=100;
 for(const kv of graph.voltageLevels.filter(kv=>voltageMatches(kv,bands))){
  const bars=graph.busSections.filter(b=>b.voltageKv===kv),own=slots.filter(s=>s.feeder.voltageKv===kv),maxDepth=Math.max(2,...own.map(s=>new Set(s.feeder.terminalIds.filter(id=>!sections.has(id))).size)),extent=(Math.min(maxDepth,12)+2)*step+150,barY=top+extent;
  const arrangement=resolveBarArrangements(graph,kv),arrangementById=new Map(arrangement.map(a=>[a.section.id,a.block])),ranksByBlock=new Map<number,number>();
  base.levels.push({kv,y:barY});bars.forEach(section=>{const block=arrangementById.get(section.id)??0,index=ranksByBlock.get(block)??0;ranksByBlock.set(block,index+1);const offset=block*(maxBlock+1)*blockWidth,p={section,x1:210+offset,x2:knownRight+100+offset,y:barY+index*34};base.sections.push(p);ports.set(section.id,{x:p.x1,y:p.y,terminalId:section.id,semantics:'busbar-section'});});
  const lastBar=barY+Math.max(0,bars.length-1)*34;
  for(const s of own){
   const arrangementBlock=arrangementById.get(s.feeder.busSectionIds[0])??0,offset=arrangementBlock*(maxBlock+1)*blockWidth,x=(s.side===null?knownRight+180:260+s.block*blockWidth+(s.column+(s.side==='B'?.5:0))*lane)+offset,sign=s.side==='A'?-1:s.side==='B'?1:0,origin=sign<0?barY:sign?lastBar:barY+s.column*110;
   const ids=s.feeder.terminalIds.filter(id=>!sections.has(id)&&terminal.get(id)?.vnKv===kv),distance=new Map(bars.map(b=>[b.id,0])),q=[...distance.keys()];
   if(!bars.length&&ids.length){const root=ids.find(id=>graph.equipment.some(e=>['generator','load','externalGrid'].includes(e.kind)&&e.terminals.includes(id)))??ids[0];distance.set(root,0);q.push(root);}
   const sw=graph.switches.filter(sw=>s.feeder.switchIds.includes(sw.id)&&sw.from!==sw.to);
   for(let i=0;i<q.length;i++)for(const e of sw){const next=e.from===q[i]?e.to:e.to===q[i]?e.from:null;if(next&&ids.includes(next)&&!distance.has(next)){distance.set(next,distance.get(q[i])!+1);q.push(next);}}
   const ranks=new Map<number,number>();
   for(const id of ids){if(ports.has(id))continue;const depth=distance.get(id)??Math.max(1,...distance.values())+1,rank=ranks.get(depth)??0;ranks.set(depth,rank+1);ports.set(id,{x:x+(sign?rank*46:(depth+1)*step),y:sign?origin+sign*(depth+1)*step:origin+rank*40,terminalId:id,semantics:graph.equipment.some(e=>e.terminals.includes(id))?'equipment-terminal':'bay-terminal',direction:sign,slot:s.slot});}
   for(const e of sw){const bar=sections.has(e.from)?e.from:sections.has(e.to)?e.to:null;if(bar){const index=s.feeder.busSectionIds.indexOf(bar);barLanes.set(e.id,x+(index-Math.max(0,s.feeder.busSectionIds.length-1)/2)*26);}}
   base.feeders.push({feeder:s.feeder,x,y:origin+sign*extent,busYs:bars.filter(b=>s.feeder.busSectionIds.includes(b.id)).map(b=>ports.get(b.id)!.y)});
  }
  let extra=0;for(const t of graph.terminals.filter(t=>t.vnKv===kv&&!ports.has(t.id)))ports.set(t.id,{x:width-70-extra++*40,y:lastBar+30,terminalId:t.id,semantics:'equipment-terminal',direction:0,slot:'UNCLASSIFIED_SLOT'});
  top=Math.max(lastBar+extent+200,barY+own.filter(s=>!s.side).length*110+150);
 }
 // Barless generator/GSU components follow their source HV lead without inventing a bus.
 for(const e of graph.equipment.filter(e=>e.kind==='transformer'&&e.terminals.length===2)){
  const a=ports.get(e.terminals[0]),b=ports.get(e.terminals[1]);if(!a||!b||graph.busSections.some(s=>s.voltageKv===terminal.get(b.terminalId)?.vnKv))continue;
  const component=new Map([[b.terminalId,0]]),q=[b.terminalId];for(let i=0;i<q.length;i++)for(const sw of graph.switches){const next=sw.from===q[i]?sw.to:sw.to===q[i]?sw.from:null;if(next&&ports.has(next)&&terminal.get(next)?.vnKv===terminal.get(b.terminalId)?.vnKv&&!component.has(next)){component.set(next,component.get(q[i])!+1);q.push(next);}}
  const zone=base.levels.find(l=>l.kv===terminal.get(b.terminalId)?.vnKv);
  for(const [id,depth]of component){const p=ports.get(id)!;p.x=a.x;p.y=(zone?.y??b.y)-140+depth*step;p.direction=1;}
 }
 const equipment:EquipmentGeometry[]=[];
 for(const e of graph.equipment){
  const visible=e.terminals.map(id=>ports.get(id)).filter((p):p is PortPosition=>!!p);if(!visible.length)continue;
  const transformer=e.kind==='transformer'||e.kind==='transformer3w',direction=visible[0].direction===-1?-1:1,parallel=graph.equipment.filter(o=>o.kind===e.kind&&o.terminals.join('|')===e.terminals.join('|')),offset=(parallel.indexOf(e)-(parallel.length-1)/2)*62,loopCount=graph.switches.filter(s=>s.from===s.to&&s.equipmentId===e.id).length;let x=visible[0].x+offset,y=visible[0].y+direction*Math.max(100,loopCount*38+44);
  if(transformer&&visible.length>=2){const zones=e.terminals.map(id=>base.levels.find(l=>l.kv===terminal.get(id)?.vnKv)?.y).filter((v):v is number=>v!=null);y=(Math.min(...zones)+Math.max(...zones))/2;}
  else if(e.kind==='line'&&visible.length===2){x=(visible[0].x+visible[1].x)/2+offset;y=Math.min(visible[0].y,visible[1].y)-100;}
  const boundary=transformer&&visible.length<e.terminals.length;
  const contactOffset=e.kind==='line'?16:e.kind==='generator'?13:e.kind==='load'?14:12;
  const leads:EquipmentPort[]=visible.map(p=>{const side=e.terminals.indexOf(p.terminalId),end:Point=boundary?[x,y]:transformer?[x+(side===2?26:0),y+(side===0?-18:side===1?18:0)]:e.kind==='line'&&visible.length===2?[x,y]:[x,y-direction*contactOffset];return {terminalId:p.terminalId,side,point:end,wires:[wire(pt(p),end,p.terminalId,side===1?'TO':'FROM')],boundaryKv:boundary?(terminal.get(e.terminals.find(id=>!ports.has(id))??'')?.vnKv??null):null};});
  equipment.push({equipment:e,x,y,direction,ports:leads,nativePorts:visible,boundary});
 }
 const routes=buildSwitchDeviceChain(graph,ports,barLanes,equipment);base.height=Math.max(400,top,...equipment.map(e=>e.y+140));base.width=Math.max(base.width,...[...ports.values()].map(p=>p.x+200),...base.sections.map(p=>p.x2+70));
 return {...base,ports,routes,equipment,slots,slotMap,transformers:equipment.filter(e=>e.equipment.kind==='transformer').map(e=>({equipment:e.equipment,ports:e.nativePorts}))};
}
