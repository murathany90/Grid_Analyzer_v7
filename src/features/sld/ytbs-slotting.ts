import type {Feeder,StationTopologyGraph} from '../../domain/model/station-topology';
import {V4_SLOTS,YTBS_SOURCE_CATALOG} from './ytbs-rule-catalog';
import {nativeBarCircuit} from './bar-circuit';
export type FeederRole='line'|'autotransformer'|'transformer-primary'|'transformer-incoming'|'coupler'|'transfer'|'compound'|'bank'|'measurement'|'generation'|'distribution'|'shunt'|'unknown';
export type VoltageZone='400'|'154/66'|'MV'|'OTHER';
export interface YtbsSlot {feeder:Feeder;role:FeederRole;zone:VoltageZone;slot:string;side:'A'|'B'|null;column:number;block:number;evidence:string[];typeName?:string;components?:string[];typeStatus?:string;placementRole?:FeederRole}
export function resolveVoltageZone(kv:number):VoltageZone {return kv>=300?'400':kv>=50&&kv<200?'154/66':kv>0&&kv<=40?'MV':'OTHER';}
/** V4 allows eight source bus arrangements per MV drawing block; no section is omitted. */
export function resolveBarArrangements(graph:StationTopologyGraph,kv:number){const bars=graph.busSections.filter(b=>b.voltageKv===kv),groups=[...new Set(bars.map(b=>b.groupId))].sort();return bars.map(section=>({section,block:resolveVoltageZone(kv)==='MV'?Math.floor(groups.indexOf(section.groupId)/8):0}));}
/** Actual attached equipment and winding terminals determine roles, never names or voltage ratios. */
export function classifyFeederRole(graph:StationTopologyGraph,feeder:Feeder):{role:FeederRole;evidence:string[];typeName?:string;components?:string[];typeStatus?:string;placementRole?:FeederRole} {
 const eq=graph.equipment.filter(e=>feeder.equipmentKeys.includes(`${e.sourceClass}|${e.id}`)),evidence=eq.map(e=>`${e.sourceClass}|${e.id}`);
 const components=[...new Set(eq.map(e=>e.kind))],declared=YTBS_SOURCE_CATALOG.feeders.find(t=>t.name.replace(/\s/g,'')===feeder.sourceFunction?.toLocaleUpperCase('tr-TR').replace(/\s/g,''));
 if(declared){const name=declared.name,placementRole:FeederRole|undefined=name.includes('+')?(name.includes('OTOTRANSFORMATÖR')?'autotransformer':name.includes('BANK')?'bank':name.includes('TRANSFORMATÖR')?'transformer-primary':name.includes('KUPLAJ')?'coupler':undefined):undefined;return {...(placementRole?{placementRole}:{}),role:name.includes('+')?'compound':name.includes('OTOTRANSFORMATÖR')?'autotransformer':name==='KUPLAJ'?'coupler':name==='TRANSFER'?'transfer':name.includes('BANK')?'bank':name.includes('ÖLÇÜ')?'measurement':name==='HAT'||name==='KABLO'||name==='YEDEK HAT/KABLO'?'line':name.includes('TRANSFORMATÖR')?'transformer-primary':name==='GRUP'||name==='OTOPRODÜKTÖR'?'generation':name.includes('REAKTÖR')||name.includes('KAPASİTÖR')?'shunt':'unknown',evidence:[...evidence,`ElmBay|${feeder.id}.feederFunction`],components,typeName:name,typeStatus:'SOURCE_DECLARED_FUNCTION'};}
 if(components.includes('line')&&components.some(c=>c!=='line'))return {role:'compound',evidence,components,typeName:'HAT + '+components.filter(c=>c!=='line').join(' + '),typeStatus:'NATIVE_COMPOSITION_PARTIAL_FUNCTION'};
 if(eq.some(e=>e.kind==='line'))return {role:'line',evidence};
 const tr=eq.filter(e=>e.kind==='transformer'||e.kind==='transformer3w');
 if(tr.length){const local=tr.flatMap(e=>e.terminals).filter(id=>feeder.terminalIds.includes(id)),other=tr.flatMap(e=>e.terminals).filter(id=>!local.includes(id)),known=other.map(id=>graph.terminals.find(t=>t.id===id)?.vnKv).filter((v):v is number=>v!=null&&v>0);
  if(known.some(kv=>kv>feeder.voltageKv))return {role:'transformer-incoming',evidence};
  if(known.some(kv=>kv<feeder.voltageKv)){const auto=tr.every(e=>e.autoTransformer===true),mixed=tr.some(e=>e.autoTransformer===true)&&tr.some(e=>e.autoTransformer===false);return {role:mixed?'compound':auto?'autotransformer':'transformer-primary',...(mixed?{placementRole:'autotransformer' as const}:{}),evidence:[...evidence,...tr.flatMap(e=>e.typeEvidence?[e.typeEvidence]:[])],components,typeName:mixed?'OTOTRANSFORMATÖR + TRANSFORMATÖR':auto?'OTOTRANSFORMATÖR':'TRANSFORMATÖR',typeStatus:mixed?'NATIVE_SHARED_PRIMARY_MIXED_FUNCTION':tr.every(e=>e.autoTransformer!=null)?'DOCUMENTED_DGS_FUNCTION':'UNVERIFIED_TYPE'};}
  return {role:'unknown',evidence,typeStatus:'UNVERIFIED_TYPE'};
 }
 if(eq.some(e=>e.kind==='generator'||e.kind==='externalGrid'))return {role:'generation',evidence};
 if(eq.some(e=>e.kind==='load'))return {role:'distribution',evidence};
 if(eq.some(e=>e.kind==='shunt'||e.kind==='seriesCompensator'))return {role:'shunt',evidence};
 const edges=graph.switches.filter(s=>feeder.switchIds.includes(s.id)&&s.from!==s.to);
 if(nativeBarCircuit(graph,feeder))return {role:'coupler',evidence:edges.map(s=>`${s.sourceClass}|${s.sourceId}`)};
 return {role:'unknown',evidence,typeStatus:'UNVERIFIED_TYPE'};
}
const a=[1,2,3,4,5,6,7].map(n=>n+'A'),b=[1,2,3,4,5,6,7].map(n=>n+'B');
function preferences(zone:VoltageZone,role:FeederRole):string[] {
 const policy=zone==='154/66'&&role==='autotransformer'?'transformer-primary':role==='compound'?'line':role==='transfer'?'coupler':role==='bank'&&zone==='400'?'autotransformer':role==='bank'&&zone==='154/66'?'transformer-primary':role;
 if(zone==='400'||zone==='154/66')return [...((V4_SLOTS[zone] as Readonly<Record<string,readonly string[]>>)[policy]??[])];
 if(zone==='MV')return role==='transformer-incoming'?[...V4_SLOTS.MV['transformer-incoming']]:role==='unknown'?[]:[...V4_SLOTS.MV.down];
 return [];
}
/** Reserve equipment before line overflow; additional V4 blocks retain all native feeders. */
export function assignYtbsSlot(graph:StationTopologyGraph,feeders:readonly Feeder[]):YtbsSlot[] {
 const records=feeders.map(feeder=>({feeder,zone:resolveVoltageZone(feeder.voltageKv),...classifyFeederRole(graph,feeder)})),used=new Map<number,Set<string>>(),slots:YtbsSlot[]=[];
 const priority=(r:typeof records[number])=>(r.placementRole??r.role)==='autotransformer'||r.role==='bank'&&r.zone==='400'?0:r.role==='coupler'||r.role==='transfer'?1:r.role==='line'?3:r.role==='unknown'?4:2;
 records.sort((l,r)=>priority(l)-priority(r)||l.feeder.id.localeCompare(r.feeder.id));
 for(const r of records){const preferred=preferences(r.zone,r.placementRole??r.role);let block=0,slot=r.feeder.voltageKv>=180&&r.feeder.voltageKv<300?'UNSPECIFIED_BY_V4':'UNCLASSIFIED_SLOT';
  if(preferred.length)for(;;block++){const occupied=used.get(block)??new Set<string>();used.set(block,occupied);const fallback=r.zone==='MV'?preferred:r.role==='line'?[...a,...b]:r.role==='transformer-incoming'?a:b,candidate=[...preferred,...fallback].find(s=>!occupied.has(s));if(candidate){slot=candidate;occupied.add(slot);break;}}
  const side=slot.endsWith('A')?'A':slot.endsWith('B')?'B':null,column=side?parseInt(slot)-1:slots.filter(s=>s.side===null).length;slots.push({...r,slot,side,column,block});
 }
 return slots.sort((l,r)=>l.feeder.id.localeCompare(r.feeder.id));
}
