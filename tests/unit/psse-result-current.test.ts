import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeRawx} from '../../src/importers/psse/raw';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import {createPsseScenario} from '../../src/domain/psse/scenario';
import {psseCalculationIdentity,psseTopologyHash} from '../../src/domain/psse/identity';
import {isCurrentPsseResult,type PsseCalculationResult} from '../../src/domain/psse/results';
import {effectivePsseNetwork,solvePsseNewton} from '../../src/analysis/psse/newton';
import {solvePsseFdns} from '../../src/analysis/psse/fdns';
import {solvePsseDc} from '../../src/analysis/psse/dc';
import {getPsseDiagramSnapshot} from '../../src/features/psse/diagram-utils';
import type {AppContext} from '../../src/app/contracts';
import {syntheticRawx} from '../../tools/psse-synthetic-cases';
function fixture(){const model=decodeRawx(new TextEncoder().encode(syntheticRawx('basic')),'identity.rawx'),network=normalizePsseBusBranch(model),scenario=createPsseScenario(network);return{model,network,scenario,current:{sourceSha256:model.source.sha256,network,effectiveNetwork:effectivePsseNetwork(network,scenario),scenario}};}
function sign(result:PsseCalculationResult){const {schema,id,...body}=result.identity;void schema;void id;result.identity=psseCalculationIdentity(body);result.id=result.identity.id;return result;}

test('current-result guard admits actual NR FDNS DC and their scenario-specific topology',()=>{
 const f=fixture();for(const solve of [solvePsseNewton,solvePsseFdns,solvePsseDc]){const r=solve(f);assert.equal(r.status,'CONVERGED');assert.equal(isCurrentPsseResult(r,{...f.current,method:r.method,optionsHash:r.identity.optionsHash}),true);}
 const scenario=createPsseScenario(f.network,[{equipmentId:f.network.branches[0].sourceEquipmentId,action:'STATUS',value:0}]),effectiveNetwork=effectivePsseNetwork(f.network,scenario),r=solvePsseDc({...f,scenario});assert.notEqual(psseTopologyHash(effectiveNetwork),psseTopologyHash(f.network));assert.equal(isCurrentPsseResult(r,{...f.current,scenario,effectiveNetwork}),true);assert.equal(isCurrentPsseResult(r,f.current),false);
});

test('old-engine foreign-source topology method option and ID results cannot publish or color a PSS/E diagram',()=>{
 const f=fixture(),r=solvePsseDc(f),mutations:((copy:PsseCalculationResult)=>void)[]=[
  copy=>{copy.identity.engineVersion='GA_PSSE_ENGINE_1';sign(copy);},
  copy=>{copy.identity.sourceSha256='0'.repeat(64);sign(copy);},
  copy=>{copy.identity.topologyHash='0'.repeat(64);sign(copy);},
  copy=>{copy.identity.normalizedModelHash='0'.repeat(64);sign(copy);},
  copy=>{copy.identity.solver='NR_POLAR';sign(copy);},
  copy=>{copy.identity.algorithmId='FDNS_XB';sign(copy);},
  copy=>{copy.identity.optionsHash='0'.repeat(64);sign(copy);},
  copy=>{copy.identity.id='psse-corrupt';copy.id=copy.identity.id;},
  copy=>{copy.id='psse-foreign';}
 ];
 for(const mutate of mutations){const copy=structuredClone(r);mutate(copy);assert.equal(isCurrentPsseResult(copy,{...f.current,method:'LOSSLESS_DC',optionsHash:r.identity.optionsHash}),false);if(copy.identity.optionsHash===r.identity.optionsHash){const ctx={psseNetwork:f.network,psseInspection:f.model,psseScenario:f.scenario,psseCalculation:copy}as unknown as AppContext;assert.equal(getPsseDiagramSnapshot(ctx)?.calculation,null);}}
 assert.equal(isCurrentPsseResult(r,{...f.current,method:'NR_POLAR'}),false);assert.equal(isCurrentPsseResult(r,{...f.current,optionsHash:'f'.repeat(64)}),false);
 const ctx={psseNetwork:f.network,psseInspection:f.model,psseScenario:f.scenario,psseCalculation:r}as unknown as AppContext;assert.equal(getPsseDiagramSnapshot(ctx)?.calculation,r);
});
