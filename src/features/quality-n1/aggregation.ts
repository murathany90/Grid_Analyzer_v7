import type { N1Impact, N1ScreenCandidate } from '../../domain/n1';

export interface N1ViolationRow {
  outage: N1ScreenCandidate;
  impact: N1Impact;
}

export interface N1CriticalConstraint {
  equipmentId: string;
  sourceClass: string;
  name: string;
  from: string;
  to: string;
  violationCount: number;
  outageCount: number;
  maxEstimatedLoadingPct: number;
  maxAbsDeltaPMw: number;
}

export function collectN1Violations(candidates: readonly N1ScreenCandidate[]): N1ViolationRow[] {
  const rows: N1ViolationRow[] = [];
  for (const outage of candidates) {
    for (const impact of outage.violationImpacts ?? []) rows.push({ outage, impact });
  }
  return rows;
}

export function aggregateCriticalConstraints(rows: readonly N1ViolationRow[]): N1CriticalConstraint[] {
  const grouped = new Map<string, { row: N1ViolationRow; outages: Set<string>; maxLoading: number; maxDelta: number; count: number }>();
  for (const row of rows) {
    const key = `${row.impact.sourceClass}:${row.impact.equipmentId}`;
    let item = grouped.get(key);
    if (!item) {
      item = { row, outages: new Set(), maxLoading: 0, maxDelta: 0, count: 0 };
      grouped.set(key, item);
    }
    item.outages.add(row.outage.candidateId);
    item.count++;
    item.maxLoading = Math.max(item.maxLoading, row.impact.estimatedLoadingPct ?? row.impact.postEstimatedLoadingPct ?? 0);
    item.maxDelta = Math.max(item.maxDelta, Math.abs(row.impact.deltaPMw));
  }
  return [...grouped.values()].map(({ row, outages, maxLoading, maxDelta, count }) => ({
    equipmentId: row.impact.equipmentId,
    sourceClass: row.impact.sourceClass,
    name: row.impact.equipmentId,
    from: row.impact.from,
    to: row.impact.to,
    violationCount: count,
    outageCount: outages.size,
    maxEstimatedLoadingPct: maxLoading,
    maxAbsDeltaPMw: maxDelta,
  })).sort((a, b) => b.outageCount - a.outageCount || b.maxEstimatedLoadingPct - a.maxEstimatedLoadingPct || b.violationCount - a.violationCount || a.equipmentId.localeCompare(b.equipmentId));
}
