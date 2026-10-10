import {beginPresentationTiming,endPresentationTiming} from './presentation-timing';
import type {CanonicalNetwork} from '../domain/model/network';
import type {BusResult,CalculationResult} from '../domain/results/types';
import {voltageMatches,type VoltageBand} from '../domain/model/voltage-band';

export type SolvedBus=Pick<BusResult,'terms'|'vnKv'|'vmPu'>&Partial<Pick<BusResult,'id'|'siteIds'>>;
export const partitionKey=(b:Pick<SolvedBus,'vnKv'|'terms'>)=>b.vnKv+'|'+JSON.stringify([...b.terms].sort());
const models=new WeakMap<CanonicalNetwork,ReturnType<typeof makeModelIndex>>();
function makeModelIndex(network:CanonicalNetwork){
  beginPresentationTiming('map.index');
  const physicalTerminalById=new Map<string,CanonicalNetwork['buses'][number]>(),ambiguous=new Set<string>(),seen=new Set<string>(),busIdsBySite=new Map<string,string[]>(),nominalsBySite=new Map<string,number[]>();
  for(const bus of network.buses){
    if(seen.has(bus.id)){physicalTerminalById.delete(bus.id);ambiguous.add(bus.id);}else{seen.add(bus.id);physicalTerminalById.set(bus.id,bus);}
    for(const id of new Set(bus.siteIds)){const list=busIdsBySite.get(id)??[];list.push(bus.id);busIdsBySite.set(id,list);const kvs=nominalsBySite.get(id)??[];if(Number.isFinite(bus.vnKv)&&bus.vnKv>0&&!kvs.includes(bus.vnKv))kvs.push(bus.vnKv);nominalsBySite.set(id,kvs);}
  }
  for(const kvs of nominalsBySite.values())kvs.sort((a,b)=>b-a);
  const siteById=new Map(network.sites.map(s=>[s.id,s])),equipmentByKey=new Map([...network.lines,...network.transformers].map(e=>[e.sourceClass+':'+e.id,e])),equipmentByFid=new Map([...network.lines,...network.transformers].map(e=>[e.sourceClass+':'+e.sourceId,e])),transformersBySite=new Map<string,CanonicalNetwork['transformers'][number][]>();
  for(const t of network.transformers)for(const id of new Set(t.siteIds)){const list=transformersBySite.get(id)??[];list.push(t);transformersBySite.set(id,list);}
  endPresentationTiming('map.index');
  return {modelHash:network.modelHash,buses:network.buses,sites:network.sites,lines:network.lines,transformers:network.transformers,physicalTerminalById,ambiguous,busIdsBySite,nominalsBySite,siteById,equipmentByKey,equipmentByFid,transformersBySite,highestByBands:new Map<string,Map<string,number|null>>()};
}
/** Model objects and solved arrays are immutable snapshots; replacements invalidate the index. */
export function modelPresentationIndex(network:CanonicalNetwork){
  let index=models.get(network);
  if(!index||index.modelHash!==network.modelHash||index.buses!==network.buses||index.sites!==network.sites||index.lines!==network.lines||index.transformers!==network.transformers){index=makeModelIndex(network);models.set(network,index);}return index;
}
export function highestNominalBySite(network:CanonicalNetwork,bands:ReadonlySet<VoltageBand>){
  const index=modelPresentationIndex(network),key=[...bands].sort().join('|');let highest=index.highestByBands.get(key);
  if(!highest){highest=new Map([...index.nominalsBySite].map(([id,kvs])=>[id,kvs.find(kv=>voltageMatches(kv,bands))??null]));index.highestByBands.set(key,highest);}return highest;
}
interface SolutionIndex<T extends SolvedBus>{model:ReturnType<typeof modelPresentationIndex>;identity:string;bySiteAndNominal:Map<string,Map<number,{bus:T;count:number}>>;byTerminal:Map<string,T|null>;byPartition:Map<string,T|null>}
const solutions=new WeakMap<object,SolutionIndex<SolvedBus>>();
export function solutionPresentationIndex<T extends SolvedBus>(network:CanonicalNetwork,buses:readonly T[],identity:string):SolutionIndex<T>{
  const model=modelPresentationIndex(network),cached=solutions.get(buses);if(cached?.model===model&&cached.identity===identity)return cached as SolutionIndex<T>;
  beginPresentationTiming('map.solution-index');
  const bySiteAndNominal=new Map<string,Map<number,{bus:T;count:number}>>(),byTerminal=new Map<string,T|null>(),byPartition=new Map<string,T|null>(),valid:T[]=[];
  for(const bus of buses){
    if(!Number.isFinite(bus.vmPu)||!bus.terms.length||!bus.terms.every(id=>model.physicalTerminalById.get(id)?.vnKv===bus.vnKv))continue;
    const key=partitionKey(bus);valid.push(bus);
    byPartition.set(key,byPartition.has(key)?null:bus);
    for(const id of bus.terms)byTerminal.set(id,byTerminal.has(id)?null:bus);
  }
  for(const bus of valid){const key=partitionKey(bus);if(byPartition.get(key)!==bus||!bus.terms.every(id=>byTerminal.get(id)===bus))continue;const sites=new Set(bus.terms.flatMap(id=>model.physicalTerminalById.get(id)!.siteIds));
    for(const id of sites){if(bus.siteIds&&!bus.siteIds.includes(id))continue;const nominals=bySiteAndNominal.get(id)??new Map(),previous=nominals.get(bus.vnKv),tie=bus.id??key,oldTie=previous?.bus.id??(previous?partitionKey(previous.bus):'');
      nominals.set(bus.vnKv,{bus:!previous||bus.vmPu>previous.bus.vmPu||bus.vmPu===previous.bus.vmPu&&tie.localeCompare(oldTie)<0?bus:previous.bus,count:(previous?.count??0)+1});bySiteAndNominal.set(id,nominals);
    }
  }
  const index={model,identity,bySiteAndNominal,byTerminal,byPartition};solutions.set(buses,index);endPresentationTiming('map.solution-index');return index;
}
const results=new WeakMap<CalculationResult,{network:CanonicalNetwork;identity:string;branches:CalculationResult['branches'];branchByKey:Map<string,CalculationResult['branches'][number]>;referenceIslands:Set<string>}>();
export function resultPresentationIndex(network:CanonicalNetwork,result:CalculationResult){
  const identity=JSON.stringify(result.identity);let index=results.get(result);
  if(!index||index.network!==network||index.identity!==identity||index.branches!==result.branches){const islands=Array.isArray(result.diagnostics.islands)?result.diagnostics.islands as {islandId:string;referenceSource?:string;status?:string}[]:[];
    index={network,identity,branches:result.branches,branchByKey:new Map(result.branches.map(b=>[b.sourceClass+':'+b.id,b])),referenceIslands:new Set(islands.filter(i=>typeof i.referenceSource==='string'&&i.referenceSource.length>0&&!['NO_REFERENCE','NO_RESULT'].includes(i.status??'')).map(i=>i.islandId))};results.set(result,index);}
  return {...index,solution:solutionPresentationIndex(network,result.buses,identity)};
}
