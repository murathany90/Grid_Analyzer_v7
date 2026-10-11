import type {Line,Transformer2W} from '../model/network';
import type {CalculationResult,BranchResult,BusResult} from './types';
import type {AppContext} from '../../app/contracts';
import {scenarioSignature,type ScenarioOverlay} from '../scenario/overlay';
import {solutionCompleteness} from './diagnostics';
import {mapLoadingValues,loadingDifference,type PresentedLoading} from './loading-presentation';
import {capacitySession,selectedCapacity} from '../model/capacity';
import {difference} from './delta';
import {lfSnapshotIsCurrent} from '../benchmark/post-result-source';

export interface LfComparisonCell {pre:number|null;post:number|null;delta:number|null;unit:string;reason:string;status:string}
export const busPartition=(b:BusResult)=>JSON.stringify([b.vnKv,[...b.terms].sort()]);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const resultIndices=new WeakMap<CalculationResult,{branches:Map<string,BranchResult>;terminals:Map<string,BusResult|null>;buses:Map<string,BusResult>;references:Map<string,string>;islandMembers:Map<string,string>}>();
function index(r:CalculationResult){
  let value=resultIndices.get(r);if(value)return value;
  const terminals=new Map<string,BusResult|null>(),buses=new Map(r.buses.map(b=>[b.id,b])),branches=new Map(r.branches.map(b=>[b.sourceClass+':'+b.id,b])),references=new Map<string,string>(),members=new Map<string,string[]>();
  for(const b of r.buses){for(const id of b.terms)terminals.set(id,terminals.has(id)?null:b);if(b.islandId){let group=members.get(b.islandId);if(!group){group=[];members.set(b.islandId,group);}group.push(...b.terms);}}
  if(Array.isArray(r.diagnostics.islands))for(const island of r.diagnostics.islands){
    if(typeof island.referenceSource==='string'&&island.referenceSource&&!['NO_REFERENCE','NO_RESULT','ISLAND_UNSUPPLIED'].includes(island.status))references.set(island.islandId,island.referenceSource);
  }
  value={branches,terminals,buses,references,islandMembers:new Map([...members].map(([id,terms])=>[id,terms.sort().join('|')]))};resultIndices.set(r,value);return value;
}
export function lfComparisonReason(before:CalculationResult|null,after:CalculationResult|null){
  if(!before)return 'NO_BASE_RESULT';if(!after)return 'SCENARIO_STALE';
  const a=before.identity,b=after.identity;
  if(a.modelHash!==b.modelHash)return 'MODEL_MISMATCH';
  if(a.optionsHash!==b.optionsHash)return 'SETTINGS_MISMATCH';
  if(a.analysisType!==b.analysisType||a.engine!==b.engine||a.engineVersion!==b.engineVersion)return 'ENGINE_MISMATCH';
  if(!before.converged||!after.converged)return 'NOT_CONVERGED';return '';
}
function partial(r:CalculationResult){return r.status?.includes('PARTIAL')||!solutionCompleteness(r).fullSolution;}
function pair(pre:number|null,post:number|null,unit:string,reason:string,status:string):LfComparisonCell{
  return {pre:finite(pre)?pre:null,post:finite(post)?post:null,delta:reason?null:difference(pre,post),unit,reason,status:reason||status};
}
function angleReason(a:CalculationResult,b:CalculationResult,x:BusResult,y:BusResult){
  const old=index(a),current=index(b),ra=x.islandId?old.references.get(x.islandId):null,rb=y.islandId?current.references.get(y.islandId):null;
  if(!ra||!rb)return 'ANGLE_REFERENCE_UNKNOWN';
  if(ra!==rb||x.islandId!==y.islandId)return 'ANGLE_REFERENCE_MISMATCH';
  return old.islandMembers.get(x.islandId!)===current.islandMembers.get(y.islandId!)?'':'ISLAND_REFERENCE_MISMATCH';
}
const units:Record<string,string>={pFromMw:'MW',pToMw:'MW',pHvMw:'MW',pLvMw:'MW',qFromMvar:'MVAr',qToMvar:'MVAr',qHvMvar:'MVAr',qLvMvar:'MVAr',sFromMva:'MVA',sToMva:'MVA',sHvMva:'MVA',sLvMva:'MVA',iFromA:'A',iToA:'A',pLossMw:'MW',qLossMvar:'MVAr',loadingPercent:'pp',voltageKv:'kV',voltagePu:'pu',angleDeg:'deg'};
export interface LfComparison {enabled:boolean;reason:string;status:string;branches:Map<string,LfComparisonCell>;terminals:Map<string,LfComparisonCell>;base:CalculationResult|null;scenario:CalculationResult|null}
const comparisons=new WeakMap<AppContext,{refs:unknown[];key:string;values:Map<string,LfComparison>}>();
/** One snapshot pair for map, analysis and lightning; canonical results remain immutable. */
export function scenarioLfComparison(ctx:AppContext,metric:string):LfComparison{
  const n=ctx.network,base=ctx.resultStore.getSnapshot(ctx.resultStore.comparisonScenarioId,'powerFlow'),scenario=ctx.resultStore.get('scenario','powerFlow');
  const oldOverlay=ctx.scenario.snapshots.find(s=>s.id===ctx.resultStore.comparisonScenarioId)?.overlay,overlay=ctx.scenario.current;
  let reason=lfComparisonReason(base,scenario);
  if(!reason&&(!n||base!.identity.modelHash!==n.modelHash))reason='MODEL_MISMATCH';
  if(!reason&&(!oldOverlay||base!.identity.scenarioHash!==scenarioSignature(oldOverlay)))reason='REFERENCE_STALE';
  if(!reason&&scenario!.identity.scenarioHash!==scenarioSignature(overlay))reason='SCENARIO_STALE';
  if(!reason&&(!lfSnapshotIsCurrent(base,n,oldOverlay!,ctx.analysisSettings.value)||!lfSnapshotIsCurrent(scenario,n,overlay,ctx.analysisSettings.value)))reason='SETTINGS_MISMATCH';
  const refs=[n,base,scenario,oldOverlay,overlay],key=JSON.stringify([ctx.resultStore.comparisonScenarioId,ctx.scenario.selectedId,n?capacitySession(n.modelHash).revision:null,reason]);
  let cached=comparisons.get(ctx);if(!cached||cached.key!==key||!refs.every((r,i)=>r===cached!.refs[i])){cached={refs,key,values:new Map()};comparisons.set(ctx,cached);}const previous=cached.values.get(metric);if(previous)return previous;
  const status=base&&scenario&&(partial(base)||partial(scenario))?'PARTIAL_GA_COMPARISON':'GA_SCENARIO_MINUS_GA_REFERENCE';
  const result:LfComparison={enabled:!reason,reason,status,branches:new Map(),terminals:new Map(),base,scenario};cached.values.set(metric,result);
  if(!n||reason||!base||!scenario)return result;
  const old=index(base),current=index(scenario),oldLoads=mapLoadingValues(n,base),loads=mapLoadingValues(n,scenario),terminals=new Map(n.buses.map(b=>[b.id,b]));
  const row=(r:ReturnType<typeof index>,e:Line|Transformer2W)=>r.branches.get(e.sourceClass+':'+e.id)??r.branches.get(e.sourceClass+':'+e.sourceId);
  const service=(e:Line|Transformer2W,s:ScenarioOverlay|undefined)=>(e.sourceClass==='ElmLne'?s?.lineStatus[e.id]:s?.transformerStatus[e.id])??e.inService;
  const zeroLoad=(e:Line|Transformer2W):PresentedLoading=>{const session=capacitySession(n.modelHash),line=e.sourceClass==='ElmLne',limit=line?selectedCapacity(e as Line,n.modelHash):null,rating=line?limit?.currentKA?limit.currentKA*1000:null:finite(e.ratingMva)&&e.ratingMva!>0&&e.ratingMva!<99999?e.ratingMva:null;
    return {maximum:rating===null?null:0,from:rating===null?null:0,to:rating===null?null:0,basis:line?'CURRENT_A':'APPARENT_MVA',source:line?limit?.source??'UNKNOWN_CAPACITY':'DGS_TRANSFORMER_RATED_MVA',season:session.season,status:'OUT_OF_SERVICE_ZERO',revision:session.revision,denominator:rating,modelHash:n.modelHash,equipmentKey:e.sourceClass+':'+e.sourceId};};
  for(const e of [...n.lines,...n.transformers]){
    const a=row(old,e),b=row(current,e),aOff=!service(e,oldOverlay),bOff=!service(e,overlay),unit=units[metric]??'';
    let why=!a&&!aOff?'BASE_NOT_RECORDED':!b&&!bOff?'ISLAND_UNSUPPLIED_OR_NOT_RECORDED':'';
    if(!why&&a&&b)for(const end of ['from','to'] as const){const x=old.buses.get(a[end])??old.terminals.get(a[end]),y=current.buses.get(b[end])??current.terminals.get(b[end]);if(!x||!y||busPartition(x)!==busPartition(y)){why='PARTITION_NOT_1_TO_1';break;}}
    let fromHv:boolean|null=true;
    if(e.sourceClass==='ElmTr2'&&/(Hv|Lv)/.test(metric)){const t=e as Transformer2W,hv=Math.max(t.vnKv,t.lvKv),lv=Math.min(t.vnKv,t.lvKv),a=terminals.get(t.from)?.vnKv,b=terminals.get(t.to)?.vnKv;fromHv=hv>lv&&a===hv&&b===lv?true:hv>lv&&a===lv&&b===hv?false:null;if(fromHv===null)why='HV_LV_IDENTITY_UNVERIFIED';}
    const scalar=(v:BranchResult|undefined,off:boolean)=>{if(!v)return off?0:null;const from=/(Hv|Lv)/.test(metric)?metric.includes('Hv')===fromHv:!metric.includes('To');const values:Record<string,number|null>={pFromMw:v.pf,qFromMvar:v.qf,pToMw:v.pt,qToMvar:v.qt,pHvMw:from?v.pf:v.pt,pLvMw:from?v.pf:v.pt,qHvMvar:from?v.qf:v.qt,qLvMvar:from?v.qf:v.qt,sFromMva:Math.hypot(v.pf,v.qf),sToMva:Math.hypot(v.pt,v.qt),sHvMva:Math.hypot(from?v.pf:v.pt,from?v.qf:v.qt),sLvMva:Math.hypot(from?v.pf:v.pt,from?v.qf:v.qt),iFromA:v.ifA,iToA:v.itA,pLossMw:v.pLoss,qLossMvar:v.qLoss};return values[metric]??null;};
    let pre=scalar(a,aOff),post=scalar(b,bOff);
    if(metric==='loadingPercent'){const x=oldLoads.get(e.sourceClass+':'+e.id)??(aOff?zeroLoad(e):null),y=loads.get(e.sourceClass+':'+e.id)??(bOff?zeroLoad(e):null),d=loadingDifference(x,y);pre=x?.maximum??null;post=y?.maximum??null;why||=d.reason;}
    const cell=pair(pre,post,unit,why,bOff||aOff?'OUT_OF_SERVICE_ZERO · '+status:status);for(const id of new Set([e.id,e.sourceId]))result.branches.set(e.sourceClass+':'+id,cell);
  }
  if(['voltageKv','voltagePu','angleDeg'].includes(metric))for(const t of n.buses){const a=old.terminals.get(t.id),b=current.terminals.get(t.id);let why=!a?'BASE_NOT_RECORDED':!b?'ISLAND_UNSUPPLIED_OR_NOT_RECORDED':busPartition(a)!==busPartition(b)||a.vnKv!==t.vnKv?'PARTITION_NOT_1_TO_1':'';
    if(!why&&metric==='angleDeg')why=angleReason(base,scenario,a!,b!);
    const scalar=(v:BusResult|null|undefined)=>!v?null:metric==='angleDeg'?v.angleRad*180/Math.PI:metric==='voltageKv'?v.vmPu*v.vnKv:v.vmPu;
    result.terminals.set(t.id,pair(scalar(a),scalar(b),units[metric],why,status));
  }
  return result;
}
