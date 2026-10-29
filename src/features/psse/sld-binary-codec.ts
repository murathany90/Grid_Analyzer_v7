export interface GaSldLayer {
  n: number;
  desc: string;
  vis: string;
}

export interface GaSldPortRef {
  sym: number | null;
  pos: [number, number];
  idx?: number;
}

export interface GaSldComponent {
  id: number;
  t: 'Symbol' | 'Link' | 'Label';
  stype?: string;
  psse?: string;
  sdef?: number;
  layer: number;
  map?: string;
  pos?: [number, number];
  rot?: number;
  color?: number;
  len?: number;
  width?: number;
  ends?: [[number, number], [number, number]];
  p1?: GaSldPortRef;
  p2?: GaSldPortRef;
  knees?: [number, number][];
  lwidth?: number;
  lstyle?: number;
  text?: string;
  fh?: number;
  fw?: number;
  owner?: number;
  vis?: boolean;
}

export interface GaSldDocument {
  format: 'ga-sld-v1';
  fileVersion: string;
  title?: string;
  extent?: [number, number, number, number];
  layers: GaSldLayer[];
  components: GaSldComponent[];
}

const CP1254_HIGH: Record<number, string> = {
  0xd0: 'Ğ', 0xdd: 'İ', 0xde: 'Ş', 0xf0: 'ğ', 0xfd: 'ı', 0xfe: 'ş',
  0xc7: 'Ç', 0xe7: 'ç', 0xd6: 'Ö', 0xf6: 'ö', 0xdc: 'Ü', 0xfc: 'ü',
};

const UNICODE_TO_CP1254: Record<string, number> = {
  'Ğ': 0xd0, 'İ': 0xdd, 'Ş': 0xde, 'ğ': 0xf0, 'ı': 0xfd, 'ş': 0xfe,
  'Ç': 0xc7, 'ç': 0xe7, 'Ö': 0xd6, 'ö': 0xf6, 'Ü': 0xdc, 'ü': 0xfc,
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

export function bgrIntToCssHex(color: number | undefined, fallback = '#7cb7f0'): string {
  if (color === undefined || color === null || !Number.isFinite(color) || color < 0) return fallback;
  const r = color & 0xff;
  const g = (color >> 8) & 0xff;
  const b = (color >> 16) & 0xff;
  if (r === 0 && g === 0 && b === 0) return '#dce7f3';
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function cssHexToBgrInt(hex: string): number {
  const clean = hex.replace(/^#/, '');
  if (clean.length !== 6) return 0xffffff;
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return r | (g << 8) | (b << 16);
}

function decodeMapRecord(mapType: number, bus1: number, bus2: number, bus3: number, ckt: string): { map: string; stype: string; psse: string; sdef: number } {
  const cleanCkt = (ckt || '1').trim() || '1';
  switch (mapType) {
    case 1:
      return { map: bus1 ? `BU ${bus1}` : '', stype: 'Busbar', psse: 'Busbar', sdef: 1 };
    case 2:
      return { map: bus1 ? `LO ${bus1} ${cleanCkt} ` : '', stype: 'Radial', psse: 'Load', sdef: 2 };
    case 3:
      return { map: bus1 ? `ME ${bus1} ${cleanCkt} ` : '', stype: 'Radial', psse: 'Machine', sdef: 4 };
    case 4:
      return { map: bus1 ? `FXS ${bus1} ${cleanCkt} ` : '', stype: 'Radial', psse: 'FixedShunt', sdef: 5 };
    case 5:
      return {
        map: bus1 && bus2 ? `TR ${bus1} ${bus2}${bus3 ? ' ' + bus3 : ''} ${cleanCkt} ` : '',
        stype: 'Branch',
        psse: 'Transformer',
        sdef: 10,
      };
    case 9:
      return { map: bus1 && bus2 ? `LI ${bus1} ${bus2} ${cleanCkt} ` : '', stype: 'Branch', psse: 'Branch', sdef: 32 };
    case 12:
      return { map: bus1 && bus2 ? `SYS ${bus1} ${bus2} ${cleanCkt} ` : '', stype: 'Branch', psse: 'SwitchingDev', sdef: 3 };
    case 13:
      return { map: bus1 ? `SWS ${bus1} ${cleanCkt} ` : '', stype: 'Radial', psse: 'SwitchedShunt', sdef: 13 };
    default:
      return { map: bus1 ? `BU ${bus1}` : '', stype: 'Node', psse: 'BusNode', sdef: 0 };
  }
}

export function parseSldBinary(bytes: Uint8Array, profile?: GaSldDocument | null): GaSldDocument {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headText = decodeCp1254(bytes.subarray(0, Math.min(bytes.length, 4096)));
  const isV36 = headText.includes('2.0.51.');
  const fileVersion = isV36 ? '2.0.51.1' : headText.includes('2.0.49.') ? '2.0.49.3' : '2.0.51.1';
  const symPad = isV36 ? 37 : 33;
  const lblPosOff = isV36 ? 85 : 81;
  const lblTxtOff = isV36 ? 119 : 115;

  // Extract layers from header
  const layers: GaSldLayer[] = profile?.layers?.length
    ? structuredClone(profile.layers)
    : [
        { n: 0, desc: 'Background', vis: 'Visible' },
        { n: 1, desc: 'Foreground', vis: 'Visible' },
        { n: 2, desc: 'BaseVoltage 154,0', vis: 'Visible' },
        { n: 4, desc: 'BaseVoltage 400,0', vis: 'Visible' },
      ];

  // If we have a matching topology profile, update its live symbol & label fields directly from the binary bytes!
  if (profile && Array.isArray(profile.components) && profile.components.length > 0) {
    const out: GaSldDocument = structuredClone(profile);
    out.fileVersion = fileVersion;
    for (const c of out.components) {
      if (c.t === 'Symbol') {
        const idx = findSymbolHeaderOffset(bytes, dv, c.id, c.layer, symPad);
        if (idx >= 0) {
          c.layer = dv.getUint32(idx + 12, true);
          c.color = dv.getUint32(idx + 29, true);
          const mlen = bytes[idx + 45];
          const adOff = idx + 46 + mlen;
          const adCnt = dv.getUint16(adOff, true);
          let p = adOff + 2;
          for (let k = 0; k < adCnt; k++) p += 1 + bytes[p];
          const dx = dv.getFloat64(p + symPad, true);
          const dy = dv.getFloat64(p + symPad + 8, true);
          const dr = dv.getFloat64(p + symPad + 16, true);
          if (Number.isFinite(dx) && Number.isFinite(dy) && Math.abs(dx) < 1e5 && Math.abs(dy) < 1e5) {
            if (c.pos && c.ends && c.ends.length === 2) {
              const shiftX = dx - c.pos[0];
              const shiftY = dy - c.pos[1];
              if (Math.abs(shiftX) > 1e-4 || Math.abs(shiftY) > 1e-4) {
                c.ends = [
                  [c.ends[0][0] + shiftX, c.ends[0][1] + shiftY],
                  [c.ends[1][0] + shiftX, c.ends[1][1] + shiftY],
                ];
              }
            }
            c.pos = [Number(dx.toFixed(4)), Number(dy.toFixed(4))];
            c.rot = Number(dr.toFixed(2));
          }
        }
      } else if (c.t === 'Label') {
        const idx = findLabelHeaderOffset(bytes, dv, c.id, c.layer, lblTxtOff);
        if (idx >= 0) {
          c.layer = dv.getUint32(idx + 12, true);
          c.color = dv.getUint32(idx + 29, true);
          const dx = dv.getFloat64(idx + lblPosOff, true);
          const dy = dv.getFloat64(idx + lblPosOff + 8, true);
          const dr = dv.getFloat64(idx + lblPosOff + 16, true);
          if (
            Number.isFinite(dx) &&
            Number.isFinite(dy) &&
            Math.abs(dx) < 1e4 &&
            Math.abs(dy) < 1e4 &&
            (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6)
          ) {
            c.pos = [Number(dx.toFixed(4)), Number(dy.toFixed(4))];
            c.rot = Number(dr.toFixed(2));
          }
          const tlen = bytes[idx + lblTxtOff];
          if (tlen > 0 && idx + lblTxtOff + 1 + tlen <= bytes.length) {
            c.text = decodeCp1254(bytes.subarray(idx + lblTxtOff + 1, idx + lblTxtOff + 1 + tlen));
          }
        }
      }
    }
    return out;
  }

  // Fallback standalone binary scanner for arbitrary unknown .sld files
  const components: GaSldComponent[] = [];
  const seenIds = new Set<number>();
  for (let i = 500; i < bytes.length - 160; i++) {
    // Check for Symbol record signature: +4..+8 == 0, +45 in (0x1c, 0x20), ANNOT at +49+mlen
    if (
      bytes[i + 4] === 0 &&
      bytes[i + 5] === 0 &&
      bytes[i + 6] === 0 &&
      bytes[i + 7] === 0 &&
      (bytes[i + 45] === 0x1c || bytes[i + 45] === 0x20)
    ) {
      const mlen = bytes[i + 45];
      const adOff = i + 46 + mlen;
      if (adOff + 12 >= bytes.length) continue;
      const adCnt = dv.getUint16(adOff, true);
      if (adCnt < 1 || adCnt > 6) continue;
      const slen = bytes[adOff + 2];
      if (slen < 5 || slen > 32 || adOff + 3 + 5 > bytes.length) continue;
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
      if (cid === 0 || cid > 500000 || layer > 64 || seenIds.has(cid)) continue;
      let p = adOff + 2;
      for (let k = 0; k < adCnt; k++) p += 1 + bytes[p];
      if (p + symPad + 24 > bytes.length) continue;
      const dx = dv.getFloat64(p + symPad, true);
      const dy = dv.getFloat64(p + symPad + 8, true);
      const dr = dv.getFloat64(p + symPad + 16, true);
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 5000 || Math.abs(dy) > 5000) continue;

      const color = dv.getUint32(i + 29, true);
      const mapType = dv.getUint32(i + 49, true);
      const bus1 = dv.getUint32(i + 58, true);
      const bus2 = dv.getUint32(i + 62, true);
      const bus3 = dv.getUint32(i + 66, true);
      const ckt = decodeCp1254(bytes.subarray(i + 70, i + 74));
      const decoded = decodeMapRecord(mapType, bus1, bus2, bus3, ckt);
      seenIds.add(cid);
      components.push({
        id: cid,
        t: 'Symbol',
        stype: decoded.stype,
        psse: decoded.psse,
        sdef: decoded.sdef,
        layer,
        color,
        map: decoded.map,
        pos: [Number(dx.toFixed(4)), Number(dy.toFixed(4))],
        rot: Number(dr.toFixed(2)),
        len: decoded.stype === 'Busbar' ? 2.5 : undefined,
        width: decoded.stype === 'Busbar' ? 0.06 : undefined,
      });

      // Scan owned labels immediately following this symbol
      let cursor = p + symPad + 24;
      for (let scan = cursor; scan < Math.min(bytes.length - 140, cursor + 900); scan++) {
        const isTag =
          (bytes[scan] === 0x03 && bytes[scan + 1] === 0x80) ||
          (scan >= 7 && bytes[scan - 7] === 0x43 && bytes[scan - 6] === 0x53 && bytes[scan + 1] === 0x6c);
        if (isTag) {
          const lIdx = scan + 2;
          const lid = dv.getUint32(lIdx, true);
          const lLayer = dv.getUint32(lIdx + 12, true);
          if (lid > 0 && lid < 500000 && lLayer <= 64 && lIdx + lblTxtOff + 2 < bytes.length) {
            const tlen = bytes[lIdx + lblTxtOff];
            if (tlen > 0 && tlen < 120 && lIdx + lblTxtOff + 1 + tlen <= bytes.length) {
              const txt = decodeCp1254(bytes.subarray(lIdx + lblTxtOff + 1, lIdx + lblTxtOff + 1 + tlen));
              const lx = dv.getFloat64(lIdx + lblPosOff, true);
              const ly = dv.getFloat64(lIdx + lblPosOff + 8, true);
              const lr = dv.getFloat64(lIdx + lblPosOff + 16, true);
              const usePos: [number, number] =
                Number.isFinite(lx) && Number.isFinite(ly) && Math.abs(lx) < 5000 && Math.abs(ly) < 5000 && (Math.abs(lx) > 1e-4 || Math.abs(ly) > 1e-4)
                  ? [Number(lx.toFixed(4)), Number(ly.toFixed(4))]
                  : [Number(dx.toFixed(4)), Number((dy + 0.4).toFixed(4))];
              if (!seenIds.has(lid) && txt.trim()) {
                seenIds.add(lid);
                components.push({
                  id: lid,
                  t: 'Label',
                  layer: lLayer,
                  color: dv.getUint32(lIdx + 29, true),
                  pos: usePos,
                  rot: Number.isFinite(lr) ? Number(lr.toFixed(2)) : 0,
                  text: txt,
                  fh: 9,
                  owner: cid,
                });
              }
            }
          }
        }
      }
    }
  }

  return {
    format: 'ga-sld-v1',
    fileVersion,
    layers,
    components,
  };
}

function findSymbolHeaderOffset(bytes: Uint8Array, dv: DataView, cid: number, expectedLayer: number, symPad: number): number {
  const b0 = cid & 0xff;
  const b1 = (cid >> 8) & 0xff;
  const b2 = (cid >> 16) & 0xff;
  const b3 = (cid >> 24) & 0xff;
  const limit = bytes.length - 150;
  for (let i = 500; i <= limit; i++) {
    if (bytes[i] === b0 && bytes[i + 1] === b1 && bytes[i + 2] === b2 && bytes[i + 3] === b3) {
      if (bytes[i + 4] !== 0 || bytes[i + 5] !== 0 || bytes[i + 6] !== 0 || bytes[i + 7] !== 0) continue;
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
      if (bytes[i + 4] !== 0 || bytes[i + 5] !== 0 || bytes[i + 6] !== 0 || bytes[i + 7] !== 0) continue;
      const hasTag =
        (bytes[i - 2] === 0x03 && bytes[i - 1] === 0x80) ||
        (i >= 9 && bytes[i - 9] === 0x43 && bytes[i - 8] === 0x53 && bytes[i - 1] === 0x6c);
      if (!hasTag) continue;
      const lyr = dv.getUint32(i + 12, true);
      if (lyr === expectedLayer && bytes[i + 16] === 0) {
        return i;
      }
    }
  }
  return -1;
}

export function patchSldBinary(baseBytes: Uint8Array, doc: GaSldDocument): Uint8Array {
  const work = new Uint8Array(baseBytes);
  const dv = new DataView(work.buffer, work.byteOffset, work.byteLength);
  const headText = decodeCp1254(work.subarray(0, Math.min(work.length, 256)));
  const isV36 = headText.includes('2.0.51.');
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
      }
    }
  }

  // 2) Patch Labels (coordinates in-place + variable-length text splices from end to start)
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
