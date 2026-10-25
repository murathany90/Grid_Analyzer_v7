/** PTI SFL v1 physical container. Independently authored from format observations.
 * All pointers come from the input. Byte 3000 is never assumed to be SAV data.
 * This layer establishes byte ranges, not electrical completeness.
 */
export interface SavContainerExtent {
  pointer: number;
  headerByte: number;
  dataByte: number;
  capacityWords: number;
  usedWords: number;
  logicalStartWord: number;
  next: number;
}

export interface SavContainerSegment {
  number: number;
  directoryByte: number;
  logicalWords: number;
  extents: SavContainerExtent[];
}

export interface SavContainer {
  signature: 'PTI_SFL_';
  revision: 1;
  byteLength: number;
  allocatedWords: number;
  /** Logical segments in increasing segment-number order; segment 1 is first. */
  segments: Uint8Array[];
  segmentInfo: SavContainerSegment[];
}

const HEADER_BYTES = 1392;
const ROOT_COUNT = 328;
const DIRECTORY_BYTES = 100 * 16;
const MAX_EXTENTS = 65536;

export function readSavContainer(buffer: ArrayBuffer, maxBytes = 512 * 1024 * 1024): SavContainer {
  const source = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const fail = (message: string): never => { throw new Error(`SAV_SFL_INVALID: ${message}`); };
  if (!Number.isSafeInteger(maxBytes) || maxBytes < HEADER_BYTES) fail('invalid byte budget');
  if (source.length > maxBytes || source.length < HEADER_BYTES || (source.length - 12) % 4 !== 0) {
    fail('truncated or excessive physical length');
  }
  const magic = 'FuP_pHySPCD%PTI_SFL_';
  for (let i = 0; i < magic.length; i++) if (source[i] !== magic.charCodeAt(i)) fail('unsupported physical signature');
  const u32 = (at: number): number => {
    if (!Number.isSafeInteger(at) || at < 0 || at + 4 > source.length) fail('integer outside source');
    return view.getUint32(at, true);
  };
  if (u32(20) !== 1) fail('unsupported SFL revision');
  const allocatedWords = u32(24);
  const allocatedEnd = 12 + 4 * allocatedWords;
  if (allocatedEnd !== source.length) fail('allocated high-water mark disagrees with physical length');
  const physical = (pointer: number, length: number): number => {
    if (!Number.isSafeInteger(pointer) || pointer < 1) fail('null or invalid word pointer');
    // Word pointers are one-based relative to the SFL stream after its 12-byte physical prefix.
    const at = 12 + 4 * (pointer - 1);
    if (!Number.isSafeInteger(length) || length < 0 || at + length > allocatedEnd) fail('pointer outside allocation');
    return at;
  };
  const ranges: { start: number; end: number }[] = [{ start: 0, end: HEADER_BYTES }];
  const directories: { group: number; at: number }[] = [];
  for (let group = 0; group < ROOT_COUNT; group++) {
    const pointer = u32(80 + group * 4);
    if (!pointer) continue;
    const at = physical(pointer, DIRECTORY_BYTES);
    if (at < HEADER_BYTES) fail('directory overlaps fixed header');
    ranges.push({ start: at, end: at + DIRECTORY_BYTES });
    directories.push({ group, at });
  }
  const segmentInfo: SavContainerSegment[] = [];
  let totalLogicalBytes = 0;
  let totalExtents = 0;
  for (const directory of directories) {
    for (let slot = 0; slot < 100; slot++) {
      const entry = directory.at + slot * 16;
      const first = u32(entry), last = u32(entry + 4), logicalWords = u32(entry + 8), lastStart = u32(entry + 12);
      if (!first && !last && !lastStart && (logicalWords === 0 || logicalWords === 0xffffffff)) continue;
      if (!first || !last || !logicalWords || logicalWords === 0xffffffff || !lastStart || lastStart > logicalWords) {
        fail('inconsistent segment directory entry');
      }
      const logicalBytes = logicalWords * 4;
      totalLogicalBytes += logicalBytes;
      if (logicalBytes > source.length || totalLogicalBytes > source.length || totalLogicalBytes > maxBytes) {
        fail('logical size exceeds physical source or byte budget');
      }
      const extents: SavContainerExtent[] = [];
      const seen = new Set<number>();
      let pointer = first, words = 0;
      while (pointer) {
        if (seen.has(pointer)) fail('extent cycle');
        seen.add(pointer);
        totalExtents++;
        if (totalExtents > MAX_EXTENTS) fail('extent traversal budget exceeded');
        const at = physical(pointer, 8);
        const next = u32(at), capacityWords = u32(at + 4);
        if (!capacityWords || words >= logicalWords) fail('invalid capacity or excessive chain');
        physical(pointer, 8 + capacityWords * 4);
        ranges.push({ start: at, end: at + 8 + capacityWords * 4 });
        const logicalStartWord = words + 1;
        const usedWords = Math.min(capacityWords, logicalWords - words);
        extents.push({ pointer, headerByte: at, dataByte: at + 8, capacityWords, usedWords, logicalStartWord, next });
        words += usedWords;
        if (pointer === last) {
          if (next !== 0 || logicalStartWord !== lastStart) fail('last extent metadata disagrees with chain');
        } else if (!next) fail('chain ends before declared last extent');
        pointer = next;
      }
      if (words !== logicalWords || extents.at(-1)?.pointer !== last) fail('logical size or last extent mismatch');
      segmentInfo.push({ number: directory.group * 100 + slot + 1, directoryByte: entry, logicalWords, extents });
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) fail('overlapping directory, header or extent ranges');
  }
  if (segmentInfo[0]?.number !== 1) fail('required SAV segment 1 is absent');
  // Allocate only after every declared physical range and chain has been validated.
  const segments = segmentInfo.map(segment => {
    const output = new Uint8Array(segment.logicalWords * 4);
    for (const extent of segment.extents) {
      output.set(source.subarray(extent.dataByte, extent.dataByte + extent.usedWords * 4), (extent.logicalStartWord - 1) * 4);
    }
    return output;
  });
  return { signature: 'PTI_SFL_', revision: 1, byteLength: source.length, allocatedWords, segments, segmentInfo };
}

/** Physical source ranges for a logical byte span, including fields split across extents. */
export function savPhysicalRanges(segment: SavContainerSegment, logicalByte: number, byteLength: number): { offset: number; length: number }[] {
  if (!Number.isSafeInteger(logicalByte) || !Number.isSafeInteger(byteLength) || logicalByte < 0 || byteLength < 0 || logicalByte + byteLength > segment.logicalWords * 4) {
    throw new Error('SAV_SFL_INVALID: provenance span outside segment');
  }
  const end = logicalByte + byteLength;
  return segment.extents.flatMap(extent => {
    const start = (extent.logicalStartWord - 1) * 4;
    const from = Math.max(start, logicalByte);
    const to = Math.min(start + extent.usedWords * 4, end);
    return from < to ? [{ offset: extent.dataByte + from - start, length: to - from }] : [];
  });
}
