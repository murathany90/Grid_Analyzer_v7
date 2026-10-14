import type {StationLayout,StationTopologyGraph} from '../../domain/model/station-topology';
import {voltageMatches,type VoltageBand} from '../../domain/model/voltage-band';
import {assignYtbsSlot,resolveBarArrangements} from './ytbs-slotting';
import {optimizedOrthogonalRoute,obstacleIntersections,type RoutingOptions} from './orthogonal-router';
import {feederDrawingPath} from './feeder-drawing-graph';
import {nearestSideCorridor} from './side-corridor';
import {nativeBarCircuit} from './bar-circuit';
import {referenceCoupler} from './reference-coupler';
import {packFeederRows,feederCellWidth,feederAreaUnits,isModelFeeder,partitionFeederSides,feederCellDemandOf,feederSideOrder,ANCHOR_STEP,LANE_STEP,barLaneX} from './feeder-packing';
export interface FeederCompartment {x1:number;x2:number;y1:number;y2:number;axis:number;direction:-1|1;titleY:number;flowY:number;equipmentY:number;units:number;model:boolean}
export type Point=readonly [number,number];
export interface PortPosition {x:number;y:number;terminalId:string;semantics:'busbar-section'|'bay-terminal'|'equipment-terminal';direction?:-1|0|1;slot?:string;railY?:number;railX2?:number;seriesRank?:number;seriesFeeder?:string}
export interface WireSegment {points:Point[];terminalId:string;contact:Point;side:'FROM'|'TO';waypoints?:Point[]}
export interface SwitchSlot {sw:StationTopologyGraph['switches'][number];a:PortPosition|undefined;b:PortPosition|undefined;x:number;y:number;rotation?:number;inline?:boolean;fixedCell?:boolean;contactFrom:Point;contactTo:Point;wires:WireSegment[];points:Point[];ordering:'NATIVE_ENDPOINTS'|'CUBICLE_ATTACHMENT'|'NATIVE_SOURCE_ORDER'|'SOURCE_ORDER_UNAVAILABLE'|'BAR_ATTACHMENT'|'INTERBUS_CIRCUIT'}
/** V3.6 planned bar connection: the bay's own lane, its own collector outside the rail
 *  group and its own spine. A bar conductor may never leave this corridor. */
export interface BayRailAttachment {laneX:number;spineX:number;collectorY:number;sign:-1|1;railY:number;localEntry?:boolean}
export interface EquipmentPort {terminalId:string;side:number;point:Point;wires:WireSegment[];boundaryKv:number|null;corridor?:number}
export interface EquipmentGeometry {equipment:StationTopologyGraph['equipment'][number];x:number;y:number;direction:-1|1;ports:EquipmentPort[];nativePorts:PortPosition[];boundary:boolean;rotation?:number;straightModelSpine?:boolean;caption?:{x:number;y:number}}
/** Orthogonal paths terminate at physical contacts; the renderer consumes them unchanged. */
export function routeOrthogonalEdges(start:Point,end:Point,options:RoutingOptions={}):Point[]{return optimizedOrthogonalRoute(start,end,options);}
function wire(start:Point,end:Point,terminalId:string,side:'FROM'|'TO',options:RoutingOptions={}):WireSegment{return {points:routeOrthogonalEdges(start,end,options),terminalId,contact:end,side};}
function segmentsTouch(a:Point,b:Point,c:Point,d:Point){
 return Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))+.01&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))+.01;
}
/** Different source LV islands may share an HV node, never a drawn LV node. */
function reserveGsuAxis(x:number,y:number,component:ReadonlyMap<string,number>,step:number,claimed:readonly PortPosition[]){
 const ranks=new Map<number,number>(),relative=[...component].map(([id,depth])=>{const rank=ranks.get(depth)??0;ranks.set(depth,rank+1);return {id,x:rank*48,y:y+depth*step};});
 for(let attempt=0;attempt<256;attempt++){const axis=x+attempt*128;if(relative.every(p=>claimed.every(c=>c.terminalId===p.id||Math.abs(axis+p.x-c.x)>=40||Math.abs(p.y-c.y)>=40)))return axis;}
 throw Error('SLD_GSU_AXES_EXHAUSTED');
}
function simplifyConductor(points:Point[]):Point[]{const result:Point[]=[];for(const p of points){const last=result.at(-1);if(last&&last[0]===p[0]&&last[1]===p[1])continue;while(result.length>1){const a=result.at(-2)!,b=result.at(-1)!;if((b[0]-a[0])*(p[1]-b[1])!==(b[1]-a[1])*(p[0]-b[0])||(b[0]-a[0])*(p[0]-b[0])+(b[1]-a[1])*(p[1]-b[1])<=0)break;result.pop();}result.push(p);}return result.length===1?[result[0],result[0]]:result;}
const pt=(p:PortPosition):Point=>[p.x,p.y];
type GlyphBox={id:string;x1:number;x2:number;y1:number;y2:number};
const intersects=(a:GlyphBox,b:GlyphBox)=>a.x1<b.x2&&a.x2>b.x1&&a.y1<b.y2&&a.y2>b.y1;
/** Fix a proven series spine before placing any glyph. Source bypasses use their
 * own real edges and lanes. Reversing source FIDs cannot reverse the spine. */
function alignNativeSeries(graph:StationTopologyGraph,ports:Map<string,PortPosition>,lanes:Map<string,number>,offsets:ReadonlyMap<string,number>,step:number,axes:ReadonlyMap<string,number>,reference=false){
 const sections=new Set(graph.busSections.map(b=>b.id));
 for(const f of graph.feeders){const main=feederDrawingPath(graph,f);if(!main||main.terminals.some(id=>!ports.has(id)))continue;
  const nodes=main.terminals.filter(id=>!sections.has(id)),first=ports.get(nodes[0]);if(!first||first.direction===0)continue;
  const axis=axes.get(f.id)??first.x,sign=first.direction===-1?-1:1,offset=offsets.get(main.switchIds[0])??0,ys=graph.busSections.filter(b=>f.busSectionIds.includes(b.id)||b.voltageKv===f.voltageKv).map(b=>ports.get(b.id)?.y).filter((y):y is number=>y!=null).map(y=>y+offset),origin=ys.length?(sign<0?Math.min(...ys):Math.max(...ys)):first.y-sign*66;
  for(const id of f.terminalIds)if(!sections.has(id)&&ports.has(id))ports.get(id)!.railY=origin;
  const owned=(id:string)=>{const parent=graph.terminals.find(t=>t.id===id)?.parentId;return parent===f.id||!graph.feeders.some(f=>f.id===parent&&f.sourceClass==='ElmBay');};
  nodes.forEach((id,i)=>{if(!owned(id))return;const p=ports.get(id)!;p.x=axis;p.y=origin+sign*((i+1)*step+18);p.seriesRank=i+1;p.seriesFeeder=f.id;});
  // Rank real off-spine components outwards from their actual fork. In
  // particular, distance measured backwards from a transformer must not put a
  // dangling bank branch back across the upstream breaker.
  const internal=graph.switches.filter(s=>f.switchIds.includes(s.id)&&s.from!==s.to&&!sections.has(s.from)&&!sections.has(s.to)),placed=new Set(nodes);let column=0;
  for(const root of nodes)for(const e of internal){const next=e.from===root?e.to:e.to===root?e.from:null;if(!next||placed.has(next))continue;const bank=reference&&graph.equipment.filter(e=>e.kind==='transformer'&&e.terminals.includes(root)).length>1,x=axis+48*++column+(bank?80:0),base=ports.get(root)!,queue:[string,number][]=[[next,1]];placed.add(next);
   for(let i=0;i<queue.length;i++){const [id,depth]=queue[i],p=ports.get(id);if(!p||!owned(id))continue;p.x=x;p.y=base.y+sign*depth*step;p.direction=sign;p.railY=origin;p.seriesRank=(base.seriesRank??0)+depth;p.seriesFeeder=f.id;
    for(const edge of internal){const n=edge.from===id?edge.to:edge.to===id?edge.from:null;if(n&&!placed.has(n)){placed.add(n);queue.push([n,depth+1]);}}
   }
  }
  let branch=0;for(const sw of graph.switches.filter(s=>f.switchIds.includes(s.id)&&s.from!==s.to))if(sections.has(sw.from)!==sections.has(sw.to))lanes.set(sw.id,main.switchIds.includes(sw.id)?axis:axis+48*++branch);
 }
}
function freePosition(x:number,y:number,halfX:number,halfY:number,occupied:GlyphBox[],id:string,vertical=false,rectangle=false){
 const radius=rectangle?24:Math.max(64,occupied.length*2,Math.ceil(Math.max(0,80-y,40-x)/32)+8);
 const candidates=[[x,y],...Array.from({length:radius},(_,i)=>i+1).flatMap(n=>rectangle?Array.from({length:n+1},(_,j)=>j).flatMap(j=>[[x+j*32,y+(n-j)*32],[x-j*32,y+(n-j)*32],[x+j*32,y-(n-j)*32],[x-j*32,y-(n-j)*32]]):vertical?[[x,y+n*32],[x,y-n*32],[x+n*32,y],[x-n*32,y]]:[[x+n*32,y],[x-n*32,y],[x,y+n*32],[x,y-n*32]])];
 for(const [xx,yy]of candidates){const box={id,x1:xx-halfX,x2:xx+halfX,y1:yy-halfY,y2:yy+halfY};if(xx>40&&yy>80&&!occupied.some(o=>intersects(box,o))){occupied.push(box);return {x:xx,y:yy};}}
 throw Error('SLD_GLYPH_PACKING_UNRESOLVED: '+id+' @'+JSON.stringify([x,y]));
}
/** V3.6: a planned bar conductor always meets the rail band on this collector line. */
const COLLECTOR_OFFSET=40;
const halfWidth=(e:EquipmentGeometry)=>e.equipment.kind==='transformer3w'?30:18;
function separateEquipment(equipment:EquipmentGeometry[],ports:Map<string,PortPosition>,bars:GlyphBox[],switches:SwitchSlot[]=[]){const occupied:GlyphBox[]=[...bars,...switches.filter(r=>r.a||r.b).map(r=>({id:'SW|'+r.sw.id,x1:r.x-14,x2:r.x+14,y1:r.y-18,y2:r.y+18})),...[...ports.values()].map(p=>({id:'PORT|'+p.terminalId,x1:p.x-2,x2:p.x+2,y1:p.y-2,y2:p.y+2}))];for(const e of equipment){const p=freePosition(e.x,e.y,halfWidth(e),19,occupied,e.equipment.sourceClass+'|'+e.equipment.id,e.straightModelSpine),dx=p.x-e.x,dy=p.y-e.y;e.x=p.x;e.y=p.y;for(const port of e.ports){port.point=[port.point[0]+dx,port.point[1]+dy];const native=e.nativePorts.find(p=>p.terminalId===port.terminalId)!;port.wires=[wire(pt(native),port.point,port.terminalId,port.side===1?'TO':'FROM')];}}}
function separateSwitches(routes:SwitchSlot[],equipment:EquipmentGeometry[],bars:GlyphBox[],railPasses=false){
 const occupied:GlyphBox[]=[...bars,...equipment.map(e=>({id:e.equipment.id,x1:e.x-halfWidth(e),x2:e.x+halfWidth(e),y1:e.y-19,y2:e.y+19})),...[...equipment.flatMap(e=>e.nativePorts),...routes.flatMap(r=>[r.a,r.b].filter((p):p is PortPosition=>!!p))].map(p=>({id:'PORT|'+p.terminalId,x1:p.x-2,x2:p.x+2,y1:p.y-2,y2:p.y+2}))];
 // Inline devices reserve their actual position first. A glyph packer must never
 // turn a proven series device into a side branch to make a layout check pass.
 const fixed=(r:SwitchSlot)=>r.inline||r.fixedCell||r.ordering==='BAR_ATTACHMENT';
 const order=[...routes.filter(fixed),...routes.filter(r=>!fixed(r))];
 for(const r of order){if(!r.a&&!r.b)continue;const hx=Math.abs(r.rotation??0)===90?18:14,hy=Math.abs(r.rotation??0)===90?11:18,id=r.sw.sourceClass+'|'+r.sw.sourceId,box={id,x1:r.x-hx,x2:r.x+hx,y1:r.y-hy,y2:r.y+hy};let p:{x:number;y:number};
  if(r.inline||r.fixedCell||r.ordering==='BAR_ATTACHMENT'){if((r.inline||r.fixedCell)&&occupied.some(o=>intersects(box,o)))throw Error('SLD_SERIAL_AXIS_UNRESOLVED: '+id+' @'+JSON.stringify([r.x,r.y])+' hits '+JSON.stringify(occupied.filter(o=>intersects(box,o))));occupied.push(box);p={x:r.x,y:r.y};}else p=freePosition(r.x,r.y,hx,hy,occupied,id,true);
  const dx=p.x-r.x,dy=p.y-r.y;if(!dx&&!dy)continue;r.x=p.x;r.y=p.y;r.contactFrom=[r.contactFrom[0]+dx,r.contactFrom[1]+dy];r.contactTo=[r.contactTo[0]+dx,r.contactTo[1]+dy];
  if(r.ordering==='NATIVE_ENDPOINTS'&&r.a&&r.b){const cf:Point=[Math.sign(r.contactFrom[0]-r.x),Math.sign(r.contactFrom[1]-r.y)],ct:Point=[Math.sign(r.contactTo[0]-r.x),Math.sign(r.contactTo[1]-r.y)];r.wires=[wire(pt(r.a),r.contactFrom,r.sw.from,'FROM',{endNormal:cf}),wire(r.contactTo,pt(r.b),r.sw.to,'TO',{startNormal:ct})];r.points=r.wires.flatMap(w=>w.points);}
 }
 // Packing moves contacts. Reconnect an explicitly ordered cubicle chain as a whole.
 const chains=new Map<string,SwitchSlot[]>();for(const r of routes)if(r.ordering==='NATIVE_SOURCE_ORDER'||r.ordering==='CUBICLE_ATTACHMENT'){const key=r.sw.from+'|'+r.sw.equipmentId;chains.set(key,[...(chains.get(key)??[]),r]);}
 for(const chain of chains.values()){chain.sort((a,b)=>(a.sw.sourceOrder??0)-(b.sw.sourceOrder??0));let start=pt(chain[0].a!);for(const r of chain){r.wires=[wire(start,r.contactFrom,r.sw.from,'FROM')];start=r.contactTo;}const last=chain.at(-1)!,port=equipment.find(e=>e.equipment.id===last.sw.equipmentId)?.ports.find(p=>p.terminalId===last.sw.from);if(port)port.wires=[wire(start,port.point,port.terminalId,port.side===1?'TO':'FROM')];}
 // Routing uses the actual other glyph obstacles and previous wires, preserving source endpoints.
 const accepted:{terminal:string;points:Point[]}[]=[...bars.filter(b=>b.id.startsWith('BAR|')).map(b=>({terminal:b.id.slice(4,b.id.lastIndexOf('|')),points:[[b.x1,(b.y1+b.y2)/2],[b.x2,(b.y1+b.y2)/2]] as Point[]})),...routes.filter(r=>!['NATIVE_ENDPOINTS','BAR_ATTACHMENT','INTERBUS_CIRCUIT'].includes(r.ordering)).flatMap(r=>r.wires.map(w=>({terminal:w.terminalId,points:w.points})))];
 const avoid=(start:Point,end:Point,own:string,options:RoutingOptions={},bars=false,nativeId='')=>{
  if(start[0]===end[0]&&start[1]===end[1])return [start,end];
  const contains=(o:GlyphBox,p:Point)=>p[0]>=o.x1&&p[0]<=o.x2&&p[1]>=o.y1&&p[1]<=o.y2;
  const core=(body:GlyphBox)=>({...body,x1:(body.x1+body.x2)/2-7,x2:(body.x1+body.x2)/2+7,y1:(body.y1+body.y2)/2-9,y2:(body.y1+body.y2)/2+9}),orderedContacts=routes.filter(r=>r.sw.equipmentId===own&&r.sw.from===nativeId&&(r.ordering==='NATIVE_SOURCE_ORDER'||r.ordering==='CUBICLE_ATTACHMENT')&&[start,end].some(p=>[r.contactFrom,r.contactTo].some(c=>p[0]===c[0]&&p[1]===c[1]))).map(r=>r.sw.sourceClass+'|'+r.sw.sourceId);
  const all=occupied.filter(o=>o.id!==own&&o.id!=='LABEL|'+own&&(!o.id.startsWith('BAR|')||bars&&!railPasses)&&(!(o.id.startsWith('PORT|')||o.id.startsWith('BAR|'))||!contains(o,start)&&!contains(o,end))).map(o=>orderedContacts.includes(o.id)?core(o):o);const body=occupied.find(o=>o.id===own);if(body&&!contains(core(body),start)&&!contains(core(body),end))all.push(core(body));
  const existing=accepted.map(w=>w.points);let near=all.filter(o=>o.x2>=Math.min(start[0],end[0])-30&&o.x1<=Math.max(start[0],end[0])+30&&o.y2>=Math.min(start[1],end[1])-30&&o.y1<=Math.max(start[1],end[1])+30),points=routeOrthogonalEdges(start,end,{...options,obstacles:near,existing});
  // Perpendicular foreign nets can have a hop. Collinear foreign nets cannot
  // share a drawn conductor: reserve a separate lane without changing contacts.
  for(let n=0;n<24;n++){const hit=all.filter(o=>obstacleIntersections(points,[o])>0),lanes:GlyphBox[]=[];for(const w of accepted.filter(w=>w.terminal!==nativeId))for(let i=1;i<w.points.length;i++)for(let j=1;j<points.length;j++){const [a,b]=[w.points[i-1],w.points[i]],[c,d]=[points[j-1],points[j]],vertical=a[0]===b[0]&&c[0]===d[0]&&a[0]===c[0],horizontal=a[1]===b[1]&&c[1]===d[1]&&a[1]===c[1];if(!vertical&&!horizontal)continue;const axis=vertical?1:0,lo=Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis])),hi=Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]));if(hi-lo<.1)continue;const box={id:'NET|'+w.terminal,x1:vertical?a[0]-3:lo-3,x2:vertical?a[0]+3:hi+3,y1:vertical?lo-3:a[1]-3,y2:vertical?hi+3:a[1]+3};if(!contains(box,start)&&!contains(box,end))lanes.push(box);}
   const on=(p:Point,a:Point,b:Point)=>a[0]===b[0]?Math.abs(p[0]-a[0])<.01&&p[1]>=Math.min(a[1],b[1])-.01&&p[1]<=Math.max(a[1],b[1])+.01:Math.abs(p[1]-a[1])<.01&&p[0]>=Math.min(a[0],b[0])-.01&&p[0]<=Math.max(a[0],b[0])+.01;
   for(const w of accepted.filter(w=>w.terminal!==nativeId))for(let i=1;i<w.points.length;i++)for(let j=1;j<points.length;j++){const a=w.points[i-1],b=w.points[i],c=points[j-1],d=points[j];for(const p of [...[a,b].filter(p=>on(p,c,d)),...[c,d].filter(p=>on(p,a,b))]){const box={id:'NET_TOUCH|'+w.terminal,x1:p[0]-3,x2:p[0]+3,y1:p[1]-3,y2:p[1]+3};if(!contains(box,start)&&!contains(box,end))lanes.push(box);}}
   if(!hit.length&&!lanes.length)break;near=[...new Set([...near,...hit]),...lanes];points=routeOrthogonalEdges(start,end,{...options,obstacles:near,existing});}const unresolved=all.filter(o=>obstacleIntersections(points,[o])>0);if(unresolved.length)throw Error('SLD_ROUTE_BLOCKED: '+own+' '+JSON.stringify({start,end,options,hits:unresolved,blockedEnds:all.filter(o=>contains(o,start)||contains(o,end))}));return points;
 };
 for(const r of routes){for(const [i,w]of r.wires.entries()){if(!['NATIVE_ENDPOINTS','BAR_ATTACHMENT','INTERBUS_CIRCUIT'].includes(r.ordering))continue;const normal:Point=i===0?[Math.sign(r.contactFrom[0]-r.x),Math.sign(r.contactFrom[1]-r.y)]:[Math.sign(r.contactTo[0]-r.x),Math.sign(r.contactTo[1]-r.y)],a=w.points[0],b=w.points.at(-1)!,own=r.sw.sourceClass+'|'+r.sw.sourceId,bar=(i===0?r.a:r.b)?.semantics==='busbar-section';
   if(bar){const native=i===0?a:b,contact=i===0?b:a,sign=Math.sign(contact[1]-native[1])||1,blockers=occupied.filter(o=>o.id!==own&&!o.id.startsWith('BAR|')&&!o.id.startsWith('PORT|')),length=[12,10,8].find(length=>{const escape:Point=[native[0],native[1]+sign*length];return obstacleIntersections([native,escape],blockers)===0&&accepted.filter(w=>w.terminal!==r.wires[i].terminalId).every(w=>w.points.slice(1).every((q,n)=>!segmentsTouch(native,escape,w.points[n],q)));});if(length==null)throw Error('SLD_BAR_ESCAPE_BLOCKED: '+r.sw.id);const gap:Point=[native[0],native[1]+sign*length];w.points=i===0?[native,...avoid(gap,contact,own,{endNormal:normal},true,w.terminalId)]:[...avoid(contact,gap,own,{startNormal:normal},true,w.terminalId),native];}
   else w.points=avoid(a,b,own,i===0?{endNormal:normal}:{startNormal:normal},true,w.terminalId);w.points=simplifyConductor(w.points);accepted.push({terminal:w.terminalId,points:w.points});}r.points=r.wires.flatMap(w=>w.points);}
 for(const e of equipment)for(const port of e.ports)for(const w of port.wires){const waypoints=(w.waypoints??[]).map(p=>{const clear=(q:Point)=>!occupied.some(o=>o.id!==e.equipment.id&&q[0]>=o.x1&&q[0]<=o.x2&&q[1]>=o.y1&&q[1]<=o.y2);if(clear(p))return p;for(let n=1;n<=64;n++)for(const sign of [1,-1]){const q:Point=[p[0],p[1]+sign*n*8];if(clear(q))return q;}throw Error('SLD_CORRIDOR_WAYPOINT_BLOCKED: '+e.equipment.id);});w.waypoints=waypoints;const tr=e.equipment.kind==='transformer'||e.equipment.kind==='transformer3w'||!!e.equipment.reactiveSymbol,normal:Point=e.equipment.reactiveSymbol?[Math.sign(port.point[0]-e.x),Math.sign(port.point[1]-e.y)]:port.side===0?[0,-1]:port.side===1?[0,1]:[1,0],stops=[w.points[0],...waypoints,w.points.at(-1)!],points:Point[]=[];for(let i=1;i<stops.length;i++){const segment=avoid(stops[i-1],stops[i],e.equipment.id,tr&&i===stops.length-1?{endNormal:normal}:{},true,w.terminalId);points.push(...segment.slice(i===1?0:1));accepted.push({terminal:w.terminalId,points:segment});}w.points=simplifyConductor(points);}
}
/** Native endpoints own one glyph; cubicle self-loops attach only to their source equipment lead. */
export function buildSwitchDeviceChain(graph:StationTopologyGraph,ports:Map<string,PortPosition>,barLanes:Map<string,number>,equipment:EquipmentGeometry[],barOffsets:ReadonlyMap<string,number>=new Map(),barAttachment:ReadonlyMap<string,BayRailAttachment>=new Map()):SwitchSlot[]{
 const sections=new Set(graph.busSections.map(b=>b.id)),routes:SwitchSlot[]=[],loops=new Map<string,StationTopologyGraph['switches']>();
 for(const sw of graph.switches){
  if(sw.from===sw.to){const k=sw.from+'|'+(sw.equipmentId??'');loops.set(k,[...(loops.get(k)??[]),sw]);continue;}
  let a=ports.get(sw.from),b=ports.get(sw.to);
  if(a&&sections.has(sw.from))a={...a,x:barLanes.get(sw.id)??b?.x??a.x,y:a.y+(barOffsets.get(sw.id)??0)};
  if(b&&sections.has(sw.to))b={...b,x:barLanes.get(sw.id)??a?.x??b.x,y:b.y+(barOffsets.get(sw.id)??0)};
  // A source switch without ElmBay ownership still needs an independent rail
  // anchor. Sharing the bay's first anchor traps its lead behind that bay glyph.
  if(sw.bayId===null&&a&&b&&sections.has(sw.from)!==sections.has(sw.to)){const bar=sections.has(sw.from)?a:b,used=routes.flatMap(r=>[r.a,r.b].filter((p):p is PortPosition=>!!p&&p.semantics==='busbar-section'&&p.terminalId===bar.terminalId));while(used.some(p=>Math.abs(p.x-bar.x)<32))bar.x+=32;}
  const bothBars=sections.has(sw.from)&&sections.has(sw.to),horizontal=!!a&&!!b&&a.y===b.y&&!bothBars;let x=horizontal?(a!.x+b!.x)/2:a?.x??b?.x??0;
  // A genuine fork starts at a shared node, then continues on its own branch
  // axis. Place the first branch device on that axis, rather than relocating it
  // halfway sideways when it collides with the sibling branch's first device.
  if(a&&b&&!horizontal&&!sections.has(sw.from)&&!sections.has(sw.to)&&a.x!==b.x)x=a.seriesFeeder&&!b.seriesFeeder?b.x:b.seriesFeeder&&!a.seriesFeeder?a.x:Math.abs(a.y-(a.railY??b.railY??0))>Math.abs(b.y-(b.railY??a.railY??0))?a.x:b.x;
  const midpointY=a&&b?(bothBars?Math.max(a.y,b.y)+60:(a.y+b.y)/2):a?.y??b?.y??0,sign=horizontal?(b!.x<a!.x?-1:1):a&&b&&b.y<a.y&&!bothBars?-1:1,half=16;
  let y=midpointY;if(bothBars&&b)b={...b,x:b.x+36};if(a&&b&&!bothBars&&(sections.has(sw.from)||sections.has(sw.to))){const f=graph.feeders.find(f=>f.switchIds.includes(sw.id)),bar=sections.has(sw.from)?a:b,near=sections.has(sw.from)?b:a,ys=(f?.busSectionIds??[bar.terminalId]).map(id=>ports.get(id)?.y).filter((v):v is number=>v!=null).map(v=>v+(barOffsets.get(sw.id)??0));y=near.direction===-1?(near.railY??Math.min(...ys))-28:(near.railY??Math.max(...ys))+28;}
  const contactFrom:Point=horizontal?[x-sign*half,y]:[x,y-sign*half],contactTo:Point=horizontal?[x+sign*half,y]:[x,y+sign*half],normal:Point=horizontal?[sign,0]:[0,sign],wires=a&&b?[wire(pt(a),contactFrom,sw.from,'FROM',{endNormal:[-normal[0],-normal[1]]}),wire(contactTo,pt(b),sw.to,'TO',{startNormal:normal})]:[];
  if(bothBars&&b)wires[1].points=[contactTo,[x,y+30],[b.x,y+30],[b.x,b.y]];
  const parallel=graph.switches.some(s=>s.id!==sw.id&&(s.from===sw.from&&s.to===sw.to||s.from===sw.to&&s.to===sw.from));
  const proven=!!a&&!!b&&(a.seriesFeeder===sw.bayId&&b.seriesFeeder===sw.bayId&&Math.abs((a.seriesRank??0)-(b.seriesRank??0))===1||sections.has(sw.from)&&b.seriesFeeder===sw.bayId&&b.seriesRank===1||sections.has(sw.to)&&a.seriesFeeder===sw.bayId&&a.seriesRank===1);
const inline=sw.bayId!==null&&!parallel&&proven&&!!a&&!!b&&!bothBars&&(horizontal||a.x===b.x)&&Math.hypot(a.x-b.x,a.y-b.y)>=40;
   // V3.6 planned bar connection. The glyph sits on this bay's own lane just outside
   // its own real rail; the far end leaves the rail band on the bay collector, so the
   // conductor can never detour to a rail end. A bar-to-bar circuit keeps its own cell.
   const planned=!bothBars&&(sections.has(sw.from)||sections.has(sw.to))?barAttachment.get(sw.id):undefined;
   // Plan a bar conductor only when its own bay really continues outward past the bay
   // collector. A sibling-group coupler keeps the evidence-driven general router.
   if(planned?.localEntry&&a&&b){
    const barFirst=sections.has(sw.from),bar=barFirst?a:b,other=barFirst?b:a,{laneX,collectorY,sign}=planned;
    // All selector glyphs sit outside the rail band. Each tail meets its actual
    // source node once, at that node's y; it never runs along the series spine.
    const input:Point=[laneX,collectorY+sign*8],output:Point=[laneX,collectorY+sign*40],barPort:Point=[laneX,bar.y],node=pt(other);
    const lead:Point[]=[barPort,input],tail:Point[]=[output,[laneX,other.y],node];
    const cf=barFirst?input:output,ct=barFirst?output:input;
    const wires:WireSegment[]=barFirst?
     [{points:lead,terminalId:sw.from,contact:cf,side:'FROM'},{points:tail,terminalId:sw.to,contact:ct,side:'TO'}]:
     [{points:[...tail].reverse(),terminalId:sw.from,contact:cf,side:'FROM'},{points:[...lead].reverse(),terminalId:sw.to,contact:ct,side:'TO'}];
    routes.push({sw,a:{...a,x:barFirst?laneX:a.x},b:{...b,x:barFirst?b.x:laneX},x:laneX,y:collectorY+sign*24,rotation:barFirst?(sign<0?180:0):(sign<0?0:180),inline:false,contactFrom:cf,contactTo:ct,wires,points:wires.flatMap(w=>w.points),ordering:'BAR_ATTACHMENT'});
    continue;
   }
   if(planned&&a&&b&&((sections.has(sw.from)?b:a).y-planned.collectorY)*planned.sign>8){const barFirst=sections.has(sw.from),bar=barFirst?a:b,other=barFirst?b:a,{laneX,sign}=planned;
    const input:Point=[laneX,bar.y+sign*8],output:Point=[laneX,bar.y+sign*40],lead:Point[]=[[laneX,bar.y],input],levelRails=[...ports.values()].filter(p=>p.semantics==='busbar-section'&&graph.terminals.find(t=>t.id===p.terminalId)?.vnKv===graph.terminals.find(t=>t.id===bar.terminalId)?.vnKv),crossed=levelRails.some(p=>p.terminalId!==bar.terminalId&&p.y>Math.min(output[1],other.y)&&p.y<Math.max(output[1],other.y)),outside=Math.max(...levelRails.map(p=>p.railX2??p.x))+32;
    // The legacy strict no-crossing view uses an external corridor; the compact
    // reference view above uses explicit insulated passages. Both meet the
    // actual source node directly, without joining an upstream series spine.
    const tail:Point[]=crossed?[output,[outside,output[1]],[outside,other.y],pt(other)]:[output,[laneX,other.y],pt(other)],cf=barFirst?input:output,ct=barFirst?output:input;
    const wires:WireSegment[]=barFirst?[{points:lead,terminalId:sw.from,contact:cf,side:'FROM'},{points:tail,terminalId:sw.to,contact:ct,side:'TO'}]:[{points:[...tail].reverse(),terminalId:sw.from,contact:cf,side:'FROM'},{points:[...lead].reverse(),terminalId:sw.to,contact:ct,side:'TO'}];
    routes.push({sw,a,b,x:laneX,y:bar.y+sign*24,rotation:barFirst?(sign<0?180:0):(sign<0?0:180),inline:false,fixedCell:true,contactFrom:cf,contactTo:ct,wires,points:wires.flatMap(w=>w.points),ordering:'NATIVE_ENDPOINTS'});
    continue;}
   routes.push({sw,a,b,x,y,rotation:horizontal?90:0,inline,contactFrom,contactTo,wires,points:wires.flatMap(w=>w.points),ordering:'NATIVE_ENDPOINTS'});
  }
 for(const switches of loops.values()){
  const sw0=switches[0],a=ports.get(sw0.from),target=equipment.find(e=>e.equipment.id===sw0.equipmentId&&e.ports.some(p=>p.terminalId===sw0.from)),port=target?.ports.find(p=>p.terminalId===sw0.from);
  const ordered=switches.length===1||switches.every(s=>s.sourceOrder!=null)&&new Set(switches.map(s=>s.sourceOrder)).size===switches.length;
  if(!ordered&&a){for(const [i,sw]of switches.entries())routes.push({sw,a,b:a,x:a.x+50+i*36,y:a.y+36,contactFrom:[a.x+50+i*36,a.y+20],contactTo:[a.x+50+i*36,a.y+52],wires:[],points:[],ordering:'SOURCE_ORDER_UNAVAILABLE'});continue;}
  if(a&&port){const sign=port.point[1]<a.y?-1:1;let start=pt(a);switches.sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
   switches.sort((a,b)=>(a.sourceOrder??0)-(b.sourceOrder??0));
   for(const [i,sw]of switches.entries()){const x=port.point[0],y=a.y+sign*(28+i*38),half=16,cf:Point=[x,y-sign*half],ct:Point=[x,y+sign*half];routes.push({sw,a,b:a,x,y,contactFrom:cf,contactTo:ct,wires:[wire(start,cf,sw.from,'FROM')],points:routeOrthogonalEdges(start,cf),ordering:switches.length===1?'CUBICLE_ATTACHMENT':'NATIVE_SOURCE_ORDER'});start=ct;}
   port.wires=[wire(start,port.point,port.terminalId,port.side===1?'TO':'FROM')];
  }else for(const sw of switches)routes.push({sw,a,b:a,x:a?.x??0,y:a?.y??0,contactFrom:[a?.x??0,a?.y??0],contactTo:[a?.x??0,a?.y??0],wires:[],points:[],ordering:'SOURCE_ORDER_UNAVAILABLE'});
 }
 return routes.sort((a,b)=>a.sw.id.localeCompare(b.sw.id));
}
/** Presentation only: roles -> voltage zones -> V4 slots -> native chains -> orthogonal wires. */
export function physicalStationLayout(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>,compact=false,focus=false){
 const ports=new Map<string,PortPosition>(),sections=new Set(graph.busSections.map(b=>b.id)),terminal=new Map(graph.terminals.map(t=>[t.id,t]));
 const step=compact?48:52,lane=76,blockHeight=380;
 const slots=graph.voltageLevels.filter(kv=>voltageMatches(kv,bands)).flatMap(kv=>assignYtbsSlot(graph,graph.feeders.filter(f=>f.voltageKv===kv)));
 const maxBlock=Math.max(0,...slots.map(s=>s.block)),unknownCount=Math.max(0,...graph.voltageLevels.map(kv=>slots.filter(s=>s.feeder.voltageKv===kv&&s.side===null).length));
 const knownRight=focus?410:Math.max(900,...slots.filter(s=>s.side).map(s=>260+(s.column+(s.side==='B'?.5:0))*lane));
 const width=knownRight+(focus?50:180),base:StationLayout={width,height:0,sections:[],feeders:[],levels:[],omitted:0,pageCount:maxBlock+1},barLanes=new Map<string,number>(),barOffsets=new Map<string,number>(),slotMap=new Map(slots.map(s=>[s.feeder.id,s]));let top=100;
 for(const kv of graph.voltageLevels.filter(kv=>voltageMatches(kv,bands))){
  const bars=graph.busSections.filter(b=>b.voltageKv===kv),own=slots.filter(s=>s.feeder.voltageKv===kv),maxDepth=Math.max(2,...own.map(s=>new Set(s.feeder.terminalIds.filter(id=>!sections.has(id))).size)),extent=(Math.min(maxDepth,8)+1)*step+48,barY=top+extent;
  const arrangement=resolveBarArrangements(graph,kv),arrangementById=new Map(arrangement.map(a=>[a.section.id,a.block])),ranksByBlock=new Map<number,number>();
  base.levels.push({kv,y:barY});bars.forEach(section=>{const block=arrangementById.get(section.id)??0,index=ranksByBlock.get(block)??0;ranksByBlock.set(block,index+1);const offset=block*blockHeight,p={section,x1:210,x2:knownRight+60,y:barY+index*26+offset};base.sections.push(p);ports.set(section.id,{x:p.x1,y:p.y,terminalId:section.id,semantics:'busbar-section',railX2:p.x2});});
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
 const placedGsu=new Set<string>(),gsuClaims:PortPosition[]=[];
 for(const e of graph.equipment.filter(e=>e.kind==='transformer'&&e.terminals.length===2)){
  const a=ports.get(e.terminals[0]),b=ports.get(e.terminals[1]);if(!a||!b||graph.busSections.some(s=>s.voltageKv===terminal.get(b.terminalId)?.vnKv))continue;
  const component=new Map([[b.terminalId,0]]),q=[b.terminalId];for(let i=0;i<q.length;i++)for(const sw of graph.switches){const next=sw.from===q[i]?sw.to:sw.to===q[i]?sw.from:null;if(next&&ports.has(next)&&terminal.get(next)?.vnKv===terminal.get(b.terminalId)?.vnKv&&!component.has(next)){component.set(next,component.get(q[i])!+1);q.push(next);}}
  if(placedGsu.has(b.terminalId))continue;
  const zone=base.levels.find(l=>l.kv===terminal.get(b.terminalId)?.vnKv),anchor=reserveGsuAxis(a.x,(zone?.y??b.y)-64,component,step,gsuClaims);
  const ranks=new Map<number,number>();for(const [id,depth]of component){const p=ports.get(id)!,rank=ranks.get(depth)??0;ranks.set(depth,rank+1);p.x=anchor+rank*48;p.y=(zone?.y??b.y)-64+depth*step;p.direction=1;placedGsu.add(id);gsuClaims.push(p);}
 }
 alignNativeSeries(graph,ports,barLanes,barOffsets,step,new Map(base.feeders.map(f=>[f.feeder.id,f.x])));
 const equipment:EquipmentGeometry[]=[];
 for(const e of graph.equipment){
  const visible=e.terminals.map(id=>ports.get(id)).filter((p):p is PortPosition=>!!p);if(!visible.length)continue;
  const transformer=e.kind==='transformer'||e.kind==='transformer3w',direction=visible[0].direction===-1?-1:1,parallel=graph.equipment.filter(o=>(transformer?o.kind===e.kind:o.kind!=='transformer'&&o.kind!=='transformer3w')&&o.terminals.join('|')===e.terminals.join('|')),offset=(parallel.indexOf(e)-(parallel.length-1)/2)*54,loopCount=graph.switches.filter(s=>s.from===s.to&&s.equipmentId===e.id).length;let x=visible[0].x+offset,y=visible[0].y+direction*Math.max(58,loopCount*38+44);
  if(transformer&&visible.length>=2){const zones=e.terminals.map(id=>base.levels.find(l=>l.kv===terminal.get(id)?.vnKv)?.y).filter((v):v is number=>v!=null);const [a,b]=visible;y=(a.y+b.y)/2;x=(a.x+b.x)/2+offset;}
  else if(e.kind==='line'&&visible.length===2){x=(visible[0].x+visible[1].x)/2+offset;y=Math.min(visible[0].y,visible[1].y)-52;}
  const series=e.kind==='seriesCompensator',rotation=series&&visible.length===2&&visible[0].y>visible[1].y?180:0;
  if(series&&visible.length===2){x=(visible[0].x+visible[1].x)/2+offset;y=(visible[0].y+visible[1].y)/2;}
  const boundary=transformer&&visible.length<e.terminals.length;
  const contactOffset=e.kind==='line'?16:e.kind==='generator'?13:e.kind==='load'?14:e.reactiveSymbol||series?18:12;
  const leads:EquipmentPort[]=visible.map(p=>{const side=e.terminals.indexOf(p.terminalId),end:Point=boundary?[x,y]:transformer?[x+(side===2?26:0),y+(side===0?-18:side===1?18:0)]:series?[x,y+(side===0?-18:18)*(rotation===180?-1:1)]:e.kind==='line'&&visible.length===2?[x,y]:[x,y-direction*contactOffset];return {terminalId:p.terminalId,side,point:end,wires:[wire(pt(p),end,p.terminalId,side===1?'TO':'FROM')],boundaryKv:boundary?(terminal.get(e.terminals.find(id=>!ports.has(id))??'')?.vnKv??null):null};});
  equipment.push({equipment:e,x,y,direction,ports:leads,nativePorts:visible,boundary,rotation});
 }
 const barObstacles:GlyphBox[]=base.sections.map((b,i)=>({id:'BAR|'+b.section.id+'|'+i,x1:b.x1,x2:b.x2,y1:b.y-3,y2:b.y+3}));const protectedPorts=new Map(ports);for(const sw of graph.switches)for(const id of [sw.from,sw.to])if(sections.has(id)&&ports.has(id)){const p=ports.get(id)!;protectedPorts.set(sw.id+'|'+id,{...p,x:barLanes.get(sw.id)??ports.get(id===sw.from?sw.to:sw.from)?.x??p.x,y:p.y+(barOffsets.get(sw.id)??0)});}separateEquipment(equipment,protectedPorts,barObstacles,buildSwitchDeviceChain(graph,ports,barLanes,equipment,barOffsets));
 const routes=buildSwitchDeviceChain(graph,ports,barLanes,equipment,barOffsets);separateSwitches(routes,equipment,barObstacles);
 base.height=Math.max(focus?280:400,focus?0:top,...base.sections.map(p=>p.y+70),...equipment.map(e=>e.y+80),...routes.map(r=>r.y+55));base.width=Math.max(base.width,...[...ports.values()].map(p=>p.x+100),...base.sections.map(p=>p.x2+70),...routes.map(r=>r.x+50));
 return {...base,ports,routes,equipment,slots,slotMap,transformers:equipment.filter(e=>e.equipment.kind==='transformer').map(e=>({equipment:e.equipment,ports:e.nativePorts}))};
}
/** One native section owns one continuous rail. Density expands its occupied span,
 * never duplicates a physical FID on a continuation row. */
export function connectedStationLayout(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>,flowLabels=false){
 let failure:unknown;for(const spacing of [1,1.5,2,3]){try{return connectedStationLayoutAttempt(graph,bands,flowLabels,spacing);}catch(error){if(!(error instanceof Error)||!/^SLD_/.test(error.message))throw error;failure=error;}}
 throw failure;
}
function connectedStationLayoutAttempt(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>,flowLabels:boolean,spacing:number){
 const referenceStyle=true; // One drawing policy for every station, independent of its identity.
 const left=160,step=48*spacing,ports=new Map<string,PortPosition>(),sections=new Set(graph.busSections.map(b=>b.id)),terminal=new Map(graph.terminals.map(t=>[t.id,t])),compartments=new Map<string,FeederCompartment>();
 const slots=graph.voltageLevels.filter(kv=>voltageMatches(kv,bands)).flatMap(kv=>assignYtbsSlot(graph,graph.feeders.filter(f=>f.voltageKv===kv))),slotMap=new Map(slots.map(s=>[s.feeder.id,s]));
 const base:StationLayout={width:640,height:0,sections:[],feeders:[],levels:[],omitted:0,pageCount:1},barLanes=new Map<string,number>(),barOffsets=new Map<string,number>(),anchors=new Map<string,{x:number;feeder:string;left:number;width:number}[]>(),barAttachment=new Map<string,BayRailAttachment>();let top=78,lowTop:number|null=null,lowLeft=left,lowBottom=0;
 const drawLevels=graph.voltageLevels.filter(kv=>voltageMatches(kv,bands));if(referenceStyle)drawLevels.sort((a,b)=>a<=40&&b<=40?a-b:b-a);
 for(const kv of drawLevels){
  const bars=graph.busSections.filter(b=>b.voltageKv===kv);
  // Standard source rail captions determine presentation order only: a transfer
  // rail follows the normal rails, while every source FID stays independent.
  if(referenceStyle&&kv<=40){const rank=(name:string)=>/\bB[- .]?T\b/i.test(name)?2:/\bTR[- .]?A\b/i.test(name)?0:/\bTR[- .]?B\b/i.test(name)?1:0;bars.sort((a,b)=>rank(a.name)-rank(b.name));}
  const own=slots.filter(s=>(graph.busSections.find(b=>s.feeder.busSectionIds.includes(b.id))?.voltageKv??s.feeder.voltageKv)===kv);if(!bars.length&&!own.length)continue;
  const groups=kv>40?[bars]:[...new Set(bars.map(b=>b.groupId))].map(id=>bars.filter(b=>b.groupId===id));if(!groups.length)groups.push([]);
  const consumed=new Set<string>();
  if(referenceStyle&&kv<=40){lowTop??=top;top=lowTop;}
  const layerTop=top;let groupLeft=referenceStyle&&kv<=40?lowLeft:left,layerBottom=top;
  for(const [groupIndex,groupBars]of groups.entries()){
   const left=groupLeft;if(referenceStyle&&kv<=40)top=layerTop;
   const ownSlots=own.filter(s=>!consumed.has(s.feeder.id)&&(s.feeder.busSectionIds.some(id=>groupBars.some(b=>b.id===id))||!s.feeder.busSectionIds.length&&groupIndex===0));ownSlots.forEach(s=>consumed.add(s.feeder.id));
// Unknown function stays unknown. Its actual native switch graph is still drawn below its rails.
    // One physical rail per real bus group: packing rows are never re-stacked into a second rail.
    const demands=new Map(ownSlots.map(s=>[s.feeder.id,feederCellDemandOf(graph,s.feeder,sections)]));
    const {upper:us,lower:ds}=partitionFeederSides(ownSlots,demands);
    if(referenceStyle){for(let i=us.length-1;i>=0;i--)if(nativeBarCircuit(graph,us[i].feeder))ds.push(...us.splice(i,1));ds.sort(feederSideOrder);
     // HV reference sheets place transfer before coupler. Caption/function is
     // used only to order already-proven native circuits, never to create one.
     if(kv>40){const cells=ds.filter(s=>nativeBarCircuit(graph,s.feeder)),rank=(s:typeof cells[number])=>s.role==='transfer'||/transfer/i.test(s.feeder.name)?0:1;cells.sort((a,b)=>rank(a)-rank(b)||feederSideOrder(a,b));let i=0;for(let j=0;j<ds.length;j++)if(nativeBarCircuit(graph,ds[j].feeder))ds[j]=cells[i++];}}
    const parts=[...us,...ds];
    const internalRanks=(f:typeof graph.feeders[number])=>{
     const ids=f.terminalIds.filter(id=>!sections.has(id)&&terminal.get(id)?.vnKv===f.voltageKv),edges=graph.switches.filter(s=>f.switchIds.includes(s.id)&&s.from!==s.to),barDegree=(id:string)=>edges.filter(s=>(s.from===id&&sections.has(s.to))||(s.to===id&&sections.has(s.from))).length;
     const root=ids.slice().sort((a,b)=>barDegree(b)-barDegree(a)||a.localeCompare(b))[0],distance=new Map<string,number>();if(root){distance.set(root,1);const q=[root];for(let i=0;i<q.length;i++)for(const e of edges){if(sections.has(e.from)||sections.has(e.to))continue;const next=e.from===q[i]?e.to:e.to===q[i]?e.from:null;if(next&&ids.includes(next)&&!distance.has(next)){distance.set(next,distance.get(q[i])!+1);q.push(next);}}}for(const id of ids)if(!distance.has(id))distance.set(id,Math.max(1,...distance.values())+1);return distance;
    };
    const ranks=new Map(parts.map(s=>[s.feeder.id,internalRanks(s.feeder)])),extent=(ss:typeof parts,padding=flowLabels?240:110)=>Math.max(0,...ss.map(s=>Math.max(1,...ranks.get(s.feeder.id)!.values())*step+padding)),up=!groupBars.length?0:referenceStyle&&kv<=40?Math.max(0,...slots.filter(s=>s.feeder.voltageKv<=40).map(s=>Math.max(1,...internalRanks(s.feeder).values())*step+(flowLabels?226:148))):extent(us,flowLabels?226:148),down=extent(ds),maxAnchors=Math.max(1,...parts.map(s=>(demands.get(s.feeder.id)??{barAnchors:0}).barAnchors)),barY=top+up+20,railGap=groupBars.length>1?(referenceStyle?18:40+20*maxAnchors):0,lastY=barY+(groupBars.length-1)*railGap;
    base.levels.push({kv,y:barY});
    // One atomic plan: measured widths, then every real busbar anchor of every feeder.
    // An anchor clash moves the whole remaining tail; it never shifts one drawn contact.
    const plan:{slot:typeof us[number];side:-1|1;width:number;left:number;axis:number}[]=[];
    for(const [list,side]of[[us,-1],[ds,1]]as const){let cursor=left+20+(side===1&&us.length?44:0);for(const slot of list){const bank=referenceStyle&&kv>40&&(demands.get(slot.feeder.id)?.parallelWindings??0)>1,width=(bank?Math.max(420,feederCellWidth(slot,demands.get(slot.feeder.id))):feederCellWidth(slot,demands.get(slot.feeder.id)))*spacing;plan.push({slot,side,width,left:cursor,axis:cursor+width/2-12});cursor+=width;}}
    const barIndex=new Map(groupBars.map((b,i)=>[b.id,i])),levelBars=new Set(bars.map(b=>b.id)),anchorsOf=(entry:typeof plan[number])=>{const seen=new Map<string,number>();
     const own=groupBars.filter(b=>entry.slot.feeder.busSectionIds.includes(b.id)),main=feederDrawingPath(graph,entry.slot.feeder),near=referenceStyle&&kv>0?Math.max(0,own.findIndex(b=>b.id===main?.terminals[0])):entry.side<0?0:own.length-1;
     for(const id of entry.slot.feeder.switchIds){const sw=graph.switches.find(e=>e.id===id);if(!sw)continue;for(const end of [sw.from,sw.to]){if(!sections.has(end)||!levelBars.has(end))continue;
      const i=own.findIndex(b=>b.id===end);seen.set(end,i<0?entry.axis:barLaneX(entry.axis,i,near));}}
     return seen;};
    // One atomic reservation per real rail, including a rail of a sibling group that a
    // proven bus coupler reaches. A clash moves the whole cell that follows; it never
    // nudges a drawn contact, a symbol or a section after the fact.
    const occupiedLanes:number[]=[];
    for(const [index,entry]of plan.entries()){for(let guard=0;guard<=plan.length*4+4;guard++){let hit:number|null=null;
      for(const [bar,x]of anchorsOf(entry)){const used=referenceStyle&&groupBars.length>1?occupiedLanes:(anchors.get(bar)??[]).map(a=>a.x);for(const u of used)if(Math.abs(u-x)<LANE_STEP*.5){hit=u+LANE_STEP*.5-x;break;}if(hit!=null)break;}
      if(hit==null)break;
      for(const tail of plan.slice(index).filter(p=>p.side===entry.side)){tail.left+=hit;tail.axis=tail.left+tail.width/2-12;}}
     occupiedLanes.push(...anchorsOf(entry).values());
     for(const [bar,x]of anchorsOf(entry))anchors.set(bar,[...(anchors.get(bar)??[]),{x,feeder:entry.slot.feeder.id,left:entry.left,width:entry.width}]);}
    const remoteBays=graph.feeders.filter(f=>!ownSlots.some(s=>s.feeder.id===f.id)&&f.busSectionIds.some(id=>groupBars.some(b=>b.id===id))).length;const right=Math.max(left+200+remoteBays*64,Math.max(...plan.map(e=>e.left+e.width)))+56;
    for(const [i,b]of groupBars.entries()){const p={section:b,x1:left,x2:right,y:barY+i*railGap};base.sections.push(p);ports.set(b.id,{x:p.x1,y:p.y,terminalId:b.id,semantics:'busbar-section',railX2:p.x2});}
    for(const entry of plan){const s=entry.slot,upSide=entry.side<0,siblings=upSide?us:ds,sign=entry.side,origin=upSide?barY:lastY,rankCounts=new Map<number,number>(),distance=ranks.get(s.feeder.id)!,x=entry.axis;
     for(const [id,depth]of distance){const parent=terminal.get(id)?.parentId;if(ports.has(id)||parent!==s.feeder.id&&graph.feeders.some(f=>f.id===parent&&f.sourceClass==='ElmBay'))continue;const n=rankCounts.get(depth)??0;rankCounts.set(depth,n+1);ports.set(id,{x:x+n*48,y:origin+sign*(depth*step+18),terminalId:id,semantics:graph.equipment.some(e=>e.terminals.includes(id))?'equipment-terminal':'bay-terminal',direction:sign,slot:s.slot});}
     for(const id of s.feeder.switchIds){const sw=graph.switches.find(e=>e.id===id)!;const other=sections.has(sw.from)?sw.to:sw.from,bar=sections.has(sw.from)?sw.from:sw.to;if(!bar||!levelBars.has(bar))continue;
      // A proven coupler onto a sibling group keeps that rail's own y and its own lane.
      if(!barIndex.has(bar)){barLanes.set(sw.id,x);barOffsets.set(sw.id,0);
       if(!sections.has(other)&&ports.has(bar))barAttachment.set(sw.id,{laneX:x,spineX:x,collectorY:origin+sign*COLLECTOR_OFFSET,sign,railY:ports.get(bar)!.y});
       continue;}
      const own=groupBars.filter(b=>s.feeder.busSectionIds.includes(b.id)),ownIndex=own.findIndex(b=>b.id===bar),main=feederDrawingPath(graph,s.feeder),near=referenceStyle&&kv>0?Math.max(0,own.findIndex(b=>b.id===main?.terminals[0])):upSide?0:own.length-1,
       laneX=barLaneX(x,ownIndex<0?groupBars.findIndex(b=>b.id===bar):ownIndex,near),railY=barY+groupBars.findIndex(b=>b.id===bar)*railGap;
      barLanes.set(sw.id,laneX);barOffsets.set(sw.id,railY-ports.get(bar)!.y);
      if(!sections.has(other)&&!nativeBarCircuit(graph,s.feeder))barAttachment.set(sw.id,{laneX,spineX:x,collectorY:origin+sign*(referenceStyle&&kv>0?16:COLLECTOR_OFFSET),sign,railY,localEntry:referenceStyle&&kv>0});}
     const labelDepth=Math.max(1,...(referenceStyle?[...ranks.get(s.feeder.id)!.values()]:siblings.flatMap(t=>[...ranks.get(t.feeder.id)!.values()]))),labelY=origin+sign*(labelDepth*step+(upSide?(flowLabels?225:referenceStyle?99:147):112));base.feeders.push({feeder:s.feeder,x,y:labelY,busYs:groupBars.filter(b=>s.feeder.busSectionIds.includes(b.id)).map(b=>barY+groupBars.indexOf(b)*railGap)});
     compartments.set(s.feeder.id,{x1:entry.left,x2:entry.left+entry.width,y1:upSide?top:origin+20,y2:upSide?origin-20:origin+down+40,axis:x,direction:sign,titleY:labelY,flowY:labelY+56,equipmentY:labelY+76,units:feederAreaUnits(kv),model:isModelFeeder(s)});
    }
    top=lastY+down+44;
    if(referenceStyle&&kv<=40){layerBottom=Math.max(layerBottom,top);groupLeft=right+48;}
   }
   if(referenceStyle&&kv<=40){lowBottom=Math.max(lowBottom,layerBottom);lowLeft=groupLeft;top=lowBottom;}
  }
 // A barless GSU/generator component follows its actual HV winding. Preserve every branch
 // and the common native terminal; a shared generator node is not a physical busbar.
 const placedGsu=new Set<string>(),gsuClaims:PortPosition[]=[];
 for(const e of graph.equipment.filter(e=>e.kind==='transformer'&&e.terminals.length===2)){
  const a=ports.get(e.terminals[0]),b=ports.get(e.terminals[1]),kv=terminal.get(e.terminals[1])?.vnKv;if(!a||!b||graph.busSections.some(s=>s.voltageKv===kv))continue;
  const distance=new Map([[b.terminalId,0]]),q=[b.terminalId];for(let i=0;i<q.length;i++)for(const sw of graph.switches){const next=sw.from===q[i]?sw.to:sw.to===q[i]?sw.from:null;if(next&&ports.has(next)&&terminal.get(next)?.vnKv===kv&&!distance.has(next)){distance.set(next,distance.get(q[i])!+1);q.push(next);}}
  if(placedGsu.has(b.terminalId))continue;
  const origin=Math.max(a.y+200,graph.busSections.some(s=>s.voltageKv<=40)?top+80:0),anchor=reserveGsuAxis(a.x,origin,distance,step,gsuClaims);
  const rows=new Map<number,number>();for(const [id,depth]of distance){const p=ports.get(id)!,n=rows.get(depth)??0;rows.set(depth,n+1);p.x=anchor+n*48;p.y=origin+depth*step;p.direction=1;placedGsu.add(id);gsuClaims.push(p);}
  for(const f of base.feeders.filter(f=>f.feeder.voltageKv===kv&&f.feeder.terminalIds.some(id=>distance.has(id)))){const own=f.feeder.terminalIds.map(id=>ports.get(id)!).filter(Boolean),incoming=f.feeder.terminalIds.includes(b.terminalId);f.x=anchor+(incoming?-92:0);f.y=incoming?Math.min(...own.map(p=>p.y))+68:Math.max(...own.map(p=>p.y))+38;}
 }
 // Source terminals outside ElmBay ownership are retained, not assigned a fictitious bay.
 let orphan=0;for(const t of graph.terminals.filter(t=>voltageMatches(t.vnKv,bands)&&!ports.has(t.id)))ports.set(t.id,{x:left+64+(orphan%12)*98,y:top+Math.floor(orphan++/12)*90,terminalId:t.id,semantics:'equipment-terminal',direction:1});
 alignNativeSeries(graph,ports,barLanes,barOffsets,step,new Map(base.feeders.map(f=>[f.feeder.id,f.x])),referenceStyle);
 // Resolve every selector against its actual rail after all sibling groups exist.
 // A nominal-voltage mismatch never discards a source feeder or invents a bus.
 const duplicateSelectors=new Map<string,typeof graph.switches>();for(const sw of graph.switches){if(!barAttachment.get(sw.id)?.localEntry)continue;const barId=sections.has(sw.from)?sw.from:sw.to,key=sw.bayId+'|'+barId;duplicateSelectors.set(key,[...(duplicateSelectors.get(key)??[]),sw]);}for(const group of duplicateSelectors.values())if(group.length>1)for(const sw of group)barAttachment.get(sw.id)!.laneX=barLanes.get(sw.id)??barAttachment.get(sw.id)!.laneX;

 const selectorLanes=new Map<string,{id:string;x:number}[]>();for(const sw of graph.switches){const old=barAttachment.get(sw.id),barId=sections.has(sw.from)?sw.from:sw.to,rail=base.sections.find(b=>b.section.id===barId);if(old?.localEntry&&rail&&old.laneX>=rail.x1&&old.laneX<=rail.x2){const key=String(rail.section.voltageKv);selectorLanes.set(key,[...(selectorLanes.get(key)??[]),{id:sw.id,x:old.laneX}]);}}
 for(const sw of graph.switches){if(sections.has(sw.from)===sections.has(sw.to))continue;const barId=sections.has(sw.from)?sw.from:sw.to,node=ports.get(sections.has(sw.from)?sw.to:sw.from),rail=base.sections.find(b=>b.section.id===barId);if(!rail||!node)continue;
  const sign=node.direction===-1?-1:1,level=base.sections.filter(b=>b.section.voltageKv===rail.section.voltageKv),origin=sign<0?Math.min(...level.map(b=>b.y)):Math.max(...level.map(b=>b.y)),old=barAttachment.get(sw.id),wanted=old?.localEntry?old.laneX:barLanes.get(sw.id)??node.x,baseLane=Math.max(rail.x1+24,Math.min(rail.x2-24,wanted)),key=String(rail.section.voltageKv),used=(selectorLanes.get(key)??[]).filter(p=>p.id!==sw.id);let lane=baseLane;
  if(!old?.localEntry){const candidates=[baseLane,...Array.from({length:Math.max(1,Math.floor((rail.x2-rail.x1-48)/16)+1)},(_,i)=>rail.x1+24+i*16)].sort((a,b)=>Math.abs(a-wanted)-Math.abs(b-wanted));lane=candidates.find(x=>used.every(u=>Math.abs(u.x-x)>=32))??baseLane;}
  selectorLanes.set(key,[...used,{id:sw.id,x:lane}]);barLanes.set(sw.id,lane);barOffsets.set(sw.id,0);const f=graph.feeders.find(f=>f.switchIds.includes(sw.id));if(f&&nativeBarCircuit(graph,f))continue;barAttachment.set(sw.id,{laneX:lane,spineX:node.x,collectorY:origin+sign*16,sign,railY:rail.y,localEntry:true});
 }
 const equipment:EquipmentGeometry[]=[];
 for(const e of graph.equipment){
  const visible=e.terminals.map(id=>ports.get(id)).filter((p):p is PortPosition=>!!p);if(!visible.length)continue;
  const owner=base.feeders.find(f=>f.feeder.equipmentKeys.includes(e.sourceClass+'|'+e.id)),cell=owner?compartments.get(owner.feeder.id):null,native=visible.map(p=>{if(p.semantics!=='busbar-section')return p;const origin=cell?(cell.direction<0?cell.y2+20:cell.y1-20):p.y,rail=base.sections.filter(b=>b.section.id===p.terminalId).sort((a,b)=>Math.abs(a.y-origin)-Math.abs(b.y-origin))[0];return {...p,x:owner?.x??p.x,y:rail?.y??p.y,direction:cell?.direction??p.direction};}),transformer=e.kind==='transformer'||e.kind==='transformer3w',direction=native[0].direction===-1?-1:1,parallel=graph.equipment.filter(o=>o.terminals[0]===e.terminals[0]&&(transformer?o.kind==='transformer':o.kind!=='transformer'&&o.kind!=='transformer3w')),offset=(parallel.indexOf(e)-(parallel.length-1)/2)*(transformer?(referenceStyle&&(owner?.feeder.voltageKv??0)>40?160:240):64);
  let x=native[0].x+offset,y=native[0].y+direction*54;if(!transformer&&parallel.length>1){x=native[0].x+(parallel.indexOf(e)-(parallel.length-1)/2)*140;y=native[0].y+direction*64;}
  if(cell?.model&&native.length===1&&native[0].semantics==='busbar-section'){x=native[0].x;y=native[0].y+direction*64;}
  if(transformer&&native.length>1){const primary=base.feeders.find(f=>f.feeder.terminalIds.includes(e.terminals[0])&&f.feeder.voltageKv===terminal.get(e.terminals[0])?.vnKv),ends=primary?.feeder.terminalIds.filter(id=>!sections.has(id)).map(id=>ports.get(id)?.y).filter((v):v is number=>v!=null)??[native[0].y];y=Math.max(native[0].y,...ends)+56;x=native[0].x+offset;}
  const series=e.kind==='seriesCompensator',rotation=series&&native.length===2&&native[0].y>native[1].y?180:0;
  if(series&&native.length===2){x=(native[0].x+native[1].x)/2+offset;y=(native[0].y+native[1].y)/2;}
  const boundary=transformer&&native.length<e.terminals.length,contactOffset=e.kind==='line'?16:e.kind==='generator'?13:e.kind==='load'?14:e.reactiveSymbol||series?18:12;
  const leads:EquipmentPort[]=native.map(p=>{const side=e.terminals.indexOf(p.terminalId),point:Point=boundary?[x,y]:transformer?[x+(side===2?26:0),y+(side===0?-18:side===1?18:0)]:series?[x,y+(side===0?-18:18)*(rotation===180?-1:1)]:[x,y-direction*contactOffset];return {terminalId:p.terminalId,side,point,wires:[wire(pt(p),point,p.terminalId,side===1?'TO':'FROM')],boundaryKv:boundary?(terminal.get(e.terminals.find(id=>!ports.has(id))??'')?.vnKv??null):null};});
  equipment.push({equipment:e,x,y,direction,ports:leads,nativePorts:native,boundary,rotation,straightModelSpine:cell?.model});
 }
 const barObstacles:GlyphBox[]=base.sections.map((b,i)=>({id:'BAR|'+b.section.id+'|'+i,x1:b.x1,x2:b.x2,y1:b.y-3,y2:b.y+3})),protectedPorts=new Map(ports);for(const sw of graph.switches)for(const id of [sw.from,sw.to])if(sections.has(id)&&ports.has(id)){const p=ports.get(id)!;protectedPorts.set(sw.id+'|'+id,{...p,x:barLanes.get(sw.id)??ports.get(id===sw.from?sw.to:sw.from)?.x??p.x,y:p.y+(barOffsets.get(sw.id)??0)});}
 const previewRoutes=buildSwitchDeviceChain(graph,ports,barLanes,equipment,barOffsets,barAttachment);for(const f of base.feeders){const circuit=nativeBarCircuit(graph,f.feeder);if(circuit)referenceCoupler(graph,f.feeder,circuit,ports,previewRoutes,compartments.get(f.feeder.id)!,base.sections);}
 separateEquipment(equipment,protectedPorts,barObstacles,previewRoutes);let cable=0,leftCables=0,rightCables=0;for(const e of equipment.filter(e=>e.equipment.kind==='transformer'||e.equipment.kind==='transformer3w'))for(const port of e.ports){if(port.side!==1)continue;const native=e.nativePorts.find(p=>p.terminalId===port.terminalId)!,crossed=base.sections.filter(b=>b.y>Math.min(port.point[1],native.y)&&b.y<Math.max(port.point[1],native.y));if(!crossed.length)continue;const corridor=nearestSideCorridor(port.point[0],native.x,Math.min(...crossed.map(b=>b.x1)),Math.max(...crossed.map(b=>b.x2)),leftCables,rightCables);if(corridor.side==='LEFT')leftCables++;else rightCables++;port.corridor=corridor.x;for(const w of port.wires){const departure=e.y+58+cable*12,arrival=native.y-30-cable*12;w.waypoints=[[native.x,arrival],[port.corridor,arrival],[port.corridor,departure],[port.point[0],departure]];}cable++;}const routes=previewRoutes;const loops=buildSwitchDeviceChain(graph,ports,barLanes,equipment,barOffsets,barAttachment).filter(r=>r.sw.from===r.sw.to);for(const r of loops){const i=routes.findIndex(o=>o.sw.id===r.sw.id);if(i>=0)routes[i]=r;}
 for(const f of base.feeders){const circuit=nativeBarCircuit(graph,f.feeder);if(!circuit)continue;
  if(referenceStyle)continue; // The shared rail plan was frozen before equipment packing.
  const from=ports.get(circuit.terminals[0])!,to=ports.get(circuit.terminals.at(-1)!)!,between=base.sections.filter(b=>b.y>Math.min(from.y,to.y)&&b.y<Math.max(from.y,to.y)).sort((a,b)=>Math.abs(a.y-from.y)-Math.abs(b.y-from.y)),y=(from.y+(between[0]?.y??to.y))/2,first=compartments.get(f.feeder.id)!.x1+36;
  for(let i=1;i<circuit.terminals.length-1;i++){const p=ports.get(circuit.terminals[i])!;p.x=first+(i-.5)*44;p.y=y;p.direction=0;}
  for(const [i,id]of circuit.switchIds.entries()){const r=routes.find(r=>r.sw.id===id)!;if(!r)continue;const sign=r.sw.from===circuit.terminals[i]?1:-1,x=first+i*44;r.a={...ports.get(r.sw.from)!};r.b={...ports.get(r.sw.to)!};if(r.a.semantics==='busbar-section')r.a.x=i===0?f.x:first+(circuit.switchIds.length-1)*44+34;if(r.b.semantics==='busbar-section')r.b.x=i===0?f.x:first+(circuit.switchIds.length-1)*44+34;
   r.x=x;r.y=y;r.rotation=sign>0?-90:90;r.inline=true;r.fixedCell=true;r.ordering='NATIVE_ENDPOINTS';r.contactFrom=[x-sign*16,y];r.contactTo=[x+sign*16,y];r.wires=[wire(pt(r.a),r.contactFrom,r.sw.from,'FROM',{endNormal:[-sign,0]}),wire(r.contactTo,pt(r.b),r.sw.to,'TO',{startNormal:[sign,0]})];r.points=r.wires.flatMap(w=>w.points);
  }
  const changed=new Set(circuit.terminals.slice(1,-1));for(const r of routes.filter(r=>f.feeder.switchIds.includes(r.sw.id)&&!circuit.switchIds.includes(r.sw.id))){if(!changed.has(r.sw.from)&&!changed.has(r.sw.to))continue;if(changed.has(r.sw.from))r.a={...ports.get(r.sw.from)!};if(changed.has(r.sw.to))r.b={...ports.get(r.sw.to)!};if(r.a&&r.b){const junction=changed.has(r.sw.from)?r.a:r.b,sign=changed.has(r.sw.from)?-1:1;r.x=junction.x-128;r.y=junction.y-14;r.rotation=sign>0?-90:90;r.inline=false;if(r.a.semantics==='busbar-section')r.a.x=r.x-32;if(r.b.semantics==='busbar-section')r.b.x=r.x-32;r.ordering='NATIVE_ENDPOINTS';r.fixedCell=true;r.contactFrom=[r.x-sign*16,r.y];r.contactTo=[r.x+sign*16,r.y];r.wires=[wire(pt(r.a),r.contactFrom,r.sw.from,'FROM'),wire(r.contactTo,pt(r.b),r.sw.to,'TO')];}}
 }
 if(flowLabels){const occupied:GlyphBox[]=[...barObstacles,...routes.map(r=>({id:r.sw.id,x1:r.x-22,x2:r.x+22,y1:r.y-24,y2:r.y+24})),...equipment.map(e=>({id:e.equipment.id,x1:e.x-24,x2:e.x+24,y1:e.y-24,y2:e.y+24})),...equipment.flatMap(e=>e.ports.flatMap(p=>p.wires.flatMap(w=>(w.waypoints??[]).map(p=>({id:'WAYPOINT|'+e.equipment.id,x1:p[0]-18,x2:p[0]+18,y1:p[1]-18,y2:p[1]+18}))))),...[...ports.values()].map(p=>({id:p.terminalId,x1:p.x-18,x2:p.x+18,y1:p.y-18,y2:p.y+18})),...base.feeders.filter(f=>!['autotransformer','transformer-primary','bank'].includes(slotMap.get(f.feeder.id)?.placementRole??slotMap.get(f.feeder.id)?.role??'')).map(f=>({id:'FEEDER|'+f.feeder.id,x1:f.x-64,x2:f.x+64,y1:f.y-14,y2:f.y+136}))];for(const e of equipment.filter(e=>!e.boundary&&(e.equipment.kind==='transformer'||e.equipment.kind==='transformer3w'))){const box=freePosition(e.x+146,e.y+116,118,90,occupied,'LABEL|'+e.equipment.id,false,true);e.caption={x:box.x-118,y:box.y-90};barObstacles.push(occupied.at(-1)!);}}
 separateSwitches(routes,equipment,barObstacles,true);
 base.height=Math.max(400,...base.sections.map(b=>b.y+95),...base.feeders.map(f=>f.y+(flowLabels?180:100)),...[...ports.values()].map(p=>p.y+100),...equipment.map(e=>Math.max(e.y+110,(e.caption?.y??0)+240)),...routes.map(r=>r.y+95));base.width=Math.max(640,...base.sections.map(b=>b.x2+50),...equipment.map(e=>Math.max(e.x+100,(e.caption?.x??0)+300)),...equipment.flatMap(e=>e.ports.map(p=>(p.corridor??0)+70)),...routes.map(r=>r.x+70),...[...ports.values()].map(p=>p.x+70));
 return {...base,ports,routes,equipment,slots,slotMap,compartments,transformers:equipment.filter(e=>e.equipment.kind==='transformer').map(e=>({equipment:e.equipment,ports:e.nativePorts}))};
}
/** Bay focus uses the same source/port/contact renderer; other winding ends stay explicit boundaries. */
export function feederFocusGraph(graph:StationTopologyGraph,id:string):StationTopologyGraph {
 const f=graph.feeders.find(f=>f.id===id);if(!f)return {...graph,feeders:[],switches:[],equipment:[],terminals:[],busSections:[],voltageLevels:[]};
 const eq=graph.equipment.filter(e=>f.equipmentKeys.includes(`${e.sourceClass}|${e.id}`)),ids=new Set([...f.terminalIds,...eq.flatMap(e=>e.terminals)]);
 return {...graph,feeders:[f],switches:graph.switches.filter(s=>f.switchIds.includes(s.id)||s.from===s.to&&eq.some(e=>e.id===s.equipmentId)),equipment:eq,terminals:graph.terminals.filter(t=>ids.has(t.id)),busSections:graph.busSections.filter(b=>ids.has(b.id)&&b.voltageKv===f.voltageKv),voltageLevels:[f.voltageKv]};
}
