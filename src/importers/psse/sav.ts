import { addEquipment, integer, newModel, value, type SourceRow } from './common';
import { readSavContainer, savPhysicalRanges } from './sav-container';
import { readSavPayloadArrays } from './sav-layout';
import type { PsseEquipment, PsseModel } from './types';

/** Decode saved electrical arrays. No host APIs, source snapshots or native code. */
export function decodeSav(bytes: Uint8Array, name: string): PsseModel {
  const started = performance.now();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const container = readSavContainer(buffer);
  const decoded = readSavPayloadArrays(container.segments[0]);
  const arrays = decoded.arrays;
  const count = (field: string) => arrays[field]?.count ?? 0;
  const num = (field: string, index: number): number => {
    const entry = arrays[field]?.values[index];
    if (typeof entry !== 'number' || !Number.isFinite(entry)) throw Error(`SAV_MISSING_OR_INVALID_FIELD: ${field}[${index + 1}]`);
    return entry;
  };
  const int = (field: string, index: number) => integer(num(field, index), `${field}[${index + 1}]`);
  const maybe = (field: string, index: number): number | null => arrays[field] && index < arrays[field].count ? num(field, index) : null;
  const text = (field: string, index: number, width: number): string => {
    const entry = arrays[field]?.values[0];
    if (typeof entry !== 'string' || index < 0 || (index + 1) * width > entry.length) throw Error(`SAV_MISSING_CHARACTER_FIELD: ${field}[${index + 1}]`);
    return entry.slice(index * width, (index + 1) * width).trimEnd();
  };
  const label = (field: string, index: number, width: number): string => {
    const raw = text(field, index, width);
    // Display inference only: binaryArrays retain every original character byte.
    // Source IDs continue to use text(), so encoding inference cannot rename them.
    if (!/[\u0080-\u00ff]/.test(raw)) return raw;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(raw, character => character.charCodeAt(0))); }
    catch { return raw; }
  };
  const complex = (field: string, index: number): [number, number] => {
    const pair = arrays[field]?.values[index];
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(v => !Number.isFinite(v))) throw Error(`SAV_MISSING_COMPLEX_FIELD: ${field}[${index + 1}]`);
    return [pair[0], pair[1]];
  };
  const inverseNegativeAdmittance = (field: string, index: number): [number, number] => {
    const [g, b] = complex(field, index), d = g * g + b * b;
    if (d === 0) throw Error(`SAV_ZERO_SERIES_ADMITTANCE: ${field}[${index + 1}]`);
    return [-g / d, b / d];
  };
  const offset = (field: string, index = 0): number => {
    const array = arrays[field];
    if (!array || index < 0 || index >= array.count) throw Error(`SAV_INVALID_PROVENANCE: ${field}`);
    const sizes: Record<string, number> = { I32: 4, F32: 4, F64: 8, CHAR: 1, LOGICAL: 4, C64: 8, C128: 16 };
    return savPhysicalRanges(container.segmentInfo[0], array.offset + index * sizes[array.type], sizes[array.type])[0].offset;
  };
  const op = (v: number, field: string, index: number, unit?: string, derived = false) => value(v, `SAV.${field}[${index + 1}]`, unit, derived, offset(field, index));
  const baseMva = num('Headre', 2), frequency = num('Headre', 16);
  const titles = [text('Ihanb', 0, 60), text('Ihanb', 1, 60)];
  const model = newModel(bytes, name, 'SAV', 31, baseMva, frequency, titles);
  model.binaryArrays = arrays;
  model.sourceTables = { SAV_HEADER: decoded.header, SFL: { ...container, segments: container.segmentInfo }, SAV_TAIL: decoded.tail };
  model.case.binaryOffsetOrigin = 'SFL segment 1 logical byte offsets in binaryArrays; operating.offset is physical source byte';
  model.case.savedInfo = decoded.header.info;
  model.case.displayNameEncoding = 'Inferred valid UTF-8 for labels, otherwise byte-faithful Latin-1; source IDs and binaryArrays retain original bytes.';
  model.case.xfrrat = int('Headlo', 26);
  model.case.nxfrat = int('Headlo', 27);
  model.case.transformerRatingUnits = Number(model.case.xfrrat) > 0 ? 'CURRENT_EXPRESSED_AS_MVA' : 'MVA';
  model.case.lineRatingUnits = Number(model.case.nxfrat) > 0 ? 'CURRENT_EXPRESSED_AS_MVA' : 'MVA';
  model.case.normalization = 'Canonical system-base impedances and bus-base winding ratios; original packed codes and every decoded array are retained.';
  const partial = (message: string) => { model.completeness = 'PARTIAL'; model.findings.push({ severity: 'WARNING', code: 'UNSUPPORTED_SOURCE_MODEL', message }); };
  if (container.segments.length > 1) partial(`${container.segments.length - 1} additional SAV segments are preserved; their electrical meaning is not implemented.`);
  // Preserve opaque segment content separately, without passing it off as decoded equipment.
  if (container.segments.length > 1) model.sourceTables.ADDITIONAL_SEGMENTS = container.segments.slice(1).map((segment, index) => ({ number: container.segmentInfo[index + 1].number, bytes: Array.from(segment) }));
  if (decoded.tail.bytes.length && !decoded.tail.recognizedEmptyExtension) partial(`SAV extension tail (${decoded.tail.bytes.length} bytes) is retained but not electrically interpreted.`);

  const busCount = count('Numbus');
  const packed = Array.from({ length: busCount }, (_, i) => int('Numbus', i));
  const hasSections = packed.some(id => id % 1000 !== 0);
  const external = packed.map(id => Math.trunc(id / 1000));
  const busKeys = packed.map((id, i) => hasSections ? id : external[i]);
  model.case.busConnectionKeyEncoding = hasSections ? 'source packed Numbus = 1000 * external bus number + section' : 'external bus number';
  const bus = (internal: number, optionalZero = false): number => {
    if (!internal && optionalZero) return 0;
    const index = Math.abs(integer(internal)) - 1;
    if (index < 0 || index >= busCount) throw Error(`SAV_MISSING_BUS_POINTER: ${internal}`);
    return busKeys[index];
  };
  const externalBus = (internal: number, optionalZero = false): number => {
    if (!internal && optionalZero) return 0;
    bus(internal);
    return external[Math.abs(internal) - 1];
  };
  const identity = (internal: number): string => {
    bus(internal);
    const index = Math.abs(internal) - 1, section = packed[index] % 1000;
    return section ? `${external[index]}:${section}` : String(external[index]);
  };
  const lookup = (field: string, index: number, allowZero = false): number => {
    if (!index && allowZero) return 0;
    return int(field, Math.abs(index) - 1);
  };
  const busRecords: PsseEquipment[] = [];
  for (let i = 0; i < busCount; i++) {
    const voltageField = arrays.Dblvlt ? 'Dblvlt' : 'Volt';
    const [vr, vi] = complex(voltageField, i), vm = Math.hypot(vr, vi), va = Math.atan2(vi, vr) * 180 / Math.PI;
    const ide = Math.abs(int('Jcode', i));
    const fields: SourceRow = { savIndex: i + 1, ibus: external[i], section: packed[i] % 1000, connectionKey: busKeys[i], packedNumbus: packed[i], name: label('Busnam', i, 12), baskv: num('Basvlt', i), ide, savedJcode: int('Jcode', i), originalJcode: maybe('Orgjcode', i), area: lookup('Numare', int('Iarea', i)), zone: lookup('Numzon', int('Loszon', i)), owner: lookup('Numown', int('Iowner', i)), vm, va, nvhi: num('Nvlmhi', i), nvlo: num('Nvlmlo', i), evhi: num('Evlmhi', i), evlo: num('Evlmlo', i), sourceVoltage: [vr, vi], originalBusIndex: int('Origbus', i) };
    const station = maybe('Bussts', i);
    if (station) fields.isub = lookup('Stsnum', station);
    busRecords.push(addEquipment(model, 'bus', identity(i + 1), fields, [busKeys[i]], ide === 4 ? 0 : 1, String(fields.name), { vm: op(vm, voltageField, i, 'pu', true), va: op(va, voltageField, i, 'deg', true) }));
  }

  /** Return owning root index of every record, rejecting cycles, aliases and orphans. */
  const ownersOf = (firstName: string, nextName: string, roots: number, records: number): number[] => {
    if (count(firstName) !== roots || count(nextName) !== records) throw Error(`SAV_LINK_DIMENSION_MISMATCH: ${firstName}/${nextName}`);
    const owners = new Array<number>(records).fill(-1);
    for (let root = 0; root < roots; root++) {
      let link = int(firstName, root);
      while (link) {
        const index = link - 1;
        if (index < 0 || index >= records) throw Error(`SAV_LINK_OUTSIDE_TABLE: ${nextName} -> ${link}`);
        if (owners[index] !== -1) throw Error(`SAV_LINK_CYCLE_OR_ALIAS: ${nextName}[${link}]`);
        owners[index] = root;
        link = int(nextName, index);
      }
    }
    if (owners.some(owner => owner < 0)) throw Error(`SAV_ORPHAN_RECORD: ${nextName}`);
    return owners;
  };
  const linkedOwners = (firstName: string, nextName: string, numName: string, fractionName: string, record: number) => {
    const result: { owner: number; fraction: number }[] = [], seen = new Set<number>();
    let link = int(firstName, record);
    while (link) {
      if (link < 1 || link > count(nextName) || seen.has(link)) throw Error(`SAV_OWNER_CHAIN_INVALID: ${nextName}`);
      seen.add(link);
      result.push({ owner: lookup('Numown', int(numName, link - 1)), fraction: num(fractionName, link - 1) });
      link = int(nextName, link - 1);
    }
    return result;
  };
  const loadIds: string[] = [], fixedShuntIds: string[] = [], generatorIds: string[] = [], switchedShuntIds: string[] = [];
  const loadCount = count('Ldnext');
  if (loadCount) {
    const owners = ownersOf('Ldfrst', 'Ldnext', busCount, loadCount);
    for (let i = 0; i < loadCount; i++) {
      const owner = owners[i], loadid = text('Loadid', i, 2), pairs = [complex('Cfdlfr', 3 * i), complex('Cfdlfr', 3 * i + 1), complex('Cfdlfr', 3 * i + 2)];
      const fields: SourceRow = { savIndex: i + 1, ibus: external[owner], section: packed[owner] % 1000, connectionKey: busKeys[owner], loadid, stat: int('Ldstat', i), area: lookup('Numare', int('Ldarea', i)), zone: lookup('Numzon', int('Ldzone', i)), owner: lookup('Numown', int('Ldownr', i)), pl: pairs[0][0] * baseMva, ql: pairs[0][1] * baseMva, ip: pairs[1][0] * baseMva, iq: pairs[1][1] * baseMva, yp: pairs[2][0] * baseMva, yq: pairs[2][1] * baseMva, scaleCode: text('Ldconf', i, 1), interruptibleCode: text('Ldintr', i, 1), distributedGenerationPu: complex('Cdgnfr', i), distributedGenerationMode: int('Ldgnfl', i), loadTypeIndex: int('Ildtype', i), name: label('Ldname', i, 40) };
      const operating: PsseEquipment['operating'] = {};
      for (const [key, pair, component] of [['pl', 0, 0], ['ql', 0, 1], ['ip', 1, 0], ['iq', 1, 1], ['yp', 2, 0], ['yq', 2, 1]] as const) operating[key] = op(pairs[pair][component] * baseMva, 'Cfdlfr', 3 * i + pair, component ? 'Mvar' : 'MW', true);
      loadIds[i] = addEquipment(model, 'load', `${identity(owner + 1)}:${loadid}`, fields, [busKeys[owner]], int('Ldstat', i), String(fields.name), operating).id;
    }
  }
  const fixedCount = count('Shnext');
  if (fixedCount) {
    const owners = ownersOf('Shfrst', 'Shnext', busCount, fixedCount);
    for (let i = 0; i < fixedCount; i++) {
      const owner = owners[i], id = text('Shntid', i, 2), [g, b] = complex('Shntgb', i);
      fixedShuntIds[i] = addEquipment(model, 'shunt', `fixed:${identity(owner + 1)}:${id}`, { savIndex: i + 1, subtype: 'fixed', ibus: external[owner], shntid: id, gl: g * baseMva, bl: b * baseMva, stat: int('Shstat', i), zeroSequenceAdmittance: arrays.Shntzr ? complex('Shntzr', i) : null }, [busKeys[owner]], int('Shstat', i), label('Shnnam', i, 40), { gl: op(g * baseMva, 'Shntgb', i, 'MW', true), bl: op(b * baseMva, 'Shntgb', i, 'Mvar', true) }).id;
    }
  }
  const plants = count('Mcfrst'), machines = count('Mcnext');
  if (machines) {
    const plantOwners = new Array<number>(plants).fill(-1);
    for (let i = 0; i < busCount; i++) {
      const plant = int('Genbus', i);
      if (!plant) continue;
      if (plant < 1 || plant > plants || plantOwners[plant - 1] !== -1) throw Error('SAV_INVALID_PLANT_BUS_LINK');
      plantOwners[plant - 1] = i;
    }
    const machinePlants = ownersOf('Mcfrst', 'Mcnext', plants, machines);
    for (let i = 0; i < machines; i++) {
      const plant = machinePlants[i], owner = plantOwners[plant];
      if (owner < 0) throw Error('SAV_GENERATOR_WITHOUT_PLANT_BUS');
      const id = text('Machid', i, 2), [zr, zx] = complex('Zsorce', i), [rt, xt] = complex('Xtran', i);
      const wind = maybe('Wndnum', i), remote = int('Regbus', plant);
      const fields: SourceRow = { savIndex: i + 1, plantIndex: plant + 1, ibus: external[owner], section: packed[owner] % 1000, connectionKey: busKeys[owner], machid: id, pg: num('Pgenmc', i) * baseMva, qg: num('Qgenmc', i) * baseMva, qt: num('Qmaxmc', i) * baseMva, qb: num('Qminmc', i) * baseMva, pt: num('Pmaxmc', i) * baseMva, pb: num('Pminmc', i) * baseMva, vs: num('Vsave', plant), ireg: externalBus(remote, true), regConnectionKey: bus(remote, true), nreg: int('Regnod', plant), mbase: num('Mbase', i), zr, zx, rt, xt, gtap: num('Gentap', i), stat: int('Mxstat', i), rmpct: num('Rempct', plant), baslod: int('Basflg', i), wmod: wind ? num('Wndmod', wind - 1) : 0, wpf: wind ? num('Wndpf', wind - 1) : null, voltageDroopIndex: int('Machdrpcurve', i), owners: linkedOwners('Mcofst', 'Mconxt', 'Mconum', 'Mcopct', i), name: label('Mcname', i, 40) };
      const operating = { pg: op(Number(fields.pg), 'Pgenmc', i, 'MW', true), qg: op(Number(fields.qg), 'Qgenmc', i, 'Mvar', true), vs: op(Number(fields.vs), 'Vsave', plant, 'pu'), status: op(Number(fields.stat), 'Mxstat', i) };
      generatorIds[i] = addEquipment(model, 'generator', `${identity(owner + 1)}:${id}`, fields, [busKeys[owner]], Number(fields.stat), String(fields.name), operating).id;
    }
  }

  const branchCount = count('Ito');
  const branchFrom = ownersOf('Ifirst', 'Inext', busCount, branchCount);
  const branchIds: string[] = new Array(branchCount);
  const transformerBranch = new Array<number>(count('Windrp')).fill(-1);
  const ratingMask = int('Ratselector', 0) & 0xfff;
  const selectedRatings = Array.from({ length: 12 }, (_, i) => i).filter(i => ratingMask & (1 << i));
  if (count('Ratings') !== selectedRatings.length * branchCount) throw Error('SAV_RATING_DIMENSION_MISMATCH');
  const ratings = (index: number) => {
    const result = new Array<number>(12).fill(0);
    selectedRatings.forEach((rating, column) => { result[rating] = num('Ratings', column * branchCount + index); });
    return result;
  };
  const ratingFields = (index: number): SourceRow => Object.fromEntries(ratings(index).map((rating, i) => [`rate${i + 1}`, rating]));
  const ends = (index: number): [number, number] => [branchFrom[index] + 1, int('Ito', index)];
  for (let i = 0; i < branchCount; i++) {
    const [from, to] = ends(i), tap = int('Tapno', i), breaker = maybe('Brkno', i) ?? 0;
    if (tap && breaker) throw Error('SAV_BRANCH_HAS_TRANSFORMER_AND_SWITCH_ID');
    if (tap) {
      const index = Math.abs(tap) - 1;
      if (index < 0 || index >= transformerBranch.length || transformerBranch[index] !== -1) throw Error('SAV_INVALID_TRANSFORMER_BRANCH_LINK');
      transformerBranch[index] = i;
      continue;
    }
    const ckt = text('Numckt', i, 2), [rpu, xpu] = inverseNegativeAdmittance('Gb', i), [gi, bi] = complex('Gbline', 2 * i), [gj, bj] = complex('Gbline', 2 * i + 1), stat = int('Icom', i);
    const fields: SourceRow = { savIndex: i + 1, ibus: externalBus(from), jbus: externalBus(to), ckt, rpu, xpu, bpu: 2 * num('B2s', i), ...ratingFields(i), gi, bi, gj, bj, stat, originalStatus: maybe('Orgicom', i), len: num('Linlen', i), meteredBus: externalBus(int('Imeter', i)), owners: linkedOwners('Lnofst', 'Lnonxt', 'Lnonum', 'Lnopct', i), name: label('Brname', i, 40), ratingMask };
    if (breaker) {
      const index = breaker - 1;
      fields.switchIndex = breaker; fields.nstat = int('Brknst', index); fields.nstatus = fields.nstat; fields.stype = int('Brktyp', index); fields.sourceBrktyp = fields.stype; fields.sourceBrknst = fields.nstat; fields.ratingSetIndex = int('Brkrsetnum', index); fields.rsetnam = Number(fields.ratingSetIndex) ? text('Rsetname', Number(fields.ratingSetIndex) - 1, 40) : '';
      branchIds[i] = addEquipment(model, 'switch', `system:${identity(from)}:${identity(to)}:${ckt}`, fields, [bus(from), bus(to)], stat, label('Brknam', index, 40), { status: op(stat, 'Icom', i) }).id;
    } else branchIds[i] = addEquipment(model, 'line', `${identity(from)}:${identity(to)}:${ckt}`, fields, [bus(from), bus(to)], stat, String(fields.name), { status: op(stat, 'Icom', i) }).id;
  }
  if (transformerBranch.some(index => index < 0)) throw Error('SAV_ORPHAN_TRANSFORMER_WINDING');
  const winding = (index: number) => {
    const branch = transformerBranch[index], [rpu, xpu] = inverseNegativeAdmittance('Gbtran', index);
    return { savIndex: index + 1, branchIndex: branch + 1, ratioPu: num('Windrp', index), secondaryRatioPu: num('Windrs', index), nominalKv: num('Nomvp', index), secondaryNominalKv: num('Nomvs', index), angleDeg: num('Psangl', index) * 180 / Math.PI, sourceAngleRadians: num('Psangl', index), systemResistancePu: rpu, systemReactancePu: xpu, mvaBase: num('Trnbas', index), controlMode: int('Tpnabl', index), controlledBus: externalBus(int('Pqcont', index), true), controlledConnectionKey: bus(int('Pqcont', index), true), controlledBusSign: Math.sign(int('Pqcont', index)), controlledNode: int('Pqcnod', index), sourceRmax: num('Rmax', index), sourceRmin: num('Rmin', index), vmax: num('Vmax', index), vmin: num('Vmin', index), tapPositions: int('Ntapos', index), correctionTable: int('Tablno', index), compensation: complex('Xfrcmp', index), connectionAngle: num('Psalfa', index), packedSourceCodes: int('Iocode', index), vectorGroupCode: int('Vg2idx', index), ratings: ratings(branch) };
  };
  for (let i = 0; i < transformerBranch.length; i++) {
    if ((maybe('Indx3w', i) ?? 0) !== 0) continue;
    const branch = transformerBranch[i], tap = int('Tapno', branch), originalEnds = ends(branch), [from, to] = tap > 0 ? originalEnds : [originalEnds[1], originalEnds[0]];
    const ckt = text('Numckt', branch, 2), w = winding(i), [g1, b1] = complex('Gbline', 2 * branch), [g2, b2] = complex('Gbline', 2 * branch + 1), stat = int('Icom', branch);
    const fields: SourceRow = { savIndex: i + 1, savBranchIndex: branch + 1, ibus: externalBus(from), jbus: externalBus(to), kbus: 0, ckt, cw: 1, cz: 1, cm: 1, mag1: g1 + g2, mag2: b1 + b2, r1_2: w.systemResistancePu, x1_2: w.systemReactancePu, sbase1_2: w.mvaBase, r12Pu: w.systemResistancePu, x12Pu: w.systemReactancePu, windv1: w.ratioPu, windv2: w.secondaryRatioPu, ratio1Pu: w.ratioPu, ratio2Pu: w.secondaryRatioPu, nomv1: w.nominalKv, nomv2: w.secondaryNominalKv, ang1: w.angleDeg, stat, ...ratingFields(branch), windings: [w], originalPackedCodes: w.packedSourceCodes, name: label('Brname', branch, 40), owners: linkedOwners('Lnofst', 'Lnonxt', 'Lnonum', 'Lnopct', branch) };
    w.ratings.forEach((rating, ratingIndex) => { fields[`wdg1rate${ratingIndex + 1}`] = rating; });
    branchIds[branch] = addEquipment(model, 'transformer', `${identity(from)}:${identity(to)}:${ckt}`, fields, [bus(from), bus(to)], stat, String(fields.name), { tap1: op(w.ratioPu, 'Windrp', i, 'pu'), tap2: op(w.secondaryRatioPu, 'Windrs', i, 'pu'), angle1: op(w.angleDeg, 'Psangl', i, 'deg', true), status: op(stat, 'Icom', branch) }).id;
  }
  for (let group = 0; group < count('Icm3wt'); group++) {
    const endpoints = [int('Bus3wt', 4 * group), int('Bus3wt', 4 * group + 1), int('Bus3wt', 4 * group + 2)], star = int('Bus3wt', 4 * group + 3);
    const components = Array.from({ length: transformerBranch.length }, (_, i) => i).filter(i => maybe('Indx3w', i) === group + 1);
    if (components.length !== 3) throw Error('SAV_INCOMPLETE_THREE_WINDING_TRANSFORMER');
    const ordered = endpoints.map(endpoint => {
      const matches = components.filter(index => { const [a, b] = ends(transformerBranch[index]); return (a === endpoint && b === star) || (b === endpoint && a === star); });
      if (matches.length !== 1) throw Error('SAV_THREE_WINDING_TERMINAL_MISMATCH');
      return matches[0];
    });
    const ws = ordered.map(winding), ckt = text('Ckt3wt', group, 2), stat = int('Icm3wt', group);
    const magnetic = components.flatMap(index => { const branch = transformerBranch[index]; return [complex('Gbline', branch * 2), complex('Gbline', branch * 2 + 1)]; });
    const fields: SourceRow = { savIndex: group + 1, subtype: 'three-winding', ibus: externalBus(endpoints[0]), jbus: externalBus(endpoints[1]), kbus: externalBus(endpoints[2]), ckt, cw: 1, cz: 1, cm: 1, stat, mag1: magnetic.reduce((sum, pair) => sum + pair[0], 0), mag2: magnetic.reduce((sum, pair) => sum + pair[1], 0), starBus: externalBus(star), starConnectionKey: bus(star), windings: ws, vectorGroupCode: int('Vg3idx', group) };
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      fields[`r${a + 1}${b + 1}Pu`] = ws[a].systemResistancePu + ws[b].systemResistancePu;
      fields[`x${a + 1}${b + 1}Pu`] = ws[a].systemReactancePu + ws[b].systemReactancePu;
      fields[`r${a + 1}_${b + 1}`] = fields[`r${a + 1}${b + 1}Pu`]; fields[`x${a + 1}_${b + 1}`] = fields[`x${a + 1}${b + 1}Pu`]; fields[`sbase${a + 1}_${b + 1}`] = ws[a].mvaBase;
    }
    const operating: PsseEquipment['operating'] = {};
    ws.forEach((w, index) => { fields[`windv${index + 1}`] = w.ratioPu; fields[`ratio${index + 1}Pu`] = w.ratioPu; fields[`nomv${index + 1}`] = w.nominalKv; fields[`ang${index + 1}`] = w.angleDeg; w.ratings.forEach((rating, ratingIndex) => { fields[`wdg${index + 1}rate${ratingIndex + 1}`] = rating; }); operating[`tap${index + 1}`] = op(w.ratioPu, 'Windrp', ordered[index], 'pu'); operating[`angle${index + 1}`] = op(w.angleDeg, 'Psangl', ordered[index], 'deg', true); });
    const equipment = addEquipment(model, 'transformer', `${endpoints.map(identity).join(':')}:${ckt}`, fields, endpoints.map(endpoint => bus(endpoint)), stat, label('Nam3wt', group, 40), operating);
    components.forEach(index => { branchIds[transformerBranch[index]] = equipment.id; });
    busRecords[star - 1].fields.threeWindingStar = true;
  }

  // Switched shunt controls are packed; preserve the full word and every block.
  if (count('Swnext')) {
    const owners = ownersOf('Swfrst', 'Swnext', busCount, count('Swnext'));
    for (let i = 0; i < owners.length; i++) {
      const owner = owners[i], id = text('Swshid', i, 2), packedMode = int('Swshmd', i), blocks = Array.from({ length: 8 }, (_, j) => ({ steps: int('Nswstp', i * 8 + j), susceptanceMvar: num('Swshnb', i * 8 + j) * baseMva }));
      const fields: SourceRow = { savIndex: i + 1, subtype: 'switched', ibus: external[owner], shntid: id, packedMode, modsw: packedMode & 7, binit: num('Bswich', i) * baseMva, vswhi: num('Vshnhi', i), vswlo: num('Vshnlo', i), swrem: externalBus(int('Swshrm', i), true), swnod: int('Swsnod', i), rmpct: num('Swspct', i), remoteIndex: int('Rmindx', i), blocks };
      switchedShuntIds[i] = addEquipment(model, 'shunt', `switched:${identity(owner + 1)}:${id}`, fields, [busKeys[owner]], null, label('Swshnm', i, 40), { binit: op(Number(fields.binit), 'Bswich', i, 'Mvar', true) }).id;
    }
    partial('Switched-shunt packed status/adjustment and block activation flags are retained but not fully normalized.');
  }

  for (let i = 0; i < count('Stsnum'); i++) {
    const isub = int('Stsnum', i);
    addEquipment(model, 'substation', String(isub), { savIndex: i + 1, isub, lati: num('Stslat', i), long: num('Stslon', i), srg: num('Stsgrd', i), latitude: num('Stslat', i), longitude: num('Stslon', i), earthResistanceOhm: num('Stsgrd', i) }, [], null, label('Stsnam', i, 40));
  }
  const nodeCount = count('Nodnum');
  const nodeIds: string[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const isub = lookup('Stsnum', int('Nodsta', i)), inode = int('Nodnum', i), internal = int('Nodbus', i);
    nodeIds[i] = addEquipment(model, 'node', `${isub}:${inode}`, { savIndex: i + 1, isub, inode, ibus: externalBus(internal, true), busSection: internal ? packed[internal - 1] % 1000 : 0, connectionKey: bus(internal, true), stat: int('Nodcod', i), name: label('Nodnam', i, 40) }, internal ? [bus(internal)] : [], int('Nodcod', i), label('Nodnam', i, 40)).id;
  }
  if (count('Ndsnxt')) {
    const owners = ownersOf('Ndsfst', 'Ndsnxt', nodeCount, count('Ndsnxt'));
    for (let i = 0; i < owners.length; i++) {
      const from = owners[i], to = int('Ndsto', i) - 1;
      if (to < 0 || to >= nodeCount || int('Nodsta', from) !== int('Nodsta', to)) throw Error('SAV_SWITCH_NODE_STATION_MISMATCH');
      const isub = lookup('Stsnum', int('Nodsta', from)), inode = int('Nodnum', from), jnode = int('Nodnum', to), breaker = int('Ibrkno', i) - 1, id = text('Brkckt', i, 2), connections = [int('Nodbus', from), int('Nodbus', to)].filter(Boolean).map(internal => bus(internal));
      addEquipment(model, 'switch', `node:${isub}:${inode}:${jnode}:${id}`, { savIndex: i + 1, isub, inode, jnode, swdid: id, stat: int('Brkcom', i), stype: int('Brktyp', breaker), nstatus: int('Brknst', breaker), xpu: num('Brkrac', i), ratingSetIndex: int('Brkrsetnum', breaker), nodeIds: [nodeIds[from], nodeIds[to]] }, connections, int('Brkcom', i), label('Brknam', breaker, 40), { status: op(int('Brkcom', i), 'Brkcom', i) });
    }
  }
  if (count('Ndtmnx')) {
    const owners = ownersOf('Ndtmfs', 'Ndtmnx', nodeCount, count('Ndtmnx'));
    for (let i = 0; i < owners.length; i++) {
      const node = owners[i], isub = lookup('Stsnum', int('Nodsta', node)), inode = int('Nodnum', node), type = int('Ndtmtyp', i), sequence = int('Ndtmseq', i), internal = int('Nodbus', node);
      const target = type === 1 ? loadIds[sequence - 1] : type === 2 ? generatorIds[sequence - 1] : type === 3 ? fixedShuntIds[sequence - 1] : type === 4 ? switchedShuntIds[sequence - 1] : type === 5 || type === 6 ? branchIds[sequence - 1] : undefined;
      addEquipment(model, 'terminal', `${isub}:${inode}:${type}:${sequence}`, { savIndex: i + 1, isub, inode, type, equipmentSequence: sequence, equipmentId: target ?? null, nodeId: nodeIds[node], sourceEndpoint: type === 5 ? 'from' : type === 6 ? 'to' : null }, internal ? [bus(internal)] : [], null);
      if (!target) partial(`Node terminal ${i + 1} type ${type} retains its source reference; this equipment family is not fully normalized.`);
    }
  }

  // Explicitly retain controls and non-AC families; unsupported control semantics block completeness.
  for (let i = 0; i < count('Vdstatusraw'); i++) {
    const remote = int('Vdregbus', i);
    addEquipment(model, 'other', `voltage-droop:${i + 1}`, { savIndex: i + 1, subtype: 'voltage-droop', regbus: externalBus(remote, true), regConnectionKey: bus(remote, true), qdb: num('Vdqdb', i), qmin: num('Vdqminraw', i), qmax: num('Vdqmaxraw', i), vlow: num('Vdvlowraw', i), vdblow: num('Vddbloraw', i), vdbhigh: num('Vddbhiraw', i), vhigh: num('Vdvhiraw', i), stat: int('Vdstatusraw', i) }, remote ? [bus(remote)] : [], int('Vdstatusraw', i), label('Vdname', i, 40));
  }
  const twoDcNames = ['Mdc', 'Rdc', 'Setval', 'Vsched', 'Vcmode', 'Rcomp', 'Delti', 'Dcvmin', 'Cccitmax', 'Cccacc', 'Nbr', 'Nbi', 'Alfmin', 'Alfmx', 'Gammin', 'Gammx', 'Xcrr', 'Xcir', 'Ebaser', 'Ebasei', 'Trr', 'Tri', 'Tapr', 'Tapi', 'Tapmxr', 'Tapmnr', 'Tstpr', 'Tapmxi', 'Tapmni', 'Tstpi', 'Rcr', 'Rci', 'Xcapr', 'Xcapi', 'Acfrr', 'Actor', 'Acfri', 'Actoi'];
  for (let i = 0; i < count('Mdc'); i++) {
    const from = int('Ipr', i), to = int('Ipi', i), fields: SourceRow = { savIndex: i + 1, subtype: 'two-terminal-dc', ibus: externalBus(from), jbus: externalBus(to) };
    for (const field of twoDcNames) fields[field] = num(field, i);
    addEquipment(model, 'dc', `two-terminal:${i + 1}`, fields, [bus(from), bus(to)], int('Mdc', i) === 0 ? 0 : 1, label('Dc2nam', i, 12), { pacRectifier: op(num('Pacr', i) * baseMva, 'Pacr', i, 'MW', true), qacRectifier: op(num('Qacr', i) * baseMva, 'Qacr', i, 'Mvar', true), pacInverter: op(num('Paci', i) * baseMva, 'Paci', i, 'MW', true), qacInverter: op(num('Qaci', i) * baseMva, 'Qaci', i, 'Mvar', true) });
  }
  if (count('Mdc')) partial('Two-terminal DC records and saved AC P/Q are decoded; converter control semantics require further validation.');
  const vscCount = count('Vscmdc,...') / 6;
  for (let i = 0; i < vscCount; i++) {
    const connections = [num('Vsccnv,...', 2 * i), num('Vsccnv,...', 2 * i + 1)];
    const fields: SourceRow = { savIndex: i + 1, subtype: 'vsc-dc', control: num('Vscmdc,...', i), rdc: num('Vscidc,...', vscCount + i), converters: connections.map((connection, converter) => { const index = 2 * i + converter, stride = 2 * vscCount; return { ibus: externalBus(connection), connectionKey: bus(connection), itype: num('Vsccnv,...', stride + index), mode: num('Vsccnv,...', 2 * stride + index), dcset: num('Vscpac,...', 2 * stride + index), acset: num('Vscpac,...', 3 * stride + index), lossA: num('Vscpac,...', 4 * stride + index), lossB: num('Vscpac,...', 5 * stride + index), lossMin: num('Vscpac,...', 6 * stride + index), smax: num('Vscpac,...', 7 * stride + index), imax: num('Vscpac,...', 8 * stride + index), powerFactor: num('Vscpac,...', 9 * stride + index), qmax: num('Vscpac,...', 10 * stride + index) * baseMva, qmin: num('Vscpac,...', 11 * stride + index) * baseMva, rmpct: num('Vscpac,...', 12 * stride + index) }; }) };
    addEquipment(model, 'dc', `vsc:${i + 1}`, fields, connections.map(connection => bus(connection)), Number(fields.control) === 0 ? 0 : 1, label('Vscnam', i, 12));
  }
  if (vscCount) partial('VSC DC records are decoded with retained converter blocks; converter control semantics require further validation.');
  const multiDcCount = count('Dcmswv');
  for (let i = 0; i < multiDcCount; i++) addEquipment(model, 'dc', `multi-terminal:${i + 1}`, { savIndex: i + 1, subtype: 'multi-terminal-dc', sourceArrays: ['Nconv,...', 'Dcmswv', 'Pac,...', 'Acbus,...', 'Vdc,...', 'Dcarea,...', 'Dcres,...', 'Dcfr,...', 'Dcckt'] }, [], null, label('Mdcnam', i, 12));
  if (multiDcCount) partial('Multi-terminal DC source blocks are preserved; converter/DC bus relationships are not fully normalized.');
  const factsNames = ['Fcstat', 'Vmxmod', 'Fcownr', 'Fcrem', 'Fcordr', 'Fcnode', 'Fcpdes', 'Fcqdes', 'Fcvset', 'Fcvtmx', 'Fcvtmn', 'Trsfmx', 'Fcshmx', 'Fcvmx', 'Fcimx', 'Bseres', 'Fcpct'];
  for (let i = 0; i < count('Fcstat'); i++) {
    const from = int('Fcsbus', i), to = int('Fctbus', i), fields: SourceRow = { savIndex: i + 1, ibus: externalBus(from), jbus: externalBus(to, true) };
    for (const field of factsNames) fields[field] = num(field, i);
    const operating: PsseEquipment['operating'] = {};
    for (const field of ['Fpbrdg', 'Fqshnt', 'Fpsend', 'Fqsend', 'Fpterm', 'Fqterm']) operating[field] = op(num(field, i) * baseMva, field, i, field[1] === 'p' ? 'MW' : 'Mvar', true);
    addEquipment(model, 'facts', String(i + 1), fields, [from, to].filter(Boolean).map(connection => bus(connection)), (int('Fcstat', i) & 0xff) === 0 ? 0 : 1, label('Fcname', i, 12), operating);
  }
  if (count('Fcstat')) partial('FACTS identities, connections, source parameters and saved P/Q are decoded; packed control semantics require further validation.');
  if (count('Imnext')) {
    const owners = ownersOf('Imfrst', 'Imnext', busCount, count('Imnext'));
    for (let i = 0; i < owners.length; i++) {
      const fields: SourceRow = { savIndex: i + 1, subtype: 'induction-machine', ibus: external[owners[i]] };
      for (const [field, array] of Object.entries(arrays)) if (field.startsWith('Im') && array.count === owners.length && array.type !== 'CHAR') fields[field] = array.values[i];
      addEquipment(model, 'other', `induction:${i + 1}`, fields, [busKeys[owners[i]]], null, label('Imname', i, 40));
    }
    partial('Induction-machine source records are retained; packed status and dynamic electrical interpretation require further validation.');
  }
  if (count('gnstat')) partial('Generic-network-equivalent source arrays are retained but their arbitrary model equations are not implemented.');
  model.case.savedEquipmentCounts = Object.fromEntries(['bus', 'line', 'transformer', 'generator', 'load', 'shunt', 'switch', 'node', 'terminal', 'dc', 'facts', 'substation'].map(kind => [kind, model.equipment.filter(e => e.kind === kind).length]));
  model.timing.decodeMs = performance.now() - started;
  return model;
}
