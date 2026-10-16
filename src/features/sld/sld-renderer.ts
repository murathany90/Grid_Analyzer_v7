import type { Bus, Site } from '../../domain/model/network';
import type { CatalogRow } from '../../app/contracts';
import { layoutStation, feederSwitchPaths, stationTerminalLinks, type StationTopologyGraph } from '../../domain/model/station-topology';
import type { VoltageBand } from '../../domain/model/voltage-band';
import type { ScenarioOverlay } from '../../domain/scenario/overlay';
import {defaultSettings,type Settings} from '../../persistence/settings';
import type { N1SelectedDetail } from '../../domain/n1';
import {islandColor} from '../../map/island-map';
import {type Point} from './physical-layout';
import {stationOverviewPage} from './page-layout';
import type {SldMode,SldResultOverlay} from './result-overlay';
import {sldFlowAtPort} from './result-overlay';
import {engineeringSymbol,drawSwitchSymbol} from './symbols';
import type {SourceSwitchKind} from '../../domain/model/switch-usage';
import {visibleCrossings} from './visible-crossings';
import {wireCrossings} from './wire-crossings';
import {sldDrawingGraph} from './source-switch-policy';
import {feederDrawingPath} from './feeder-drawing-graph';
import {nativeBarCircuit} from './bar-circuit';
import {railPassPath} from './rail-pass';
import {claimConductor,type OwnedSegment} from './conductor-ledger';
import {portResultRows,transformerCardRows,labelValues,resultNumber} from './result-labels';
import {captionLines,feederCaption,localDeviceName} from './caption-text';
import {feederReadout} from './feeder-readout';
import {stationSummary} from './station-summary';
export type SldScope='station';
export interface SldEquipment { id:string;name:string;sourceClass:string;busIds:readonly string[];siteIds:readonly string[];inService:boolean;sourceInService?:boolean;closed?:boolean;sourceClosed?:boolean;fromSiteId?:string;toSiteId?:string;voltageKv?:number;lvKv?:number;ratingMva?:number }
export interface SldBusGroup {id:string;name:string;buses:readonly Bus[]}
export interface SldTerminal {id:string;name:string;bayId:string;external:boolean;equipment:readonly SldEquipment[]}
export interface SldSwitch {id:string;name:string;sourceClass:'ElmCoup'|'StaSwitch';kind:SourceSwitchKind|'other';from:string|null;to:string|null;modelClosed:boolean;closed:boolean;inService:boolean;stateKnown?:boolean}
export interface SldRegionalBranch extends SldEquipment {fromSiteId:string;toSiteId:string}
export interface SldDiagram {
  scope:SldScope;orientation:'horizontal'|'vertical';station:Site;scenarioLabel?:string;selectedId:string|null;groups:readonly SldBusGroup[];equipment:readonly SldEquipment[];
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
    text(badge,x+badgeWidth/2,y+12,shorten(label,34),9,'#fff','middle');
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
export function fullDiagramClone(root:SVGSVGElement,fitBox:readonly number[]):SVGSVGElement {
  const clone=root.cloneNode(true) as SVGSVGElement;clone.setAttribute('viewBox',fitBox.join(' '));clone.setAttribute('width',String(fitBox[2]));clone.setAttribute('height',String(fitBox[3]));clone.style.width=fitBox[2]+'px';clone.style.height=fitBox[3]+'px';return clone;
}
function voltageColor(d:SldDiagram,kv:number){return kv>=300?d.settings.color400:kv>=180?d.settings.color220:kv>=100?d.settings.color154:kv>=50?d.settings.color66:d.settings.colorLow;}
const defaultPalette=defaultSettings();
function paperVoltageColor(d:SldDiagram,kv:number){const key=kv>=300?'color400':kv>=180?'color220':kv>=100?'color154':kv>=50?'color66':'colorLow';return d.settings[key]!==defaultPalette[key]?d.settings[key]:kv>=300?'#d62f2f':kv>=180?'#7151ab':kv>=100?'#254a6e':kv>=50?'#287783':'#25813a';}
// Native station graphs are immutable cached source projections; result/scenario labels are never cached.
const geometryCache=new WeakMap<StationTopologyGraph,Map<string,ReturnType<typeof stationOverviewPage>>>();
function stationGeometry(graph:StationTopologyGraph,d:SldDiagram){let cache=geometryCache.get(graph);if(!cache){cache=new Map();geometryCache.set(graph,cache);}const expanded=['N1','SC'].includes(d.mode??''),key=[...d.voltageBands].sort().join(',')+'|'+expanded;let layout=cache.get(key);if(!layout){layout=stationOverviewPage(graph,d.voltageBands,expanded);cache.set(key,layout);}return layout;}
function station(root:SVGSVGElement,d:SldDiagram,select:Select):void {
  if(!d.graph)return;const sourceGraph=d.graph,graph=sldDrawingGraph(sourceGraph),layout=stationGeometry(graph,d),overview=true;root.setAttribute('viewBox',`0 0 ${layout.width} ${layout.height}`);root.dataset.lod=d.lod==='detail'?'detail':overview?'overview':'detail';root.dataset.omittedFeeders='0';root.dataset.methodStatus=d.overlay?.status??'NOT_RUN';
  if(overview){root.dataset.paper='true';root.style.background='#fff';root.style.setProperty('--sld-paper','#fff');}
  if(overview){for(const inset of [10,16])svg('rect',{x:inset,y:inset,width:layout.width-inset*2,height:layout.height-inset*2,fill:'none',stroke:'#6c7b83','stroke-width':1,'data-station-frame':'true','pointer-events':'none'},root);}
  text(root,overview?layout.width/2:24,38,d.station.name,21,ink,overview?'middle':'start');text(root,overview?layout.width/2:24,70,`${graph.busSections.length} bara · ${graph.sourceFeederCount} kaynak fider · ${sourceGraph.switches.length} kaynak anahtar · ${graph.switches.length} çizilen`,11,muted,overview?'middle':'start');
  root.dataset.sourceAvailability=graph.terminals.length||graph.equipment.length||graph.switches.length?'AVAILABLE':'NO_SOURCE_TOPOLOGY';if(root.dataset.sourceAvailability==='NO_SOURCE_TOPOLOGY')text(root,layout.width/2,160,'Bu merkez için kaynak terminal veya ekipman bağlantısı bulunmuyor.',12,muted,'middle');
  const palette=(kv:number,state:boolean)=>overview?(state?(d.colorMode==='state'?'#25813a':paperVoltageColor(d,kv)):d.settings.colorOut!==defaultPalette.colorOut?d.settings.colorOut:'#ef7b16'):d.colorMode==='state'?(state?normal:d.settings.colorOut):voltageColor(d,kv);
  const equipment=new Map(d.equipment.map(e=>[`${e.sourceClass}|${e.id}`,e]));
  const junctions=new Set<string>(),junction=(p:{x:number;y:number;terminalId:string},color:string)=>{const key=[p.terminalId,p.x,p.y,'bus-attachment'].join('|');if(junctions.has(key))return;junctions.add(key);svg('circle',{cx:p.x,cy:p.y,r:4.5,fill:color,'data-junction':p.terminalId,'data-junction-role':'bus-attachment'},root);};
  const overlay=(g:SVGGElement,key:string,x:number,y:number,side:'FROM'|'TO'='FROM',axis:readonly[number,number]=[0,1])=>{
    const entry=d.overlay?.entries.get(key);
    if(d.showResults!==false&&['LF','N1','SC'].includes(d.mode??'')&&overview&&g.dataset.semantic==='busbar-section'){const v=labelValues(entry),layer=svg('g',{'data-result-layer':'bus'},g);text(layer,x,y-7,`${d.overlay?.phase==='CHANGE'?'Δ ':''}${d.mode==='SC'?'Ik″':'U'} ${resultNumber(d.mode==='SC'?v.ikssKa:v.voltageKv)} ${d.mode==='SC'?'kA':'kV'}`,9,muted,'end');}
    if(!entry)return;
    g.dataset.resultStatus=entry.status;g.dataset.resultMethod=entry.method;
    const title=g.querySelector('title');if(title)title.textContent+=`\n${entry.status} · ${entry.method}\n`+Object.entries(entry.values).map(([k,v])=>`${k}: ${v??'—'}`).join('\n');
    const direction=sldFlowAtPort(entry,side);
    if(d.showArrows!==false&&direction!==null&&direction!==0){const layer=svg('g',{'data-result-layer':'direction'},g),sign=direction>0?1:-1,vx=axis[0]*sign,vy=axis[1]*sign,cx=x+(g.dataset.semantic?.startsWith('transformer')?-64:g.dataset.reactiveType?-28:24),cy=y-(g.dataset.semantic?.startsWith('transformer')?20:g.dataset.reactiveType?70:62),ex=cx+vx*8,ey=cy+vy*8,change=d.overlay?.phase==='CHANGE';svg('path',{d:`M${cx-vx*8},${cy-vy*8} L${ex},${ey} M${ex-vx*6-vy*6},${ey-vy*6+vx*6} L${ex},${ey} L${ex-vx*6+vy*6},${ey-vy*6-vx*6}`,fill:'none',stroke:normal,'data-flow-side':side,'data-flow-direction':change?(sign>0?'INCREASED_INJECTION':'DECREASED_INJECTION'):sign>0?'LOCAL_OUTBOUND':'LOCAL_INBOUND'},layer);if(change)text(layer,cx+12,cy+3,'Δ',9,normal);}
  };
  for(const p of layout.sections){const b=p.section,current=d.scenario.busOrTerminalStatus[b.id]??(d.scenario.restoredTerminals.includes(b.id)||b.inService),g=group(root,b.id,'ElmTerm',b.name,select,`${b.voltageKv} kV · ${current?'Serviste':'Servis dışı'}`);
    const rail=path(g,[[p.x1,p.y],[p.x2,p.y]],d.selectedId===b.id?'#ffe382':palette(b.voltageKv,current),'',4);rail.dataset.nativeTerminal=b.id;g.dataset.state=current?'IN_SERVICE':'OUT_OF_SERVICE';text(g,b.voltageKv<=40?p.x1-10:24,p.y+(b.voltageKv<=40?-16:4),shorten(b.name,28)+(p.reference?' · devam':''),11,ink,b.voltageKv<=40?'end':'start');svg('rect',{x:p.x2-118,y:p.y-20,width:110,height:14,fill:'none','pointer-events':'none','data-label-reservation':'bus'},g);if(p.reference){g.removeAttribute('data-id');g.dataset.sourceReference=b.id;}else g.dataset.port=b.id;g.dataset.semantic='busbar-section';overlay(g,`ElmTerm|${b.id}`,p.x2-8,p.y+2);
  }
  for(const [id,p]of layout.ports){if(p.semantics==='busbar-section')continue;const term=graph.terminals.find(t=>t.id===id)!,g=group(root,id,'ElmTerm',term.name,select,`${term.vnKv} kV · ${id}`);g.dataset.port=id;g.dataset.semantic=p.semantics;g.dataset.ytbsSlot=p.slot??'';svg('circle',{cx:p.x,cy:p.y,r:3,fill:palette(term.vnKv,term.inService)},g);if(d.technical)text(g,p.x+7,p.y-4,id,8,muted);overlay(g,`ElmTerm|${id}`,p.x,p.y+16);}
  for(const route of layout.routes){const {sw,a,b,x,y}=route,item=equipment.get(`${sw.sourceClass}|${sw.id}`);if(!item)continue;
    if(!a&&!b&&graph.terminals.some(t=>t.id===sw.from)&&graph.terminals.some(t=>t.id===sw.to))continue;
    const known=sw.stateKnown||Object.hasOwn(d.scenario.switchState,sw.id),closed=item.closed??false,state=!item.inService?'OUT_OF_SERVICE':!known?'UNKNOWN':closed?'CLOSED':'OPEN';
    const color=state==='UNKNOWN'?d.settings.colorNoResult:!item.inService?d.settings.colorOut:item.sourceClosed!=null&&item.sourceClosed!==closed?(closed?d.settings.colorScenarioOn:d.settings.colorScenarioOff):palette(graph.terminals.find(t=>t.id===sw.from)?.vnKv??0,closed),g=group(root,sw.id,sw.sourceClass,item.name,select,`${sw.kind} · ${state} · ${sw.from} → ${sw.to}`);
    const decision=sourceGraph.sourceAudit?.switchDrawing?.find(r=>r.switchId===sw.id);g.dataset.switchDrawingClass=decision?.classification??'REVIEW_UNRESOLVED';if(decision){const title=g.querySelector('title');if(title)title.textContent+='\n'+decision.classification+' · '+decision.reason+'\n'+decision.evidence;}g.dataset.deviceKind=sw.kind;g.dataset.sourceUsage=sw.sourceUsage??'';g.dataset.physicalSwitch=`${sw.sourceClass}|${sw.sourceId}`;g.dataset.from=sw.from;g.dataset.to=sw.to;g.dataset.state=state;g.dataset.semantic=sw.from===sw.to?'cubicle-switch':sw.kind;g.dataset.bay=sw.bayId??'';g.dataset.cubicle=sw.cubicleId??'';
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
    for(const port of geo.ports)for(const w of port.wires){const line=path(g,w.points,palette(graph.terminals.find(t=>t.id===port.terminalId)?.vnKv??0,item.inService),style.dash);line.dataset.nativeTerminal=port.terminalId;line.dataset.equipmentContact=port.point.join(',');if(w.bankEntry)line.dataset.bankEntry=JSON.stringify(w.bankEntry);}for(const p of ports)if(p.semantics==='busbar-section')junction(p,color);
    const flowSide:'FROM'|'TO'=e.terminals.indexOf(ports[0].terminalId)===1?'TO':'FROM';let flowAxis:readonly[number,number]=[0,geo.direction];
    if(geo.boundary){g.dataset.boundary='true';g.dataset.hvTerminal=e.terminals[0];g.dataset.lvTerminal=e.terminals[1]??'';
      const kv=geo.ports[0].boundaryKv;svg('path',{d:`M${x-7},${y-geo.direction*7} L${x},${y} L${x+7},${y-geo.direction*7}`,fill:'none',stroke:color,'stroke-width':2},g);text(g,x,y+geo.direction*28,`Diğer gerilim seviyesine devam: ${kv??'—'} kV`,10,ink,'middle');text(g,x,y+geo.direction*43,e.id,9,muted,'middle');
    }else if(e.kind==='transformer'||e.kind==='transformer3w'){
      engineeringSymbol(g,e.autoTransformer?'autotransformer':e.kind==='transformer3w'?'transformer3w':'transformer2w',x,y,color,true,palette(graph.terminals.find(t=>t.id===e.terminals[1])?.vnKv??0,item.inService));g.dataset.transformerType=e.autoTransformer===true?'AUTOTRANSFORMER':e.autoTransformer===false?'TWO_WINDING':'UNVERIFIED_TYPE';g.dataset.hvTerminal=e.terminals[0];g.dataset.lvTerminal=e.terminals[1]??'';g.dataset.windingSourceAudit=JSON.stringify(graph.sourceAudit?.windings.filter(w=>w.transformerId===e.id)??[]);
      const caption=svg('g',{'data-equipment-caption':e.id,'data-fixed-label-cell':'transformer'},g),cx=x,cy=y+36;
      text(caption,cx,cy,shorten(localDeviceName(e.name,d.station.name),26),10,ink,'middle').dataset.labelZone='title';
      const nominal=typeof item.ratingMva==='number'&&Number.isFinite(item.ratingMva)&&item.ratingMva>0?String(Number(item.ratingMva.toFixed(3))):'—';
      text(caption,cx,cy+14,nominal+' MVA',9,muted,'middle').dataset.labelZone='rating';
      svg('rect',{x:x+34,y:y-34,width:130,height:59,fill:'none','pointer-events':'none','data-label-reservation':'transformer'},caption);
      if(d.showResults!==false&&['LF','N1','SC'].includes(d.mode??'')){
       const layer=svg('g',{'data-result-layer':'transformer'},caption),native=e.terminals[0]??'',column=svg('g',{'data-result-port':'HV','data-native-terminal':native},layer);
       caption.dataset.transformerCard=e.id;caption.dataset.readoutStatus=d.overlay?.entries.get(e.sourceClass+'|'+e.id)?.status??d.overlay?.status??'NOT_RUN';
       transformerCardRows(d.overlay,e.sourceClass+'|'+e.id,native).forEach((row,i)=>text(column,x+40,y-21+i*14,row,9,muted));
      }
      if(e.kind==='transformer3w')svg('title',{},caption).textContent='PARTIAL · üç sargılı hesap UNSUPPORTED';flowAxis=[0,1];
    }else if(e.kind==='line'&&ports.length===2){g.dataset.nativeFrom=e.terminals[0];g.dataset.nativeTo=e.terminals[1];flowAxis=[ports[1].x>=ports[0].x?1:-1,0];wrappedText(g,x,y-18,e.name,24,10);
    }else if(e.kind==='line'){
      g.dataset.exitDirection=geo.direction<0?'UP':'DOWN';const remoteId=flowSide==='FROM'?item.toSiteId:item.fromSiteId,remote=d.regionalSites.find(s=>s.id===remoteId);
      svg('path',{d:`M${x},${y-geo.direction*16} L${x},${y} M${x-7},${y-geo.direction*8} L${x},${y} L${x+7},${y-geo.direction*8}`,fill:'none',stroke:color,'stroke-width':2},g);if(!overview){wrappedText(g,x,y+geo.direction*27,remote?.name??e.name,24,10);text(g,x,y+geo.direction*45,e.id,9,muted,'middle');}
    }else if(e.reactiveSymbol){
      const rotation=e.kind==='seriesCompensator'?geo.rotation??0:geo.direction<0?180:0,glyph=svg('g',{transform:`rotate(${rotation} ${x} ${y})`},g);
      engineeringSymbol(glyph,e.reactiveSymbol,x,y,color);g.dataset.reactiveType=e.reactiveSymbol;g.dataset.typeEvidence=e.typeEvidence??'';g.dataset.nativeFrom=e.terminals[0];g.dataset.nativeTo=e.terminals[1]??'';g.dataset.sourceContacts=JSON.stringify(geo.ports.map(p=>({terminal:p.terminalId,side:p.side,point:p.point})));g.dataset.calculationSupport=e.diagramOnly?'UNSUPPORTED':'CANONICAL';
      const caption=svg('g',{'data-equipment-caption':e.id,'data-fixed-label-cell':'reactive'},g);text(caption,x+30,y-5,shorten(localDeviceName(e.name,d.station.name),22),10);text(caption,x+30,y+12,({'shunt-reactor':'Şönt reaktör','capacitor-bank':'Kapasitör bataryası','series-reactor':'Seri reaktör','series-capacitor':'Seri kapasitör','reactive-equivalent':'Reaktif eleman · tür doğrulanamadı'} as const)[e.reactiveSymbol],9,muted);
      if(e.diagramOnly)text(caption,x+30,y+27,'Hesap modeli desteklenmiyor',9,muted);
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
    const actual=layout.equipment.filter(e=>f.feeder.equipmentKeys.includes(e.equipment.sourceClass+'|'+e.equipment.id));if(actual.some(e=>['line','transformer','transformer3w','shunt','seriesCompensator'].includes(e.equipment.kind)))continue;
    const sign=p.direction===-1?-1:1,x=p.x,y=layout.compartments.get(f.feeder.id)?.outletY??p.y+sign*38,last=main?.switchIds.at(-1),g=svg('g',{'data-feeder-exit':f.feeder.id,'data-native-terminal':end!,'data-state-source':last??'UNKNOWN','data-exit-direction':sign<0?'UP':'DOWN'},root),conductor=[...root.querySelectorAll<SVGPathElement>('path[data-native-terminal]')].find(path=>path.dataset.nativeTerminal===end&&path.closest('[data-id]')?.getAttribute('data-id')===last),color=conductor?.getAttribute('stroke')??d.settings.colorNoResult;svg('title',{},g).textContent=`Ok rengi kaynak ana devre iletkenini izler: ${last??'UNKNOWN'}. Alternatif besleme nedeniyle enerji var/yok çıkarımı yapılmaz.`;
    path(g,[[x,p.y],[x,y]],color);svg('path',{d:`M${x-7},${y-sign*8} L${x},${y} L${x+7},${y-sign*8}`,stroke:color,'stroke-width':2,fill:'none'},g);
  }
  // Preserve a real exported leaf even when no equipment cubicle attaches to
  // it. In particular, never move a winding onto a bank DS merely because its
  // cubicle name resembles that winding's name.
  let sourceLeafIndex=0;const mainEnds=new Set(graph.feeders.map(f=>feederDrawingPath(graph,f)?.terminals.at(-1)));for(const [id,p]of layout.ports){if(p.semantics==='busbar-section'||mainEnds.has(id)||graph.equipment.some(e=>e.terminals.includes(id))||graph.switches.filter(s=>s.from!==s.to&&(s.from===id||s.to===id)).length!==1)continue;const audit=graph.sourceAudit?.leaves.find(l=>l.terminalId===id),note=svg('g',{'data-source-leaf-caption':id,'data-source-classification':audit?.classification??'INSUFFICIENT_SOURCE','data-source-leaf-status':audit?.status??'UNKNOWN',role:'button',tabindex:0,'aria-label':`${id} · ${audit?.status==='SOURCE_LEAF_VERIFIED'?'Doğrulanmış kaynak yaprağı':'Kaynak ucu doğrulanamadı'}`},root);note.onclick=()=>select(id,'ElmTerm');note.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(id,'ElmTerm');}};svg('title',{},note).textContent=`${audit?.status??'UNKNOWN'} · ${id}\n${audit?.evidence??'Ham DGS kanıtı yok; saha bağlantısı hakkında karar verilmez.'}\nSargı bağlantısı türetilmedi. Kaynak ve kalite panelini açmak için seçin.`;note.dataset.sourceLeafIndex=String(++sourceLeafIndex);svg('rect',{x:p.x-6,y:p.y-6,width:32,height:24,fill:'transparent','pointer-events':'all'},note);text(note,p.x+8,p.y+13,`ⓘ${sourceLeafIndex}${audit?.status==='SOURCE_LEAF_VERIFIED'?'':'?'}`,9,muted);}
  for(const slot of layout.slots){const p=layout.feeders.find(p=>p.feeder.id===slot.feeder.id)!;
    if(overview){const f=p.feeder,cls=f.sourceClass,id=cls==='ElmBay'?f.id:f.id.slice(f.id.indexOf('|')+1),keys=[...f.switchIds.map(id=>{const s=graph.switches.find(s=>s.id===id)!;return s.sourceClass+'|'+s.sourceId;}),...f.equipmentKeys],g=group(root,id,cls,f.name,()=>d.onFocusFeeder?d.onFocusFeeder(f.id):select(id,cls),`${slot.typeName??slot.role} · ${slot.typeStatus??'SOURCE_GRAPH'} · ${slot.slot}\nNative cihazlar: ${keys.join(',')}`);g.dataset.feederMarker=f.id;g.setAttribute('aria-pressed',String(d.selectedId===id));g.dataset.representedKeys=keys.join(';');g.dataset.ytbsSlot=slot.slot;g.dataset.ytbsSide=slot.side??'N';
      const name=feederCaption(f.name,d.station.name,f.voltageKv),nameLines=captionLines(name,f.voltageKv<=36?17:24),flowOffset=33,labelHeight=51,hiddenCaption=f.equipmentKeys.some(k=>graph.equipment.some(e=>k===e.sourceClass+'|'+e.id&&['transformer','transformer3w'].includes(e.kind)))||f.equipmentKeys.some(k=>graph.equipment.some(e=>k===e.sourceClass+'|'+e.id&&e.reactiveSymbol))&&!f.equipmentKeys.some(k=>graph.equipment.some(e=>k===e.sourceClass+'|'+e.id&&e.kind==='line'));
      const cell=layout.compartments.get(f.id),lx=p.x,ly=p.y,expanded=['N1','SC'].includes(d.mode??'');
      g.dataset.fixedLabelCell='feeder';g.dataset.labelAxis=String(lx);g.dataset.labelBand=String(ly);if(!f.terminalIds.length&&!f.switchIds.length&&!f.equipmentKeys.length){g.dataset.sourceOnly='true';g.querySelector('title')!.textContent+='\nÇizilebilir kaynak teçhizat/terminal yok. Ham kayıt ve gizleme kanıtları kalite panelindedir.';}
      if(cell){g.dataset.compartment=[cell.x1,cell.y1,cell.x2,cell.y2].join(',');g.dataset.packingUnits=String(cell.units);g.dataset.drawingSide=cell.direction<0?'UP':'DOWN';g.dataset.modelFeeder=String(cell.model);g.dataset.labelZones='title,flow,equipment';}
      if(!hiddenCaption)nameLines.forEach((line,i)=>{text(g,lx,ly+i*14,line,10,ink,'middle').dataset.labelZone='title';});else g.dataset.captionSuppressed='WINDING_HELPER';
      svg('rect',{x:lx-(expanded?85:45),y:ly+5,width:expanded?170:90,height:hiddenCaption?18:expanded?122:labelHeight,fill:'transparent','pointer-events':'all','data-label-reservation':'feeder'},g);
      const readout=feederReadout(graph,f,d.overlay),resultKey=readout.key,entry=readout.entry,end=readout.terminal,terminalEntry=d.overlay?.entries.get('ElmTerm|'+end),side=readout.side,transformerSummary=f.equipmentKeys.some(k=>layout.equipment.some(e=>k===e.equipment.sourceClass+'|'+e.equipment.id&&!e.boundary&&['transformer','transformer3w'].includes(e.equipment.kind)));g.dataset.resultMappingReason=readout.reason;g.dataset.resultKey=resultKey??'';
      if(!hiddenCaption&&d.showResults!==false&&['LF','N1','SC'].includes(d.mode??'')&&!(d.mode==='LF'&&transformerSummary)){
        const layer=svg('g',{'data-result-layer':'feeder'},g),rows=d.mode==='LF'?readout.rows:portResultRows(d.overlay,resultKey,end);if(d.mode==='SC')rows.push(`Ik″: ${resultNumber(labelValues(terminalEntry).ikssKa)} kA`);
        rows.forEach((line,i)=>{text(layer,lx,ly+(d.mode==='LF'?flowOffset:56)+i*16,line,9,entry?.alarm?'#b93831':muted,'middle').dataset.labelZone='flow';});g.dataset.readoutStatus=(entry??terminalEntry)?.status??d.overlay?.status??'NOT_RUN';if(entry||terminalEntry)g.dataset.resultStatus=(entry??terminalEntry)!.status;g.dataset.flowSide=side.toUpperCase();g.dataset.resultTerminal=end;
      }
      if(d.technical)text(g,lx,ly-15,f.id.replace(/^[^|]+\|/,''),9,muted,'middle').dataset.labelZone='equipment';

    }else if(d.technical)text(root,p.x,p.busYs.length?(slot.side==='A'?Math.min(...p.busYs)-22:Math.max(...p.busYs)+22):p.y,slot.side?`${slot.slot}${slot.block?' · blok '+(slot.block+1):''}`:slot.slot,9,muted,'middle');
  }
  const sourceOnlyMarkers=[...root.querySelectorAll<SVGGElement>('[data-source-only]')];if(sourceOnlyMarkers.length)text(root,160,Math.min(...sourceOnlyMarkers.map(g=>Number(g.dataset.labelBand)))-34,'Kaynak fider kayıtları · çizilebilir teçhizat yok',11,muted);
  for(const p of layout.feeders){const issues=graph.issues.filter(i=>i.sourceId===p.feeder.id);if(!issues.length)continue;const g=group(root,p.feeder.id,p.feeder.sourceClass,p.feeder.name,select,issues.map(i=>i.reason).join('\n'));g.dataset.unresolved='true';const marker=[...root.querySelectorAll<SVGGElement>('[data-feeder-marker]')].find(m=>m.dataset.feederMarker===p.feeder.id);if(marker){marker.dataset.unresolved='true';marker.querySelector('title')!.textContent+='\nPARTIAL · '+issues.map(i=>i.reason).join('\n');}}
  const decisions=sourceGraph.sourceAudit?.switchDrawing??[],hidden=decisions.filter(r=>r.classification==='HIDE_NONFUNCTIONAL_SOURCE_LEAF'),review=decisions.filter(r=>r.classification==='REVIEW_UNRESOLVED');root.dataset.hiddenSourceSwitchCount=String(hidden.length);root.dataset.switchDrawingStatus=review.length||sourceGraph.counters.diagramUnresolvedTotal?'PARTIAL':'VERIFIED';
  const visibleLeaves=[...root.querySelectorAll<SVGGElement>('[data-source-leaf-caption]')],verifiedLeaves=visibleLeaves.filter(g=>g.dataset.sourceLeafStatus==='SOURCE_LEAF_VERIFIED').length;root.dataset.sourceLeafCount=String(visibleLeaves.length);root.dataset.sourceLeafVerified=String(verifiedLeaves);root.dataset.sourceParity=root.dataset.sourceAvailability==='NO_SOURCE_TOPOLOGY'?'NO_SOURCE_TOPOLOGY':graph.sourceAudit?.status??'PARTIAL';
  const summary=stationSummary(sourceGraph,graph,root.querySelectorAll('[data-physical-switch],[data-equipment-center]').length),footerTop=root.viewBox.baseVal.height,footer=svg('g',{'data-station-summary':'true','data-summary-top':footerTop,'pointer-events':'none'},root),right=Math.max(330,root.viewBox.baseVal.width/2);
  root.setAttribute('viewBox',`0 0 ${root.viewBox.baseVal.width} ${footerTop+118}`);
  svg('rect',{x:20,y:footerTop,width:root.viewBox.baseVal.width-40,height:100,fill:'none',stroke:'#9aa7ae','stroke-width':0.7},footer);
  text(footer,28,footerTop+16,shorten(d.station.name,45)+' · '+(d.scenarioLabel??'Seçili senaryo'),10);
  const status=d.overlay?.status??'NOT_RUN',solution=!['LF','N1','SC'].includes(d.mode??'')?'Sonuç katmanı kapalı':status.startsWith('CONVERGED')?'Yakınsadı · kontrol desteği kısmi':status.startsWith('STALE')?'Güncel değil (STALE)':status.startsWith('NOT_RUN')?'Hesaplanmadı (NOT_RUN)':status;
  text(footer,28,footerTop+32,`Çözüm: ${shorten(solution,90)}${['LF','N1','SC'].includes(d.mode??'')?' · '+d.mode:''}`,9,muted);svg('title',{},footer).textContent=`${status} · ${d.overlay?.method??'NOT_RUN'} · ${d.overlay?.phase??''}\n${JSON.stringify(summary)}`;
  const leftRows=[`Bara: ${summary.bars} · Fider: ${summary.feeders}`,`Kesici: ${summary.breakers} · Ayırıcı: ${summary.disconnectors}`,`Reaktör: ${summary.reactors} · Kapasitör: ${summary.capacitors}`,`Başarıyla çizilen cihaz: ${summary.drawn}`],rightRows=[`Trafo: ${summary.transformers} · Ototrafo: ${summary.auto}`,`Diğer anahtar: ${summary.otherSwitches} · Diğer teçhizat: ${summary.otherEquipment}`,`Gizli işlevsiz kaynak kolu: ${summary.hidden}`,`Çizilemeyen: ${summary.missing} · Kaynak belirsizliği: ${summary.uncertain}`];
  leftRows.forEach((row,i)=>text(footer,28,footerTop+48+i*14,row,9,muted));rightRows.forEach((row,i)=>text(footer,right,footerTop+48+i*14,row,9,muted));
  for(const frame of root.querySelectorAll<SVGRectElement>('[data-station-frame]')){const inset=Number(frame.getAttribute('x'));frame.setAttribute('width',String(root.viewBox.baseVal.width-inset*2));frame.setAttribute('height',String(root.viewBox.baseVal.height-inset*2));}
  const lines=[...root.querySelectorAll<SVGPathElement>('path[data-connection][data-native-terminal]')],conductors=lines.map(line=>({terminalId:line.dataset.nativeTerminal!,points:[...line.getAttribute('d')!.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map(m=>[Number(m[1]),Number(m[2])] as const)}));
  const referenceRails=layout.sections.map(s=>({id:s.section.id,x1:s.x1,x2:s.x2,y:s.y}));
  const passes=new Map<number,ReturnType<typeof railPassPath>['passes']>();
  for(const [i,c]of conductors.entries()){
    const result=railPassPath(c.points,c.terminalId,referenceRails);if(!result.passes.length)continue;
    // Keep owner and source-terminal provenance alongside the full centerline.
    const line=lines[i];line.dataset.sourceConductor=line.getAttribute('d')!;line.dataset.railPasses=JSON.stringify(result.passes);line.setAttribute('d',result.d);passes.set(i,result.passes);
  }
  {const ledger:OwnedSegment[]=[],sharedLines=new Map<OwnedSegment,SVGPathElement>();
    for(const line of lines){
      const full=line.dataset.sourceConductor??line.getAttribute('d')!,owner=line.closest('[data-id]')?.getAttribute('data-id')??'',commands:string[]=[],references:OwnedSegment[]=[];let previous:Point|null=null;
      for(const m of line.getAttribute('d')!.matchAll(/([ML])([\d.-]+),([\d.-]+)/g)){const p:Point=[+m[2],+m[3]];if(m[1]==='L'&&previous){const claim=claimConductor(previous,p,line.dataset.nativeTerminal!,owner,ledger);for(const s of claim.fresh){commands.push(`M${s.a.join(',')} L${s.b.join(',')}`);sharedLines.set(s,line);}references.push(...claim.shared);}previous=p;}
      if(references.length){line.dataset.sourceConductor=full;line.dataset.sharedConductors=JSON.stringify(references.map(s=>({terminal:s.terminalId,a:s.a,b:s.b,owner:s.owners[0]})));}
      line.setAttribute('d',commands.join(' '));
    }
    for(const [s,line]of sharedLines)if(s.owners.length>1)line.dataset.conductorOwners=[...new Set([...(line.dataset.conductorOwners??'').split(';').filter(Boolean),...s.owners])].join(';');
  }
  const visibleCrossingSet=new Set(visibleCrossings(lines.map(line=>({d:line.getAttribute('d')!,terminalId:line.dataset.nativeTerminal!}))).map(c=>c.x+','+c.y));
  for(const jump of wireCrossings(conductors).filter(c=>visibleCrossingSet.has(c.x+','+c.y))){const {x,y,vertical}=jump,line=lines[jump.wire],g=svg('g',{'data-hop-over':'true','data-crossing-at':`${x},${y}`,'data-crossing-purpose':'VISIBLE_FOREIGN_CONDUCTORS','data-terminal-a':conductors[jump.wire].terminalId,'data-terminal-b':conductors[jump.other].terminalId,'pointer-events':'none'},root);
    // A foreign rail crossing is already physically separated in the visible path.
    // Do not add a second bridge glyph over that explicit local passage.
    if([jump.wire,jump.other].some(i=>passes.get(i)?.some(p=>p.x===x&&p.y===y))){g.remove();continue;}
    svg('path',{d:vertical?`M${x},${y-7} L${x},${y+7}`:`M${x-7},${y} L${x+7},${y}`,stroke:overview?'#fff':'#102033','stroke-width':6,fill:'none'},g);
    svg('path',{d:vertical?`M${x},${y-7} C${x+10},${y-7} ${x+10},${y+7} ${x},${y+7}`:`M${x-7},${y} C${x-7},${y-10} ${x+7},${y-10} ${x+7},${y}`,stroke:line.getAttribute('stroke')!,fill:'none','stroke-width':2},g);
  }
}

export class SvgSldRenderer {
  private root:SVGSVGElement|null=null;private fitBox=[0,0,1200,600];private key='';
  zoom(factor:number){if(!this.root)return;const[x,y,w,h]=this.box(),nextW=Math.max(this.fitBox[2]/12,Math.min(this.fitBox[2]*2,w/factor)),nextH=nextW*h/w;this.root.setAttribute('viewBox',[x+(w-nextW)/2,y+(h-nextH)/2,nextW,nextH].join(' '));}
  exportSvg():string|null{return this.root?new XMLSerializer().serializeToString(fullDiagramClone(this.root,this.fitBox)):null;}
  focusFeeder(id:string):void {
    const root=this.root,marker=[...root?.querySelectorAll<SVGGElement>('[data-feeder-marker]')??[]].find(g=>g.dataset.feederMarker===id);if(!root||!marker)return;
    const keys=new Set((marker.dataset.representedKeys??'').split(';')),groups=[marker,...[...root.querySelectorAll<SVGGElement>('g[data-id][data-class]')].filter(g=>keys.has(g.dataset.class+'|'+g.dataset.id))];
    const inverse=root.getScreenCTM()!.inverse(),points=groups.flatMap(g=>{const b=g.getBBox(),m=inverse.multiply(g.getScreenCTM()!);return [[b.x,b.y],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));});
    const left=Math.min(...points.map(p=>p.x))-40,top=Math.min(...points.map(p=>p.y))-40,width=Math.max(320,Math.max(...points.map(p=>p.x))-left+40),height=Math.max(220,Math.max(...points.map(p=>p.y))-top+40);
    root.dataset.viewportMode='focus';root.dataset.focusedFeeder=id;root.style.minWidth='';root.style.height=root.dataset.viewportHeight+'px';root.parentElement!.scrollTop=0;root.setAttribute('viewBox',[left,top,width,height].join(' '));marker.focus();
  }
  fit(){if(!this.root)return;this.root.dataset.viewportMode='fit';this.root.setAttribute('viewBox',this.fitBox.join(' '));this.root.style.minWidth='';this.root.style.height=this.root.dataset.viewportHeight+'px';this.root.parentElement!.scrollTop=0;}
  readable(){if(!this.root)return;this.root.dataset.viewportMode='readable';const host=this.root.parentElement!,width=this.root.dataset.paper==='true'?Math.max(this.fitBox[2],host.clientWidth):host.clientWidth;this.root.style.minWidth=width>host.clientWidth?width+'px':'';this.root.setAttribute('viewBox',this.fitBox.join(' '));this.root.style.height=Math.max(Number(this.root.dataset.viewportHeight),this.fitBox[3]*width/this.fitBox[2])+'px';host.scrollTop=0;}
  focus(id:string,sourceClass:string){if(this.root)this.root.dataset.viewportMode='focus';if(this.root?.dataset.paper==='true'){this.root.style.height=this.root.dataset.viewportHeight+'px';this.root.style.minWidth='';this.root.parentElement!.scrollTop=0;}const g=[...this.root?.querySelectorAll<SVGGElement>('g[data-id][data-class]')??[]].find(g=>g.dataset.id===id&&g.dataset.class===sourceClass);if(!g)return;g.focus();const b=g.getBBox(),matrix=this.root!.getScreenCTM()!.inverse().multiply(g.getScreenCTM()!),corners=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix)),left=Math.min(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),width=Math.max(...corners.map(p=>p.x))-left,height=Math.max(...corners.map(p=>p.y))-top,w=Math.max(320,width+80),h=Math.max(220,height+80);this.root!.setAttribute('viewBox',[left+width/2-w/2,top+height/2-h/2,w,h].join(' '));}
  private box(){return this.root!.getAttribute('viewBox')!.split(' ').map(Number);}
  render(host:HTMLElement,d:SldDiagram,select:Select):void {
    const previousMode=this.root?.dataset.viewportMode??'fit',previousFeeder=this.root?.dataset.focusedFeeder,previousScroll=host.scrollTop,previousLeft=host.scrollLeft;const key=[d.station.id,[...d.voltageBands].join(',')].join('|'),previous=this.root&&key===this.key?this.box():null;this.key=key;
    const root=svg('svg',{xmlns:NS,viewBox:'0 0 1240 600',width:'100%',height:540,role:'img','aria-label':`${d.station.name} TM genel tek hat şeması`,class:'ga-sld-svg',preserveAspectRatio:'xMidYMid meet'});
    const available=Math.max(160,(host.parentElement?.classList.contains('ga-sld-canvas')?host.parentElement.clientHeight:host.clientHeight)||innerHeight-Math.max(0,host.getBoundingClientRect().top)-24);d.overviewSize={width:Math.max(360,host.clientWidth||1200),height:available};
    root.style.background='#102033';root.style.touchAction='none';root.style.display='block';root.style.width='100%';root.style.height=available+'px';
    const oldFit=this.fitBox;host.replaceChildren(root);this.root=root;station(root,d,select);applyN1Overlay(root,d);this.fitBox=this.box();if(previous&&oldFit[2]===this.fitBox[2]&&oldFit[3]===this.fitBox[3])root.setAttribute('viewBox',previous.join(' '));
    root.dataset.viewportWidth=String(host.clientWidth);root.dataset.viewportHeight=String(available);host.style.maxHeight='';host.style.overflow='auto';host.style.display='block';
    root.dataset.viewportMode=previous?previousMode:'fit';
    if(previous&&previousMode==='focus'&&previousFeeder&&d.graph?.feeders.some(f=>f.id===previousFeeder))root.dataset.focusedFeeder=previousFeeder;
    if(root.dataset.paper==='true'&&previous&&previousMode==='readable')this.readable();else {root.style.minWidth='';root.style.height=available+'px';}
    if(previous&&oldFit[2]===this.fitBox[2]&&oldFit[3]===this.fitBox[3]){root.setAttribute('viewBox',previous.join(' '));host.scrollTop=previousScroll;host.scrollLeft=previousLeft;}
    let drag:{x:number;y:number;box:number[]}|null=null,moved=false;
    root.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,box:this.box()};moved=false;};
    root.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4){moved=true;root.setPointerCapture(e.pointerId);}if(!moved)return;const r=root.getBoundingClientRect(),scale=Math.min(r.width/drag.box[2],r.height/drag.box[3]);root.setAttribute('viewBox',[drag.box[0]-dx/scale,drag.box[1]-dy/scale,drag.box[2],drag.box[3]].join(' '));};
    root.onpointerup=e=>{drag=null;if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);};root.onpointercancel=()=>{drag=null;};root.addEventListener('click',e=>{if(moved){e.stopImmediatePropagation();moved=false;}},true);
    root.onwheel=e=>{e.preventDefault();this.zoom(e.deltaY<0?1.15:1/1.15);};
  }
}
