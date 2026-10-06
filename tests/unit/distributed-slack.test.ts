import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultAnalysisSettings } from '../../src/domain/calculation/analysis-settings';
import { finalizeActiveBalanceAfterControls, solveNRWithActiveBalance, type ActiveBalanceCapture } from '../../src/analysis/power-flow/station-controls-v73';
import { alphaLoadReductionBound, solveNR } from '../../src/analysis/power-flow/js/newton';
import { Q_LIMITS_MISSING_CODE, stationSourceFidelityOf } from '../../src/analysis/power-flow/station-participation';
import { prepareModel } from '../../src/analysis/power-flow/preparation';
import { runStationControlledIslandV73 } from '../../src/analysis/power-flow/station-controls-v73';
import { BrowserJsPowerFlowEngine } from '../../src/analysis/api/browser-js-engine';
import { identity } from '../../src/domain/calculation/identity';
import { emptyScenario } from '../../src/domain/scenario/overlay';
import type { CanonicalNetwork } from '../../src/domain/model/network';
import type { NumericModel } from '../../src/analysis/power-flow/preparation';

const entity=(id:string,sourceClass='ElmTerm')=>({id,name:id,sourceClass,sourceId:id,inService:true,siteIds:['S'],sourceRefs:{}});
/** Single-generator station, small enough to reason about exactly. */
function stationFixture(generatorLimits:{qMin:number|null;qMax:number|null}):CanonicalNetwork{
  const buses=['B0','B1','B2','B3'].map(id=>({...entity(id),vnKv:154,parentId:'S'}));
  const line=(id:string,from:string,to:string)=>({...entity(id,'ElmLne'),from,to,vnKv:154,lengthKm:10,rOhm:1,xOhm:12,bSiemens:0,ratingMva:200,coordinates:[] as [number,number][],sections:1});
  const generator=(id:string,bus:string,pMw:number)=>({...entity(id,'ElmSym'),bus,pMw,qMvar:0,vmSet:1.04,voltageControl:true,...generatorLimits});
  return {schemaVersion:1,modelHash:'slack',name:'slack',size:0,baseMva:100,buses,
   lines:[line('L01','B0','B1'),line('L02','B0','B2'),line('L13','B1','B3'),line('L23','B2','B3')],
   transformers:[],generators:[generator('G1','B1',20)],
   loads:[{...entity('D3','ElmLod'),bus:'B3',pMw:70,qMvar:20}],shunts:[],seriesCompensators:[],
   externalGrids:[{...entity('X0','ElmXnet'),bus:'B0',pMw:0,qMvar:0,vmSet:1}],
   internationalConnections:[],switches:[],
   stationControllers:[{...entity('C1','ElmStactrl'),remoteBus:'B3',unitIds:['G1'],vmSet:1.02,controlModeRaw:0,selectedBusModeRaw:0,distributionModeRaw:0,droopModeRaw:0,qOrientationRaw:0,qSetpointRaw:0,modeSemantics:'CURRENT_PROFILE_VOLTAGE_DISPATCH_P'}],
   secondaryControllers:[],boundaries:[],sites:[],classCounts:{},records:0,warnings:[],
   capabilities:{powerFlow:{state:'READY' as const,reasons:[]},shortCircuit3Phase:{state:'BLOCKED' as const,reasons:[]},shortCircuitGround:{state:'BLOCKED' as const,reasons:[]},n1:{state:'BLOCKED' as const,reasons:[]}}};
}
const engineRun=async(network:CanonicalNetwork)=>{
  const engine=new BrowserJsPowerFlowEngine(),scenario=emptyScenario();
  return engine.runPowerFlow({network,scenario,identity:identity(network.modelHash,scenario,'powerFlow'),analysisSettings:defaultAnalysisSettings(),stationControlMode:'zeroDroop',stationControlImplementation:'INTEGRATED'});
};

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

/**
 * Two-bus model with a single eligible load, so the alpha unknown is directly observable.
 *
 * `generatorMw` is the reference-bus dispatch: negative alpha raises load, positive alpha
 * sheds it, and the reference P target stays at 0, so an export surplus forces one or the
 * other depending on the surplus.
 */
const singleEligibleLoad=(eligibleLoadMw:number,generatorMw=0):NumericModel=>({n:2,baseMVA:100,slack:0,slackVm:1,referencePMw:0,
 pSpec:Float64Array.from([generatorMw,-eligibleLoadMw]),qSpec:Float64Array.from([0,0]),busType:Int8Array.from([2,0]),vmSet:Float64Array.from([1,1]),
 shuntG:new Float64Array(2),shuntB:new Float64Array(2),qMinNet:[null,null],qMaxNet:[null,null],
 activeBalanceParticipation:Float64Array.from([0,1]),activeBalanceEligibleLoadMw:Float64Array.from([0,eligibleLoadMw]),activeBalanceEligibilityComplete:true,
 branches:[{i:0,j:1,r:.01,x:.1,bch:0,tap:1,phase:0}]});
const integratedOptions={integratedEquations:true,integratedActiveBalance:true,settings:{maxInnerIterations:300,maxOuterIterations:8,nodalToleranceKva:5}};

test('the integrated alpha Newton unknown cannot drive an eligible load below zero',()=>{
 // A single eligible 10 MW load. The distributed-P unknown alpha scales load injection,
 // so an unbounded Newton step could reverse its flow direction. The one-sided
 // fraction-to-boundary on alpha keeps every participating eligible load at or above zero.
 const model=singleEligibleLoad;
 const options=integratedOptions;
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

test('a station controller without a source Q limit still solves but is not source-exact',()=>{
 const network=stationFixture({qMin:null,qMax:null});
 const part=prepareModel(network);
 const controlled=runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],'zeroDroop',undefined,'INTEGRATED'),row=controlled.controllers[0];
 // The numerical solve is allowed to proceed: the dispatch comes from the control equation.
 assert.equal(controlled.result.converged,true);
 assert.ok(Number.isFinite(controlled.unitOverrides.get('G1')!.qMvar!));
 // The voltage equation is genuinely satisfied, so the solve status stays SATISFIED:
 // the missing capability is a source-fidelity fact, not an unsolved control equation.
 assert.equal(row.status,'SATISFIED');
 assert.equal(row.qLimitAvailability,'MISSING');
 assert.equal(row.boundedUnitCount,0);
 assert.equal(stationSourceFidelityOf([row]),'PARTIAL_SOURCE_FIDELITY');
 assert.equal(Q_LIMITS_MISSING_CODE,'Q_LIMITS_MISSING');
 // No limit state may be invented for an unbounded member.
 assert.notEqual(controlled.unitOverrides.get('G1')!.qState,'QMIN_LIMITED');
 assert.notEqual(controlled.unitOverrides.get('G1')!.qState,'QMAX_LIMITED');
 // A bounded station stays source-exact.
 assert.equal(stationSourceFidelityOf([{qLimitAvailability:'SOURCE_BOUNDED'}]),'SOURCE_BOUNDED');
});

test('a missing source Q limit is reported as PARTIAL_SOURCE_FIDELITY, not as full comparability',async()=>{
 const network=stationFixture({qMin:null,qMax:null});
 const result=await engineRun(network);
 const convergence=(result.diagnostics as Record<string,unknown>).convergence as Record<string,string>;
 // Numerically converged...
 assert.equal(convergence.newtonRaphson,'NR_CONVERGED');
 // The station control itself converges: the voltage equation is met.
 assert.equal(convergence.stationControl,'STATION_CONTROL_CONVERGED');
 // ...but the source capability is unresolved, so it is not source-exact and not fully
 // comparable. Convergence per concern and source fidelity are reported separately.
 assert.equal(convergence.sourceFidelity,'PARTIAL_SOURCE_FIDELITY');
 assert.notEqual(convergence.powerFactoryComparability,'COMPARABLE');
 const summary=(result.diagnostics as Record<string,any>).stationControllerSummary;
 assert.equal(summary.stationSourceFidelity,'PARTIAL_SOURCE_FIDELITY');
 assert.ok(summary.missingSourceQLimit.controllerCount>=1);
 assert.equal(summary.missingSourceQLimit.code,'Q_LIMITS_MISSING');
 // A station whose source supplies limits is source-exact, so comparability is decided only
 // by the remaining concerns (this fixture has no adjustable load, so the active balance is
 // separately partial).
 const bounded=await engineRun(stationFixture({qMin:-5,qMax:5}));
 const boundedConvergence=(bounded.diagnostics as Record<string,unknown>).convergence as Record<string,string>;
 assert.equal(boundedConvergence.sourceFidelity,'SOURCE_BOUNDED');
 assert.equal(((bounded.diagnostics as Record<string,any>).stationControllerSummary).stationSourceFidelity,'SOURCE_BOUNDED');
 assert.notEqual(boundedConvergence.powerFactoryComparability,'PARTIAL_SOURCE_FIDELITY');
});

test('the alpha bound is one-sided: load reduction is bounded, load increase is not',()=>{
 // Bound arithmetic: min(L_i / w_i) over participating buses, in MW.
 assert.equal(alphaLoadReductionBound(Float64Array.from([0,1]),Float64Array.from([0,10]),2),10);
 assert.equal(alphaLoadReductionBound(Float64Array.from([0,.5,.5]),Float64Array.from([0,30,60]),3),60);
 // A bus with no eligible load must not produce a zero bound, and a zero weight is skipped.
 assert.equal(alphaLoadReductionBound(Float64Array.from([0,1,0]),Float64Array.from([0,10,0]),3),10);
 assert.equal(alphaLoadReductionBound(undefined,Float64Array.from([0,10]),2),Infinity);
 assert.equal(alphaLoadReductionBound(Float64Array.from([0,1]),undefined,2),Infinity);

 // A positive alpha (load reduction) cannot reverse load direction.
 const reduced=solveNR(singleEligibleLoad(10),undefined,{...integratedOptions,initialAlphaMw:200});
 assert.equal(reduced.status,'CONVERGED_FULL_NR');
 assert.ok((reduced.P![1]>=-1e-6),`load reversed into generation: ${reduced.P![1]} MW`);
 assert.ok((reduced.alphaMw??0)<=10+1e-6);
 assert.equal(reduced.genericQLimitActiveSet?.alphaBoundPu,10);

 // A negative alpha raises load. No sourced maximum load exists, so this direction must
 // not be bounded by the reduction bound. A 50 MW export surplus against a 10 MW load must
 // reach roughly -40 MW; a symmetric bound would have stopped it at -10.
 const increased=solveNR(singleEligibleLoad(10,50),undefined,integratedOptions);
 assert.equal(increased.status,'CONVERGED_FULL_NR');
 assert.ok((increased.alphaMw??0)<-30,`negative alpha was artificially bounded at ${increased.alphaMw}`);
 assert.ok(increased.P![1]<-40,`load did not increase: ${increased.P![1]} MW`);
 // The reduction bound is still reported, and it was never applied in this direction.
 assert.equal(increased.genericQLimitActiveSet?.alphaBoundPu,10);
 assert.equal(increased.genericQLimitActiveSet?.alphaBoundApplied,false);
 // Q is untouched by a P-only balance in either direction: the reactive specification is
 // never scaled with the load, so the solved Q stays at the sourced value plus line loss.
 assert.ok(Math.abs(increased.Q![1])<1,`Q was scaled with the P balance: ${increased.Q![1]} MVAr`);
 assert.ok(Math.abs(reduced.Q![1])<1,`Q was scaled with the P balance: ${reduced.Q![1]} MVAr`);
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
