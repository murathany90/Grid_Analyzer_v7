import type {StationLayout,StationTopologyGraph} from '../../domain/model/station-topology';
import {voltageMatches,type VoltageBand} from '../../domain/model/voltage-band';
import {assignYtbsSlot,resolveBarArrangements} from './ytbs-slotting';
import {optimizedOrthogonalRoute,obstacleIntersections,type RoutingOptions} from './orthogonal-router';
export type Point=readonly [number,number];
export interface PortPosition {x:number;y:number;terminalId:string;semantics:'busbar-section'|'bay-terminal'|'equipment-terminal';direction?:-1|0|1;slot?:string}
export interface WireSegment {points:Point[];terminalId:string;contact:Point;side:'FROM'|'TO'}
export interface SwitchSlot {sw:StationTopologyGraph['switches'][number];a:PortPosition|undefined;b:PortPosition|undefined;x:number;y:number;rotation?:number;contactFrom:Point;contactTo:Point;wires:WireSegment[];points:Point[];ordering:'NATIVE_ENDPOINTS'|'CUBICLE_ATTACHMENT'|'NATIVE_SOURCE_ORDER'|'SOURCE_ORDER_UNAVAILABLE'}
export interface EquipmentPort {terminalId:string;side:number;point:Point;wires:WireSegment[];boundaryKv:number|null}
export interface EquipmentGeometry {equipment:StationTopologyGraph['equipment'][number];x:number;y:number;direction:-1|1;ports:EquipmentPort[];nativePorts:PortPosition[];boundary:boolean}
/** Orthogonal paths terminate at physical contacts; the renderer consumes them unchanged. */
export function routeOrthogonalEdges(start:Point,end:Point,options:RoutingOptions={}):Point[]{return optimizedOrthogonalRoute(start,end,options);}
function wire(start:Point,end:Point,terminalId:string,side:'FROM'|'TO',options:RoutingOptions={}):WireSegment{return {points:routeOrthogonalEdges(start,end,options),terminalId,contact:end,side};}
const pt=(p:PortPosition):Point=>[p.x,p.y];
type GlyphBox={id:string;x1:number;x2:number;y1:number;y2:number};
const intersects=(a:GlyphBox,b:GlyphBox)=>a.x1<b.x2&&a.x2>b.x1&&a.y1<b.y2&&a.y2>b.y1;
function freePosition(x:number,y:number,halfX:number,halfY:number,occupied:GlyphBox[],id:string){
 const candidates=[[x,y],...Array.from({length:16},(_,i)=>i+1).flatMap(n=>[[x+n*32,y],[x-n*32,y],[x,y+n*32],[x,y-n*32]])];
 for(const [xx,yy]of candidates){const box={id,x1:xx-halfX,x2:xx+halfX,y1:yy-halfY,y2:yy+halfY};if(xx>40&&yy>80&&!occupied.some(o=>intersects(box,o))){occupied.push(box);return {x:xx,y:yy};}}
 throw Error('SLD_GLYPH_PACKING_UNRESOLVED: '+id);
}
const halfWidth=(e:EquipmentGeometry)=>e.equipment.kind==='transformer3w'?30:18;
function separateEquipment(equipment:EquipmentGeometry[],ports:Map<string,PortPosition>,bars:GlyphBox[]){const occupied:GlyphBox[]=[...bars,...[...ports.values()].map(p=>({id:'PORT|'+p.terminalId,x1:p.x-2,x2:p.x+2,y1:p.y-2,y2:p.y+2}))];for(const e of equipment){const p=freePosition(e.x,e.y,halfWidth(e),19,occupied,e.equipment.sourceClass+'|'+e.equipment.id),dx=p.x-e.x,dy=p.y-e.y;e.x=p.x;e.y=p.y;for(const port of e.ports){port.point=[port.point[0]+dx,port.point[1]+dy];const native=e.nativePorts.find(p=>p.terminalId===port.terminalId)!;port.wires=[wire(pt(native),port.point,port.terminalId,port.side===1?'TO':'FROM')];}}}
function separateSwitches(routes:SwitchSlot[],equipment:EquipmentGeometry[],bars:GlyphBox[]){
 const occupied:GlyphBox[]=[...bars,...equipment.map(e=>({id:e.equipment.id,x1:e.x-halfWidth(e),x2:e.x+halfWidth(e),y1:e.y-19,y2:e.y+19})),...[...equipment.flatMap(e=>e.nativePorts),...routes.flatMap(r=>[r.a,r.b].filter((p):p is PortPosition=>!!p))].map(p=>({id:'PORT|'+p.terminalId,x1:p.x-2,x2:p.x+2,y1:p.y-2,y2:p.y+2}))];
 for(const r of routes){if(!r.a&&!r.b)continue;const p=freePosition(r.x,r.y,14,14,occupied,r.sw.sourceClass+'|'+r.sw.sourceId),dx=p.x-r.x,dy=p.y-r.y;if(!dx&&!dy)continue;r.x=p.x;r.y=p.y;r.contactFrom=[r.contactFrom[0]+dx,r.contactFrom[1]+dy];r.contactTo=[r.contactTo[0]+dx,r.contactTo[1]+dy];
  if(r.ordering==='NATIVE_ENDPOINTS'&&r.a&&r.b){const cf:Point=[Math.sign(r.contactFrom[0]-r.x),Math.sign(r.contactFrom[1]-r.y)],ct:Point=[Math.sign(r.contactTo[0]-r.x),Math.sign(r.contactTo[1]-r.y)];r.wires=[wire(pt(r.a),r.contactFrom,r.sw.from,'FROM',{endNormal:cf}),wire(r.contactTo,pt(r.b),r.sw.to,'TO',{startNormal:ct})];r.points=r.wires.flatMap(w=>w.points);}
 }
 // Packing moves contacts. Reconnect an explicitly ordered cubicle chain as a whole.
 const chains=new Map<string,SwitchSlot[]>();for(const r of routes)if(r.ordering==='NATIVE_SOURCE_ORDER'||r.ordering==='CUBICLE_ATTACHMENT'){const key=r.sw.from+'|'+r.sw.equipmentId;chains.set(key,[...(chains.get(key)??[]),r]);}
 for(const chain of chains.values()){chain.sort((a,b)=>(a.sw.sourceOrder??0)-(b.sw.sourceOrder??0));let start=pt(chain[0].a!);for(const r of chain){r.wires=[wire(start,r.contactFrom,r.sw.from,'FROM')];start=r.contactTo;}const last=chain.at(-1)!,port=equipment.find(e=>e.equipment.id===last.sw.equipmentId)?.ports.find(p=>p.terminalId===last.sw.from);if(port)port.wires=[wire(start,port.point,port.terminalId,port.side===1?'TO':'FROM')];}
 // Routing uses the actual other glyph obstacles and previous wires, preserving source endpoints.
 const accepted:Point[][]=[];const avoid=(start:Point,end:Point,own:string,options:RoutingOptions={})=>{const all=occupied.filter(o=>!o.id.startsWith('PORT|')&&!o.id.startsWith('BAR|')&&o.id!==own);let near=all.filter(o=>o.x2>=Math.min(start[0],end[0])-30&&o.x1<=Math.max(start[0],end[0])+30&&o.y2>=Math.min(start[1],end[1])-30&&o.y1<=Math.max(start[1],end[1])+30),points=routeOrthogonalEdges(start,end,{...options,obstacles:near,existing:accepted});for(let i=0;i<3;i++){const hit=all.filter(o=>obstacleIntersections(points,[o])>0);if(!hit.length)break;near=[...new Set([...near,...hit])];points=routeOrthogonalEdges(start,end,{...options,obstacles:near,existing:accepted});}return points;};for(const r of routes){for(const [i,w]of r.wires.entries()){if(r.ordering!=='NATIVE_ENDPOINTS')continue;const start=w.points[0],end=w.points.at(-1)!,near=occupied.filter(o=>!o.id.startsWith('PORT|')&&!o.id.startsWith('BAR|')&&o.id!==r.sw.sourceClass+'|'+r.sw.sourceId&&o.x2>=Math.min(start[0],end[0])-30&&o.x1<=Math.max(start[0],end[0])+30&&o.y2>=Math.min(start[1],end[1])-30&&o.y1<=Math.max(start[1],end[1])+30),normal:Point=i===0?[Math.sign(r.contactFrom[0]-r.x),Math.sign(r.contactFrom[1]-r.y)]:[Math.sign(r.contactTo[0]-r.x),Math.sign(r.contactTo[1]-r.y)];w.points=avoid(start,end,r.sw.sourceClass+'|'+r.sw.sourceId,i===0?{endNormal:normal}:{startNormal:normal});accepted.push(w.points);}r.points=r.wires.flatMap(w=>w.points);}
 for(const e of equipment)for(const port of e.ports)for(const w of port.wires){w.points=avoid(w.points[0],w.points.at(-1)!,e.equipment.id);accepted.push(w.points);}
}
/** Native endpoints own one glyph; cubicle self-loops attach only to their source equipment lead. */
export function buildSwitchDeviceChain(graph:StationTopologyGraph,ports:Map<string,PortPosition>,barLanes:Map<string,number>,equipment:EquipmentGeometry[],barOffsets:ReadonlyMap<string,number>=new Map()):SwitchSlot[]{
 const sections=new Set(graph.busSections.map(b=>b.id)),routes:SwitchSlot[]=[],loops=new Map<string,StationTopologyGraph['switches']>();
 for(const sw of graph.switches){
  if(sw.from===sw.to){const k=sw.from+'|'+(sw.equipmentId??'');loops.set(k,[...(loops.get(k)??[]),sw]);continue;}
  let a=ports.get(sw.from),b=ports.get(sw.to);
  if(a&&sections.has(sw.from))a={...a,x:barLanes.get(sw.id)??b?.x??a.x,y:a.y+(barOffsets.get(sw.id)??0)};
  if(b&&sections.has(sw.to))b={...b,x:barLanes.get(sw.id)??a?.x??b.x,y:b.y+(barOffsets.get(sw.id)??0)};
  const bothBars=sections.has(sw.from)&&sections.has(sw.to),horizontal=!!a&&!!b&&a.y===b.y&&!bothBars,x=horizontal?(a!.x+b!.x)/2:a?.x??b?.x??0,y=a&&b?(bothBars?Math.max(a.y,b.y)+60:(a.y+b.y)/2):a?.y??b?.y??0,sign=horizontal?(b!.x<a!.x?-1:1):a&&b&&b.y<a.y&&!bothBars?-1:1,half=sw.kind==='breaker'?8:sw.kind==='isolator'?12:9;
  if(bothBars&&b)b={...b,x:b.x+36};
  const contactFrom:Point=horizontal?[x-sign*half,y]:[x,y-sign*half],contactTo:Point=horizontal?[x+sign*half,y]:[x,y+sign*half],normal:Point=horizontal?[sign,0]:[0,sign],wires=a&&b?[wire(pt(a),contactFrom,sw.from,'FROM',{endNormal:[-normal[0],-normal[1]]}),wire(contactTo,pt(b),sw.to,'TO',{startNormal:normal})]:[];
  if(bothBars&&b)wires[1].points=[contactTo,[x,y+30],[b.x,y+30],[b.x,b.y]];
  routes.push({sw,a,b,x,y,rotation:horizontal?90:0,contactFrom,contactTo,wires,points:wires.flatMap(w=>w.points),ordering:'NATIVE_ENDPOINTS'});
 }
 for(const switches of loops.values()){
  const sw0=switches[0],a=ports.get(sw0.from),target=equipment.find(e=>e.equipment.id===sw0.equipmentId&&e.ports.some(p=>p.terminalId===sw0.from)),port=target?.ports.find(p=>p.terminalId===sw0.from);
  const ordered=switches.length===1||switches.every(s=>s.sourceOrder!=null)&&new Set(switches.map(s=>s.sourceOrder)).size===switches.length;
  if(!ordered&&a){for(const [i,sw]of switches.entries())routes.push({sw,a,b:a,x:a.x+50+i*36,y:a.y+36,contactFrom:[a.x+50+i*36,a.y+24],contactTo:[a.x+50+i*36,a.y+48],wires:[],points:[],ordering:'SOURCE_ORDER_UNAVAILABLE'});continue;}
  if(a&&port){const sign=port.point[1]<a.y?-1:1;let start=pt(a);switches.sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
   switches.sort((a,b)=>(a.sourceOrder??0)-(b.sourceOrder??0));
   for(const [i,sw]of switches.entries()){const x=port.point[0],y=a.y+sign*(28+i*38),half=sw.kind==='breaker'?8:sw.kind==='isolator'?12:9,cf:Point=[x,y-sign*half],ct:Point=[x,y+sign*half];routes.push({sw,a,b:a,x,y,contactFrom:cf,contactTo:ct,wires:[wire(start,cf,sw.from,'FROM')],points:routeOrthogonalEdges(start,cf),ordering:switches.length===1?'CUBICLE_ATTACHMENT':'NATIVE_SOURCE_ORDER'});start=ct;}
   port.wires=[wire(start,port.point,port.terminalId,port.side===1?'TO':'FROM')];
  }else for(const sw of switches)routes.push({sw,a,b:a,x:a?.x??0,y:a?.y??0,contactFrom:[a?.x??0,a?.y??0],contactTo:[a?.x??0,a?.y??0],wires:[],points:[],ordering:'SOURCE_ORDER_UNAVAILABLE'});
 }
 return routes.sort((a,b)=>a.sw.id.localeCompare(b.sw.id));
}
/** Presentation only: roles -> voltage zones -> V4 slots -> native chains -> orthogonal wires. */
export function physicalStationLayout(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>,compact=false,focus=false){
 const ports=new Map<string,PortPosition>(),sections=new Set(graph.busSections.map(b=>b.id)),terminal=new Map(graph.terminals.map(t=>[t.id,t]));
 const step=compact?28:32,lane=76,blockHeight=380;
 const slots=graph.voltageLevels.filter(kv=>voltageMatches(kv,bands)).flatMap(kv=>assignYtbsSlot(graph,graph.feeders.filter(f=>f.voltageKv===kv)));
 const maxBlock=Math.max(0,...slots.map(s=>s.block)),unknownCount=Math.max(0,...graph.voltageLevels.map(kv=>slots.filter(s=>s.feeder.voltageKv===kv&&s.side===null).length));
 const knownRight=focus?410:Math.max(900,...slots.filter(s=>s.side).map(s=>260+(s.column+(s.side==='B'?.5:0))*lane));
 const width=knownRight+(focus?50:180),base:StationLayout={width,height:0,sections:[],feeders:[],levels:[],omitted:0,pageCount:maxBlock+1},barLanes=new Map<string,number>(),barOffsets=new Map<string,number>(),slotMap=new Map(slots.map(s=>[s.feeder.id,s]));let top=100;
 for(const kv of graph.voltageLevels.filter(kv=>voltageMatches(kv,bands))){
  const bars=graph.busSections.filter(b=>b.voltageKv===kv),own=slots.filter(s=>s.feeder.voltageKv===kv),maxDepth=Math.max(2,...own.map(s=>new Set(s.feeder.terminalIds.filter(id=>!sections.has(id))).size)),extent=(Math.min(maxDepth,8)+1)*step+48,barY=top+extent;
  const arrangement=resolveBarArrangements(graph,kv),arrangementById=new Map(arrangement.map(a=>[a.section.id,a.block])),ranksByBlock=new Map<number,number>();
  base.levels.push({kv,y:barY});bars.forEach(section=>{const block=arrangementById.get(section.id)??0,index=ranksByBlock.get(block)??0;ranksByBlock.set(block,index+1);const offset=block*blockHeight,p={section,x1:210,x2:knownRight+60,y:barY+index*26+offset};base.sections.push(p);ports.set(section.id,{x:p.x1,y:p.y,terminalId:section.id,semantics:'busbar-section'});});
  const lastBar=barY+Math.max(0,bars.length-1)*26;
  for(const s of own){
   const arrangementBlock=arrangementById.get(s.feeder.busSectionIds[0])??0,offset=focus?0:s.block*blockHeight,x=focus?260:s.side===null?260+(s.column%7)*lane:260+(s.column+(s.side==='B'?.5:0))*lane,sign=s.side==='A'?-1:s.side==='B'?1:0,origin=(sign<0?barY:sign?lastBar:lastBar+extent+30+Math.floor(s.column/7)*56)+offset+arrangementBlock*blockHeight;
   if(offset)for(const b of bars){const native=base.sections.find(p=>p.section.id===b.id&&!p.reference)!;if(!base.sections.some(p=>p.reference&&p.section.id===b.id&&p.y===native.y+offset))base.sections.push({...native,y:native.y+offset,reference:true});}
   const ids=s.feeder.terminalIds.filter(id=>!sections.has(id)&&terminal.get(id)?.vnKv===kv),distance=new Map(bars.map(b=>[b.id,0])),q=[...distance.keys()];
   if(!bars.length&&ids.length){const root=ids.find(id=>graph.equipment.some(e=>['generator','load','externalGrid'].includes(e.kind)&&e.terminals.includes(id)))??ids.find(id=>terminal.get(id)?.parentId!==s.feeder.id)??ids[0];distance.set(root,0);q.push(root);}
   const sw=graph.switches.filter(sw=>s.feeder.switchIds.includes(sw.id)&&sw.from!==sw.to);
   for(let i=0;i<q.length;i++)for(const e of sw){const next=e.from===q[i]?e.to:e.to===q[i]?e.from:null;if(next&&ids.includes(next)&&!distance.has(next)){distance.set(next,distance.get(q[i])!+1);q.push(next);}}
   // A source bypass must not shorten/reverse the internal breaker -> disconnector chain.
   // Rank the internal native graph from its actual equipment ports, excluding bars.
   const targets=graph.equipment.filter(e=>s.feeder.equipmentKeys.includes(`${e.sourceClass}|${e.id}`)).flatMap(e=>e.terminals).filter(id=>ids.includes(id));
   if(bars.length&&targets.length){const internal=new Map(targets.map(id=>[id,0])),queue=[...internal.keys()];for(let i=0;i<queue.length;i++)for(const e of sw){if(sections.has(e.from)||sections.has(e.to))continue;const next=e.from===queue[i]?e.to:e.to===queue[i]?e.from:null;if(next&&ids.includes(next)&&!internal.has(next)){internal.set(next,internal.get(queue[i])!+1);queue.push(next);}}const deepest=Math.max(...internal.values());for(const [id,d]of internal)distance.set(id,deepest-d+1);}
   const ranks=new Map<number,number>();
   for(const id of ids){if(ports.has(id))continue;const depth=distance.get(id)??Math.max(1,...distance.values())+1,rank=ranks.get(depth)??0;ranks.set(depth,rank+1);const vertical=sign!==0||!bars.length;ports.set(id,{x:x+(vertical?rank*40:(depth+1)*step),y:vertical?(!bars.length?120+depth*step:origin+sign*(depth+1)*step):origin+rank*40,terminalId:id,semantics:graph.equipment.some(e=>e.terminals.includes(id))?'equipment-terminal':'bay-terminal',direction:!bars.length?1:sign,slot:s.slot});}
   for(const e of sw){const bar=sections.has(e.from)?e.from:sections.has(e.to)?e.to:null;if(bar){const index=s.feeder.busSectionIds.indexOf(bar);barLanes.set(e.id,x+(index-Math.max(0,s.feeder.busSectionIds.length-1)/2)*40);barOffsets.set(e.id,offset);}}
   base.feeders.push({feeder:s.feeder,x,y:origin+sign*extent,busYs:bars.filter(b=>s.feeder.busSectionIds.includes(b.id)).map(b=>ports.get(b.id)!.y)});
  }
  let extra=0;for(const t of graph.terminals.filter(t=>t.vnKv===kv&&!ports.has(t.id)))ports.set(t.id,{x:260+(extra%7)*lane,y:lastBar+extent+80+Math.floor(extra++/7)*48,terminalId:t.id,semantics:'equipment-terminal',direction:0,slot:'UNCLASSIFIED_SLOT'});
  top=lastBar+extent+90+Math.ceil(own.filter(s=>!s.side).length/7)*56+Math.max(0,...own.map(s=>s.block+(arrangementById.get(s.feeder.busSectionIds[0])??0)))*blockHeight;
 }
 // Barless generator/GSU components follow their source HV lead without inventing a bus.
 for(const e of graph.equipment.filter(e=>e.kind==='transformer'&&e.terminals.length===2)){
  const a=ports.get(e.terminals[0]),b=ports.get(e.terminals[1]);if(!a||!b||graph.busSections.some(s=>s.voltageKv===terminal.get(b.terminalId)?.vnKv))continue;
  const component=new Map([[b.terminalId,0]]),q=[b.terminalId];for(let i=0;i<q.length;i++)for(const sw of graph.switches){const next=sw.from===q[i]?sw.to:sw.to===q[i]?sw.from:null;if(next&&ports.has(next)&&terminal.get(next)?.vnKv===terminal.get(b.terminalId)?.vnKv&&!component.has(next)){component.set(next,component.get(q[i])!+1);q.push(next);}}
  const zone=base.levels.find(l=>l.kv===terminal.get(b.terminalId)?.vnKv);
  const ranks=new Map<number,number>();for(const [id,depth]of component){const p=ports.get(id)!,rank=ranks.get(depth)??0;ranks.set(depth,rank+1);p.x=a.x+rank*40;p.y=(zone?.y??b.y)-64+depth*step;p.direction=1;}
 }
 const equipment:EquipmentGeometry[]=[];
 for(const e of graph.equipment){
  const visible=e.terminals.map(id=>ports.get(id)).filter((p):p is PortPosition=>!!p);if(!visible.length)continue;
  const transformer=e.kind==='transformer'||e.kind==='transformer3w',direction=visible[0].direction===-1?-1:1,parallel=graph.equipment.filter(o=>(transformer?o.kind===e.kind:o.kind!=='transformer'&&o.kind!=='transformer3w')&&o.terminals.join('|')===e.terminals.join('|')),offset=(parallel.indexOf(e)-(parallel.length-1)/2)*54,loopCount=graph.switches.filter(s=>s.from===s.to&&s.equipmentId===e.id).length;let x=visible[0].x+offset,y=visible[0].y+direction*Math.max(58,loopCount*38+44);
  if(transformer&&visible.length>=2){const zones=e.terminals.map(id=>base.levels.find(l=>l.kv===terminal.get(id)?.vnKv)?.y).filter((v):v is number=>v!=null);const [a,b]=visible;y=(a.y+b.y)/2;x=(a.x+b.x)/2+offset;}
  else if(e.kind==='line'&&visible.length===2){x=(visible[0].x+visible[1].x)/2+offset;y=Math.min(visible[0].y,visible[1].y)-52;}
  const boundary=transformer&&visible.length<e.terminals.length;
  const contactOffset=e.kind==='line'?16:e.kind==='generator'?13:e.kind==='load'?14:12;
  const leads:EquipmentPort[]=visible.map(p=>{const side=e.terminals.indexOf(p.terminalId),end:Point=boundary?[x,y]:transformer?[x+(side===2?26:0),y+(side===0?-18:side===1?18:0)]:e.kind==='line'&&visible.length===2?[x,y]:[x,y-direction*contactOffset];return {terminalId:p.terminalId,side,point:end,wires:[wire(pt(p),end,p.terminalId,side===1?'TO':'FROM')],boundaryKv:boundary?(terminal.get(e.terminals.find(id=>!ports.has(id))??'')?.vnKv??null):null};});
  equipment.push({equipment:e,x,y,direction,ports:leads,nativePorts:visible,boundary});
 }
 const barObstacles:GlyphBox[]=base.sections.map((b,i)=>({id:'BAR|'+b.section.id+'|'+i,x1:b.x1,x2:b.x2,y1:b.y-3,y2:b.y+3}));const protectedPorts=new Map(ports);for(const sw of graph.switches)for(const id of [sw.from,sw.to])if(sections.has(id)&&ports.has(id)){const p=ports.get(id)!;protectedPorts.set(sw.id+'|'+id,{...p,x:barLanes.get(sw.id)??ports.get(id===sw.from?sw.to:sw.from)?.x??p.x,y:p.y+(barOffsets.get(sw.id)??0)});}separateEquipment(equipment,protectedPorts,barObstacles);
 const routes=buildSwitchDeviceChain(graph,ports,barLanes,equipment,barOffsets);separateSwitches(routes,equipment,barObstacles);
 base.height=Math.max(focus?280:400,focus?0:top,...base.sections.map(p=>p.y+70),...equipment.map(e=>e.y+80),...routes.map(r=>r.y+55));base.width=Math.max(base.width,...[...ports.values()].map(p=>p.x+100),...base.sections.map(p=>p.x2+70),...routes.map(r=>r.x+50));
 return {...base,ports,routes,equipment,slots,slotMap,transformers:equipment.filter(e=>e.equipment.kind==='transformer').map(e=>({equipment:e.equipment,ports:e.nativePorts}))};
}
/** Connected engineering sheet. Repeated rails reference the same native section; no feeder cards. */
export function connectedStationLayout(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>){
 const width=1440,left=160,right=1370,step=40,ports=new Map<string,PortPosition>(),sections=new Set(graph.busSections.map(b=>b.id)),terminal=new Map(graph.terminals.map(t=>[t.id,t]));
 const slots=graph.voltageLevels.filter(kv=>voltageMatches(kv,bands)).flatMap(kv=>assignYtbsSlot(graph,graph.feeders.filter(f=>f.voltageKv===kv))),slotMap=new Map(slots.map(s=>[s.feeder.id,s]));
 const base:StationLayout={width,height:0,sections:[],feeders:[],levels:[],omitted:0,pageCount:1},barLanes=new Map<string,number>(),barOffsets=new Map<string,number>();let top=100;
 for(const kv of graph.voltageLevels.filter(kv=>voltageMatches(kv,bands))){
  const bars=graph.busSections.filter(b=>b.voltageKv===kv),own=slots.filter(s=>s.feeder.voltageKv===kv),groups=kv>40?[bars]:[...new Set(bars.map(b=>b.groupId))].map(id=>bars.filter(b=>b.groupId===id));if(!groups.length)groups.push([]);
  const consumed=new Set<string>();
  for(const [groupIndex,groupBars]of groups.entries()){
   const ownSlots=own.filter(s=>!consumed.has(s.feeder.id)&&(s.feeder.busSectionIds.some(id=>groupBars.some(b=>b.id===id))||!s.feeder.busSectionIds.length&&groupIndex===0));ownSlots.forEach(s=>consumed.add(s.feeder.id));
   // Unknown function stays unknown. Its actual native switch graph is still drawn below its rails.
   const upper=ownSlots.filter(s=>s.side==='A').sort((a,b)=>a.column-b.column||a.feeder.id.localeCompare(b.feeder.id)),lower=ownSlots.filter(s=>s.side!=='A').sort((a,b)=>a.side===b.side?a.column-b.column||a.feeder.id.localeCompare(b.feeder.id):a.side?-1:1),capacity=kv>40?7:14;
   const blocks=Math.max(1,Math.ceil(upper.length/capacity),Math.ceil(lower.length/capacity));
   for(let block=0;block<blocks;block++){
    const us=upper.slice(block*capacity,(block+1)*capacity),ds=lower.slice(block*capacity,(block+1)*capacity),parts=[...us,...ds];
    const internalRanks=(f:typeof graph.feeders[number])=>{
     const ids=f.terminalIds.filter(id=>!sections.has(id)&&terminal.get(id)?.vnKv===kv),edges=graph.switches.filter(s=>f.switchIds.includes(s.id)&&s.from!==s.to),barDegree=(id:string)=>edges.filter(s=>(s.from===id&&sections.has(s.to))||(s.to===id&&sections.has(s.from))).length;
     const root=ids.slice().sort((a,b)=>barDegree(b)-barDegree(a)||a.localeCompare(b))[0],distance=new Map<string,number>();if(root){distance.set(root,1);const q=[root];for(let i=0;i<q.length;i++)for(const e of edges){if(sections.has(e.from)||sections.has(e.to))continue;const next=e.from===q[i]?e.to:e.to===q[i]?e.from:null;if(next&&ids.includes(next)&&!distance.has(next)){distance.set(next,distance.get(q[i])!+1);q.push(next);}}}for(const id of ids)if(!distance.has(id))distance.set(id,Math.max(1,...distance.values())+1);return distance;
    };
    const ranks=new Map(parts.map(s=>[s.feeder.id,internalRanks(s.feeder)])),extent=(ss:typeof parts)=>Math.max(0,...ss.map(s=>Math.max(1,...ranks.get(s.feeder.id)!.values())*step+110)),up=extent(us),down=extent(ds),barY=top+up+20,lastY=barY+Math.max(0,groupBars.length-1)*28;
    base.levels.push({kv,y:barY});
    for(const [i,b]of groupBars.entries()){const p={section:b,x1:left-28,x2:right,y:barY+i*28,reference:ports.has(b.id)};base.sections.push(p);if(!ports.has(b.id))ports.set(b.id,{x:p.x1,y:p.y,terminalId:b.id,semantics:'busbar-section'});}
    for(const s of parts){const upSide=us.includes(s),siblings=upSide?us:ds,index=siblings.indexOf(s),pitch=kv>40?164:80,x=left+64+index*pitch+(upSide?0:kv>40?82:0),sign=upSide?-1:1,origin=upSide?barY:lastY,rankCounts=new Map<number,number>(),distance=ranks.get(s.feeder.id)!;
     for(const [id,depth]of distance){if(ports.has(id))continue;const n=rankCounts.get(depth)??0;rankCounts.set(depth,n+1);ports.set(id,{x:x+n*48,y:origin+sign*(depth*step+18),terminalId:id,semantics:graph.equipment.some(e=>e.terminals.includes(id))?'equipment-terminal':'bay-terminal',direction:sign,slot:s.slot});}
     for(const id of s.feeder.switchIds){const sw=graph.switches.find(e=>e.id===id)!,bar=groupBars.find(b=>b.id===sw.from||b.id===sw.to);if(!bar)continue;const n=groupBars.indexOf(bar);barLanes.set(sw.id,x+(n-(groupBars.length-1)/2)*32);barOffsets.set(sw.id,barY+n*28-ports.get(bar.id)!.y);}
     const labelY=origin+sign*(Math.max(1,...distance.values())*step+92);base.feeders.push({feeder:s.feeder,x,y:labelY,busYs:groupBars.filter(b=>s.feeder.busSectionIds.includes(b.id)).map(b=>barY+groupBars.indexOf(b)*28)});
    }
    top=lastY+down+70;
   }
  }
 }
 // A barless GSU/generator component follows its actual HV winding. Preserve every branch
 // and the common native terminal; a shared generator node is not a physical busbar.
 for(const e of graph.equipment.filter(e=>e.kind==='transformer'&&e.terminals.length===2)){
  const a=ports.get(e.terminals[0]),b=ports.get(e.terminals[1]),kv=terminal.get(e.terminals[1])?.vnKv;if(!a||!b||graph.busSections.some(s=>s.voltageKv===kv))continue;
  const distance=new Map([[b.terminalId,0]]),q=[b.terminalId];for(let i=0;i<q.length;i++)for(const sw of graph.switches){const next=sw.from===q[i]?sw.to:sw.to===q[i]?sw.from:null;if(next&&ports.has(next)&&terminal.get(next)?.vnKv===kv&&!distance.has(next)){distance.set(next,distance.get(q[i])!+1);q.push(next);}}
  const rows=new Map<number,number>();for(const [id,depth]of distance){const p=ports.get(id)!,n=rows.get(depth)??0;rows.set(depth,n+1);p.x=a.x+n*48;p.y=a.y+200+depth*step;p.direction=1;}
  for(const f of base.feeders.filter(f=>f.feeder.voltageKv===kv&&f.feeder.terminalIds.some(id=>distance.has(id)))){const own=f.feeder.terminalIds.map(id=>ports.get(id)!).filter(Boolean),incoming=f.feeder.terminalIds.includes(b.terminalId);f.x=a.x+(incoming?-92:0);f.y=incoming?Math.min(...own.map(p=>p.y))+68:Math.max(...own.map(p=>p.y))+38;}
 }
 // Source terminals outside ElmBay ownership are retained, not assigned a fictitious bay.
 let orphan=0;for(const t of graph.terminals.filter(t=>voltageMatches(t.vnKv,bands)&&!ports.has(t.id)))ports.set(t.id,{x:left+64+(orphan%12)*98,y:top+Math.floor(orphan++/12)*90,terminalId:t.id,semantics:'equipment-terminal',direction:1});
 const equipment:EquipmentGeometry[]=[];
 for(const e of graph.equipment){
  const visible=e.terminals.map(id=>ports.get(id)).filter((p):p is PortPosition=>!!p);if(!visible.length)continue;
  const owner=base.feeders.find(f=>f.feeder.equipmentKeys.includes(e.sourceClass+'|'+e.id)),native=visible.map(p=>p.semantics==='busbar-section'?{...p,x:owner?.x??p.x}:p),transformer=e.kind==='transformer'||e.kind==='transformer3w',direction=native[0].direction===-1?-1:1,parallel=graph.equipment.filter(o=>o.terminals[0]===e.terminals[0]&&(transformer?o.kind==='transformer':o.kind!=='transformer'&&o.kind!=='transformer3w')),offset=(parallel.indexOf(e)-(parallel.length-1)/2)*64;
  let x=native[0].x+offset,y=native[0].y+direction*54;if(!transformer&&parallel.length>1){x=native[0].x+(parallel.indexOf(e)-(parallel.length-1)/2)*140;y=native[0].y+direction*64;}
  if(transformer&&native.length>1){y=(native[0].y+native[1].y)/2;x=native[0].x+offset;}
  const boundary=transformer&&native.length<e.terminals.length,contactOffset=e.kind==='line'?16:e.kind==='generator'?13:e.kind==='load'?14:12;
  const leads:EquipmentPort[]=native.map(p=>{const side=e.terminals.indexOf(p.terminalId),point:Point=boundary?[x,y]:transformer?[x+(side===2?26:0),y+(side===0?-18:side===1?18:0)]:[x,y-direction*contactOffset];return {terminalId:p.terminalId,side,point,wires:[wire(pt(p),point,p.terminalId,side===1?'TO':'FROM')],boundaryKv:boundary?(terminal.get(e.terminals.find(id=>!ports.has(id))??'')?.vnKv??null):null};});
  equipment.push({equipment:e,x,y,direction,ports:leads,nativePorts:native,boundary});
 }
 const barObstacles:GlyphBox[]=base.sections.map((b,i)=>({id:'BAR|'+b.section.id+'|'+i,x1:b.x1,x2:b.x2,y1:b.y-3,y2:b.y+3})),protectedPorts=new Map(ports);for(const sw of graph.switches)for(const id of [sw.from,sw.to])if(sections.has(id)&&ports.has(id)){const p=ports.get(id)!;protectedPorts.set(sw.id+'|'+id,{...p,x:barLanes.get(sw.id)??ports.get(id===sw.from?sw.to:sw.from)?.x??p.x,y:p.y+(barOffsets.get(sw.id)??0)});}
 separateEquipment(equipment,protectedPorts,barObstacles);const routes=buildSwitchDeviceChain(graph,ports,barLanes,equipment,barOffsets);separateSwitches(routes,equipment,barObstacles);
 base.height=Math.max(top+60,...[...ports.values()].map(p=>p.y+80),...equipment.map(e=>e.y+100),...routes.map(r=>r.y+70));base.width=Math.max(width,...routes.map(r=>r.x+50),...[...ports.values()].map(p=>p.x+60));
 return {...base,ports,routes,equipment,slots,slotMap,transformers:equipment.filter(e=>e.equipment.kind==='transformer').map(e=>({equipment:e.equipment,ports:e.nativePorts}))};
}
/** Bay focus uses the same source/port/contact renderer; other winding ends stay explicit boundaries. */
export function feederFocusGraph(graph:StationTopologyGraph,id:string):StationTopologyGraph {
 const f=graph.feeders.find(f=>f.id===id);if(!f)return {...graph,feeders:[],switches:[],equipment:[],terminals:[],busSections:[],voltageLevels:[]};
 const eq=graph.equipment.filter(e=>f.equipmentKeys.includes(`${e.sourceClass}|${e.id}`)),ids=new Set([...f.terminalIds,...eq.flatMap(e=>e.terminals)]);
 return {...graph,feeders:[f],switches:graph.switches.filter(s=>f.switchIds.includes(s.id)||s.from===s.to&&eq.some(e=>e.id===s.equipmentId)),equipment:eq,terminals:graph.terminals.filter(t=>ids.has(t.id)),busSections:graph.busSections.filter(b=>ids.has(b.id)&&b.voltageKv===f.voltageKv),voltageLevels:[f.voltageKv]};
}
