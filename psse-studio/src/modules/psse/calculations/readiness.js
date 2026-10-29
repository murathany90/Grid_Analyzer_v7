import {isExtendedAction,applyExtendedOperation} from '../scenarios/operations.js';
// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.ns = function ns(e2) {
  return e2 && typeof e2 == `object` && !Array.isArray(e2) ? e2 : null;
};
ctx.rs = function rs(e2, t2, n2, r2 = NaN) {
  let i2 = t2.toUpperCase();
  if (e2.source.format === `SAV` && n2 !== void 0) {
    let t3 = e2.binaryArrays?.Headre?.values;
    if (t3 && n2 < t3.length) return {
      value: ctx.ts(t3[n2]),
      source: `SAV.Headre[${n2 + 1}]`,
      scalarPrecision: `F32`,
      explicit: true
    };
  }
  let a2 = [[e2.case.general, `source case GENERAL`], [e2.sourceTables.GENERAL?.[0], `sourceTables.GENERAL`], [e2.case, `source case`]];
  for (let [e3, t3] of a2) {
    let n3 = ctx.ns(e3);
    if (n3) {
      for (let [e4, r3] of Object.entries(n3)) if (e4.toUpperCase() === i2 || i2 === `THRSHZ` && e4.toUpperCase() === `THRESHZ`) return {
        value: ctx.ts(r3),
        source: `${t3}.${e4}`,
        scalarPrecision: `F64`,
        explicit: true
      };
    }
  }
  let o2 = e2.sourceTables.SYSTEM_WIDE;
  if (Array.isArray(o2)) for (let e3 of o2) {
    let t3 = ctx.ns(e3);
    if (!t3) continue;
    let n3 = Array.isArray(t3.sourceTokens) ? t3.sourceTokens : [];
    if (String(n3[0] ?? t3.sourceField1 ?? ``).trim().toUpperCase() === `GENERAL`) for (let e4 of n3) {
      let t4 = typeof e4 == `string` ? e4.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i) : null;
      if (t4 && t4[1].toUpperCase() === i2) return {
        value: ctx.ts(t4[2]),
        source: `RAW.SYSTEM_WIDE.GENERAL.${i2}`,
        scalarPrecision: `F64`,
        explicit: true
      };
    }
  }
  return {
    value: Number.isFinite(r2) ? r2 : null,
    source: `PSS/E 36.5 default ${i2}`,
    scalarPrecision: `F64`,
    explicit: false
  };
};
ctx.is = function is(e2) {
  let t2 = ctx.rs(e2, `THRSHZ`, 11, 1e-4);
  return {
    valuePu: t2.value ?? NaN,
    source: t2.source,
    scalarPrecision: t2.scalarPrecision
  };
};
ctx.as = function as(e2, t2) {
  if (t2.kind !== `line` && t2.kind !== `switch`) return 0;
  let n2 = t2.fields.bp ?? t2.fields.bypass;
  if (n2 == null || n2 === ``) return e2.source.format === `SAV` ? null : 0;
  let r2 = typeof n2 == `boolean` ? +!!n2 : Number(n2);
  return Number.isFinite(r2) ? r2 : null;
};
ctx.os = function os(e2, t2, n2 = ctx.is(e2), r2) {
  let i2 = r2 ? r2.get(t2.sourceEquipmentId) : e2.equipment.find(e3 => e3.id === t2.sourceEquipmentId);
  return !i2 || i2.kind !== `switch` && i2.kind !== `line` || t2.rPu !== 0 || !Number.isFinite(t2.xPu) || n2.valuePu < 0 || ctx.as(e2, i2) !== 0 || n2.valuePu === 0 ? false : n2.scalarPrecision === `F32` ? Math.fround(Math.abs(t2.xPu)) <= Math.fround(n2.valuePu) : Math.abs(t2.xPu) <= n2.valuePu;
};
ctx.ss = function ss(e2, t2) {
  let n2 = new Set(t2.branches.filter(e3 => e3.status === 1).map(e3 => e3.sourceEquipmentId));
  return e2.equipment.filter(t3 => (t3.kind === `line` || t3.kind === `switch`) && n2.has(t3.id) && ctx.as(e2, t3) !== 0).map(e3 => e3.id);
};
ctx.cs = function cs(e2) {
  return [`INSPECTION_ONLY`, `UNSPECIFIED_BASE_KV`, `NO_ACTIVE_SLACK`, `SLACK_WITHOUT_ACTIVE_GENERATOR`, `ISLAND_WITHOUT_ACTIVE_SLACK`].includes(e2.code) || e2.code === `UNSUPPORTED_SOURCE_MODEL` && /^VOLTAGE_DROOP_CONTROL\s*:/i.test(e2.message);
};
ctx.ls = function ls(e2, t2, n2) {
  let r2 = e3 => e3.kind === `other` && (String(e3.fields.subtype ?? ``).trim().toLowerCase() === `voltage-droop` || String(e3.fields.sourceTable ?? ``).trim().toUpperCase() === `VOLTAGE_DROOP_CONTROL`),
    i2 = e2.findings.filter(e3 => e3.code === `UNSUPPORTED_SOURCE_MODEL`),
    a2 = i2.length > 0 && i2.every(e3 => /^VOLTAGE_DROOP_CONTROL\s*:/i.test(e3.message)) && e2.findings.every(ctx.cs) && e2.equipment.some(r2),
    o2 = t2.findings.filter(e3 => n2 !== `LOSSLESS_DC` && !a2 || e3.code !== `SOURCE_MODEL_PARTIAL`),
    s2 = t2.buses.filter(e3 => e3.source && e3.status === 1),
    c2 = t2.buses.map(() => []),
    l2 = /* @__PURE__ */new Map();
  for (let t3 of e2.equipment) l2.has(t3.id) || l2.set(t3.id, t3);
  let u2 = new Set(t2.generators.filter(e3 => e3.status === 1).map(e3 => e3.bus)),
    d2 = ctx.is(e2),
    f2 = t2.branches.filter(e3 => {
      if (e3.status !== 1) return false;
      let t3 = l2.get(e3.sourceEquipmentId);
      return t3?.kind === `switch` || t3?.kind === `line`;
    }),
    p2 = f2.filter(e3 => e3.xPu === 0 && d2.valuePu === 0),
    m2 = f2.filter(t3 => ctx.os(e2, t3, d2, l2)),
    h2 = ctx.ss(e2, t2),
    g2 = n2 === `LOSSLESS_DC` ? h2 : h2.filter(t3 => {
      let n3 = l2.get(t3);
      return !n3 || ctx.as(e2, n3) === null;
    }),
    _2 = ctx.rs(e2, `PQBRAK`, 1, 0.7);
  (!Number.isFinite(d2.valuePu) || d2.valuePu < 0) && o2.push({
    severity: `ERROR`,
    code: `SYSTEM_SWITCH_THRESHOLD_INVALID`,
    message: `Source THRSHZ must be finite and nonnegative.`,
    equipment: f2[0]?.sourceEquipmentId
  }), p2.length && o2.push({
    severity: `ERROR`,
    code: `ZERO_X_WITH_ZIL_DISABLED`,
    message: `THRSHZ=0 disables zero-impedance line treatment; an active zero-X non-transformer branch cannot be interpreted in this profile.`,
    equipment: p2[0].sourceEquipmentId
  }), g2.length && o2.push({
    severity: `ERROR`,
    code: `ACTIVE_BYPASS_UNSUPPORTED`,
    message: n2 === `LOSSLESS_DC` ? `Lossless DC does not model BP/bypass branch status on ${g2.length} active branch(es).` : `${g2.length} active non-transformer branch(es) have an unknown BP/bypass state.`,
    equipment: g2[0]
  }), n2 !== `LOSSLESS_DC` && m2.length && o2.push({
    severity: `INFO`,
    code: `AC_IDEAL_LINK_CONTRACTION_REQUIRED`,
    message: `${m2.length} active non-transformer link(s) require equal-voltage contraction at THRSHZ=${d2.valuePu}.`
  }), n2 !== `LOSSLESS_DC` && (_2.value === null || !Number.isFinite(_2.value)) ? o2.push({
    severity: `ERROR`,
    code: `PSSE_PQBRAK_INVALID`,
    message: `Source PQBRAK is malformed or unavailable; the PSS/E low-voltage load break profile cannot be established.`
  }) : n2 !== `LOSSLESS_DC` && _2.explicit && (_2.scalarPrecision === `F32` ? Math.fround(_2.value) !== Math.fround(0.7) : _2.value !== 0.7) && o2.push({
    severity: `ERROR`,
    code: `PSSE_PQBRAK_UNSUPPORTED`,
    message: `Source PQBRAK=${_2.value} differs from the validated default 0.7; this AC profile does not implement that low-voltage load curve.`
  });
  let v2 = new Set(t2.generators.filter(e3 => e3.status === 1).flatMap(e3 => {
    let t3 = l2.get(e3.sourceEquipmentId),
      n3 = String(t3?.fields.droopname ?? ``).trim(),
      r3 = Number(t3?.fields.voltageDroopIndex ?? 0);
    return n3 || r3 !== 0 ? [e3.remoteBus ?? e3.bus] : [];
  }));
  for (let i3 of e2.equipment) {
    if (r2(i3) && i3.status === 1) {
      let e3 = String(i3.fields.regConnectionKey ?? i3.fields.regbus ?? i3.buses[0] ?? ``),
        r3 = t2.buses.findIndex(t3 => t3.connectionKey === e3 || String(t3.externalNumber) === e3),
        a3 = r3 >= 0 && v2.has(r3),
        s3 = n2 === `LOSSLESS_DC` ? `DC_REACTIVE_CONTROL_OMITTED` : a3 ? `VOLTAGE_DROOP_Q_FIXED_APPROXIMATION` : `VOLTAGE_DROOP_UNREFERENCED`,
        c3 = n2 === `LOSSLESS_DC` ? `Lossless DC fixes active-power injections and omits this known voltage-droop reactive control.` : a3 ? `An assigned voltage-droop curve is held at the source QG value in the FIXED_CONTROLS approximation.` : `The active voltage-droop record is not assigned to a machine and has no AC equation effect.`;
      o2.push({
        severity: `INFO`,
        code: s3,
        message: c3,
        equipment: i3.id
      });
    } else [`dc`, `facts`, `other`].includes(i3.kind) && i3.status !== 0 && o2.push({
      severity: `ERROR`,
      code: `ACTIVE_UNSUPPORTED_EQUIPMENT`,
      message: `${i3.kind} equipment ${i3.id} has no implemented ${n2} equations.`,
      equipment: i3.id
    });
    i3.kind === `switch` && i3.status !== 0 && !i3.id.startsWith(`switch:system:`) && o2.push({
      severity: `ERROR`,
      code: `ACTIVE_SWITCH_TOPOLOGY_UNSUPPORTED`,
      message: `Active node-breaker switch ${i3.id} requires validated bus contraction and terminal topology.`,
      equipment: i3.id
    }), i3.kind === `switch` && i3.status === null && o2.push({
      severity: `ERROR`,
      code: `SWITCH_STATUS_UNKNOWN`,
      message: `Switch status is unknown.`,
      equipment: i3.id
    });
  }
  for (let t3 of e2.equipment) [`line`, `transformer`, `generator`, `load`, `shunt`, `switch`].includes(t3.kind) && t3.status === null && o2.push({
    severity: `ERROR`,
    code: `EQUIPMENT_STATUS_UNKNOWN`,
    message: `Electrical equipment status is unknown; it cannot be assumed in or out of service.`,
    equipment: t3.id
  });
  for (let e3 of t2.branches) e3.status === 1 && (!t2.buses[e3.from]?.status || !t2.buses[e3.to]?.status) && o2.push({
    severity: `ERROR`,
    code: `ACTIVE_BRANCH_ON_OUT_OF_SERVICE_BUS`,
    message: `Active series branch ${e3.id} is connected to an out-of-service or IDE=4 bus.`,
    equipment: e3.sourceEquipmentId
  });
  for (let e3 of [t2.generators, t2.loads, t2.shunts]) for (let n3 of e3) n3.status === 1 && t2.buses[n3.bus]?.status !== 1 && o2.push({
    severity: `ERROR`,
    code: `ACTIVE_INJECTION_ON_OUT_OF_SERVICE_BUS`,
    message: `Active ${`pMw` in n3 ? `generator` : `bMvar` in n3 ? `shunt` : `load`} ${n3.id} is connected to an out-of-service or IDE=4 bus.`,
    equipment: n3.sourceEquipmentId
  });
  for (let t3 of e2.equipment) if (t3.kind === `load` && t3.status !== 0) {
    let e3 = Number(t3.fields.dgenm ?? t3.fields.distributedGenerationMode ?? 0),
      n3 = Number(t3.fields.dgenp ?? 0),
      r3 = Number(t3.fields.dgenq ?? 0);
    (e3 !== 0 || n3 !== 0 || r3 !== 0) && o2.push({
      severity: `ERROR`,
      code: `LOAD_EMBEDDED_GENERATION_UNSUPPORTED`,
      message: `Embedded load generation has nonzero mode or power and is not implemented.`,
      equipment: t3.id
    });
  }
  for (let t3 of e2.equipment) if (t3.kind === `generator` && t3.status === 1) {
    let e3 = Number(t3.fields.wmod ?? 0),
      r3 = String(t3.fields.droopname ?? ``).trim(),
      i3 = Number(t3.fields.voltageDroopIndex ?? 0);
    !Number.isInteger(e3) || e3 < 0 || e3 > 4 ? o2.push({
      severity: `ERROR`,
      code: `GENERATOR_WMOD_UNSUPPORTED`,
      message: `WMOD=${e3} has no implemented fixed-controls equation.`,
      equipment: t3.id
    }) : n2 === `LOSSLESS_DC` && (e3 !== 0 || r3 || i3 !== 0) ? o2.push({
      severity: `INFO`,
      code: `DC_REACTIVE_CONTROL_OMITTED`,
      message: `Lossless DC fixes source active-power injections and omits generator reactive/voltage controls.`,
      equipment: t3.id
    }) : n2 !== `LOSSLESS_DC` && (e3 === 1 || e3 === 2 || e3 === 3 || e3 === 4) && o2.push({
      severity: `INFO`,
      code: `GENERATOR_WMOD_MAPPED`,
      message: `WMOD=${e3} uses its documented P/Q limit or fixed-Q equation.`,
      equipment: t3.id
    }), n2 !== `LOSSLESS_DC` && (r3 || i3 !== 0) && o2.push({
      severity: `INFO`,
      code: `GENERATOR_DROOP_FIXED_Q_APPROXIMATION`,
      message: `Assigned generator voltage droop is held at source QG under FIXED_CONTROLS.`,
      equipment: t3.id
    });
  }
  for (let t3 of e2.equipment) t3.kind === `transformer` && t3.status !== 0 && (([`tab1`, `tab2`, `tab3`].some(e3 => Number(t3.fields[e3] ?? 0) !== 0) || Number(t3.fields.correctionTable ?? 0) !== 0 || Array.isArray(t3.fields.windings) && t3.fields.windings.some(e3 => Number(e3.correctionTable ?? 0) !== 0)) && o2.push({
    severity: `ERROR`,
    code: `TRANSFORMER_CORRECTION_TABLE_UNSUPPORTED`,
    message: `Nonzero impedance correction table is not applied to the transformer primitive.`,
    equipment: t3.id
  }), Number(t3.fields.connectionAngle ?? t3.fields.psalfa ?? 0) !== 0 && o2.push({
    severity: `ERROR`,
    code: `TRANSFORMER_CONNECTION_ANGLE_UNSUPPORTED`,
    message: `Nonzero transformer connection-angle semantics are not implemented.`,
    equipment: t3.id
  }), [`cod1`, `cod2`, `cod3`].some(e3 => Number(t3.fields[e3] ?? 0) !== 0) && o2.push({
    severity: `INFO`,
    code: `TRANSFORMER_CONTROL_HELD_FIXED`,
    message: `Source transformer control is held at its selected tap by the explicit FIXED_CONTROLS policy.`,
    equipment: t3.id
  }));
  let y2 = e2.completeness === `PARTIAL` && e2.findings.length > 0 && e2.findings.every(e3 => e3.code === `UNSPECIFIED_BASE_KV` || e3.code === `INSPECTION_ONLY`);
  e2.completeness === `PARTIAL` && !y2 && !a2 && !o2.some(e3 => e3.code === `SOURCE_MODEL_PARTIAL`) && o2.push({
    severity: `ERROR`,
    code: `SOURCE_MODEL_PARTIAL`,
    message: `Native source findings leave electrical records or packed controls unresolved.`
  });
  for (let e3 of t2.branches) e3.status === 1 && (c2[e3.from].push(e3.to), c2[e3.to].push(e3.from));
  let b2 = new Uint8Array(t2.buses.length),
    x2 = [];
  for (let e3 = 0; e3 < t2.buses.length; e3++) {
    if (b2[e3] || t2.buses[e3].status !== 1) continue;
    b2[e3] = 1;
    let n3 = [e3];
    for (let e4 = 0; e4 < n3.length; e4++) for (let t3 of c2[n3[e4]]) b2[t3] || (b2[t3] = 1, n3.push(t3));
    x2.push(n3);
  }
  for (let e3 of x2) {
    let r3 = e3.map(e4 => t2.buses[e4].id),
      i3 = e3.filter(e4 => t2.buses[e4].type === 3);
    if (i3.length !== 1 && o2.push({
      severity: `ERROR`,
      code: `ISLAND_REFERENCE_COUNT`,
      message: `Energized island [${r3.slice(0, 8).join(`, `)}] has ${i3.length} reference buses; exactly one is required.`
    }), i3.some(e4 => u2.has(e4)) || o2.push({
      severity: `ERROR`,
      code: `ISLAND_REFERENCE_SOURCE_MISSING`,
      message: `Reference bus has no active generator.`
    }), n2 !== `LOSSLESS_DC`) for (let n3 of e3) t2.buses[n3].type === 2 && !u2.has(n3) && o2.push({
      severity: `INFO`,
      code: `PV_WITHOUT_ACTIVE_GENERATOR_FIXED_PQ`,
      message: `PV bus ${t2.buses[n3].id} has no active local machine; FIXED_CONTROLS treats it as PQ.`,
      equipment: t2.buses[n3].sourceEquipmentId ?? void 0
    });
  }
  for (let e3 of t2.generators.filter(e4 => e4.status === 1)) {
    if (n2 === `LOSSLESS_DC`) {
      e3.remoteBus !== null && e3.remoteBus !== e3.bus && o2.push({
        severity: `INFO`,
        code: `DC_REACTIVE_CONTROL_OMITTED`,
        message: `Lossless DC fixes source active-power setpoints and does not model remote voltage regulation.`,
        equipment: e3.id
      });
      continue;
    }
    let r3 = ctx.us(e3, t2);
    r3 === `UNKNOWN` ? o2.push({
      severity: `ERROR`,
      code: `REMOTE_REGULATION_UNSUPPORTED`,
      message: `Generator regulation bus cannot be resolved.`,
      equipment: e3.id
    }) : r3 !== null && r3 !== e3.bus && o2.push({
      severity: `INFO`,
      code: `REMOTE_REGULATION_FIXED_Q_SOURCE_SAVED`,
      message: `Remote voltage regulation is held at the source QG value in the FIXED_CONTROLS approximation.`,
      equipment: e3.id
    });
  }
  return o2.some(e3 => e3.severity === `ERROR`) ? {
    method: n2,
    status: `BLOCKED`,
    findings: o2,
    energizedBusCount: s2.length,
    islandCount: x2.length
  } : {
    method: n2,
    status: o2.some(e3 => e3.severity === `WARNING`) ? `PARTIAL` : `READY`,
    findings: o2,
    energizedBusCount: s2.length,
    islandCount: x2.length
  };
};
ctx.us = function us(e2, t2) {
  let n2 = e2.remoteBus;
  return n2 === null ? null : Number.isInteger(n2) && n2 >= 0 && n2 < t2.buses.length ? n2 : `UNKNOWN`;
};
ctx.fs = function fs(e2, t2) {
  if (t2.networkHash !== e2.modelHash) throw Error(`PSSE_SCENARIO_NETWORK_MISMATCH`);
  let n2 = structuredClone(e2);
  for (let e3 of t2.operations) if (e3.action === `STATUS`) {
    let t3 = e3.value === true ? 1 : e3.value === false ? 0 : typeof e3.value == `number` && [0, 1].includes(e3.value) ? e3.value : null;
    if (t3 === null) throw Error(`PSSE_SCENARIO_STATUS_RANGE`);
    for (let r2 of [n2.branches, n2.generators, n2.loads, n2.shunts]) for (let n3 of r2) n3.sourceEquipmentId === e3.equipmentId && (n3.status = t3);
  } else if (e3.action === `GENERATOR_P`) for (let t3 of n2.generators) t3.sourceEquipmentId === e3.equipmentId && (t3.pMw = Number(e3.value));else if (e3.action === `LOAD_SCALE`) {
    let t3 = Number(e3.value);
    for (let r2 of n2.loads) r2.sourceEquipmentId === e3.equipmentId && (r2.pMw *= t3, r2.qMvar *= t3, r2.ipMw *= t3, r2.iqMvar *= t3, r2.ypMw *= t3, r2.yqMvar *= t3);
  } else if(isExtendedAction(e3.action)){applyExtendedOperation(n2,e3);} else throw Error(`PSSE_SCENARIO_OPERATION_NOT_SUPPORTED:${e3.action}`);
  for (let e3 of n2.buses) if (!e3.source) {
    let t3 = n2.branches.filter(t4 => t4.sourceEquipmentId === e3.sourceEquipmentId);
    t3.length && (e3.status = +!!t3.some(e4 => e4.status === 1));
  }
  return n2;
};
}
export const initializers = [
[427, ctx => { ctx.ts = e2 => {
  let t2 = typeof e2 == `number` ? e2 : typeof e2 == `string` && e2.trim() ? Number(e2) : NaN;
  return Number.isFinite(t2) ? t2 : null;
}; }],
[437, ctx => { ctx.ds = {
  tolerancePu: 1e-6,
  maxIterations: 40,
  maxQLimitRounds: 8,
  reactiveLimitsEnabled: true,
  initialVoltagePolicy: `FLAT`,
  minVoltagePu: 1e-3,
  maxVoltagePu: 8,
  loadModelProfile: `PSSE_SOURCE`,
  automaticAdjustments: false,
  maxAdjustmentRounds: 10,
  remoteRegulation: false,
  remoteChasing: false,
  maxRemoteRounds: 15,
  sourceUnits: `MVA_MVAR_DEG_PER_UNIT`
}; }],
[439, ctx => { ctx.ps = {
  voltageMagnitudePu: 1,
  loadVoltagePolicy: `SOURCE_SAVED`,
  includeRealShuntConsumption: true,
  realShuntVoltagePolicy: `SOURCE_SAVED`,
  referenceAnglePolicy: `FLAT_REFERENCE`,
  tapPolicy: `PSSE36_DCLF_COMPAT`
}; }]
];
