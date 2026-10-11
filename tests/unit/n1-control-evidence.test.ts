import test from 'node:test';
import assert from 'node:assert/strict';
import {acNetwork} from '../helpers/ac-network';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {defaultAnalysisSettings} from '../../src/domain/calculation/analysis-settings';
import {validateAcOutages} from '../../src/analysis/contingency-ac';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';
import {hybridStudySettings} from '../../src/analysis/contingency-hybrid/profile';

const outage={caseId:'N1:ElmLne:BYPASS',sourceClass:'ElmLne' as const,fid:'BYPASS'};
function stationFixture(remoteBus='B2',bounded=true){
  const n=acNetwork(),e=n.externalGrids[0];
  return {...n,generators:[{...e,id:'G1',sourceId:'G1',sourceClass:'ElmSym',bus:'B1',pMw:10,qMvar:0,vmSet:1,voltageControl:true,qMin:bounded?-100:null,qMax:bounded?100:null}],stationControllers:[{...e,id:'C1',sourceId:'C1',sourceClass:'ElmStactrl',remoteBus,unitIds:['G1'],vmSet:1.02,controlModeRaw:0,selectedBusModeRaw:0,distributionModeRaw:0,droopModeRaw:0,qOrientationRaw:0,qSetpointRaw:0,modeSemantics:'CURRENT_PROFILE_VOLTAGE_DISPATCH_P' as const}]};
}
function settings(){const s=defaultAnalysisSettings();s.powerFlow.activeBalancingMode='SINGLE_REFERENCE';s.powerFlow.stationControlMode='zeroDroop';return s;}

test('native supported station POST keeps controls and passes fidelity with source Q bounds',async()=>{
  const n=stationFixture(),s=settings(),before=JSON.stringify([n,s]);
  const [r]=await validateAcOutages(n,emptyScenario(),[outage],{analysisSettings:s});
  assert.equal(r.status,'CONVERGED');assert.equal(r.controlEvidence?.fidelity,'CONTROL_VERIFIED');assert.ok(r.result?.converged);
  assert.equal(JSON.stringify([n,s]),before);assert.equal(r.controlEvidence?.stationMode,'zeroDroop');
});
test('unsupported controller is strict BLOCKED; explicit native partial retains identical LF settings',async()=>{
  const n=stationFixture('MISSING_REMOTE'),s=settings();
  const [strict]=await validateAcOutages(n,emptyScenario(),[outage],{analysisSettings:s});
  assert.equal(strict.status,'UNSUPPORTED_CONTROL_CONFIGURATION');assert.equal(strict.result,null);assert.equal(strict.controlEvidence?.numericalSolved,true);
  const [partial]=await validateAcOutages(n,emptyScenario(),[outage],{analysisSettings:s,controlPolicy:'ALLOW_PARTIAL'});
  assert.equal(partial.status,'PARTIAL_SOLUTION');assert.ok(partial.result?.converged);assert.match(partial.reason,/UNSUPPORTED_STATION_CONTROL/);assert.match(partial.reason,/NOT_PF_PARITY/);
  assert.deepEqual(hybridStudySettings(s,'NATIVE_PARTIAL_CONTROLS'),s);
  const strictStudy=await runHybridN1(n,emptyScenario(),{analysisSettings:s,policy:{acBudgetCases:1}});assert.equal(strictStudy.status,'BLOCKED');
  const native=await runHybridN1(n,emptyScenario(),{analysisSettings:s,studyProfile:'NATIVE_PARTIAL_CONTROLS',catalogCandidateIds:['ElmLne:BYPASS'],solveAllSelected:true,policy:{acBudgetCases:1}});
  assert.equal(native.status,'PARTIAL');assert.equal(native.counts.AC_ATTEMPTED,1);assert.equal(native.counts.AC_NUMERICALLY_SOLVED,1);assert.equal(native.counts.AC_VERIFIED,0);assert.equal(native.counts.AC_UNVERIFIED,3);assert.equal(native.cases[0].acSolved,true);
});
test('missing station source limit is not silently inferred and cannot produce fully verified N-1',async()=>{
  const [r]=await validateAcOutages(stationFixture('B2',false),emptyScenario(),[outage],{analysisSettings:settings(),controlPolicy:'ALLOW_PARTIAL'});
  assert.equal(r.controlEvidence?.numericalSolved,true);assert.equal(r.status,'PARTIAL_SOLUTION');assert.match(r.reason,/MISSING_SOURCE_REACTIVE_LIMIT/);
});
test('unresolved distributed active balance cannot pass a station-free strict gate',async()=>{
  const s=defaultAnalysisSettings();s.powerFlow.stationControlMode='off';
  const [r]=await validateAcOutages(acNetwork(),emptyScenario(),[outage],{analysisSettings:s});
  assert.equal(r.status,'UNSUPPORTED_CONTROL_CONFIGURATION');assert.match(r.reason,/ACTIVE_BALANCE_PARTIAL/);
});
test('real DC and AC coverage counts do not promote unverified safe cases to full coverage',async()=>{
  const r=await runHybridN1(acNetwork(),emptyScenario(),{policy:{acBudgetCases:1},selectedCandidateIds:['ElmLne:BYPASS']});
  assert.equal(r.counts.AC_ATTEMPTED,1);assert.equal(r.counts.AC_NUMERICALLY_SOLVED,1);assert.equal(r.counts.AC_VERIFIED,1);assert.equal(r.counts.AC_UNVERIFIED,2);assert.equal(r.counts.DC_SCREENED,0);assert.equal(r.status,'PARTIAL');
});
