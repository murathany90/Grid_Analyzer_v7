import type { BranchResult, BusResult } from './types';
export const difference = (before: number | null | undefined, after: number | null | undefined): number | null =>
  before != null && after != null && Number.isFinite(before) && Number.isFinite(after) ? after - before : null;
export function branchDelta(before?: BranchResult, after?: BranchResult) {
  return { pMw: difference(before?.pf, after?.pf), qMvar: difference(before?.qf, after?.qf),
    loading: difference(before?.loading, after?.loading), pLoss: difference(before?.pLoss, after?.pLoss),
    qLoss: difference(before?.qLoss, after?.qLoss) };
}
export function deltaSummary(rows: readonly { baseBranch?: BranchResult; branch?: BranchResult; baseBus?: BusResult; bus?: BusResult }[]) {
  const max = (values: (number | null)[]) => { const valid = values.filter((n): n is number => n != null && Number.isFinite(n)); return valid.length ? Math.max(...valid.map(Math.abs)) : null; };
  const paired = rows.filter(r => r.baseBranch?.loading != null && r.branch?.loading != null);
  return { newOverloads: paired.length ? paired.filter(r => r.baseBranch!.loading! < 100 && r.branch!.loading! >= 100).length : null,
    resolvedOverloads: paired.length ? paired.filter(r => r.baseBranch!.loading! >= 100 && r.branch!.loading! < 100).length : null,
    maxP: max(rows.map(r => branchDelta(r.baseBranch,r.branch).pMw)), maxQ: max(rows.map(r => branchDelta(r.baseBranch,r.branch).qMvar)),
    maxLoading: max(rows.map(r => branchDelta(r.baseBranch,r.branch).loading)), maxV: max(rows.map(r => difference(r.baseBus?.vmPu,r.bus?.vmPu))) };
}
