import type {BenchmarkMetricRow} from './comparison';
/** Exploratory statistics have their own names and never feed certified statistics. */
export function diagnosticStatistics(rows:readonly BenchmarkMetricRow[],dimension:'METRIC'|'VOLTAGE'|'YTM'='METRIC') {
  const unique=new Map<string,BenchmarkMetricRow>();for(const r of rows)unique.set(`${r.analysis}|${r.table}|${r.sourceCellKey??`${r.fid}|${r.side}`}|${r.metric}`,r);
  const groups=new Map<string,BenchmarkMetricRow[]>();for(const r of unique.values()){
    const key=[r.analysis,r.table,r.kind??r.sourceClass,r.metric,r.pf.unit,dimension==='VOLTAGE'?r.nominalKv??'UNKNOWN':dimension==='YTM'?r.ytm||'UNKNOWN':'ALL'].join('|');const group=groups.get(key)??[];group.push(r);groups.set(key,group);
  }
  return [...groups].map(([key,g])=>{
    const measured=g.filter(r=>r.delta===null&&r.diagnosticDelta!=null&&Number.isFinite(r.diagnosticDelta)),signed=measured.map(r=>r.diagnosticDelta!),abs=signed.map(Math.abs).sort((a,b)=>a-b),rel=measured.filter(r=>r.pf.value!==null&&r.pf.value!==0).map(r=>Math.abs(r.diagnosticDelta!/r.pf.value!)).sort((a,b)=>a-b);
    const quantile=(p:number)=>abs.length?abs[Math.max(0,Math.ceil(abs.length*p)-1)]:null,worst=measured.reduce<BenchmarkMetricRow|null>((a,b)=>!a||Math.abs(b.diagnosticDelta!)>Math.abs(a.diagnosticDelta!)?b:a,null);
    return {key,dimension,metric:g[0].metric,unit:g[0].pf.unit,kind:g[0].kind??g[0].sourceClass,nominalKv:dimension==='VOLTAGE'?g[0].nominalKv:null,ytm:dimension==='YTM'?g[0].ytm:null,nPF:g.filter(r=>r.pf.value!==null).length,nGA:g.filter(r=>r.ga!==null).length,nIdentityMatched:g.filter(r=>r.identityMatched).length,nDiagnostic:abs.length,nCertified:g.filter(r=>r.delta!==null).length,missingPF:g.filter(r=>r.pf.value===null).length,missingGA:g.filter(r=>r.ga===null).length,invalid:g.filter(r=>r.pf.availability==='INVALID').length,ratingExcluded:g.filter(r=>/rating|DENOMINATOR/i.test(r.reason)&&r.diagnosticDelta==null).length,methodExcluded:g.filter(r=>r.ga!==null&&r.delta===null).length,bias_diag:signed.length?signed.reduce((a,b)=>a+b,0)/signed.length:null,MAE_diag:abs.length?abs.reduce((a,b)=>a+b,0)/abs.length:null,RMSE_diag:abs.length?Math.sqrt(abs.reduce((a,b)=>a+b*b,0)/abs.length):null,P50_diag:quantile(.5),P95_diag:quantile(.95),P99_diag:quantile(.99),maxAbs_diag:abs.at(-1)??null,medianRelative_diag:rel.length?(rel[Math.floor((rel.length-1)/2)]+rel[Math.floor(rel.length/2)])/2:null,worstPrivateFid:worst?.fid??null,worstPrivateSide:worst?.side??null,status:abs.length?'EXPLORATORY_DELTA_METHOD_UNVERIFIED':'NOT_MEASURED'};
  });
}
