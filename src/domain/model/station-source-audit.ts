import type {CanonicalNetwork,Entity} from './network';
import type {StationSources,StationTopologyGraph} from './station-topology';

export type SourceClassification='MATCH'|'RAW_SOURCE_LEAF'|'IMPORT_MAPPING_MISMATCH'|'STATION_PROJECTION_MISMATCH'|'LAYOUT_DRAWING_GAP'|'INSUFFICIENT_SOURCE';
export interface WindingSourceAudit {transformerId:string;sourceClass:string;side:'HV'|'MV'|'LV';cubicleId:string;rawTerminalId:string;canonicalTerminalId:string;projectedTerminalId:string;cubicleOwnerId:string;classification:SourceClassification;evidence:string}
export interface SourceLeafAudit {terminalId:string;classification:SourceClassification;status:'SOURCE_LEAF_VERIFIED'|'MISMATCH'|'UNKNOWN';switchIds:string[];cubicleIds:string[];windings:WindingSourceAudit[];evidence:string}
export interface StationSourceAudit {windings:WindingSourceAudit[];leaves:SourceLeafAudit[];status:'SOURCE_PARITY_VERIFIED'|'PARTIAL'|'MISMATCH'}
const ends=(e:Entity)=>'from'in e&&'to'in e?[String(e.from),String(e.to)]:'bus'in e?[String(e.bus)]:[];
/** Source identities are checked, never repaired or merged by this audit. */
export function auditStationSource(graph:StationTopologyGraph,network:CanonicalNetwork,source:StationSources):StationSourceAudit {
 const cubs=new Map(source.cubicles.map(c=>[c.id,c])),terms=new Set(source.terminals.map(t=>t.id)),rawSwitches=new Map(source.switches.map(s=>[s.id,s])),rawTransformers=new Map([...(source.transformers??[]),...(source.unsupportedEquipment??[])].map(r=>[r.id,r]));
 const canonical=new Map(network.transformers.map(e=>[e.id,e])),windings:WindingSourceAudit[]=[];
 const expected=graph.equipment.filter(e=>e.kind==='transformer'||e.kind==='transformer3w');for(const r of [...(source.transformers??[]),...(source.unsupportedEquipment??[])])if(!expected.some(e=>e.id===r.id)){const cls=r.sourceClass??'ElmTr2';expected.push({id:r.id,name:r.name,sourceClass:cls,kind:cls==='ElmTr3'?'transformer3w':'transformer',terminals:[]});}
 for(const e of expected){
  const raw=rawTransformers.get(e.id),fields=e.kind==='transformer3w'?['bushv','busmv','buslv']:['bushv','buslv'];
  for(const [i,field]of fields.entries()){
   const cubicleId=String(raw?.attributes[field]??''),cub=cubs.get(cubicleId),rawTerminalId=String(cub?.attributes.fold_id??''),cubicleOwnerId=String(cub?.attributes.obj_id??''),tr=e.kind==='transformer3w'?undefined:canonical.get(e.id),canonicalTerminalId=tr?(i===0?tr.from:tr.to):'',projectedTerminalId=e.terminals[i]??'';
   const classification:SourceClassification=!raw||!cub||!rawTerminalId||!terms.has(rawTerminalId)||cubicleOwnerId!==e.id?'INSUFFICIENT_SOURCE':e.kind!=='transformer3w'&&(!tr||canonicalTerminalId!==rawTerminalId)?'IMPORT_MAPPING_MISMATCH':projectedTerminalId!==rawTerminalId?'STATION_PROJECTION_MISMATCH':'MATCH';
   windings.push({transformerId:e.id,sourceClass:e.sourceClass,side:i===0?'HV':i===1&&fields.length===3?'MV':'LV',cubicleId,rawTerminalId,canonicalTerminalId,projectedTerminalId,cubicleOwnerId,classification,evidence:`${e.sourceClass}|${e.id}.${field}=${cubicleId}; StaCubic|${cubicleId}.fold_id=${rawTerminalId}; obj_id=${cubicleOwnerId}; canonical=${canonicalTerminalId||'UNSUPPORTED_3W'}; projection=${projectedTerminalId}`});
  }
 }
 const bars=new Set(graph.busSections.map(b=>b.id)),leaves:SourceLeafAudit[]=[],physical=[network.lines,network.transformers,network.generators,network.loads,network.shunts,network.externalGrids,network.seriesCompensators,network.internationalConnections];
 for(const t of graph.terminals){
  const switches=graph.switches.filter(s=>s.from!==s.to&&(s.from===t.id||s.to===t.id));if(bars.has(t.id)||switches.length!==1||graph.equipment.some(e=>e.terminals.includes(t.id)))continue;
  const sw=switches[0],raw=rawSwitches.get(sw.id),refs=['bus1','bus2'].map(f=>String(raw?.attributes[f]??'')),rawEnds=refs.map(id=>String(cubs.get(id)?.attributes.fold_id??'')),attached=source.cubicles.filter(c=>String(c.attributes.fold_id)===t.id),rawEdges=source.switches.filter(r=>['bus1','bus2'].some(f=>String(cubs.get(String(r.attributes[f]??''))?.attributes.fold_id??'')===t.id));
  let classification:SourceClassification=!source.sourceEvidenceComplete||!terms.has(t.id)||!raw||rawEnds.some(id=>!id)||attached.some(c=>!String(c.attributes.obj_id??''))?'INSUFFICIENT_SOURCE':rawEnds[0]!==sw.from||rawEnds[1]!==sw.to?'IMPORT_MAPPING_MISMATCH':rawEdges.length!==1?'STATION_PROJECTION_MISMATCH':'RAW_SOURCE_LEAF';
  for(const c of attached.filter(c=>!switches.some(s=>s.id===String(c.attributes.obj_id)))){
   const id=String(c.attributes.obj_id),device=physical.flatMap(a=>a.filter(e=>e.id===id))[0],winding=windings.find(w=>w.transformerId===id&&w.rawTerminalId===t.id);
   classification=winding&&winding.classification!=='MATCH'?winding.classification:device&&ends(device).includes(t.id)?'STATION_PROJECTION_MISMATCH':'INSUFFICIENT_SOURCE';
  }
  // Report nearby windings through real switch edges, stopping at physical bars.
  // Distance supplies context only; it cannot create a winding attachment.
  const visited=new Set<string>([t.id]),queue=[t.id];let related:WindingSourceAudit[]=[];
  for(let i=0;i<queue.length&&!related.length;){const layer=queue.slice(i);i=queue.length;related=windings.filter(w=>layer.includes(w.rawTerminalId));if(related.length)break;for(const id of layer)for(const edge of graph.switches){const next=edge.from===id?edge.to:edge.to===id?edge.from:null;if(next&&!visited.has(next)&&!bars.has(next)){visited.add(next);queue.push(next);}}}
  leaves.push({terminalId:t.id,classification,status:classification==='RAW_SOURCE_LEAF'?'SOURCE_LEAF_VERIFIED':classification==='INSUFFICIENT_SOURCE'?'UNKNOWN':'MISMATCH',switchIds:switches.map(s=>s.id),cubicleIds:attached.map(c=>c.id),windings:related,evidence:`ElmTerm|${t.id}; ${sw.sourceClass}|${sw.id}: raw ${rawEnds.join(' → ')}, canonical/projection ${sw.from} → ${sw.to}; raw terminal switch degree=${rawEdges.length}; cubicle owners=${attached.map(c=>c.id+':'+String(c.attributes.obj_id)).join('|')}; no projected equipment attached. Nearby windings are context, not an inferred connection.`});
 }
 const mismatch=(v:SourceClassification)=>v==='IMPORT_MAPPING_MISMATCH'||v==='STATION_PROJECTION_MISMATCH';
 return{windings,leaves,status:!source.sourceEvidenceComplete?'PARTIAL':[...windings,...leaves].some(r=>mismatch(r.classification))?'MISMATCH':[...windings,...leaves].some(r=>r.classification==='INSUFFICIENT_SOURCE')?'PARTIAL':'SOURCE_PARITY_VERIFIED'};
}
