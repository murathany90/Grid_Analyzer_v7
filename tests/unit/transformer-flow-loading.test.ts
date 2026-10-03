import assert from 'node:assert/strict';
import test from 'node:test';
import type {CanonicalNetwork} from '../../src/domain/model/network';
import {prepareModel} from '../../src/analysis/power-flow/preparation';
import {solveNR} from '../../src/analysis/power-flow/js/newton';
import {calcPQ} from '../../src/analysis/power-flow/js/jacobian';
import {buildY} from '../../src/analysis/power-flow/js/ybus';
import {mapResults} from '../../src/analysis/power-flow/results';

const entity=(id:string,sourceClass:string)=>({id,name:id,sourceClass,sourceId:id,inService:true,siteIds:['S'],sourceRefs:{}});
function fixture():CanonicalNetwork{
  const buses=[{...entity('B0','ElmTerm'),vnKv:100,parentId:'S'},{...entity('B1','ElmTerm'),vnKv:10,parentId:'S'}];
  const transformer={...entity('T1','ElmTr2'),from:'B0',to:'B1',vnKv:100,lvKv:10,rPu:.01,xPu:.1,tap:1,phase:0,ratingMva:50,tapPosition:0,gPu:.015,bPu:-.04};
  return{schemaVersion:1,modelHash:'transformer-flow-test',name:'transformer-flow-test',size:0,baseMva:100,buses,lines:[],transformers:[transformer],generators:[],loads:[{...entity('D1','ElmLod'),bus:'B1',pMw:20,qMvar:8}],shunts:[],seriesCompensators:[],externalGrids:[{...entity('X1','ElmXnet'),bus:'B0',pMw:0,qMvar:0,vmSet:1}],internationalConnections:[],switches:[],stationControllers:[],secondaryControllers:[],boundaries:[],sites:[],classCounts:{},records:0,warnings:[],capabilities:{powerFlow:{state:'READY',reasons:[]},shortCircuit3Phase:{state:'BLOCKED',reasons:[]},shortCircuitGround:{state:'BLOCKED',reasons:[]},n1:{state:'BLOCKED',reasons:[]}}} as unknown as CanonicalNetwork;
}

test('transformer terminal powers include the magnetizing branch represented in Ybus',()=>{
  const prepared=prepareModel(fixture()),solved=solveNR(prepared.model);
  assert.equal(solved.converged,true,solved.status);
  const Y=buildY(prepared.model),P=new Float64Array(Y.n),Q=new Float64Array(Y.n);
  calcPQ(Y,Float64Array.from(solved.Vm!),Float64Array.from(solved.Va!),P,Q);
  const branch=solved.branches![0];
  assert.ok(Math.abs(branch.pf-P[0]*prepared.model.baseMVA)<1e-8);
  assert.ok(Math.abs(branch.qf-Q[0]*prepared.model.baseMVA)<1e-8);
  assert.ok(Math.abs(branch.pt-P[1]*prepared.model.baseMVA)<1e-8);
  assert.ok(Math.abs(branch.qt-Q[1]*prepared.model.baseMVA)<1e-8);
});

test('branch results expose apparent and current loading with endpoint rated currents',()=>{
  const prepared=prepareModel(fixture()),solved=solveNR(prepared.model),result=mapResults(prepared,solved,{modelHash:'transformer-flow-test',scenarioHash:'base',engine:'test',engineVersion:'1'} as never),branch=result.branches[0];
  assert.equal(solved.converged,true);
  assert.ok(branch.apparentPowerLoadingPercent!>0);
  assert.equal(branch.loading,branch.apparentPowerLoadingPercent);
  assert.equal(branch.displayLoadingPercent,branch.apparentPowerLoadingPercent);
  assert.ok(branch.ratedCurrentFromA!>0&&branch.ratedCurrentToA!>0);
  assert.ok(branch.currentLoadingPercent!>0);
  assert.ok(Math.abs(branch.ratedCurrentFromA!-50_000/(Math.sqrt(3)*100))<1e-10);
  assert.ok(Math.abs(branch.ratedCurrentToA!-50_000/(Math.sqrt(3)*10))<1e-10);
});
