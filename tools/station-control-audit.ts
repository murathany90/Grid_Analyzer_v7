/** Opt-in local source audit; writes aggregate counts only, never raw DGS rows. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
import {DgsModel} from '../src/importers/dgs/index';
import {mapCanonical} from '../src/importers/dgs/canonical';
import {prepareModel} from '../src/analysis/power-flow/preparation';

const filename='kontrol1/20260928_0900_SN1_TR0.zip',archive=unzipSync(await readFile(filename)),entries=Object.keys(archive).filter(x=>x.toLowerCase().endsWith('.json'));
if(entries.length!==1)throw new Error(`Expected one DGS JSON entry; found ${entries.length}`);
const bytes=archive[entries[0]],dgs=await new DgsModel(JSON.parse(strFromU8(bytes)),entries[0],bytes.length).build(),network=mapCanonical(dgs,'audit'),prepared=prepareModel(network),topology=prepared.topology;
const generatorById=new Map(network.generators.map(g=>[g.id,g])),mappings=new Map((prepared.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[]).map(m=>[m.id,m]));
const islands=prepared.diagnostics.islands as {islandId:string;referenceSource:string|null}[],referenced=new Set(islands.filter(i=>i.referenceSource).map(i=>i.islandId));
const topologyBusIsland=new Map<number,string>();for(const part of [prepared,...(prepared.additionalIslands||[])])for(const bus of part.buses){const global=topology.terminalToBus.get(bus.terms[0]);if(global!=null&&part.islandId)topologyBusIsland.set(global,part.islandId);}
const unitOwners=new Map<string,number>();for(const c of network.stationControllers.filter(c=>c.inService))for(const id of c.unitIds)unitOwners.set(id,(unitOwners.get(id)||0)+1);
const counts={total:network.stationControllers.length,active:0,inactive:0,droop0:0,droop1:0,droopOther:0,remoteResolved:0,remoteUnresolved:0,activeUnitReferences:0,activeUniqueUnits:0,noActiveUnit:0,singleActiveUnit:0,multipleSameBus:0,multipleDifferentBus:0,completeQLimits:0,incompleteQLimits:0,noReferenceIsland:0,unitDifferentIsland:0,localVoltageControlConflicts:0,sharedUnitControllers:0,eligibleTopologyAndLimits:0};
const uniqueActive=new Set<string>(),controllerRows:{id:string;status:string;activeUnits:number;remoteIsland:string|null}[]=[];
for(const c of network.stationControllers){if(!c.inService){counts.inactive++;continue;}counts.active++;
  if(c.droopModeRaw===0)counts.droop0++;else if(c.droopModeRaw===1)counts.droop1++;else counts.droopOther++;
  const remote=topology.terminalToBus.get(c.remoteBus),mapping=mappings.get(c.id);if(remote==null)counts.remoteUnresolved++;else counts.remoteResolved++;
  const units=c.unitIds.map(id=>generatorById.get(id)).filter(g=>g?.inService&&!topology.blockedEquipment.has(g.id)&&topology.terminalToBus.has(g.bus));
  counts.activeUnitReferences+=units.length;units.forEach(g=>uniqueActive.add(g!.id));
  if(!units.length)counts.noActiveUnit++;else if(units.length===1)counts.singleActiveUnit++;else if(new Set(units.map(g=>topology.terminalToBus.get(g!.bus))).size===1)counts.multipleSameBus++;else counts.multipleDifferentBus++;
  const limits=units.length>0&&units.every(g=>g!.qMin!=null&&g!.qMax!=null&&Number.isFinite(g!.qMin)&&Number.isFinite(g!.qMax));if(limits)counts.completeQLimits++;else counts.incompleteQLimits++;
  if(!mapping?.islandId||!referenced.has(mapping.islandId))counts.noReferenceIsland++;
  const remoteIsland=mapping?.islandId??null,unitIslandIds=units.map(g=>{const bus=topology.terminalToBus.get(g!.bus);return bus==null?null:topologyBusIsland.get(bus)??null;});
  if(remoteIsland&&unitIslandIds.some(x=>x!==remoteIsland))counts.unitDifferentIsland++;
  if(units.some(g=>g!.voltageControl&&topology.terminalToBus.get(g!.bus)!==remote))counts.localVoltageControlConflicts++;
  if(units.some(g=>(unitOwners.get(g!.id)||0)>1))counts.sharedUnitControllers++;
  const eligible=c.droopModeRaw===0&&remote!=null&&mapping?.solverBusIndex!=null&&units.length>0&&(units.length===1||new Set(units.map(g=>topology.terminalToBus.get(g!.bus))).size===1)&&unitIslandIds.every(id=>id===remoteIsland)&&limits&&!units.some(g=>(unitOwners.get(g!.id)||0)>1);
  if(eligible)counts.eligibleTopologyAndLimits++;
  controllerRows.push({id:c.id,status:eligible?'ELIGIBLE':'UNSUPPORTED',activeUnits:units.length,remoteIsland});
}
counts.activeUniqueUnits=uniqueActive.size;
const report={source:'20260928_0900_SN1_TR0.zip',counts,notes:['Numeric i_ctrl/imode meanings remain unverified.','Eligibility is topology/limit audit only; it does not establish control enum semantics.'],islands:islands.map(({islandId,referenceSource})=>({islandId,referenceSource}))};
await mkdir('docs/validation',{recursive:true});await writeFile('docs/validation/20260928-station-control-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
