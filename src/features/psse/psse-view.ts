import type {PsseEquipment,PsseKind,PsseModel} from '../../importers/psse/types';
import {psseKinds} from '../../importers/psse/types';
import {element,button,downloadText,format} from '../../ui/components/dom';
import {kindLabels,queryPsse,equipmentValue,type PsseTab,psseBandFilter,psseSetBandFilter,psseToggleBand} from './catalog';
import {PSSE_VOLTAGE_BANDS,psseVoltageBandCounts} from './voltage-bands';
import {psseAreaName,psseNamedCode,psseNameDictionaries} from './ytbs-names';
import {normalizePsseBusBranch,type PsseBusBranchNetwork} from '../../domain/psse/network';
import {createPsseGeographyReport} from './geography-report';
export interface PsseViewOptions {getModel:()=>PsseModel|null|undefined;getNetwork?:()=>PsseBusBranchNetwork|null|undefined;onSelection?:(row:PsseEquipment)=>void;onKind?:(kind:PsseKind)=>void}
const display=(value:unknown):string=>value===null||value===undefined?'—':typeof value==='object'?JSON.stringify(value):typeof value==='number'?value!==0&&Math.abs(value)<.00001?value.toExponential(5):value.toLocaleString('tr-TR',{maximumFractionDigits:5,useGrouping:false}):String(value);
const count=(n:number)=>n.toLocaleString('tr-TR');
const bytes=(value:number)=>value>=1048576?`${format(value/1048576,1)} MB`:value>=1024?`${format(value/1024,1)} KB`:`${format(value,0)} bayt`;
const statusLabel=(status:number|null):string=>status===null?'Kaynakta belirtilmemiş':status===1?'Serviste':status===0?'Devre dışı':`Kaynak durum ${status}`;
const KPI_KINDS:PsseKind[]=['substation','bus','line','transformer','generator','load','shunt','switch'];
type RegionKind='AREA'|'ZONE'|'OWNER';
const REGION_CONFIG:{kind:RegionKind;heading:string;busField:string;codeField:string;nameField:string}[]=[
 {kind:'AREA',heading:'YTM / AREA',busField:'area',codeField:'iarea',nameField:'arname'},
 {kind:'ZONE',heading:'Gerilim Bölgesi / ZONE',busField:'zone',codeField:'izone',nameField:'zoname'},
 {kind:'OWNER',heading:'Bölge Müdürlüğü / OWNER',busField:'owner',codeField:'iowner',nameField:'owname'}];
/** Shared source-inspection UI for GA and the offline standalone artifact. */
export function createPsseView(tab:PsseTab,options:PsseViewOptions){
 const root=element('section','ga-feature ga-psse-view ga-psse-'+tab),notice=element('p','ga-notice','PSS/E kaynak incelemesi · SOURCE_SAVED değerleri hesaplanmış sonuç değildir. Çözüm uygunluğu ve yöntem kapsamı Yük Akışı bölümünde denetlenir.'),body=element('div');root.append(notice,body);
 let identity='',kind:PsseKind=tab==='operating'?'bus':'substation',page=0,sort='id',descending=false,search='',status='',voltage='',severity='',size=40,lastFilter='';
 let summaryKind:PsseKind='substation',summaryPage=0,rawPages:Record<string,number>={},azoFilters:Record<string,string>={},azoOpen:Record<string,boolean>={},advancedOpen={main:false,tables:{} as Record<string,boolean>},busNames=new Map<number,string>();
 const toolbar=element('div','ga-toolbar'),kinds=element('nav','ga-tabs'),searchInput=element('input'),statusSelect=element('select'),bandSelect=element('select'),sizeSelect=element('select'),severitySelect=element('select'),details=element('dialog','ga-record-dialog'),detail=element('div','ga-detail');
 searchInput.type='search';searchInput.placeholder='Ad / kaynak kimliği / bara';searchInput.setAttribute('aria-label','PSS/E ekipman araması');statusSelect.setAttribute('aria-label','PSS/E ekipman durumu');statusSelect.append(new Option('Tüm durumlar',''));for(const [value,label] of [['1','Serviste / durum 1'],['0','Devre dışı / durum 0'],['2','Kaynak durum 2'],['3','Kaynak durum 3'],['4','Kaynak durum 4'],['unknown','Kaynakta belirtilmemiş']])statusSelect.append(new Option(label,value));sizeSelect.setAttribute('aria-label','PSS/E sayfa boyutu');for(const value of [20,40,80,100])sizeSelect.append(new Option(value+' / sayfa',String(value)));sizeSelect.value=String(size);
 bandSelect.setAttribute('aria-label','PSS/E gerilim bandı');bandSelect.append(new Option('Tüm gerilim bantları',''),...PSSE_VOLTAGE_BANDS.map(band=>new Option(band.label,band.id)));
 severitySelect.setAttribute('aria-label','PSS/E bulgu önemi');severitySelect.append(new Option('Tüm önemler',''),new Option('Hata','ERROR'),new Option('Uyarı','WARNING'),new Option('Bilgi','INFO'));
 const exportButton=button('JSON indir',()=>{const model=options.getModel();if(model)downloadText(JSON.stringify(model,null,2),'PSSE_'+model.source.name.replace(/\.[^.]+$/,'')+'.json','application/json');});
 toolbar.append(searchInput,tab==='quality'?severitySelect:statusSelect,...(tab==='quality'?[]:[bandSelect]),sizeSelect,...(tab==='summary'?[]:[exportButton]));details.setAttribute('aria-label','PSS/E kaynak ekipman ayrıntısı');details.append(button('Kapat',()=>details.close()),detail);root.append(details);
 const update=()=>{page=0;render();};searchInput.oninput=()=>{search=searchInput.value;update();};statusSelect.onchange=()=>{status=statusSelect.value;update();};bandSelect.onchange=()=>{psseSetBandFilter(bandSelect.value?[bandSelect.value]:[]);update();};severitySelect.onchange=()=>{severity=severitySelect.value;update();};sizeSelect.onchange=()=>{size=Number(sizeSelect.value);update();};
 function card(label:string,value:string){const node=element('div','ga-card');node.append(element('span','ga-muted',label),element('strong','',value));return node;}
 function showDetail(row:PsseEquipment){options.onSelection?.(row);detail.replaceChildren(element('h3','',row.name||row.id),element('p','ga-code',kindLabels[row.kind]+' · '+row.id),element('p','ga-muted','Kaynak alanları ve bağlantılar; eksik değerler doldurulmaz.'),element('pre','',JSON.stringify({id:row.id,buses:row.buses,status:row.status,nominalKv:row.nominalKv,fields:row.fields,operating:row.operating},null,2)));if(!details.open)details.showModal();}
 function pager(total:number,pages:number,current:number,onMove?:(next:number)=>void){const root=element('div','ga-pager'),previous=button('← Önceki',()=>{if(onMove)onMove(current-1);else{page--;render();}}),next=button('Sonraki →',()=>{if(onMove)onMove(current+1);else{page++;render();}});previous.disabled=current===0;next.disabled=current>=pages-1;root.append(previous,element('span','ga-muted',`${count(total)} kayıt · ${current+1}/${pages}`),next);return root;}
 /** Source dictionary + binary-array name resolution for AREA/ZONE/OWNER entries; no name is invented. */
 function regionEntries(model:PsseModel,config:(typeof REGION_CONFIG)[number]){
  const raw=model.sourceTables[config.kind],sourceRows=Array.isArray(raw)?raw as Record<string,unknown>[]:[],names=new Map<number,string>();
  for(const row of sourceRows){const id=Number(row[config.codeField]);if(Number.isFinite(id))names.set(id,String(row[config.nameField]??'').trim());}
  const dictionary={AREA:psseNameDictionaries(model).area,ZONE:psseNameDictionaries(model).zone,OWNER:psseNameDictionaries(model).owner}[config.kind];
  for(const [id,name] of dictionary)if(name&&!names.has(id))names.set(id,name);
  const busCounts=new Map<number,number>();
  for(const bus of model.equipment)if(bus.kind==='bus'){const id=Number(bus.fields[config.busField]);if(Number.isFinite(id)){busCounts.set(id,(busCounts.get(id)??0)+1);if(!names.has(id))names.set(id,'');}}
  return [...names].map(([code,name])=>({code,name,busCount:busCounts.get(code)??0})).sort((a,b)=>b.busCount-a.busCount||a.code-b.code);
 }
 /** Compact Area/Zone/Owner card: leading entry in the summary, filterable table inside the details. */
 function azoCard(model:PsseModel,config:(typeof REGION_CONFIG)[number]):HTMLElement{
  const entries=regionEntries(model,config),top=entries[0],open=azoOpen[config.kind]??false;
  const card=element('details','ga-psse-azocard');card.open=open;card.ontoggle=()=>{azoOpen[config.kind]=card.open;};
  const summary=element('summary');summary.append(element('small','ga-muted',config.heading),element('strong','',top?top.name?psseNamedCode(top.name,top.code):String(top.code):'—'),element('span','ga-psse-azocard-sub',top?`${count(top.busCount)} bara · ${count(entries.length)} kaynak kodu`:'kaynak kodu yok'));
  const bodyNode=element('div','ga-psse-azocard-body'),filterInput=element('input');filterInput.type='search';filterInput.placeholder='Ad veya kod ara';filterInput.setAttribute('aria-label',`${config.heading} ara`);filterInput.value=azoFilters[config.kind]??'';
  const wrap=element('div','ga-table-wrap'),note=element('p','ga-muted'),table=element('table','ga-table ga-psse-azocard-table'),thead=element('thead'),head=element('tr');for(const label of ['Kod','Ad','Bara'])head.append(element('th','',label));thead.append(head);
  const draw=()=>{const needle=(azoFilters[config.kind]??'').toLocaleLowerCase('tr'),filtered=entries.filter(entry=>!needle||`${entry.code} ${entry.name}`.toLocaleLowerCase('tr').includes(needle)),tbody=element('tbody');
   for(const entry of filtered.slice(0,100)){const tr=element('tr');tr.append(element('td','',String(entry.code)),element('td','',entry.name||'Kaynakta ad belirtilmemiş'),element('td','',count(entry.busCount)));tbody.append(tr);}
   table.replaceChildren(thead,tbody);wrap.replaceChildren(table);
   note.textContent=filtered.length>100?`İlk 100 satır gösteriliyor; aramayla daraltın (${count(filtered.length)} kayıt).`:filtered.length===entries.length?`${count(filtered.length)} kaynak kodu · bara sayıları kaynak bus alanı ${config.busField} üzerinden.`:`${count(filtered.length)}/${count(entries.length)} kaynak kodu.`;};
  filterInput.oninput=()=>{azoFilters[config.kind]=filterInput.value;draw();};
  draw();bodyNode.append(filterInput,wrap,note);card.append(summary,bodyNode);return card;
 }
 /** Paginated ≤100-row preview of one raw source table; nothing is dropped from the JSON export. */
 function advancedTableBox(name:string,value:unknown):HTMLElement{
  const box=element('details','ga-psse-advanced-table');box.open=advancedOpen.tables[name]??false;box.ontoggle=()=>{advancedOpen.tables[name]=box.open;};
  const rows=Array.isArray(value)?value:[],objectRows=rows.filter((row):row is Record<string,unknown>=>!!row&&typeof row==='object');
  box.append(element('summary','',`${name} · ${count(rows.length)} kayıt`));
  const bodyNode=element('div','ga-psse-advanced-body');
  if(!Array.isArray(value))bodyNode.append(element('pre','',JSON.stringify(value,null,2).slice(0,4000)));
  else if(!objectRows.length)bodyNode.append(element('p','ga-muted','Kayıt yok.'));
  else{
   const pageSize=100,pages=Math.max(1,Math.ceil(objectRows.length/pageSize));
   const draw=()=>{const current=Math.min(rawPages[name]??0,pages-1);rawPages[name]=current;
    const keys=[...new Set(objectRows.slice(0,50).flatMap(row=>Object.keys(row)))].slice(0,8),table=element('table','ga-table'),thead=element('thead'),head=element('tr');for(const key of keys)head.append(element('th','',key));thead.append(head);
    const tbody=element('tbody');for(const row of objectRows.slice(current*pageSize,(current+1)*pageSize)){const tr=element('tr');for(const key of keys){const cell=element('td','',display(row[key]));cell.title=typeof row[key]==='object'?JSON.stringify(row[key]):String(row[key]??'');tr.append(cell);}tbody.append(tr);}
    table.append(thead,tbody);const wrap=element('div','ga-table-wrap');wrap.append(table);
    const bar=element('div','ga-pager'),previous=button('← Önceki',()=>{rawPages[name]=Math.max(0,current-1);draw();}),next=button('Sonraki →',()=>{rawPages[name]=Math.min(pages-1,current+1);draw();});previous.disabled=current===0;next.disabled=current>=pages-1;
    bar.append(previous,element('span','ga-muted',`${count(objectRows.length)} kayıt · sayfa ${current+1}/${pages} · ${keys.length} kolon`),next);
    bodyNode.replaceChildren(bar,wrap);
    if(rows.length!==objectRows.length)bodyNode.append(element('p','ga-muted',`${count(rows.length-objectRows.length)} kayıt nesne olmadığı için tabloda önizlenmez; JSON indirimi tümünü korur.`));
    if(keys.length<Object.keys(objectRows[0]??{}).length)bodyNode.append(element('p','ga-muted','İlk kolonlar önizlenir; tüm alanlar JSON indiriminin içindedir.'));};
   draw();
  }
  box.append(bodyNode);return box;
 }
 /** Collapsed advanced block: counts summary, paginated per-table previews, binary arrays, analysis records, JSON download. */
 function renderAdvanced(model:PsseModel):HTMLElement{
  const details=element('details','ga-psse-advanced');details.open=advancedOpen.main;details.ontoggle=()=>{advancedOpen.main=details.open;};
  const tables=Object.entries(model.sourceTables),recordTotal=tables.reduce((sum,[,value])=>sum+(Array.isArray(value)?value.length:0),0),binaryKeys=Object.keys(model.binaryArrays??{});
  details.append(element('summary','',`Gelişmiş / Kaynak Veri · ${tables.length} kaynak tablosu · ${count(recordTotal)} kayıt · ${binaryKeys.length} binary dizi · ${model.sourceResults.length} analiz kaydı`),element('p','ga-muted','Salt okunur önizleme (sayfa başına 100 satır). Hiçbir kaynak veri gösterimden kaybolmaz; tam içerik JSON indirimiyle korunur.'));
  for(const [name,value] of tables)details.append(advancedTableBox(name,value));
  if(binaryKeys.length){const box=element('details','ga-psse-advanced-table'),list=element('div','ga-psse-advanced-list');box.append(element('summary','',`binary diziler · ${binaryKeys.length}`));for(const key of binaryKeys){const array=model.binaryArrays?.[key];list.append(element('div','ga-psse-advanced-list-row',`${key} · ${array?.type??'?'} · ${count(array?.count??0)}`));}box.append(list);details.append(box);}
  if(model.sourceResults.length){const box=element('details','ga-psse-advanced-table'),list=element('div','ga-psse-advanced-list');box.append(element('summary','',`analiz kayıtları · ${model.sourceResults.length}`));for(const result of model.sourceResults){const row=element('div','ga-psse-advanced-list-row',`${result.type} · ${result.evidence}`);row.title=JSON.stringify(result.values).slice(0,400);list.append(row);}box.append(list);details.append(box);}
  details.append(exportButton);
  return details;
 }
 /** Inventory column priority: name / YTM / gerilim / tip / işletme durumu first, source ids as secondary muted column. */
 interface ColumnDef{key:string;label:string;secondary?:boolean}
 function sourceColumns(target:PsseKind):ColumnDef[]{
  const columns:ColumnDef[]=[{key:'name',label:target==='substation'?'TM adı':target==='bus'?'Bara adı':'Ad'}];
  if(target!=='bus'&&target!=='substation')columns.push({key:'buses',label:'Baralar'});
  columns.push({key:'area',label:'YTM'},{key:'nominalKv',label:'Gerilim (kV)'},{key:'kind',label:'Tip'},{key:'status',label:'İşletme durumu'},{key:'id',label:'Kaynak kimlikleri',secondary:true});
  return columns;
 }
 function sourceCell(model:PsseModel,equipment:PsseEquipment,column:ColumnDef):HTMLTableCellElement{
  const td=element('td');
  if(column.key==='name')td.textContent=equipment.name||'—';
  else if(column.key==='buses'){td.textContent=equipment.buses.map(bus=>busNames.get(bus)??String(bus)).join(' → ')||'—';td.title=equipment.buses.join(' → ');}
  else if(column.key==='area'){const code=equipment.fields.area;if(code===undefined||code===null||code==='')td.textContent='—';else{const name=psseAreaName(model,Number(code));td.textContent=name?psseNamedCode(name,Number(code)):display(code);td.title=String(code);}}
  else if(column.key==='nominalKv')td.textContent=equipment.nominalKv===null?'—':display(equipment.nominalKv);
  else if(column.key==='kind')td.textContent=kindLabels[equipment.kind];
  else if(column.key==='status')td.textContent=statusLabel(equipment.status);
  else{td.className='ga-psse-cell-secondary';const bits=[equipment.id];for(const key of ['ibus','ckt','savIndex'])if(equipment.fields[key]!==undefined&&equipment.fields[key]!==null)bits.push(`${key} ${display(equipment.fields[key])}`);td.textContent=bits.join(' · ');}
  return td;
 }
 function renderSummary(model:PsseModel){
  const line=element('p','ga-psse-model-line');
  line.append(element('strong','',model.source.name),element('span','ga-psse-model-meta',` · ${model.source.format} · ${bytes(model.source.byteLength)} · ${model.completeness} · ${display(model.case.baseMva)} MVA · ${display(model.case.frequencyHz)} Hz · çözümleme ${model.timing.decodeMs.toFixed(1)} ms`));
  line.title=`SHA-256 ${model.source.sha256} · binary revizyon ${model.source.revision} · ${count(model.source.byteLength)} bayt`;
  const tech=element('details','ga-psse-advanced');
  tech.append(element('summary','','Teknik Detaylar'),element('code','ga-model-sha',model.source.sha256),element('p','ga-muted',`Binary revizyon ${model.source.revision} · ${count(model.source.byteLength)} bayt · çözümleme ${model.timing.decodeMs.toFixed(1)} ms · ${count(model.equipment.length)} kaynak kaydı`),element('p','ga-muted',`Model kapsamı: ${model.completeness} · ${model.completeness==='PARTIAL'?'Eksik elektriksel model; envanter tanısal inceleme içindir.':'Çözümlenen kaynak envanteri.'}`),element('p','ga-muted',model.case.title.filter(title=>title.trim()).join(' / ')||'Kaynak başlığı belirtilmemiş.'));
  const kpis=element('div','ga-psse-kpi-row');
  for(const key of KPI_KINDS){
   const total=model.equipment.filter(row=>row.kind===key).length,card=element('button','ga-psse-kpi');card.type='button';
   card.append(element('span','ga-psse-kpi-label',kindLabels[key]),element('span','ga-psse-kpi-count',count(total)));
   card.title=`${kindLabels[key]} envanter tablosunu göster`;card.setAttribute('aria-pressed',String(key===summaryKind));
   card.onclick=()=>{summaryKind=key;summaryPage=0;options.onKind?.(key);render();};
   kpis.append(card);
  }
  const bandCounts=psseVoltageBandCounts(model.equipment.filter(row=>row.kind==='bus').map(row=>row.nominalKv)),selected=new Set(psseBandFilter()),bandRow=element('div','ga-psse-band-row');
  bandRow.append(element('span','ga-psse-band-caption','Gerilim bandı:'));
  for(const band of PSSE_VOLTAGE_BANDS){
   const chip=element('button','ga-psse-band-chip');chip.type='button';
   chip.textContent=`${band.label} · ${count(bandCounts[band.id as keyof typeof bandCounts])}`;
   chip.title='Envanter tablolarını bu gerilim bandına indirger; ≤36 kV tek banttır.';chip.setAttribute('aria-pressed',String(selected.has(band.id)));
   chip.onclick=()=>{psseToggleBand(band.id);render();};
   bandRow.append(chip);
  }
  bandRow.append(element('span','ga-psse-band-unknown',`bilinmeyen: ${count(bandCounts.unknown)}`));
  const azoRow=element('div','ga-psse-azo-row');for(const config of REGION_CONFIG)azoRow.append(azoCard(model,config));
  const azoNote=element('p','ga-psse-azo-note','Adlar kaynak SAV sözlüklerinden (Arnam/Zoname/Owname) okunur; ZONE gerilim sınıfıdır, BM (bölge müdürlüğü) ≠ YTM. Kodsuz adlar doldurulmaz.');
  const tableSection=element('section','ga-psse-summary-inventory'),available=psseKinds.filter(key=>model.equipment.some(row=>row.kind===key));
  if(!available.includes(summaryKind))summaryKind=available[0]??'bus';
  const result=queryPsse(model,{kind:summaryKind,bands:psseBandFilter(),sort:'name',descending:false,page:summaryPage,pageSize:12});summaryPage=result.page;
  const caption=element('p','ga-psse-summary-caption',`${kindLabels[summaryKind]} envanteri · ${count(result.total)} kayıt${psseBandFilter().length?` · gerilim bandı filtresi etkin`:''}`);
  const table=element('table','ga-table'),thead=element('thead'),head=element('tr');for(const column of sourceColumns(summaryKind))head.append(element('th','',column.label));head.append(element('th','','Ayrıntı'));thead.append(head);
  const tbody=element('tbody');
  for(const equipment of result.rows){const row=element('tr');row.dataset.id=equipment.id;for(const column of sourceColumns(summaryKind))row.append(sourceCell(model,equipment,column));const td=element('td');td.append(button('Kaynak / detay',()=>showDetail(equipment)));row.append(td);tbody.append(row);}
  table.append(thead,tbody);const wrap=element('div','ga-psse-summary-wrap');wrap.append(table);
  tableSection.append(caption,wrap,tbody.children.length?pager(result.total,result.pages,summaryPage,next=>{summaryPage=next;render();}):element('p','ga-muted','Bu filtrede kayıt yok.'));
  body.replaceChildren(line,tech,kpis,bandRow,azoRow,azoNote,tableSection,renderAdvanced(model));
 }
 function renderQuality(model:PsseModel){
  const needle=search.trim().toLocaleLowerCase('tr'),findings=model.findings.filter(row=>(!severity||row.severity===severity)&&(!needle||JSON.stringify(row).toLocaleLowerCase('tr').includes(needle))),pages=Math.max(1,Math.ceil(findings.length/size));page=Math.min(page,pages-1);
  const cards=element('div','ga-model-health');for(const key of ['ERROR','WARNING','INFO']){const c=card(key,count(model.findings.filter(row=>row.severity===key).length));c.dataset.severity=key;cards.append(c);}
  const table=element('table','ga-table'),head=element('tr');for(const label of ['Önem','Kod','Kaynak kimliği','Bulgu'])head.append(element('th','',label));const thead=element('thead');thead.append(head);const tbody=element('tbody');for(const finding of findings.slice(page*size,(page+1)*size)){const row=element('tr');for(const value of [finding.severity,finding.code,finding.equipment,finding.message])row.append(element('td','',display(value)));tbody.append(row);}table.append(thead,tbody);const wrap=element('div','ga-table-wrap');wrap.append(table);
  body.replaceChildren(toolbar,cards,element('p','ga-notice',`Kaynak tanısı: ${model.completeness} · Solver uygunluğu Yük Akışı bölümünde yöntem bazında değerlendirilir · ${count(findings.length)} kaynak bulgusu`),findings.length?wrap:element('p','ga-muted','Bu filtrede bulgu yok; bu ifade analiz uygunluğu onayı değildir.'),pager(findings.length,pages,page));
  body.append(createPsseGeographyReport(model,options.getNetwork?.()??normalizePsseBusBranch(model)));
 }
 function renderEquipment(model:PsseModel){
  const available=psseKinds.filter(key=>model.equipment.some(row=>row.kind===key));if(!available.includes(kind))kind=available[0]??'bus';
  kinds.replaceChildren(...available.map(key=>{const b=button(kindLabels[key],()=>{kind=key;sort='id';update();});b.setAttribute('aria-pressed',String(key===kind));return b;}));kinds.setAttribute('aria-label',tab==='inventory'?'PSS/E envanter türleri':'PSS/E kayıtlı işletme türleri');
  const operating=tab==='operating',bands=psseBandFilter(),query={kind,search:search,status,sort,descending,page,pageSize:size,operating,bands,minKv:operating&&voltage?Number(voltage):undefined,maxKv:operating&&voltage?Number(voltage):undefined},result=queryPsse(model,query);page=result.page;
  const table=element('table','ga-table'),thead=element('thead');
  if(operating){
   const fields=[...new Set(model.equipment.filter(row=>row.kind===kind).flatMap(row=>Object.keys(row.operating)))];
   const keys=['id','name','buses','nominalKv','status',...fields.slice(0,10)],labels:Record<string,string>={id:'Kaynak kimliği',name:'Ad',buses:'Bara bağlantıları',nominalKv:'Nominal kV',status:'Kaynak durumu'};
   const head=element('tr');for(const key of keys){const th=element('th'),b=button((labels[key]??key)+(sort===key?(descending?' ↓':' ↑'):''),()=>{descending=sort===key?!descending:false;sort=key;update();});th.append(b);head.append(th);}head.append(element('th','','Ayrıntı'));thead.append(head);
   const tbody=element('tbody');
   for(const equipment of result.rows){const row=element('tr');row.dataset.id=equipment.id;for(const key of keys){const original=equipmentValue(equipment,key,operating),td=element('td','',display(original));td.title=typeof original==='object'?JSON.stringify(original):String(original??'Kaynakta belirtilmemiş');if(equipment.operating[key]){const value=equipment.operating[key];td.title=`${value.provenance} · ${value.field} = ${value.value}${value.unit?' · '+value.unit:''}${value.offset===undefined?'':' · byte '+value.offset}`;td.dataset.provenance=value.provenance;}row.append(td);}const td=element('td');td.append(button('Kaynak / detay',()=>showDetail(equipment)));row.append(td);tbody.append(row);}
   table.append(thead,tbody);
  }else{
   const columns=sourceColumns(kind),head=element('tr');
   for(const column of columns){const th=element('th');if(column.secondary)th.append(element('span','ga-psse-th-secondary',column.label));else{const b=button(column.label+(sort===column.key?(descending?' ↓':' ↑'):''),()=>{descending=sort===column.key?!descending:false;sort=column.key;update();});th.append(b);}head.append(th);}
   head.append(element('th','','Ayrıntı'));thead.append(head);
   const tbody=element('tbody');
   for(const equipment of result.rows){const row=element('tr');row.dataset.id=equipment.id;for(const column of columns){const td=sourceCell(model,equipment,column);if(column.key!=='id'&&column.key!=='buses'&&column.key!=='area')td.title=`${column.label}: ${display(equipmentValue(equipment,column.key))}`;row.append(td);}const td=element('td');td.append(button('Kaynak / detay',()=>showDetail(equipment)));row.append(td);tbody.append(row);}
   table.append(thead,tbody);
  }
  const wrap=element('div','ga-table-wrap');wrap.append(table);
  const note=element('p','ga-muted',operating?'Vm, Va, P/Q ve konumlar yalnız kaynakta bulunan değerlerdir. Hücre ipuçları kaynak alanı, birim ve varsa binary ofseti gösterir.':'Kaynak kimlikleri, bağlantılar ve durum kodları korunur; kimlik sütunu ikincil gösterilir. Tüm alanlar ekipman ayrıntısında bulunur.');
  body.replaceChildren(kinds,toolbar,note,wrap,pager(result.total,result.pages,result.page));
  if(operating&&model.sourceResults.length){const results=element('details','ga-psse-advanced');results.append(element('summary','','Kaynakta bulunan diğer analiz kayıtları'),element('pre','',JSON.stringify(model.sourceResults,null,2)));body.append(results);}
 }
 function render(){const model=options.getModel();if(!model){body.replaceChildren(element('p','ga-empty','PSS/E modeli bekleniyor.'));details.close();return;}
  busNames=new Map<number,string>();for(const row of model.equipment)if(row.kind==='bus'&&row.buses[0]!==undefined)busNames.set(row.buses[0],row.name||String(row.buses[0]));
  if(identity!==model.source.sha256){identity=model.source.sha256;page=0;summaryPage=0;lastFilter='';details.close();status='';voltage='';summaryKind='substation';rawPages={};azoFilters={};azoOpen={};advancedOpen={main:false,tables:{}};psseSetBandFilter([]);}
  const filter=JSON.stringify([search,status,voltage,severity,kind,size]);if(filter!==lastFilter){page=0;lastFilter=filter;}
  notice.dataset.completeness=model.completeness;
  const currentBands=psseBandFilter();bandSelect.value=currentBands.length===1&&[...bandSelect.options].some(option=>option.value===currentBands[0])?currentBands[0]:'';
  if(tab==='summary')renderSummary(model);else if(tab==='quality')renderQuality(model);else renderEquipment(model);}
 return{element:root,render,deactivate(){details.close();},setKind(value:PsseKind){kind=value;page=0;render();}};
}
