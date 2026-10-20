import type {AppContext,CatalogRow} from '../../app/contracts';
import type {Entity} from '../../domain/model/network';
import type {ManeuverEvent} from '../../domain/scenario/overlay';
import {element,button} from './dom';
import {activeResultId} from '../../domain/results/workspace';
import {fetchCatalogAll} from '../../features/catalog';
import {sourceSwitchKind} from '../../domain/model/switch-usage';
export function createScenarioWorkspace(ctx:AppContext,embedded=false){
  const root=element('div','ga-scenario-workspace'+(embedded?' ga-scenario-embedded':'')),log=element('details','ga-scenario-log'),events=element('ol'),actions=element('div','ga-actions');
  const undo=button('Geri Al',()=>ctx.undoScenario()),reset=button('Senaryoyu Sıfırla',()=>ctx.resetScenario());
  log.append(element('summary','','Manevra Günlüğü'),events);actions.append(undo,reset);root.append(actions,log);
  let network=ctx.network,revision=-1;
  const source=new Map<string,CatalogRow>(),requested=new Set<string>();
  const raw=(cls:string,id:string)=>source.get(cls+':'+id);
  function describe(e:ManeuverEvent){
    const n=ctx.network!;
    const sw=e.action==='switchState'?n.switches.find(s=>s.id===e.equipmentId):undefined;
    const entity:Entity|undefined=sw??(e.action==='lineStatus'?n.lines:e.action==='transformerStatus'?n.transformers:e.action==='generatorDispatch'?n.generators:e.action==='loadAdjustments'?n.loads:n.buses).find(x=>x.id===e.equipmentId);
    const sites=n.sites.filter(s=>entity?.siteIds.includes(s.id));
    let feederNames:string[]=[],kv:number|undefined,kind='Cihaz',baseline:unknown;
    if(sw){
      const row=raw(sw.sourceClass,sw.id),parent=String(row?.attributes.fold_id??''),cub=raw('StaCubic',parent),terminal=cub?raw('ElmTerm',String(cub.attributes.fold_id??'')):undefined;
      const feeder=raw('ElmBay',terminal?String(terminal.attributes.fold_id??''):parent);if(feeder?.name)feederNames=[feeder.name];
      const ends=[n.buses.find(b=>b.id===sw.from),n.buses.find(b=>b.id===sw.to)].filter(b=>!!b);
      const voltages=[...new Set(ends.map(b=>b.vnKv))];kv=voltages.length===1?voltages[0]:undefined;
      kind=({'breaker':'Kesici','isolator':'Ayırıcı','load-break-disconnector':'Yük ayırıcısı','load-switch':'Yük anahtarı','switch':'Anahtar'})[sourceSwitchKind(String(row?.attributes.aUsage??''))];baseline=sw.closed;
    }else if(entity){
      kind=e.action==='lineStatus'?'Hat':e.action==='transformerStatus'?'Trafo':e.action==='generatorDispatch'?'Üretim':e.action==='loadAdjustments'?'Yük':'Bara';baseline=entity.inService;if('vnKv'in entity)kv=Number(entity.vnKv);
      const terminals='from'in entity&&'to'in entity?[String(entity.from),String(entity.to)]:'bus'in entity?[String(entity.bus)]:[entity.id];
      feederNames=[...new Set(terminals.flatMap(id=>{const terminal=n.buses.find(b=>b.id===id),bay=terminal?raw('ElmBay',terminal.parentId):undefined;return bay?.name?[bay.name]:[];}))];
      if('pMw'in entity&&'qMvar'in entity)baseline={pMw:entity.pMw,qMvar:entity.qMvar};
    }
    const context=[[...new Set(sites.map(s=>s.areaName).filter(Boolean))].join(' / '),sites.map(s=>s.name).filter(Boolean).join(' ↔ '),kv&&Number.isFinite(kv)?kv.toLocaleString('tr-TR')+' kV':undefined,feederNames.join(' ↔ ')].filter(Boolean).join(' → ');
    const label=kind+' '+(entity?.name||e.equipmentId);
    const state=(value:unknown)=>{if(value===undefined||e.action==='restoredTerminals'&&value===false)value=baseline;if(typeof value==='boolean')return sw?(value?'Kapalı':'Açık'):(value?'Serviste':'Servis Dışı');if(value&&typeof value==='object'){const v=value as {pMw?:number;qMvar?:number};return [typeof v.pMw==='number'?v.pMw.toLocaleString('tr-TR')+' MW':'',typeof v.qMvar==='number'?v.qMvar.toLocaleString('tr-TR')+' MVAr':''].filter(Boolean).join(' / ')||'Bilinmiyor';}return 'Bilinmiyor';};
    return {context,text:[context,label+': '+state(e.before)+' → '+state(e.after)].filter(Boolean).join(' → ')};
  }
  function render(){
    if(network!==ctx.network){network=ctx.network;source.clear();requested.clear();revision=-1;}
    root.dataset.scenarioId=ctx.scenario.selectedId;root.dataset.resultId=activeResultId(ctx)||'NOT_RUN';
    undo.disabled=ctx.busy||!ctx.scenario.canUndo;reset.disabled=ctx.busy||!ctx.network;
    if(revision===ctx.scenario.revision)return;revision=ctx.scenario.revision;
    events.replaceChildren();const groups=new Map<string,ManeuverEvent[]>();
    for(const e of ctx.scenario.selected.events){const group=groups.get(e.operationId)??[];group.push(e);groups.set(e.operationId,group);}
    for(const group of groups.values()){
      const li=element('li'),descriptions=group.map(describe);
      if(group.length===1)li.textContent=descriptions[0].text;
      else{const details=element('details'),list=element('ul'),contexts=[...new Set(descriptions.map(d=>d.context).filter(Boolean))];details.append(element('summary','',(contexts.length===1?contexts[0]+' → ':'')+'Toplu manevra · '+group.length+' cihaz'),list);for(const d of descriptions)list.append(element('li','',d.text));li.append(details);}
      events.append(li);
    }
    if(!groups.size)events.append(element('li','ga-muted','Henüz manevra yapılmadı.'));
    // Only source parent/cubicle relations establish a feeder; proximity is never evidence.
    const n=ctx.network;if(!n)return;
    const ids=new Set(ctx.scenario.selected.events.map(e=>e.equipmentId)),affected=[...n.switches,...n.lines,...n.transformers,...n.buses,...n.generators,...n.loads].filter(e=>ids.has(e.id));
    for(const siteId of new Set(affected.flatMap(s=>s.siteIds))){
      const classes=['ElmBay','ElmTerm','StaCubic',...new Set(n.switches.filter(s=>ids.has(s.id)&&s.siteIds.includes(siteId)).map(s=>s.sourceClass))].filter(cls=>!requested.has(siteId+':'+cls));
      if(!classes.length)continue;for(const cls of classes)requested.add(siteId+':'+cls);
      void Promise.all(classes.map(async cls=>[cls,n.classCounts[cls]?(await fetchCatalogAll(ctx,cls,{siteId})).rows:[]] as const)).then(rows=>{if(ctx.network!==n)return;for(const [cls,items] of rows)for(const row of items)source.set(cls+':'+row.id,row);revision=-1;render();}).catch(()=>{});
    }
  }
  return{element:root,render};
}
