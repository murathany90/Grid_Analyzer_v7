import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeRawx} from '../../src/importers/psse/raw';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import {createPsseScenario} from '../../src/domain/psse/scenario';
import {retainPsseBaseCalculation} from '../../src/domain/psse/base-calculation';
import {solvePsseDc} from '../../src/analysis/psse/dc';
import {syntheticRawx} from '../../tools/psse-synthetic-cases';

test('consecutive scenario operations and undo retain the real empty-scenario baseline',()=>{
 const model=decodeRawx(new TextEncoder().encode(syntheticRawx('basic')),'baseline.rawx'),network=normalizePsseBusBranch(model),baseScenario=createPsseScenario(network),base=solvePsseDc({model,network,scenario:baseScenario}),scenario=createPsseScenario(network,[{action:'STATUS',equipmentId:network.branches[0].sourceEquipmentId,value:0}]),changed=solvePsseDc({model,network,scenario});
 assert.equal(base.status,'CONVERGED');assert.equal(changed.status,'CONVERGED');
 const cached=retainPsseBaseCalculation(null,base,network,model.source.sha256);
 assert.equal(cached,base);
 assert.equal(retainPsseBaseCalculation(cached,changed,network,model.source.sha256),base);
 assert.equal(retainPsseBaseCalculation(cached,{...changed,status:'NON_CONVERGED'},network,model.source.sha256),base);
 assert.equal(retainPsseBaseCalculation(cached,null,network,model.source.sha256),base);
 assert.equal(retainPsseBaseCalculation(cached,null,network,'f'.repeat(64)),null);
 assert.equal(retainPsseBaseCalculation(null,changed,network,model.source.sha256),null);
});
