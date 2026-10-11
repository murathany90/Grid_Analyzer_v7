import type {AppContext} from '../../app/contracts';
import {scenarioSignature,emptyScenario} from '../../domain/scenario/overlay';
import {lfSnapshotIsCurrent,selectN1Result} from '../../domain/benchmark/post-result-source';
import {activeResultId} from '../../domain/results/workspace';

export type StudyEvidenceStatus='ENGINE_CALCULATED'|'SOURCE_VERIFIED'|'METHOD_VERIFIED'|'NETWORK_APPROXIMATION'|'EXPLORATORY_ONLY'|'BLOCKED'|'NOT_CALCULATED'|'STALE_RESULT';
/** The selected record owns its status, time, identity and control proof together.
 * Numerical convergence never verifies source/method/PF parity. */
export function studyEvidence(ctx:AppContext){
  const family=ctx.analysisTab,n=ctx.network,sc=ctx.scResult,lf=ctx.resultStore.active;
  const selected=selectN1Result({network:n,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,ac:ctx.n1AcResults,hybrid:ctx.hybridResult,dc:ctx.n1Result},ctx.resultView.caseId);
  const manual=selected.ac,h=selected.hybrid,hc=selected.hybridCase,dc=selected.dc;
  const pfOnly=ctx.resultView.source==='PF',reference=pfOnly?ctx.benchmark?.groups[family]:null;
  const result=pfOnly?null:family==='SC'?sc:family==='N1'?manual??hc??h??dc:lf;
  const stale=!!result&&(!n||(family==='SC'?sc!.identity.modelHash!==n.modelHash||sc!.identity.scenarioHash!==scenarioSignature(ctx.scenario.current):family==='N1'?!selected.current:!lfSnapshotIsCurrent(lf!,n,ctx.resultStore.role==='base'?emptyScenario():ctx.scenario.current,ctx.analysisSettings.value)));
  const solved=manual?!!(manual.controlEvidence?.numericalSolved??manual.result?.converged):hc?!!(hc.controlEvidence?.numericalSolved??hc.acSolved):false;
  const numbers=pfOnly?0:family==='SC'?sc?.faults.filter(f=>f.ikssKa!==null&&Number.isFinite(f.ikssKa)).length??0:family==='N1'?manual||hc?Number(solved):h?.counts.AC_NUMERICALLY_SOLVED??(selected.candidate?Number(['SCREENED_VIOLATION','SCREENED_NO_VIOLATION','SCREENED'].includes(selected.candidate.status)):dc?.screenedCount??0):lf?.converged?lf.buses.length:0;
  const recordStatus=pfOnly?'PF_REFERENCE_ONLY':family==='N1'?manual?.status??hc?.status??h?.status??selected.candidate?.status??(dc?'DC_SCREENED':'NOT_RUN'):family==='LF'?lf?.status??'NOT_RUN':sc?.faults.find(f=>f.physicalTerminalFid===ctx.resultView.faultId)?.status??(sc?'SC_BATCH':'NOT_RUN');
  const rejected=manual?manual.result===null:hc?['BLOCKED','AC_DIVERGED','ISLAND_UNSUPPLIED','CANCELLED'].includes(hc.status):h?.status==='BLOCKED';
  const blocked=pfOnly?0:family==='SC'?sc?.counts.BLOCKED??0:family==='N1'?manual||hc?Number(rejected):h?.counts.BLOCKED??Number(rejected):lf&&!lf.converged?1:0;
  const numerical:StudyEvidenceStatus=stale?'STALE_RESULT':numbers?'ENGINE_CALCULATED':blocked?'BLOCKED':'NOT_CALCULATED';
  const method:StudyEvidenceStatus=pfOnly?reference?'EXPLORATORY_ONLY':'NOT_CALCULATED':family==='SC'?sc?.profile.edition?'BLOCKED':sc?'NETWORK_APPROXIMATION':'NOT_CALCULATED':result?'EXPLORATORY_ONLY':'NOT_CALCULATED';
  const control=pfOnly?null:family==='N1'?manual?.controlEvidence??hc?.controlEvidence??h?.base?.controlEvidence??null:family==='LF'?lf?.diagnostics.convergence??null:null;
  const coverage=pfOnly?null:family==='N1'?manual||hc?{AC_ATTEMPTED:manual?1:Number(hc?.acAttempted),AC_NUMERICALLY_SOLVED:numbers,AC_RESULTS_AVAILABLE:manual?Number(!!manual.result):Number(!!hc?.mapResults),AC_VERIFIED:control&&typeof control==='object'&&'fidelity' in control?Number(control.fidelity==='CONTROL_VERIFIED'&&['CONVERGED','AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION'].includes(recordStatus)):0}:h?.counts??(dc?{DC_SCREENED:numbers}:null):family==='SC'?sc?.counts??null:null;
  const reason=pfOnly?'PF_REFERENCE_ONLY; GA calculation evidence is not reference evidence':family==='SC'?sc?.methodEvidence?.blockers.join('; ')??sc?.assumptions.join('; ')??'SC çalıştırılmadı':family==='N1'?manual?.reason??hc?.reason??h?.reason??selected.candidate?.exclusionReason??'Seçili vaka çalıştırılmadı':lf?.warnings.join('; ')??'Yük akışı çalıştırılmadı';
  const resultIdentity=pfOnly?reference?.identity??null:family==='SC'?sc?.identity??null:family==='N1'?manual?.identity??h?.identity??dc?.identity??null:lf?.identity??null;
  return {family,numerical,source:result||reference?'EXPLORATORY_ONLY' as const:'NOT_CALCULATED' as const,method,pf:result||reference?'EXPLORATORY_ONLY' as const:'NOT_CALCULATED' as const,numbers,blocked,elapsedMs:result?.elapsedMs??null,
    recordSource:pfOnly?'PF_REFERENCE_ONLY':family==='N1'?selected.source:family==='SC'?sc?.method??'NOT_RUN':lf?.identity.analysisType??'NOT_RUN',recordStatus,resultId:activeResultId(ctx),resultIdentity,
    caseId:family==='N1'?ctx.resultView.caseId??null:null,residualMw:pfOnly?null:family==='LF'?lf?.maxMismatchMw??null:family==='N1'?manual?.controlEvidence?.maxMismatchMw??manual?.result?.maxMismatchMw??hc?.maxMismatchMw??h?.base?.maxMismatchMw??null:null,modelHash:n?.modelHash??null,scenarioId:ctx.scenario.selectedId,scenarioHash:scenarioSignature(ctx.scenario.current),reason,control,coverage,
    runCoverage:!pfOnly&&family==='N1'?h?.counts??null:null,methodEvidence:!pfOnly&&family==='SC'?sc?.methodEvidence??null:null};
}
