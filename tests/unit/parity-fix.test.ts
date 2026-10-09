import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyN1Scope,buildN1CandidateCatalog,filterN1CatalogCandidates} from '../../src/domain/n1/catalog';
import {constraintState,comparePostConstraints} from '../../src/analysis/contingency-hybrid/constraints';
import {hybridStudySettings,hybridStudyIsCurrent} from '../../src/analysis/contingency-hybrid/profile';
import {defaultAnalysisSettings} from '../../src/domain/calculation/analysis-settings';
import {stableJson,identity} from '../../src/domain/calculation/identity';
import {approximationModeProfiles} from '../../src/analysis/short-circuit/mode-profiles';
import {auditScPartition} from '../../src/domain/benchmark/sc-partition';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';
import {validateAcOutages} from '../../src/analysis/contingency-ac';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {acNetwork} from '../helpers/ac-network';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import type {PostMapResults} from '../../src/analysis/contingency-ac/post-results';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {loadBenchmark} from '../../src/importers/powerfactory-benchmark';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {adaptShortCircuitSources} from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import {calculateThreePhase} from '../../src/analysis/short-circuit';

test('selected-set scope handles A+B, boundary, ALL and unresolved endpoints without collapsing parallel lines',()=>{
  const c=(a:string[],b:string[])=>({fromYtmIds:a,toYtmIds:b});
  assert.equal(classifyN1Scope(c(['A'],['B']),['A','B']),'INTERNAL_SELECTED_SET');assert.equal(classifyN1Scope(c(['A'],['C']),['A','B']),'BOUNDARY_SELECTED_SET');assert.equal(classifyN1Scope(c(['A'],['A']),['A','B']),'INTERNAL_SELECTED_SET');assert.equal(classifyN1Scope(c(['A'],['C'])),'INTERNAL_SELECTED_SET');assert.equal(classifyN1Scope(c([],['A']),['A']),'UNKNOWN_SCOPE');assert.equal(classifyN1Scope(c(['A','B'],['A']),['A']),'UNKNOWN_SCOPE');
  const n=acNetwork(2),catalog=buildN1CandidateCatalog(n,emptyScenario(),{includeAllVoltages:true}).candidates.map(r=>({...r,fromYtmIds:['A'],toYtmIds:['B'],voltageLevelsKv:[154,33]}));assert.equal(filterN1CatalogCandidates(catalog,{ytmIds:['A','B'],endpointScope:'INTERNAL',voltageBands:[33]}).length,2);assert.equal(filterN1CatalogCandidates(catalog,{ytmIds:['A','B'],endpointScope:'CONNECTED'}).length,0);assert.equal(filterN1CatalogCandidates(catalog,{ytmIds:['A'],endpointScope:'CONNECTED'}).length,2);
});
test('base/post violations distinguish new, worsened, persistent and relieved values',()=>{
  assert.equal(constraintState(1,.89,.9,1.1),'NEW');assert.equal(constraintState(.85,.8,.9,1.1),'WORSENED');assert.equal(constraintState(.8,.85,.9,1.1),'PERSISTENT');assert.equal(constraintState(.8,1,.9,1.1),'RELIEVED');assert.equal(constraintState(80,120,0,100),'NEW');assert.equal(constraintState(120,121,0,100),'WORSENED');assert.equal(constraintState(120,100,0,100),'RELIEVED');assert.equal(constraintState(90,100,0,100),null);
});
test('unknown ratings, changed bus partitions and unsolved islands never become new violations',()=>{
  const b:PostMapResults={buses:[{terms:['A','B'],vnKv:154,vmPu:.85,angleDeg:0},{terms:['C'],vnKv:33,vmPu:1,angleDeg:0}],branches:[{sourceClass:'ElmLne',fid:'L',pf:1,qf:1,pt:-1,qt:-1,ifA:1,itA:1,loading:{currentPercent:null,apparentPercent:null,operationalPercent:null,basis:'CURRENT_A',season:'nominal',fromLimitA:null,toLimitA:null,ratingMva:null,source:'MISSING',reason:'UNKNOWN_RATING'}}]};
  const post={buses:[{...b.buses[0],terms:['A'],vmPu:.7}],branches:b.branches},rows=comparePostConstraints(b,post,{voltageMinPu:.9,voltageMaxPu:1.1,operationalLoadingLimitPercent:100});assert.deepEqual(rows.map(r=>r.state),['IDENTITY_UNVERIFIED','UNSOLVED_ISLAND','UNKNOWN_RATING']);assert.ok(rows.every(r=>r.delta===null));
});
test('explicit station-off preserves global balancing and the default support safety gate',async()=>{
  const defaults=defaultAnalysisSettings(),off=hybridStudySettings(defaults,'GA_APPROX_STATION_OFF');assert.equal(defaults.powerFlow.stationControlMode,'droop');assert.equal(off.powerFlow.stationControlMode,'off');assert.equal(off.powerFlow.activeBalancingMode,defaults.powerFlow.activeBalancingMode);assert.ok(hybridStudyIsCurrent(stableJson(off),defaults,'GA_APPROX_STATION_OFF'));assert.ok(!hybridStudyIsCurrent(stableJson(off),defaults));
  const n=acNetwork(),s=emptyScenario(),base=await new BrowserJsPowerFlowEngine().runPowerFlow({network:n,scenario:s,identity:identity(n.modelHash,s,'powerFlow')});base.identity=identity(n.modelHash,s,'powerFlow',{analysisSettings:defaults});base.diagnostics.stationControllerSummary={unsupported:1};const blocked=await runHybridN1(n,s,{analysisSettings:defaults,solveBase:async()=>base});assert.equal(blocked.status,'BLOCKED');assert.match(blocked.reason,/stationControlMode=droop/);
});
test('SC electrical table conflict and declared membership are independent native gates',async()=>{
  const pair=syntheticBenchmarkPair(true),b=await loadBenchmark(pair.benchmark),n=(await loadBenchmarkModel(pair.model)).network,sc=await calculateThreePhase(n,emptyScenario(),adaptShortCircuitSources(pair.raw,n),['SYN-B1'],{faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'TEST',edition:null,rfOhm:0,xfOhm:0,maxFaults:1,timeBudgetMs:30000}),f=sc.faults[0];assert.equal(auditScPartition(b,f,sc.profile).matched,true);assert.ok(auditScPartition(b,{...f,physicalTerminalFids:[...f.physicalTerminalFids,...f.physicalTerminalFids]},sc.profile).reasons.includes('SOURCE_PARTITION_MISMATCH'));
  const t=b.groups.SC.tables.SC_CalculationBus_Raw,physical=b.groups.SC.tables.SC_BusResults_Raw,r=physical.rows[1],get=(field:string)=>r[physical.headers.indexOf(field)];t.headers=['calculationBusKey','physicalTerminalCount','representativePhysicalTerminalFid','nominalKv','faultType','calculateMode','resultConflictFlag'];t.rows=[[get('calculationBusKey'),2,'SYN-B1',100,'3PH','MAX',1]];
  // A package is immutable after import; a new package identity rebuilds its index.
  const audit=auditScPartition({...b},f,sc.profile);assert.ok(audit.reasons.includes('RESULT_CONFLICT'));assert.ok(audit.reasons.includes('MISSING_MEMBERS'));assert.ok(auditScPartition({...b},f,{...sc.profile,calculateMode:'MIN'}).reasons.includes('METHOD_MISMATCH'));
});
test('MAX/MIN approximation presets preserve independent user edits and native sources stay distinct',async()=>{
  const profiles=approximationModeProfiles();profiles.MAX.faultFactor=1.07;assert.equal(profiles.MIN.faultFactor,1);profiles.MIN.sourceFactor=.99;assert.equal(profiles.MAX.sourceFactor,1.1);assert.equal(profiles.MAX.faultFactor,1.07);
  const pair=syntheticBenchmarkPair(),n=(await loadBenchmarkModel(pair.model)).network,raw={...pair.raw,ElmXnet:undefined,ElmSym:{Attributes:['FID','bus1','outserv','typ_id','ngnum'],Values:[['G','SYN-CX',0,'T',1]]},TypSym:{Attributes:['FID','rstr','xdss','ugn','sgn'],Values:[['T',.01,.2,100,100]]}};
  assert.equal(adaptShortCircuitSources(raw,n).sources[0].parameterStatus,'NATIVE');const missing={...raw,TypSym:{...raw.TypSym,Values:[['T',.01,'',100,100]]}};assert.equal(adaptShortCircuitSources(missing,n).sources[0].parameterStatus,'UNSUPPORTED');assert.equal(adaptShortCircuitSources(missing,n,undefined,{missingMachineRPu:.01,missingMachineXdssPu:.2,provenance:'EXPLICIT_TEST'}).sources[0].parameterStatus,'ASSUMED');
});
test('empty post buses leave null extrema and cannot increment AC_CALCULATED',async()=>{
  const n=acNetwork(),s=emptyScenario(),r=await runHybridN1(n,s,{catalogCandidateIds:['ElmLne:BYPASS'],solveAllSelected:true,solveOutage:async o=>{const ac=(await validateAcOutages(n,s,[o]))[0];return {...ac,result:{...ac.result!,buses:[]}};}});assert.equal(r.cases[0].status,'BLOCKED');assert.equal(r.cases[0].minVpu,null);assert.equal(r.cases[0].maxVpu,null);assert.equal(r.counts.AC_CALCULATED,0);
});
test('bounded details retain summaries, persist all cases and resume never reruns completed outages',async()=>{
  const n=acNetwork(),s=emptyScenario();let persisted=0,calls=0;const opts={solveAllSelected:true,maxRetainedCaseDetails:1,onCaseDetail:()=>{persisted++;},solveOutage:async(o:import('../../src/analysis/contingency-ac').AcOutage)=>{calls++;return (await validateAcOutages(n,s,[o]))[0];}};const r=await runHybridN1(n,s,opts);assert.equal(persisted,3);assert.equal(r.cases.filter(c=>c.mapResults).length,1);assert.ok(r.cases.every(c=>c.constraintCounts));await runHybridN1(n,s,{...opts,resume:r});assert.equal(calls,3);
});
