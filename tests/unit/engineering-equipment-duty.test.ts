import test from 'node:test';
import assert from 'node:assert/strict';
import {scEquipmentDuty,type EquipmentDutyContext} from '../../src/analysis/short-circuit/equipment-limits';
const rating={ratedKv:170,interruptingKa:20,makingPeakKa:50,thermalKa:15,thermalTimeS:1,provenance:'INDEPENDENT_NAMEPLATE_FIXTURE'};
const actual={nominalKv:154,ibKa:20,ipKa:40,ithKa:15,thermalTimeS:1};
const context:EquipmentDutyContext={applicable:true,faultConnectionId:'TEST_CUBICLE',ratingConnectionId:'TEST_CUBICLE',quantityVerification:{ibKa:true,ipKa:true,ithKa:true},methodProvenance:'INDEPENDENT_QUANTITY_REFERENCE'};
test('equipment duty uses verified distinct quantities and includes the exact nameplate boundary',()=>{
  const pass=scEquipmentDuty(actual,rating,context);assert.deepEqual(Object.values(pass).map(v=>v.status),['PASS','PASS','PASS']);
  assert.deepEqual(Object.values(scEquipmentDuty({...actual,ibKa:21,ipKa:51,ithKa:16},rating,context)).map(v=>v.status),['FAIL','FAIL','FAIL']);
  assert.deepEqual(Object.values(scEquipmentDuty({...actual,nominalKv:180},rating,context)).map(v=>v.status),['FAIL','FAIL','FAIL']);
});
test('diagnostic numbers or Ikss alone cannot approve any equipment duty',()=>{
  const noMethod={...context,quantityVerification:{ibKa:false,ipKa:false,ithKa:false}};
  assert.ok(Object.values(scEquipmentDuty(actual,rating,noMethod)).every(v=>v.status==='UNVERIFIED_METHOD'));
  assert.ok(Object.values(scEquipmentDuty({...actual,ibKa:null,ipKa:null,ithKa:null},rating,context)).every(v=>v.status==='UNVERIFIED_METHOD'));
  for(const value of [NaN,Infinity,-1])assert.equal(scEquipmentDuty({...actual,ibKa:value},rating,context).interrupting.status,'UNVERIFIED_METHOD');
  assert.equal(scEquipmentDuty({...actual,ibKa:0},rating,context).interrupting.status,'PASS','physical zero is distinct from null');
});
test('missing names, mismatched physical connection and thermal times fail closed',()=>{
  for(const r of [{...rating,provenance:''},{...rating,ratedKv:null},{...rating,interruptingKa:0}])assert.equal(scEquipmentDuty(actual,r,context).interrupting.status,'INSUFFICIENT_RATING_DATA');
  assert.equal(scEquipmentDuty(actual,rating,{...context,ratingConnectionId:'OTHER'}).making.status,'INSUFFICIENT_RATING_DATA');
  assert.equal(scEquipmentDuty({...actual,thermalTimeS:.1},rating,context).thermal.status,'UNVERIFIED_METHOD');
  assert.equal(scEquipmentDuty(actual,{...rating,thermalTimeS:null},context).thermal.status,'INSUFFICIENT_RATING_DATA');
  assert.ok(Object.values(scEquipmentDuty(actual,rating,{...context,applicable:false})).every(v=>v.status==='NOT_APPLICABLE'));
});
