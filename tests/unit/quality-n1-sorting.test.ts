import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelQualityFinding } from '../../src/domain/model-quality';
import type { N1ScreenCandidate } from '../../src/domain/n1';
import { compareQuality, sortN1 } from '../../src/features/quality-n1/sorting';

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
