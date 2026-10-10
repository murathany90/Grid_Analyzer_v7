import type {AppContext} from '../app/contracts';import {effectiveNetwork,scenarioSignature} from '../domain/scenario/overlay';
import {buildSplitBusTopology,type SplitBusTopology,type SplitBusStation} from '../topology/split-bus';
import type {BenchmarkMapSelection} from '../domain/benchmark/map-layer';import type {Settings} from '../persistence/settings';
import {splitBusMarksVisible} from './geometry';
export function splitTopologyVisible(selection:BenchmarkMapSelection|null,mode:Settings['displayMode']){
  return selection?selection.analysis==='LF'&&selection.source==='GA'&&selection.metric==='island'||selection.analysis==='N1'&&mode==='n1-island':splitBusMarksVisible(mode);
}
const cache=new WeakMap<AppContext,{network:AppContext['network'];modelHash:string;scenarioHash:string;data:SplitBusTopology;bySite:Map<string,SplitBusStation[]>}>();
export function mapTopologyPresentation(ctx:AppContext){
  if(!ctx.network)return null;const network=ctx.network,scenarioHash=scenarioSignature(ctx.scenario.current),old=cache.get(ctx);if(old?.network===network&&old.modelHash===network.modelHash&&old.scenarioHash===scenarioHash)return old;
  performance.mark('map.topology.start');const data=buildSplitBusTopology(effectiveNetwork(network,ctx.scenario.current)),bySite=new Map<string,SplitBusStation[]>(),pairs=new Set<string>();
  for(const station of data.splitStations){if(!station.siteId||station.confidence==='AMBIGUOUS')continue;const key=station.siteId+'|'+[station.bus1.electricalBusId,station.bus2.electricalBusId].sort().join('|');if(pairs.has(key))continue;pairs.add(key);const group=bySite.get(station.siteId)??[];group.push(station);bySite.set(station.siteId,group);}
  const value={network,modelHash:network.modelHash,scenarioHash,data,bySite};cache.set(ctx,value);performance.measure('map.topology','map.topology.start');return value;
}
