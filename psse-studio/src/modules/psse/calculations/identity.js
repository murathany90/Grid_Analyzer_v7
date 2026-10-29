import {isExtendedAction,validateExtendedOperation} from '../scenarios/operations.js';
import {resultStatus} from './status.js';
// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.Fo = function Fo(e2, t2 = []) {
  if (!Array.isArray(t2)) throw Error(`PSSE_SCENARIO_OPERATIONS_INVALID`);
  let n2 = t2.map((e3, t3) => {
      if (!e3 || typeof e3 != `object` || typeof e3.equipmentId != `string` || !e3.equipmentId.trim()) throw Error(`PSSE_SCENARIO_OPERATION_INVALID:${t3}`);
      return {
        equipmentId: e3.equipmentId,
        action: e3.action,
        value: e3.value
      };
    }).sort((e3, t3) => e3.equipmentId.localeCompare(t3.equipmentId) || e3.action.localeCompare(t3.action)),
    r2 = /* @__PURE__ */new Set();
  for (let t3 of n2) {
    let n3 = `${t3.equipmentId}\0${t3.action}`;
    if (r2.has(n3)) throw Error(`PSSE_SCENARIO_DUPLICATE_OPERATION:${t3.equipmentId}:${t3.action}`);
    if (r2.add(n3), t3.action === `STATUS`) {
      if (![...e2.branches, ...e2.generators, ...e2.loads, ...e2.shunts].some(e3 => e3.sourceEquipmentId === t3.equipmentId)) throw Error(`PSSE_SCENARIO_UNKNOWN_EQUIPMENT:${t3.equipmentId}`);
      if (typeof t3.value == `boolean`) continue;
      if (typeof t3.value != `number` || !Number.isInteger(t3.value) || ![0, 1].includes(t3.value)) throw Error(`PSSE_SCENARIO_STATUS_RANGE`);
    } else if (t3.action === `GENERATOR_P`) {
      let n4 = e2.generators.filter(e3 => e3.sourceEquipmentId === t3.equipmentId);
      if (!n4.length) throw Error(`PSSE_SCENARIO_ACTION_TARGET_MISMATCH:GENERATOR_P:${t3.equipmentId}`);
      if (typeof t3.value != `number` || !Number.isFinite(t3.value)) throw Error(`PSSE_SCENARIO_GENERATOR_P_VALUE`);
      if (n4.length !== 1) throw Error(`PSSE_SCENARIO_AMBIGUOUS_GENERATOR_TARGET:${t3.equipmentId}`);
      let r3 = n4[0];
      if (r3.pMinMw !== null && t3.value < r3.pMinMw - 1e-8 || r3.pMaxMw !== null && t3.value > r3.pMaxMw + 1e-8) throw Error(`PSSE_SCENARIO_GENERATOR_P_RANGE:${t3.equipmentId}`);
    } else if (t3.action === `LOAD_SCALE`) {
      if (!e2.loads.filter(e3 => e3.sourceEquipmentId === t3.equipmentId).length) throw Error(`PSSE_SCENARIO_ACTION_TARGET_MISMATCH:LOAD_SCALE:${t3.equipmentId}`);
      if (typeof t3.value != `number` || !Number.isFinite(t3.value) || t3.value < 0) throw Error(`PSSE_SCENARIO_LOAD_SCALE_RANGE`);
    } else if(isExtendedAction(t3.action)){validateExtendedOperation(e2,t3);} else throw Error(`PSSE_SCENARIO_ACTION_UNSUPPORTED:${t3.action}`);
  }
  let i2 = Object.freeze(n2.map(e3 => Object.freeze({
      ...e3
    }))),
    a2 = {
      schema: `ga.psse.scenario.v1`,
      networkHash: e2.modelHash,
      operations: i2
    },
    o2 = ctx.Po(JSON.stringify(a2));
  return Object.freeze({
    ...a2,
    hash: o2
  });
};
ctx.Lo = function Lo(e2) {
  if (Array.isArray(e2)) return e2.map(ctx.Lo);
  if (e2 && typeof e2 == `object`) return Object.fromEntries(Object.entries(e2).sort(([e3], [t2]) => e3.localeCompare(t2)).map(([e3, t2]) => [e3, ctx.Lo(t2)]));
  if (typeof e2 == `number` && !Number.isFinite(e2)) throw Error(`PSSE_OPTIONS_NONFINITE`);
  return e2;
};
ctx.Ro = function Ro(e2) {
  return ctx.Io(JSON.stringify(ctx.Lo(e2)));
};
ctx.zo = function zo(e2) {
  let t2 = {
    schema: `ga.psse.calculation-identity.v1`,
    ...e2
  };
  return {
    ...t2,
    id: `psse-` + ctx.Io(JSON.stringify(t2))
  };
};
ctx.Bo = function Bo(e2) {
  return ctx.Io(JSON.stringify({
    buses: e2.buses.map((e3, t2) => [t2, e3.connectionKey, e3.status, e3.type, e3.source]).sort((e3, t2) => String(e3[1]).localeCompare(String(t2[1]))),
    branches: e2.branches.map(e3 => [e3.id, e3.fromKey, e3.toKey, e3.windingId, e3.status, e3.kind]).sort((e3, t2) => String(e3[0]).localeCompare(String(t2[0])))
  }));
};
ctx.Vo = function Vo(e2) {
  return resultStatus(e2);
};
ctx.Ho = function Ho(e2) {
  return ctx.Vo(e2) === `LIMITED_PROFILE` ? `Say\u0131sal art\u0131k e\u015Fi\u011Fi ${e2.method} y\xF6ntemi i\xE7in sa\u011Fland\u0131; do\u011Frulanan profil kapsam\u0131 PARTIAL. Sonu\xE7 bu se\xE7ili y\xF6ntem ve profil i\xE7in ge\xE7erlidir.` : e2.status === `CONVERGED` ? `Say\u0131sal art\u0131k e\u015Fi\u011Fi sa\u011Fland\u0131; fizik kapsam\u0131 SUPPORTED.` : `Say\u0131sal sonu\xE7 durumu: ${e2.status}; fizik kapsam\u0131 ${e2.physicsCoverage}.`;
};
ctx.Uo = function Uo(e2) {
  return {
    ...e2,
    numericalStatus: e2.status,
    classification: e2.classification,
    publicationStatus: ctx.Vo(e2),
    publicationMessage: ctx.Ho(e2)
  };
};
ctx.Wo = function Wo(e2, t2) {
  try {
    if (!e2 || e2.schema !== `ga.psse.calculation.v1` || e2.source !== `GA_PSSE_CALCULATED`) return false;
    let n2 = e2.identity,
      r2 = t2.network,
      i2 = t2.scenario;
    if (!n2 || n2.schema !== `ga.psse.calculation-identity.v1` || n2.mode !== `PSSE` || n2.engineVersion !== `GA_PSSE_ENGINE_4` || i2.networkHash !== r2.modelHash || t2.sourceSha256 !== r2.sourceSha256 || n2.sourceSha256 !== t2.sourceSha256 || n2.modelHash !== r2.modelHash || n2.normalizedModelHash !== r2.modelHash || n2.normalizedRevision !== r2.revision || n2.scenarioHash !== i2.hash || t2.effectiveNetwork.modelHash !== r2.modelHash || n2.topologyHash !== ctx.Bo(t2.effectiveNetwork) || ![`NR_POLAR`, `FDNS_XB`, `LOSSLESS_DC`].includes(e2.method) || n2.solver !== e2.method || n2.algorithmId !== e2.method || t2.method !== void 0 && t2.method !== e2.method || n2.resultSchemaRevision !== `psse-result-1` || !/^[a-f0-9]{64}$/.test(n2.optionsHash) || t2.optionsHash !== void 0 && n2.optionsHash !== t2.optionsHash || e2.id !== n2.id) return false;
    let {
      schema: a2,
      id: o2,
      ...s2
    } = n2;
    return o2 === ctx.zo(s2).id;
  } catch {
    return false;
  }
};
ctx.Go = function Go(e2, t2, n2, r2) {
  let i2 = ctx.Fo(n2),
    a2 = e3 => !!e3 && e3.status === `CONVERGED` && e3.physicsCoverage !== `BLOCKED` && ctx.Wo(e3, {
      sourceSha256: r2,
      network: n2,
      effectiveNetwork: n2,
      scenario: i2
    });
  return a2(t2) ? t2 : a2(e2) ? e2 : null;
};
}
export const initializers = [
[408, ctx => { ctx.Io = e2 => Array.from(ctx.z(new TextEncoder().encode(e2)), e3 => e3.toString(16).padStart(2, `0`)).join(``); }]
];
