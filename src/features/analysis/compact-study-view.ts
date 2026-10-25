import {scCurrentKa,nominalKv,SC_NODE_LABELS} from '../../domain/results/sc-node';
import {populateVoltageGroups,selectVoltageGroup,scNodeFilter} from '../../domain/results/sc-view-scope';
import {voltageMatches} from '../../domain/model/voltage-band';
import {cleanStudy} from '../../domain/results/sc-persistence';
import {scDetail} from './sc-detail';
import {capacitySession} from '../../domain/model/capacity';
import type {AppContext,Feature} from '../../app/contracts';
import {element,button,format,downloadText,csvDocument} from '../../ui/components/dom';
import {requestedRole} from '../../ui/components/calculation-controls';
import {recordTable} from '../../analysis/ytm-study/export';
import {studyFamilies,studyScopeKey,ytmStudyIsCurrent,type YtmStudyOptions} from '../../analysis/ytm-study';
import {selectScMode} from '../../domain/results/sc-selection';
import {stableJson} from '../../domain/calculation/identity';
import {downloadComparisonWorkbook} from './comparison-export';
import {runEvidence,selectedCaseEvidence} from './run-evidence';
import {compactN1Rows,compactScRows,compactLfRows,sortCompactRows,type CompactRow,type LfList,type Triple} from './compact-rows';
import {analysisDialog} from './analysis-dialog';

export const SC_STATUS_FILTER_OPTIONS=[{value:'',label:'Tümü'},{value:'CALCULATED',label:'3F hesaplandı'},{value:'BLOCKED_OR_UNCOMPUTABLE',label:'Hesaplanamadı / engellendi'},{value:'PF_AVAILABLE',label:'PF 3F referansı mevcut'},{value:'NOT_RUN_OR_STALE',label:'Henüz çalıştırılmadı / eski sonuç'}] as const;
export function scStateMatches(value:string,r:{raw:Record<string,unknown>;metrics:{ikss?:{pf:number|null}}}){
 const status=String(r.raw.status_3F??'');if(!value)return true;
 if(value==='CALCULATED')return status==='CALCULATED_NETWORK_APPROXIMATION';
 if(value==='BLOCKED_OR_UNCOMPUTABLE')return ['BLOCKED','NOT_COMPUTABLE'].includes(status);
 if(value==='PF_AVAILABLE')return r.metrics.ikss?.pf!=null&&Number.isFinite(r.metrics.ikss.pf);
 return ['NOT_RUN','STALE'].includes(status);
}

export function createCompactStudyView(ctx:AppContext,openTools:()=>void):Feature{
 const root=element('div','ga-ytm-study ga-compact-study'),controls=element('div','ga-compact-controls'),status=element('p','ga-compact-status'),scNotice=element('p','ga-sc-notice'),kpis=element('div','ga-compact-kpis'),lists=element('nav','ga-compact-lists'),filters=element('div','ga-compact-filters'),host=element('div','ga-compact-table-host'),pager=element('div','ga-compact-pager');
 const nodeFilter=element('select');nodeFilter.setAttribute('aria-label','Sonuç düğüm sınıfı');nodeFilter.append(new Option('Tüm düğümler',''),...Object.entries(SC_NODE_LABELS).map(([v,label])=>new Option(label,v)));
 const area=element('select'),tm=element('select'),voltage=element('select'),profile=element('select'),mode=element('select'),search=element('input'),state=element('select'),metric=element('select');
 const selectLabel=(s:HTMLSelectElement,label:string)=>{s.setAttribute('aria-label',label);return s;};
 selectLabel(area,'Toplu analiz YTM');selectLabel(tm,'Toplu analiz TM');selectLabel(voltage,'Toplu analiz gerilim seviyesi');selectLabel(profile,'Toplu analiz profili');selectLabel(mode,'Görüntülenen SC modu');selectLabel(state,'Sonuç durum filtresi');selectLabel(metric,'Gösterilen LF metriği');search.setAttribute('aria-label','Toplu analiz sonuç filtresi');search.type='search';search.placeholder='Ekipman, TM, YTM veya FID ara';
 const populateVoltages=()=>populateVoltageGroups(voltage,ctx);populateVoltages();
 const n1StateOptions='<option value="">Tüm durumlar</option><option value="AC">AC sayısal / Hesaplanan</option><option value="DC">DC tarandı</option><option value="OVER">%100 üzeri</option><option value="PF">PF kaydı olan</option><option value="MISSING">Sayısal sonuç yok / Engellenen</option>';
 const scStateOptions=SC_STATUS_FILTER_OPTIONS.map(o=>`<option value="${o.value}">${o.label}</option>`).join('');
 profile.innerHTML='<option value="BALANCED">Dengeli</option><option value="FAST">Hızlı</option><option value="DETAILED">Ayrıntılı</option><option value="STRICT">Strict</option>';mode.innerHTML='<option>MAX</option><option>MIN</option>';state.innerHTML=ctx.analysisTab==='SC'?scStateOptions:n1StateOptions;metric.innerHTML='<option value="p">P (MW)</option><option value="q">Q (MVAr)</option><option value="loading">Yük (%)</option>';
 scNotice.textContent='⚠️ IEC 60909-0:2016 ağ yaklaşımı; IEC / PF paritesi doğrulanmadı. Eksik/engellenen sayılar sıfır kabul edilmez.';
 const settings=analysisDialog('Gelişmiş ayarlar'),evidence=analysisDialog('Yöntem ve kanıt'),detail=analysisDialog('Sonuç ayrıntısı');
 const number=(label:string,value:number)=>{const l=element('label','ga-field',label),input=element('input');input.type='number';input.step='any';input.value=String(value);input.setAttribute('aria-label',label);l.append(input);settings.body.append(l);return input;};
 const budget=number('Toplu analiz bütçe s',178),low=number('YTM min Vpu',.9),high=number('YTM max Vpu',1.1),loading=number('YTM yüklenme limiti %',100),modes=selectLabel(element('select'),'SC hesap modları');modes.innerHTML='<option value="BOTH">MAX + MIN</option><option>MAX</option><option>MIN</option>';
 const profileSetting=element('div','ga-field'),profileLabel=element('label','','N-1 Çalışma Profili'),profileSelect=selectLabel(element('select'),'N-1 Profil');
 profileSelect.innerHTML='<option value="BALANCED">Dengeli (DC tarama + kritik AC)</option><option value="FAST">Hızlı (Yalnız DC tarama)</option><option value="DETAILED">Ayrıntılı (Genişletilmiş AC)</option><option value="STRICT">Strict (Tam AC doğrulama)</option>';
 profileSetting.append(profileLabel,profileSelect,element('small','ga-muted','SC hesabı ağ yaklaşımını kullanır; MAX/MIN kaynak varsayımları ve veri yeterliliği ayrıca gösterilir. IEC/PF paritesi doğrulanmadı.'));
 settings.body.append(modes,profileSetting,element('p','ga-muted','Limitler düzenlenebilir kullanıcı eşikleridir. IEC 60909-0:2016 · ağ yaklaşımı; IEC doğrulanmadı.'));
 let lastNetwork:unknown,lastOptions:unknown,lastFamily='',lastTmArea='',tab='cases',page=0,sort='name',descending=false,rows:CompactRow[]=[],selected:CompactRow|null=null,lastRefs:unknown[]=[],lastKey='',lastDomKey='',lastDomRows:CompactRow[]|null=null;
 const scUnit='kA' as const;
 const options=():YtmStudyOptions=>{
  const prior=ctx.studyOptions??ctx.ytmStudy?.options,base={...prior,ytmId:area.value,tmId:tm.value||undefined,profile:(profile.value||profileSelect.value) as YtmStudyOptions['profile'],timeBudgetMs:Number(budget.value)*1000,families:[ctx.analysisTab==='SC'?'SC' as const:'N1' as const],scModes:modes.value==='BOTH'?undefined:[modes.value as 'MAX'|'MIN'],voltageBands:ctx.filters.voltages.size===5?undefined:[...new Set(ctx.network?.buses.filter(b=>voltageMatches(b.vnKv,ctx.filters.voltages)).map(b=>b.vnKv)??[])]};
  return {...base,...(prior?.voltageMinPu!==undefined||Number(low.value)!==.9?{voltageMinPu:Number(low.value)}:{}),...(prior?.voltageMaxPu!==undefined||Number(high.value)!==1.1?{voltageMaxPu:Number(high.value)}:{}),...(prior?.loadingLimitPercent!==undefined||Number(loading.value)!==100?{loadingLimitPercent:Number(loading.value)}:{})};
 };
 const start=(resume=false)=>{if(ctx.analysisTab==='LF'){void ctx.run('powerFlow',requestedRole(ctx));return;}const o=resume&&ctx.ytmStudy?{...options(),families:ctx.ytmStudy.options.families,scModes:ctx.ytmStudy.options.scModes}:options();ctx.studyOptions=o;void ctx.runYtmStudy?.(o,resume);};
 const run=button('Analiz Et',()=>start()),resume=button('Devam',()=>start(true)),cancel=button('İptal',()=>ctx.cancel()),settingsButton=button('Gelişmiş ayarlar',settings.open),evidenceButton=button('Yöntem ve kanıt',()=>{const proof={run:runEvidence(ctx),selected:selectedCaseEvidence(ctx),studyIdentity:ctx.ytmStudy?.identity,options:ctx.studyOptions};evidence.body.replaceChildren(element('p','','Sayısal çözüm; kaynak, yöntem veya PF eşdeğerliği doğrulaması değildir.'),button('Kanıt JSON',()=>downloadText(JSON.stringify(proof,null,2),'GA_Analysis_Evidence.local.json','application/json')),element('pre','',JSON.stringify(proof,null,2)));evidence.open();});
 const maxSortBtn=button('Maks. Akım',()=>{sort='maxIkss';descending=true;page=0;render();},'Maksimum kısa devre akımına göre azalan sırala');
 controls.append(area,tm,voltage,profile,mode,run,resume,cancel,settingsButton,button('Gelişmiş araçlar',openTools),evidenceButton);status.setAttribute('role','status');root.append(controls,status,scNotice,kpis,lists,filters,host,pager,settings.element,evidence.element,detail.element);
 function scopeChanged(){if(lastTmArea!==area.value){tm.value='';ctx.filters.siteId='';}ctx.filters.areaId=area.value;ctx.filters.siteId=tm.value;page=0;ctx.notify();}
 for(const field of [area,tm,voltage,profile,profileSelect,modes,low,high,loading])field.addEventListener('change',()=>{if(field===voltage)selectVoltageGroup(ctx,voltage.value);if(field===profileSelect)profile.value=profileSelect.value;else if(field===profile)profileSelect.value=profile.value;if(field!==area&&field!==tm&&field!==voltage)ctx.studyOptions=options();scopeChanged();});budget.onchange=()=>{ctx.studyOptions=options();};mode.onchange=()=>{ctx.resultView.scMode=mode.value as 'MAX'|'MIN';if(!selectScMode(ctx,ctx.resultView.scMode))ctx.setMessage('3F '+mode.value+' seçildi. Hesaplamak için Analiz Et.');page=0;ctx.notify();};
 const changed=()=>{page=0;render();};search.oninput=changed;state.onchange=changed;nodeFilter.onchange=()=>{ctx.resultView.scNodeKind=nodeFilter.value;if(ctx.benchmarkMap?.analysis==='SC')ctx.benchmarkMap={...ctx.benchmarkMap,nodeKind:nodeFilter.value};page=0;ctx.notify();};metric.onchange=()=>render();
 const list=(key:string,label:string)=>{const b=button(label,()=>{tab=key;page=0;sort='name';lastKey='';render();});b.dataset.list=key;lists.append(b);};
 const filtered=()=>{
  const q=search.value.toLocaleLowerCase('tr-TR'),family=ctx.analysisTab;
  const rowVoltageMatches=(r:CompactRow)=>voltageMatches(r.kv,ctx.filters.voltages);
  const stateMatches=(r:CompactRow)=>{
   if(!state.value)return true;
   if(family==='SC')return scStateMatches(state.value,r);
   return state.value==='AC'&&r.acLabel?.startsWith('Sayısal')||state.value==='DC'&&r.dcLabel?.startsWith('Tarandı')||state.value==='OVER'&&(r.loading!=null&&r.loading>100||r.overloads?.length)||state.value==='PF'&&(Object.values(r.metrics).some(v=>v.pf!==null)||r.overloads?.some(v=>v.source==='PF'))||state.value==='MISSING'&&!Object.values(r.metrics).some(v=>v.ga!==null)&&!r.acLabel?.startsWith('Sayısal')&&!r.dcLabel?.startsWith('Tarandı');
  };
  return sortCompactRows(rows.filter(r=>(!q||r.searchText.includes(q))&&rowVoltageMatches(r)&&stateMatches(r)&&(family!=='SC'||!nodeFilter.value||r.raw.nodeKind===nodeFilter.value)),sort,descending);
 };
 function exportRows(){
  const family=ctx.analysisTab,identity=runEvidence(ctx).resultIdentity;
  if(family==='SC'){
   return filtered().map(r=>({
    YTM:r.ytm,
    TM:r.tm,
    Bara_FID:r.fid,
    Bara_Adi:r.name,
    Goruntuleme_FID:r.raw.displayFid??r.fid,
    Baz_kV:r.kv,
    Gerilim_kV:r.metrics.voltage?.ga??null,
    Aci_deg:r.metrics.angle?.ga??null,
    '3F_Ikss_A':r.raw.GA_3F_Ikss_A??null,
    '3F_Ikss_kA':r.raw.GA_3F_Ikss_kA??null,
    PF_3F_Ikss_kA:r.metrics.ikss?.pf??null,
    Fark_3F_kA:r.metrics.ikss?.delta??null,
    Hesap_Durumu:r.raw.Hesap_Durumu,
    Durum_3F:r.raw.status_3F,
    Gerekce_3F:r.raw.reason_3F,
    Mod:r.raw.mode,
    electricalBusId:r.raw.electricalBusId,
    siteIds:r.raw.siteIds,
    Z3F_DrivingPoint_R_ohm:r.raw.Z3F_DrivingPoint_R_ohm,
    Z3F_DrivingPoint_X_ohm:r.raw.Z3F_DrivingPoint_X_ohm,
    Standard:'IEC60909-0:2016',
    IEC_Dogrulandi:0,
    identity_json:JSON.stringify(identity),
    Tanisal_Fark_3F_kA:r.raw.diagnosticDelta_kA??null,
    Dugum_Sinifi:r.raw.nodeKind,
    Dugum_Kaniti:r.raw.nodeEvidence,
    PF_reference_file:ctx.benchmark?.groups.SC.workbook.file??null,
    PF_reference_sha256:ctx.benchmark?.groups.SC.workbook.sha256??null
   }));
  }
  return filtered().map(r=>({...r.raw,TM:r.tm,YTM:r.ytm,identity_json:JSON.stringify(identity),PF_reference_file:ctx.benchmark?.groups[family].workbook.file??null,PF_reference_sha256:ctx.benchmark?.groups[family].workbook.sha256??null,...(r.overloads?{overloads:JSON.stringify(r.overloads)}:{})}));
 }
 const exportCsv=button('CSV',()=>downloadText(csvDocument(recordTable(exportRows())),'GA_'+ctx.analysisTab+'.local.csv','text/csv;charset=utf-8')),exportXlsx=button('XLSX',()=>downloadComparisonWorkbook([{name:ctx.analysisTab,rows:recordTable(exportRows())}],'GA_'+ctx.analysisTab+'_Table.local.xlsx')),exportJson=button('JSON',()=>downloadText(JSON.stringify({schemaVersion:ctx.analysisTab==='SC'?'GA_SC_3PH_1':undefined,identity:runEvidence(ctx).resultIdentity,mode:ctx.analysisTab==='SC'?mode.value:undefined,tab,rows:exportRows()},null,2),'GA_'+ctx.analysisTab+'_Table.local.json','application/json'));
 filters.append(search,nodeFilter,maxSortBtn,state,metric,exportCsv,exportXlsx,exportJson,button('Tüm çalışma JSON',()=>{const current=runEvidence(ctx);downloadText(JSON.stringify(current.stale?{run:current}:ctx.analysisTab==='LF'?ctx.resultStore.active:cleanStudy(ctx.ytmStudy)??{hybrid:ctx.hybridResult,sc:ctx.scResult},null,2),'GA_YTM_Study.local.json','application/json');}));
 const previous=button('Önceki',()=>{page--;render();}),next=button('Sonraki',()=>{page++;render();}),count=element('span');pager.append(previous,count,next);
 function showDetail(row:CompactRow){
  selected=row;const d=detail.body,family=ctx.analysisTab;
  detail.element.classList.toggle('ga-sc-result-dialog',family==='SC');
  if(family==='SC'){d.replaceChildren(scDetail(row,'GA',()=>toMap(row)));detail.open();return;}
  d.replaceChildren(element('h3','',row.name),element('p','',row.fid+' · '+row.status+(row.acLabel?' · '+row.acLabel:'')),button('Haritada göster',()=>toMap(row)),button('Tam kayıt JSON',()=>downloadText(JSON.stringify(row.detail,null,2),'GA_'+ctx.analysisTab+'_'+row.fid+'.json','application/json')));
  if(row.caseId){const c=ctx.hybridResult?.cases.find(c=>c.outage.caseId===row.caseId);ctx.resultView.caseId=row.caseId;
   for(const [source,label] of [['GA_AC','GA AC >%100'],['GA_DC','GA DC yaklaşık >%100'],['PF','PF kayıtlı >%100']] as const){const values=row.overloads?.filter(v=>v.source===source)??[];d.append(element('h3','',label),element('p','',values.length?values.map(v=>v.name+' ['+v.fid+'] '+(source==='GA_DC'?'~':'')+format(v.percent)+'% · '+v.ytm+(v.boundary?' · sınır ötesi':'')).join('\n'):source==='PF'?'Kayıt bulunmadı; PF tam POST matrisi değildir.':row.missingDetail||'Saklanan kayıtta %100 üzeri ekipman yok.'));}
   d.append(element('p','',c?.mapResults?'Saklanan POST ayrıntısı mevcut. PRE/POST aynı vaka ve ekipman kimliğinden gösterilir.':'Tam POST ayrıntısı yok; eksik P/Q/I sıfır kabul edilmez.'));
   if(!c?.mapResults)d.append(button('Vaka ayrıntısını önbellekten yükle',()=>void ctx.loadHybridCaseDetail(row.caseId!).then(ok=>{if(ok&&ctx.ytmStudy){ctx.ytmStudy={...ctx.ytmStudy,n1:ctx.hybridResult};lastKey='';render();const fresh=rows.find(r=>r.key===row.key);if(fresh){detail.close();showDetail(fresh);}}else ctx.setMessage('Bu vaka için saklanmış ayrıntı kaydı yok.');})));
   if(c?.mapResults){const table=element('table','ga-compact-detail-table');table.innerHTML='<thead><tr><th>Ekipman FID</th><th>PRE P</th><th>POST P</th><th>POST Q</th><th>I (A)</th><th>Yük (%)</th></tr></thead>';const body=element('tbody');for(const b of c.mapResults.branches.slice(0,20)){const tr=element('tr'),pre=ctx.hybridResult?.basePost?.branches.find(x=>x.sourceClass===b.sourceClass&&x.fid===b.fid);for(const v of [b.fid,pre?.pf??null,b.pf,b.qf,b.ifA,b.loading.operationalPercent])tr.append(element('td','',typeof v==='string'?v:format(v)));body.append(tr);}table.append(body);d.append(table,element('p','ga-muted','İlk 20 POST kaydı; tüm matris Tam kayıt JSON içinde korunur.'));}
  }
  d.append(element('pre','ga-compact-raw',JSON.stringify(row.raw,null,2)));detail.open();
 }
 function toMap(row:CompactRow){ctx.resultView.analysis=ctx.analysisTab;ctx.resultView.source='GA';if(row.caseId){ctx.resultView.caseId=row.caseId;void ctx.loadHybridCaseDetail(row.caseId);}else if(row.faultId){ctx.resultView.faultId=row.faultId;selectScMode(ctx,mode.value as 'MAX'|'MIN');}else ctx.select(row.fid,row.cls);detail.close();ctx.setView('map');}
 const triplet=(v:Triple|undefined)=>{const cell=element('div','ga-compact-triple');const entries:Array<[string,number|null|undefined]>=[['GA',v?.ga]];if(v?.pf!=null){entries.push(['PF',v.pf]);if(v.delta!=null)entries.push([v.reason?'Δ tanısal':'Δ',v.delta]);}for(const [label,value] of entries){const line=element('span');line.append(element('small','',label),element('b','',(label.startsWith('Δ')&&value!=null&&value>0?'+':'')+format(value,3)));cell.append(line);}cell.title=v?.reason??'PF referansı yok';return cell;};
 function render(){
  const family=ctx.analysisTab;
  populateVoltages();nodeFilter.value=scNodeFilter(ctx);
  if(lastNetwork!==ctx.network){lastNetwork=ctx.network;populateVoltages();lastTmArea='';area.replaceChildren(new Option('Tüm YTM',''));for(const id of new Set(ctx.network?.sites.map(s=>s.areaId).filter(Boolean)??[])){const o=element('option','',ctx.network!.sites.find(s=>s.areaId===id)!.areaName);o.value=id;area.append(o);}area.value=ctx.filters.areaId;}
  if(area.value!==ctx.filters.areaId)area.value=ctx.filters.areaId;
  if(lastTmArea!==area.value){lastTmArea=area.value;tm.replaceChildren(element('option','','Tüm TM'));tm.options[0].value='';for(const s of ctx.network?.sites.filter(s=>s.areaId===area.value)??[]){const o=element('option','',s.name);o.value=s.id;tm.append(o);}tm.value=ctx.filters.siteId;if(tm.selectedIndex<0)tm.value='';}
  tm.value=ctx.filters.siteId;
  const stored=ctx.studyOptions??ctx.ytmStudy?.options;if(stored&&lastOptions!==stored){lastOptions=stored;profile.value=stored.profile??'BALANCED';profileSelect.value=stored.profile??'BALANCED';low.value=String(stored.voltageMinPu??.9);high.value=String(stored.voltageMaxPu??1.1);loading.value=String(stored.loadingLimitPercent??100);budget.value=String((stored.timeBudgetMs??178000)/1000);populateVoltages();modes.value=stored.scModes?.length===1?stored.scModes[0]:'BOTH';}
  if(lastFamily!==family){lastFamily=family;tab=family==='LF'?'lines':family==='SC'?'sc':'cases';lists.replaceChildren();if(family==='LF'){list('lines','Hatlar');list('transformers','Trafolar');list('buses','Baralar');}else if(family==='N1'){list('cases','Kesintiler');list('overloads','Aşırı yüklenen ekipmanlar');}else list('sc','Bara akımları · 3F');state.innerHTML=family==='SC'?scStateOptions:n1StateOptions;state.value='';page=0;lastKey='';}
  mode.hidden=family!=='SC';profile.hidden=family!=='N1';modes.hidden=family!=='SC';scNotice.hidden=family!=='SC';nodeFilter.hidden=family!=='SC';maxSortBtn.hidden=family!=='SC';mode.value=ctx.resultView.scMode??ctx.scResult?.profile.calculateMode??mode.value;metric.hidden=family!=='LF'||tab==='buses';root.dataset.metric=metric.value;root.dataset.family=family;run.disabled=ctx.busy||!ctx.network||family!=='LF'&&!area.value;cancel.hidden=!ctx.busy;cancel.disabled=!ctx.busy;
  const current=!!(ctx.ytmStudy&&ctx.network&&ytmStudyIsCurrent(ctx.ytmStudy,ctx.network,ctx.scenario.current,ctx.analysisSettings.value,ctx.studyOptions));const pending=family==='N1'?ctx.ytmStudy?.n1?.cases.some(c=>['NOT_RUN_BUDGET','NOT_EVALUATED_BUDGET','CANCELLED','DC_UNSCREENABLE'].includes(c.status)):ctx.ytmStudy&&(ctx.ytmStudy.options.scModes??['MAX','MIN']).some(m=>{const sc=m==='MAX'?ctx.ytmStudy!.scMax:ctx.ytmStudy!.scMin;return (ctx.ytmStudy!.pendingCounts?.[m==='MAX'?'SC_MAX':'SC_MIN']??0)>0||!sc||sc.faults.some(f=>f.status==='CANCELLED');});resume.hidden=family==='LF'||!ctx.ytmStudy||!pending;resume.disabled=ctx.busy||!current||ctx.studyResumeAvailable===false||!ctx.ytmStudy||!studyFamilies(ctx.ytmStudy.options).includes(family==='SC'?'SC':'N1');
  voltage.options[0].textContent='Tüm gerilimler';
  const proof=runEvidence(ctx);if(proof.stale&&detail.element.open)detail.close();root.dataset.resultId=JSON.stringify(proof.resultIdentity);root.dataset.workflow=proof.workflow;status.textContent=`${ctx.network?.name??'Model yüklenmedi'} · ${ctx.resultStore.role==='base'&&family==='LF'?'Baz':ctx.scenario.selected.name} · ${proof.label}${proof.retainedFamily?' · önceki geçerli aile kaydı':''}${proof.elapsedMs===null?'':' · '+format(proof.elapsedMs/1000,1)+' s'}${ctx.busy?' · '+ctx.status:''}`;
  const refs=[ctx.network,ctx.ytmStudy,ctx.hybridResult,ctx.scResult,ctx.resultStore.active,ctx.benchmark,ctx.powerFactoryReference,ctx.powerFactoryControlContextNumericFile],key=[family,tab,ctx.resultView.source,ctx.filters.areaId,ctx.filters.siteId,stableJson(ctx.analysisSettings.value),ctx.studyOptions?studyScopeKey(ctx.studyOptions):'',proof.stale,proof.workflow,proof.acCalculated,proof.acAttempted,ctx.resultStore.role,ctx.network?capacitySession(ctx.network.modelHash).revision:0].join('|');
  if(key!==lastKey||!refs.every((r,i)=>r===lastRefs[i])){lastKey=key;lastRefs=refs;rows=proof.stale&&!(family==='SC'&&ctx.resultView.source==='PF')?[]:family==='N1'?compactN1Rows(ctx):family==='SC'?compactScRows(ctx,ctx.resultView.source==='PF'?'PF':'GA'):compactLfRows(ctx,tab as LfList);if(family==='N1'&&tab==='overloads')rows=rows.flatMap(r=>(r.overloads??[]).map(v=>({...r,key:r.key+'|'+v.source+'|'+v.cls+'|'+v.fid,name:v.name,fid:v.fid,cls:v.cls,kv:v.kv,ytm:v.ytm,status:v.source,loading:v.percent,loadingSource:v.source==='GA_DC'?'~DC':v.source==='GA_AC'?'AC':'PF seyrek',overloads:[v],raw:{...r.raw,affectedFID:v.fid,affectedName:v.name,evidenceSource:v.source,postLoadingPercent:v.percent}})));}
  const values=filtered(),pages=Math.max(1,Math.ceil(values.length/50));page=Math.max(0,Math.min(page,pages-1));previous.disabled=page===0;next.disabled=page===pages-1;count.textContent=`${values.length} / ${rows.length} kayıt · ${page+1}/${pages}${family==='SC'?' · elektriksel bara başına tek satır':''}`;
  const domKey=[key,ctx.status,ctx.resultView.source,[...ctx.filters.voltages].sort().join(','),nodeFilter.value,search.value,state.value,metric.value,sort,descending,page].join('|');if(domKey===lastDomKey&&rows===lastDomRows)return;lastDomKey=domKey;lastDomRows=rows;
  const cards=family==='N1'?[['Aday',proof.candidateCount],['DC taranan',proof.dcScreened],['AC denenen',proof.acAttempted],['AC sayısal',proof.acCalculated],['AC doğrulanan',proof.acVerified],['DC∪AC farklı',proof.distinctNumerical]]:family==='SC'?[['Elektriksel bara',proof.electricalBuses],['Fiziksel terminal',proof.physicalTerminals],['Yaklaşık hesaplanan',proof.numericalAvailable],['PF 3F değeri bulunan',values.filter(r=>r.metrics.ikss?.pf!=null).length],['Karşılaştırılabilirliği doğrulanan',values.filter(r=>r.metrics.ikss?.delta!=null).length]]:[['Sayısal bara',proof.numericalAvailable],['Listede kayıt',rows.length],['Kontrol',proof.numericalAvailable?'Kısmi':'—']];kpis.replaceChildren(...cards.map(([label,value])=>{const card=element('div');if(label==='Kontrol')card.title='Newton–Raphson sayısal yakınsaması kontrol kapsamından ayrıdır; kısmi kontrol PF yöntem eşdeğerliği değildir.';card.append(element('small','',String(label)),element('strong','',String(value)));return card;}));for(const b of lists.querySelectorAll<HTMLButtonElement>('[data-list]'))b.setAttribute('aria-pressed',String(b.dataset.list===tab));
  host.replaceChildren();if(!ctx.network||proof.stale&&!(family==='SC'&&ctx.resultView.source==='PF')){host.append(element('p','ga-notice',proof.stale?'Sonuç farklı model, senaryo, kapsam veya ayara ait. Güncel liste ve dışa aktarıma alınmadı.':'Önce bir model yükleyin.'));return;}
  const table=element('table','ga-compact-table'),cols=element('colgroup'),thead=element('thead'),tr=element('tr'),tbody=element('tbody');
  const columns=family==='SC'?[['tm','TM'],['name','Bara / Düğüm'],['nodeType','Tür'],['kv','Baz kV'],['u','U(kV)'],['angle','Açı(°)'],['ikss3F','3F Ikss (kA)'],['pfSc','PF 3F Ikss (kA)'],['diagnostic','Tanısal fark (kA)'],['status','Durum'],['detail','Detay']]:family==='N1'?[['name',tab==='overloads'?'Ekipman':'Kesinti'],['kv','kV'],['dc','DC'],['ac','AC'],['loading','Maks. yük (%)'],['over','>%100 etkilenen'],['detail','Detay']]:tab==='buses'?[['tm','TM'],['name','Bara'],['kv','kV'],['ga','GA U (kV)'],['pf','PF U (kV)'],['delta','ΔU (kV)'],['detail','Detay']]:[['name',tab==='lines'?'Hat':'Trafo'],['kv',tab==='lines'?'kV':'HV kV'],['p',tab==='lines'?'P (MW)':'P HV (MW)'],['q',tab==='lines'?'Q (MVAr)':'Q HV (MVAr)'],['loading','Yük (%)'],['detail','Detay']];
  for(const [key,label] of columns){const col=element('col');col.dataset.column=key;cols.append(col);const th=element('th');th.dataset.column=key;th.scope='col';th.append(key==='detail'?element('span','',label):button(label,()=>{descending=sort===key?!descending:false;sort=key;page=0;render();}));tr.append(th);}thead.append(tr);table.append(cols,thead,tbody);
  for(const row of values.slice(page*50,(page+1)*50)){const line=element('tr');line.tabIndex=0;line.dataset.fid=row.fid;line.dataset.caseId=row.caseId??'';line.dataset.rowKey=row.key;line.onclick=()=>{selected=row;line.setAttribute('aria-selected','true');};line.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();showDetail(row);}};line.ondblclick=()=>toMap(row);
   for(const [key,label] of columns){const td=element('td');td.dataset.column=key;td.dataset.label=label;
    if(key==='name'){td.append(element('strong','ga-compact-name',row.name),element('small','',row.fid+(family==='N1'?' · '+row.tm:'')));td.title=row.name+' · Kaynak FID: '+row.fid+(row.raw.displayFid&&row.raw.displayFid!==row.fid?' · Görüntüleme FID: '+row.raw.displayFid:'');}
    else if(key==='kv')td.textContent=nominalKv(row.kv);
    else if(key==='tm'){td.textContent=row.tm;td.title=row.tm;}
    else if(key==='u'){const uVal=row.metrics.voltage?.ga;td.textContent=uVal!=null?format(uVal,2):'—';td.title=uVal!=null?`${format(uVal,2)} kV (LF)`:'LF sonucu yok';}
    else if(key==='angle'){const aVal=row.metrics.angle?.ga;td.textContent=aVal!=null?format(aVal,1)+'°':'—';td.title=aVal!=null?`${format(aVal,1)}° (LF)`:'LF sonucu yok';}
    else if(key==='ikss3F'){
     const ga=row.metrics.ikss?.ga,pf=row.metrics.ikss?.pf,delta=row.metrics.ikss?.delta,st3F=row.raw.status_3F;
     if(st3F==='CALCULATED_NETWORK_APPROXIMATION'&&ga!=null&&Number.isFinite(ga)){
      const valStr=scCurrentKa(ga);td.textContent=valStr;
      const diffStr=delta!=null?` (PF: ${scCurrentKa(pf)} ${scUnit}, Δ: ${delta>0?'+':''}${scCurrentKa(delta)} ${scUnit})`:'';
      td.title=`3F Ikss: ${valStr} ${scUnit}${diffStr}`;
     }else if(st3F==='BLOCKED'){td.textContent='Engellendi';td.className='ga-sc-status-blocked';td.title='Engellendi: '+(row.raw.reason_3F||st3F);}
     else if(st3F==='NOT_COMPUTABLE'){td.textContent='Hesaplanamaz';td.className='ga-sc-status-uncomputed';td.title='Hesaplanamaz: '+(row.raw.reason_3F||st3F);}
     else if(st3F==='NOT_RUN'){td.textContent='Hesaplanmadı';td.className='ga-sc-status-notrun';td.title='3F hesabı çalıştırılmadı';}
     else if(st3F==='STALE'){td.textContent='Güncel Değil';td.className='ga-sc-status-stale';td.title='3F sonucu güncel değil (STALE)';}
     else{td.textContent=String(st3F||'Hesaplanamadı');td.className='ga-sc-status-uncomputed';td.title=String(row.raw.reason_3F||st3F);}
    }
    else if(key==='pfSc'){td.textContent=scCurrentKa(row.metrics.ikss?.pf);td.title=String(row.raw.referenceReason??'PF referansı yok');}
    else if(key==='diagnostic'){td.textContent=format(row.raw.diagnosticDelta_kA as number|null,3);td.title='TANISAL GA−PF; doğrulanmış parite değildir · '+String(row.raw.referenceReason??'');}
    else if(key==='status'){td.textContent=row.raw.Hesap_Durumu==='CALCULATED'?'Hesaplandı':String(row.raw.Hesap_Durumu);td.title=String(row.raw.reason_3F??'');}
    else if(key==='nodeType')td.textContent=String(row.raw.nodeLabel??'Sınıfı doğrulanamadı');
    else if(key==='dc')td.textContent=row.dcLabel??'Taranmadı';
    else if(key==='ac'){td.textContent=row.acLabel??row.status;td.title=row.status;}
    else if(key==='over'){const values=row.overloads?.filter(v=>v.source===(row.loadingSource==='AC'?'GA_AC':row.loadingSource==='PF seyrek'?'PF':'GA_DC'))??[];td.textContent=values.length?values.slice(0,2).map(v=>v.name).join('; ')+(values.length>2?' +'+(values.length-2):''):row.missingDetail||'Saklanan kayıtta yok';td.title=values.map(v=>v.name+' ['+v.fid+']').join('; ')||td.textContent;const text=td.textContent;td.replaceChildren(element('span','ga-compact-name',text??''));}
    else if(key==='detail')td.append(button('›',()=>showDetail(row),row.name+' ayrıntısı'));
    else if(family==='LF'&&tab!=='buses')td.append(triplet(row.metrics[key]));
    else if(key==='loading')td.textContent=(row.loading==null?'—':row.loadingSource==='~DC'?'~'+format(row.loading):format(row.loading))+(row.loadingSource?' · '+row.loadingSource:'');
    else{const v=row.metrics[family==='SC'?'ikss':'voltage'],value=key==='ga'?v?.ga:key==='pf'?v?.pf:v?.delta;td.textContent=(key==='delta'&&value!=null&&value>0?'+':'')+format(value,3);td.title=v?.reason??'';}
    line.append(td);
   }tbody.append(line);
  }host.append(table);if(!values.length)host.append(element('p','ga-muted','Bu kapsam/filtrede kayıt yok. Eksik sayılar sıfır kabul edilmez.'));
 }
 return {element:root,render};
}
