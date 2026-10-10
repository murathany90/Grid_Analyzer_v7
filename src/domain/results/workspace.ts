import {buildBenchmarkMapData,type BenchmarkMapSelection} from '../benchmark/map-layer';
import {resolveN1Post} from '../benchmark/post-result-source';
import {sha256} from '@noble/hashes/sha2.js';
import type {AppContext} from '../../app/contracts';
import {stableJson,identityKey} from '../calculation/identity';
import {scenarioSignature} from '../scenario/overlay';
export interface ResultView {scenarioId:string;fid?:string;analysis:'LF'|'N1'|'SC';source:'GA'|'PF'|'GA−PF'|'Senaryo−Baz';phase:'BASE'|'PRE'|'POST'|'CHANGE';metric:string;caseId?:string;faultId?:string;side?:string}
export const initialResultView=():ResultView=>({scenarioId:'B0',analysis:'LF',source:'GA',phase:'BASE',metric:'pFromMw'});
export function workspaceKey(ctx:AppContext):string{return stableJson({model:ctx.network?.modelHash,scenario:scenarioSignature(ctx.scenario.current),settings:ctx.analysisSettings.value,control:ctx.powerFactoryControlContextHash});}
export interface ScenarioResults {n1:AppContext['n1Result'];ac:AppContext['n1AcResults'];hybrid:AppContext['hybridResult'];sc:AppContext['scResult'];scContext:AppContext['scContext']}
/** References are shared, never cloned. Evicted entries may be restored from IndexedDB. */
export class WorkspaceResultCache {private entries=new Map<string,ScenarioResults>();constructor(private limit=6){}set(key:string,value:ScenarioResults){this.entries.delete(key);this.entries.set(key,value);while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value!);}get(key:string){const entry=this.entries.get(key);if(entry){this.entries.delete(key);this.entries.set(key,entry);}return entry;}clear(){this.entries.clear();}}
function shortId(family:string,key:string){return family+'-'+Array.from(sha256(new TextEncoder().encode(key)),v=>v.toString(16).padStart(2,'0')).join('').slice(0,20);}
const n1Ids=new WeakMap<AppContext,{key:string;refs:unknown[];id:string|null}>();
/** READY belongs to a recorded case/phase/metric, never to the enclosing run. */
function activeN1Id(ctx:AppContext):string|null{
  const v=ctx.resultView;if(!ctx.network||!v.caseId)return null;
  const c=ctx.n1AcResults.find(c=>c.outage.caseId===v.caseId),h=ctx.hybridResult?.cases.find(c=>c.outage.caseId===v.caseId),selection=ctx.benchmarkMap?.analysis==='N1'&&ctx.benchmarkMap.caseId===v.caseId&&ctx.benchmarkMap.metric===v.metric?ctx.benchmarkMap:workspaceMapSelection(ctx);
  const key=stableJson([v.caseId,v.phase,v.metric,v.source,v.side,selection,ctx.analysisSettings.value,ctx.powerFactoryControlContextHash]),refs=[ctx.network,ctx.scenario.current,ctx.benchmark,ctx.resultStore.get(ctx.scenario.selectedId==='B0'?'base':'scenario','powerFlow'),ctx.n1Result,ctx.n1AcResults,c?.result,c?.status,ctx.hybridResult,ctx.hybridResult?.basePost,h?.mapResults,h?.status],old=n1Ids.get(ctx);
  if(old?.key===key&&old.refs.every((r,i)=>r===refs[i]))return old.id;
  const data=buildBenchmarkMapData(ctx,selection);let id:string|null=null;
  if(data.enabled&&(data.numericValues??0)>0){
    const post=resolveN1Post({network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,hybrid:ctx.hybridResult,ac:ctx.n1AcResults},v.caseId),identity=post?.source==='MANUAL_FULL_AC'?c?.identity:post?.source==='HYBRID_FULL_AC'?ctx.hybridResult?.identity:ctx.n1Result?.identity;
    if(identity)id=shortId('N1',stableJson([identity,post?.source??'GA_DC_SCREEN',v.caseId,selection.n1Layer,v.metric,v.side]));
  }
  n1Ids.set(ctx,{key,refs,id});return id;
}
export function activeResultId(ctx:AppContext):string|null{const v=ctx.resultView;if(v.source==='PF'){const r=ctx.benchmark?.groups[v.analysis];return r?shortId('PF',stableJson(r.identity)):null;}
  if(v.analysis==='LF'){const r=ctx.resultStore.active;return r?shortId('LF',identityKey(r.identity)):null;}
  if(v.analysis==='SC')return ctx.scResult?ctx.scResult.identity.scenarioHash===scenarioSignature(ctx.scenario.current)?shortId('SC',stableJson(ctx.scResult.identity)):null:null;
  return activeN1Id(ctx);
}

export function workspaceMapSelection(ctx:AppContext):BenchmarkMapSelection{const v=ctx.resultView;return {analysis:v.analysis,source:v.source==='PF'?'PF':v.source==='GA−PF'?'DELTA':v.source==='Senaryo−Baz'?'SCENARIO_DELTA':'GA',metric:v.metric,table:v.analysis==='LF'?'GA_Reference_Raw':v.analysis==='N1'?'N1_RecordedExtrema_Raw':'SC_BusResults_Raw',caseId:v.caseId,n1Layer:v.phase==='PRE'||v.phase==='BASE'?'BASE':v.phase==='CHANGE'?'CHANGE':'POST',side:v.side};}
