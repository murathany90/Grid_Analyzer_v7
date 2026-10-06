import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultAnalysisSettings } from '../../src/domain/calculation/analysis-settings';
import { finalizeActiveBalanceAfterControls, solveNRWithActiveBalance, type ActiveBalanceCapture } from '../../src/analysis/power-flow/station-controls-v73';
import { solveNR } from '../../src/analysis/power-flow/js/newton';
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

test('the integrated alpha Newton unknown cannot drive an eligible load below zero',()=>{
 // A single eligible 10 MW load. The distributed-P unknown alpha scales load injection,
 // so an unbounded Newton step could reverse its flow direction. The fraction-to-boundary
 // on alpha keeps every participating eligible load at or above its initial consumption.
 const model=(eligibleLoadMw:number):NumericModel=>({n:2,baseMVA:100,slack:0,slackVm:1,referencePMw:0,
  pSpec:Float64Array.from([0,-eligibleLoadMw]),qSpec:Float64Array.from([0,0]),busType:Int8Array.from([2,0]),vmSet:Float64Array.from([1,1]),
  shuntG:new Float64Array(2),shuntB:new Float64Array(2),qMinNet:[null,null],qMaxNet:[null,null],
  activeBalanceParticipation:Float64Array.from([0,1]),activeBalanceEligibleLoadMw:Float64Array.from([0,eligibleLoadMw]),activeBalanceEligibilityComplete:true,
  branches:[{i:0,j:1,r:.01,x:.1,bch:0,tap:1,phase:0}]});
 const options={integratedEquations:true,integratedActiveBalance:true,settings:{maxInnerIterations:200,maxOuterIterations:8,nodalToleranceKva:5}};
 const result=solveNR(model(10),undefined,options);
 assert.equal(result.status,'CONVERGED_FULL_NR');
 assert.equal(result.activeBalanceLoadAdjustmentsMw?.length,2);
 // Q is unchanged by a P-only balance: the reactive specification is never scaled.
 assert.equal(result.Q?.[1],0);
 // The load may be shed completely but never reversed into generation.
 const netLoad=result.P![1];
 assert.ok(netLoad>=-1e-6,`eligible load reversed into generation: ${netLoad} MW`);
 assert.ok((result.alphaMw??0)<=10+1e-6,`alpha ${result.alphaMw} exceeds the eligible load headroom`);
 // The bound is reported so provenance can show the value actually used.
 assert.equal(result.genericQLimitActiveSet?.alphaBoundPu,10);
 // Warm-starting beyond the bound is clipped back to the physical boundary.
 const over=solveNR(model(10),undefined,{...options,initialAlphaMw:200});
 assert.equal(over.status,'CONVERGED_FULL_NR');
 assert.ok((over.alphaMw??0)<=10+1e-6,`alpha ${over.alphaMw} exceeded the headroom from an over-limit warm start`);
 assert.ok(over.P![1]>=-1e-6);
});

test('the alpha bound is unbounded when no eligible load headroom is declared',()=>{
 const unbounded:NumericModel={...model(),activeBalanceEligibleLoadMw:undefined};
 const result=solveNR(unbounded,undefined,{integratedEquations:true,integratedActiveBalance:false,settings:{maxInnerIterations:50,nodalToleranceKva:5}});
 // Without declared headroom the balance is not applied, so no bound is claimed.
 assert.equal(result.genericQLimitActiveSet?.alphaBoundPu,null);
});

test('Q-only control trials reuse balanced P and final loss correction preserves cumulative load adjustment',()=>{
 const settings=defaultAnalysisSettings().powerFlow;settings.activeBalancingMode='DISTRIBUTED_ADJUSTABLE_LOADS';
 const source=model(),capture:ActiveBalanceCapture={},baseline=solveNRWithActiveBalance(source,undefined,settings,{},capture);
 assert.equal(baseline.converged,true);assert.ok(capture.model&&capture.adjustmentsMw);
 const balanced=capture.model!;balanced.qSpec[2]-=8;
 const counters={fullNrSolves:0,kluNewtonFactorizations:0};
 const qTrial=solveNR(balanced,undefined,{initialVm:baseline.Vm,initialVa:baseline.Va,workCounters:counters});
 assert.equal(qTrial.converged,true);assert.equal(counters.fullNrSolves,1,'one Q trial must not rerun distributed balance');
 const final=finalizeActiveBalanceAfterControls(balanced,qTrial,capture,undefined,settings,{workCounters:counters});
 assert.equal(final.converged,true);assert.ok(Math.abs(final.activeBalanceMismatchMw??Infinity)<=settings.nodalToleranceKva/1000);
 assert.ok((final.activeBalanceIterations??0)>(capture.iterations??0),'changed Q losses require a final P correction');
 assert.ok(counters.fullNrSolves<=1+settings.maxFinalActiveBalanceCorrections*4,'final active balance obeys the typed correction bound');
 assert.ok(Math.abs((final.activeBalanceLoadAdjustmentsMw?.[1]??0)-(capture.adjustmentsMw?.[1]??0))<1,'final correction extends the initial adjustment');
});

test('a carried reference Q limit keeps the angle reference and frees its voltage in the next NR solve',()=>{
 const source=model();source.n=2;source.pSpec=Float64Array.from([0,-20]);source.qSpec=Float64Array.from([0,-5]);source.busType=Int8Array.from([2,0]);source.vmSet=Float64Array.from([1,1]);source.shuntG=new Float64Array(2);source.shuntB=new Float64Array(2);source.qMinNet=[null,null];source.qMaxNet=[null,null];source.branches=[source.branches[0]];
 const first=solveNR(source);
 assert.equal(first.converged,true,first.failure?.message??first.status);
 const limit=first.Q![source.slack]-.01;source.referenceQMinNet=[-100,null];source.referenceQMaxNet=[limit,null];
 const carried=solveNR(source,undefined,{initialVm:first.Vm,initialVa:first.Va,initialLimitedBuses:[{bus:source.slack,qRequired:first.Q![source.slack],qLimit:limit,state:'QMAX_LIMITED'}],settings:{maxInnerIterations:100}});
 assert.equal(carried.converged,true,carried.failure?.message??carried.status);
 assert.ok(carried.pvToPq?.some(row=>row.bus===source.slack&&row.state==='QMAX_LIMITED'));
 assert.ok(Math.abs(carried.Va![source.slack])<1e-12,'the reference angle remains fixed after its Q limit becomes active');
 assert.ok(Math.abs(carried.Vm![source.slack]-source.slackVm)>1e-4,'the Q-limited reference voltage is free to move');
});
