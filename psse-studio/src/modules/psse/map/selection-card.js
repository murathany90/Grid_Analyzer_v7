import {resultStatus} from '../calculations/status.js';
import {stationState,stationRepresentative} from './station-state.js';
export function createMapSelection(controller,{context,onSelect,onActivate,onResults,onSld}){
  const element=document.createElement('aside');element.className='ga-map-selection';element.hidden=true;element.setAttribute('aria-label','Harita seçimi');
  const title=document.createElement('strong'),identity=document.createElement('small'),state=document.createElement('span'),values=document.createElement('div'),actions=document.createElement('div');identity.className='ga-muted';values.className='ga-map-selection-values';actions.className='ga-map-selection-actions';element.append(title,identity,state,values,actions);
  let selected=null;
  const fmt=(v,d=1)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('tr-TR',{maximumFractionDigits:d}):'—';
  function close(){selected=null;element.hidden=true;onSelect?.({});}
  function button(label,action){const b=document.createElement('button');b.textContent=label;b.disabled=controller.busy;b.onclick=()=>Promise.resolve().then(action).catch(e=>controller.setMessage(e.message));actions.append(b);return b;}
  function render(){
    if(!selected)return;const {workspace,layer,role,stationBuses,allows}=context(),model=controller.psseInspection;
    if(!workspace||model!==selected.model||model?.source.sha256!==selected.sourceSha){close();return;}
    const source=model.equipment.find(e=>e.id===selected.id);if(!source){close();return;}
    if(allows&&!allows(source)){close();return;}
    const network=layer==='saved'||role==='base'?workspace.base:workspace.network,branches=network.branches.filter(b=>b.sourceEquipmentId===source.id),branch=branches.find(b=>b.id===selected.branchId)??branches[0],bus=selected.busId?network.buses.find(b=>b.id===selected.busId):null;
    const comparison=controller.engine.Rv(workspace,controller.psseBaseCalculation),difference=role==='delta',result=layer==='saved'?null:role==='base'?comparison.base:role==='scenario'||difference&&comparison.ready?comparison.scenario:null;
    const delta=(current,base)=>current&&base?Object.fromEntries(Object.keys(current).map(key=>[key,typeof current[key]==='number'&&typeof base[key]==='number'?current[key]-base[key]:current[key]])):null;
    const rawRow=branch?result?.branchResults.find(r=>r.id===branch.id):null,rawBus=bus?result?.busResults.find(r=>r.connectionKey===bus.connectionKey):null,row=difference?delta(rawRow,comparison.base?.branchResults.find(r=>r.id===branch?.id)):rawRow,br=difference?delta(rawBus,comparison.base?.busResults.find(r=>r.connectionKey===bus?.connectionKey)):rawBus;
    const equipment=new Map(model.equipment.map(e=>[e.id,e])),ids=source.kind==='substation'?stationBuses?.(selected.stationId)??[]:[],aggregate=ids.length?stationState(network,ids,{result,baseResult:difference?comparison.base:null,saved:layer==='saved',sourceById:equipment}):null,sourceAggregate=ids.length?stationState(workspace.base,ids,{saved:true,sourceById:equipment}):null;
    const nominal=aggregate?aggregate.kv.map(v=>fmt(v)).join('/'):(branch?network.buses[branch.from]?.baseKv:bus?.baseKv??source.nominalKv);
    title.textContent=selected.title||source.name;identity.textContent=[source.kind==='substation'?'TM':source.kind==='bus'?'Bara':source.kind==='transformer'?'Trafo':'AC hat',branch?.kind==='three-winding-leg'?'Sargı '+branch.windingId:null,nominal?(typeof nominal==='string'?nominal:fmt(nominal))+' kV':null].filter(Boolean).join(' · ');identity.title=source.id;element.dataset.equipmentId=source.id;
    const sourceOn=source.status??source.fields.stat,activeOn=branch?branches.some(b=>b.status===1):bus?.status;
    const scenarioBranches=workspace.network.branches.filter(b=>b.sourceEquipmentId===source.id),scenarioOn=scenarioBranches.some(b=>b.status===1);
    state.textContent=aggregate?`Kaynak: ${sourceAggregate.active}/${sourceAggregate.count} bara · ${role==='base'?'Baz':'Senaryo'}: ${aggregate.status} (${aggregate.active}/${aggregate.count})`:branch?`Kaynak: ${sourceOn===0?'Devre dışı':'Serviste'} · Senaryo: ${scenarioOn?'Serviste':'Devre dışı'}`:bus?`${bus.status===1?'Serviste':'Devre dışı'}`:'';
    values.replaceChildren();
    const metric=text=>{const item=document.createElement('span');item.textContent=text;values.append(item);};
    if(branch&&row){const maximum=r=>{const values=[r?.loadingFromPct,r?.loadingToPct].filter(v=>typeof v==='number'&&Number.isFinite(v));return values.length?Math.max(...values):null;},current=maximum(rawRow),base=maximum(comparison.base?.branchResults.find(r=>r.id===branch.id)),loading=difference?current!=null&&base!=null?current-base:null:current;metric(`P ${fmt(row.pFromMw)} / ${fmt(row.pToMw)} MW`);metric(`Q ${fmt(row.qFromMvar)} / ${fmt(row.qToMvar)} Mvar`);metric(`Kayıp ${fmt(row.pLossMw)} MW · Yük ${fmt(loading)} %`);}
    else if(aggregate){const highest=stationRepresentative(aggregate);metric(`${fmt(highest?.baseKv)} kV · V ${Number.isFinite(highest?.vm)?fmt(highest.vm*highest.baseKv):'—'} kV · Açı ${fmt(highest?.va)}°`);}
    else if(bus){const vm=layer==='saved'?model.equipment.find(e=>e.id===bus.sourceEquipmentId)?.fields.vm:br?.vmPu,va=layer==='saved'?model.equipment.find(e=>e.id===bus.sourceEquipmentId)?.fields.va:br?.vaDeg;metric(`V ${vm!=null?fmt(vm*bus.baseKv):'—'} kV · Açı ${fmt(va)}°`);}
    metric(layer==='saved'?'SAV kayıtlı durum':`${role==='base'?'Baz':role==='scenario'?'Senaryo':'Fark'} · ${resultStatus(result)}`);
    actions.replaceChildren();
    if(branch&&['line','transformer'].includes(source.kind)){
      async function change(solve){
        const next=scenarioOn?0:1,operations=controller.psseScenario.operations.filter(o=>!(o.equipmentId===source.id&&o.action==='STATUS'));
        if(next!==Number(sourceOn))operations.push({equipmentId:source.id,action:'STATUS',value:next});
        controller.setPsseScenario(operations);onActivate?.();
        if(solve)await controller.runPsseCalculation(controller.solverOptions?.method??'NR_POLAR',controller.solverOptions?.ac??{});
      }
      button(scenarioOn?'Servis dışı':'Servise al',()=>change(false));button('Değiştir + hesapla',()=>change(true));
      if(controller.psseScenario.operations.some(o=>o.equipmentId===source.id))button('Kaynağa dön',()=>{controller.setPsseScenario(controller.psseScenario.operations.filter(o=>o.equipmentId!==source.id));onActivate?.();});
    }
    button('Sonuçlar',()=>onResults?.({kind:branch?source.kind==='transformer'?'transformers':'lines':'buses',query:source.kind==='substation'?source.name:source.id}));
    button('Tek Hat',()=>onSld?.(selected.stationId));button('Temizle',close);
  }
  function open(source,label,details={}){
    if(!source)return;const bus=details.normalizedBus,branch=details.normalizedBranch;
    selected={id:source.id,title:label?.replace(/^Kaynak TM\s*[·\-]\s*/,''),branchId:branch?.id,busId:bus?.id,stationId:details.stationId??(source.kind==='substation'?source.fields.isub:null),sourceSha:controller.psseInspection.source.sha256,model:controller.psseInspection};element.hidden=false;
    onSelect?.({equipmentId:source.id,branchId:branch?.id,busId:bus?.id,stationId:source.kind==='substation'||details.highlightStation?selected.stationId:null});render();
  }
  return {element,open,close,render,dispose(){selected=null;element.remove();}};
}
