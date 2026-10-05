import assert from 'node:assert/strict';
import test from 'node:test';
import type {IntegratedStationControl,NumericalModel} from '../../src/analysis/power-flow/js/types';
import {solveNR} from '../../src/analysis/power-flow/js/newton';

const model=():NumericalModel=>({n:4,baseMVA:100,slack:0,slackVm:1,
 pSpec:Float64Array.from([0,35,-25,-12]),qSpec:Float64Array.from([0,4,-9,-5]),busType:Int8Array.from([2,0,0,0]),vmSet:Float64Array.from([1,1,1,1]),
 shuntG:new Float64Array(4),shuntB:new Float64Array(4),qMinNet:[null,null,null,null],qMaxNet:[null,null,null,null],
 activeBalanceEligibilityComplete:true,activeBalanceParticipation:Float64Array.from([0,0,.4,.6]),
 branches:[[0,1],[1,2],[2,3],[0,3],[1,3]].map(([i,j],k)=>({i,j,r:.012+k*.001,x:.1+k*.007,bch:.008,tap:1,phase:0}))});

test('explicit zero droop and distributed P balance solve one sparse AC state',()=>{
 const control:IntegratedStationControl={remoteBus:3,targetVmPu:1.025,actuators:[{bus:1,participation:1}]};
 const result=solveNR(model(),undefined,{stationControls:[control],integratedEquations:true,integratedActiveBalance:true});
 assert.equal(result.converged,true,JSON.stringify(result.failure));
 assert.ok(Math.abs(result.Vm![3]-1.025)<1e-6);
 assert.ok(Math.abs(result.P![0])<.001);
 assert.ok(Math.abs(result.Q![1]-4-result.controlDqPu![0]*100)<.001);
 assert.ok(Math.abs(result.activeBalanceLoadAdjustmentsMw![2]/result.activeBalanceLoadAdjustmentsMw![3]-2/3)<1e-8);
});

test('signed droop and shared remote control retain independent Q equations',()=>{
 const controls:IntegratedStationControl[]=[
  {remoteBus:3,targetVmPu:1.025,actuators:[{bus:1,participation:1}]},
  {remoteBus:3,targetVmPu:1.02,droopQmvar:-500,measurementQmvar:2,measurementParticipation:1,actuators:[{bus:2,participation:1}]},
 ];
 const result=solveNR(model(),undefined,{stationControls:controls,integratedEquations:true,integratedActiveBalance:true});
 assert.equal(result.converged,true,JSON.stringify(result.failure));
 assert.ok(Math.abs(result.Vm![3]-1.025)<1e-6);
 assert.ok(Math.abs(1.02+(2+result.controlDqPu![1]*100)/-500-result.Vm![3])<1e-6);
 assert.ok(Math.abs(result.P![0])<.001);
});

test('an island with no adjustable loads keeps the reference P free',()=>{
 const source=model();source.activeBalanceParticipation=new Float64Array(source.n);
 const control:IntegratedStationControl={remoteBus:3,targetVmPu:1.025,actuators:[{bus:1,participation:1}]};
 const result=solveNR(source,undefined,{stationControls:[control],integratedEquations:true,integratedActiveBalance:true});
 assert.equal(result.converged,true,JSON.stringify(result.failure));
 assert.equal(result.activeBalanceIterations,undefined);
 assert.ok(Math.abs(result.Vm![3]-1.025)<1e-6);
});
