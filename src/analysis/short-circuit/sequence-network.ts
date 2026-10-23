import type { SequenceBranch, SequenceSource } from './positive-sequence';
import { factorPositiveSequence } from './positive-sequence';
import type { ElectricalTopology } from '../../topology/electrical-topology';
import type { CanonicalNetwork } from '../../domain/model/network';
import type { ScSourceContext } from './source-adapter';

export interface ScZeroSequenceLine {
  lineId: string;
  r0Ohm: number;
  x0Ohm: number;
}

export interface ScZeroSequenceTransformer {
  transformerId: string;
  vectorGroupHv: string; // 'YN' | 'Y' | 'D' | 'Z' | 'ZN'
  vectorGroupLv: string;
  uk0tr: number; // %
  ur0tr?: number; // %
  x0tor0?: number;
  re0tr_h: number; // Ohm
  re0tr_l: number; // Ohm
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
 * If a component has no generator negative-sequence overrides, Z2 is physically identical to Z1.
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
          if (neg && neg.x2Ohm > 0) {
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
 * Connects transmission lines, YNyn transformers, YNd/dYN shunts to ground,
 * and ElmNec grounding compensators. Isolated zero-sequence sub-networks are
 * detected cleanly without causing singular matrix crashes.
 */
export function buildZeroSequenceEngine(
  n: number,
  topology: ElectricalTopology,
  network: CanonicalNetwork,
  context: ScSourceContext
): ZeroSequenceEngine {
  const zbase = (bus: number) => topology.buses[bus].vnKv ** 2 / network.baseMva;
  const seqData = context.sequenceData;

  const z0Branches: SequenceBranch[] = [];
  const z0GroundShunts: SequenceSource[] = [];
  const adj = Array.from({ length: n }, () => [] as number[]);

  // 1. Lines in zero sequence
  for (const l of network.lines) {
    if (!l.inService || topology.blockedEquipment.has(l.id)) continue;
    const a = topology.terminalToBus.get(l.from);
    const b = topology.terminalToBus.get(l.to);
    if (a === undefined || b === undefined) continue;

    const lineSeq = seqData?.lines.get(l.sourceId);
    // Use verified line sequence parameters if available; fallback to line base if not
    const r0Ohm = lineSeq ? lineSeq.r0Ohm : l.rOhm * 3;
    const x0Ohm = lineSeq ? lineSeq.x0Ohm : l.xOhm * 3;

    const kv = topology.buses[a].vnKv;
    const base = (kv * kv) / network.baseMva;
    if (base > 0 && x0Ohm > 0 && Number.isFinite(r0Ohm) && Number.isFinite(x0Ohm)) {
      z0Branches.push({
        a,
        b,
        rPu: r0Ohm / base,
        xPu: x0Ohm / base,
        tap: 1,
        phaseRad: 0,
      });
      adj[a].push(b);
      adj[b].push(a);
    }
  }

  // 2. Transformers in zero sequence
  for (const tr of network.transformers) {
    if (!tr.inService || topology.blockedEquipment.has(tr.id)) continue;
    const a = topology.terminalToBus.get(tr.from); // HV
    const b = topology.terminalToBus.get(tr.to); // LV
    if (a === undefined || b === undefined) continue;

    const trSeq = seqData?.transformers.get(tr.sourceId);
    const vgHv = (trSeq?.vectorGroupHv ?? 'YN').toUpperCase();
    const vgLv = (trSeq?.vectorGroupLv ?? 'D').toUpperCase();

    const isHvGrounded = vgHv.includes('N');
    const isLvGrounded = vgLv.includes('N');
    const isHvDelta = vgHv === 'D';
    const isLvDelta = vgLv === 'D';

    // Zero-sequence short-circuit impedance (on base)
    let r0Pu = tr.rPu;
    let x0Pu = tr.xPu;
    if (trSeq && trSeq.uk0tr > 0) {
      const z0pu =
        (trSeq.uk0tr / 100) *
        (network.baseMva / tr.ratingMva) *
        ((tr.typeLvKv ?? tr.lvKv) / tr.lvKv) ** 2;
      x0Pu = z0pu;
      r0Pu = tr.rPu;
    }

    // Neutral grounding resistance (3 * Re)
    const reHvPu = trSeq && trSeq.re0tr_h > 0 ? (3 * trSeq.re0tr_h) / zbase(a) : 0;
    const reLvPu = trSeq && trSeq.re0tr_l > 0 ? (3 * trSeq.re0tr_l) / zbase(b) : 0;

    // A. YN / d (or YN / D): Grounded star on HV, delta on LV
    if (isHvGrounded && isLvDelta) {
      const shuntR = r0Pu + reHvPu;
      const shuntX = x0Pu;
      if (shuntX > 0) {
        z0GroundShunts.push({ bus: a, rPu: shuntR, xPu: shuntX });
      }
    }
    // B. d / YN (or D / YN): Delta on HV, grounded star on LV
    else if (isHvDelta && isLvGrounded) {
      const shuntR = r0Pu + reLvPu;
      const shuntX = x0Pu;
      if (shuntX > 0) {
        z0GroundShunts.push({ bus: b, rPu: shuntR, xPu: shuntX });
      }
    }
    // C. YN / YN (or YN / yn): Grounded star on both sides (series transmission)
    else if (isHvGrounded && isLvGrounded) {
      const seriesR = r0Pu + reHvPu + reLvPu;
      const seriesX = x0Pu;
      const neutralRatio =
        tr.typeHvKv && tr.typeLvKv && tr.vnKv && tr.lvKv
          ? (tr.typeHvKv / tr.vnKv) / (tr.typeLvKv / tr.lvKv)
          : 1;

      if (seriesX > 0) {
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
    // D. Ungrounded star or delta-delta: no connection in zero sequence
  }

  // 3. ElmNec (Neutral earthing compensators / grounding transformers)
  if (seqData?.groundCompensators) {
    for (const nec of seqData.groundCompensators) {
      if (!nec.inService) continue;
      const busIdx = topology.terminalToBus.get(nec.bus);
      if (busIdx === undefined) continue;

      const zb = zbase(busIdx);
      if (zb > 0 && nec.x0Ohm > 0) {
        z0GroundShunts.push({
          bus: busIdx,
          rPu: nec.r0Ohm / zb,
          xPu: nec.x0Ohm / zb,
        });
      }
    }
  }

  // 4. ElmVac / Grounded Voltage Sources
  if (seqData?.zeroSources) {
    for (const [, s] of seqData.zeroSources) {
      const busIdx = topology.terminalToBus.get(s.bus);
      if (busIdx === undefined) continue;
      const zb = zbase(busIdx);
      if (zb > 0 && s.x0Ohm > 0) {
        z0GroundShunts.push({
          bus: busIdx,
          rPu: s.r0Ohm / zb,
          xPu: s.x0Ohm / zb,
        });
      }
    }
  }

  // 5. Partition zero-sequence graph into connected components
  const componentOf = new Int32Array(n).fill(-1);
  const components: number[][] = [];

  for (let root = 0; root < n; root++) {
    if (componentOf[root] < 0) {
      const group: number[] = [];
      const id = components.length;
      const stack = [root];
      componentOf[root] = id;
      while (stack.length) {
        const u = stack.pop()!;
        group.push(u);
        for (const v of adj[u]) {
          if (componentOf[v] < 0) {
            componentOf[v] = id;
            stack.push(v);
          }
        }
      }
      components.push(group);
    }
  }

  // Determine which components have at least one ground shunt
  const componentGrounded = new Uint8Array(components.length);
  for (const s of z0GroundShunts) {
    const cId = componentOf[s.bus];
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
      const cId = componentOf[busIndex];
      if (cId < 0 || !componentGrounded[cId]) {
        return {
          z0Ohm: null,
          status: 'UNEARTHED',
          reason: 'ISOLATED_ZERO_SEQUENCE_NETWORK: NO_GROUNDING_PATH',
        };
      }

      let entry = factorCache.get(cId);
      if (!entry) {
        const group = components[cId];
        const local = new Map(group.map((b, i) => [b, i]));
        const compBranches = z0Branches
          .filter((b) => componentOf[b.a] === cId)
          .map((b) => ({ ...b, a: local.get(b.a)!, b: local.get(b.b)! }));
        const compShunts = z0GroundShunts
          .filter((s) => componentOf[s.bus] === cId)
          .map((s) => ({ ...s, bus: local.get(s.bus)! }));

        const factor = factorPositiveSequence(group.length, compBranches, compShunts);
        entry = { factor, local };
        factorCache.set(cId, entry);
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
