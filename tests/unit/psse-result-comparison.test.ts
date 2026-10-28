import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeRawx} from '../../src/importers/psse/raw';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import {createPsseScenario} from '../../src/domain/psse/scenario';
import {psseCalculationIdentity} from '../../src/domain/psse/identity';
import type {PsseCalculationResult} from '../../src/domain/psse/results';
import {effectivePsseNetwork,solvePsseNewton} from '../../src/analysis/psse/newton';
import {solvePsseDc} from '../../src/analysis/psse/dc';
import {getPsseResultComparison,psseFiniteDelta} from '../../src/features/psse/result-comparison';
import type {PsseDiagramSnapshot} from '../../src/features/psse/diagram-utils';
import {syntheticRawx} from '../../tools/psse-synthetic-cases';

function fixture(){const model=decodeRawx(new TextEncoder().encode(syntheticRawx()),'comparison.rawx'),network=normalizePsseBusBranch(model),baseScenario=createPsseScenario(network),scenario=createPsseScenario(network,[{action:'STATUS',equipmentId:network.branches[0].sourceEquipmentId,value:0}]),base=solvePsseNewton({model,network,scenario:baseScenario}),calculation=solvePsseNewton({model,network,scenario}),snapshot:PsseDiagramSnapshot={base:network,network:effectivePsseNetwork(network,scenario),model,scenario,calculation,lastCalculation:calculation};return{model,network,baseScenario,base,snapshot};}
function resign(result:PsseCalculationResult){const {schema,id,...body}=result.identity;void schema;void id;result.identity=psseCalculationIdentity(body);result.id=result.identity.id;return result;}

test('compatible empty base and current scenario solves permit differences; missing quantities stay blank',()=>{
 const {base,snapshot}=fixture(),comparison=getPsseResultComparison(snapshot,base);assert.equal(comparison.ready,true);assert.equal(comparison.base,base);assert.equal(comparison.scenario,snapshot.calculation);assert.equal(psseFiniteDelta(5,8),3);assert.equal(psseFiniteDelta(null,8),null);assert.equal(psseFiniteDelta(5,undefined),null);assert.equal(psseFiniteDelta(NaN,8),null);
});
test('previous non-base scenarios, stale engines, foreign topology and changed numerical settings cannot produce a delta',()=>{
 const {model,network,base,snapshot}=fixture();
 for(const mutation of [(r:PsseCalculationResult)=>{r.identity.scenarioHash=snapshot.scenario.hash;},(r:PsseCalculationResult)=>{r.identity.engineVersion='OLD_ENGINE';},(r:PsseCalculationResult)=>{r.identity.topologyHash='0'.repeat(64);},(r:PsseCalculationResult)=>{r.identity.optionsHash='0'.repeat(64);},(r:PsseCalculationResult)=>{r.identity.algorithmRevision='different';}]){const copy=structuredClone(base);mutation(copy);resign(copy);assert.equal(getPsseResultComparison(snapshot,copy).ready,false);}
 const dc=solvePsseDc({model,network,scenario:createPsseScenario(network)});assert.equal(getPsseResultComparison(snapshot,dc).ready,false);
});
test('failed or blocked scenario/base results never become a successful comparison',()=>{
 const {base,snapshot}=fixture();for(const status of ['NON_CONVERGED','BLOCKED','ERROR','CANCELLED']as const){assert.equal(getPsseResultComparison({...snapshot,calculation:{...snapshot.calculation!,status}},base).ready,false);assert.equal(getPsseResultComparison(snapshot,{...base,status}).ready,false);}
 assert.equal(getPsseResultComparison({...snapshot,calculation:{...snapshot.calculation!,physicsCoverage:'BLOCKED'}},base).ready,false);
});
test('the base-only view admits its own current solve but has no invented scenario difference',()=>{
 const {base,baseScenario,network,snapshot}=fixture(),comparison=getPsseResultComparison({...snapshot,network,scenario:baseScenario,calculation:base},null);assert.equal(comparison.base,base);assert.equal(comparison.scenario,null);assert.equal(comparison.ready,false);
});
