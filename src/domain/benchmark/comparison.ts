import type { CanonicalNetwork } from '../model/network';
import type { CalculationResult } from '../results/types';
import { comparePowerFactoryReference, type PowerFactoryComparison, type MetricPair } from '../../analysis/validation/powerfactory-reference';
import { preflightPowerFactoryReference, type ReferencePreflight } from '../../analysis/validation/powerfactory-preflight';
import { benchmarkLfReference } from './reference';
import { readCell, rowObject, type BenchmarkPackage, type RawTable, type BenchmarkCell } from './types';

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
  const report=comparePowerFactoryReference(lf.reference,result,lf.context);
  const permitted=lf.status==='COMPATIBLE'&&['COMPATIBLE','COMPARABLE_PARTIAL'].includes(report.compatibility.status)&&result.identity.analysisType==='powerFlow'&&result.converged;
  if(!permitted){
    for(const row of report.rows)for(const pair of Object.values(row.metrics))if(pair){pair.comparable=false;pair.delta=null;pair.absoluteDelta=null;pair.deltaPercent=null;}
    report.metrics=[];report.voltageBands=[];
  }
  const status:ComparisonStatus=permitted?'COMPARABLE_PARTIAL':lf.status==='BLOCKED'?'BLOCKED':'EXPLORATORY_ONLY';
  return {status,reasons:[...lf.reasons,...report.compatibility.reasons],lf,comparison:report};
}
export interface BenchmarkMetricRow {analysis:'LF'|'N1'|'SC';table:string;sourceClass:string;fid:string;name:string;caseId:string;side:string;metric:string;pf:BenchmarkCell;ga:number|null;delta:number|null;absoluteDelta:number|null;deltaPercent:number|null;status:string;reason:string;method:string;ytm:string;tm:string;nominalKv:number|null}
export const METRICS:Record<string,Record<string,string>>={
  GA_Reference_Raw:{voltagePu:'pu',voltageKv:'kV',angleDeg:'deg',pFromMw:'MW',qFromMvar:'Mvar',pToMw:'MW',qToMvar:'Mvar',pHvMw:'MW',qHvMvar:'Mvar',pLvMw:'MW',qLvMvar:'Mvar',iFromA:'A',iToA:'A',loadingPercent:'%',pLossMw:'MW',qLossMvar:'Mvar',pResultMw:'MW',qResultMvar:'Mvar'},
  N1_Cases_Raw:{casePostMaxLoadingPercent:'%',casePostMinVoltagePu:'pu',casePostMaxVoltagePu:'pu'},
  N1_RecordedExtrema_Raw:{postLoadingPercent:'%',postPmw:'MW',postQmvar:'Mvar',postMva:'MVA'},
  SC_BusResults_Raw:{ikssKa:'kA',skssMva:'MVA',ipKa:'kA',ibKa:'kA',ithKa:'kA'},
  SC_CalculationBus_Raw:{ikssKa:'kA',skssMva:'MVA',ipKa:'kA',ibKa:'kA',ithKa:'kA'},
  SC_DeviceResults_Raw:{ikssKa:'kA',ipKa:'kA',ibKa:'kA',ithKa:'kA'},
};
export const lfMetricAlias:Record<string,string>={iFromA:'currentFromA',iToA:'currentToA',pResultMw:'pMw',qResultMvar:'qMvar'};
export function metricRows(table:RawTable,gate:BenchmarkPreflight,selectedMetric?:string):BenchmarkMetricRow[]{
  const units=METRICS[table.name]||{},matched=new Map<string,NonNullable<BenchmarkPreflight['comparison']>['rows'][number][]>();
  for(const row of gate.comparison?.rows||[]){const key=`${row.kind}|${row.powerFactoryFid}`,rows=matched.get(key)||[];rows.push(row);matched.set(key,rows);}
  const out:BenchmarkMetricRow[]=[];
  for(let i=0;i<table.rows.length;i++){
    const row=rowObject(table,table.rows[i]),fid=String(row.fid??row.physicalTerminalFid??row.representativePhysicalTerminalFid??row.elementFid??row.affectedFid??row.outageFid??''),kind=String(row.kind??'');
    // Empty fields are retained for the appropriate element family, without expanding every bus into branch metrics.
    const metrics=Object.entries(units).filter(([field])=>!selectedMetric||field===selectedMetric).filter(([field])=>table.analysis!=='LF'||kind==='bus'?table.analysis!=='LF'||['voltagePu','voltageKv','angleDeg'].includes(field):kind==='generator'?['pResultMw','qResultMvar'].includes(field):kind==='line'||kind==='transformer'? !['voltagePu','voltageKv','angleDeg','pResultMw','qResultMvar'].includes(field):false);
    const possible=matched.get(`${kind}|${fid}`),match=possible?.length===1?possible[0]:undefined;
    for(const [metric,unit] of metrics){
      const pf=readCell(table,i,metric,unit),pair=match?.metrics[(lfMetricAlias[metric]||metric) as keyof typeof match.metrics] as MetricPair|undefined;
      const available=row.resultAvailable==null||![0,'0',false].includes(row.resultAvailable as never);
      const allowed=table.analysis==='LF'&&gate.status==='COMPARABLE_PARTIAL'&&match?.status==='MATCHED'&&match.matchMethod!=='EXACT_NAME'&&!!pair?.comparable&&available&&pf.value!==null&&pair.powerFactory===pf.value;
      const reason=table.analysis==='N1'?'NOT_COMPARABLE_PF_MISSING: PF case method/status/post-results unverified':table.analysis==='SC'?'PF_REFERENCE_ONLY: independent IEC method parity unavailable':!available?'NOT_RECORDED':!match?'UNMATCHED_OR_AMBIGUOUS':!allowed?pair?.semantics||gate.reasons.join('; ')||'METHOD_MISMATCH':'';
      out.push({analysis:table.analysis,table:table.name,sourceClass:String(row.sourceClass??row.elementClass??row.outageClass??(table.analysis==='SC'?'ElmTerm':'')),fid,name:String(row.name??row.physicalTerminalName??row.elementName??row.outageName??row.caseName??''),caseId:String(row.caseId??''),side:String(row.side??''),metric,pf,ga:available?pair?.gridAnalyzer??null:null,delta:allowed?pair!.delta:null,absoluteDelta:allowed?pair!.absoluteDelta:null,deltaPercent:allowed?pair!.deltaPercent:null,status:allowed?'COMPARABLE_PARTIAL':pf.availability==='NOT_RECORDED'?'NOT_RECORDED':table.analysis==='SC'?'PF_REFERENCE_ONLY':table.analysis==='N1'?'PF_RECORDED_EXTREMA':'NOT_COMPARABLE',reason,method:table.analysis==='LF'?'AC_BALANCED':table.analysis==='N1'?'PF_RECORDED_EXTREMA':'PF_IEC60909_3PH_MAX',ytm:String(row.ytmName??row.outageYtm??''),tm:String(row.substationName??row.siteName??''),nominalKv:typeof row.nominalKv==='number'?row.nominalKv:typeof row.voltageLevelKv==='number'?row.voltageLevelKv:null});
    }
  }
  return out;
}
export function metricStatistics(rows:readonly BenchmarkMetricRow[]){
  const groups=new Map<string,BenchmarkMetricRow[]>();for(const row of rows){const key=`${row.analysis}|${row.metric}|${row.pf.unit}`,group=groups.get(key)||[];group.push(row);groups.set(key,group);}
  return [...groups].map(([metric,group])=>{const errors=group.filter(r=>r.delta!==null).map(r=>Math.abs(r.delta!)).sort((a,b)=>a-b);return {metric,sourceCount:group.length,matched:errors.length,missingPF:group.filter(r=>r.pf.value===null).length,missingGA:group.filter(r=>r.ga===null).length,excludedMethod:group.filter(r=>r.pf.value!==null&&r.ga!==null&&r.delta===null&&r.metric!=='loadingPercent').length,excludedRating:group.filter(r=>r.metric==='loadingPercent'&&r.delta===null).length,mae:errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null,p95:errors.length?errors[Math.min(errors.length-1,Math.ceil(errors.length*.95)-1)]:null,maxAbsDelta:errors.length?errors.at(-1)!:null,unit:group[0].pf.unit,status:errors.length?'COMPARABLE_PARTIAL':'NOT_COMPARABLE'};});
}
