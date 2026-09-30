import type { ModelQualityFinding, ModelQualitySeverity } from '../../domain/model-quality';
import type { N1ScreenCandidate } from '../../domain/n1';
import type { N1CatalogCandidate } from '../../domain/n1/catalog';
import { categoryLabels, qualityPresentation } from './presentation';

export type SortDirection = 'asc' | 'desc';

const severityRank: Record<ModelQualitySeverity, number> = { BLOCKER: 0, ERROR: 1, WARNING: 2, INFO: 3 };

export function compareQuality(a: ModelQualityFinding, b: ModelQualityFinding, key: string): number {
  if (key === 'severity') return severityRank[a.severity] - severityRank[b.severity] || a.code.localeCompare(b.code) || a.id.localeCompare(b.id);
  const value = (finding: ModelQualityFinding): string => {
    if (key === 'equipment') return finding.entityName || finding.entityId || '';
    if (key === 'category') return categoryLabels[finding.category];
    if (key === 'message') return qualityPresentation(finding).message;
    if (key === 'impact') return qualityPresentation(finding).impact;
    return String(finding[key as keyof ModelQualityFinding] ?? '');
  };
  return value(a).localeCompare(value(b), 'tr') || a.id.localeCompare(b.id);
}

export function sortN1<T extends N1ScreenCandidate | N1CatalogCandidate>(rows: readonly T[], key: string, direction: SortDirection): T[] {
  const sorted = [...rows];
  if (key === 'priority') return direction === 'asc' ? sorted : sorted.reverse();
  const value = (x: T): string | number => {
    if (key === 'name') return x.name;
    if (key === 'type') return x.sourceClass;
    if (key === 'kv') return x.vnKv;
    if (key === 'status') return 'status' in x ? String(x.status) : x.screenable ? 'Taranabilir' : x.topology;
    const result = x as N1ScreenCandidate;
    if (key === 'maxEstimatedLoadingPct') return result.maxEstimatedLoadingPct ?? -1;
    if (key === 'estimatedOverloadCount') return result.estimatedOverloadCount;
    if (key === 'maxDeltaPMw') return result.maxDeltaPMw ?? -1;
    return '';
  };
  sorted.sort((a, b) => {
    const av = value(a), bv = value(b);
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'tr');
    return (direction === 'asc' ? cmp : -cmp) || a.candidateId.localeCompare(b.candidateId);
  });
  return sorted;
}
