import { seasonalReference } from './seasonal-reference';
import type { Line } from './network';
import type { CalculationResult } from '../results/types';

export type CapacitySeason = 'nominal' | 'summer' | 'winter' | 'operational';
export interface ManualSeasonalCapacity { readonly summer: number; readonly winter: number }
export interface CapacitySourceRef { readonly sourceClass: string; readonly sourceId: string; readonly field: string; readonly unit?: string }

export interface CapacitySection {
  readonly id: string | null;
  readonly typeId: string | null;
  readonly conductor: string | null;
  readonly index: number;
  readonly rawCurrentKA: number | null;
  readonly sectionFactor: number | null;
  readonly lineFactor: number | null;
  readonly appliedFactor: number | null;
  readonly nominalCurrentKA: number | null;
  readonly nominalMVA: number | null;
  readonly supported: boolean;
  readonly unsupportedReasons: readonly string[];
  readonly sourceRefs: readonly CapacitySourceRef[];
}

export interface SeasonalCapacityReference {
  readonly name: string;
  readonly voltageKv: number;
  readonly stationA: string;
  readonly stationB: string;
  readonly summerMVA: number | null;
  readonly winterMVA: number | null;
  readonly operationalCandidateMVA: number | null;
  readonly matched: boolean;
  readonly reason: string;
}

export interface LineCapacityMetadata {
  readonly quality: 'CAPACITY_UNAVAILABLE' | 'SECTION_LIMITED' | 'DGS_MAIN_TYPE';
  readonly typeId: string | null;
  readonly typeName: string | null;
  readonly nominalCurrentKA: number | null;
  readonly nominalMVA: number | null;
  readonly limitingSectionId: string | null;
  readonly sections: readonly CapacitySection[];
  readonly seasonalReference: SeasonalCapacityReference | null;
}

export interface CapacityTypeInput { readonly id: string | null; readonly name?: unknown; readonly sline?: unknown }
export interface CapacitySectionInput {
  readonly id: string | null;
  readonly type: CapacityTypeInput | null;
  readonly factor: unknown;
  readonly index: number;
  readonly factorSourceClass: 'ElmLne' | 'ElmLnesec';
  readonly factorSourceId: string;
}

export interface CapacityLimit {
  readonly currentKA: number;
  readonly mva: number | null;
  readonly source: string;
  readonly season: CapacitySeason;
  readonly sectionId: string | null;
}

export interface CapacityLoading {
  readonly percent: number;
  readonly currentKA: number;
  readonly amp: number;
  readonly pMW: number | null;
  readonly qMvar: number | null;
  readonly terminal: 'from' | 'to';
  readonly quality: 'SOLVED_TERMINAL_VOLTAGE' | 'DIRECT_TERMINAL_VOLTAGE';
  readonly capacityMVA: number | null;
  readonly source: string;
  readonly season: CapacitySeason;
}

/**
 * Manual overrides and the selected limit are session state, indexed by model
 * hash so loading another model cannot accidentally reuse a line FID override.
 * Mutate through the functions below so presentation caches can use revision.
 */
export interface CapacitySession {
  readonly modelHash: string;
  season: CapacitySeason;
  readonly manual: Map<string, ManualSeasonalCapacity>;
  revision: number;
}

const capacitySessions = new Map<string, CapacitySession>();

export function capacitySession(modelHash: string): CapacitySession {
  let session = capacitySessions.get(modelHash);
  if (!session) {
    session = { modelHash, season: 'nominal', manual: new Map(), revision: 0 };
    capacitySessions.set(modelHash, session);
  }
  return session;
}

export function setCapacitySeason(modelHash: string, season: CapacitySeason): CapacitySession {
  const session = capacitySession(modelHash);
  if (session.season !== season) { session.season = season; session.revision++; }
  return session;
}

export function setManualCapacity(modelHash: string, lineId: string, value: ManualSeasonalCapacity): CapacitySession {
  const session = capacitySession(modelHash);
  const previous = session.manual.get(lineId);
  if (!previous || previous.summer !== value.summer || previous.winter !== value.winter) {
    session.manual.set(lineId, { summer: value.summer, winter: value.winter });
    session.revision++;
  }
  return session;
}

export function removeManualCapacity(modelHash: string, lineId: string): CapacitySession {
  const session = capacitySession(modelHash);
  if (session.manual.delete(lineId)) session.revision++;
  return session;
}

const numOrNaN = (value: unknown): number => Number(value);

/** Rebuilds v5.3 capacity metadata from DGS section/type fields and the embedded reference. */
export function buildLineCapacityMetadata(input: {
  id: string;
  voltageKv: number;
  lineFactor: unknown;
  mainType: CapacityTypeInput | null;
  sections: readonly CapacitySectionInput[];
}): LineCapacityMetadata {
  const lineFactor = numOrNaN(input.lineFactor);
  const hasSections = input.sections.length > 0;
  const entries: CapacitySectionInput[] = hasSections ? [...input.sections] : [{
    id: null,
    type: input.mainType,
    factor: input.lineFactor,
    index: 0,
    factorSourceClass: 'ElmLne',
    factorSourceId: input.id,
  }];
  const sections = entries.map((entry): CapacitySection => {
    const rawCurrent = entry.type ? numOrNaN(entry.type.sline) : NaN;
    const sectionFactor = numOrNaN(entry.factor);
    // The legacy formula requires line.fline even for a non-sectioned line, but
    // multiplies it only once there (as the main-line factor).
    const appliedLineFactor = hasSections ? lineFactor : 1;
    const current = rawCurrent > 0 && sectionFactor > 0 && lineFactor > 0
      ? rawCurrent * sectionFactor * appliedLineFactor
      : null;
    const nominalMVA = current && input.voltageKv > 0
      ? Math.sqrt(3) * input.voltageKv * current
      : null;
    const reasons: string[] = [];
    if (!entry.type) reasons.push('Hat tipi çözülemedi.');
    else if (!(rawCurrent > 0)) reasons.push('TypLne.sline pozitif ve sayısal değil.');
    if (!(sectionFactor > 0)) reasons.push(`${entry.factorSourceClass}.fline pozitif ve sayısal değil.`);
    if (!(lineFactor > 0)) reasons.push('ElmLne.fline pozitif ve sayısal değil.');
    if (current !== null && !(input.voltageKv > 0)) reasons.push('Hat gerilimi pozitif değil; MVA hesaplanamadı.');
    const sourceTypeId = entry.type?.id || '';
    const factorField = entry.factorSourceClass === 'ElmLnesec' ? 'fline/index' : 'fline';
    return {
      id: entry.id,
      typeId: entry.type?.id ?? null,
      conductor: entry.type?.name == null || entry.type.name === '' ? null : String(entry.type.name),
      index: entry.index,
      rawCurrentKA: Number.isFinite(rawCurrent) ? rawCurrent : null,
      sectionFactor: Number.isFinite(sectionFactor) ? sectionFactor : null,
      lineFactor: Number.isFinite(lineFactor) ? lineFactor : null,
      appliedFactor: Number.isFinite(sectionFactor * appliedLineFactor) ? sectionFactor * appliedLineFactor : null,
      nominalCurrentKA: current,
      nominalMVA,
      supported: current !== null && nominalMVA !== null,
      unsupportedReasons: reasons,
      sourceRefs: [
        ...(sourceTypeId ? [{ sourceClass: 'TypLne', sourceId: sourceTypeId, field: 'sline', unit: 'kA' }] : []),
        { sourceClass: entry.factorSourceClass, sourceId: entry.factorSourceId, field: factorField },
        { sourceClass: 'ElmLne', sourceId: input.id, field: 'fline' },
      ],
    };
  }).sort((a, b) => a.index - b.index);

  const limiting = sections.filter((section) => (section.nominalCurrentKA ?? 0) > 0)
    .sort((a, b) => (a.nominalCurrentKA ?? 0) - (b.nominalCurrentKA ?? 0))[0] ?? null;
  const nominalCurrentKA = limiting?.nominalCurrentKA ?? null;
  const nominalMVA = limiting?.nominalMVA ?? null;
  const rawReference = seasonalReference[input.id];
  let reference: SeasonalCapacityReference | null = null;
  if (rawReference) {
    const [name, voltageKv, stationA, stationB, summerMVA, winterMVA, operationalCandidateMVA] = rawReference;
    const matched = Number(voltageKv) === Number(input.voltageKv)
      && Number.isFinite(nominalMVA)
      && Math.abs(nominalMVA! - Number(summerMVA)) <= 1;
    reference = {
      name, voltageKv, stationA, stationB, summerMVA, winterMVA, operationalCandidateMVA, matched,
      reason: matched
        ? 'FID + gerilim + nominal/yaz kapasitesi uyumlu'
        : 'FID eşleşti; gerilim/kapasite farklı, mevsimsel kayıt bu model için uygulanmaz',
    };
  }

  return {
    quality: nominalMVA === null ? 'CAPACITY_UNAVAILABLE' : hasSections ? 'SECTION_LIMITED' : 'DGS_MAIN_TYPE',
    typeId: input.mainType?.id ?? null,
    typeName: input.mainType?.name == null || input.mainType.name === '' ? null : String(input.mainType.name),
    nominalCurrentKA,
    nominalMVA,
    limitingSectionId: limiting?.id ?? null,
    sections,
    seasonalReference: reference,
  };
}

export function capacityLimit(
  capacity: LineCapacityMetadata,
  voltageKv: number,
  season: CapacitySeason = 'nominal',
  manual?: ManualSeasonalCapacity,
): CapacityLimit | null {
  if (season === 'nominal') {
    return capacity.nominalCurrentKA != null && capacity.nominalCurrentKA > 0
      ? { currentKA: capacity.nominalCurrentKA, mva: capacity.nominalMVA, source: 'DGS nominal akım · sınırlayıcı kesit', season, sectionId: capacity.limitingSectionId }
      : null;
  }
  const manualMVA = manual?.[season as 'summer' | 'winter'];
  if ((season === 'summer' || season === 'winter') && Number.isFinite(manualMVA) && (manualMVA ?? 0) > 0) {
    if (!(Number.isFinite(voltageKv) && voltageKv > 0)) return null;
    return { currentKA: manualMVA! / (Math.sqrt(3) * voltageKv), mva: manualMVA!, source: 'Kullanıcı MVA parametresi', season, sectionId: null };
  }
  // Legacy v5.3 deliberately never treats its Excel operational candidate as a limit.
  if (season === 'operational') return null;
  const ref = capacity.seasonalReference;
  const mva = season === 'summer' ? ref?.summerMVA : ref?.winterMVA;
  if (!ref?.matched || !(Number.isFinite(mva) && (mva ?? 0) > 0) || !(Number.isFinite(voltageKv) && voltageKv > 0)) return null;
  return {
    currentKA: mva! / (Math.sqrt(3) * voltageKv), mva: mva!,
    source: '315 hatlık Excel envanteri · FID/gerilim/nominal kapasite doğrulandı',
    season, sectionId: capacity.limitingSectionId,
  };
}

export function loadingFromResult(
  lineId: string,
  capacity: LineCapacityMetadata,
  voltageKv: number,
  modelHash: string,
  result: import('../results/types').CalculationResult | null,
  season: CapacitySeason = 'nominal',
  manual?: ManualSeasonalCapacity,
): CapacityLoading | null {
  if (!result?.converged || result.identity.modelHash !== modelHash) return null;
  const limit = capacityLimit(capacity, voltageKv, season, manual);
  if (!limit || !(limit.currentKA > 0 && Number.isFinite(limit.currentKA))) return null;
  const branch = result.branches.find((item) => item.sourceClass === 'ElmLne' && item.id === lineId);
  if (!branch) return null;
  const direct = [
    { terminal: 'from' as const, current: branch.ifA },
    { terminal: 'to' as const, current: branch.itA },
  ].filter((item) => Number.isFinite(item.current) && item.current >= 0);
  let endpoint: { terminal: 'from' | 'to'; current: number; p: number | null; q: number | null; quality: CapacityLoading['quality'] } | null = null;
  if (direct.length) {
    const selected = direct.sort((a, b) => b.current - a.current)[0];
    endpoint = { terminal: selected.terminal, current: selected.current / 1000, p: selected.terminal === 'from' ? branch.pf : branch.pt, q: selected.terminal === 'from' ? branch.qf : branch.qt, quality: 'SOLVED_TERMINAL_VOLTAGE' };
  } else {
    const busById = new Map(result.buses.map((bus) => [bus.id, bus]));
    const candidates = [
      { terminal: 'from' as const, p: branch.pf, q: branch.qf, busId: branch.from },
      { terminal: 'to' as const, p: branch.pt, q: branch.qt, busId: branch.to },
    ].flatMap((item) => {
      const bus = busById.get(item.busId), voltage = bus ? bus.vmPu * bus.vnKv : NaN;
      if (!(Number.isFinite(item.p) && Number.isFinite(item.q) && voltage > 0)) return [];
      return [{ ...item, current: Math.hypot(item.p, item.q) / (Math.sqrt(3) * voltage) }];
    }).filter((item) => Number.isFinite(item.current) && item.current >= 0);
    const selected = candidates.sort((a, b) => b.current - a.current)[0];
    if (selected) endpoint = { terminal: selected.terminal, current: selected.current, p: selected.p, q: selected.q, quality: 'DIRECT_TERMINAL_VOLTAGE' };
  }
  if (!endpoint) return null;
  return {
    percent: 100 * endpoint.current / limit.currentKA,
    currentKA: endpoint.current,
    amp: endpoint.current * 1000,
    pMW: endpoint.p,
    qMvar: endpoint.q,
    terminal: endpoint.terminal,
    quality: endpoint.quality,
    capacityMVA: limit.mva,
    source: limit.source,
    season,
  };
}

/** Returns the selected, validated limit using the shared session override. */
export function selectedCapacity(
  line: Pick<Line, 'id' | 'vnKv' | 'capacity'>,
  modelHash: string,
  season: CapacitySeason = capacitySession(modelHash).season,
): CapacityLimit | null {
  return line.capacity ? capacityLimit(line.capacity, line.vnKv, season, capacitySession(modelHash).manual.get(line.id)) : null;
}

/** Computes presented loading from the result endpoints and selected limit. */
export function selectedLineLoading(
  line: Pick<Line, 'id' | 'vnKv' | 'capacity'>,
  modelHash: string,
  result: CalculationResult | null,
  season: CapacitySeason = capacitySession(modelHash).season,
): CapacityLoading | null {
  return line.capacity
    ? loadingFromResult(line.id, line.capacity, line.vnKv, modelHash, result, season, capacitySession(modelHash).manual.get(line.id))
    : null;
}
