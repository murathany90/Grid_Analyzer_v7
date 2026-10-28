import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeRawx} from '../../src/importers/psse/raw';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import {solvePsseNewton} from '../../src/analysis/psse/newton';
import {solvePsseDc} from '../../src/analysis/psse/dc';
import {createPsseResultValues} from '../../src/features/psse/result-values';
import {syntheticRawx} from '../../tools/psse-synthetic-cases';

function fixture(){const model=decodeRawx(new TextEncoder().encode(syntheticRawx()),'values.rawx'),network=normalizePsseBusBranch(model);return{model,network};}
test('calculated AC table values reproduce actual solver terminal values and bus generation',()=>{
 const input=fixture(),result=solvePsseNewton(input),values=createPsseResultValues(result);assert.equal(result.status,'CONVERGED');
 for(const bus of input.network.buses){const row=result.busResults.find(row=>row.connectionKey===bus.connectionKey)!;assert.deepEqual(values.bus(bus),{vmPu:row.vmPu,vaDeg:row.vaDeg,pGenerationMw:row.pGenerationMw,qGenerationMvar:row.qGenerationMvar});}
 for(const branch of input.network.branches){const actual=values.branch(branch),row=result.branchResults.find(row=>row.id===branch.id)!;assert.equal(actual.pFromMw,row.pFromMw);assert.equal(actual.qFromMvar,row.qFromMvar);assert.equal(actual.iFromA,row.iFromA);assert.equal(actual.loadingToPct,row.loadingToPct);assert.ok(actual.iFromA!>0);}
});
test('DC publication masks unsupported Vm, Q, current and loading even when an accidental value is present',()=>{
 const input=fixture(),result=solvePsseDc(input);assert.equal(result.status,'CONVERGED');for(const row of result.busResults){row.vmPu=1;row.qGenerationMvar=70;}for(const row of result.branchResults){row.qFromMvar=22;row.qToMvar=-21;row.iFromA=300;row.iToA=299;row.loadingFromPct=70;row.loadingToPct=69;}const values=createPsseResultValues(result);
 const bus=values.bus(input.network.buses[0]);assert.equal(bus.vmPu,null);assert.equal(bus.qGenerationMvar,null);assert.notEqual(bus.vaDeg,null);assert.notEqual(bus.pGenerationMw,null);
 const branch=values.branch(input.network.branches[0]);assert.notEqual(branch.pFromMw,null);for(const key of ['qFromMvar','qToMvar','iFromA','iToA','loadingFromPct','loadingToPct']as const)assert.equal(branch[key],null);
});
test('source-only and failed results never supply calculated table quantities',()=>{
 const input=fixture(),result=solvePsseNewton(input);for(const candidate of [null,...(['NON_CONVERGED','BLOCKED','CANCELLED','ERROR']as const).map(status=>({...result,status}))]){const values=createPsseResultValues(candidate);assert.ok(Object.values(values.bus(input.network.buses[0])).every(value=>value===null));assert.ok(Object.values(values.branch(input.network.branches[0])).every(value=>value===null));}
});
test('same row ID with foreign source or swapped branch terminals cannot be published at another physical object',()=>{
 const input=fixture(),result=solvePsseNewton(input),values=createPsseResultValues(result),branch=input.network.branches[0],bus=input.network.buses[0];
 assert.ok(Object.values(values.branch({...branch,terminalFrom:branch.terminalTo,terminalTo:branch.terminalFrom})).every(value=>value===null));assert.ok(Object.values(values.branch({...branch,sourceEquipmentId:'foreign'})).every(value=>value===null));assert.ok(Object.values(values.bus({...bus,sourceEquipmentId:'foreign'})).every(value=>value===null));
});
