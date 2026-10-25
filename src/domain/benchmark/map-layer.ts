import {pfScReferenceRows} from './sc-reference';
import {currentScResult} from '../results/sc-selection';
import {compactScRows} from '../../features/analysis/compact-rows';
import {scenarioLfComparison} from '../results/lf-comparison';
import {postResultAssembler} from '../../analysis/contingency-ac/post-results';
import type { BenchmarkAnalysis } from './types';
import type { AppContext } from '../../app/contracts';
import { metricRows,preflightBenchmark,type BenchmarkMetricRow,METRICS } from './comparison';
import { rowObject } from './types';
import { scenarioSignature,scenarioChanged,emptyScenario } from '../scenario/overlay';
import {resolveN1Post,lfSnapshotIsCurrent,selectN1Result} from './post-result-source';
import {postBranchMetric} from '../../analysis/contingency-ac/post-results';
import { stableJson } from '../calculation/identity';
import {hasReference} from './reference-slots';
export interface BenchmarkMapSelection {analysis:BenchmarkAnalysis;source:'GA'|'PF'|'DELTA'|'EXPLORATORY_DELTA'|'SCENARIO_DELTA';metric:string;table:string;caseId?:string;n1Layer?:'BASE'|'POST'|'CHANGE'|'NEW_CONSTRAINTS';scMode?:'MAX'|'MIN';diagnostic?:boolean;side?:string;voltageKv?:number;nodeKind?:string}
export interface BenchmarkMapValue {value:number|null;unit:string;status:string;details:string[];minVpu?:number;maxVpu?:number;maxDeviationPu?:number;representativeFid?:string;nominalKv?:number|null;electricalBusId?:string;sourceCellKey?:string;deltaLevels?:Record<string,{min:number;max:number;representativeFid:string;value:number}>;voltageLevels?:Record<string,{minVpu:number;maxVpu:number;maxDeviationPu:number;representativeFid:string}>}
export interface BenchmarkMapData {enabled:boolean;reason:string;branches:Map<string,BenchmarkMapValue>;sites:Map<string,BenchmarkMapValue>;outage:{fid:string;sourceClass:string}|null;noGeometry:number;numericValues?:number;scale?:{p95:number;min:number;max:number;unit:string}}
const gateCache=new WeakMap<AppContext,{benchmark:unknown;network:unknown;result:unknown;control:unknown;gate:ReturnType<typeof preflightBenchmark>}>();
function cachedPreflight(ctx:AppContext){const result=ctx.resultStore.get('base','powerFlow'),old=gateCache.get(ctx);if(old&&old.benchmark===ctx.benchmark&&old.network===ctx.network&&old.result===result&&old.control===ctx.powerFactoryControlContextNumericFile)return old.gate;const gate=preflightBenchmark(ctx.benchmark!,ctx.network,result,ctx.powerFactoryControlContextNumericFile);gateCache.set(ctx,{benchmark:ctx.benchmark,network:ctx.network,result,control:ctx.powerFactoryControlContextNumericFile,gate});return gate;}
const rowCache=new WeakMap<AppContext,{key:string;benchmark:AppContext['benchmark'];result:unknown;ac:unknown;dc:unknown;hybrid:unknown;sc:unknown;rows:BenchmarkMetricRow[]}>();
function canonicalRows(ctx:AppContext,s:BenchmarkMapSelection):BenchmarkMetricRow[]{
  const table=ctx.benchmark?.groups[s.analysis].tables[s.table];if(!table||!ctx.network)return [];
  const result=ctx.resultStore.get('base','powerFlow'),key=stableJson([{analysis:s.analysis,metric:s.metric,table:s.table,caseId:s.caseId,scMode:s.scMode,diagnostic:s.diagnostic,side:s.side,voltageKv:s.voltageKv},ctx.network.modelHash,scenarioSignature(ctx.scenario.current),ctx.analysisSettings?.value]),cached=rowCache.get(ctx);
  if(cached&&cached.key===key&&cached.benchmark===ctx.benchmark&&cached.result===result&&cached.ac===ctx.n1AcResults&&cached.dc===ctx.n1Result&&cached.hybrid===ctx.hybridResult&&cached.sc===ctx.scResult)return cached.rows;
  const gate=cachedPreflight(ctx);
  const rows=metricRows(table,gate,s.metric,{lfResult:result,diagnostic:s.diagnostic===true,network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings?.value,hybrid:ctx.hybridResult,sc:ctx.scResult,benchmark:ctx.benchmark,ac:ctx.n1AcResults}).filter(r=>(s.analysis!=='N1'||r.caseId===s.caseId)&&(!s.voltageKv||r.nominalKv===s.voltageKv));
  rowCache.set(ctx,{key,benchmark:ctx.benchmark,result,ac:ctx.n1AcResults,dc:ctx.n1Result,hybrid:ctx.hybridResult,sc:ctx.scResult,rows});return rows;
}
function currentLf(ctx:AppContext):boolean {const base=ctx.resultView?.analysis==='LF'?ctx.resultStore.role==='base':!scenarioChanged(ctx.scenario.current);return lfSnapshotIsCurrent(ctx.resultStore.get(base?'base':'scenario','powerFlow'),ctx.network,base?emptyScenario():ctx.scenario.current,ctx.analysisSettings?.value);}
export function benchmarkMapGate(ctx:AppContext,s:BenchmarkMapSelection):{enabled:boolean;reason:string}{
  if(!ctx.network)return {enabled:false,reason:'MODEL_NOT_LOADED'};
  if(s.source==='SCENARIO_DELTA'){const pair=scenarioLfComparison(ctx,s.metric);return {enabled:s.analysis==='LF'&&pair.enabled,reason:pair.reason||pair.status};}
  if(s.source!=='GA'&&!ctx.benchmark)return {enabled:false,reason:'PF_NOT_LOADED'};
  if(s.source!=='GA'&&!hasReference(ctx.benchmark,s.analysis))return {enabled:false,reason:'PF_REFERENCE_SLOT_NOT_LOADED'};
  if(s.source==='EXPLORATORY_DELTA'){
    if(!s.diagnostic)return {enabled:false,reason:'DIAGNOSTIC_OPT_IN_REQUIRED'};
    if(s.analysis==='LF'&&!currentLf(ctx))return {enabled:false,reason:'GA_LF_NOT_CALCULATED_OR_STALE'};
    if(scenarioSignature(ctx.scenario.current)!==scenarioSignature(emptyScenario()))return {enabled:false,reason:'PF_SCENARIO_IDENTITY_UNVERIFIED'};
    return canonicalRows(ctx,s).some(r=>r.identityMatched&&r.diagnosticDelta!=null)?{enabled:true,reason:'EXPLORATORY_DELTA_METHOD_UNVERIFIED'}:{enabled:false,reason:'NO_IDENTITY_MATCHED_DIAGNOSTIC_CELLS; LOADING_DENOMINATOR_OR_METHOD_UNVERIFIED'};
  }
  if(s.analysis==='SC'&&s.source==='DELTA')return {enabled:false,reason:'GA_IEC60909_METHOD_AND_EDITION_UNVERIFIED'};
  if(s.analysis==='SC'&&s.source==='PF'){
    if(s.metric==='skssMva')return {enabled:false,reason:'PF_SKSS_REFERENCE_NOT_AVAILABLE'};
    if(s.scMode==='MIN')return {enabled:false,reason:'PF_SC_MIN_REFERENCE_NOT_AVAILABLE'};
  }
  if(s.analysis==='SC'&&s.source==='GA'){
    const sc=currentScResult(ctx),current=!!sc&&sc.identity.modelHash===ctx.network.modelHash&&sc.identity.scenarioHash===scenarioSignature(ctx.scenario.current);
    if(!current||!sc.faults.length)return {enabled:false,reason:'GA_IEC60909_NOT_COMPUTABLE'};
    if(!['ikssKa','maxIkssKa','ikss3FKa','skssMva'].includes(s.metric))return {enabled:false,reason:'SC_METRIC_NOT_IMPLEMENTED'};
  }
  if(s.analysis==='N1'&&s.source==='DELTA')return {enabled:false,reason:'NOT_COMPARABLE_PF_MISSING'};
  if(s.analysis==='LF'&&s.source==='GA'&&!currentLf(ctx))return {enabled:false,reason:'GA_LF_NOT_CALCULATED'};
  if(s.analysis==='LF'&&s.source==='DELTA'){
    if(!currentLf(ctx))return {enabled:false,reason:'GA_LF_NOT_CALCULATED_OR_STALE'};
    const gate=ctx.benchmark?cachedPreflight(ctx):null;
    if(gate?.status!=='COMPARABLE_PARTIAL')return {enabled:false,reason:gate?.reasons.join('; ')||'METHOD_MISMATCH'};
  }
  if(s.analysis==='N1'&&s.source==='GA'){
    const selected=selectN1Result({network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings?.value,hybrid:ctx.hybridResult,ac:ctx.n1AcResults,dc:ctx.n1Result},s.caseId);
    const post=resolveN1Post({network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings?.value,hybrid:ctx.hybridResult,ac:ctx.n1AcResults},s.caseId??'');
    if(selected.current&&selected.ac&&!post)return {enabled:false,reason:selected.ac.status+'; SELECTED_MANUAL_POST_NOT_AVAILABLE'};
    const dc=ctx.n1Result,validDc=!!dc&&dc.identity.modelHash===ctx.network.modelHash&&dc.identity.scenarioHash===scenarioSignature(ctx.scenario.current)&&dc.candidates.some(c=>{const e=[...ctx.network!.lines,...ctx.network!.transformers].find(e=>e.id===c.equipmentId&&e.sourceClass===c.sourceClass);return s.caseId===`N1:${c.sourceClass}:${e?.sourceId??c.equipmentId}`;});
    if(!post&&!validDc)return {enabled:false,reason:'GA_N1_NOT_CALCULATED_OR_STALE'};
    if(!post&&!['postLoadingPercent','postPmw'].includes(s.metric))return {enabled:false,reason:'GA_DC_P_ONLY'};
    if(s.n1Layer==='NEW_CONSTRAINTS'&&post?.source!=='HYBRID_FULL_AC')return {enabled:false,reason:'N1_CONSTRAINT_CHANGE_NOT_RECORDED'};
    if(post&&s.n1Layer&&s.n1Layer!=='POST'&&!(post.source==='HYBRID_FULL_AC'?ctx.hybridResult?.basePost:currentLf(ctx)))return {enabled:false,reason:'GA_N1_BASE_METHOD_IDENTITY_NOT_VERIFIED'};
  }
  return {enabled:true,reason:''};
}
/** Source identity and metric gates govern colors. Missing numbers remain null. */
export function buildBenchmarkMapData(ctx:AppContext,s:BenchmarkMapSelection):BenchmarkMapData{
  const gate=benchmarkMapGate(ctx,s),data:BenchmarkMapData={...gate,branches:new Map(),sites:new Map(),outage:null,noGeometry:0,numericValues:0},network=ctx.network;if(!network||!gate.enabled)return data;
  const busById=new Map(network.buses.map(b=>[b.id,b])),lineByKey=new Map([...network.lines,...network.transformers].map(e=>[`${e.sourceClass}:${e.sourceId}`,e]));
  const siteById=new Map(network.sites.map(site=>[site.id,site]));
  const putSite=(id:string,value:BenchmarkMapValue,fid:string,kv:number|null)=>{
    let previous=data.sites.get(id);if(!previous){previous={...value,representativeFid:fid,nominalKv:kv,details:[]};data.sites.set(id,previous);}if(previous.details.length<32)previous.details.push(...value.details);
    if(value.value===null)return;
    if(value.unit==='pu'&&s.n1Layer!=='CHANGE'&&!['DELTA','EXPLORATORY_DELTA','SCENARIO_DELTA'].includes(s.source)){
      const v=value.value,deviation=Math.abs(v-1),level=String(kv??'UNKNOWN');previous.voltageLevels??={};const old=previous.voltageLevels[level];
      previous.voltageLevels[level]=old?{minVpu:Math.min(old.minVpu,v),maxVpu:Math.max(old.maxVpu,v),maxDeviationPu:Math.max(old.maxDeviationPu,deviation),representativeFid:deviation>old.maxDeviationPu?fid:old.representativeFid}:{minVpu:v,maxVpu:v,maxDeviationPu:deviation,representativeFid:fid};
      previous.minVpu=Math.min(previous.minVpu??v,v);previous.maxVpu=Math.max(previous.maxVpu??v,v);
      if(previous.maxDeviationPu===undefined||deviation>previous.maxDeviationPu){previous.value=v;previous.maxDeviationPu=deviation;previous.representativeFid=fid;}
    }else {if(s.n1Layer==='CHANGE'||['DELTA','EXPLORATORY_DELTA','SCENARIO_DELTA'].includes(s.source)){const level=String(kv??'UNKNOWN');previous.deltaLevels??={};const old=previous.deltaLevels[level];previous.deltaLevels[level]={min:Math.min(old?.min??value.value,value.value),max:Math.max(old?.max??value.value,value.value),value:!old||Math.abs(value.value)>Math.abs(old.value)?value.value:old.value,representativeFid:!old||Math.abs(value.value)>Math.abs(old.value)?fid:old.representativeFid};}if(previous.value===null||previous.representativeFid===undefined||Math.abs(value.value)>Math.abs(previous.value)){previous.value=value.value;previous.representativeFid=fid;previous.status=value.status;previous.nominalKv=kv;previous.electricalBusId=value.electricalBusId;previous.sourceCellKey=value.sourceCellKey;}}
  };
  const put=(sourceClass:string,fid:string,value:BenchmarkMapValue)=>{
    const line=lineByKey.get(`${sourceClass}:${fid}`),bus=sourceClass==='ElmTerm'?busById.get(fid):undefined,siteIds=line?.siteIds||bus?.siteIds||[];if(s.voltageKv&&(bus?.vnKv??line?.vnKv)!==s.voltageKv)return;
    if(value.value!==null&&Number.isFinite(value.value))data.numericValues!++;
    if(line)data.branches.set(`${sourceClass}:${line.id}`,value);
    let hasGeometry=!!(sourceClass==='ElmLne'&&line&&'coordinates' in line&&line.coordinates.length);
    for(const id of siteIds){putSite(id,value,fid,bus?.vnKv??null);const site=siteById.get(id);if(site?.lat!=null&&site.lon!=null)hasGeometry=true;}
    if(!hasGeometry)data.noGeometry++;
  };
  const baseView=s.analysis==='LF'&&ctx.resultStore?.role==='base',result=typeof ctx.resultStore?.get==='function'?ctx.resultStore.get((s.analysis==='LF'?ctx.resultStore.role==='base':!scenarioChanged(ctx.scenario.current))?'base':'scenario','powerFlow'):ctx.resultStore?.active;
  if(s.source==='SCENARIO_DELTA'){
    const pair=scenarioLfComparison(ctx,s.metric),details=(v:import('../results/lf-comparison').LfComparisonCell)=>['Senaryo−Baz · GA ONLY',v.reason||pair.status,'PRE '+v.pre+' · POST '+v.post+' · Δ '+v.delta+' '+v.unit];
    if(!['voltageKv','voltagePu','angleDeg'].includes(s.metric))for(const e of [...network.lines,...network.transformers]){const v=pair.branches.get(e.sourceClass+':'+e.id);if(v)put(e.sourceClass,e.sourceId,{value:v.delta,unit:v.unit,status:v.status,details:details(v)});}
    for(const [fid,v] of pair.terminals)put('ElmTerm',fid,{value:v.delta,unit:v.unit,status:v.status,details:details(v)});
    const values=[...data.branches.values(),...data.sites.values()].flatMap(v=>v.value===null?[]:[v.value]),abs=values.map(Math.abs).sort((a,b)=>a-b);
    data.scale={p95:abs[Math.max(0,Math.ceil(abs.length*.95)-1)]||1,min:values.length?Math.min(...values):0,max:values.length?Math.max(...values):0,unit:pair.branches.values().next().value?.unit??pair.terminals.values().next().value?.unit??''};
    return data;
  }
  if(s.analysis==='SC'){
    const source=s.source==='PF'?'PF':'GA',rows=compactScRows(ctx,source).filter(r=>!s.nodeKind||r.raw.nodeKind===s.nodeKind),unit=s.metric==='skssMva'?'MVA':'kA';
    const pfCells=source==='PF'?new Map(pfScReferenceRows(ctx).map(r=>[r.fid,r])):null;
    if(pfCells&&(!s.nodeKind||s.nodeKind==='UNCLASSIFIED'))for(const cell of pfCells.values())if(!busById.has(cell.fid)&&(!s.voltageKv||cell.nominalKv===s.voltageKv))data.noGeometry++;
    for(const row of rows){
      if(s.voltageKv&&(row.kv==null||Math.abs(row.kv-s.voltageKv)>1e-6))continue;
      const value=source==='PF'?row.metrics.ikss?.pf??null:s.metric==='skssMva'?row.metrics.skss?.ga??null:row.metrics.ikss?.ga??null;
      if(value!==null&&Number.isFinite(value))data.numericValues!++;
      let hasGeometry=false;const ids=JSON.parse(String(row.raw.physicalAliases??'[]')) as string[];
      for(const siteId of row.siteIds??[]){const fid=ids.find(id=>busById.get(id)?.siteIds.includes(siteId))??row.fid,cell=pfCells?.get(fid);putSite(siteId,{value,unit,status:source==='PF'?'PF_REFERENCE_ONLY':String(row.raw.Hesap_Durumu),nominalKv:row.kv,electricalBusId:row.key,sourceCellKey:cell?.sourceCellKey??String(row.raw.sourceCellKey??''),details:[`${source} · ${row.name} (${fid}) · ${row.kv} kV · ${value??'—'} ${unit}`,source==='PF'?'TM maksimumu · PF kaynak hücresi; GA yöntem paritesi doğrulanmadı':String(row.raw.reason_3F)]},fid,row.kv);const site=siteById.get(siteId);if(site?.lat!=null&&site.lon!=null)hasGeometry=true;}
      if(!hasGeometry)data.noGeometry++;

    }
    for(const site of network.sites)if(!data.sites.has(site.id))data.sites.set(site.id,{value:null,unit,status:s.voltageKv?'NO_VOLTAGE_MATCH':'NOT_RUN',details:['Seçili kaynak/mod/gerilim/sınıfta sayısal 3F değeri yok.']});
    const sorted=[...data.sites.values()].flatMap(v=>v.value!==null&&Number.isFinite(v.value)?[v.value]:[]).sort((a,b)=>a-b);
    if(sorted.length)data.scale={p95:sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)],min:sorted[0],max:sorted.at(-1)!,unit};
    return data;
  }
  if(s.analysis==='LF'&&s.source==='GA'&&result){
    for(const b of result.buses){const value=s.metric==='voltagePu'?b.vmPu:s.metric==='voltageKv'?b.vmPu*b.vnKv:s.metric==='angleDeg'?b.angleRad*180/Math.PI:null;if(value!==null)for(const fid of b.terms)put('ElmTerm',fid,{value,unit:s.metric==='voltagePu'?'pu':s.metric==='voltageKv'?'kV':'deg',status:'GA_AC_BALANCED',details:[`ElmTerm:${fid} · ${value} · GA AC · ${b.islandId??'ada bilinmiyor'} · NO_PF_DELTA`]});}
    for(const b of result.branches){const value=({pFromMw:b.pf,qFromMvar:b.qf,pToMw:b.pt,qToMvar:b.qt,sFromMva:Math.hypot(b.pf,b.qf),sToMva:Math.hypot(b.pt,b.qt),loadingPercent:b.loading,iFromA:b.ifA,iToA:b.itA} as Record<string,number|null>)[s.metric]??null;if(value!==null)put(b.sourceClass,b.id,{value,unit:METRICS.GA_Reference_Raw[s.metric]??'',status:'GA_AC_BALANCED',details:[`${b.sourceClass}:${b.id} · ${value} · GA_AC_BALANCED`]});}
    return data;
  }
  if(s.analysis==='N1'){
    const table=ctx.benchmark?.groups.N1.tables.N1_Cases_Raw,caseRow=table?.rows.map(row=>rowObject(table,row)).find(r=>r.caseId===s.caseId);if(caseRow)data.outage={fid:String(caseRow.outageFid),sourceClass:String(caseRow.outageClass)};
    if(s.source==='GA'){
      const resolved=resolveN1Post({network,scenario:ctx.scenario.current,settings:ctx.analysisSettings?.value,hybrid:ctx.hybridResult,ac:ctx.n1AcResults},s.caseId??'');
      if(resolved){
        data.outage={fid:resolved.outage.fid,sourceClass:resolved.outage.sourceClass};
        const base=resolved.source==='HYBRID_FULL_AC'?ctx.hybridResult?.basePost:currentLf(ctx)&&result?postResultAssembler(network,result,'nominal'):undefined,layer=s.n1Layer??'POST',post=layer==='BASE'?base!:resolved.post;
        const busKey=(b:{vnKv:number;terms:string[]})=>`${b.vnKv}|${stableJson([...b.terms].sort())}`,baseBuses=new Map(base?.buses.map(b=>[busKey(b),b])),baseBranches=new Map(base?.branches.map(b=>[`${b.sourceClass}:${b.fid}`,b]));
        const changes=resolved.source==='HYBRID_FULL_AC'?ctx.hybridResult?.cases.find(c=>c.outage.caseId===s.caseId)?.constraintChanges??[]:[];
        for(const b of post.buses){const before=baseBuses.get(busKey(b)),metric=['voltagePu','postVoltagePu'].includes(s.metric)?b.vmPu:s.metric==='voltageKv'?b.vmPu*b.vnKv:s.metric==='angleDeg'?b.angleDeg:null;
          const value=metric===null?null:layer==='CHANGE'?(before?metric-(s.metric==='voltageKv'?before.vmPu*before.vnKv:s.metric==='angleDeg'?before.angleDeg:before.vmPu):null):layer==='NEW_CONSTRAINTS'&&!changes.some(c=>c.state==='NEW'&&c.metric==='voltagePu'&&c.physicalTerminalFids?.some(fid=>b.terms.includes(fid)))?null:metric;
          if(metric!==null)for(const fid of b.terms)put('ElmTerm',fid,{value,unit:s.metric==='voltageKv'?'kV':s.metric==='angleDeg'?'deg':'pu',status:layer,details:[`${fid} / ${s.caseId} / ${resolved.source} / ${layer} / BASE ${before?.vmPu??'null'} / POST ${b.vmPu} / model ${network.modelHash} / settings ${ctx.hybridResult?.identity.settingsHash??'manual AC'}`]});}
        for(const b of post.branches){const before=baseBranches.get(`${b.sourceClass}:${b.fid}`),metric=postBranchMetric(b,s.metric,s.side),previous=before?postBranchMetric(before,s.metric,s.side):null,ratingMatches=before&&before.from!==undefined&&before.to!==undefined&&before.from===b.from&&before.to===b.to&&before.loading.basis===b.loading.basis&&before.loading.season===b.loading.season&&before.loading.fromLimitA===b.loading.fromLimitA&&before.loading.toLimitA===b.loading.toLimitA&&before.loading.ratingMva===b.loading.ratingMva;
          const value=layer==='CHANGE'?(metric!==null&&previous!==null&&(!s.metric.includes('Loading')||ratingMatches)?metric-previous:null):layer==='NEW_CONSTRAINTS'&&!changes.some(c=>c.state==='NEW'&&c.sourceClass===b.sourceClass&&c.fid===b.fid&&c.metric==='postLoadingPercent')?null:metric;
          put(b.sourceClass,b.fid,{value,unit:s.metric.includes('Loading')?'%':s.metric==='postMva'?'MVA':['postQmvar','postQLossMvar'].includes(s.metric)?'Mvar':s.metric==='postCurrentA'?'A':s.metric==='postAngleDifferenceDeg'?'deg':s.metric==='postTapPosition'?'step':'MW',status:b.loading.reason||layer,details:[`${b.sourceClass}:${b.fid} / ${s.caseId} / ${layer} / BASE ${previous} / POST ${metric} / CHANGE ${value} / ${s.side??'FROM'}`,`Rating: ${JSON.stringify(b.loading)}`]});}
        if(layer==='CHANGE'){const values=[...data.branches.values(),...data.sites.values()].flatMap(v=>v.value===null?[]:[v.value]),abs=values.map(Math.abs).sort((a,b)=>a-b);data.scale={p95:abs[Math.max(0,Math.ceil(abs.length*.95)-1)]||1,min:values.length?Math.min(...values):0,max:values.length?Math.max(...values):0,unit:data.sites.values().next().value?.unit??''};}
      }else{const c=ctx.n1Result?.candidates.find(c=>{const e=[...network.lines,...network.transformers].find(e=>e.id===c.equipmentId&&e.sourceClass===c.sourceClass);return s.caseId===`N1:${c.sourceClass}:${e?.sourceId??c.equipmentId}`;}),outage=c?[...network.lines,...network.transformers].find(e=>e.id===c.equipmentId&&e.sourceClass===c.sourceClass):null;if(outage)data.outage={fid:outage.sourceId,sourceClass:outage.sourceClass};for(const b of c?.topImpacts||[]){const e=[...network.lines,...network.transformers].find(e=>e.id===b.equipmentId&&e.sourceClass===b.sourceClass),layer=s.n1Layer??'POST',p=s.metric==='postPmw',before=p?b.baseFlowMw:b.baseEstimatedLoadingPct,after=p?b.postFlowMw:b.postEstimatedLoadingPct,value=layer==='BASE'?before:layer==='CHANGE'?p?b.deltaPMw:before!=null&&after!=null?after-before:null:after;put(b.sourceClass,e?.sourceId??b.equipmentId,{value,unit:p?'MW':'%',status:'GA_DC_SCREEN',details:[`${b.sourceClass}:${b.equipmentId} · GA_DC_SCREEN · ${s.caseId} · ${layer} · P-only · recorded top impacts`]});}}
      return data;
    }
  }
  const table=ctx.benchmark?.groups[s.analysis].tables[s.table];if(!table)return {...data,enabled:false,reason:'NO_DATA'};
  const rows=canonicalRows(ctx,s);
  for(const r of rows){const value=s.source==='EXPLORATORY_DELTA'?r.diagnosticDelta??null:s.source==='DELTA'?r.delta:r.pf.value;
    const available=r.reason!=='NOT_RECORDED'&&r.pf.availability!=='INVALID'&&!r.pf.qualityFlags.includes('SENTINEL_CANDIDATE');
    put(r.sourceClass||'ElmTerm',r.fid,{value:available?value:null,unit:r.pf.unit,status:value===null?r.reason:r.status,details:[`${r.sourceClass}:${r.fid} · ${r.name} · PF ${r.pf.rawText||'—'} / GA ${r.ga??'—'} / signed Δ ${value??'—'} / |Δ| ${value===null?'—':Math.abs(value)} / Δ% ${value===null||r.pf.value===null||r.pf.value===0?'—':100*value/Math.abs(r.pf.value)} ${r.pf.unit}`,`${r.method} · ${r.status} · case ${r.caseId||'base'} / side ${r.side||s.side||'native metric endpoint'} / model ${network.modelHash} / scenario ${scenarioSignature(ctx.scenario.current)}`,`${r.pf.availability} · source ${r.pf.source.sheet}!${r.pf.source.column}${r.pf.source.row} · ${r.sourceCellKey}`,r.reason]});
  }
  if(['DELTA','EXPLORATORY_DELTA'].includes(s.source)){const values=rows.map(r=>s.source==='DELTA'?r.delta:r.diagnosticDelta).filter((v):v is number=>v!=null&&Number.isFinite(v)),abs=values.map(Math.abs).sort((a,b)=>a-b);data.scale={p95:abs.length?abs[Math.max(0,Math.ceil(.95*abs.length)-1)]||abs.at(-1)||1:1,min:values.length?Math.min(...values):0,max:values.length?Math.max(...values):0,unit:rows[0]?.pf.unit??''};}
  return data;
}
export function benchmarkLayerColor(value:BenchmarkMapValue|undefined,delta=false,scale=1):string{
  if(!value||value.value===null||!Number.isFinite(value.value))return '#708596';
  if(delta){if(value.value===0)return '#a6b7c0';const t=Math.min(1,Math.abs(value.value)/(scale>0?scale:1)),from=[166,183,192],to=value.value>0?[235,118,91]:[99,189,207];return '#'+from.map((v,i)=>Math.round(v+(to[i]-v)*t).toString(16).padStart(2,'0')).join('');}
  if(value.unit==='pu')return value.value<.9?'#df6c68':value.value>1.1?'#e8ae52':'#77bbac';
  const magnitude=Math.abs(value.value);return magnitude===0?'#a6b7c0':magnitude>100?'#e47d58':magnitude>30?'#d6af64':'#75bcc5';
}
