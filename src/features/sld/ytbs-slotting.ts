import type {Feeder,StationTopologyGraph} from '../../domain/model/station-topology';
export type FeederRole='line'|'autotransformer'|'transformer-primary'|'transformer-incoming'|'coupler'|'generation'|'distribution'|'shunt'|'unknown';
export type VoltageZone='400'|'154/66'|'MV'|'OTHER';
export interface YtbsSlot {feeder:Feeder;role:FeederRole;zone:VoltageZone;slot:string;side:'A'|'B'|null;column:number;block:number;evidence:string[]}
export function resolveVoltageZone(kv:number):VoltageZone {return kv>=300?'400':kv>=50&&kv<200?'154/66':kv>0&&kv<=40?'MV':'OTHER';}
/** V4 allows eight source bus arrangements per MV drawing block; no section is omitted. */
export function resolveBarArrangements(graph:StationTopologyGraph,kv:number){const bars=graph.busSections.filter(b=>b.voltageKv===kv),groups=[...new Set(bars.map(b=>b.groupId))].sort();return bars.map(section=>({section,block:resolveVoltageZone(kv)==='MV'?Math.floor(groups.indexOf(section.groupId)/8):0}));}
/** Actual attached equipment and winding terminals determine roles, never names or voltage ratios. */
export function classifyFeederRole(graph:StationTopologyGraph,feeder:Feeder):{role:FeederRole;evidence:string[]} {
 const eq=graph.equipment.filter(e=>feeder.equipmentKeys.includes(`${e.sourceClass}|${e.id}`)),evidence=eq.map(e=>`${e.sourceClass}|${e.id}`);
 if(eq.some(e=>e.kind==='line'))return {role:'line',evidence};
 const tr=eq.filter(e=>e.kind==='transformer'||e.kind==='transformer3w');
 if(tr.length){const local=tr.flatMap(e=>e.terminals).filter(id=>feeder.terminalIds.includes(id)),other=tr.flatMap(e=>e.terminals).filter(id=>!local.includes(id)),known=other.map(id=>graph.terminals.find(t=>t.id===id)?.vnKv).filter((v):v is number=>v!=null&&v>0);
  if(known.some(kv=>kv>feeder.voltageKv))return {role:'transformer-incoming',evidence};
  if(known.some(kv=>kv<feeder.voltageKv))return {role:'transformer-primary',evidence};
  return {role:'unknown',evidence};
 }
 if(eq.some(e=>e.kind==='generator'||e.kind==='externalGrid'))return {role:'generation',evidence};
 if(eq.some(e=>e.kind==='load'))return {role:'distribution',evidence};
 if(eq.some(e=>e.kind==='shunt'||e.kind==='seriesCompensator'))return {role:'shunt',evidence};
 const edges=graph.switches.filter(s=>feeder.switchIds.includes(s.id)&&s.from!==s.to);
 if(feeder.busSectionIds.length>=2){const seen=new Set([feeder.busSectionIds[0]]),q=[...seen];for(let i=0;i<q.length;i++)for(const s of edges){const next=s.from===q[i]?s.to:s.to===q[i]?s.from:null;if(next&&!seen.has(next)){seen.add(next);q.push(next);}}if(feeder.busSectionIds.slice(1).some(id=>seen.has(id)))return {role:'coupler',evidence:edges.map(s=>`${s.sourceClass}|${s.sourceId}`)};}
 return {role:'unknown',evidence};
}
const a=[1,2,3,4,5,6,7].map(n=>n+'A'),b=[1,2,3,4,5,6,7].map(n=>n+'B');
function preferences(zone:VoltageZone,role:FeederRole):string[] {
 if(zone==='400')return role==='line'?a:role==='autotransformer'?['1B','2B','3B']:role==='coupler'?['4B','5B']:role==='transformer-primary'?['6B','7B']:[];
 if(zone==='154/66')return role==='transformer-incoming'?['1A','2A','3A','6A','7A']:role==='transformer-primary'?['1B','2B','3B']:role==='line'?['4A','5A','4B','5B','6B','7B']:role==='coupler'?['4B','5B']:[];
 if(zone==='MV')return role==='transformer-incoming'?['1A','2A']:role==='unknown'?[]:Array.from({length:14},(_,i)=>(i+1)+'B');
 return [];
}
/** Reserve equipment before line overflow; additional V4 blocks retain all native feeders. */
export function assignYtbsSlot(graph:StationTopologyGraph,feeders:readonly Feeder[]):YtbsSlot[] {
 const records=feeders.map(feeder=>({feeder,zone:resolveVoltageZone(feeder.voltageKv),...classifyFeederRole(graph,feeder)})),used=new Map<number,Set<string>>(),slots:YtbsSlot[]=[];
 const priority=(r:typeof records[number])=>r.role==='autotransformer'?0:r.role==='coupler'?1:r.role==='line'?3:r.role==='unknown'?4:2;
 records.sort((l,r)=>priority(l)-priority(r)||l.feeder.id.localeCompare(r.feeder.id));
 for(const r of records){const preferred=preferences(r.zone,r.role);let block=0,slot='UNCLASSIFIED_SLOT';
  if(preferred.length)for(;;block++){const occupied=used.get(block)??new Set<string>();used.set(block,occupied);const fallback=r.zone==='MV'?preferred:r.role==='line'?[...a,...b]:r.role==='transformer-incoming'?a:b,candidate=[...preferred,...fallback].find(s=>!occupied.has(s));if(candidate){slot=candidate;occupied.add(slot);break;}}
  const side=slot.endsWith('A')?'A':slot.endsWith('B')?'B':null,column=side?parseInt(slot)-1:slots.filter(s=>s.side===null).length;slots.push({...r,slot,side,column,block});
 }
 return slots.sort((l,r)=>l.feeder.id.localeCompare(r.feeder.id));
}
