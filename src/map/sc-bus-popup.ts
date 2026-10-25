import type {AppContext} from '../app/contracts';
import {compactScRows,type CompactRow} from '../features/analysis/compact-rows';
import {scScopeRows,scNodeFilter} from '../domain/results/sc-view-scope';
import {scCurrentKa,nominalKv} from '../domain/results/sc-node';
import {scenarioSignature} from '../domain/scenario/overlay';
import {modelPresentationIndex} from './presentation-index';
import {element,button} from '../ui/components/dom';
type Rect={left:number;top:number;width:number;height:number};
/** Screen placement only. The site anchor is always the native renderer projection. */
export function placeScPopup(anchor:{x:number;y:number},size:{width:number;height:number},bounds:{width:number;height:number},obstacles:Rect[]){
 const w=size.width,h=size.height,m=8;if(w>bounds.width-2*m||h>bounds.height-2*m)return null;
 const xs=[anchor.x+14,anchor.x-w-14,m,bounds.width-w-m,...obstacles.flatMap(r=>[r.left-w-m,r.left+r.width+m])],ys=[anchor.y-h/2,anchor.y-h-14,anchor.y+14,m,bounds.height-h-m,...obstacles.flatMap(r=>[r.top-h-m,r.top+r.height+m])];
 let best:{left:number;top:number;score:number}|null=null;
 for(const x of xs)for(const y of ys){const left=Math.max(m,Math.min(bounds.width-w-m,x)),top=Math.max(m,Math.min(bounds.height-h-m,y));if(obstacles.some(r=>left<r.left+r.width+4&&left+w>r.left-4&&top<r.top+r.height+4&&top+h>r.top-4))continue;const score=Math.hypot(Math.max(left,Math.min(left+w,anchor.x))-anchor.x,Math.max(top,Math.min(top+h,anchor.y))-anchor.y);if(!best||score<best.score)best={left,top,score};}
 return best;
}
export function createScBusPopup(ctx:AppContext,wrap:HTMLElement,anchorSite:(id:string)=>{x:number;y:number}|null,panelVisible:()=>boolean,onClose:()=>void){
 const root=element('aside','ga-sc-bus-popup');root.setAttribute('role','dialog');root.setAttribute('aria-label','Bara kısa devre özeti');root.hidden=true;
 const connector=document.createElementNS('http://www.w3.org/2000/svg','svg'),line=document.createElementNS('http://www.w3.org/2000/svg','line');connector.classList.add('ga-sc-popup-connector');connector.setAttribute('aria-hidden','true');connector.append(line);connector.style.display='none';wrap.append(connector,root);
 let renderedRow:CompactRow|null=null;
 let state:{key:string;source:'GA'|'PF';siteId:string;stamp:string;refs:unknown[]}|null=null;
 const stamp=()=>JSON.stringify([ctx.network?.modelHash,ctx.resultView.source,ctx.resultView.scMode??ctx.scResult?.profile.calculateMode,ctx.filters.areaId,ctx.filters.siteId,[...ctx.filters.voltages].sort(),scNodeFilter(ctx),scenarioSignature(ctx.scenario.current)]);
 const refs=()=>[ctx.network,ctx.scResult,ctx.scResult?.faults,ctx.scContext,ctx.benchmark,ctx.analysisSettings.value,ctx.scenario.current];
 function close(){const had=!!state;state=null;renderedRow=null;root.hidden=true;connector.style.display='none';if(had)onClose();}
 function reposition(){
  if(!state)return;const anchor=anchorSite(state.siteId),box=wrap.getBoundingClientRect(),scale=box.width/wrap.clientWidth;if(!anchor||!scale){root.hidden=true;connector.style.display='none';return;}
  const x=anchor.x/scale,y=anchor.y/scale,bounds={width:Math.min(wrap.clientWidth,(innerWidth-box.left)/scale),height:Math.min(wrap.clientHeight,(innerHeight-box.top)/scale)};if(x<0||y<0||x>bounds.width||y>bounds.height){root.hidden=true;connector.style.display='none';return;}
  root.hidden=false;const size={width:root.offsetWidth,height:root.offsetHeight},obstacles=[...wrap.querySelectorAll<HTMLElement>('.ga-lightning:not([hidden]),.ga-map-legend:not([hidden]),.ga-map-selection,.ga-lightning-toggle')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {left:(r.left-box.left)/scale,top:(r.top-box.top)/scale,width:r.width/scale,height:r.height/scale};});
  const place=placeScPopup({x,y},size,bounds,obstacles);if(!place){root.hidden=true;connector.style.display='none';return;}
  root.style.left=place.left+'px';root.style.top=place.top+'px';root.dataset.anchorX=String(x);root.dataset.anchorY=String(y);connector.setAttribute('viewBox',`0 0 ${wrap.clientWidth} ${wrap.clientHeight}`);connector.style.display='block';line.setAttribute('x1',String(x));line.setAttribute('y1',String(y));line.setAttribute('x2',String(Math.max(place.left,Math.min(place.left+size.width,x))));line.setAttribute('y2',String(Math.max(place.top,Math.min(place.top+size.height,y))));
 }
 function render(){
  if(!state)return;if(ctx.view!=='map'||ctx.resultView.analysis!=='SC'||!panelVisible()||state.stamp!==stamp()||!refs().every((r,i)=>r===state!.refs[i])){close();return;}
  const row=scScopeRows(ctx,compactScRows(ctx,state.source)).find(r=>r.key===state!.key&&r.siteIds?.includes(state!.siteId));if(!row){close();return;}if(row===renderedRow){reposition();return;}renderedRow=row;
  const source=state.source,sourceFid=String(row.raw.sourceFaultFid??row.fid),displayFid=String(row.raw.displayFid??row.fid),siteId=state.siteId,site=ctx.network?.sites.find(s=>s.id===siteId),head=element('header'),title=element('strong','',`⚡ ${site?.name??row.tm} · ${row.name}`);head.append(title,button('×',close,'Bara popup kapat'));
  const status:Record<string,string>={CALCULATED:'Hesaplandı',PF_REFERENCE_ONLY:'PF referansı',BLOCKED:'Engellendi',NOT_COMPUTABLE:'Hesaplanamadı',NOT_RUN:'Hesaplanmadı'};
  root.replaceChildren(head,element('p','ga-sc-popup-meta',`${nominalKv(row.kv)} kV · ${row.raw.nodeLabel} · 3F ${row.raw.mode} · ${source}`),element('strong','ga-sc-popup-current',`Ikss: ${scCurrentKa(source==='PF'?row.metrics.ikss.pf:row.metrics.ikss.ga)} kA`),element('p','',`PF: ${scCurrentKa(row.metrics.ikss.pf)} · Tanısal fark: ${scCurrentKa(row.raw.diagnosticDelta_kA as number|null)}`),element('p','ga-sc-popup-identity',`Hesap FID: ${sourceFid} · ${status[String(row.raw.Hesap_Durumu)]??row.raw.Hesap_Durumu}`));
  if(displayFid!==sourceFid)root.append(element('p','ga-sc-popup-identity',`Görüntüleme FID: ${displayFid}`));
  root.dataset.sourceFaultFid=sourceFid;root.dataset.displayFid=displayFid;root.dataset.electricalBusId=row.key;root.dataset.siteId=siteId;root.dataset.sourceCellKey=String(row.raw.sourceCellKey??'');root.dataset.source=source;root.dataset.mode=String(row.raw.mode);root.title=`Elektriksel düğüm: ${row.key} · TM: ${siteId}`;
  root.append(button('Analizlerde detay',()=>{close();ctx.resultView.source=source;ctx.resultView.faultId=sourceFid;ctx.setView('analysis:SC');document.querySelector('.ga-analysis-compact .ga-compact-study')?.dispatchEvent(new CustomEvent('ga-sc-open-detail',{detail:{key:row.key,source,fid:sourceFid}}));}));reposition();
 }
 function select(row:CompactRow,source:'GA'|'PF'){
  const n=ctx.network;if(!n)return;const index=modelPresentationIndex(n),display=index.physicalTerminalById.get(String(row.raw.displayFid??row.fid)),candidates=[...new Set([ctx.filters.siteId,...(display?.siteIds??[]),...(row.siteIds??[])])].filter(id=>id&&row.siteIds?.includes(id)),siteId=candidates.find(id=>{const s=index.siteById.get(id);return s?.lat!=null&&s.lon!=null&&Number.isFinite(s.lat)&&Number.isFinite(s.lon);});
  if(!siteId){close();onClose();ctx.setMessage('Bu bara için doğrulanabilir TM harita koordinatı yok.');return;}
  renderedRow=null;state={key:row.key,source,siteId,stamp:stamp(),refs:refs()};render();
 }
 const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&state){e.preventDefault();e.stopPropagation();close();}};document.addEventListener('keydown',escape,true);
 return {element:root,select,close,render,reposition,dispose(){document.removeEventListener('keydown',escape,true);close();root.remove();connector.remove();}};
}
