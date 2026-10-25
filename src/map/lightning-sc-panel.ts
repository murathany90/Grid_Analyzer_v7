import {workspaceMapSelection} from '../domain/results/workspace';
import type {AppContext} from '../app/contracts';
import {element,button} from '../ui/components/dom';
import {compactScRows,type CompactRow} from '../features/analysis/compact-rows';
import {scDetail} from '../features/analysis/sc-detail';
import {selectScMode} from '../domain/results/sc-selection';
import {scCurrentKa,nominalKv,SC_NODE_LABELS} from '../domain/results/sc-node';
import {populateVoltageGroups,selectVoltageGroup,voltageGroupLabel,scNodeFilter,scScopeRows} from '../domain/results/sc-view-scope';
export function createLightningScPanel(ctx:AppContext){
 const root=element('div','ga-lightning-sc-panel'),status=element('div','ga-lightning-sc-status'),toolbar=element('div','ga-lightning-sc-toolbar'),host=element('div','ga-lightning-sc-table-host'),pager=element('div','ga-lightning-sc-pager'),detail=element('div','ga-lightning-sc-detail-host');
 const tm=element('select'),mode=element('select'),voltage=element('select'),kind=element('select'),search=element('input');
 tm.setAttribute('aria-label','Seçili TM');mode.setAttribute('aria-label','SC hesap modu');voltage.setAttribute('aria-label','Gerilim Filtresi');kind.setAttribute('aria-label','Düğüm sınıfı');search.setAttribute('aria-label','TM baralarında ara');search.placeholder='Bara / düğüm adı veya FID';search.type='search';mode.innerHTML='<option value="MAX">MAX Arıza</option><option value="MIN">MIN Arıza</option>';
 kind.append(new Option('Tüm düğümler',''),...Object.entries(SC_NODE_LABELS).map(([v,label])=>new Option(label,v)));toolbar.append(tm,mode,voltage,kind,search);root.append(status,toolbar,host,pager,detail);
 let network:unknown,areaKey='',selected='',sort='tm',descending=false,page=0,lastPageKey='',lastRenderKey='',lastRefs:unknown[]=[];
 const closeDetail=()=>{selected='';detail.replaceChildren();detail.hidden=true;};closeDetail();
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&selected){e.stopPropagation();closeDetail();}});
 tm.onchange=()=>{ctx.filters.siteId=tm.value;closeDetail();ctx.notify();};
 mode.onchange=()=>{if(ctx.resultView.source==='PF')return;if(!selectScMode(ctx,mode.value as 'MAX'|'MIN'))ctx.setMessage('Seçilen mod için güncel 3F sonucu yok.');closeDetail();ctx.notify();};
 voltage.onchange=()=>{selectVoltageGroup(ctx,voltage.value);closeDetail();ctx.notify();};
 kind.onchange=()=>{ctx.resultView.scNodeKind=kind.value;ctx.benchmarkMap={...(ctx.benchmarkMap??workspaceMapSelection(ctx)),nodeKind:kind.value};closeDetail();ctx.notify();};
 search.oninput=()=>{closeDetail();render();};
 function render(){
  const source=ctx.resultView.source==='PF'?'PF':'GA',activeMode=source==='PF'?(ctx.benchmarkMap?.scMode??'MAX'):(ctx.resultView.scMode??ctx.scResult?.profile.calculateMode??'MAX');
  const key=JSON.stringify([source,activeMode,ctx.filters.areaId,ctx.filters.siteId,[...ctx.filters.voltages].sort(),scNodeFilter(ctx),search.value,sort,descending,page,selected,ctx.scenario.revision,ctx.scResult?.identity,ctx.scResult?.method,ctx.scResult?.engineRevision]),refs=[ctx.network,ctx.network?.buses,ctx.scResult,ctx.scResult?.faults,ctx.ytmStudy,ctx.studyOptions,ctx.benchmark,ctx.scContext,ctx.analysisSettings.value,ctx.scenario.current,ctx.resultStore.active];
  if(lastRenderKey===key&&refs.every((v,i)=>v===lastRefs[i]))return;lastRenderKey=key;lastRefs=refs;
  root.dataset.source=source;root.dataset.mode=activeMode;
  if(network!==ctx.network||areaKey!==ctx.filters.areaId){network=ctx.network;areaKey=ctx.filters.areaId;tm.replaceChildren(new Option('Tüm TM',''),...(ctx.network?.sites.filter(s=>!areaKey||s.areaId===areaKey).map(s=>new Option(s.name,s.id))??[]));closeDetail();}
  populateVoltageGroups(voltage,ctx);tm.value=ctx.filters.siteId;kind.value=scNodeFilter(ctx);mode.value=activeMode;mode.options[1].disabled=source==='PF';
  const q=search.value.toLocaleLowerCase('tr-TR');let rows=scScopeRows(ctx,compactScRows(ctx,source)).filter(r=>!q||r.searchText.includes(q));
  const value=(r:CompactRow)=>sort==='tm'?r.tm:sort==='name'?r.name:sort==='kv'?r.kv:source==='PF'?r.metrics.ikss?.pf:r.metrics.ikss?.ga;
  rows=[...rows].sort((a,b)=>{const x=value(a),y=value(b);if(x==null||y==null)return Number(x==null)-Number(y==null)||a.key.localeCompare(b.key);return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'tr',{numeric:true}))*(descending?-1:1)||a.key.localeCompare(b.key);});
  const pageKey=JSON.stringify([source,activeMode,tm.value,ctx.filters.areaId,voltage.value,kind.value,q,sort,descending,rows.length]);if(pageKey!==lastPageKey){lastPageKey=pageKey;page=0;}const pages=Math.max(1,Math.ceil(rows.length/50));page=Math.min(page,pages-1);
  const area=ctx.network?.sites.find(s=>s.areaId===ctx.filters.areaId)?.areaName??'Tümü',site=ctx.network?.sites.find(s=>s.id===ctx.filters.siteId)?.name??'Tümü';
  status.textContent=`YTM: ${area} · TM: ${site} · ${source} · 3F ${activeMode} · Gerilim: ${voltageGroupLabel(ctx)} · ${rows.length} düğüm · kA${source==='PF'?' · GA/PF paritesi doğrulanmadı':''}`;root.dataset.totalRows=String(rows.length);root.dataset.voltageGroup=voltage.value;root.dataset.nodeKind=kind.value;
  const table=element('table','ga-lightning-sc-table'),thead=element('thead'),head=element('tr'),body=element('tbody');
  for(const [key,label] of [['tm','TM'],['name','Bara / Düğüm'],['type','Tür'],['kv','kV'],['ikss','3F Ikss (kA)'],['status','Durum']]){const th=element('th');if(key==='status'||key==='type')th.textContent=label;else{th.setAttribute('aria-sort',sort===key?(descending?'descending':'ascending'):'none');th.append(button(label+(sort===key?(descending?' ↓':' ↑'):''),()=>{descending=sort===key?!descending:false;sort=key;render();},label+' sırala'));}head.append(th);}thead.append(head);table.append(thead,body);
  const statuses:Record<string,string>={CALCULATED:'Hesaplandı',BLOCKED:'Engellendi',NOT_COMPUTABLE:'Hesaplanamadı',NOT_RUN:'Hesaplanmadı',PF_REFERENCE_ONLY:'PF mevcut · GA hesaplanmadı'};
  for(const row of rows.slice(page*50,(page+1)*50)){const tr=element('tr');tr.dataset.fid=row.fid;tr.dataset.displayFid=String(row.raw.displayFid??row.fid);tr.dataset.electricalBusId=String(row.raw.electricalBusId);tr.tabIndex=0;if(selected===row.key)tr.classList.add('is-selected');
   for(const [column,text] of [['tm',row.tm],['name',row.name],['type',String(row.raw.nodeLabel)],['kv',nominalKv(row.kv)],['ikss',scCurrentKa(source==='PF'?row.metrics.ikss?.pf:row.metrics.ikss?.ga)],['status',source==='PF'?'PF referansı':statuses[String(row.raw.Hesap_Durumu)]??String(row.raw.Hesap_Durumu)]]){const td=element('td','',text);td.dataset.column=column;if(column==='name')td.title=`Kaynak FID: ${row.fid} · Görüntüleme FID: ${row.raw.displayFid??row.fid}`;tr.append(td);}
   tr.title=`${source} · ${row.fid} · ${row.raw.referenceReason??row.raw.reason_3F}`;tr.onclick=()=>{selected=row.key;ctx.resultView.faultId=row.fid;render();};tr.onkeydown=e=>{if(e.key==='Enter')tr.click();};tr.ondblclick=()=>ctx.select(row.fid,'ElmTerm');body.append(tr);
  }
  host.replaceChildren(table);if(!rows.length)host.append(element('p','ga-muted','Bu kapsamda doğrulanabilir kayıt yok. Diğer düğüm türlerini görmek için Tüm düğümler seçin.'));
  const previous=button('Önceki',()=>{page--;closeDetail();render();}),next=button('Sonraki',()=>{page++;closeDetail();render();});previous.disabled=page===0;next.disabled=page>=pages-1;pager.replaceChildren(previous,element('span','',`${page+1}/${pages} · ${rows.length} düğüm`),next);pager.hidden=pages===1;
  const active=rows.find(r=>r.key===selected);if(active){detail.hidden=false;const head=element('div','ga-lightning-sc-detail-head');head.append(element('strong','',`3F · ${source} · ${active.fid}`),button('×',()=>{closeDetail();render();},'SC ayrıntısını kapat'));detail.replaceChildren(head,scDetail(active,source,()=>ctx.select(active.fid,'ElmTerm')));}else closeDetail();
 }
 return {element:root,render};
}
