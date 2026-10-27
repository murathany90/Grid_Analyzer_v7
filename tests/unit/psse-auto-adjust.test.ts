import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticRawx} from '../../tools/psse-synthetic-cases';
import {decodeRawx} from '../../src/importers/psse/raw';
import {validatePsse} from '../../src/importers/psse/common';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import {solvePsseNewton} from '../../src/analysis/psse/newton';
import type {PsseModel} from '../../src/importers/psse/types';

function makeCase(name='tap'):{model:PsseModel;network:ReturnType<typeof normalizePsseBusBranch>}{
 const model=decodeRawx(new TextEncoder().encode(syntheticRawx(name)),name+'.rawx');
 validatePsse(model);
 return {model,network:normalizePsseBusBranch(model)};
}
function addSwitchedShunt(model:PsseModel,bus:number,modsw:number,vlo:number,vhi:number){
 model.equipment.push({id:`shunt:switched:${bus}:1`,kind:'shunt',name:'SWITCHED TEST',buses:[bus],status:1,nominalKv:null,
  fields:{subtype:'switched',ibus:bus,shntid:'1',modsw,binit:0,vswhi:vhi,vswlo:vlo,swrem:0,
   blocks:[{steps:3,susceptanceMvar:15},{steps:2,susceptanceMvar:-10}]},operating:{}});
}

test('automatic far-side tap control decreases the winding-1 ratio to raise the controlled voltage and stays converged',()=>{
 const base=makeCase('tap');
 const reference=solvePsseNewton({model:base.model,network:base.network});
 assert.equal(reference.status,'CONVERGED');
 const controlledBus=base.network.buses.find(b=>b.externalNumber===3)!;
 const v0=reference.busResults.find(b=>b.id===controlledBus.id)!.vmPu!;
 const tuned=makeCase('tap');
 const transformer=tuned.model.equipment.find(e=>e.kind==='transformer')!;
 transformer.fields.cod1=1;
 transformer.fields.cont1=3;
 transformer.fields.vma1=v0+.02;
 transformer.fields.vmi1=v0+.01;
 transformer.fields.rma1=1.2;
 transformer.fields.rmi1=.8;
 transformer.fields.ntp1=33;
 const network=normalizePsseBusBranch(tuned.model),branch=network.branches.find(b=>b.kind==='transformer')!;
 assert.ok(branch.tapControl,'tap control must normalize from RAW winding-1 fields');
 assert.equal(branch.tapControl!.regulatedKey,controlledBus.connectionKey);
 assert.equal(branch.tapControl!.regulatesTapSide,false);
 const initialTap=branch.tapFrom;
 const result=solvePsseNewton({model:tuned.model,network,options:{automaticAdjustments:true,maxAdjustmentRounds:40}});
 assert.equal(result.status,'CONVERGED');
 const adjustments=result.diagnostics.adjustments as {tapMoves:number;rounds:number;tapAtLimit:number;rolledBack:boolean};
 assert.ok(adjustments.tapMoves>0,'at least one tap step must move');
 assert.ok(!adjustments.rolledBack);
 const vm=result.busResults.find(b=>b.id===controlledBus.id)!.vmPu!;
 assert.ok(vm>v0,'the controlled voltage must rise');
 assert.ok(vm>=v0+.01-1e-6,'the controlled voltage settles inside the requested band');
 // An unreachable band drives the tap to its minimum ratio, proving the downward far-side direction.
 const extreme=makeCase('tap');
 Object.assign(extreme.model.equipment.find(e=>e.kind==='transformer')!.fields,{cod1:1,cont1:3,vma1:v0+.6,vmi1:v0+.5,rma1:1.2,rmi1:.8,ntp1:33});
 const extremeResult=solvePsseNewton({model:extreme.model,network:normalizePsseBusBranch(extreme.model),options:{automaticAdjustments:true,maxAdjustmentRounds:60}});
 assert.equal(extremeResult.status,'CONVERGED');
 const extremeAdjustments=extremeResult.diagnostics.adjustments as {tapMoves:number;tapAtLimit:number};
 assert.ok(extremeAdjustments.tapAtLimit>0,'the tap must reach its lower ratio limit');
 assert.ok((extremeResult.busResults.find(b=>b.id===controlledBus.id)!.vmPu??0)>v0+.1,'decreasing the winding-1 ratio raises the far-side voltage substantially');
 assert.ok(result.findings.some(f=>f.code==='AUTO_TAP_ADJUSTMENT_APPLIED'));
 assert.ok((result.maxPMismatchPu??1)<1e-6,'the re-solved state keeps the physical mismatch at solver tolerance');
 assert.equal(base.network.branches.find(b=>b.kind==='transformer')!.tapFrom,initialTap,'the input network is not mutated');
});

test('automatic switched-shunt blocks switch in on low voltage and out on high voltage; continuous mode stays untouched',()=>{
 const low=makeCase();
 const reference=solvePsseNewton({model:low.model,network:low.network});
 assert.equal(reference.status,'CONVERGED');
 const bus3=low.network.buses.find(b=>b.externalNumber===3)!;
 const v0=reference.busResults.find(b=>b.id===bus3.id)!.vmPu!;
 const tuned=makeCase();
 addSwitchedShunt(tuned.model,3,1,v0+.005,v0+.02);
 let network=normalizePsseBusBranch(tuned.model);
 const increase=solvePsseNewton({model:tuned.model,network,options:{automaticAdjustments:true,maxAdjustmentRounds:20}});
 assert.equal(increase.status,'CONVERGED');
 assert.ok(increase.findings.some(f=>f.code==='AUTO_SWITCHED_SHUNT_ADJUSTMENT_APPLIED'));
 const raised=increase.busResults.find(b=>b.id===bus3.id)!.vmPu!;
 assert.ok(raised>v0+0.004,'switching in capacitive blocks must raise the bus voltage toward the band');
 const high=makeCase();
 addSwitchedShunt(high.model,3,1,v0-.02,v0-.005);
 network=normalizePsseBusBranch(high.model);
 const decrease=solvePsseNewton({model:high.model,network,options:{automaticAdjustments:true,maxAdjustmentRounds:20}});
 assert.equal(decrease.status,'CONVERGED');
 assert.ok(decrease.findings.some(f=>f.code==='AUTO_SWITCHED_SHUNT_ADJUSTMENT_APPLIED'));
 const lowered=decrease.busResults.find(b=>b.id===bus3.id)!.vmPu!;
 assert.ok(lowered<v0-0.004,'switching in reactor blocks must lower the bus voltage toward the band');
 const continuous=makeCase();
 addSwitchedShunt(continuous.model,3,2,v0-.02,v0-.005);
 network=normalizePsseBusBranch(continuous.model);
 const untouched=solvePsseNewton({model:continuous.model,network,options:{automaticAdjustments:true}});
 assert.equal(untouched.status,'CONVERGED');
 assert.ok(untouched.findings.some(f=>f.code==='SWITCHED_SHUNT_CONTINUOUS_MODE_NOT_ADJUSTED'));
 assert.ok(!(untouched.diagnostics.adjustments as {shuntMoves:number}).shuntMoves);
});

test('without automatic adjustments the NR profile is unchanged and emits no adjustment findings',()=>{
 const base=makeCase('tap');
 const before=solvePsseNewton({model:base.model,network:base.network});
 const after=solvePsseNewton({model:base.model,network:base.network,options:{automaticAdjustments:true}});
 assert.equal(after.status,'CONVERGED');
 assert.ok(!(after.diagnostics.adjustments as {tapMoves:number}).tapMoves);
 assert.ok(!after.findings.some(f=>f.code.startsWith('AUTO_')));
 assert.deepEqual(after.busResults,before.busResults);
});
