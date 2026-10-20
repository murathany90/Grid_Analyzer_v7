import test from 'node:test';
import assert from 'node:assert/strict';
import type {AppContext} from '../../src/app/contracts';
import type {CalculationResult} from '../../src/domain/results/types';
import {acNetwork} from '../helpers/ac-network';
import {ScenarioStore,calculationScenario,scenarioSignature} from '../../src/domain/scenario/overlay';
import {ResultStore} from '../../src/domain/results/store';
import {identity} from '../../src/domain/calculation/identity';
import {AnalysisSettingsStore} from '../../src/domain/calculation/analysis-settings';
import {initialResultView} from '../../src/domain/results/workspace';
import {defaultSettings} from '../../src/persistence/settings';
import {scenarioLfComparison} from '../../src/domain/results/lf-comparison';
import {mapLoadingValues,loadingDifference} from '../../src/domain/results/loading-presentation';
import {setCapacitySeason,setManualCapacity} from '../../src/domain/model/capacity';
import {buildMapPresentationData,currentMapLf} from '../../src/map/layer-policy';
import {buildBenchmarkMapData} from '../../src/domain/benchmark/map-layer';
import {studyResultRows} from '../../src/features/analysis/study-result-rows';
import {compactResultColumns,resultSortValue,type ResultRow} from '../../src/features/analysis/result-columns';
import {branchDelta,deltaSummary} from '../../src/domain/results/delta';
import {equipmentCard} from '../../src/map/equipment-tooltip';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';

function fixture(){
  const raw=acNetwork(),network={...raw,modelHash:'scenario-loading-'+Math.random(),sites:[{...raw.buses[0],id:'S',sourceId:'S',sourceClass:'ElmSite',name:'Station',voltages:[100],areaId:'A',areaName:'A',lat:39,lon:32}],buses:raw.buses.map(b=>({...b,siteIds:['S']})),lines:raw.lines.map(l=>({...l,siteIds:['S'],capacity:{quality:'DGS_MAIN_TYPE' as const,typeId:'TYPE',typeName:'Type',nominalCurrentKA:1,nominalMVA:Math.sqrt(3)*100,limitingSectionId:null,sections:[],seasonalReference:null}}))};
  const scenario=new ScenarioStore(network.modelHash),analysisSettings=new AnalysisSettingsStore(),resultStore=new ResultStore();
  const make=(amps:number):CalculationResult=>({identity:identity(network.modelHash,scenario.current,'powerFlow',{analysisSettings:analysisSettings.value}),status:'CONVERGED',converged:true,iterations:1,rounds:1,maxMismatchMw:0,elapsedMs:1,generators:[],warnings:[],quality:{numericalStatus:'CONVERGED',controlFidelity:'PARTIAL',referenceValidation:'NOT_AVAILABLE'},diagnostics:{islands:[{islandId:'island-1',referenceSource:'SLACK',status:'CONVERGED'}],convergence:{stationControl:'STATION_CONTROL_CONVERGED',activeBalance:'ACTIVE_BALANCE_CONVERGED'}},buses:network.buses.map(b=>({id:b.id,name:b.name,terms:[b.id],siteIds:b.siteIds,vnKv:b.vnKv,vmPu:1,angleRad:0,pMw:0,qMvar:0,islandId:'island-1'})),branches:network.lines.map(l=>({...l,pf:20,qf:5,pt:-19,qt:-4,ifA:amps,itA:amps-10,loading:0,pLoss:1,qLoss:1,islandId:'island-1'}))});
  const accept=(r:CalculationResult,role:'base'|'scenario')=>{resultStore.selectScenario(scenario.selectedId);resultStore.expect(role,r.identity);assert.equal(resultStore.accept(role,r),true);};
  const base=make(546);accept(base,'base');scenario.setStatus('lineStatus','BYPASS',false,true);const post=make(801);accept(post,'scenario');resultStore.role='delta';
  const selection={analysis:'LF',source:'SCENARIO_DELTA',metric:'loadingPercent',table:'GA_Reference_Raw'} as const;
  const ctx={network,scenario,analysisSettings,resultStore,resultView:{...initialResultView(),source:'Senaryo−Baz',metric:'loadingPercent'},benchmarkMap:selection,settings:{value:defaultSettings()},filters:{voltages:new Set(['66','154','400','220','33']),areaId:'',siteId:''},benchmark:null,n1AcResults:[],hybridResult:null,scResult:null,n1Result:null} as unknown as AppContext;
  return {ctx,network,scenario,base,post,make,accept,selection};
}
test('raw loading 0/0 projects 54.6→80.1 and +25.5 pp identically in map, study, table and tooltip',()=>{
  const {ctx,network,base,post,selection}=fixture(),canonical=JSON.stringify([base,post]),cell=scenarioLfComparison(ctx,'loadingPercent').branches.get('ElmLne:L0')!;
  assert.equal(cell.pre,54.6);assert.ok(Math.abs(cell.post!-80.1)<1e-10);assert.ok(Math.abs(cell.delta!-25.5)<1e-10);assert.equal(cell.unit,'pp');
  assert.equal(buildBenchmarkMapData(ctx,selection).branches.get('ElmLne:L0')?.value,cell.delta);
  assert.equal(buildMapPresentationData(ctx,selection).branches.get('ElmLne:L0')?.value,cell.delta);
  const study=studyResultRows(ctx,selection).rows.find(r=>r.id==='ElmLne:L0')!;assert.deepEqual([study.pre,study.post,study.delta],[cell.pre,cell.post,cell.delta]);
  const row={comparisons:{loadingPercent:cell},loadingComparison:cell,baseBranch:base.branches[0],branch:post.branches[0]} as unknown as ResultRow;
  assert.equal(resultSortValue(row,'deltaLoad'),cell.delta);assert.equal(branchDelta(row.baseBranch,row.branch,cell).loading,cell.delta);assert.equal(deltaSummary([row]).maxLoading,cell.delta);
  assert.match(equipmentCard(ctx,network.lines[0]).note,/Baz 54,6%.*Senaryo 80,1%.*Δ \+25,5 pp/);assert.equal(JSON.stringify([base,post]),canonical);
});
test('validated zero remains zero; unknown capacity and stale result remain null with reasons',()=>{
  const {ctx,base,post,accept}=fixture();const zero={...post,branches:post.branches.map(b=>({...b,ifA:0,itA:0}))};accept({...base,branches:base.branches.map(b=>({...b,ifA:0,itA:0}))},'base');accept(zero,'scenario');
  assert.equal(scenarioLfComparison(ctx,'loadingPercent').branches.get('ElmLne:L0')?.delta,0);
  ctx.network={...ctx.network!,lines:ctx.network!.lines.map(l=>({...l,capacity:undefined}))};const unknown=scenarioLfComparison(ctx,'loadingPercent').branches.get('ElmLne:L0')!;assert.equal(unknown.delta,null);assert.equal(unknown.reason,'UNKNOWN_CAPACITY');
  ctx.resultStore.invalidateScenario();assert.equal(scenarioLfComparison(ctx,'loadingPercent').reason,'SCENARIO_STALE');
});
test('season, revision and rating identity mismatches never produce a loading delta',()=>{
  const {network,base,post}=fixture(),old=mapLoadingValues(network,base).get('ElmLne:L0')!,now=mapLoadingValues(network,post).get('ElmLne:L0')!;
  for(const changed of [{...now,season:'winter'},{...now,revision:now.revision+1},{...now,denominator:500},{...now,modelHash:'other'}])assert.equal(loadingDifference(old,changed).value,null);
  setCapacitySeason(network.modelHash,'summer');setManualCapacity(network.modelHash,'L0',{summer:100,winter:200});const refreshed=mapLoadingValues(network,post).get('ElmLne:L0')!;assert.equal(loadingDifference(old,refreshed).reason,'LOADING_DENOMINATOR_MISMATCH');
});
test('partition and angle reference mismatch block deltas; partial comparisons stay explicitly partial',()=>{
  const {ctx,post,accept}=fixture();accept({...post,buses:post.buses.map((b,i)=>i===0?{...b,terms:[...b.terms,'EXTRA']}:b)},'scenario');
  assert.equal(scenarioLfComparison(ctx,'voltageKv').terminals.get('B0')?.reason,'PARTITION_NOT_1_TO_1');assert.equal(scenarioLfComparison(ctx,'pFromMw').branches.get('ElmLne:L0')?.delta,null);
  accept({...post,diagnostics:{...post.diagnostics,islands:[{islandId:'island-1',referenceSource:'OTHER',status:'CONVERGED'}]}},'scenario');assert.equal(scenarioLfComparison(ctx,'angleDeg').terminals.get('B0')?.reason,'ANGLE_REFERENCE_MISMATCH');
  accept({...post,status:'PARTIAL_SOLUTION',diagnostics:{...post.diagnostics,resultProvenance:'BASELINE_FALLBACK'}},'scenario');assert.equal(scenarioLfComparison(ctx,'pFromMw').status,'PARTIAL_GA_COMPARISON');
  accept({...post,identity:{...post.identity,optionsHash:'different'}},'scenario');assert.equal(scenarioLfComparison(ctx,'pFromMw').reason,'SETTINGS_MISMATCH');
  accept(post,'scenario');ctx.analysisSettings.update({shared:{...ctx.analysisSettings.value.shared,loadScalePercent:110}});assert.equal(scenarioLfComparison(ctx,'pFromMw').reason,'SETTINGS_MISMATCH');
});
test('HV/LV power uses physical nominal side; reversed terminal orientation does not swap the delta',()=>{
  const {ctx,network,base,post,accept}=fixture(),t={...network.lines[0],id:'TR',sourceId:'TR',sourceClass:'ElmTr2',from:'B2',to:'B0',vnKv:100,lvKv:33,ratingMva:100,rPu:0,xPu:.1,tap:1,phase:0,gPu:0,bPu:0};ctx.network={...network,buses:network.buses.map(b=>b.id==='B2'?{...b,vnKv:33}:b),transformers:[t] as never};
  const add=(r:CalculationResult,hv:number)=>({...r,buses:r.buses.map(b=>b.id==='B2'?{...b,vnKv:33}:b),branches:[...r.branches,{...r.branches[0],...t,pf:-hv,pt:hv,qf:-2,qt:2}]});accept(add(base,10),'base');accept(add(post,17),'scenario');assert.equal(scenarioLfComparison(ctx,'pHvMw').branches.get('ElmTr2:TR')?.delta,7);assert.equal(scenarioLfComparison(ctx,'pLvMw').branches.get('ElmTr2:TR')?.delta,-7);
});
test('actual small-network cumulative workspace maneuvers yield P/Q/U/loading differences and physical outage zero',async()=>{
  const raw=acNetwork(4),network={...raw,modelHash:'cumulative-lf',lines:[...raw.lines,{...raw.lines[0],id:'SECOND',sourceId:'SECOND',from:'B1',to:'B3'}].map(l=>({...l,capacity:{quality:'DGS_MAIN_TYPE' as const,typeId:'T',typeName:'T',nominalCurrentKA:1,nominalMVA:173.2,limitingSectionId:null,sections:[],seasonalReference:null}}))},scenario=new ScenarioStore(network.modelHash),resultStore=new ResultStore(),analysisSettings=new AnalysisSettingsStore(),engine=new BrowserJsPowerFlowEngine();
  const ctx={network,scenario,resultStore,analysisSettings} as unknown as AppContext;
  const solve=async(role:'base'|'scenario')=>{const overlay=calculationScenario(scenario.current,role),id=identity(network.modelHash,overlay,'powerFlow',{analysisSettings:analysisSettings.value}),r=await engine.runPowerFlow({network,scenario:overlay,identity:id,analysisSettings:analysisSettings.value});resultStore.selectScenario(scenario.selectedId);resultStore.expect(role,id);assert.equal(resultStore.accept(role,r),true);assert.equal(r.converged,true);return r;};
  const base=await solve('base');scenario.setStatus('lineStatus','BYPASS',false,true);await solve('scenario');const s1=scenario.selectedId;scenario.setStatus('lineStatus','SECOND',false,true);await solve('scenario');assert.equal(scenario.current.lineStatus.BYPASS,false);assert.equal(scenario.current.lineStatus.SECOND,false);
  for(const metric of ['pFromMw','qFromMvar','loadingPercent'])assert.ok(Math.abs(scenarioLfComparison(ctx,metric).branches.get('ElmLne:L0')?.delta??0)>1e-7,metric);
  assert.ok(Math.abs(scenarioLfComparison(ctx,'voltageKv').terminals.get('B3')?.delta??0)>1e-7);
  assert.equal(scenarioLfComparison(ctx,'pFromMw').branches.get('ElmLne:BYPASS')?.post,0);
  assert.equal(scenario.selectedId,s1);assert.equal(scenario.snapshots.length,2);assert.strictEqual(scenarioLfComparison(ctx,'pFromMw').base,base);
  assert.equal(scenarioSignature(calculationScenario(scenario.current,'base')),base.identity.scenarioHash);
});

test('N-1 uses the working-scenario LF even when the last LF view was Baz',()=>{const {ctx,base,post}=fixture();ctx.resultStore.role='base';assert.strictEqual(currentMapLf(ctx),base);ctx.resultView.analysis='N1';assert.strictEqual(currentMapLf(ctx),post);});

test('compact LF metric modes keep matching loss columns and bus voltage is always kV',()=>{
  const settings=defaultSettings(),keys=(kind:'line'|'trafo'|'bus',tab:'results'|'delta')=>compactResultColumns(kind,tab,settings).flatMap(c=>c.metrics.map(m=>m.key));
  assert.equal(settings.lfBranchDisplay,'pq-loading');assert.equal(settings.lfBusDisplay,'voltage-angle');
  for(const kind of ['line','trafo'] as const)for(const tab of ['results','delta'] as const){
    settings.lfBranchDisplay='pq-loading';assert.ok(keys(kind,tab).some(k=>/Q|^q/.test(k)));assert.ok(keys(kind,tab).some(k=>/load/i.test(k)));
    settings.lfBranchDisplay='p-loading';assert.ok(keys(kind,tab).includes(tab==='delta'?'deltaPLoss':'pLoss'));assert.ok(!keys(kind,tab).some(k=>/q/i.test(k)));
    settings.lfBranchDisplay='pq';assert.ok(keys(kind,tab).includes(tab==='delta'?'deltaQLoss':'qLoss'));assert.ok(!keys(kind,tab).some(k=>/load/i.test(k)));
  }
  for(const tab of ['results','delta'] as const){
    settings.lfBusDisplay='voltage';assert.ok(keys('bus',tab).some(k=>/vkv/i.test(k)));assert.ok(!keys('bus',tab).some(k=>/angle/i.test(k)));
    settings.lfBusDisplay='angle';assert.ok(keys('bus',tab).some(k=>/angle/i.test(k)));assert.ok(!keys('bus',tab).some(k=>/vkv/i.test(k)));if(tab==='delta')assert.deepEqual(compactResultColumns('bus',tab,settings).slice(1).flatMap(c=>c.metrics.map(m=>m.label)),['Baz Açı','Senaryo Açı','ΔAçı']);
    settings.lfBusDisplay='voltage-angle';assert.ok(!compactResultColumns('bus',tab,settings).some(c=>c.metrics.some(m=>m.unit==='pu'||m.label.includes('pu'))));
  }
});
