import type { SequenceBranch, SequenceSource } from './positive-sequence';
import { factorPositiveSequence } from './positive-sequence';
import type { ElectricalTopology } from '../../topology/electrical-topology';
import type { CanonicalNetwork, Line as CanonicalLine, Transformer2W as CanonicalTransformer } from '../../domain/model/network';
import type { ScSourceContext } from './source-adapter';
/** Physical sequence data accepts explicit zero, never missing, negative or sentinel values. */
const physical = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v !== 99999 && v !== 999999;
const impedance = (r: unknown, x: unknown) => physical(r) && physical(x) && Math.hypot(r, x) > 0;

export interface ScZeroSequenceLine {
  lineId: string;
  r0Ohm: number;
  x0Ohm: number;
}

export interface ScZeroSequenceTransformer {
  transformerId: string;
  vectorGroupHv?: string; // 'YN' | 'Y' | 'D' | 'Z' | 'ZN'
  vectorGroupLv?: string;
  uk0tr?: number; // %
  ur0tr?: number; // %
  x0tor0?: number;
  cneutcon?: number; // 0=none/internal, 1=separate, 2=common
  bushvn?: string | null;
  buslvn?: string | null;
  re0tr_h?: number; // Ohm
  re0tr_l?: number; // Ohm
}

export interface ScZeroSequenceGroundCompensator {
  fid: string;
  bus: string;
  r0Ohm: number;
  x0Ohm: number;
  inService: boolean;
}

export interface ScNegativeSequenceSource {
  fid: string;
  sourceClass: string;
  bus: string;
  r2Ohm: number;
  x2Ohm: number;
}

export interface ScSequenceData {
  lines: Map<string, ScZeroSequenceLine>;
  transformers: Map<string, ScZeroSequenceTransformer>;
  groundCompensators: ScZeroSequenceGroundCompensator[];
  negativeSources: Map<string, ScNegativeSequenceSource>;
  zeroSources: Map<string, { bus: string; r0Ohm: number; x0Ohm: number }>;
}

export interface SequenceImpedanceResult {
  z0Ohm: { re: number; im: number } | null;
  status: 'SOLVED' | 'UNEARTHED' | 'FAILED';
  reason?: string;
}

export interface ZeroSequenceEngine {
  drivingPoint: (busIndex: number) => SequenceImpedanceResult;
  dispose: () => void;
}

export interface NegativeSequenceEngine {
  drivingPoint: (
    busIndex: number,
    posZ?: { re: number; im: number },
    posResidual?: number
  ) => { z2Ohm: { re: number; im: number }; residual: number };
  dispose: () => void;
}

/**
 * Builds and factorizes the Negative-Sequence Network (Z2) on demand per component.
 * Every effective voltage source requires explicit Z2; no source-equality fallback is inferred.
 */
export function buildNegativeSequenceEngine(
  topology: ElectricalTopology,
  network: CanonicalNetwork,
  componentOf: Int32Array,
  components: number[][],
  branches: SequenceBranch[],
  positiveSources: { bus: number; rPu: number; xPu: number; fid: string }[],
  context: ScSourceContext
): NegativeSequenceEngine {
  const zbase = (bus: number) => topology.buses[bus].vnKv ** 2 / network.baseMva;
  const negSourceMap = context.sequenceData?.negativeSources;
  type FactorEntry = {
    factor: ReturnType<typeof factorPositiveSequence>;
    local: Map<number, number>;
  };
  const factorCache = new Map<number, FactorEntry>();

  return {
    drivingPoint: (
      busIndex: number,
      posZ?: { re: number; im: number },
      posResidual = 0
    ) => {
      const cId = componentOf[busIndex];
      if (cId < 0) throw Error('INVALID_BUS_COMPONENT');

      const group = components[cId];
      for (const source of positiveSources.filter(s => componentOf[s.bus] === cId)) {
        const seq = negSourceMap?.get(source.fid);
        if (!seq || !impedance(seq.r2Ohm, seq.x2Ohm)) throw Error(`NOT_COMPUTABLE: MISSING_NEGATIVE_SEQUENCE_SOURCE_MODEL:${source.fid}`);
      }
      let entry = factorCache.get(cId);
      if (!entry) {
        const local = new Map(group.map((b, i) => [b, i]));
        const compBranches = branches
          .filter((b) => componentOf[b.a] === cId)
          .map((b) => ({ ...b, a: local.get(b.a)!, b: local.get(b.b)! }));

        const compSources: SequenceSource[] = [];
        for (const source of positiveSources.filter(s => componentOf[s.bus] === cId)) {
          const neg = negSourceMap!.get(source.fid)!;
          const zb = zbase(source.bus);
          compSources.push({bus: local.get(source.bus)!, rPu: neg.r2Ohm / zb, xPu: neg.x2Ohm / zb});
        }
        const factor = factorPositiveSequence(group.length, compBranches, compSources);
        entry = { factor, local };
        factorCache.set(cId, entry);
      }

      const localIdx = entry.local.get(busIndex)!;
      const solved = entry.factor.drivingPoint(localIdx);
      const zb = zbase(busIndex);
      return {
        z2Ohm: { re: solved.zPu.re * zb, im: solved.zPu.im * zb },
        residual: solved.residual,
      };
    },
    dispose: () => {
      for (const entry of factorCache.values()) entry.factor.dispose();
      factorCache.clear();
    },
  };
}

/**
 * Builds and factorizes the Zero-Sequence Network (Z0).
 * Uses active lines and transformers directly from effectiveNetwork(network, scenario)
 * to respect open lines, opened transformers, switch states, and topology partitioning.
 * No fabricated 3*R1/X1 fallbacks or default YN/D vector groups are assumed.
 * Missing in-service equipment parameters reliably invalidate affected components.
 */
export function buildZeroSequenceEngine(
  n: number,
  topology: ElectricalTopology,
  activeLines: readonly CanonicalLine[],
  activeTransformers: readonly CanonicalTransformer[],
  baseMva: number,
  componentOf: Int32Array,
  components: number[][],
  context: ScSourceContext,
  activeSources: { bus: number; fid: string }[]
): ZeroSequenceEngine {
  const zbase = (bus: number) => topology.buses[bus].vnKv ** 2 / baseMva;
  const seqData = context.sequenceData;

  const z0Branches: SequenceBranch[] = [];
  const z0GroundShunts: SequenceSource[] = [];
  const adj = Array.from({ length: n }, () => [] as number[]);
  const componentMissingZ0 = new Map<number, string>();

  // 1. Lines in zero sequence
  for (const l of activeLines) {
    if (!l.inService || topology.blockedEquipment.has(l.id)) continue;
    const a = topology.terminalToBus.get(l.from);
    const b = topology.terminalToBus.get(l.to);
    if (a === undefined || b === undefined) continue;

    const lineSeq = seqData?.lines.get(l.sourceId);
    // Explicit, verified R0/X0 required; no 3*R1 fallback assumption
    if (!lineSeq || !impedance(lineSeq.r0Ohm, lineSeq.x0Ohm)) {
      const cId = componentOf[a];
      if (cId >= 0 && !componentMissingZ0.has(cId)) {
        componentMissingZ0.set(cId, `NOT_COMPUTABLE: MISSING_ZERO_SEQUENCE_PARAMETERS:line:${l.sourceId}`);
      }
      continue;
    }

    const kv = topology.buses[a].vnKv;
    const base = (kv * kv) / baseMva;
    if (base > 0) {
      z0Branches.push({
        a,
        b,
        rPu: lineSeq.r0Ohm / base,
        xPu: lineSeq.x0Ohm / base,
        tap: 1,
        phaseRad: 0,
      });
      adj[a].push(b);
      adj[b].push(a);
    }
  }

  // 2. Transformers in zero sequence
  const usedNecFids = new Set<string>();
  for (const tr of activeTransformers) {
    if (!tr.inService || topology.blockedEquipment.has(tr.id)) continue;
    const a = topology.terminalToBus.get(tr.from); // HV
    const b = topology.terminalToBus.get(tr.to); // LV
    if (a === undefined || b === undefined) continue;

    const cId = componentOf[a];
    const trSeq = seqData?.transformers.get(tr.sourceId);
    if (!trSeq || !trSeq.vectorGroupHv || !trSeq.vectorGroupLv) {
      if (cId >= 0 && !componentMissingZ0.has(cId)) {
        componentMissingZ0.set(cId, `NOT_COMPUTABLE: MISSING_ZERO_SEQUENCE_TRANSFORMER_VECTOR_GROUP:${tr.sourceId}`);
      }
      continue;
    }

    const vgHv = trSeq.vectorGroupHv.toUpperCase();
    const vgLv = trSeq.vectorGroupLv.toUpperCase();

    // Must have verified zero-sequence short circuit impedance (uk0tr)
    const uk0tr = trSeq.uk0tr;
    const isUk0trValid = Number.isFinite(uk0tr) && (uk0tr ?? 0) > 0 && (uk0tr ?? 0) < 100 && uk0tr !== 99999 && uk0tr !== 999999;
    if (!isUk0trValid) {
      if (cId >= 0 && !componentMissingZ0.has(cId)) {
        componentMissingZ0.set(cId, `NOT_COMPUTABLE: MISSING_ZERO_SEQUENCE_TRANSFORMER_IMPEDANCE:${tr.sourceId}`);
      }
      continue;
    }

    let isHvGrounded = vgHv.includes('N');
    let isLvGrounded = vgLv.includes('N');
    const isHvDelta = vgHv === 'D';
    const isLvDelta = vgLv === 'D';

    // Unknown modes, vector groups or neutral fields must never imply solid grounding.
    const fail = (reason: string) => componentMissingZ0.set(cId, `NOT_COMPUTABLE: ${reason}:${tr.sourceId}`);
    if (![vgHv, vgLv].every(v => ['Y', 'YN', 'D'].includes(v))) { fail('UNSUPPORTED_TRANSFORMER_VECTOR_GROUP'); continue; }
    if (trSeq.cneutcon !== 0 && trSeq.cneutcon !== 1) { fail('UNKNOWN_TRANSFORMER_NEUTRAL_MODE'); continue; }
    if (isHvGrounded && !physical(trSeq.re0tr_h) || isLvGrounded && !physical(trSeq.re0tr_l)) { fail('INVALID_OR_MISSING_TRANSFORMER_NEUTRAL_IMPEDANCE'); continue; }
    const neutral = (ref: string | null | undefined) => seqData?.groundCompensators.find(n => n.inService && (n.bus === ref || n.fid === ref));
    const necHv = trSeq.cneutcon === 1 && isHvGrounded ? neutral(trSeq.bushvn) : undefined;
    const necLv = trSeq.cneutcon === 1 && isLvGrounded ? neutral(trSeq.buslvn) : undefined;
    if (trSeq.cneutcon === 1 && (isHvGrounded && !necHv || isLvGrounded && !necLv)) { fail('AMBIGUOUS_TRANSFORMER_NEUTRAL_CONNECTION'); continue; }
    if ([necHv, necLv].some(n => n && !impedance(n.r0Ohm, n.x0Ohm))) { fail('INVALID_NEUTRAL_COMPENSATOR_IMPEDANCE'); continue; }
    if (necHv) usedNecFids.add(necHv.fid);
    if (necLv) usedNecFids.add(necLv.fid);
    if (!physical(trSeq.ur0tr) || trSeq.ur0tr > uk0tr!) { fail('INVALID_OR_MISSING_ZERO_SEQUENCE_RX_DECOMPOSITION'); continue; }
    // uk0 and ur0 are percentages on the type LV winding base, converted to canonical LV base.
    const scale = baseMva / tr.ratingMva * ((tr.typeLvKv ?? tr.lvKv) / tr.lvKv) ** 2;
    const z0pu = uk0tr! / 100 * scale;
    const r0Pu = trSeq.ur0tr / 100 * scale;
    const x0Pu = Math.sqrt(Math.max(0, z0pu ** 2 - r0Pu ** 2));
    const neutralRatio = tr.typeHvKv && tr.typeLvKv && tr.vnKv && tr.lvKv ? (tr.typeHvKv / tr.vnKv) / (tr.typeLvKv / tr.lvKv) : 1;
    const reHvPu = (3 * (trSeq.re0tr_h ?? 0) + (necHv?.r0Ohm ?? 0)) / zbase(a);
    const reLvPu = (3 * (trSeq.re0tr_l ?? 0) + (necLv?.r0Ohm ?? 0)) / zbase(b);
    const xeHvPu = (necHv?.x0Ohm ?? 0) / zbase(a);
    const xeLvPu = (necLv?.x0Ohm ?? 0) / zbase(b);

    // A. YN / d (or YN / D): Grounded star on HV, delta on LV
    if (isHvGrounded && isLvDelta) {
      const shuntR = r0Pu * neutralRatio ** 2 + reHvPu;
      const shuntX = x0Pu * neutralRatio ** 2 + xeHvPu;
      if (shuntX > 0 || shuntR > 0) {
        z0GroundShunts.push({ bus: a, rPu: shuntR, xPu: shuntX });
      }
    }
    // B. d / YN (or D / YN): Delta on HV, grounded star on LV
    else if (isHvDelta && isLvGrounded) {
      const shuntR = r0Pu + reLvPu;
      const shuntX = x0Pu + xeLvPu;
      if (shuntX > 0 || shuntR > 0) {
        z0GroundShunts.push({ bus: b, rPu: shuntR, xPu: shuntX });
      }
    }
    // C. YN / YN (or YN / yn): Grounded star on both sides (series transmission)
    else if (isHvGrounded && isLvGrounded) {
      const seriesR = r0Pu + reHvPu / neutralRatio ** 2 + reLvPu;
      const seriesX = x0Pu + xeHvPu / neutralRatio ** 2 + xeLvPu;

      if (seriesX > 0 || seriesR > 0) {
        z0Branches.push({
          a,
          b,
          rPu: seriesR,
          xPu: seriesX,
          tap: neutralRatio,
          phaseRad: 0,
        });
        adj[a].push(b);
        adj[b].push(a);
      }
    }
    // D. Ungrounded star or delta-delta: no zero sequence connection
  }

  // 3. ElmNec (Neutral earthing compensators / grounding transformers connected directly to buses)
  // Supports pure resistive earthing (R0 > 0, X0 = 0) as well as reactive
  if (seqData?.groundCompensators) {
    for (const nec of seqData.groundCompensators) {
      if (!nec.inService || usedNecFids.has(nec.fid)) continue;
      const busIdx = topology.terminalToBus.get(nec.bus);
      if (busIdx === undefined) continue;

      const zb = zbase(busIdx);
      if (!impedance(nec.r0Ohm, nec.x0Ohm)) { componentMissingZ0.set(componentOf[busIdx], `NOT_COMPUTABLE: INVALID_NEUTRAL_COMPENSATOR_IMPEDANCE:${nec.fid}`); continue; }
      if (zb > 0 && (nec.x0Ohm > 0 || nec.r0Ohm > 0) && Math.hypot(nec.r0Ohm, nec.x0Ohm) > 0) {
        z0GroundShunts.push({
          bus: busIdx,
          rPu: nec.r0Ohm / zb,
          xPu: nec.x0Ohm / zb,
        });
      }
    }
  }

  // 4. ElmVac / Grounded Voltage Sources (supports pure resistive R0 > 0, X0 = 0)
  if (seqData?.zeroSources) {
    for (const [fid, s] of seqData.zeroSources) {
      if (!activeSources.some(source => source.fid === fid)) continue;
      const busIdx = topology.terminalToBus.get(s.bus);
      if (busIdx === undefined) continue;
      const zb = zbase(busIdx);
      if (zb > 0 && (s.x0Ohm > 0 || s.r0Ohm > 0) && Math.hypot(s.r0Ohm, s.x0Ohm) > 0) {
        z0GroundShunts.push({
          bus: busIdx,
          rPu: s.r0Ohm / zb,
          xPu: s.x0Ohm / zb,
        });
      }
    }
  }

  // 5. Partition zero-sequence graph into connected components
  const z0ComponentOf = new Int32Array(n).fill(-1);
  const z0Components: number[][] = [];

  for (let root = 0; root < n; root++) {
    if (z0ComponentOf[root] < 0) {
      const group: number[] = [];
      const id = z0Components.length;
      const stack = [root];
      z0ComponentOf[root] = id;
      while (stack.length) {
        const u = stack.pop()!;
        group.push(u);
        for (const v of adj[u]) {
          if (z0ComponentOf[v] < 0) {
            z0ComponentOf[v] = id;
            stack.push(v);
          }
        }
      }
      z0Components.push(group);
    }
  }

  // Determine which components have at least one ground shunt
  const componentGrounded = new Uint8Array(z0Components.length);
  for (const s of z0GroundShunts) {
    const cId = z0ComponentOf[s.bus];
    if (cId >= 0) componentGrounded[cId] = 1;
  }

  // Factorize only grounded components
  type Z0FactorEntry = {
    factor: ReturnType<typeof factorPositiveSequence>;
    local: Map<number, number>;
  };
  const factorCache = new Map<number, Z0FactorEntry>();

  return {
    drivingPoint: (busIndex: number): SequenceImpedanceResult => {
      const posCId = componentOf[busIndex];
      if (posCId < 0) {
        return {
          z0Ohm: null,
          status: 'FAILED',
          reason: 'INVALID_BUS_COMPONENT',
        };
      }

      for (const source of activeSources.filter(s => componentOf[s.bus] === posCId)) {
        const seq = seqData?.zeroSources.get(source.fid);
        if (!seq || !impedance(seq.r0Ohm, seq.x0Ohm)) return {z0Ohm: null, status: 'FAILED', reason: `NOT_COMPUTABLE: MISSING_ZERO_SEQUENCE_SOURCE_MODEL:${source.fid}`};
      }
      // Check if this electrical component has any in-service equipment with missing Z0 data
      const missingReason = componentMissingZ0.get(posCId);
      if (missingReason) {
        return {
          z0Ohm: null,
          status: 'FAILED',
          reason: missingReason,
        };
      }

      const z0CId = z0ComponentOf[busIndex];
      if (z0CId < 0 || !componentGrounded[z0CId]) {
        return {
          z0Ohm: null,
          status: 'UNEARTHED',
          reason: 'ISOLATED_ZERO_SEQUENCE_NETWORK: NO_GROUNDING_PATH',
        };
      }

      let entry = factorCache.get(z0CId);
      if (!entry) {
        const group = z0Components[z0CId];
        const local = new Map(group.map((b, i) => [b, i]));
        const compBranches = z0Branches
          .filter((b) => z0ComponentOf[b.a] === z0CId)
          .map((b) => ({ ...b, a: local.get(b.a)!, b: local.get(b.b)! }));
        const compShunts = z0GroundShunts
          .filter((s) => z0ComponentOf[s.bus] === z0CId)
          .map((s) => ({ ...s, bus: local.get(s.bus)! }));

        const factor = factorPositiveSequence(group.length, compBranches, compShunts);
        entry = { factor, local };
        factorCache.set(z0CId, entry);
      }

      const localIdx = entry.local.get(busIndex)!;
      const solved = entry.factor.drivingPoint(localIdx);
      const zb = zbase(busIndex);
      return {
        z0Ohm: { re: solved.zPu.re * zb, im: solved.zPu.im * zb },
        status: 'SOLVED',
      };
    },
    dispose: () => {
      for (const entry of factorCache.values()) {
        entry.factor.dispose();
      }
      factorCache.clear();
    },
  };
}
