import test from 'node:test';
import assert from 'node:assert/strict';
import {acNetwork} from '../helpers/ac-network';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {calculateThreePhase,type ScProfile} from '../../src/analysis/short-circuit';
import {scMethodPreflight} from '../../src/analysis/short-circuit/method-evidence';
const n=acNetwork(2),context={modelHash:n.modelHash,sources:[{sourceClass:'ElmXnet',fid:'SLACK',bus:'B0',inService:true,rOhm:1,xOhm:10,reason:'',sourceRef:'INDEPENDENT_SERIES_R_X'}],audit:[],invalidBranches:[]};
const profile:ScProfile={faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'EXPLICIT_APPROXIMATION',edition:null,rfOhm:0,xfOhm:0,maxFaults:5,timeBudgetMs:30000};
test('unaccepted IEC correction factors carry no equation, assumed unity or applied-network claim',()=>{
  const e=scMethodPreflight(profile,context,n,emptyScenario());assert.deepEqual(e.correctionEvidence.map(c=>c.kind),['KT','KG','KKW']);for(const c of e.correctionEvidence){assert.equal(c.calculatedFactor,null);assert.equal(c.appliedToNetwork,false);assert.equal(c.verificationStatus,'BLOCKED');assert.equal(c.equationSource,null);assert.ok(c.inputs.length>0);}
  assert.equal(e.equipmentDutyEvidence.automaticVerdict,'UNVERIFIED_METHOD');assert.equal(e.sequenceEvidence.faultTypes['3PH'],'NETWORK_APPROXIMATION_ONLY');
});
test('LL and grounded faults cannot reuse positive-sequence Ikss and cannot factor an unverified sequence network',async()=>{
  for(const type of ['LL','1LG','2LG'] as const){const r=await calculateThreePhase(n,emptyScenario(),context,['B1'],{...profile,faultType:type});assert.equal(r.factorizations,0);assert.equal(r.rhsCount,0);assert.equal(r.faults[0].ikssKa,null);assert.equal(r.faults[0].skssMva,null);assert.equal(r.faults[0].ipKa,null);assert.equal(r.methodEvidence?.sequenceEvidence.faultTypes[type],'BLOCKED');assert.match(r.faults[0].reasons.join(';'),/MISSING_SEQUENCE/);}
});
