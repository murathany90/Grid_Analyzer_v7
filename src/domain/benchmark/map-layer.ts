import type { BenchmarkAnalysis } from './types';
import type { AppContext } from '../../app/contracts';
import { metricRows,preflightBenchmark,type BenchmarkMetricRow,METRICS } from './comparison';
import { rowObject } from './types';
import { scenarioSignature,emptyScenario } from '../scenario/overlay';
import { stableJson } from '../calculation/identity';
export interface BenchmarkMapSelection {analysis:BenchmarkAnalysis;source:'GA'|'PF'|'DELTA';metric:string;table:string;caseId?:string}
export interface BenchmarkMapValue {value:number|null;unit:string;status:string;details:string[]}
export interface BenchmarkMapData {enabled:boolean;reason:string;branches:Map<string,BenchmarkMapValue>;sites:Map<string,BenchmarkMapValue>;outage:{fid:string;sourceClass:string}|null;noGeometry:number}
export function benchmarkMapGate(ctx:AppContext,s:BenchmarkMapSelection):{enabled:boolean;reason:string}{
  if(!ctx.network)return {enabled:false,reason:'MODEL_NOT_LOADED'};
  if(s.source==='PF'&&!ctx.benchmark)return {enabled:false,reason:'PF_NOT_LOADED'};
  if(s.analysis==='SC'&&s.source!=='PF')return {enabled:false,reason:'GA_IEC60909_NOT_COMPUTABLE'};
  if(s.analysis==='N1'&&s.source==='DELTA')return {enabled:false,reason:'NOT_COMPARABLE_PF_MISSING'};
  if(s.analysis==='LF'&&s.source==='GA'&&!ctx.resultStore.get('base','powerFlow')?.converged)return {enabled:false,reason:'GA_LF_NOT_CALCULATED'};
  if(s.analysis==='LF'&&s.source==='DELTA'){
    const gate=ctx.benchmark?preflightBenchmark(ctx.benchmark,ctx.network,ctx.resultStore.get('base','powerFlow'),ctx.powerFactoryControlContextNumericFile):null;
    if(gate?.status!=='COMPARABLE_PARTIAL')return {enabled:false,reason:gate?.reasons.join('; ')||'METHOD_MISMATCH'};
  }
  if(s.analysis==='N1'&&s.source==='GA'){
    const ac=ctx.n1AcResults.find(r=>r.outage.caseId===s.caseId&&r.status==='CONVERGED'&&r.identity.baseScenarioHash===scenarioSignature(ctx.scenario.current)&&r.identity.settingsHash===stableJson(ctx.analysisSettings.value));
    const dc=ctx.n1Result,validDc=!!dc&&dc.identity.modelHash===ctx.network.modelHash&&dc.identity.scenarioHash===scenarioSignature(dc.analysisScope==='base'?emptyScenario():ctx.scenario.current);
    if(!ac&&!validDc)return {enabled:false,reason:'GA_N1_NOT_CALCULATED_OR_STALE'};
    if(!ac&&!['postLoadingPercent','postPmw'].includes(s.metric))return {enabled:false,reason:'GA_DC_P_ONLY'};
  }
  return {enabled:true,reason:''};
}
/** Source identity and metric gates govern colors. Missing numbers remain null. */
export function buildBenchmarkMapData(ctx:AppContext,s:BenchmarkMapSelection):BenchmarkMapData{
  const gate=benchmarkMapGate(ctx,s),data:BenchmarkMapData={...gate,branches:new Map(),sites:new Map(),outage:null,noGeometry:0},network=ctx.network;if(!network||!gate.enabled)return data;
  const busById=new Map(network.buses.map(b=>[b.id,b])),lineByKey=new Map([...network.lines,...network.transformers].map(e=>[`${e.sourceClass}:${e.sourceId}`,e]));
  const siteById=new Map(network.sites.map(site=>[site.id,site]));
  const putSite=(id:string,value:BenchmarkMapValue)=>{const previous=data.sites.get(id);if(!previous){data.sites.set(id,{...value,details:[...value.details]});return;}previous.details.push(...value.details);if(value.value!==null&&(previous.value===null||Math.abs(value.value)>Math.abs(previous.value)))previous.value=value.value;};
  const put=(sourceClass:string,fid:string,value:BenchmarkMapValue)=>{
    const line=lineByKey.get(`${sourceClass}:${fid}`),bus=busById.get(fid),siteIds=line?.siteIds||bus?.siteIds||[];
    if(line)data.branches.set(`${sourceClass}:${line.id}`,value);
    let hasGeometry=!!(sourceClass==='ElmLne'&&line&&'coordinates' in line&&line.coordinates.length);
    for(const id of siteIds){putSite(id,value);const site=siteById.get(id);if(site?.lat!=null&&site.lon!=null)hasGeometry=true;}
    if(!hasGeometry)data.noGeometry++;
  };
  const result=ctx.resultStore.get('base','powerFlow');
  if(s.analysis==='LF'&&s.source==='GA'&&result){
    for(const b of result.buses){const value=s.metric==='voltagePu'?b.vmPu:s.metric==='voltageKv'?b.vmPu*b.vnKv:s.metric==='angleDeg'?b.angleRad*180/Math.PI:null;if(value!==null)for(const fid of b.terms)put('ElmTerm',fid,{value,unit:s.metric==='voltagePu'?'pu':s.metric==='voltageKv'?'kV':'deg',status:'GA_AC_BALANCED',details:[`ElmTerm:${fid} · ${value} · GA AC · ${b.islandId??'ada bilinmiyor'} · NO_PF_DELTA`]});}
    for(const b of result.branches){const value=({pFromMw:b.pf,qFromMvar:b.qf,pToMw:b.pt,qToMvar:b.qt,sFromMva:Math.hypot(b.pf,b.qf),sToMva:Math.hypot(b.pt,b.qt),loadingPercent:b.loading,iFromA:b.ifA,iToA:b.itA} as Record<string,number|null>)[s.metric]??null;if(value!==null)put(b.sourceClass,b.id,{value,unit:METRICS.GA_Reference_Raw[s.metric]??'',status:'GA_AC_BALANCED',details:[`${b.sourceClass}:${b.id} · ${value} · GA_AC_BALANCED`]});}
    return data;
  }
  if(s.analysis==='N1'){
    const table=ctx.benchmark?.groups.N1.tables.N1_Cases_Raw,caseRow=table?.rows.map(row=>rowObject(table,row)).find(r=>r.caseId===s.caseId);if(caseRow)data.outage={fid:String(caseRow.outageFid),sourceClass:String(caseRow.outageClass)};
    if(s.source==='GA'){
      const ac=ctx.n1AcResults.find(r=>r.outage.caseId===s.caseId&&r.status==='CONVERGED'&&r.identity.baseScenarioHash===scenarioSignature(ctx.scenario.current)&&r.identity.settingsHash===stableJson(ctx.analysisSettings.value));
      if(ac?.result){for(const b of ac.result.buses){const value=s.metric==='voltagePu'?b.vmPu:s.metric==='voltageKv'?b.vmPu*b.vnKv:null;if(value!==null)for(const fid of b.terms)put('ElmTerm',fid,{value,unit:s.metric==='voltagePu'?'pu':'kV',status:'GA_AC_POST_CONTINGENCY',details:[`${fid} · ${s.caseId} · GA_AC_POST_CONTINGENCY`]});}for(const b of ac.result.branches){const value=({postPmw:b.pf,postQmvar:b.qf,postMva:Math.hypot(b.pf,b.qf),postLoadingPercent:b.loading} as Record<string,number|null>)[s.metric]??null;put(b.sourceClass,b.id,{value,unit:s.metric==='postLoadingPercent'?'%':s.metric==='postMva'?'MVA':s.metric==='postQmvar'?'Mvar':'MW',status:'GA_AC_POST_CONTINGENCY',details:[`${b.sourceClass}:${b.id} · ${s.caseId} · GA_AC_POST_CONTINGENCY`]});}}
      else{const c=ctx.n1Result?.candidates.find(c=>c.equipmentId===data.outage?.fid&&c.sourceClass===data.outage.sourceClass);for(const b of c?.topImpacts||[])put(b.sourceClass,b.equipmentId,{value:s.metric==='postPmw'?b.postFlowMw:b.postEstimatedLoadingPct,unit:s.metric==='postPmw'?'MW':'%',status:'GA_DC_SCREEN',details:[`${b.sourceClass}:${b.equipmentId} · GA_DC_SCREEN · ${s.caseId} · P-only`]});}
      return data;
    }
  }
  const table=ctx.benchmark?.groups[s.analysis].tables[s.table];if(!table)return {...data,enabled:false,reason:'NO_DATA'};
  const preflight=ctx.benchmark?preflightBenchmark(ctx.benchmark,network,result,ctx.powerFactoryControlContextNumericFile):{status:'NOT_COMPARABLE' as const,reasons:[],lf:null,comparison:null};
  const rows=metricRows(table,preflight,s.metric).filter(r=>s.analysis!=='N1'||r.caseId===s.caseId);
  for(const r of rows){const value=s.source==='DELTA'?r.delta:r.pf.value;
    const available=r.reason!=='NOT_RECORDED'&&r.pf.availability!=='INVALID';
    put(r.sourceClass||'ElmTerm',r.fid,{value:available?value:null,unit:r.pf.unit,status:value===null?r.status:s.source==='DELTA'?'COMPARABLE_PARTIAL':r.status,details:[`${r.sourceClass}:${r.fid} · ${r.name} · PF ${r.pf.rawText||'—'} / GA ${r.ga??'—'} / Δ ${r.delta??'—'} ${r.pf.unit}`,`${r.method} · ${r.pf.availability} · ${r.pf.source.sheet}!${r.pf.source.column}${r.pf.source.row}`,r.reason]});
  }
  return data;
}
export function benchmarkLayerColor(value:BenchmarkMapValue|undefined,delta=false):string{
  if(!value||value.value===null||!Number.isFinite(value.value))return '#708596';
  if(delta)return value.value>0?'#eb765b':value.value<0?'#63bdcf':'#a6b7c0';
  if(value.unit==='pu')return value.value<.9?'#df6c68':value.value>1.1?'#e8ae52':'#77bbac';
  const magnitude=Math.abs(value.value);return magnitude===0?'#a6b7c0':magnitude>100?'#e47d58':magnitude>30?'#d6af64':'#75bcc5';
}
