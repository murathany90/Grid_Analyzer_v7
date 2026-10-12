import type { Bus, Site } from '../../domain/model/network';
import type { CatalogRow } from '../../app/contracts';
import { layoutStation, feederSwitchPaths, stationTerminalLinks, type StationTopologyGraph } from '../../domain/model/station-topology';
import type { VoltageBand } from '../../domain/model/voltage-band';
import type { ScenarioOverlay } from '../../domain/scenario/overlay';
import type { Settings } from '../../persistence/settings';
import type { N1SelectedDetail } from '../../domain/n1';
import {islandColor} from '../../map/island-map';
import {physicalStationLayout} from './physical-layout';
import type {SldMode,SldResultOverlay} from './result-overlay';
import {sldFlowAtPort} from './result-overlay';
import {engineeringSymbol} from './symbols';
export type SldScope='station'|'bay'|'regional';
export interface SldEquipment { id:string;name:string;sourceClass:string;busIds:readonly string[];siteIds:readonly string[];inService:boolean;sourceInService?:boolean;closed?:boolean;sourceClosed?:boolean;fromSiteId?:string;toSiteId?:string;voltageKv?:number;lvKv?:number;ratingMva?:number }
export interface SldBusGroup {id:string;name:string;buses:readonly Bus[]}
export interface SldTerminal {id:string;name:string;bayId:string;external:boolean;equipment:readonly SldEquipment[]}
export interface SldSwitch {id:string;name:string;sourceClass:'ElmCoup'|'StaSwitch';kind:'breaker'|'isolator'|'other';from:string|null;to:string|null;modelClosed:boolean;closed:boolean;inService:boolean;stateKnown?:boolean}
export interface SldRegionalBranch extends SldEquipment {fromSiteId:string;toSiteId:string}
export interface SldDiagram {
  scope:SldScope;orientation:'horizontal'|'vertical';station:Site;selectedId:string|null;groups:readonly SldBusGroup[];equipment:readonly SldEquipment[];
  bays:readonly CatalogRow[];selectedBay:CatalogRow|null;terminals:readonly SldTerminal[];switches:readonly SldSwitch[];
  regionalSites:readonly Site[];regionalBranches:readonly SldRegionalBranch[];unresolvedSwitches:number;
  graph:StationTopologyGraph|null;voltageBands:ReadonlySet<VoltageBand>;page:number;technical:boolean;scenario:ScenarioOverlay;settings:Settings;
  n1Detail:N1SelectedDetail|null;selectedN1IslandId:string|null;
  mode?:SldMode;overlay?:SldResultOverlay;showResults?:boolean;showArrows?:boolean;colorMode?:'voltage'|'state';
}
type Select=(id:string,sourceClass:string)=>void;
const NS='http://www.w3.org/2000/svg',ink='#e0edf2',muted='#9bb3c1',normal='#90d4df';
function svg<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>,parent?:SVGElement):SVGElementTagNameMap[K]{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent?.append(n);return n;}
function text(parent:SVGElement,x:number,y:number,label:string,size=12,color=ink,anchor='start'){const n=svg('text',{x,y,fill:color,'font-size':size,'font-family':'system-ui, sans-serif','text-anchor':anchor},parent);n.textContent=label;return n;}
const shorten=(s:string,n=23)=>s.length>n?s.slice(0,n-1)+'…':s;
function group(parent:SVGElement,id:string,cls:string,name:string,select:Select,detail=''){const g=svg('g',{'data-id':id,'data-class':cls,role:'button',tabindex:0,'aria-label':name},parent);svg('title',{},g).textContent=`${name}\n${cls} · ${id}${detail?'\n'+detail:''}`;g.onclick=e=>{e.stopPropagation();select(id,cls);};g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();select(id,cls);}};return g;}
function stateStyle(d:SldDiagram,source:boolean,current:boolean){return {color:source!==current?(current?d.settings.colorScenarioOn:d.settings.colorScenarioOff):current?normal:d.settings.colorOut,dash:current?'':'6 4'};}
function equipmentState(d:SldDiagram,item:SldEquipment){return stateStyle(d,item.sourceInService??item.inService,item.inService);}
function n1RiskColor(loading:number|null):string|null{if(loading==null||!Number.isFinite(loading))return null;return loading<80?'#43b874':loading<85?'#e4c84f':loading<=90?'#e99340':'#e34848';}
function applyN1Overlay(root:SVGSVGElement,d:SldDiagram):void{
  const detail=d.n1Detail;if(!detail)return;
  for(const groupElement of root.querySelectorAll<SVGGElement>('g[data-id][data-class]')){
    const id=groupElement.dataset.id||'',sourceClass=groupElement.dataset.class||'';
    const outage=detail.outage.equipmentId===id&&detail.outage.sourceClass===sourceClass;
    const impact=detail.branchImpacts.find(row=>row.equipmentId===id&&row.sourceClass===sourceClass);
    const component=detail.outageIslands.find(row=>row.branchIds.includes(id)||row.busIds.includes(id)||row.siteIds.includes(id)),selectedComponent=component?.componentId===d.selectedN1IslandId;
    const componentName=component?`Ada ${detail.outageIslands.indexOf(component)+1}`:'';
    let label='',color='';
    if(outage){label='N-1 KESİNTİ';color='#111318';}
    else if(impact){const loading=impact.postEstimatedLoadingPct??impact.estimatedLoadingPct;color=n1RiskColor(loading)||'#708596';label=loading==null?'N-1 · —':loading>100?`LİMİT >100% · ${loading.toFixed(0)}%`:`N-1 · ${loading.toFixed(0)}%`;if(component)label+=` · ${componentName} · ${component.hasReference?'Ref var':'Ref yok'}`;}
    else if(component){label=`${componentName} · ${component.hasReference?'Referanslı':'Referanssız'}`;color=islandColor(component.componentId);}
    if(selectedComponent&&!outage)label+=` · SEÇİLİ`;
    if(!label)continue;
    const dashes=outage||component&&!component.hasReference?'6 4':'';
    const stroke=component&&(selectedComponent||!impact)&&!outage?islandColor(component.componentId):color;
    if(outage)for(const line of groupElement.querySelectorAll<SVGPathElement>('path[data-connection]'))line.setAttribute('stroke-dasharray',dashes);
    if(component)groupElement.setAttribute('data-n1-island',component.componentId);
    const title=groupElement.querySelector('title');if(title)title.textContent+=`\n${label}${component?` · ${component.componentId} · ${component.references.map(row=>row.name).join(', ')||'YOK'} · ${component.hasLocalGeneration?`Yerel üretim var (${component.generatorCount} jeneratör, ${component.generationMw.toFixed(1)} MW)`:''}`:''}${impact?` · Baz ${impact.baseFlowMw.toFixed(1)} MW · N-1 ${impact.postFlowMw==null?'—':impact.postFlowMw.toFixed(1)+' MW'} · ΔP ${impact.deltaPMw==null?'—':impact.deltaPMw.toFixed(1)+' MW'} · Kapasite ${impact.capacityMva==null?'—':impact.capacityMva.toFixed(1)+' MVA'}`:''}`;
    const bounds=groupElement.getBBox(),badgeWidth=Math.min(210,Math.max(68,label.length*6+14)),badge=svg('g',{'pointer-events':'none','aria-hidden':'true',...(component?{'data-n1-island':component.componentId}:{})},groupElement),x=bounds.x+bounds.width-badgeWidth/2,y=bounds.y-11;
    svg('rect',{x,y,width:badgeWidth,height:18,rx:4,fill:color||'#496879',stroke:outage?'#f2f5f7':'#b5d0dc','stroke-width':outage?1:0.7},badge);
    text(badge,x+badgeWidth/2,y+12,shorten(label,34),9,'#fff','middle');
  }
}
function path(parent:SVGElement,points:readonly (readonly[number,number])[],color:string,dash='',width=2){return svg('path',{d:points.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':dash,'data-connection':'orthogonal'},parent);}
function symbol(parent:SVGElement,x:number,y:number,cls:string,color:string,closed=true,kind='breaker'){
  if(cls==='ElmTr2')engineeringSymbol(parent,'transformer2w',x,y,color);
  else if(cls==='ElmTr3')engineeringSymbol(parent,'transformer3w',x,y,color);
  else if(cls==='ElmCoup'||cls==='StaSwitch'){
    if(kind==='isolator'){svg('rect',{x:x-10,y:y-12,width:20,height:24,fill:'#102033'},parent);const blade=path(parent,[[x,y+12],[closed?x:x+9,closed?y-12:y-5]],color);blade.removeAttribute('data-connection');blade.dataset.switchBlade=closed?'CLOSED':'OPEN';svg('circle',{cx:x,cy:y-12,r:2,fill:color},parent);svg('circle',{cx:x,cy:y+12,r:2,fill:color},parent);}
    else if(kind==='breaker'){svg('rect',{x:x-7,y:y-8,width:14,height:16,fill:closed?color:'#102033',stroke:color,'stroke-width':2},parent);if(!closed){const blade=path(parent,[[x,y+6],[x+5,y-3]],color);blade.removeAttribute('data-connection');blade.dataset.switchBlade='OPEN';}}
    else svg('path',{d:`M${x},${y-9} L${x+8},${y} L${x},${y+9} L${x-8},${y} Z`,fill:closed?color:'#102033',stroke:color,'stroke-width':2},parent);
  }
  else if(cls==='ElmLne'){svg('path',{d:`M${x},${y-16} L${x},${y} M${x-6},${y-6} L${x},${y} L${x+6},${y-6}`,fill:'none',stroke:color,'stroke-width':2},parent);}
  else if(cls==='ElmSym'||cls==='ElmGenStat')engineeringSymbol(parent,'generator',x,y,color);
  else if(cls==='ElmLod')engineeringSymbol(parent,'load',x,y,color);
  else{svg('circle',{cx:x,cy:y,r:12,stroke:color,fill:'#102033','stroke-width':2},parent);text(parent,x,y+4,cls==='ElmShnt'?'Ş':'G',11,color,'middle');}
}
function wrappedText(parent:SVGElement,x:number,y:number,label:string,limit=18,size=10,color=ink){
  const words=label.split(/\s+/);let first='';while(words.length&&(!first||first.length+words[0].length+1<=limit)){first+=(first?' ':'')+words.shift();}
  text(parent,x,y,shorten(first,limit),size,color,'middle');if(words.length)text(parent,x,y+14,shorten(words.join(' '),limit),size,color,'middle');
}
export function fullDiagramClone(root:SVGSVGElement,fitBox:readonly number[]):SVGSVGElement {
  const clone=root.cloneNode(true) as SVGSVGElement;clone.setAttribute('viewBox',fitBox.join(' '));clone.setAttribute('width',String(fitBox[2]));clone.setAttribute('height',String(fitBox[3]));clone.style.width=fitBox[2]+'px';clone.style.height=fitBox[3]+'px';return clone;
}
function voltageColor(d:SldDiagram,kv:number){return kv>=300?d.settings.color400:kv>=180?d.settings.color220:kv>=100?d.settings.color154:kv>=50?d.settings.color66:d.settings.colorLow;}
function station(root:SVGSVGElement,d:SldDiagram,select:Select):void {
  if(!d.graph)return;const graph=d.graph,layout=physicalStationLayout(graph,d.voltageBands,d.mode==='compact');root.setAttribute('viewBox',`0 0 ${layout.width} ${layout.height}`);
  text(root,24,30,d.station.name,21);text(root,24,52,`${graph.busSections.length} bara · ${graph.sourceFeederCount} kaynak fider · ${graph.switches.length} fiziksel anahtar`,12,muted);
  const palette=(kv:number,state:boolean)=>d.colorMode==='state'?(state?normal:d.settings.colorOut):voltageColor(d,kv);
  const equipment=new Map(d.equipment.map(e=>[`${e.sourceClass}|${e.id}`,e]));
  const overlay=(g:SVGGElement,key:string,x:number,y:number,side:'FROM'|'TO'='FROM',axis:readonly[number,number]=[0,1])=>{
    const entry=d.overlay?.entries.get(key);if(!entry)return;
    g.dataset.resultStatus=entry.status;g.dataset.resultMethod=entry.method;
    const title=g.querySelector('title');if(title)title.textContent+=`\n${entry.status} · ${entry.method}\n`+Object.entries(entry.values).map(([k,v])=>`${k}: ${v??'—'}`).join('\n');
    if(d.showResults!==false)entry.lines.forEach((line,i)=>text(g,x,y+i*14,line,9,entry.alarm?'#ff746f':ink,'middle'));
    const direction=sldFlowAtPort(entry,side);
    if(d.showArrows!==false&&direction!==null&&direction!==0){const sign=direction>0?1:-1,vx=axis[0]*sign,vy=axis[1]*sign,cx=x+18,cy=y-20,ex=cx+vx*8,ey=cy+vy*8,change=d.overlay?.phase==='CHANGE';svg('path',{d:`M${cx-vx*8},${cy-vy*8} L${ex},${ey} M${ex-vx*6-vy*6},${ey-vy*6+vx*6} L${ex},${ey} L${ex-vx*6+vy*6},${ey-vy*6-vx*6}`,fill:'none',stroke:normal,'data-flow-side':side,'data-flow-direction':change?(sign>0?'INCREASED_INJECTION':'DECREASED_INJECTION'):sign>0?'LOCAL_OUTBOUND':'LOCAL_INBOUND'},g);if(change)text(g,cx+12,cy+3,'Δ',9,normal);}
  };
  for(const p of layout.sections){const b=p.section,current=d.scenario.busOrTerminalStatus[b.id]??(d.scenario.restoredTerminals.includes(b.id)||b.inService),g=group(root,b.id,'ElmTerm',b.name,select,`${b.voltageKv} kV · ${current?'Serviste':'Servis dışı'}`);
    path(g,[[p.x1,p.y],[p.x2,p.y]],d.selectedId===b.id?'#ffe382':palette(b.voltageKv,current),current?'':'6 4',4);text(g,24,p.y+4,shorten(b.name,28),11);g.dataset.port=b.id;g.dataset.semantic='busbar-section';overlay(g,`ElmTerm|${b.id}`,p.x2-120,p.y-8);
  }
  for(const [id,p]of layout.ports){if(p.semantics==='busbar-section')continue;const term=graph.terminals.find(t=>t.id===id)!,g=group(root,id,'ElmTerm',term.name,select,`${term.vnKv} kV · ${id}`);g.dataset.port=id;g.dataset.semantic=p.semantics;g.dataset.ytbsSlot=p.slot??'';svg('circle',{cx:p.x,cy:p.y,r:3,fill:palette(term.vnKv,term.inService)},g);if(d.technical)text(g,p.x+7,p.y-4,id,8,muted);overlay(g,`ElmTerm|${id}`,p.x,p.y+16);}
  for(const route of layout.routes){const {sw,a,b,x,y}=route,item=equipment.get(`${sw.sourceClass}|${sw.id}`);if(!item)continue;
    if(!a&&!b&&graph.terminals.some(t=>t.id===sw.from)&&graph.terminals.some(t=>t.id===sw.to))continue;
    const known=sw.stateKnown||Object.hasOwn(d.scenario.switchState,sw.id),closed=item.closed??false,state=!item.inService?'OUT_OF_SERVICE':!known?'UNKNOWN':closed?'CLOSED':'OPEN';
    const color=state==='UNKNOWN'?d.settings.colorNoResult:!item.inService?d.settings.colorOut:palette(graph.terminals.find(t=>t.id===sw.from)?.vnKv??0,closed),g=group(root,sw.id,sw.sourceClass,item.name,select,`${sw.kind} · ${state} · ${sw.from} → ${sw.to}`);
    g.dataset.physicalSwitch=`${sw.sourceClass}|${sw.sourceId}`;g.dataset.from=sw.from;g.dataset.to=sw.to;g.dataset.state=state;g.dataset.semantic=sw.from===sw.to?'cubicle-switch':sw.kind;g.dataset.bay=sw.bayId??'';g.dataset.cubicle=sw.cubicleId??'';
    g.dataset.contactFrom=route.contactFrom.join(',');g.dataset.contactTo=route.contactTo.join(',');g.dataset.chainOrdering=route.ordering;
    if(!route.wires.length){if(a||b)text(g,x+20,y,'Kaynak zincir sırası/uç çözümlenemedi',9,muted);else continue;}
    for(const w of route.wires){const line=path(g,w.points,color,item.inService?'':'6 4');line.dataset.nativeTerminal=w.terminalId;line.dataset.contactSide=w.side;}
    const glyph=svg('g',{transform:`rotate(${route.rotation??0} ${x} ${y})`},g);symbol(glyph,x,y,sw.sourceClass,color,closed,sw.kind);
    // A real hit target remains usable independently of thin strokes and label geometry.
    svg('rect',{x:x-14,y:y-17,width:28,height:34,fill:'transparent','pointer-events':'all','data-switch-hit':sw.id},g);
    if(state==='UNKNOWN')text(g,x+12,y+3,'?',10,color);if(d.selectedId===sw.id)svg('circle',{cx:x,cy:y,r:19,fill:'none',stroke:'#ffe382','pointer-events':'none'},g);if(d.technical)text(g,x+16,y-7,sw.id,8,muted);
  }
  for(const geo of layout.equipment){const e=geo.equipment,item=equipment.get(`${e.sourceClass}|${e.id}`);if(!item)continue;
    const {x,y}=geo,ports=geo.nativePorts,g=group(root,e.id,e.sourceClass,e.name,select,e.terminals.join(' → ')),style=equipmentState(d,item),color=palette(item.voltageKv??graph.terminals.find(t=>t.id===ports[0].terminalId)?.vnKv??0,item.inService);
    g.dataset.terminals=e.terminals.join('|');g.dataset.semantic=e.kind;g.dataset.localTerminal=ports[0].terminalId;g.dataset.ytbsSlot=ports[0].slot??'';g.dataset.equipmentCenter=[x,y].join(',');
    for(const port of geo.ports)for(const w of port.wires){const line=path(g,w.points,palette(graph.terminals.find(t=>t.id===port.terminalId)?.vnKv??0,item.inService),style.dash);line.dataset.nativeTerminal=port.terminalId;line.dataset.equipmentContact=port.point.join(',');}
    const flowSide:'FROM'|'TO'=e.terminals.indexOf(ports[0].terminalId)===1?'TO':'FROM';let flowAxis:readonly[number,number]=[0,geo.direction];
    if(geo.boundary){g.dataset.boundary='true';g.dataset.hvTerminal=e.terminals[0];g.dataset.lvTerminal=e.terminals[1]??'';
      const kv=geo.ports[0].boundaryKv;svg('path',{d:`M${x-7},${y-geo.direction*7} L${x},${y} L${x+7},${y-geo.direction*7}`,fill:'none',stroke:color,'stroke-width':2},g);text(g,x,y+geo.direction*28,`Diğer gerilim seviyesine devam: ${kv??'—'} kV`,10,ink,'middle');text(g,x,y+geo.direction*43,e.id,9,muted,'middle');
    }else if(e.kind==='transformer'||e.kind==='transformer3w'){
      symbol(g,x,y,e.sourceClass,color);g.dataset.hvTerminal=e.terminals[0];g.dataset.lvTerminal=e.terminals[1]??'';text(g,x+24,y-5,shorten(e.name,26),10);text(g,x+24,y+12,`${item.voltageKv??'—'}/${item.lvKv??'—'} kV · ${item.ratingMva??'—'} MVA`,9,muted);if(e.kind==='transformer3w')text(g,x+24,y+27,'PARTIAL · hesap UNSUPPORTED',9,'#ffd27e');flowAxis=[0,1];
    }else if(e.kind==='line'&&ports.length===2){g.dataset.nativeFrom=e.terminals[0];g.dataset.nativeTo=e.terminals[1];flowAxis=[ports[1].x>=ports[0].x?1:-1,0];wrappedText(g,x,y-18,e.name,24,10);
    }else if(e.kind==='line'){
      g.dataset.exitDirection=geo.direction<0?'UP':'DOWN';const remoteId=flowSide==='FROM'?item.toSiteId:item.fromSiteId,remote=d.regionalSites.find(s=>s.id===remoteId);
      svg('path',{d:`M${x},${y-geo.direction*16} L${x},${y} M${x-7},${y-geo.direction*8} L${x},${y} L${x+7},${y-geo.direction*8}`,fill:'none',stroke:color,'stroke-width':2},g);wrappedText(g,x,y+geo.direction*27,remote?.name??e.name,24,10);text(g,x,y+geo.direction*45,e.id,9,muted,'middle');
    }else {symbol(g,x,y,e.sourceClass,color);wrappedText(g,x,y+26,e.name,24,10);}
    svg('rect',{x:x-15,y:y-20,width:30,height:40,fill:'transparent','pointer-events':'all','data-equipment-hit':e.id},g);
    if(d.selectedId===e.id)svg('circle',{cx:x,cy:y,r:21,fill:'none',stroke:'#ffe382','pointer-events':'none'},g);
    if(d.overlay?.outageKey===`${e.sourceClass}|${e.id}`){g.dataset.outage='true';text(g,x,y-25,'N-1 KESİNTİ',10,'#ff746f','middle');}
    overlay(g,`${e.sourceClass}|${e.id}`,x,y+70,flowSide,flowAxis);
  }
  for(const slot of layout.slots){const p=layout.feeders.find(p=>p.feeder.id===slot.feeder.id)!;text(root,p.x,p.busYs.length?(slot.side==='A'?Math.min(...p.busYs)-22:Math.max(...p.busYs)+22):p.y,slot.side?`${slot.slot}${slot.block?' · blok '+(slot.block+1):''}`:'UNCLASSIFIED_SLOT',9,muted,'middle');}
  for(const p of layout.feeders){const issues=graph.issues.filter(i=>i.sourceId===p.feeder.id);if(!issues.length)continue;const g=group(root,p.feeder.id,p.feeder.sourceClass,p.feeder.name,select,issues.map(i=>i.reason).join('\n'));g.dataset.unresolved='true';text(g,p.x,p.y+25,'Uç belirsiz · '+p.feeder.name,9,'#ffd27e','middle');}
  text(root,24,layout.height-17,`${graph.counters.diagramUnresolvedTotal} kaynak sorunu · uç ${graph.counters.invalidSwitchEndpoints} · cubicle ${graph.counters.missingCubicleReferences} · ${layout.slots.filter(s=>!s.side).length} sınıflanamayan fider · ${layout.routes.filter(r=>r.ordering==='SOURCE_ORDER_UNAVAILABLE').length} belirsiz cihaz sırası`,11,muted);
  if(d.overlay&&['LF','N1','SC'].includes(d.mode??''))text(root,24,layout.height-35,`${d.mode} ${d.overlay.phase} · ${d.overlay.status} · ${d.overlay.method}`,10,muted);
}

function bay(root:SVGSVGElement,d:SldDiagram,select:Select):void {
  const terminals=[...d.terminals].sort((a,b)=>a.id.localeCompare(b.id)),adj=new Map(terminals.map(t=>[t.id,[] as string[]]));
  for(const s of d.switches)if(s.from&&s.to&&adj.has(s.from)&&adj.has(s.to)){adj.get(s.from)!.push(s.to);adj.get(s.to)!.push(s.from);}
  const levels=new Map<string,number>(),roots=terminals.filter(t=>d.graph?.busSections.some(b=>b.id===t.id)),queue=(roots.length?roots:terminals.slice(0,1)).map(t=>t.id);for(const id of queue)levels.set(id,0);
  for(let i=0;i<queue.length;i++)for(const id of adj.get(queue[i])!.sort())if(!levels.has(id)){levels.set(id,levels.get(queue[i])!+1);queue.push(id);}
  for(const t of terminals)if(!levels.has(t.id))levels.set(t.id,0);
  const groups=new Map<number,typeof terminals>();for(const t of terminals){const level=levels.get(t.id)!;groups.set(level,[...(groups.get(level)||[]),t]);}
  const horizontal=d.orientation==='horizontal',depth=Math.max(0,...levels.values()),lanes=Math.max(1,...[...groups.values()].map(g=>g.length));
  const width=horizontal?Math.max(900,260+depth*210):Math.max(900,lanes*240+180),height=horizontal?Math.max(480,lanes*170+180):Math.max(480,depth*150+210);
  root.setAttribute('viewBox',`0 0 ${width} ${height}`);text(root,24,31,d.selectedBay?.name||'Fider',20);text(root,24,53,`${terminals.length} terminal · ${d.switches.length} kaynak anahtar · ${d.unresolvedSwitches} çözülemeyen uç`,12,muted);
  const pos=new Map<string,[number,number]>();for(const[level,rows]of groups)rows.forEach((t,i)=>pos.set(t.id,horizontal?[150+level*210,120+i*170]:[210+i*240,105+level*150]));
  for(const s of d.switches){const a=pos.get(s.from||''),b=pos.get(s.to||'');if(!a||!b)continue;const state=!s.inService?'OUT_OF_SERVICE':s.stateKnown===false?'UNKNOWN':s.closed?'CLOSED':'OPEN',g=group(root,s.id,s.sourceClass,s.name,select,`${s.kind} · ${state}`),style=stateStyle(d,s.modelClosed,s.closed),color=!s.inService?d.settings.colorOut:s.stateKnown===false?d.settings.colorNoResult:style.color;g.dataset.physicalSwitch=`${s.sourceClass}|${s.id}`;g.dataset.state=state;
    const midY=(a[1]+b[1])/2,midX=(a[0]+b[0])/2,points:[number,number][]=horizontal?[[a[0],a[1]],[midX,a[1]],[midX,b[1]],[b[0],b[1]]]:[[a[0],a[1]],[a[0],midY],[b[0],midY],[b[0],b[1]]];path(g,points,color,s.closed?style.dash:'5 4');
    const x=horizontal?midX:a[0],y=horizontal?a[1]:midY;symbol(g,x,y,s.sourceClass,color,s.closed,s.kind);text(g,x+16,y-5,shorten(`${s.kind==='breaker'?'Kesici':s.kind==='isolator'?'Ayırıcı':'Anahtar'} ${s.name}`,27),10,color);if(d.technical)text(g,x+16,y+10,s.id,9,muted);
  }
  for(const t of terminals){const[x,y]=pos.get(t.id)!,g=group(root,t.id,'ElmTerm',t.name,select),isBus=d.graph?.busSections.some(b=>b.id===t.id),source=d.graph?.terminals.find(b=>b.id===t.id)?.inService??true,current=d.scenario.busOrTerminalStatus[t.id]??(d.scenario.restoredTerminals.includes(t.id)||source),style=stateStyle(d,source,current);if(isBus)path(g,[[x-66,y],[x+66,y]],style.color,style.dash,5);else svg('circle',{cx:x,cy:y,r:4,fill:style.color},g);text(g,x-15,y-11,shorten(t.name,24),11,ink,'end');if(d.technical)text(g,x-15,y+12,t.id,9,muted,'end');
    t.equipment.slice(0,3).forEach((e,i)=>{const sx=x+115+i*100,sy=y+42,style=equipmentState(d,e),eg=group(root,e.id,e.sourceClass,e.name,select);path(eg,[[x,y],[sx,y],[sx,sy]],style.color,style.dash);symbol(eg,sx,sy,e.sourceClass,style.color);text(eg,sx,sy+25,shorten(e.name,17),10,ink,'middle');});
  }
}
function regional(root:SVGSVGElement,d:SldDiagram,select:Select):void {
  const neighbors=d.regionalSites.filter(s=>s.id!==d.station.id).slice(d.page*12,(d.page+1)*12),height=Math.max(440,100+neighbors.length*55),cy=height/2;root.setAttribute('viewBox',`0 0 1100 ${height}`);
  text(root,24,30,`${d.station.name} · bölgesel bağlantılar`,20);text(root,24,52,`${neighbors.length}/${d.regionalSites.length-1} komşu gösteriliyor · yalnız TM ve hat bağlantıları`,12,muted);
  const rootGroup=group(root,d.station.id,'ElmSite',d.station.name,select);svg('rect',{x:60,y:cy-24,width:245,height:48,rx:6,fill:'#214255',stroke:normal},rootGroup);text(rootGroup,76,cy+4,shorten(d.station.name,30),14);
  neighbors.forEach((site,i)=>{const y=95+i*55,items=d.regionalBranches.filter(b=>b.fromSiteId===site.id||b.toSiteId===site.id),first=items[0];if(first){const style=equipmentState(d,first),g=group(root,first.id,first.sourceClass,first.name,select,items.map(e=>`${e.name} · ${e.id}`).join('\n'));path(g,[[305,cy],[370+i*12,cy],[370+i*12,y],[775,y]],style.color,style.dash);text(g,560,y-7,shorten(first.name,26)+(items.length>1?` +${items.length-1}`:''),10);}
    const g=group(root,site.id,'ElmSite',site.name,select);svg('rect',{x:780,y:y-17,width:292,height:34,rx:5,fill:'#183247',stroke:normal},g);text(g,792,y+4,shorten(site.name,35),12);
  });
}
export class SvgSldRenderer {
  private root:SVGSVGElement|null=null;private fitBox=[0,0,1200,600];private key='';
  zoom(factor:number){if(!this.root)return;const[x,y,w,h]=this.box(),nextW=Math.max(this.fitBox[2]/12,Math.min(this.fitBox[2]*2,w/factor)),nextH=nextW*h/w;this.root.setAttribute('viewBox',[x+(w-nextW)/2,y+(h-nextH)/2,nextW,nextH].join(' '));}
  exportSvg():string|null{return this.root?new XMLSerializer().serializeToString(fullDiagramClone(this.root,this.fitBox)):null;}
  fit(){this.root?.setAttribute('viewBox',this.fitBox.join(' '));}
  focus(id:string,sourceClass:string){const g=[...this.root?.querySelectorAll<SVGGElement>('g[data-id][data-class]')??[]].find(g=>g.dataset.id===id&&g.dataset.class===sourceClass);if(!g)return;g.focus();const b=g.getBBox(),w=Math.max(360,b.width+100),h=Math.max(260,b.height+100);this.root!.setAttribute('viewBox',[b.x+b.width/2-w/2,b.y+b.height/2-h/2,w,h].join(' '));}
  private box(){return this.root!.getAttribute('viewBox')!.split(' ').map(Number);}
  render(host:HTMLElement,d:SldDiagram,select:Select):void {
    const key=[d.station.id,d.scope,d.scope==='bay'?d.selectedBay?.id:'',d.scope==='bay'?d.orientation:'vertical',d.scope==='regional'?d.page:0,[...d.voltageBands].join(',')].join('|'),previous=this.root&&key===this.key?this.box():null;this.key=key;
    const root=svg('svg',{xmlns:NS,viewBox:'0 0 1240 600',width:'100%',height:540,role:'img','aria-label':`${d.station.name} ${d.scope==='bay'?d.selectedBay?.name||'fider':d.scope==='regional'?'bölgesel':'TM genel'} tek hat şeması`,class:'ga-sld-svg',preserveAspectRatio:'xMidYMid meet'});
    root.style.background='#102033';root.style.touchAction='none';root.style.display='block';root.style.width='100%';root.style.height='clamp(360px,60vh,740px)';
    host.replaceChildren(root);this.root=root;if(d.scope==='regional')regional(root,d,select);else if(d.scope==='bay')bay(root,d,select);else station(root,d,select);applyN1Overlay(root,d);this.fitBox=this.box();if(previous)root.setAttribute('viewBox',previous.join(' '));
    let drag:{x:number;y:number;box:number[]}|null=null,moved=false;
    root.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,box:this.box()};moved=false;};
    root.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4){moved=true;root.setPointerCapture(e.pointerId);}if(!moved)return;const r=root.getBoundingClientRect(),scale=Math.min(r.width/drag.box[2],r.height/drag.box[3]);root.setAttribute('viewBox',[drag.box[0]-dx/scale,drag.box[1]-dy/scale,drag.box[2],drag.box[3]].join(' '));};
    root.onpointerup=e=>{drag=null;if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);};root.onpointercancel=()=>{drag=null;};root.addEventListener('click',e=>{if(moved){e.stopImmediatePropagation();moved=false;}},true);
    root.onwheel=e=>{e.preventDefault();this.zoom(e.deltaY<0?1.15:1/1.15);};
  }
}
