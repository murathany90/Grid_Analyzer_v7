import assert from 'node:assert/strict';
import test from 'node:test';
import type {CanonicalNetwork} from '../../src/domain/model/network';
import {prepareModel} from '../../src/analysis/power-flow/preparation';
import {runStationControlledIslandV73,droopTarget,activeControlRms,solveCoupledLeastSquares} from '../../src/analysis/power-flow/station-controls-v73';
import {allocateReactiveDelta,dispatchedPWeights,stationParticipation} from '../../src/analysis/power-flow/station-participation';
import {solveNR} from '../../src/analysis/power-flow/js/newton';
import {buildY} from '../../src/analysis/power-flow/js/ybus';
import {calcPQ,fillJacobian,makeLayout} from '../../src/analysis/power-flow/js/jacobian';
import {gmres,iluFill} from '../../src/analysis/power-flow/js/linear-solver';
import {solveSensitivityRhs} from '../../src/analysis/power-flow/js/sensitivity-interleaved';
import {APP_VERSION} from '../../src/version';
import packageJson from '../../package.json';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {identity} from '../../src/domain/calculation/identity';
import {emptyScenario} from '../../src/domain/scenario/overlay';

const entity=(id:string,sourceClass='ElmTerm')=>({id,name:id,sourceClass,sourceId:id,inService:true,siteIds:['S'],sourceRefs:{}});
function fixture(multi=true,remote='B3'):CanonicalNetwork {
  const buses=['B0','B1','B2','B3'].map(id=>({...entity(id),vnKv:154,parentId:'S'}));
  const line=(id:string,from:string,to:string)=>({...entity(id,'ElmLne'),from,to,vnKv:154,lengthKm:10,rOhm:1,xOhm:12,bSiemens:0,ratingMva:200,coordinates:[],sections:1});
  const generator=(id:string,bus:string,pMw:number)=>({...entity(id,'ElmSym'),bus,pMw,qMvar:0,vmSet:1.04,voltageControl:true,qMin:-100,qMax:100});
  return {schemaVersion:1,modelHash:'v73',name:'v73',size:0,baseMva:100,buses,lines:[line('L01','B0','B1'),line('L02','B0','B2'),line('L13','B1','B3'),line('L23','B2','B3')],transformers:[],generators:multi?[generator('G1','B1',20),generator('G2','B2',60)]:[generator('G1','B1',20)],loads:[{...entity('D3','ElmLod'),bus:'B3',pMw:70,qMvar:20}],shunts:[],seriesCompensators:[],externalGrids:[{...entity('X0','ElmXnet'),bus:'B0',pMw:0,qMvar:0,vmSet:1}],internationalConnections:[],switches:[],stationControllers:[{...entity('C1','ElmStactrl'),remoteBus:remote,unitIds:multi?['G1','G2']:['G1'],vmSet:1.02,controlModeRaw:0,selectedBusModeRaw:0,distributionModeRaw:0,droopModeRaw:0,qOrientationRaw:0,qSetpointRaw:0,modeSemantics:'CURRENT_PROFILE_VOLTAGE_DISPATCH_P'}],secondaryControllers:[],boundaries:[],sites:[],classCounts:{},records:0,warnings:[],capabilities:{powerFlow:{state:'READY',reasons:[]},shortCircuit3Phase:{state:'BLOCKED',reasons:[]},shortCircuitGround:{state:'BLOCKED',reasons:[]},n1:{state:'BLOCKED',reasons:[]}}};
}
const run=(network:CanonicalNetwork,mode:'off'|'ownership'|'zeroDroop'='zeroDroop')=>{const part=prepareModel(network);return runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],mode);};

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
});
test('package, application engine and calculation identity share one version',()=>{
  assert.equal(packageJson.version,'7.4.0');assert.equal(APP_VERSION,packageJson.version);assert.equal(new BrowserJsPowerFlowEngine().version,APP_VERSION);
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
  assert.ok(q1!=null&&q2!=null);assert.ok(Math.abs(q1/.25-q2/.75)<1e-6);
  assert.ok(Math.abs(c.result.Vm![c.controllers[0].remoteBusIndex!]-1.02)<1e-4);
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
test('integrated Q limit active set clamps one unit and redistributes to its peer',()=>{
  const base=fixture(),network={...base,generators:base.generators.map(g=>g.id==='G1'?{...g,qMin:-.25,qMax:.25}:{...g,qMin:-10000,qMax:10000})},controlled=run(network,'zeroDroop'),row=controlled.controllers[0];
  assert.equal(controlled.result.converged,true);assert.equal(row.status,'SATISFIED');
  assert.equal(Math.abs(controlled.unitOverrides.get('G1')?.qMvar??NaN),.25);assert.ok(Math.abs(controlled.unitOverrides.get('G2')?.qMvar??0)>.25);
  assert.ok(controlled.controlLimitRestarts!>0);assert.ok(Math.abs(controlled.result.Vm![row.remoteBusIndex!]-1.02)<1e-4);assert.equal(controlled.timings.sensitivitySolveMs,0);
});
test('duplicate droop remote bus conflicts return to local PV without competing',()=>{
  const base=fixture(),controllers=[{...base.stationControllers[0],id:'D1',unitIds:['G1'],droopModeRaw:1,ratedPowerRaw:100,droopValueRaw:-4,measurementSelfCubicle:true},{...base.stationControllers[0],id:'D2',unitIds:['G2'],droopModeRaw:1,ratedPowerRaw:100,droopValueRaw:-4,measurementSelfCubicle:true}].map(c=>({...c,sourceClass:'ElmGenStat'}));
  const network={...base,stationControllers:controllers,generators:base.generators.map(g=>({...g,sourceClass:'ElmGenStat'}))};
  const controlled=run(network,'zeroDroop');assert.ok(controlled.controllers.every(c=>c.status==='UNSUPPORTED_DROOP'));
  const droop=(()=>{const part=prepareModel(network);return runStationControlledIslandV73(network,part,part.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],'droop');})();
  assert.ok(droop.controllers.every(c=>c.status==='REMOTE_CONTROL_CONFLICT'));assert.equal(droop.result.converged,true);
});
test('remote voltage target releases after every actuator reaches a Q limit',()=>{
  const base=fixture(false),network={...base,generators:base.generators.map(g=>({...g,qMin:-.25,qMax:.25})),stationControllers:base.stationControllers.map(c=>({...c,vmSet:1.2}))},controlled=run(network),row=controlled.controllers[0];
  assert.equal(controlled.result.converged,true);assert.ok(['SATURATED_QMAX','SATURATED_QMIN'].includes(row.status));
  assert.equal(Math.abs(controlled.unitOverrides.get('G1')?.qMvar??NaN),.25);assert.ok(Math.abs(controlled.result.Vm![row.remoteBusIndex!]-1.2)>1e-3);
  assert.ok(controlled.controlLimitRestarts!>0);assert.equal(controlled.timings.sensitivitySolveMs,0);
});
