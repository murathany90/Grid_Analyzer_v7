import type {BenchmarkMapSelection} from '../benchmark/map-layer';
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
export function activeResultId(ctx:AppContext):string|null{const v=ctx.resultView;if(v.source==='PF'){const r=ctx.benchmark?.groups[v.analysis];return r?shortId('PF',stableJson(r.identity)):null;}
  if(v.analysis==='LF'){const r=ctx.resultStore.active;return r?shortId('LF',identityKey(r.identity)):null;}
  if(v.analysis==='SC')return ctx.scResult?ctx.scResult.identity.scenarioHash===scenarioSignature(ctx.scenario.current)?shortId('SC',stableJson(ctx.scResult.identity)):null:null;
  const c=ctx.n1AcResults.find(c=>c.outage.caseId===v.caseId);const key=c?.identity.baseScenarioHash===scenarioSignature(ctx.scenario.current)?c.identity.key:ctx.hybridResult?.identity.scenarioHash===scenarioSignature(ctx.scenario.current)?stableJson(ctx.hybridResult.identity):ctx.n1Result?.identity.scenarioHash===scenarioSignature(ctx.scenario.current)?stableJson(ctx.n1Result.identity):null;return key?shortId('N1',key):null;
}

export function workspaceMapSelection(ctx:AppContext):BenchmarkMapSelection{const v=ctx.resultView;return {analysis:v.analysis,source:v.source==='PF'?'PF':v.source==='GA−PF'?'DELTA':v.source==='Senaryo−Baz'?'SCENARIO_DELTA':'GA',metric:v.metric,table:v.analysis==='LF'?'GA_Reference_Raw':v.analysis==='N1'?'N1_RecordedExtrema_Raw':'SC_BusResults_Raw',caseId:v.caseId,n1Layer:v.phase==='PRE'||v.phase==='BASE'?'BASE':v.phase==='CHANGE'?'CHANGE':'POST',side:v.side};}
