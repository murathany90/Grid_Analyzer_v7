import test from 'node:test';
import assert from 'node:assert/strict';
import {scAuditFixture} from '../helpers/study-audit';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';
import {runEvidence} from '../../src/features/analysis/run-evidence';
import {scenarioSignature} from '../../src/domain/scenario/overlay';
import {analysisUiFixture} from '../helpers/analysis-ui';

test('a completed run owns its 30 numerical / zero verified counters across case and PF selection',async()=>{
 const {ctx}=scAuditFixture();ctx.analysisTab='N1';ctx.hybridResult=await runHybridN1(ctx.network!,ctx.scenario.current,{analysisSettings:ctx.analysisSettings.value,studyProfile:'NATIVE_PARTIAL_CONTROLS',policy:{acBudgetCases:1}});
 Object.assign(ctx.hybridResult.counts,{AC_CALCULATED:30,AC_ATTEMPTED:37,AC_VERIFIED:0,DC_SCREENED:296});ctx.hybridResult.status='COMPLETE';
 const first=runEvidence(ctx);assert.equal(first.numericalAvailable,30);assert.equal(first.acVerified,0);assert.match(first.label,/30 sayısal AC/);assert.doesNotMatch(first.label,/Henüz/);
 ctx.resultView.caseId='N1:ElmLne:NOT_RECORDED';ctx.resultView.source='PF';assert.deepEqual(runEvidence(ctx),first);
 ctx.hybridResult.identity.scenarioHash='OLD';assert.equal(runEvidence(ctx).stale,true);assert.equal(runEvidence(ctx).numericalAvailable,0);
});
test('workflow and elapsed time belong to the displayed family, including retained and never-run families',()=>{
 const {ctx,study}=analysisUiFixture();study.options.families=['SC'];study.status='CANCELLED';study.elapsedMs=20;study.n1!.elapsedMs=123;
 assert.equal(runEvidence(ctx).workflow,'COMPLETE');assert.equal(runEvidence(ctx).elapsedMs,123);assert.equal(runEvidence(ctx).retainedFamily,true);
 ctx.hybridResult={...ctx.hybridResult!,identity:{...ctx.hybridResult!.identity}};ctx.studyOptions={...study.options,profile:'FAST'};assert.equal(runEvidence(ctx).stale,true);ctx.studyOptions=study.options;
 ctx.hybridResult=null;study.n1=null;study.catalog=[];const absent=runEvidence(ctx);assert.equal(absent.workflow,'NOT_STARTED');assert.equal(absent.elapsedMs,null);assert.equal(absent.resultIdentity,null);
 ctx.analysisTab='SC';ctx.scResult=null;assert.equal(runEvidence(ctx).workflow,'NOT_STARTED');
});
test('SC run counts electrical buses once and preserves a recorded zero, independent of PF overlay',()=>{
 const f=scAuditFixture(),ctx=f.ctx;ctx.analysisTab='SC';ctx.scResult=f.result([f.fault(0,'CALCULATED_NETWORK_APPROXIMATION'),{...f.fault(0,'CALCULATED_NETWORK_APPROXIMATION'),physicalTerminalFid:'ALIAS'},f.fault(1)]);
 assert.equal(runEvidence(ctx).electricalBuses,2);assert.equal(runEvidence(ctx).numericalAvailable,1);ctx.resultView.source='PF';assert.equal(runEvidence(ctx).numericalAvailable,1);ctx.scResult.identity.scenarioHash=scenarioSignature({...ctx.scenario.current,loadAdjustments:{X:{pMw:1,qMvar:1}}});assert.equal(runEvidence(ctx).numericalAvailable,0);
});
