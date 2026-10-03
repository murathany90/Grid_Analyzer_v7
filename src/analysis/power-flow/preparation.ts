import type { CanonicalNetwork, Generator } from '../../domain/model/network';
import { buildTopology, type ElectricalBus, type ElectricalTopology } from '../../topology/electrical-topology';
export interface NumericBranch { i:number;j:number;r:number;x:number;bch:number;tap:number;phase:number;gMagPu?:number;bMagPu?:number }
export interface NumericModel {
  n:number;baseMVA:number;slack:number;slackVm:number;pSpec:Float64Array;qSpec:Float64Array;busType:Int8Array;vmSet:Float64Array;
  shuntG:Float64Array;shuntB:Float64Array;qMinNet:(number|null)[];qMaxNet:(number|null)[];branches:NumericBranch[];
}
export interface BranchMeta { id:string;name:string;sourceClass:string;from:string;to:string;siteIds:string[];vnKv:number;ratingMva:number|null;i:number;j:number }
export interface PreparedModel { model:NumericModel;buses:ElectricalBus[];branches:BranchMeta[];generators:(Generator&{index:number})[];topology:ElectricalTopology;diagnostics:Record<string,unknown>;warnings:string[];islandId?:string;additionalIslands?:PreparedModel[];stationControlUnitResults?:ReadonlyMap<string,{qMvar:number|null;qState:string}> }
export function prepareModel(n:CanonicalNetwork):PreparedModel{
  const topology=buildTopology(n),N=topology.buses.length,bi=topology.terminalToBus,warnings=[...topology.warnings];
  const pSpec=new Float64Array(N),qSpec=new Float64Array(N),busType=new Int8Array(N),vmSet=new Float64Array(N).fill(1),shuntG=new Float64Array(N),shuntB=new Float64Array(N),qMinNet:(number|null)[]=Array(N).fill(null),qMaxNet:(number|null)[]=Array(N).fill(null);
  const branches:NumericBranch[]=[],metadata:BranchMeta[]=[];
  const enabled=(e:{id:string;inService:boolean})=>e.inService&&!topology.blockedEquipment.has(e.id);
  const add=(e:{id:string;name:string;sourceClass:string;from:string;to:string;siteIds:readonly string[]},r:number,x:number,bch:number,tap:number,phase:number,ratingMva:number|null,gMagPu=0,bMagPu=0)=>{
    const i=bi.get(e.from),j=bi.get(e.to);if(i==null||j==null||i===j)return;
    if(!Number.isFinite(r)||!Number.isFinite(x)||Math.abs(r)+Math.abs(x)<=1e-12||!(tap>0)){warnings.push(`Geçersiz dal parametresi: ${e.name}`);return;}
    branches.push({i,j,r,x,bch,tap,phase,gMagPu,bMagPu});metadata.push({...e,siteIds:[...e.siteIds],vnKv:topology.buses[i].vnKv,ratingMva,i,j});
  };
  for(const e of n.lines.filter(enabled)){const z=(topology.buses[bi.get(e.from)??-1]?.vnKv||0)**2/n.baseMva;if(!(e.xOhm>0&&z>0)){warnings.push(`Hat X/Zbase geçersiz: ${e.name}`);continue;}add(e,e.rOhm/z,e.xOhm/z,e.bSiemens*z,1,0,e.ratingMva);}
  for(const e of n.transformers.filter(enabled)){add(e,e.rPu,e.xPu,0,e.tap,e.phase,e.ratingMva,e.gPu,e.bPu);const i=bi.get(e.from);if(i!=null){shuntG[i]+=e.gPu;shuntB[i]+=e.bPu;}}
  for(const e of n.seriesCompensators.filter(enabled)){const z=(topology.buses[bi.get(e.from)??-1]?.vnKv||0)**2/n.baseMva;add(e,e.rOhm/z,e.xOhm/z,0,1,0,null);}
  for(const e of n.shunts.filter(enabled)){const i=bi.get(e.bus);if(i!=null){shuntG[i]+=e.gPu;shuntB[i]+=e.bPu;}}
  const generators:(Generator&{index:number})[]=[];
  for(const e of n.generators.filter(enabled)){const i=bi.get(e.bus);if(i==null)continue;generators.push({...e,index:i});pSpec[i]+=e.pMw;qSpec[i]+=e.qMvar;
    if(e.voltageControl){if(busType[i]===0){busType[i]=1;vmSet[i]=e.vmSet;}else if(Math.abs(vmSet[i]-e.vmSet)>1e-5)warnings.push(`PV setpoint çakışması: ${topology.buses[i].name}`);}}
  for(const e of[...n.loads,...n.internationalConnections].filter(enabled)){const i=bi.get(e.bus);if(i!=null){pSpec[i]-=e.pMw;qSpec[i]-=e.qMvar;}}
  const sources=n.externalGrids.filter(enabled).map(e=>({...e,index:bi.get(e.bus)})).filter((e):e is typeof e&{index:number}=>e.index!==undefined);
  for(const e of sources){pSpec[e.index]+=e.pMw;qSpec[e.index]+=e.qMvar;}
  const byBus=new Map<number,(Generator&{index:number})[]>();for(const e of generators.filter(g=>g.voltageControl)){if(!byBus.has(e.index))byBus.set(e.index,[]);byBus.get(e.index)!.push(e);}
  for(const[i,gs]of byBus){const fixed=qSpec[i]-gs.reduce((s,g)=>s+g.qMvar,0);if(gs.every(g=>g.qMin!=null&&g.qMax!=null)){qMinNet[i]=fixed+gs.reduce((s,g)=>s+g.qMin!,0);qMaxNet[i]=fixed+gs.reduce((s,g)=>s+g.qMax!,0);}}
  const adjacency:number[][]=Array.from({length:N},()=>[]);for(const e of branches){adjacency[e.i].push(e.j);adjacency[e.j].push(e.i);}
  const componentOf=new Int32Array(N).fill(-1),components:number[][]=[];
  for(let i=0;i<N;i++)if(componentOf[i]<0){const id=components.length,group:number[]=[],stack=[i];componentOf[i]=id;while(stack.length){const u=stack.pop()!;group.push(u);for(const v of adjacency[u])if(componentOf[v]<0){componentOf[v]=id;stack.push(v);}}group.sort((a,b)=>a-b);components.push(group);}
  const branchByComponent:{e:NumericBranch;meta:BranchMeta}[][]=Array.from({length:components.length},()=>[]);branches.forEach((e,i)=>branchByComponent[componentOf[e.i]].push({e,meta:metadata[i]}));
  const controls=n.stationControllers.filter(enabled),generatorById=new Map(n.generators.map(g=>[g.id,g]));let resolvedRemote=0,resolvedUnits=0,unresolvedUnits=0,outOfServiceUnits=0,duplicateUnits=0,localVoltageConflicts=0;
  const controlMappings=controls.map(c=>{const remote=bi.get(c.remoteBus),seen=new Set<string>();if(remote!=null)resolvedRemote++;for(const id of c.unitIds){if(seen.has(id)){duplicateUnits++;continue;}seen.add(id);const g=generatorById.get(id);if(!g){unresolvedUnits++;continue;}resolvedUnits++;if(!g.inService)outOfServiceUnits++;if(g.voltageControl&&remote!=null&&bi.get(g.bus)!==remote)localVoltageConflicts++;}
    const component=remote==null?-1:componentOf[remote],supplied=component>=0&&sources.some(s=>componentOf[s.index]===component);
    return{id:c.id,remoteTerminalId:c.remoteBus,topologyBusIndex:remote??null,solverBusIndex:supplied?components[component].indexOf(remote!):null,islandId:component<0?null:`island-${component+1}`,unitCount:c.unitIds.length,controlModeRaw:c.controlModeRaw??null,distributionModeRaw:c.distributionModeRaw??null,droopModeRaw:c.droopModeRaw??null,status:remote==null?'REMOTE_BUS_UNRESOLVED':!supplied?'NO_REFERENCE_ISLAND':'UNSUPPORTED_MODE_ENUM'};
  });
  const controlSummary={active:controls.length,satisfied:0,qLimitSaturated:0,unsupported:controls.length,remoteResolved:resolvedRemote,remoteUnresolved:controls.length-resolvedRemote,unitsResolved:resolvedUnits,unitsUnresolved:unresolvedUnits,unitsOutOfService:outOfServiceUnits,unitDuplicates:duplicateUnits,localVoltageConflicts,mode:'CURRENT_PROFILE_VOLTAGE_DISPATCH_P',droop:'SAFE_EXPERIMENTAL',qDistribution:'DISPATCHED_ACTIVE_POWER'};
  const islands:PreparedModel[]=[],islandDiagnostics:{islandId:string;busCount:number;branchCount:number;referenceSource:string|null;referenceBusId:string|null;referenceCount:number;status:string;iterations:number|null}[]=[];
  let unsupplied=0;
  for(const [componentIndex,kept] of components.entries()){
    const sourceRows=sources.filter(s=>componentOf[s.index]===componentIndex).sort((a,b)=>a.id.localeCompare(b.id));const source=sourceRows[0],islandId=`island-${componentIndex+1}`;
    const selected=branchByComponent[componentIndex];
    const diagnostic={islandId,busCount:kept.length,branchCount:selected.length,referenceSource:source?.id??null,referenceBusId:source?topology.buses[source.index].id:null,referenceCount:sourceRows.length,status:source?sourceRows.length>1?'MULTIPLE_REFERENCE_PARTIAL':'READY':'NO_REFERENCE',iterations:null};islandDiagnostics.push(diagnostic);
    if(!source){unsupplied+=kept.length;continue;}
    if(sourceRows.length>1)warnings.push(`${islandId}: ${sourceRows.length} ElmXnet; ${source.id} deterministik referans, P dengeleme semantiği doğrulanmadı (MULTIPLE_REFERENCE_PARTIAL).`);
    const oldToNew=new Int32Array(N).fill(-1);kept.forEach((old,i)=>oldToNew[old]=i);const pick=(a:ArrayLike<number>)=>Float64Array.from(kept,i=>a[i]);
    const localType=Int8Array.from(kept,i=>i===source.index?2:busType[i]),localVm=pick(vmSet);localVm[oldToNew[source.index]]=source.vmSet||1;
    const model:NumericModel={n:kept.length,baseMVA:n.baseMva,slack:oldToNew[source.index],slackVm:source.vmSet||1,pSpec:pick(pSpec),qSpec:pick(qSpec),busType:localType,vmSet:localVm,shuntG:pick(shuntG),shuntB:pick(shuntB),qMinNet:kept.map(i=>qMinNet[i]),qMaxNet:kept.map(i=>qMaxNet[i]),branches:selected.map(({e})=>({...e,i:oldToNew[e.i],j:oldToNew[e.j]}))};
    islands.push({model,buses:kept.map(i=>topology.buses[i]),branches:selected.map(({meta})=>({...meta,i:oldToNew[meta.i],j:oldToNew[meta.j]})),generators:generators.filter(e=>componentOf[e.index]===componentIndex).map(e=>({...e,index:oldToNew[e.index]})),topology,warnings:[],diagnostics:{islandId,referenceSource:source.id,referenceBusId:topology.buses[source.index].id},islandId});
  }
  if(unsupplied)warnings.push(`${unsupplied} bara referanssız adalarda; hesap sonucu yok.`);
  const globalDiagnostics={rawTerminals:n.buses.length,inServiceTerminals:n.buses.filter(b=>b.inService).length,electricalBuses:N,solveBuses:N-unsupplied,islandCount:components.length,unsuppliedBuses:unsupplied,branches:branches.length,lines:metadata.filter(e=>e.sourceClass==='ElmLne').length,transformers:metadata.filter(e=>e.sourceClass==='ElmTr2').length,generators:generators.length,loads:n.loads.filter(enabled).length,closedSwitches:topology.closedSwitches,stationControllers:controls.length,stationControllersTotal:n.stationControllers.length,stationControllerSummary:controlSummary,stationControllerMappings:controlMappings,transformerPhase:'PHASE_SHIFT_SOURCE_UNAVAILABLE',loadFlowOptionsRaw:n.loadFlowOptionsRaw||{},islands:islandDiagnostics,controlFidelity:'CURRENT_PROFILE_PARTIAL',referenceValidation:'NOT_AVAILABLE'};
  const primary=islands[0]||{model:{n:0,baseMVA:n.baseMva,slack:-1,slackVm:1,pSpec:new Float64Array(),qSpec:new Float64Array(),busType:new Int8Array(),vmSet:new Float64Array(),shuntG:new Float64Array(),shuntB:new Float64Array(),qMinNet:[],qMaxNet:[],branches:[]},buses:[],branches:[],generators:[],topology,warnings:[],diagnostics:{},islandId:'none'};
  return{...primary,warnings,diagnostics:globalDiagnostics,additionalIslands:islands.slice(1)};
}
