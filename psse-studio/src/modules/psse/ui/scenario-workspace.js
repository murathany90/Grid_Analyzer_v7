import { resultStatus } from '../calculations/status.js';
export function createScenarioWorkspace(controller,{actionPrefix='',onActivate}={}) {
  const el=document.createElement('section');el.className='psse-scenario-workspace';
  el.innerHTML='<div class="psse-scenario-toolbar"><select aria-label="Etkin senaryo"></select><button data-action="copy">Kopyala</button><button data-action="undo">Geri al</button><button data-action="redo">Yinele</button><button data-action="reset">Sıfırla</button><button data-action="save">Kaydet</button><button data-action="load">Yükle</button><input type="file" accept=".json" hidden><span class="psse-scenario-state"></span></div><details><summary>İşlem geçmişi ve ekipman değişiklikleri</summary><div class="psse-scenario-edit"><select aria-label="Senaryo ekipmanı"></select><select aria-label="Senaryo işlemi"><option value="STATUS">Servis durumu (0/1)</option><option value="GENERATOR_P">Üretim P (MW)</option><option value="LOAD_SCALE">Yük çarpanı</option><option value="SHUNT_B">Sabit şönt B (Mvar)</option><option value="TAP_RATIO">Trafo kademe oranı (pu)</option></select><input type="number" aria-label="Senaryo değeri" value="0" step="any"><button data-action="apply">Uygula</button></div><div class="psse-operation-list"></div></details>';
  const select=el.querySelector('select'),equipment=el.querySelector('[aria-label="Senaryo ekipmanı"]'),action=el.querySelector('[aria-label="Senaryo işlemi"]'),value=el.querySelector('input[type=number]'),file=el.querySelector('input[type=file]'),state=el.querySelector('.psse-scenario-state'),history=el.querySelector('.psse-operation-list');
  const name=document.createElement('input');name.type='text';name.maxLength=80;name.placeholder='Senaryo adı';name.setAttribute('aria-label','Senaryo adı');select.after(name);
  const create=document.createElement('button'),rename=document.createElement('button'),remove=document.createElement('button');create.textContent='Yeni';rename.textContent='Adlandır';remove.textContent='Sil';create.dataset.action='create';rename.dataset.action='rename';remove.dataset.action='delete';name.after(create);el.querySelector('[data-action=copy]').after(rename,remove);
  for(const button of el.querySelectorAll('[data-action]'))button.dataset.action=actionPrefix+button.dataset.action;
  const actionButton=key=>el.querySelector(`[data-action="${actionPrefix+key}"]`);let lastSelected,lastName,lastScenarioId;
  const toolbar=el.querySelector('.psse-scenario-toolbar'),journal=el.querySelector('details'),mode=document.createElement('select'),advanced=document.createElement('details'),manage=document.createElement('div');
  mode.setAttribute('aria-label','Baz / Senaryo');mode.append(new Option('Baz','base'),new Option('Senaryo','scenario'));
  advanced.className='psse-scenario-advanced';manage.className='psse-scenario-toolbar';const summary=document.createElement('summary');summary.textContent='Senaryoları yönet';advanced.append(summary,manage);
  for(const node of [select,name,create,actionButton('copy'),rename,remove,actionButton('redo'),actionButton('save'),actionButton('load'),file])manage.append(node);
  toolbar.prepend(mode);actionButton('undo').textContent='Geri Al';actionButton('reset').textContent='Senaryoyu Sıfırla';journal.querySelector('summary').textContent='Manevra Günlüğü';el.append(advanced);
  mode.onchange=()=>{const book=controller.scenarios;if(!book)return;if(mode.value==='base')controller.selectScenario('base');else{const existing=book.items.has(lastScenarioId)?lastScenarioId:[...book.items.keys()].find(id=>id!=='base');if(existing)controller.selectScenario(existing);else{book.create('Senaryo',[]);controller.syncScenario();}}onActivate?.();};
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
  select.onchange=()=>{controller.selectScenario(select.value);onActivate?.();};
  el.onclick=async event=>{
    const raw=event.target.dataset.action;if(!raw||!raw.startsWith(actionPrefix)||!controller.scenarios)return;const key=raw.slice(actionPrefix.length);
    try{
      const book=controller.scenarios,typed=name.value.trim(),custom=typed&&typed!==book.item.name;
      if(key==='create'){book.create(custom?typed:'Senaryo '+(book.serial+1),[]);controller.syncScenario();}
      if(key==='copy'){book.create(custom?typed:book.item.name+' kopyası');controller.syncScenario();}
      if(key==='rename'){book.rename(book.selected,typed);controller.notify();}
      if(key==='delete'){const selected=book.selected;book.remove();if(selected!==book.selected)controller.syncScenario();else controller.notify();}
      if(key==='undo')controller.undoScenario();if(key==='redo')controller.redoScenario();if(key==='reset')controller.resetScenario();
      if(key==='save')download();if(key==='load')file.click();
      if(key==='apply')controller.apply({equipmentId:equipment.value,action:action.value,value:Number(value.value)});
      if(['create','copy','delete','undo','redo','reset','apply'].includes(key))onActivate?.();
    }catch(error){controller.setMessage(error.message);}
  };
  file.onchange=async()=>{try{controller.scenarios.restore(await file.files[0].text());controller.syncScenario();onActivate?.();}catch(error){controller.setMessage(error.message);}file.value='';};
  function render(){
    const book=controller.scenarios,network=controller.psseNetwork;el.hidden=!book;if(!book)return;
    select.replaceChildren(...[...book.items.values()].map(item=>new Option(item.name,item.id)));select.value=book.selected;mode.value=book.selected==='base'?'base':'scenario';if(book.selected!=='base')lastScenarioId=book.selected;
    if(lastSelected!==book.selected||lastName!==book.item.name){name.value=book.item.name;lastSelected=book.selected;lastName=book.item.name;}
    actionButton('undo').disabled=book.selected==='base'||book.item.cursor===0;actionButton('redo').disabled=book.selected==='base'||book.item.cursor>=book.item.history.length-1;actionButton('rename').disabled=actionButton('delete').disabled=actionButton('reset').disabled=book.selected==='base';
    state.textContent=`${book.item.operations.length} etkilenen işlem · ${resultStatus(controller.psseCalculation)}`;state.title=`Model ${network.modelHash}\nSenaryo ${controller.psseScenario.hash}\nHesap ${controller.psseCalculation?.id??'NOT_RUN'}`;
    if(lastNetwork!==network){lastNetwork=network;equipmentKey='';populateEquipment();}
    const stamp=book.selected+'|'+book.item.cursor+'|'+book.item.history.length+'|'+controller.psseScenario.hash;if(lastHash!==stamp){lastHash=stamp;const rows=[],names=controller.engine.Lv(controller.psseInspection,network);for(let i=1;i<book.item.history.length;i++){const previous=new Map(book.item.history[i-1].map(op=>[op.equipmentId+'|'+op.action,op])),next=new Map(book.item.history[i].map(op=>[op.equipmentId+'|'+op.action,op]));for(const key of new Set([...previous.keys(),...next.keys()])){const before=previous.get(key),after=next.get(key);if(before&&after&&JSON.stringify(before.value)===JSON.stringify(after.value))continue;const op=after??before,row=document.createElement('div');row.classList.toggle('is-future',i>book.item.cursor);row.textContent=i+'. '+names.equipment(op.equipmentId)+' · '+op.action+' = '+(after?String(after.value):'Kaynağa dön');rows.push(row);}}if(!rows.length)for(const op of book.item.operations){const row=document.createElement('div');row.textContent=names.equipment(op.equipmentId)+' · '+op.action+' = '+op.value;rows.push(row);}history.replaceChildren(...rows);}
  }
  render();return {element:el,render,dispose(){lastNetwork=null;lastHash=null;el.replaceChildren();}};
}
