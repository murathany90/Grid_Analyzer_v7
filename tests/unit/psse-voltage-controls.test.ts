import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeRawx} from '../../src/importers/psse/raw';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import {solvePsseNewton} from '../../src/analysis/psse/newton';
import {psseDroopAtVoltage} from '../../src/analysis/psse/voltage-controls';
import {createPsseScenario} from '../../src/domain/psse/scenario';
import {controlFixture} from '../../tools/psse-v5-fixtures';
function fixture(name:string){const model=decodeRawx(new TextEncoder().encode(controlFixture(name)),name+'.rawx');return{model,network:normalizePsseBusBranch(model)};}
const options={remoteRegulation:true,initialVoltagePolicy:'SOURCE_SAVED' as const,tolerancePu:1e-9,maxIterations:80};
test('augmented Newton controls the actual IREG bus with plant RMPCT and machine P sharing',()=>{
 for(const name of ['remote-single','remote-shared','remote-multi-machine-pg','remote-multi-machine-mbase']){
  const input=fixture(name),before=JSON.stringify(input.network),r=solvePsseNewton({...input,options});assert.equal(r.status,'CONVERGED');assert.equal(r.classification,'SOLVED_APPROXIMATE');assert.ok(Math.abs(r.busResults[2].vmPu!-1.01)<1e-8);assert.equal(JSON.stringify(input.network),before);
  const q=r.generatorResults.map(g=>g.qMvar!);if(name==='remote-shared')assert.ok(Math.abs(q[1]/q[2]-7/3)<1e-7);if(name.endsWith('-pg'))assert.ok(Math.abs(q[2]/q[1]-2)<1e-7);if(name.endsWith('-mbase'))assert.ok(Math.abs(q[2]-q[1])<1e-7);
 }
});
test('Q limits release voltage control and an explicit disabled-limit option retains it',()=>{
 const input=fixture('remote-limit'),limited=solvePsseNewton({...input,options}),unlimited=solvePsseNewton({...input,options:{...options,reactiveLimitsEnabled:false}});
 assert.equal(limited.status,'CONVERGED');assert.equal(limited.generatorResults[1].qMvar,5);assert.equal(limited.generatorResults[1].limitState,'QMAX');assert.ok(limited.busResults[2].vmPu!<1.08-.01);assert.equal(unlimited.status,'CONVERGED');assert.ok(Math.abs(unlimited.busResults[2].vmPu!-1.08)<1e-8);assert.ok(unlimited.generatorResults[1].qMvar!>5);
});
test('Q(V) controller enforces feeder receiving-end reactive power, with deadband and saturation',()=>{
 for(const name of ['droop-low','droop-deadband','droop-high','droop-limit']){
  const input=fixture(name),r=solvePsseNewton({...input,options});assert.equal(r.status,'CONVERGED');assert.equal((r.diagnostics.remoteRegulation as {droopGroups:number}).droopGroups,1);
  const curve={name:'SYNTH_QV',qmin:-80,qmax:100,qdb:0,vlow:.9,vdblow:.98,vdbhigh:1.02,vhigh:1.1},pcc=r.branchResults.find(b=>b.sourceEquipmentId===input.network.branches.find(b=>b.from===1&&b.to===2)!.sourceEquipmentId)!;
  if(name==='droop-limit'){assert.equal(r.generatorResults[1].qMvar,10);assert.equal(r.generatorResults[1].limitState,'QMAX');}
  else{assert.ok(Math.abs(-pcc.qToMvar!-psseDroopAtVoltage(curve,r.busResults[2].vmPu!).q)<1e-6);assert.ok(Math.abs(r.generatorResults[1].qMvar!+pcc.qToMvar!)>.1,'feeder losses must distinguish PCC Q from terminal Q');}
  if(name==='droop-deadband')assert.ok(r.busResults[2].vmPu!>=.98&&r.busResults[2].vmPu!<=1.02);
 }
});
test('scenario re-solve responds to load changes and undo restores exact baseline quantities',()=>{
 const input=fixture('remote-shared'),base=solvePsseNewton({...input,options}),scenario=createPsseScenario(input.network,input.network.loads.map(l=>({equipmentId:l.sourceEquipmentId,action:'LOAD_SCALE' as const,value:1.1}))),changed=solvePsseNewton({...input,scenario,options}),undo=solvePsseNewton({...input,scenario:createPsseScenario(input.network),options});
 assert.equal(changed.status,'CONVERGED');assert.notEqual(changed.generatorResults[1].qMvar,base.generatorResults[1].qMvar);assert.deepEqual(undo.busResults,base.busResults);assert.deepEqual(undo.branchResults,base.branchResults);assert.deepEqual(undo.generatorResults,base.generatorResults);
});
