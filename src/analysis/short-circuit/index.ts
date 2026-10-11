import type {CanonicalNetwork} from '../../domain/model/network';
import {effectiveNetwork,scenarioSignature,type ScenarioOverlay} from '../../domain/scenario/overlay';
import {stableJson} from '../../domain/calculation/identity';
import {sha256} from '@noble/hashes/sha2.js';
import {buildTopology} from '../../topology/electrical-topology';
import type {ScSourceContext} from './source-adapter';
import {factorPositiveSequence,type SequenceBranch} from './positive-sequence';
import {IEC_2016,scMethodPreflight,scQuantitySupport,type ScQuantitySupport} from './method-evidence';
export interface ScProfile {schemaVersion?:2;faultType:'3PH'|'1LG'|'LL'|'2LG';calculateMode:'MAX'|'MIN';voltageFactor:number;factorProvenance:string;edition:null|typeof IEC_2016;frequencyHz?:50|60;breakerOpeningTimeS?:number;thermalClearingTimeS?:number;rfOhm:number;xfOhm:number;maxFaults:number;timeBudgetMs:number}
export interface ScFaultResult {physicalTerminalFid:string;electricalBusId:string|null;physicalTerminalFids:string[];nominalKv:number|null;componentId:number|null;status:'CALCULATED_NETWORK_APPROXIMATION'|'BLOCKED'|'UNSUPPORTED'|'CANCELLED';reasons:string[];quantitySupport?:ScQuantitySupport;zkkOhm:{re:number;im:number}|null;ikssKa:number|null;skssMva:number|null;ipKa:null;ibKa:null;ithKa:null;residual:number|null}
export interface ScResult {schemaVersion?:2;method:'GA_POSITIVE_SEQUENCE_3PH_MAX'|'GA_POSITIVE_SEQUENCE_3PH_MIN'|'GA_IEC60909_2016_PREFLIGHT';methodEvidence?:ReturnType<typeof scMethodPreflight>;identity:{modelHash:string;scenarioHash:string;profileHash:string;sourceHash:string};profile:ScProfile;faults:ScFaultResult[];componentEvidence:{componentId:number;reasons:string[]}[];assumptions:string[];sourceCounts?:Record<string,number>;counts:Record<string,number>;factorizations:number;rhsCount:number;reusedDrivingPoints?:number;dimensions:{dimension:number;nnz:number}[];elapsedMs:number}
export const APPROXIMATION_ASSUMPTIONS=['SERIES_POSITIVE_SEQUENCE_NETWORK','PASSIVE_LOADS_LINE_CHARGING_AND_SHUNTS_EXCLUDED','TRANSFORMER_UNCORRECTED_KT_UNVERIFIED; PHASE_AS_CANONICAL_MODEL','NO_MACHINE_CONVERTER_OR_EXTERNAL_GRID_DEFAULTS','IEC_EDITION_KG_KKW_AND_CMAX_NOT_NORMATIVELY_VERIFIED','IP_IB_ITH_AND_UNBALANCED_FAULTS_NOT_IMPLEMENTED'];
const hash=(v:unknown)=>Array.from(sha256(new TextEncoder().encode(stableJson(v))),v=>v.toString(16).padStart(2,'0')).join('');
type ComponentFactor={factor:ReturnType<typeof factorPositiveSequence>;local:Map<number,number>;drivingPoints?:Map<number,ReturnType<ReturnType<typeof factorPositiveSequence>['drivingPoint']>>;injection?:ReturnType<ReturnType<typeof factorPositiveSequence>['solveInjection']>};
function prepareSources(network:CanonicalNetwork,scenario:ScenarioOverlay,context:ScSourceContext){
  const active=effectiveNetwork(network,scenario),busById=new Map(active.buses.map(b=>[b.sourceId,b]));
  // Vac is a physical source absent from the LF canonical collection; include its terminal for SC topology only.
  const vacs=context.sources.filter(s=>s.inService).flatMap(s=>[s.bus,...s.additionalBuses??[]].filter(bus=>busById.get(bus)?.inService).map(bus=>({...busById.get(bus)!,id:s.fid,sourceId:s.fid,sourceClass:s.sourceClass,bus,pMw:0,qMvar:0,vmSet:0})));
  const topology=buildTopology({...active,externalGrids:[...active.externalGrids,...vacs]}),n=topology.buses.length;
  const branches:SequenceBranch[]=[],adj=Array.from({length:n},()=>[] as number[]),issues=new Map<number,string[]>();
  const issue=(bus:number,reason:string)=>{const r=issues.get(bus)??[];r.push(reason);issues.set(bus,r);};
  topology.buses.forEach((b,i)=>{if(!(b.vnKv>0)||!Number.isFinite(b.vnKv)||!context.allowMixedNominalKv&&b.terms.some(fid=>{const kv=busById.get(fid)?.vnKv;return kv===undefined||!Number.isFinite(kv)||Math.abs(kv/b.vnKv-1)>1e-9;}))issue(i,'INVALID_UNIT: COLLAPSED_BUS_NOMINAL_KV_MISMATCH');});
  for(const source of context.sources.filter(s=>s.inService&&s.additionalBuses?.length&&!topology.blockedEquipment.has(s.fid))){const points=[source.bus,...source.additionalBuses!].map(b=>topology.terminalToBus.get(b)).filter((b):b is number=>b!==undefined);for(const b of points){issue(b,`${source.reason||'MISSING_SOURCE_MODEL: UNSUPPORTED_MULTITERMINAL_ELEMENT'}:${source.sourceClass}:${source.fid}`);for(const other of points)if(other!==b)adj[b].push(other);}}
  const invalid=new Map(context.invalidBranches.map(e=>[`${e.sourceClass}:${e.fid}`,e.reason]));
  for(const e of [...active.lines,...active.transformers,...active.seriesCompensators]){
    if(!e.inService||topology.blockedEquipment.has(e.id))continue;const a=topology.terminalToBus.get(e.from),b=topology.terminalToBus.get(e.to);if(a===undefined||b===undefined)continue;
    adj[a].push(b);adj[b].push(a);
    const reason=invalid.get(`${e.sourceClass}:${e.sourceId}`);if(reason){issue(a,`${reason}:${e.sourceClass}:${e.sourceId}`);continue;}
    const kv=topology.buses[a].vnKv,base=kv*kv/network.baseMva;
    if(e.sourceClass==='ElmTr2'&&'rPu'in e){if(!Number.isFinite(e.rPu)||e.rPu<0||!(e.xPu>0)||!Number.isFinite(e.xPu)||!(e.tap>0)){issue(a,'INVALID_UNIT: TRANSFORMER');continue;}branches.push({a,b,rPu:e.rPu,xPu:e.xPu,tap:e.tap,phaseRad:e.phase});}
    else if('rOhm'in e){if(!Number.isFinite(e.rOhm)||e.rOhm<0||!Number.isFinite(e.xOhm)||e.xOhm===0||!(base>0)||Math.abs(topology.buses[b].vnKv/kv-1)>1e-6){issue(a,'INVALID_UNIT: LINE_BASE_R_X');continue;}branches.push({a,b,rPu:e.rOhm/base,xPu:e.xOhm/base,tap:1,phaseRad:0});}
  }
  const componentOf=new Int32Array(n).fill(-1),components:number[][]=[];
  for(let root=0;root<n;root++)if(componentOf[root]<0){const group:number[]=[],id=components.length,stack=[root];componentOf[root]=id;while(stack.length){const u=stack.pop()!;group.push(u);for(const v of adj[u])if(componentOf[v]<0){componentOf[v]=id;stack.push(v);}}components.push(group);}
  const sources:{bus:number;rPu:number;xPu:number}[]=[],currentSources:{bus:number;re:number;im:number}[]=[];
  const activeIds=new Set([...active.generators,...active.externalGrids].filter(e=>e.inService).map(e=>`${e.sourceClass}:${e.sourceId}`));
  for(const s of context.sources){const canonical=[...active.generators,...active.externalGrids].find(e=>e.sourceClass===s.sourceClass&&e.sourceId===s.fid);if(canonical?!activeIds.has(`${s.sourceClass}:${s.fid}`):!s.inService)continue;if(topology.blockedEquipment.has(s.fid))continue;
    const bus=topology.terminalToBus.get(s.bus);if(bus===undefined)continue;
    if(s.currentKa!==undefined&&!s.reason){if(!(s.currentKa>=0&&Number.isFinite(s.currentKa)&&Number.isFinite(s.currentAngleDeg))){issue(bus,'INVALID_UNIT: CURRENT_SOURCE');continue;}const i=s.currentKa*Math.sqrt(3)*topology.buses[bus].vnKv/network.baseMva,angle=s.currentAngleDeg!*Math.PI/180;currentSources.push({bus,re:i*Math.cos(angle),im:i*Math.sin(angle)});continue;}
    if(s.reason||s.rOhm===null||s.xOhm===null){issue(bus,`${s.reason||'MISSING_SOURCE_MODEL'}:${s.sourceClass}:${s.fid}`);continue;}
    const zbase=topology.buses[bus].vnKv**2/network.baseMva;if(!(s.rOhm>=0&&s.xOhm>0&&s.rOhm!==99999&&s.xOhm!==99999&&Number.isFinite(s.rOhm)&&Number.isFinite(s.xOhm)&&zbase>0)){issue(bus,'INVALID_UNIT: SOURCE_IMPEDANCE');continue;}
    sources.push({bus,rPu:s.rOhm/zbase,xPu:s.xOhm/zbase});
  }
  // A source omitted by an adapter must never disappear from a supplied component.
  for(const g of [...active.generators,...active.externalGrids].filter(g=>g.inService&&!topology.blockedEquipment.has(g.id)))if(!context.sources.some(s=>s.sourceClass===g.sourceClass&&s.fid===g.sourceId)){const b=topology.terminalToBus.get(g.bus);if(b!==undefined)issue(b,`MISSING_SOURCE_MODEL:${g.sourceClass}:${g.sourceId}`);}
  const unresolved=context.sources.filter(s=>s.inService&&!s.bus);
  const componentIssues=components.map(group=>[...new Set([...group.flatMap(b=>issues.get(b)??[]),...unresolved.map(s=>`${s.reason}:${s.sourceClass}:${s.fid}`)])]);
  return {busById,topology,branches,componentOf,components,sources,currentSources,componentIssues,factors:new Map<number,ComponentFactor>()};
}
type Preparation={network:CanonicalNetwork;scenarioHash:string;sourceHash:string;value:ReturnType<typeof prepareSources>;users:number;retired:boolean};
let retained:Preparation|undefined;
function dispose(entry:Preparation){for(const c of entry.value.factors.values())c.factor.dispose();entry.value.factors.clear();}
/** One retained preparation; concurrent callers lease a retired entry until they finish. */
function acquire(network:CanonicalNetwork,scenario:ScenarioOverlay,context:ScSourceContext){
  const scenarioHash=scenarioSignature(scenario),sourceHash=hash(context);
  if(!retained||retained.network!==network||retained.scenarioHash!==scenarioHash||retained.sourceHash!==sourceHash){
    const value=prepareSources(network,scenario,context);if(retained){retained.retired=true;if(!retained.users)dispose(retained);}retained={network,scenarioHash,sourceHash,value,users:0,retired:false};
  }
  retained.users++;return retained;
}
function release(entry:Preparation){entry.users--;if(entry.retired&&!entry.users)dispose(entry);}
export function clearScPreparationCache(){if(retained){retained.retired=true;if(!retained.users)dispose(retained);retained=undefined;}}
export const scFaultTargetHash=(ids:readonly string[])=>hash([...new Set(ids)].sort());
export interface ScFaultCatalog {identity:{modelHash:string;scenarioHash:string;sourceHash:string;targetHash:string};physicalTerminals:number;electricalPartitions:number;unmappedTerminals:number;networkPartitions:number}
/** Counts selected targets against the full source graph, without solving fault RHS. */
export function scFaultCatalog(network:CanonicalNetwork,scenario:ScenarioOverlay,context:ScSourceContext,selectedTerminals:readonly string[]):ScFaultCatalog{
  if(context.modelHash!==network.modelHash)throw Error('SC_SOURCE_MODEL_MISMATCH');const entry=acquire(network,scenario,context);
  try{const ids=[...new Set(selectedTerminals)],mapped=ids.map(id=>entry.value.topology.terminalToBus.get(id));return {identity:{modelHash:network.modelHash,scenarioHash:entry.scenarioHash,sourceHash:entry.sourceHash,targetHash:scFaultTargetHash(ids)},physicalTerminals:ids.length,electricalPartitions:new Set(mapped.filter(id=>id!==undefined)).size,unmappedTerminals:mapped.filter(id=>id===undefined).length,networkPartitions:entry.value.topology.buses.length};}finally{release(entry);}
}
/** c is mandatory, explicit, independent of LF Vm. No automatic IEEE/IEC certification. */
export async function calculateThreePhase(network:CanonicalNetwork,scenario:ScenarioOverlay,context:ScSourceContext,selectedTerminals:readonly string[],profile:ScProfile,options:{signal?:AbortSignal;onProgress?:(stage:string,detail?:Record<string,unknown>)=>void}={}):Promise<ScResult>{
  const started=performance.now();
  if(context.calculateMode&&context.calculateMode!==profile.calculateMode)throw Error('SC_SOURCE_MODE_MISMATCH');
  if(context.modelHash!==network.modelHash)throw Error('SC_SOURCE_MODEL_MISMATCH');
  if(!['MAX','MIN'].includes(profile.calculateMode)||!(profile.voltageFactor>0&&profile.voltageFactor<=2)||!profile.factorProvenance.trim()||(profile.edition!==null&&profile.edition!==IEC_2016)||!Number.isInteger(profile.maxFaults)||profile.maxFaults<1||profile.maxFaults>10000||selectedTerminals.length>profile.maxFaults||!(profile.timeBudgetMs>0&&profile.timeBudgetMs<=300000)||!Number.isFinite(profile.rfOhm)||profile.rfOhm<0||!Number.isFinite(profile.xfOhm)||profile.xfOhm<0||!(network.baseMva>0))throw Error('SC_INVALID_OR_UNVERIFIED_PROFILE');
  if([profile.breakerOpeningTimeS,profile.thermalClearingTimeS].some(t=>t!==undefined&&!(t>0&&Number.isFinite(t)))||profile.frequencyHz!==undefined&&![50,60].includes(profile.frequencyHz))throw Error('SC_INVALID_TIME_OR_FREQUENCY');
  if(new Set(selectedTerminals).size!==selectedTerminals.length)throw Error('SC_DUPLICATE_FAULT');
  const entry=acquire(network,scenario,context),{busById,topology,branches,componentOf,components,sources,currentSources,componentIssues,factors:cache}=entry.value;
  const result:ScResult={schemaVersion:2,methodEvidence:scMethodPreflight(profile,context,network,scenario),reusedDrivingPoints:0,method:profile.edition===IEC_2016?'GA_IEC60909_2016_PREFLIGHT':profile.calculateMode==='MIN'?'GA_POSITIVE_SEQUENCE_3PH_MIN':'GA_POSITIVE_SEQUENCE_3PH_MAX',identity:{modelHash:network.modelHash,scenarioHash:entry.scenarioHash,profileHash:hash(profile),sourceHash:entry.sourceHash},profile:{...profile},faults:[],componentEvidence:componentIssues.map((reasons,componentId)=>({componentId,reasons})).filter(c=>c.reasons.length),assumptions:[...APPROXIMATION_ASSUMPTIONS,...context.assumptions??[],...(currentSources.length?['IDEAL_CURRENT_SOURCE_SUPERPOSITION; EXPLICIT_PHASE_AND_TERMINAL_BASIS']:[]),...(context.allowMixedNominalKv?['COLLAPSED_BUS_BASE_NORMALIZATION_ASSUMED']:[])],counts:{},factorizations:0,rhsCount:0,dimensions:[],elapsedMs:0};
  result.sourceCounts={};for(const source of context.sources.filter(s=>s.inService)){const status=source.parameterStatus??(source.reason?'UNSUPPORTED':'NATIVE');result.sourceCounts[status]=(result.sourceCounts[status]??0)+1;}
  try{for(const terminal of selectedTerminals){try{
    const bus=topology.terminalToBus.get(terminal),group=bus===undefined?undefined:components[componentOf[bus]],physical=bus===undefined?[]:[...topology.buses[bus].terms];
    const row:ScFaultResult={physicalTerminalFid:terminal,electricalBusId:bus===undefined?null:topology.buses[bus].id,physicalTerminalFids:physical,nominalKv:bus===undefined?null:topology.buses[bus].vnKv,componentId:bus===undefined?null:componentOf[bus],status:'BLOCKED',reasons:[],zkkOhm:null,ikssKa:null,skssMva:null,ipKa:null,ibKa:null,ithKa:null,residual:null};
    result.faults.push(row);
    if(options.signal?.aborted||performance.now()-started>=profile.timeBudgetMs){row.status='CANCELLED';row.reasons=['CANCELLED_OR_TIME_BUDGET'];continue;}
    if(profile.faultType!=='3PH'){row.reasons=['MISSING_SEQUENCE_FOR_UNBALANCED'];continue;}
    if(profile.edition===IEC_2016){row.reasons=['NORMATIVE_METHOD_UNVERIFIED',...result.methodEvidence!.blockers];continue;}
    if(bus===undefined||!group||!busById.get(terminal)?.inService){row.reasons=['NO_ACTIVE_FAULT_BUS'];continue;}
    const reasons=componentIssues[componentOf[bus]];if(reasons.length){row.reasons=[...new Set(reasons.map(r=>r.split(':')[0]))];continue;}
    const groupSources=sources.filter(s=>componentOf[s.bus]===componentOf[bus]);if(!groupSources.length){row.reasons=['MISSING_SOURCE_MODEL: NO_VALID_ACTIVE_SOURCE'];continue;}
    try{let prepared=cache.get(componentOf[bus]);
      if(!prepared){const local=new Map(group.map((b,i)=>[b,i])),factor=factorPositiveSequence(group.length,branches.filter(b=>componentOf[b.a]===componentOf[bus]).map(b=>({...b,a:local.get(b.a)!,b:local.get(b.b)!})),groupSources.map(s=>({...s,bus:local.get(s.bus)!})));const injections=currentSources.filter(s=>componentOf[s.bus]===componentOf[bus]).map(s=>({...s,bus:local.get(s.bus)!}));prepared={local,factor,injection:injections.length?factor.solveInjection(injections):undefined};cache.set(componentOf[bus],prepared);result.factorizations++;result.dimensions.push({dimension:factor.dimension,nnz:factor.nnz});}
      const points=prepared.drivingPoints??=new Map(),cached=points.get(bus),solved=cached??prepared.factor.drivingPoint(prepared.local.get(bus)!);if(cached)result.reusedDrivingPoints!++;else{points.set(bus,solved);result.rhsCount++;}const zbase=row.nominalKv!**2/network.baseMva,z={re:solved.zPu.re*zbase,im:solved.zPu.im*zbase};
      const magnitude=Math.hypot(z.re+profile.rfOhm,z.im+profile.xfOhm),localBus=prepared.local.get(bus)!,injection=prepared.injection,openRe=injection?.voltageRe[localBus]??0,openIm=injection?.voltageIm[localBus]??0,ikss=Math.hypot(profile.voltageFactor+openRe,openIm)*row.nominalKv!/(Math.sqrt(3)*magnitude),skss=Math.sqrt(3)*row.nominalKv!*ikss;
      if(!(magnitude>0)||!Number.isFinite(ikss)||ikss<=0||!Number.isFinite(skss))throw Error('SC_INVALID_DRIVING_POINT');
      row.status='CALCULATED_NETWORK_APPROXIMATION';row.reasons=['MISSING_IEC_FACTOR; MISSING_METHOD_OPTION; APPROXIMATION_ONLY'];row.zkkOhm=z;row.ikssKa=ikss;row.skssMva=skss;row.residual=Math.max(solved.residual,prepared.injection?.residual??0);
    }catch(e){row.reasons=[String(e)];}
    }finally{options.onProgress?.('SC_FAULT',{message:`GA 3PH ${profile.calculateMode} ${result.faults.length}/${selectedTerminals.length}`,completed:result.faults.length,total:selectedTerminals.length,percent:100*result.faults.length/selectedTerminals.length});await new Promise<void>(resolve=>setTimeout(resolve,0));}
  }}finally{release(entry);}
  for(const f of result.faults){f.quantitySupport=scQuantitySupport(f);result.counts[f.status]=(result.counts[f.status]??0)+1;}result.elapsedMs=performance.now()-started;return result;
}
