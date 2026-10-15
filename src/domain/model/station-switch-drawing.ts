import type {CanonicalNetwork} from './network';
import type {StationSources,StationTopologyGraph} from './station-topology';
import {feederSwitchPaths} from './station-topology';

export type SwitchDrawingClass='DRAW_VERIFIED_PATH'|'HIDE_NONFUNCTIONAL_SOURCE_LEAF'|'REVIEW_UNRESOLVED';
export interface SwitchDrawingEvidence {switchId:string;sourceClass:string;from:string;to:string;cubicleIds:string[];classification:SwitchDrawingClass;reason:string;evidence:string;leafTerminalIds:string[]}
const nativeIndexes=new WeakMap<CanonicalNetwork['switches'],Map<string,CanonicalNetwork['switches'][number]>>();
/** Presentation decisions only. Neither switch state nor global island counts
 * establish structural relevance. Source rows and canonical objects are read-only. */
export function auditSwitchDrawing(graph:StationTopologyGraph,network:CanonicalNetwork,source:StationSources):SwitchDrawingEvidence[]{
 let native=nativeIndexes.get(network.switches);if(!native){native=new Map(network.switches.map(s=>[s.id,s]));nativeIndexes.set(network.switches,native);}
 const raw=new Map(source.switches.map(r=>[r.id,r])),cubs=new Map(source.cubicles.map(r=>[r.id,r])),terms=new Set(source.terminals.map(r=>r.id));
 const bars=new Set(graph.busSections.map(b=>b.id)),equipment=new Set(graph.equipment.flatMap(e=>e.terminals)),outlets=new Set<string>();
 // A native, equipment-free feeder with a breaker and a real bar path has a
 // legitimate continuation terminal. Do not confuse it with a side stub.
 for(const f of graph.feeders){if(f.equipmentKeys.length||!source.bays.some(b=>b.id===f.id))continue;for(const p of feederSwitchPaths(graph,f)){if(p.switchIds.length<1||!p.switchIds.some(id=>graph.switches.some(s=>s.id===id&&s.kind==='breaker')))continue;let end=p.busId;for(const id of p.switchIds){const sw=graph.switches.find(s=>s.id===id)!;end=sw.from===end?sw.to:sw.from;}outlets.add(end);}}
 const loops=graph.switches.filter(s=>s.from===s.to),leaves=graph.sourceAudit?.leaves??[];
 const decisions=graph.switches.map(sw=>{
  const r=raw.get(sw.id),n=native.get(sw.id),isCubicle=sw.sourceClass==='StaSwitch',refs=isCubicle?[String(r?.attributes.fold_id??'')]:['bus1','bus2'].map(k=>String(r?.attributes[k]??'')),ends=refs.map(id=>String(cubs.get(id)?.attributes.fold_id??''));
  const evidence=`${sw.sourceClass}|${sw.id}; ${refs.map((id,i)=>`${id} → ${ends[i]}; owner=${String(cubs.get(id)?.attributes.obj_id??'')}`).join(' | ')}; canonical=${n?.from}/${n?.to}; projected=${sw.from}/${sw.to}; on_off=${String(r?.attributes.on_off)}; outserv=${String(r?.attributes.outserv??'ABSENT')}`;
  const result=(classification:SwitchDrawingClass,reason:string,leafTerminalIds:string[]=[]):SwitchDrawingEvidence=>({switchId:sw.id,sourceClass:sw.sourceClass,from:sw.from,to:sw.to,cubicleIds:refs,classification,reason,evidence,leafTerminalIds});
  if(!source.sourceEvidenceComplete||!r||!n||refs.some(id=>!id||!cubs.has(id))||ends.some(id=>!terms.has(id)))return result('REVIEW_UNRESOLVED','Ham kaynak/cubicle/terminal kanıtı eksik');
  if(n.from!==sw.from||n.to!==sw.to||ends[0]!==sw.from||(isCubicle?ends[0]:ends[1])!==sw.to)return result('REVIEW_UNRESOLVED','Ham / canonical / SLD uç eşleştirmesi çelişkili');
  const state=r.attributes.on_off,out=r.attributes.outserv;
  if(![0,1,true,false,'0','1'].includes(state as number)||n.closed!==(Number(state)===1)||(out!=null&&n.inService!==(Number(out)===0)))return result('REVIEW_UNRESOLVED','Kaynak konum/servis eşleştirmesi belirsiz');
  if(isCubicle){
   const owner=String(cubs.get(refs[0])?.attributes.obj_id??''),e=graph.equipment.find(e=>e.id===owner&&e.terminals.includes(sw.from)),same=loops.filter(s=>s.cubicleId===refs[0]);
   if(!e||n.cubicleId!==refs[0]||n.equipmentId!==owner||sw.equipmentId!==owner||same.length!==1)return result('REVIEW_UNRESOLVED','Cubicle ekipman etkisi veya birden çok cihazın kaynak sırası kanıtlanamadı');
   return result('DRAW_VERIFIED_PATH','StaSwitch: gerçek ekipman cubicle kontağı; from===to yaprak değildir');
  }
  if(sw.sourceClass!=='ElmCoup'||sw.from===sw.to||refs.some(id=>String(cubs.get(id)?.attributes.obj_id)!==sw.id))return result('REVIEW_UNRESOLVED','İki uçlu ElmCoup sahipliği kanıtlanamadı');
  if(sw.kind==='switch')return result('REVIEW_UNRESOLVED','Kaynak anahtar kullanım türü belirsiz; fiziksel görev tahmin edilmedi');
  const leaf=leaves.find(l=>l.switchIds.includes(sw.id)&&!outlets.has(l.terminalId));
  if(leaf){
   const attached=source.cubicles.filter(c=>String(c.attributes.fold_id)===leaf.terminalId),cubicleDevice=source.switches.some(s=>(s.sourceClass??native.get(s.id)?.sourceClass)==='StaSwitch'&&attached.some(c=>c.id===String(s.attributes.fold_id)));
   if(leaf.classification==='RAW_SOURCE_LEAF'&&leaf.status==='SOURCE_LEAF_VERIFIED'&&!bars.has(leaf.terminalId)&&!equipment.has(leaf.terminalId)&&!cubicleDevice&&attached.every(c=>String(c.attributes.obj_id)===sw.id))return result('HIDE_NONFUNCTIONAL_SOURCE_LEAF','Kaynakta tek anahtarlı uç; ekipman, bara veya doğrulanmış fider devamı yok. Yalnız çizimden gizlendi.',[leaf.terminalId]);
   return result('REVIEW_UNRESOLVED','Yaprak görünen uçta kaynak/ekipman rolü güvenle doğrulanamadı');
  }
  return result('DRAW_VERIFIED_PATH','İki gerçek kaynak terminali; yapısal bara/fider/ekipman bağlantısı korunur (konumdan bağımsız)');
 });
 // Peel only fully evidenced dead-end branches. A leaf can be preceded by
 // several real intermediate nodes: leaving the preceding switch/stub behind
 // would merely move the same nonfunctional tail one device upstream.
 const anchors=new Set([...bars,...equipment,...outlets]),byId=new Map(decisions.map(r=>[r.switchId,r])),edges=graph.switches.filter(s=>s.from!==s.to),remaining=new Set(edges.map(s=>s.id)),removedTerms=new Set<string>();
 const incident=new Map<string,typeof edges>();for(const s of edges)for(const id of [s.from,s.to])incident.set(id,[...(incident.get(id)??[]),s]);
 const rawDegree=new Map<string,Set<string>>();for(const r of source.switches)for(const f of ['bus1','bus2']){const t=String(cubs.get(String(r.attributes[f]??''))?.attributes.fold_id??'');if(t){const ids=rawDegree.get(t)??new Set<string>();ids.add(r.id);rawDegree.set(t,ids);}}
 const queue=[...incident.keys()];for(let i=0;i<queue.length;i++){
  const id=queue[i];if(anchors.has(id)||removedTerms.has(id))continue;const all=incident.get(id)??[],live=all.filter(s=>remaining.has(s.id));if(live.length!==1||rawDegree.get(id)?.size!==all.length)continue;
  const row=byId.get(live[0].id)!;if(row.classification==='REVIEW_UNRESOLVED')continue;
  const attached=source.cubicles.filter(c=>String(c.attributes.fold_id)===id);if(!attached.length||attached.some(c=>!all.some(s=>s.id===String(c.attributes.obj_id))))continue;
  // A hidden terminal must not carry a cubicle device or any unknown owner.
  if(source.switches.some(s=>(s.sourceClass??native.get(s.id)?.sourceClass)==='StaSwitch'&&attached.some(c=>c.id===String(s.attributes.fold_id))))continue;
  row.classification='HIDE_NONFUNCTIONAL_SOURCE_LEAF';row.reason='Ham kaynakla kanıtlı işlevsiz yaprak kolu; ara düğümler boyunca ekipman/bara/fider devamı yok. Yalnız çizimden gizlendi.';row.leafTerminalIds.push(id);row.evidence+=`; pruned terminal=${id}, raw degree=${all.length}, remaining degree=1, no equipment/cubicle owner`;
  removedTerms.add(id);remaining.delete(row.switchId);queue.push(live[0].from===id?live[0].to:live[0].from);
 }
 return decisions;
}
