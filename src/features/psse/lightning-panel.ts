import type {AppContext} from '../../app/contracts';
import type {PsseCalculationResult} from '../../domain/psse/results';
import {pssePublicationStatus} from '../../domain/psse/results';
import {button,element} from '../../ui/components/dom';
import {busSavedAngle,busSavedVoltage,fmt,getPsseDiagramSnapshot,normalizedKey,sourceResultLabel,type PsseDiagramSnapshot} from './diagram-utils';
import {createPsseDisplayNames} from './display-names';
import {getPsseResultComparison,psseFiniteDelta,type PsseResultComparison} from './result-comparison';
import {createPsseResultValues,type PsseBusDisplayValues as BusValues,type PsseBranchDisplayValues as BranchValues} from './result-values';
import './psse-diagrams.css';

export type PsseLightningTab='LF'|'SCENARIOS';
type ValueLayer='source'|'base'|'scenario'|'delta';
type RowKind='buses'|'branches';
const PAGE_SIZE=100;
const LAYERS:readonly {key:ValueLayer;label:string}[]=[{key:'source',label:'Kaynak kaydı'},{key:'base',label:'Baz'},{key:'scenario',label:'Senaryo'},{key:'delta',label:'Fark (Senaryo − Baz)'}];
const emptyBranch=():BranchValues=>({pFromMw:null,qFromMvar:null,pToMw:null,qToMvar:null,iFromA:null,iToA:null,loadingFromPct:null,loadingToPct:null});

/** The panel reads only the isolated PSS/E store and never promotes source records to solved flows. */
export function createPsseLightningPanel(ctx:AppContext){
 const panel=element('section','ga-psse-lightning'),head=element('header','ga-psse-lightning-head'),title=element('strong','','⚡ Elektriksel Sonuçlar'),identity=element('small'),body=element('div','ga-psse-lightning-body');
 panel.hidden=true;panel.setAttribute('aria-label','PSS/E elektriksel sonuçlar');
 let active:PsseLightningTab='LF',layer:ValueLayer='source',kind:RowKind='buses',page=0,layerChosen=false;
 const hide=()=>{panel.hidden=true;},minimize=button('−',()=>{body.hidden=!body.hidden;minimize.textContent=body.hidden?'□':'−';},'Paneli küçült / geri aç'),close=button('×',hide,'Sonuç panelini kapat');
 head.append(title,identity,minimize,close);panel.append(head,body);
 const tabs=element('nav','ga-psse-lightning-tabs');tabs.setAttribute('aria-label','Elektriksel sonuç sekmeleri');
 for(const [key,label]of [['LF','Yük Akışı'],['SCENARIOS','Senaryolar']]as const){const tab=button(label,()=>{active=key;page=0;render();});tab.dataset.tab=key;tabs.append(tab);}
 for(const [label,reason]of [['Kısıt (N-1)','Bu pakette PSS/E N-1 sonuç motoru yok.'],['Kısa Devre','Bu pakette PSS/E kısa devre sonuç motoru yok; .iec bir kısa devre sonucu değildir.']]){const tab=button(label,()=>{});tab.disabled=true;tab.title=reason;tabs.append(tab);}
 const status=element('p','ga-psse-lightning-status'),context=element('p','ga-psse-lightning-context'),tools=element('div','ga-psse-lightning-tools'),layerSelect=element('select'),kindSelect=element('select'),search=element('input'),tableWrap=element('div','ga-psse-lightning-table-wrap'),table=element('table','ga-table ga-psse-lightning-table'),pager=element('div','ga-psse-lightning-pager');
 status.setAttribute('role','status');layerSelect.setAttribute('aria-label','Sonuç katmanı');for(const item of LAYERS)layerSelect.append(new Option(item.label,item.key));kindSelect.setAttribute('aria-label','Sonuç tablosu');kindSelect.append(new Option('Baralar','buses'),new Option('Hat ve trafolar','branches'));search.type='search';search.placeholder='Ekipman / TM adı ara';search.setAttribute('aria-label','Elektriksel sonuçlarda ekipman veya TM adı ara');
 layerSelect.onchange=()=>{layer=layerSelect.value as ValueLayer;layerChosen=true;page=0;render();};kindSelect.onchange=()=>{kind=kindSelect.value as RowKind;page=0;render();};search.oninput=()=>{page=0;render();};tools.append(layerSelect,kindSelect,search);tableWrap.append(table);
 const previous=button('←',()=>{page--;render();},'Önceki sonuç sayfası'),pageInfo=element('span','ga-muted'),next=button('→',()=>{page++;render();},'Sonraki sonuç sayfası');pager.append(previous,pageInfo,next);
 const scenarioActions=element('div','ga-psse-lightning-tools'),method=element('select');method.setAttribute('aria-label','Senaryo hesap yöntemi');method.append(new Option('Newton–Raphson','NR_POLAR'),new Option('FDNS','FDNS_XB'),new Option('DC','LOSSLESS_DC'));method.value='NR_POLAR';let methodChosen=false;method.onchange=()=>{methodChosen=true;};
 const recalculate=button('Yeniden hesapla',()=>{void ctx.runPsseCalculation(method.value as PsseCalculationResult['method']).catch(error=>ctx.setMessage(error instanceof Error?error.message:'PSS/E hesabı tamamlanamadı.'));},'Seçili PSS/E yöntemini son kullanılan yöntem ayarlarıyla yeniden hesapla'),reset=button('Tüm işlemleri geri al',()=>{ctx.setPsseScenario([]);ctx.setMessage('PSS/E senaryosu baz durumuna döndü; sonuç için yeniden hesaplayın.');render();},'Senaryodaki tüm işlemleri geri al');scenarioActions.append(method,recalculate,reset);
 const provenance=element('details','ga-psse-lightning-provenance'),provenanceBody=element('div');provenance.append(element('summary','','Kaynak ve hesap ayrıntıları'),provenanceBody);body.append(tabs,status,context,tools,scenarioActions,tableWrap,pager,provenance);

 function resultFor(comparison:PsseResultComparison):PsseCalculationResult|null{return layer==='base'?comparison.base:layer==='scenario'?comparison.scenario:null;}
 function difference<T extends BusValues|BranchValues>(base:T,scenario:T):T{return Object.fromEntries(Object.keys(base).map(key=>[key,psseFiniteDelta(base[key as keyof T] as number|null|undefined,scenario[key as keyof T] as number|null|undefined)]))as T;}
 function renderProvenance(snapshot:PsseDiagramSnapshot,comparison:PsseResultComparison){
  const result=resultFor(comparison),rows=[`Dosya: ${snapshot.model.source.name}`,`Kaynak: ${sourceResultLabel(snapshot)} · SHA-256 ${snapshot.model.source.sha256}`,`Model: ${snapshot.base.modelHash}`,`Senaryo: ${snapshot.scenario.hash}`];
  for(const [label,value]of [['Baz',comparison.base],['Senaryo',comparison.scenario]]as const)if(value)rows.push(`${label}: ${value.source} · ${value.method} · ${pssePublicationStatus(value)} · ${value.classification} · fizik ${value.physicsCoverage} · iterasyon ${value.iterations} · max ΔP/ΔQ ${fmt(value.maxPMismatchPu,7)}/${fmt(value.maxQMismatchPu,7)} pu · seçenek ${value.identity.optionsHash}`);
  if(result)rows.push(`Görünen hesap: ${result.identity.id}`);if(snapshot.lastCalculation&&!snapshot.calculation)rows.push(`Son hesap yayımlanmıyor: ${snapshot.lastCalculation.status} · ${snapshot.lastCalculation.classification} · ${snapshot.lastCalculation.physicsCoverage}`);
  provenanceBody.replaceChildren(...rows.map(row=>element('p','ga-muted',row)));
 }
 function header(labels:readonly string[]){const head=element('thead'),row=element('tr');for(const label of labels)row.append(element('th','',label));head.append(row);return head;}
 function dataRow(values:readonly string[],titleText:string){const row=element('tr');row.title=titleText;for(const value of values)row.append(element('td','',value));return row;}
 function paginate<T>(rows:T[]):T[]{const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));page=Math.max(0,Math.min(page,pages-1));previous.disabled=page===0;next.disabled=page===pages-1;pageInfo.textContent=`${rows.length.toLocaleString('tr-TR')} sonuç · ${page+1}/${pages}`;return rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);}
 function renderLf(snapshot:PsseDiagramSnapshot,comparison:PsseResultComparison){
  const names=createPsseDisplayNames(snapshot.model,snapshot.base),result=resultFor(comparison),values=createPsseResultValues(result),baseValues=createPsseResultValues(comparison.base),scenarioValues=createPsseResultValues(comparison.scenario),query=normalizedKey(search.value),source=layer==='source',delta=layer==='delta',network=source||layer==='base'?snapshot.base:snapshot.network;
  const label=LAYERS.find(item=>item.key===layer)!.label;identity.textContent=label;context.textContent=source?`${sourceResultLabel(snapshot)} · Vm/Va ve üretim kayıtları kaynak dosyadan. Dal P/Q, akım ve yükleme kaydı bu katmanda yok.`:delta?`Fark = Senaryo − Baz. Yalnız aynı yöntem, model ve ayarlarla hesaplanan değerler karşılaştırılır.${comparison.scenario?.method==='LOSSLESS_DC'?' DC Vm, Q, akım ve yükleme hesaplamaz; bu hücreler boş kalır.':''}`:`${label} · ${result!.method} · ${pssePublicationStatus(result!)} · ${result!.classification} · fizik ${result!.physicsCoverage}${result!.method==='LOSSLESS_DC'?' · DC Vm, Q, akım ve yükleme hesaplamaz; bu hücreler boş kalır.':''}`;
  const tbody=element('tbody'),caption=element('caption','',kind==='buses'?(source?'Üretim P/Q değerleri kaynak kaydındaki jeneratör toplamlarıdır.':'Üretim P/Q değerleri seçili hesabın bara sonuçlarıdır.'):(source?'Kaynak katmanında dal akışı sunulmaz.':'P/Q işareti ilgili uçtan dala doğrudur; 1/2 sütunları kaynak uç sırasını korur.'));
  if(kind==='buses'){
   const production=new Map<string,{p:number;q:number}>();for(const generator of snapshot.base.generators){if(generator.status!==1)continue;const key=snapshot.base.buses[generator.bus].connectionKey,total=production.get(key)??{p:0,q:0};total.p+=generator.pMw;total.q+=generator.qMvar;production.set(key,total);}
   const rows=network.buses.filter(bus=>bus.source&&(!query||normalizedKey(names.busSearchText(bus)).includes(query)));
   for(const bus of paginate(rows)){let rowValues=source?{vmPu:busSavedVoltage(bus,snapshot.model),vaDeg:busSavedAngle(bus,snapshot.model),pGenerationMw:production.get(bus.connectionKey)?.p??0,qGenerationMvar:production.get(bus.connectionKey)?.q??0}:values.bus(bus);if(delta)rowValues=difference(baseValues.bus(bus),scenarioValues.bus(bus));tbody.append(dataRow([names.bus(bus),fmt(bus.baseKv,1),fmt(rowValues.vmPu,4),fmt(rowValues.vaDeg,3),fmt(rowValues.pGenerationMw),fmt(rowValues.qGenerationMvar)],names.busTitle(bus)));}
   table.replaceChildren(caption,header(['Bara / TM','kV',delta?'ΔVm pu':'Vm pu',delta?'ΔVa °':'Va °',delta?'ΔP gen MW':'P gen MW',delta?'ΔQ gen Mvar':'Q gen Mvar']),tbody);
  }else{
   const rows=network.branches.filter(branch=>!query||normalizedKey(names.branchTitle(branch)).includes(query));
   for(const branch of paginate(rows)){let rowValues=source?emptyBranch():values.branch(branch);if(delta)rowValues=difference(baseValues.branch(branch),scenarioValues.branch(branch));const currentState=branch.status===1?'Serviste':'Devre dışı',baseState=snapshot.base.branches.find(item=>item.id===branch.id)?.status===1?'Serviste':'Devre dışı',state=delta?`${baseState} → ${currentState}`:currentState;tbody.append(dataRow([names.branch(branch),state,`${fmt(rowValues.pFromMw)} / ${fmt(rowValues.pToMw)}`,`${fmt(rowValues.qFromMvar)} / ${fmt(rowValues.qToMvar)}`,`${fmt(rowValues.iFromA,1)} / ${fmt(rowValues.iToA,1)}`,`${fmt(rowValues.loadingFromPct,1)} / ${fmt(rowValues.loadingToPct,1)}`],`${names.branchTitle(branch)} · Yükleme temeli: ${result?.branchResults.find(row=>row.id===branch.id)?.loadingBasis??'UNAVAILABLE'}`));}
   table.replaceChildren(caption,header(['Hat / trafo','Durum',`${delta?'Δ':''}P 1 / 2 MW`,`${delta?'Δ':''}Q 1 / 2 Mvar`,`${delta?'Δ':''}I 1 / 2 A`,`${delta?'Δ':''}Yükleme 1 / 2 %`]),tbody);
  }
  if(!tbody.children.length){const cell=element('td','ga-empty','Aramayla eşleşen sonuç yok.');cell.colSpan=6;const row=element('tr');row.append(cell);tbody.append(row);}
 }
 function renderScenarios(snapshot:PsseDiagramSnapshot,comparison:PsseResultComparison){
  const names=createPsseDisplayNames(snapshot.model,snapshot.base),tbody=element('tbody'),labels={STATUS:'Servis durumu',GENERATOR_P:'Jeneratör P (MW)',LOAD_SCALE:'Yük ölçeği',FIXED_TAP:'Kademe',FIXED_PHASE:'Faz',FIXED_SHUNT:'Şönt'};
  identity.textContent='Senaryo';context.textContent=`${snapshot.scenario.operations.length} senaryo işlemi. Geri alma kaynak dosyayı değiştirmez; güncel sonuç için yeniden hesaplayın. ${comparison.scenario?'Senaryo hesabı güncel.':snapshot.scenario.operations.length?'Senaryo hesabı bekleniyor.':'Baz durum.'}`;
  const operations=paginate([...snapshot.scenario.operations]);for(const operation of operations){const value=operation.action==='STATUS'?(operation.value===true||operation.value===1?'Serviste':'Devre dışı'):String(operation.value),row=dataRow([labels[operation.action],names.equipment(operation.equipmentId),value],operation.equipmentId),cell=element('td'),undo=button('Geri al',()=>{const remaining=snapshot.scenario.operations.filter(item=>!(item.equipmentId===operation.equipmentId&&item.action===operation.action));ctx.setPsseScenario(remaining);ctx.setMessage(`${names.equipment(operation.equipmentId)} işlemi geri alındı; yeniden hesaplayın.`);render();},`${names.equipment(operation.equipmentId)} senaryo işlemini geri al`);undo.disabled=ctx.busy;cell.append(undo);row.append(cell);tbody.append(row);}
  if(!operations.length){const row=element('tr'),cell=element('td','ga-empty','Senaryo işlemi yok. Haritadaki hat veya trafo ayrıntısından servis durumunu değiştirebilirsiniz.');cell.colSpan=4;row.append(cell);tbody.append(row);}table.replaceChildren(header(['İşlem','Ekipman / TM','Değer','Geri alma']),tbody);
 }
 function render(){
  if(panel.hidden)return;for(const tab of tabs.querySelectorAll<HTMLButtonElement>('button[data-tab]'))tab.setAttribute('aria-pressed',String(tab.dataset.tab===active));const snapshot=getPsseDiagramSnapshot(ctx);tools.hidden=active!=='LF';scenarioActions.hidden=active!=='SCENARIOS';
  if(!snapshot){identity.textContent='';status.textContent='PSS/E modeli bekleniyor.';context.textContent='';table.replaceChildren();pager.hidden=true;provenance.hidden=true;return;}
  pager.hidden=false;provenance.hidden=false;const comparison=getPsseResultComparison(snapshot,ctx.psseBaseCalculation),availability={source:true,base:!!comparison.base,scenario:!!comparison.scenario,delta:comparison.ready};
  for(const option of layerSelect.options){option.disabled=!availability[option.value as ValueLayer];option.title=option.value==='delta'&&!comparison.ready?comparison.reason??'':'';}
  if(!layerChosen)layer=availability.scenario?'scenario':availability.base?'base':'source';if(!availability[layer])layer='source';layerSelect.value=layer;
  const last=snapshot.lastCalculation;if(!methodChosen&&last)method.value=last.method;recalculate.disabled=ctx.busy;reset.disabled=ctx.busy||!snapshot.scenario.operations.length;method.disabled=ctx.busy;
  status.textContent=ctx.busy?'Hesaplanıyor…':ctx.psseWorkerError?`Hesap hatası: ${ctx.psseWorkerError.message}`:last&&!snapshot.calculation?`Son hesap ${last.status} · ${last.classification}. Bu hesap güncel sonuç katmanında kullanılamaz.`:layer==='delta'?'Uyumlu baz ve senaryo hesabı.':layer==='source'?'Kaynak kaydı gösteriliyor.':'Güncel hesap sonucu gösteriliyor.';
  renderProvenance(snapshot,comparison);if(active==='LF')renderLf(snapshot,comparison);else renderScenarios(snapshot,comparison);
 }
 const open=(tab?:PsseLightningTab)=>{if(tab)active=tab;panel.hidden=false;body.hidden=false;minimize.textContent='−';render();},toggle=(tab?:PsseLightningTab)=>{if(panel.hidden)open(tab);else hide();};
 const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!panel.hidden)hide();},outside=(event:PointerEvent)=>{const target=event.target;if(!panel.hidden&&target instanceof Element&&!panel.contains(target)&&!target.closest('[data-psse-lightning-toggle]'))hide();};document.addEventListener('keydown',escape);document.addEventListener('pointerdown',outside);
 return{element:panel,render,open,close:hide,toggle,dispose:()=>{document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside);}};
}
