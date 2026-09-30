import type {CanonicalNetwork} from '../domain/model/network';
import type {CalculationResult} from '../domain/results/types';
import {buildTopology} from '../topology/electrical-topology';

export interface ElectricalIslandSummary {
  islandId:string;busCount:number;branchCount:number;referenceSource:string|null;referenceSourceName:string|null;status:string;
}
export interface SiteIslandEntry {island:ElectricalIslandSummary;busCount:number}
export interface SiteIslandSummary {dominant?:ElectricalIslandSummary;islandCount:number;entries:SiteIslandEntry[]}
export interface IslandMapData {
  islands:ElectricalIslandSummary[];lineIslands:Map<string,ElectricalIslandSummary>;siteIslands:Map<string,SiteIslandSummary>;
}

/** Stable categorical colors for the deterministic island-N identifiers emitted by topology preparation. */
export function islandColor(islandId:string):string {
  const suffix=/-(\d+)$/.exec(islandId),index=suffix?Number(suffix[1])-1:[...islandId].reduce((hash,char)=>(hash*31+char.charCodeAt(0))>>>0,7);
  const hue=((index*137.508+190)%360+360)%360;
  return `hsl(${hue.toFixed(1)} 62% 61%)`;
}

/** Rebuilds the solver's component ordering so unsupplied islands can be mapped without invented result rows. */
export function buildIslandMapData(network:CanonicalNetwork,result:CalculationResult|null):IslandMapData {
  const topology=buildTopology(network),count=topology.buses.length,adjacency:number[][]=Array.from({length:count},()=>[]),lineIndex=new Map<string,number>(),branchComponents:number[][]=[];
  const addBranch=(id:string,from:string,to:string,valid:boolean,isLine=false)=>{
    if(!valid)return;const i=topology.terminalToBus.get(from),j=topology.terminalToBus.get(to);if(i==null||j==null||i===j)return;
    adjacency[i].push(j);adjacency[j].push(i);branchComponents.push([i,j]);if(isLine)lineIndex.set(id,i);
  };
  for(const line of network.lines){const i=topology.terminalToBus.get(line.from),kv=i==null?0:topology.buses[i].vnKv,z=kv*kv/network.baseMva;addBranch(line.id,line.from,line.to,line.inService&&!topology.blockedEquipment.has(line.id)&&line.xOhm>0&&z>0&&Number.isFinite(line.rOhm/z)&&Number.isFinite(line.xOhm/z)&&Math.abs(line.rOhm/z)+Math.abs(line.xOhm/z)>1e-12,true);}
  for(const transformer of network.transformers)addBranch(transformer.id,transformer.from,transformer.to,transformer.inService&&!topology.blockedEquipment.has(transformer.id)&&transformer.tap>0&&Number.isFinite(transformer.rPu)&&Number.isFinite(transformer.xPu)&&Math.abs(transformer.rPu)+Math.abs(transformer.xPu)>1e-12);
  for(const branch of network.seriesCompensators){const i=topology.terminalToBus.get(branch.from),kv=i==null?0:topology.buses[i].vnKv,z=kv*kv/network.baseMva,r=branch.rOhm/z,x=branch.xOhm/z;addBranch(branch.id,branch.from,branch.to,branch.inService&&!topology.blockedEquipment.has(branch.id)&&z>0&&Number.isFinite(r)&&Number.isFinite(x)&&Math.abs(r)+Math.abs(x)>1e-12);}
  const componentOf=new Int32Array(count).fill(-1),components:number[][]=[];
  for(let i=0;i<count;i++)if(componentOf[i]<0){const index=components.length,group:number[]=[],stack=[i];componentOf[i]=index;while(stack.length){const bus=stack.pop()!;group.push(bus);for(const next of adjacency[bus])if(componentOf[next]<0){componentOf[next]=index;stack.push(next);}}components.push(group);}
  const rawRows=Array.isArray(result?.diagnostics.islands)?result!.diagnostics.islands as Record<string,unknown>[]:[],diagnostics=new Map(rawRows.filter(row=>typeof row.islandId==='string').map(row=>[row.islandId as string,row]));
  const sourceByComponent=new Map<number,string>();for(const source of [...network.externalGrids].sort((a,b)=>a.id.localeCompare(b.id)))if(source.inService&&!topology.blockedEquipment.has(source.id)){const bus=topology.terminalToBus.get(source.bus);if(bus!=null&&!sourceByComponent.has(componentOf[bus]))sourceByComponent.set(componentOf[bus],source.id);}
  const componentBranchCount=Array(components.length).fill(0);for(const [i]of branchComponents)componentBranchCount[componentOf[i]]++;
  const sourceNames=new Map(network.externalGrids.map(source=>[source.id,source.name]));
  const islands=components.map((buses,index)=>{
    const islandId=`island-${index+1}`,row=diagnostics.get(islandId),source=typeof row?.referenceSource==='string'?row.referenceSource:sourceByComponent.get(index)??null;
    const status=typeof row?.status==='string'?row.status:source?'NO_RESULT':'NO_REFERENCE';
    return{islandId,busCount:typeof row?.busCount==='number'?row.busCount:buses.length,branchCount:typeof row?.branchCount==='number'?row.branchCount:componentBranchCount[index],referenceSource:source,referenceSourceName:source?sourceNames.get(source)??source:null,status};
  });
  const byIsland=new Map(islands.map(island=>[island.islandId,island])),lineIslands=new Map<string,ElectricalIslandSummary>(),resultLines=new Map((result?.branches||[]).filter(branch=>branch.sourceClass==='ElmLne').map(branch=>[branch.id,branch]));
  for(const [id,bus]of lineIndex){const islandId=`island-${componentOf[bus]+1}`,rowIsland=resultLines.get(id)?.islandId;if(rowIsland&&byIsland.has(rowIsland))lineIslands.set(id,byIsland.get(rowIsland)!);else if(byIsland.has(islandId))lineIslands.set(id,byIsland.get(islandId)!);}
  const siteCounts=new Map<string,Map<string,number>>();topology.buses.forEach((bus,index)=>{const islandId=`island-${componentOf[index]+1}`;for(const siteId of bus.siteIds){const counts=siteCounts.get(siteId)||new Map<string,number>();counts.set(islandId,(counts.get(islandId)||0)+1);siteCounts.set(siteId,counts);}});
  const siteIslands=new Map<string,SiteIslandSummary>();for(const[siteId,counts]of siteCounts){const entries=[...counts].map(([islandId,busCount])=>({island:byIsland.get(islandId)!,busCount})).sort((a,b)=>b.busCount-a.busCount||a.island.islandId.localeCompare(b.island.islandId));siteIslands.set(siteId,{dominant:entries[0]?.island,islandCount:entries.length,entries});}
  return{islands,lineIslands,siteIslands};
}

export function islandDetail(info:ElectricalIslandSummary|undefined):string {
  if(!info)return 'Elektrik adası: — / Sonuç yok';
  const reference=info.referenceSourceName?`${info.referenceSourceName} (${info.referenceSource})`:'YOK';
  return `${info.islandId} · Referans: ${reference} · ${info.busCount} bara · ${info.branchCount} dal · ${info.status}`;
}
