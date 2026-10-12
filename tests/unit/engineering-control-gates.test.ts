import test from 'node:test';
import assert from 'node:assert/strict';
import {acNetwork} from '../helpers/ac-network';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {defaultAnalysisSettings} from '../../src/domain/calculation/analysis-settings';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {identity} from '../../src/domain/calculation/identity';
import {n1ControlEvidence} from '../../src/analysis/contingency-ac/control-evidence';
import {validateAcOutages} from '../../src/analysis/contingency-ac';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';

const settings=()=>{const s=defaultAnalysisSettings();s.powerFlow.stationControlMode='off';s.powerFlow.activeBalancingMode='SINGLE_REFERENCE';return s;};
async function solve(){const network=acNetwork(),scenario=emptyScenario(),s=settings();return {network,s,result:await new BrowserJsPowerFlowEngine().runPowerFlow({network,scenario,identity:identity(network.modelHash,scenario,'powerFlow'),analysisSettings:s})};}

test('unconsumed requested LF controls and scaling cannot certify N-1 control fidelity',async()=>{
  const {network,s,result}=await solve();assert.equal(n1ControlEvidence(network,result,s).fidelity,'CONTROL_VERIFIED');
  for(const key of ['activePowerLimitsEnabled','automaticTransformerTap','automaticShunt','loadVoltageDependency','feederLoadScaling','interchangeSchedule','lineResistanceTemperatureCorrection','qLimitScalingEnabled'] as const){const changed=structuredClone(s);changed.powerFlow[key]=true;const e=n1ControlEvidence(network,result,changed);assert.equal(e.fidelity,'CONTROL_FIDELITY_PARTIAL');assert.ok(e.models?.some(m=>m.kind===key&&m.status==='UNSUPPORTED'));}
  const changed=structuredClone(s);changed.shared.loadScalePercent=80;assert.match(n1ControlEvidence(network,result,changed).reasons.join(';'),/UNIMPLEMENTED_SCALING/);
  const [strict]=await validateAcOutages(network,emptyScenario(),[{caseId:'N1:ElmLne:BYPASS',sourceClass:'ElmLne',fid:'BYPASS'}],{analysisSettings:{...s,powerFlow:{...s.powerFlow,automaticTransformerTap:true}}});assert.equal(strict.result,null);assert.equal(strict.status,'UNSUPPORTED_CONTROL_CONFIGURATION');
});
test('runtime unknown modes and a forged convergence flag fail physical residual acceptance',async()=>{
  const {network,s,result}=await solve();
  for(const residual of [-1,NaN,Infinity,.006]){const r={...result,maxMismatchMw:residual};assert.equal(n1ControlEvidence(network,r,s).numericalSolved,false);}
  assert.equal(n1ControlEvidence(network,{...result,maxMismatchMw:0},s).numericalSolved,true,'zero residual is valid');
  const unknown=JSON.parse(JSON.stringify(s));unknown.powerFlow.activeBalancingMode='DISTRIBUTED_GENERATORS';unknown.powerFlow.stationControlMode='Q_CONTROL';assert.equal(n1ControlEvidence(network,result,unknown).fidelity,'CONTROL_FIDELITY_PARTIAL');
});
test('fixed native physics and missing source or reactive-mode fidelity remain separate',async()=>{
  const {network,s,result}=await solve(),entity=network.lines[0];
  const fixed={...network,transformers:[{...entity,sourceClass:'ElmTr2',rPu:0,xPu:.1,tap:1.05,phase:.1,lvKv:100,ratingMva:100,tapPosition:1,gPu:0,bPu:0}],shunts:[{...entity,bus:'B1',gPu:0,bPu:.1}]};
  const ok=n1ControlEvidence(fixed,result,s);assert.equal(ok.fidelity,'CONTROL_VERIFIED');assert.equal(ok.models?.find(m=>m.kind==='FIXED_TRANSFORMER_TAP_PHASE')?.status,'SUPPORTED');
  const bad={...fixed,transformers:fixed.transformers.map(t=>({...t,tap:NaN})),shunts:fixed.shunts.map(t=>({...t,bPu:Infinity}))};assert.equal(n1ControlEvidence(bad,result,s).fidelity,'CONTROL_FIDELITY_PARTIAL');
  const offline={...bad,transformers:bad.transformers.map(t=>({...t,inService:false})),shunts:bad.shunts.map(t=>({...t,inService:false}))};assert.equal(n1ControlEvidence(offline,result,s).fidelity,'CONTROL_VERIFIED');
  for(const diagnostics of [{sourceFidelity:{fidelity:'PARTIAL'}},{reactiveLimitClasses:{fidelity:'PARTIAL'}}])assert.equal(n1ControlEvidence(network,{...result,diagnostics:{...result.diagnostics,...diagnostics}},s).fidelity,'CONTROL_FIDELITY_PARTIAL');
});

test('even a diagnostic N-1 profile refuses forged converged BASE and POST residuals',async t=>{
  const {network,s,result}=await solve();
  const forged={...result,maxMismatchMw:.006};
  const base=await runHybridN1(network,emptyScenario(),{analysisSettings:s,studyProfile:'NATIVE_PARTIAL_CONTROLS',solveBase:async()=>forged,policy:{acBudgetCases:1}});assert.equal(base.status,'BLOCKED');assert.equal(base.counts.AC_ATTEMPTED,0);
  t.mock.method(BrowserJsPowerFlowEngine.prototype,'runPowerFlow',async()=>forged);
  const [post]=await validateAcOutages(network,emptyScenario(),[{caseId:'N1:ElmLne:BYPASS',sourceClass:'ElmLne',fid:'BYPASS'}],{analysisSettings:s,controlPolicy:'ALLOW_PARTIAL'});assert.equal(post.status,'NOT_COMPUTABLE');assert.equal(post.result,null);assert.equal(post.controlEvidence?.numericalSolved,false);
});
