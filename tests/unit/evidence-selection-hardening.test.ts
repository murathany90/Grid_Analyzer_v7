import test from 'node:test';
import assert from 'node:assert/strict';
import {scAuditFixture} from '../helpers/study-audit';
import {acNetwork} from '../helpers/ac-network';
import {ScenarioStore} from '../../src/domain/scenario/overlay';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';
import {validateAcOutages} from '../../src/analysis/contingency-ac';
import {studyEvidence} from '../../src/features/analysis/study-evidence';
import {selectedN1Presentation} from '../../src/map/layer-policy';
import {activeResultId,workspaceMapSelection} from '../../src/domain/results/workspace';
import {buildBenchmarkMapData} from '../../src/domain/benchmark/map-layer';
import {metricRows} from '../../src/domain/benchmark/comparison';
const outage={caseId:'N1:ElmLne:BYPASS',sourceClass:'ElmLne' as const,fid:'BYPASS'};
async function fixture(){
  const {ctx}=scAuditFixture(),n=acNetwork();ctx.network=n;ctx.scenario=new ScenarioStore(n.modelHash);ctx.analysisTab='N1';ctx.resultView={...ctx.resultView,analysis:'N1',source:'GA',caseId:outage.caseId,metric:'postPmw'};
  ctx.hybridResult=await runHybridN1(n,ctx.scenario.current,{analysisSettings:ctx.analysisSettings.value,studyProfile:'NATIVE_PARTIAL_CONTROLS',selectedCandidateIds:['ElmLne:BYPASS'],policy:{acBudgetCases:1}});
  ctx.n1AcResults=await validateAcOutages(n,ctx.scenario.current,[outage],{analysisSettings:ctx.analysisSettings.value,controlPolicy:'ALLOW_PARTIAL'});return ctx;
}
test('selected manual POST and its evidence share owner, identity, control and case-local counters',async()=>{
  const ctx=await fixture(),manual=ctx.n1AcResults[0];
  const evidence=studyEvidence(ctx),map=selectedN1Presentation(ctx);assert.equal(map.post?.source,'MANUAL_FULL_AC');assert.equal(evidence.recordSource,map.post?.source);assert.strictEqual(evidence.control,manual.controlEvidence);assert.strictEqual(evidence.resultIdentity,manual.identity);assert.equal(evidence.elapsedMs,manual.elapsedMs);assert.equal(evidence.caseId,outage.caseId);assert.equal(evidence.numbers,1);assert.equal(evidence.coverage?.AC_ATTEMPTED,1);assert.equal(evidence.resultId,activeResultId(ctx));
  ctx.resultView.caseId='N1:ElmLne:NOT_RECORDED';const absent=studyEvidence(ctx);assert.equal(absent.recordSource,'NOT_RUN');assert.equal(absent.numerical,'NOT_CALCULATED');assert.equal(absent.control,null);assert.equal(absent.resultIdentity,null);assert.equal(absent.numbers,0);
});
test('a current manual rejection cannot expose an older hybrid POST or DC substitute',async()=>{
  const ctx=await fixture();ctx.n1AcResults=await validateAcOutages(ctx.network!,ctx.scenario.current,[outage],{analysisSettings:ctx.analysisSettings.value});assert.equal(ctx.n1AcResults[0].status,'UNSUPPORTED_CONTROL_CONFIGURATION');
  const e=studyEvidence(ctx),p=selectedN1Presentation(ctx);assert.equal(e.recordSource,'MANUAL_FULL_AC');assert.equal(e.recordStatus,p.status);assert.equal(p.post,null);assert.equal(e.coverage?.AC_VERIFIED,0);assert.equal(e.blocked,1);assert.equal(activeResultId(ctx),null);assert.equal(buildBenchmarkMapData(ctx,workspaceMapSelection(ctx)).enabled,false);
  const table={name:'N1_RecordedExtrema_Raw',analysis:'N1' as const,fileSha256:'SYNTHETIC',metadata:{},rowNumbers:[2],headerRow:1,headers:['caseId','outageClass','outageFid','affectedClass','affectedFid','postPowerEndpoint','postPmw'],rows:[[outage.caseId,'ElmLne','BYPASS','ElmLne','L0','FROM',30]]};
  const comparison=metricRows(table,{status:'NOT_COMPARABLE',reasons:[],lf:null,comparison:null},'postPmw',{network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,hybrid:ctx.hybridResult,ac:ctx.n1AcResults,diagnostic:true});assert.equal(comparison[0].ga,null);assert.equal(comparison[0].diagnosticDelta,null);
  const incomplete={...table,headers:['caseId','affectedClass','affectedFid','postPmw'],rows:[[outage.caseId,'ElmLne','L0',30]]};assert.equal(metricRows(incomplete,{status:'NOT_COMPARABLE',reasons:[],lf:null,comparison:null},'postPmw',{network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,hybrid:ctx.hybridResult,ac:ctx.n1AcResults})[0].ga,null);
});
test('stale manual evidence yields to current same-case hybrid and never to a different case',async()=>{
  const ctx=await fixture();ctx.n1AcResults[0].identity.modelHash='OLD';
  assert.equal(studyEvidence(ctx).recordSource,'HYBRID_FULL_AC');assert.equal(studyEvidence(ctx).recordSource,selectedN1Presentation(ctx).post?.source);assert.strictEqual(studyEvidence(ctx).control,ctx.hybridResult!.cases.find(c=>c.outage.caseId===outage.caseId)!.controlEvidence);
  ctx.hybridResult!.identity.scenarioHash='OLD';assert.equal(studyEvidence(ctx).numerical,'STALE_RESULT');assert.equal(activeResultId(ctx),null);
  ctx.resultView.source='PF';const pf=studyEvidence(ctx);assert.equal(pf.recordSource,'PF_REFERENCE_ONLY');assert.equal(pf.control,null);assert.equal(pf.numbers,0);assert.equal(pf.numerical,'NOT_CALCULATED');
});
