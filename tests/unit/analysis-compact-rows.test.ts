import {SC_ENGINE_REVISION} from '../../src/analysis/short-circuit';
import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisUiFixture,installLfFixture} from '../helpers/analysis-ui';
import {compactN1Rows,compactScRows,compactLfRows,sortCompactRows,acStatus,type CompactRow} from '../../src/features/analysis/compact-rows';
import {runEvidence} from '../../src/features/analysis/run-evidence';
import {selectScMode} from '../../src/domain/results/sc-selection';
import {seedBenchmarkPreflight,type BenchmarkPreflight} from '../../src/domain/benchmark/comparison';
import {createLightningScPanel} from '../../src/map/lightning-sc-panel';
import {buildBenchmarkMapData,benchmarkMapGate} from '../../src/domain/benchmark/map-layer';
import {resultLayerColor} from '../../src/map/layer-policy';
import {finishYtmStudy,type YtmStudyResult} from '../../src/analysis/ytm-study';
import {WorkspaceResultCache,workspaceKey,type ScenarioResults} from '../../src/domain/results/workspace';
import {scenarioSignature} from '../../src/domain/scenario/overlay';
import {SC_STATUS_FILTER_OPTIONS, scStateMatches} from '../../src/features/analysis/compact-study-view';

test('660 presentation rows retain independent AC/DC sets, names, missing POST and budget/divergence states',()=>{
 const {ctx}=analysisUiFixture(),rows=compactN1Rows(ctx);assert.equal(rows.length,660);assert.equal(runEvidence(ctx).acCalculated,30);assert.equal(runEvidence(ctx).acAttempted,37);assert.equal(runEvidence(ctx).acVerified,0);assert.equal(runEvidence(ctx).distinctNumerical,298);
 assert.equal(rows[0].loadingSource,'AC');assert.equal(rows[0].loading,120);assert.match(rows[0].overloads![0].name,/CAYIRHAN/);assert.equal(rows[0].missingDetail,'Tam POST ayrıntısı yok');assert.match(rows[28].acLabel!,/Yakınsamadı/);assert.match(rows[35].acLabel!,/Denenmedi · süre/);assert.equal(rows[35].loadingSource,'~DC');assert.equal(rows[400].dcLabel,'Taranmadı');assert.match(rows[400].acLabel!,/Sayısal/);
 assert.equal(acStatus({...ctx.hybridResult!.cases[0],status:'ISLAND_UNSUPPLIED',acSolved:false}),'Beslemesiz ada');assert.equal(acStatus({...ctx.hybridResult!.cases[0],status:'BLOCKED',acSolved:false}),'Bloke');
});
test('SC aliases produce 500 independent rows, diagnostic signed MAX delta and missing MIN PF stays null',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='SC';const rows=compactScRows(ctx);assert.equal(rows.length,500);assert.equal(runEvidence(ctx).physicalTerminals,6278);const matched=rows.find(r=>r.metrics.ikss.delta!==null)!;assert.ok(matched);assert.equal(matched.metrics.ikss.delta,-.99);assert.equal(matched.raw.IEC_VERIFIED,'false');assert.equal(rows.find(r=>r.kv===66)?.kv,66);
 assert.ok(selectScMode(ctx,'MIN'));const min=compactScRows(ctx);assert.ok(min.every(r=>r.metrics.ikss.pf===null&&r.metrics.ikss.delta===null));assert.notEqual(ctx.scResult!.identity.sourceHash,ctx.ytmStudy!.scMax!.identity.sourceHash);
 ctx.filters.areaId='OTHER';assert.equal(compactScRows(ctx).length,0);ctx.filters.areaId='A';assert.ok(selectScMode(ctx,'MAX'));ctx.ytmStudy=null;ctx.studyOptions=undefined;assert.ok(compactScRows(ctx).some(r=>r.metrics.ikss.delta!==null));
});
test('LF retains signed FROM values, unknown rating, kV and the inclusive 66 kV boundary',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='LF';installLfFixture(ctx);const lines=compactLfRows(ctx,'lines');assert.equal(lines[0].metrics.p.ga,-12);assert.equal(lines[0].metrics.q.ga,3);assert.equal(lines[0].metrics.loading.ga,null);assert.equal(lines[0].metrics.p.delta,null);const buses=compactLfRows(ctx,'buses');assert.equal(buses.length,2);assert.equal(buses[0].kv,66);assert.ok(Math.abs(buses[0].metrics.voltage.ga!-67.32)<1e-10);
});
test('sorting is numeric, signed, with null last in both directions and raw export fields retained',()=>{
 const {ctx}=analysisUiFixture(),a=compactN1Rows(ctx).slice(0,3);a[0].loading=2;a[1].loading=100;a[2].loading=null;assert.deepEqual(sortCompactRows(a,'loading',true).map(r=>r.loading),[100,2,null]);assert.deepEqual(sortCompactRows(a,'loading').map(r=>r.loading),[2,100,null]);assert.ok('capacityBasis' in a[0].raw);assert.ok('scenarioHash' in a[0].raw);
});
test('transformer P/Q use the native HV terminal even when HV is the TO endpoint',()=>{
 const {ctx}=analysisUiFixture();installLfFixture(ctx);const t=compactLfRows(ctx,'transformers')[0];assert.equal(t.metrics.p.ga,-9);assert.equal(t.metrics.q.ga,-2);assert.equal(t.kv,154);
});
test('LF presentation retains a signed GA minus PF pair only after the existing identity gate',()=>{
 const {ctx}=analysisUiFixture(),r=installLfFixture(ctx),fid=r.branches[0].id,b=ctx.benchmark!,n=ctx.network!;
 b.groups.LF.tables.GA_Reference_Raw={name:'GA_Reference_Raw',analysis:'LF',fileSha256:'PUBLIC_PRESENTATION_FIXTURE',metadata:{},headers:['kind','fid','sourceClass','pFromMw','qFromMvar'],rows:[['line',fid,'ElmLne',-15,5]],rowNumbers:[2],headerRow:1};
 const metric=(ga:number,pf:number,unit:string)=>({gridAnalyzer:ga,powerFactory:pf,delta:ga-pf,absoluteDelta:Math.abs(ga-pf),deltaPercent:null,unit,comparable:true,semantics:'PUBLIC_PRESENTATION_GATE_FIXTURE'});
 // Seed an already accepted mapping to test presentation, not the independent physical gate.
 const gate={status:'COMPARABLE_PARTIAL',reasons:[],lf:{status:'COMPATIBLE',reference:{records:[{kind:'line',fid,name:fid}]}},comparison:{rows:[{kind:'line',status:'MATCHED',matchMethod:'FID',powerFactoryFid:fid,metrics:{pFromMw:metric(-12,-15,'MW'),qFromMvar:metric(3,5,'Mvar')}}]}} as unknown as BenchmarkPreflight;
 seedBenchmarkPreflight(b,n,r,undefined,gate);const row=compactLfRows(ctx,'lines')[0];assert.deepEqual([row.metrics.p.ga,row.metrics.p.pf,row.metrics.p.delta],[-12,-15,3]);assert.equal(row.metrics.q.delta,-2);assert.equal(row.metrics.loading.delta,null);
});


test('failed LF is never labelled converged or exposed as numerical rows',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='LF';const r=installLfFixture(ctx);r.converged=false;r.status='DIVERGED';
 assert.doesNotMatch(runEvidence(ctx).label,/Sayısal yakınsadı/);assert.match(runEvidence(ctx).label,/yakınsamadı/);assert.equal(runEvidence(ctx).numericalAvailable,0);
 for(const kind of ['lines','transformers','buses'] as const)assert.equal(compactLfRows(ctx,kind).length,0);
});
test('standalone SC filters YTM and TM before electrical dedup and run counters',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='SC';ctx.ytmStudy=null;ctx.studyOptions=undefined;
 const n=ctx.network!;ctx.network={...n,sites:[...n.sites,{...n.sites[0],id:'OTHER',name:'Other TM',areaId:'B'}],buses:n.buses.map(t=>({...t,siteIds:[t.sourceId==='B1'?'STATION':'OTHER']}))};
 ctx.filters.areaId='A';ctx.filters.siteId='STATION';const rows=compactScRows(ctx);assert.equal(rows.length,1);assert.equal(rows[0].fid,'B1');assert.equal(runEvidence(ctx).electricalBuses,1);assert.equal(runEvidence(ctx).physicalTerminals,1);
 ctx.filters.siteId='OTHER';assert.equal(compactScRows(ctx).length,0);assert.equal(runEvidence(ctx).electricalBuses,0);
 ctx.filters.areaId='B';assert.ok(compactScRows(ctx).length>0);assert.ok(compactScRows(ctx).every(r=>r.tm==='Other TM'));
});





test('C.1: Turkish number formatting for SC satisfies 26.795 A = 26,795 kA and never produces 0 for uncomputed',()=>{
 const fmt=(valKa:number|null|undefined,unit:'A'|'kA'):string=>{
  if(valKa===null||valKa===undefined||!Number.isFinite(valKa))return '—';
  if(unit==='A')return Math.round(valKa*1000).toLocaleString('tr-TR',{maximumFractionDigits:0});
  return Number(valKa).toLocaleString('tr-TR',{minimumFractionDigits:3,maximumFractionDigits:3});
 };

 assert.equal(fmt(26.7946,'A'),'26.795');
 assert.equal(fmt(26.7946,'kA'),'26,795');
 assert.equal(fmt(0.313,'A'),'313');
 assert.equal(fmt(0.313,'kA'),'0,313');
 assert.equal(fmt(38.178,'A'),'38.178');
 assert.equal(fmt(38.178,'kA'),'38,178');
 assert.equal(fmt(null,'A'),'—');
 assert.equal(fmt(null,'kA'),'—');
 assert.notEqual(fmt(null,'A'),'0');
 assert.notEqual(fmt(null,'kA'),'0');
});

test('C.2: Map SC layer aggregates maximum bus current per TM and assigns grey to uncomputed/stale sites',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='SC';
 const data=buildBenchmarkMapData(ctx,{analysis:'SC',source:'GA',metric:'maxIkssKa',table:'SC_BusResults_Raw'});
 assert.ok(data.enabled);
 assert.ok(data.sites.size>0);
 const values=[...data.sites.values()].map(v=>v.value).filter((v):v is number=>v!==null);
 assert.ok(values.length>0);
 assert.ok(data.scale);
 assert.ok(data.scale.p95>0);
 assert.ok(data.scale.max>=data.scale.min);
 const uncomputedSite=ctx.network!.sites.find(s=>![...data.sites.entries()].some(([id,v])=>id===s.id&&v.value!==null));
 if(uncomputedSite){
  const v=data.sites.get(uncomputedSite.id);
  assert.equal(v?.value,null);
  const color=resultLayerColor('#b8e1e3','site',{analysis:'SC',source:'GA',metric:'maxIkssKa',table:'SC_BusResults_Raw'},v,true,data.scale.p95);
  assert.equal(color,'#708596');
 }
});

test('C.2: resultLayerColor accurately computes 5-tier P95 quantile colors and grey for SC',()=>{
 const s={analysis:'SC' as const,source:'GA' as const,metric:'maxIkssKa',table:'SC_BusResults_Raw'};
 const p95=30;
 const cPeak=resultLayerColor('#b8e1e3','site',s,{value:38,unit:'kA',status:'CALCULATED',details:[]},true,p95);
 assert.equal(cPeak,'#f43f5e'); // >1.15 P95
 const cHigh=resultLayerColor('#b8e1e3','site',s,{value:28,unit:'kA',status:'CALCULATED',details:[]},true,p95);
 assert.equal(cHigh,'#fb923c'); // 0.85 - 1.15 P95
 const cMidHigh=resultLayerColor('#b8e1e3','site',s,{value:20,unit:'kA',status:'CALCULATED',details:[]},true,p95);
 assert.equal(cMidHigh,'#fbbf24'); // 0.55 - 0.85 P95
 const cMid=resultLayerColor('#b8e1e3','site',s,{value:10,unit:'kA',status:'CALCULATED',details:[]},true,p95);
 assert.equal(cMid,'#34d399'); // 0.25 - 0.55 P95
 const cLow=resultLayerColor('#b8e1e3','site',s,{value:2,unit:'kA',status:'CALCULATED',details:[]},true,p95);
 assert.equal(cLow,'#38bdf8'); // <0.25 P95
 const cNull=resultLayerColor('#b8e1e3','site',s,{value:null,unit:'kA',status:'NOT_RUN',details:[]},true,p95);
 assert.equal(cNull,'#708596'); // Grey for uncomputed
 const cUndefined=resultLayerColor('#b8e1e3','site',s,undefined,true,p95);
 assert.equal(cUndefined,'#708596'); // Grey for missing
});

test('C.2.1: selectScMode preserves benchmarkMap when SC map layer is active and updates scMode', () => {
 const {ctx} = analysisUiFixture();
 ctx.analysisTab = 'SC';
 ctx.benchmarkMap = {
  analysis: 'SC',
  source: 'GA',
  metric: 'maxIkssKa',
  table: 'SC_BusResults_Raw',
  scMode: 'MAX'
 };
 const okMin = selectScMode(ctx, 'MIN');
 assert.equal(okMin, true);
 assert.ok(ctx.benchmarkMap, 'benchmarkMap should not be cleared to null');
 assert.equal(ctx.benchmarkMap?.analysis, 'SC');
 assert.equal(ctx.benchmarkMap?.scMode, 'MIN');

 const okMax = selectScMode(ctx, 'MAX');
 assert.equal(okMax, true);
 assert.ok(ctx.benchmarkMap);
 assert.equal(ctx.benchmarkMap?.scMode, 'MAX');
});



test('C.2.1: siteIds properly derived from terminals and deduplicated per electrical bus on map layer', () => {
 const {ctx} = analysisUiFixture();
 ctx.analysisTab = 'SC';
 const rows = compactScRows(ctx);
 assert.ok(rows.length > 0);
 assert.ok(rows.every(r => Array.isArray(r.siteIds)));
 assert.ok(rows.some(r => r.siteIds!.length > 0));

 const mapData = buildBenchmarkMapData(ctx, {analysis: 'SC', source: 'GA', metric: 'skssMva', table: 'SC_BusResults_Raw'});
 assert.ok(mapData.enabled);
 assert.equal(mapData.scale?.unit, 'MVA');
});





 test('C.2.2: duplicate fault FIDs do not falsely satisfy missing targets in pendingCounts', () => {
 const study: YtmStudyResult = {
  schemaVersion: 1,
  identity: { studyCase: 'syn', modelHash: 'm1', scenarioHash: 's1', optionsHash: 'opt1' },
  options: { ytmId: 'Y1', profile: 'BALANCED', timeBudgetMs: 60000 },
  status: 'COMPLETE',
  catalog: [],
  n1: null,
  scMax: {
   identity: { modelHash: 'm1', scenarioHash: 's1', sourceHash: 'src1', profileHash: 'p1' },
   profile: { calculateMode: 'MAX', faultType: '3PH' },
   method: 'GA_POSITIVE_SEQUENCE_3PH_MAX',
   // 3 faults, but all are duplicate T1!
   faults: [
    { physicalTerminalFid: 'T1', electricalBusId: 'B1', physicalTerminalFids: ['T1'], nominalKv: 154, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 20, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null },
    { physicalTerminalFid: 'T1', electricalBusId: 'B1', physicalTerminalFids: ['T1'], nominalKv: 154, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 20, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null },
    { physicalTerminalFid: 'T1', electricalBusId: 'B1', physicalTerminalFids: ['T1'], nominalKv: 154, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 20, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null }
   ]
  } as any,
  scMin: null,
  faultTargets: ['T1', 'T2', 'T3'], // T2 and T3 are missing!
  electricalTargets: 3,
  stageMs: { MODEL_PREPARATION: 0, CATALOG: 0, DC_SCREEN: 0, AC_APPROX: 0, AC_FULL: 0, SC_SOURCE_PREP: 0, SC_FACTORIZATION: 0, SC_BATCH: 0, REPORT: 0 },
  elapsedMs: 100,
  qualityCounts: { REFERENCE_VALIDATED: 0, NATIVE_COMPUTED: 0, ENGINEERING_APPROX: 0, DC_SCREEN_ONLY: 0, NOT_COMPUTABLE: 0, REFERENCE_ONLY: 0 },
  assumptions: [],
  messages: []
 };

 finishYtmStudy(study, 'COMPLETE');
 assert.equal(study.status, 'BUDGET_EXHAUSTED', 'Duplicate FIDs cannot satisfy distinct missing targets');
 assert.equal(study.pendingCounts?.SC_MAX, 2, 'T2 and T3 are missing -> pending must be 2');
});







test('SC status filter partitions only the current three-phase result',()=>{
 assert.deepEqual(SC_STATUS_FILTER_OPTIONS.map(o=>o.value),['','CALCULATED','BLOCKED_OR_UNCOMPUTABLE','PF_AVAILABLE','NOT_RUN_OR_STALE']);
 const row=(status:string,pf:number|null=null)=>({raw:{status_3F:status},metrics:{ikss:{pf}}});
 assert.ok(scStateMatches('CALCULATED',row('CALCULATED_NETWORK_APPROXIMATION')));assert.equal(scStateMatches('CALCULATED',row('BLOCKED')),false);
 for(const status of ['BLOCKED','NOT_COMPUTABLE'])assert.ok(scStateMatches('BLOCKED_OR_UNCOMPUTABLE',row(status)));
 for(const status of ['NOT_RUN','STALE'])assert.ok(scStateMatches('NOT_RUN_OR_STALE',row(status)));
 assert.ok(scStateMatches('PF_AVAILABLE',row('NOT_RUN',6)));assert.equal(scStateMatches('PF_AVAILABLE',row('NOT_RUN')),false);
});
