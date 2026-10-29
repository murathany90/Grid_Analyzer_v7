import { resultStatus } from '../calculations/status.js';
export function createScenarioWorkspace(controller) {
  const el=document.createElement('section');el.className='psse-scenario-workspace';
  el.innerHTML='<div class="psse-scenario-toolbar"><select aria-label="Etkin senaryo"></select><button data-action="copy">Kopyala</button><button data-action="undo">Geri al</button><button data-action="redo">Yinele</button><button data-action="reset">Sıfırla</button><button data-action="save">Kaydet</button><button data-action="load">Yükle</button><input type="file" accept=".json" hidden><span class="psse-scenario-state"></span></div><details><summary>İşlem geçmişi ve ekipman değişiklikleri</summary><div class="psse-scenario-edit"><select aria-label="Senaryo ekipmanı"></select><select aria-label="Senaryo işlemi"><option value="STATUS">Servis durumu (0/1)</option><option value="GENERATOR_P">Üretim P (MW)</option><option value="LOAD_SCALE">Yük çarpanı</option><option value="SHUNT_B">Sabit şönt B (Mvar)</option><option value="TAP_RATIO">Trafo kademe oranı (pu)</option></select><input type="number" aria-label="Senaryo değeri" value="0" step="any"><button data-action="apply">Uygula</button></div><div class="psse-operation-list"></div></details>';
  const select=el.querySelector('select'),equipment=el.querySelector('[aria-label="Senaryo ekipmanı"]'),action=el.querySelector('[aria-label="Senaryo işlemi"]'),value=el.querySelector('input[type=number]'),file=el.querySelector('input[type=file]'),state=el.querySelector('.psse-scenario-state'),history=el.querySelector('.psse-operation-list');
  let lastNetwork,lastHash,equipmentKey='';
  const search=document.createElement('input');search.type='search';search.placeholder='Ekipman adı / TM / kimlik';search.setAttribute('aria-label','Senaryo ekipmanı ara');equipment.before(search);
  function populateEquipment(){
    if(!controller.scenarios||!el.querySelector('details').open)return;
    const network=controller.psseNetwork,key=network.modelHash+'|'+action.value+'|'+search.value;if(key===equipmentKey)return;equipmentKey=key;
    const groups=action.value==='GENERATOR_P'?[network.generators]:action.value==='LOAD_SCALE'?[network.loads]:action.value==='SHUNT_B'?[network.shunts.filter(s=>s.selection==='FIXED')]:action.value==='TAP_RATIO'?[network.branches.filter(b=>b.kind==='transformer'&&b.tapControl)]:[network.branches,network.generators,network.loads,network.shunts];
    const ids=new Map(),term=search.value.toLocaleLowerCase('tr-TR'),names=controller.engine.Lv(controller.psseInspection,network);
    for(const group of groups)for(const eq of group){if(ids.has(eq.sourceEquipmentId))continue;const text=names.equipment(eq.sourceEquipmentId)+' · '+eq.sourceEquipmentId;if(!term||text.toLocaleLowerCase('tr-TR').includes(term))ids.set(eq.sourceEquipmentId,text);if(ids.size>=300)break;}
    const selected=equipment.value;equipment.replaceChildren(...[...ids].map(([id,text])=>new Option(text,id)));if(ids.has(selected))equipment.value=selected;equipment.title='En fazla 300 eşleşme; diğer ekipmanlar için arayın.';
  }
  search.oninput=populateEquipment;action.onchange=populateEquipment;el.querySelector('details').ontoggle=populateEquipment;
  const download=()=>{const url=URL.createObjectURL(new Blob([controller.scenarios.serialize()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='GA_PSSE_Scenarios.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  select.onchange=()=>controller.selectScenario(select.value);
  el.onclick=async event=>{
    const key=event.target.dataset.action;if(!key||!controller.scenarios)return;
    try{
      if(key==='copy'){controller.scenarios.create(controller.scenarios.item.name+' kopyası');controller.syncScenario();}
      if(key==='undo')controller.undoScenario();if(key==='redo')controller.redoScenario();if(key==='reset')controller.resetScenario();
      if(key==='save')download();if(key==='load')file.click();
      if(key==='apply')controller.apply({equipmentId:equipment.value,action:action.value,value:Number(value.value)});
    }catch(error){controller.setMessage(error.message);}
  };
  file.onchange=async()=>{try{controller.scenarios.restore(await file.files[0].text());controller.syncScenario();}catch(error){controller.setMessage(error.message);}file.value='';};
  function render(){
    const book=controller.scenarios,network=controller.psseNetwork;el.hidden=!book;if(!book)return;
    select.replaceChildren(...[...book.items.values()].map(item=>new Option(item.name,item.id)));select.value=book.selected;
    el.querySelector('[data-action=undo]').disabled=book.item.cursor===0;el.querySelector('[data-action=redo]').disabled=book.item.cursor>=book.item.history.length-1;
    state.textContent=`${book.item.operations.length} etkilenen işlem · ${resultStatus(controller.psseCalculation)}`;state.title=`Model ${network.modelHash}\nSenaryo ${controller.psseScenario.hash}\nHesap ${controller.psseCalculation?.id??'NOT_RUN'}`;
    if(lastNetwork!==network){lastNetwork=network;equipmentKey='';populateEquipment();}
    if(lastHash!==controller.psseScenario.hash){lastHash=controller.psseScenario.hash;history.replaceChildren(...book.item.operations.map(op=>{const row=document.createElement('div');row.textContent=`${controller.engine.Lv(controller.psseInspection,network).equipment(op.equipmentId)} · ${op.action} = ${op.value}`;return row;}));}
  }
  render();return {element:el,render,dispose(){lastNetwork=null;lastHash=null;el.replaceChildren();}};
}
