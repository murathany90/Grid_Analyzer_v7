import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryLabels, n1StatusLabels, qualityPresentation, severityLabels, severityOrder } from '../../src/features/quality-n1/presentation';
import type { ModelQualityFinding } from '../../src/domain/model-quality';

test('quality and N-1 presentation retain technical codes with Turkish labels and severity order', () => {
  assert.deepEqual(severityOrder, ['BLOCKER', 'ERROR', 'WARNING', 'INFO']);
  assert.equal(severityLabels.BLOCKER, 'Engelleyici');
  assert.equal(categoryLabels.ELECTRICAL_DATA, 'Elektriksel Veri');
  assert.equal(n1StatusLabels.SCREENED_NO_VIOLATION, 'DC taramasında ihlal görülmedi');
  const finding = { code: 'ISLAND_WITHOUT_REFERENCE' } as ModelQualityFinding;
  assert.deepEqual(qualityPresentation(finding), {
    title: 'Referans Kaynağı Olmayan Ada',
    message: 'Bu elektrik adasında referans kaynak bulunamadı.',
    impact: 'Bu ada için güç akışı çözülemez.',
  });
});
