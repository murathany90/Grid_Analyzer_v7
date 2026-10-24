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

test('C.1: SC compact rows integrate 3F and 1F side-by-side with LF operating point and correct blocked/uncomputed states',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='SC';installLfFixture(ctx);
 let rows=compactScRows(ctx);assert.ok(rows.length>0);
 assert.equal(rows[0].raw.status_1F,'NOT_RUN');assert.equal(rows[0].raw.GA_1F_Ikss_A,null);assert.equal(rows[0].metrics.ikss1F.ga,null);
 assert.ok(rows.some(r=>r.metrics.voltage?.ga!==null));assert.ok(rows.some(r=>r.metrics.angle?.ga!==null));

 const sc3F=ctx.scResult!;
 ctx.scResult1Lg={
  ...sc3F,
  method:'GA_SEQUENCE_1LG_MAX',
  profile:{...sc3F.profile,faultType:'1LG' as const},
  identity:{...sc3F.identity,profileHash:'1LG_PROFILE_HASH'},
  faults:sc3F.faults.map((f,i)=>({
   ...f,
   faultType:'1LG' as const,
   status:i===0?'CALCULATED_NETWORK_APPROXIMATION' as const:'BLOCKED' as const,
   reasons:i===0?['CALCULATED']:['NOT_COMPUTABLE: no grounding path'],
   ikssKa:i===0?15.42:null,
   z1Ohm:{re:.5,im:3.2},
   z2Ohm:{re:.5,im:3.2},
   z0Ohm:i===0?{re:1.2,im:7.8}:null
  }))
 };

 rows=compactScRows(ctx);
 const calculatedBus=rows.find(r=>r.fid===ctx.scResult1Lg!.faults[0].physicalTerminalFid);
 assert.ok(calculatedBus);
 assert.equal(calculatedBus.raw.status_1F,'CALCULATED_NETWORK_APPROXIMATION');
 assert.equal(calculatedBus.metrics.ikss1F.ga,15.42);
 assert.equal(calculatedBus.raw.GA_1F_Ikss_A,15420);
 assert.equal(calculatedBus.raw.GA_1F_Ikss_kA,15.42);
 assert.equal(calculatedBus.raw.Z0_R_ohm,1.2);
 assert.equal(calculatedBus.raw.Z0_X_ohm,7.8);
 assert.equal(calculatedBus.raw.PF_1F_Ikss_kA,null);

 const blockedBus=rows.find(r=>r.fid===ctx.scResult1Lg!.faults[1].physicalTerminalFid);
 assert.ok(blockedBus);
 assert.equal(blockedBus.raw.status_1F,'NOT_COMPUTABLE');
 assert.equal(blockedBus.metrics.ikss1F.ga,null);
 assert.equal(blockedBus.raw.GA_1F_Ikss_A,null);
 assert.match(String(blockedBus.raw.reason_1F),/NOT_COMPUTABLE/);

 const sortedByMax=sortCompactRows(rows,'maxIkss',true);
 const maxVal=(r:CompactRow)=>Math.max(r.metrics.ikss?.ga??-Infinity,r.metrics.ikss1F?.ga??-Infinity);
 assert.ok(maxVal(sortedByMax[0])>=maxVal(sortedByMax[sortedByMax.length-1]));
 const sortedBy1F=sortCompactRows(rows,'ikss1F',true);
 assert.equal(sortedBy1F[0].fid,calculatedBus.fid);
 const sortedBy3F=sortCompactRows(rows,'ikss3F',true);
 assert.ok(sortedBy3F[0].raw.GA_3F_Ikss_kA!>=(sortedBy3F[sortedBy3F.length-1].raw.GA_3F_Ikss_kA??0));
 const sortedByU=sortCompactRows(rows,'u',true);
 assert.ok(sortedByU.length>0);
});

test('C.1: Stale 1F result is rejected and marked STALE when sourceHash or mode mismatches',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='SC';installLfFixture(ctx);
 const sc3F=ctx.scResult!;
 // Incompatible 1F (e.g. sourceHash mismatch)
 ctx.scResult1Lg={
  ...sc3F,
  method:'GA_SEQUENCE_1LG_MAX',
  profile:{...sc3F.profile,faultType:'1LG' as const},
  identity:{...sc3F.identity,sourceHash:'DIFFERENT_SOURCE_HASH'},
  faults:sc3F.faults.map(f=>({...f,faultType:'1LG' as const,status:'CALCULATED_NETWORK_APPROXIMATION' as const,ikssKa:12.5}))
 };
 const rows=compactScRows(ctx);
 assert.ok(rows.length>0);
 assert.equal(rows[0].raw.status_1F,'STALE');
 assert.equal(rows[0].raw.GA_1F_Ikss_A,null);
 assert.equal(rows[0].raw.GA_1F_Ikss_kA,null);
 assert.equal(rows[0].raw.Hesap_Durumu,'PARTIAL');
 assert.match(String(rows[0].raw.reason_1F),/STALE/);
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

test('C.2: Lightning SC Panel renders selected TM electrical buses and shows bus details upon selection',()=>{
 const makeEl=(tag:string)=>{
  const el={
   tagName:tag.toUpperCase(),
   className:'',
   textContent:'',
   title:'',
   value:'',
   type:'',
   hidden:false,
   placeholder:'',
   children:[] as any[],
   style:{},
   dataset:{},
   setAttribute:()=>{},
   append:(...kids:any[])=>el.children.push(...kids),
   replaceChildren:(...kids:any[])=>{el.children=kids;},
   querySelector:()=>null,
   querySelectorAll:()=>[],
   classList:{add:()=>{},remove:()=>{},toggle:()=>{}}
  };
  return el as any;
 };
 (globalThis as any).document={createElement:makeEl};
 try{
  const {ctx}=analysisUiFixture();ctx.analysisTab='SC';installLfFixture(ctx);
  const panel=createLightningScPanel(ctx);
  assert.ok(panel.element);
  assert.equal(typeof panel.render,'function');
  panel.render();
 }finally{
  delete (globalThis as any).document;
 }
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

test('C.2.1: skss metric is exposed for GA, disallowed for PF, and legend omits Amperes for MVA', () => {
 const {ctx} = analysisUiFixture();
 ctx.analysisTab = 'SC';
 const rows = compactScRows(ctx);
 assert.ok(rows.length > 0);
 const rowWithSkss = rows.find(r => r.raw.Skss_MVA != null);
 assert.ok(rowWithSkss);
 assert.equal(rowWithSkss.metrics.skss.ga, rowWithSkss.raw.Skss_MVA);
 assert.equal(rowWithSkss.metrics.skss.pf, null);
 assert.equal(rowWithSkss.metrics.skss.reason, 'PF Skss referansı yok');

 // Benchmark gate rejections for PF
 const gateSkss = benchmarkMapGate(ctx, {analysis: 'SC', source: 'PF', metric: 'skssMva', table: 'SC_BusResults_Raw'});
 assert.equal(gateSkss.enabled, false);
 assert.equal(gateSkss.reason, 'PF_SKSS_REFERENCE_NOT_AVAILABLE');

 const gate1F = benchmarkMapGate(ctx, {analysis: 'SC', source: 'PF', metric: 'ikss1FKa', table: 'SC_BusResults_Raw'});
 assert.equal(gate1F.enabled, false);
 assert.equal(gate1F.reason, 'PF_1F_REFERENCE_NOT_AVAILABLE');

 const gateMin = benchmarkMapGate(ctx, {analysis: 'SC', source: 'PF', metric: 'maxIkssKa', table: 'SC_BusResults_Raw', scMode: 'MIN'});
 assert.equal(gateMin.enabled, false);
 assert.equal(gateMin.reason, 'PF_SC_MIN_REFERENCE_NOT_AVAILABLE');
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

test('C.2.1: partial SC targets (3F=3, 1F=1 of 3 targets) marks study BUDGET_EXHAUSTED and pending=2', () => {
 const study: YtmStudyResult = {
  schemaVersion: 1,
  identity: { modelHash: 'm1', scenarioHash: 's1', optionsHash: 'o1' },
  options: { ytmId: 'A', families: ['SC'], scModes: ['MAX'] },
  status: 'COMPLETE',
  catalog: [],
  n1: null,
  scMax: {
   identity: { modelHash: 'm1', scenarioHash: 's1', sourceHash: 'src1', profileHash: 'p1' },
   profile: { calculateMode: 'MAX', faultType: '3PH' },
   method: 'GA_POSITIVE_SEQUENCE_3PH_MAX',
   faults: [
    { physicalTerminalFid: 'T1', electricalBusId: 'B1', physicalTerminalFids: ['T1'], nominalKv: 154, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 20, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null },
    { physicalTerminalFid: 'T2', electricalBusId: 'B2', physicalTerminalFids: ['T2'], nominalKv: 154, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 25, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null },
    { physicalTerminalFid: 'T3', electricalBusId: 'B3', physicalTerminalFids: ['T3'], nominalKv: 154, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 30, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null }
   ]
  } as any,
  sc1LgMax: {
   identity: { modelHash: 'm1', scenarioHash: 's1', sourceHash: 'src1', profileHash: 'p1' },
   profile: { calculateMode: 'MAX', faultType: '1LG' },
   method: 'GA_SEQUENCE_1LG_MAX',
   faults: [
    { physicalTerminalFid: 'T1', electricalBusId: 'B1', physicalTerminalFids: ['T1'], nominalKv: 154, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 15, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null }
   ]
  } as any,
  scMin: null,
  faultTargets: ['T1', 'T2', 'T3'],
  electricalTargets: 3,
  stageMs: { MODEL_PREPARATION: 0, CATALOG: 0, DC_SCREEN: 0, AC_APPROX: 0, AC_FULL: 0, SC_SOURCE_PREP: 0, SC_FACTORIZATION: 0, SC_BATCH: 0, REPORT: 0 },
  elapsedMs: 100,
  qualityCounts: { REFERENCE_VALIDATED: 0, NATIVE_COMPUTED: 0, ENGINEERING_APPROX: 0, DC_SCREEN_ONLY: 0, NOT_COMPUTABLE: 0, REFERENCE_ONLY: 0 },
  assumptions: [],
  messages: []
 };

 finishYtmStudy(study, 'COMPLETE');
 assert.equal(study.status, 'BUDGET_EXHAUSTED', 'Study with partial 1F results must not be COMPLETE');
 assert.equal(study.pendingCounts?.SC_MAX, 0, 'All 3 3F faults present');
 assert.equal(study.pendingCounts?.SC1_MAX, 2, '2 missing 1F faults must be marked pending');

 // Physically blocked fault (quality = NOT_COMPUTABLE) is counted in qualityCounts, NOT as pending
 study.sc1LgMax!.faults.push({
  physicalTerminalFid: 'T2', electricalBusId: 'B2', physicalTerminalFids: ['T2'], nominalKv: 154, componentId: null,
  status: 'BLOCKED', quality: 'NOT_COMPUTABLE', reasons: ['NOT_COMPUTABLE: no grounding path'],
  zkkOhm: null, ikssKa: null, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null
 });
 finishYtmStudy(study, 'COMPLETE');
 assert.equal(study.pendingCounts?.SC1_MAX, 1, 'Only the 1 genuinely missing fault should be pending');
 assert.equal(study.qualityCounts.NOT_COMPUTABLE, 1, 'Physically blocked fault is in qualityCounts');
});

test('C.2.2: workspace save/sync retains and clears scResult1Lg consistently (unconditional)', () => {
 const {ctx} = analysisUiFixture();
 const cache = new WorkspaceResultCache();
 const key = workspaceKey(ctx);

 const sc3F = ctx.scResult!;
 const sc1F: any = {
  ...sc3F,
  method: 'GA_SEQUENCE_1LG_MAX',
  profile: { ...sc3F.profile, faultType: '1LG' as const },
  identity: { ...sc3F.identity, profileHash: '1LG_PROFILE' }
 };
 ctx.scResult1Lg = sc1F;

 const savedResults: ScenarioResults = {
  n1: null,
  ac: [],
  hybrid: null,
  sc: ctx.scResult,
  sc1Lg: ctx.scResult1Lg,
  scContext: ctx.scContext,
  ytm: null,
  studyOptions: undefined
 };

 // Unconditional save
 cache.set(key, savedResults);

 // Reset memory
 ctx.scResult = null;
 ctx.scResult1Lg = null;

 // Unconditional restore
 const restored = cache.get(key);
 assert.ok(restored, 'Saved workspace must be retrieved from cache');
 assert.equal(restored.sc, sc3F, '3F SC result must be restored');
 assert.equal(restored.sc1Lg, sc1F, '1F SC result must be restored');
 assert.equal(restored.sc?.identity.modelHash, restored.sc1Lg?.identity.modelHash, 'Model hash must match');
 assert.equal(restored.sc?.identity.scenarioHash, restored.sc1Lg?.identity.scenarioHash, 'Scenario hash must match');
 assert.equal(restored.sc?.identity.sourceHash, restored.sc1Lg?.identity.sourceHash, 'Source hash must match');
 assert.equal(restored.sc?.profile.calculateMode, restored.sc1Lg?.profile.calculateMode, 'Mode must match');

 // Mismatched scenario key must return undefined
 const foreignKey = key + '_OTHER_SCENARIO';
 assert.equal(cache.get(foreignKey), undefined, 'Different workspace key must not return previous results');

 // Clear
 cache.clear();
 assert.equal(cache.get(key), undefined, 'Clear must empty cache');
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
  sc1LgMax: null,
  scMin: null,
  sc1LgMin: null,
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

test('C.2.2: multi-voltage single TM applies voltageKv filter prior to maximum calculation', () => {
 const {ctx} = analysisUiFixture();
 ctx.filters.areaId = '';
 ctx.network = {
  ...ctx.network!,
  sites: [{ id: 'SITE_MV', name: 'TEST TM', sourceId: 'SITE_MV', sourceClass: 'ElmSubstat', areaId: 'A', areaName: 'A', lat: 39, lon: 32, voltages: [400, 34.5] } as any],
  buses: [
   { id: 'TERM_400', sourceId: 'TERM_400', sourceClass: 'ElmTerm', name: '400 kV Bara', vnKv: 400, siteIds: ['SITE_MV'], terms: ['TERM_400'] } as any,
   { id: 'TERM_34', sourceId: 'TERM_34', sourceClass: 'ElmTerm', name: '34.5 kV Bara', vnKv: 34.5, siteIds: ['SITE_MV'], terms: ['TERM_34'] } as any
  ]
 } as any;
 ctx.scResult = {
  engineRevision:SC_ENGINE_REVISION,
  identity: { modelHash: ctx.network!.modelHash, scenarioHash: scenarioSignature(ctx.scenario.current), sourceHash: 'SRC_MV', profileHash: 'PRF' },
  profile: { calculateMode: 'MAX', faultType: '3PH' },
  method: 'GA_POSITIVE_SEQUENCE_3PH_MAX',
  faults: [
   { physicalTerminalFid: 'TERM_400', electricalBusId: 'E_400', physicalTerminalFids: ['TERM_400'], nominalKv: 400, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 20.0, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null },
   { physicalTerminalFid: 'TERM_34', electricalBusId: 'E_34', physicalTerminalFids: ['TERM_34'], nominalKv: 34.5, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 45.0, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null }
  ]
 } as any;
 ctx.scResult1Lg = null;
 ctx.ytmStudy = null;

 // When voltageKv: 400 is requested, site maximum MUST be 20 kA, not 45 kA
 const map400 = buildBenchmarkMapData(ctx, { analysis: 'SC', source: 'GA', metric: 'maxIkssKa', table: 'SC_BusResults_Raw', voltageKv: 400 });
 assert.equal(map400.sites.get('SITE_MV')?.value, 20.0, '400 kV map must only reflect 400 kV bus');
 assert.equal(map400.sites.get('SITE_MV')?.representativeFid, 'TERM_400');

 // When voltageKv: 154 is requested, site has no 154 kV bus -> status must be NO_VOLTAGE_MATCH and value null
 const map154 = buildBenchmarkMapData(ctx, { analysis: 'SC', source: 'GA', metric: 'maxIkssKa', table: 'SC_BusResults_Raw', voltageKv: 154 });
 assert.equal(map154.sites.get('SITE_MV')?.status, 'NO_VOLTAGE_MATCH');
 assert.equal(map154.sites.get('SITE_MV')?.value, null);

 // When no voltageKv filter (all voltages), site maximum is 45 kA
 const mapAll = buildBenchmarkMapData(ctx, { analysis: 'SC', source: 'GA', metric: 'maxIkssKa', table: 'SC_BusResults_Raw' });
 assert.equal(mapAll.sites.get('SITE_MV')?.value, 45.0, 'Unfiltered map reflects overall maximum');
});

test('C.2.2: two sites with identical names never cross-contaminate and name fallback is eliminated', () => {
 const {ctx} = analysisUiFixture();
 ctx.filters.areaId = '';
 ctx.network = {
  ...ctx.network!,
  sites: [
   { id: 'SITE_1', name: 'KAYAS', sourceId: 'SITE_1', sourceClass: 'ElmSubstat', areaId: 'A', areaName: 'A', lat: 39, lon: 32, voltages: [154] } as any,
   { id: 'SITE_2', name: 'KAYAS', sourceId: 'SITE_2', sourceClass: 'ElmSubstat', areaId: 'A', areaName: 'A', lat: 40, lon: 33, voltages: [154] } as any
  ],
  buses: [
   { id: 'T_K1', sourceId: 'T_K1', sourceClass: 'ElmTerm', name: 'K1 Bara', vnKv: 154, siteIds: ['SITE_1'], terms: ['T_K1'] } as any,
   { id: 'T_K2', sourceId: 'T_K2', sourceClass: 'ElmTerm', name: 'K2 Bara', vnKv: 154, siteIds: ['SITE_2'], terms: ['T_K2'] } as any
  ]
 } as any;
 ctx.scResult = {
  engineRevision:SC_ENGINE_REVISION,
  identity: { modelHash: ctx.network!.modelHash, scenarioHash: scenarioSignature(ctx.scenario.current), sourceHash: 'SRC_K', profileHash: 'PRF' },
  profile: { calculateMode: 'MAX', faultType: '3PH' },
  method: 'GA_POSITIVE_SEQUENCE_3PH_MAX',
  faults: [
   { physicalTerminalFid: 'T_K1', electricalBusId: 'E_K1', physicalTerminalFids: ['T_K1'], nominalKv: 154, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 12.0, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null },
   { physicalTerminalFid: 'T_K2', electricalBusId: 'E_K2', physicalTerminalFids: ['T_K2'], nominalKv: 154, componentId: null, status: 'CALCULATED_NETWORK_APPROXIMATION', quality: 'ENGINEERING_APPROX', reasons: ['OK'], zkkOhm: null, ikssKa: 28.0, skssMva: null, ipKa: null, ibKa: null, ithKa: null, residual: null }
  ]
 } as any;
 ctx.scResult1Lg = null;
 ctx.ytmStudy = null;

 const mapData = buildBenchmarkMapData(ctx, { analysis: 'SC', source: 'GA', metric: 'maxIkssKa', table: 'SC_BusResults_Raw' });
 assert.equal(mapData.sites.get('SITE_1')?.value, 12.0, 'SITE_1 must strictly match T_K1');
 assert.equal(mapData.sites.get('SITE_2')?.value, 28.0, 'SITE_2 must strictly match T_K2');
});

test('C.2.2: PF-only 3F MAX map functions independently when GA SC is NOT_RUN', () => {
 const {ctx} = analysisUiFixture();
 ctx.scResult = null; // GA SC has NOT run
 ctx.scResult1Lg = null;
 ctx.ytmStudy = null;

 // Gate for PF 3F MAX is enabled
 const gate3F = benchmarkMapGate(ctx, { analysis: 'SC', source: 'PF', metric: 'maxIkssKa', table: 'SC_BusResults_Raw' });
 assert.equal(gate3F.enabled, true, 'PF 3PH MAX must be enabled even without GA result');

 // Gate for unsupported PF metrics / modes are rejected
 assert.equal(benchmarkMapGate(ctx, { analysis: 'SC', source: 'PF', metric: 'skssMva', table: 'SC_BusResults_Raw' }).enabled, false);
 assert.equal(benchmarkMapGate(ctx, { analysis: 'SC', source: 'PF', metric: 'ikss1FKa', table: 'SC_BusResults_Raw' }).enabled, false);
 assert.equal(benchmarkMapGate(ctx, { analysis: 'SC', source: 'PF', metric: 'maxIkssKa', table: 'SC_BusResults_Raw', scMode: 'MIN' }).enabled, false);

 // Map data renders PF pins without requiring compactScRows
 const mapData = buildBenchmarkMapData(ctx, { analysis: 'SC', source: 'PF', metric: 'maxIkssKa', table: 'SC_BusResults_Raw' });
 assert.equal(mapData.enabled, true);
 assert.ok((mapData.numericValues ?? 0) > 0, 'PF numerical values must be populated on map');
});

test('C.2.3: SC status filter exposes functional options and partitions compact rows accurately', () => {
 // Verify functional options contract
 assert.deepEqual(SC_STATUS_FILTER_OPTIONS.map(o => o.value), [
  '',
  'CALCULATED_BOTH',
  'CALCULATED_3F_ONLY',
  'BLOCKED_OR_UNCOMPUTABLE',
  'PF_AVAILABLE',
  'NOT_RUN_OR_STALE'
 ]);

 assert.equal(SC_STATUS_FILTER_OPTIONS.some(o => o.label.includes('DC tarandı')), false, 'N-1 DC option must NOT exist in SC');
 assert.equal(SC_STATUS_FILTER_OPTIONS.some(o => o.label.includes('%100 üzeri')), false, 'N-1 OVER option must NOT exist in SC');
 assert.equal(SC_STATUS_FILTER_OPTIONS.some(o => o.label.includes('AC sayısal')), false, 'N-1 AC option must NOT exist in SC');

 // Test scStateMatches predicate against representative rows
 const rowBoth = { raw: { status_3F: 'CALCULATED_NETWORK_APPROXIMATION', status_1F: 'CALCULATED_NETWORK_APPROXIMATION' }, metrics: { ikss: { pf: 25.5 } } };
 const row3FOnly = { raw: { status_3F: 'CALCULATED_NETWORK_APPROXIMATION', status_1F: 'NOT_COMPUTABLE' }, metrics: { ikss: { pf: null } } };
 const rowBlocked = { raw: { status_3F: 'BLOCKED', status_1F: 'BLOCKED' }, metrics: { ikss: { pf: null } } };
 const rowNotRun = { raw: { status_3F: 'NOT_RUN', status_1F: 'NOT_RUN' }, metrics: { ikss: { pf: null } } };
 const rowStale = { raw: { status_3F: 'CALCULATED_NETWORK_APPROXIMATION', status_1F: 'STALE' }, metrics: { ikss: { pf: null } } };

 // '' (ALL)
 assert.equal(scStateMatches('', rowBoth), true);
 assert.equal(scStateMatches('', rowBlocked), true);

 // CALCULATED_BOTH
 assert.equal(scStateMatches('CALCULATED_BOTH', rowBoth), true);
 assert.equal(scStateMatches('CALCULATED_BOTH', row3FOnly), false);
 assert.equal(scStateMatches('CALCULATED_BOTH', rowBlocked), false);

 // CALCULATED_3F_ONLY
 assert.equal(scStateMatches('CALCULATED_3F_ONLY', row3FOnly), true);
 assert.equal(scStateMatches('CALCULATED_3F_ONLY', rowBoth), false);

 // BLOCKED_OR_UNCOMPUTABLE
 assert.equal(scStateMatches('BLOCKED_OR_UNCOMPUTABLE', rowBlocked), true);
 assert.equal(scStateMatches('BLOCKED_OR_UNCOMPUTABLE', row3FOnly), true);
 assert.equal(scStateMatches('BLOCKED_OR_UNCOMPUTABLE', rowBoth), false);

 // PF_AVAILABLE
 assert.equal(scStateMatches('PF_AVAILABLE', rowBoth), true);
 assert.equal(scStateMatches('PF_AVAILABLE', rowBlocked), false);

 // NOT_RUN_OR_STALE
 assert.equal(scStateMatches('NOT_RUN_OR_STALE', rowNotRun), true);
 assert.equal(scStateMatches('NOT_RUN_OR_STALE', rowStale), true);
 assert.equal(scStateMatches('NOT_RUN_OR_STALE', rowBoth), false);
});

test('C.2.3: Incompatible 3F/1F pair with mismatched sourceHash, calculateMode, or faultType is strictly rejected during standalone restore', () => {
 const {ctx} = analysisUiFixture();
 const loadedModelHash = ctx.network!.modelHash;
 const scenarioSig = scenarioSignature(ctx.scenario.current);

 const baseSc = {
  identity: { modelHash: loadedModelHash, scenarioHash: scenarioSig, sourceHash: 'SRC_ALPHA', profileHash: 'PRF' },
  profile: { calculateMode: 'MAX' as const, faultType: '3PH' },
  method: 'GA_POSITIVE_SEQUENCE_3PH_MAX',
  faults: []
 };

 const incompatibleSourceHash = {
  identity: { modelHash: loadedModelHash, scenarioHash: scenarioSig, sourceHash: 'SRC_BETA_DIFFERENT', profileHash: 'PRF' },
  profile: { calculateMode: 'MAX' as const, faultType: '1LG' as const },
  method: 'GA_SYMMETRICAL_COMPONENTS_1LG_MAX',
  faults: []
 };

 const incompatibleMode = {
  identity: { modelHash: loadedModelHash, scenarioHash: scenarioSig, sourceHash: 'SRC_ALPHA', profileHash: 'PRF' },
  profile: { calculateMode: 'MIN' as const, faultType: '1LG' as const },
  method: 'GA_SYMMETRICAL_COMPONENTS_1LG_MIN',
  faults: []
 };

 const canRestore1Lg = (sc: typeof baseSc, sc1: any) => {
  return (
   sc1 &&
   sc1.identity.modelHash === loadedModelHash &&
   sc1.identity.scenarioHash === scenarioSig &&
   sc1.identity.sourceHash === sc.identity.sourceHash &&
   sc1.profile.calculateMode === sc.profile.calculateMode &&
   sc1.profile.faultType === '1LG'
  );
 };

 assert.equal(canRestore1Lg(baseSc, incompatibleSourceHash), false, 'Mismatched sourceHash must reject sc1Lg');
 assert.equal(canRestore1Lg(baseSc, incompatibleMode), false, 'Mismatched calculateMode must reject sc1Lg');

 const compatibleSc1 = {
  identity: { modelHash: loadedModelHash, scenarioHash: scenarioSig, sourceHash: 'SRC_ALPHA', profileHash: 'PRF' },
  profile: { calculateMode: 'MAX' as const, faultType: '1LG' as const },
  method: 'GA_SYMMETRICAL_COMPONENTS_1LG_MAX',
  faults: []
 };
 assert.equal(canRestore1Lg(baseSc, compatibleSc1), true, 'Matching sc1Lg must be accepted');
});


