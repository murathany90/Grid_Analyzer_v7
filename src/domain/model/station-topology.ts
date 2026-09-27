import type { CanonicalNetwork, Bus, Entity } from './network';
import { voltageMatches, type VoltageBand } from './voltage-band';
export interface StationSourceRow { id:string;name:string;attributes:Readonly<Record<string,unknown>> }
export interface StationSources { bays:readonly StationSourceRow[];terminals:readonly StationSourceRow[];switches:readonly StationSourceRow[];cubicles:readonly StationSourceRow[];substats:readonly StationSourceRow[] }
export interface BusSection { id:string;name:string;voltageKv:number;groupId:string;groupName:string;inService:boolean }
export interface Feeder { id:string;name:string;sourceClass:string;voltageKv:number;terminalIds:string[];busSectionIds:string[];switchIds:string[];equipmentKeys:string[] }
export interface StationTopologyGraph {
  siteId:string;busSections:BusSection[];feeders:Feeder[];terminals:Bus[];
  switches:{id:string;from:string;to:string;kind:'breaker'|'isolator'|'switch';bayId:string|null}[];
  equipment:{id:string;name:string;sourceClass:string;terminals:string[];kind:string}[];
  voltageLevels:number[];sourceFeederCount:number;unresolvedEndpoints:number;
}
const order=(a:{name:string;id:string},b:{name:string;id:string})=>a.name.localeCompare(b.name,'tr')||a.id.localeCompare(b.id);
/** Structural connectivity, including open switches. It is not an energized-bus reduction. */
export function buildStationTopologyGraph(network:CanonicalNetwork,siteId:string,source:StationSources):StationTopologyGraph {
  const terminals=network.buses.filter(b=>b.siteIds.includes(siteId)),termById=new Map(network.buses.map(b=>[b.id,b]));
  const bays=new Map(source.bays.map(b=>[b.id,b])),rawTerms=new Map(source.terminals.map(t=>[t.id,t])),groups=new Map(source.substats.map(g=>[g.id,g]));
  // Preserve actual bus sections; collapse bay-internal terminal nodes only in overview.
  const busSections=terminals.filter(t=>!bays.has(t.parentId)&&(!rawTerms.has(t.id)||rawTerms.get(t.id)?.attributes.iUsage==null||Number(rawTerms.get(t.id)?.attributes.iUsage)===0))
    .map(t=>({id:t.id,name:t.name,voltageKv:t.vnKv,groupId:t.parentId,groupName:groups.get(t.parentId)?.name||'',inService:t.inService})).sort((a,b)=>b.voltageKv-a.voltageKv||order(a,b));
  const sectionIds=new Set(busSections.map(b=>b.id)),rawSwitches=new Map(source.switches.map(s=>[s.id,s])),cubicles=new Map(source.cubicles.map(c=>[c.id,c]));
  const switches=network.switches.filter(s=>s.siteIds.includes(siteId)).map(s=>{
    const raw=rawSwitches.get(s.id),direct=String(raw?.attributes.fold_id??''),cub=cubicles.get(direct),terminal=cub?rawTerms.get(String(cub.attributes.fold_id??'')):null,parent=terminal?String(terminal.attributes.fold_id??''):direct,usage=String(raw?.attributes.aUsage??'').toLowerCase();
    return {id:s.id,from:s.from,to:s.to,kind:usage==='cbk'?'breaker' as const:usage==='dct'?'isolator' as const:'switch' as const,bayId:bays.has(parent)?parent:null};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  const equipment:StationTopologyGraph['equipment']=[];
  const append=(items:readonly Entity[],kind:string)=>{for(const e of items){const ends='from'in e&&'to'in e?[String(e.from),String(e.to)]:'bus'in e?[String(e.bus)]:[];if(!ends.some(t=>termById.get(t)?.siteIds.includes(siteId)))continue;equipment.push({id:e.id,name:e.name,sourceClass:e.sourceClass,terminals:ends,kind});}};
  append(network.lines,'line');append(network.transformers,'transformer');append(network.generators,'generator');append(network.loads,'load');append(network.shunts,'shunt');append(network.externalGrids,'externalGrid');append(network.seriesCompensators,'seriesCompensator');
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
  return {siteId,busSections,feeders,terminals:terminals.slice().sort(order),switches,equipment,
    voltageLevels:[...new Set([...busSections.map(b=>b.voltageKv),...feeders.map(f=>f.voltageKv)])].sort((a,b)=>b-a),sourceFeederCount:source.bays.length,
    unresolvedEndpoints:switches.reduce((n,s)=>n+Number(!termById.has(s.from))+Number(!termById.has(s.to)),0)};
}
export interface StationLayout {width:number;height:number;sections:{section:BusSection;x1:number;x2:number;y:number}[];feeders:{feeder:Feeder;x:number;y:number;busYs:number[]}[];levels:{kv:number;y:number}[];omitted:number;pageCount:number}
/** Bounded overview page, exact nominal levels, horizontal busbars and stable vertical lanes. */
export function layoutStation(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>,page=0,size=12):StationLayout {
  const all=graph.feeders.filter(f=>voltageMatches(f.voltageKv,bands)),pages=Math.max(1,Math.ceil(all.length/size)),shown=all.slice(Math.min(page,pages-1)*size,(Math.min(page,pages-1)+1)*size);
  const levels=graph.voltageLevels.filter(kv=>voltageMatches(kv,bands));
  const result:StationLayout={width:1240,height:0,sections:[],feeders:[],levels:[],omitted:all.length-shown.length,pageCount:pages};
  let y=82;
  for(const kv of levels){const sections=graph.busSections.filter(b=>b.voltageKv===kv),feeders=shown.filter(f=>f.voltageKv===kv);if(!sections.length&&!feeders.length)continue;
    result.levels.push({kv,y});const busTop=y+28;
    sections.forEach((section,i)=>result.sections.push({section,x1:225,x2:1204,y:busTop+i*31}));
    const bottom=busTop+Math.max(1,sections.length)*31+35;
    feeders.forEach((feeder,i)=>result.feeders.push({feeder,x:260+(i+.5)*900/Math.max(1,feeders.length),y:bottom+45,busYs:feeder.busSectionIds.map(id=>result.sections.find(s=>s.section.id===id)?.y).filter((v):v is number=>v!=null)}));
    y=bottom+125;
  }
  result.height=Math.max(400,y+30);return result;
}
