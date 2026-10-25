import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { readSavContainer } from '../../src/importers/psse/sav-container';
import { readSavPayloadArrays } from '../../src/importers/psse/sav-layout';
import { SAV_LAYOUT_31 } from '../../src/importers/psse/sav-layout-schema';

const golden = JSON.parse(fs.readFileSync(new URL('../../evidence/sav-layout-position-parity.json', import.meta.url), 'utf8')) as {
  cases: { file: string; sha256: string; indexedPositionDigest: string; decodedPresentFields: number; consumedBytes: number; payloadBytes: number; unmappedTailBytes: number }[];
};
const installation = process.env.PSSE_TEST_ROOT ?? 'C:/Program Files/PTI/PSSE36/36.5';
const digest = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

test('native SAV refuses an unverified layout without attempting electrical extraction', () => {
  const bytes = new Uint8Array(40);
  bytes.set(new TextEncoder().encode('LILL32'));
  assert.throws(() => readSavPayloadArrays(bytes), /SAV_UNSUPPORTED_LAYOUT: 32/);
  assert.throws(() => readSavPayloadArrays(bytes.subarray(0, 20)), /SAV_PAYLOAD_SIZE/);
  bytes[0] = 0;
  assert.throws(() => readSavPayloadArrays(bytes), /SAV_UNSUPPORTED_REPRESENTATION/);
});

for (const fixture of golden.cases) {
  const filename = path.join(installation, fixture.file);
  test(`native SAV 621-array position parity: ${fixture.file}`, { skip: !fs.existsSync(filename) }, () => {
    const bytes = fs.readFileSync(filename);
    assert.equal(digest(bytes), fixture.sha256, 'oracle metadata belongs to this exact input');
    const buffer = Uint8Array.from(bytes).buffer;
    const payload = readSavContainer(buffer).segments[0];
    const result = readSavPayloadArrays(payload);
    const positions = SAV_LAYOUT_31.map(([name]) => [name, result.arrays[name] ? result.arrays[name].offset / 4 + 1 : 0]);
    assert.equal(positions.length, 621);
    assert.equal(digest(JSON.stringify(positions)), fixture.indexedPositionDigest,
      'every active and absent logical position agrees with the independent native trace');
    assert.equal(Object.keys(result.arrays).length, fixture.decodedPresentFields);
    assert.equal(result.consumedBytes, fixture.consumedBytes);
    assert.equal(payload.byteLength, fixture.payloadBytes);
    assert.equal(result.tail.bytes.length, fixture.unmappedTailBytes);
    for (const [name, array] of Object.entries(result.arrays)) {
      assert.ok(Number.isInteger(array.offset) && array.offset >= 0 && array.offset <= payload.byteLength, name);
      assert.ok(Number.isInteger(array.count) && array.count >= 0, name);
      if (array.type === 'CHAR') {
        assert.equal((array.values[0] as string).length, array.count, name);
      } else {
        assert.equal(array.values.length, array.count, name);
        assert.ok(array.values.flat().every(value => typeof value === 'number' && Number.isFinite(value)), name);
      }
    }

    const hugeCount = payload.slice();
    new DataView(hugeCount.buffer).setInt32(result.arrays.Headin.offset, 2_147_483_647, true);
    assert.throws(() => readSavPayloadArrays(hugeCount), /SAV_INVALID_BUS_COUNT/);
    const nonfinite = payload.slice();
    new DataView(nonfinite.buffer).setFloat32(result.arrays.Basvlt.offset, Number.NaN, true);
    assert.throws(() => readSavPayloadArrays(nonfinite), /SAV_NONFINITE: Basvlt/);
    const complexNonfinite = payload.slice();
    new DataView(complexNonfinite.buffer).setFloat64(result.arrays.Dblvlt.offset + 8, Number.POSITIVE_INFINITY, true);
    assert.throws(() => readSavPayloadArrays(complexNonfinite), /SAV_NONFINITE: Dblvlt/);
    assert.throws(() => readSavPayloadArrays(payload.subarray(0, result.arrays.Ratings.offset + 1)), /SAV_TRUNCATED_ARRAY/);
  });
}
