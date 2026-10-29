import {resultStatus} from '../calculations/status.js';
export function createMapSelection(controller,{context,onSelect,onActivate,onResults,onSld}){
  const element=document.createElement('aside');element.className='ga-map-selection';element.hidden=true;element.setAttribute('aria-label','Harita seçimi');
  const title=document.createElement('strong'),identity=document.createElement('small'),state=document.createElement('span'),values=document.createElement('div'),actions=document.createElement('div');identity.className='ga-muted';values.className='ga-map-selection-values';actions.className='ga-map-selection-actions';element.append(title,identity,state,values,actions);
  let selected=null;
  element.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  const fmt=(v,d=1)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('tr-TR',{maximumFractionDigits:d}):'—';
  function close(){selected=null;element.hidden=true;onSelect?.({});}
  function button(label,action){const b=document.createElement('button');b.textContent=label;b.disabled=controller.busy;b.onclick=()=>Promise.resolve().then(action).catch(e=>controller.setMessage(e.message));actions.append(b);return b;}
  function render(){
    if(!selected)return;const {workspace,layer,role}=context(),model=controller.psseInspection;
    if(!workspace||model!==selected.model||model?.source.sha256!==selected.sourceSha){close();return;}
    const source=model.equipment.find(e=>e.id===selected.id);if(!source){close();return;}
    const network=workspace.network,branches=network.branches.filter(b=>b.sourceEquipmentId===source.id),branch=branches.find(b=>b.id===selected.branchId)??branches[0],bus=selected.busId?network.buses.find(b=>b.id===selected.busId):null;
    const comparison=controller.engine.Rv(workspace,controller.psseBaseCalculation),result=layer==='saved'?null:role==='base'?comparison.base:role==='scenario'?comparison.scenario:null;
    const row=branch?result?.branchResults.find(r=>r.id===branch.id):null,br=bus?result?.busResults.find(r=>r.connectionKey===bus.connectionKey):null;
    const nominal=branch?network.buses[branch.from]?.baseKv:bus?.baseKv??source.nominalKv;
    title.textContent=selected.title||source.name;identity.textContent=[source.kind==='substation'?'TM':source.kind==='bus'?'Bara':source.kind==='transformer'?'Trafo':'AC hat',nominal?fmt(nominal)+' kV':null].filter(Boolean).join(' · ');identity.title=source.id;
    const sourceOn=source.status??source.fields.stat,activeOn=branch?branches.some(b=>b.status===1):bus?.status;
    state.textContent=branch?`Kaynak: ${sourceOn===0?'Devre dışı':'Serviste'} · Senaryo: ${activeOn?'Serviste':'Devre dışı'}`:bus?`${bus.status===1?'Serviste':'Devre dışı'}`:'';
    values.replaceChildren();
    const metric=text=>{const item=document.createElement('span');item.textContent=text;values.append(item);};
    if(branch){metric(`P ${fmt(row?.pFromMw)} / ${fmt(row?.pToMw)} MW`);metric(`Q ${fmt(row?.qFromMvar)} / ${fmt(row?.qToMvar)} Mvar`);metric(`Kayıp ${fmt(row?.pLossMw,3)} MW · Yük ${fmt(row?.loadingFromPct)} %`);}
    else if(bus){const vm=layer==='saved'?model.equipment.find(e=>e.id===bus.sourceEquipmentId)?.fields.vm:br?.vmPu,va=layer==='saved'?model.equipment.find(e=>e.id===bus.sourceEquipmentId)?.fields.va:br?.vaDeg;metric(`V ${vm!=null?fmt(vm*bus.baseKv):'—'} kV · Açı ${fmt(va)}°`);}
    metric(layer==='saved'?'SAV kayıtlı durum':`${role==='base'?'Baz':role==='scenario'?'Senaryo':'Fark'} · ${resultStatus(result)}`);
    actions.replaceChildren();
    if(branch&&['line','transformer'].includes(source.kind)){
      async function change(solve){
        const next=activeOn?0:1,operations=controller.psseScenario.operations.filter(o=>!(o.equipmentId===source.id&&o.action==='STATUS'));
        if(next!==Number(sourceOn))operations.push({equipmentId:source.id,action:'STATUS',value:next});
        controller.setPsseScenario(operations);onActivate?.();
        if(solve)await controller.runPsseCalculation(controller.solverOptions?.method??'NR_POLAR',controller.solverOptions?.ac??{});
      }
      button(activeOn?'Servis dışı':'Servise al',()=>change(false));button('Değiştir + hesapla',()=>change(true));
      if(controller.psseScenario.operations.some(o=>o.equipmentId===source.id))button('Kaynağa dön',()=>{controller.setPsseScenario(controller.psseScenario.operations.filter(o=>o.equipmentId!==source.id));onActivate?.();});
    }
    button('Sonuçlar',()=>onResults?.({kind:branch?source.kind==='transformer'?'transformers':'lines':'buses',query:source.kind==='substation'?source.name:source.id}));
    button('Tek Hat',()=>onSld?.(selected.stationId));button('Temizle',close);
  }
  function open(source,label,details={}){
    if(!source)return;const bus=details.normalizedBus,branch=details.normalizedBranch;
    selected={id:source.id,title:label?.replace(/^Kaynak TM\s*[·\-]\s*/,''),branchId:branch?.id,busId:bus?.id,stationId:details.stationId??(source.kind==='substation'?source.fields.isub:null),sourceSha:controller.psseInspection.source.sha256,model:controller.psseInspection};element.hidden=false;
    onSelect?.({branchId:branch?.id,busId:bus?.id,stationId:source.kind==='substation'?selected.stationId:null});render();
  }
  return {element,open,close,render,dispose(){selected=null;element.remove();}};
}
