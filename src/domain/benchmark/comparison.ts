import type { CanonicalNetwork } from '../model/network';
import type { CalculationResult } from '../results/types';
import { comparePowerFactoryReference, type PowerFactoryComparison, type MetricPair } from '../../analysis/validation/powerfactory-reference';
import { preflightPowerFactoryReference, type ReferencePreflight } from '../../analysis/validation/powerfactory-preflight';
import { benchmarkLfReference } from './reference';
import { readCell, rowObject, type BenchmarkPackage, type RawTable, type BenchmarkCell } from './types';
import {augmentCalculatedRow,type MetricOptions} from './calculated-comparison';
export type {MetricOptions} from './calculated-comparison';

export type ComparisonStatus='COMPARABLE_FULL'|'COMPARABLE_PARTIAL'|'EXPLORATORY_ONLY'|'NOT_COMPARABLE'|'BLOCKED';
export interface BenchmarkPreflight {status:ComparisonStatus;reasons:string[];lf:ReferencePreflight|null;comparison:PowerFactoryComparison|null}
/** Identity + topology + method gates. A different hash algorithm never proves equality. */
export function preflightBenchmark(b:BenchmarkPackage,n:CanonicalNetwork|null,result:CalculationResult|null,controlFile?:string|null):BenchmarkPreflight{
  if(!n)return {status:'NOT_COMPARABLE',reasons:['MODEL_NOT_LOADED'],lf:null,comparison:null};
  const id=b.groups.LF.identity;
  if((n.studyCase||n.name.replace(/\.(json|zip)$/i,''))!==id.studyCase)return {status:'BLOCKED',reasons:['MODEL_STUDY_CASE_MISMATCH'],lf:null,comparison:null};
  if(id.effectiveMethod!=='AC_BALANCED'||id.methodVerificationStatus!=='VERIFIED_EXACT')return {status:'NOT_COMPARABLE',reasons:['LF_METHOD_UNVERIFIED'],lf:null,comparison:null};
  const lf=preflightPowerFactoryReference(benchmarkLfReference(b),n,result,controlFile);
  if(!result)return {status:'NOT_COMPARABLE',reasons:['GA_NOT_CALCULATED',...lf.reasons],lf,comparison:null};
  // Exporter structural hashes and GA byte/scenario hashes have different algorithms.
  // Only the independently verified full terminal partition and branch endpoint gate
  // can issue GA comparison identities. Original exporter hashes stay in b.identity.
  const verifiedReference=lf.status==='COMPATIBLE'?{...lf.reference,metadata:{...lf.reference.metadata,modelHash:lf.context.modelHash,scenarioHash:lf.context.scenarioHash}}:lf.reference;
  const report=comparePowerFactoryReference(verifiedReference,result,lf.context);
  const permitted=lf.status==='COMPATIBLE'&&['COMPATIBLE','COMPARABLE_PARTIAL'].includes(report.compatibility.status)&&result.identity.analysisType==='powerFlow'&&result.converged;
  if(!permitted){
    for(const row of report.rows)for(const pair of Object.values(row.metrics))if(pair){pair.comparable=false;pair.delta=null;pair.absoluteDelta=null;pair.deltaPercent=null;}
    report.metrics=[];report.voltageBands=[];
  }
  const status:ComparisonStatus=permitted?'COMPARABLE_PARTIAL':lf.status==='BLOCKED'?'BLOCKED':'EXPLORATORY_ONLY';
  return {status,reasons:[...lf.reasons,...report.compatibility.reasons],lf,comparison:report};
}
export interface BenchmarkMetricRow {analysis:'LF'|'N1'|'SC';table:string;sourceClass:string;fid:string;name:string;caseId:string;side:string;metric:string;pf:BenchmarkCell;ga:number|null;delta:number|null;absoluteDelta:number|null;deltaPercent:number|null;diagnosticDelta?:number|null;identityMatched?:boolean;sourceCellKey?:string;status:string;reason:string;method:string;ytm:string;tm:string;nominalKv:number|null}
export const METRICS:Record<string,Record<string,string>>={
  GA_Reference_Raw:{voltagePu:'pu',voltageKv:'kV',angleDeg:'deg',pFromMw:'MW',qFromMvar:'Mvar',sFromMva:'MVA',pToMw:'MW',qToMvar:'Mvar',sToMva:'MVA',pHvMw:'MW',qHvMvar:'Mvar',sHvMva:'MVA',pLvMw:'MW',qLvMvar:'Mvar',sLvMva:'MVA',iFromA:'A',iToA:'A',loadingPercent:'%',pLossMw:'MW',qLossMvar:'Mvar',pResultMw:'MW',qResultMvar:'Mvar'},
  N1_Cases_Raw:{casePostMaxLoadingPercent:'%',casePostMinVoltagePu:'pu',casePostMaxVoltagePu:'pu'},
  N1_RecordedExtrema_Raw:{postLoadingPercent:'%',postPmw:'MW',postQmvar:'Mvar',postMva:'MVA',postVoltagePu:'pu'},
  SC_BusResults_Raw:{ikssKa:'kA',skssMva:'MVA',ipKa:'kA',ibKa:'kA',ithKa:'kA'},
  SC_CalculationBus_Raw:{ikssKa:'kA',skssMva:'MVA',ipKa:'kA',ibKa:'kA',ithKa:'kA'},
  SC_DeviceResults_Raw:{ikssKa:'kA',ipKa:'kA',ibKa:'kA',ithKa:'kA'},
};
export const lfMetricAlias:Record<string,string>={iFromA:'currentFromA',iToA:'currentToA',pResultMw:'pMw',qResultMvar:'qMvar',angleDeg:'alignedAngleDeg'};
export function metricRows(table:RawTable,gate:BenchmarkPreflight,selectedMetric?:string,options:MetricOptions={}):BenchmarkMetricRow[]{
  const units=METRICS[table.name]||{},matched=new Map<string,NonNullable<BenchmarkPreflight['comparison']>['rows'][number][]>();
  const referenceByKey=new Map<string,NonNullable<BenchmarkPreflight['lf']>['reference']['records']>();
  for(const r of gate.lf?.reference.records??[])for(const fid of new Set([r.fid,...r.fids??[],...r.physicalTerminalFids??[]].filter(Boolean))){const key=`${r.kind}|${fid}`,group=referenceByKey.get(key)??[];group.push(r);referenceByKey.set(key,group);}
  for(const row of gate.comparison?.rows||[]){const key=`${row.kind}|${row.powerFactoryFid}`,rows=matched.get(key)||[];rows.push(row);matched.set(key,rows);}
  const out:BenchmarkMetricRow[]=[];
  for(let i=0;i<table.rows.length;i++){
    const row=rowObject(table,table.rows[i]),fid=String(row.fid??row.physicalTerminalFid??row.representativePhysicalTerminalFid??row.elementFid??row.affectedFid??row.outageFid??''),kind=String(row.kind??'');
    // Empty fields are retained for the appropriate element family, without expanding every bus into branch metrics.
    const metrics=Object.entries(units).filter(([field])=>!selectedMetric||field===selectedMetric).filter(([field])=>table.analysis!=='LF'||kind==='bus'?table.analysis!=='LF'||['voltagePu','voltageKv','angleDeg'].includes(field):kind==='generator'?['pResultMw','qResultMvar'].includes(field):kind==='line'||kind==='transformer'? !['voltagePu','voltageKv','angleDeg','pResultMw','qResultMvar'].includes(field):false);
    const possible=matched.get(`${kind}|${fid}`),match=possible?.length===1?possible[0]:undefined;
    for(const [metric,unit] of metrics){
      let pf=readCell(table,i,metric,unit),pair=match?.metrics[(lfMetricAlias[metric]||metric) as keyof typeof match.metrics] as MetricPair|undefined;
      const apparent=/^s(From|To|Hv|Lv)Mva$/.exec(metric);
      if(table.analysis==='LF'&&apparent){
        const pName=`p${apparent[1]}Mw`,qName=`q${apparent[1]}Mvar`,p=readCell(table,i,pName,'MW'),q=readCell(table,i,qName,'Mvar'),pm=match?.metrics[pName as keyof typeof match.metrics] as MetricPair|undefined,qm=match?.metrics[qName as keyof typeof match.metrics] as MetricPair|undefined;
        const value=p.value!==null&&q.value!==null?Math.hypot(p.value,q.value):null;
        pf={...p,value,unit:'MVA',rawText:value===null?'':`hypot(${p.rawText}, ${q.rawText})`,availability:value===null?'NOT_RECORDED':value===0?'RECORDED_NUMERIC_ZERO':'RECORDED',qualityFlags:[...p.qualityFlags,...q.qualityFlags,`DERIVED_FROM_P_Q:${p.source.column},${q.source.column}`]};
        if(pm&&qm&&pm.gridAnalyzer!==null&&qm.gridAnalyzer!==null&&value!==null){const ga=Math.hypot(pm.gridAnalyzer,qm.gridAnalyzer),delta=ga-value;pair={...pm,unit:'MVA',powerFactory:value,gridAnalyzer:ga,comparable:pm.comparable&&qm.comparable,delta,absoluteDelta:Math.abs(delta),deltaPercent:value===0?null:100*delta/Math.abs(value)};}
      }
      const available=row.resultAvailable==null||![0,'0',false].includes(row.resultAvailable as never);
      const sentinel=pf.qualityFlags.includes('SENTINEL_CANDIDATE');
      // Native field provenance + full partition/endpoint preflight issue this mapping.
      // Numeric coincidence never establishes source-cell identity.
      const refs=referenceByKey.get(`${kind}|${fid}`)??[];
      const provenance=refs.length===1&&!refs[0].conflictedMetrics?.includes((lfMetricAlias[metric]||metric) as never)&&!!pair&&pair.powerFactory!==null&&match?.status==='MATCHED'&&match.matchMethod!=='EXACT_NAME'&&gate.lf?.status==='COMPATIBLE'&&pair.unit.toLowerCase()===unit.toLowerCase();
      const allowed=table.analysis==='LF'&&gate.status==='COMPARABLE_PARTIAL'&&provenance&&!!pair?.comparable&&available&&!sentinel&&pf.value!==null;
      const reason=table.analysis==='N1'?'NOT_COMPARABLE_PF_MISSING: PF case method/status/post-results unverified':table.analysis==='SC'?'PF_REFERENCE_ONLY: independent IEC method parity unavailable':!available?'NOT_RECORDED':sentinel?'SENTINEL_SEMANTICS_UNVERIFIED':!match?possible&&possible.length>1?'AMBIGUOUS':'UNMATCHED_OR_AMBIGUOUS':!allowed?[...(gate.status!=='COMPARABLE_PARTIAL'?gate.reasons:[]),pair?.semantics||'METRIC_OR_METHOD_UNVERIFIED'].join('; '):'';
      const r:BenchmarkMetricRow={analysis:table.analysis,table:table.name,sourceClass:String(row.sourceClass??row.affectedClass??row.elementClass??row.outageClass??(table.analysis==='SC'?'ElmTerm':'')),fid,name:String(row.name??row.physicalTerminalName??row.elementName??row.outageName??row.caseName??''),caseId:String(row.caseId??''),side:String(row.side??row.postPowerEndpoint??''),metric,pf,ga:available?pair?.gridAnalyzer??null:null,delta:allowed?pair!.delta:null,absoluteDelta:allowed?pair!.absoluteDelta:null,deltaPercent:allowed?pair!.deltaPercent:null,status:allowed?'COMPARABLE_PARTIAL':pf.availability==='NOT_RECORDED'?'NOT_RECORDED':table.analysis==='SC'?'PF_REFERENCE_ONLY':table.analysis==='N1'?'PF_RECORDED_EXTREMA':'NOT_COMPARABLE',reason,method:table.analysis==='LF'?'AC_BALANCED':table.analysis==='N1'?'PF_RECORDED_EXTREMA':'PF_IEC60909_3PH_MAX',ytm:String(row.ytmName??row.outageYtm??''),tm:String(row.substationName??row.siteName??''),nominalKv:typeof row.nominalKv==='number'?row.nominalKv:typeof row.voltageLevelKv==='number'?row.voltageLevelKv:null,diagnosticDelta:null,identityMatched:table.analysis==='LF'&&!!provenance,sourceCellKey:`${pf.source.fileSha256}|${pf.source.sheet}|${pf.source.row}|${pf.source.column}|${kind}|${fid}`};
      if(table.analysis==='LF'&&options.diagnostic&&provenance&&gate.status==='EXPLORATORY_ONLY'&&available&&!sentinel&&pf.value!==null&&r.ga!==null&&!/^excluded:/.test(pair?.semantics??'')){r.diagnosticDelta=r.ga-pf.value;r.status='EXPLORATORY_DELTA_METHOD_UNVERIFIED';}
      augmentCalculatedRow(r,row,options);out.push(r);
    }
  }
  return out;
}
export function metricStatistics(rows:readonly BenchmarkMetricRow[]){
  const groups=new Map<string,BenchmarkMetricRow[]>();for(const row of rows){const key=`${row.analysis}|${row.table}|${row.metric}|${row.pf.unit}`,group=groups.get(key)||[];group.push(row);groups.set(key,group);}
  return [...groups].map(([metric,group])=>{const errors=group.filter(r=>r.delta!==null).map(r=>Math.abs(r.delta!)).sort((a,b)=>a-b);const q=(p:number)=>errors.length?errors[Math.min(errors.length-1,Math.ceil(errors.length*p)-1)]:null;const verified=group.filter(r=>r.delta!==null);const relative=verified.filter(r=>r.pf.value!==0).map(r=>Math.abs(r.delta!/r.pf.value!)).sort((a,b)=>a-b);return {nPF:group.filter(r=>r.pf.value!==null).length,nGA:group.filter(r=>r.ga!==null).length,nIdentityMatched:group.filter(r=>r.identityMatched).length,nMethodComparable:errors.length,nIECSubset:0,nMissingPF:group.filter(r=>r.pf.value===null).length,nMissingGA:group.filter(r=>r.ga===null).length,nInvalid:group.filter(r=>r.pf.availability==='INVALID').length,nExcludedMethod:group.filter(r=>r.ga!==null&&r.delta===null).length,nExcludedRating:group.filter(r=>/excluded: endpoint rated-current/.test(r.reason)).length,nUnattributed:group.filter(r=>r.analysis==='SC'&&r.table==='SC_DeviceResults_Raw').length,rmse:errors.length?Math.sqrt(errors.reduce((s,v)=>s+v*v,0)/errors.length):null,p50:q(.5),p99:q(.99),medianRelative:relative.length?(relative[Math.floor((relative.length-1)/2)]+relative[Math.floor(relative.length/2)])/2:null,worstFid:verified.sort((a,b)=>Math.abs(b.delta!)-Math.abs(a.delta!))[0]?.fid??null,metric,sourceCount:group.length,matched:errors.length,missingPF:group.filter(r=>r.pf.value===null).length,missingGA:group.filter(r=>r.ga===null).length,ambiguous:group.filter(r=>r.reason==='AMBIGUOUS').length,excludedMethod:group.filter(r=>r.pf.value!==null&&r.ga!==null&&r.delta===null&&!/^excluded: endpoint rated-current/.test(r.reason)).length,excludedRating:group.filter(r=>r.metric==='loadingPercent'&&r.delta===null&&/excluded: endpoint rated-current/.test(r.reason)).length,mae:errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null,p95:errors.length?errors[Math.min(errors.length-1,Math.ceil(errors.length*.95)-1)]:null,maxAbsDelta:errors.length?errors.at(-1)!:null,unit:group[0].pf.unit,status:errors.length?'COMPARABLE_PARTIAL':'NOT_COMPARABLE'};});
}
