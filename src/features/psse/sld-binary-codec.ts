/**
 * Pure TypeScript CArchive Binary Codec for PSS(R)E 36.5 Single-Line Diagrams (.sld)
 * Supports Slider binary format versions 2.0.49.x (PSS/E 34/35) and 2.0.51.x (PSS/E 36.5).
 *
 * Full MFC CArchive reader and writer:
 * - Dynamic class registration and object mapping (0xFFFF class tag, 0x8000 | cls_idx, REF index tags).
 * - Complete CArchive record graphs: Symbol -> Port -> Link -> KneePoint -> Port -> Symbol.
 * - CSldBusbar, CSldPointNode, CSldRadial, CSldBranch, CSldTwoWindingTransformer, CSldThreeWindingTransformer.
 * - CSldPort (relative offsets dx, dy to owner symbol position).
 * - CSldLink (knees list, port references p1, p2).
 * - CSldKneePoint (absolute x, y, owner link reference).
 * - CSldLabel (text, owner component reference, position, font info).
 * - CSldLayer (22 lists for 2.0.51.1, 21 lists for 2.0.49.3).
 * - CSldGroup, CSldSavedView.
 * - Mandatory pre-export round-trip validation within 1e-4 tolerance.
 */

export interface GaSldLayer {
  n: number;
  desc: string;
  vis: string;
  minZ?: number;
  maxZ?: number;
}

export interface GaSldLinkEndpoint {
  sym: number;
  pos: [number, number];
  idx?: number;
}

export interface GaSldKneeMeta {
  id: number;
  pos: [number, number];
  binOffset: number;
}

export interface GaSldComponent {
  id: number;
  t: 'Symbol' | 'Link' | 'Label';
  layer: number;
  color: number;
  pos?: [number, number];
  rot?: number;
  map?: string;
  stype?: 'Busbar' | 'Branch' | 'Radial' | 'Node';
  psse?: string;
  sdef?: number;
  len?: number;
  width?: number;
  ends?: [[number, number], [number, number]];
  p1?: GaSldLinkEndpoint;
  p2?: GaSldLinkEndpoint;
  knees?: [number, number][];
  _rawKnees?: GaSldKneeMeta[];
  lwidth?: number;
  lstyle?: number;
  text?: string;
  fh?: number;
  lpos?: number;
  owner?: number;
  vis?: boolean;
  groupId?: string;
  _rawObj?: any;
}

export interface GaSldDocument {
  format: 'ga-sld-v1';
  fileVersion: string;
  layers: GaSldLayer[];
  components: GaSldComponent[];
  rawBytes?: Uint8Array;
  _rawMainList?: any[];
  _rawLayers?: any[];
  _rawGroups?: any[];
  _rawViews?: any[];
  _u1?: number;
  _u2?: number;
}

const CP1254_HIGH: Record<number, string> = {
  0xd0: 'Ğ',
  0xdd: 'İ',
  0xde: 'Ş',
  0xf0: 'ğ',
  0xfd: 'ı',
  0xfe: 'ş',
  0xc7: 'Ç',
  0xe7: 'ç',
  0xd6: 'Ö',
  0xf6: 'ö',
  0xdc: 'Ü',
  0xfc: 'ü',
};

const UNICODE_TO_CP1254: Record<string, number> = {
  Ğ: 0xd0,
  İ: 0xdd,
  Ş: 0xde,
  ğ: 0xf0,
  ı: 0xfd,
  ş: 0xfe,
  Ç: 0xc7,
  ç: 0xe7,
  Ö: 0xd6,
  ö: 0xf6,
  Ü: 0xdc,
  ü: 0xfc,
};

export function decodeCp1254(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += CP1254_HIGH[b] ?? String.fromCharCode(b);
  }
  return out;
}

export function encodeCp1254(text: string): Uint8Array {
  const arr: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch in UNICODE_TO_CP1254) {
      arr.push(UNICODE_TO_CP1254[ch]);
    } else {
      const code = text.charCodeAt(i);
      arr.push(code < 256 ? code : 0x3f);
    }
  }
  return new Uint8Array(arr);
}

export function findAscii(bytes: Uint8Array, needle: string, fromIndex = 0): number {
  const nlen = needle.length;
  if (nlen === 0 || bytes.length < nlen) return -1;
  const first = needle.charCodeAt(0);
  const limit = bytes.length - nlen;
  for (let i = Math.max(0, fromIndex); i <= limit; i++) {
    if (bytes[i] !== first) continue;
    let ok = true;
    for (let k = 1; k < nlen; k++) {
      if (bytes[i + k] !== needle.charCodeAt(k)) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

export function findMainListStart(bytes: Uint8Array): number {
  const idx = findAscii(bytes, 'CSld');
  if (idx < 8) {
    throw new Error('Geçersiz PSS®E .sld CArchive: CSld sınıf başlangıcı bulunamadı.');
  }
  return idx - 8;
}

export function validateSldBinary(bytes: Uint8Array): { valid: boolean; version: string; reason?: string } {
  if (!bytes || bytes.length < 512) {
    return { valid: false, version: '', reason: 'Dosya boyutu geçerli bir PSS®E .sld CArchive dosyası için çok küçük (<512 bayt).' };
  }
  const vlen = bytes[0];
  if (vlen < 6 || vlen > 12 || bytes[1 + vlen] !== 0) {
    return { valid: false, version: '', reason: 'Geçersiz PSS®E .sld binary başlığı: CArchive sürüm imzası bulunamadı.' };
  }
  const ver = decodeCp1254(bytes.subarray(1, 1 + vlen));
  if (!/^2\.0\.(48|49|50|51)\.\d+$/.test(ver)) {
    return { valid: false, version: ver, reason: `Desteklenmeyen veya bozuk Slider sürüm başlığı: "${ver}".` };
  }
  const hasSldClass =
    findAscii(bytes, 'CSldBusbar') >= 0 ||
    findAscii(bytes, 'CSldBranch') >= 0 ||
    findAscii(bytes, 'CSldPointNode') >= 0 ||
    findAscii(bytes, 'CSldLayer') >= 0;
  if (!hasSldClass) {
    return { valid: false, version: ver, reason: 'CArchive içinde CSldBusbar / CSldBranch / CSldLayer çalışma zamanı sınıfları bulunamadı.' };
  }
  return { valid: true, version: ver };
}

// Clean 2,263-byte PSS/E 36.5 2.0.51.1 preamble (color palette, fonts, styles)
export const PSSE_365_PREAMBLE_B64 =
  'CDIuMC41MS4xAP///wCAgIAAAMgAAAAAAKCZmak/AAAA4E1ioD8AAADgTWKwPwEAAAAAAACgmZnJPwAAAAAAAIA/AQAAAP////8BAAAAAAAAoJmZuT8AAACgmZnZPwAAAAAAACRAAAAAQOF6hD8AAACgmZm5PwAAAKCZmck/AAAAQDMz0z8AAACgmZm5PwEAAAAHAAAAAAAAAAAAJEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABkAAAAAAAAoJmZqT8AAAAAZmbm1yIrDcBcj3KHwEoywAAAKJkY8EZAVHYYKplzBUBmZubXIisNwMsOQ1ym4THAAAAomRjwRkBUdhgqmXMFQAAAAAAAAAAAAAAAAACAAAD/gAAAAAAAAAAAAAAAAAAAAwAAAPoABDM2LjQBMBhEaWFncmFtX0RpYWdyYW1fU2V0dGluZ3MAATACMTIPQ29sb3JWaXNpYmlsaXR5AAE3C0hpZGVVbmJvdW5kATAFQm91bmQBMAdVbmJvdW5kCDE2NzExOTM1CEJya3JPcGVuBTY1MjgwCUJya3JDbG9zZQMyNTUNU2hvd0xvb3BGbG93cwExCUxvb3BGbG93cwczOTk3Njk1ATABMA1GYXVsdFNldHRpbmdzAAEzBVdpZHRoATIFU3R5bGUFNjM1MjAFQ29sb3IHODQyMTUwNAEwATALT09TU2V0dGluZ3MAATQGVXNlT09TATEFV2lkdGgBMQVTdHlsZQU2MzczNgVDb2xvcgc0MTk0MzY4ATABMAxWUkNTU2V0dGluZ3MAATYPVXNlVm9sdGFnZUNvbG9yATEPVXNlVm9sdGFnZUxheWVyATEFV2lkdGgWMSAgMSAgMSAgMSAgMSAgMSAgMSAgMQVTdHlsZR4tMSAgLTEgIC0xICAtMSAgLTEgIC0xICAtMSAgLTEFQ29sb3I9MCAgMjU1ICAxNjcxMTY4MCAgNjUyODAgIDgzODg4NjMgIDg0MjE0NDAgIDE0MzUyMzg0ICAxNjcxMTY4MARWb2x0NzAuMDAwICAxMy44MDAgIDE4LjAwMCAgMjAuMDAwICAyMS42MDAgIDIzMC4wMDAgIDUwMC4wMDABMAEwCUJhckNoYXJ0cwABNAlCYXJDaGFydHMBMA1UcmFuc0JhckNoYXJ0ATAPQmFyQ2hhcnRQZXJjZW50ETk1ICAxMDAgIDEwNSAgMTEwDUJhckNoYXJ0Q29sb3IXMTMzNjk1NDggIDI1NSAgMjA0ICAxMjgBMAEwEUR5bmFtaWNSYW5nZUNoZWNrAAIxNRJVc2VCcmFuY2hMb2FkQ29sb3IBMA1MaW5lTG9hZENvbG9yBTMzMDIzDUxpbmVMb2FkV2lkdGgBNQ1MaW5lTG9hZFN0eWxlAi0xC0xpbmVMb2FkaW5nCjEwMC4wMDAwMDAPVXNlQnVzVm9sdENvbG9yATAPQnVzVm9sdE1pbkNvbG9yBTMyNzY4D0J1c1ZvbHRNYXhDb2xvcgc4Mzg4ODYzD0J1c1ZvbHRNaW5XaWR0aAExD0J1c1ZvbHRNYXhXaWR0aAEyEUJ1c1ZvbHRNaW5Wb2x0YWdlCDAuMDAwMDAwEUJ1c1ZvbHRNYXhWb2x0YWdlCDEuMDAwMDAwD0JyYW5jaFJhdGluZ1NldAExDFN3ZFJhdGluZ1NldAEwD1VzZVN3ZExvYWRDb2xvcgEwATABMA5NVVNUQW5ub3RhdGlvbgABNQtNVVNUT3B0aW9uMQExC01VU1RPcHRpb24yATILTVVTVE9wdGlvbjMBMwtNVVNUT3B0aW9uNAEwC01VU1RPcHRpb240ATEBMAEwDURZTkFubm90YXRpb24AATMHRFlOTW9kZQExCURZTlJlc3VsdAExCkRZTkNvbnRvdXIBMAEwATANUkVMQW5ub3RhdGlvbgACMTEHUkVMTW9kZQEwClJFTE91dE1vZGUBMQpSRUxCdXNNb2RlATAKUkVMQ250TGlzdAExCVJFTENudEJ1cwExCVJFTENudEJybgExCVJFTFByYkJ1cwExCVJFTFByYkJybgExCVJFTERldEJ1cwExCVJFTERldEJybgExB1JFTFZSZWMBMQEwATANQVNDQW5ub3RhdGlvbgACMTAFQW5ub3QBMARUeXBlATEIRmF1bHRCdXMJMTAwMDAwMDAwA0JvZQExB0NvbnRyaWIBMAdGcm9tQnVzCTEwMDAwMDAwMAVUb0J1cwkxMDAwMDAwMDAHTGFzdEJ1cwkxMDAwMDAwMDAHQnVzU2VjdAkxMDAwMDAwMDACSWQAATABMA1JRUNBbm5vdGF0aW9uAAIxMAVBbm5vdAEwBFR5cGUBMQhGYXVsdEJ1cwkxMDAwMDAwMDADQm9lATEHQ29udHJpYgEwB0Zyb21CdXMJMTAwMDAwMDAwBVRvQnVzCTEwMDAwMDAwMAdMYXN0QnVzCTEwMDAwMDAwMAdCdXNTZWN0CTEwMDAwMDAwMAJJZAABMAEwC0Fubm90YXRpb25zAAIxNAtSZXN1bHRzVHlwZQExCEhpZGVNb2RlATAIRGlhZ1ByZWMKMSAgMSAgMSAgMhBCcmFuY2hBbm5vdGF0aW9uBzYgIDAgIDEKRmxvd0RpcmVjdAEwB0J1c1ZvbHQENiAgNAVCdXNJZAEyCUVxdWlwbWVudAQwICAxDlBlcmNlbnRNVkFMaW5lATEVUGVyY2VudE1WQVRyYW5zZm9ybWVyATEKUmVwb3J0TVNMcwExEVJlcG9ydEJ1c1NlY3Rpb25zATEMQnVzSW1wZWRhbmNlATYPQnJhbmNoSW1wZWRhbmNlATYBMAEwAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAABbw97DL794QKAAAAAAkAEAAFAAAAAFQXJpYWwBAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAAAAAHgAAAAAAAOBRuL4/AAAAAP///wABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAQAAAAAAAEDhepQ/AAAAAA==';

export function getDefaultPreamble(): Uint8Array {
  const bin = atob(PSSE_365_PREAMBLE_B64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function encodeMapStruct(mapStr: string, isBusbar = false): Uint8Array {
  const parts = (mapStr || '').trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return new Uint8Array(0);
  const buf = new Uint8Array(32);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 32, true);
  const code = parts[0].toUpperCase();
  const b1 = Number(parts[1]) || 0;
  const branch = ['TR', 'TX', 'LI', 'LN', 'SYS'].includes(code);
  const thirdBus = branch && parts.length >= 5 ? Number(parts[3]) || 0 : 0;
  const b2 = branch ? Number(parts[2]) || 0 : 0;
  const ckt = code === 'BU' ? '' : branch ? parts[thirdBus ? 4 : 3] || '1' : parts[2] || '1';
  const kinds: Record<string, number> = { BU: 1, LO: 2, ME: 3, GE: 3, FXS: 6, SWS: 13, TR: 11, TX: 11, LI: 9, LN: 9, SYS: 12 };
  const kind = kinds[code];
  if (kind === undefined) throw new Error(`Unsupported PSS/E map code ${code}`);
  dv.setUint32(4, kind, true);
  dv.setUint32(12, b1, true); dv.setUint32(16, b2, true); dv.setUint32(20, thirdBus, true);
  buf.set(encodeCp1254((ckt + '    ').slice(0, 4)), 24);
  return buf;
}

export function decodeMapStruct(mapRaw: Uint8Array): {
  map: string;
  stype: 'Busbar' | 'Branch' | 'Radial' | 'Node';
  psse: string;
  sdef: number;
} {
  if (mapRaw.length < 20) {
    return { map: '', stype: 'Node', psse: 'BusNode', sdef: 0 };
  }
  const dv = new DataView(mapRaw.buffer, mapRaw.byteOffset, mapRaw.byteLength);
  const mtype = dv.getUint32(4, true);
  const bus1 = dv.getUint32(12, true);
  const bus2 = dv.getUint32(16, true);
  const bus3 = mapRaw.length >= 24 ? dv.getUint32(20, true) : 0;
  const ckt = decodeCp1254(mapRaw.subarray(24, Math.min(28, mapRaw.length))).replace(/\0/g, '').trim() || '1';

  switch (mtype) {
    case 1:
      return { map: bus1 ? `BU ${bus1}` : '', stype: 'Busbar', psse: 'Busbar', sdef: 1 };
    case 2:
      return { map: bus1 ? `LO ${bus1} ${ckt} ` : '', stype: 'Radial', psse: 'Load', sdef: 2 };
    case 3:
      return { map: bus1 ? `ME ${bus1} ${ckt} ` : '', stype: 'Radial', psse: 'Machine', sdef: 4 };
    case 4:
    case 6:
      return { map: bus1 ? `FXS ${bus1} ${ckt} ` : '', stype: 'Radial', psse: 'FixedShunt', sdef: 5 };
    case 5:
    case 11:
      return {
        map: bus1 && bus2 ? `TR ${bus1} ${bus2}${bus3 ? ' ' + bus3 : ''} ${ckt} ` : '',
        stype: 'Branch',
        psse: bus3 ? 'TWTransformer' : 'Transformer',
        sdef: bus3 ? 11 : 10,
      };
    case 7:
    case 13:
      return { map: bus1 ? `SWS ${bus1} ${ckt} ` : '', stype: 'Radial', psse: 'SwitchedShunt', sdef: 13 };
    case 9:
      return { map: bus1 && bus2 ? `LI ${bus1} ${bus2} ${ckt} ` : '', stype: 'Branch', psse: 'Branch', sdef: 32 };
    case 10:
    case 12:
      return { map: bus1 && bus2 ? `SYS ${bus1} ${bus2} ${ckt} ` : '', stype: 'Branch', psse: 'SwitchingDev', sdef: 3 };
    default:
      return { map: bus1 ? `BU ${bus1}` : '', stype: 'Busbar', psse: 'Busbar', sdef: 1 };
  }
}

/**
 * Low-level MFC CArchive Binary Stream Reader
 */
export class SldArchiveReader {
  bytes: Uint8Array;
  dv: DataView;
  pos: number;
  isV51: boolean;
  map: Map<number, { type: 'NULL' | 'CLASS' | 'OBJ'; value: any }>;
  nextIdx: number;

  constructor(bytes: Uint8Array, pos = 0, isV51 = true) {
    this.bytes = bytes;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = pos;
    this.isV51 = isV51;
    this.map = new Map();
    this.map.set(0, { type: 'NULL', value: null });
    this.nextIdx = 1;
  }

  u8(): number {
    return this.bytes[this.pos++];
  }

  u16(): number {
    const v = this.dv.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }

  u32(): number {
    const v = this.dv.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  f64(): number {
    const v = this.dv.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  skip(n: number): Uint8Array {
    const b = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }

  count(): number {
    const c = this.u16();
    return c === 0xffff ? this.u32() : c;
  }

  cstringRaw(): Uint8Array {
    const b = this.u8();
    let length = b;
    if (b === 0xff) {
      const w = this.u16();
      length = w === 0xffff ? this.u32() : w;
    }
    const s = this.bytes.subarray(this.pos, this.pos + length);
    this.pos += length;
    return s;
  }

  readObject(): ['NULL' | 'REF' | 'NEW', number, any] | null {
    const startPos = this.pos;
    const w = this.u16();
    if (w === 0) return null;

    const obTag = w === 0x7fff ? this.u32() : w;

    if (w !== 0xffff && (w & 0x8000) === 0) {
      const entry = this.map.get(obTag);
      if (!entry) {
        throw new Error(`Invalid REF 0x${obTag.toString(16)} at pos ${startPos}`);
      }
      return ['REF', obTag, entry.value];
    }

    let clsName: string;
    if (w === 0xffff) {
      this.u16(); // schema
      const nameLen = this.u16();
      clsName = decodeCp1254(this.bytes.subarray(this.pos, this.pos + nameLen));
      this.pos += nameLen;
      const clsIdx = this.nextIdx++;
      this.map.set(clsIdx, { type: 'CLASS', value: clsName });
    } else {
      const clsIdx = obTag & 0x7fff;
      const entry = this.map.get(clsIdx);
      if (!entry || entry.type !== 'CLASS') {
        throw new Error(`Invalid CLASS tag 0x${obTag.toString(16)} (clsIdx=${clsIdx}) at pos ${startPos}`);
      }
      clsName = entry.value;
    }

    const obIdx = this.nextIdx++;
    const obj: any = { _obIdx: obIdx, _class: clsName, _pos: startPos };
    this.map.set(obIdx, { type: 'OBJ', value: obj });
    this.deserializeObj(clsName, obj);
    obj._end = this.pos;
    return ['NEW', obIdx, obj];
  }

  readObList(): any[] {
    const cnt = this.count();
    const items: any[] = [];
    for (let i = 0; i < cnt; i++) {
      items.push(this.readObject());
    }
    return items;
  }

  deserializeCompBase(obj: any): void {
    obj.id = this.u32();
    obj.rot = this.f64();
    obj.layer = this.u32();
    obj.flag0 = this.u8();
    obj.f1 = this.u32();
    obj.f2 = this.u32();
    obj.f3 = this.u32();
    obj.color = this.u32();
    obj.comp_pre_map = this.skip(12);
    obj.map_raw = this.cstringRaw();
    const acnt = this.count();
    obj.comp_annots = [];
    for (let i = 0; i < acnt; i++) {
      obj.comp_annots.push(this.cstringRaw());
    }
    obj.comp_post_map = this.skip(this.isV51 ? 37 : 33);
    obj.x = this.f64();
    obj.y = this.f64();
    obj.comp_post_xy = this.skip(16);
    obj.labels = this.readObList();
  }

  deserializeSymbolBase(obj: any): void {
    this.deserializeCompBase(obj);
    obj.sdef = this.u32();
    obj.sym_flag = this.u32();
    obj.ports = this.readObList();
  }

  deserializeObj(clsName: string, obj: any): void {
    if (clsName === 'CSldBusbar') {
      this.deserializeSymbolBase(obj);
      obj.bus_tail = this.skip(this.isV51 ? 60 : 58);
    } else if (
      clsName === 'CSldPointNode' ||
      clsName === 'CSldRadial' ||
      clsName === 'CSldBranch' ||
      clsName === 'CSldTwoWindingTransformer' ||
      clsName === 'CSldThreeWindingTransformer'
    ) {
      this.deserializeSymbolBase(obj);
      obj.sym_tail = this.skip(this.isV51 ? 12 : 10);
    } else if (clsName === 'CSldLabel') {
      this.deserializeCompBase(obj);
      obj.text = decodeCp1254(this.cstringRaw());
      obj.owner = this.readObject();
      obj.lbl_vis = this.u32();
      obj.lbl_bg = this.u32();
      obj.lbl_position = this.u32();
      obj.lbl_font_info = this.skip(36);
      obj.lbl_font_name = decodeCp1254(this.cstringRaw());
      obj.lbl_font_tail = this.skip(8);
    } else if (clsName === 'CSldPort') {
      obj.owner = this.readObject();
      obj.link = this.readObject();
      obj.port_idx = this.u32();
      obj.dx = this.f64();
      obj.dy = this.f64();
      obj.port_tail = this.skip(16);
    } else if (clsName === 'CSldLink') {
      this.deserializeCompBase(obj);
      obj.link_pre_knees = this.skip(66);
      obj.knees = this.readObList();
      obj.p1 = this.readObject();
      obj.p2 = this.readObject();
      obj.link_tail = this.skip(32);
    } else if (clsName === 'CSldKneePoint') {
      this.deserializeCompBase(obj);
      obj.owner = this.readObject();
    } else if (clsName === 'CSldLayer') {
      obj.layer_hdr = this.skip(20);
      obj.name = decodeCp1254(this.cstringRaw());
      obj.vis = this.u32();
      const numLists = this.isV51 ? 22 : 21;
      obj.layer_lists = [];
      for (let i = 0; i < numLists; i++) {
        obj.layer_lists.push(this.readObList());
      }
    } else if (clsName === 'CSldGroup') {
      obj.name = decodeCp1254(this.cstringRaw());
      obj.items = this.readObList();
    } else if (clsName === 'CSldSavedView') {
      obj.name = decodeCp1254(this.cstringRaw());
      obj.view_data = this.skip(78);
    } else {
      throw new Error(`Desteklenmeyen veya bilinmeyen CArchive sınıfı: "${clsName}" (pos: ${this.pos})`);
    }
  }
}

/**
 * Low-level MFC CArchive Binary Stream Writer
 */
export class SldArchiveWriter {
  chunks: Uint8Array[];
  totalLen: number;
  isV51: boolean;
  storeMap: Map<any, number>;
  classMap: Map<string, number>;
  nextIdx: number;

  constructor(isV51 = true) {
    this.chunks = [];
    this.totalLen = 0;
    this.isV51 = isV51;
    this.storeMap = new Map();
    this.classMap = new Map();
    this.nextIdx = 1;
  }

  u8(v: number): void {
    const b = new Uint8Array([v & 0xff]);
    this.chunks.push(b);
    this.totalLen += 1;
  }

  u16(v: number): void {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, v & 0xffff, true);
    this.chunks.push(b);
    this.totalLen += 2;
  }

  u32(v: number): void {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v >>> 0, true);
    this.chunks.push(b);
    this.totalLen += 4;
  }

  f64(v: number): void {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, Number(v), true);
    this.chunks.push(b);
    this.totalLen += 8;
  }

  bytes(b: Uint8Array): void {
    if (b.length > 0) {
      this.chunks.push(b);
      this.totalLen += b.length;
    }
  }

  count(cnt: number): void {
    if (cnt < 0xffff) {
      this.u16(cnt);
    } else {
      this.u16(0xffff);
      this.u32(cnt);
    }
  }

  cstringRaw(raw: Uint8Array): void {
    const length = raw.length;
    if (length < 0xff) {
      this.u8(length);
    } else if (length < 0xffff) {
      this.u8(0xff);
      this.u16(length);
    } else {
      this.u8(0xff);
      this.u16(0xffff);
      this.u32(length);
    }
    this.bytes(raw);
  }

  writeClass(clsName: string): void {
    if (!this.classMap.has(clsName)) {
      const clsIdx = this.nextIdx++;
      this.classMap.set(clsName, clsIdx);
      this.u16(0xffff);
      this.u16(1); // schema
      const bName = encodeCp1254(clsName);
      this.u16(bName.length);
      this.bytes(bName);
    } else {
      const clsIdx = this.classMap.get(clsName)!;
      this.u16(0x8000 | (clsIdx & 0x7fff));
    }
  }

  writeObject(obj: any): void {
    if (obj === null || obj === undefined) {
      this.u16(0);
      return;
    }
    if (Array.isArray(obj) && obj.length === 3 && (obj[0] === 'NEW' || obj[0] === 'REF')) {
      obj = obj[2];
      if (!obj) {
        this.u16(0);
        return;
      }
    }

    if (this.storeMap.has(obj)) {
      const obIdx = this.storeMap.get(obj)!;
      if (obIdx < 0x7fff) {
        this.u16(obIdx);
      } else {
        this.u16(0x7fff);
        this.u32(obIdx);
      }
      return;
    }

    const clsName = obj._class;
    this.writeClass(clsName);

    const obIdx = this.nextIdx++;
    this.storeMap.set(obj, obIdx);

    this.serializeObj(clsName, obj);
  }

  writeObList(items: any[]): void {
    this.count(items.length);
    for (let i = 0; i < items.length; i++) {
      this.writeObject(items[i]);
    }
  }

  serializeCompBase(obj: any): void {
    this.u32(obj.id);
    this.f64(obj.rot ?? 0.0);
    this.u32(obj.layer ?? 4);
    this.u8(obj.flag0 ?? 0);
    this.u32(obj.f1 ?? 1);
    this.u32(obj.f2 ?? 1);
    this.u32(obj.f3 ?? 1);
    this.u32(obj.color ?? 0);
    this.bytes(obj.comp_pre_map || new Uint8Array(12));
    this.cstringRaw(obj.map_raw || new Uint8Array(0));
    const annots = obj.comp_annots || [];
    this.count(annots.length);
    for (let i = 0; i < annots.length; i++) {
      this.cstringRaw(annots[i]);
    }
    this.bytes(obj.comp_post_map || new Uint8Array(this.isV51 ? 37 : 33));
    this.f64(obj.x ?? 0.0);
    this.f64(obj.y ?? 0.0);
    this.bytes(obj.comp_post_xy || new Uint8Array(16));
    this.writeObList(obj.labels || []);
  }

  serializeSymbolBase(obj: any): void {
    this.serializeCompBase(obj);
    this.u32(obj.sdef ?? 0);
    this.u32(obj.sym_flag ?? 0);
    this.writeObList(obj.ports || []);
  }

  serializeObj(clsName: string, obj: any): void {
    if (clsName === 'CSldBusbar') {
      this.serializeSymbolBase(obj);
      this.bytes(obj.bus_tail || new Uint8Array(this.isV51 ? 60 : 58));
    } else if (
      clsName === 'CSldPointNode' ||
      clsName === 'CSldRadial' ||
      clsName === 'CSldBranch' ||
      clsName === 'CSldTwoWindingTransformer' ||
      clsName === 'CSldThreeWindingTransformer'
    ) {
      this.serializeSymbolBase(obj);
      this.bytes(obj.sym_tail || new Uint8Array(this.isV51 ? 12 : 10));
    } else if (clsName === 'CSldLabel') {
      this.serializeCompBase(obj);
      this.cstringRaw(encodeCp1254(obj.text || ''));
      this.writeObject(obj.owner);
      this.u32(obj.lbl_vis ?? 1);
      this.u32(obj.lbl_bg ?? 16777215);
      this.u32(obj.lbl_position ?? 0);
      this.bytes(obj.lbl_font_info || new Uint8Array(36));
      this.cstringRaw(encodeCp1254(obj.lbl_font_name || 'Arial'));
      this.bytes(obj.lbl_font_tail || new Uint8Array(8));
    } else if (clsName === 'CSldPort') {
      this.writeObject(obj.owner);
      this.writeObject(obj.link);
      this.u32(obj.port_idx ?? 0);
      this.f64(obj.dx ?? 0.0);
      this.f64(obj.dy ?? 0.0);
      this.bytes(obj.port_tail || new Uint8Array(16));
    } else if (clsName === 'CSldLink') {
      this.serializeCompBase(obj);
      this.bytes(obj.link_pre_knees || new Uint8Array(66));
      this.writeObList(obj.knees || []);
      this.writeObject(obj.p1);
      this.writeObject(obj.p2);
      this.bytes(obj.link_tail || new Uint8Array(32));
    } else if (clsName === 'CSldKneePoint') {
      this.serializeCompBase(obj);
      this.writeObject(obj.owner);
    } else if (clsName === 'CSldLayer') {
      this.bytes(obj.layer_hdr || new Uint8Array(20));
      this.cstringRaw(encodeCp1254(obj.name || ''));
      this.u32(obj.vis ?? 1);
      const lists = obj.layer_lists || [];
      const numLists = this.isV51 ? 22 : 21;
      for (let i = 0; i < numLists; i++) {
        this.writeObList(lists[i] || []);
      }
    } else if (clsName === 'CSldGroup') {
      this.cstringRaw(encodeCp1254(obj.name || 'Default'));
      this.writeObList(obj.items || []);
    } else if (clsName === 'CSldSavedView') {
      this.cstringRaw(encodeCp1254(obj.name || 'Default'));
      this.bytes(obj.view_data || new Uint8Array(78));
    } else {
      throw new Error(`Bilinmeyen CArchive serileştirme sınıfı: "${clsName}"`);
    }
  }

  getBuffer(): Uint8Array {
    const out = new Uint8Array(this.totalLen);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

/**
 * Universal Native PSS(R)E .sld Binary Parser
 */
export function parseSldBinary(bytes: Uint8Array): GaSldDocument {
  const check = validateSldBinary(bytes);
  if (!check.valid) {
    throw new Error(check.reason || 'Geçersiz PSS®E .sld binary dosyası.');
  }

  const isV51 = check.version.startsWith('2.0.51.') || check.version.startsWith('2.0.50.');
  const startOff = findMainListStart(bytes);
  const reader = new SldArchiveReader(bytes, startOff, isV51);

  const rawMainList = reader.readObList(); // main_list
  const u1 = reader.u32(); // u1
  const rawLayers = reader.readObList(); // layers
  const u2 = reader.u16(); // u2
  const rawGroups = reader.readObList(); // groups
  const rawViews = reader.readObList(); // views

  const objs: any[] = [];
  reader.map.forEach((entry) => {
    if (entry.type === 'OBJ') objs.push(entry.value);
  });

  const components: GaSldComponent[] = [];

  // 1. Symbols
  for (const o of objs) {
    const clsName = o._class;
    if (
      clsName === 'CSldBusbar' ||
      clsName === 'CSldPointNode' ||
      clsName === 'CSldRadial' ||
      clsName === 'CSldBranch' ||
      clsName === 'CSldTwoWindingTransformer' ||
      clsName === 'CSldThreeWindingTransformer'
    ) {
      const dec = decodeMapStruct(o.map_raw || new Uint8Array(0));
      let stype: GaSldComponent['stype'] = clsName === 'CSldPointNode' ? 'Node' : clsName === 'CSldRadial' ? 'Radial' : clsName === 'CSldBusbar' ? 'Busbar' : 'Branch';
      let blen: number | undefined;
      let bwidth: number | undefined;
      let ends: [[number, number], [number, number]] | undefined;

      if (clsName === 'CSldBusbar') {
        stype = 'Busbar';
        if (o.bus_tail && o.bus_tail.length >= 28) {
          const dv = new DataView(o.bus_tail.buffer, o.bus_tail.byteOffset, o.bus_tail.byteLength);
          bwidth = Number(dv.getFloat64(isV51 ? 12 : 10, true).toFixed(4));
          blen = Number(dv.getFloat64(isV51 ? 20 : 18, true).toFixed(4));
        } else {
          bwidth = 0.4;
          blen = 16.0;
        }
        const bx = o.x;
        const by = o.y;
        const isHoriz = Math.abs((o.rot ?? 0.0) % 180) > 45;
        ends = isHoriz
          ? [
              [Number((bx - blen / 2).toFixed(6)), Number(by.toFixed(6))],
              [Number((bx + blen / 2).toFixed(6)), Number(by.toFixed(6))],
            ]
          : [
              [Number(bx.toFixed(6)), Number((by + blen / 2).toFixed(6))],
              [Number(bx.toFixed(6)), Number((by - blen / 2).toFixed(6))],
            ];
      }

      const symComp: GaSldComponent = {
        id: o.id,
        t: 'Symbol',
        stype,
        psse: dec.psse,
        sdef: o.sdef ?? dec.sdef,
        layer: o.layer ?? 4,
        color: o.color ?? 0,
        map: dec.map,
        pos: [Number(o.x.toFixed(6)), Number(o.y.toFixed(6))],
        rot: Number((o.rot ?? 0.0).toFixed(4)),
      };
      if (blen !== undefined && bwidth !== undefined && ends) {
        symComp.len = blen;
        symComp.width = bwidth;
        symComp.ends = ends;
      }
      symComp._rawObj = o;
      components.push(symComp);
    }
  }

  // 2. Links
  for (const o of objs) {
    if (o._class === 'CSldLink') {
      const p1Obj = o.p1 ? (Array.isArray(o.p1) ? o.p1[2] : o.p1) : null;
      const p2Obj = o.p2 ? (Array.isArray(o.p2) ? o.p2[2] : o.p2) : null;
      const s1Obj = p1Obj && p1Obj.owner ? (Array.isArray(p1Obj.owner) ? p1Obj.owner[2] : p1Obj.owner) : null;
      const s2Obj = p2Obj && p2Obj.owner ? (Array.isArray(p2Obj.owner) ? p2Obj.owner[2] : p2Obj.owner) : null;

      const p1Pos = archivePortWorld(s1Obj, p1Obj);
      const p2Pos = archivePortWorld(s2Obj, p2Obj);

      const knees: [number, number][] = [];
      const rawKnees: GaSldKneeMeta[] = [];
      const kList = o.knees || [];
      for (const kw of kList) {
        const kp = Array.isArray(kw) ? kw[2] : kw;
        if (kp) {
          const kpos: [number, number] = [Number(kp.x.toFixed(6)), Number(kp.y.toFixed(6))];
          knees.push(kpos);
          rawKnees.push({ id: kp.id, pos: kpos, binOffset: kp._pos || 0 });
        }
      }

      const linkComp: GaSldComponent = {
        id: o.id,
        t: 'Link',
        layer: o.layer ?? 4,
        color: o.color ?? 0,
        lwidth: 1,
        p1: { sym: s1Obj ? s1Obj.id : 0, pos: p1Pos, idx: p1Obj ? p1Obj.port_idx ?? 0 : 0 },
        p2: { sym: s2Obj ? s2Obj.id : 0, pos: p2Pos, idx: p2Obj ? p2Obj.port_idx ?? 0 : 0 },
      };
      if (knees.length > 0) {
        linkComp.knees = knees;
        linkComp._rawKnees = rawKnees;
      }
      linkComp._rawObj = o;
      components.push(linkComp);
    }
  }

  // 3. Labels
  for (const o of objs) {
    if (o._class === 'CSldLabel') {
      const ownerObj = o.owner ? (Array.isArray(o.owner) ? o.owner[2] : o.owner) : null;
      components.push({
        id: o.id,
        t: 'Label',
        layer: o.layer ?? 4,
        color: o.color ?? 0,
        pos: [Number(o.x.toFixed(6)), Number(o.y.toFixed(6))],
        rot: Number((o.rot ?? 0.0).toFixed(4)),
        text: o.text || '',
        fh: o.lbl_font_info?.length >= 12 ? new DataView(o.lbl_font_info.buffer, o.lbl_font_info.byteOffset, o.lbl_font_info.byteLength).getInt32(8, true) || 9 : 9,
        lpos: o.lbl_position | 0,
        vis: o.lbl_vis !== 0,
        owner: ownerObj ? ownerObj.id : undefined,
        _rawObj: o,
      });
    }
  }

  // Native group membership is geometry/editor state, independent of SAV data.
  for (const wrapped of rawGroups) {
    const group = Array.isArray(wrapped) ? wrapped[2] : wrapped;
    if (!group || group.name === 'Default') continue;
    const members = new Set((group.items || []).map((w: any) => (Array.isArray(w) ? w[2] : w)?.id));
    for (const c of components) if (members.has(c.id)) c.groupId = group.name;
  }

  // 4. Layers
  const docLayers: GaSldLayer[] = [];
  for (let idx = 0; idx < rawLayers.length; idx++) {
    const lWrap = rawLayers[idx];
    const lObj = Array.isArray(lWrap) ? lWrap[2] : lWrap;
    if (lObj) {
      docLayers.push({
        n: idx,
        desc: lObj.name || `Layer ${idx}`,
        vis: lObj.vis === 0 ? 'Invisible' : 'Visible',
      });
    }
  }

  return {
    format: 'ga-sld-v1',
    fileVersion: check.version,
    layers: docLayers,
    components,
    rawBytes: bytes,
    _rawMainList: rawMainList,
    _rawLayers: rawLayers,
    _rawGroups: rawGroups,
    _rawViews: rawViews,
    _u1: u1,
    _u2: u2,
  };
}

/**
 * Universal Native PSS(R)E .sld Binary Serializer
 * Works strictly bridge-free without python or local server.
 */
function archivePortWorld(owner: any, port: any): [number, number] {
  if (!owner || !port) return [0, 0];
  const a = (owner.rot || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  return [Number((owner.x + co * port.dx - si * port.dy).toFixed(6)), Number((owner.y + si * port.dx + co * port.dy).toFixed(6))];
}

function archivePortLocal(owner: any, pos: number[]): { dx: number; dy: number } {
  const a = (owner.rot || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  const x = pos[0] - owner.x, y = pos[1] - owner.y;
  return { dx: co * x + si * y, dy: -si * x + co * y };
}

function assertSldGeometry(doc: GaSldDocument): void {
  const ids = new Set<number>();
  const symbols = new Set(doc.components.filter(c => c.t === 'Symbol').map(c => c.id));
  const point = (p: number[] | undefined) => p?.length === 2 && p.every(Number.isFinite);
  for (const c of doc.components) {
    if (!Number.isInteger(c.id) || ids.has(c.id)) throw new Error(`Duplicate/invalid SLD ID ${c.id}`);
    ids.add(c.id);
    if (c.t === 'Link') {
      for (const p of [c.p1, c.p2]) {
        if (!p || !symbols.has(p.sym) || !point(p.pos) || (p.idx !== undefined && (!Number.isInteger(p.idx) || p.idx < 0))) {
          throw new Error(`Invalid Link #${c.id} port/owner/position`);
        }
      }
      if (!(c.knees || []).every(point)) throw new Error(`Invalid Link #${c.id} knee`);
    } else if (!point(c.pos)) throw new Error(`Invalid ${c.t} #${c.id} position`);
    if (c.len !== undefined && (!Number.isFinite(c.len) || c.len <= 0)) throw new Error(`Invalid bus length #${c.id}`);
  }
}

function assertSldRoundTrip(expected: GaSldDocument, actual: GaSldDocument): void {
  const byId = new Map(actual.components.map(c => [c.id, c]));
  if (expected.components.length !== actual.components.length) throw new Error('SLD component count changed during export');
  const close = (a: number | undefined, b: number | undefined) => a === undefined || (b !== undefined && Math.abs(a - b) <= 1e-4);
  const point = (a: number[] | undefined, b: number[] | undefined) => !a || (!!b && close(a[0], b[0]) && close(a[1], b[1]));
  for (const c of expected.components) {
    const r = byId.get(c.id);
    if (!r || r.t !== c.t || !point(c.pos, r.pos) || !close(c.rot, r.rot)) throw new Error(`SLD geometry mismatch #${c.id}`);
    if (c.t === 'Symbol' && (!close(c.len, r.len) || (c.stype && c.stype !== r.stype))) throw new Error(`SLD symbol mismatch #${c.id}`);
    if (c.t === 'Label' && c.text !== r.text) throw new Error(`SLD label mismatch #${c.id}`);
    if (c.groupId !== r.groupId) throw new Error(`SLD group mismatch #${c.id}`);
    if (c.t === 'Symbol' && (c.map || '').trim().replace(/\s+/g, ' ') !== (r.map || '').trim().replace(/\s+/g, ' ')) throw new Error(`SLD equipment map mismatch #${c.id}`);
    if (c.t === 'Link') {
      for (const key of ['p1', 'p2'] as const) {
        if (c[key]?.sym !== r[key]?.sym || !point(c[key]?.pos, r[key]?.pos) || (c[key]?.idx !== undefined && c[key]?.idx !== r[key]?.idx)) {
          throw new Error(`SLD endpoint mismatch #${c.id}.${key}`);
        }
      }
      if ((c.knees || []).length !== (r.knees || []).length || !(c.knees || []).every((p, i) => point(p, r.knees?.[i]))) throw new Error(`SLD knee mismatch #${c.id}`);
    }
  }
}

function synchronizeArchiveGeometry(doc: GaSldDocument, isV51: boolean): void {
  const unwrap = (o: any): any => Array.isArray(o) && (o[0] === 'NEW' || o[0] === 'REF') ? o[2] : o;
  const objects = new Map<number, any>(), seen = new Set<any>();
  function visit(value: any): void {
    if (!value || typeof value !== 'object' || seen.has(value) || ArrayBuffer.isView(value)) return;
    seen.add(value);
    if (value._class && Number.isInteger(value.id)) objects.set(value.id, value);
    for (const child of Object.values(value)) visit(child);
  }
  visit(doc._rawMainList); visit(doc._rawLayers); visit(doc._rawGroups); visit(doc._rawViews);
  let nextId = Math.max(0, ...objects.keys(), ...doc.components.map(c => c.id)) + 1;
  for (const c of doc.components) {
    const o = objects.get(c.id);
    if (!o) throw new Error(`Unsupported archive structural edit #${c.id}`);
    if (c.pos) [o.x, o.y] = c.pos;
    for (const k of ['rot', 'color', 'layer'] as const) if (c[k] !== undefined) o[k] = c[k];
    if (c.t === 'Symbol') {
      if(c.sdef !== undefined)o.sdef=c.sdef;
      o.ports = (o.ports || []).map(unwrap);
      if (c.stype === 'Node' && o._class === 'CSldBusbar') {
        o._class = 'CSldPointNode'; o.sym_tail = new Uint8Array(isV51 ? 12 : 10);
      } else if (c.stype === 'Busbar') {
        o._class = 'CSldBusbar';
        if (!o.bus_tail) o.bus_tail = new Uint8Array(isV51 ? 60 : 58);
        const dv = new DataView(o.bus_tail.buffer, o.bus_tail.byteOffset, o.bus_tail.byteLength);
        dv.setFloat64(isV51 ? 12 : 10, c.width ?? 0.4, true); dv.setFloat64(isV51 ? 20 : 18, c.len ?? 2, true);
      }
    } else if (c.t === 'Label') {
      o.text = c.text || '';
      if (c.owner !== undefined) o.owner = objects.get(c.owner) || null;
    }
  }
  for (const c of doc.components.filter(c => c.t === 'Link')) {
    const o = objects.get(c.id);
    for (const key of ['p1', 'p2'] as const) {
      const ep = c[key]!, owner = objects.get(ep.sym);
      const port = unwrap(o[key]) || { _class: 'CSldPort', port_tail: new Uint8Array(16) };
      const priorOwner = unwrap(port.owner);
      if(priorOwner && priorOwner !== owner)priorOwner.ports = priorOwner.ports.filter((p: any)=>unwrap(p)!==port);
      Object.assign(port, { owner, link: o, port_idx: ep.idx ?? owner.ports.length, ...archivePortLocal(owner, ep.pos) });
      if(!owner.ports.includes(port))owner.ports.push(port); o[key] = port;
    }
    const oldKnees = (o.knees || []).map(unwrap);
    o.knees = (c.knees || []).map((p, i) => ({
      ...(oldKnees[i] || { _class: 'CSldKneePoint', id: nextId++, comp_post_map: new Uint8Array(isV51 ? 37 : 33) }),
      x: p[0], y: p[1], owner: o,
    }));
  }
  doc._rawLayers!.forEach((wrapped: any, i: number) => {
    const layer = unwrap(wrapped), edited = doc.layers[i];
    if (layer && edited) { layer.name = edited.desc; layer.vis = /^(Hidden|Invisible)$/.test(edited.vis) ? 0 : 1; }
  });
  registerArchiveLayers(doc._rawLayers!, doc.components.map(c => objects.get(c.id)));
  doc._rawGroups = archiveGroups(doc, objects);
}

function archiveGroups(doc: GaSldDocument, objects: Map<number, any>): any[] {
  const groups = new Map<string, any>();
  groups.set('Default', { _class: 'CSldGroup', name: 'Default', items: [] });
  for (const c of doc.components) {
    if (!c.groupId) continue;
    if (!groups.has(c.groupId)) groups.set(c.groupId, { _class: 'CSldGroup', name: c.groupId, items: [] });
    groups.get(c.groupId).items.push(objects.get(c.id));
  }
  return [...groups.values()];
}

// Slider draws from each layer's typed indexes, independently of the main list.
// An archive with empty layer indexes parses but opens as a blank PSS/E canvas.
function registerArchiveLayers(layers: any[], components: any[]): void {
  const typed: Record<string, number> = { CSldPointNode: 4, CSldBusbar: 5, CSldRadial: 6, CSldBranch: 7,
    CSldTwoWindingTransformer: 7, CSldThreeWindingTransformer: 7, CSldLink: 11, CSldLabel: 17 };
  const ids = new Set(components.map(o => o.id));
  const unwrap = (o: any): any => Array.isArray(o) ? o[2] : o;
  for (const wrapped of layers) {
    const l = unwrap(wrapped);
    l.layer_lists = l.layer_lists.map((items: any[]) => items.filter(w => !ids.has(unwrap(w)?.id)));
  }
  for (const o of components) {
    const layer = unwrap(layers[o.layer]);
    if (!layer || typed[o._class] === undefined) throw new Error(`Invalid SLD layer/class #${o.id}`);
    layer.layer_lists[0].push(o);
    layer.layer_lists[typed[o._class]].push(o);
  }
}

export function serializeSldBinary(doc: GaSldDocument, targetVersion = '2.0.51.1'): Uint8Array {
  // CArchive contains cycles and shared references. Clone the entire graph once;
  // serializing an immutable edit must never modify the parsed source document.
  doc = structuredClone(doc);
  assertSldGeometry(doc);
  const isV51 = !targetVersion.startsWith('2.0.49.');

  // 1. Preamble
  let preamble: Uint8Array;
  if (doc.rawBytes && doc.rawBytes.length >= 512) {
    const pEnd = findMainListStart(doc.rawBytes);
    preamble = doc.rawBytes.subarray(0, pEnd);
  } else {
    preamble = getDefaultPreamble();
  }
  preamble = preamble.slice();
  const versionBytes = new TextEncoder().encode(targetVersion);
  if (versionBytes.length !== preamble[0]) throw new Error('Unsupported SLD version header length');
  preamble.set(versionBytes, 1);

  if (doc._rawLayers && doc._rawMainList) {
    synchronizeArchiveGeometry(doc, isV51);
    const writer = new SldArchiveWriter(isV51);
    writer.writeObList(doc._rawMainList.map((w: any) => (Array.isArray(w) ? w[2] : w)));
    writer.u32(doc._u1 ?? 1);
    writer.writeObList(doc._rawLayers.map((w: any) => (Array.isArray(w) ? w[2] : w)));
    writer.u16(doc._u2 ?? 0);
    writer.writeObList(doc._rawGroups ? doc._rawGroups.map((w: any) => (Array.isArray(w) ? w[2] : w)) : []);
    writer.writeObList(doc._rawViews ? doc._rawViews.map((w: any) => (Array.isArray(w) ? w[2] : w)) : []);

    const bodyBytes = writer.getBuffer();
    const fullBytes = new Uint8Array(preamble.length + bodyBytes.length);
    fullBytes.set(preamble, 0);
    fullBytes.set(bodyBytes, preamble.length);

    // Validate pre-export round-trip
    assertSldRoundTrip(doc, parseSldBinary(fullBytes));
    return fullBytes;
  }

  // 2. Build CArchive Object Graph
  const symMap = new Map<number, any>();
  const linkList: any[] = [];
  const labelsByOwner = new Map<number, any[]>();
  const portsBySym = new Map<number, any[]>();

  for (const c of doc.components) {
    if (c.t === 'Symbol') {
      symMap.set(c.id, c);
      portsBySym.set(c.id, []);
    } else if (c.t === 'Link') {
      linkList.push(c);
    } else if (c.t === 'Label') {
      const owner = c.owner ?? 0;
      const list = labelsByOwner.get(owner) ?? [];
      list.push(c);
      labelsByOwner.set(owner, list);
    }
  }

  const carchiveObjs = new Map<number, any>();

  // Build Symbol objects
  symMap.forEach((c, cid) => {
    const stype = c.stype || 'Busbar';
    const clsName =
      stype === 'Busbar'
        ? 'CSldBusbar'
        : stype === 'Node'
        ? 'CSldPointNode'
        : stype === 'Radial'
        ? 'CSldRadial'
        : 'CSldBranch';

    const mapRaw = encodeMapStruct(c.map || '', stype === 'Busbar');
    const pos = c.pos || [0.0, 0.0];
    const blen = c.len ?? 16.0;
    const bwidth = c.width ?? 0.4;
    const color = c.color ?? 0xff0000;
    const layer = c.layer ?? 4;
    const rot = c.rot ?? 0.0;

    const busTail = new Uint8Array(isV51 ? 60 : 58);
    const busDv = new DataView(busTail.buffer);
    busDv.setUint32(0, 1, true);
    busDv.setUint32(4, color, true);
    busDv.setFloat64(isV51 ? 12 : 10, bwidth, true);
    busDv.setFloat64(isV51 ? 20 : 18, blen, true);
    busDv.setFloat32(isV51 ? 28 : 26, 1.0, true);
    busDv.setInt32(isV51 ? 32 : 30, -1, true);
    busDv.setUint16(isV51 ? 36 : 34, 2, true);
    busDv.setUint16(isV51 ? 38 : 36, 2, true);
    busDv.setUint16(isV51 ? 40 : 38, 1, true);
    busDv.setUint16(isV51 ? 42 : 40, 1, true);

    const obj: any = {
      _class: clsName,
      id: cid,
      rot,
      layer,
      flag0: 0,
      f1: 1,
      f2: 1,
      f3: 1,
      color,
      comp_pre_map: new Uint8Array(12),
      map_raw: mapRaw,
      comp_annots: [encodeCp1254('ANNOT' + 'N'.repeat(32))],
      comp_post_map: new Uint8Array(isV51 ? 37 : 33),
      x: pos[0],
      y: pos[1],
      comp_post_xy: new Uint8Array(16),
      labels: [],
      sdef: c.sdef ?? (stype === 'Busbar' ? 1 : 0),
      sym_flag: 0,
      ports: [],
      bus_tail: busTail,
      sym_tail: new Uint8Array(isV51 ? 12 : 10),
    };
    carchiveObjs.set(cid, obj);
  });

  // Build Link objects & Port objects
  for (const l of linkList) {
    const lid = l.id;
    const p1Info = l.p1 || {};
    const p2Info = l.p2 || {};
    const s1Id = p1Info.sym;
    const s2Id = p2Info.sym;
    const s1Obj = carchiveObjs.get(s1Id);
    const s2Obj = carchiveObjs.get(s2Id);
    const p1Pos = p1Info.pos || (s1Obj ? [s1Obj.x, s1Obj.y] : [0.0, 0.0]);
    const p2Pos = p2Info.pos || (s2Obj ? [s2Obj.x, s2Obj.y] : [0.0, 0.0]);
    const color = l.color ?? 0x00ff00;
    const layer = l.layer ?? 4;

    const linkPreKnees = new Uint8Array(66);
    // Standard link handle radius signature
    linkPreKnees[0] = 0xcd;
    linkPreKnees[1] = 0xcc;
    linkPreKnees[2] = 0x4c;
    linkPreKnees[3] = 0x3d;
    linkPreKnees[4] = 0xff;
    linkPreKnees[5] = 0xff;
    linkPreKnees[6] = 0xff;
    linkPreKnees[7] = 0xff;
    linkPreKnees[16] = 0x01;
    linkPreKnees[46] = 0xff;
    linkPreKnees[47] = 0xff;
    linkPreKnees[48] = 0xff;
    linkPreKnees[49] = 0xff;
    linkPreKnees[58] = 0xe0;
    linkPreKnees[59] = 0x51;
    linkPreKnees[60] = 0xb8;
    linkPreKnees[61] = 0xbe;
    linkPreKnees[62] = 0x3f;

    const linkTail = new Uint8Array(32);
    linkTail[1] = 0x01;

    const linkObj: any = {
      _class: 'CSldLink',
      id: lid,
      rot: 0.0,
      layer,
      flag0: 0,
      f1: 1,
      f2: 1,
      f3: 0,
      color,
      comp_pre_map: new Uint8Array(12),
      map_raw: new Uint8Array(0),
      comp_annots: [],
      comp_post_map: new Uint8Array(isV51 ? 37 : 33),
      x: 0.0,
      y: 0.0,
      comp_post_xy: new Uint8Array(16),
      labels: [],
      link_pre_knees: linkPreKnees,
      knees: [],
      p1: null,
      p2: null,
      link_tail: linkTail,
    };
    carchiveObjs.set(lid, linkObj);

    // Knees
    const knees = l.knees || [];
    for (let kidx = 0; kidx < knees.length; kidx++) {
      const kp = knees[kidx];
      const kneeId = 90000 + lid * 10 + kidx;
      const kObj: any = {
        _class: 'CSldKneePoint',
        id: kneeId,
        rot: 0.0,
        layer,
        flag0: 0,
        f1: 1,
        f2: 1,
        f3: 0,
        color,
        comp_pre_map: new Uint8Array(12),
        map_raw: new Uint8Array(0),
        comp_annots: [],
        comp_post_map: new Uint8Array(isV51 ? 37 : 33),
        x: kp[0],
        y: kp[1],
        comp_post_xy: new Uint8Array(16),
        labels: [],
        owner: linkObj,
      };
      linkObj.knees.push(kObj);
    }

    // Port 1
    const local1 = archivePortLocal(s1Obj, p1Pos);
    const port1: any = {
      _class: 'CSldPort',
      owner: s1Obj,
      link: linkObj,
      port_idx: p1Info.idx ?? (portsBySym.get(s1Id)?.length ?? 0),
      ...local1,
      port_tail: new Uint8Array(16),
    };
    linkObj.p1 = port1;
    if (s1Obj) {
      portsBySym.get(s1Id)!.push(port1);
    }

    // Port 2
    const local2 = archivePortLocal(s2Obj, p2Pos);
    const port2: any = {
      _class: 'CSldPort',
      owner: s2Obj,
      link: linkObj,
      port_idx: p2Info.idx ?? (portsBySym.get(s2Id)?.length ?? 0),
      ...local2,
      port_tail: new Uint8Array(16),
    };
    linkObj.p2 = port2;
    if (s2Obj) {
      portsBySym.get(s2Id)!.push(port2);
    }
  }

  // Attach ports to symbols
  carchiveObjs.forEach((sObj, sid) => {
    if (
      sObj._class === 'CSldBusbar' ||
      sObj._class === 'CSldPointNode' ||
      sObj._class === 'CSldRadial' ||
      sObj._class === 'CSldBranch'
    ) {
      const ports = portsBySym.get(sid) || [];
      const c = symMap.get(sid);
      const count = c?.stype === 'Branch' ? (c.psse === 'TWTransformer' ? 3 : 2) : c?.stype === 'Radial' ? 1 : 0;
      for (let idx = 0; idx < count; idx++) {
        if (ports.some(p => p.port_idx === idx)) continue;
        const half = c?.psse === 'Transformer' || c?.psse === 'TWTransformer' || c?.sdef === 10 ? 0.2 : 0.116;
        ports.push({ _class: 'CSldPort', owner: sObj, link: null, port_idx: idx,
          dx: c?.stype === 'Branch' ? (idx === 0 ? -half : idx === 1 ? half : 0) : 0,
          dy: c?.stype === 'Radial' ? ({ 2: .082, 4: .099, 5: .13 } as Record<number, number>)[c.sdef || 0] || 0 : idx === 2 ? -.2 : 0,
          port_tail: new Uint8Array(16) });
      }
      sObj.ports = ports.sort((a, b) => a.port_idx - b.port_idx);
    }
  });

  // Attach labels
  const unownedLabels: any[] = [];
  labelsByOwner.forEach((lblList, ownerId) => {
    const ownerObj = carchiveObjs.get(ownerId);
    if (!ownerObj && ownerId !== 0) throw new Error(`Invalid label owner ${ownerId}`);
    for (const l of lblList) {
      const pos = l.pos || [ownerObj?.x || 0, ownerObj?.y || 0];
      const fontInfo = new Uint8Array(36);
      const fontDv = new DataView(fontInfo.buffer);
      fontDv.setInt32(8, Math.round(l.fh || 9), true); // native font height
      fontDv.setInt32(24, 400, true); // native font weight
      const lblObj: any = {
        _class: 'CSldLabel',
        id: l.id,
        rot: l.rot ?? 0.0,
        layer: l.layer ?? (ownerObj?.layer ?? 4),
        flag0: 0,
        f1: 1,
        f2: 1,
        f3: 1,
        color: l.color ?? 0xffffff,
        comp_pre_map: new Uint8Array(12),
        map_raw: new Uint8Array(0),
        comp_annots: [],
        comp_post_map: new Uint8Array(isV51 ? 37 : 33),
        x: pos[0],
        y: pos[1],
        comp_post_xy: new Uint8Array(16),
        labels: [],
        text: l.text || '',
        owner: ownerObj || null,
        lbl_vis: l.vis === false ? 0 : 1,
        lbl_bg: 0xffffff,
        lbl_position: l.lpos ?? 0xffffffff, // free authored label; native ctor uses slot -1
        lbl_font_info: fontInfo,
        lbl_font_name: 'Arial',
        lbl_font_tail: new Uint8Array(8),
      };
      if(ownerObj)ownerObj.labels.push(lblObj);else unownedLabels.push(lblObj);
    }
  });

  // Main list
  const mainList: any[] = [];
  for (const c of doc.components) {
    const cid = c.id;
    if (carchiveObjs.has(cid)) {
      const o = carchiveObjs.get(cid)!;
      mainList.push(o);
      if (o.labels) {
        for (const lbl of o.labels) mainList.push(lbl);
      }
      if (o.knees) {
        for (const kp of o.knees) mainList.push(kp);
      }
    }
  }

  mainList.push(...unownedLabels);

  // Layers
  const layerNames = [
    'Background', 'Foreground', 'BaseVoltage 154,0', 'BaseVoltage 380,0', 'BaseVoltage 400,0',
    'BaseVoltage 220,0', 'BaseVoltage 66,0', 'BaseVoltage 33,0', 'BaseVoltage 31,5',
    'BaseVoltage 15,8', 'BaseVoltage 10,6', 'BaseVoltage 10,5', 'BaseVoltage 6,3',
    'BaseVoltage 3,3', 'BaseVoltage 0,4', 'User Layer 1', 'User Layer 2', 'User Layer 3', 'User Layer 4',
  ];
  const activeNames = isV51 ? layerNames : layerNames.slice(0, 12);
  const layers: any[] = [];
  for (let lIdx = 0; lIdx < activeNames.length; lIdx++) {
    const layerHdr = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x7b, 0x14, 0xae, 0x47, 0xe1, 0x7a, 0x84, 0x3f,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x59, 0x40,
    ]);
    layers.push({
      _class: 'CSldLayer',
      layer_hdr: layerHdr,
      name: activeNames[lIdx],
      vis: 1,
      layer_lists: Array.from({ length: isV51 ? 22 : 21 }, () => []),
    });
  }

  const groupObjects = new Map([...carchiveObjs.values()].flatMap(o => [o, ...(o.labels || [])]).concat(unownedLabels).map(o => [o.id, o]));
  const groups = archiveGroups(doc, groupObjects);

  const viewData = new Uint8Array(78);
  const viewDv = new DataView(viewData.buffer);
  const points = doc.components.flatMap(c => c.pos ? [c.pos] : [c.p1!.pos, ...(c.knees || []), c.p2!.pos]);
  const minX = Math.min(...points.map(p => p[0])) - 1, maxX = Math.max(...points.map(p => p[0])) + 1;
  const minY = Math.min(...points.map(p => p[1])) - 1, maxY = Math.max(...points.map(p => p[1])) + 1;
  viewDv.setFloat64(0, 1.0, true); // positive zoom factor, not a bounding rectangle
  viewDv.setFloat64(8, (minX + maxX) / 2, true);
  viewDv.setFloat64(16, (minY + maxY) / 2, true);
  viewDv.setFloat64(40, minX, true); viewDv.setFloat64(48, maxY, true);
  viewDv.setFloat64(56, maxX, true); viewDv.setFloat64(64, minY, true);

  const views = [
    {
      _class: 'CSldSavedView',
      name: 'Default',
      view_data: viewData,
    },
  ];

  // Write CArchive Body
  const allComponents = [...carchiveObjs.values()].flatMap(o => [o, ...(o.labels || [])]).concat(unownedLabels);
  registerArchiveLayers(layers, allComponents);
  const writer = new SldArchiveWriter(isV51);
  writer.writeObList(mainList);
  writer.u32(1); // u1
  writer.writeObList(layers);
  writer.u16(0); // u2
  writer.writeObList(groups);
  writer.writeObList(views);

  const bodyBytes = writer.getBuffer();
  const fullBytes = new Uint8Array(preamble.length + bodyBytes.length);
  fullBytes.set(preamble, 0);
  fullBytes.set(bodyBytes, preamble.length);

  // 3. Mandatory Pre-Export Round-Trip Validation
  const reDoc = parseSldBinary(fullBytes);
  assertSldRoundTrip(doc, reDoc);
  const origSyms = doc.components.filter((c) => c.t === 'Symbol');
  const reSyms = reDoc.components.filter((c) => c.t === 'Symbol');
  if (reSyms.length !== origSyms.length) {
    throw new Error(`Round-trip sembol sayısı uyuşmazlığı: Orijinal=${origSyms.length}, Üretilen=${reSyms.length}`);
  }

  const origLinks = doc.components.filter((c) => c.t === 'Link');
  const reLinks = reDoc.components.filter((c) => c.t === 'Link');
  if (reLinks.length !== origLinks.length) {
    throw new Error(`Round-trip bağlantı (Link) sayısı uyuşmazlığı: Orijinal=${origLinks.length}, Üretilen=${reLinks.length}`);
  }

  // Coordinate check tolerance: 1e-4
  const reSymMap = new Map<number, GaSldComponent>();
  for (const s of reSyms) reSymMap.set(s.id, s);
  for (const os of origSyms) {
    const rs = reSymMap.get(os.id);
    if (!rs || !os.pos || !rs.pos) continue;
    const dx = Math.abs(os.pos[0] - rs.pos[0]);
    const dy = Math.abs(os.pos[1] - rs.pos[1]);
    if (dx > 1e-4 || dy > 1e-4) {
      throw new Error(`Round-trip koordinat uyuşmazlığı (Sembol #${os.id}): Orijinal=(${os.pos}), Üretilen=(${rs.pos})`);
    }
  }

  return fullBytes;
}

/**
 * Universal In-Place / Serializing Patcher for PSS(R)E .sld Binaries
 */
export function patchSldBinary(baseBytes: Uint8Array, doc: GaSldDocument): Uint8Array {
  const check = validateSldBinary(baseBytes);
  if (!check.valid) {
    throw new Error(check.reason || 'Geçersiz temel .sld binary dosyası.');
  }

  const targetVersion = check.version || '2.0.51.1';
  const docWithBytes: GaSldDocument = { ...doc, rawBytes: baseBytes };
  return serializeSldBinary(docWithBytes, targetVersion);
}
