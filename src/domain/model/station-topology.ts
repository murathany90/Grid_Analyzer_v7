import type { CanonicalNetwork, Bus, Entity } from './network';
import { voltageMatches, type VoltageBand } from './voltage-band';
export interface StationSourceRow { id:string;name:string;attributes:Readonly<Record<string,unknown>>;sourceClass?:string }
export interface StationSources { bays:readonly StationSourceRow[];terminals:readonly StationSourceRow[];switches:readonly StationSourceRow[];cubicles:readonly StationSourceRow[];substats:readonly StationSourceRow[];unsupportedEquipment?:readonly StationSourceRow[] }
export type StationIssueKind='invalidSwitchEndpoints'|'unresolvedFeederTerminals'|'unresolvedEquipmentConnections'|'missingCubicleReferences'|'ambiguousBusSections'|'unsupportedEquipmentConnections';
export interface StationIssue {kind:StationIssueKind;sourceClass:string;sourceId:string;field:string;reference:string;reason:string}
export interface StationConnection {key:string;sourceClass:string;sourceId:string;kind:'switch'|'equipment';terminals:string[];cubicleIds:string[]}
export interface BusSection { id:string;name:string;voltageKv:number;groupId:string;groupName:string;inService:boolean }
export interface Feeder { id:string;name:string;sourceClass:string;voltageKv:number;terminalIds:string[];busSectionIds:string[];switchIds:string[];equipmentKeys:string[] }
export interface StationTopologyGraph {
  siteId:string;busSections:BusSection[];feeders:Feeder[];terminals:Bus[];
  switches:{id:string;sourceId:string;sourceClass:string;from:string;to:string;kind:'breaker'|'isolator'|'switch';bayId:string|null;cubicleId?:string;equipmentId?:string;stateKnown:boolean}[];
  equipment:{id:string;name:string;sourceClass:string;terminals:string[];kind:string}[];
  voltageLevels:number[];sourceFeederCount:number;unresolvedEndpoints:number;
  connections:StationConnection[];issues:StationIssue[];counters:Record<StationIssueKind|'diagramUnresolvedTotal',number>;
}
const order=(a:{name:string;id:string},b:{name:string;id:string})=>a.name.localeCompare(b.name,'tr')||a.id.localeCompare(b.id);
/** Structural connectivity, including open switches. It is not an energized-bus reduction. */
export function buildStationTopologyGraph(network:CanonicalNetwork,siteId:string,source:StationSources):StationTopologyGraph {
  const terminals=network.buses.filter(b=>b.siteIds.includes(siteId)),termById=new Map(network.buses.map(b=>[b.id,b]));
  const bays=new Map(source.bays.map(b=>[b.id,b])),rawTerms=new Map(source.terminals.map(t=>[t.id,t])),groups=new Map(source.substats.map(g=>[g.id,g]));
  // Preserve actual bus sections; collapse bay-internal terminal nodes only in overview.
  const busSections=terminals.filter(t=>!bays.has(t.parentId)&&rawTerms.get(t.id)?.attributes.iUsage!=null&&Number(rawTerms.get(t.id)?.attributes.iUsage)===0)
    .map(t=>({id:t.id,name:t.name,voltageKv:t.vnKv,groupId:t.parentId,groupName:groups.get(t.parentId)?.name||'',inService:t.inService})).sort((a,b)=>b.voltageKv-a.voltageKv||order(a,b));
  const sectionIds=new Set(busSections.map(b=>b.id)),rawSwitches=new Map(source.switches.map(s=>[s.id,s])),cubicles=new Map(source.cubicles.map(c=>[c.id,c]));
  const switches=network.switches.filter(s=>s.siteIds.includes(siteId)).map(s=>{
    const raw=rawSwitches.get(s.id),direct=String(raw?.attributes.fold_id??''),cub=cubicles.get(direct),terminal=cub?rawTerms.get(String(cub.attributes.fold_id??'')):null,parent=terminal?String(terminal.attributes.fold_id??''):direct,usage=String(raw?.attributes.aUsage??'').toLowerCase();
    return {id:s.id,sourceId:s.sourceId,sourceClass:s.sourceClass,from:s.from,to:s.to,kind:usage==='cbk'?'breaker' as const:usage==='dct'?'isolator' as const:'switch' as const,bayId:bays.has(parent)?parent:null,cubicleId:s.cubicleId,equipmentId:s.equipmentId,stateKnown:([0,1,true,false,'0','1'] as unknown[]).includes(raw?.attributes.on_off)};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  const equipment:StationTopologyGraph['equipment']=[];
  const append=(items:readonly Entity[],kind:string)=>{for(const e of items){const ends='from'in e&&'to'in e?[String(e.from),String(e.to)]:'bus'in e?[String(e.bus)]:[];if(!ends.some(t=>termById.get(t)?.siteIds.includes(siteId)))continue;equipment.push({id:e.id,name:e.name,sourceClass:e.sourceClass,terminals:ends,kind});}};
  append(network.lines,'line');append(network.transformers,'transformer');append(network.generators,'generator');append(network.loads,'load');append(network.shunts,'shunt');append(network.externalGrids,'externalGrid');append(network.seriesCompensators,'seriesCompensator');
  for(const row of source.unsupportedEquipment??[]){const cls=row.sourceClass??'ElmTr3',fields=cls==='ElmTr3'?['bushv','busmv','buslv']:['bushv','buslv'],ends=fields.map(f=>String(cubicles.get(String(row.attributes[f]??''))?.attributes.fold_id??''));equipment.push({id:row.id,name:row.name,sourceClass:cls,terminals:ends,kind:cls==='ElmTr3'?'transformer3w':'transformer'});}
  equipment.sort(order);
  const feeders:Feeder[]=[];
  for(const bay of [...source.bays].sort(order)){
    const own=terminals.filter(t=>t.parentId===bay.id).map(t=>t.id),edges=switches.filter(s=>s.bayId===bay.id),ids=new Set([...own,...edges.flatMap(s=>[s.from,s.to]).filter(Boolean)]);
    const ownSet=new Set(own),attached=equipment.filter(e=>e.terminals.some(t=>ownSet.has(t)));
    const nominal=own.map(t=>termById.get(t)?.vnKv).find((v):v is number=>v!=null&&v>0)??[...ids].map(t=>termById.get(t)?.vnKv).find((v):v is number=>v!=null&&v>0)??0;
    feeders.push({id:bay.id,name:bay.name,sourceClass:'ElmBay',voltageKv:nominal,terminalIds:[...ids].sort(),busSectionIds:[...ids].filter(id=>sectionIds.has(id)).sort(),switchIds:edges.map(s=>s.id),equipmentKeys:attached.map(e=>`${e.sourceClass}|${e.id}`)});
  }
  // Direct busbar equipment may have no ElmBay; retain it without inventing a bay or connection.
  const covered=new Set(feeders.flatMap(f=>f.equipmentKeys));
  for(const e of equipment)if(!covered.has(`${e.sourceClass}|${e.id}`)){
    const local=e.terminals.filter(t=>termById.get(t)?.siteIds.includes(siteId));
    feeders.push({id:`${e.sourceClass}|${e.id}`,name:e.name,sourceClass:e.sourceClass,voltageKv:termById.get(local[0])?.vnKv??0,terminalIds:local,busSectionIds:local.filter(t=>sectionIds.has(t)),switchIds:[],equipmentKeys:[`${e.sourceClass}|${e.id}`]});
  }
  feeders.sort((a,b)=>b.voltageKv-a.voltageKv||order(a,b));
  const graph:StationTopologyGraph={siteId,busSections,feeders,terminals:terminals.slice().sort(order),switches,equipment,
    voltageLevels:[...new Set([...busSections.map(b=>b.voltageKv),...feeders.map(f=>f.voltageKv)])].sort((a,b)=>b-a),sourceFeederCount:source.bays.length,
    unresolvedEndpoints:switches.reduce((n,s)=>n+Number(!termById.has(s.from))+Number(!termById.has(s.to)),0),connections:[],issues:[],counters:{invalidSwitchEndpoints:0,unresolvedFeederTerminals:0,unresolvedEquipmentConnections:0,missingCubicleReferences:0,ambiguousBusSections:0,unsupportedEquipmentConnections:0,diagramUnresolvedTotal:0}};
  const issue=(kind:StationIssueKind,sourceClass:string,sourceId:string,field:string,reference:string,reason:string)=>graph.issues.push({kind,sourceClass,sourceId,field,reference,reason});
  for(const sw of switches){
    for(const [field,id]of [['from',sw.from],['to',sw.to]])if(!termById.has(id))issue('invalidSwitchEndpoints',sw.sourceClass,sw.sourceId,field,id,'Terminal FID bulunamadı');
    if(sw.cubicleId&&!cubicles.has(sw.cubicleId))issue('missingCubicleReferences',sw.sourceClass,sw.sourceId,'cubicleId',sw.cubicleId,'StaCubic kaydı bulunamadı');
    const raw=rawSwitches.get(sw.id),refs=sw.cubicleId?[sw.cubicleId]:['bus1','bus2'].map(f=>String(raw?.attributes[f]??'')).filter(Boolean);
    for(const ref of refs)if(!cubicles.has(ref)&&ref!==sw.cubicleId)issue('missingCubicleReferences',sw.sourceClass,sw.sourceId,'bus1/bus2',ref,'Kaynak StaCubic referansı katalogda bulunamadı');
    graph.connections.push({key:`${sw.sourceClass}|${sw.sourceId}`,sourceClass:sw.sourceClass,sourceId:sw.sourceId,kind:'switch',terminals:[sw.from,sw.to],cubicleIds:refs});
  }
  for(const e of equipment){
    for(const id of e.terminals)if(!termById.has(id))issue('unresolvedEquipmentConnections',e.sourceClass,e.id,'terminal',id,'Ekipman terminal FID bulunamadı');
    graph.connections.push({key:`${e.sourceClass}|${e.id}`,sourceClass:e.sourceClass,sourceId:e.id,kind:'equipment',terminals:e.terminals,cubicleIds:source.cubicles.filter(c=>String(c.attributes.obj_id)===e.id).map(c=>c.id)});
  }
  for(const f of feeders){
    const shared=f.terminalIds.some(id=>equipment.filter(e=>e.terminals.includes(id)).length>1);
    if(!feederSwitchPaths(graph,f).length&&!f.busSectionIds.length&&!shared)issue('unresolvedFeederTerminals',f.sourceClass,f.id,'terminalIds',f.terminalIds.join(','),'Bara yolu veya ortak ekipman terminali çözümlenemedi');
  }
  for(const row of source.unsupportedEquipment??[])issue('unsupportedEquipmentConnections',row.sourceClass??'ElmTr3',row.id,'winding',String(row.attributes.bushv??''),'Canonical hesap bağlantısı desteklenmiyor; yalnız kaynak portları gösterilebilir');
  for(const terminal of terminals){const row=rawTerms.get(terminal.id);if(row?.attributes.iUsage==null&&!bays.has(terminal.parentId))issue('ambiguousBusSections','ElmTerm',terminal.id,'iUsage','','Bara/terminal kullanımı kaynakta yok; terminal kimliği korunur, bara tahmin edilmez');}
  for(const record of graph.issues)graph.counters[record.kind]++;
  graph.counters.diagramUnresolvedTotal=graph.issues.length;
  return graph;
}
export interface StationLayout {width:number;height:number;sections:{section:BusSection;x1:number;x2:number;y:number}[];feeders:{feeder:Feeder;x:number;y:number;busYs:number[]}[];levels:{kv:number;y:number}[];omitted:number;pageCount:number}
/** Full station by default; each nominal voltage owns its independent deterministic lanes. */
export function layoutStation(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>,page=0,size=Infinity):StationLayout {
  const all=graph.feeders.filter(f=>voltageMatches(f.voltageKv,bands)),pages=Number.isFinite(size)?Math.max(1,Math.ceil(all.length/size)):1,shown=Number.isFinite(size)?all.slice(Math.min(page,pages-1)*size,(Math.min(page,pages-1)+1)*size):all;
  const levels=graph.voltageLevels.filter(kv=>voltageMatches(kv,bands));
  const couplers=graph.switches.filter(s=>graph.busSections.some(b=>b.id===s.from)&&graph.busSections.some(b=>b.id===s.to)).length;
  const left=250+couplers*28,laneWidth=Math.max(700,...levels.map(kv=>shown.filter(f=>f.voltageKv===kv).length*160)),right=100;
  const result:StationLayout={width:Math.max(1200,left+laneWidth+right),height:0,sections:[],feeders:[],levels:[],omitted:all.length-shown.length,pageCount:pages};
  let y=82;
  for(const kv of levels){const sections=graph.busSections.filter(b=>b.voltageKv===kv),feeders=shown.filter(f=>f.voltageKv===kv);if(!sections.length&&!feeders.length)continue;
    result.levels.push({kv,y});const busTop=y+28;
    sections.forEach((section,i)=>result.sections.push({section,x1:225,x2:left+laneWidth,y:busTop+i*34}));
    const bottom=busTop+Math.max(1,sections.length)*34+40,depth=Math.max(2,...feeders.map(f=>f.switchIds.length));
    feeders.forEach((feeder,i)=>result.feeders.push({feeder,x:left+(i+.5)*laneWidth/Math.max(1,feeders.length),y:bottom+depth*48+30,busYs:feeder.busSectionIds.map(id=>result.sections.find(s=>s.section.id===id)?.y).filter((v):v is number=>v!=null)}));
    y=bottom+depth*48+220;
  }
  result.height=Math.max(400,y+30);return result;
}
/** Actual bus-to-equipment switch paths, without deriving a switching sequence. */
export function feederSwitchPaths(graph:StationTopologyGraph,feeder:Feeder):{busId:string;switchIds:string[]}[]{
  const switches=graph.switches.filter(s=>feeder.switchIds.includes(s.id));
  const targets=new Set(graph.equipment.filter(e=>feeder.equipmentKeys.includes(`${e.sourceClass}|${e.id}`)).flatMap(e=>e.terminals).filter(id=>feeder.terminalIds.includes(id)));
  if(!targets.size){
    const leaves=graph.terminals.filter(t=>t.parentId===feeder.id&&switches.filter(s=>s.from===t.id||s.to===t.id).length===1);
    if(leaves.length===1)targets.add(leaves[0].id);
    else if(feeder.busSectionIds.length>1)targets.add(feeder.busSectionIds.at(-1)!);
  }
  if(!targets.size)return [];
  return feeder.busSectionIds.flatMap(busId=>{const queue=[{id:busId,switchIds:[] as string[]}],seen=new Set([busId]);
    for(let i=0;i<queue.length;i++){const item=queue[i];if(targets.has(item.id))return[{busId,switchIds:item.switchIds}];
      for(const sw of switches){const next=sw.from===item.id?sw.to:sw.to===item.id?sw.from:null;if(next&&!seen.has(next)){seen.add(next);queue.push({id:next,switchIds:[...item.switchIds,sw.id]});}}
    }return[];
  });
}
/** Equipment may share an internal terminal without a physical busbar (e.g. generator/GSU). */
export function stationTerminalLinks(graph:StationTopologyGraph,layout:StationLayout):{terminal:Bus;points:{x:number;y:number;feederId:string}[]}[]{
  const sections=new Set(graph.busSections.map(b=>b.id));
  return graph.terminals.filter(t=>!sections.has(t.id)).flatMap(terminal=>{
    const equipmentKeys=new Set(graph.equipment.filter(e=>e.terminals.includes(terminal.id)).map(e=>`${e.sourceClass}|${e.id}`));
    if(equipmentKeys.size<2)return[];
    const points=layout.feeders.filter(p=>p.feeder.voltageKv===terminal.vnKv&&p.feeder.terminalIds.includes(terminal.id)&&p.feeder.equipmentKeys.some(key=>equipmentKeys.has(key))).map(p=>({x:p.x,y:p.y,feederId:p.feeder.id}));
    return points.length>1?[{terminal,points}]:[];
  });
}
