import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultAnalysisSettings } from '../../src/domain/calculation/analysis-settings';
import { solveNRWithActiveBalance } from '../../src/analysis/power-flow/station-controls-v73';
import type { NumericModel } from '../../src/analysis/power-flow/preparation';

const model=():NumericModel=>({n:3,baseMVA:100,slack:0,slackVm:1,referencePMw:0,pSpec:Float64Array.from([0,20,-20]),qSpec:Float64Array.from([0,0,-5]),busType:Int8Array.from([2,0,0]),vmSet:Float64Array.from([1,1,1]),shuntG:new Float64Array(3),shuntB:new Float64Array(3),qMinNet:[null,null,null],qMaxNet:[null,null,null],activeBalanceParticipation:Float64Array.from([0,1,0]),activeBalanceEligibleLoadMw:Float64Array.from([0,30,0]),activeBalanceEligibilityComplete:true,branches:[{i:0,j:1,r:.01,x:.1,bch:0,tap:1,phase:0},{i:1,j:2,r:.01,x:.1,bch:0,tap:1,phase:0}]});

test('distributed active balancing assigns mismatch only to sourced adjustable loads and converges external P',()=>{
 const settings=defaultAnalysisSettings().powerFlow;settings.activeBalancingMode='DISTRIBUTED_ADJUSTABLE_LOADS';
 const source=model();source.n=4;source.pSpec=Float64Array.from([0,-20,-60,70]);source.qSpec=Float64Array.from([0,-4,-12,0]);source.busType=Int8Array.from([2,0,0,0]);source.vmSet=Float64Array.from([1,1,1,1]);source.shuntG=new Float64Array(4);source.shuntB=new Float64Array(4);source.qMinNet=[null,null,null,null];source.qMaxNet=[null,null,null,null];source.activeBalanceParticipation=Float64Array.from([0,.25,.75,0]);source.activeBalanceEligibleLoadMw=Float64Array.from([0,20,60,0]);source.branches.push({i:2,j:3,r:.01,x:.1,bch:0,tap:1,phase:0});
 const fixedLoadInjection=source.pSpec[3],result=solveNRWithActiveBalance(source,undefined,settings);
 assert.equal(result.converged,true,result.failure?.message??result.status);
 assert.ok((result.activeBalanceIterations??0)>1);
 assert.ok(Math.abs(result.activeBalanceMismatchMw??Infinity)<=settings.nodalToleranceKva/1000,`mismatch=${result.activeBalanceMismatchMw}, adjustments=${result.activeBalanceLoadAdjustmentsMw}`);
 assert.ok(Math.abs(result.P![0])<settings.nodalToleranceKva/1000);
 assert.equal(source.pSpec[3],fixedLoadInjection,'fixed-load bus specification is not altered');
 assert.ok((result.activeBalanceLoadAdjustmentsMw?.[1]??0)<0,'the adjustable-load bus is scaled down to balance positive external-grid P');
 const first=-(result.activeBalanceLoadAdjustmentsMw?.[1]??0),second=-(result.activeBalanceLoadAdjustmentsMw?.[2]??0);assert.ok(first>0&&second>0);assert.ok(Math.abs(second/first-3)<.03,'eligible loads share active balancing in the sourced 1:3 Pini ratio');
 assert.equal(result.activeBalanceLoadAdjustmentsMw?.[3],0,'the fixed-load bus receives no adjustment');
});

test('distributed active balancing refuses incomplete eligibility instead of treating every load as adjustable',()=>{
 const settings=defaultAnalysisSettings().powerFlow;settings.activeBalancingMode='DISTRIBUTED_ADJUSTABLE_LOADS';
 const source=model();source.activeBalanceEligibilityComplete=false;
 const result=solveNRWithActiveBalance(source,undefined,settings);
 assert.equal(result.converged,true);assert.equal(result.activeBalanceIterations,undefined);assert.ok((result.P?.[0]??0)>0);
});

test('distributed active balancing never reduces sourced adjustable load below zero',()=>{
 const settings=defaultAnalysisSettings().powerFlow;settings.activeBalancingMode='DISTRIBUTED_ADJUSTABLE_LOADS';settings.maxOuterIterations=8;
 const source=model();source.pSpec=Float64Array.from([0,-20,-80]);source.activeBalanceEligibleLoadMw=Float64Array.from([0,20,0]);
 const result=solveNRWithActiveBalance(source,undefined,settings);
 assert.equal(result.converged,true,result.failure?.message??result.status);
 assert.ok(result.warnings?.includes('DISTRIBUTED_ACTIVE_BALANCE_ELIGIBLE_LOADS_EXHAUSTED'));
 assert.equal(result.activeBalanceLoadAdjustmentsMw?.[1],-20,'cumulative shed is bounded by the eligible load present at the start');
 assert.equal(result.activeBalanceLoadAdjustmentsMw?.[2],0,'fixed-load bus is unchanged');
 assert.ok((result.activeBalanceMismatchMw??0)>settings.nodalToleranceKva/1000,'remaining mismatch is reported after the adjustable load saturates');
});
