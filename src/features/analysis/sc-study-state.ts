import type {AppContext} from '../../app/contracts';
import type {FaultScope} from '../../domain/benchmark/study-scope';
import {workspaceKey} from '../../domain/results/workspace';
import {scenarioSignature} from '../../domain/scenario/overlay';
import {VOLTAGE_BANDS} from '../../domain/model/voltage-band';

interface ScStudyState {identity:string;mapKey:string;scope:FaultScope;targets:string[];pending:string[];cancelled:string[]}
const states=new WeakMap<AppContext,ScStudyState>();
/** Shared presentation scope and bounded targets; never a solver network subset. */
export function scStudyState(ctx:AppContext){
  const identity=workspaceKey(ctx),mapKey=JSON.stringify([ctx.filters.areaId,ctx.filters.siteId,[...ctx.filters.voltages].sort()]);
  let state=states.get(ctx);
  if(!state||state.identity!==identity||state.mapKey!==mapKey){state={identity,mapKey,scope:{ytmIds:ctx.filters.areaId?[ctx.filters.areaId]:[],tmId:ctx.filters.siteId||undefined,voltageBands:ctx.filters.voltages.size===VOLTAGE_BANDS.length?[]:[...ctx.filters.voltages].map(v=>v==='low'?36:Number(v))},targets:[],pending:[],cancelled:[]};states.set(ctx,state);}
  return state;
}
export function setScStudyScope(ctx:AppContext,scope:FaultScope){const state=scStudyState(ctx);state.scope=scope;state.targets=[];state.pending=[];state.cancelled=[];}
export function setScStudyTargets(ctx:AppContext,targets:readonly string[],pending:readonly string[]=[]){const state=scStudyState(ctx);state.targets=[...new Set(targets)];state.pending=[...pending];state.cancelled=state.cancelled.filter(fid=>state.targets.includes(fid)&&!pending.includes(fid));}
export function resetScStudyTargets(ctx:AppContext){setScStudyTargets(ctx,[]);}
export function cancelScBatch(ctx:AppContext){const state=scStudyState(ctx);if(ctx.busy)state.cancelled=[...new Set([...state.cancelled,...state.pending])];state.pending=[];}
export function scBatchProgress(ctx:AppContext){
  const state=scStudyState(ctx),sc=ctx.scResult,current=sc&&sc.identity.modelHash===ctx.network?.modelHash&&sc.identity.scenarioHash===scenarioSignature(ctx.scenario.current);
  const faults=current?sc.faults:[],targets=state.targets.length?state.targets:faults.map(f=>f.physicalTerminalFid),wanted=new Set(targets),selected=faults.filter(f=>wanted.has(f.physicalTerminalFid));
  const calculated=selected.filter(f=>f.status==='CALCULATED_NETWORK_APPROXIMATION'&&typeof f.ikssKa==='number'&&Number.isFinite(f.ikssKa)).length,blocked=selected.filter(f=>['BLOCKED','UNSUPPORTED'].includes(f.status)).length,retry=selected.filter(f=>f.status==='CANCELLED'),cancelled=new Set([...retry.map(f=>f.physicalTerminalFid),...state.cancelled]).size,processed=selected.length;
  return {targets:targets.length,processed,calculated,blocked,cancelled,remaining:Math.max(0,targets.length-processed+retry.length),batch:ctx.busy?state.pending.length:0};
}
export function nextScBatch(ctx:AppContext,targets:readonly string[],budget:number,resume:boolean){
  const sc=ctx.scResult,current=sc&&sc.identity.modelHash===ctx.network?.modelHash&&sc.identity.scenarioHash===scenarioSignature(ctx.scenario.current),done=new Set(resume&&current?sc.faults.filter(f=>f.status!=='CANCELLED').map(f=>f.physicalTerminalFid):[]),limit=Math.max(1,Math.min(20,Math.floor(budget)||10));
  return [...new Set(targets)].filter(fid=>!done.has(fid)).slice(0,limit);
}
