import type { CanonicalNetwork, Generator } from '../../domain/model/network';
import { buildTopology, type ElectricalBus, type ElectricalTopology } from '../../topology/electrical-topology';
export interface NumericBranch { i:number;j:number;r:number;x:number;bch:number;tap:number;phase:number }
export interface NumericModel {
  n:number;baseMVA:number;slack:number;slackVm:number;pSpec:Float64Array;qSpec:Float64Array;busType:Int8Array;vmSet:Float64Array;
  shuntG:Float64Array;shuntB:Float64Array;qMinNet:(number|null)[];qMaxNet:(number|null)[];branches:NumericBranch[];
}
export interface BranchMeta { id:string;name:string;sourceClass:string;from:string;to:string;siteIds:string[];vnKv:number;ratingMva:number|null;i:number;j:number }
export interface PreparedModel { model:NumericModel;buses:ElectricalBus[];branches:BranchMeta[];generators:(Generator&{index:number})[];topology:ElectricalTopology;diagnostics:Record<string,unknown>;warnings:string[] }
export function prepareModel(n:CanonicalNetwork):PreparedModel{
  const topology=buildTopology(n),N=topology.buses.length,bi=topology.terminalToBus,warnings=[...topology.warnings];
  const pSpec=new Float64Array(N),qSpec=new Float64Array(N),busType=new Int8Array(N),vmSet=new Float64Array(N).fill(1),shuntG=new Float64Array(N),shuntB=new Float64Array(N),qMinNet:(number|null)[]=Array(N).fill(null),qMaxNet:(number|null)[]=Array(N).fill(null);
  const branches:NumericBranch[]=[],metadata:BranchMeta[]=[];
  const enabled=(e:{id:string;inService:boolean})=>e.inService&&!topology.blockedEquipment.has(e.id);
  const add=(e:{id:string;name:string;sourceClass:string;from:string;to:string;siteIds:readonly string[]},r:number,x:number,bch:number,tap:number,phase:number,ratingMva:number|null)=>{
    const i=bi.get(e.from),j=bi.get(e.to);if(i==null||j==null||i===j)return;
    if(!Number.isFinite(r)||!Number.isFinite(x)||Math.abs(r)+Math.abs(x)<=1e-12||!(tap>0)){warnings.push(`Geçersiz dal parametresi: ${e.name}`);return;}
    branches.push({i,j,r,x,bch,tap,phase});metadata.push({...e,siteIds:[...e.siteIds],vnKv:topology.buses[i].vnKv,ratingMva,i,j});
  };
  for(const e of n.lines.filter(enabled)){const z=(topology.buses[bi.get(e.from)??-1]?.vnKv||0)**2/n.baseMva;if(!(e.xOhm>0&&z>0)){warnings.push(`Hat X/Zbase geçersiz: ${e.name}`);continue;}add(e,e.rOhm/z,e.xOhm/z,e.bSiemens*z,1,0,e.ratingMva);}
  for(const e of n.transformers.filter(enabled)){add(e,e.rPu,e.xPu,0,e.tap,e.phase,e.ratingMva);const i=bi.get(e.from);if(i!=null){shuntG[i]+=e.gPu;shuntB[i]+=e.bPu;}}
  for(const e of n.seriesCompensators.filter(enabled)){const z=(topology.buses[bi.get(e.from)??-1]?.vnKv||0)**2/n.baseMva;add(e,e.rOhm/z,e.xOhm/z,0,1,0,null);}
  for(const e of n.shunts.filter(enabled)){const i=bi.get(e.bus);if(i!=null){shuntG[i]+=e.gPu;shuntB[i]+=e.bPu;}}
  const generators:(Generator&{index:number})[]=[];
  for(const e of n.generators.filter(enabled)){const i=bi.get(e.bus);if(i==null)continue;generators.push({...e,index:i});pSpec[i]+=e.pMw;qSpec[i]+=e.qMvar;
    if(e.voltageControl){if(busType[i]===0){busType[i]=1;vmSet[i]=e.vmSet;}else if(Math.abs(vmSet[i]-e.vmSet)>1e-5)warnings.push(`PV setpoint çakışması: ${topology.buses[i].name}`);}}
  for(const e of[...n.loads,...n.internationalConnections].filter(enabled)){const i=bi.get(e.bus);if(i!=null){pSpec[i]-=e.pMw;qSpec[i]-=e.qMvar;}}
  const sources=n.externalGrids.filter(enabled).map(e=>({...e,index:bi.get(e.bus)})).filter((e):e is typeof e&{index:number}=>e.index!==undefined);
  const slack=sources[0]?.index??-1,slackVm=sources[0]?.vmSet||1;
  for(const e of sources){pSpec[e.index]+=e.pMw;qSpec[e.index]+=e.qMvar;}
  if(slack>=0){busType[slack]=2;vmSet[slack]=slackVm;}
  if(sources.length>1)warnings.push(`Birden çok ElmXnet: ${sources.length}; v6.8 gibi ilk referans kullanıldı.`);
  const byBus=new Map<number,(Generator&{index:number})[]>();for(const e of generators.filter(g=>g.voltageControl)){if(!byBus.has(e.index))byBus.set(e.index,[]);byBus.get(e.index)!.push(e);}
  for(const[i,gs]of byBus){if(i===slack)continue;const fixed=qSpec[i]-gs.reduce((s,g)=>s+g.qMvar,0);if(gs.every(g=>g.qMin!=null&&g.qMax!=null)){qMinNet[i]=fixed+gs.reduce((s,g)=>s+g.qMin!,0);qMaxNet[i]=fixed+gs.reduce((s,g)=>s+g.qMax!,0);}}
  const adjacency:number[][]=Array.from({length:N},()=>[]);for(const e of branches){adjacency[e.i].push(e.j);adjacency[e.j].push(e.i);}
  const keep=new Uint8Array(N),stack:number[]=[];if(slack>=0){keep[slack]=1;stack.push(slack);}while(stack.length){const u=stack.pop()!;for(const v of adjacency[u])if(!keep[v]){keep[v]=1;stack.push(v);}}
  const kept:number[]=[],oldToNew=new Int32Array(N).fill(-1);for(let i=0;i<N;i++)if(keep[i]){oldToNew[i]=kept.length;kept.push(i);}
  const selected=branches.map((e,i)=>({e,meta:metadata[i]})).filter(({e})=>keep[e.i]&&keep[e.j]);
  const pick=(a:ArrayLike<number>)=>Float64Array.from(kept,i=>a[i]);
  const model:NumericModel={n:kept.length,baseMVA:n.baseMva,slack:slack>=0?oldToNew[slack]:-1,slackVm,pSpec:pick(pSpec),qSpec:pick(qSpec),busType:Int8Array.from(kept,i=>busType[i]),vmSet:pick(vmSet),shuntG:pick(shuntG),shuntB:pick(shuntB),qMinNet:kept.map(i=>qMinNet[i]),qMaxNet:kept.map(i=>qMaxNet[i]),branches:selected.map(({e})=>({...e,i:oldToNew[e.i],j:oldToNew[e.j]}))};
  if(N-kept.length)warnings.push(`${N-kept.length} bara referans adası dışında; hesap sonucu yok.`);
  return{model,buses:kept.map(i=>topology.buses[i]),branches:selected.map(({meta})=>({...meta,i:oldToNew[meta.i],j:oldToNew[meta.j]})),generators:generators.filter(e=>keep[e.index]).map(e=>({...e,index:oldToNew[e.index]})),topology,warnings,
    diagnostics:{rawTerminals:n.buses.length,inServiceTerminals:n.buses.filter(b=>b.inService).length,electricalBuses:N,solveBuses:kept.length,unsuppliedBuses:N-kept.length,branches:model.branches.length,lines:metadata.filter(e=>e.sourceClass==='ElmLne').length,transformers:metadata.filter(e=>e.sourceClass==='ElmTr2').length,generators:generators.length,loads:n.loads.filter(enabled).length,closedSwitches:topology.closedSwitches,stationControllers:n.stationControllers.filter(c=>c.inService).length,stationControllersTotal:n.stationControllers.length,controlFidelity:'PARTIAL_MAPPING_ONLY',referenceValidation:'NOT_AVAILABLE'}};
}
