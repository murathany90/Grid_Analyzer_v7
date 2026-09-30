import {voltageMatches} from '../domain/model/voltage-band';
import {displayBranches} from '../domain/results/presentation';
import type {AppContext} from '../app/contracts';
import type {BranchResult} from '../domain/results/types';
import type {Line,Site} from '../domain/model/network';
import {selectedCapacity} from '../domain/model/capacity';
import {buildGeometry,offsetPath,type NetworkGeometry} from './geometry';
import {lineStyle} from './result-style';
import {BasemapRenderer} from './basemap';
import {projectWgs84} from './projection';
import {aggregateStationVoltages,aggregateStationAngles,stationVoltageDeltas,flowScale,voltageColor,scaleColor,type StationVoltage,type StationAngle} from './electrical-overlays';
import {mapDetailText} from './detail-text';
import {deltaColor} from './delta-style';
import {buildIslandMapData,islandColor,type IslandMapData} from './island-map';
import {effectiveNetwork,emptyScenario} from '../domain/scenario/overlay';
import {escapeHtml} from '../ui/components/dom';
import type {CanonicalNetwork} from '../domain/model/network';
import type {CalculationResult} from '../domain/results/types';
export interface MapRenderer {render():void;focus(id:string,sourceClass:string):void;reset():void;dispose():void}
export class CanvasMapRenderer implements MapRenderer {
  private basemap=new BasemapRenderer();private voltages=new Map<string,StationVoltage>();private angles=new Map<string,StationAngle>();private voltageDeltas=new Map<string,number>();
  private geometry:NetworkGeometry|null=null;private zoom=1;private panX=0;private panY=0;private width=1;private height=1;private scale=1;
  private baseRows=new Map<string,BranchResult>();private flowRows=new Map<string,BranchResult>();private lengths=new Map<string,{segments:number[];total:number}>();
  private islandMap:IslandMapData|null=null;
  private islandMapCache:{network:CanonicalNetwork;result:CalculationResult|null;role:string;scenarioRevision:number;data:IslandMapData}|null=null;
  private n1Cache:{detail:NonNullable<AppContext['n1Detail']>;impactByBranch:Map<string,NonNullable<AppContext['n1Detail']>['branchImpacts'][number]>;islandByBranch:Map<string,NonNullable<AppContext['n1Detail']>['outageIslands'][number]>;islandsBySite:Map<string,NonNullable<AppContext['n1Detail']>['outageIslands'][number][]>}|null=null;
  private paths=new Map<string,[number,number][]>();private screenKey='';private visibleLines:Line[]=[];private visibleSites:Site[]=[];
  private resize:ResizeObserver;private raf=0;private pointer:{x:number;y:number;px:number;py:number;dragged:boolean}|null=null;
  showSites=true;showLabels=false;simple=false;
  private visibility=()=>this.render();
  private n1Detail(){const detail=this.ctx.n1Detail;return detail&&detail.candidate.candidateId===this.ctx.selectedN1CandidateId?detail:null;}
  private n1Lookups(){const detail=this.n1Detail();if(!detail)return null;if(this.n1Cache?.detail!==detail){const impactByBranch=new Map(detail.branchImpacts.map(row=>[row.equipmentId,row])),islandByBranch=new Map<string,typeof detail.outageIslands[number]>(),islandsBySite=new Map<string,typeof detail.outageIslands[number][]>();for(const island of detail.outageIslands){for(const id of island.branchIds)islandByBranch.set(id,island);for(const id of island.siteIds)islandsBySite.set(id,[...(islandsBySite.get(id)||[]),island]);}this.n1Cache={detail,impactByBranch,islandByBranch,islandsBySite};}return this.n1Cache;}
  private n1Impact(id:string){return this.n1Lookups()?.impactByBranch.get(id);}
  private n1IslandForBranch(id:string){return this.n1Lookups()?.islandByBranch.get(id);}
  private n1Color(loading:number|null|undefined):string|null{if(loading==null||!Number.isFinite(loading))return null;return loading<80?'#43b874':loading<85?'#e4c84f':loading<=90?'#e99340':'#e34848';}
  private n1LineStyle(line:Line,style:{color:string;width:number;dash:number[];alpha:number}){
    const detail=this.n1Detail();if(!detail)return{...style,color:this.ctx.settings.value.colorNoResult,dash:[5,4],alpha:.72};
    if(detail.outage.equipmentId===line.id&&detail.outage.sourceClass==='ElmLne')return{...style,color:'#111318',width:Math.max(3,style.width+1),dash:[6,4],alpha:1};
    if(this.ctx.settings.value.displayMode==='n1-island'){
      const island=this.n1IslandForBranch(line.id);return island?.hasReference?{...style,color:islandColor(island.componentId),width:Math.max(style.width,2.2),dash:[],alpha:1}:{...style,color:this.ctx.settings.value.colorNoResult,dash:[5,4],alpha:.75};
    }
    const impact=this.n1Impact(line.id),color=this.n1Color(impact?.postEstimatedLoadingPct??impact?.estimatedLoadingPct);
    return color?{...style,color,width:Math.max(style.width,2.4),dash:[],alpha:1}:{...style,color:this.ctx.settings.value.colorNoResult,dash:[5,4],alpha:.75};
  }
  constructor(private ctx:AppContext,private canvas:HTMLCanvasElement,private overlay:HTMLCanvasElement,private tooltip:HTMLElement,private baseCanvas:HTMLCanvasElement,private selectionCanvas:HTMLCanvasElement){
    document.addEventListener('visibilitychange',this.visibility);
    this.resize=new ResizeObserver(()=>this.render());this.resize.observe(canvas);
    canvas.onwheel=e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,factor=e.deltaY<0?1.18:1/1.18,old=this.zoom;this.zoom=Math.min(35,Math.max(.6,old*factor));const f=this.zoom/old;this.panX=(this.panX+this.width/2-x)*f+x-this.width/2;this.panY=(this.panY+this.height/2-y)*f+y-this.height/2;this.render();};
    canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);this.pointer={x:e.clientX,y:e.clientY,px:this.panX,py:this.panY,dragged:false};};
    canvas.onpointermove=e=>{if(this.pointer){const dx=e.clientX-this.pointer.x,dy=e.clientY-this.pointer.y;if(Math.hypot(dx,dy)>4)this.pointer.dragged=true;this.panX=this.pointer.px+dx;this.panY=this.pointer.py+dy;this.render();return;}const rect=canvas.getBoundingClientRect(),hit=this.hit(e.clientX-rect.left,e.clientY-rect.top);this.tooltip.hidden=!hit;if(hit){this.tooltip.textContent=this.detailText(hit);this.tooltip.style.left=Math.min(rect.width-270,e.clientX-rect.left+12)+'px';this.tooltip.style.top=(e.clientY-rect.top+12)+'px';}};
    canvas.onpointerup=e=>{const pointer=this.pointer;this.pointer=null;if(pointer?.dragged)return;const rect=canvas.getBoundingClientRect(),hit=this.hit(e.clientX-rect.left,e.clientY-rect.top);if(hit)this.ctx.select(hit.id,hit.sourceClass);else if(this.ctx.settings.value.clearOnBlank){this.ctx.selection=null;this.ctx.filters.siteId='';this.ctx.notify();}};
    canvas.onpointerleave=()=>{this.tooltip.hidden=true;};canvas.tabIndex=0;canvas.setAttribute('aria-label','Şebeke haritası. Ok tuşlarıyla kaydırın, artı ve eksiyle yakınlaştırın.');
    canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Escape'].includes(e.key))e.preventDefault();if(e.key==='Escape'){this.ctx.selection=null;this.ctx.notify();}else{if(e.key==='ArrowLeft')this.panX+=35;if(e.key==='ArrowRight')this.panX-=35;if(e.key==='ArrowUp')this.panY+=35;if(e.key==='ArrowDown')this.panY-=35;if(e.key==='+')this.zoom=Math.min(35,this.zoom*1.2);if(e.key==='-')this.zoom=Math.max(.6,this.zoom/1.2);this.render();}};
  }
  private point(lon:number,lat:number):[number,number]{const[x,y]=projectWgs84(lon,lat);return[this.width/2+x*this.scale+this.panX,this.height/2+y*this.scale+this.panY];}
  private hit(x:number,y:number):Site|Line|null{for(const s of this.visibleSites){const p=this.point(s.lon!,s.lat!);if(Math.hypot(p[0]-x,p[1]-y)<10)return s;}let best:Line|null=null,dist=8;for(const l of this.visibleLines){const path=this.paths.get(l.id)||[];for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/len)):0,d=Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);if(d<dist){dist=d;best=l;}}}return best;}
  render(){
    if(this.ctx.view!=='map'||document.hidden){cancelAnimationFrame(this.raf);this.raf=0;return;}const rect=this.canvas.getBoundingClientRect();if(rect.width<2||rect.height<2)return;this.width=rect.width;this.height=rect.height;this.scale=Math.min(this.width/21,this.height/10)*this.zoom;
    const dpr=devicePixelRatio||1;for(const c of[this.canvas,this.overlay,this.baseCanvas,this.selectionCanvas])if(c.width!==Math.round(this.width*dpr)||c.height!==Math.round(this.height*dpr)){c.width=Math.round(this.width*dpr);c.height=Math.round(this.height*dpr);}
    const g=this.canvas.getContext('2d')!;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,this.width,this.height);this.basemap.render(this.baseCanvas,this.width,this.height,this.scale,this.panX,this.panY,this.zoom,this.ctx.settings.value);
    const selection=this.selectionCanvas.getContext('2d')!;selection.setTransform(dpr,0,0,dpr,0,0);selection.clearRect(0,0,this.width,this.height);
    const n=this.ctx.network;if(!n)return;if(this.geometry?.modelHash!==n.modelHash){this.geometry=buildGeometry(n);this.screenKey='';}
    const settings=this.ctx.settings.value,screenKey=[this.width,this.height,this.zoom,this.panX,this.panY,settings.layoutMode,this.simple,settings.routeDetail].join('|');
    if(screenKey!==this.screenKey){this.screenKey=screenKey;const siteById=new Map(n.sites.map(s=>[s.id,s]));this.paths.clear();this.lengths.clear();for(const l of n.lines){let pts=this.geometry.paths.get(l.id)||[];if(this.simple||!settings.routeDetail)pts=l.siteIds.map(id=>siteById.get(id)).filter(s=>s?.lat!=null&&s.lon!=null).map(s=>[s!.lat!,s!.lon!]as const);const parallel=this.geometry.parallel.get(l.id),off=settings.layoutMode==='separated'&&parallel?(parallel.index-(parallel.count-1)/2)*5:0;this.paths.set(l.id,offsetPath(pts.map(p=>this.point(p[1],p[0])),off));}}
    if(!this.lengths.size)for(const[id,path]of this.paths){const segments=path.slice(1).map((p,i)=>Math.hypot(p[0]-path[i][0],p[1]-path[i][1]));this.lengths.set(id,{segments,total:segments.reduce((a,b)=>a+b,0)});}
    const area=this.ctx.filters.areaId,sites=new Map(n.sites.map(s=>[s.id,s])),volts=this.ctx.filters.voltages;
    this.visibleLines=n.lines.filter(l=>voltageMatches(l.vnKv,volts)&&(!area||l.siteIds.some(id=>sites.get(id)?.areaId===area)));
    this.visibleSites=this.showSites?n.sites.filter(s=>s.lat!=null&&s.lon!=null&&(!area||s.areaId===area)&&s.voltages.some(v=>voltageMatches(v,volts))):[];
    const result=settings.displayMode==='delta'?this.ctx.resultStore.get('scenario'):this.ctx.resultStore.active,results=new Map([...displayBranches(n,result).values()].filter(b=>b.sourceClass==='ElmLne').map(b=>[b.id,b])),base=new Map([...displayBranches(n,this.ctx.resultStore.get('base')).values()].filter(b=>b.sourceClass==='ElmLne').map(b=>[b.id,b]));
    if(settings.displayMode==='island'){
      const role=this.ctx.resultStore.role,scenarioRevision=this.ctx.scenario.revision,cached=this.islandMapCache;
      if(!cached||cached.network!==n||cached.result!==result||cached.role!==role||cached.scenarioRevision!==scenarioRevision){const network=effectiveNetwork(n,role==='base'?emptyScenario():this.ctx.scenario.current);this.islandMapCache={network:n,result,role,scenarioRevision,data:buildIslandMapData(network,result)};}
      this.islandMap=this.islandMapCache!.data;
    }else this.islandMap=null;
    this.tooltip.hidden=true;this.baseRows=this.ctx.resultStore.comparable()?base:new Map();this.flowRows=results;this.voltages=aggregateStationVoltages(result?.buses||[],volts);this.angles=aggregateStationAngles(result?.buses||[],volts);this.voltageDeltas=this.ctx.resultStore.comparable()?stationVoltageDeltas(this.ctx.resultStore.get('base')?.buses||[],this.ctx.resultStore.get('scenario')?.buses||[],volts):new Map();
    const flowMetric=settings.displayMode==='q'?'q':'p',magnitudeScale=flowScale(this.visibleLines.filter(l=>this.paths.get(l.id)?.some(([x,y])=>x>=0&&x<=this.width&&y>=0&&y<=this.height)).map(l=>results.get(l.id)),flowMetric,settings.magnitudePercentile,flowMetric==='q'?settings.magnitudeQMax:settings.magnitudePMax);
    for(const line of this.visibleLines){
      const inService=settings.displayMode!=='delta'&&this.ctx.resultStore.role==='base'?line.inService:this.ctx.scenario.current.lineStatus[line.id]??line.inService;
      let style=lineStyle(line,inService,settings.displayMode==='delta'?'scenario':this.ctx.resultStore.role,settings,results.get(line.id),(settings.displayMode!=='delta'||this.ctx.resultStore.comparable())?base.get(line.id):undefined,magnitudeScale,this.islandMap?.lineIslands.get(line.id));
      if(settings.displayMode==='n1-island'||settings.displayMode==='n1-risk')style=this.n1LineStyle(line,style);
      const path=this.paths.get(line.id);if(!path?.length)continue;
      g.beginPath();path.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=style.color;g.lineWidth=style.width;g.setLineDash(style.dash);g.globalAlpha=style.alpha;g.stroke();
      const n1Island=this.n1IslandForBranch(line.id);if((settings.displayMode==='n1-island'||settings.displayMode==='n1-risk')&&n1Island&&this.ctx.selectedN1IslandId===n1Island.componentId){selection.beginPath();path.forEach(([x,y],i)=>i?selection.lineTo(x,y):selection.moveTo(x,y));selection.strokeStyle='#e8f2ff';selection.lineWidth=style.width+3;selection.setLineDash([2,4]);selection.stroke();}
      if(this.ctx.selection?.id===line.id){selection.beginPath();path.forEach(([x,y],i)=>i?selection.lineTo(x,y):selection.moveTo(x,y));selection.strokeStyle='#fff2b0';selection.lineWidth=style.width+2;selection.setLineDash(style.dash);selection.stroke();}
    }
    g.globalAlpha=1;g.setLineDash([]);g.font='10px system-ui';for(const s of this.visibleSites){
      const[x,y]=this.point(s.lon!,s.lat!),selected=this.ctx.selection?.id===s.id,delta=this.voltageDeltas.get(s.id),siteIsland=this.islandMap?.siteIslands.get(s.id),dominant=siteIsland?.dominant;
      const n1SiteIslands=this.n1Lookups()?.islandsBySite.get(s.id)||[],n1Island=n1SiteIslands.find(island=>island.hasReference)||n1SiteIslands[0];
      g.fillStyle=settings.displayMode==='n1-island'?n1Island?.hasReference?islandColor(n1Island.componentId):settings.colorNoResult:settings.displayMode==='island'?dominant&&dominant.status!=='NO_REFERENCE'&&dominant.status!=='NO_RESULT'?islandColor(dominant.islandId):settings.colorNoResult:settings.displayMode==='v'?voltageColor(this.voltages.get(s.id)?.worst.vmPu,settings):settings.displayMode==='angle'?scaleColor(this.angles.get(s.id)?.median,settings.angleMin,settings.angleNeutral,settings.angleMax,settings.angleNegativeColor,settings.angleNeutralColor,settings.anglePositiveColor,settings.colorNoResult):settings.displayMode==='delta'&&settings.deltaMetric==='v'?deltaColor(delta,settings):'#b8e1e3';
      g.beginPath();g.arc(x,y,selected?settings.siteSize+2.5:settings.siteSize,0,Math.PI*2);g.fill();if(selected){selection.beginPath();selection.arc(x,y,settings.siteSize+4,0,Math.PI*2);selection.strokeStyle='#ffe49b';selection.lineWidth=2;selection.setLineDash([]);selection.stroke();}if(this.showLabels||selected){g.fillStyle='#d7e7ef';g.fillText(s.name,x+5,y-5);}
    }
    cancelAnimationFrame(this.raf);this.raf=0;const overlay=this.overlay.getContext('2d')!;overlay.clearRect(0,0,this.overlay.width,this.overlay.height);if(settings.flowDefault&&!['q','v','angle','delta','island','n1-island','n1-risk'].includes(settings.displayMode)&&result?.branches.length)this.animate();
  }
  detailText(entity:Site|Line):string {
    if(this.ctx.settings.value.displayMode==='n1-island'||this.ctx.settings.value.displayMode==='n1-risk')return this.n1DetailText(entity);
    const settings=this.ctx.settings.value,line=entity as Line,sites=entity.sourceClass==='ElmLne'?line.siteIds.map(id=>({id,name:this.ctx.network?.sites.find(s=>s.id===id)?.name||'—'})):[];
    const inService=settings.displayMode!=='delta'&&this.ctx.resultStore.role==='base'?entity.inService:this.ctx.scenario.current.lineStatus[entity.id]??entity.inService;
    return mapDetailText(entity,{settings,inService,names:sites.map(s=>s.name),row:this.flowRows.get(entity.id),base:this.baseRows.get(entity.id),voltage:this.voltages.get(entity.id),angle:this.angles.get(entity.id),voltageDelta:this.voltageDeltas.get(entity.id),endpointVoltages:sites.map(s=>({name:s.name,voltage:this.voltages.get(s.id),angle:this.angles.get(s.id),delta:this.voltageDeltas.get(s.id)})),island:this.islandMap?.lineIslands.get(entity.id),siteIslands:entity.sourceClass==='ElmSite'?this.islandMap?.siteIslands.get(entity.id):undefined});
  }
  private n1DetailText(entity:Site|Line):string {
    const detail=this.n1Detail(),fmt=(value:number|null|undefined,digits=1)=>value==null||!Number.isFinite(value)?'—':value.toLocaleString('tr-TR',{maximumFractionDigits:digits}),mode=this.ctx.settings.value.displayMode;
    if(!detail)return 'N-1 ayrıntısı yok · Sonuç görünümü için N-1 adayını seçin.';
    if(entity.sourceClass==='ElmSite'){
      const islands=detail.outageIslands.filter(island=>island.siteIds.includes(entity.id));
      return `${entity.name}\n${islands.length?islands.map(island=>`${island.componentId} · ${island.hasReference?'Referanslı':'Referanssız'} · ${fmt(island.loadMw)} MW yük · ${fmt(island.generationMw)} MW üretim`).join('\n'):'N-1 adasında veri yok'}`;
    }
    const outage=detail.outage.equipmentId===entity.id&&detail.outage.sourceClass===entity.sourceClass;
    if(outage){const line=entity as Line,capacity=this.ctx.network?selectedCapacity(line,this.ctx.network.modelHash)?.mva??null:null,baseLoading=capacity&&detail.candidate.baseFlowMw!=null?Math.abs(detail.candidate.baseFlowMw)/capacity*100:null;return `${entity.name} · N-1 kesinti ekipmanı\nBaz akış: ${fmt(detail.candidate.baseFlowMw)} MW · Baz tahmini yüklenme: ${fmt(baseLoading)}%\nN-1 akış / ΔP / yüklenme: — (kesinti dalı)\nKapasite: ${fmt(capacity)} MVA\nKesinti: ${detail.candidate.name} · Durum: ${detail.candidate.status}`;}
    const impact=detail.branchImpacts.find(row=>row.equipmentId===entity.id);
    if(!impact)return `${entity.name}\nN-1 ${mode==='n1-risk'?'risk':'ada'} verisi yok · İzlenen ≥66 kV dallarda değil.`;
    const loading=impact.postEstimatedLoadingPct??impact.estimatedLoadingPct,hardViolation=loading!=null&&loading>100;
    return `${entity.name} · ${impact.sourceClass}\nBaz akış: ${fmt(impact.baseFlowMw)} MW · Baz yüklenme: ${fmt(impact.baseEstimatedLoadingPct)}%\nN-1 tahmini akış: ${fmt(impact.postFlowMw)} MW · N-1 tahmini yüklenme: ${fmt(loading)}%\nΔP: ${fmt(impact.deltaPMw)} MW\nKapasite: ${fmt(impact.capacityMva)} MVA${hardViolation?' · LİMİT AŞIMI (>100%)':''}\nN-1 adası: ${this.n1IslandForBranch(entity.id)?.componentId||'—'}\nKesinti: ${detail.candidate.name}`;
  }
  islandLegendMarkup(noResultColor='#708596'):string {
    const islands=this.islandMap?.islands||[],unreferenced=islands.filter(island=>island.status==='NO_REFERENCE').length;
    if(!islands.length)return '<span>Hesaplama sonucu yok</span><span>Gri · ┄ NO_REFERENCE</span>';
    return `<span>${islands.length} elektrik adası · ${unreferenced} referanssız</span>${islands.map(island=>`<span><i style="background:${island.status==='NO_REFERENCE'||island.status==='NO_RESULT'?noResultColor:islandColor(island.islandId)};${island.status==='NO_REFERENCE'?'border-bottom:2px dashed #fff':''}"></i>${escapeHtml(island.islandId)} · ${island.busCount} bara · ${island.branchCount} dal · ${escapeHtml(island.referenceSourceName||'NO_REFERENCE')} · ${escapeHtml(island.status)}</span>`).join('')}<span>NO_REFERENCE: gri · ┄</span>`;
  }
  n1IslandLegendMarkup(noResultColor='#708596'):string {
    const detail=this.n1Detail();if(!detail)return `<span>${this.ctx.n1DetailLoading?'N-1 ayrıntısı hesaplanıyor…':'N-1 ayrıntısı yok · Sonuç görünümü için N-1 adayını seçin.'}</span>`;
    const islands=detail.outageIslands,unreferenced=islands.filter(island=>!island.hasReference).length;
    const references=(island:typeof islands[number])=>island.references.length?island.references.map(row=>`${row.name} (${row.id})`).join(', '):'YOK';
    return `<span>${islands.length} N-1 adası · ${unreferenced} referanssız · Kesinti: ${escapeHtml(detail.candidate.name)}</span><span><i style="background:#111318;border-bottom:2px dashed #f2f5f7"></i>Kesinti ekipmanı · siyah ┄</span>${islands.map(island=>{
      const active=this.ctx.selectedN1IslandId===island.componentId,color=island.hasReference?islandColor(island.componentId):noResultColor;
      return `<button type="button" class="ga-n1-island-choice${active?' is-selected':''}" data-n1-island="${escapeHtml(island.componentId)}" aria-pressed="${active}"><i style="background:${color};${island.hasReference?'':'border-bottom:2px dashed #f2f5f7'}"></i><span><b>${escapeHtml(island.componentId)}</b> · ${island.busIds.length} bara · ${island.branchIds.length} dal · ${island.referenceCount} referans${island.hasReference?'':' · REFERANSSIZ'}<small>${escapeHtml(references(island))} · Yük ${island.loadMw.toLocaleString('tr-TR',{maximumFractionDigits:1})} MW · Üretim ${island.generationMw.toLocaleString('tr-TR',{maximumFractionDigits:1})} MW</small></span></button>`;
    }).join('')}<span>REFERANSSIZ: gri · ┄</span>`;
  }
  n1RiskLegendMarkup(noResultColor='#708596'):string {
    const detail=this.n1Detail();if(!detail)return `<span>${this.ctx.n1DetailLoading?'N-1 ayrıntısı hesaplanıyor…':'N-1 ayrıntısı yok · Sonuç görünümü için N-1 adayını seçin.'}</span>`;
    const rows=detail.branchImpacts,counts=[rows.filter(row=>row.postEstimatedLoadingPct!=null&&row.postEstimatedLoadingPct<80).length,rows.filter(row=>row.postEstimatedLoadingPct!=null&&row.postEstimatedLoadingPct>=80&&row.postEstimatedLoadingPct<85).length,rows.filter(row=>row.postEstimatedLoadingPct!=null&&row.postEstimatedLoadingPct>=85&&row.postEstimatedLoadingPct<=90).length,rows.filter(row=>row.postEstimatedLoadingPct!=null&&row.postEstimatedLoadingPct>90).length],unrated=rows.filter(row=>row.postEstimatedLoadingPct==null).length;
    const colors=['#43b874','#e4c84f','#e99340','#e34848'];
    return `<span>${escapeHtml(detail.candidate.name)} · ${rows.length} izlenen dal · ${detail.candidate.estimatedOverloadCount} tahmini limit aşımı</span><span><i style="background:#111318;border-bottom:2px dashed #f2f5f7"></i>Kesinti ekipmanı</span>${['&lt;80%','80–85%','85–90%','&gt;90%'].map((label,index)=>`<span><i style="background:${colors[index]}"></i>${label} · ${counts[index]}</span>`).join('')}<span><i style="background:${noResultColor};border-bottom:2px dashed #f2f5f7"></i>Kapasite / sonuç yok · ${unrated}</span><span>Kırmızı &gt;90% risk bandı · Sert kapasite ihlali yalnızca &gt;100%</span>`;
  }
  private animate=()=>{
    if(this.ctx.view!=='map'||document.hidden||!this.ctx.settings.value.flowDefault){this.raf=0;return;}const result=this.ctx.resultStore.active;if(!result){this.raf=0;return;}const dpr=devicePixelRatio||1,g=this.overlay.getContext('2d')!,rows=this.flowRows;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,this.width,this.height);const cells=new Map<string,number>(),settings=this.ctx.settings.value;
    for(const l of this.visibleLines){if(l.vnKv!==400&&l.vnKv!==154)continue;const r=rows.get(l.id),p=this.paths.get(l.id);if(!r||!Number.isFinite(r.pf)||Math.abs(r.pf)<.15||!p||p.length<2)continue;const metric=this.lengths.get(l.id);if(!metric)continue;const lens=metric.segments,total=metric.total;if(total<34)continue;const count=Math.min(3,Math.ceil(total/180)),speed=({slow:.72,normal:1,fast:1.35}[settings.flowSpeed])*(.52+Math.min(120,r.loading||30)/120*1.15);for(let k=0;k<count;k++){let d=(performance.now()/1000*36*speed+k*total/count)%total;if(r.pf<0)d=total-d;let i=0;while(i<lens.length-1&&d>lens[i]){d-=lens[i];i++;}const t=lens[i]?d/lens[i]:0,a=p[i],b=p[i+1],x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,key=Math.floor(x/115)+'|'+Math.floor(y/115);if((cells.get(key)||0)>=settings.flowDensity&&this.ctx.selection?.id!==l.id)continue;cells.set(key,(cells.get(key)||0)+1);g.save();g.translate(x,y);g.rotate(Math.atan2(b[1]-a[1],b[0]-a[0])+(r.pf<0?Math.PI:0));g.fillStyle='#ffe2a2';g.beginPath();g.moveTo(6,0);g.lineTo(-5,-3.5);g.lineTo(-3,0);g.lineTo(-5,3.5);g.closePath();g.fill();g.restore();}}
    this.raf=requestAnimationFrame(this.animate);
  };
  focus(id:string,cls:string){const n=this.ctx.network;if(!n)return;const site=cls==='ElmSite'?n.sites.find(s=>s.id===id):n.sites.find(s=>(cls==='ElmLne'?n.lines.find(l=>l.id===id):n.transformers.find(l=>l.id===id))?.siteIds.includes(s.id));if(site?.lon==null||site.lat==null)return;this.zoom=3.2;this.scale=Math.min(this.width/21,this.height/10)*this.zoom;const[x,y]=projectWgs84(site.lon,site.lat);this.panX=-x*this.scale;this.panY=-y*this.scale;this.render();}
  reset(){this.zoom=1;this.panX=0;this.panY=0;this.render();}
  dispose(){document.removeEventListener('visibilitychange',this.visibility);this.resize.disconnect();cancelAnimationFrame(this.raf);}
}
