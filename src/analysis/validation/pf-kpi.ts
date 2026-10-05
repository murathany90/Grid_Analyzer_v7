import type { CalculationResult } from '../../domain/results/types';

/**
 * Canonical PowerFactory merge KPI definitions.
 *
 * This module is the single implementation of the six merge KPIs. Release reports,
 * the README tables and the merge decision must all consume `computePowerFactoryKpis`
 * so that no document can quote a differently computed number.
 *
 * Formula (per KPI, over the >= 66 kV equipment population only):
 *   observation error_i = abs( abs(GA_i) - abs(PF_i) )
 *   absoluteAverage     = sum(error_i) / N
 *   normalizedPercent   = 100 * sum(error_i) / sum(abs(PF_i))
 *
 * `abs(GA - PF)`, row-wise MAPE and averages of row percentages are deliberately
 * NOT used as the primary KPI.
 */

export const MIN_KPI_NOMINAL_KV = 66;

export type PfKpiId =
  | 'lineActivePowerMw'
  | 'lineReactivePowerMvar'
  | 'transformerActivePowerMw'
  | 'transformerReactivePowerMvar'
  | 'busVoltageKv'
  | 'busAlignedAngleDeg';

export interface PfKpiObservation {
  /** Stable identity of the compared quantity, e.g. `line:H2484:pFrom`. */
  observationId: string;
  gaValue: number;
  pfValue: number;
}

export interface PfKpiResult {
  id: PfKpiId;
  label: string;
  unit: string;
  n: number;
  sumAbsoluteError: number;
  sumAbsoluteReference: number;
  absoluteAverage: number;
  normalizedPercent: number;
}

export interface PfKpiSecondaryDiagnostics {
  id: PfKpiId;
  unit: string;
  /** sum(GA - PF) / N. Signed bias of the compared quantity. */
  signedMeanError: number;
  signedSumError: number;
  signedMaxAbsoluteError: number;
  /** Observations where a material GA value has the opposite sign of a material PF value. */
  signDisagreementCount: number;
  /** Observations where both sides were material enough to compare signs. */
  signComparableCount: number;
  p95AbsoluteError: number;
  maxAbsoluteError: number;
}

export interface PfKpiReport {
  minimumNominalKv: number;
  kpis: PfKpiResult[];
  secondary: PfKpiSecondaryDiagnostics[];
  population: {
    lineCount: number;
    lineObservationCount: number;
    transformerCount: number;
    transformerObservationCount: number;
    busCount: number;
    busObservationCount: number;
    linesBelowThreshold: number;
    transformersBelowThreshold: number;
    busesBelowThreshold: number;
    /** Comparability guard: a changed signature invalidates a merge comparison. */
    populationSignature: string;
  };
  alignment: {
    islandsAligned: number;
    islandsWithPowerFactoryReferenceBus: number;
    islandsWithoutPowerFactoryReferenceBus: number;
    method: string;
    offsetDeg: Array<{ islandId: string; offsetDeg: number; source: 'POWERFACTORY_REFERENCE_BUS' | 'MEDIAN_FALLBACK' }>;
  };
  unmatched: {
    powerFactoryLines: number;
    powerFactoryTransformers: number;
    powerFactoryBusGroups: number;
    gridAnalyzerBranches: number;
    gridAnalyzerBuses: number;
  };
}

export const PF_KPI_IDS: readonly PfKpiId[] = [
  'lineActivePowerMw',
  'lineReactivePowerMvar',
  'transformerActivePowerMw',
  'transformerReactivePowerMvar',
  'busVoltageKv',
  'busAlignedAngleDeg',
];

const KPI_META: Record<PfKpiId, { label: string; unit: string }> = {
  lineActivePowerMw: { label: 'Line active power', unit: 'MW' },
  lineReactivePowerMvar: { label: 'Line reactive power', unit: 'MVAr' },
  transformerActivePowerMw: { label: 'Transformer active power', unit: 'MW' },
  transformerReactivePowerMvar: { label: 'Transformer reactive power', unit: 'MVAr' },
  busVoltageKv: { label: 'Bus voltage', unit: 'kV' },
  busAlignedAngleDeg: { label: 'Reference-aligned bus angle magnitude', unit: 'deg' },
};

/** Values below this magnitude are treated as noise when comparing signs. */
const SIGN_MATERIALITY_FLOOR: Record<PfKpiId, number> = {
  lineActivePowerMw: 1e-6,
  lineReactivePowerMvar: 1e-6,
  transformerActivePowerMw: 1e-6,
  transformerReactivePowerMvar: 1e-6,
  busVoltageKv: 1e-6,
  busAlignedAngleDeg: 1e-6,
};

/** A bus group whose reference kV values disagree by more than this is not comparable. */
export const BUS_VOLTAGE_KV_CONSISTENCY_TOLERANCE = 1e-5;
/** A bus group whose reference angles disagree by more than this (deg) is not comparable. */
export const BUS_ANGLE_DEG_CONSISTENCY_TOLERANCE = 1e-6;

/** Pure KPI math for one metric. Exported so unit tests can pin the formula. */
export function scoreKpi(
  id: PfKpiId,
  observations: readonly Pick<PfKpiObservation, 'gaValue' | 'pfValue'>[],
): PfKpiResult {
  let sumAbsoluteError = 0;
  let sumAbsoluteReference = 0;
  for (const observation of observations) {
    sumAbsoluteError += Math.abs(Math.abs(observation.gaValue) - Math.abs(observation.pfValue));
    sumAbsoluteReference += Math.abs(observation.pfValue);
  }
  const count = observations.length;
  return {
    id,
    label: KPI_META[id].label,
    unit: KPI_META[id].unit,
    n: count,
    sumAbsoluteError,
    sumAbsoluteReference,
    absoluteAverage: count ? sumAbsoluteError / count : 0,
    normalizedPercent: sumAbsoluteReference > 0 ? (100 * sumAbsoluteError) / sumAbsoluteReference : 0,
  };
}

export function scoreKpiSecondary(
  id: PfKpiId,
  observations: readonly Pick<PfKpiObservation, 'gaValue' | 'pfValue'>[],
): PfKpiSecondaryDiagnostics {
  const floor = SIGN_MATERIALITY_FLOOR[id];
  let signedSumError = 0;
  let signedMaxAbsoluteError = 0;
  let signDisagreementCount = 0;
  let signComparableCount = 0;
  const absoluteErrors: number[] = [];
  for (const observation of observations) {
    const signed = observation.gaValue - observation.pfValue;
    signedSumError += signed;
    signedMaxAbsoluteError = Math.max(signedMaxAbsoluteError, Math.abs(signed));
    absoluteErrors.push(Math.abs(signed));
    if (Math.abs(observation.gaValue) > floor && Math.abs(observation.pfValue) > floor) {
      signComparableCount += 1;
      if (Math.sign(observation.gaValue) !== Math.sign(observation.pfValue)) signDisagreementCount += 1;
    }
  }
  const sorted = [...absoluteErrors].sort((a, b) => a - b);
  const at = sorted.length ? (sorted.length - 1) * 0.95 : 0;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return {
    id,
    unit: KPI_META[id].unit,
    signedMeanError: observations.length ? signedSumError / observations.length : 0,
    signedSumError,
    signedMaxAbsoluteError,
    signDisagreementCount,
    signComparableCount,
    p95AbsoluteError: sorted.length ? sorted[low] + (sorted[high] - sorted[low]) * (at - low) : 0,
    maxAbsoluteError: sorted.length ? sorted[sorted.length - 1] : 0,
  };
}

export interface PowerFactoryNumericRow {
  kind: string;
  fid: string;
  electricalBusKey?: string;
  nominalKv?: number;
  voltageKv?: number;
  angleDeg?: number;
  isReferenceBus?: string;
  fromVoltageKv?: number;
  toVoltageKv?: number;
  pFromMw?: number;
  qFromMvar?: number;
  pToMw?: number;
  qToMvar?: number;
  pHvMw?: number;
  qHvMvar?: number;
  pLvMw?: number;
  qLvMvar?: number;
  pResultMw?: number;
  qResultMvar?: number;
  resultAvailable?: string;
}

export interface PowerFactoryKpiInput {
  rows: readonly PowerFactoryNumericRow[];
  result: CalculationResult;
  minimumNominalKv?: number;
}

/** Returns the shared reference value, or null when the group disagrees beyond tolerance. */
function consistentValue(values: readonly number[], tolerance: number): number | null {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min > tolerance) return null;
  return values[0];
}

interface AngleCandidate {
  islandId: string;
  gaAngleDeg: number;
  pfAngleDeg: number;
  isPowerFactoryReference: boolean;
}

interface MutableKpiBuckets {
  lineActivePowerMw: PfKpiObservation[];
  lineReactivePowerMvar: PfKpiObservation[];
  transformerActivePowerMw: PfKpiObservation[];
  transformerReactivePowerMvar: PfKpiObservation[];
  busVoltageKv: PfKpiObservation[];
  busAlignedAngleDeg: PfKpiObservation[];
}

export function computePowerFactoryKpis(input: PowerFactoryKpiInput): PfKpiReport {
  const minimumNominalKv = input.minimumNominalKv ?? MIN_KPI_NOMINAL_KV;
  const gaBuses = input.result?.buses ?? [];
  const gaBranches = input.result?.branches ?? [];

  const gaBusByAlias = new Map<string, (typeof gaBuses)[number]>();
  for (const bus of gaBuses) {
    if (!gaBusByAlias.has(bus.id)) gaBusByAlias.set(bus.id, bus);
    for (const term of bus.terms ?? []) if (!gaBusByAlias.has(term)) gaBusByAlias.set(term, bus);
  }
  const gaBranchByFid = new Map<string, (typeof gaBranches)[number]>();
  for (const branch of gaBranches) gaBranchByFid.set(branch.id, branch);

  const buckets: MutableKpiBuckets = {
    lineActivePowerMw: [],
    lineReactivePowerMvar: [],
    transformerActivePowerMw: [],
    transformerReactivePowerMvar: [],
    busVoltageKv: [],
    busAlignedAngleDeg: [],
  };
  const add = (
    id: PfKpiId,
    observationId: string,
    gaValue: number | undefined,
    pfValue: number | undefined,
  ) => {
    if (gaValue === undefined || pfValue === undefined) return;
    buckets[id].push({ observationId, gaValue, pfValue });
  };

  const busGroups = new Map<string, PowerFactoryNumericRow[]>();
  let unmatchedLines = 0;
  let unmatchedTransformers = 0;
  let unmatchedBusGroups = 0;
  let linesBelow = 0;
  let transformersBelow = 0;
  let busesBelow = 0;
  let lineCount = 0;
  let transformerCount = 0;

  for (const row of input.rows) {
    if (row.resultAvailable !== '1') continue;
    if (row.kind === 'line') {
      if (row.fromVoltageKv === undefined || row.fromVoltageKv < minimumNominalKv) {
        linesBelow += 1;
        continue;
      }
      const branch = gaBranchByFid.get(row.fid);
      if (!branch) {
        unmatchedLines += 1;
        continue;
      }
      lineCount += 1;
      add('lineActivePowerMw', `line:${row.fid}:pFrom`, branch.pf, row.pFromMw);
      add('lineActivePowerMw', `line:${row.fid}:pTo`, branch.pt, row.pToMw);
      add('lineReactivePowerMvar', `line:${row.fid}:qFrom`, branch.qf, row.qFromMvar);
      add('lineReactivePowerMvar', `line:${row.fid}:qTo`, branch.qt, row.qToMvar);
    } else if (row.kind === 'transformer') {
      if (row.fromVoltageKv === undefined || row.fromVoltageKv < minimumNominalKv) {
        transformersBelow += 1;
        continue;
      }
      const branch = gaBranchByFid.get(row.fid);
      if (!branch) {
        unmatchedTransformers += 1;
        continue;
      }
      transformerCount += 1;
      add('transformerActivePowerMw', `transformer:${row.fid}:pHv`, branch.pf, row.pHvMw);
      add('transformerActivePowerMw', `transformer:${row.fid}:pLv`, branch.pt, row.pLvMw);
      add('transformerReactivePowerMvar', `transformer:${row.fid}:qHv`, branch.qf, row.qHvMvar);
      add('transformerReactivePowerMvar', `transformer:${row.fid}:qLv`, branch.qt, row.qLvMvar);
    } else if (row.kind === 'bus') {
      if (row.nominalKv === undefined || row.nominalKv < minimumNominalKv) {
        busesBelow += 1;
        continue;
      }
      const key = row.electricalBusKey;
      if (!key) continue;
      const group = busGroups.get(key);
      if (group) group.push(row);
      else busGroups.set(key, [row]);
    }
  }

  let voltageBusCount = 0;
  let angleBusCount = 0;
  const angleCandidates: AngleCandidate[] = [];

  for (const [key, group] of busGroups) {
    const gaBus = gaBusByAlias.get(key);
    if (!gaBus) {
      unmatchedBusGroups += 1;
      continue;
    }
    const voltages = group
      .map(row => row.voltageKv)
      .filter((value): value is number => value !== undefined);
    const referenceVoltage = consistentValue(voltages, BUS_VOLTAGE_KV_CONSISTENCY_TOLERANCE);
    if (referenceVoltage !== null) {
      voltageBusCount += 1;
      add('busVoltageKv', `bus:${key}:voltageKv`, gaBus.vmPu * gaBus.vnKv, referenceVoltage);
    }
    const angles = group
      .map(row => row.angleDeg)
      .filter((value): value is number => value !== undefined);
    const referenceAngle = consistentValue(angles, BUS_ANGLE_DEG_CONSISTENCY_TOLERANCE);
    if (referenceAngle !== null) {
      angleBusCount += 1;
      angleCandidates.push({
        islandId: gaBus.islandId ?? 'unknown',
        gaAngleDeg: (gaBus.angleRad * 180) / Math.PI,
        pfAngleDeg: referenceAngle,
        isPowerFactoryReference: group.some(row => row.isReferenceBus === '1'),
      });
    }
  }

  // Reference-angle alignment, applied before the angle KPI: each island is rotated onto
  // its PowerFactory reference bus angle. Islands without a PowerFactory reference bus use
  // the median offset, which is reported rather than silently applied.
  const candidatesByIsland = new Map<string, AngleCandidate[]>();
  for (const candidate of angleCandidates) {
    const list = candidatesByIsland.get(candidate.islandId);
    if (list) list.push(candidate);
    else candidatesByIsland.set(candidate.islandId, [candidate]);
  }
  const offsets = new Map<string, number>();
  const offsetDeg: PfKpiReport['alignment']['offsetDeg'] = [];
  let islandsWithPowerFactoryReferenceBus = 0;
  for (const [islandId, candidates] of candidatesByIsland) {
    const reference = candidates.find(candidate => candidate.isPowerFactoryReference);
    if (reference) {
      islandsWithPowerFactoryReferenceBus += 1;
      const offset = reference.pfAngleDeg - reference.gaAngleDeg;
      offsets.set(islandId, offset);
      offsetDeg.push({ islandId, offsetDeg: offset, source: 'POWERFACTORY_REFERENCE_BUS' });
    } else {
      const residuals = candidates
        .map(candidate => candidate.pfAngleDeg - candidate.gaAngleDeg)
        .sort((a, b) => a - b);
      const offset = residuals[Math.floor(residuals.length / 2)] ?? 0;
      offsets.set(islandId, offset);
      offsetDeg.push({ islandId, offsetDeg: offset, source: 'MEDIAN_FALLBACK' });
    }
  }
  for (const candidate of angleCandidates) {
    add(
      'busAlignedAngleDeg',
      `bus:${candidate.islandId}:${candidate.gaAngleDeg}:alignedAngleDeg`,
      candidate.gaAngleDeg + (offsets.get(candidate.islandId) ?? 0),
      candidate.pfAngleDeg,
    );
  }

  const kpis = PF_KPI_IDS.map(id => scoreKpi(id, buckets[id]));
  const secondary = PF_KPI_IDS.map(id => scoreKpiSecondary(id, buckets[id]));
  const populationSignature = [
    `minKv=${minimumNominalKv}`,
    `lines=${lineCount}`,
    `transformers=${transformerCount}`,
    `busesVoltage=${voltageBusCount}`,
    `busesAngle=${angleBusCount}`,
    `lineP=${buckets.lineActivePowerMw.length}`,
    `lineQ=${buckets.lineReactivePowerMvar.length}`,
    `trafoP=${buckets.transformerActivePowerMw.length}`,
    `trafoQ=${buckets.transformerReactivePowerMvar.length}`,
  ].join('|');

  return {
    minimumNominalKv,
    kpis,
    secondary,
    population: {
      lineCount,
      lineObservationCount: buckets.lineActivePowerMw.length,
      transformerCount,
      transformerObservationCount: buckets.transformerActivePowerMw.length,
      busCount: voltageBusCount,
      busObservationCount: buckets.busVoltageKv.length,
      linesBelowThreshold: linesBelow,
      transformersBelowThreshold: transformersBelow,
      busesBelowThreshold: busesBelow,
      populationSignature,
    },
    alignment: {
      islandsAligned: candidatesByIsland.size,
      islandsWithPowerFactoryReferenceBus,
      islandsWithoutPowerFactoryReferenceBus: candidatesByIsland.size - islandsWithPowerFactoryReferenceBus,
      method: 'PER_ISLAND_POWERFACTORY_REFERENCE_BUS_OFFSET',
      offsetDeg,
    },
    unmatched: {
      powerFactoryLines: unmatchedLines,
      powerFactoryTransformers: unmatchedTransformers,
      powerFactoryBusGroups: unmatchedBusGroups,
      gridAnalyzerBranches: gaBranches.length,
      gridAnalyzerBuses: gaBuses.length,
    },
  };
}

/** Relative change of a normalized KPI in percent; negative means improvement. */
export function kpiImprovementPercent(baseline: PfKpiResult, candidate: PfKpiResult): number | null {
  if (!(baseline.normalizedPercent > 0)) return null;
  return (100 * (candidate.normalizedPercent - baseline.normalizedPercent)) / baseline.normalizedPercent;
}
