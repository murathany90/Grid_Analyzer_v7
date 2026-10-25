import type {CanonicalNetwork} from '../model/network';
export type ScNodeKind='PHYSICAL_BUS'|'FEEDER_NODE'|'AUXILIARY_NODE'|'UNCLASSIFIED';
export const SC_NODE_LABELS:Record<ScNodeKind,string>={PHYSICAL_BUS:'Fiziksel bara',FEEDER_NODE:'Fider düğümü',AUXILIARY_NODE:'Yardımcı düğüm',UNCLASSIFIED:'Sınıfı doğrulanamadı'};
const cache=new WeakMap<CanonicalNetwork,Map<string,{kind:ScNodeKind;evidence:string[]}>>();
/** Native usage plus actual equipment endpoints; names never classify or remove a node. */
export function scNodeIndex(n:CanonicalNetwork){
 let value=cache.get(n);if(value)return value;
 const branches=new Map<string,string[]>(),switches=new Map<string,string[]>();
 for(const e of [...n.lines,...n.transformers,...n.seriesCompensators])for(const id of [e.from,e.to]){const list=branches.get(id)??[];list.push(`${e.sourceClass}:${e.sourceId}`);branches.set(id,list);}
 for(const e of [...n.generators,...n.loads,...n.externalGrids,...n.shunts,...n.internationalConnections]){const list=branches.get(e.bus)??[];list.push(`${e.sourceClass}:${e.sourceId}`);branches.set(e.bus,list);}
 for(const e of n.switches)for(const id of [e.from,e.to]){const list=switches.get(id)??[];list.push(e.sourceId);switches.set(id,list);}
 value=new Map(n.buses.map(b=>{const ends=branches.get(b.sourceId)??[],links=switches.get(b.sourceId)??[],usage=b.usage;
  const kind:ScNodeKind=usage===0?'PHYSICAL_BUS':(usage===1||usage===2)&&ends.length===1?'FEEDER_NODE':usage===2&&!ends.length&&links.length>0?'AUXILIARY_NODE':'UNCLASSIFIED';
  return [b.sourceId,{kind,evidence:[`ElmTerm:${b.sourceId}.iUsage=${usage??'NOT_RECORDED'}`,`equipmentEndpoints=${ends.join(',')||'none'}`,`switchEndpoints=${links.join(',')||'none'}`]}];}));cache.set(n,value);return value;
}
export function scNodeClassification(n:CanonicalNetwork,ids:readonly string[]){
 const index=scNodeIndex(n),items=ids.map(id=>index.get(id)).filter(v=>!!v),kind=(['PHYSICAL_BUS','FEEDER_NODE','AUXILIARY_NODE','UNCLASSIFIED'] as const).find(k=>items.some(v=>v.kind===k))??'UNCLASSIFIED';
 return {kind,label:SC_NODE_LABELS[kind],evidence:items.flatMap(v=>v.evidence)};
}
export function scVoltageOptions(n:CanonicalNetwork|null){return [...new Set([400,220,154,66,34.5,33,...n?.buses.map(b=>b.vnKv).filter(v=>v>0&&Number.isFinite(v))??[]])].sort((a,b)=>b-a);}
export const nominalKv=(value:number|null|undefined)=>value==null?'—':value.toLocaleString('tr-TR',{maximumFractionDigits:3});
export const scCurrentKa=(value:number|null|undefined)=>value==null||!Number.isFinite(value)?'—':value.toLocaleString('tr-TR',{minimumFractionDigits:3,maximumFractionDigits:3});
