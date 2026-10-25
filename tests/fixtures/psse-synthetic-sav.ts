import { SAV_LAYOUT_31, savDimension, savPredicate } from '../../src/importers/psse/sav-layout-schema';

/** Original three-bus electrical test case. Contains no Siemens/model fixture data.
 * The shared declarative format catalog is used only for serialization, while
 * expected electrical meanings are asserted independently in normalization tests.
 */
export function syntheticSav(overrides: Record<string, unknown[]> = {}): Uint8Array {
  const I = new Array<number>(71).fill(0), M = new Array<number>(10).fill(0), L = new Array<number>(37).fill(0), P = new Array<number>(19).fill(0);
  for (const [index, value] of [[0, 3], [1, 1], [2, 1], [3, 3], [4, 1], [8, 1], [26, 1], [27, 1], [28, 3], [34, 1], [35, 1], [36, 1], [37, 1], [45, 1], [48, 1], [69, 1]]) I[index] = value;
  L[16] = 1; L[27] = 1;
  const padded = (values: string[], width: number) => [values.map(v => v.padEnd(width, ' ')).join('')];
  const reals = new Array<number>(28).fill(0); reals[2] = 100; reals[16] = 50;
  const custom: Record<string, unknown[]> = {
    Info: ['LILL31 SYNTHETIC ELECTRICAL CASE'.padEnd(36, ' ')], Release: [5], Pntrev: [0, 0, 0, 0, 0], Headre: reals, Headin: I, Maxary: M, Headlo: L,
    Ihanb: padded(['ORIGINAL TEST CASE', 'THREE BUSES'], 60), Numbus: [101000, 102000, 103000], Jcode: [3, 1, 1], Orgjcode: [3, 1, 1], Origbus: [1, 2, 3], Dblvlt: [[1.01, 0], [0.98, 0.1], [0.99, -0.02]],
    Busnam: padded(['SOURCE', 'JUNCTION', 'LOAD'], 12), Basvlt: [110, 110, 20], Nvlmhi: [1.1, 1.1, 1.1], Nvlmlo: [0.9, 0.9, 0.9], Evlmhi: [1.2, 1.2, 1.2], Evlmlo: [0.8, 0.8, 0.8],
    Iarea: [1, 1, 1], Loszon: [1, 1, 1], Iowner: [1, 1, 1], Numare: [70], Numzon: [80], Numown: [90],
    Genbus: [1, 0, 0], Mcfrst: [1], Mcnext: [0], Mxstat: [1], Machid: padded(['G1'], 2), Mcname: padded(['SYNTHETIC GENERATOR'], 40), Pgenmc: [0.5], Qgenmc: [0.12], Qmaxmc: [0.3], Qminmc: [-0.2], Pmaxmc: [0.8], Pminmc: [0.1], Mbase: [75], Zsorce: [[0.01, 0.2]], Xtran: [[0.002, 0.05]], Gentap: [1.025], Vsave: [1.01], Regbus: [1], Regnod: [0], Rempct: [100], Mcofst: [1], Mconxt: [0], Mconum: [1], Mcopct: [1], Machdrpcurve: [1],
    Ldfrst: [0, 0, 1], Ldnext: [0], Ldstat: [1], Ldarea: [1], Ldzone: [1], Ldownr: [1], Loadid: padded(['L1'], 2), Ldname: padded(['SYNTHETIC ZIP LOAD'], 40), Cfdlfr: [[0.4, 0.1], [0.02, 0.03], [0.04, -0.05]], Cdgnfr: [[0, 0]], Ldconf: ['1'], Ldintr: ['0'],
    Shfrst: [0, 1, 0], Shnext: [0], Shstat: [1], Shntgb: [[0.001, -0.05]], Shntid: padded(['S1'], 2), Shnnam: padded(['SYNTHETIC FIXED SHUNT'], 40),
    Ifirst: [1, 3, 2], Inext: [0, 0, 0], Ito: [2, 2, 3], Icom: [1, 1, 0], Orgicom: [1, 1, 0], Tapno: [0, -1, 0], Brkno: [0, 0, 1], Numckt: padded(['A', 'T1', 'SW'], 2), Imeter: [1, 2, 3],
    Brname: padded(['SYNTHETIC LINE', 'SYNTHETIC TRANSFORMER', 'SYNTHETIC SWITCH'], 40), Gb: [[-0.9900990099, 9.900990099], [-0.495049505, 4.95049505], [0, 10000]], B2s: [0.015, 0, 0], Gbline: [[0.001, 0.02], [0.003, 0.04], [0.0001, -0.0002], [0, 0], [0, 0], [0, 0]], Linlen: [12.5, 0, 0],
    Lnofst: [1, 2, 3], Lnonxt: [0, 0, 0], Lnonum: [1, 1, 1], Lnopct: [1, 1, 1],
    Ratselector: [4095], Ratings: Array.from({ length: 12 }, (_, r) => [100 + r, 200 + r, 300 + r]).flat(),
    Windrp: [1.05], Windrs: [0.98], Nomvp: [110], Nomvs: [20], Trnbas: [40], Psangl: [Math.PI / 6], Gbtran: [[-0.495049505, 4.95049505]], Iocode: [4681], Tpnabl: [0], Ntapos: [33], Rmax: [1.1], Rmin: [0.9], Vmax: [1.1], Vmin: [0.9], Xfrcmp: [[0.001, 0.002]],
    Brktyp: [2], Brknst: [1], Brknam: padded(['SYNTHETIC SYSTEM SWITCH'], 40), Brkrsetnum: [0],
    Stsnum: [501], Stsnam: padded(['SYNTHETIC SUBSTATION'], 40), Stslat: [30], Stslon: [40], Stsgrd: [0.1], Bussts: [1, 1, 1],
    Vdname: padded(['SYNTHETIC DROOP'], 40), Vdstatusraw: [1], Vdregbus: [1], Vdqdb: [0], Vdqminraw: [-20], Vdqmaxraw: [30], Vdvlowraw: [0.9], Vddbloraw: [0.99], Vddbhiraw: [1.01], Vdvhiraw: [1.1],
    ...overrides,
  };
  const chunks: Uint8Array[] = [];
  const sizes = [4, 4, 8, 1, 4, 8, 16];
  let scalarIndex = 0;
  for (const [field, type, dimension, predicate, revision] of SAV_LAYOUT_31) {
    if (dimension === 0) scalarIndex++;
    if (revision > 31 || !savPredicate(predicate, I, L, P, M, key => Number(custom[key]?.[0] ?? 0))) continue;
    const count = dimension > 0 ? dimension : dimension === 0 ? [5, 28, 71, 10, 37, 17, 19, 31][scalarIndex - 1] : dimension === -101 ? 36 : [-117, -124, -139, -152].includes(dimension) ? 0 : savDimension(dimension, I, M, P);
    const bytes = new Uint8Array(Math.ceil(count * sizes[type] / 4) * 4), view = new DataView(bytes.buffer), values = custom[field];
    if (type === 3) {
      const source = String(values?.[0] ?? '').padEnd(count, ' ');
      for (let j = 0; j < count; j++) bytes[j] = source.charCodeAt(j);
    } else {
      for (let j = 0; j < count; j++) {
        const at = j * sizes[type], v = values?.[j] ?? (type >= 5 ? [0, 0] : 0);
        if (type === 0 || type === 4) view.setInt32(at, Number(v), true);
        else if (type === 1) view.setFloat32(at, Number(v), true);
        else if (type === 2) view.setFloat64(at, Number(v), true);
        else { const pair = v as number[]; if (type === 5) { view.setFloat32(at, pair[0], true); view.setFloat32(at + 4, pair[1], true); } else { view.setFloat64(at, pair[0], true); view.setFloat64(at + 8, pair[1], true); } }
      }
    }
    chunks.push(bytes);
  }
  const payloadLength = chunks.reduce((sum, chunk) => sum + chunk.length, 20);
  const rootWord = 400, extentWord = 1000, physical = (pointer: number) => 12 + 4 * (pointer - 1), start = physical(extentWord) + 8;
  const result = new Uint8Array(start + payloadLength), view = new DataView(result.buffer);
  result.set(new TextEncoder().encode('FuP_pHySPCD%PTI_SFL_'));
  view.setUint32(20, 1, true); view.setUint32(24, (result.length - 12) / 4, true); view.setUint32(80, rootWord, true);
  [extentWord, extentWord, payloadLength / 4, 1].forEach((v, i) => view.setUint32(physical(rootWord) + i * 4, v, true));
  view.setUint32(physical(extentWord) + 4, payloadLength / 4, true);
  let cursor = start;
  for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.length; }
  return result;
}
