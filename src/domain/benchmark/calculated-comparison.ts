import type {HybridResult} from '../../analysis/contingency-hybrid';
import type {ScResult} from '../../analysis/short-circuit';
import {scenarioSignature,emptyScenario,type ScenarioOverlay} from '../scenario/overlay';
import {stableJson} from '../calculation/identity';
import type {AnalysisSettings} from '../calculation/analysis-settings';
import type {CanonicalNetwork} from '../model/network';
import type {BenchmarkPackage,RawTable} from './types';
import {rowObject} from './types';
import type {BenchmarkMetricRow} from './comparison';
export interface MetricOptions {diagnostic?:boolean;network?:CanonicalNetwork|null;scenario?:ScenarioOverlay;settings?:AnalysisSettings;hybrid?:HybridResult|null;sc?:ScResult|null;benchmark?:BenchmarkPackage|null}
const partitionCache=new WeakMap<BenchmarkPackage,{table:RawTable;byTerminal:Map<string,Record<string,string|number|null>[]>;members:Map<string,Set<string>>}>();
function pfPartition(benchmark:BenchmarkPackage){
  const table=benchmark.groups.SC.tables.SC_BusResults_Raw,cached=partitionCache.get(benchmark);if(cached?.table===table)return cached;
  const byTerminal=new Map<string,Record<string,string|number|null>[]>(),members=new Map<string,Set<string>>();
  for(const row of table.rows){const r=rowObject(table,row),fid=String(r.physicalTerminalFid??''),key=String(r.calculationBusKey||r.electricalBusKey||'');const group=byTerminal.get(fid)??[];group.push(r);byTerminal.set(fid,group);const set=members.get(key)??new Set<string>();set.add(fid);members.set(key,set);}
  const value={table,byTerminal,members};partitionCache.set(benchmark,value);return value;
}
/** Only matched native identities can acquire GA numbers; diagnostic differences never become parity. */
export function augmentCalculatedRow(r:BenchmarkMetricRow,raw:Record<string,string|number|null>,o:MetricOptions){
  const n=o.network,s=o.scenario;if(!n||!s||r.pf.value===null||r.pf.availability==='INVALID'||r.pf.qualityFlags.includes('SENTINEL_CANDIDATE'))return;
  // These packages describe the loaded base study. No native scenario-hash algorithm
  // equivalence has been supplied for an arbitrary edited overlay.
  if(scenarioSignature(s)!==scenarioSignature(emptyScenario()))return;
  if(r.analysis==='N1'&&r.table==='N1_RecordedExtrema_Raw'){
    const h=o.hybrid;if(!h||h.identity.modelHash!==n.modelHash||h.identity.scenarioHash!==scenarioSignature(s)||o.settings&&h.identity.settingsHash!==stableJson(o.settings))return;
    const c=h.cases.find(c=>c.outage.caseId===r.caseId&&c.outage.fid===raw.outageFid&&c.outage.sourceClass===raw.outageClass),v=c?.observations.filter(v=>v.fid===r.fid&&v.sourceClass===r.sourceClass&&v.metric===r.metric&&((v.side??'')===r.side));
    if(c&&!['AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION','PARTIAL_SOLUTION'].includes(c.status))return;
    if(v?.length===1&&v[0].value!==null){r.ga=v[0].value;r.identityMatched=true;r.method='PF_RECORDED_EXTREMA_ONLY; VERIFIED_FAMILY_ONLY / GA_FULL_AC';r.reason='PF case solved status and complete matrices unavailable';if(o.diagnostic){r.diagnosticDelta=r.ga-r.pf.value!;r.status='EXPLORATORY_DELTA_METHOD_UNVERIFIED';}}
  }
  if(r.analysis==='SC'&&['SC_BusResults_Raw','SC_CalculationBus_Raw'].includes(r.table)){
    const sc=o.sc;if(!sc||sc.identity.modelHash!==n.modelHash||sc.identity.scenarioHash!==scenarioSignature(s))return;
    const f=sc.faults.find(f=>f.physicalTerminalFids.includes(r.fid));if(!f||f.status!=='CALCULATED_NETWORK_APPROXIMATION'||f.nominalKv!==r.nominalKv)return;
    if(!o.benchmark)return;const indexed=pfPartition(o.benchmark),partition=f.physicalTerminalFids.flatMap(fid=>indexed.byTerminal.get(fid)??[]),keys=new Set(partition.map(row=>String(row.calculationBusKey||row.electricalBusKey||'')).filter(Boolean));
    const key=[...keys][0],declaredKey=String(raw.calculationBusKey||raw.electricalBusKey||''),complete=indexed.members.get(key);
    const nativeType=String(raw.faultType??''),mode=String(raw.calculateMode??'');
    if(keys.size!==1||partition.length!==f.physicalTerminalFids.length||complete?.size!==f.physicalTerminalFids.length||declaredKey!==key||!partition.every(p=>p.rfOhm===0&&p.xfOhm===0&&p.nominalKv===f.nominalKv&&p.calculateMode==='MAX'&&['3PH','3-Phase Short-Circuit'].includes(String(p.faultType)))||!['3PH','3-Phase Short-Circuit'].includes(nativeType)||mode!=='MAX'||sc.profile.rfOhm!==0||sc.profile.xfOhm!==0||raw.resultConflictFlag===1)return;
    const value=r.metric==='ikssKa'?f.ikssKa:r.metric==='skssMva'?f.skssMva:null;if(value===null)return;
    r.ga=value;r.identityMatched=true;r.method='GA_NETWORK_APPROXIMATION / PF_IEC60909_EDITION_UNVERIFIED';r.reason='MISSING_IEC_FACTOR_AND_EDITION; certified delta null';
    if(o.diagnostic){r.diagnosticDelta=value-r.pf.value!;r.status='EXPLORATORY_DELTA_METHOD_UNVERIFIED';}
  }
}
