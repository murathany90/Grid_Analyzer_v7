import type { PsseBinaryArray } from './types';
import { SAV_LAYOUT_31, savDimension, savPredicate } from './sav-layout-schema';

export interface SavPayloadResult {
  arrays: Record<string, PsseBinaryArray>;
  header: Record<string, unknown>;
  consumedBytes: number;
  tail: { offset: number; bytes: number[]; recognizedEmptyExtension: boolean };
}

const TYPE_NAMES = ['I32', 'F32', 'F64', 'CHAR', 'LOGICAL', 'C64', 'C128'] as const;
const TYPE_BYTES = [4, 4, 8, 1, 4, 8, 16] as const;

/** One byte maps to one code point so names and opaque strings remain byte faithful. */
function latin1(bytes: Uint8Array): string {
  let value = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    value += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return value;
}

/**
 * Read the logical SFL stream, after container extent reconstruction.
 * Every offset is relative to that stream. No model-specific file offsets, host
 * APIs, native libraries, network operations, or preconverted models are used.
 * Layout 31 is the only layout validated by the current implementation.
 */
export function readSavPayloadArrays(payload: Uint8Array): SavPayloadResult {
  if (payload.byteLength < 40 || payload.byteLength > 512 * 1024 * 1024) {
    throw new Error('SAV_PAYLOAD_SIZE: missing, truncated or excessive logical stream');
  }
  const info = latin1(payload.subarray(0, 36));
  if (info.slice(0, 4) !== 'LILL' || !/^\d{2}$/.test(info.slice(4, 6))) {
    throw new Error('SAV_UNSUPPORTED_REPRESENTATION: expected validated LILL representation');
  }
  const revision = Number(info.slice(4, 6));
  if (revision !== 31) {
    throw new Error(`SAV_UNSUPPORTED_LAYOUT: ${revision}; verified layout is 31`);
  }
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const arrays: Record<string, PsseBinaryArray> = Object.create(null);
  let cursor = 0;
  let scalarIndex = 0;
  let integers: number[] = [];
  let limits: number[] = [];
  let logical: number[] = [];
  let opfIntegers: number[] = [];
  const numeric = (name: string): number[] => {
    const values = arrays[name]?.values;
    if (!values) return [];
    if (values.some(value => typeof value !== 'number')) {
      throw new Error(`SAV_INVALID_NUMERIC_ARRAY: ${name}`);
    }
    return values as number[];
  };
  const first = (name: string): number => numeric(name)[0] ?? 0;
  const finite = (value: number, field: string, offset: number): number => {
    if (!Number.isFinite(value)) throw new Error(`SAV_NONFINITE: ${field} at logical byte ${offset}`);
    return value;
  };
  const ensure = (offset: number, bytes: number, name: string): void => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(bytes) || offset < 0 || bytes < 0 || offset > payload.byteLength - bytes) {
      throw new Error(`SAV_TRUNCATED_ARRAY: ${name} at logical byte ${offset}, ${bytes} bytes`);
    }
  };
  const variableDescriptionBytes = (): number => {
    let end = cursor;
    const count = integers[68];
    if (!Number.isSafeInteger(count) || count < 0 || count > Math.floor((payload.byteLength - end) / 4)) {
      throw new Error('SAV_INVALID_DESCRIPTION_COUNT');
    }
    for (let index = 0; index < count; index += 1) {
      ensure(end, 4, 'Rsetdesc.length');
      const length = view.getInt32(end, true);
      if (length < 0) throw new Error('SAV_INVALID_DESCRIPTION_LENGTH');
      const bytes = Math.ceil(length / 4) * 4;
      ensure(end + 4, bytes, 'Rsetdesc.text');
      end += 4 + bytes;
    }
    return end - cursor;
  };
  const dimension = (code: number): number => {
    switch (code) {
      case 0: return [first('Release'), 28, 71, 10, 37, 17, 19, 31][scalarIndex - 1];
      case -101: {
        let mask = first('Ratselector') & 0xfff;
        let count = 0;
        while (mask) { count += mask & 1; mask >>>= 1; }
        return count * integers[3];
      }
      case -117: return numeric('Ntbpnt').reduce((sum, count) => sum + Math.max(0, count), 0);
      case -124: return Math.max(0, Math.min(1288, numeric('Vg3idx').reduce((max, value) => Math.max(max, value), 0)) - 288) * 9;
      case -139: return variableDescriptionBytes();
      case -152: return numeric('Nctpak').reduce((sum, value) => sum + (value & 63), 0);
      default: return savDimension(code, integers, limits, opfIntegers);
    }
  };

  for (const [name, type, code, predicate, minimumRevision] of SAV_LAYOUT_31) {
    if (code === 0) scalarIndex += 1;
    if (minimumRevision > revision) continue;
    if (!savPredicate(predicate, integers, logical, opfIntegers, limits, first)) continue;
    const count = code <= 0 ? dimension(code) : code;
    const elementBytes = TYPE_BYTES[type];
    if (!Number.isSafeInteger(count) || count < 0 || elementBytes === undefined) {
      throw new Error(`SAV_INVALID_DIMENSION: ${name} (${count})`);
    }
    const bytes = count * elementBytes;
    ensure(cursor, Math.ceil(bytes / 4) * 4, name);
    const values: PsseBinaryArray['values'] = [];
    if (type === 3) {
      values.push(latin1(payload.subarray(cursor, cursor + bytes)));
    } else {
      for (let index = 0; index < count; index += 1) {
        const offset = cursor + index * elementBytes;
        switch (type) {
          case 0: case 4: values.push(view.getInt32(offset, true)); break;
          case 1: values.push(finite(view.getFloat32(offset, true), name, offset)); break;
          case 2: values.push(finite(view.getFloat64(offset, true), name, offset)); break;
          case 5: values.push([finite(view.getFloat32(offset, true), name, offset), finite(view.getFloat32(offset + 4, true), name, offset + 4)]); break;
          case 6: values.push([finite(view.getFloat64(offset, true), name, offset), finite(view.getFloat64(offset + 8, true), name, offset + 8)]); break;
          default: throw new Error(`SAV_UNSUPPORTED_TYPE: ${type}`);
        }
      }
    }
    arrays[name] = { type: TYPE_NAMES[type], count, offset: cursor, values };
    cursor += Math.ceil(bytes / 4) * 4;
    if (name === 'Release' && (first('Release') < 0 || first('Release') > 65536)) throw new Error('SAV_INVALID_RELEASE_LENGTH');
    if (name === 'Headin') {
      integers = numeric(name);
      if (integers[0] < 1 || integers[0] > 2_000_000) throw new Error('SAV_INVALID_BUS_COUNT');
    } else if (name === 'Maxary') limits = numeric(name);
    else if (name === 'Headlo') logical = numeric(name);
    else if (name === 'Ophdin') opfIntegers = numeric(name);
  }

  const tailBytes = Array.from(payload.subarray(cursor));
  const recognizedEmptyExtension = tailBytes.length === 20 && tailBytes.every(value => value === 0);
  return {
    arrays,
    header: { layoutRevision: revision, info, integerHeader: integers, sizingLimits: limits, logicalHeader: logical, opfIntegerHeader: opfIntegers },
    consumedBytes: cursor,
    tail: { offset: cursor, bytes: tailBytes, recognizedEmptyExtension },
  };
}
