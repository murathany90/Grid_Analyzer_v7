import assert from 'node:assert/strict';
import test from 'node:test';
import type { CalculationResult } from '../../src/domain/results/types';
import { comparePowerFactoryReference, importPowerFactoryReference } from '../../src/analysis/validation/powerfactory-reference';

function result(buses:CalculationResult['buses'],branches:CalculationResult['branches']):CalculationResult{
 return{identity:{} as CalculationResult['identity'],status:'CONVERGED_FULL_NR',converged:true,iterations:2,rounds:1,maxMismatchMw:0,elapsedMs:1,buses,branches,generators:[],diagnostics:{},warnings:[],quality:{numericalStatus:'CONVERGED',controlFidelity:'PARTIAL',referenceValidation:'NOT_AVAILABLE'}};
}

test('PowerFactory reference imports typed JSON and Turkish-delimited CSV values',()=>{
 const json=importPowerFactoryReference(JSON.stringify({buses:[{fid:'B1',name:'Bara 1',nominalKv:154,voltagePu:0.99,angleDeg:-2.5}],lines:[{fid:'L1',name:'Hat 1',pFromMw:12.3,qFromMvar:-13.52}]}));
 assert.equal(json.length,2);assert.equal(json[0].kind,'bus');assert.equal(json[0].nominalKv,154);assert.equal(json[1].pFromMw,12.3);
 const csv=importPowerFactoryReference('\ufeffsep=;\r\nType;FID;Name;Voltage kV;Voltage pu;Angle deg\r\nBus;B2;Bara 2;154;0,9765;-1,25');
 assert.equal(csv.length,1);assert.equal(csv[0].voltagePu,0.9765);assert.equal(csv[0].angleDeg,-1.25);
});

test('PowerFactory comparison prioritizes FID and reports MAE, maximum error and missing objects',()=>{
 const calc=result([
  {id:'B1',name:'Bara 1',terms:['FID-B1'],siteIds:[],vnKv:154,vmPu:0.99,angleRad:-0.04363323129985824,pMw:0,qMvar:0},
  {id:'B2',name:'Bara 2',terms:[],siteIds:[],vnKv:154,vmPu:1,angleRad:0,pMw:0,qMvar:0},
 ],[
  {id:'L1',name:'Hat 1',sourceClass:'ElmLne',from:'B1',to:'B2',siteIds:[],vnKv:154,pf:12,qf:2,pt:-11,qt:-3,ifA:1,itA:1,loading:25,pLoss:1,qLoss:-1},
  {id:'T1',name:'Trafo 1',sourceClass:'ElmTr2',from:'B1',to:'B2',siteIds:[],vnKv:154,pf:20,qf:4,pt:-19,qt:-5,ifA:1,itA:1,loading:50,pLoss:1,qLoss:-1},
 ]);
 const refs=importPowerFactoryReference(JSON.stringify({buses:[{fid:'FID-B1',name:'Different display name',voltagePu:1}],lines:[{fid:'L1',name:'Hat 1',pFromMw:10,pToMw:-10}],transformers:[{fid:'T1',name:'Trafo 1',pHvMw:20,pLvMw:-19}],records:[{kind:'line',name:'Missing'}]}));
 const report=comparePowerFactoryReference(refs,calc);assert.deepEqual(report.matched,{bus:1,line:1,transformer:1});assert.equal(report.unmatched.length,1);
 assert.deepEqual(report.metrics.find(m=>m.kind==='line'&&m.metric==='pFromMw'),{kind:'line',metric:'pFromMw',count:1,mae:2,maxAbsoluteError:2,p95AbsoluteError:2,meanBias:2});
});

test('PowerFactory name-only matching refuses duplicate names as ambiguous',()=>{
 const calc=result([
  {id:'B1',name:'Duplicate',terms:[],siteIds:[],vnKv:110,vmPu:1,angleRad:0,pMw:0,qMvar:0},
  {id:'B2',name:'Duplicate',terms:[],siteIds:[],vnKv:110,vmPu:1,angleRad:0,pMw:0,qMvar:0},
 ],[]);
 const report=comparePowerFactoryReference([{kind:'bus',name:'Duplicate',voltagePu:1}],calc);
 assert.equal(report.matched.bus,0);assert.equal(report.ambiguous.length,1);assert.equal(report.ambiguous[0].reason,'AMBIGUOUS');
});

test('PowerFactory comparison reports interpolated p95, signed bias, voltage bands and aligned angles',()=>{
 const calc=result([
  {id:'B1',name:'Slack',terms:[],siteIds:[],vnKv:154,vmPu:1.01,angleRad:10*Math.PI/180,pMw:0,qMvar:0},
  {id:'B2',name:'Remote',terms:[],siteIds:[],vnKv:154,vmPu:0.99,angleRad:12*Math.PI/180,pMw:0,qMvar:0},
 ],[]);calc.diagnostics.referenceBusId='B1';
 const refs=importPowerFactoryReference(JSON.stringify({buses:[{fid:'B1',name:'Slack',voltagePu:1,angleDeg:0},{fid:'B2',name:'Remote',voltagePu:1,angleDeg:1}]}));
 const report=comparePowerFactoryReference(refs,calc),v=report.metrics.find(m=>m.metric==='voltagePu'),angle=report.metrics.find(m=>m.metric==='alignedAngleDeg');
 assert.equal(report.angleAlignment.method,'REFERENCE_BUS');assert.ok(Math.abs((report.angleAlignment.offsetDeg??0)+10)<1e-9);
 assert.equal(v?.count,2);assert.ok(Math.abs((v?.p95AbsoluteError??0)-.01)<1e-10);assert.ok(Math.abs(v?.meanBias??1)<1e-10);
 assert.equal(angle?.count,2);assert.ok(Math.abs((angle?.mae??0)-.5)<1e-10);assert.ok(report.voltageBands.some(m=>m.band==='154'&&m.metric==='voltagePu'));
 const separate=result([{id:'A',name:'A',terms:[],siteIds:[],vnKv:154,vmPu:1,angleRad:10*Math.PI/180,pMw:0,qMvar:0,islandId:'one'},{id:'B',name:'B',terms:[],siteIds:[],vnKv:154,vmPu:1,angleRad:100*Math.PI/180,pMw:0,qMvar:0,islandId:'two'}],[]);
 const separateReport=comparePowerFactoryReference([{kind:'bus',fid:'A',name:'A',angleDeg:0},{kind:'bus',fid:'B',name:'B',angleDeg:0}],separate);
 assert.equal(separateReport.angleAlignment.method,'PER_ISLAND');assert.equal(separateReport.metrics.find(m=>m.metric==='alignedAngleDeg')?.mae,0);
});
