import test from 'node:test';
import assert from 'node:assert/strict';
import {scAuditFixture} from '../helpers/study-audit';
import {n1OperatorRows,n1CaseRows,groupN1Cases} from '../../src/features/analysis/study-operator';
import {createStudyRowsCache} from '../../src/features/analysis/study-rows-cache';
import {workspaceMapSelection} from '../../src/domain/results/workspace';
import {setScStudyScope} from '../../src/features/analysis/sc-study-state';
import {capacitySession,setCapacitySeason} from '../../src/domain/model/capacity';
import {acNetwork} from '../helpers/ac-network';
import {ScenarioStore} from '../../src/domain/scenario/overlay';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';

test('cached rows invalidate identities, replacement results, model metadata and shared SC scope',()=>{
  const {ctx,fault,result}=scAuditFixture(70);ctx.scResult=result([fault(0,'CALCULATED_NETWORK_APPROXIMATION')]);const read=createStudyRowsCache(ctx),s=workspaceMapSelection(ctx),first=read(s);assert.equal(first.gaCalculatedCount,1);assert.strictEqual(read(s),first);
  ctx.scResult.identity.modelHash='STALE';const stale=read(s);assert.notStrictEqual(stale,first);assert.equal(stale.gaCalculatedCount,0);
  ctx.scResult=result([fault(2,'CALCULATED_NETWORK_APPROXIMATION')]);assert.equal(read(s).rows.find(r=>r.fid==='B2')!.ikss,2);
  const old=read(s);ctx.network={...ctx.network!,buses:ctx.network!.buses.map(b=>({...b,vnKv:101}))};assert.notStrictEqual(read(s),old);assert.equal(read(s).rows[0].nominal,101);
  setScStudyScope(ctx,{search:'Terminal 1'});assert.ok(read(s).rows.length<70);assert.ok(read(s).rows.every(r=>r.name.includes('Terminal 1')));
  const scoped=read(s);setCapacitySeason(ctx.network.modelHash,capacitySession(ctx.network.modelHash).season==='summer'?'winter':'summer');assert.notStrictEqual(read(s),scoped);
  ctx.scenario.setStatus('lineStatus','L0',false,true);assert.equal(read(s).gaCalculatedCount,0);
});
test('case-detail hydration on an existing hybrid object invalidates cached numerical rows',async()=>{
  const {ctx}=scAuditFixture(),n=acNetwork();ctx.network=n;ctx.scenario=new ScenarioStore(n.modelHash);ctx.resultView={...ctx.resultView,analysis:'N1',source:'GA',caseId:'N1:ElmLne:BYPASS',metric:'postPmw'};
  ctx.hybridResult=await runHybridN1(n,ctx.scenario.current,{analysisSettings:ctx.analysisSettings.value,studyProfile:'NATIVE_PARTIAL_CONTROLS',selectedCandidateIds:['ElmLne:BYPASS'],policy:{acBudgetCases:1}});const c=ctx.hybridResult.cases.find(c=>c.outage.caseId===ctx.resultView.caseId)!,post=c.mapResults!,read=createStudyRowsCache(ctx),s=workspaceMapSelection(ctx);assert.ok(read(s).numericCount>0);
  delete c.mapResults;assert.equal(read(s).numericCount,0);
  assert.ok(c.affectedKeys?.length);c.violationKeys=[];const evicted=groupN1Cases(ctx,n1CaseRows(ctx));assert.ok(evicted.length);assert.ok(evicted.every(g=>g.row.reason==='CASE_DETAIL_NOT_LOADED'&&Object.values(g.values).every(v=>v.pre===null&&v.post===null)&&!g.critical.violation));
  c.mapResults=post;assert.ok(read(s).numericCount>0);const before=ctx.hybridResult.basePost!.branches[0],after=post.branches.find(b=>b.fid===before.fid&&b.sourceClass===before.sourceClass)!;before.loading={...before.loading,operationalPercent:50,fromLimitA:1000};after.loading={...after.loading,operationalPercent:60,fromLimitA:2000};const shown=n1OperatorRows(ctx).find(r=>r.row.fid===before.fid)!;assert.equal(shown.values.loading.delta,null);assert.match(shown.values.loading.reason,/DENOMINATOR/);
});
