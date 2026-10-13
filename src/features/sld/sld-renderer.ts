import type { Bus, Site } from '../../domain/model/network';
import type { CatalogRow } from '../../app/contracts';
import { layoutStation, feederSwitchPaths, stationTerminalLinks, type StationTopologyGraph } from '../../domain/model/station-topology';
import type { VoltageBand } from '../../domain/model/voltage-band';
import type { ScenarioOverlay } from '../../domain/scenario/overlay';
import {defaultSettings,type Settings} from '../../persistence/settings';
import type { N1SelectedDetail } from '../../domain/n1';
import {islandColor} from '../../map/island-map';
import {physicalStationLayout,feederFocusGraph} from './physical-layout';
import {stationOverviewPage} from './page-layout';
import type {SldMode,SldResultOverlay} from './result-overlay';
import {sldFlowAtPort} from './result-overlay';
import {engineeringSymbol,drawSwitchSymbol} from './symbols';
import type {SourceSwitchKind} from '../../domain/model/switch-usage';
import {wireCrossings} from './wire-crossings';
import {feederDrawingPath} from './feeder-drawing-graph';
import {nativeBarCircuit} from './bar-circuit';
import {portResultRows,labelValues,resultNumber} from './result-labels';
export type SldScope='station'|'bay'|'regional';
export interface SldEquipment { id:string;name:string;sourceClass:string;busIds:readonly string[];siteIds:readonly string[];inService:boolean;sourceInService?:boolean;closed?:boolean;sourceClosed?:boolean;fromSiteId?:string;toSiteId?:string;voltageKv?:number;lvKv?:number;ratingMva?:number }
export interface SldBusGroup {id:string;name:string;buses:readonly Bus[]}
export interface SldTerminal {id:string;name:string;bayId:string;external:boolean;equipment:readonly SldEquipment[]}
export interface SldSwitch {id:string;name:string;sourceClass:'ElmCoup'|'StaSwitch';kind:SourceSwitchKind|'other';from:string|null;to:string|null;modelClosed:boolean;closed:boolean;inService:boolean;stateKnown?:boolean}
export interface SldRegionalBranch extends SldEquipment {fromSiteId:string;toSiteId:string}
export interface SldDiagram {
  scope:SldScope;orientation:'horizontal'|'vertical';station:Site;selectedId:string|null;groups:readonly SldBusGroup[];equipment:readonly SldEquipment[];
  bays:readonly CatalogRow[];selectedBay:CatalogRow|null;terminals:readonly SldTerminal[];switches:readonly SldSwitch[];
  regionalSites:readonly Site[];regionalBranches:readonly SldRegionalBranch[];unresolvedSwitches:number;
  graph:StationTopologyGraph|null;voltageBands:ReadonlySet<VoltageBand>;page:number;technical:boolean;scenario:ScenarioOverlay;settings:Settings;
  n1Detail:N1SelectedDetail|null;selectedN1IslandId:string|null;
  mode?:SldMode;overlay?:SldResultOverlay;showResults?:boolean;showArrows?:boolean;colorMode?:'voltage'|'state';
  lod?:'auto'|'overview'|'detail';overviewSize?:{width:number;height:number};onFocusFeeder?:(id:string)=>void;
  onNavigateSite?:(siteId:string,lineId?:string)=>void;
}
type Select=(id:string,sourceClass:string)=>void;
const NS='http://www.w3.org/2000/svg',ink='#e0edf2',muted='#9bb3c1',normal='#90d4df';
function svg<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>,parent?:SVGElement):SVGElementTagNameMap[K]{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent?.append(n);return n;}
function text(parent:SVGElement,x:number,y:number,label:string,size=12,color=ink,anchor='start'){const paper=(parent instanceof SVGSVGElement?parent:parent.ownerSVGElement)?.dataset.paper==='true';const n=svg('text',{x,y,fill:paper?(color===ink?'#182833':color===muted?'#526776':color):color,'font-size':size,'font-family':'system-ui, sans-serif','text-anchor':anchor},parent);n.textContent=label;return n;}
const shorten=(s:string,n=23)=>s.length>n?s.slice(0,n-1)+'…':s;
function group(parent:SVGElement,id:string,cls:string,name:string,select:Select,detail=''){const g=svg('g',{'data-id':id,'data-class':cls,role:'button',tabindex:0,'aria-label':name},parent);svg('title',{},g).textContent=`${name}\n${cls} · ${id}${detail?'\n'+detail:''}`;g.onclick=e=>{e.stopPropagation();select(id,cls);};g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();select(id,cls);}};return g;}
function stateStyle(d:SldDiagram,source:boolean,current:boolean){return {color:source!==current?(current?d.settings.colorScenarioOn:d.settings.colorScenarioOff):current?normal:d.settings.colorOut,dash:''};}
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
    const stroke=component&&(selectedComponent||!impact)&&!outage?islandColor(component.componentId):color;
    if(outage)for(const line of groupElement.querySelectorAll<SVGPathElement>('path[data-connection]'))line.setAttribute('stroke',color);
    if(component)groupElement.setAttribute('data-n1-island',component.componentId);
    const title=groupElement.querySelector('title');if(title)title.textContent+=`\n${label}${component?` · ${component.componentId} · ${component.references.map(row=>row.name).join(', ')||'YOK'} · ${component.hasLocalGeneration?`Yerel üretim var (${component.generatorCount} jeneratör, ${component.generationMw.toFixed(1)} MW)`:''}`:''}${impact?` · Baz ${impact.baseFlowMw.toFixed(1)} MW · N-1 ${impact.postFlowMw==null?'—':impact.postFlowMw.toFixed(1)+' MW'} · ΔP ${impact.deltaPMw==null?'—':impact.deltaPMw.toFixed(1)+' MW'} · Kapasite ${impact.capacityMva==null?'—':impact.capacityMva.toFixed(1)+' MVA'}`:''}`;
    const bounds=groupElement.getBBox(),badgeWidth=Math.min(210,Math.max(68,label.length*6+14)),badge=svg('g',{'data-n1-badge':'true','pointer-events':'none','aria-hidden':'true',...(component?{'data-n1-island':component.componentId}:{})},groupElement),x=bounds.x+bounds.width-badgeWidth/2,y=bounds.y-11;
    svg('rect',{x,y,width:badgeWidth,height:18,rx:4,fill:color||'#496879',stroke:outage?'#f2f5f7':'#b5d0dc','stroke-width':outage?1:0.7},badge);
    text(badge,x+badgeWidth/2,y+12,shorten(label,34),9,'#fff','middle');if(d.scope==='bay'&&d.orientation==='horizontal')badge.setAttribute('transform',`rotate(-90 ${x+badgeWidth/2} ${y+9})`);
  }
}
function path(parent:SVGElement,points:readonly (readonly[number,number])[],color:string,_dash='',width=2){return svg('path',{d:points.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'data-connection':'orthogonal'},parent);}
function symbol(parent:SVGElement,x:number,y:number,cls:string,color:string,closed:boolean|null=true,kind='breaker'){
  if(cls==='ElmTr2')engineeringSymbol(parent,'transformer2w',x,y,color);
  else if(cls==='ElmTr3')engineeringSymbol(parent,'transformer3w',x,y,color);
  else if(cls==='ElmCoup'||cls==='StaSwitch')drawSwitchSymbol(parent,kind==='breaker'?'KE-01':kind==='isolator'||kind==='load-break-disconnector'?'GENERIC_DISCONNECTOR':'UNSPECIFIED',x,y,color,closed);
  else if(cls==='ElmLne'){svg('path',{d:`M${x},${y-16} L${x},${y} M${x-6},${y-6} L${x},${y} L${x+6},${y-6}`,fill:'none',stroke:color,'stroke-width':2},parent);}
  else if(cls==='ElmSym'||cls==='ElmGenStat')engineeringSymbol(parent,'generator',x,y,color);
  else if(cls==='ElmLod')engineeringSymbol(parent,'load',x,y,color);
  else{const g=svg('g',{'data-symbol':'unknown-equipment','data-symbol-partial':cls},parent);svg('rect',{x:x-12,y:y-12,width:24,height:24,stroke:color,fill:'var(--sld-paper, #102033)','stroke-width':2},g);text(g,x,y+4,'?',11,color,'middle');}
}
function wrappedText(parent:SVGElement,x:number,y:number,label:string,limit=18,size=10,color=ink){
  const words=label.split(/\s+/);let first='';while(words.length&&(!first||first.length+words[0].length+1<=limit)){first+=(first?' ':'')+words.shift();}
  text(parent,x,y,shorten(first,limit),size,color,'middle');if(words.length)text(parent,x,y+20,shorten(words.join(' '),limit),size,color,'middle');
}
/** Labels may move; electrical ports and conductors never move to accommodate text. */
function clearFeederLabel(root:SVGSVGElement,g:SVGGElement){
 const inverse=root.getScreenCTM()!.inverse(),world=(e:SVGGraphicsElement)=>{const r=e.getBoundingClientRect(),a=new DOMPoint(r.left,r.top).matrixTransform(inverse),b=new DOMPoint(r.right,r.bottom).matrixTransform(inverse);return {left:a.x,right:b.x,top:a.y,bottom:b.y};},others=[...root.querySelectorAll<SVGGraphicsElement>('[data-device-glyph],text')].filter(e=>!g.contains(e)).map(world),box=root.viewBox.baseVal;
 for(const line of root.querySelectorAll<SVGPathElement>('path[data-connection]')){const matrix=inverse.multiply(line.getScreenCTM()!),points=[...line.getAttribute('d')!.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map(m=>new DOMPoint(Number(m[1]),Number(m[2])).matrixTransform(matrix));for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];others.push({left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)});}}
 const hit=(a:ReturnType<typeof world>,b:ReturnType<typeof world>)=>a.left<b.right+3&&a.right>b.left-3&&a.top<b.bottom+3&&a.bottom>b.top-3;
 for(const [dx,dy]of [[0,0],...Array.from({length:12},(_,i)=>i+1).flatMap(n=>[[0,n*40],[0,-n*40],[-n*24,0],[n*24,0],[-n*24,40],[n*24,40],[-n*24,-40],[n*24,-40]])]){g.setAttribute('transform',`translate(${dx} ${dy})`);const captions=[...g.querySelectorAll('text')].map(world);if(captions.some(b=>b.left<10||b.right>box.width-10||b.top<65||b.bottom>box.height-45))continue;if(!captions.some(c=>others.some(o=>hit(c,o))))return;}
 throw Error('SLD_LABEL_PACKING_UNRESOLVED: '+(g.dataset.feederMarker??g.dataset.equipmentCaption));
}
export function fullDiagramClone(root:SVGSVGElement,fitBox:readonly number[]):SVGSVGElement {
  const clone=root.cloneNode(true) as SVGSVGElement;clone.setAttribute('viewBox',fitBox.join(' '));clone.setAttribute('width',String(fitBox[2]));clone.setAttribute('height',String(fitBox[3]));clone.style.width=fitBox[2]+'px';clone.style.height=fitBox[3]+'px';return clone;
}
function voltageColor(d:SldDiagram,kv:number){return kv>=300?d.settings.color400:kv>=180?d.settings.color220:kv>=100?d.settings.color154:kv>=50?d.settings.color66:d.settings.colorLow;}
const defaultPalette=defaultSettings();
function paperVoltageColor(d:SldDiagram,kv:number){const key=kv>=300?'color400':kv>=180?'color220':kv>=100?'color154':kv>=50?'color66':'colorLow';return d.settings[key]!==defaultPalette[key]?d.settings[key]:kv>=300?'#d62f2f':kv>=180?'#7151ab':kv>=100?'#254a6e':kv>=50?'#287783':'#25813a';}
// Native station graphs are immutable cached source projections; result/scenario labels are never cached.
const geometryCache=new WeakMap<StationTopologyGraph,Map<string,ReturnType<typeof physicalStationLayout>|ReturnType<typeof stationOverviewPage>>>();
const focusGraphs=new WeakMap<StationTopologyGraph,Map<string,StationTopologyGraph>>();
function stationGeometry(graph:StationTopologyGraph,d:SldDiagram){let cache=geometryCache.get(graph);if(!cache){cache=new Map();geometryCache.set(graph,cache);}const flowLabels=d.showResults!==false&&['LF','N1','SC'].includes(d.mode??''),key=[...d.voltageBands].sort().join(',')+'|'+(d.mode==='compact')+'|'+(d.scope==='bay')+'|'+flowLabels;let layout=cache.get(key);if(!layout){layout=d.scope==='station'?stationOverviewPage(graph,d.voltageBands,flowLabels):physicalStationLayout(graph,d.voltageBands,d.mode==='compact',d.scope==='bay');cache.set(key,layout);}return layout;}
function station(root:SVGSVGElement,d:SldDiagram,select:Select):void {
  if(!d.graph)return;const graph=d.graph,layout=stationGeometry(graph,d),overview=d.scope==='station',bayReadouts=d.scope==='bay'&&d.showResults!==false&&['LF','N1','SC'].includes(d.mode??'');let readoutCount=0;root.setAttribute('viewBox',`0 0 ${layout.width+(bayReadouts?280:0)} ${layout.height}`);root.dataset.lod=d.lod==='detail'?'detail':overview?'overview':'detail';root.dataset.omittedFeeders='0';root.dataset.methodStatus=d.overlay?.status??'NOT_RUN';
  if(overview){root.dataset.paper='true';root.style.background='#fff';root.style.setProperty('--sld-paper','#fff');}
  if(overview){for(const inset of [10,16])svg('rect',{x:inset,y:inset,width:layout.width-inset*2,height:layout.height-inset*2,fill:'none',stroke:'#6c7b83','stroke-width':1,'data-station-frame':'true','pointer-events':'none'},root);}
  text(root,overview?layout.width/2:24,38,d.station.name,21,ink,overview?'middle':'start');text(root,overview?layout.width/2:24,58,`${graph.busSections.length} bara · ${d.scope==='bay'?graph.feeders.length:graph.sourceFeederCount} ${d.scope==='bay'?'seçili':'kaynak'} fider · ${graph.switches.length} fiziksel anahtar`,11,muted,overview?'middle':'start');
  const palette=(kv:number,state:boolean)=>overview?(state?(d.colorMode==='state'?'#25813a':paperVoltageColor(d,kv)):d.settings.colorOut!==defaultPalette.colorOut?d.settings.colorOut:'#ef7b16'):d.colorMode==='state'?(state?normal:d.settings.colorOut):voltageColor(d,kv);
  const equipment=new Map(d.equipment.map(e=>[`${e.sourceClass}|${e.id}`,e]));
  const junctions=new Set<string>(),junction=(p:{x:number;y:number;terminalId:string},color:string)=>{const key=[p.terminalId,p.x,p.y,'bus-attachment'].join('|');if(junctions.has(key))return;junctions.add(key);svg('circle',{cx:p.x,cy:p.y,r:4.5,fill:color,'data-junction':p.terminalId,'data-junction-role':'bus-attachment'},root);};
  const overlay=(g:SVGGElement,key:string,x:number,y:number,side:'FROM'|'TO'='FROM',axis:readonly[number,number]=[0,1])=>{
    const entry=d.overlay?.entries.get(key);if(!entry)return;
    g.dataset.resultStatus=entry.status;g.dataset.resultMethod=entry.method;
    const title=g.querySelector('title');if(title)title.textContent+=`\n${entry.status} · ${entry.method}\n`+Object.entries(entry.values).map(([k,v])=>`${k}: ${v??'—'}`).join('\n');
    if(bayReadouts&&!key.startsWith('ElmTerm|')){const top=110+readoutCount++*112,readout=svg('g',{'data-bay-readout':key},g);text(readout,layout.width+18,top,shorten(g.getAttribute('aria-label')??key,32),10,ink);text(readout,layout.width+18,top+14,key,9,muted);entry.lines.forEach((line,i)=>text(readout,layout.width+18,top+30+i*16,line,9,entry.alarm?'#ff746f':ink));const native=g.dataset.localTerminal,voltage=native?d.overlay?.entries.get('ElmTerm|'+native):null;if(voltage)text(readout,layout.width+18,top+30+entry.lines.length*16,voltage.lines[0],9,muted);}
    else if(d.showResults!==false&&overview&&g.dataset.semantic==='busbar-section'){const v=d.mode==='SC'?entry.values.ikssKa:entry.values.voltageKv,value=typeof v==='number'&&Number.isFinite(v)?v.toFixed(1):'—';text(g,24,y+22,`${d.overlay?.phase==='CHANGE'?'Δ ':''}${d.mode==='SC'?'Ik″':'U'} ${value} ${d.mode==='SC'?'kA':'kV'}`,9,muted);}
    else if(d.showResults!==false&&!bayReadouts&&!overview)entry.lines.forEach((line,i)=>text(g,x,y+i*16,line,9,entry.alarm?'#ff746f':ink,'middle'));
    const direction=sldFlowAtPort(entry,side);
    if(d.showArrows!==false&&direction!==null&&direction!==0){const sign=direction>0?1:-1,vx=axis[0]*sign,vy=axis[1]*sign,cx=x+18,cy=y-20,ex=cx+vx*8,ey=cy+vy*8,change=d.overlay?.phase==='CHANGE';svg('path',{d:`M${cx-vx*8},${cy-vy*8} L${ex},${ey} M${ex-vx*6-vy*6},${ey-vy*6+vx*6} L${ex},${ey} L${ex-vx*6+vy*6},${ey-vy*6-vx*6}`,fill:'none',stroke:normal,'data-flow-side':side,'data-flow-direction':change?(sign>0?'INCREASED_INJECTION':'DECREASED_INJECTION'):sign>0?'LOCAL_OUTBOUND':'LOCAL_INBOUND'},g);if(change)text(g,cx+12,cy+3,'Δ',9,normal);}
  };
  for(const p of layout.sections){const b=p.section,current=d.scenario.busOrTerminalStatus[b.id]??(d.scenario.restoredTerminals.includes(b.id)||b.inService),g=group(root,b.id,'ElmTerm',b.name,select,`${b.voltageKv} kV · ${current?'Serviste':'Servis dışı'}`);
    const rail=path(g,[[p.x1,p.y],[p.x2,p.y]],d.selectedId===b.id?'#ffe382':palette(b.voltageKv,current),'',4);rail.dataset.nativeTerminal=b.id;g.dataset.state=current?'IN_SERVICE':'OUT_OF_SERVICE';text(g,24,p.y+4,shorten(b.name,28)+(p.reference?' · devam':''),11);if(p.reference){g.removeAttribute('data-id');g.dataset.sourceReference=b.id;}else g.dataset.port=b.id;g.dataset.semantic='busbar-section';overlay(g,`ElmTerm|${b.id}`,p.x2-120,p.y+2);
  }
  for(const [id,p]of layout.ports){if(p.semantics==='busbar-section')continue;const term=graph.terminals.find(t=>t.id===id)!,g=group(root,id,'ElmTerm',term.name,select,`${term.vnKv} kV · ${id}`);g.dataset.port=id;g.dataset.semantic=p.semantics;g.dataset.ytbsSlot=p.slot??'';svg('circle',{cx:p.x,cy:p.y,r:3,fill:palette(term.vnKv,term.inService)},g);if(d.technical)text(g,p.x+7,p.y-4,id,8,muted);overlay(g,`ElmTerm|${id}`,p.x,p.y+16);}
  for(const route of layout.routes){const {sw,a,b,x,y}=route,item=equipment.get(`${sw.sourceClass}|${sw.id}`);if(!item)continue;
    if(!a&&!b&&graph.terminals.some(t=>t.id===sw.from)&&graph.terminals.some(t=>t.id===sw.to))continue;
    const known=sw.stateKnown||Object.hasOwn(d.scenario.switchState,sw.id),closed=item.closed??false,state=!item.inService?'OUT_OF_SERVICE':!known?'UNKNOWN':closed?'CLOSED':'OPEN';
    const color=state==='UNKNOWN'?d.settings.colorNoResult:!item.inService?d.settings.colorOut:item.sourceClosed!=null&&item.sourceClosed!==closed?(closed?d.settings.colorScenarioOn:d.settings.colorScenarioOff):palette(graph.terminals.find(t=>t.id===sw.from)?.vnKv??0,closed),g=group(root,sw.id,sw.sourceClass,item.name,select,`${sw.kind} · ${state} · ${sw.from} → ${sw.to}`);
    g.dataset.deviceKind=sw.kind;g.dataset.sourceUsage=sw.sourceUsage??'';g.dataset.physicalSwitch=`${sw.sourceClass}|${sw.sourceId}`;g.dataset.from=sw.from;g.dataset.to=sw.to;g.dataset.state=state;g.dataset.semantic=sw.from===sw.to?'cubicle-switch':sw.kind;g.dataset.bay=sw.bayId??'';g.dataset.cubicle=sw.cubicleId??'';
    g.dataset.contactIn=g.dataset.contactFrom=route.contactFrom.join(',');g.dataset.contactOut=g.dataset.contactTo=route.contactTo.join(',');g.dataset.inline=String(route.inline===true);g.dataset.chainOrdering=route.ordering;
    if(!route.wires.length){if(a||b)text(g,x+20,y,'Kaynak zincir sırası/uç çözümlenemedi',9,muted);else continue;}
    for(const w of route.wires){const line=path(g,w.points,color);line.dataset.nativeTerminal=w.terminalId;line.dataset.contactSide=w.side;}for(const p of [a,b])if(p?.semantics==='busbar-section')junction(p,color);
    const glyph=svg('g',{'data-device-glyph':g.dataset.physicalSwitch!,transform:`rotate(${route.rotation??0} ${x} ${y})`},g);symbol(glyph,x,y,sw.sourceClass,color,known?closed:null,sw.kind);
    // A real hit target remains usable independently of thin strokes and label geometry.
    svg('rect',{x:x-14,y:y-17,width:28,height:34,fill:'transparent','pointer-events':'all','data-switch-hit':sw.id},g);
    if(state==='UNKNOWN')text(g,x+12,y+3,'?',10,color);if(d.selectedId===sw.id)svg('circle',{cx:x,cy:y,r:19,fill:'none',stroke:'#ffe382','pointer-events':'none'},g);if(d.technical)text(g,x+16,y-7,sw.id,8,muted);
  }
  for(const geo of layout.equipment){const e=geo.equipment,item=equipment.get(`${e.sourceClass}|${e.id}`);if(!item)continue;
    const {x,y}=geo,ports=geo.nativePorts,g=group(root,e.id,e.sourceClass,e.name,select,e.terminals.join(' → ')),style=equipmentState(d,item),color=palette(item.voltageKv??graph.terminals.find(t=>t.id===ports[0].terminalId)?.vnKv??0,item.inService);
    g.dataset.secondaryRouting=geo.ports.some(p=>p.corridor!=null)?'SIDE_CORRIDOR':'LOCAL';g.dataset.terminals=e.terminals.join('|');g.dataset.semantic=e.kind;g.dataset.localTerminal=ports[0].terminalId;g.dataset.ytbsSlot=ports[0].slot??'';g.dataset.equipmentCenter=[x,y].join(',');
    for(const port of geo.ports)for(const w of port.wires){const line=path(g,w.points,palette(graph.terminals.find(t=>t.id===port.terminalId)?.vnKv??0,item.inService),style.dash);line.dataset.nativeTerminal=port.terminalId;line.dataset.equipmentContact=port.point.join(',');}for(const p of ports)if(p.semantics==='busbar-section')junction(p,color);
    const flowSide:'FROM'|'TO'=e.terminals.indexOf(ports[0].terminalId)===1?'TO':'FROM';let flowAxis:readonly[number,number]=[0,geo.direction];
    if(geo.boundary){g.dataset.boundary='true';g.dataset.hvTerminal=e.terminals[0];g.dataset.lvTerminal=e.terminals[1]??'';
      const kv=geo.ports[0].boundaryKv;svg('path',{d:`M${x-7},${y-geo.direction*7} L${x},${y} L${x+7},${y-geo.direction*7}`,fill:'none',stroke:color,'stroke-width':2},g);text(g,x,y+geo.direction*28,`Diğer gerilim seviyesine devam: ${kv??'—'} kV`,10,ink,'middle');text(g,x,y+geo.direction*43,e.id,9,muted,'middle');
    }else if(e.kind==='transformer'||e.kind==='transformer3w'){
      engineeringSymbol(g,e.autoTransformer?'autotransformer':e.kind==='transformer3w'?'transformer3w':'transformer2w',x,y,color,true,palette(graph.terminals.find(t=>t.id===e.terminals[1])?.vnKv??0,item.inService));g.dataset.transformerType=e.autoTransformer===true?'AUTOTRANSFORMER':e.autoTransformer===false?'TWO_WINDING':'UNVERIFIED_TYPE';g.dataset.hvTerminal=e.terminals[0];g.dataset.lvTerminal=e.terminals[1]??'';
      const caption=svg('g',{'data-equipment-caption':e.id},g),card=d.showResults!==false&&['LF','N1','SC'].includes(d.mode??''),cx=geo.caption?.x??x+24,cy=geo.caption?.y??y+24;text(caption,card?cx:x+24,card?cy+13:y-5,shorten(e.name,26),10);text(caption,card?cx:x+24,card?cy+29:y+12,`${item.voltageKv??'—'}/${item.lvKv??'—'} kV · Snom ${item.ratingMva??'—'} MVA`,9,muted);
      if(card){caption.dataset.transformerCard=e.id;caption.dataset.readoutStatus=d.overlay?.entries.get(e.sourceClass+'|'+e.id)?.status??d.overlay?.status??'NOT_RUN';for(const [side,index]of [['HV',0],['LV',1]] as const){const native=e.terminals[index]??'',column=svg('g',{'data-result-port':side,'data-native-terminal':native},caption),xx=cx+index*112;text(column,xx,cy+47,side+' · '+native,9,ink);portResultRows(d.overlay,e.sourceClass+'|'+e.id,native).forEach((row,i)=>text(column,xx,cy+63+i*15,row,9,muted));}
       const v=labelValues(d.overlay?.entries.get(e.sourceClass+'|'+e.id));text(caption,cx,cy+125,`Tap ${resultNumber(v.tapPosition)} · Yük ${resultNumber(v.loadingPercent)} %`,9,muted);text(caption,cx,cy+141,`Kayıp P/Q ${resultNumber(v.pLossMw)} / ${resultNumber(v.qLossMvar)} MW/MVAr`,9,muted);}
      if(e.kind==='transformer3w')text(caption,card?cx:x+24,card?cy+157:y+27,'PARTIAL · hesap UNSUPPORTED',9,'#ffd27e');flowAxis=[0,1];
    }else if(e.kind==='line'&&ports.length===2){g.dataset.nativeFrom=e.terminals[0];g.dataset.nativeTo=e.terminals[1];flowAxis=[ports[1].x>=ports[0].x?1:-1,0];wrappedText(g,x,y-18,e.name,24,10);
    }else if(e.kind==='line'){
      g.dataset.exitDirection=geo.direction<0?'UP':'DOWN';const remoteId=flowSide==='FROM'?item.toSiteId:item.fromSiteId,remote=d.regionalSites.find(s=>s.id===remoteId);
      svg('path',{d:`M${x},${y-geo.direction*16} L${x},${y} M${x-7},${y-geo.direction*8} L${x},${y} L${x+7},${y-geo.direction*8}`,fill:'none',stroke:color,'stroke-width':2},g);if(!overview&&!bayReadouts){wrappedText(g,x,y+geo.direction*27,remote?.name??e.name,24,10);text(g,x,y+geo.direction*45,e.id,9,muted,'middle');}
    }else {symbol(g,x,y,e.sourceClass,color);if(!overview)wrappedText(g,x,y+26,e.name,24,10);}
    svg('rect',{x:x-15,y:y-20,width:30,height:40,fill:'transparent','pointer-events':'all','data-equipment-hit':e.id},g);
    if(d.selectedId===e.id)svg('circle',{cx:x,cy:y,r:21,fill:'none',stroke:'#ffe382','pointer-events':'none'},g);
    if(d.overlay?.outageKey===`${e.sourceClass}|${e.id}`){g.dataset.outage='true';text(g,x,y-25,'N-1 KESİNTİ',10,'#ff746f','middle');}
    overlay(g,`${e.sourceClass}|${e.id}`,x,y+70,flowSide,flowAxis);
  }
  for(const g of root.querySelectorAll<SVGGElement>('[data-equipment-center]')){const glyph=g.querySelector('[data-symbol]')??[...g.children].find(n=>n.tagName==='path'&&!n.hasAttribute('data-connection'));if(glyph)glyph.setAttribute('data-device-glyph',g.dataset.class+'|'+g.dataset.id);}
  // A native bay endpoint is a feeder continuation, even when the export has no
  // ElmLne record. This arrow is presentation geometry, never fabricated gear.
  for(const f of layout.feeders){if(nativeBarCircuit(graph,f.feeder))continue;const main=feederDrawingPath(graph,f.feeder),end=main?.terminals.at(-1),p=end?layout.ports.get(end):null;if(!p||p.semantics==='busbar-section')continue;
    const actual=layout.equipment.filter(e=>f.feeder.equipmentKeys.includes(e.equipment.sourceClass+'|'+e.equipment.id));if(actual.some(e=>['line','transformer','transformer3w'].includes(e.equipment.kind)))continue;
    const sign=p.direction===-1?-1:1,x=p.x,y=p.y+sign*38,last=main?.switchIds.at(-1),g=svg('g',{'data-feeder-exit':f.feeder.id,'data-native-terminal':end!,'data-state-source':last??'UNKNOWN','data-exit-direction':sign<0?'UP':'DOWN'},root),conductor=[...root.querySelectorAll<SVGPathElement>('path[data-native-terminal]')].find(path=>path.dataset.nativeTerminal===end&&path.closest('[data-id]')?.getAttribute('data-id')===last),color=conductor?.getAttribute('stroke')??d.settings.colorNoResult;svg('title',{},g).textContent=`Ok rengi kaynak ana devre iletkenini izler: ${last??'UNKNOWN'}. Alternatif besleme nedeniyle enerji var/yok çıkarımı yapılmaz.`;
    path(g,[[x,p.y],[x,y]],color);svg('path',{d:`M${x-7},${y-sign*8} L${x},${y} L${x+7},${y-sign*8}`,stroke:color,'stroke-width':2,fill:'none'},g);
  }
  for(const caption of root.querySelectorAll<SVGGElement>('[data-equipment-caption]'))clearFeederLabel(root,caption);
  // Preserve a real exported leaf even when no equipment cubicle attaches to
  // it. In particular, never move a winding onto a bank DS merely because its
  // cubicle name resembles that winding's name.
  const mainEnds=new Set(graph.feeders.map(f=>feederDrawingPath(graph,f)?.terminals.at(-1)));for(const [id,p]of layout.ports){if(p.semantics==='busbar-section'||mainEnds.has(id)||graph.equipment.some(e=>e.terminals.includes(id))||graph.switches.filter(s=>s.from!==s.to&&(s.from===id||s.to===id)).length!==1)continue;const note=svg('g',{'data-source-leaf-caption':id},root);svg('title',{},note).textContent=`Kaynak terminal ${id}: bu uca bağlı ekipman cubicle kaydı yok. Sargı bağlantısı türetilmedi.`;text(note,p.x+14,p.y+12,'Kaynak ucu',9,muted);clearFeederLabel(root,note);}
  for(const slot of layout.slots){const p=layout.feeders.find(p=>p.feeder.id===slot.feeder.id)!;
    if(overview){const f=p.feeder,cls=f.sourceClass,id=cls==='ElmBay'?f.id:f.id.slice(f.id.indexOf('|')+1),keys=[...f.switchIds.map(id=>{const s=graph.switches.find(s=>s.id===id)!;return s.sourceClass+'|'+s.sourceId;}),...f.equipmentKeys],g=group(root,id,cls,f.name,()=>d.onFocusFeeder?d.onFocusFeeder(f.id):select(id,cls),`${slot.typeName??slot.role} · ${slot.typeStatus??'SOURCE_GRAPH'} · ${slot.slot}\nNative cihazlar: ${keys.join(',')}`);g.dataset.feederMarker=f.id;g.dataset.representedKeys=keys.join(';');g.dataset.ytbsSlot=slot.slot;g.dataset.ytbsSide=slot.side??'N';
      const cell='compartments'in layout?layout.compartments.get(f.id):null;const lx=p.x,ly=p.y;const nativeName=f.name.startsWith(d.station.name+' ')?f.name.slice(d.station.name.length+1):f.name;const name=nativeName.replace(/^\d+\s*kV\s*/i,'').replace(/ EIH FIDERI$/,'').replace(/ PRIMER FIDERI$/,' PR.').replace(/ SEKONDER FIDERI$/,' SEK.');
      if(cell){g.dataset.compartment=[cell.x1,cell.y1,cell.x2,cell.y2].join(',');g.dataset.packingUnits=String(cell.units);g.dataset.drawingSide=cell.direction<0?'UP':'DOWN';g.dataset.modelFeeder=String(cell.model);g.dataset.labelZones='title,flow,equipment';}
      wrappedText(g,lx,ly,name,f.voltageKv<=40?12:17,11);if(cell?.model)text(g,lx,ly+38,'Model fideri',9,muted,'middle');
      const resultKey=f.equipmentKeys.find(k=>d.overlay?.entries.has(k)),entry=resultKey?d.overlay?.entries.get(resultKey):null,end=feederDrawingPath(graph,f)?.terminals.at(-1)??f.terminalIds.find(id=>!f.busSectionIds.includes(id))??f.terminalIds[0],terminalEntry=d.overlay?.entries.get('ElmTerm|'+end),sourceEquipment=graph.equipment.find(e=>resultKey===e.sourceClass+'|'+e.id),side=sourceEquipment?.terminals.indexOf(end)===1?'To':'From';
      if(d.showResults!==false&&['LF','N1','SC'].includes(d.mode??'')){
        const rows=portResultRows(d.overlay,resultKey,end);if(d.mode==='SC')rows.push(`Ik″: ${resultNumber(labelValues(terminalEntry).ikssKa)} kA`);
        rows.forEach((line,i)=>{text(g,lx,ly+56+i*16,line,9,entry?.alarm?'#b93831':muted,'middle').dataset.labelZone='flow';});g.dataset.readoutStatus=(entry??terminalEntry)?.status??d.overlay?.status??'NOT_RUN';if(entry||terminalEntry)g.dataset.resultStatus=(entry??terminalEntry)!.status;g.dataset.flowSide=side.toUpperCase();g.dataset.resultTerminal=end;
      }
      if(d.technical)text(g,lx,ly+148,f.id.replace(/^[^|]+\|/,''),9,muted,'middle').dataset.labelZone='equipment';clearFeederLabel(root,g);
    }else if(d.technical)text(root,p.x,p.busYs.length?(slot.side==='A'?Math.min(...p.busYs)-22:Math.max(...p.busYs)+22):p.y,slot.side?`${slot.slot}${slot.block?' · blok '+(slot.block+1):''}`:slot.slot,9,muted,'middle');
  }
  for(const p of layout.feeders){const issues=graph.issues.filter(i=>i.sourceId===p.feeder.id);if(!issues.length)continue;const g=group(root,p.feeder.id,p.feeder.sourceClass,p.feeder.name,select,issues.map(i=>i.reason).join('\n'));g.dataset.unresolved='true';text(g,p.x,p.y+25,'Uç belirsiz · '+p.feeder.name,9,'#ffd27e','middle');}
  if(bayReadouts&&!readoutCount){const f=graph.feeders[0],end=f?feederDrawingPath(graph,f)?.terminals.at(-1):null,entry=end?d.overlay?.entries.get('ElmTerm|'+end):null;if(entry){const readout=svg('g',{'data-bay-readout':'ElmTerm|'+end},root);text(readout,layout.width+18,110,'Fider terminali · '+end,10);entry.lines.forEach((line,i)=>text(readout,layout.width+18,132+i*16,line,9,muted));readoutCount++;}}
  if(bayReadouts)root.setAttribute('viewBox',`0 0 ${layout.width+280} ${Math.max(layout.height,readoutCount*112+190)}`);
  text(root,24,layout.height-17,`${graph.counters.diagramUnresolvedTotal} kaynak sorunu · uç ${graph.counters.invalidSwitchEndpoints} · cubicle ${graph.counters.missingCubicleReferences} · ${layout.slots.filter(s=>!s.side).length} sınıflanamayan fider · ${layout.routes.filter(r=>r.ordering==='SOURCE_ORDER_UNAVAILABLE').length} belirsiz cihaz sırası`,11,muted);
  if(d.overlay&&['LF','N1','SC'].includes(d.mode??''))text(root,24,layout.height-52,`${d.mode} ${d.overlay.phase} · ${d.overlay.status} · ${d.overlay.method}`,10,muted);
  const lines=[...root.querySelectorAll<SVGPathElement>('path[data-connection][data-native-terminal]')],conductors=lines.map(line=>({terminalId:line.dataset.nativeTerminal!,points:[...line.getAttribute('d')!.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map(m=>[Number(m[1]),Number(m[2])] as const)}));
  for(const jump of wireCrossings(conductors)){const {x,y,vertical}=jump,line=lines[jump.wire],g=svg('g',{'data-hop-over':'true','data-terminal-a':conductors[jump.wire].terminalId,'data-terminal-b':conductors[jump.other].terminalId,'pointer-events':'none'},root);
    svg('path',{d:vertical?`M${x},${y-7} L${x},${y+7}`:`M${x-7},${y} L${x+7},${y}`,stroke:overview?'#fff':'#102033','stroke-width':6,fill:'none'},g);
    svg('path',{d:vertical?`M${x},${y-7} C${x+10},${y-7} ${x+10},${y+7} ${x},${y+7}`:`M${x-7},${y} C${x-7},${y-10} ${x+7},${y-10} ${x+7},${y}`,stroke:line.getAttribute('stroke')!,fill:'none','stroke-width':2},g);
  }
}

function bay(root:SVGSVGElement,d:SldDiagram,select:Select):void {
 if(!d.graph||!d.selectedBay)return;let cache=focusGraphs.get(d.graph);if(!cache){cache=new Map();focusGraphs.set(d.graph,cache);}let graph=cache.get(d.selectedBay.id);if(!graph){graph=feederFocusGraph(d.graph,d.selectedBay.id);cache.set(d.selectedBay.id,graph);}
 station(root,{...d,graph,lod:'detail'},select);root.dataset.lod='focus';
 if(d.orientation==='horizontal'){const [,,width,height]=root.getAttribute('viewBox')!.split(' ').map(Number),body=svg('g',{'data-bay-orientation':'horizontal',transform:`translate(${height} 0) rotate(90)`});for(const child of [...root.children]){if(child.tagName==='text'&&(Number(child.getAttribute('y'))<80||Number(child.getAttribute('y'))>=height-40)){if(Number(child.getAttribute('y'))>=height-40)child.setAttribute('y',String(width-(height-Number(child.getAttribute('y')))));continue;}body.append(child);}root.append(body);root.setAttribute('viewBox',`0 0 ${height} ${width}`);for(const t of root.querySelectorAll<SVGTextElement>(':scope > text')){const full=t.textContent??'';let n=full.length;while(t.getComputedTextLength()>height-48&&n>8)t.textContent=shorten(full,--n);if(n<full.length)svg('title',{},t).textContent=full;}}

 text(root,24,76,d.orientation==='horizontal'?'Fider odağı · native kontaklar':'Fider odağı · kaynak terminal / cubicle / kontak zinciri',11,muted);
}
function regional(root:SVGSVGElement,d:SldDiagram,select:Select):void {
 const neighbors=d.regionalSites.filter(s=>s.id!==d.station.id).slice(d.page*12,(d.page+1)*12),rows=neighbors.map(site=>({site,items:d.regionalBranches.filter(e=>e.fromSiteId===site.id||e.toSiteId===site.id)})),height=Math.max(400,100+rows.reduce((n,r)=>n+Math.max(1,r.items.length)*48+38,0));root.setAttribute('viewBox',`0 0 1100 ${height}`);root.dataset.lod='regional';text(root,24,28,`${d.station.name} · bölgesel bağlantılar`,19);
 let top=65;for(const {site,items}of rows){const size=Math.max(1,items.length)*48+30;svg('rect',{x:20,y:top,width:1050,height:size,rx:5,fill:'#142a3b',stroke:'#496879'},root);text(root,35,top+20,`${site.name} · ${items.length} ayrı native bağlantı`,12);
  for(const [i,e]of items.entries()){const y=top+43+i*48,g=group(root,e.id,e.sourceClass,e.name,select,`${e.id} · ${d.station.id} ↔ ${site.id}`),style=equipmentState(d,e);g.dataset.regionalBranch=e.id;path(g,[[40,y],[1020,y]],style.color,style.dash);svg('rect',{x:480,y:y-14,width:40,height:28,fill:'var(--sld-paper, #102033)',stroke:style.color},g);text(g,58,y-7,shorten(e.name,48)+' · '+e.id,11);const entry=d.overlay?.entries.get(e.sourceClass+'|'+e.id);if(entry&&d.showResults!==false){g.dataset.resultStatus=entry.status;text(g,550,y-7,shorten(entry.lines[0]??entry.status,58),10,muted);}svg('rect',{x:475,y:y-17,width:50,height:34,fill:'transparent','pointer-events':'all','data-equipment-hit':e.id},g);}
  const target=group(root,site.id,'ElmSite','Karşı TM: '+site.name,()=>{if(d.onNavigateSite)d.onNavigateSite(site.id,items[0]?.id);else select(site.id,'ElmSite');});svg('rect',{x:860,y:top+4,width:180,height:24,rx:4,fill:'#214255'},target);text(target,950,top+21,'Karşı TM: '+shorten(site.name,18),10,ink,'middle');top+=size+10;
 }
}
export class SvgSldRenderer {
  private root:SVGSVGElement|null=null;private fitBox=[0,0,1200,600];private key='';
  zoom(factor:number){if(!this.root)return;const[x,y,w,h]=this.box(),nextW=Math.max(this.fitBox[2]/12,Math.min(this.fitBox[2]*2,w/factor)),nextH=nextW*h/w;this.root.setAttribute('viewBox',[x+(w-nextW)/2,y+(h-nextH)/2,nextW,nextH].join(' '));}
  exportSvg():string|null{return this.root?new XMLSerializer().serializeToString(fullDiagramClone(this.root,this.fitBox)):null;}
  fit(){if(!this.root)return;this.root.dataset.viewportMode='fit';this.root.setAttribute('viewBox',this.fitBox.join(' '));this.root.style.minWidth='';this.root.style.height=this.root.dataset.viewportHeight+'px';this.root.parentElement!.scrollTop=0;}
  readable(){if(!this.root)return;this.root.dataset.viewportMode='readable';const host=this.root.parentElement!,width=this.root.dataset.paper==='true'?Math.max(this.fitBox[2],host.clientWidth):host.clientWidth;this.root.style.minWidth=width>host.clientWidth?width+'px':'';this.root.setAttribute('viewBox',this.fitBox.join(' '));this.root.style.height=Math.max(Number(this.root.dataset.viewportHeight),this.fitBox[3]*width/this.fitBox[2])+'px';host.scrollTop=0;}
  focus(id:string,sourceClass:string){if(this.root)this.root.dataset.viewportMode='focus';if(this.root?.dataset.paper==='true'){this.root.style.height=this.root.dataset.viewportHeight+'px';this.root.style.minWidth='';this.root.parentElement!.scrollTop=0;}const g=[...this.root?.querySelectorAll<SVGGElement>('g[data-id][data-class]')??[]].find(g=>g.dataset.id===id&&g.dataset.class===sourceClass);if(!g)return;g.focus();const b=g.getBBox(),matrix=this.root!.getScreenCTM()!.inverse().multiply(g.getScreenCTM()!),corners=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix)),left=Math.min(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),width=Math.max(...corners.map(p=>p.x))-left,height=Math.max(...corners.map(p=>p.y))-top,w=Math.max(320,width+80),h=Math.max(220,height+80);this.root!.setAttribute('viewBox',[left+width/2-w/2,top+height/2-h/2,w,h].join(' '));}
  private box(){return this.root!.getAttribute('viewBox')!.split(' ').map(Number);}
  render(host:HTMLElement,d:SldDiagram,select:Select):void {
    const previousMode=this.root?.dataset.viewportMode??'fit',previousScroll=host.scrollTop,previousLeft=host.scrollLeft;const key=[d.station.id,d.scope,d.lod,d.scope==='bay'?d.selectedBay?.id:'',d.scope==='bay'?d.orientation:'vertical',d.scope==='regional'?d.page:0,[...d.voltageBands].join(',')].join('|'),previous=this.root&&key===this.key?this.box():null;this.key=key;
    const root=svg('svg',{xmlns:NS,viewBox:'0 0 1240 600',width:'100%',height:540,role:'img','aria-label':`${d.station.name} ${d.scope==='bay'?d.selectedBay?.name||'fider':d.scope==='regional'?'bölgesel':'TM genel'} tek hat şeması`,class:'ga-sld-svg',preserveAspectRatio:'xMidYMid meet'});
    const available=Math.max(160,(host.parentElement?.classList.contains('ga-sld-canvas')?host.parentElement.clientHeight:host.clientHeight)||innerHeight-Math.max(0,host.getBoundingClientRect().top)-24);d.overviewSize={width:Math.max(360,host.clientWidth||1200),height:available};
    root.style.background='#102033';root.style.touchAction='none';root.style.display='block';root.style.width='100%';root.style.height=available+'px';
    const oldFit=this.fitBox;host.replaceChildren(root);this.root=root;if(d.scope==='regional')regional(root,d,select);else if(d.scope==='bay')bay(root,d,select);else station(root,d,select);applyN1Overlay(root,d);for(const t of root.querySelectorAll<SVGTextElement>('[data-bay-orientation] text'))if(!t.closest('[data-n1-badge]'))t.setAttribute('transform',`rotate(-90 ${t.getAttribute('x')??0} ${t.getAttribute('y')??0})`);this.fitBox=this.box();if(previous&&oldFit[2]===this.fitBox[2]&&oldFit[3]===this.fitBox[3])root.setAttribute('viewBox',previous.join(' '));
    root.dataset.viewportWidth=String(host.clientWidth);root.dataset.viewportHeight=String(available);host.style.maxHeight='';host.style.overflow='auto';host.style.display='block';
    root.dataset.viewportMode=previous?previousMode:'fit';
    if(root.dataset.paper==='true'&&previous&&previousMode==='readable')this.readable();else {root.style.minWidth='';root.style.height=available+'px';}
    if(previous&&oldFit[2]===this.fitBox[2]&&oldFit[3]===this.fitBox[3]){root.setAttribute('viewBox',previous.join(' '));host.scrollTop=previousScroll;host.scrollLeft=previousLeft;}
    let drag:{x:number;y:number;box:number[]}|null=null,moved=false;
    root.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,box:this.box()};moved=false;};
    root.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4){moved=true;root.setPointerCapture(e.pointerId);}if(!moved)return;const r=root.getBoundingClientRect(),scale=Math.min(r.width/drag.box[2],r.height/drag.box[3]);root.setAttribute('viewBox',[drag.box[0]-dx/scale,drag.box[1]-dy/scale,drag.box[2],drag.box[3]].join(' '));};
    root.onpointerup=e=>{drag=null;if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);};root.onpointercancel=()=>{drag=null;};root.addEventListener('click',e=>{if(moved){e.stopImmediatePropagation();moved=false;}},true);
    root.onwheel=e=>{e.preventDefault();this.zoom(e.deltaY<0?1.15:1/1.15);};
  }
}
