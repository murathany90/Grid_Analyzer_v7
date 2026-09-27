import type { DgsModel } from './index';
import type { ContextRef, EngineeringContext } from '../../domain/dgs-semantics/context';
const parentClasses=['ElmSite','ElmSubstat','ElmBay','ElmTerm','StaCubic','ElmArea','ElmNet','IntFolder'];
const equipmentClasses=['ElmLne','ElmTr2','ElmCoup','StaSwitch','ElmSym','ElmGenStat','ElmLod','ElmShnt','ElmScap','ElmXnet','ElmVac'];
const connectionIndexes=new WeakMap<DgsModel,Map<string,Set<string>>>();
const sectionTypeIndexes=new WeakMap<DgsModel,Map<string,Set<string>>>();
const parentVoltageIndexes=new WeakMap<DgsModel,Map<string,Set<number>>>();
export function groupNominalVoltages(model:DgsModel,id:string):ReadonlySet<number> {
  const known=model.findTermVoltagesForGroup(id);if(known.size)return known;
  let map=parentVoltageIndexes.get(model);
  if(!map){map=new Map();const table=model.t('ElmTerm'),fold=model.attrAt('ElmTerm','fold_id'),voltage=model.attrAt('ElmTerm','uknom');
    if(table&&fold>=0&&voltage>=0)for(const row of table.Values){const parent=String(row[fold]??''),kv=Number(row[voltage]);if(!parent||!(kv>0)||!Number.isFinite(kv))continue;let values=map.get(parent);if(!values)map.set(parent,values=new Set());values.add(kv);}
    parentVoltageIndexes.set(model,map);
  }
  return map.get(id)||new Set();
}
function lineTypeIds(model:DgsModel,id:string):string[] {
  let map=sectionTypeIndexes.get(model);
  if(!map){map=new Map();const table=model.t('ElmLnesec'),fold=model.attrAt('ElmLnesec','fold_id'),type=model.attrAt('ElmLnesec','typ_id');
    if(table&&fold>=0&&type>=0)for(const row of table.Values){const line=String(row[fold]??''),typeId=String(row[type]??'');if(!line||!typeId)continue;let ids=map.get(line);if(!ids)map.set(line,ids=new Set());ids.add(typeId);}
    sectionTypeIndexes.set(model,map);
  }
  return [...(map.get(id)||[])];
}
function connected(model:DgsModel):Map<string,Set<string>> {
  let map=connectionIndexes.get(model);if(map)return map;map=new Map();
  const table=model.t('StaCubic'),fold=model.attrAt('StaCubic','fold_id'),obj=model.attrAt('StaCubic','obj_id');
  if(table&&fold>=0&&obj>=0)for(const row of table.Values){const terminal=String(row[fold]??''),id=String(row[obj]??'');if(!terminal||!id)continue;let set=map.get(terminal);if(!set)map.set(terminal,set=new Set());set.add(id);}
  connectionIndexes.set(model,map);return map;
}
const numeric=(v:unknown):number|null=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
function value(model:DgsModel,cls:string,id:string,field:string):unknown {
  const i=model.index.get(cls)?.get(id),col=model.attrAt(cls,field);return i===undefined||col<0?null:model.t(cls)?.Values[i]?.[col];
}
function ref(model:DgsModel,cls:string,id:string):ContextRef {return {id,name:String(value(model,cls,id,'loc_name')||id),sourceClass:cls};}
export function nominalVoltage(model:DgsModel,cls:string,id:string,attributes:Readonly<Record<string,unknown>>):number|null {
  if(cls==='ElmLne')return model.lineById(id)?.voltage??null;
  if(cls==='ElmTr2')return numeric(value(model,'TypTr2',String(attributes.typ_id??''),'utrn_h'));
  const direct=numeric(attributes.uknom??attributes.utrn_h??attributes.uline);if(direct!=null)return direct;
  const cubId=String(attributes.bus1??attributes.bushv??(cls==='StaSwitch'?attributes.fold_id:'')??'');
  const terminal=cls==='StaCubic'?String(attributes.fold_id??''):String(value(model,'StaCubic',cubId,'fold_id')??'');
  return numeric(value(model,'ElmTerm',terminal,'uknom'));
}
export function resolveEngineeringContext(model:DgsModel,cls:string,id:string,attributes:Readonly<Record<string,unknown>>,siteIds:readonly string[]):EngineeringContext {
  const refs=new Map<string,ContextRef>(),add=(c:string,i:string)=>{if(i&&model.index.get(c)?.has(i))refs.set(`${c}|${i}`,ref(model,c,i));};
  function parents(c:string,i:string){const seen=new Set<string>();for(let depth=0;i&&depth<24&&!seen.has(`${c}|${i}`);depth++){
    seen.add(`${c}|${i}`);add(c,i);const parent=String(value(model,c,i,'fold_id')??'');if(!parent)break;
    const candidates=parentClasses.filter(k=>model.index.get(k)?.has(parent));if(candidates.length!==1)break;c=candidates[0];i=parent;
  }}
  parents(cls,id);
  const sourceRefs:EngineeringContext['sourceRefs']=[];
  for(const field of ['fold_id','typ_id','bus1','bus2','bushv','buslv','obj_id']){
    const target=String(attributes[field]??'');if(!target)continue;
    const candidates=(field==='typ_id'?['TypLne','TypTr2','TypSym','TypSwitch']:field==='obj_id'?equipmentClasses:field==='fold_id'?parentClasses:['StaCubic']).filter(c=>model.index.get(c)?.has(target));
    sourceRefs.push({field,id:target,sourceClass:candidates.length===1?candidates[0]:null});
    if(candidates.length===1&&field!=='typ_id'&&field!=='obj_id')parents(candidates[0],target);
  }
  // Cubicles link equipment to source terminals; no FID-prefix guesses.
  const terminals=[...refs.values()].filter(r=>r.sourceClass==='ElmTerm');
  const equipmentIds=new Set<string>();
  if(cls==='ElmTerm'||cls==='StaCubic')for(const terminal of terminals)for(const item of connected(model).get(terminal.id)||[])equipmentIds.add(item);
  const connectedEquipment=[...equipmentIds].flatMap(i=>{const classes=equipmentClasses.filter(c=>model.index.get(c)?.has(i));return classes.length===1?[ref(model,classes[0],i)]:[];});
  const sites=siteIds.map(i=>ref(model,'ElmSite',i)),areas=[...new Set(siteIds.map(i=>model.siteById(i)?.ytmId).filter((v):v is string=>!!v))].map(i=>ref(model,model.index.get('ElmArea')?.has(i)?'ElmArea':'ElmNet',i));
  if(cls==='ElmArea'&&!areas.length)areas.push(ref(model,cls,id));
  const typeId=String(attributes.typ_id??''),typeClass=cls==='ElmTr2'?'TypTr2':cls==='ElmLne'||cls==='ElmLnesec'?'TypLne':cls==='ElmSym'?'TypSym':'TypSwitch';
  const line=cls==='ElmLne'?model.lineById(id):null;
  const lineTypes=cls==='ElmLne'?lineTypeIds(model,id):[];
  for(const type of lineTypes)sourceRefs.push({field:'ElmLnesec.typ_id',id:type,sourceClass:'TypLne'});
  return {sites,areas,groups:[...refs.values()].filter(r=>r.sourceClass==='ElmSubstat'),bays:[...refs.values()].filter(r=>r.sourceClass==='ElmBay'),terminals,
    connectedEquipment,connectedEquipmentCount:cls==='ElmTerm'||cls==='StaCubic'?equipmentIds.size:null,
    voltageKv:nominalVoltage(model,cls,id,attributes),lvKv:cls==='ElmTr2'?numeric(value(model,'TypTr2',typeId,'utrn_l')):null,
    ratingMva:cls==='ElmTr2'?numeric(value(model,'TypTr2',typeId,'strn')):null,
    typeName:lineTypes.length?lineTypes.map(type=>String(value(model,'TypLne',type,'loc_name')||type)).join(' / '):typeId?String(value(model,typeClass,typeId,'loc_name')||typeId):null,
    fromSite:line?model.siteById(line.stationA)?.loc_name??null:sites[0]?.name??null,
    toSite:line?model.siteById(line.stationB)?.loc_name??null:sites[1]?.name??null,sourceRefs};
}
