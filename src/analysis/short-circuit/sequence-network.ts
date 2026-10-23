import type { SequenceBranch, SequenceSource } from './positive-sequence';
import { factorPositiveSequence } from './positive-sequence';
import type { ElectricalTopology } from '../../topology/electrical-topology';
import type { CanonicalNetwork, Line as CanonicalLine, Transformer2W as CanonicalTransformer } from '../../domain/model/network';
import type { ScSourceContext } from './source-adapter';

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
 * If a component has no generator/voltage source negative-sequence overrides, Z2 is physically identical to Z1.
 */
export function buildNegativeSequenceEngine(
  topology: ElectricalTopology,
  network: CanonicalNetwork,
  componentOf: Int32Array,
  components: number[][],
  branches: SequenceBranch[],
  positiveSources: { bus: number; rPu: number; xPu: number }[],
  context: ScSourceContext
): NegativeSequenceEngine {
  const zbase = (bus: number) => topology.buses[bus].vnKv ** 2 / network.baseMva;
  const negSourceMap = context.sequenceData?.negativeSources;
  const hasAnyOverride = negSourceMap && negSourceMap.size > 0;

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

      // Check if this component has any negative sequence override
      const group = components[cId];
      let compHasOverride = false;
      if (hasAnyOverride) {
        for (const s of context.sources) {
          if (!s.inService || s.bus === undefined) continue;
          const bIdx = topology.terminalToBus.get(s.bus);
          if (bIdx !== undefined && componentOf[bIdx] === cId && negSourceMap.has(s.fid)) {
            compHasOverride = true;
            break;
          }
        }
      }

      // If no override in this component, Z2 = Z1 exactly
      if (!compHasOverride && posZ) {
        return {
          z2Ohm: { re: posZ.re, im: posZ.im },
          residual: posResidual,
        };
      }

      let entry = factorCache.get(cId);
      if (!entry) {
        const local = new Map(group.map((b, i) => [b, i]));
        const compBranches = branches
          .filter((b) => componentOf[b.a] === cId)
          .map((b) => ({ ...b, a: local.get(b.a)!, b: local.get(b.b)! }));

        const compSources: SequenceSource[] = [];
        for (const s of context.sources) {
          if (!s.inService || s.bus === undefined) continue;
          const bIdx = topology.terminalToBus.get(s.bus);
          if (bIdx === undefined || componentOf[bIdx] !== cId) continue;
          const zb = zbase(bIdx);
          if (!(zb > 0)) continue;

          const neg = negSourceMap?.get(s.fid);
          if (neg && (neg.x2Ohm > 0 || neg.r2Ohm > 0)) {
            compSources.push({ bus: local.get(bIdx)!, rPu: neg.r2Ohm / zb, xPu: neg.x2Ohm / zb });
          } else if (s.rOhm !== null && s.xOhm !== null && s.rOhm >= 0 && s.xOhm > 0) {
            compSources.push({ bus: local.get(bIdx)!, rPu: s.rOhm / zb, xPu: s.xOhm / zb });
          }
        }

        const activeSources = compSources.length
          ? compSources
          : positiveSources
              .filter((s) => componentOf[s.bus] === cId)
              .map((s) => ({ ...s, bus: local.get(s.bus)! }));

        const factor = factorPositiveSequence(group.length, compBranches, activeSources);
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
  context: ScSourceContext
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
    if (!lineSeq || !(lineSeq.x0Ohm > 0) || !Number.isFinite(lineSeq.r0Ohm) || !Number.isFinite(lineSeq.x0Ohm)) {
      const cId = componentOf[a];
      if (cId >= 0 && !componentMissingZ0.has(cId)) {
        componentMissingZ0.set(cId, `NOT_COMPUTABLE: MISSING_ZERO_SEQUENCE_PARAMETERS:line:${l.sourceId}`);
      }
      continue;
    }

    const kv = topology.buses[a].vnKv;
    const base = (kv * kv) / baseMva;
    if (base > 0 && lineSeq.x0Ohm > 0) {
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

    // Verify neutral connection mode (cneutcon)
    // If cneutcon === 1 (separate external neutral), neutral is only grounded if bushvn/buslvn has a valid connection
    let necHv: import('./sequence-network').ScZeroSequenceGroundCompensator | undefined;
    let necLv: import('./sequence-network').ScZeroSequenceGroundCompensator | undefined;
    if (trSeq.cneutcon === 1) {
      if (isHvGrounded) {
        if (trSeq.bushvn && trSeq.bushvn !== 'null') {
          necHv = seqData?.groundCompensators.find((n) => n.inService && (n.bus === trSeq.bushvn || n.fid === trSeq.bushvn));
          if (!necHv && !(trSeq.re0tr_h && trSeq.re0tr_h > 0)) {
            // Ambiguous neutral connection: specified neutral terminal could not be verified
            if (cId >= 0 && !componentMissingZ0.has(cId)) {
              componentMissingZ0.set(cId, `NOT_COMPUTABLE: AMBIGUOUS_TRANSFORMER_NEUTRAL_CONNECTION:${tr.sourceId}`);
            }
            isHvGrounded = false;
          } else if (necHv) {
            usedNecFids.add(necHv.fid);
          }
        } else if (!(trSeq.re0tr_h && trSeq.re0tr_h > 0)) {
          // Open neutral terminal
          isHvGrounded = false;
        }
      }
      if (isLvGrounded) {
        if (trSeq.buslvn && trSeq.buslvn !== 'null') {
          necLv = seqData?.groundCompensators.find((n) => n.inService && (n.bus === trSeq.buslvn || n.fid === trSeq.buslvn));
          if (!necLv && !(trSeq.re0tr_l && trSeq.re0tr_l > 0)) {
            // Ambiguous neutral connection: specified neutral terminal could not be verified
            if (cId >= 0 && !componentMissingZ0.has(cId)) {
              componentMissingZ0.set(cId, `NOT_COMPUTABLE: AMBIGUOUS_TRANSFORMER_NEUTRAL_CONNECTION:${tr.sourceId}`);
            }
            isLvGrounded = false;
          } else if (necLv) {
            usedNecFids.add(necLv.fid);
          }
        } else if (!(trSeq.re0tr_l && trSeq.re0tr_l > 0)) {
          // Open neutral terminal
          isLvGrounded = false;
        }
      }
    }

    const z0pu =
      ((uk0tr!) / 100) *
      (baseMva / tr.ratingMva) *
      ((tr.typeLvKv ?? tr.lvKv) / tr.lvKv) ** 2;
    const x0Pu = z0pu;

    let r0Pu = tr.rPu;
    if (trSeq.ur0tr && Number.isFinite(trSeq.ur0tr) && trSeq.ur0tr > 0 && trSeq.ur0tr !== 99999 && trSeq.ur0tr !== 999999) {
      r0Pu =
        (trSeq.ur0tr / 100) *
        (baseMva / tr.ratingMva) *
        ((tr.typeLvKv ?? tr.lvKv) / tr.lvKv) ** 2;
    }

    // Neutral grounding resistance and reactance (from re0tr or connected ElmNec)
    let reHvPu = trSeq.re0tr_h && trSeq.re0tr_h > 0 ? (3 * trSeq.re0tr_h) / zbase(a) : 0;
    let reLvPu = trSeq.re0tr_l && trSeq.re0tr_l > 0 ? (3 * trSeq.re0tr_l) / zbase(b) : 0;
    let xeHvPu = 0;
    let xeLvPu = 0;
    if (necHv) {
      reHvPu += (necHv.r0Ohm) / zbase(a);
      xeHvPu += (necHv.x0Ohm) / zbase(a);
    }
    if (necLv) {
      reLvPu += (necLv.r0Ohm) / zbase(b);
      xeLvPu += (necLv.x0Ohm) / zbase(b);
    }

    // A. YN / d (or YN / D): Grounded star on HV, delta on LV
    if (isHvGrounded && isLvDelta) {
      const shuntR = r0Pu + reHvPu;
      const shuntX = x0Pu + xeHvPu;
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
      const seriesR = r0Pu + reHvPu + reLvPu;
      const seriesX = x0Pu + xeHvPu + xeLvPu;
      const neutralRatio =
        tr.typeHvKv && tr.typeLvKv && tr.vnKv && tr.lvKv
          ? (tr.typeHvKv / tr.vnKv) / (tr.typeLvKv / tr.lvKv)
          : 1;

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
    for (const [, s] of seqData.zeroSources) {
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
