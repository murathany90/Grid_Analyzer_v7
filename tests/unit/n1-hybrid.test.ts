import test from 'node:test';
import assert from 'node:assert/strict';
import {runHybridN1,promotionReasons,DEFAULT_HYBRID_POLICY,parsePfCaseId} from '../../src/analysis/contingency-hybrid';
import {runN1Screen} from '../../src/domain/n1';
import {auditOutageTopology} from '../../src/analysis/contingency-ac/topology-audit';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {acNetwork} from '../helpers/ac-network';
import {validateAcOutages} from '../../src/analysis/contingency-ac';
test('full multigraph audit preserves parallel branches and bridge cuts',()=>{
  const n=acNetwork(2);assert.equal(auditOutageTopology(n,emptyScenario()).edges.filter(e=>e.classification==='BRIDGE').length,0);
  assert.equal(auditOutageTopology(n,{...emptyScenario(),lineStatus:{BYPASS:false}}).edges.filter(e=>e.classification==='BRIDGE').length,1);
});
test('real hybrid calls independent base / DC / AC; unknown ratings and budget stay explicit',async()=>{
  const n=acNetwork(),r=await runHybridN1(n,emptyScenario(),{policy:{acBudgetCases:1},selectedCandidateIds:['ElmLne:BYPASS']});
  assert.equal(r.base?.converged,true);assert.equal(r.counts.total,3);assert.equal(r.counts.promoted,3);const ac=r.cases.find(c=>c.outage.fid==='BYPASS')!;assert.equal(ac.status,'AC_CONVERGED_WITHIN_LIMIT');assert.ok(ac.unknownRatings>0);assert.equal(r.counts.NOT_RUN_BUDGET,2);assert.equal(r.status,'PARTIAL');assert.ok(!('result'in ac));
  const resumed=await runHybridN1(n,emptyScenario(),{policy:{acBudgetCases:1},selectedCandidateIds:['ElmLne:BYPASS'],resume:r});assert.equal(resumed.cases.filter(c=>c.iterations!==null).length,2);
  await assert.rejects(runHybridN1(n,{...emptyScenario(),lineStatus:{L0:false}},{policy:{acBudgetCases:1},selectedCandidateIds:['ElmLne:BYPASS'],resume:r}),/STALE_RESUME/);
});
test('promotion violation/threshold/unknown/island/explicit and DC clear retain distinct reasons',async()=>{
  const c=(await runN1Screen(acNetwork(),emptyScenario())).candidates[0],p=DEFAULT_HYBRID_POLICY;
  assert.ok(promotionReasons({...c,status:'SCREENED_VIOLATION'},p).includes('DC_VIOLATION'));
  assert.ok(promotionReasons({...c,maxEstimatedLoadingPct:91},p).includes('DC_PROMOTION_THRESHOLD'));
  assert.ok(promotionReasons({...c,status:'ISLANDING'},p).includes('ISLANDING'));
  assert.ok(promotionReasons({...c,status:'UNSCREENABLE'},p).includes('UNSCREENABLE'));
  assert.ok(promotionReasons(c,p,true).includes('EXPLICIT_SELECTION'));
  assert.deepEqual(promotionReasons({...c,status:'SCREENED_NO_VIOLATION',maxEstimatedLoadingPct:20,outageRatingAvailable:true,ratingCoverage:{...c.ratingCoverage,percent:100}},p),[]);
});
test('scope mismatch, wrong FID, zero budget, cancellation and PF case parsing',async()=>{
  const n=acNetwork();assert.deepEqual(parsePfCaseId('N1:ElmLne:L0'),{caseId:'N1:ElmLne:L0',sourceClass:'ElmLne',fid:'L0'});assert.equal(parsePfCaseId('L0'),null);
  await assert.rejects(runHybridN1(n,emptyScenario(),{selectedCandidateIds:['ElmLne:WRONG']}),/UNKNOWN_FID/);
  await assert.rejects(runHybridN1(n,emptyScenario(),{filter:{ytmId:'UNKNOWN'},selectedCandidateIds:['ElmLne:L0']}),/OUTSIDE_SCOPE/);
  const r=await runHybridN1(n,emptyScenario(),{policy:{acBudgetCases:0}});assert.equal(r.counts.NOT_RUN_BUDGET,3);
  assert.equal((await runHybridN1(n,emptyScenario(),{signal:AbortSignal.abort()})).status,'CANCELLED');
  const timer=await runHybridN1(n,emptyScenario(),{solveBase:async()=>{throw Error('WORKER_TIME_BUDGET');}});assert.equal(timer.status,'BLOCKED');assert.match(timer.reason,/TIME_BUDGET/);
});
test('voltage limits run only after AC; safe DC is explicitly not AC verified',async()=>{
  const n=acNetwork(),scenario=emptyScenario();
  const clear=await runHybridN1(n,scenario,{dcClearValidationCases:0,screen:async options=>{const r=await runN1Screen(n,scenario,options);return {...r,candidates:r.candidates.map(c=>({...c,status:'SCREENED_NO_VIOLATION',outageRatingAvailable:true,maxEstimatedLoadingPct:10,ratingCoverage:{...c.ratingCoverage,percent:100}}))};},solveOutage:async()=>{throw Error('should not run');}});
  assert.equal(clear.counts.DC_CLEAR_NOT_AC_VERIFIED,3);assert.ok(clear.cases.every(c=>c.minVpu===null));
  const promoted=await runHybridN1(n,scenario,{catalogCandidateIds:['ElmLne:BYPASS'],selectedCandidateIds:['ElmLne:BYPASS'],policy:{voltageMinPu:.999,voltageMaxPu:1.001,acBudgetCases:1}});
  assert.equal(promoted.cases[0].status,'AC_CONVERGED_VIOLATION');assert.ok(promoted.cases[0].voltageViolations>0);
});
test('multi-reference is blocked and transformer outages retain native class/FID',async()=>{
  const base=acNetwork(),multiple={...base,externalGrids:[...base.externalGrids,{...base.externalGrids[0],id:'X2',sourceId:'X2',bus:'B2'}]};
  assert.equal((await runHybridN1(multiple,emptyScenario())).reason,'BASE_UNSUPPLIED_OR_MULTIPLE_REFERENCE');
  assert.equal((await validateAcOutages(multiple,emptyScenario(),[{caseId:'C',sourceClass:'ElmLne',fid:'BYPASS'}]))[0].status,'UNSUPPORTED_CONTROL_CONFIGURATION');
  const n={...base,transformers:[{...base.lines[0],id:'T-INTERNAL',sourceId:'T-FID',sourceClass:'ElmTr2',rPu:.01,xPu:.1,tap:1,phase:0,lvKv:100,ratingMva:100,tapPosition:0,gPu:0,bPu:0}]};
  const r=await runHybridN1(n,emptyScenario(),{catalogCandidateIds:['ElmTr2:T-INTERNAL'],selectedCandidateIds:['ElmTr2:T-INTERNAL'],policy:{acBudgetCases:1}});assert.equal(r.cases[0].outage.fid,'T-FID');assert.equal(r.cases[0].outage.sourceClass,'ElmTr2');assert.ok(r.cases[0].iterations!==null);
});
test('global budget, cancellation after checkpoint and disabled uncertainty cannot imply clear',async()=>{
  const n=acNetwork(),abort=new AbortController();
  const r=await runHybridN1(n,emptyScenario(),{policy:{acBudgetCases:1},onCheckpoint:r=>{if(r.phase==='BUDGETED_AC_QUEUE')abort.abort();},signal:abort.signal});assert.equal(r.status,'CANCELLED');assert.equal(r.counts.CANCELLED,3);
  const excluded=await runHybridN1(n,emptyScenario(),{policy:{includeCapacityUnavailable:false,includeUnscreenable:false,classifyIslanding:false}});assert.equal(excluded.counts.BLOCKED,3);assert.equal(excluded.counts.DC_CLEAR_NOT_AC_VERIFIED,undefined);
  const timed=await runHybridN1(n,emptyScenario(),{policy:{globalTimeLimitMs:1},solveBase:async()=>{const base=(await validateAcOutages(n,emptyScenario(),[{caseId:'BASE_DELAY',sourceClass:'ElmLne',fid:'BYPASS'}]))[0].result!;await new Promise(resolve=>setTimeout(resolve,10));return base;}});assert.ok(timed.status==='PARTIAL'||timed.status==='BLOCKED');assert.ok(timed.cases.every(c=>c.iterations===null));
});

test('33 kV candidates go directly to Full AC and resume never repeats solved cases',async()=>{
 const base=acNetwork(),n={...base,buses:base.buses.map(b=>({...b,vnKv:33})),lines:base.lines.map(l=>({...l,vnKv:33,xOhm:l.xOhm*(33/100)**2}))};let calls=0;
 const solve=async(outage:import('../../src/analysis/contingency-ac').AcOutage)=>{calls++;return (await validateAcOutages(n,emptyScenario(),[outage]))[0];};
 const opts={solveAllSelected:true,policy:{acBudgetCases:1},screen:async()=>{throw Error('DC must not solve 33kV-only scope');},solveOutage:solve};
 const r=await runHybridN1(n,emptyScenario(),opts);assert.equal(r.cases.length,3);assert.equal(calls,1);assert.ok(r.cases.every(c=>c.dcStatus==='UNSCREENABLE'));
 const resumed=await runHybridN1(n,emptyScenario(),{...opts,resume:r,policy:{acBudgetCases:10}});assert.equal(calls,3);assert.equal(resumed.counts.AC_CALCULATED,3);assert.ok(resumed.cases.every(c=>c.mapResults?.buses.length));
 const again=await runHybridN1(n,emptyScenario(),{...opts,resume:resumed});assert.equal(calls,3);assert.equal(again.counts.NOT_RUN,0);
});
test('actual DC-clear sample is Full AC checked for voltage false negatives',async()=>{
 const base=acNetwork(),n={...base,lines:base.lines.map(l=>({...l,capacity:{quality:'DGS_MAIN_TYPE' as const,typeId:'T',typeName:'T',nominalCurrentKA:10,nominalMVA:1732,limitingSectionId:null,sections:[],seasonalReference:null}}))};
 const r=await runHybridN1(n,emptyScenario(),{dcClearValidationCases:1,policy:{acBudgetCases:1,voltageMinPu:.999,voltageMaxPu:1.001}});
 assert.equal(r.counts.dcClearAcVerified,1);assert.equal(r.counts.dcClearVoltageRisk,1);assert.ok(r.cases.some(c=>c.promotionReasons.includes('DC_CLEAR_VALIDATION')&&c.voltageViolations>0));
});
