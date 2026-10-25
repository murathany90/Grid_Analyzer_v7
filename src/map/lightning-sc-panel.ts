import {workspaceMapSelection} from '../domain/results/workspace';
import type {AppContext} from '../app/contracts';
import {element,button,format} from '../ui/components/dom';
import {compactScRows,type CompactRow} from '../features/analysis/compact-rows';
import {scDetail} from '../features/analysis/sc-detail';
import {selectScMode,currentScResult} from '../domain/results/sc-selection';
import {scCurrentKa,nominalKv,scVoltageOptions,SC_NODE_LABELS} from '../domain/results/sc-node';
export function createLightningScPanel(ctx:AppContext){
 const root=element('div','ga-lightning-sc-panel'),status=element('div','ga-lightning-sc-status'),toolbar=element('div','ga-lightning-sc-toolbar'),host=element('div','ga-lightning-sc-table-host'),pager=element('div','ga-lightning-sc-pager'),detail=element('div','ga-lightning-sc-detail-host');
 const tm=element('select','ga-lightning-sc-tm'),mode=element('select','ga-lightning-sc-mode'),voltage=element('select'),kind=element('select'),search=element('input','ga-lightning-sc-search');
 tm.setAttribute('aria-label','Seçili TM');mode.setAttribute('aria-label','SC hesap modu');voltage.setAttribute('aria-label','Gerilim Filtresi');kind.setAttribute('aria-label','Düğüm sınıfı');search.setAttribute('aria-label','TM baralarında ara');search.placeholder='Bara adı veya FID ara';search.type='search';mode.innerHTML='<option value="MAX">MAX Arıza</option><option value="MIN">MIN Arıza</option>';
 kind.append(new Option('Tüm düğümler',''),...Object.entries(SC_NODE_LABELS).map(([v,label])=>new Option(label,v)));toolbar.append(tm,mode,voltage,kind,search);root.append(status,toolbar,host,pager,detail);
 let network:unknown,selected='',sort='tm',descending=false,lastMapFilter='',page=0,lastPageKey='';
 const closeDetail=()=>{selected='';detail.replaceChildren();detail.hidden=true;};closeDetail();
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&selected){e.stopPropagation();closeDetail();}});
 tm.onchange=()=>{ctx.filters.siteId=tm.value;closeDetail();ctx.notify();};mode.onchange=()=>{if(ctx.resultView.source==='PF'&&mode.value==='MIN'){mode.value='MAX';ctx.setMessage('PF MIN referansı mevcut değil.');return;}if(!selectScMode(ctx,mode.value as 'MAX'|'MIN'))ctx.setMessage('Seçilen mod için güncel 3F sonucu yok.');closeDetail();ctx.notify();};
 for(const input of [voltage,kind])input.onchange=()=>{closeDetail();ctx.benchmarkMap={...(ctx.benchmarkMap??workspaceMapSelection(ctx)),voltageKv:voltage.value?Number(voltage.value):undefined,nodeKind:kind.value||undefined};ctx.notify();};search.oninput=()=>{closeDetail();render();};
 function showDetail(row:CompactRow,source:'GA'|'PF'){
  detail.hidden=false;const head=element('div','ga-lightning-sc-detail-head');head.append(element('strong','',`3F · ${source} · ${row.fid}`),button('×',()=>{closeDetail();render();},'SC ayrıntısını kapat'));detail.replaceChildren(head,scDetail(row,source,()=>{ctx.resultView.faultId=row.fid;ctx.select(row.fid,'ElmTerm');}));
 }
 function render(){
  const source=ctx.resultView.source==='PF'?'PF':'GA';root.dataset.source=source;
  if(network!==ctx.network){network=ctx.network;tm.replaceChildren(new Option('Tüm TM Baraları',''),...(ctx.network?.sites.map(s=>new Option(s.name,s.id))??[]));voltage.replaceChildren(new Option('Gerilim: Tümü',''),...scVoltageOptions(ctx.network).map(v=>new Option(nominalKv(v)+' kV',String(v))));closeDetail();}
  const mapFilter=JSON.stringify([ctx.benchmarkMap?.voltageKv,ctx.benchmarkMap?.nodeKind]);if(mapFilter!==lastMapFilter){lastMapFilter=mapFilter;voltage.value=String(ctx.benchmarkMap?.voltageKv??'');kind.value=ctx.benchmarkMap?.nodeKind??'';}
  tm.value=ctx.filters.siteId;mode.value=source==='PF'?(ctx.benchmarkMap?.scMode??'MAX'):(currentScResult(ctx)?.profile.calculateMode??'MAX');mode.options[1].disabled=source==='PF';
  const q=search.value.toLocaleLowerCase('tr-TR'),sites=new Map(ctx.network?.sites.map(s=>[s.id,s])??[]);
  let rows=compactScRows(ctx,source).filter(r=>(!ctx.filters.areaId||r.siteIds?.some(id=>sites.get(id)?.areaId===ctx.filters.areaId))&&(!tm.value||r.siteIds?.includes(tm.value))&&(!voltage.value||r.kv!==null&&Math.abs(r.kv-Number(voltage.value))<1e-6)&&(!kind.value||r.raw.nodeKind===kind.value)&&(!q||r.searchText.includes(q)));
  const value=(r:CompactRow)=>sort==='tm'?r.tm:sort==='name'?r.name:sort==='kv'?r.kv:source==='PF'?r.metrics.ikss?.pf:r.metrics.ikss?.ga;
  rows=[...rows].sort((a,b)=>{const x=value(a),y=value(b);if(x==null||y==null)return Number(x==null)-Number(y==null)||a.key.localeCompare(b.key);return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'tr',{numeric:true}))*(descending?-1:1)||a.key.localeCompare(b.key);});
  const pageKey=JSON.stringify([source,mode.value,tm.value,ctx.filters.areaId,voltage.value,kind.value,q,sort,descending,rows.length]);if(pageKey!==lastPageKey){lastPageKey=pageKey;page=0;}const pages=Math.max(1,Math.ceil(rows.length/50));page=Math.min(page,pages-1);
  status.textContent=`${source} · 3F ${mode.value} · ${rows.length} elektriksel düğüm · kA${source==='PF'?' · PF referansı; GA paritesi doğrulanmadı':''}`;
  const table=element('table','ga-lightning-sc-table'),thead=element('thead'),head=element('tr'),body=element('tbody');
  for(const [key,label] of [['tm','TM'],['name','Bara'],['kv','kV'],['ikss','3F Ikss (kA)'],['status','Durum']]){const th=element('th');if(key==='status')th.textContent=label;else{th.setAttribute('aria-sort',sort===key?(descending?'descending':'ascending'):'none');th.append(button(label+(sort===key?(descending?' ↓':' ↑'):''),()=>{descending=sort===key?!descending:false;sort=key;render();},label+' sırala'));}head.append(th);}thead.append(head);table.append(thead,body);
  const statuses:Record<string,string>={CALCULATED:'Hesaplandı',BLOCKED:'Engellendi',NOT_COMPUTABLE:'Hesaplanamadı',NOT_RUN:'Hesaplanmadı',PF_REFERENCE_ONLY:'PF mevcut · GA hesaplanmadı'};
  for(const row of rows.slice(page*50,(page+1)*50)){const tr=element('tr');tr.dataset.fid=row.fid;tr.dataset.electricalBusId=String(row.raw.electricalBusId);tr.tabIndex=0;if(selected===row.key)tr.classList.add('is-selected');for(const text of [row.tm,row.name,nominalKv(row.kv),scCurrentKa(source==='PF'?row.metrics.ikss?.pf:row.metrics.ikss?.ga),source==='PF'?'PF referansı':statuses[String(row.raw.Hesap_Durumu)]??String(row.raw.Hesap_Durumu)])tr.append(element('td','',text));
   tr.title=`${source} · ${row.fid} · ${row.raw.referenceReason??row.raw.reason_3F}`;tr.onclick=()=>{selected=row.key;ctx.resultView.faultId=row.fid;render();};tr.onkeydown=e=>{if(e.key==='Enter')tr.click();};tr.ondblclick=()=>ctx.select(row.fid,'ElmTerm');body.append(tr);
  }host.replaceChildren(table);if(!rows.length)host.append(element('p','ga-muted','Bu kaynak, mod ve filtrede sayısal 3F kaydı yok.'));const previous=button('Önceki',()=>{page--;closeDetail();render();}),next=button('Sonraki',()=>{page++;closeDetail();render();});previous.disabled=page===0;next.disabled=page>=pages-1;pager.replaceChildren(previous,element('span','',`${page+1}/${pages} · ${rows.length} düğüm`),next);pager.hidden=pages===1;const active=rows.find(r=>r.key===selected);if(active)showDetail(active,source);else closeDetail();
 }
 return {element:root,render};
}
