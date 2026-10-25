import test from 'node:test';
import assert from 'node:assert/strict';
import { readSavContainer, savPhysicalRanges } from '../../src/importers/psse/sav-container';

/** Entirely synthetic container; no Siemens/model bytes are copied into fixtures. */
function fixture({ root = 400, first = 900, split = true, spare = 0 } = {}) {
  const payload = Uint8Array.from({ length: 96 }, (_, i) => (i * 31 + 17) & 255);
  const firstWords = split ? 12 : payload.length / 4;
  const second = first + firstWords + 102;
  const offset = (word: number) => 12 + 4 * (word - 1);
  const last = split ? second : first;
  const lastCapacity = payload.length / 4 - (split ? firstWords : 0) + spare;
  const buffer = new ArrayBuffer(offset(last) + 8 + lastCapacity * 4);
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  bytes.set(new TextEncoder().encode('FuP_pHySPCD%PTI_SFL_'));
  const put = (at: number, value: number) => view.setUint32(at, value, true);
  put(20, 1); put(24, (buffer.byteLength - 12) / 4); put(36, 1); put(80, root);
  const directory = offset(root);
  put(directory, first); put(directory + 4, last); put(directory + 8, payload.length / 4);
  put(directory + 12, split ? firstWords + 1 : 1);
  put(offset(first), split ? second : 0); put(offset(first) + 4, split ? firstWords : lastCapacity);
  bytes.set(payload.subarray(0, firstWords * 4), offset(first) + 8);
  if (split) {
    put(offset(second), 0); put(offset(second) + 4, lastCapacity);
    bytes.set(payload.subarray(firstWords * 4), offset(second) + 8);
  }
  return { buffer, payload, view, directory, first: offset(first), second: offset(second), put };
}

test('SAV container follows relocated directory and noncontiguous extent pointers', () => {
  const f = fixture(), parsed = readSavContainer(f.buffer);
  assert.deepEqual(parsed.segments[0], f.payload);
  assert.equal(parsed.segmentInfo[0].directoryByte, 1608);
  assert.equal(parsed.segmentInfo[0].extents.length, 2);
  assert.equal(parsed.segmentInfo[0].extents[0].dataByte, 3616);
  assert.equal(parsed.segmentInfo[0].extents[1].logicalStartWord, 13);
});

test('SAV container handles a single extent and ignores proven spare last-extent capacity', () => {
  for (const split of [true, false]) {
    const f = fixture({ root: 450, first: 1000, split, spare: 10 });
    assert.deepEqual(readSavContainer(f.buffer).segments[0], f.payload);
  }
});

test('SAV physical provenance includes every range for a field across an extent boundary', () => {
  const f = fixture(), segment = readSavContainer(f.buffer).segmentInfo[0];
  assert.deepEqual(savPhysicalRanges(segment, 44, 12), [{ offset: f.first + 8 + 44, length: 4 }, { offset: f.second + 8, length: 8 }]);
  assert.deepEqual(savPhysicalRanges(segment, 96, 0), []);
  assert.throws(() => savPhysicalRanges(segment, 95, 2), /provenance span outside/);
});

test('SAV container rejects unsupported headers, truncated allocations and size bombs', () => {
  let f = fixture(); new Uint8Array(f.buffer)[0] = 0;
  assert.throws(() => readSavContainer(f.buffer), /signature/);
  f = fixture(); f.put(20, 2);
  assert.throws(() => readSavContainer(f.buffer), /revision/);
  f = fixture();
  assert.throws(() => readSavContainer(f.buffer.slice(0, -4)), /high-water/);
  assert.throws(() => readSavContainer(f.buffer.slice(0, -1)), /physical length/);
  assert.throws(() => readSavContainer(f.buffer, 2000), /physical length/);
  f.put(f.directory + 8, 0x7fffffff);
  assert.throws(() => readSavContainer(f.buffer), /logical size/);
});

test('SAV container rejects bad directory/extent pointers, missing segments and reserved deletion markers', () => {
  let f = fixture(); f.put(80, 0xffffffff);
  assert.throws(() => readSavContainer(f.buffer), /outside allocation/);
  f = fixture(); f.put(f.directory, 0xffffffff);
  assert.throws(() => readSavContainer(f.buffer), /outside allocation/);
  f = fixture(); f.put(80, 0);
  assert.throws(() => readSavContainer(f.buffer), /segment 1 is absent/);
  f = fixture(); f.put(f.directory + 8, 0xffffffff);
  assert.throws(() => readSavContainer(f.buffer), /inconsistent segment/);
  f = fixture(); f.put(f.first + 4, 0xffffffff);
  assert.throws(() => readSavContainer(f.buffer), /outside allocation/);
});

test('SAV container rejects cycles, incomplete chains and false last-extent positions', () => {
  let f = fixture(); f.put(f.first, 900);
  assert.throws(() => readSavContainer(f.buffer), /extent cycle/);
  f = fixture(); f.put(f.first, 0);
  assert.throws(() => readSavContainer(f.buffer), /before declared last/);
  f = fixture(); f.put(f.directory + 12, 2);
  assert.throws(() => readSavContainer(f.buffer), /last extent metadata/);
});

test('SAV container rejects directory aliases and extent/header overlap', () => {
  let f = fixture(); f.put(84, 400);
  assert.throws(() => readSavContainer(f.buffer), /overlapping/);
  f = fixture(); f.put(80, 1);
  assert.throws(() => readSavContainer(f.buffer), /directory overlaps/);
  f = fixture(); f.put(f.directory, 401);
  assert.throws(() => readSavContainer(f.buffer), /capacity|last|overlapping|chain/);
});

test('SAV container inventories additional logical segments instead of dropping them', () => {
  const f = fixture({ split: false, spare: 4 });
  // Use four former spare words as an independently referenced 2-word segment.
  f.put(f.first + 4, 24);
  const nextHeader = f.first + 8 + 96;
  const nextPointer = (nextHeader - 8) / 4;
  f.put(f.directory + 16, nextPointer); f.put(f.directory + 20, nextPointer);
  f.put(f.directory + 24, 2); f.put(f.directory + 28, 1);
  f.put(nextHeader, 0); f.put(nextHeader + 4, 2);
  f.put(nextHeader + 8, 0x12345678); f.put(nextHeader + 12, 0xabcdef01);
  const parsed = readSavContainer(f.buffer);
  assert.equal(parsed.segments.length, 2);
  assert.deepEqual(parsed.segmentInfo.map(s => s.number), [1, 2]);
  assert.equal(new DataView(parsed.segments[1].buffer).getUint32(0, true), 0x12345678);
});
