import {scAuditFixture} from '../helpers/study-audit';
import {studyEvidence} from '../../src/features/analysis/study-evidence';
import test from 'node:test';
import assert from 'node:assert/strict';
import {acNetwork} from '../helpers/ac-network';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {runYtmStudy,retainStudyFamilies} from '../../src/analysis/ytm-study';
import {currentScResult,selectScMode} from '../../src/domain/results/sc-selection';
import {stableJson} from '../../src/domain/calculation/identity';
import {defaultAnalysisSettings} from '../../src/domain/calculation/analysis-settings';
import type {AppContext} from '../../src/app/contracts';
const network=()=>{const n=acNetwork();return {...n,sites:[{...n.buses[0],id:'TM',areaId:'Y',areaName:'Synthetic YTM',lat:null,lon:null,voltages:[100]}],buses:n.buses.map(b=>({...b,siteIds:['TM']}))};};
const context=(n=network())=>({modelHash:n.modelHash,audit:[],invalidBranches:[],sources:[{sourceClass:'ElmXnet',fid:'SLACK',bus:'B0',inService:true,rOhm:1,xOhm:10,reason:'',sourceRef:'ANALYTIC'}]});
test('N1-only never accesses SC contexts or performs a fault RHS',async()=>{
 const n=network(),contexts=new Proxy({},{get(){throw Error('SC_CONTEXT_ACCESSED');}}),r=await runYtmStudy(n,emptyScenario(),contexts,{ytmId:'Y',profile:'FAST',families:['N1']});assert.equal(r.catalog.length,3);assert.ok(r.n1);assert.equal(r.scMax,null);assert.equal(r.scMin,null);assert.equal(r.faultTargets.length,0);assert.equal(r.stageMs.SC_BATCH,0);
});
test('SC-only never dispatches DC/base/outage calculations and supports an explicit single mode',async()=>{
 const n=network(),c=context(n),r=await runYtmStudy(n,emptyScenario(),{MIN:{...c,calculateMode:'MIN'}},{ytmId:'Y',families:['SC'],scModes:['MIN']},{hybrid:{screen:async()=>{throw Error('N1_CALLED');},solveBase:async()=>{throw Error('AC_CALLED');}}});assert.equal(r.catalog.length,0);assert.equal(r.n1,null);assert.equal(r.scMax,null);assert.equal(r.scMin?.faults.length,3);assert.equal(r.pendingCounts?.SC_MAX,0);assert.equal(r.stageMs.DC_SCREEN,0);
});
test('a single-mode refresh cannot silently pair an opposite mode with unverified source identity',async()=>{
 const n=network(),c=context(n),old=await runYtmStudy(n,emptyScenario(),{MIN:{...c,calculateMode:'MIN'}},{ytmId:'Y',families:['SC'],scModes:['MIN']}),fresh=await runYtmStudy(n,emptyScenario(),{MAX:{...c,sources:c.sources.map(s=>({...s,xOhm:20}))}},{ytmId:'Y',families:['SC'],scModes:['MAX']});
 const r=retainStudyFamilies(fresh,old);assert.equal(r.scMin,null);assert.ok(r.scMax?.faults[0].ikssKa);
});
test('family merge preserves compatible data and rejects changed scope/settings; resume rejects another family',async()=>{
 const n=network(),c=context(n),s=emptyScenario(),settings=defaultAnalysisSettings(),options={ytmId:'Y',profile:'FAST' as const,analysisSettings:settings},sc=await runYtmStudy(n,s,{MAX:c,MIN:c},{...options,families:['SC']}),n1=await runYtmStudy(n,s,{}, {...options,families:['N1']});
 const merged=retainStudyFamilies(n1,sc);assert.equal(merged.scMin,sc.scMin);assert.equal(merged.faultTargets.length,3);assert.equal(merged.n1?.cases.length,3);
 await assert.rejects(runYtmStudy(n,s,{}, {...options,families:['N1']},{resume:sc}),/STALE_RESUME/);
 const changed={...sc,options:{...sc.options,profile:'BALANCED' as const}};assert.equal(retainStudyFamilies({...n1,scMin:null},changed).scMin,null);
 const ctx={network:n,scenario:{current:s},analysisSettings:{value:settings},filters:{areaId:'Y'},studyOptions:options,ytmStudy:sc,scResult:sc.scMax,resultView:{faultId:'B1'}} as unknown as AppContext;
 assert.ok(selectScMode(ctx,'MIN'));assert.equal(currentScResult(ctx),sc.scMin);assert.equal(ctx.scResult?.profile.calculateMode,'MIN');ctx.filters.areaId='OTHER';assert.equal(currentScResult(ctx),null);assert.equal(selectScMode(ctx,'MAX'),false);ctx.filters.areaId='Y';ctx.analysisSettings.value={...settings,powerFlow:{...settings.powerFlow,nodalToleranceKva:10}};assert.equal(currentScResult(ctx),null);assert.notEqual(stableJson(ctx.analysisSettings.value),stableJson(settings));
});
test('a budget-limited retry retains same-context AC with explicit provenance, never across changed scope',async()=>{
 const n=network(),s=emptyScenario(),options={ytmId:'Y',families:['N1' as const]},old=await runYtmStudy(n,s,{},options);assert.ok(old.n1?.cases.some(c=>c.acSolved));
 const retry=await runYtmStudy(n,s,{}, {...options,timeBudgetMs:.001});const merged=retainStudyFamilies(retry,old);assert.ok(merged.n1!.counts.AC_RETAINED>0);assert.equal(merged.n1!.basePost,old.n1!.basePost);assert.equal(merged.n1!.retainedBasePost,true);assert.equal(merged.n1!.counts.AC_CALCULATED_THIS_ATTEMPT,0);assert.ok(merged.n1!.cases.filter(c=>c.acSolved).every(c=>c.retainedFromPrior&&c.reason.includes('RETAINED_SAME_CONTEXT')));
 const different={...old,options:{...old.options,voltageMinPu:.95}};assert.equal(retainStudyFamilies({...retry,n1:{...retry.n1!,cases:retry.n1!.cases.map(c=>({...c,acSolved:false,status:'NOT_EVALUATED_BUDGET' as const}))}},different).n1!.cases.some(c=>c.acSolved),false);
});

test('the evidence header and map both reject a stale workspace SC scope',()=>{
 const f=scAuditFixture(),ctx=f.ctx;ctx.analysisTab='SC';ctx.filters.areaId='A';ctx.scResult=f.result([f.fault(0,'CALCULATED_NETWORK_APPROXIMATION')]);ctx.scResult.workspaceScope={ytmId:'A',optionsKey:'unused',settingsHash:stableJson(ctx.analysisSettings.value)};assert.equal(studyEvidence(ctx).numerical,'ENGINE_CALCULATED');ctx.filters.areaId='OTHER';assert.equal(currentScResult(ctx),null);assert.equal(studyEvidence(ctx).numerical,'STALE_RESULT');
});
