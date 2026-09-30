import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelQualityFinding } from '../../src/domain/model-quality';
import type { N1ScreenCandidate } from '../../src/domain/n1';
import { compareQuality, sortN1 } from '../../src/features/quality-n1/sorting';
import { aggregateCriticalConstraints, collectN1Violations } from '../../src/features/quality-n1/aggregation';
import { n1IslandStatusLabels } from '../../src/features/quality-n1/presentation';

test('N-1 priority sort reverses the existing ranked result without inventing a new score', () => {
  const ranked = ['first', 'second', 'third'].map(candidateId => ({ candidateId }) as N1ScreenCandidate);
  assert.deepEqual(sortN1(ranked, 'priority', 'asc').map(row => row.candidateId), ['first', 'second', 'third']);
  assert.deepEqual(sortN1(ranked, 'priority', 'desc').map(row => row.candidateId), ['third', 'second', 'first']);
  assert.deepEqual(ranked.map(row => row.candidateId), ['first', 'second', 'third']);
});

test('Model Quality message and impact sort by the Turkish text visible to the user', () => {
  const bus = { id: 'a', code: 'BUS_VN_INVALID', message: 'z', calculationImpact: 'a' } as ModelQualityFinding;
  const island = { id: 'z', code: 'ISLAND_WITHOUT_REFERENCE', message: 'a', calculationImpact: 'z' } as ModelQualityFinding;
  assert.ok(compareQuality(bus, island, 'message') < 0);
  assert.ok(compareQuality(island, bus, 'impact') < 0);
});

test('critical constraints count distinct outages for each overloaded monitored branch', () => {
  const impact = (equipmentId: string, loading: number) => ({ equipmentId, sourceClass: 'ElmLne', from: 'A', to: 'B', estimatedLoadingPct: loading, postEstimatedLoadingPct: loading, deltaPMw: 12 });
  const candidates = [
    { candidateId: 'outage-a', violationImpacts: [impact('line-1', 121), impact('line-2', 102)] },
    { candidateId: 'outage-b', violationImpacts: [impact('line-1', 133)] },
  ] as unknown as N1ScreenCandidate[];
  const rows = collectN1Violations(candidates);
  assert.equal(rows.length, 3);
  const critical = aggregateCriticalConstraints(rows);
  assert.deepEqual(critical.map(item => [item.equipmentId, item.outageCount, item.maxEstimatedLoadingPct]), [['line-1', 2, 133], ['line-2', 1, 102]]);
});

test('island reference status is presented in Turkish without exposing domain enums', () => {
  assert.equal(n1IslandStatusLabels.REFERENCED, 'Referanslı ada');
  assert.equal(n1IslandStatusLabels.UNREFERENCED, 'Referanssız ada');
});
