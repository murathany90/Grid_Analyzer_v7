import type {AppContext} from '../../app/contracts';
import type {CalculationResult,BranchResult} from '../../domain/results/types';
import {identity,identityKey,stableJson} from '../../domain/calculation/identity';
import {activeAnalysisSettings,analysisSettingsHash} from '../../domain/calculation/analysis-settings';
import {calculationScenario,scenarioSignature} from '../../domain/scenario/overlay';
import {selectedN1Presentation,angleHasReference} from '../../map/layer-policy';
import {mapLoadingValues} from '../../map/loading-presentation';
import {sha256} from '@noble/hashes/sha2.js';
import {capacitySession} from '../../domain/model/capacity';
import type {ScenarioOverlay} from '../../domain/scenario/overlay';
import {postResultAssembler} from '../../analysis/contingency-ac/post-results';
import {scenarioLfComparison} from '../../domain/results/lf-comparison';
export type SldMode='ytbs'|'technical'|'LF'|'N1'|'SC'|'operation'|'compact';
export interface SldResultEntry {status:string;method:string;values:Record<string,number|string|null>;lines:string[];direction:number|null;alarm:boolean}
export interface SldResultOverlay {status:string;method:string;phase:string;entries:Map<string,SldResultEntry>;outageKey:string|null}
export const finite=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
/** Positive endpoint injection leaves that physical terminal; TO is not guessed as -FROM. */
export function sldFlowAtPort(entry:SldResultEntry,side:'FROM'|'TO'):number|null{return finite(entry.values[side==='FROM'?'pFromMw':'pToMw']);}
const fmt=(v:unknown)=>finite(v)===null?'—':finite(v)!.toFixed(2);
const hash=(v:unknown)=>Array.from(sha256(new TextEncoder().encode(stableJson(v))),n=>n.toString(16).padStart(2,'0')).join('');
export function sldLfCurrent(ctx:AppContext,r:CalculationResult|null,role:'base'|'scenario'):r is CalculationResult {
  return lfForScenario(ctx,r,calculationScenario(ctx.scenario.current,role));
}
function lfForScenario(ctx:AppContext,r:CalculationResult|null,scenario:ScenarioOverlay):r is CalculationResult {
  if(!r?.converged||!['CONVERGED','CONVERGED_FULL_NR'].includes(r.status)||!ctx.network||r.identity.analysisType!=='powerFlow')return false;
  const expected=identity(ctx.network.modelHash,scenario,'powerFlow',{analysisSettings:activeAnalysisSettings(ctx.analysisSettings.value,'powerFlow'),analysisSettingsHash:analysisSettingsHash(ctx.analysisSettings.value,'powerFlow'),controlContextHash:ctx.powerFactoryControlContextHash});
  return identityKey(expected)===identityKey(r.identity);
}
/** Both endpoint injections use the solver's native sign. Loss is pf+pt, never forced to zero. */
export function sldBranchValues(b:Pick<BranchResult,'pf'|'qf'|'pt'|'qt'|'ifA'|'itA'>,loading:number|null){
  const pf=finite(b.pf),qf=finite(b.qf),pt=finite(b.pt),qt=finite(b.qt);
  return {pFromMw:pf,qFromMvar:qf,pToMw:pt,qToMvar:qt,sFromMva:pf===null||qf===null?null:Math.hypot(pf,qf),sToMva:pt===null||qt===null?null:Math.hypot(pt,qt),iFromA:finite(b.ifA),iToA:finite(b.itA),loadingPercent:finite(loading),pLossMw:pf===null||pt===null?null:pf+pt,qLossMvar:qf===null||qt===null?null:qf+qt};
}
function buildSldResultOverlay(ctx:AppContext,mode:SldMode):SldResultOverlay {
  const out:SldResultOverlay={status:'NOT_RUN',method:'NOT_RUN',phase:ctx.resultView.phase,entries:new Map(),outageKey:null},n=ctx.network;
  if(!n||!['LF','N1','SC'].includes(mode))return out;
  if(ctx.resultView.source!=='GA'&&ctx.resultView.source!=='Senaryo−Baz'){out.status='SOURCE_NOT_GA';return out;}
  const base=ctx.resultStore.get('base','powerFlow'),scenario=ctx.resultStore.get('scenario','powerFlow');
  const role=ctx.resultStore.role==='base'?'base':'scenario',r=role==='base'?base:scenario;
  const installBranch=(key:string,values:Record<string,number|string|null>,status:string,method:string)=>{
    const change=out.phase==='CHANGE',prefix=change?'Δ ':'';out.entries.set(key,{status,method,values,lines:[`${prefix}P/Q uç 1: ${fmt(values.pFromMw)} / ${fmt(values.qFromMvar)} MW/MVAr`,`${prefix}P/Q uç 2: ${fmt(values.pToMw)} / ${fmt(values.qToMvar)} MW/MVAr`,`${prefix}I: ${fmt(values.iFromA)} / ${fmt(values.iToA)} A · ${prefix}Yük ${fmt(values.loadingPercent)} ${change?'pp':'%'}`],direction:finite(values.pFromMw),alarm:!change&&(finite(values.loadingPercent)??0)>100});
  };
  if(mode==='LF'){
    if(!sldLfCurrent(ctx,r,role)){out.status=r?'STALE':'NOT_RUN / STALE';return out;}
    const delta=ctx.resultStore.role==='delta'||ctx.resultView.source==='Senaryo−Baz';
    const comparison=ctx.resultStore.getSnapshot(ctx.resultStore.comparisonScenarioId),snapshot=ctx.scenario.snapshots.find(s=>s.id===ctx.resultStore.comparisonScenarioId);
    if(delta&&(!comparison||!snapshot||!lfForScenario(ctx,comparison,snapshot.overlay)||!ctx.resultStore.comparable())){out.status='STALE / COMPARISON_BLOCKED';return out;}
    out.phase=delta?'CHANGE':role==='base'?'BASE':'POST';out.status='CONVERGED · PARTIAL_CONTROL_FIDELITY';out.method=r.identity.engine;const loading=mapLoadingValues(n,r),before=delta?new Map(comparison!.branches.map(b=>[`${b.sourceClass}|${b.id}`,b])):null,beforeLoading=delta?mapLoadingValues(n,comparison!):null;
    const byTerm=new Map(r.buses.flatMap(b=>b.terms.map(t=>[t,b] as const))),nativeTerms=new Map(n.buses.map(b=>[b.id,b])),equipment=new Map([...n.lines,...n.transformers].map(e=>[`${e.sourceClass}|${e.id}`,e]));
    for(const b of r.branches){const key=`${b.sourceClass}|${b.id}`,l=loading.get(`${b.sourceClass}:${b.id}`),values=sldBranchValues(b,l?.maximum??null);
      if(delta){const old=before!.get(key),bv=old?sldBranchValues(old,beforeLoading?.get(`${b.sourceClass}:${b.id}`)?.maximum??null):null;for(const k of Object.keys(values) as (keyof typeof values)[])values[k]=values[k]===null||!bv||bv[k]===null?null:values[k]!-bv[k]!;}
      const e=equipment.get(key),from=byTerm.get(e?.from??b.from),to=byTerm.get(e?.to??b.to);
      const fromNominal=nativeTerms.get(e?.from??b.from)?.vnKv??null,toNominal=nativeTerms.get(e?.to??b.to)?.vnKv??null;
      installBranch(key,{...values,fromTerminal:e?.from??b.from,toTerminal:e?.to??b.to,fromNominalKv:fromNominal,toNominalKv:toNominal,fromVoltageKv:delta?null:from&&fromNominal===from.vnKv?finite(from.vnKv*from.vmPu):null,toVoltageKv:delta?null:to&&toNominal===to.vnKv?finite(to.vnKv*to.vmPu):null,loadingBasis:l?.basis??'UNKNOWN',loadingSeason:l?.season??'UNKNOWN',loadingLimit:l?.denominator??null,tapPosition:e&&'tapPosition'in e?e.tapPosition:null,phaseRad:e&&'phase'in e?e.phase:null},out.status,out.method);
    }
    const oldBus=new Map(comparison?.buses.flatMap(b=>b.terms.map(t=>[t,b] as const))??[]);
    for(const b of r.buses)for(const id of b.terms){const old=oldBus.get(id),nominalMatch=nativeTerms.get(id)?.vnKv===b.vnKv,referenced=angleHasReference(r,b),values={voltagePu:!nominalMatch?null:delta?(old?finite(b.vmPu-old.vmPu):null):finite(b.vmPu),voltageKv:!nominalMatch?null:delta?(old&&old.vnKv===b.vnKv?finite((b.vmPu-old.vmPu)*b.vnKv):null):finite(b.vmPu*b.vnKv),angleDeg:!referenced?null:delta?(old&&angleHasReference(comparison,old)?finite((b.angleRad-old.angleRad)*180/Math.PI):null):finite(b.angleRad*180/Math.PI),island:b.islandId??null,referenceStatus:referenced?'SOURCE_REFERENCE_AVAILABLE':'REFERENCE_UNVERIFIED'};out.entries.set(`ElmTerm|${id}`,{status:nominalMatch?out.status:'NOMINAL_KV_MISMATCH',method:out.method,values,lines:[`${delta?'Δ ':''}U ${fmt(values.voltageKv)} kV · ${fmt(values.voltagePu)} pu · ∠ ${fmt(values.angleDeg)}°`],direction:null,alarm:!delta&&nominalMatch&&(b.vmPu<ctx.settings.value.voltageMin||b.vmPu>ctx.settings.value.voltageMax)});}
    for(const g of r.generators){const native=n.generators.find(e=>e.id===g.id),old=comparison?.generators.find(e=>e.id===g.id),p=delta?old?finite(g.pMw-old.pMw):null:finite(g.pMw),q=delta?old&&old.qMvar!==null&&g.qMvar!==null?finite(g.qMvar-old.qMvar):null:finite(g.qMvar);out.entries.set(`${native?.sourceClass??'ElmSym'}|${g.id}`,{status:g.qState,method:out.method,values:{pMw:p,qMvar:q,qMinMvar:native?.qMin??null,qMaxMvar:native?.qMax??null,control:native?.voltageControl?'VOLTAGE_CONTROL':'FIXED_Q'},lines:[`${delta?'Δ ':''}P ${fmt(p)} MW · Q ${fmt(q)} MVAr · ${g.qState}`],direction:null,alarm:false});}
    if(delta){
      const metrics=['pFromMw','qFromMvar','pToMw','qToMvar','sFromMva','sToMva','iFromA','iToA','loadingPercent','pLossMw','qLossMvar'];
      const comparisons=new Map(metrics.map(m=>[m,scenarioLfComparison(ctx,m)]));
      for(const e of [...n.lines,...n.transformers]){const values:Record<string,number|string|null>={},states=new Set<string>();for(const m of metrics){const cell=comparisons.get(m)!.branches.get(`${e.sourceClass}:${e.id}`);values[m]=finite(cell?.delta);if(cell?.reason)states.add(cell.reason);}installBranch(`${e.sourceClass}|${e.id}`,values,states.size?[...states].join(' · '):out.status,out.method);}
      const voltage=scenarioLfComparison(ctx,'voltageKv'),pu=scenarioLfComparison(ctx,'voltagePu'),angle=scenarioLfComparison(ctx,'angleDeg');
      for(const t of n.buses){const v=voltage.terminals.get(t.id),a=angle.terminals.get(t.id),values={voltageKv:finite(v?.delta),voltagePu:finite(pu.terminals.get(t.id)?.delta),angleDeg:finite(a?.delta)};out.entries.set(`ElmTerm|${t.id}`,{status:v?.reason||a?.reason||out.status,method:out.method,values,lines:[`Δ U ${fmt(values.voltageKv)} kV · ${fmt(values.voltagePu)} pu · Δ∠ ${fmt(values.angleDeg)}°`],direction:null,alarm:false});}
    }
  }else if(mode==='N1'){
    const p=selectedN1Presentation(ctx);out.status=p.status;out.method=p.method;
    const outage=p.post?.outage??p.recorded?.outage??p.hybrid?.outage;if(outage)out.outageKey=`${outage.sourceClass}|${outage.fid}`;
    if(!p.post){if(p.candidate){out.outageKey=`${p.candidate.sourceClass}|${p.candidate.equipmentId}`;for(const b of p.candidate.topImpacts){const phase=out.phase,flow=phase==='BASE'||phase==='PRE'?b.baseFlowMw:phase==='CHANGE'?b.deltaPMw:b.postFlowMw,load=phase==='BASE'||phase==='PRE'?b.baseEstimatedLoadingPct:phase==='CHANGE'?b.postEstimatedLoadingPct===null||b.baseEstimatedLoadingPct===null?null:b.postEstimatedLoadingPct-b.baseEstimatedLoadingPct:b.postEstimatedLoadingPct;out.entries.set(`${b.sourceClass}|${b.equipmentId}`,{status:'DC_SCREENED · AC_UNVERIFIED',method:'GA_DC_SCREEN',values:{pFromMw:finite(flow),qFromMvar:null,voltageKv:null,currentA:null,estimatedLoadingPercent:finite(load)},lines:[`DC P ${fmt(flow)} MW · tahmini yük ${fmt(load)}%`,`Q / U / I: — · AC_UNVERIFIED`],direction:finite(flow),alarm:false});}}return out;}
    const selectedRole=ctx.scenario.selectedId==='B0'?'base':'scenario',selectedBase=ctx.resultStore.get(selectedRole,'powerFlow'),validBase=sldLfCurrent(ctx,selectedBase,selectedRole)?selectedBase:null;
    const pre=p.post.source==='HYBRID_FULL_AC'?ctx.hybridResult?.basePost:validBase?postResultAssembler(n,validBase,p.post.post.branches[0]?.loading.season??'nominal'):null,preBranches=new Map((pre?.branches??[]).map(b=>[`${b.sourceClass}|${b.fid}`,b]));
    for(const b of p.post.post.branches){const key=`${b.sourceClass}|${b.fid}`,old=preBranches.get(key),values=sldBranchValues(b,b.loading.operationalPercent);
      if(out.phase==='BASE'||out.phase==='PRE'){const bv=old?sldBranchValues(old,old.loading&&typeof old.loading==='object'?old.loading.operationalPercent:old.loading as number|null):null;for(const k of Object.keys(values) as (keyof typeof values)[])values[k]=bv?.[k]??null;}
      if(out.phase==='CHANGE'){const bv=old?sldBranchValues(old,typeof old.loading==='object'&&old.loading?old.loading.operationalPercent:old.loading as number|null):null;for(const k of Object.keys(values) as (keyof typeof values)[])values[k]=bv?.[k]===null||!bv||values[k]===null?null:values[k]!-bv[k]!;}
      if(out.phase==='CHANGE'&&old&&stableJson([old.loading.basis,old.loading.season,old.loading.source,old.loading.ratingMva,old.loading.fromLimitA,old.loading.toLimitA])!==stableJson([b.loading.basis,b.loading.season,b.loading.source,b.loading.ratingMva,b.loading.fromLimitA,b.loading.toLimitA]))values.loadingPercent=null;
      installBranch(key,values,out.status,out.method);
    }
    const oldBuses=new Map((pre?.buses??[]).flatMap(b=>b.terms.map(t=>[t,b] as const)));
    for(const b of p.post.post.buses)for(const id of b.terms){const old=oldBuses.get(id),change=out.phase==='CHANGE',prePhase=out.phase==='BASE'||out.phase==='PRE',value=prePhase?old?.vmPu??null:change?old?b.vmPu-old.vmPu:null:b.vmPu,angle=prePhase?old?.angleDeg??null:change?old?b.angleDeg-old.angleDeg:null:b.angleDeg;out.entries.set(`ElmTerm|${id}`,{status:out.status,method:out.method,values:{voltagePu:finite(value),voltageKv:value===null?null:finite(value*b.vnKv),angleDeg:finite(angle)},lines:[`${change?'Δ ':''}U ${fmt(value===null?null:value*b.vnKv)} kV · ∠ ${fmt(angle)}°`],direction:null,alarm:!change&&value!==null&&(value<ctx.settings.value.voltageMin||value>ctx.settings.value.voltageMax)});}
  }else{
    const sc=ctx.scResult;
    if(!sc||sc.identity.modelHash!==n.modelHash||sc.identity.scenarioHash!==scenarioSignature(ctx.scenario.current)||sc.identity.profileHash!==hash(sc.profile)||!ctx.scContext||sc.identity.sourceHash!==hash(ctx.scContext)){out.status=sc?'STALE':'NOT_RUN';return out;}
    out.method=sc.method;out.status=sc.profile.edition?'BLOCKED · NORMATIVE_METHOD_UNVERIFIED':'NETWORK_APPROXIMATION · IEC/PF PARITY_UNVERIFIED';
    for(const terminal of n.buses){const exact=sc.faults.filter(f=>f.physicalTerminalFid===terminal.sourceId),matches=exact.length?exact:sc.faults.filter(f=>f.physicalTerminalFids.includes(terminal.sourceId));if(matches.length!==1)continue;const f=matches[0],numeric=f.status==='CALCULATED_NETWORK_APPROXIMATION'&&sc.profile.edition===null;
      out.entries.set(`ElmTerm|${terminal.id}`,{status:f.status,method:sc.method,values:{ikssKa:numeric?finite(f.ikssKa):null,skssMva:numeric?finite(f.skssMva):null,ipKa:null,ibKa:null,ithKa:null},lines:[`${sc.profile.faultType} ${sc.profile.calculateMode} · ${f.status}`,`Ik″ ${numeric?fmt(f.ikssKa):'—'} kA · Sk″ ${numeric?fmt(f.skssMva):'—'} MVA`],direction:null,alarm:false});
    }
  }
  return out;
}
const cache=new WeakMap<AppContext,{key:string;refs:unknown[];overlay:SldResultOverlay}>();
/** Reuse immutable solver snapshots; scenario/settings/capacity changes invalidate the projection. */
export function createSldResultOverlay(ctx:AppContext,mode:SldMode){
  const refs=[ctx.network,ctx.resultStore.get('base','powerFlow'),ctx.resultStore.get('scenario','powerFlow'),ctx.resultStore.getSnapshot(ctx.resultStore.comparisonScenarioId),ctx.hybridResult,ctx.n1AcResults,ctx.n1Result,ctx.scResult,ctx.scContext];
  const key=stableJson([mode,ctx.resultView,ctx.resultStore.role,ctx.resultStore.comparisonScenarioId,scenarioSignature(ctx.scenario.current),ctx.analysisSettings.value,ctx.powerFactoryControlContextHash,ctx.settings.value.voltageMin,ctx.settings.value.voltageMax,ctx.network?capacitySession(ctx.network.modelHash).revision:0,ctx.n1AcResults.length,mode==='SC'?[ctx.scResult?.profile,ctx.scContext?hash(ctx.scContext):null]:null]);
  const old=cache.get(ctx);if(old?.key===key&&old.refs.every((r,i)=>r===refs[i]))return old.overlay;
  const overlay=buildSldResultOverlay(ctx,mode);cache.set(ctx,{key,refs,overlay});return overlay;
}
