import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateThreePhase,clearScPreparationCache,type ScProfile} from '../../src/analysis/short-circuit';
import {IEC_2016,scMethodPreflight} from '../../src/analysis/short-circuit/method-evidence';
import {scEquipmentCheck} from '../../src/analysis/short-circuit/equipment-limits';
import {acNetwork} from '../helpers/ac-network';
import {emptyScenario} from '../../src/domain/scenario/overlay';
const n=acNetwork(2),context={modelHash:n.modelHash,sources:[{sourceClass:'ElmXnet',fid:'SLACK',bus:'B0',inService:true,parameterStatus:'NATIVE' as const,rOhm:1,xOhm:10,reason:'',sourceRef:'PUBLIC_ANALYTICAL_FIXTURE'}],audit:[],invalidBranches:[]};
const profile:ScProfile={faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'TEST_EXPLICIT_C',edition:null,rfOhm:0,xfOhm:0,maxFaults:10,timeBudgetMs:30000};
test('requesting 2016 cannot relabel a network solution or inject certification through a profile',async()=>{
  const result=await calculateThreePhase(n,emptyScenario(),context,['B0','B1'],{...profile,schemaVersion:2,edition:IEC_2016,frequencyHz:50,breakerOpeningTimeS:.1,thermalClearingTimeS:1});
  assert.equal(result.method,'GA_IEC60909_2016_PREFLIGHT');assert.equal(result.methodEvidence?.normativeStatus,'BLOCKED');assert.equal(result.factorizations,0);assert.equal(result.rhsCount,0);
  for(const f of result.faults){assert.equal(f.status,'BLOCKED');assert.equal(f.ikssKa,null);assert.equal(f.ipKa,null);assert.equal(f.ibKa,null);assert.equal(f.ithKa,null);assert.match(f.reasons.join(';'),/INDEPENDENT_NORMATIVE_EXAMPLES/);}
  assert.equal(result.methodEvidence?.times.breakerOpeningTimeS,.1);assert.equal(result.methodEvidence?.times.thermalClearingTimeS,1);
});
test('legacy approximation remains numerically unchanged and every missing quantity has a distinct reason',async()=>{
  clearScPreparationCache();const r=await calculateThreePhase(n,emptyScenario(),context,['B1'],profile),f=r.faults[0];
  assert.ok(Math.abs(f.ikssKa!-110/(Math.sqrt(3)*Math.hypot(1,15)))<1e-9);assert.equal(f.quantitySupport?.ikssKa.status,'ENGINE_CALCULATED');assert.match(f.quantitySupport!.ipKa.reason,/KAPPA/);assert.match(f.quantitySupport!.ibKa.reason,/BREAK/);assert.match(f.quantitySupport!.ithKa.reason,/THERMAL/);
});
test('source audit and time/frequency gates do not infer unsupported source defaults',async()=>{
  const c={...context,sources:[{...context.sources[0],parameterStatus:'ASSUMED' as const}]};assert.equal(scMethodPreflight(profile,c).sourceStatus,'PARTIAL');
  assert.equal(scMethodPreflight({...profile,edition:IEC_2016},context).blockers.includes('REQUESTED_50_HZ_PROFILE_NOT_RECORDED'),true);
  await assert.rejects(calculateThreePhase(n,emptyScenario(),context,['B0'],{...profile,thermalClearingTimeS:-1}),/TIME/);
});
test('electrical aliases and later batches reuse Zkk while fault impedance changes current',async()=>{
  clearScPreparationCache();const alias={...n,buses:[...n.buses,{...n.buses[1],id:'ALIAS',sourceId:'ALIAS'}],switches:[{...n.lines[0],id:'COUP',sourceId:'COUP',sourceClass:'ElmCoup',from:'B1',to:'ALIAS',closed:true}]};
  const first=await calculateThreePhase(alias,emptyScenario(),context,['B1','ALIAS'],profile);assert.equal(first.rhsCount,1);assert.equal(first.reusedDrivingPoints,1);assert.equal(first.faults[0].ikssKa,first.faults[1].ikssKa);
  const next=await calculateThreePhase(alias,emptyScenario(),context,['B1'],{...profile,rfOhm:3});assert.equal(next.rhsCount,0);assert.equal(next.reusedDrivingPoints,1);assert.ok(next.faults[0].ikssKa!<first.faults[0].ikssKa!);
});
test('equipment interrupting/making/thermal verdicts require their own quantities and matching time',()=>{
  const rating={ratedKv:154,interruptingKa:20,makingPeakKa:50,thermalKa:15,thermalTimeS:1,provenance:'PUBLIC_EQUIPMENT_FIXTURE'};
  const absent=scEquipmentCheck({nominalKv:154,ibKa:null,ipKa:null,ithKa:null,thermalTimeS:1},rating);assert.equal(absent.interrupting.status,'BLOCKED');assert.equal(absent.making.status,'BLOCKED');assert.equal(absent.thermal.status,'BLOCKED');
  const actual={nominalKv:154,ibKa:21,ipKa:40,ithKa:14,thermalTimeS:.1},r=scEquipmentCheck(actual,rating);assert.equal(r.interrupting.status,'EXCEEDED');assert.equal(r.making.status,'WITHIN_RATING');assert.equal(r.thermal.status,'BLOCKED');assert.equal(scEquipmentCheck({...actual,thermalTimeS:1},rating).thermal.status,'WITHIN_RATING');
});

test('SC source summary audits missing canonical adapters and limits its claim to observed fields',async()=>{
  const full=scMethodPreflight(profile,context,n,emptyScenario());assert.equal(full.sourceStatus,'ADAPTER_FIELDS_PRESENT');assert.equal(full.sourceCoverage.canonicalComplete,true);
  assert.equal(scMethodPreflight(profile,context).sourceCoverage.canonicalComplete,null);
  const incomplete={...n,generators:[{...n.externalGrids[0],id:'OMITTED',sourceId:'OMITTED',sourceClass:'ElmSym',voltageControl:true,qMin:null,qMax:null}]},audit=scMethodPreflight(profile,context,incomplete,emptyScenario());
  assert.equal(audit.sourceStatus,'PARTIAL');assert.equal(audit.sourceCoverage.canonicalComplete,false);assert.equal(audit.sourceFamilies.ElmSym.expectedCanonical,1);assert.equal(audit.sourceFamilies.ElmSym.missingAdapter,1);
  assert.deepEqual(audit.sourceCoverage.missingAdapters,[{sourceClass:'ElmSym',fid:'OMITTED'}]);
  clearScPreparationCache();const actual=await calculateThreePhase(incomplete,emptyScenario(),context,['B1'],profile);assert.equal(actual.faults[0].status,'BLOCKED');assert.equal(actual.faults[0].ikssKa,null);assert.equal(actual.methodEvidence?.sourceStatus,'PARTIAL');assert.match(actual.faults[0].reasons.join(';'),/MISSING_SOURCE_MODEL/);
  const duplicate=scMethodPreflight(profile,{...context,sources:[context.sources[0],context.sources[0]]},n);assert.equal(duplicate.sourceStatus,'PARTIAL');assert.equal(duplicate.sourceCoverage.duplicateAdapters.length,1);
  assert.equal(scMethodPreflight(profile,context,{...n,modelHash:'OLD'}).sourceStatus,'SOURCE_IDENTITY_UNVERIFIED');
});
