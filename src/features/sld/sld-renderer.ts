import type { Bus, Site } from '../../domain/model/network';
import type { CatalogRow } from '../../app/contracts';
import { layoutStation, feederSwitchPaths, stationTerminalLinks, type StationTopologyGraph } from '../../domain/model/station-topology';
import type { VoltageBand } from '../../domain/model/voltage-band';
import type { ScenarioOverlay } from '../../domain/scenario/overlay';
import type { Settings } from '../../persistence/settings';
export type SldScope='station'|'bay'|'regional';
export interface SldEquipment { id:string;name:string;sourceClass:string;busIds:readonly string[];siteIds:readonly string[];inService:boolean;sourceInService?:boolean;closed?:boolean;sourceClosed?:boolean;fromSiteId?:string;toSiteId?:string;voltageKv?:number;lvKv?:number;ratingMva?:number }
export interface SldBusGroup {id:string;name:string;buses:readonly Bus[]}
export interface SldTerminal {id:string;name:string;bayId:string;external:boolean;equipment:readonly SldEquipment[]}
export interface SldSwitch {id:string;name:string;sourceClass:'ElmCoup'|'StaSwitch';kind:'breaker'|'isolator'|'other';from:string|null;to:string|null;modelClosed:boolean;closed:boolean;inService:boolean}
export interface SldRegionalBranch extends SldEquipment {fromSiteId:string;toSiteId:string}
export interface SldDiagram {
  scope:SldScope;orientation:'horizontal'|'vertical';station:Site;selectedId:string|null;groups:readonly SldBusGroup[];equipment:readonly SldEquipment[];
  bays:readonly CatalogRow[];selectedBay:CatalogRow|null;terminals:readonly SldTerminal[];switches:readonly SldSwitch[];
  regionalSites:readonly Site[];regionalBranches:readonly SldRegionalBranch[];unresolvedSwitches:number;
  graph:StationTopologyGraph|null;voltageBands:ReadonlySet<VoltageBand>;page:number;technical:boolean;scenario:ScenarioOverlay;settings:Settings;
}
type Select=(id:string,sourceClass:string)=>void;
const NS='http://www.w3.org/2000/svg',ink='#e0edf2',muted='#9bb3c1',normal='#90d4df';
function svg<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>,parent?:SVGElement):SVGElementTagNameMap[K]{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent?.append(n);return n;}
function text(parent:SVGElement,x:number,y:number,label:string,size=12,color=ink,anchor='start'){const n=svg('text',{x,y,fill:color,'font-size':size,'font-family':'system-ui, sans-serif','text-anchor':anchor},parent);n.textContent=label;return n;}
const shorten=(s:string,n=23)=>s.length>n?s.slice(0,n-1)+'…':s;
function group(parent:SVGElement,id:string,cls:string,name:string,select:Select,detail=''){const g=svg('g',{'data-id':id,'data-class':cls,role:'button',tabindex:0,'aria-label':name},parent);svg('title',{},g).textContent=`${name}\n${cls} · ${id}${detail?'\n'+detail:''}`;g.onclick=()=>select(id,cls);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(id,cls);}};return g;}
function stateStyle(d:SldDiagram,source:boolean,current:boolean){return {color:source!==current?(current?d.settings.colorScenarioOn:d.settings.colorScenarioOff):current?normal:d.settings.colorOut,dash:current?'':'6 4'};}
function equipmentState(d:SldDiagram,item:SldEquipment){return stateStyle(d,item.sourceInService??item.inService,item.inService);}
function path(parent:SVGElement,points:readonly (readonly[number,number])[],color:string,dash='',width=2){return svg('path',{d:points.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':dash,'data-connection':'orthogonal'},parent);}
function symbol(parent:SVGElement,x:number,y:number,cls:string,color:string,closed=true,kind='breaker'){
  if(cls==='ElmTr2'){svg('circle',{cx:x,cy:y-6,r:10,stroke:color,fill:'#102033','stroke-width':2},parent);svg('circle',{cx:x,cy:y+6,r:10,stroke:color,fill:'none','stroke-width':2},parent);}
  else if(cls==='ElmCoup'||cls==='StaSwitch'){
    if(kind==='isolator'){svg('rect',{x:x-9,y:y-12,width:18,height:24,fill:'#102033'},parent);path(parent,[[x,y+10],[closed?x:x+9,y-10]],color);svg('circle',{cx:x,cy:y-11,r:2,fill:color},parent);svg('circle',{cx:x,cy:y+11,r:2,fill:color},parent);}
    else svg('rect',{x:x-7,y:y-8,width:14,height:16,fill:closed?color:'#102033',stroke:color,'stroke-width':2},parent);
  }
  else if(cls==='ElmLne'){svg('path',{d:`M${x},${y-16} L${x},${y} M${x-6},${y-6} L${x},${y} L${x+6},${y-6}`,fill:'none',stroke:color,'stroke-width':2},parent);}
  else{svg('circle',{cx:x,cy:y,r:12,stroke:color,fill:'#102033','stroke-width':2},parent);text(parent,x,y+4,cls==='ElmLod'?'Y':cls==='ElmShnt'?'Ş':'G',11,color,'middle');}
}
function wrappedText(parent:SVGElement,x:number,y:number,label:string,limit=18,size=10,color=ink){
  const words=label.split(/\s+/);let first='';while(words.length&&(!first||first.length+words[0].length+1<=limit)){first+=(first?' ':'')+words.shift();}
  text(parent,x,y,shorten(first,limit),size,color,'middle');if(words.length)text(parent,x,y+14,shorten(words.join(' '),limit),size,color,'middle');
}
export function fullDiagramClone(root:SVGSVGElement,fitBox:readonly number[]):SVGSVGElement {
  const clone=root.cloneNode(true) as SVGSVGElement;clone.setAttribute('viewBox',fitBox.join(' '));clone.setAttribute('width',String(fitBox[2]));clone.setAttribute('height',String(fitBox[3]));clone.style.width=fitBox[2]+'px';clone.style.height=fitBox[3]+'px';return clone;
}
function station(root:SVGSVGElement,d:SldDiagram,select:Select):void {
  if(!d.graph)return;const layout=layoutStation(d.graph,d.voltageBands,d.page),graph=d.graph;root.setAttribute('viewBox',`0 0 ${layout.width} ${layout.height}`);
  text(root,24,30,d.station.name,21);text(root,24,52,`TM genel · ${graph.busSections.length} bara bölümü · ${graph.sourceFeederCount} kaynak fider · kaynak anahtar bağlantıları`,12,muted);
  const positions=new Map(layout.sections.map(p=>[p.section.id,p]));
  for(const level of layout.levels)text(root,24,level.y,`${level.kv||'—'} kV`,17,'#f1cf8a');
  for(const p of layout.sections){const b=p.section,current=d.scenario.busOrTerminalStatus[b.id]??(d.scenario.restoredTerminals.includes(b.id)||b.inService),style=stateStyle(d,b.inService,current),g=group(root,b.id,'ElmTerm',b.name,select,`${b.voltageKv} kV · ${current?'Serviste':'Servis dışı'}`);
    text(g,24,p.y+4,shorten(b.name,26),11);path(g,[[p.x1,p.y],[p.x2,p.y]],d.selectedId===b.id?'#ffe382':style.color,style.dash,4);
    if(d.technical)text(g,p.x2,p.y-7,b.id,9,muted,'end');
  }
  const eq=new Map(d.equipment.map(e=>[`${e.sourceClass}|${e.id}`,e]));
  const terminalLinks=stationTerminalLinks(graph,layout),linkedFeeders=new Set(terminalLinks.flatMap(link=>link.points.map(p=>p.feederId)));
  for(const {terminal,points}of terminalLinks){const current=d.scenario.busOrTerminalStatus[terminal.id]??(d.scenario.restoredTerminals.includes(terminal.id)||terminal.inService),style=stateStyle(d,terminal.inService,current),g=group(root,terminal.id,'ElmTerm',terminal.name,select,'Kaynakta ortak terminal'),y=Math.min(...points.map(p=>p.y))-18;
    path(g,[[Math.min(...points.map(p=>p.x)),y],[Math.max(...points.map(p=>p.x)),y]],style.color,style.dash);
    for(const p of points){path(g,[[p.x,y],[p.x,p.y-12]],style.color,style.dash);svg('circle',{cx:p.x,cy:y,r:2,fill:style.color},g);}
  }
  const switchById=new Map(graph.switches.map(sw=>[sw.id,sw]));
  const drawSwitch=(parent:SVGElement,id:string,x:number,y:number)=>{const sw=switchById.get(id),item=d.equipment.find(e=>e.id===id);if(!sw||!item)return;const closed=item.closed??false,style=stateStyle(d,(item.sourceClosed??closed)&&(item.sourceInService??true),closed&&item.inService),g=group(parent,id,item.sourceClass,item.name,select,`${sw.kind} · ${closed?'Kapalı':'Açık'}`);symbol(g,x,y,item.sourceClass,style.color,closed,sw.kind);};
  const equipmentPositions=new Map<string,{x:number;y:number;feederId:string}[]>();
  for(const p of layout.feeders){const f=p.feeder,entity=f.equipmentKeys.map(k=>eq.get(k)).find(Boolean),identity=f.sourceClass==='ElmBay'?f.id:entity?.id||f.id;
    const g=group(root,identity,f.sourceClass,f.name,select,`${f.terminalIds.length} terminal · ${f.switchIds.length} anahtar · ${f.equipmentKeys.length} ekipman`),style=entity?equipmentState(d,entity):{color:normal,dash:''};
    g.setAttribute('data-feeder',f.id);
    const connections=feederSwitchPaths(graph,f).filter(c=>positions.has(c.busId));
    // StaSwitch belongs to the equipment cubicle (canonical from===to), not a new bus edge.
    const cubicleSwitches=f.switchIds.filter(id=>{const sw=switchById.get(id);return sw&&sw.from===sw.to&&entity?.busIds.includes(sw.from);});
    let common:string[]=[];
    if(connections.length){common=[...connections[0].switchIds];for(const connection of connections.slice(1)){let count=0;while(count<common.length&&count<connection.switchIds.length&&common[common.length-1-count]===connection.switchIds[connection.switchIds.length-1-count])count++;common=count?common.slice(-count):[];}}
    const barBottom=Math.max(0,...layout.sections.filter(b=>b.section.voltageKv===f.voltageKv).map(b=>b.y)),junction=barBottom+45+(p.y-barBottom-65)*.5;
    const directPorts=entity&&f.sourceClass!=='ElmBay'&&entity.busIds.filter(id=>positions.has(id)).length===2?entity.busIds:[];
    for(const[c,connection]of (directPorts.length?[]:connections).entries()){const bus=positions.get(connection.busId)!,x=p.x+(c-(connections.length-1)/2)*32,branch=connection.switchIds.slice(0,connection.switchIds.length-common.length);
      path(g,[[x,bus.y],[x,junction],[p.x,junction]],style.color,style.dash);svg('circle',{cx:x,cy:bus.y,r:3,fill:style.color},g);
      branch.forEach((id,i)=>drawSwitch(g,id,x,barBottom+25+(i+.5)*(junction-barBottom-30)/Math.max(1,branch.length)));
    }
    if(directPorts.length){directPorts.forEach((id,i)=>{const bus=positions.get(id);if(!bus)return;const x=p.x+(i?35:0),y=p.y+(i?15:-15);path(g,[[x,bus.y],[x,y],[p.x,y]],style.color,style.dash);svg('circle',{cx:x,cy:bus.y,r:3,fill:style.color},g);});}
    else if(connections.length){path(g,[[p.x,junction],[p.x,p.y-13]],style.color,style.dash);const chain=[...common,...cubicleSwitches];chain.forEach((id,i)=>drawSwitch(g,id,p.x,junction+(i+.5)*(p.y-junction-20)/Math.max(1,chain.length)));}
    else if(!linkedFeeders.has(f.id))text(g,p.x,p.y-25,'Uç belirsiz',9,muted,'middle');
    if(!entity||entity.sourceClass==='ElmTr2')svg('circle',{cx:p.x,cy:p.y,r:4,fill:style.color},g);else symbol(g,p.x,p.y,entity.sourceClass,style.color);
    const label=entity&&entity.sourceClass!=='ElmTr2'?entity.name:f.name;wrappedText(g,p.x,p.y+28,label);
    if(d.technical)text(g,p.x,p.y+59,identity,8,muted,'middle');
    for(const key of f.equipmentKeys)equipmentPositions.set(key,[...(equipmentPositions.get(key)||[]),{x:p.x,y:p.y,feederId:f.id}]);
  }
  let bridge=0;
  for(const e of graph.equipment.filter(e=>e.kind==='transformer')){
    const key=`${e.sourceClass}|${e.id}`,lanes=equipmentPositions.get(key)||[],item=eq.get(key);if(!item||!lanes.length)continue;
    const style=equipmentState(d,item),first=lanes[0],last=lanes[lanes.length-1];
    if(first===last){const g=group(root,e.id,e.sourceClass,e.name,select);symbol(g,first.x,first.y,'ElmTr2',style.color);continue;}
    const x=Math.max(...layout.sections.map(p=>p.x2))+70+bridge++*160,mid=(first.y+last.y)/2,g=group(root,e.id,e.sourceClass,e.name,select);
    path(g,[[first.x,first.y],[x,first.y],[x,last.y],[last.x,last.y]],style.color,style.dash);symbol(g,x,mid,'ElmTr2',style.color);wrappedText(g,x,mid+33,e.name,20);
    const rating=[item.voltageKv&&item.lvKv?`${item.voltageKv} / ${item.lvKv} kV`:'',item.ratingMva?`${item.ratingMva} MVA`:''].filter(Boolean).join(' · ');if(rating)wrappedText(g,x,mid+65,rating,22,9,muted);
    if(d.technical)text(g,x,mid-25,e.id,9,muted,'middle');
  }
  let coupler=0;for(const sw of graph.switches){const a=positions.get(sw.from),b=positions.get(sw.to);if(!a||!b||a.section.voltageKv!==b.section.voltageKv||a.section.id===b.section.id)continue;const x=238+coupler++*28,item=d.equipment.find(e=>e.id===sw.id),closed=item?.closed??false,style=stateStyle(d,(item?.sourceClosed??closed)&&(item?.sourceInService??true),closed&&(item?.inService??true));path(root,[[x,a.y],[x,b.y]],style.color,style.dash);drawSwitch(root,sw.id,x,(a.y+b.y)/2);}
  text(root,24,layout.height-15,`Tam istasyon · ${layout.feeders.length} bağlantı · ${graph.unresolvedEndpoints} çözülemeyen uç`,11,muted);

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
  for(const s of d.switches){const a=pos.get(s.from||''),b=pos.get(s.to||'');if(!a||!b)continue;const g=group(root,s.id,s.sourceClass,s.name,select,`${s.kind} · ${s.closed?'Kapalı':'Açık'}`),style=stateStyle(d,s.modelClosed,s.closed),color=!s.inService?d.settings.colorOut:style.color;
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
  private box(){return this.root!.getAttribute('viewBox')!.split(' ').map(Number);}
  render(host:HTMLElement,d:SldDiagram,select:Select):void {
    const key=[d.station.id,d.scope,d.selectedBay?.id,d.orientation,d.page,[...d.voltageBands].join(',')].join('|'),previous=this.root&&key===this.key?this.box():null;this.key=key;
    const root=svg('svg',{xmlns:NS,viewBox:'0 0 1240 600',width:'100%',height:540,role:'img','aria-label':`${d.station.name} ${d.scope==='bay'?d.selectedBay?.name||'fider':d.scope==='regional'?'bölgesel':'TM genel'} tek hat şeması`,class:'ga-sld-svg',preserveAspectRatio:'xMidYMid meet'});
    root.style.background='#102033';root.style.touchAction='none';root.style.display='block';root.style.width='100%';root.style.height='clamp(360px,60vh,740px)';
    host.replaceChildren(root);this.root=root;if(d.scope==='regional')regional(root,d,select);else if(d.scope==='bay')bay(root,d,select);else station(root,d,select);this.fitBox=this.box();if(previous)root.setAttribute('viewBox',previous.join(' '));
    let drag:{x:number;y:number;box:number[]}|null=null,moved=false;
    root.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,box:this.box()};moved=false;};
    root.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4){moved=true;root.setPointerCapture(e.pointerId);}if(!moved)return;const r=root.getBoundingClientRect(),scale=Math.min(r.width/drag.box[2],r.height/drag.box[3]);root.setAttribute('viewBox',[drag.box[0]-dx/scale,drag.box[1]-dy/scale,drag.box[2],drag.box[3]].join(' '));};
    root.onpointerup=e=>{drag=null;if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);};root.onpointercancel=()=>{drag=null;};root.addEventListener('click',e=>{if(moved){e.stopImmediatePropagation();moved=false;}},true);
    root.onwheel=e=>{e.preventDefault();this.zoom(e.deltaY<0?1.15:1/1.15);};
  }
}
