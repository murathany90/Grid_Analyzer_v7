import type {AppContext} from '../../app/contracts';
import {button,element} from '../../ui/components/dom';
import {fmt,getPsseDiagramSnapshot} from './diagram-utils';
import './psse-diagrams.css';

export type PsseLightningTab='LF'|'SCENARIOS';
const TABS:readonly {key:PsseLightningTab;label:string;enabled:boolean}[]=[
 {key:'LF',label:'Yük Akışı',enabled:true},
 {key:'SCENARIOS',label:'Senaryolar',enabled:true},
];

/** DGS lightning-panel shell, fed only by the isolated PSS/E result store. N-1/short-circuit tabs stay disabled. */
export function createPsseLightningPanel(ctx:AppContext):{element:HTMLElement;render:()=>void;open:(tab?:PsseLightningTab)=>void;dispose:()=>void}{
 const panel=element('section','ga-psse-lightning'),head=element('header','ga-psse-lightning-head'),title=element('strong','','⚡ Elektriksel Sonuçlar'),identity=element('small'),body=element('div','ga-psse-lightning-body');
 const toggle=button('⚡',()=>panel.toggleAttribute('hidden'),'PSS/E elektriksel sonuç panelini aç/kapat');toggle.className='ga-psse-lightning-toggle';toggle.setAttribute('aria-label','Elektriksel sonuçlar paneli');
 panel.hidden=true;
 const hide=()=>panel.setAttribute('hidden',''),minimize=button('−',()=>{body.toggleAttribute('hidden');minimize.textContent=body.hasAttribute('hidden')?'□':'−';},'Paneli küçült / geri aç'),close=button('×',hide,'Sonuç panelini kapat');
 head.append(title,identity,minimize,close);panel.append(head,body);
 const tabs=element('nav','ga-psse-lightning-tabs');let active:PsseLightningTab='LF';
 for(const tab of TABS){const b=button(tab.label,()=>{active=tab.key;render();});b.dataset.tab=tab.key;b.setAttribute('aria-pressed',String(active===tab.key));tabs.append(b);}
 for(const [label,reason] of [['Kısıt (N-1)','Bu pakette PSS/E N-1 sonuç motoru yok; sonuç varmış gösterilmez.'],['Kısa Devre','Bu pakette PSS/E kısa devre sonuç motoru yok; .iec bir kısa devre sonucu değildir.']]){const b=button(label,()=>{});b.disabled=true;b.title=reason;tabs.append(b);}
 const context=element('p','ga-psse-lightning-context'),table=element('table','ga-table ga-psse-lightning-table');
 body.append(tabs,context,table);
 function busRows(){const snapshot=getPsseDiagramSnapshot(ctx);if(!snapshot)return null;const calculated=snapshot.calculation;return {snapshot,calculated};}
 function renderLf(){
  const data=busRows();
  if(!data){context.textContent='PSS/E modeli bekleniyor.';table.replaceChildren();identity.textContent='';return;}
  const {snapshot,calculated}=data,calc=calculated;
  identity.textContent=calc?'Hesap':'Baz / SOURCE_SAVED';
  context.textContent=`${snapshot.model.source.name} · SHA ${snapshot.model.source.sha256.slice(0,12)} · ${calc?`${calc.classification} · ${calc.method} · iterasyon ${calc.iterations} · max P/Q ${fmt(calc.maxPMismatchPu,6)}/${fmt(calc.maxQMismatchPu,6)} pu`:'SOURCE_SAVED katmanı: bara Vm/Va kaynak kaydından; dal akışı bu katmanda sunulmaz.'}`;
  const thead=element('thead'),headRow=element('tr');
  for(const label of ['Bara','kV','Vm pu','Va °','P gen MW','Q gen Mvar'])headRow.append(element('th','',label));
  thead.append(headRow);const tbody=element('tbody');
  const buses=snapshot.network.buses.filter(bus=>bus.source),branchMap=new Map(calc?.branchResults.map(row=>[row.id,row])??[]);
  for(const bus of buses.slice(0,100)){
   const result=calc?.busResults.find(row=>row.connectionKey===bus.connectionKey),row=element('tr');
   const kv=snapshot.model.equipment.find(item=>item.id===bus.sourceEquipmentId)?.nominalKv??bus.baseKv;
   for(const value of [`${bus.externalNumber??bus.id} · ${bus.connectionKey}`,kv!==null&&kv!==undefined?`${Math.round(kv)} kV`:'—',fmt(calc?result?.vmPu:bus.initialVm,4),fmt(calc?result?.vaDeg:bus.initialVaDeg,2),'—','—'])row.append(element('td','',value));
   tbody.append(row);
  }
  table.replaceChildren(thead,tbody);
  const note=element('caption','',calc?`Dal sonuçları: ${calc.branchResults.filter(row=>row.pFromMw!==null).length} uç çifti hesaplandı (tablo bara odaklıdır; dal akışları harita tık etkileşiminde ve Analizler ekranındadır).`:'Kaynak katmanında dal P/Q kayıtlı değildir; akış oku/animasyon gösterilmez.');
  table.append(note);
 }
 function renderScenarios(){
  const data=busRows();
  if(!data){context.textContent='PSS/E modeli bekleniyor.';table.replaceChildren();return;}
  const {snapshot,calculated}=data,thead=element('thead'),headRow=element('tr');
  for(const label of ['#','İşlem','Ekipman','Değer'])headRow.append(element('th','',label));
  thead.append(headRow);const tbody=element('tbody');
  snapshot.scenario.operations.slice(0,50).forEach((operation,index)=>{
   const row=element('tr');
   for(const value of [String(index+1),operation.action,operation.equipmentId,String(operation.value)])row.append(element('td','',value));
   tbody.append(row);
  });
  table.replaceChildren(thead,tbody);
  context.textContent=`Senaryo ${snapshot.scenario.hash.slice(0,12)} · ${snapshot.scenario.operations.length} işlem · model ${snapshot.model.source.sha256.slice(0,12)}. Hat açma/geri alma haritadaki dal iletişim kutusundan yapılır; her işlem yalnız senaryo kopyasını değiştirir, kaynak dosyaya dokunulmaz. Hesap ${calculated?`güncel (${calculated.classification})`:'yok; yalnız SOURCE_SAVED mümkün'}.`;
  identity.textContent='Senaryo';
 }
 function render(){
  for(const b of tabs.querySelectorAll<HTMLButtonElement>('button[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===active));
  if(active==='LF')renderLf();else renderScenarios();
 }
 const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!panel.hasAttribute('hidden'))hide();};
 const outside=(event:PointerEvent)=>{const target=event.target as Element;if(!panel.hasAttribute('hidden')&&!panel.contains(target)&&!toggle.contains(target))hide();};
 document.addEventListener('keydown',escape);document.addEventListener('pointerdown',outside);
 return {element:panel,render,open:(tab)=>{if(tab)active=tab;panel.removeAttribute('hidden');body.removeAttribute('hidden');minimize.textContent='−';render();},dispose:()=>{document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside);}};
}
