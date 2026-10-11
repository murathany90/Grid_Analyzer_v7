import type {AppContext} from '../../app/contracts';
import {scenarioSignature,emptyScenario} from '../../domain/scenario/overlay';
import {hybridIsCurrent} from '../../analysis/contingency-hybrid';
import {lfSnapshotIsCurrent} from '../../domain/benchmark/post-result-source';
import {stableJson} from '../../domain/calculation/identity';

export type StudyEvidenceStatus='ENGINE_CALCULATED'|'SOURCE_VERIFIED'|'METHOD_VERIFIED'|'NETWORK_APPROXIMATION'|'EXPLORATORY_ONLY'|'BLOCKED'|'NOT_CALCULATED'|'STALE_RESULT';
/** Independent verdicts: a numerical solve never automatically verifies source/method/PF parity. */
export function studyEvidence(ctx:AppContext){
  const family=ctx.analysisTab,n=ctx.network,sc=ctx.scResult,hybrid=ctx.hybridResult,lf=ctx.resultStore.active,manual=ctx.n1AcResults.at(-1);
  const result=family==='SC'?sc:family==='N1'?hybrid??manual??ctx.n1Result:lf;
  const stale=!!n&&!!result&&(family==='SC'?sc!.identity.modelHash!==n.modelHash||sc!.identity.scenarioHash!==scenarioSignature(ctx.scenario.current):family==='N1'?hybrid?!hybridIsCurrent(hybrid,n,ctx.scenario.current,ctx.analysisSettings.value):manual?manual.identity.modelHash!==n.modelHash||manual.identity.baseScenarioHash!==scenarioSignature(ctx.scenario.current)||manual.identity.settingsHash!==stableJson(ctx.analysisSettings.value):ctx.n1Result!.identity.modelHash!==n.modelHash||ctx.n1Result!.identity.scenarioHash!==scenarioSignature(ctx.scenario.current):!lfSnapshotIsCurrent(lf!,n,ctx.resultStore.role==='base'?emptyScenario():ctx.scenario.current,ctx.analysisSettings.value));
  const numbers=family==='SC'?sc?.faults.filter(f=>f.ikssKa!==null&&Number.isFinite(f.ikssKa)).length??0:family==='N1'?hybrid?.counts.AC_NUMERICALLY_SOLVED??(manual?ctx.n1AcResults.filter(c=>c.controlEvidence?.numericalSolved??c.result?.converged).length:ctx.n1Result?.screenedCount??0):lf?.converged?lf.buses.length:0;
  const blocked=family==='SC'?sc?.counts.BLOCKED??0:family==='N1'?hybrid?.counts.BLOCKED??(hybrid?.status==='BLOCKED'?1:manual?ctx.n1AcResults.filter(c=>!c.result).length:0):lf&&!lf.converged?1:0;
  const numerical:StudyEvidenceStatus=stale?'STALE_RESULT':numbers?'ENGINE_CALCULATED':blocked?'BLOCKED':'NOT_CALCULATED';
  const method:StudyEvidenceStatus=family==='SC'?sc?.profile.edition?'BLOCKED':sc?'NETWORK_APPROXIMATION':'NOT_CALCULATED':result?'EXPLORATORY_ONLY':'NOT_CALCULATED';
  const reason=family==='SC'?sc?.methodEvidence?.blockers.join('; ')??sc?.assumptions.join('; ')??'SC çalıştırılmadı':family==='N1'?hybrid?.reason??manual?.reason??'N-1 çalıştırılmadı':lf?.warnings.join('; ')??'Yük akışı çalıştırılmadı';
  return {family,numerical,source:result?'EXPLORATORY_ONLY' as const:'NOT_CALCULATED' as const,method,pf:result?'EXPLORATORY_ONLY' as const:'NOT_CALCULATED' as const,numbers,blocked,elapsedMs:result?.elapsedMs??null,
    modelHash:n?.modelHash??null,scenarioId:ctx.scenario.selectedId,scenarioHash:scenarioSignature(ctx.scenario.current),reason,
    control:family==='N1'?hybrid?.base?.controlEvidence??manual?.controlEvidence??hybrid?.base??null:family==='LF'?lf?.diagnostics.convergence??null:null,
    coverage:family==='N1'?hybrid?.counts??(manual?{AC_ATTEMPTED:ctx.n1AcResults.length,AC_NUMERICALLY_SOLVED:numbers,AC_RESULTS_AVAILABLE:ctx.n1AcResults.filter(c=>!!c.result).length}:null):family==='SC'?sc?.counts??null:null,methodEvidence:family==='SC'?sc?.methodEvidence??null:null};
}
