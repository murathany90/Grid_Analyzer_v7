import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {loadBenchmark} from '../../src/importers/powerfactory-benchmark';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {ScenarioStore,emptyScenario} from '../../src/domain/scenario/overlay';
import {identity} from '../../src/domain/calculation/identity';
import {AnalysisSettingsStore} from '../../src/domain/calculation/analysis-settings';
import {buildBenchmarkMapData,benchmarkMapGate,benchmarkLayerColor,type BenchmarkMapSelection} from '../../src/domain/benchmark/map-layer';
import {metricRows,metricStatistics,preflightBenchmark} from '../../src/domain/benchmark/comparison';
import {diagnosticStatistics} from '../../src/domain/benchmark/diagnostic-statistics';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';
import {postResultAssembler} from '../../src/analysis/contingency-ac/post-results';
import {acNetwork} from '../helpers/ac-network';

test('canonical diagnostic map uses signed native cells, robust scale and separate certified gate',async()=>{
  const p=syntheticBenchmarkPair(),b=await loadBenchmark(p.benchmark),base=(await loadBenchmarkModel(p.model)).network;
  const table=b.groups.LF.tables.GA_Reference_Raw;table.rows[0][table.headers.indexOf('voltagePu')]=.95;table.rows[1][table.headers.indexOf('voltagePu')]=1.03;
  const n={...base,buses:base.buses.map((x,i)=>({...x,siteIds:[`S${i}`]})),sites:base.buses.map((x,i)=>({...x,id:`S${i}`,sourceId:`S${i}`,areaId:'A',areaName:'A',lat:39+i,lon:32,voltages:[100]}))},scenario=new ScenarioStore(),result=await new BrowserJsPowerFlowEngine().runPowerFlow({network:n,scenario:scenario.current,identity:identity(n.modelHash,scenario.current,'powerFlow')});
  const ctx={network:n,benchmark:b,resultStore:{get:()=>result},scenario,analysisSettings:new AnalysisSettingsStore(),n1AcResults:[],hybridResult:null};
  const s:BenchmarkMapSelection={analysis:'LF',source:'EXPLORATORY_DELTA',metric:'voltagePu',table:'GA_Reference_Raw',diagnostic:true},map=buildBenchmarkMapData(ctx as never,s);
  assert.ok(map.enabled);assert.ok(Math.abs(map.sites.get('S0')!.value!-.05)<1e-12);assert.ok(Math.abs(map.sites.get('S1')!.value!+.03)<1e-12);assert.ok(map.sites.get('S0')!.details.join().includes('EXPLORATORY'));assert.ok(map.scale!.p95>0);
  assert.equal(benchmarkLayerColor(map.sites.get('S0'),true,map.scale!.p95),'#eb765b');assert.notEqual(benchmarkLayerColor(map.sites.get('S1'),true,map.scale!.p95),'#eb765b');assert.equal(benchmarkLayerColor({value:0,unit:'pu',status:'EXPLORATORY',details:[]},true,0),'#a6b7c0');
  assert.ok(!benchmarkMapGate(ctx as never,{...s,diagnostic:false}).enabled);assert.ok(!benchmarkMapGate(ctx as never,{...s,source:'DELTA'}).enabled);
  const rows=metricRows(table,preflightBenchmark(b,n,result),'voltagePu',{diagnostic:true});assert.equal(diagnosticStatistics([...rows,...rows])[0].nDiagnostic,2);assert.ok(metricStatistics(rows).every(r=>r.mae===null));
  table.rows[0][table.headers.indexOf('fid')]='WRONG';const bad=buildBenchmarkMapData({...ctx,benchmark:{...b}} as never,s);assert.ok(!bad.sites.has('S0')); // invalid row never acquires geometry
  for(const key of ['unit','phase'])if(!table.headers.includes(key))table.headers.push(key);table.rows[1][table.headers.indexOf('unit')]='kA';table.rows[1][table.headers.indexOf('phase')]='A';const unit=buildBenchmarkMapData({...ctx,benchmark:{...b}} as never,s);assert.ok(!unit.enabled);assert.equal(unit.sites.size,0);
  assert.ok(!buildBenchmarkMapData({...ctx,resultStore:{get:()=>({...result,identity:{...result.identity,scenarioHash:'STALE'}})}} as never,s).enabled);
});

test('hybrid map resolves exact case, keeps partial island absence and invalidates snapshots',async()=>{
  const base=acNetwork(),n={...base,buses:base.buses.map(b=>({...b,siteIds:[b.id]})),sites:base.buses.map(b=>({...b,areaId:'A',areaName:'A',lat:39,lon:32,voltages:[100]}))},settings=new AnalysisSettingsStore(),scenario=new ScenarioStore();
  const hybrid=await runHybridN1(n,scenario.current,{analysisSettings:settings.value,selectedCandidateIds:['ElmLne:BYPASS'],policy:{acBudgetCases:1}}),ctx={network:n,hybridResult:hybrid,n1AcResults:[],n1Result:null,resultStore:{get:()=>null},analysisSettings:settings,scenario};
  const s:BenchmarkMapSelection={analysis:'N1',source:'GA',metric:'postVoltagePu',table:'N1_RecordedExtrema_Raw',caseId:'N1:ElmLne:BYPASS'};
  const map=buildBenchmarkMapData(ctx as never,s);assert.ok(map.enabled);assert.equal(map.sites.size,3);assert.match(map.sites.get('B2')!.details.join(),/HYBRID_FULL_AC/);
  const baseMap=buildBenchmarkMapData(ctx as never,{...s,n1Layer:'BASE'}),change=buildBenchmarkMapData(ctx as never,{...s,n1Layer:'CHANGE'});assert.equal(baseMap.sites.get('B2')?.value,hybrid.basePost?.buses.find(b=>b.terms.includes('B2'))?.vmPu);assert.ok(Math.abs(change.sites.get('B2')!.value!-(map.sites.get('B2')!.value!-baseMap.sites.get('B2')!.value!))<1e-12);assert.ok(change.scale);
  assert.ok(!buildBenchmarkMapData(ctx as never,{...s,caseId:'N1:ElmLne:L0'}).enabled);
  assert.ok(!buildBenchmarkMapData({...ctx,hybridResult:{...hybrid,identity:{...hybrid.identity,settingsHash:'WRONG'}}} as never,s).enabled);
  const resumed=await runHybridN1(n,scenario.current,{analysisSettings:settings.value,selectedCandidateIds:['ElmLne:BYPASS'],policy:{acBudgetCases:5},resume:hybrid});assert.equal(resumed.counts.AC_CALCULATED,3);
});

test('N1 loading observation uses queue denominator; absent PF basis blocks even diagnostic delta',async()=>{
  const base=acNetwork(),n={...base,lines:base.lines.map(l=>({...l,capacity:{quality:'DGS_MAIN_TYPE' as const,typeId:'T',typeName:'T',nominalCurrentKA:1,nominalMVA:173.2,limitingSectionId:null,sections:[],seasonalReference:null}}))},scenario=emptyScenario(),caseId='N1:ElmLne:BYPASS';
  const h=await runHybridN1(n,scenario,{selectedCandidateIds:['ElmLne:BYPASS'],policy:{acBudgetCases:1},observations:[{sourceClass:'ElmLne',fid:'L0',metric:'postLoadingPercent',side:'FROM',caseId}]});
  const c=h.cases.find(c=>c.outage.caseId===caseId)!,branch=c.mapResults!.branches.find(b=>b.fid==='L0')!;assert.equal(c.observations[0].value,branch.loading.operationalPercent);
  const table={name:'N1_RecordedExtrema_Raw',analysis:'N1' as const,fileSha256:'SYNTHETIC',metadata:{},rowNumbers:[2],headerRow:1,headers:['caseId','outageClass','outageFid','affectedClass','affectedFid','postPowerEndpoint','postLoadingPercent'],rows:[[caseId,'ElmLne','BYPASS','ElmLne','L0','FROM',30]]};
  const gate={status:'NOT_COMPARABLE' as const,reasons:[],lf:null,comparison:null},o={network:n,scenario,hybrid:h,diagnostic:true};
  const missing=metricRows(table,gate,'postLoadingPercent',o)[0];assert.equal(missing.ga,branch.loading.operationalPercent);assert.equal(missing.diagnosticDelta,null);assert.equal(missing.reason,'LOADING_DENOMINATOR_UNVERIFIED');
  table.headers.push('loadingDenominatorBasis','loadingSeason','ratedCurrentFromA','ratedCurrentToA');table.rows[0].push('CURRENT_A','nominal',1000,1000);
  const proven=metricRows(table,gate,'postLoadingPercent',o)[0];assert.ok(proven.diagnosticDelta!==null);assert.equal(proven.delta,null);
});

test('seasonal current and apparent MVA loading use independent explicit denominators and both endpoints',()=>{
  const base=acNetwork(),capacity={quality:'DGS_MAIN_TYPE' as const,typeId:'T',typeName:'T',nominalCurrentKA:1,nominalMVA:173.2,limitingSectionId:null,sections:[],seasonalReference:{name:'L',voltageKv:100,stationA:'A',stationB:'B',summerMVA:100,winterMVA:200,operationalCandidateMVA:null,matched:true,reason:'SYNTHETIC'}};
  const n={...base,lines:base.lines.map(l=>({...l,ratingMva:50,capacity}))},r={buses:[],branches:[{...n.lines[0],pf:10,qf:0,pt:-20,qt:0,ifA:100,itA:200,loading:999,pLoss:0,qLoss:0}]};
  const summer=postResultAssembler(n,r as never,'summer').branches[0].loading,winter=postResultAssembler(n,r as never,'winter').branches[0].loading;
  assert.equal(summer.apparentPercent,40);assert.ok(Math.abs(summer.currentPercent!-winter.currentPercent!*2)<1e-12);assert.equal(summer.operationalPercent,summer.currentPercent);assert.notEqual(summer.operationalPercent,999);
  assert.equal(postResultAssembler({...n,lines:n.lines.map(l=>({...l,capacity:undefined}))},r as never,'summer').branches[0].loading.operationalPercent,null);
});
