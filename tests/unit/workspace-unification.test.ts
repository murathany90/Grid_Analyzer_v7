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
test('family merge preserves compatible data and rejects changed scope/settings; resume rejects another family',async()=>{
 const n=network(),c=context(n),s=emptyScenario(),settings=defaultAnalysisSettings(),options={ytmId:'Y',profile:'FAST' as const,analysisSettings:settings},sc=await runYtmStudy(n,s,{MAX:c,MIN:c},{...options,families:['SC']}),n1=await runYtmStudy(n,s,{}, {...options,families:['N1']});
 const merged=retainStudyFamilies(n1,sc);assert.equal(merged.scMin,sc.scMin);assert.equal(merged.faultTargets.length,3);assert.equal(merged.n1?.cases.length,3);
 await assert.rejects(runYtmStudy(n,s,{}, {...options,families:['N1']},{resume:sc}),/STALE_RESUME/);
 const changed={...sc,options:{...sc.options,profile:'BALANCED' as const}};assert.equal(retainStudyFamilies({...n1,scMin:null},changed).scMin,null);
 const ctx={network:n,scenario:{current:s},analysisSettings:{value:settings},filters:{areaId:'Y'},studyOptions:options,ytmStudy:sc,scResult:sc.scMax,resultView:{faultId:'B1'}} as AppContext;
 assert.ok(selectScMode(ctx,'MIN'));assert.equal(currentScResult(ctx),sc.scMin);assert.equal(ctx.scResult?.profile.calculateMode,'MIN');ctx.filters.areaId='OTHER';assert.equal(currentScResult(ctx),null);assert.equal(selectScMode(ctx,'MAX'),false);ctx.filters.areaId='Y';ctx.analysisSettings.value={...settings,powerFlow:{...settings.powerFlow,nodalToleranceKva:10}};assert.equal(currentScResult(ctx),null);assert.notEqual(stableJson(ctx.analysisSettings.value),stableJson(settings));
});
