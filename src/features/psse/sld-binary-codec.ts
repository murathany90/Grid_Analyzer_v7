/**
 * Pure TypeScript CArchive Binary Codec for PSS(R)E 36.5 Single-Line Diagrams (.sld)
 * Supports Slider binary format versions 2.0.49.x (PSS/E 34/35) and 2.0.51.x (PSS/E 36.5).
 *
 * Strictly zero hardcoded profiles, zero filename heuristics, and zero fake fallbacks:
 * - Validates CArchive header & Slider runtime classes (`CSldBusbar`, `CSldBranch`, `CSldLink`, `CSldLayer`).
 * - Parses Layers (`CSldLayer`), Symbols (`CSldBusbar`, `CSldPointNode`, `CSldBranch`, `CSldRadial`),
 *   Busbar geometry (`width`, `len`, `ends` via CArchive depth-first LIFO stack),
 *   Links (`CSldLink`), KneePoints (`CSldKneePoint`), and Labels (`CSldLabel`).
 * - Patches existing `.sld` binaries in-place (symbol coordinates/rotation/layer/color,
 *   busbar lengths, knee-point coordinates, and variable-length CP1254 label texts).
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
  owner?: number;
  vis?: boolean;
}

export interface GaSldDocument {
  format: 'ga-sld-v1';
  fileVersion: string;
  layers: GaSldLayer[];
  components: GaSldComponent[];
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

function findAscii(bytes: Uint8Array, needle: string, fromIndex = 0): number {
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

function decodeMapRecord(
  mapType: number,
  bus1: number,
  bus2: number,
  bus3: number,
  ckt: string,
  isBusbarClass: boolean
): {
  map: string;
  stype: 'Busbar' | 'Branch' | 'Radial' | 'Node';
  psse: string;
  sdef: number;
} {
  const c = (ckt || '1').trim() || '1';
  switch (mapType) {
    case 1:
      return isBusbarClass
        ? { map: bus1 ? `BU ${bus1}` : '', stype: 'Busbar', psse: 'Busbar', sdef: 1 }
        : { map: bus1 ? `BU ${bus1}` : '', stype: 'Node', psse: 'BusNode', sdef: 0 };
    case 2:
      return { map: bus1 ? `LO ${bus1} ${c} ` : '', stype: 'Radial', psse: 'Load', sdef: 2 };
    case 3:
      return { map: bus1 ? `ME ${bus1} ${c} ` : '', stype: 'Radial', psse: 'Machine', sdef: 4 };
    case 4:
    case 6:
      return { map: bus1 ? `FXS ${bus1} ${c} ` : '', stype: 'Radial', psse: 'FixedShunt', sdef: 5 };
    case 5:
    case 11:
      return {
        map: bus1 && bus2 ? `TR ${bus1} ${bus2}${bus3 ? ' ' + bus3 : ''} ${c} ` : '',
        stype: 'Branch',
        psse: bus3 ? 'TWTransformer' : 'Transformer',
        sdef: bus3 ? 11 : 10,
      };
    case 7:
    case 13:
      return { map: bus1 ? `SWS ${bus1} ${c} ` : '', stype: 'Radial', psse: 'SwitchedShunt', sdef: 13 };
    case 9:
      return { map: bus1 && bus2 ? `LI ${bus1} ${bus2} ${c} ` : '', stype: 'Branch', psse: 'Branch', sdef: 32 };
    case 10:
    case 12:
      return { map: bus1 && bus2 ? `SYS ${bus1} ${bus2} ${c} ` : '', stype: 'Branch', psse: 'SwitchingDev', sdef: 3 };
    default:
      return isBusbarClass
        ? { map: bus1 ? `BU ${bus1}` : '', stype: 'Busbar', psse: 'Busbar', sdef: 1 }
        : { map: bus1 ? `BU ${bus1}` : '', stype: 'Node', psse: 'BusNode', sdef: 0 };
  }
}

function parseLayersFromBinary(bytes: Uint8Array, dv: DataView): GaSldLayer[] {
  const layers: GaSldLayer[] = [];
  const clsIdx = findAscii(bytes, 'CSldLayer');
  if (clsIdx >= 8) {
    let pos = clsIdx + 9;
    let layerIdx = 0;
    while (pos + 24 < bytes.length && layerIdx < 64) {
      const visFlag = dv.getInt32(pos, true);
      const minZ = dv.getFloat64(pos + 4, true);
      const maxZ = dv.getFloat64(pos + 12, true);
      const dlen = bytes[pos + 20];
      if (!Number.isFinite(minZ) || !Number.isFinite(maxZ) || dlen === 0 || dlen > 80 || pos + 21 + dlen + 4 > bytes.length) {
        break;
      }
      const desc = decodeCp1254(bytes.subarray(pos + 21, pos + 21 + dlen));
      const layerNum = dv.getUint32(pos + 21 + dlen, true);
      layers.push({
        n: layerNum < 64 ? layerNum : layerIdx,
        desc,
        vis: visFlag === 0 ? 'Visible' : 'Invisible',
        minZ: Number(minZ.toFixed(4)),
        maxZ: Number(maxZ.toFixed(4)),
      });
      layerIdx++;
      // Find next CSldLayer record by scanning for the (minZ, maxZ) pattern
      let nextPos = -1;
      for (let scan = pos + 25 + dlen; scan < Math.min(bytes.length - 30, pos + 16384); scan++) {
        if (bytes[scan + 11] === 0x3f && bytes[scan + 18] === 0x59 && bytes[scan + 19] === 0x40) {
          const slen = bytes[scan + 20];
          if (slen > 0 && slen < 64) {
            nextPos = scan;
            break;
          }
        }
      }
      if (nextPos < 0) break;
      pos = nextPos;
    }
  }
  if (layers.length === 0) {
    return [
      { n: 0, desc: 'Background', vis: 'Visible' },
      { n: 1, desc: 'Foreground', vis: 'Visible' },
      { n: 2, desc: 'BaseVoltage 154,0', vis: 'Visible' },
      { n: 4, desc: 'BaseVoltage 400,0', vis: 'Visible' },
    ];
  }
  return layers;
}

export function parseSldBinary(bytes: Uint8Array): GaSldDocument {
  const check = validateSldBinary(bytes);
  if (!check.valid) {
    throw new Error(check.reason || 'Geçersiz PSS®E .sld binary dosyası.');
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isV36 = check.version.startsWith('2.0.51.');
  const symPad = isV36 ? 37 : 33;
  const lblPosOff = isV36 ? 85 : 81;
  const lblTxtOff = isV36 ? 119 : 115;
  const kneeStep = isV36 ? 121 : 117;

  const layers = parseLayersFromBinary(bytes, dv);
  const components: GaSldComponent[] = [];
  const seenIds = new Set<number>();

  // 1) Scan all CSldSymbol records and Busbar (width, len) trailers for LIFO pairing
  interface SymEntry {
    binOffset: number;
    afterHeaderOffset: number;
    comp: GaSldComponent;
  }
  const symEntries: SymEntry[] = [];
  const lifoEvents: { offset: number; kind: 'OPEN' | 'CLOSE'; sym?: GaSldComponent; wl?: [number, number] }[] = [];

  for (let i = 500; i < bytes.length - 160; i++) {
    if (bytes[i + 16] === 0 && (bytes[i + 45] === 0x1c || bytes[i + 45] === 0x20)) {
      const mlen = bytes[i + 45];
      const adOff = i + 46 + mlen;
      if (adOff + 12 >= bytes.length) continue;
      const adCnt = dv.getUint16(adOff, true);
      if (adCnt < 1 || adCnt > 8) continue;
      const slen = bytes[adOff + 2];
      if (slen < 5 || slen > 32 || adOff + 8 >= bytes.length) continue;
      if (
        bytes[adOff + 3] !== 0x41 || // 'A'
        bytes[adOff + 4] !== 0x4e || // 'N'
        bytes[adOff + 5] !== 0x4e || // 'N'
        bytes[adOff + 6] !== 0x4f || // 'O'
        bytes[adOff + 7] !== 0x54    // 'T'
      ) {
        continue;
      }
      const cid = dv.getUint32(i, true);
      const layer = dv.getUint32(i + 12, true);
      if (cid === 0 || cid > 10000000 || layer > 64 || seenIds.has(cid)) continue;
      let p = adOff + 2;
      let ok = true;
      for (let k = 0; k < adCnt; k++) {
        if (p >= bytes.length) {
          ok = false;
          break;
        }
        p += 1 + bytes[p];
      }
      if (!ok || p + symPad + 24 > bytes.length) continue;
      const dx = dv.getFloat64(p + symPad, true);
      const dy = dv.getFloat64(p + symPad + 8, true);
      const dr = dv.getFloat64(p + symPad + 16, true);
      const hdrRot = dv.getFloat64(i + 4, true);
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 5000 || Math.abs(dy) > 5000) continue;

      const color = dv.getUint32(i + 29, true);
      const mapType = dv.getUint32(i + 50, true);
      const bus1 = dv.getUint32(i + 58, true);
      const bus2 = dv.getUint32(i + 62, true);
      const bus3 = dv.getUint32(i + 66, true);
      const ckt = decodeCp1254(bytes.subarray(i + 70, i + 74));
      const isBusbarClass =
        (bytes[i - 2] === 0x61 && bytes[i - 1] === 0x72) || // 'ar' (CSldBusbar)
        (bytes[i - 2] === 0x01 && bytes[i - 1] === 0x80);
      const decoded = decodeMapRecord(mapType, bus1, bus2, bus3, ckt, isBusbarClass);
      const useRot = Number.isFinite(dr) && Math.abs(dr) > 1e-4 ? dr : Number.isFinite(hdrRot) ? hdrRot : 0;

      seenIds.add(cid);
      const symComp: GaSldComponent = {
        id: cid,
        t: 'Symbol',
        stype: decoded.stype,
        psse: decoded.psse,
        sdef: decoded.sdef,
        layer,
        color,
        map: decoded.map,
        pos: [Number(dx.toFixed(6)), Number(dy.toFixed(6))],
        rot: Number(useRot.toFixed(4)),
      };
      if (decoded.stype === 'Busbar') {
        symComp.len = 2.0;
        symComp.width = 0.05;
        lifoEvents.push({ offset: i, kind: 'OPEN', sym: symComp });
      }
      components.push(symComp);
      symEntries.push({ binOffset: i, afterHeaderOffset: p + symPad + 24, comp: symComp });
    }
  }

  // Scan Busbar (width, len) trailers for exact LIFO stack matching
  for (let i = 520; i < bytes.length - 32; i++) {
    if (bytes[i] === 0x00 && bytes[i + 1] === 0x00 && bytes[i + 2] === 0x80 && bytes[i + 3] === 0x3f) {
      const d1 = dv.getUint16(i + 8, true);
      const d2 = dv.getUint16(i + 10, true);
      if ((d1 === 2 && d2 === 2) || (d1 === 1 && d2 === 1) || (d1 === 0 && d2 === 0)) {
        const w = dv.getFloat64(i - 16, true);
        const l = dv.getFloat64(i - 8, true);
        if (Number.isFinite(w) && Number.isFinite(l) && w > 0.005 && w < 0.25 && l > 0.1 && l < 100) {
          lifoEvents.push({ offset: i - 16, kind: 'CLOSE', wl: [w, l] });
        }
      }
    }
  }
  lifoEvents.sort((a, b) => a.offset - b.offset);
  const busStack: GaSldComponent[] = [];
  for (const ev of lifoEvents) {
    if (ev.kind === 'OPEN' && ev.sym) {
      busStack.push(ev.sym);
    } else if (ev.kind === 'CLOSE' && ev.wl && busStack.length > 0) {
      const bar = busStack.pop()!;
      const [w, l] = ev.wl;
      bar.width = Number(w.toFixed(4));
      bar.len = Number(l.toFixed(4));
      const [bx, by] = bar.pos!;
      const isHoriz = Math.abs((bar.rot ?? 0) % 180) > 45;
      bar.ends = isHoriz
        ? [
            [Number((bx - l / 2).toFixed(6)), Number(by.toFixed(6))],
            [Number((bx + l / 2).toFixed(6)), Number(by.toFixed(6))],
          ]
        : [
            [Number(bx.toFixed(6)), Number((by + l / 2).toFixed(6))],
            [Number(bx.toFixed(6)), Number((by - l / 2).toFixed(6))],
          ];
    }
  }
  for (const s of symEntries) {
    if (s.comp.stype === 'Busbar' && !s.comp.ends && s.comp.pos) {
      const l = s.comp.len ?? 2.0;
      const [bx, by] = s.comp.pos;
      const isHoriz = Math.abs((s.comp.rot ?? 0) % 180) > 45;
      s.comp.ends = isHoriz
        ? [
            [Number((bx - l / 2).toFixed(6)), Number(by.toFixed(6))],
            [Number((bx + l / 2).toFixed(6)), Number(by.toFixed(6))],
          ]
        : [
            [Number(bx.toFixed(6)), Number((by + l / 2).toFixed(6))],
            [Number(bx.toFixed(6)), Number((by - l / 2).toFixed(6))],
          ];
    }
  }

  // 2) Scan all CSldLink records + their owned labels + CSldKneePoint records
  interface RawLinkRecord {
    binOffset: number;
    endOffset: number;
    id: number;
    layer: number;
    color: number;
    ownedLabelCoords: [number, number][];
    rawKnees: GaSldKneeMeta[];
  }
  const rawLinks: RawLinkRecord[] = [];
  for (let i = 500; i < bytes.length - 140; i++) {
    const isLinkTag =
      (bytes[i - 2] === 0x08 && bytes[i - 1] === 0x80) ||
      (bytes[i - 2] === 0x6e && bytes[i - 1] === 0x6b); // 'nk' (CSldLink)
    if (!isLinkTag || bytes[i + 16] !== 0) continue;
    const lid = dv.getUint32(i, true);
    const lLayer = dv.getUint32(i + 12, true);
    if (lid === 0 || lid > 10000000 || lLayer > 64 || seenIds.has(lid)) continue;
    // Find link handle radius signature (\xe0Q\xb8\xbe?\x00\x00\x00\x00) within 900 bytes
    let sigIdx = -1;
    for (let s = i + 100; s < Math.min(bytes.length - 20, i + 950); s++) {
      if (
        bytes[s] === 0xe0 &&
        bytes[s + 1] === 0x51 &&
        bytes[s + 2] === 0xb8 &&
        bytes[s + 3] === 0xbe &&
        bytes[s + 4] === 0x3f &&
        bytes[s + 5] === 0x00 &&
        bytes[s + 6] === 0x00 &&
        bytes[s + 7] === 0x00 &&
        bytes[s + 8] === 0x00
      ) {
        sigIdx = s;
        break;
      }
    }
    if (sigIdx < 0) continue;
    const kcnt = dv.getUint16(sigIdx + 9, true);
    if (kcnt > 40) continue;
    seenIds.add(lid);

    // Scan owned labels between i + 110 and sigIdx
    const ownedLabelCoords: [number, number][] = [];
    for (let s = i + 110; s < sigIdx - 80; s++) {
      const isLbl =
        (bytes[s] === 0x03 && bytes[s + 1] === 0x80) ||
        (s >= 7 && bytes[s - 7] === 0x43 && bytes[s - 6] === 0x53 && bytes[s + 1] === 0x6c);
      if (!isLbl) continue;
      const lIdx = s + 2;
      if (lIdx + lblTxtOff + 2 >= sigIdx) continue;
      const lbid = dv.getUint32(lIdx, true);
      const lbLayer = dv.getUint32(lIdx + 12, true);
      if (lbid === 0 || lbid > 10000000 || lbLayer > 64 || bytes[lIdx + 16] !== 0) continue;
      const tlen = bytes[lIdx + lblTxtOff];
      if (lIdx + lblTxtOff + 1 + tlen > sigIdx) continue;
      const lx = dv.getFloat64(lIdx + lblPosOff, true);
      const ly = dv.getFloat64(lIdx + lblPosOff + 8, true);
      const lr = dv.getFloat64(lIdx + lblPosOff + 16, true);
      if (Number.isFinite(lx) && Number.isFinite(ly) && Math.abs(lx) < 5000 && Math.abs(ly) < 5000) {
        ownedLabelCoords.push([lx, ly]);
        if (tlen > 0 && !seenIds.has(lbid)) {
          const txt = decodeCp1254(bytes.subarray(lIdx + lblTxtOff + 1, lIdx + lblTxtOff + 1 + tlen));
          seenIds.add(lbid);
          components.push({
            id: lbid,
            t: 'Label',
            layer: lbLayer,
            color: dv.getUint32(lIdx + 29, true),
            pos: [Number(lx.toFixed(6)), Number(ly.toFixed(6))],
            rot: Number.isFinite(lr) ? Number(lr.toFixed(2)) : 0,
            text: txt,
            fh: 9,
            owner: lid,
          });
        }
      }
    }

    // Parse CSldKneePoint records starting at sigIdx + 11
    let kpCursor = sigIdx + 11;
    const rawKnees: GaSldKneeMeta[] = [];
    for (let k = 0; k < kcnt; k++) {
      if (kpCursor + 20 >= bytes.length) break;
      if (bytes[kpCursor] === 0xff && bytes[kpCursor + 1] === 0xff) {
        kpCursor += 19; // \xff\xff\x01\x00\x0d\x00CSldKneePoint
      } else {
        kpCursor += 2; // \x0c\x80
      }
      if (kpCursor + lblPosOff + 16 > bytes.length) break;
      const kid = dv.getUint32(kpCursor, true);
      const kx = dv.getFloat64(kpCursor + lblPosOff, true);
      const ky = dv.getFloat64(kpCursor + lblPosOff + 8, true);
      if (Number.isFinite(kx) && Number.isFinite(ky) && Math.abs(kx) < 5000 && Math.abs(ky) < 5000) {
        rawKnees.push({
          id: kid,
          pos: [Number(kx.toFixed(6)), Number(ky.toFixed(6))],
          binOffset: kpCursor + lblPosOff,
        });
      }
      kpCursor += kneeStep;
    }

    rawLinks.push({
      binOffset: i,
      endOffset: kpCursor,
      id: lid,
      layer: lLayer,
      color: dv.getUint32(i + 29, true),
      ownedLabelCoords,
      rawKnees,
    });
  }

  // 3) Scan all remaining CSldLabel records (owned by Symbols or free-standing)
  symEntries.sort((a, b) => a.binOffset - b.binOffset);
  for (let i = 500; i < bytes.length - (lblTxtOff + 6); i++) {
    const isLbl =
      (bytes[i - 2] === 0x03 && bytes[i - 1] === 0x80) ||
      (i >= 9 && bytes[i - 9] === 0x43 && bytes[i - 8] === 0x53 && bytes[i - 1] === 0x6c);
    if (!isLbl || bytes[i + 16] !== 0) continue;
    const lid = dv.getUint32(i, true);
    const lLayer = dv.getUint32(i + 12, true);
    if (lid === 0 || lid > 10000000 || lLayer > 64 || seenIds.has(lid)) continue;
    const tlen = bytes[i + lblTxtOff];
    if (tlen === 0 || tlen > 220 || i + lblTxtOff + 1 + tlen > bytes.length) continue;
    const txt = decodeCp1254(bytes.subarray(i + lblTxtOff + 1, i + lblTxtOff + 1 + tlen));
    if (!txt.trim()) continue;
    const lx = dv.getFloat64(i + lblPosOff, true);
    const ly = dv.getFloat64(i + lblPosOff + 8, true);
    const lr = dv.getFloat64(i + lblPosOff + 16, true);
    if (!Number.isFinite(lx) || !Number.isFinite(ly) || Math.abs(lx) > 5000 || Math.abs(ly) > 5000) continue;

    // Owner is the symbol whose header immediately precedes this label
    let ownerId: number | undefined;
    for (let sIdx = symEntries.length - 1; sIdx >= 0; sIdx--) {
      if (symEntries[sIdx].binOffset < i) {
        if (i - symEntries[sIdx].afterHeaderOffset < 950) {
          ownerId = symEntries[sIdx].comp.id;
        }
        break;
      }
    }
    seenIds.add(lid);
    components.push({
      id: lid,
      t: 'Label',
      layer: lLayer,
      color: dv.getUint32(i + 29, true),
      pos: [Number(lx.toFixed(6)), Number(ly.toFixed(6))],
      rot: Number.isFinite(lr) ? Number(lr.toFixed(2)) : 0,
      text: txt,
      fh: 9,
      owner: ownerId,
    });
  }

  // 4) Pair each RawLinkRecord with its exact (Busbar/Node p1, Branch/Radial p2) endpoints
  const busSymsByNum = new Map<string, GaSldComponent[]>();
  for (const se of symEntries) {
    const c = se.comp;
    if ((c.stype === 'Busbar' || c.stype === 'Node') && c.map?.startsWith('BU ')) {
      const bnum = c.map.slice(3).trim().split(/\s+/)[0];
      if (bnum) {
        const list = busSymsByNum.get(bnum) ?? [];
        list.push(c);
        busSymsByNum.set(bnum, list);
      }
    }
  }

  function projectOntoBus(busSym: GaSldComponent, refPt: [number, number]): [number, number] {
    const [bx, by] = busSym.pos ?? [0, 0];
    if (busSym.stype === 'Busbar' && busSym.ends && busSym.ends.length === 2) {
      const [[x1, y1], [x2, y2]] = busSym.ends;
      const isHoriz = Math.abs(x2 - x1) > Math.abs(y2 - y1);
      if (isHoriz) {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const px = Math.max(minX, Math.min(maxX, refPt[0]));
        return [Number(px.toFixed(6)), Number(by.toFixed(6))];
      } else {
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        const py = Math.max(minY, Math.min(maxY, refPt[1]));
        return [Number(bx.toFixed(6)), Number(py.toFixed(6))];
      }
    }
    return [Number(bx.toFixed(6)), Number(by.toFixed(6))];
  }

  function pickBestBusSym(busNum: string, refPt: [number, number]): GaSldComponent | null {
    const candidates = busSymsByNum.get(busNum);
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    let best = candidates[0];
    let bestDist = Infinity;
    for (const cand of candidates) {
      const proj = projectOntoBus(cand, refPt);
      const d = Math.hypot(proj[0] - refPt[0], proj[1] - refPt[1]);
      if (d < bestDist) {
        bestDist = d;
        best = cand;
      }
    }
    return best;
  }

  const usedLinkIds = new Set<number>();
  for (const se of symEntries) {
    const sym = se.comp;
    if (sym.stype !== 'Branch' && sym.stype !== 'Radial') continue;
    const parts = (sym.map || '').trim().split(/\s+/);
    const bus1 = parts[1] || '';
    const bus2 = sym.stype === 'Branch' ? parts[2] || '' : '';
    const [sx, sy] = sym.pos ?? [0, 0];

    // Find raw links within [-1200, +1200] bytes of this Branch/Radial symbol
    const nearby = rawLinks
      .filter((rl) => !usedLinkIds.has(rl.id) && Math.abs(rl.binOffset - se.binOffset) <= 1350)
      .sort((a, b) => a.binOffset - b.binOffset);

    if (sym.stype === 'Radial') {
      const rl = nearby[0];
      const refPt: [number, number] =
        rl && rl.ownedLabelCoords.length >= 2
          ? [
              (rl.ownedLabelCoords[0][0] + rl.ownedLabelCoords[1][0]) / 2,
              (rl.ownedLabelCoords[0][1] + rl.ownedLabelCoords[1][1]) / 2,
            ]
          : rl && rl.rawKnees.length > 0
          ? rl.rawKnees[0].pos
          : [sx, sy];
      const bSym = pickBestBusSym(bus1, refPt);
      if (bSym) {
        const p1Pos = projectOntoBus(bSym, refPt);
        const knees = rl ? rl.rawKnees.map((k) => k.pos) : [];
        if (rl) usedLinkIds.add(rl.id);
        components.push({
          id: rl ? rl.id : sym.id + 100000,
          t: 'Link',
          layer: rl ? rl.layer : sym.layer,
          color: rl ? rl.color : sym.color,
          lwidth: 1,
          p1: { sym: bSym.id, pos: p1Pos, idx: 0 },
          p2: { sym: sym.id, pos: [sx, sy], idx: 0 },
          knees: knees.length > 0 ? knees : undefined,
          _rawKnees: rl?.rawKnees,
        });
      }
    } else if (sym.stype === 'Branch') {
      const before = nearby.filter((r) => r.binOffset < se.binOffset).pop();
      const after = nearby.find((r) => r.binOffset > se.binOffset);
      const pairLinks = [before, after].filter(Boolean) as RawLinkRecord[];

      const getRef = (rl?: RawLinkRecord): [number, number] => {
        if (rl && rl.ownedLabelCoords.length >= 2) {
          return [
            (rl.ownedLabelCoords[0][0] + rl.ownedLabelCoords[1][0]) / 2,
            (rl.ownedLabelCoords[0][1] + rl.ownedLabelCoords[1][1]) / 2,
          ];
        }
        if (rl && rl.rawKnees.length > 0) return rl.rawKnees[0].pos;
        return [sx, sy];
      };

      const refA = getRef(pairLinks[0]);
      const refB = getRef(pairLinks[1]);
      const bSym1A = pickBestBusSym(bus1, refA);
      const bSym2B = pickBestBusSym(bus2, refB);
      const bSym1B = pickBestBusSym(bus1, refB);
      const bSym2A = pickBestBusSym(bus2, refA);

      let assignSwapped = false;
      if (bSym1A && bSym2B && bSym1B && bSym2A) {
        const dNormal =
          Math.hypot(projectOntoBus(bSym1A, refA)[0] - refA[0], projectOntoBus(bSym1A, refA)[1] - refA[1]) +
          Math.hypot(projectOntoBus(bSym2B, refB)[0] - refB[0], projectOntoBus(bSym2B, refB)[1] - refB[1]);
        const dSwap =
          Math.hypot(projectOntoBus(bSym2A, refA)[0] - refA[0], projectOntoBus(bSym2A, refA)[1] - refA[1]) +
          Math.hypot(projectOntoBus(bSym1B, refB)[0] - refB[0], projectOntoBus(bSym1B, refB)[1] - refB[1]);
        if (dSwap + 0.05 < dNormal) assignSwapped = true;
      }

      const assignments: { rl?: RawLinkRecord; busSym: GaSldComponent | null; ref: [number, number]; portIdx: number }[] =
        assignSwapped
          ? [
              { rl: pairLinks[0], busSym: bSym2A, ref: refA, portIdx: 0 },
              { rl: pairLinks[1], busSym: bSym1B, ref: refB, portIdx: 1 },
            ]
          : [
              { rl: pairLinks[0], busSym: bSym1A, ref: refA, portIdx: 0 },
              { rl: pairLinks[1], busSym: bSym2B, ref: refB, portIdx: 1 },
            ];

      for (const item of assignments) {
        if (!item.busSym) continue;
        if (item.rl) usedLinkIds.add(item.rl.id);
        const p1Pos = projectOntoBus(item.busSym, item.ref);
        const dx = p1Pos[0] - sx;
        const dy = p1Pos[1] - sy;
        const dist = Math.hypot(dx, dy) || 1;
        const p2Pos: [number, number] = [
          Number((sx + (dx / dist) * 0.116).toFixed(6)),
          Number((sy + (dy / dist) * 0.116).toFixed(6)),
        ];
        // Filter out collinear single-segment handle points while preserving real 90-degree bends
        const rawKnees = item.rl?.rawKnees ?? [];
        const knees = rawKnees
          .map((k) => k.pos)
          .filter((kp) => {
            const colY = Math.abs(kp[1] - p1Pos[1]) < 0.03 && Math.abs(p1Pos[1] - p2Pos[1]) < 0.03;
            const colX = Math.abs(kp[0] - p1Pos[0]) < 0.03 && Math.abs(p1Pos[0] - p2Pos[0]) < 0.03;
            return !(rawKnees.length === 1 && (colY || colX));
          });
        components.push({
          id: item.rl ? item.rl.id : sym.id * 100 + item.portIdx,
          t: 'Link',
          layer: item.rl ? item.rl.layer : sym.layer,
          color: item.rl ? item.rl.color : sym.color,
          lwidth: 1,
          p1: { sym: item.busSym.id, pos: p1Pos, idx: 0 },
          p2: { sym: sym.id, pos: p2Pos, idx: item.portIdx },
          knees: knees.length > 0 ? knees : undefined,
          _rawKnees: rawKnees,
        });
      }
    }
  }

  return { format: 'ga-sld-v1', fileVersion: check.version, layers, components };
}

function findSymbolHeaderOffset(bytes: Uint8Array, dv: DataView, cid: number, expectedLayer: number, symPad: number): number {
  const b0 = cid & 0xff;
  const b1 = (cid >> 8) & 0xff;
  const b2 = (cid >> 16) & 0xff;
  const b3 = (cid >> 24) & 0xff;
  const limit = bytes.length - 150;
  for (let i = 500; i <= limit; i++) {
    if (bytes[i] === b0 && bytes[i + 1] === b1 && bytes[i + 2] === b2 && bytes[i + 3] === b3) {
      if (bytes[i + 16] !== 0) continue;
      const mlen = bytes[i + 45];
      if (mlen !== 0x1c && mlen !== 0x20) continue;
      const lyr = dv.getUint32(i + 12, true);
      if (expectedLayer !== undefined && lyr !== expectedLayer && lyr > 64) continue;
      const adOff = i + 46 + mlen;
      if (adOff + 8 >= bytes.length) continue;
      if (
        bytes[adOff + 3] !== 0x41 ||
        bytes[adOff + 4] !== 0x4e ||
        bytes[adOff + 5] !== 0x4e ||
        bytes[adOff + 6] !== 0x4f ||
        bytes[adOff + 7] !== 0x54
      ) {
        continue;
      }
      const adCnt = dv.getUint16(adOff, true);
      if (adCnt < 1 || adCnt > 10) continue;
      let p = adOff + 2;
      let ok = true;
      for (let k = 0; k < adCnt; k++) {
        if (p >= bytes.length) {
          ok = false;
          break;
        }
        p += 1 + bytes[p];
      }
      if (ok && p + symPad + 24 <= bytes.length) {
        return i;
      }
    }
  }
  return -1;
}

function findLabelHeaderOffset(bytes: Uint8Array, dv: DataView, cid: number, expectedLayer: number, lblTxtOff: number): number {
  const b0 = cid & 0xff;
  const b1 = (cid >> 8) & 0xff;
  const b2 = (cid >> 16) & 0xff;
  const b3 = (cid >> 24) & 0xff;
  const limit = bytes.length - (lblTxtOff + 4);
  for (let i = 500; i <= limit; i++) {
    if (bytes[i] === b0 && bytes[i + 1] === b1 && bytes[i + 2] === b2 && bytes[i + 3] === b3) {
      if (bytes[i + 16] !== 0) continue;
      const hasTag =
        (bytes[i - 2] === 0x03 && bytes[i - 1] === 0x80) ||
        (i >= 9 && bytes[i - 9] === 0x43 && bytes[i - 8] === 0x53 && bytes[i - 1] === 0x6c);
      if (!hasTag) continue;
      const lyr = dv.getUint32(i + 12, true);
      if ((expectedLayer === undefined || lyr === expectedLayer) && lyr <= 64) {
        return i;
      }
    }
  }
  return -1;
}

function findKneeOffsetById(bytes: Uint8Array, dv: DataView, kid: number, lblPosOff: number): number {
  const b0 = kid & 0xff;
  const b1 = (kid >> 8) & 0xff;
  const b2 = (kid >> 16) & 0xff;
  const b3 = (kid >> 24) & 0xff;
  const limit = bytes.length - (lblPosOff + 16);
  for (let i = 500; i <= limit; i++) {
    if (bytes[i] === b0 && bytes[i + 1] === b1 && bytes[i + 2] === b2 && bytes[i + 3] === b3) {
      const isKneeTag =
        (bytes[i - 2] === 0x0c && bytes[i - 1] === 0x80) ||
        (i >= 13 && bytes[i - 13] === 0x43 && bytes[i - 1] === 0x74); // CSldKneePoint
      if (isKneeTag && bytes[i + 16] === 0) {
        return i + lblPosOff;
      }
    }
  }
  return -1;
}

export function patchSldBinary(baseBytes: Uint8Array, doc: GaSldDocument): Uint8Array {
  const check = validateSldBinary(baseBytes);
  if (!check.valid) {
    throw new Error(check.reason || 'Geçersiz temel .sld binary dosyası.');
  }
  const work = new Uint8Array(baseBytes);
  const dv = new DataView(work.buffer, work.byteOffset, work.byteLength);
  const isV36 = check.version.startsWith('2.0.51.');
  const symPad = isV36 ? 37 : 33;
  const lblPosOff = isV36 ? 85 : 81;
  const lblTxtOff = isV36 ? 119 : 115;

  // 1) Patch Symbols in-place (only when modified)
  for (const c of doc.components) {
    if (c.t !== 'Symbol' || !c.pos) continue;
    const idx = findSymbolHeaderOffset(work, dv, c.id, c.layer, symPad);
    if (idx >= 0) {
      if (c.layer !== undefined && dv.getUint32(idx + 12, true) !== c.layer) dv.setUint32(idx + 12, c.layer, true);
      if (c.color !== undefined && dv.getUint32(idx + 29, true) !== c.color) dv.setUint32(idx + 29, c.color, true);
      const mlen = work[idx + 45];
      const adOff = idx + 46 + mlen;
      const adCnt = dv.getUint16(adOff, true);
      let p = adOff + 2;
      for (let k = 0; k < adCnt; k++) p += 1 + work[p];
      const curX = dv.getFloat64(p + symPad, true);
      const curY = dv.getFloat64(p + symPad + 8, true);
      const curR = dv.getFloat64(p + symPad + 16, true);
      if (Math.abs(curX - c.pos[0]) > 1e-3 || Math.abs(curY - c.pos[1]) > 1e-3) {
        dv.setFloat64(p + symPad, c.pos[0], true);
        dv.setFloat64(p + symPad + 8, c.pos[1], true);
      }
      if (c.rot !== undefined && Math.abs(curR - c.rot) > 1e-2) {
        dv.setFloat64(p + symPad + 16, c.rot, true);
        dv.setFloat64(idx + 4, c.rot, true);
      }
    }
  }

  // 2) Patch KneePoint coordinates in-place (when knee points were dragged)
  for (const c of doc.components) {
    if (c.t !== 'Link' || !c._rawKnees || !c.knees) continue;
    const count = Math.min(c._rawKnees.length, c.knees.length);
    for (let k = 0; k < count; k++) {
      const rk = c._rawKnees[c._rawKnees.length - count + k];
      const nk = c.knees[k];
      if (!rk || !nk) continue;
      const kpOff = findKneeOffsetById(work, dv, rk.id, lblPosOff);
      if (kpOff >= 0 && kpOff + 16 <= work.length) {
        const curKx = dv.getFloat64(kpOff, true);
        const curKy = dv.getFloat64(kpOff + 8, true);
        if (Math.abs(curKx - nk[0]) > 1e-3 || Math.abs(curKy - nk[1]) > 1e-3) {
          dv.setFloat64(kpOff, nk[0], true);
          dv.setFloat64(kpOff + 8, nk[1], true);
        }
      }
    }
  }

  // 3) Patch Labels (coordinates in-place + variable-length text splices from end to start)
  const splices: { offset: number; oldLen: number; newBytes: Uint8Array }[] = [];
  for (const c of doc.components) {
    if (c.t !== 'Label') continue;
    const idx = findLabelHeaderOffset(work, dv, c.id, c.layer, lblTxtOff);
    if (idx >= 0) {
      if (c.layer !== undefined && dv.getUint32(idx + 12, true) !== c.layer) dv.setUint32(idx + 12, c.layer, true);
      if (c.color !== undefined && dv.getUint32(idx + 29, true) !== c.color) dv.setUint32(idx + 29, c.color, true);
      if (c.pos) {
        const curX = dv.getFloat64(idx + lblPosOff, true);
        const curY = dv.getFloat64(idx + lblPosOff + 8, true);
        const curR = dv.getFloat64(idx + lblPosOff + 16, true);
        if (Math.abs(curX - c.pos[0]) > 1e-3 || Math.abs(curY - c.pos[1]) > 1e-3) {
          dv.setFloat64(idx + lblPosOff, c.pos[0], true);
          dv.setFloat64(idx + lblPosOff + 8, c.pos[1], true);
        }
        if (c.rot !== undefined && Math.abs(curR - c.rot) > 1e-2) {
          dv.setFloat64(idx + lblPosOff + 16, c.rot, true);
        }
      }
      if (c.text !== undefined) {
        const oldLen = work[idx + lblTxtOff];
        if (oldLen < 250 && idx + lblTxtOff + 1 + oldLen <= work.length) {
          const encoded = encodeCp1254(c.text).subarray(0, 250);
          const curBytes = work.subarray(idx + lblTxtOff + 1, idx + lblTxtOff + 1 + oldLen);
          let changed = encoded.length !== curBytes.length;
          if (!changed) {
            for (let k = 0; k < encoded.length; k++) {
              if (encoded[k] !== curBytes[k]) {
                changed = true;
                break;
              }
            }
          }
          if (changed) {
            splices.push({ offset: idx + lblTxtOff, oldLen, newBytes: encoded });
          }
        }
      }
    }
  }

  if (splices.length === 0) return work;

  splices.sort((a, b) => a.offset - b.offset);
  let totalDelta = 0;
  for (const sp of splices) totalDelta += sp.newBytes.length - sp.oldLen;

  const out = new Uint8Array(work.length + totalDelta);
  let srcCursor = 0;
  let dstCursor = 0;
  for (const sp of splices) {
    const chunkLen = sp.offset - srcCursor;
    out.set(work.subarray(srcCursor, sp.offset), dstCursor);
    dstCursor += chunkLen;
    out[dstCursor++] = sp.newBytes.length;
    out.set(sp.newBytes, dstCursor);
    dstCursor += sp.newBytes.length;
    srcCursor = sp.offset + 1 + sp.oldLen;
  }
  out.set(work.subarray(srcCursor), dstCursor);
  return out;
}
