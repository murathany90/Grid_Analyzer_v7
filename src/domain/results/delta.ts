import type { BranchResult, BusResult } from './types';
export const difference = (before: number | null | undefined, after: number | null | undefined): number | null =>
  before != null && after != null && Number.isFinite(before) && Number.isFinite(after) ? after - before : null;
export interface LoadingPair {pre:number|null;post:number|null;delta:number|null}
export function branchDelta(before?: BranchResult, after?: BranchResult,loading?:LoadingPair) {
  return { pMw: difference(before?.pf, after?.pf), qMvar: difference(before?.qf, after?.qf),
    loading: loading?loading.delta:difference(before?.loading, after?.loading), pLoss: difference(before?.pLoss, after?.pLoss),
    qLoss: difference(before?.qLoss, after?.qLoss) };
}
export function deltaSummary(rows: readonly { baseBranch?: BranchResult; branch?: BranchResult; baseBus?: BusResult; bus?: BusResult;loadingComparison?:LoadingPair;comparisons?:Record<string,{delta:number|null}|undefined> }[]) {
  const max = (values: (number | null)[]) => { const valid = values.filter((n): n is number => n != null && Number.isFinite(n)); return valid.length ? Math.max(...valid.map(Math.abs)) : null; };
  const paired=rows.map(r=>r.loadingComparison??{pre:r.baseBranch?.loading??null,post:r.branch?.loading??null,delta:difference(r.baseBranch?.loading,r.branch?.loading)}).filter(r=>r.pre!==null&&r.post!==null&&r.delta!==null);
  return { newOverloads: paired.length ? paired.filter(r => r.pre! < 100 && r.post! >= 100).length : null,
    resolvedOverloads: paired.length ? paired.filter(r => r.pre! >= 100 && r.post! < 100).length : null,
    maxP: max(rows.map(r => r.comparisons?r.comparisons.pFromMw?.delta??null:branchDelta(r.baseBranch,r.branch,r.loadingComparison).pMw)), maxQ: max(rows.map(r => r.comparisons?r.comparisons.qFromMvar?.delta??null:branchDelta(r.baseBranch,r.branch,r.loadingComparison).qMvar)),
    maxLoading: max(rows.map(r => branchDelta(r.baseBranch,r.branch,r.loadingComparison).loading)), maxV: max(rows.map(r => r.comparisons?r.comparisons.voltagePu?.delta??null:difference(r.baseBus?.vmPu,r.bus?.vmPu))) };
}
