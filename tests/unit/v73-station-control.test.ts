import assert from 'node:assert/strict';
import test from 'node:test';
import type {CanonicalNetwork} from '../../src/domain/model/network';
import {prepareModel} from '../../src/analysis/power-flow/preparation';
import {runStationControlledIslandV73,droopTarget,activeControlRms,solveCoupledLeastSquares,solveActiveControllerObjective,solveBoundedActiveSetPolish,solveBoundedControllerObjective,solveDirectionConsistentBoundedObjective,partitionControllerDescent,mergeControllerAllocations,globalGradientStep,classifyMonotoneActiveSet,scaleCoupledProposal,runPredictedDescentTrial} from '../../src/analysis/power-flow/station-controls-v73';
import {allocateReactiveDelta,activeParticipation,dispatchedPWeights,interiorParticipation,stationParticipation} from '../../src/analysis/power-flow/station-participation';
import {solveNR} from '../../src/analysis/power-flow/js/newton';
import {buildY} from '../../src/analysis/power-flow/js/ybus';
import {calcPQ,fillJacobian,makeLayout} from '../../src/analysis/power-flow/js/jacobian';
import {gmres,ilu0,iluFill} from '../../src/analysis/power-flow/js/linear-solver';
import {probeAdjointSensitivities,solveSensitivityRhs} from '../../src/analysis/power-flow/js/sensitivity-interleaved';
import {APP_VERSION} from '../../src/version';
import packageJson from '../../package.json';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {identity} from '../../src/domain/calculation/identity';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {defaultAnalysisSettings} from '../../src/domain/calculation/analysis-settings';

const entity=(id:string,sourceClass='ElmTerm')=>({id,name:id,sourceClass,sourceId:id,inService:true,siteIds:['S'],sourceRefs:{}});
test('classification fixed point keeps two controllers in a monotone 5→3→2→2 sequence',()=>{
  const seen:number[]=[],restored:number[]=[];
  const result=classifyMonotoneActiveSet([0,1,2,3,4],active=>{seen.push(active.length);return active.length===5?[3,4]:active.length===3?[2]:[];},failed=>{restored.push(...failed);return true;});
  assert.deepEqual(seen,[5,3,2]);assert.deepEqual(restored,[3,4,2]);
  assert.deepEqual(result.active,[0,1]);assert.equal(result.passes,3);assert.equal(result.stable,true);
});
test('successful second-pass survivors are not rolled back at the classification limit',()=>{
  const removed:number[]=[];
  const result=classifyMonotoneActiveSet([0,1,2,3,4],(active,pass)=>[4,3,2,1].slice(pass-1,pass).filter(id=>active.includes(id)),failed=>{removed.push(...failed);return true;});
  assert.deepEqual(removed,[4,3,2,1]);assert.deepEqual(result.active,[0]);
  assert.equal(result.passes,4);assert.equal(result.stable,false);
});
function fixture(multi=true,remote='B3'):CanonicalNetwork {
  const buses=['B0','B1','B2','B3'].map(id=>({...entity(id),vnKv:154,parentId:'S'}));
  const line=(id:string,from:string,to:string)=>({...entity(id,'ElmLne'),from,to,vnKv:154,lengthKm:10,rOhm:1,xOhm:12,bSiemens:0,ratingMva:200,coordinates:[],sections:1});
  const generator=(id:string,bus:string,pMw:number)=>({...entity(id,'ElmSym'),bus,pMw,qMvar:0,vmSet:1.04,voltageControl:true,qMin:-100,qMax:100});
  return {schemaVersion:1,modelHash:'v73',name:'v73',size:0,baseMva:100,buses,lines:[line('L01','B0','B1'),line('L02','B0','B2'),line('L13','B1','B3'),line('L23','B2','B3')],transformers:[],generators:multi?[generator('G1','B1',20),generator('G2','B2',60)]:[generator('G1','B1',20)],loads:[{...entity('D3','ElmLod'),bus:'B3',pMw:70,qMvar:20}],shunts:[],seriesCompensators:[],externalGrids:[{...entity('X0','ElmXnet'),bus:'B0',pMw:0,qMvar:0,vmSet:1}],internationalConnections:[],switches:[],stationControllers:[{...entity('C1','ElmStactrl'),remoteBus:remote,unitIds:multi?['G1','G2']:['G1'],vmSet:1.02,controlModeRaw:0,selectedBusModeRaw:0,distributionModeRaw:0,droopModeRaw:0,qOrientationRaw:0,qSetpointRaw:0,modeSemantics:'CURRENT_PROFILE_VOLTAGE_DISPATCH_P'}],secondaryControllers:[],boundaries:[],sites:[],classCounts:{},records:0,warnings:[],capabilities:{powerFlow:{state:'READY',reasons:[]},shortCircuit3Phase:{state:'BLOCKED',reasons:[]},shortCircuitGround:{state:'BLOCKED',reasons:[]},n1:{state:'BLOCKED',reasons:[]}}};
}
const run=(network:CanonicalNetwork,mode:'off'|'ownership'|'zeroDroop'='zeroDroop')=>{const part=prepareModel(network);return runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],mode,undefined,'INTEGRATED_EXPERIMENTAL');};

test('current profile participation is dispatched P, with no equal fallback',()=>{
  assert.deepEqual([...dispatchedPWeights([{id:'A',pMw:20},{id:'B',pMw:60}])!],[['A',.25],['B',.75]]);
  assert.equal(dispatchedPWeights([{id:'A',pMw:0},{id:'B',pMw:0}]),null);
  assert.deepEqual(stationParticipation([{id:'A',pMw:20},{id:'B',pMw:60}],[20,80]),{weights:new Map([['A',.2],['B',.8]]),source:'SOURCE_CVQQ'});
});
test('unit Q limits clamp and redistribute the remaining request',()=>{
  const allocation=allocateReactiveDelta([{id:'A',bus:1,pMw:20,qMvar:0,qMin:-5,qMax:5},{id:'B',bus:2,pMw:60,qMvar:0,qMin:-100,qMax:100}],40);
  assert.equal(allocation.qByUnit.get('A'),5);assert.equal(allocation.qByUnit.get('B'),35);assert.equal(allocation.saturated,false);
  const saturated=allocateReactiveDelta([{id:'A',bus:1,pMw:20,qMvar:0,qMin:-5,qMax:5},{id:'B',bus:2,pMw:60,qMvar:0,qMin:-10,qMax:10}],40);
  assert.equal(saturated.appliedDelta,15);assert.equal(saturated.saturated,true);
});
test('sourced cvqq shares govern Q allocation and remain active after a unit saturates',()=>{
  const units=[{id:'A',bus:1,pMw:80,qMvar:0,qMin:-100,qMax:100},{id:'B',bus:2,pMw:20,qMvar:0,qMin:-100,qMax:100}];
  const sourced=stationParticipation(units,[20,80])!;
  assert.equal(sourced.source,'SOURCE_CVQQ');
  const move=allocateReactiveDelta(units,40,sourced.weights);
  assert.ok(Math.abs(move.qByUnit.get('A')!-8)<1e-9);
  assert.ok(Math.abs(move.qByUnit.get('B')!-32)<1e-9);
  const limited=[{...units[0],qMax:5},{...units[1]}];
  const redistributed=allocateReactiveDelta(limited,40,sourced.weights);
  assert.equal(redistributed.qByUnit.get('A'),5);
  assert.ok(Math.abs(redistributed.qByUnit.get('B')!-35)<1e-9);
  assert.deepEqual([...activeParticipation([{...limited[0],qMvar:5},{...limited[1],qMvar:35}],1,sourced.weights)!],[['B',1]]);
});
test('bounded coupled objective retains cross-controller effects at an active Q limit',()=>{
  const result=solveBoundedControllerObjective([[1,1],[1,-1]],[2,0],[-.5,-2],[.5,2],12);
  assert.ok(Math.abs(result.solution[0]-.5)<1e-6);
  assert.ok(Math.abs(result.solution[1]-1)<1e-6);
  assert.ok(result.predictedNorm<.51);
});
test('bounded objective records coordinate sweeps and active-set polish after six sweeps',()=>{
  const easy=solveBoundedControllerObjective([[1,0],[0,2]],[1,-2],[-2,-2],[2,2]);
  assert.equal(easy.converged,true);assert.ok(easy.sweeps<80);assert.ok(easy.projectedGradientNorm<1e-6);
  assert.ok(easy.objectiveEnd<easy.objectiveStart);
  const matrix=[[1,.9],[.9,1]],residual=[1,0],six=solveBoundedControllerObjective(matrix,residual,[-100,-100],[100,100],6),long=solveBoundedControllerObjective(matrix,residual,[-100,-100],[100,100]);
  assert.equal(six.sweeps,6);assert.ok(long.sweeps>6);assert.ok(long.objectiveAtSweeps['5']!>0);assert.ok(long.objectiveEnd<=six.objectiveEnd+1e-12);
  assert.ok(long.activeSetPolishIterations>0);assert.ok(long.objectiveRatio!<1);
});
test('active-set least-squares polish finds an interior optimum',()=>{
  const solved=solveBoundedActiveSetPolish([[1,0],[0,1]],[2,-3],[-5,-5],[5,5],[0,0]);
  assert.equal(solved.converged,true);assert.deepEqual(solved.solution,[2,-3]);
});
test('active-set polish clamps a violating variable and resolves the remaining free subset',()=>{
  const solved=solveBoundedActiveSetPolish([[1,0],[0,1]],[2,3],[-.5,-10],[.5,10],[0,0]);
  assert.equal(solved.converged,true);assert.ok(Math.abs(solved.solution[0]-.5)<1e-10);assert.ok(Math.abs(solved.solution[1]-3)<1e-9);
});
test('active-set polish releases a bound variable when its KKT sign points inward',()=>{
  const solved=solveBoundedActiveSetPolish([[1,1]],[-1],[-1,-.5],[0,1],[0,-.5]);
  assert.equal(solved.converged,true);assert.ok(Math.abs(solved.solution[0]+.5)<1e-9);assert.equal(solved.solution[1],-.5);
});
test('direction rebuild and active-set polish preserve a negative coupled solution',()=>{
  const solved=solveDirectionConsistentBoundedObjective([-1,-1],[1,1],directions=>{
    const first=directions[0]===1?1.01:1,second=directions[1]===1?.99:.98;
    return{matrix:[[first,second],[.99,1]],lower:[-2,-2],upper:[2,2]};
  });
  assert.ok(solved.directionRebuilds>0);assert.equal(solved.directionConsistent,true);assert.ok(solved.activeSetPolishIterations>0);
  assert.ok(solved.solution.every(value=>value<0));assert.ok(solved.solution.every((value,index)=>Math.sign(value)===solved.directions[index]));
});
test('bounded direction rebuild lets a Q-max unit re-enter a negative multi-unit move',()=>{
  const units=[{id:'A',bus:1,pMw:20,qMvar:5,qMin:-20,qMax:5},{id:'B',bus:2,pMw:60,qMvar:0,qMin:-20,qMax:20}];
  const solved=solveDirectionConsistentBoundedObjective([-1],[1],directions=>{
    const weights=activeParticipation(units,directions[0])!,column=[...weights].reduce((sum,[id,share])=>sum+share*(id==='A'?3:1),0);
    return{matrix:[[column]],lower:[-2],upper:[2]};
  });
  assert.equal(solved.directionRebuilds,1);assert.equal(solved.directionConsistent,true);
  assert.deepEqual(solved.directions,[-1]);assert.ok(solved.solution[0]<0);
  assert.deepEqual([...activeParticipation(units,-1)!],[['A',.25],['B',.75]]);
});
test('one stationary controller leaves the movable peer in the coupled retry',()=>{
  const stagnant={id:'stagnant'},movable={id:'movable'},active=[stagnant,movable],partition=partitionControllerDescent(active,new Map([[movable,-2]]));
  assert.deepEqual(partition.stationary,[stagnant]);assert.deepEqual(partition.movable,[movable]);
  assert.deepEqual(active,[stagnant,movable]);
});
test('source participation re-enters a clamped unit when Q direction reverses',()=>{
  const units=[{id:'A',bus:1,pMw:20,qMvar:2,qMin:-20,qMax:5},{id:'B',bus:2,pMw:60,qMvar:3,qMin:-20,qMax:100}];
  const weights=stationParticipation(units,[25,75])!.weights,up=allocateReactiveDelta(units,40,weights);
  assert.equal(up.qByUnit.get('A'),5);assert.equal(up.qByUnit.get('B'),40);
  const down=allocateReactiveDelta(units.map(unit=>({...unit,qMvar:up.qByUnit.get(unit.id)!})),-20,weights);
  assert.equal(down.qByUnit.get('A'),0);assert.equal(down.qByUnit.get('B'),25);
});
test('station participation uses immutable source P when solved P differs',()=>{
  const network=fixture(),generators=network.generators.map((g,i)=>({...g,pDispatchMw:i?60:40,pMw:i?120:5})),modified={...network,generators};
  const part=prepareModel(modified),rows=runStationControlledIslandV73(modified,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],'off').controllers;
  assert.deepEqual(rows[0].participationKi,{G1:.4,G2:.6});
});
test('units at either Q limit do not regain unrestricted participation',()=>{
  const units=[{id:'MIN',bus:1,pMw:20,qMvar:-5,qMin:-5,qMax:5},{id:'MID',bus:2,pMw:60,qMvar:0,qMin:-5,qMax:5},{id:'MAX',bus:3,pMw:20,qMvar:5,qMin:-5,qMax:5}];
  assert.deepEqual([...interiorParticipation(units)!],[['MID',1]]);
  assert.deepEqual([...activeParticipation(units,1)!],[['MIN',.25],['MID',.75]]);
});
test('signed negative droop changes target in the source direction',()=>{
  assert.equal(droopTarget(1.02,25,100,-5),1.0075);
});
test('unavailable, rolled-back and saturated controls leave the active objective',()=>{
  assert.equal(activeControlRms([{status:'PENDING',residual:.02},{status:'ROLLED_BACK_TO_LOCAL_PV',residual:1},{status:'SATURATED_QMAX',residual:1}]),.02);
  assert.equal(activeControlRms([{status:'ROLLED_BACK_TO_LOCAL_PV',residual:1}]),null);
});
test('GMRES checks true residual before accepting a small preconditioned residual',()=>{
  const matrix={N:1,rowPtr:Int32Array.from([0,1]),colIdx:Int32Array.from([0]),values:Float64Array.from([1]),pos:[new Map([[0,0]])],diagPos:Int32Array.from([0])};
  const factor={lu:Float64Array.from([1e12]),diag:Int32Array.from([0]),minPivot:1e12};
  const solved=gmres(matrix,Float64Array.from([1]),factor,1e-8,2,2);
  assert.ok(solved);assert.ok(Math.abs(solved.x[0]-1)<1e-8);assert.ok(solved.residual<1e-8);
});
test('legacy diagnostic sensitivity solver falls back from ILU1 and checks true residual',()=>{
  const matrix={N:1,rowPtr:Int32Array.from([0,1]),colIdx:Int32Array.from([0]),values:Float64Array.from([1]),pos:[new Map([[0,0]])],diagPos:Int32Array.from([0])},weak=iluFill(matrix,1);weak.lu[0]=0;
  let fallbackBuilds=0;const solved=solveSensitivityRhs(matrix,Float64Array.from([1]),weak,()=>{fallbackBuilds++;return iluFill(matrix,2);});
  assert.equal(fallbackBuilds,1);assert.equal(solved.method,'ILU2-GMRES');assert.ok(solved.solution);assert.ok(solved.residual!=null&&solved.residual<=1e-6);
  assert.equal(solved.fallbackCount,1);assert.equal(solved.attempts.length,2);
});
test('ILU reports raw and regularized pivots separately',()=>{
  const matrix={N:2,rowPtr:Int32Array.from([0,1,2]),colIdx:Int32Array.from([0,1]),values:Float64Array.from([0,2]),pos:[new Map([[0,0]]),new Map([[1,1]])],diagPos:Int32Array.from([0,1])};
  const factor=ilu0(matrix);assert.equal(factor.minPivotBeforeRegularization,0);assert.equal(factor.minPivotAfterRegularization,1e-10);assert.equal(factor.regularizedPivotCount,1);
});
test('natural and full RCM adjoint solves preserve sensitivities and true residual with cached remote RHS',()=>{
  const part=prepareModel(fixture()),baseline=solveNR(part.model);assert.equal(baseline.converged,true);
  const model={...part.model,busType:Int8Array.from(part.model.busType),qSpec:Float64Array.from(part.model.qSpec),qMinNet:[...part.model.qMinNet],qMaxNet:[...part.model.qMaxNet]};
  const g1=part.generators.find(g=>g.id==='G1')!.index,g2=part.generators.find(g=>g.id==='G2')!.index,remote=part.buses.findIndex(b=>b.terms.includes('B3')||b.id==='B3');
  for(const bus of [g1,g2]){model.busType[bus]=0;model.qSpec[bus]=baseline.Q![bus];model.qMinNet[bus]=null;model.qMaxNet[bus]=null;}
  const solved=solveNR(model,undefined,{initialVm:baseline.Vm,initialVa:baseline.Va});assert.equal(solved.converged,true);
  const groups=[{remoteBus:remote,actuators:[{bus:g1,weight:.25},{bus:g2,weight:.75}]},{remoteBus:remote,actuators:[{bus:g1,weight:1}]}];
  const natural=probeAdjointSensitivities(model,solved,groups),rcm=probeAdjointSensitivities(model,solved,groups,undefined,{ordering:'RCM'}),legacy=probeAdjointSensitivities(model,solved,groups,undefined,{solver:'LEGACY_KRYLOV'});
  for(let i=0;i<groups.length;i++){
    assert.equal(natural.probes[i].reason,rcm.probes[i].reason);
    assert.ok(Math.abs(natural.probes[i].slope!-rcm.probes[i].slope!)<1e-8);
    assert.ok(Math.abs(natural.probes[i].slope!-legacy.probes[i].slope!)<1e-8);
  }
  for(const batch of [natural,rcm]){
    assert.equal(batch.solverDiagnostics.rhsCount,2);assert.equal(batch.solverDiagnostics.uniqueRemoteRhsCount,1);assert.equal(batch.solverDiagnostics.cachedRhsHits,1);
    assert.ok(batch.solverDiagnostics.rhs[0].trueResidual!<=1e-6);
    assert.equal(Object.values(batch.solverDiagnostics.methodCounts).reduce((sum,count)=>sum+count,0)+Object.values(batch.solverDiagnostics.failureCounts).reduce((sum,count)=>sum+count,0),1);
  }
  assert.equal(natural.solverDiagnostics.ordering,'NATURAL');assert.equal(rcm.solverDiagnostics.ordering,'RCM');
  assert.equal(natural.solverDiagnostics.backend,'KLU_WASM');assert.equal(legacy.solverDiagnostics.backend,'LEGACY_KRYLOV');
});
test('package, application engine and calculation identity share one version',()=>{
  assert.equal(packageJson.version,'8.2.5');assert.equal(APP_VERSION,packageJson.version);assert.equal(new BrowserJsPowerFlowEngine().version,APP_VERSION);
  assert.equal(identity('model',emptyScenario(),'powerFlow').engineVersion,APP_VERSION);
});
test('A/B/C modes separate local PV, ownership and integrated multi-bus station control',()=>{
  const network=fixture(),a=run(network,'off'),b=run(network,'ownership'),c=run(network,'zeroDroop');
  assert.equal(a.result.converged,true);assert.equal(b.result.converged,true);assert.equal(c.result.converged,true);
  assert.equal(a.controllers[0].status,'BASELINE_LOCAL_PV');assert.equal(b.controllers[0].status,'OWNERSHIP_ONLY');
  assert.deepEqual(c.controllers[0].actuatorBuses.length,2);assert.deepEqual(c.controllers[0].participationKi,{G1:.25,G2:.75});
  assert.equal(a.prepared.model.busType[a.prepared.generators[0].index],1);assert.equal(b.prepared.model.busType[b.prepared.generators[0].index],0);
  assert.equal(c.controllers[0].failureReason,null);
  assert.equal(c.integratedControllers,1);assert.equal(c.timings.sensitivitySolveMs,0);assert.equal(c.timings.outerTrialNrMs,0);
  const q1=c.unitOverrides.get('G1')?.qMvar,q2=c.unitOverrides.get('G2')?.qMvar;
  assert.ok(q1!=null&&q2!=null);
  const bus1=partBus(network,'G1'),bus2=partBus(network,'G2');
  assert.ok(Math.abs((q1-a.result.Q![bus1])/.25-(q2-a.result.Q![bus2])/.75)<1e-6);
  assert.ok(Math.abs(c.result.Vm![c.controllers[0].remoteBusIndex!]-1.02)<1e-4);
});
function partBus(network:CanonicalNetwork,id:string):number {const part=prepareModel(network);return part.generators.find(g=>g.id===id)!.index;}
test('integrated ownership starts at solved net Q without double-counting fixed injections',()=>{
  const source=fixture(false),network={...source,loads:[...source.loads,{...entity('D1','ElmLod'),bus:'B1',pMw:3,qMvar:7}],generators:source.generators.map(g=>({...g,qMvar:2,qMin:-10000,qMax:10000}))};
  const part=prepareModel(network),bus=part.generators[0].index,baseline=run(network,'off'),controlled=run(network),dq=(controlled.result.controlDqPu?.[0]??NaN)*part.model.baseMVA;
  assert.equal(baseline.result.converged,true);assert.equal(controlled.result.converged,true);
  assert.ok(Math.abs(controlled.prepared.model.qSpec[bus]-baseline.result.Q![bus])<1e-8);
  assert.ok(Math.abs(controlled.controllers[0].initialQ!-(2+baseline.result.Q![bus]-part.model.qSpec[bus]))<1e-8);
  assert.ok(Math.abs(controlled.unitOverrides.get('G1')!.qMvar!-controlled.controllers[0].initialQ!-dq)<1e-6);
  assert.ok(Math.abs(controlled.result.Q![bus]-controlled.prepared.model.qSpec[bus]-dq)<1e-6);
});
test('single remote controller has P/PQV behavior and finite-difference Q-column sign',()=>{
  const base=fixture(false),network={...base,generators:base.generators.map(g=>({...g,qMin:-10000,qMax:10000}))},part=prepareModel(network),controlled=run(network),row=controlled.controllers[0],bus=part.generators[0].index,remote=row.remoteBusIndex!;
  assert.equal(controlled.result.converged,true);assert.equal(row.status,'SATISFIED');assert.ok(Math.abs(controlled.result.Vm![remote]-1.02)<1e-4);
  assert.ok(Math.abs(controlled.result.Q![bus]-controlled.prepared.model.qSpec[bus]-(controlled.result.controlDqPu?.[0]??0)*100)<1e-4);
  const model=part.model;model.busType[bus]=0;model.busType[remote]=0;const control={remoteBus:remote,targetVmPu:1.02,actuators:[{bus,participation:1}]},Y=buildY(model),layout=makeLayout(Y,model.busType,model.slack,[control]);
  const vm=new Float64Array(model.n).fill(1),va=new Float64Array(model.n),p=new Float64Array(model.n),q=new Float64Array(model.n),values=new Float64Array(layout.colIdx.length);vm[remote]=1.02;
  calcPQ(Y,vm,va,p,q);fillJacobian(Y,layout,vm,va,p,q,values,[control]);
  const coefficient=values[layout.pos[layout.qIndex[bus]].get(layout.controlIndex[0])!],mismatch=(dq:number)=>q[bus]-model.qSpec[bus]/100-dq,eps=1e-6;
  assert.ok(Math.abs(coefficient-((mismatch(eps)-mismatch(0))/eps))<1e-8);assert.equal(coefficient,-1);
});
test('coupled station solve uses cross-controller voltage effects',()=>{
  const matrix=[[1,.5],[.25,1]],target=[1,1],solved=solveCoupledLeastSquares(matrix,target,[100,100]);
  assert.equal(solved.solveStatus,'SOLVED');assert.ok(solved.solution);
  assert.ok(Math.abs(solved.solution[0]-4/7)<1e-9);assert.ok(Math.abs(solved.solution[1]-6/7)<1e-9);
  const coupledResidual=matrix.map((row,i)=>row.reduce((sum,value,j)=>sum+value*solved.solution![j],0)-target[i]);
  const diagonalDelta=matrix.map((row,i)=>target[i]/row[i]),diagonalResidual=matrix.map((row,i)=>row.reduce((sum,value,j)=>sum+value*diagonalDelta[j],0)-target[i]);
  assert.ok(Math.hypot(...coupledResidual)<Math.hypot(...diagonalResidual));
});
test('active five-row objective keeps fixed effects while solving three free columns',()=>{
  const matrix=[[1,0,0,0,0],[1,1,0,0,0],[0,0,1,0,0],[0,0,0,1,1],[0,0,0,0,1]],fixed=new Map([[1,.2],[3,-.1]]),fixedEffects=matrix.map(row=>[...fixed].reduce((sum,[column,delta])=>sum+row[column]*delta,0)),residual=[0,.3,0,0,0].map((value,row)=>value+fixedEffects[row]);
  const solution=solveActiveControllerObjective(matrix,residual,[0,2,4],fixedEffects,[1,1,1]).solution!;
  assert.equal(solution.length,3);assert.ok(Math.abs(solution[0]-.15)<1e-12);assert.ok(Math.abs(solution[1])<1e-12);assert.ok(Math.abs(solution[2])<1e-12);
  const oldNorm=Math.hypot(...residual),predicted=Math.hypot(...matrix.map((row,index)=>residual[index]-fixedEffects[index]-[0,2,4].reduce((sum,column,j)=>sum+row[column]*solution[j],0)));
  assert.ok(predicted<oldNorm);
});
test('fixed Q allocations remain single-owned and cannot re-enter free moves',()=>{
  const units=[{id:'F',bus:1,pMw:1,qMvar:0,qMin:0,qMax:1}],fixed=allocateReactiveDelta(units,2),free=allocateReactiveDelta([{id:'M',bus:2,pMw:1,qMvar:0,qMin:-2,qMax:2}],.5);
  const combined=mergeControllerAllocations(new Map([['fixed',fixed]]),new Map([['free',free]]));
  assert.equal(combined.get('fixed')?.appliedDelta,1);assert.equal(combined.get('free')?.appliedDelta,.5);assert.equal(combined.size,2);
  assert.throws(()=>mergeControllerAllocations(new Map([['fixed',fixed]]),new Map([['fixed',free]])),/CONTROLLER_FIXED_AND_FREE/);
});
test('one global gradient step descends with correlated controller columns',()=>{
  const matrix=[[1,1],[1,1.01],[0,.01]],residual=[.02,.02,0],step=globalGradientStep(matrix,residual);
  const oldNorm=Math.hypot(...residual),predicted=Math.hypot(...matrix.map((row,index)=>residual[index]-row.reduce((sum,value,column)=>sum+value*step[column],0)));
  assert.ok(predicted<oldNorm);assert.ok(step.every(Number.isFinite));
});
test('uniform trust scaling keeps a coupled descent direction and changes the applied Q vector',()=>{
  const n=128,matrix:number[][]=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:i<2&&j<2?.99:0)),target:number[]=Array.from({length:n},(_,i)=>i===0?1:0),scales=Array.from({length:n},(_,i)=>i===1?10:1),raw=solveCoupledLeastSquares(matrix,target,scales).solution!;
  const bounds=Array.from({length:n},(_,i)=>i===0?.25:i===1?2.5:1),clipped=raw.map((value,i)=>Math.max(-bounds[i],Math.min(bounds[i],value)));
  const error=(delta:number[])=>Math.hypot(...target.map((value,i)=>value-matrix[i].reduce((sum,slope,j)=>sum+slope*delta[j],0)));
  const zero=Array<number>(n).fill(0);assert.ok(error(clipped)>error(zero));
  const first=scaleCoupledProposal(raw,bounds),second=scaleCoupledProposal(raw,bounds.map(value=>value/2));
  assert.ok(error(first)<error(zero));assert.ok(error(second)<error(zero));
  assert.ok(Math.max(...second.map(Math.abs))<Math.max(...first.map(Math.abs)));
  assert.ok(first.every((value,i)=>Math.abs(value)<=bounds[i]+1e-12));
  assert.ok(second.every((value,i)=>Math.abs(value)<=bounds[i]/2+1e-12));
});
test('non-descent proposals never invoke a full NR trial callback',()=>{
  let solves=0;const run=()=>{solves++;return 'CONVERGED';};
  const skipped=runPredictedDescentTrial(1,1.01,run);assert.equal(skipped.result,null);assert.ok(skipped.predictedReduction<0);assert.equal(solves,0);
  assert.equal(runPredictedDescentTrial(1,.9,run).result,'CONVERGED');assert.equal(solves,1);
});
test('sensitivity controller accepts a bounded Q step and reduces remote voltage error',()=>{
  const network=fixture(),part=prepareModel(network),controlled=runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],'zeroDroop');
  const row=controlled.controllers[0];assert.ok(controlled.outerRounds>0);assert.equal(controlled.resultProvenance,'SENSITIVITY_STATION_CONTROL');
  assert.ok(Math.abs(row.voltageResidualPu!)<Math.abs(row.targetVpu-row.initialVpu!));
  for(const unit of part.generators){const q=controlled.unitOverrides.get(unit.id)?.qMvar;assert.ok(q!=null&&q>=unit.qMin!-1e-8&&q<=unit.qMax!+1e-8);}
  assert.ok(controlled.trialAttempts?.some(attempt=>attempt.accepted));
});
test('accepted sensitivity Q step leaves a limited unit out of remaining participation',()=>{
  const base=fixture(),network={...base,generators:base.generators.map(g=>g.id==='G1'?{...g,qMin:-.25,qMax:.25}:{...g,qMin:-10000,qMax:10000})},part=prepareModel(network);
  // The tolerance is stated explicitly: the model-equation tolerance now has one typed
  // source with a 0.2 % default, so this case must not depend on which fallback an
  // omitted settings object happens to pick.
  const settings={...defaultAnalysisSettings().powerFlow,modelEquationTolerancePercent:.01};
  const controlled=runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],'zeroDroop',undefined,'SENSITIVITY',settings),row=controlled.controllers[0];
  assert.ok(controlled.outerRounds>0);assert.equal(Math.abs(controlled.unitOverrides.get('G1')?.qMvar??NaN),.25);
  assert.deepEqual(row.participationKi,{G2:1});
});
test('integrated Q limit active set clamps one unit and redistributes to its peer',()=>{
  const base=fixture(),network={...base,generators:base.generators.map(g=>g.id==='G1'?{...g,qMin:-.25,qMax:.25}:{...g,qMin:-10000,qMax:10000})},controlled=run(network,'zeroDroop'),row=controlled.controllers[0];
  assert.equal(controlled.result.converged,true);assert.equal(row.status,'SATISFIED');
  assert.equal(Math.abs(controlled.unitOverrides.get('G1')?.qMvar??NaN),.25);assert.ok(Math.abs(controlled.unitOverrides.get('G2')?.qMvar??0)>.25);
  assert.ok(controlled.controlLimitRestarts!>0);assert.ok(Math.abs(controlled.result.Vm![row.remoteBusIndex!]-1.02)<1e-4);assert.equal(controlled.timings.sensitivitySolveMs,0);
});
test('shared droop remote bus participates in the coupled solve',()=>{
  const base=fixture(),controllers=[{...base.stationControllers[0],id:'D1',unitIds:['G1'],droopModeRaw:1,ratedPowerRaw:100,droopValueRaw:-4,measurementSelfCubicle:true},{...base.stationControllers[0],id:'D2',unitIds:['G2'],droopModeRaw:1,ratedPowerRaw:100,droopValueRaw:-4,measurementSelfCubicle:true}].map(c=>({...c,sourceClass:'ElmGenStat'}));
  const network={...base,stationControllers:controllers,generators:base.generators.map(g=>({...g,sourceClass:'ElmGenStat'}))};
  const controlled=run(network,'zeroDroop');assert.ok(controlled.controllers.every(c=>c.status==='UNSUPPORTED_DROOP'));
  const droop=(()=>{const part=prepareModel(network);return runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],'droop');})();
  assert.ok(droop.controllers.every(c=>c.supported&&c.status!=='REMOTE_CONTROL_CONFLICT'));assert.equal(droop.result.converged,true);
  assert.ok(droop.unitOverrides.has('G1')&&droop.unitOverrides.has('G2'));
});
test('two shared-remote droop units satisfy their measured Q/V equations',()=>{
  const base=fixture(),generators=base.generators.map(g=>({...g,sourceClass:'ElmGenStat',qMin:-200,qMax:200}));
  const controllers=generators.map((g,i)=>({...base.stationControllers[0],id:`D${i+1}`,unitIds:[g.id],vmSet:1.012+i*.001,droopModeRaw:1,ratedPowerRaw:100,droopValueRaw:1,measurementSelfCubicle:true}));
  const network={...base,generators,stationControllers:controllers},part=prepareModel(network);
  const settings=defaultAnalysisSettings().powerFlow;settings.activeBalancingMode='SINGLE_REFERENCE';settings.modelEquationTolerancePercent=.01;
  const solved=runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],'droop',undefined,'SENSITIVITY',settings);
  assert.equal(solved.result.converged,true);
  for(const row of solved.controllers){const unit=generators.find(g=>g.id===row.unitIds[0])!,q=solved.unitOverrides.get(unit.id)?.qMvar;
    assert.ok(q!=null&&q>=unit.qMin!&&q<=unit.qMax!);
    assert.ok(Math.abs(row.targetVpu+q/10000-solved.result.Vm![row.remoteBusIndex!])<1e-4,`${row.id}: residual=${row.voltageResidualPu} q=${q} status=${row.status} rounds=${solved.outerRounds}`);
  }
});
test('zero-width droop Q limit is reported while its shared-remote peer stays eligible',()=>{
  const base=fixture(),generators=base.generators.map((g,i)=>({...g,sourceClass:'ElmGenStat',qMvar:i?0:5,qMin:i?-200:0,qMax:i?200:0}));
  const controllers=generators.map((g,i)=>({...base.stationControllers[0],id:`D${i+1}`,unitIds:[g.id],droopModeRaw:1,ratedPowerRaw:100,droopValueRaw:50,measurementSelfCubicle:true}));
  const network={...base,generators,stationControllers:controllers},part=prepareModel(network);
  const solved=runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],'droop');
  assert.equal(solved.controllers.find(c=>c.id==='D1')?.status,'NO_REACTIVE_HEADROOM');
  assert.equal(solved.controllers.find(c=>c.id==='D2')?.supported,true);
  assert.equal(solved.unitOverrides.get('G1')?.qMvar,0);
  assert.ok(Math.abs(solved.prepared.model.qSpec[part.generators.find(g=>g.id==='G1')!.index]-(part.model.qSpec[part.generators.find(g=>g.id==='G1')!.index]-5))<1e-8);
});
test('remote voltage target releases after every actuator reaches a Q limit',()=>{
  const base=fixture(false),network={...base,generators:base.generators.map(g=>({...g,qMin:-.25,qMax:.25})),stationControllers:base.stationControllers.map(c=>({...c,vmSet:1.2}))},controlled=run(network),row=controlled.controllers[0];
  assert.equal(controlled.result.converged,true);assert.ok(['SATURATED_QMAX','SATURATED_QMIN'].includes(row.status));
  assert.equal(Math.abs(controlled.unitOverrides.get('G1')?.qMvar??NaN),.25);assert.ok(Math.abs(controlled.result.Vm![row.remoteBusIndex!]-1.2)>1e-3);
  assert.ok(controlled.controlLimitRestarts!>0);assert.equal(controlled.timings.sensitivitySolveMs,0);
});
test('one controller reaching a Q limit leaves its peer controller active',()=>{
  const source=fixture(),network={...source,
    generators:source.generators.map(g=>g.id==='G1'?{...g,qMin:-.25,qMax:.25}:{...g,qMin:-10000,qMax:10000}),
    stationControllers:[
      {...source.stationControllers[0],id:'C1',unitIds:['G1'],vmSet:1.2},
      {...source.stationControllers[0],id:'C2',unitIds:['G2'],remoteBus:'B2',vmSet:1.03},
    ],
  },controlled=run(network),byId=new Map(controlled.controllers.map(row=>[row.id,row]));
  assert.equal(controlled.result.converged,true);
  assert.ok(controlled.controlLimitRestarts!>0);
  assert.ok(['SATURATED_QMIN','SATURATED_QMAX'].includes(byId.get('C1')!.status));
  assert.equal(byId.get('C2')!.status,'SATISFIED');
  assert.deepEqual(byId.get('C2')!.participationKi,{G2:1});
  assert.ok(Math.abs(controlled.result.Vm![byId.get('C2')!.remoteBusIndex!]-1.03)<1e-4);
});
test('a member released in the +Q direction can re-enter at the opposite limit',()=>{
  // Two passes through the same station: the first drives the single member to QMAX, the
  // second reverses the station's reactive requirement so that member must be released
  // from QMAX and pushed toward QMIN. A release direction taken from the sign of the
  // previous Q dispatch would keep releasing the wrong bound and never re-enter.
  const base=fixture(false);
  const narrow=(g:CanonicalNetwork['generators'][number])=>({...g,qMin:-.25,qMax:.25});
  // The integrated (V2) station path owns the bidirectional member release logic.
  const runIntegrated=(network:CanonicalNetwork)=>{const part=prepareModel(network);return runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],'zeroDroop',undefined,'INTEGRATED');};
  // First pass: a high remote target pushes Q up until QMAX binds.
  const up={...base,generators:base.generators.map(narrow),stationControllers:base.stationControllers.map(c=>({...c,vmSet:1.2}))};
  const upRun=runIntegrated(up);
  assert.equal(upRun.result.converged,true);
  assert.ok(['SATURATED_QMAX','SATURATED_QMIN'].includes(upRun.controllers[0].status));
  assert.ok(upRun.controlLimitRestarts!>0,'expected active-set restarts in the first pass');
  const upQ=upRun.unitOverrides.get('G1')!.qMvar!;
  assert.ok(Math.abs(Math.abs(upQ)-.25)<1e-6,`first pass did not reach a limit: ${upQ}`);
  const upBound=upQ>0?'QMAX':'QMIN';

  // Second pass: the remote target moves the opposite way, so the same member must be
  // released from its first-pass bound and travel to the other limit.
  const down={...up,stationControllers:base.stationControllers.map(c=>({...c,vmSet:upBound==='QMAX'?.7:1.2}))};
  const downRun=runIntegrated(down);
  assert.equal(downRun.result.converged,true);
  const downQ=downRun.unitOverrides.get('G1')!.qMvar!;
  assert.ok(Math.abs(downQ-upQ)>1e-3,`member did not move away from ${upBound}: ${upQ} -> ${downQ}`);
  assert.ok(Math.abs(Math.abs(downQ)-.25)<1e-6,`reverse pass did not reach the opposite limit: ${downQ}`);
  assert.ok(Math.sign(downQ)!==Math.sign(upQ),`member stayed on the same bound ${upBound}`);
  assert.equal(downRun.controllers[0].releaseDirectionSource,'CONTROLLER_EQUATION_RESIDUAL');
});

test('a station member whose source supplies no limit is reported, not clamped',()=>{
  const base=fixture(false);
  const network={...base,generators:base.generators.map(g=>({...g,qMin:null,qMax:null}))};
  const controlled=run(network),row=controlled.controllers[0];
  assert.equal(row.qLimitAvailability,'MISSING');
  assert.equal(row.boundedUnitCount,0);
  // The Q dispatch comes from the control equation, so the unit still moves.
  assert.equal(controlled.result.converged,true);
  assert.ok(Number.isFinite(controlled.unitOverrides.get('G1')!.qMvar!));
  // No limit state may be invented for a unit the source does not bound.
  assert.notEqual(controlled.unitOverrides.get('G1')!.qState,'QMIN_LIMITED');
  assert.notEqual(controlled.unitOverrides.get('G1')!.qState,'QMAX_LIMITED');
});

test('a station member whose qgini sits outside its source band reports the clamp',()=>{
  const base=fixture(false);
  // qgini = 5 MVAr but the source band is [-0.25, 0.25].
  const network={...base,generators:base.generators.map(g=>({...g,qMvar:5,qDispatchMvar:5,qMin:-.25,qMax:.25}))};
  const part=prepareModel(network);
  const controlled=runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],'zeroDroop',undefined,'INTEGRATED'),row=controlled.controllers[0];
  assert.equal(row.qLimitAvailability,'SOURCE_BOUNDED');
  assert.equal(row.qginiClampCount,1);
  assert.ok(Math.abs((row.qginiClampMvar??0)-4.75)<1e-6);
  // The clamp is visible in the unit result and the unit sits on the source limit.
  assert.ok(Math.abs(Math.abs(controlled.unitOverrides.get('G1')!.qMvar!)-.25)<1e-6);
});

test('production Full AC uses integrated station control when a station mode is selected',async()=>{
  const network=fixture(false),scenario=emptyScenario(),calculationIdentity=identity(network.modelHash,scenario,'powerFlow'),engine=new BrowserJsPowerFlowEngine();
  const production=await engine.runPowerFlow({network,scenario,identity:calculationIdentity}),integrated=await engine.runPowerFlow({network,scenario,identity:calculationIdentity,stationControlMode:'zeroDroop'}),sensitivity=await engine.runPowerFlow({network,scenario,identity:calculationIdentity,stationControlMode:'zeroDroop',stationControlImplementation:'SENSITIVITY'}),experimental=await engine.runPowerFlow({network,scenario,identity:calculationIdentity,stationControlMode:'zeroDroop',stationControlImplementation:'INTEGRATED_EXPERIMENTAL'});
  assert.equal(production.converged,true);assert.equal(production.diagnostics.resultProvenance,'LOCAL_PV');
  assert.equal((production.diagnostics.stationControllerSummary as {mode:string}).mode,'off');
  assert.equal(integrated.converged,true);assert.equal(integrated.diagnostics.resultProvenance,'INTEGRATED_STATION_CONTROL');
  assert.equal((integrated.diagnostics.stationControllerSummary as {implementation:string}).implementation,'INTEGRATED');
  assert.equal(sensitivity.converged,true);assert.equal(sensitivity.diagnostics.resultProvenance,'SENSITIVITY_STATION_CONTROL');
  assert.equal((sensitivity.diagnostics.sensitivitySolver as {ordering:string}).ordering,'NATURAL');
  assert.equal(experimental.converged,true);assert.equal(experimental.diagnostics.resultProvenance,'INTEGRATED_STATION_CONTROL');
  assert.equal((experimental.diagnostics.stationControllerSummary as {implementation:string}).implementation,'INTEGRATED_EXPERIMENTAL');
});
