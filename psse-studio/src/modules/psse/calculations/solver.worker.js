import { isExtendedAction, validateExtendedOperation, applyExtendedOperation } from '../scenarios/operations.js';
(function () {
  let e = e2 => {
    let t2 = typeof e2 == `number` ? e2 : typeof e2 == `string` && e2.trim() ? Number(e2) : NaN;
    return Number.isFinite(t2) ? t2 : null;
  };
  function t(e2) {
    return e2 && typeof e2 == `object` && !Array.isArray(e2) ? e2 : null;
  }
  function n(n2, r2, i2, a2 = NaN) {
    let o2 = r2.toUpperCase();
    if (n2.source.format === `SAV` && i2 !== void 0) {
      let t2 = n2.binaryArrays?.Headre?.values;
      if (t2 && i2 < t2.length) return {
        value: e(t2[i2]),
        source: `SAV.Headre[${i2 + 1}]`,
        scalarPrecision: `F32`,
        explicit: true
      };
    }
    let s2 = [[n2.case.general, `source case GENERAL`], [n2.sourceTables.GENERAL?.[0], `sourceTables.GENERAL`], [n2.case, `source case`]];
    for (let [n3, r3] of s2) {
      let i3 = t(n3);
      if (i3) {
        for (let [t2, n4] of Object.entries(i3)) if (t2.toUpperCase() === o2 || o2 === `THRSHZ` && t2.toUpperCase() === `THRESHZ`) return {
          value: e(n4),
          source: `${r3}.${t2}`,
          scalarPrecision: `F64`,
          explicit: true
        };
      }
    }
    let c2 = n2.sourceTables.SYSTEM_WIDE;
    if (Array.isArray(c2)) for (let n3 of c2) {
      let r3 = t(n3);
      if (!r3) continue;
      let i3 = Array.isArray(r3.sourceTokens) ? r3.sourceTokens : [];
      if (String(i3[0] ?? r3.sourceField1 ?? ``).trim().toUpperCase() === `GENERAL`) for (let t2 of i3) {
        let n4 = typeof t2 == `string` ? t2.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i) : null;
        if (n4 && n4[1].toUpperCase() === o2) return {
          value: e(n4[2]),
          source: `RAW.SYSTEM_WIDE.GENERAL.${o2}`,
          scalarPrecision: `F64`,
          explicit: true
        };
      }
    }
    return {
      value: Number.isFinite(a2) ? a2 : null,
      source: `PSS/E 36.5 default ${o2}`,
      scalarPrecision: `F64`,
      explicit: false
    };
  }
  function r(e2) {
    let t2 = n(e2, `THRSHZ`, 11, 1e-4);
    return {
      valuePu: t2.value ?? NaN,
      source: t2.source,
      scalarPrecision: t2.scalarPrecision
    };
  }
  function i(e2, t2) {
    if (t2.kind !== `line` && t2.kind !== `switch`) return 0;
    let n2 = t2.fields.bp ?? t2.fields.bypass;
    if (n2 == null || n2 === ``) return e2.source.format === `SAV` ? null : 0;
    let r2 = typeof n2 == `boolean` ? +!!n2 : Number(n2);
    return Number.isFinite(r2) ? r2 : null;
  }
  function a(e2, t2, n2 = r(e2), a2) {
    let o2 = a2 ? a2.get(t2.sourceEquipmentId) : e2.equipment.find(e3 => e3.id === t2.sourceEquipmentId);
    return !o2 || o2.kind !== `switch` && o2.kind !== `line` || t2.rPu !== 0 || !Number.isFinite(t2.xPu) || n2.valuePu < 0 || i(e2, o2) !== 0 || n2.valuePu === 0 ? false : n2.scalarPrecision === `F32` ? Math.fround(Math.abs(t2.xPu)) <= Math.fround(n2.valuePu) : Math.abs(t2.xPu) <= n2.valuePu;
  }
  function o(e2, t2) {
    let n2 = new Set(t2.branches.filter(e3 => e3.status === 1).map(e3 => e3.sourceEquipmentId));
    return e2.equipment.filter(t3 => (t3.kind === `line` || t3.kind === `switch`) && n2.has(t3.id) && i(e2, t3) !== 0).map(e3 => e3.id);
  }
  function s(e2) {
    return [`INSPECTION_ONLY`, `UNSPECIFIED_BASE_KV`, `NO_ACTIVE_SLACK`, `SLACK_WITHOUT_ACTIVE_GENERATOR`, `ISLAND_WITHOUT_ACTIVE_SLACK`].includes(e2.code) || e2.code === `UNSUPPORTED_SOURCE_MODEL` && /^VOLTAGE_DROOP_CONTROL\s*:/i.test(e2.message);
  }
  function c(e2, t2, c2) {
    let u2 = e3 => e3.kind === `other` && (String(e3.fields.subtype ?? ``).trim().toLowerCase() === `voltage-droop` || String(e3.fields.sourceTable ?? ``).trim().toUpperCase() === `VOLTAGE_DROOP_CONTROL`),
      d2 = e2.findings.filter(e3 => e3.code === `UNSUPPORTED_SOURCE_MODEL`),
      f2 = d2.length > 0 && d2.every(e3 => /^VOLTAGE_DROOP_CONTROL\s*:/i.test(e3.message)) && e2.findings.every(s) && e2.equipment.some(u2),
      p2 = t2.findings.filter(e3 => c2 !== `LOSSLESS_DC` && !f2 || e3.code !== `SOURCE_MODEL_PARTIAL`),
      m2 = t2.buses.filter(e3 => e3.source && e3.status === 1),
      h2 = t2.buses.map(() => []),
      g2 = /* @__PURE__ */new Map();
    for (let t3 of e2.equipment) g2.has(t3.id) || g2.set(t3.id, t3);
    let _2 = new Set(t2.generators.filter(e3 => e3.status === 1).map(e3 => e3.bus)),
      v2 = r(e2),
      y2 = t2.branches.filter(e3 => {
        if (e3.status !== 1) return false;
        let t3 = g2.get(e3.sourceEquipmentId);
        return t3?.kind === `switch` || t3?.kind === `line`;
      }),
      b2 = y2.filter(e3 => e3.xPu === 0 && v2.valuePu === 0),
      x2 = y2.filter(t3 => a(e2, t3, v2, g2)),
      S2 = o(e2, t2),
      C2 = c2 === `LOSSLESS_DC` ? S2 : S2.filter(t3 => {
        let n2 = g2.get(t3);
        return !n2 || i(e2, n2) === null;
      }),
      w2 = n(e2, `PQBRAK`, 1, 0.7);
    (!Number.isFinite(v2.valuePu) || v2.valuePu < 0) && p2.push({
      severity: `ERROR`,
      code: `SYSTEM_SWITCH_THRESHOLD_INVALID`,
      message: `Source THRSHZ must be finite and nonnegative.`,
      equipment: y2[0]?.sourceEquipmentId
    }), b2.length && p2.push({
      severity: `ERROR`,
      code: `ZERO_X_WITH_ZIL_DISABLED`,
      message: `THRSHZ=0 disables zero-impedance line treatment; an active zero-X non-transformer branch cannot be interpreted in this profile.`,
      equipment: b2[0].sourceEquipmentId
    }), C2.length && p2.push({
      severity: `ERROR`,
      code: `ACTIVE_BYPASS_UNSUPPORTED`,
      message: c2 === `LOSSLESS_DC` ? `Lossless DC does not model BP/bypass branch status on ${C2.length} active branch(es).` : `${C2.length} active non-transformer branch(es) have an unknown BP/bypass state.`,
      equipment: C2[0]
    }), c2 !== `LOSSLESS_DC` && x2.length && p2.push({
      severity: `INFO`,
      code: `AC_IDEAL_LINK_CONTRACTION_REQUIRED`,
      message: `${x2.length} active non-transformer link(s) require equal-voltage contraction at THRSHZ=${v2.valuePu}.`
    }), c2 !== `LOSSLESS_DC` && (w2.value === null || !Number.isFinite(w2.value)) ? p2.push({
      severity: `ERROR`,
      code: `PSSE_PQBRAK_INVALID`,
      message: `Source PQBRAK is malformed or unavailable; the PSS/E low-voltage load break profile cannot be established.`
    }) : c2 !== `LOSSLESS_DC` && w2.explicit && (w2.scalarPrecision === `F32` ? Math.fround(w2.value) !== Math.fround(0.7) : w2.value !== 0.7) && p2.push({
      severity: `ERROR`,
      code: `PSSE_PQBRAK_UNSUPPORTED`,
      message: `Source PQBRAK=${w2.value} differs from the validated default 0.7; this AC profile does not implement that low-voltage load curve.`
    });
    let T2 = new Set(t2.generators.filter(e3 => e3.status === 1).flatMap(e3 => {
      let t3 = g2.get(e3.sourceEquipmentId),
        n2 = String(t3?.fields.droopname ?? ``).trim(),
        r2 = Number(t3?.fields.voltageDroopIndex ?? 0);
      return n2 || r2 !== 0 ? [e3.remoteBus ?? e3.bus] : [];
    }));
    for (let n2 of e2.equipment) {
      if (u2(n2) && n2.status === 1) {
        let e3 = String(n2.fields.regConnectionKey ?? n2.fields.regbus ?? n2.buses[0] ?? ``),
          r2 = t2.buses.findIndex(t3 => t3.connectionKey === e3 || String(t3.externalNumber) === e3),
          i2 = r2 >= 0 && T2.has(r2),
          a2 = c2 === `LOSSLESS_DC` ? `DC_REACTIVE_CONTROL_OMITTED` : i2 ? `VOLTAGE_DROOP_Q_FIXED_APPROXIMATION` : `VOLTAGE_DROOP_UNREFERENCED`,
          o2 = c2 === `LOSSLESS_DC` ? `Lossless DC fixes active-power injections and omits this known voltage-droop reactive control.` : i2 ? `An assigned voltage-droop curve is held at the source QG value in the FIXED_CONTROLS approximation.` : `The active voltage-droop record is not assigned to a machine and has no AC equation effect.`;
        p2.push({
          severity: `INFO`,
          code: a2,
          message: o2,
          equipment: n2.id
        });
      } else [`dc`, `facts`, `other`].includes(n2.kind) && n2.status !== 0 && p2.push({
        severity: `ERROR`,
        code: `ACTIVE_UNSUPPORTED_EQUIPMENT`,
        message: `${n2.kind} equipment ${n2.id} has no implemented ${c2} equations.`,
        equipment: n2.id
      });
      n2.kind === `switch` && n2.status !== 0 && !n2.id.startsWith(`switch:system:`) && p2.push({
        severity: `ERROR`,
        code: `ACTIVE_SWITCH_TOPOLOGY_UNSUPPORTED`,
        message: `Active node-breaker switch ${n2.id} requires validated bus contraction and terminal topology.`,
        equipment: n2.id
      }), n2.kind === `switch` && n2.status === null && p2.push({
        severity: `ERROR`,
        code: `SWITCH_STATUS_UNKNOWN`,
        message: `Switch status is unknown.`,
        equipment: n2.id
      });
    }
    for (let t3 of e2.equipment) [`line`, `transformer`, `generator`, `load`, `shunt`, `switch`].includes(t3.kind) && t3.status === null && p2.push({
      severity: `ERROR`,
      code: `EQUIPMENT_STATUS_UNKNOWN`,
      message: `Electrical equipment status is unknown; it cannot be assumed in or out of service.`,
      equipment: t3.id
    });
    for (let e3 of t2.branches) e3.status === 1 && (!t2.buses[e3.from]?.status || !t2.buses[e3.to]?.status) && p2.push({
      severity: `ERROR`,
      code: `ACTIVE_BRANCH_ON_OUT_OF_SERVICE_BUS`,
      message: `Active series branch ${e3.id} is connected to an out-of-service or IDE=4 bus.`,
      equipment: e3.sourceEquipmentId
    });
    for (let e3 of [t2.generators, t2.loads, t2.shunts]) for (let n2 of e3) n2.status === 1 && t2.buses[n2.bus]?.status !== 1 && p2.push({
      severity: `ERROR`,
      code: `ACTIVE_INJECTION_ON_OUT_OF_SERVICE_BUS`,
      message: `Active ${`pMw` in n2 ? `generator` : `bMvar` in n2 ? `shunt` : `load`} ${n2.id} is connected to an out-of-service or IDE=4 bus.`,
      equipment: n2.sourceEquipmentId
    });
    for (let t3 of e2.equipment) if (t3.kind === `load` && t3.status !== 0) {
      let e3 = Number(t3.fields.dgenm ?? t3.fields.distributedGenerationMode ?? 0),
        n2 = Number(t3.fields.dgenp ?? 0),
        r2 = Number(t3.fields.dgenq ?? 0);
      (e3 !== 0 || n2 !== 0 || r2 !== 0) && p2.push({
        severity: `ERROR`,
        code: `LOAD_EMBEDDED_GENERATION_UNSUPPORTED`,
        message: `Embedded load generation has nonzero mode or power and is not implemented.`,
        equipment: t3.id
      });
    }
    for (let t3 of e2.equipment) if (t3.kind === `generator` && t3.status === 1) {
      let e3 = Number(t3.fields.wmod ?? 0),
        n2 = String(t3.fields.droopname ?? ``).trim(),
        r2 = Number(t3.fields.voltageDroopIndex ?? 0);
      !Number.isInteger(e3) || e3 < 0 || e3 > 4 ? p2.push({
        severity: `ERROR`,
        code: `GENERATOR_WMOD_UNSUPPORTED`,
        message: `WMOD=${e3} has no implemented fixed-controls equation.`,
        equipment: t3.id
      }) : c2 === `LOSSLESS_DC` && (e3 !== 0 || n2 || r2 !== 0) ? p2.push({
        severity: `INFO`,
        code: `DC_REACTIVE_CONTROL_OMITTED`,
        message: `Lossless DC fixes source active-power injections and omits generator reactive/voltage controls.`,
        equipment: t3.id
      }) : c2 !== `LOSSLESS_DC` && (e3 === 1 || e3 === 2 || e3 === 3 || e3 === 4) && p2.push({
        severity: `INFO`,
        code: `GENERATOR_WMOD_MAPPED`,
        message: `WMOD=${e3} uses its documented P/Q limit or fixed-Q equation.`,
        equipment: t3.id
      }), c2 !== `LOSSLESS_DC` && (n2 || r2 !== 0) && p2.push({
        severity: `INFO`,
        code: `GENERATOR_DROOP_FIXED_Q_APPROXIMATION`,
        message: `Assigned generator voltage droop is held at source QG under FIXED_CONTROLS.`,
        equipment: t3.id
      });
    }
    for (let t3 of e2.equipment) t3.kind === `transformer` && t3.status !== 0 && (([`tab1`, `tab2`, `tab3`].some(e3 => Number(t3.fields[e3] ?? 0) !== 0) || Number(t3.fields.correctionTable ?? 0) !== 0 || Array.isArray(t3.fields.windings) && t3.fields.windings.some(e3 => Number(e3.correctionTable ?? 0) !== 0)) && p2.push({
      severity: `ERROR`,
      code: `TRANSFORMER_CORRECTION_TABLE_UNSUPPORTED`,
      message: `Nonzero impedance correction table is not applied to the transformer primitive.`,
      equipment: t3.id
    }), Number(t3.fields.connectionAngle ?? t3.fields.psalfa ?? 0) !== 0 && p2.push({
      severity: `ERROR`,
      code: `TRANSFORMER_CONNECTION_ANGLE_UNSUPPORTED`,
      message: `Nonzero transformer connection-angle semantics are not implemented.`,
      equipment: t3.id
    }), [`cod1`, `cod2`, `cod3`].some(e3 => Number(t3.fields[e3] ?? 0) !== 0) && p2.push({
      severity: `INFO`,
      code: `TRANSFORMER_CONTROL_HELD_FIXED`,
      message: `Source transformer control is held at its selected tap by the explicit FIXED_CONTROLS policy.`,
      equipment: t3.id
    }));
    let E2 = e2.completeness === `PARTIAL` && e2.findings.length > 0 && e2.findings.every(e3 => e3.code === `UNSPECIFIED_BASE_KV` || e3.code === `INSPECTION_ONLY`);
    e2.completeness === `PARTIAL` && !E2 && !f2 && !p2.some(e3 => e3.code === `SOURCE_MODEL_PARTIAL`) && p2.push({
      severity: `ERROR`,
      code: `SOURCE_MODEL_PARTIAL`,
      message: `Native source findings leave electrical records or packed controls unresolved.`
    });
    for (let e3 of t2.branches) e3.status === 1 && (h2[e3.from].push(e3.to), h2[e3.to].push(e3.from));
    let D2 = new Uint8Array(t2.buses.length),
      O2 = [];
    for (let e3 = 0; e3 < t2.buses.length; e3++) {
      if (D2[e3] || t2.buses[e3].status !== 1) continue;
      D2[e3] = 1;
      let n2 = [e3];
      for (let e4 = 0; e4 < n2.length; e4++) for (let t3 of h2[n2[e4]]) D2[t3] || (D2[t3] = 1, n2.push(t3));
      O2.push(n2);
    }
    for (let e3 of O2) {
      let n2 = e3.map(e4 => t2.buses[e4].id),
        r2 = e3.filter(e4 => t2.buses[e4].type === 3);
      if (r2.length !== 1 && p2.push({
        severity: `ERROR`,
        code: `ISLAND_REFERENCE_COUNT`,
        message: `Energized island [${n2.slice(0, 8).join(`, `)}] has ${r2.length} reference buses; exactly one is required.`
      }), r2.some(e4 => _2.has(e4)) || p2.push({
        severity: `ERROR`,
        code: `ISLAND_REFERENCE_SOURCE_MISSING`,
        message: `Reference bus has no active generator.`
      }), c2 !== `LOSSLESS_DC`) for (let n3 of e3) t2.buses[n3].type === 2 && !_2.has(n3) && p2.push({
        severity: `INFO`,
        code: `PV_WITHOUT_ACTIVE_GENERATOR_FIXED_PQ`,
        message: `PV bus ${t2.buses[n3].id} has no active local machine; FIXED_CONTROLS treats it as PQ.`,
        equipment: t2.buses[n3].sourceEquipmentId ?? void 0
      });
    }
    for (let e3 of t2.generators.filter(e4 => e4.status === 1)) {
      if (c2 === `LOSSLESS_DC`) {
        e3.remoteBus !== null && e3.remoteBus !== e3.bus && p2.push({
          severity: `INFO`,
          code: `DC_REACTIVE_CONTROL_OMITTED`,
          message: `Lossless DC fixes source active-power setpoints and does not model remote voltage regulation.`,
          equipment: e3.id
        });
        continue;
      }
      let n2 = l(e3, t2);
      n2 === `UNKNOWN` ? p2.push({
        severity: `ERROR`,
        code: `REMOTE_REGULATION_UNSUPPORTED`,
        message: `Generator regulation bus cannot be resolved.`,
        equipment: e3.id
      }) : n2 !== null && n2 !== e3.bus && p2.push({
        severity: `INFO`,
        code: `REMOTE_REGULATION_FIXED_Q_SOURCE_SAVED`,
        message: `Remote voltage regulation is held at the source QG value in the FIXED_CONTROLS approximation.`,
        equipment: e3.id
      });
    }
    return p2.some(e3 => e3.severity === `ERROR`) ? {
      method: c2,
      status: `BLOCKED`,
      findings: p2,
      energizedBusCount: m2.length,
      islandCount: O2.length
    } : {
      method: c2,
      status: p2.some(e3 => e3.severity === `WARNING`) ? `PARTIAL` : `READY`,
      findings: p2,
      energizedBusCount: m2.length,
      islandCount: O2.length
    };
  }
  function l(e2, t2) {
    let n2 = e2.remoteBus;
    return n2 === null ? null : Number.isInteger(n2) && n2 >= 0 && n2 < t2.buses.length ? n2 : `UNKNOWN`;
  }
  let u = e2 => e2 / 2 ** 32 | 0,
    d = e2 => e2 >>> 0;
  function f(e2, t2, n2, r2) {
    let i2 = u(n2),
      a2 = d(n2);
    e2.setUint32(t2, r2 ? a2 : i2, r2), e2.setUint32(t2 + 4, r2 ? i2 : a2, r2);
  }
  function p(e2) {
    return e2 instanceof Uint8Array || ArrayBuffer.isView(e2) && e2.constructor.name === `Uint8Array` && `BYTES_PER_ELEMENT` in e2 && e2.BYTES_PER_ELEMENT === 1;
  }
  let m = e2 => e2 ? `"${e2}" ` : ``;
  function h(e2, t2 = ``) {
    if (typeof e2 != `number`) throw TypeError(m(t2) + `expected number, got ` + typeof e2);
    if (!Number.isSafeInteger(e2) || e2 < 0) throw RangeError(m(t2) + `expected integer >= 0, got ` + e2);
    return e2;
  }
  function g(e2, t2, n2 = ``) {
    if (p(e2) && (t2 === void 0 || e2.length === t2)) return e2;
    t2 !== void 0 && h(t2, `length`);
    let r2 = p(e2),
      i2 = t2 === void 0 ? `` : ` of length ${t2}`,
      a2 = r2 ? `length=${e2.length}` : `type=${typeof e2}`,
      o2 = m(n2) + `expected Uint8Array` + i2 + `, got ` + a2;
    throw r2 ? RangeError(o2) : TypeError(o2);
  }
  let _ = (e2, t2) => {
      if (typeof e2 != `object` || !e2 || Array.isArray(e2)) throw TypeError((t2 === `object` ? `` : `"${t2}" `) + `expected object, got type=` + typeof e2);
    },
    v = (e2, t2) => {
      _(e2, t2);
      let n2 = Object.getPrototypeOf(e2);
      if (n2 !== Object.prototype && n2 !== null) throw TypeError(`"${t2}" expected plain object`);
      if (Object.hasOwn(e2, `__proto__`)) throw TypeError(`"${t2}.__proto__" is not allowed`);
    };
  function y(e2, t2 = true) {
    if (e2.destroyed) throw Error(`hash was destroyed`);
    if (t2 && e2.finished) throw Error(`digest() was already called`);
  }
  function b(e2, t2) {
    g(e2, void 0, `output`);
    let n2 = t2.outputLen;
    if (!(e2.length >= n2)) throw RangeError(`"output" expected length >= ` + n2);
  }
  function x(...e2) {
    for (let t2 = 0; t2 < e2.length; t2++) e2[t2].fill(0);
  }
  function S(e2) {
    return new DataView(e2.buffer, e2.byteOffset, e2.byteLength);
  }
  function C(e2, t2) {
    return e2 << 32 - t2 | e2 >>> t2;
  }
  function w(e2, t2, n2 = `opts`) {
    return v(e2, `defaults`), t2 !== void 0 && v(t2, n2), Object.assign(/* @__PURE__ */Object.create(null), e2, t2);
  }
  function T(e2, t2 = {}) {
    if (typeof e2 != `function`) throw TypeError(`"hashCons" expected function, got type=` + typeof e2);
    t2 = w({}, t2, `info`);
    let n2 = (t3, n3) => e2(n3).update(t3).digest(),
      r2 = e2(void 0);
    return n2.outputLen = r2.outputLen, n2.blockLen = r2.blockLen, n2.canXOF = r2.canXOF, n2.create = t3 => e2(t3), Object.assign(n2, t2), Object.freeze(n2);
  }
  let E = e2 => ({
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, e2])
  });
  function D(e2, t2, n2) {
    return e2 & t2 ^ ~e2 & n2;
  }
  function O(e2, t2, n2) {
    return e2 & t2 ^ e2 & n2 ^ t2 & n2;
  }
  var k = class {
    blockLen;
    outputLen;
    canXOF = false;
    padOffset;
    isLE;
    buffer;
    view;
    finished = false;
    length = 0;
    pos = 0;
    destroyed = false;
    constructor(e2, t2, n2, r2) {
      this.blockLen = e2, this.outputLen = t2, this.padOffset = n2, this.isLE = r2, this.buffer = new Uint8Array(e2), this.view = S(this.buffer);
    }
    update(e2) {
      y(this), g(e2);
      let {
          view: t2,
          buffer: n2,
          blockLen: r2
        } = this,
        i2 = e2.length,
        a2 = false;
      for (let o2 = 0; o2 < i2;) {
        let s2 = Math.min(r2 - this.pos, i2 - o2);
        if (s2 === r2) {
          let t3 = S(e2);
          for (; r2 <= i2 - o2; o2 += r2) this.process(t3, o2);
          a2 = true;
          continue;
        }
        n2.set(o2 === 0 && s2 === i2 ? e2 : e2.subarray(o2, o2 + s2), this.pos), this.pos += s2, o2 += s2, this.pos === r2 && (this.process(t2, 0), this.pos = 0, a2 = true);
      }
      return this.length += e2.length, a2 && this.roundClean(), this;
    }
    digestInto(e2) {
      y(this), b(e2, this), this.finished = true;
      let {
          buffer: t2,
          view: n2,
          blockLen: r2,
          isLE: i2
        } = this,
        {
          pos: a2
        } = this;
      t2[a2++] = 128, t2.fill(0, a2), this.padOffset > r2 - a2 && (this.process(n2, 0), t2.fill(0)), f(n2, r2 - 8, this.length * 8, i2), this.process(n2, 0), this.roundClean();
      let o2 = e2 === t2 ? n2 : S(e2),
        s2 = this.outputLen,
        c2 = s2 / 4,
        l2 = this.get();
      if (s2 % 4 || c2 > l2.length) throw Error(`invalid outputLen`);
      for (let e3 = 0; e3 < c2; e3++) o2.setUint32(4 * e3, l2[e3], i2);
    }
    digest() {
      let {
        buffer: e2,
        outputLen: t2
      } = this;
      this.digestInto(e2);
      let n2 = e2.slice(0, t2);
      return this.destroy(), n2;
    }
    _cloneIntoMeta(e2) {
      let {
        buffer: t2,
        length: n2,
        finished: r2,
        destroyed: i2,
        pos: a2
      } = this;
      return e2.destroyed = i2, e2.finished = r2, e2.length = n2, e2.pos = a2, a2 && e2.buffer.set(t2), e2;
    }
    clone() {
      return this._cloneInto();
    }
  };
  let A = /* @__PURE__ */Uint32Array.from([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]),
    j = /* @__PURE__ */Uint32Array.from([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]),
    M = /* @__PURE__ */new Uint32Array(64);
  var N = class extends k {
      A = 0;
      B = 0;
      C = 0;
      D = 0;
      E = 0;
      F = 0;
      G = 0;
      H = 0;
      constructor(e2, t2) {
        super(64, e2, 8, false), this.A = t2[0] | 0, this.B = t2[1] | 0, this.C = t2[2] | 0, this.D = t2[3] | 0, this.E = t2[4] | 0, this.F = t2[5] | 0, this.G = t2[6] | 0, this.H = t2[7] | 0;
      }
      get() {
        let {
          A: e2,
          B: t2,
          C: n2,
          D: r2,
          E: i2,
          F: a2,
          G: o2,
          H: s2
        } = this;
        return [e2, t2, n2, r2, i2, a2, o2, s2];
      }
      set(e2, t2, n2, r2, i2, a2, o2, s2) {
        this.A = e2 | 0, this.B = t2 | 0, this.C = n2 | 0, this.D = r2 | 0, this.E = i2 | 0, this.F = a2 | 0, this.G = o2 | 0, this.H = s2 | 0;
      }
      _cloneInto(e2) {
        return (e2 ||= new this.constructor()).set(...this.get()), this._cloneIntoMeta(e2);
      }
      process(e2, t2) {
        for (let n3 = 0; n3 < 16; n3++, t2 += 4) M[n3] = e2.getUint32(t2, false);
        for (let e3 = 16; e3 < 64; e3++) {
          let t3 = M[e3 - 15],
            n3 = M[e3 - 2],
            r3 = C(t3, 7) ^ C(t3, 18) ^ t3 >>> 3,
            i3 = C(n3, 17) ^ C(n3, 19) ^ n3 >>> 10;
          M[e3] = i3 + M[e3 - 7] + r3 + M[e3 - 16] | 0;
        }
        let {
          A: n2,
          B: r2,
          C: i2,
          D: a2,
          E: o2,
          F: s2,
          G: c2,
          H: l2
        } = this;
        for (let e3 = 0; e3 < 64; e3++) {
          let t3 = C(o2, 6) ^ C(o2, 11) ^ C(o2, 25),
            u2 = l2 + t3 + D(o2, s2, c2) + j[e3] + M[e3] | 0,
            d2 = (C(n2, 2) ^ C(n2, 13) ^ C(n2, 22)) + O(n2, r2, i2) | 0;
          l2 = c2, c2 = s2, s2 = o2, o2 = a2 + u2 | 0, a2 = i2, i2 = r2, r2 = n2, n2 = u2 + d2 | 0;
        }
        n2 = n2 + this.A | 0, r2 = r2 + this.B | 0, i2 = i2 + this.C | 0, a2 = a2 + this.D | 0, o2 = o2 + this.E | 0, s2 = s2 + this.F | 0, c2 = c2 + this.G | 0, l2 = l2 + this.H | 0, this.set(n2, r2, i2, a2, o2, s2, c2, l2);
      }
      roundClean() {
        x(M);
      }
      destroy() {
        this.destroyed = true, this.set(0, 0, 0, 0, 0, 0, 0, 0), x(this.buffer);
      }
    },
    P = class extends N {
      constructor() {
        super(32, A);
      }
    };
  let F = /* @__PURE__ */T(() => new P(), /* @__PURE__ */E(1)),
    I = e2 => Array.from(F(new TextEncoder().encode(e2)), e3 => e3.toString(16).padStart(2, `0`)).join(``),
    L = `GA_PSSE_ENGINE_4`;
  function R(e2) {
    if (Array.isArray(e2)) return e2.map(R);
    if (e2 && typeof e2 == `object`) return Object.fromEntries(Object.entries(e2).sort(([e3], [t2]) => e3.localeCompare(t2)).map(([e3, t2]) => [e3, R(t2)]));
    if (typeof e2 == `number` && !Number.isFinite(e2)) throw Error(`PSSE_OPTIONS_NONFINITE`);
    return e2;
  }
  function z(e2) {
    return I(JSON.stringify(R(e2)));
  }
  function B(e2) {
    let t2 = {
      schema: `ga.psse.calculation-identity.v1`,
      ...e2
    };
    return {
      ...t2,
      id: `psse-` + I(JSON.stringify(t2))
    };
  }
  function ee(e2) {
    return I(JSON.stringify({
      buses: e2.buses.map((e3, t2) => [t2, e3.connectionKey, e3.status, e3.type, e3.source]).sort((e3, t2) => String(e3[1]).localeCompare(String(t2[1]))),
      branches: e2.branches.map(e3 => [e3.id, e3.fromKey, e3.toKey, e3.windingId, e3.status, e3.kind]).sort((e3, t2) => String(e3[0]).localeCompare(String(t2[0])))
    }));
  }
  function V(e2) {
    return e2.status === `CONVERGED` ? e2.physicsCoverage === `SUPPORTED` ? `SOLVED_FULL` : `SOLVED_APPROXIMATE` : e2.status === `BLOCKED` ? e2.findings.some(e3 => e3.severity === `ERROR` && /UNSUPPORTED|UNIMPLEMENTED|NO_IMPLEMENTED|NOT_IMPLEMENTED/.test(e3.code)) ? `UNSUPPORTED_PHYSICS` : `INVALID_MODEL` : `NOT_CONVERGED`;
  }
  let te = e2 => Array.from(F(new TextEncoder().encode(e2)), e3 => e3.toString(16).padStart(2, `0`)).join(``);
  function ne(e2, t2 = []) {
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
      } else if (isExtendedAction(t3.action)) {
        validateExtendedOperation(e2, t3);
      } else throw Error(`PSSE_SCENARIO_ACTION_UNSUPPORTED:${t3.action}`);
    }
    let i2 = Object.freeze(n2.map(e3 => Object.freeze({
        ...e3
      }))),
      a2 = {
        schema: `ga.psse.scenario.v1`,
        networkHash: e2.modelHash,
        operations: i2
      },
      o2 = te(JSON.stringify(a2));
    return Object.freeze({
      ...a2,
      hash: o2
    });
  }
  function H(e2, t2) {
    let n2 = e2.generators.filter(e3 => e3.status === 1 && e3.bus === t2),
      r2 = n2.filter(e3 => e3.qControl === `FIXED_Q`),
      i2 = n2.filter(e3 => e3.qControl !== `FIXED_Q`),
      a2 = r2.reduce((e3, t3) => e3 + (t3.qFixedMvar ?? t3.qMvar), 0);
    return {
      units: n2,
      fixedUnits: r2,
      regulatingUnits: i2,
      fixedQ: a2,
      minimumQ: a2 + i2.reduce((e3, t3) => e3 + t3.qMinMvar, 0),
      maximumQ: a2 + i2.reduce((e3, t3) => e3 + t3.qMaxMvar, 0),
      specifiedQ: a2 + i2.reduce((e3, t3) => e3 + t3.qMvar, 0)
    };
  }
  function re(e2, t2, n2) {
    return {
      p: (e2.pMw + e2.ipMw * t2 + e2.ypMw * t2 * t2) / n2,
      q: (e2.qMvar + e2.iqMvar * t2 + e2.yqMvar * t2 * t2) / n2,
      dp: (e2.ipMw + 2 * e2.ypMw * t2) / n2,
      dq: (e2.iqMvar + 2 * e2.yqMvar * t2) / n2
    };
  }
  function ie(e2, t2, n2) {
    let r2 = [];
    for (let i2 of e2.loads) {
      if (i2.status !== 1) continue;
      let e3 = t2.vm[i2.bus],
        a2 = Math.abs(i2.pMw) > 1e-9 || Math.abs(i2.qMvar) > 1e-9,
        o2 = Math.abs(i2.ipMw) > 1e-9 || Math.abs(i2.iqMvar) > 1e-9;
      (a2 && e3 < 0.7 || o2 && e3 < 0.5) && r2.push({
        severity: n2 === `PSSE_SOURCE` ? `ERROR` : `WARNING`,
        code: n2 === `PSSE_SOURCE` ? `PSSE_LOW_VOLTAGE_LOAD_CURVE_UNSUPPORTED` : `GENERIC_ZIP_BELOW_PSSE_BREAKPOINT`,
        message: `Load ${i2.id} at ${e3.toFixed(4)} pu crosses a PSS/E low-voltage load characteristic breakpoint; this solver retains the polynomial ZIP law.`,
        equipment: i2.sourceEquipmentId
      });
    }
    return r2;
  }
  function U(e2, t2, n2, r2) {
    let i2 = e2.buses.length,
      a2 = new Float64Array(i2),
      o2 = new Float64Array(i2),
      s2 = new Float64Array(i2),
      c2 = new Float64Array(i2),
      l2 = new Float64Array(i2),
      u2 = new Float64Array(i2),
      d2 = e2.baseMva,
      f2 = new Float64Array(i2),
      p2 = new Float64Array(i2);
    for (let e3 = 0; e3 < i2; e3++) f2[e3] = n2.vm[e3] * Math.cos(n2.va[e3]), p2[e3] = n2.vm[e3] * Math.sin(n2.va[e3]);
    for (let e3 = 0; e3 < i2; e3++) {
      let n3 = 0,
        r3 = 0;
      for (let [i3, a3] of t2.rows[e3]) n3 += a3.re * f2[i3] - a3.im * p2[i3], r3 += a3.im * f2[i3] + a3.re * p2[i3];
      a2[e3] = f2[e3] * n3 + p2[e3] * r3, o2[e3] = p2[e3] * n3 - f2[e3] * r3;
    }
    for (let t3 of e2.loads) if (t3.status === 1) {
      let e3 = n2.vm[t3.bus],
        r3 = re(t3, e3, d2);
      s2[t3.bus] += r3.p, c2[t3.bus] += r3.q;
    }
    for (let t3 of e2.generators) t3.status === 1 && (l2[t3.bus] += t3.pMw / d2);
    for (let t3 = 0; t3 < i2; t3++) {
      l2[t3] -= s2[t3];
      let r3 = H(e2, t3);
      u2[t3] = (n2.qLimited.get(t3) ?? r3.specifiedQ / d2) - c2[t3];
    }
    let m2 = [],
      h2 = 0,
      g2 = 0,
      _2 = 0;
    for (let t3 = 0; t3 < i2; t3++) if (n2.busType[t3] !== 4 && e2.buses[t3].status === 1 && !r2.has(t3)) {
      let e3 = a2[t3] - l2[t3];
      m2.push(e3), h2 = Math.max(h2, Math.abs(e3)), _2 += e3 * e3;
    }
    for (let t3 = 0; t3 < i2; t3++) if (n2.busType[t3] === 1 && e2.buses[t3].status === 1) {
      let e3 = o2[t3] - u2[t3];
      m2.push(e3), g2 = Math.max(g2, Math.abs(e3)), _2 += e3 * e3;
    }
    return {
      p: a2,
      q: o2,
      loadP: s2,
      loadQ: c2,
      specP: l2,
      specQ: u2,
      f: m2,
      maxP: h2,
      maxQ: g2,
      norm: Math.sqrt(_2)
    };
  }
  Number.isFinite;
  function ae(e2, t2, n2) {
    for (let r2 = 0; r2 < e2.N; r2++) {
      let i2 = 0;
      for (let n3 = e2.rowPtr[r2]; n3 < e2.rowPtr[r2 + 1]; n3++) i2 += e2.values[n3] * t2[e2.colIdx[n3]];
      n2[r2] = i2;
    }
  }
  let W = function (e2) {
      let t2;
      typeof document < `u` && document.currentScript !== null && (t2 = document.currentScript.src ? new URL(document.currentScript.src, location.href).toString() : location.href);
      class n2 {
        static __wrap(e3) {
          let t3 = Object.create(n2.prototype);
          return t3.__wbg_ptr = e3, g2.register(t3, t3.__wbg_ptr, t3), t3;
        }
        __destroy_into_raw() {
          let e3 = this.__wbg_ptr;
          return this.__wbg_ptr = 0, g2.unregister(this), e3;
        }
        free() {
          let e3 = this.__destroy_into_raw();
          R2.__wbg_klucommon_free(e3, 0);
        }
        get btf() {
          return R2.klucommon_btf(this.__wbg_ptr);
        }
        get condest() {
          return R2.klucommon_condest(this.__wbg_ptr);
        }
        get flops() {
          return R2.klucommon_flops(this.__wbg_ptr);
        }
        get halt_if_singular() {
          return R2.klucommon_halt_if_singular(this.__wbg_ptr);
        }
        get initmem() {
          return R2.klucommon_initmem(this.__wbg_ptr);
        }
        get initmem_amd() {
          return R2.klucommon_initmem_amd(this.__wbg_ptr);
        }
        get maxwork() {
          return R2.klucommon_maxwork(this.__wbg_ptr);
        }
        get memgrow() {
          return R2.klucommon_memgrow(this.__wbg_ptr);
        }
        get mempeak() {
          return R2.klucommon_mempeak(this.__wbg_ptr) >>> 0;
        }
        get memusage() {
          return R2.klucommon_memusage(this.__wbg_ptr) >>> 0;
        }
        constructor() {
          let e3 = R2.klucommon_new();
          return this.__wbg_ptr = e3, g2.register(this, this.__wbg_ptr, this), this;
        }
        get noffdiag() {
          return R2.klucommon_noffdiag(this.__wbg_ptr);
        }
        get numerical_rank() {
          return R2.klucommon_numerical_rank(this.__wbg_ptr);
        }
        get ordering() {
          return R2.klucommon_ordering(this.__wbg_ptr);
        }
        get rcond() {
          return R2.klucommon_rcond(this.__wbg_ptr);
        }
        get rgrowth() {
          return R2.klucommon_rgrowth(this.__wbg_ptr);
        }
        get scale() {
          return R2.klucommon_scale(this.__wbg_ptr);
        }
        set btf(e3) {
          R2.klucommon_set_btf(this.__wbg_ptr, e3);
        }
        set halt_if_singular(e3) {
          R2.klucommon_set_halt_if_singular(this.__wbg_ptr, e3);
        }
        set initmem(e3) {
          R2.klucommon_set_initmem(this.__wbg_ptr, e3);
        }
        set initmem_amd(e3) {
          R2.klucommon_set_initmem_amd(this.__wbg_ptr, e3);
        }
        set maxwork(e3) {
          R2.klucommon_set_maxwork(this.__wbg_ptr, e3);
        }
        set memgrow(e3) {
          R2.klucommon_set_memgrow(this.__wbg_ptr, e3);
        }
        set ordering(e3) {
          R2.klucommon_set_ordering(this.__wbg_ptr, e3);
        }
        set scale(e3) {
          R2.klucommon_set_scale(this.__wbg_ptr, e3);
        }
        set tol(e3) {
          R2.klucommon_set_tol(this.__wbg_ptr, e3);
        }
        get singular_col() {
          return R2.klucommon_singular_col(this.__wbg_ptr);
        }
        get status() {
          return R2.klucommon_status(this.__wbg_ptr);
        }
        get structural_rank() {
          return R2.klucommon_structural_rank(this.__wbg_ptr);
        }
        get tol() {
          return R2.klucommon_tol(this.__wbg_ptr);
        }
        get work() {
          return R2.klucommon_work(this.__wbg_ptr);
        }
      }
      Symbol.dispose && (n2.prototype[Symbol.dispose] = n2.prototype.free), e2.KluCommon = n2;
      class r2 {
        static __wrap(e3) {
          let t3 = Object.create(r2.prototype);
          return t3.__wbg_ptr = e3, _2.register(t3, t3.__wbg_ptr, t3), t3;
        }
        __destroy_into_raw() {
          let e3 = this.__wbg_ptr;
          return this.__wbg_ptr = 0, _2.unregister(this), e3;
        }
        free() {
          let e3 = this.__destroy_into_raw();
          R2.__wbg_klunumeric_free(e3, 0);
        }
      }
      Symbol.dispose && (r2.prototype[Symbol.dispose] = r2.prototype.free), e2.KluNumeric = r2;
      class i2 {
        static __wrap(e3) {
          let t3 = Object.create(i2.prototype);
          return t3.__wbg_ptr = e3, v2.register(t3, t3.__wbg_ptr, t3), t3;
        }
        __destroy_into_raw() {
          let e3 = this.__wbg_ptr;
          return this.__wbg_ptr = 0, v2.unregister(this), e3;
        }
        free() {
          let e3 = this.__destroy_into_raw();
          R2.__wbg_klusymbolic_free(e3, 0);
        }
      }
      Symbol.dispose && (i2.prototype[Symbol.dispose] = i2.prototype.free), e2.KluSymbolic = i2;
      function a2(e3, t3, r3, a3) {
        let o3 = A2(t3, R2.__wbindgen_malloc),
          s3 = L2,
          c3 = A2(r3, R2.__wbindgen_malloc),
          l3 = L2;
        y2(a3, n2);
        let u3 = R2.klu_analyze(e3, o3, s3, c3, l3, a3.__wbg_ptr);
        if (u3[2]) throw N2(u3[1]);
        return i2.__wrap(u3[0]);
      }
      e2.klu_analyze = a2;
      function o2() {
        let e3 = R2.klu_defaults();
        return n2.__wrap(e3);
      }
      e2.klu_defaults = o2;
      function s2(e3, t3, a3, o3, s3) {
        let c3 = A2(e3, R2.__wbindgen_malloc),
          l3 = L2,
          u3 = A2(t3, R2.__wbindgen_malloc),
          d3 = L2,
          f3 = j2(a3, R2.__wbindgen_malloc),
          p3 = L2;
        y2(o3, i2), y2(s3, n2);
        let m3 = R2.klu_factor(c3, l3, u3, d3, f3, p3, o3.__wbg_ptr, s3.__wbg_ptr);
        if (m3[2]) throw N2(m3[1]);
        return r2.__wrap(m3[0]);
      }
      e2.klu_factor = s2;
      function c2(e3, t3) {
        return y2(e3, r2), y2(t3, n2), R2.klu_free_numeric(e3.__wbg_ptr, t3.__wbg_ptr);
      }
      e2.klu_free_numeric = c2;
      function l2(e3, t3) {
        return y2(e3, i2), y2(t3, n2), R2.klu_free_symbolic(e3.__wbg_ptr, t3.__wbg_ptr);
      }
      e2.klu_free_symbolic = l2;
      function u2(e3, t3, a3, o3, s3, c3) {
        let l3 = A2(e3, R2.__wbindgen_malloc),
          u3 = L2,
          d3 = A2(t3, R2.__wbindgen_malloc),
          f3 = L2,
          p3 = j2(a3, R2.__wbindgen_malloc),
          m3 = L2;
        y2(o3, i2), y2(s3, r2), y2(c3, n2);
        let h3 = R2.klu_refactor(l3, u3, d3, f3, p3, m3, o3.__wbg_ptr, s3.__wbg_ptr, c3.__wbg_ptr);
        if (h3[2]) throw N2(h3[1]);
        return h3[0];
      }
      e2.klu_refactor = u2;
      function d2(e3, t3, a3, o3, s3, c3) {
        y2(e3, i2), y2(t3, r2);
        var l3 = j2(s3, R2.__wbindgen_malloc),
          u3 = L2;
        y2(c3, n2);
        let d3 = R2.klu_solve(e3.__wbg_ptr, t3.__wbg_ptr, a3, o3, l3, u3, s3, c3.__wbg_ptr);
        if (d3[2]) throw N2(d3[1]);
        return d3[0];
      }
      e2.klu_solve = d2;
      function f2(e3, t3, a3, o3, s3, c3) {
        y2(e3, i2), y2(t3, r2);
        var l3 = j2(s3, R2.__wbindgen_malloc),
          u3 = L2;
        y2(c3, n2);
        let d3 = R2.klu_tsolve(e3.__wbg_ptr, t3.__wbg_ptr, a3, o3, l3, u3, s3, c3.__wbg_ptr);
        if (d3[2]) throw N2(d3[1]);
        return d3[0];
      }
      e2.klu_tsolve = f2;
      function p2() {
        R2.set_panic_hook();
      }
      e2.set_panic_hook = p2;
      function m2() {
        R2.start();
      }
      e2.start = m2;
      function h2() {
        return {
          __proto__: null,
          "./klu_js_bg.js": {
            __proto__: null,
            __wbg___wbindgen_copy_to_typed_array_4db0cbe2cc60dbee: function (e3, t3, n3) {
              new Uint8Array(n3.buffer, n3.byteOffset, n3.byteLength).set(b2(e3, t3));
            },
            __wbg___wbindgen_throw_344f42d3211c4765: function (e3, t3) {
              throw Error(T2(e3, t3));
            },
            __wbg_error_a6fa202b58aa1cd3: function (e3, t3) {
              let n3, r3;
              try {
                n3 = e3, r3 = t3, console.error(T2(e3, t3));
              } finally {
                R2.__wbindgen_free(n3, r3, 1);
              }
            },
            __wbg_new_227d7c05414eb861: function () {
              return /* @__PURE__ */Error();
            },
            __wbg_stack_3b0d974bbf31e44f: function (e3, t3) {
              let n3 = t3.stack,
                r3 = M2(n3, R2.__wbindgen_malloc, R2.__wbindgen_realloc),
                i3 = L2;
              S2().setInt32(e3 + 4, i3, true), S2().setInt32(e3 + 0, r3, true);
            },
            __wbindgen_cast_0000000000000001: function (e3, t3) {
              return T2(e3, t3);
            },
            __wbindgen_init_externref_table: function () {
              let e3 = R2.__wbindgen_externrefs,
                t3 = e3.grow(4);
              e3.set(0, void 0), e3.set(t3 + 0, void 0), e3.set(t3 + 1, null), e3.set(t3 + 2, true), e3.set(t3 + 3, false);
            }
          }
        };
      }
      let g2 = typeof FinalizationRegistry > `u` ? {
          register: () => {},
          unregister: () => {}
        } : new FinalizationRegistry(e3 => R2.__wbg_klucommon_free(e3, 1)),
        _2 = typeof FinalizationRegistry > `u` ? {
          register: () => {},
          unregister: () => {}
        } : new FinalizationRegistry(e3 => R2.__wbg_klunumeric_free(e3, 1)),
        v2 = typeof FinalizationRegistry > `u` ? {
          register: () => {},
          unregister: () => {}
        } : new FinalizationRegistry(e3 => R2.__wbg_klusymbolic_free(e3, 1));
      function y2(e3, t3) {
        if (!(e3 instanceof t3)) throw Error(`expected instance of ${t3.name}`);
      }
      function b2(e3, t3) {
        return e3 >>>= 0, k2().subarray(e3 / 1, e3 / 1 + t3);
      }
      let x2 = null;
      function S2() {
        return (x2 === null || x2.buffer.detached === true || x2.buffer.detached === void 0 && x2.buffer !== R2.memory.buffer) && (x2 = new DataView(R2.memory.buffer)), x2;
      }
      let C2 = null;
      function w2() {
        return (C2 === null || C2.byteLength === 0) && (C2 = new Float64Array(R2.memory.buffer)), C2;
      }
      function T2(e3, t3) {
        return F2(e3 >>> 0, t3);
      }
      let E2 = null;
      function D2() {
        return (E2 === null || E2.byteLength === 0) && (E2 = new Uint32Array(R2.memory.buffer)), E2;
      }
      let O2 = null;
      function k2() {
        return (O2 === null || O2.byteLength === 0) && (O2 = new Uint8Array(R2.memory.buffer)), O2;
      }
      function A2(e3, t3) {
        let n3 = t3(e3.length * 4, 4) >>> 0;
        return D2().set(e3, n3 / 4), L2 = e3.length, n3;
      }
      function j2(e3, t3) {
        let n3 = t3(e3.length * 8, 8) >>> 0;
        return w2().set(e3, n3 / 8), L2 = e3.length, n3;
      }
      function M2(e3, t3, n3) {
        if (n3 === void 0) {
          let n4 = I2.encode(e3),
            r4 = t3(n4.length, 1) >>> 0;
          return k2().subarray(r4, r4 + n4.length).set(n4), L2 = n4.length, r4;
        }
        let r3 = e3.length,
          i3 = t3(r3, 1) >>> 0,
          a3 = k2(),
          o3 = 0;
        for (; o3 < r3; o3++) {
          let t4 = e3.charCodeAt(o3);
          if (t4 > 127) break;
          a3[i3 + o3] = t4;
        }
        if (o3 !== r3) {
          o3 !== 0 && (e3 = e3.slice(o3)), i3 = n3(i3, r3, r3 = o3 + e3.length * 3, 1) >>> 0;
          let t4 = k2().subarray(i3 + o3, i3 + r3),
            a4 = I2.encodeInto(e3, t4);
          o3 += a4.written, i3 = n3(i3, r3, o3, 1) >>> 0;
        }
        return L2 = o3, i3;
      }
      function N2(e3) {
        let t3 = R2.__wbindgen_externrefs.get(e3);
        return R2.__externref_table_dealloc(e3), t3;
      }
      let P2 = new TextDecoder(`utf-8`, {
        ignoreBOM: true,
        fatal: true
      });
      P2.decode();
      function F2(e3, t3) {
        return P2.decode(k2().subarray(e3, e3 + t3));
      }
      let I2 = new TextEncoder();
      `encodeInto` in I2 || (I2.encodeInto = function (e3, t3) {
        let n3 = I2.encode(e3);
        return t3.set(n3), {
          read: e3.length,
          written: n3.length
        };
      });
      let L2 = 0,
        R2;
      function z2(e3, t3) {
        return R2 = e3.exports, x2 = null, C2 = null, E2 = null, O2 = null, R2.__wbindgen_start(), R2;
      }
      async function B2(e3, t3) {
        if (typeof Response == `function` && e3 instanceof Response) {
          if (typeof WebAssembly.instantiateStreaming == `function`) try {
            return await WebAssembly.instantiateStreaming(e3, t3);
          } catch (t4) {
            if (e3.ok && n3(e3.type) && e3.headers.get(`Content-Type`) !== `application/wasm`) console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", t4);else throw t4;
          }
          let r3 = await e3.arrayBuffer();
          return await WebAssembly.instantiate(r3, t3);
        }
        {
          let n4 = await WebAssembly.instantiate(e3, t3);
          return n4 instanceof WebAssembly.Instance ? {
            instance: n4,
            module: e3
          } : n4;
        }
        function n3(e4) {
          switch (e4) {
            case `basic`:
            case `cors`:
            case `default`:
              return true;
          }
          return false;
        }
      }
      function ee2(e3) {
        if (R2 !== void 0) return R2;
        e3 !== void 0 && (Object.getPrototypeOf(e3) === Object.prototype ? {
          module: e3
        } = e3 : console.warn("using deprecated parameters for `initSync()`; pass a single object instead"));
        let t3 = h2();
        return e3 instanceof WebAssembly.Module || (e3 = new WebAssembly.Module(e3)), z2(new WebAssembly.Instance(e3, t3), e3);
      }
      async function V2(e3) {
        if (R2 !== void 0) return R2;
        e3 !== void 0 && (Object.getPrototypeOf(e3) === Object.prototype ? {
          module_or_path: e3
        } = e3 : console.warn(`using deprecated parameters for the initialization function; pass a single object instead`)), e3 === void 0 && t2 !== void 0 && (e3 = t2.replace(/\.js$/, `_bg.wasm`));
        let n3 = h2();
        (typeof e3 == `string` || typeof Request == `function` && e3 instanceof Request || typeof URL == `function` && e3 instanceof URL) && (e3 = fetch(e3));
        let {
          instance: r3,
          module: i3
        } = await B2(await e3, n3);
        return z2(r3, i3);
      }
      return Object.assign(V2, {
        initSync: ee2
      }, e2);
    }({
      __proto__: null
    }),
    oe = false;
  function se() {
    if (oe) return;
    let e2 = Uint8Array.from(atob(`AGFzbQEAAAABygEaYAJ/fwF/YAJ/fwBgA39/fwF/YAF/AX9gAX8AYAF/AXxgAAN/f39gBH9/f38Bf2ADf39/AGAAAGACf3wAYAABf2AGf39/f39/AGAFf39/f38AYAh/f39/f39vfwN/f39gAAFvYAJ/bwBgA39/bwBgAn9/AW9gCH9/f39/f39/AX9gCX9/f39/f39/fwBgCH9/f39/f39/AGAJf39/f39/f39/A39/f2AIf39/f39/f38Df39/YAZ/f39/f38Df39/YAV/f39/fwF/AuwCBw4uL2tsdV9qc19iZy5qcxpfX3diZ19uZXdfMjI3ZDdjMDU0MTRlYjg2MQAPDi4va2x1X2pzX2JnLmpzHF9fd2JnX3N0YWNrXzNiMGQ5NzRiYmYzMWU0NGYAEA4uL2tsdV9qc19iZy5qcxxfX3diZ19lcnJvcl9hNmZhMjAyYjU4YWExY2QzAAEOLi9rbHVfanNfYmcuanMnX193YmdfX193YmluZGdlbl90aHJvd18zNDRmNDJkMzIxMWM0NzY1AAEOLi9rbHVfanNfYmcuanM1X193YmdfX193YmluZGdlbl9jb3B5X3RvX3R5cGVkX2FycmF5XzRkYjBjYmUyY2M2MGRiZWUAEQ4uL2tsdV9qc19iZy5qcx9fX3diaW5kZ2VuX2luaXRfZXh0ZXJucmVmX3RhYmxlAAkOLi9rbHVfanNfYmcuanMgX193YmluZGdlbl9jYXN0XzAwMDAwMDAwMDAwMDAwMDEAEgODAYEBAxMUBwQVAgcABwEAAQABCwEAAAwCAAAAAQcHDQwBAAEIAQEKCgoKAQEKAQgIAAQCAwUFAwUFBQUDAwMDAwUFAwMDAwUFDQALBAIDAgIACQAEAQQIABYABw4XDgcHGAQEBAQBAQEIAAgCAAAHAAEIAggCAgAACQkBAQEAAAEBAQkJBAkCcAEnJ28AgAgFAwEAEQYZA38BQYCAwAALfwBB6JTAAAt/AEGQlcAACwfNCDgGbWVtb3J5AgAUX193Ymdfa2x1Y29tbW9uX2ZyZWUAJBVfX3diZ19rbHVudW1lcmljX2ZyZWUAJhZfX3diZ19rbHVzeW1ib2xpY19mcmVlACYLa2x1X2FuYWx5emUAZAxrbHVfZGVmYXVsdHMATgprbHVfZmFjdG9yAGAQa2x1X2ZyZWVfbnVtZXJpYwAYEWtsdV9mcmVlX3N5bWJvbGljABkMa2x1X3JlZmFjdG9yAFwJa2x1X3NvbHZlAGEKa2x1X3Rzb2x2ZQBfDWtsdWNvbW1vbl9idGYANxFrbHVjb21tb25fY29uZGVzdAA4D2tsdWNvbW1vbl9mbG9wcwA5GmtsdWNvbW1vbl9oYWx0X2lmX3Npbmd1bGFyADoRa2x1Y29tbW9uX2luaXRtZW0AOxVrbHVjb21tb25faW5pdG1lbV9hbWQAPBFrbHVjb21tb25fbWF4d29yawA9EWtsdWNvbW1vbl9tZW1ncm93AD4Ra2x1Y29tbW9uX21lbXBlYWsAPxJrbHVjb21tb25fbWVtdXNhZ2UAQBJrbHVjb21tb25fbm9mZmRpYWcAQRhrbHVjb21tb25fbnVtZXJpY2FsX3JhbmsAQhJrbHVjb21tb25fb3JkZXJpbmcAQw9rbHVjb21tb25fcmNvbmQARBFrbHVjb21tb25fcmdyb3d0aABFD2tsdWNvbW1vbl9zY2FsZQBGEWtsdWNvbW1vbl9zZXRfYnRmACgea2x1Y29tbW9uX3NldF9oYWx0X2lmX3Npbmd1bGFyACkVa2x1Y29tbW9uX3NldF9pbml0bWVtACoZa2x1Y29tbW9uX3NldF9pbml0bWVtX2FtZAArFWtsdWNvbW1vbl9zZXRfbWF4d29yawAsFWtsdWNvbW1vbl9zZXRfbWVtZ3JvdwAtFmtsdWNvbW1vbl9zZXRfb3JkZXJpbmcALhNrbHVjb21tb25fc2V0X3NjYWxlAC8Ra2x1Y29tbW9uX3NldF90b2wAMBZrbHVjb21tb25fc2luZ3VsYXJfY29sAEcQa2x1Y29tbW9uX3N0YXR1cwBIGWtsdWNvbW1vbl9zdHJ1Y3R1cmFsX3JhbmsASQ1rbHVjb21tb25fdG9sAEoOa2x1Y29tbW9uX3dvcmsASw5zZXRfcGFuaWNfaG9vawBVBXN0YXJ0AFUNa2x1Y29tbW9uX25ldwBOBGZyZWUAVwZtYWxsb2MAUQdyZWFsbG9jACUPX19hYm9ydF9oYW5kbGVyAwEVX19pbnN0YW5jZV90ZXJtaW5hdGVkAwIPX193YmluZGdlbl9mcmVlAG4RX193YmluZGdlbl9tYWxsb2MAWxJfX3diaW5kZ2VuX3JlYWxsb2MAYxVfX3diaW5kZ2Vu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NgIMIAAgACgCAEEBayIANgIAIAANAiACQQxqEFkMAgsQfAALQdOKwABBPxB+AAsgAkEQaiQAC5wBAQJ/QQEgASABQQFNGyECAkACQCAARQRAIAFBd0sNASACQQhqIgBB+P///wdLDQEgAEEIEHoiAUUNAQwCCyAAQQhrIgMoAgAiAEF3Sw0AQQEgACAAQQFNG0EIaiIAQfj///8HSyABQXdLcg0AIAJBCGoiAUH4////B0sNACADIABBCCABEHIiAQ0BC0EADwsgASACNgIAIAFBCGoLoQEBAX8jAEEQayICJAACQAJAAkAgAUUEQCAARQ0BIABBCGsiASgCAEEBRw0CIAFBADYCACABQX9GDQMgAEEEayIAIAAoAgBBAWsiADYCACAADQMgAUEQQQQQdQwDCyAARQ0AIAIgAEEIayIANgIMIAAgACgCAEEBayIANgIAIAANAiACQQxqEGYMAgsQfAALQdOKwABBPxB+AAsgAkEQaiQAC4cBAQF/IwBBEGsiAyQAIAIgASACaiIBSwRAQQBBABBrAAsgA0EEaiAAKAIAIgIgACgCBEEIIAEgAkEBdCICIAEgAksbIgEgAUEITRsiAUEBQQEQIyADKAIEQQFGBEAgAygCCCADKAIMEGsACyADKAIIIQIgACABNgIAIAAgAjYCBCADQRBqJAALmAEBA38jAEEQayICJAACQAJAIAAEQCAAQQhrIgMgAygCAEEBaiIENgIAIARFDQEgACgCAA0CIABBfzYCACACIAM2AgwgAiAANgIIIAAoAgQgATYCKCACIABBBGo2AgQgACAAKAIAQQFqNgIAIAMgAygCAEEBayIANgIAIABFBEAgAkEMahBZCyACQRBqJAAPCxB8CwALEH0AC5gBAQN/IwBBEGsiAiQAAkACQCAABEAgAEEIayIDIAMoAgBBAWoiBDYCACAERQ0BIAAoAgANAiAAQX82AgAgAiADNgIMIAIgADYCCCAAKAIEIAE2AjwgAiAAQQRqNgIEIAAgACgCAEEBajYCACADIAMoAgBBAWsiADYCACAARQRAIAJBDGoQWQsgAkEQaiQADwsQfAsACxB9AAuYAQEDfyMAQRBrIgIkAAJAAkAgAARAIABBCGsiAyADKAIAQQFqIgQ2AgAgBEUNASAAKAIADQIgAEF/NgIAIAIgAzYCDCACIAA2AgggACgC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QYCVwAAoAgAiAUkNASAAIAFrIgBB+JTAACgCAE8NAUH0lMAAKAIAIABBAnRqQfyUwAAoAgA2AgBB/JTAACAANgIAQeyUwABB7JTAACgCAEEBajYCAAsPCwALQZyOwAAQZQALYwEBfyACBEAgAUUEQCACQX02AkBBAA8LIAAgARBWIgNFBEAgAkF+NgJAQQAPCyACIAIoAoABQQEgACAAQQFNGyABbGoiATYCgAEgAiACKAKEASIAIAEgACABSxs2AoQBCyADC2EBBH8CQAJAIAAEQCAAQQhrIgIgAigCACIDQQFqIgE2AgAgAUUNASAAKAIAIgFB/////wdPDQIgACABQQFqNgIAIAAoAgQoAiggACABNgIAIAIgAzYCAA8LEHwLAAsQfQALYwIDfwF8AkACQCAABEAgAEEIayICIAIoAgAiA0EBaiIBNgIAIAFFDQEgACgCACIBQf////8HTw0CIAAgAUEBajYCACAAKAIEKwNoIAAgATYCACACIAM2AgAPCxB8CwALEH0AC2MCA38BfAJAAkAgAARAIABBCGsiAiACKAIAIgNBAWoiATYCACABRQ0BIAAoAgAiAUH/////B08NAiAAIAFBAWo2AgAgACgCBCsDWCAAIAE2AgAgAiADNgIADwsQfAsACxB9AAthAQR/AkACQCAABEAgAEEIayICIAIoAgAiA0EBaiIBNgIAIAFFDQEgACgCACIBQf////8HTw0CIAAgAUEBajYCACAAKAIEKAI8IAAgATYCACACIAM2AgAPCxB8CwALEH0AC2MCA38BfAJAAkAgAARAIABBCGsiAiACKAIAIgNBAWoiATYCACABRQ0BIAAoAgAiAUH/////B08NAiAAIAFBAWo2AgAgACgCBCsDGCAAIAE2AgAgAiADNgIADwsQfAsACxB9AAtjAgN/AXwCQAJAIAAEQCAAQQhrIgIgAigCACIDQQFqIgE2AgAgAUUNASAAKAIAIgFB/////wdPDQIgACABQQFqNgIAIAAoAgQrAxAgACABNgIAIAIgAzYCAA8LEHwLAAsQfQALYwIDfwF8AkACQCAABEAgAEEIayICIAIoAgAiA0EBaiIBNgIAIAFFDQEgACgCACIBQf////8HTw0CIAAgAUEBajYCACAAKAIEKwMgIAAgATYCACACIAM2AgAPCxB8CwALEH0AC2MCA38BfAJAAkAgAARAIABBCGsiAiACKAIAIgNBAWoiATYCACABRQ0BIAAoAgAiAUH/////B08NAiAAIAFBAWo2AgAgACgCBCsDCCAAIAE2AgAgAiADNgIADwsQfAsACxB9AAtiAQR/AkACQCAABEAgAEEIayICIAIoAgAiA0EBaiIBNgIAIAFFDQEgACgCACIBQf////8HTw0CIAAgAUEBajYCACAAKAIEKAKEASAAIAE2AgAgAiADNgIADwsQfAsACxB9AAtiAQR/AkACQCAABEAgAEEIayICIAIoAgAiA0EBaiIBNgIAIAFFDQEgACgCACIBQf////8HTw0CIAAgAUEBajYCACAAKAIEKAKAASAAIAE2AgAgAiADNgIADwsQfAsACxB9AAthAQR/AkACQCAABEAgAEEIayICIAIoAgAiA0EBaiIBNgIAIAFFDQEgACgCACIBQf////8HTw0CIAAgAUEBajYCACAAKAIEKAJUIAAgATYCACACIAM2AgAPCxB8CwALEH0AC2EBBH8CQAJAIAAEQCAAQQhrIgIgAigCACIDQQFqIgE2AgAgAUUNASAAKAIAIgFB/////wdPDQIgACABQQFqNgIAIAAoAgQoAkwgACABNgIAIAIgAzYCAA8LEHwLAAsQfQALYQEEfwJAAkAgAARAIABBCGsiAiACKAIAIgNBAWoiATYCACABRQ0BIAAoAgAiAUH/////B08NAiAAIAFBAWo2AgAgACgCBCgCLCAAIAE2AgAgAiADNgIADwsQfAsACxB9AAtjAgN/AXwCQAJAIAAEQCAAQQhrIgIgAigCACIDQQFqIgE2AgAgAUUNASAAKAIAIgFB/////wdPDQIgACABQQFqNgIAIAAoAgQrA2AgACABNgIAIAIgAzYCAA8LEHwLAAsQfQALYwIDfwF8AkACQCAABEAgAEEIayICIAIoAgAiA0EBaiIBNgIAIAFFDQEgACgCACIBQf////8HTw0CIAAgAUEBajYCACAAKAIEKwNwIAAgATYCACACIAM2AgAPCxB8CwALEH0AC2EBBH8CQAJAIAAEQCAAQQhrIgIgAigCACIDQQFqIgE2AgAgAUUNASAAKAIAIgFB/////wdPDQIgACABQQFqNgIAIAAoAgQoAjAgACABNgIAIAIgAzYCAA8LEHwLAAsQfQALYQEEfwJAAkAgAARAIABBCGsiAiACKAIAIgNBAWoiATYCACABRQ0BIAAoAgAiAUH/////B08NAiAAIAFBAWo2AgAgACgCBCgCUCAAIAE2AgAgAiADNgIADwsQfAsACxB9AAthAQR/AkACQCAABEAgAEEIayICIAIoAgAiA0EBaiIBNgIAIAFFDQEgACgCACIBQf////8HTw0CIAAgAUEBajYCACAAKAIEKAJAIAAgATYCACACIAM2AgAPCxB8CwALEH0AC2EBBH8CQAJAIAAEQCAAQQhrIgIgAigCACIDQQFqIgE2AgAgAUUNASAAKAIAIgFB/////wdPDQIgACABQQFqNgIAIAAoAgQoAkggACABNgIAIAIgAzYCAA8LEHwLAAsQfQALYwIDfwF8AkACQCAABEAgAEEIayICIAIoAgAiA0EBaiIBNgIAIAFFDQEgACgCACIBQf////8HTw0CIAAgAUEBajYCACAAKAIEKwMAIAAgATYCACACIAM2AgAPCxB8CwALEH0AC2MCA38BfAJAAkAgAARAIABBCGsiAiACKAIAIgNBAWoiATYCACABRQ0BIAAoAgAiAUH/////B08NAiAAIAFBAWo2AgAgACgCBCsDeCAAIAE2AgAgAiADNgIADwsQfAsACxB9AAtbAQF/IwBBIGsiBSQAIAUgATYCBCAFIAA2AgAgBSADNgIMIAUgAjYCCCAFIAVBCGqtQoCAgIDQBIQ3AxggBSAFrUKAgICA4ASENwMQQZCDwAAgBUEQaiAEEFoAC0UBAX8jAEEQayICJAAgASAAKAIAIgBBf3NBH3YgACAAQR91IgFzIAFrIAJBBmoiARAPIgAgAWpBCiAAaxAKIAJBEGokAAu5AgECfwJAQYgBEAciAEUNACAAQQRrLQAAQQNxRQ0AIABBAEGIAfwLAAsCQCAABEAgAARAIABBATYCKCAAQoCAgICAgICSwAA3AxggAEKz5syZs+bM+T83AxAgAEKz5syZs+bM+T83AwggAEL808aX3cmYqD83AwAgAEEBNgI8IABCgICAgCA3AiwgAEIANwMgIABCgICAgICAgPi/fzcDcCAAQoCAgICAgID4v383A2ggAEKAgICAgICA+L9/NwNgIABCgICAgICAgPi/fzcDWCAAQX82AlQgAEJ/NwNIIABCADcDQCAAQgA3AjQgAEIANwOAASAAQgA3A3gLQRBBBBB6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DAMLIAdBAEwNAkEAIQMgHgRAIAIhASAdIQADQCABIBAgACgCAEEDdGoiBSsDADkDACABQQhqIAUgFUEDdCINaisDADkDACABQRBqIBAgAEEEaigCAEEDdGoiBSsDADkDACABQRhqIAUgDWorAwA5AwAgAUEgaiEBIABBCGohACAlIANBAmoiA0cNAAsgJEUNAwsgAiADQQR0aiIAIBAgHSADQQJ0aigCAEEDdGoiASsDADkDACAAIAEgFUEDdGorAwA5AwgMAgsgB0EATA0BQQAhAyAeQQNPBEAgAiEBIB0hAANAIAEgECAAKAIAQQN0aisDADkDACABQQhqIBAgAEEEaigCAEEDdGorAwA5AwAgAUEQaiAQIABBCGooAgBBA3RqKwMAOQMAIAFBGGogECAAQQxqKAIAQQN0aisDADkDACABQSBqIQEgAEEQaiEAIDwgA0EEaiIDRw0ACyArRQ0CCyAdIANBAnRqIQEgAiADQQN0aiEAICshAwNAIAAgECABKAIAQQN0aisDADkDACABQQRqIQEgAEEIaiEAIANBAWsiAw0ACwwBCyACIQEgHSEDIAciBUEATA0AA0AgASAQIAMoAgBBA3RqIgArAwA5AwAgAUEIaiAAIBVBA3RqKwMAOQMAIAFBEGogACAZaisDADkDACABQRhqIAAgMWorAwA5AwAgAUEgaiEBIANBBGohAyAFQQFrIgUNAAsLIDtBAEoEQEEAITMDQCA6IDMiAEEBaiIzQQJ0aigCACIRIDogAEECdCIYaigCACINayESAkAgAEUNAAJAAkACQAJAICwOBAMCAQAECyANIBFODQMgGyANQQJ0aigCACEBIA0hAANAIAIgAEEFdGoiFCsDACEJIBRBGGoiFisDACEIIBRBEGoiFysDACEKIBRBCGoiGisDACELIAEgGyAAQQFqIg9BAnRqKAIAIg5IBEAgDiABayEFICMgAUECdGohACAiIAFBA3RqIQMDQCAJIAMrAwAiDCACIAAoAgBBBXRqIgErAwCioSEJIAggDCABQRhqKwMAoqEhCCAKIAwgAUEQaisDAKKhIQogCyAMIAFBCGorAwCioSELIABBBGohACADQQhqIQMgBUEBayIFDQALCyAUIAk5AwAgFiAIOQMAIBcgCjkDACAaIAs5AwAgDiEBIA8iACARRw0ACwwDCyANIBFODQIgGyANQQJ0aigCACEAIA0hAQNAIAIgAUEYbGoiDysDACEJIA9BEGoiFisDACEIIA9BCGoiFysDACEKIAAgGyABQQFqIg5BAnRqKAIAIgNIBEAgAyAAayEFICMgAEECdGohASAiIABBA3RqIQADQCAJIAArAwAiCyACIAEoAgBBGGxqIhQrAwCioSEJIAggCyAUQRBqKwMAoqEhCCAKIAsgFEEIaisDAKKhIQogAUEEaiEBIABBCGohACAFQQFrIgUNAAsLIA8gCTkDACAWIAg5AwAgFyAKOQMAIAMhACAOIgEgEUcNAAsMAgsgDSARTg0BIBsgDUECdGooAgAhDyANIQUDQCACIAVBBHRqIg4rAwAhCCAOQQhqIhQrAwAhCQJAIA8iACAbIAVBAWoiBUECdGooAgAiD04NACAAQQFqIQEgDyAAa0EBcQRAIAggIiAAQQN0aisDACIKIAIgIyAAQQJ0aigCAEEEdGoiACsDAKKhIQggCSAKIABBCGorAwCioSEJIAEhAAsgASAPRg0AIA8gAGshAyAjIABBAnRqIQEgIiAAQQN0aiEAA0AgCCAAKwMAIgogAiABKAIAQQR0aiIWKwMAoqEgAEEIaisDACILIAIgAUEEaigCAEEEdGoiFysDAKKhIQggCSAKIBZBCGorAwCioSALIBdBCGorAwCioSEJIAFBCGohASAAQRBqIQAgA0ECayIDDQALCyAOIAg5AwAgFCAJOQMAIAUgEUcNAAsMAQsgDSARTg0AIBsgDUECdGooAgAhDiANIQ8DQAJAIA4iACAbIA8iA0EBaiIPQQJ0aigCACIOTg0AIABBAWohASACIANBA3RqIgMrAwAhCCAOIABrQQFxBEAgAyAIICIgAEEDdGorAwAgAiAjIABBAnRqKAIAQQN0aisDAKKhIgg5AwAgASEACyABIA5GDQAgDiAAayEFICIgAEEDdGohASAjIABBAnRqIQADQCADIAggASsDACACIAAoAgBBA3RqKwMAoqEiCDkDACADIAggAUEIaisDACACIABBBGooAgBBA3RqKwMAoqEiCDkDACABQRBqIQEgAEEIaiEAIAVBAmsiBQ0ACwsgDyARRw0ACwsCQCASQQFGBEAgOSANQQN0IgBqKwMAIQgCQAJAAkACQCAsDgQAAQIDBQsgACACaiIAIAArAwAgCKM5AwAM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gICAgICA+L9/NwOQASAKQoCAgICAgID4v383A4gBIApCgICAgICAgPi/fzcDgAEgCkKAgICAgICA+L9/NwN4IApCgICAgICAgPi/fzcDcCAKQoCAgICAgID4v383A2ggCkKAgICAgICA+L9/NwNgIApCgICAgICAgPi/fzcDWCAKQoCAgICAgID4v383A1AgCkKAgICAgICA+L9/NwNIIApCgICAgICAgPi/fzcDQCAKQoCAgICAgID4v383AzggCkKAgICAgICA+L9/NwMwIApCgICAgICAgPi/fzcDKCAKQoCAgICAgID4v383AyAgCkKAgICAgICA+L9/NwMYIApCgICAgICAgPi/fzcDECAKIAm3OQMIIApCADcDAAsCQAJAAn8gBkUgB0UgCUEASHJyQQEgFRsEQEF+IApFDQEaDAILQQAgCUUNAxogByAJQQJ0aigCACEbAkACQAJAIApFBEAgG0EATg0BQX4MBwsgCiAbtzkDECAbQQBODQEMBAtBfyAJQf7///8BSyAbQf7///8BS3INAhpBfiAJIAkgByAGECAiKEF+Rg0CGgwBCyAbQf////8BSSAJQf7///8BTXFFDQMgCSAJIAcgBhAgIihBfkcNAAwCCyAJQQQQViIOQQAgCUEEEFYiGRtFBEAgDhBXIBkQV0F/IApFDQEaDAMLIAlBAXQhLCAoQQFGBEAgCUEBaiIjQQQQViILQQAgG0EEEFYiCBtFBEAgCxBXIAgQVyAOEFcgGRBXQX8gCkUNAhoMBAsgByEMIAYhEkEAIQcCQCAJQQBKBEAgCUEDcSEAAkAgCUEETwRAIAlB/P///wdxIRQDQCAHIA5qIgZBADYCACAHIBlqIg9BfzYCACAGQQRqQQA2AgAgD0EEakF/NgIAIAZBCGpBADYCACAPQQhqQX82AgAgBkEMakEANgIAIA9BDGpBfzYCACAHQRBqIQcgFCANQQRqIg1HDQALIABFDQELIA4gDUECdCIGaiEHIAYgGWohBgNAIAdBADYCACAGQX82AgAgB0EEaiEHIAZBBGohBiAAQQFrIgANAAsLQQAhAANAAkAgDCAAIgZBAWoiAEECdGooAgAiDyAMIAZBAnRqKAIAIgdMDQAgB0EBaiENIA8gB2tBAXEEQCAGIBkgEiAHQQJ0aigCAEECdCIHaiIUKAIARwRAIAcgDmoiByAHKAIAQQFqNgIAIBQgBjYCAAsgDSEHCyANIA9GDQAgDyAHayEPIBIgB0ECdGohBwNAIAYgGSAHKAIAQQJ0Ig1qIhQoAgBHBEAgDSAOaiINIA0oAgBBAWo2AgAgFCAGNgIACyAGIBkgB0EEaigCAEECdCINaiIUKAIARwRAIA0gDmoiDSANKAIAQQFqNgIAIBQgBjYCAAsgB0EIaiEHIA9BAmsiDw0ACwsgACAJRw0AC0EAIQcgC0EANgIAIAlBA3EhDUEAIQACQCAJQQRPBEAgCUH8////B3EhH0EAIQYDQCAGIAtqIg9BBGogByAGIA5qIhQoAgBqIgc2AgAgD0EIaiAUQQRqKAIAIAdqIgc2AgAgD0EMaiAUQQhqKAIAIAdqIgc2AgAgD0EQaiAUQQxqKAIAIAdqIgc2AgAgBkEQaiEGIB8gAEEEaiIARw0ACyANRQ0BCyAOIABBAnQiAGohBiAAIAtqQQRqIQ8DQCAPIAYoAgAgB2oiBzYCACAGQQRqIQYgD0EEaiEPIA1BAWsiDQ0ACwsgCUEDcSENQQAhAAJAIAlBBE8EQCAJQfz///8HcSEfQQAhBwNAIAcgDmoiBiAHIAtqIg8oAgA2AgAgByAZaiIUQX82AgAgBkEEaiAPQQRqKAIANgIAIBRBBGpBfzYCACAGQQhqIA9BCGooAgA2AgAgFEEIakF/NgIAIAZBDGogD0EMaigCADYCACAUQQxqQX82AgAgB0EQaiEHIB8gAEEEaiIARw0ACyANRQ0BCyALIABBAnQiAGohByAAIA5qIQYgACAZaiEPA0AgBiAHKAIANgIAIA9BfzYCACAHQQRqIQcgBkEEaiEGIA9BBGohDyANQQFrIg0NAAsLQQAhAANAIAwgACIGQQFqIgBBAnRqKAIAIg0gDCAGQQJ0aigCACIHSgRAIA0gB2shDyASIAdBAnRqIQcDQCAGIBkgBygCAEECdCINaiIUKAIARwRAIA0gDmoiDSANKAIAIg1BAWo2AgAgCCANQQJ0aiAGNgIAIBQgBjYCAAsgB0EEaiEHIA9BAWsiDw0ACwsgACAJRw0ACwwBCyALQQA2AgALICMgLGpBASAbIBtBAU0baiEsIAshByAIIQYLQQAhI0EAIQ0gCgRAIApCgICAgICAgPi/fzcDmAEgCkKAgICAgICA+L9/NwOQASAKQoCAgICAgID4v383A4gBIApCgICAgICAgPi/fzcDgAEgCkKAgICAgICA+L9/NwN4IApCgICAgICAgPi/fzcDcCAKQoCAgICAgID4v383A2ggCkKAgICAgICA+L9/NwNgIApCgICAgICAgPi/fzcDWCAKQoCAgICAgID4v383A1AgCkKAgICAgICA+L9/NwNIIApCgICAgICAgPi/fzcDQCAKQoCAgICAgID4v383AzggCkKAgICAgICA+L9/NwMwIApCgICAgICAgPi/fzcDKCAKQoCAgICAgID4v383AyAgCkKAgICAgICA+L9/NwMYIApCgICAgICAgPi/fzcDECAKQoCAgICAgID4v383AwggCkIANwMACwJAIAlBAEwEQCAHIAlBAnRqKAIAIR8MAQsgCUECdCIABEAgDkEAIAD8CwALIAAgB2ooAgAhHwNAAkAgByANIg9BAnQiNGooAgAiEiAHIA1BAWoiDUECdGooAgAiG04NACAOIDRqITUDQAJAAkAgDyAGIBJBAnRqKAIAIgBKBEAgDiAAQQJ0IgxqIi0gLSgCAEEBajYCACA1IDUoAgBBAWo2AgAgDCAVaiI3KAIAIgAgByAMakEEaigCACIUTg0CIAYgAEECdGohDANAIAwoAgAiKSAPTg0CIA4gKUECdGoiKSApKAIAQQFqNgIAIC0gLSgCAEEBajYCACAMQQRqIQwgFCAAQQFqIgBHDQALIBQhAAwCCyAAIA9HDQMgI0EBaiEjIBJBAWohEgwDCyAPIClHDQAgKkEBaiEqIABBAWohAAsgNyAANgIAIBJBAWoiEiAbRw0ACyAbIRILIBUgNGogEjYCACAJIA1HDQALICq3IjggOKAhOEEAIRIDQCAVIBJBAnQiDWooAgAiACAHIBJBAWoiEkECdGoiDygCAEgEQCAGIABBAnRqIQwgDSAOaiENA0AgDiAMKAIAQQJ0aiIbIBsoAgBBAWo2AgAgDSANKAIAQQFqNgIAIAxBBGohDCAAQQFqIgAgDygCAEgNAAsLIAkgEkcNAAsLAkAgCUEATARAQQAhAAwBCyAJQQNxIRJBACEAQQAhDyAJQQRPBEAgCUH8////B3EhDSAOIQwDQCAMQQxqKAIAIAxBCGooAgAgDEEEaigCACAMKAIAIABqampqIQAgDEEQaiEMIA0gD0EEaiIPRw0ACyASRQ0BCyAO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czogdGhlIGxlbiBpcyDAEiBidXQgdGhlIGluZGV4IGlzIMAAwAI6IMAAL3J1c3RjL2U0MDg5NDdiZmQyMDBhZjQyZGIzMjJkYWYwZmFkZmU3ZTI2ZDNiZDEvbGlicmFyeS9hbGxvYy9zcmMvZm10LnJzAC9ydXN0Yy9lNDA4OTQ3YmZkMjAwYWY0MmRiMzIyZGFmMGZhZGZlN2UyNmQzYmQxL2xpYnJhcnkvY29yZS9zcmMvZm10L251bS5ycwBDOlxVc2Vyc1xyd2xpblwucnVzdHVwXHRvb2xjaGFpbnNcc3RhYmxlLXg4Nl82NC1wYy13aW5kb3dzLW1zdmNcbGliL3J1c3RsaWIvc3JjL3J1c3RcbGlicmFyeS9hbGxvYy9zcmMvc3RyaW5nLnJzAC9ydXN0Yy9lNDA4OTQ3YmZkMjAwYWY0MmRiMzIyZGFmMGZhZGZlN2UyNmQzYmQxL2xpYnJhcnkvc3RkL3NyYy9wYW5pY2tpbmcucnMAQzpcVXNlcnNccndsaW5cLmNhcmdvXHJlZ2lzdHJ5XHNyY1xpbmRleC5jcmF0ZXMuaW8tMTk0OWNmOGM2YjViNTU3Zlx3YXNtLWJpbmRnZW4tMC4yLjEyNlxzcmNcZXh0ZXJucmVmLnJzAEM6XFVzZXJzXHJ3bGluXC5ydXN0dXBcdG9vbGNoYWluc1xzdGFibGUteDg2XzY0LXBjLXdpbmRvd3MtbXN2Y1xsaWIvcnVzdGxpYi9zcmMvcnVzdFxsaWJyYXJ5L3N0ZC9zcmMvc3luYy9vbmNlLnJzAC9ydXN0Yy9lNDA4OTQ3YmZkMjAwYWY0MmRiMzIyZGFmMGZhZGZlN2UyNmQzYmQxL2xpYnJhcnkvYWxsb2Mvc3JjL3Jhd192ZWMvbW9kLnJzAC9ydXN0L2RlcHMvZGxtYWxsb2MtMC4yLjExL3NyYy9kbG1hbGxvYy5ycwBDOlxVc2Vyc1xyd2xpblwuY2FyZ29ccmVnaXN0cnlcc3JjXGluZGV4LmNyYXRlcy5pby0xOTQ5Y2Y4YzZiNWI1NTdmXGNvbnNvbGVfZXJyb3JfcGFuaWNfaG9vay0wLjEuN1xzcmNcbGliLnJzAMAUIGZhaWxlZCAoS0xVIHN0YXR1cyDAASkAAAAAQQQQAG0AAACVAAAADgAAAEIgbGVuZ3RoIG11c3QgZXF1YWwg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`), e3 => e3.charCodeAt(0));
    W.initSync({
      module: e2
    }), oe = true;
  }
  function ce(e2) {
    let t2 = e2.N,
      n2 = e2.colIdx.length,
      r2 = new Int32Array(t2 + 1),
      i2 = new Int32Array(n2),
      a2 = new Float64Array(n2);
    if (e2.rowPtr.length !== t2 + 1 || e2.values.length !== n2) throw Error(`SPARSE_DIRECT_INVALID_CSR`);
    for (let i3 = 0; i3 < n2; i3++) {
      let n3 = e2.colIdx[i3];
      if (n3 < 0 || n3 >= t2) throw Error(`SPARSE_DIRECT_INVALID_COLUMN`);
      r2[n3 + 1]++;
    }
    for (let e3 = 0; e3 < t2; e3++) r2[e3 + 1] += r2[e3];
    let o2 = Int32Array.from(r2);
    for (let n3 = 0; n3 < t2; n3++) for (let t3 = e2.rowPtr[n3]; t3 < e2.rowPtr[n3 + 1]; t3++) {
      let r3 = o2[e2.colIdx[t3]]++;
      i2[r3] = n3, a2[r3] = e2.values[t3];
    }
    return {
      ap: r2,
      ai: i2,
      ax: a2
    };
  }
  function le(e2, t2, n2) {
    let r2 = new Float64Array(e2.N);
    ae(e2, n2, r2);
    let i2 = 0,
      a2 = 0;
    for (let n3 = 0; n3 < e2.N; n3++) {
      let e3 = t2[n3] - r2[n3];
      i2 += e3 * e3, a2 += t2[n3] * t2[n3];
    }
    return Math.sqrt(i2) / Math.max(1e-14, Math.sqrt(a2));
  }
  var ue = class {
    diagnostics = {
      backend: `KLU_WASM`,
      dimension: 0,
      nnz: 0,
      ordering: `KLU_AMD`,
      cscConversionMs: 0,
      symbolicFactorMs: 0,
      numericFactorMs: 0,
      factorMs: 0,
      solveMs: 0,
      rhsCount: 0,
      factorizations: 0,
      failureStage: `NONE`,
      failureMessage: null
    };
    matrix = null;
    common = null;
    symbolic = null;
    numeric = null;
    factorize(e2) {
      if (this.matrix) throw Error(`SPARSE_DIRECT_ALREADY_FACTORIZED`);
      se();
      let t2 = performance.now(),
        n2 = ce(e2),
        r2 = performance.now();
      this.diagnostics.dimension = e2.N, this.diagnostics.nnz = e2.colIdx.length, this.diagnostics.cscConversionMs = r2 - t2;
      try {
        this.common = W.klu_defaults(), this.common.ordering = 0, this.symbolic = W.klu_analyze(e2.N, n2.ap, n2.ai, this.common);
        let t3 = performance.now();
        this.diagnostics.symbolicFactorMs = t3 - r2, this.numeric = W.klu_factor(n2.ap, n2.ai, n2.ax, this.symbolic, this.common), this.diagnostics.numericFactorMs = performance.now() - t3, this.diagnostics.factorMs = this.diagnostics.symbolicFactorMs + this.diagnostics.numericFactorMs, this.diagnostics.factorizations = 1, this.matrix = e2;
      } catch (e3) {
        throw this.diagnostics.failureStage = `FACTORIZE_THREW`, this.diagnostics.failureMessage = e3 instanceof Error ? e3.message : String(e3), this.dispose(), e3;
      }
    }
    solve(e2) {
      return this.solveMany([e2])[0];
    }
    solveMany(e2) {
      let t2 = this.matrix;
      if (!t2 || !this.common || !this.symbolic || !this.numeric) throw Error(`SPARSE_DIRECT_NOT_FACTORIZED`);
      if (!e2.length) return [];
      let n2 = t2.N,
        r2 = new Float64Array(n2 * e2.length);
      e2.forEach((e3, t3) => {
        if (e3.length !== n2) throw Error(`SPARSE_DIRECT_RHS_SIZE`);
        r2.set(e3, t3 * n2);
      });
      let i2 = performance.now(),
        a2 = 0;
      try {
        a2 = W.klu_solve(this.symbolic, this.numeric, n2, e2.length, r2, this.common);
      } catch (e3) {
        a2 = 0, this.diagnostics.failureStage = `SOLVE_THREW`, this.diagnostics.failureMessage = e3 instanceof Error ? e3.message : String(e3);
      }
      a2 !== 1 && this.diagnostics.failureStage === `NONE` && (this.diagnostics.failureStage = `SOLVE_STATUS_NONZERO`, this.diagnostics.failureMessage = `klu_solve returned status ${a2}`);
      let o2 = performance.now() - i2;
      return this.diagnostics.solveMs += o2, this.diagnostics.rhsCount += e2.length, e2.map((i3, s2) => {
        let c2 = a2 === 1 ? Float64Array.from(r2.subarray(s2 * n2, (s2 + 1) * n2)) : null,
          l2 = c2 ? le(t2, i3, c2) : null,
          u2 = c2 != null && l2 != null && Number.isFinite(l2) && l2 <= 1e-6;
        return {
          x: u2 ? c2 : null,
          trueResidual: l2,
          solveMs: o2 / e2.length,
          success: u2
        };
      });
    }
    dispose() {
      this.numeric && this.common && W.klu_free_numeric(this.numeric, this.common), this.symbolic && this.common && W.klu_free_symbolic(this.symbolic, this.common), this.common?.free(), this.numeric = null, this.symbolic = null, this.common = null, this.matrix = null;
    }
  };
  function G(e2) {
    let t2 = e2.length,
      n2 = new Int32Array(t2 + 1),
      r2 = [],
      i2 = [],
      a2 = [],
      o2 = new Int32Array(t2).fill(-1);
    for (let s2 = 0; s2 < t2; s2++) {
      let c2 = new Map(e2[s2]);
      c2.has(s2) || c2.set(s2, 0);
      for (let [e3, n3] of [...c2].sort((e4, t3) => e4[0] - t3[0])) {
        if (e3 < 0 || e3 >= t2 || !Number.isFinite(n3)) throw Error(`PSSE_SPARSE_INVALID_ENTRY`);
        let a3 = r2.length;
        r2.push(e3), i2.push(n3), e3 === s2 && (o2[s2] = a3);
      }
      n2[s2 + 1] = r2.length, a2.push(new Map([...c2.keys()].sort((e3, t3) => e3 - t3).map((e3, t3) => [e3, n2[s2] + t3])));
    }
    return {
      N: t2,
      rowPtr: n2,
      colIdx: Int32Array.from(r2),
      values: Float64Array.from(i2),
      pos: a2,
      diagPos: o2
    };
  }
  function K(e2, t2) {
    let n2 = new ue();
    try {
      n2.factorize(e2);
      let r2 = n2.solve(t2);
      return {
        x: r2.x,
        relativeResidual: r2.trueResidual,
        diagnostics: {
          ...n2.diagnostics
        }
      };
    } finally {
      n2.dispose();
    }
  }
  var de = class {
    matrix;
    factor = new ue();
    constructor(e2) {
      this.matrix = e2, this.factor.factorize(e2);
    }
    solve(e2) {
      let t2 = this.factor.solve(e2);
      return {
        x: t2.x,
        relativeResidual: t2.trueResidual,
        success: t2.success,
        diagnostics: {
          ...this.factor.diagnostics
        }
      };
    }
    dispose() {
      this.factor.dispose();
    }
  };
  function fe(e2, t2, n2, r2, i2) {
    let a2 = e2.buses.length,
      o2 = new Int32Array(a2).fill(-1),
      s2 = new Int32Array(a2).fill(-1),
      c2 = new Int32Array(a2).fill(-1),
      l2 = new Int32Array(a2).fill(-1),
      u2 = [],
      d2 = [],
      f2 = [];
    for (let t3 = 0; t3 < a2; t3++) n2.busType[t3] !== 4 && e2.buses[t3].status === 1 && !i2.has(t3) && (c2[t3] = u2.length, u2.push(t3));
    for (let t3 = 0; t3 < a2; t3++) n2.busType[t3] === 1 && e2.buses[t3].status === 1 && (l2[t3] = u2.length + d2.length, d2.push(t3));
    let p2 = u2.length + d2.length;
    for (let e3 of u2) o2[e3] = f2.length, f2.push(/* @__PURE__ */new Map());
    for (let e3 of d2) s2[e3] = f2.length, f2.push(/* @__PURE__ */new Map());
    if (f2.length !== p2) throw Error(`PSSE_JACOBIAN_DIMENSION_MISMATCH`);
    let m2 = (e3, t3, n3) => {
        e3 < 0 || t3 < 0 || f2[e3].set(t3, (f2[e3].get(t3) ?? 0) + n3);
      },
      h2 = e2.loads.filter(e3 => e3.status === 1).reduce((t3, r3) => {
        let i3 = t3.get(r3.bus) ?? {
            dp: 0,
            dq: 0
          },
          a3 = re(r3, n2.vm[r3.bus], e2.baseMva);
        return i3.dp += a3.dp, i3.dq += a3.dq, t3.set(r3.bus, i3), t3;
      }, /* @__PURE__ */new Map());
    for (let e3 = 0; e3 < a2; e3++) {
      let i3 = o2[e3],
        a3 = s2[e3];
      if (i3 < 0 && a3 < 0) continue;
      let u3 = n2.vm[e3],
        d3 = r2.p[e3],
        f3 = r2.q[e3],
        p3 = t2.rows[e3].get(e3) ?? {
          re: 0,
          im: 0
        },
        g2 = -f3 - p3.im * u3 * u3,
        _2 = d3 - p3.re * u3 * u3,
        v2 = d3 / u3 + p3.re * u3 + (h2.get(e3)?.dp ?? 0),
        y2 = f3 / u3 - p3.im * u3 + (h2.get(e3)?.dq ?? 0);
      for (let [r3, o3] of t2.rows[e3]) {
        if (e3 === r3) continue;
        let t3 = n2.vm[r3],
          s3 = n2.va[e3] - n2.va[r3],
          d4 = Math.cos(s3),
          f4 = Math.sin(s3),
          p4 = o3.re,
          h3 = o3.im;
        m2(i3, c2[r3], u3 * t3 * (p4 * f4 - h3 * d4)), m2(i3, l2[r3], u3 * (p4 * d4 + h3 * f4)), m2(a3, c2[r3], -u3 * t3 * (p4 * d4 + h3 * f4)), m2(a3, l2[r3], u3 * (p4 * f4 - h3 * d4));
      }
      m2(i3, c2[e3], g2), m2(a3, c2[e3], _2), m2(i3, l2[e3], v2), m2(a3, l2[e3], y2);
    }
    return {
      matrix: G(f2),
      pRow: o2,
      qRow: s2,
      angleColumn: c2,
      vmColumn: l2,
      angleBuses: u2,
      vmBuses: d2
    };
  }
  let pe = () => ({
    re: 0,
    im: 0
  });
  function me(e2, t2, n2, r2) {
    let i2 = e2[t2].get(n2) ?? pe();
    e2[t2].set(n2, {
      re: i2.re + r2.re,
      im: i2.im + r2.im
    });
  }
  function q(e2) {
    let t2 = e2.buses.map(() => /* @__PURE__ */new Map());
    for (let n2 of e2.branches) n2.status === 1 && (me(t2, n2.from, n2.from, n2.yff), me(t2, n2.from, n2.to, n2.yft), me(t2, n2.to, n2.from, n2.ytf), me(t2, n2.to, n2.to, n2.ytt));
    for (let n2 of e2.shunts) {
      if (n2.status !== 1) continue;
      let r2 = t2[n2.bus].get(n2.bus) ?? pe();
      t2[n2.bus].set(n2.bus, {
        re: r2.re + n2.gMw / e2.baseMva,
        im: r2.im + n2.bMvar / e2.baseMva
      });
    }
    return {
      rows: t2,
      nnz: t2.reduce((e3, t3) => e3 + t3.size, 0)
    };
  }
  function he(e2, t2, n2, r2, i2) {
    let a2 = /* @__PURE__ */new Map();
    for (let t3 of e2.generators) if (t3.status === 1) {
      let e3 = a2.get(t3.bus) ?? [];
      e3.push(t3), a2.set(t3.bus, e3);
    }
    let o2 = /* @__PURE__ */new Map();
    for (let [s2, c2] of a2) {
      let a3 = t2.busType[s2] === 3,
        l2 = t2.qLimited.has(s2),
        u2 = (n2.p[s2] + n2.loadP[s2]) * e2.baseMva,
        d2 = (n2.q[s2] + n2.loadQ[s2]) * e2.baseMva,
        f2 = H(e2, s2),
        p2 = f2.fixedUnits,
        m2 = f2.regulatingUnits,
        h2 = f2.fixedQ;
      m2.length > 1 && (a3 || t2.busType[s2] === 2 || l2) && i2.push({
        severity: `WARNING`,
        code: `PER_MACHINE_DISPATCH_UNAVAILABLE`,
        message: `${m2.length} regulating generators share bus ${e2.buses[s2].id}; the supported bus equations determine their aggregate Q, not individual machine dispatch.`
      });
      for (let e3 of p2) {
        let t3 = a3 ? null : e3.pMw;
        o2.set(e3.id, {
          id: e3.id,
          sourceEquipmentId: e3.sourceEquipmentId,
          pMw: t3,
          qMvar: e3.qFixedMvar ?? e3.qMaxMvar,
          limitState: `FIXED_Q`
        });
      }
      for (let e3 of m2) {
        let n3 = e3.qMvar,
          i3 = `FREE`;
        if (a3 ? n3 = c2.length === 1 ? d2 : null : m2.length === 1 && (t2.busType[s2] === 2 || l2) ? n3 = d2 - h2 : m2.length > 1 && (t2.busType[s2] === 2 || l2) && (n3 = null), r2 && m2.length === 1) {
          let r3 = t2.qState.get(s2);
          r3 === `QMIN` ? i3 = `QMIN` : r3 === `QMAX` ? i3 = `QMAX` : l2 && n3 !== null && (n3 <= e3.qMinMvar + 0.02 ? i3 = `QMIN` : n3 >= e3.qMaxMvar - 0.02 && (i3 = `QMAX`));
        }
        n3 === null && (i3 = `UNAVAILABLE`), o2.set(e3.id, {
          id: e3.id,
          sourceEquipmentId: e3.sourceEquipmentId,
          pMw: a3 ? c2.length === 1 ? u2 : null : e3.pMw,
          qMvar: n3,
          limitState: i3
        });
      }
    }
    return e2.generators.map(e3 => e3.status === 0 ? {
      id: e3.id,
      sourceEquipmentId: e3.sourceEquipmentId,
      pMw: null,
      qMvar: null,
      limitState: `UNAVAILABLE`
    } : o2.get(e3.id) ?? {
      id: e3.id,
      sourceEquipmentId: e3.sourceEquipmentId,
      pMw: null,
      qMvar: null,
      limitState: `UNAVAILABLE`
    });
  }
  function ge(e2, t2, n2, r2) {
    let i2 = t2 ? e2.from : e2.to,
      a2 = t2 ? e2.to : e2.from,
      o2 = t2 ? e2.yff : e2.ytt,
      s2 = t2 ? e2.yft : e2.ytf,
      c2 = r2.vm[i2],
      l2 = r2.vm[a2],
      u2 = r2.va[i2],
      d2 = r2.va[a2],
      f2 = c2 * Math.cos(u2),
      p2 = c2 * Math.sin(u2),
      m2 = l2 * Math.cos(d2),
      h2 = l2 * Math.sin(d2),
      g2 = (e3, t3, n3) => ({
        re: e3.re * t3 - e3.im * n3,
        im: e3.im * t3 + e3.re * n3
      }),
      _2 = g2(o2, f2, p2),
      v2 = g2(s2, m2, h2),
      y2 = _2.re + v2.re,
      b2 = _2.im + v2.im;
    return {
      p: (f2 * y2 + p2 * b2) * n2.baseMva,
      q: (p2 * y2 - f2 * b2) * n2.baseMva
    };
  }
  function _e(e2, t2, n2, r2, i2) {
    let a2 = e2.buses[r2 ? n2.from : n2.to],
      o2 = Math.hypot(i2.p, i2.q),
      s2 = t2.vm[r2 ? n2.from : n2.to],
      c2 = (r2 ? n2.ratingsFromSource : n2.ratingsToSource)[0] ?? null,
      l2 = (r2 || n2.kind === `line`) && n2.ratingBasis !== `UNKNOWN` && c2 !== null && c2 > 0 ? c2 : null;
    return {
      apparent: o2,
      current: a2.source && a2.baseKv !== null && Number.isFinite(a2.baseKv) && a2.baseKv > 0 && Number.isFinite(s2) && s2 > 0 ? o2 * 1e3 / (Math.sqrt(3) * a2.baseKv * s2) : null,
      limit: l2 !== null && a2.source && a2.baseKv !== null && a2.baseKv > 0 ? l2 * 1e3 / (Math.sqrt(3) * a2.baseKv) : null,
      loading: l2 === null ? null : o2 / (l2 * (n2.ratingBasis === `CURRENT_EXPRESSED_AS_MVA` ? s2 : 1)) * 100
    };
  }
  function ve(e2, t2, n2, r2, i2) {
    let a2 = _e(e2, t2, n2, true, r2),
      o2 = _e(e2, t2, n2, false, i2);
    return {
      id: n2.id,
      sourceEquipmentId: n2.sourceEquipmentId,
      terminalFrom: n2.terminalFrom,
      terminalTo: n2.terminalTo,
      pFromMw: r2.p,
      qFromMvar: r2.q,
      pToMw: i2.p,
      qToMvar: i2.q,
      pLossMw: r2.p + i2.p,
      qLossMvar: r2.q + i2.q,
      sFromMva: a2.apparent,
      sToMva: o2.apparent,
      iFromA: a2.current,
      iToA: o2.current,
      iFromLimitA: a2.limit,
      iToLimitA: o2.limit,
      loadingFromPct: a2.loading,
      loadingToPct: o2.loading,
      ratingBasis: n2.ratingBasis,
      ratingsFromSource: n2.ratingsFromSource,
      ratingsToSource: n2.ratingsToSource,
      loadingBasis: n2.ratingBasis === `UNKNOWN` ? `UNAVAILABLE` : n2.ratingBasis
    };
  }
  function ye(e2, t2) {
    return e2.branches.map(n2 => n2.status === 1 ? ve(e2, t2, n2, ge(n2, true, e2, t2), ge(n2, false, e2, t2)) : {
      id: n2.id,
      sourceEquipmentId: n2.sourceEquipmentId,
      terminalFrom: n2.terminalFrom,
      terminalTo: n2.terminalTo,
      pFromMw: null,
      qFromMvar: null,
      pToMw: null,
      qToMvar: null,
      pLossMw: null,
      qLossMvar: null,
      sFromMva: null,
      sToMva: null,
      iFromA: null,
      iToA: null,
      iFromLimitA: null,
      iToLimitA: null,
      loadingFromPct: null,
      loadingToPct: null,
      ratingBasis: n2.ratingBasis,
      ratingsFromSource: n2.ratingsFromSource,
      ratingsToSource: n2.ratingsToSource,
      loadingBasis: `UNAVAILABLE`
    });
  }
  let be = e2 => structuredClone(e2),
    xe = () => ({
      re: 0,
      im: 0
    }),
    Se = (e2, t2) => ({
      re: e2.re + t2.re,
      im: e2.im + t2.im
    }),
    Ce = (e2, t2) => ({
      re: e2.re - t2.re,
      im: e2.im - t2.im
    }),
    we = (e2, t2) => e2 !== null && t2 !== null && Math.abs(e2 - t2) <= Math.max(e2, t2) * 1e-9,
    Te = (e2, t2) => Math.hypot(e2.re - t2.re, e2.im - t2.im);
  function Ee(e2, t2, n2 = `SOURCE_SAVED`, r2 = false) {
    let i2 = be(t2),
      a2 = new Map(e2.equipment.map(e3 => [e3.id, e3])),
      o2 = e2.equipment.filter(e3 => e3.kind === `other` && (String(e3.fields.subtype ?? ``).toLowerCase() === `voltage-droop` || String(e3.fields.sourceTable ?? ``).toUpperCase() === `VOLTAGE_DROOP_CONTROL`) && e3.status === 1),
      s2 = new Set(o2.map(e3 => String(e3.name ?? ``).trim()).filter(Boolean)),
      c2 = new Set(o2.map(e3 => Number(e3.fields.savIndex ?? 0)).filter(e3 => e3 > 0)),
      l2 = [],
      u2 = {
        remoteQHeld: 0,
        droopQHeld: 0,
        wmod3FixedQ: 0,
        wmod4FixedQ: 0,
        localVoltageSetpointHeld: 0
      },
      d2 = /* @__PURE__ */new Map();
    for (let e3 of i2.generators) {
      let i3 = a2.get(e3.sourceEquipmentId);
      if (e3.status !== 1 || !i3) continue;
      let o3 = String(i3.fields.droopname ?? ``).trim(),
        f3 = Number(i3.fields.voltageDroopIndex ?? 0),
        p2 = o3 && s2.has(o3) || f3 !== 0 && c2.has(f3);
      if (e3.remoteBus !== null && e3.remoteBus !== e3.bus && e3.remoteBus >= 0 && e3.qControl !== `FIXED_Q`) {
        if (r2) {
          let t3 = d2.get(e3.remoteBus) ?? {
            machines: [],
            remoteBus: e3.remoteBus,
            vsPu: e3.vsPu
          };
          t3.machines.push(e3.id), t3.vsPu === null && (t3.vsPu = e3.vsPu), d2.set(e3.remoteBus, t3), e3.qControl = `FIXED_Q`, e3.qFixedMvar = e3.qMvar;
        } else e3.qControl = `FIXED_Q`, e3.qFixedMvar = e3.qMvar, e3.qMinMvar = e3.qMvar, e3.qMaxMvar = e3.qMvar, u2.remoteQHeld++, l2.push({
          severity: `INFO`,
          code: `REMOTE_REGULATION_FIXED_Q_SOURCE_SAVED`,
          message: `Remote IREG voltage control is approximated by holding this machine at its source QG and solving its terminal bus as PQ.`,
          equipment: e3.sourceEquipmentId
        });
      }
      p2 && e3.qControl !== `FIXED_Q` && (e3.qControl = `FIXED_Q`, e3.qFixedMvar = e3.qMvar, e3.qMinMvar = e3.qMvar, e3.qMaxMvar = e3.qMvar, u2.droopQHeld++, l2.push({
        severity: `INFO`,
        code: `GENERATOR_DROOP_FIXED_Q_SOURCE_SAVED`,
        message: `The assigned Q(V) curve is approximated by holding this machine at its source QG.`,
        equipment: e3.sourceEquipmentId
      }));
      let m2 = t2.buses[e3.bus];
      n2 === `SOURCE_SAVED` && !r2 && e3.qControl === `REGULATING` && (e3.remoteBus === null || e3.remoteBus === e3.bus) && m2?.type === 2 && m2.initialVm !== null && e3.vsPu !== null && Math.abs(m2.initialVm - e3.vsPu) > 1e-5 && (u2.localVoltageSetpointHeld++, l2.push({
        severity: `INFO`,
        code: `LOCAL_REGULATION_SOURCE_SAVED_VOLTAGE_HELD`,
        message: `Local voltage regulator setpoint ${e3.vsPu.toFixed(6)} pu differs from saved bus voltage ${m2.initialVm.toFixed(6)} pu; SOURCE_SAVED holds the saved voltage in this fixed-controls profile.`,
        equipment: e3.sourceEquipmentId
      })), e3.wmod === 3 ? u2.wmod3FixedQ++ : e3.wmod === 4 && u2.wmod4FixedQ++;
    }
    let f2 = new Set(i2.generators.filter(e3 => e3.status === 1).map(e3 => {
      let t3 = a2.get(e3.sourceEquipmentId);
      return String(t3?.fields.droopname ?? ``).trim() || String(t3?.fields.voltageDroopIndex ?? `0`);
    }));
    for (let e3 of o2) {
      let t3 = String(e3.fields.savIndex ?? `0`),
        n3 = String(e3.name ?? ``).trim();
      !f2.has(t3) && !f2.has(n3) && l2.push({
        severity: `INFO`,
        code: `VOLTAGE_DROOP_UNREFERENCED`,
        message: `This active Q(V) record is not referenced by any active machine and has no steady-state equation effect.`,
        equipment: e3.id
      });
    }
    return {
      network: i2,
      findings: l2,
      counts: u2,
      remoteGroups: [...d2.values()]
    };
  }
  function De(e2) {
    let t2 = e2.rPu * e2.rPu + e2.xPu * e2.xPu;
    return !(t2 > 0) || !Number.isFinite(t2) ? xe() : {
      re: e2.rPu / t2,
      im: -e2.xPu / t2
    };
  }
  function Oe(e2) {
    let t2 = e2.initialVm !== null && e2.initialVm > 0 ? e2.initialVm : 1,
      n2 = (e2.initialVaDeg ?? 0) * Math.PI / 180;
    return {
      re: t2 * Math.cos(n2),
      im: t2 * Math.sin(n2)
    };
  }
  function ke(e2, t2) {
    let n2 = [],
      s2 = r(e2),
      c2 = new Map(e2.equipment.map(e3 => [e3.id, e3])),
      l2 = t2.branches.filter(t3 => {
        if (t3.status !== 1) return false;
        let n3 = c2.get(t3.sourceEquipmentId),
          r2 = n3 ? i(e2, n3) : 0;
        return a(e2, t3, s2, c2) || r2 !== null && r2 !== 0;
      }),
      u2 = Int32Array.from({
        length: t2.buses.length
      }, (e3, t3) => t3),
      d2 = new Uint8Array(t2.buses.length),
      f2 = e3 => {
        let t3 = e3;
        for (; u2[t3] !== t3;) t3 = u2[t3];
        for (; u2[e3] !== e3;) {
          let n3 = u2[e3];
          u2[e3] = t3, e3 = n3;
        }
        return t3;
      },
      p2 = (e3, t3) => {
        let n3 = f2(e3),
          r2 = f2(t3);
        n3 !== r2 && (d2[n3] < d2[r2] && ([n3, r2] = [r2, n3]), u2[r2] = n3, d2[n3] === d2[r2] && d2[n3]++);
      },
      m2 = [];
    for (let r2 of l2) {
      let a2 = t2.buses[r2.from],
        o2 = t2.buses[r2.to],
        s3 = c2.get(r2.sourceEquipmentId),
        l3 = s3 ? i(e2, s3) : 0,
        u3 = l3 !== null && l3 !== 0;
      if (!a2 || !o2 || a2.status !== 1 || o2.status !== 1 || r2.from === r2.to || !we(a2.baseKv, o2.baseKv) || r2.tapFrom !== 1 || r2.tapTo !== 1 || r2.phaseDeg !== 0) {
        n2.push({
          severity: `ERROR`,
          code: `AC_IDEAL_LINK_TERMINAL_INCOMPATIBLE`,
          message: `Ideal link ${r2.id} cannot be contracted: active terminals with equal kV bases, unity taps and zero phase are required.`,
          equipment: r2.sourceEquipmentId
        });
        continue;
      }
      if (!u3 && r2.rPu !== 0) {
        n2.push({
          severity: `ERROR`,
          code: `AC_IDEAL_LINK_SERIES_RESISTANCE`,
          message: `Ideal link ${r2.id} has nonzero series resistance without BP bypass.`,
          equipment: r2.sourceEquipmentId
        });
        continue;
      }
      p2(r2.from, r2.to), m2.push(r2);
    }
    let h2 = /* @__PURE__ */new Map(),
      g2 = [],
      _2 = new Int32Array(t2.buses.length);
    for (let e3 = 0; e3 < t2.buses.length; e3++) {
      let n3 = t2.buses[e3].status === 1 ? f2(e3) : e3,
        r2 = h2.get(n3);
      r2 === void 0 && (r2 = g2.length, h2.set(n3, r2), g2.push([])), g2[r2].push(e3), _2[e3] = r2;
    }
    let v2 = new Set(m2.map(e3 => e3.id)),
      y2 = /* @__PURE__ */new Map();
    for (let e3 of m2) {
      let t3 = De(e3),
        n3 = Ce(e3.yff, t3),
        r2 = Ce(e3.ytt, t3);
      y2.set(e3.id, {
        from: n3,
        to: r2
      });
    }
    let b2 = g2.map((e3, r2) => {
        let i2 = e3.filter(e4 => t2.buses[e4].status === 1),
          a2 = i2.filter(e4 => t2.buses[e4].type === 3),
          o2 = new Set(i2.map(e4 => t2.buses[e4].type)),
          s3 = Ae(t2, e3),
          c3 = e3.find(e4 => t2.buses[e4].source) ?? e3[0],
          l3 = t2.buses[c3],
          u3 = i2.map(e4 => Oe(t2.buses[e4])),
          d3 = u3.length ? u3.reduce((e4, t3) => Se(e4, t3), xe()) : Oe(l3);
        u3.length && (d3.re /= u3.length, d3.im /= u3.length);
        let f3 = 0;
        for (let e4 of u3) Te(e4, d3) > 1e-5 && f3++;
        f3 && n2.push({
          severity: `WARNING`,
          code: `AC_IDEAL_LINK_SOURCE_VOLTAGE_DISAGREEMENT`,
          message: `${f3} source voltage(s) differ inside ideal-link node ${l3.id}; the initial node voltage is the complex-voltage average.`
        }), a2.length > 1 && n2.push({
          severity: `ERROR`,
          code: `AC_CONTRACTED_REFERENCE_COLLISION`,
          message: `Ideal-link node ${l3.id} contains ${a2.length} reference buses.`,
          equipment: l3.sourceEquipmentId ?? void 0
        });
        let p3 = i2.length === 0 ? 4 : a2.length === 1 ? 3 : o2.has(2) && s3 ? 2 : 1;
        return {
          ...l3,
          id: i2.length > 1 ? `ac-node:${l3.id}` : l3.id,
          connectionKey: i2.length > 1 ? `@ac:${r2}` : l3.connectionKey,
          externalNumber: i2.length > 1 ? null : l3.externalNumber,
          sourceEquipmentId: i2.length > 1 ? null : l3.sourceEquipmentId,
          baseKv: l3.baseKv,
          type: p3,
          status: +!!i2.length,
          initialVm: Math.hypot(d3.re, d3.im),
          initialVaDeg: Math.atan2(d3.im, d3.re) * 180 / Math.PI,
          source: i2.some(e4 => t2.buses[e4].source),
          fieldMap: i2.length > 1 ? [] : l3.fieldMap
        };
      }),
      x2 = t2.branches.filter(e3 => e3.status !== 1 || !v2.has(e3.id)).map(e3 => ({
        ...e3,
        from: _2[e3.from],
        to: _2[e3.to]
      }));
    for (let e3 of m2) {
      let t3 = y2.get(e3.id);
      if (Math.hypot(t3.from.re, t3.from.im) + Math.hypot(t3.to.re, t3.to.im) < 1e-15) continue;
      let n3 = _2[e3.from];
      x2.push({
        ...e3,
        id: `@ac-zil-shunt:${e3.id}`,
        sourceEquipmentId: `@ac-zil-shunt:${e3.sourceEquipmentId}`,
        kind: `line`,
        from: n3,
        to: n3,
        rPu: 1,
        xPu: 0,
        yff: t3.from,
        yft: xe(),
        ytf: xe(),
        ytt: t3.to,
        ratingBasis: `UNKNOWN`,
        ratingsFromSource: Array(12).fill(null),
        ratingsToSource: Array(12).fill(null),
        rateMva: null,
        terminalFrom: `@ac:${n3}`,
        terminalTo: `@ac:${n3}`,
        fieldMap: []
      });
    }
    let S2 = t2.generators.map(e3 => ({
        ...e3,
        bus: _2[e3.bus],
        remoteBus: e3.remoteBus === null ? null : e3.remoteBus >= 0 ? _2[e3.remoteBus] : -1
      })),
      C2 = t2.loads.map(e3 => ({
        ...e3,
        bus: _2[e3.bus]
      })),
      w2 = t2.shunts.map(e3 => ({
        ...e3,
        bus: _2[e3.bus]
      })),
      T2 = {
        ...t2,
        buses: b2,
        branches: x2,
        generators: S2,
        loads: C2,
        shunts: w2
      },
      E2 = /* @__PURE__ */new Map();
    for (let e3 of m2) {
      let t3 = f2(e3.from),
        n3 = E2.get(t3);
      n3 || (n3 = {
        buses: g2[_2[e3.from]].slice(),
        branches: []
      }, E2.set(t3, n3)), n3.branches.push(e3);
    }
    let D2 = [...E2.values()],
      O2 = 0,
      k2 = 0;
    for (let e3 of D2) k2 += e3.buses.length, O2 += Math.max(0, e3.branches.length - e3.buses.length + 1);
    let A2 = o(e2, t2).filter(t3 => i(e2, c2.get(t3)) === null);
    for (let e3 of A2) n2.push({
      severity: `ERROR`,
      code: `ACTIVE_BYPASS_UNSUPPORTED`,
      message: `Active branch BP/bypass state is missing or invalid.`,
      equipment: e3
    });
    return {
      network: T2,
      busToNode: _2,
      nodeBuses: g2,
      idealBranches: m2,
      idealBranchShunts: y2,
      components: D2,
      findings: n2,
      counts: {
        contractedBranchCount: m2.length,
        contractedBusCount: k2,
        nodeCount: g2.length,
        cycleRank: O2,
        sourceVoltageDisagreementCount: n2.filter(e3 => e3.code === `AC_IDEAL_LINK_SOURCE_VOLTAGE_DISAGREEMENT`).length
      }
    };
  }
  function Ae(e2, t2) {
    let n2 = new Set(t2);
    return e2.generators.some(e3 => e3.status === 1 && n2.has(e3.bus) && e3.qControl === `REGULATING`);
  }
  function je(e2, t2, n2, r2, i2, a2) {
    let o2 = new Map(i2.map(e3 => [e3.sourceEquipmentId, e3])),
      s2 = /* @__PURE__ */new Map(),
      c2 = /* @__PURE__ */new Map();
    for (let e3 of t2.generators) if (e3.status === 1) {
      let t3 = c2.get(e3.bus) ?? [];
      t3.push(e3), c2.set(e3.bus, t3);
    }
    let l2 = /* @__PURE__ */new Map();
    for (let n3 of e2.network.generators) if (n3.status === 1) {
      if (!t2.generators.find(e4 => e4.sourceEquipmentId === n3.sourceEquipmentId)) continue;
      let e3 = l2.get(n3.bus) ?? [],
        r3 = o2.get(n3.sourceEquipmentId);
      e3.push({
        g: n3,
        result: r3 ?? {
          id: n3.id,
          sourceEquipmentId: n3.sourceEquipmentId,
          pMw: null,
          qMvar: null,
          limitState: `UNAVAILABLE`
        },
        p: r3?.pMw ?? null,
        q: r3?.qMvar ?? null
      }), l2.set(n3.bus, e3);
    }
    let u2 = 0;
    for (let [e3, i3] of l2) {
      let a3 = (r2.p[e3] + r2.loadP[e3]) * t2.baseMva,
        o3 = (r2.q[e3] + r2.loadQ[e3]) * t2.baseMva,
        s3 = (t3, r3) => {
          let a4 = i3.filter(e4 => e4[t3] !== null),
            o4 = i3.filter(e4 => e4[t3] === null),
            s4 = a4.reduce((e4, n3) => e4 + n3[t3], 0);
          if (!o4.length) {
            if (a4.length) {
              let a5 = i3.find(r4 => n2.busType[e3] === 3 && r4[t3] !== null);
              a5 && (a5[t3] = a5[t3] + r3 - s4);
            }
            return;
          }
          u2++;
          let c3 = o4.map(e4 => Math.max(e4.g.participation, 0) || 1),
            l3 = c3.reduce((e4, t4) => e4 + t4, 0) || o4.length;
          for (let e4 = 0; e4 < o4.length; e4++) o4[e4][t3] = (r3 - s4) * c3[e4] / l3;
        };
      s3(`p`, a3), s3(`q`, o3);
    }
    for (let e3 of l2.values()) for (let n3 of e3) {
      let e4 = t2.generators.find(e5 => e5.sourceEquipmentId === n3.g.sourceEquipmentId)?.bus;
      if (e4 === void 0) continue;
      let r3 = s2.get(e4) ?? {
        p: 0,
        q: 0
      };
      r3.p += n3.p ?? 0, r3.q += n3.q ?? 0, s2.set(e4, r3);
    }
    let d2 = new Map(a2.map(e3 => [e3.id, e3])),
      f2 = new Set(e2.idealBranches.map(e3 => e3.id)),
      p2 = /* @__PURE__ */new Map(),
      m2 = /* @__PURE__ */new Map();
    for (let e3 of t2.loads) if (e3.status === 1) {
      let t3 = n2.vm[e3.bus],
        r3 = e3.pMw + e3.ipMw * t3 + e3.ypMw * t3 * t3,
        i3 = e3.qMvar + e3.iqMvar * t3 + e3.yqMvar * t3 * t3,
        a3 = m2.get(e3.bus) ?? {
          p: 0,
          q: 0
        };
      a3.p += r3, a3.q += i3, m2.set(e3.bus, a3);
    }
    for (let e3 of t2.shunts) if (e3.status === 1) {
      let t3 = n2.vm[e3.bus],
        r3 = p2.get(e3.bus) ?? {
          p: 0,
          q: 0
        };
      r3.p += e3.gMw * t3 * t3, r3.q -= e3.bMvar * t3 * t3, p2.set(e3.bus, r3);
    }
    let h2 = /* @__PURE__ */new Map();
    for (let n3 of e2.components) for (let r3 of n3.buses) {
      let n4 = s2.get(r3) ?? {
          p: 0,
          q: 0
        },
        i3 = m2.get(r3) ?? {
          p: 0,
          q: 0
        },
        a3 = p2.get(r3) ?? {
          p: 0,
          q: 0
        },
        o3 = n4.p - i3.p - a3.p,
        c3 = n4.q - i3.q - a3.q;
      for (let e3 of t2.branches) if (e3.status === 1 && !f2.has(e3.id)) {
        let t3 = d2.get(e3.id);
        if (!t3) continue;
        e3.from === r3 && (o3 -= t3.pFromMw ?? 0, c3 -= t3.qFromMvar ?? 0), e3.to === r3 && (o3 -= t3.pToMw ?? 0, c3 -= t3.qToMvar ?? 0);
      }
      for (let t3 of e2.idealBranches) if (t3.from === r3 || t3.to === r3) {
        let e3 = d2.get(t3.id);
        if (!e3) continue;
        t3.from === r3 && (o3 -= e3.pFromMw ?? 0, c3 -= e3.qFromMvar ?? 0), t3.to === r3 && (o3 -= e3.pToMw ?? 0, c3 -= e3.qToMvar ?? 0);
      }
      h2.set(r3, {
        p: o3,
        q: c3
      });
    }
    let g2 = /* @__PURE__ */new Map(),
      _2 = 0;
    for (let t3 of e2.components) {
      let {
        buses: e3,
        branches: n3
      } = t3;
      if (n3.length === e3.length - 1) {
        let t4 = /* @__PURE__ */new Map();
        for (let n4 of e3) t4.set(n4, []);
        for (let e4 of n3) t4.get(e4.from).push({
          next: e4.to,
          edge: e4
        }), t4.get(e4.to).push({
          next: e4.from,
          edge: e4
        });
        let r4 = e3[0],
          i3 = /* @__PURE__ */new Map([[r4, -1]]),
          a3 = /* @__PURE__ */new Map(),
          o3 = [r4];
        for (let e4 = 0; e4 < o3.length; e4++) for (let {
          next: n4,
          edge: r5
        } of t4.get(o3[e4]) ?? []) i3.has(n4) || (i3.set(n4, o3[e4]), a3.set(n4, r5), o3.push(n4));
        if (o3.length !== e3.length) throw Error(`AC_IDEAL_LINK_TREE_TOPOLOGY_INVALID`);
        let s3 = /* @__PURE__ */new Map();
        for (let e4 = o3.length - 1; e4 > 0; e4--) {
          let t5 = o3[e4],
            n4 = h2.get(t5),
            r5 = {
              p: n4.p + (s3.get(t5)?.p ?? 0),
              q: n4.q + (s3.get(t5)?.q ?? 0)
            },
            c3 = i3.get(t5),
            l3 = a3.get(t5);
          s3.set(t5, r5);
          let u3 = l3.from === c3 ? -1 : 1;
          g2.set(l3.id, {
            p: u3 * r5.p,
            q: u3 * r5.q
          });
          let d3 = s3.get(c3) ?? {
            p: 0,
            q: 0
          };
          d3.p += r5.p, d3.q += r5.q, s3.set(c3, d3);
        }
      } else {
        let t4 = e3[0],
          r4 = e3.slice(1),
          i3 = new Map(r4.map((e4, t5) => [e4, t5])),
          a3 = r4.map(() => /* @__PURE__ */new Map()),
          o3 = new Float64Array(r4.length),
          s3 = new Float64Array(r4.length);
        for (let e4 = 0; e4 < r4.length; e4++) {
          let t5 = r4[e4],
            n4 = h2.get(t5);
          o3[e4] = n4.p, s3[e4] = n4.q;
        }
        for (let e4 of n3) {
          let t5 = i3.get(e4.from),
            n4 = i3.get(e4.to),
            r5 = Number.isFinite(e4.xPu) && e4.xPu !== 0 ? 1 / Math.abs(e4.xPu) : 1;
          t5 !== void 0 && (a3[t5].set(t5, (a3[t5].get(t5) ?? 0) + r5), n4 !== void 0 && a3[t5].set(n4, (a3[t5].get(n4) ?? 0) - r5)), n4 !== void 0 && (a3[n4].set(n4, (a3[n4].get(n4) ?? 0) + r5), t5 !== void 0 && a3[n4].set(t5, (a3[n4].get(t5) ?? 0) - r5));
        }
        let c3 = G(a3),
          l3 = K(c3, o3),
          u3 = K(c3, s3);
        if (!l3.x || !u3.x || l3.relativeResidual === null || u3.relativeResidual === null || l3.relativeResidual > 1e-7 || u3.relativeResidual > 1e-7) throw Error(`AC_IDEAL_LINK_CYCLE_RECOVERY_FAILED`);
        let d3 = /* @__PURE__ */new Map([[t4, 0]]),
          f3 = /* @__PURE__ */new Map([[t4, 0]]);
        r4.forEach((e4, t5) => {
          d3.set(e4, l3.x[t5]), f3.set(e4, u3.x[t5]);
        });
        for (let e4 of n3) {
          let t5 = Number.isFinite(e4.xPu) && e4.xPu !== 0 ? 1 / Math.abs(e4.xPu) : 1;
          g2.set(e4.id, {
            p: t5 * (d3.get(e4.from) - d3.get(e4.to)),
            q: t5 * (f3.get(e4.from) - f3.get(e4.to))
          });
        }
      }
      let r3 = /* @__PURE__ */new Map();
      for (let t4 of e3) r3.set(t4, {
        p: 0,
        q: 0
      });
      for (let e4 of n3) {
        let t4 = g2.get(e4.id);
        r3.get(e4.from).p += t4.p, r3.get(e4.from).q += t4.q, r3.get(e4.to).p -= t4.p, r3.get(e4.to).q -= t4.q;
      }
      for (let t4 of e3) {
        let e4 = h2.get(t4),
          n4 = r3.get(t4);
        _2 = Math.max(_2, Math.hypot(e4.p - n4.p, e4.q - n4.q));
      }
    }
    return {
      machineByBus: s2,
      idealFlows: g2,
      maxIdealKclResidualMva: _2,
      idealCycleRank: e2.counts.cycleRank,
      allocationApproximationCount: u2
    };
  }
  function Me(e2, t2, n2) {
    let r2 = new Map(e2.equipment.map(e3 => [e3.id, e3])),
      i2 = e2.equipment.filter(e3 => e3.kind === `other` && e3.status === 1 && (String(e3.fields.subtype ?? ``).toLowerCase() === `voltage-droop` || String(e3.fields.sourceTable ?? ``).toUpperCase() === `VOLTAGE_DROOP_CONTROL`)),
      a2 = [];
    for (let e3 of t2.generators) {
      if (e3.status !== 1 || e3.qControl !== `REGULATING` || t2.buses[e3.bus].type !== 2 || e3.vsPu === null) continue;
      let n3 = r2.get(e3.sourceEquipmentId),
        o3 = String(n3?.fields.droopname ?? ``).trim(),
        s3 = Number(n3?.fields.voltageDroopIndex ?? 0),
        c2 = i2.find(e4 => o3 !== `` && String(e4.name).trim() === o3 || s3 > 0 && Number(e4.fields.savIndex) === s3),
        l2 = {
          ...e3,
          controlTarget: e3.remoteBus !== null && e3.remoteBus >= 0 ? e3.remoteBus : e3.bus
        };
      if (c2) {
        let e4 = c2.fields,
          n4 = Number(e4.regbus ?? 0),
          r3 = String(e4.regConnectionKey ?? n4),
          i3 = t2.buses.findIndex(e5 => e5.connectionKey === r3 || e5.externalNumber === n4);
        n4 !== 0 && i3 >= 0 && (l2.controlTarget = i3);
        let a3 = {
          name: c2.name,
          qmin: Number(e4.qmin),
          qmax: Number(e4.qmax),
          qdb: Number(e4.qdb),
          vlow: Number(e4.vlow),
          vdblow: Number(e4.vdblow),
          vdbhigh: Number(e4.vdbhigh),
          vhigh: Number(e4.vhigh)
        };
        if (Object.values(a3).filter(e5 => typeof e5 == `number`).every(Number.isFinite) && a3.vlow < a3.vdblow && a3.vdblow <= a3.vdbhigh && a3.vdbhigh < a3.vhigh && a3.qmin < a3.qdb && a3.qdb < a3.qmax) l2.curve = a3;else continue;
      }
      a2.push(l2);
    }
    let o2 = new Set(a2.map(e3 => e3.id)),
      s2 = new Map(a2.map(e3 => [e3.id, e3]));
    for (let e3 of n2.generators) if (o2.has(e3.id)) {
      let t3 = s2.get(e3.id);
      e3.qControl = `FIXED_Q`, e3.qFixedMvar = t3.qMvar, e3.qMinMvar = t3.qMinMvar, e3.qMaxMvar = t3.qMaxMvar;
    }
    return {
      eligible: a2,
      ids: o2
    };
  }
  function Ne(e2, t2, n2) {
    let r2 = /* @__PURE__ */new Map(),
      i2 = [],
      a2 = new Map(t2.generators.map(e3 => [e3.id, e3]));
    for (let o3 of e2) {
      let e3 = n2[o3.controlTarget],
        s2 = e3 + `|` + (o3.curve?.name ?? `VS`),
        c2 = a2.get(o3.id),
        l2 = r2.get(s2);
      l2 || (l2 = {
        target: e3,
        vs: o3.vsPu,
        plants: [],
        q: 0,
        minimum: 0,
        maximum: 0,
        limited: false,
        curve: o3.curve
      }, r2.set(s2, l2)), !l2.curve && Math.abs(l2.vs - o3.vsPu) > 1e-5 && i2.push({
        severity: `ERROR`,
        code: `VOLTAGE_CONTROL_CONFLICTING_SETPOINTS`,
        message: `Controllers assigned to the same numerical regulated bus have incompatible VS setpoints.`
      });
      let u2 = l2.plants.find(e4 => e4.sourceBus === o3.bus);
      u2 ? Math.abs(u2.weight - Math.max(o3.participation, 0)) > 1e-6 && i2.push({
        severity: `ERROR`,
        code: `VOLTAGE_CONTROL_CONFLICTING_PLANT_RMPCT`,
        message: `Machines in one source plant specify inconsistent plant participation values.`
      }) : (u2 = {
        units: [],
        weight: Math.max(o3.participation, 0),
        sourceBus: o3.bus
      }, l2.plants.push(u2)), u2.units.push(c2), l2.q += o3.qMvar / t2.baseMva, l2.minimum += o3.qMinMvar / t2.baseMva, l2.maximum += o3.qMaxMvar / t2.baseMva;
    }
    let o2 = [];
    for (let e3 of r2.values()) {
      let n3 = e3.plants.flatMap(e4 => e4.units),
        a3 = new Set(n3.map(e4 => e4.id)),
        s2 = t2.buses[e3.target]?.status === 1 && t2.buses[e3.target]?.type !== 3;
      if (e3.curve) {
        [...r2.values()].some(t3 => t3 !== e3 && t3.target === e3.target) && (s2 = false);
        let i3 = /* @__PURE__ */new Set(),
          o3 = n3.map(e4 => e4.bus).filter(t3 => t3 !== e3.target);
        for (; o3.length;) {
          let n4 = o3.pop();
          if (!(i3.has(n4) || n4 === e3.target)) {
            i3.add(n4);
            for (let r3 of t2.branches) r3.status === 1 && (r3.from === n4 && r3.to !== e3.target ? o3.push(r3.to) : r3.to === n4 && r3.from !== e3.target && o3.push(r3.from));
          }
        }
        t2.generators.some(e4 => e4.status === 1 && i3.has(e4.bus) && !a3.has(e4.id)) && (s2 = false), e3.edges = t2.branches.filter(t3 => t3.status === 1 && (t3.from === e3.target && i3.has(t3.to) || t3.to === e3.target && i3.has(t3.from))), n3.some(t3 => t3.bus !== e3.target) && !e3.edges.length && (s2 = false);
      }
      s2 ? o2.push(e3) : i2.push({
        severity: `WARNING`,
        code: `VOLTAGE_CONTROL_TOPOLOGY_UNSUPPORTED`,
        message: `A voltage controller has incompatible setpoint/reference or non-radial PCC boundaries; its source Q is held explicitly.`
      });
    }
    return {
      groups: o2,
      findings: i2,
      controlledIds: new Set(o2.flatMap(e3 => e3.plants.flatMap(e4 => e4.units.map(e5 => e5.id))))
    };
  }
  function Pe(e2, t2) {
    if (t2 <= e2.vlow) return {
      q: e2.qmax,
      slope: 0
    };
    if (t2 < e2.vdblow) {
      let n2 = (e2.qdb - e2.qmax) / (e2.vdblow - e2.vlow);
      return {
        q: e2.qmax + n2 * (t2 - e2.vlow),
        slope: n2
      };
    }
    if (t2 <= e2.vdbhigh) return {
      q: e2.qdb,
      slope: 0
    };
    if (t2 < e2.vhigh) {
      let n2 = (e2.qmin - e2.qdb) / (e2.vhigh - e2.vdbhigh);
      return {
        q: e2.qdb + n2 * (t2 - e2.vdbhigh),
        slope: n2
      };
    }
    return {
      q: e2.qmin,
      slope: 0
    };
  }
  function Fe(e2, t2, n2) {
    let r2 = /* @__PURE__ */new Map(),
      i2 = (e3, t3, n3) => {
        let i3 = r2.get(e3) ?? {
          angle: 0,
          vm: 0
        };
        i3.angle += t3, i3.vm += n3, r2.set(e3, i3);
      },
      a2 = 0;
    for (let n3 of e2.edges ?? []) {
      let r3 = n3.from === e2.target,
        o2 = e2.target,
        s2 = r3 ? n3.to : n3.from,
        c2 = r3 ? n3.yff : n3.ytt,
        l2 = r3 ? n3.yft : n3.ytf,
        u2 = t2.vm[o2],
        d2 = t2.vm[s2],
        f2 = t2.va[o2] - t2.va[s2],
        p2 = l2.re * Math.sin(f2) - l2.im * Math.cos(f2),
        m2 = u2 * d2 * (l2.re * Math.cos(f2) + l2.im * Math.sin(f2));
      a2 += c2.im * u2 * u2 - u2 * d2 * p2, i2(o2, -m2, 2 * c2.im * u2 - d2 * p2), i2(s2, m2, -u2 * p2);
    }
    for (let t3 of e2.plants) for (let r3 of t3.units) r3.bus === e2.target && (a2 += (r3.qFixedMvar ?? r3.qMvar) / n2);
    return {
      q: a2,
      derivatives: r2
    };
  }
  function Ie(e2, t2, n2) {
    return e2.curve ? Fe(e2, t2, n2).q - Pe(e2.curve, t2.vm[e2.target]).q / n2 : t2.vm[e2.target] - e2.vs;
  }
  function Le(e2, t2) {
    let n2 = Array(t2.length).fill(0),
      r2 = Array(t2.length).fill(0),
      i2 = t2.map((e3, t3) => t3),
      a2 = e2;
    for (let e3 = 0; e3 <= t2.length && i2.length; e3++) {
      let e4 = i2.reduce((e5, n3) => e5 + t2[n3].weight, 0),
        o2 = i2.map(n3 => e4 > 0 ? t2[n3].weight / e4 : 1 / i2.length),
        s2 = [],
        c2 = a2;
      if (i2.forEach((e5, r3) => {
        let i3 = c2 * o2[r3],
          l2 = Math.min(t2[e5].max, Math.max(t2[e5].min, i3));
        Math.abs(l2 - i3) > 1e-10 && (n2[e5] = l2, a2 -= l2, s2.push(e5));
      }), !s2.length) {
        i2.forEach((e5, t3) => {
          n2[e5] = a2 * o2[t3], r2[e5] = o2[t3];
        });
        break;
      }
      for (let e5 of s2) i2.splice(i2.indexOf(e5), 1);
    }
    return {
      values: n2,
      derivatives: r2
    };
  }
  function Re(e2, t2, n2 = true) {
    let r2 = Le(e2.q * t2, e2.plants.map(e3 => ({
        weight: e3.weight,
        min: n2 ? e3.units.reduce((e4, t3) => e4 + t3.qMinMvar, 0) : -1 / 0,
        max: n2 ? e3.units.reduce((e4, t3) => e4 + t3.qMaxMvar, 0) : 1 / 0
      }))),
      i2 = /* @__PURE__ */new Map();
    return e2.plants.forEach((e3, t3) => {
      let a2 = Le(r2.values[t3], e3.units.map(e4 => ({
        weight: Math.max(e4.pMw, 0),
        min: n2 ? e4.qMinMvar : -1 / 0,
        max: n2 ? e4.qMaxMvar : 1 / 0
      })));
      e3.units.forEach((e4, n3) => {
        e4.qFixedMvar = a2.values[n3], i2.set(e4.bus, (i2.get(e4.bus) ?? 0) + r2.derivatives[t3] * a2.derivatives[n3]);
      });
    }), i2;
  }
  function ze(e2, t2) {
    return {
      formulation: `AUGMENTED_NEWTON_IREG_RMPCT`,
      groups: e2.groups.length,
      limitedGroups: e2.groups.filter(e3 => e3.limited).length,
      droopGroups: e2.groups.filter(e3 => !!e3.curve).length,
      maxUnconstrainedVoltageErrorPu: Math.max(0, ...e2.groups.filter(e3 => !e3.limited && !e3.curve).map(e3 => Math.abs(t2.vm[e3.target] - e3.vs))),
      maxVoltageErrorPu: Math.max(0, ...e2.groups.filter(e3 => !e3.curve).map(e3 => Math.abs(t2.vm[e3.target] - e3.vs)))
    };
  }
  function Be(e2, t2, n2, r2, i2, a2, o2, s2) {
    let c2 = s2.groups,
      l2 = 0,
      u2 = null,
      d2 = 0,
      f2 = (e3 = false) => {
        let o3 = c2.map(e4 => Re(e4, t2.baseMva, a2.reactiveLimitsEnabled !== false)),
          s3 = U(t2, r2, n2, i2),
          l3 = c2.map(r3 => {
            let i3 = Ie(r3, n2, t2.baseMva);
            return e3 && (r3.limited = a2.reactiveLimitsEnabled !== false && (r3.q >= r3.maximum - 1e-10 && i3 < 0 || r3.q > r3.maximum + 1e-10 || r3.q <= r3.minimum + 1e-10 && i3 > 0 || r3.q < r3.minimum - 1e-10), r3.bound = r3.q >= r3.maximum - 1e-10 ? r3.maximum : r3.minimum), r3.limited ? r3.q - r3.bound : i3;
          }),
          u3 = [...s3.f, ...l3];
        return {
          power: s3,
          derivatives: o3,
          f: u3,
          norm: Math.hypot(...u3),
          max: Math.max(s3.maxP, s3.maxQ, ...l3.map(Math.abs))
        };
      },
      p2 = f2(true);
    for (; l2 < a2.maxIterations; l2++) {
      if (e2.cancelled?.()) return {
        status: `CANCELLED`,
        power: p2.power,
        iteration: l2,
        linearDiagnostics: u2,
        lineSearchReductions: d2
      };
      if (p2 = f2(true), e2.progress?.({
        phase: `NR_IREG_RMPCT`,
        iteration: o2 + l2,
        residualPu: p2.max
      }), p2.max <= a2.tolerancePu) return {
        status: `CONVERGED`,
        power: p2.power,
        iteration: l2,
        linearDiagnostics: u2,
        lineSearchReductions: d2
      };
      let s3 = fe(t2, r2, n2, p2.power, i2),
        m2 = s3.matrix.N,
        h2 = [];
      for (let e3 = 0; e3 < m2; e3++) {
        let t3 = /* @__PURE__ */new Map();
        for (let n3 = s3.matrix.rowPtr[e3]; n3 < s3.matrix.rowPtr[e3 + 1]; n3++) t3.set(s3.matrix.colIdx[n3], s3.matrix.values[n3]);
        h2.push(t3);
      }
      c2.forEach((e3, r3) => {
        for (let [e4, t3] of p2.derivatives[r3]) s3.qRow[e4] >= 0 && h2[s3.qRow[e4]].set(m2 + r3, -t3);
        let i3 = /* @__PURE__ */new Map();
        if (e3.limited) i3.set(m2 + r3, 1);else if (e3.curve) {
          let a3 = Fe(e3, n2, t2.baseMva);
          for (let [e4, t3] of a3.derivatives) s3.angleColumn[e4] >= 0 && i3.set(s3.angleColumn[e4], (i3.get(s3.angleColumn[e4]) ?? 0) + t3.angle), s3.vmColumn[e4] >= 0 && i3.set(s3.vmColumn[e4], (i3.get(s3.vmColumn[e4]) ?? 0) + t3.vm);
          let o3 = s3.vmColumn[e3.target];
          o3 >= 0 && i3.set(o3, (i3.get(o3) ?? 0) - Pe(e3.curve, n2.vm[e3.target]).slope / t2.baseMva);
          let c3 = p2.derivatives[r3].get(e3.target) ?? 0;
          c3 && i3.set(m2 + r3, c3);
        } else s3.vmColumn[e3.target] >= 0 && i3.set(s3.vmColumn[e3.target], 1);
        h2.push(i3);
      });
      let g2;
      try {
        g2 = K(G(h2), Float64Array.from(p2.f, e3 => -e3));
      } catch (e3) {
        return {
          status: `NON_CONVERGED`,
          power: p2.power,
          iteration: l2,
          linearDiagnostics: {
            error: String(e3),
            dimension: h2.length
          },
          lineSearchReductions: d2
        };
      }
      if (u2 = g2.diagnostics, !g2.x || g2.relativeResidual === null || g2.relativeResidual > 1e-6) return {
        status: `NON_CONVERGED`,
        power: p2.power,
        iteration: l2,
        linearDiagnostics: u2,
        lineSearchReductions: d2
      };
      let _2 = Float64Array.from(n2.vm),
        v2 = Float64Array.from(n2.va),
        y2 = c2.map(e3 => e3.q),
        b2 = g2.x,
        x2 = p2.norm,
        S2 = false;
      for (let e3 = 1; e3 >= 1 / 128; e3 /= 2) {
        n2.vm.set(_2), n2.va.set(v2);
        for (let t3 of s3.angleBuses) n2.va[t3] += e3 * b2[s3.angleColumn[t3]];
        for (let t3 of s3.vmBuses) n2.vm[t3] += e3 * b2[s3.vmColumn[t3]];
        if (c2.forEach((t3, n3) => {
          t3.q = y2[n3] + e3 * b2[m2 + n3];
        }), n2.vm.every(e4 => Number.isFinite(e4) && e4 >= a2.minVoltagePu && e4 <= a2.maxVoltagePu) && n2.va.every(Number.isFinite)) {
          let t3 = f2();
          if (t3.norm < x2 * (1 - 1e-5 * e3) || t3.max <= a2.tolerancePu) {
            p2 = t3, S2 = true, e3 < 1 && d2++;
            break;
          }
        }
      }
      if (!S2) return n2.vm.set(_2), n2.va.set(v2), c2.forEach((e3, t3) => e3.q = y2[t3]), p2 = f2(), {
        status: `NON_CONVERGED`,
        power: p2.power,
        iteration: l2 + 1,
        linearDiagnostics: u2,
        lineSearchReductions: d2
      };
    }
    return {
      status: p2.max <= a2.tolerancePu ? `CONVERGED` : `NON_CONVERGED`,
      power: p2.power,
      iteration: l2,
      linearDiagnostics: u2,
      lineSearchReductions: d2
    };
  }
  function Ve(e2, t2) {
    let n2 = e2 * e2 + t2 * t2;
    if (!(n2 > 0) || !Number.isFinite(n2)) throw Error(`ZERO_OR_INVALID_SERIES_IMPEDANCE`);
    return {
      re: e2 / n2,
      im: -t2 / n2
    };
  }
  let He = (e2, t2) => ({
      re: e2.re + t2.re,
      im: e2.im + t2.im
    }),
    Ue = (e2, t2) => ({
      re: e2.re * t2,
      im: e2.im * t2
    }),
    We = (e2, t2) => {
      let n2 = t2.re * t2.re + t2.im * t2.im;
      return {
        re: (e2.re * t2.re + e2.im * t2.im) / n2,
        im: (e2.im * t2.re - e2.re * t2.im) / n2
      };
    };
  function Ge(e2, t2, n2 = 1, r2 = 1, i2 = 0, a2 = {
    re: 0,
    im: 0
  }) {
    let o2 = Ve(e2, t2),
      s2 = i2 * Math.PI / 180,
      c2 = {
        re: n2 * Math.cos(s2),
        im: n2 * Math.sin(s2)
      },
      l2 = {
        re: r2,
        im: 0
      },
      u2 = {
        re: c2.re,
        im: -c2.im
      },
      d2 = n2 * n2,
      f2 = r2 * r2,
      p2 = {
        re: u2.re * l2.re - u2.im * l2.im,
        im: u2.re * l2.im + u2.im * l2.re
      },
      m2 = {
        re: l2.re * c2.re + l2.im * c2.im,
        im: l2.re * c2.im - l2.im * c2.re
      };
    return {
      yff: He(Ue(o2, 1 / d2), a2),
      yft: Ue(We(o2, p2), -1),
      ytf: Ue(We(o2, m2), -1),
      ytt: Ue(o2, 1 / f2)
    };
  }
  function Ke(e2, t2) {
    let n2 = Ve(e2.rPu, e2.xPu),
      r2 = e2.tapFrom * e2.tapFrom,
      i2 = {
        re: e2.yff.re - n2.re / r2,
        im: e2.yff.im - n2.im / r2
      },
      a2 = Ge(e2.rPu, e2.xPu, t2, e2.tapTo, e2.phaseDeg, i2);
    e2.tapFrom = t2, e2.yff = a2.yff, e2.yft = a2.yft, e2.ytf = a2.ytf, e2.ytt = a2.ytt;
  }
  let qe = {
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
    },
    Je = e2 => ({
      ...qe,
      ...e2.options
    });
  function Ye(e2, t2) {
    if (t2.networkHash !== e2.modelHash) throw Error(`PSSE_SCENARIO_NETWORK_MISMATCH`);
    let n2 = structuredClone(e2);
    for (let e3 of t2.operations) if (e3.action === `STATUS`) {
      let t3 = e3.value === true ? 1 : e3.value === false ? 0 : typeof e3.value == `number` && [0, 1].includes(e3.value) ? e3.value : null;
      if (t3 === null) throw Error(`PSSE_SCENARIO_STATUS_RANGE`);
      for (let r2 of [n2.branches, n2.generators, n2.loads, n2.shunts]) for (let n3 of r2) n3.sourceEquipmentId === e3.equipmentId && (n3.status = t3);
    } else if (e3.action === `GENERATOR_P`) for (let t3 of n2.generators) t3.sourceEquipmentId === e3.equipmentId && (t3.pMw = Number(e3.value));else if (e3.action === `LOAD_SCALE`) {
      let t3 = Number(e3.value);
      for (let r2 of n2.loads) r2.sourceEquipmentId === e3.equipmentId && (r2.pMw *= t3, r2.qMvar *= t3, r2.ipMw *= t3, r2.iqMvar *= t3, r2.ypMw *= t3, r2.yqMvar *= t3);
    } else if (isExtendedAction(e3.action)) {
      applyExtendedOperation(n2, e3);
    } else throw Error(`PSSE_SCENARIO_OPERATION_NOT_SUPPORTED:${e3.action}`);
    for (let e3 of n2.buses) if (!e3.source) {
      let t3 = n2.branches.filter(t4 => t4.sourceEquipmentId === e3.sourceEquipmentId);
      t3.length && (e3.status = +!!t3.some(e4 => e4.status === 1));
    }
    return n2;
  }
  function J(e2, t2, n2, r2, i2 = 0) {
    let a2 = r2 === `BLOCKED` ? `BLOCKED` : `PARTIAL`;
    return {
      schema: `ga.psse.calculation.v1`,
      id: e2.id,
      identity: e2,
      method: `NR_POLAR`,
      status: r2,
      classification: V({
        status: r2,
        physicsCoverage: a2,
        findings: n2
      }),
      physicsCoverage: a2,
      referenceComparisonStatus: `NOT_COMPARED`,
      source: `GA_PSSE_CALCULATED`,
      baseMva: t2.baseMva,
      iterations: 0,
      outerRounds: 0,
      elapsedMs: i2,
      maxPMismatchPu: null,
      maxQMismatchPu: null,
      busResults: t2.buses.filter(e3 => e3.source).map(e3 => ({
        id: e3.id,
        connectionKey: e3.connectionKey,
        vmPu: null,
        vaDeg: null,
        pGenerationMw: null,
        qGenerationMvar: null,
        sourceEquipmentId: e3.sourceEquipmentId
      })),
      branchResults: t2.branches.map(e3 => ({
        id: e3.id,
        sourceEquipmentId: e3.sourceEquipmentId,
        terminalFrom: e3.terminalFrom,
        terminalTo: e3.terminalTo,
        pFromMw: null,
        qFromMvar: null,
        pToMw: null,
        qToMvar: null,
        pLossMw: null,
        qLossMvar: null
      })),
      generatorResults: t2.generators.map(e3 => ({
        id: e3.id,
        sourceEquipmentId: e3.sourceEquipmentId,
        pMw: null,
        qMvar: null,
        limitState: `UNAVAILABLE`
      })),
      unsolvedIslands: [],
      diagnostics: {},
      findings: n2
    };
  }
  function Xe(e2, t2) {
    let n2 = e2.buses.length,
      r2 = new Float64Array(n2),
      i2 = new Float64Array(n2),
      a2 = new Int8Array(n2);
    for (let o2 = 0; o2 < n2; o2++) {
      let n3 = e2.buses[o2];
      a2[o2] = n3.status === 0 ? 4 : n3.type, t2 === `SOURCE_SAVED` && n3.initialVm !== null && n3.initialVm > 0 ? (r2[o2] = n3.initialVm, i2[o2] = (n3.initialVaDeg ?? 0) * Math.PI / 180) : (r2[o2] = 1, i2[o2] = 0);
    }
    for (let t3 = 0; t3 < n2; t3++) if (a2[t3] === 2) {
      let n3 = H(e2, t3);
      n3.units.length > 0 && n3.regulatingUnits.length === 0 && (a2[t3] = 1);
    }
    if (t2 === `FLAT`) for (let t3 of e2.generators) t3.status === 1 && t3.qControl === `REGULATING` && t3.vsPu !== null && (a2[t3.bus] === 2 || a2[t3.bus] === 3) && (r2[t3.bus] = t3.vsPu);
    return {
      vm: r2,
      va: i2,
      busType: a2,
      qLimited: /* @__PURE__ */new Map(),
      qState: /* @__PURE__ */new Map()
    };
  }
  function Ze(e2, t2) {
    let n2 = /* @__PURE__ */new Set();
    for (let e3 = 0; e3 < t2.busType.length; e3++) t2.busType[e3] === 3 && n2.add(e3);
    return n2;
  }
  function Y(e2, t2, n2, r2) {
    return U(e2, t2, n2, r2);
  }
  function Qe(e2) {
    return Math.max(e2.maxP, e2.maxQ);
  }
  function X(e2, t2, n2, r2, i2, a2, o2, s2) {
    if (s2) return Be(e2, t2, n2, r2, i2, a2, o2, s2);
    let c2 = Y(t2, r2, n2, i2),
      l2 = 0,
      u2 = null,
      d2 = 0;
    for (; l2 < a2.maxIterations; l2++) {
      if (e2.cancelled?.()) return {
        status: `CANCELLED`,
        power: c2,
        iteration: l2,
        linearDiagnostics: u2,
        lineSearchReductions: d2
      };
      let s3 = Qe(c2);
      if (e2.progress?.({
        phase: `NR_POLAR`,
        iteration: o2 + l2,
        residualPu: s3
      }), s3 <= a2.tolerancePu) return {
        status: `CONVERGED`,
        power: c2,
        iteration: l2,
        linearDiagnostics: u2,
        lineSearchReductions: d2
      };
      let f2 = fe(t2, r2, n2, c2, i2),
        p2 = Float64Array.from(c2.f, e3 => -e3),
        m2;
      try {
        m2 = K(f2.matrix, p2);
      } catch (e3) {
        return {
          status: `NON_CONVERGED`,
          power: c2,
          iteration: l2,
          linearDiagnostics: {
            error: e3 instanceof Error ? e3.message : String(e3),
            dimension: f2.matrix.N,
            nnz: f2.matrix.colIdx.length
          },
          lineSearchReductions: d2
        };
      }
      if (u2 = m2.diagnostics, !m2.x || m2.relativeResidual === null || m2.relativeResidual > 1e-6) return {
        status: `NON_CONVERGED`,
        power: c2,
        iteration: l2,
        linearDiagnostics: u2,
        lineSearchReductions: d2
      };
      let h2 = m2.x,
        g2 = Float64Array.from(n2.vm),
        _2 = Float64Array.from(n2.va),
        v2 = c2.norm,
        y2 = false;
      for (let e3 = 1; e3 >= 1 / 128; e3 /= 2) {
        for (let t3 = 0; t3 < f2.angleBuses.length; t3++) n2.va[f2.angleBuses[t3]] += e3 * h2[t3];
        for (let t3 = 0; t3 < f2.vmBuses.length; t3++) n2.vm[f2.vmBuses[t3]] += e3 * h2[f2.vmColumn[f2.vmBuses[t3]]];
        if (n2.vm.every(e4 => Number.isFinite(e4) && e4 >= a2.minVoltagePu && e4 <= a2.maxVoltagePu) && n2.va.every(Number.isFinite)) {
          let o3 = Y(t2, r2, n2, i2);
          if (Number.isFinite(o3.norm) && (o3.norm < v2 * (1 - 1e-5 * e3) || Qe(o3) <= a2.tolerancePu)) {
            c2 = o3, y2 = true, e3 < 1 && d2++;
            break;
          }
        }
        n2.vm.set(g2), n2.va.set(_2);
      }
      if (!y2) return {
        status: `NON_CONVERGED`,
        power: c2,
        iteration: l2 + 1,
        linearDiagnostics: u2,
        lineSearchReductions: d2
      };
    }
    return c2 = Y(t2, r2, n2, i2), {
      status: Qe(c2) <= a2.tolerancePu ? `CONVERGED` : `NON_CONVERGED`,
      power: c2,
      iteration: l2,
      linearDiagnostics: u2,
      lineSearchReductions: d2
    };
  }
  let $e = 1e-6;
  function et(e2, t2, n2, r2) {
    let i2 = {
      rounds: 0,
      tapMoves: 0,
      shuntMoves: 0,
      tapAtLimit: 0,
      shuntAtLimit: 0,
      continuousShunts: 0,
      rolledBack: false
    };
    for (let r3 of e2.branches) {
      let e3 = r3.tapControl;
      if (r3.status !== 1 || !e3) continue;
      let a2 = n2.get(e3.regulatedKey);
      if (a2 === void 0) continue;
      let o2 = t2.vm[a2],
        s2 = null;
      if (o2 < e3.vminPu - $e) s2 = true;else if (o2 > e3.vmaxPu + $e) s2 = false;else continue;
      let c2 = (s2 === e3.regulatesTapSide ? 1 : -1) * (e3.reverse ? -1 : 1) * e3.tapStepPu,
        l2 = r3.tapFrom + c2,
        u2 = Math.min(e3.tapMaxPu, Math.max(e3.tapMinPu, l2));
      if (Math.abs(u2 - r3.tapFrom) < 1e-12) {
        i2.tapAtLimit++;
        continue;
      }
      Ke(r3, u2), i2.tapMoves++;
    }
    for (let a2 of e2.shunts) {
      let e3 = a2.switchedControl;
      if (a2.status !== 1 || !e3) continue;
      if (e3.modsw !== 1) {
        e3.modsw === 2 && i2.continuousShunts++;
        continue;
      }
      let o2 = e3.remoteKey ? n2.get(e3.remoteKey) ?? a2.bus : a2.bus,
        s2 = t2.vm[o2],
        c2 = r2.get(a2.id) ?? e3.blocks.map(() => 0);
      if (r2.set(a2.id, c2), s2 >= e3.vloPu - $e && s2 <= e3.vhiPu + $e) continue;
      let l2 = s2 < e3.vloPu,
        u2 = false;
      if (l2) for (let t3 = 0; t3 < e3.blocks.length && !u2; t3++) {
        let n3 = e3.blocks[t3];
        n3.susceptanceMvar > 0 && c2[t3] < n3.steps && (c2[t3]++, a2.bMvar += n3.susceptanceMvar, u2 = true);
      } else {
        for (let t3 = e3.blocks.length - 1; t3 >= 0 && !u2; t3--) {
          let n3 = e3.blocks[t3];
          n3.susceptanceMvar > 0 && c2[t3] > 0 && (c2[t3]--, a2.bMvar -= n3.susceptanceMvar, u2 = true);
        }
        for (let t3 = 0; t3 < e3.blocks.length && !u2; t3++) {
          let n3 = e3.blocks[t3];
          n3.susceptanceMvar < 0 && c2[t3] < n3.steps && (c2[t3]++, a2.bMvar += n3.susceptanceMvar, u2 = true);
        }
      }
      u2 ? i2.shuntMoves++ : i2.shuntAtLimit++;
    }
    return i2;
  }
  function tt(e2) {
    let t2 = performance.now(),
      n2 = Je(e2),
      r2 = e2.scenario ?? ne(e2.network),
      i2 = Ye(e2.network, r2),
      a2 = Ee(e2.model, i2, n2.initialVoltagePolicy, n2.remoteRegulation),
      o2 = n2.remoteRegulation ? Me(e2.model, i2, a2.network) : null,
      s2 = ke(e2.model, a2.network),
      l2 = s2.network,
      u2 = o2 ? Ne(o2.eligible, l2, s2.busToNode) : void 0,
      d2 = z(n2),
      f2 = a2.counts.remoteQHeld + a2.counts.droopQHeld + a2.counts.localVoltageSetpointHeld + s2.counts.sourceVoltageDisagreementCount + s2.counts.cycleRank > 0,
      p2 = u2 ? `AUGMENTED_IREG_RMPCT_QV` : `${n2.reactiveLimitsEnabled ? `FIXED_CONTROLS_Q_LIMITS` : `FIXED_CONTROLS_NO_Q_LIMITS`}${f2 ? `_SOURCE_SAVED_Q_HOLD` : ``}`,
      m2 = u2 ? `augmented-ireg-rmpct-qv-1` : f2 ? `fixed-controls-source-saved-q-hold-1` : `fixed-controls-1`,
      h2 = B({
        mode: `PSSE`,
        sourceSha256: i2.sourceSha256,
        modelHash: i2.modelHash,
        topologyHash: ee(i2),
        normalizedModelHash: i2.modelHash,
        normalizedRevision: i2.revision,
        scenarioHash: r2.hash,
        solver: `NR_POLAR`,
        engineVersion: L,
        algorithmId: `NR_POLAR`,
        algorithmRevision: u2 ? `psse-nr-polar-ireg-qv-1` : `psse-nr-polar-2`,
        controlPolicyId: p2,
        controlPolicyRevision: m2,
        optionsHash: d2,
        resultSchemaRevision: `psse-result-1`,
        initialVoltagePolicy: n2.initialVoltagePolicy
      });
    if (u2) {
      let e3 = new Set(l2.generators.filter(e4 => u2.controlledIds.has(e4.id)).map(e4 => e4.sourceEquipmentId));
      a2.findings = a2.findings.filter(t3 => t3.code !== `GENERATOR_DROOP_FIXED_Q_SOURCE_SAVED` || !t3.equipment || !e3.has(t3.equipment)), a2.counts.droopQHeld = a2.findings.filter(e4 => e4.code === `GENERATOR_DROOP_FIXED_Q_SOURCE_SAVED`).length, a2.remoteGroups = [], a2.counts.remoteQHeld = 0, a2.counts.localVoltageSetpointHeld = 0, a2.findings = a2.findings.filter(e4 => ![`REMOTE_REGULATION_FIXED_Q_SOURCE_SAVED`, `LOCAL_REGULATION_SOURCE_SAVED_VOLTAGE_HELD`].includes(e4.code));
    }
    let g2 = c(e2.model, l2, `NR_POLAR`),
      _2 = [...(n2.remoteRegulation ? g2.findings.filter(e3 => e3.code !== `REMOTE_REGULATION_FIXED_Q_SOURCE_SAVED`) : g2.findings), ...a2.findings, ...s2.findings, ...(u2?.findings ?? [])];
    if (g2.status === `BLOCKED` || _2.some(e3 => e3.severity === `ERROR`)) return J(h2, i2, _2, `BLOCKED`, performance.now() - t2);
    let v2 = Xe(l2, n2.initialVoltagePolicy),
      y2 = Ze(l2, v2),
      b2 = q(l2);
    if (n2.remoteRegulation && !u2) {
      for (let e3 of l2.generators) e3.status === 1 && e3.qControl === `REGULATING` && e3.vsPu !== null && (e3.remoteBus === null || e3.remoteBus === e3.bus) && v2.busType[e3.bus] === 2 && (v2.vm[e3.bus] = e3.vsPu);
      if (!n2.remoteChasing) {
        let e3 = 0;
        for (let t3 of l2.generators) t3.status === 1 && t3.qControl === `FIXED_Q` && t3.remoteBus !== null && t3.remoteBus !== t3.bus && t3.remoteBus >= 0 && t3.vsPu !== null && t3.qMinMvar !== t3.qMaxMvar && (t3.qControl = `REGULATING`, e3++, v2.busType[t3.bus] === 1 && (v2.busType[t3.bus] = 2, v2.vm[t3.bus] = t3.vsPu));
        e3 && _2.push({
          severity: `WARNING`,
          code: `REMOTE_REGULATION_TERMINAL_PV_APPROXIMATION`,
          message: `${e3} remote-regulated machine(s) are approximated by terminal-bus PV regulation at the remote setpoint value; the IREG bus setpoint itself is not enforced in this profile.`
        });
      }
    }
    if (u2) for (let e3 of l2.generators) e3.status === 1 && v2.busType[e3.bus] === 3 && e3.vsPu !== null && (v2.vm[e3.bus] = e3.vsPu);
    let x2 = Y(l2, b2, v2, y2),
      S2 = 0,
      C2 = 0,
      w2 = null,
      T2 = 0,
      E2 = null,
      D2 = [];
    for (; C2 <= n2.maxQLimitRounds; C2++) {
      let r3 = X(e2, l2, v2, b2, y2, n2, S2, u2);
      if (S2 += r3.iteration, w2 = r3.linearDiagnostics, T2 += r3.lineSearchReductions, E2 = r3.power, r3.status === `CANCELLED`) return {
        ...J(h2, i2, _2, `CANCELLED`, performance.now() - t2),
        iterations: S2,
        outerRounds: C2,
        diagnostics: {
          linearDiagnostics: w2
        }
      };
      if (r3.status !== `CONVERGED`) return {
        ...J(h2, i2, _2, `NON_CONVERGED`, performance.now() - t2),
        iterations: S2,
        outerRounds: C2,
        maxPMismatchPu: E2.maxP,
        maxQMismatchPu: E2.maxQ,
        diagnostics: {
          linearDiagnostics: w2,
          lineSearchReductions: T2
        }
      };
      if (!n2.reactiveLimitsEnabled) break;
      let a3 = false;
      for (let e3 of l2.buses.map((e4, t3) => t3)) if (v2.busType[e3] === 2 || v2.busType[e3] === 3) {
        let n3 = H(l2, e3);
        if (!n3.units.length) continue;
        let r4 = (E2.q[e3] + E2.loadQ[e3]) * l2.baseMva,
          o3 = n3.minimumQ,
          s3 = n3.maximumQ;
        if (v2.busType[e3] === 3) {
          if (r4 < o3 - 0.02 || r4 > s3 + 0.02) return _2.push({
            severity: `ERROR`,
            code: `REFERENCE_Q_LIMIT_EXCEEDED`,
            message: `Reference bus requires ${r4.toFixed(4)} Mvar outside [${o3}, ${s3}].`
          }), {
            ...J(h2, i2, _2, `BLOCKED`, performance.now() - t2),
            iterations: S2,
            outerRounds: C2,
            maxPMismatchPu: E2.maxP,
            maxQMismatchPu: E2.maxQ
          };
        } else if (r4 < o3 - 0.02 || r4 > s3 + 0.02) {
          let t3 = r4 < o3 ? o3 : s3;
          v2.busType[e3] = 1, v2.qLimited.set(e3, t3 / i2.baseMva), v2.qState.set(e3, t3 === o3 ? `QMIN` : `QMAX`), D2.push(e3), a3 = true;
        }
      }
      if (!a3) break;
      if (C2 === n2.maxQLimitRounds) return {
        ...J(h2, i2, [..._2, {
          severity: `ERROR`,
          code: `Q_LIMIT_ROUND_LIMIT`,
          message: `Reactive-limit active set did not settle within the configured outer-round limit.`
        }], `NON_CONVERGED`, performance.now() - t2),
        iterations: S2,
        outerRounds: C2
      };
    }
    let O2 = null;
    if (n2.remoteRegulation && a2.remoteGroups.length && n2.remoteChasing) {
      let r3 = new Map(l2.generators.map(e3 => [e3.sourceEquipmentId, e3])),
        o3 = a2.remoteGroups.map(t3 => ({
          ...t3,
          node: t3.remoteBus >= 0 && t3.remoteBus < e2.network.buses.length ? s2.busToNode[t3.remoteBus] : null,
          gain: 1,
          previousError: 0,
          initialError: 0
        })).filter(e3 => e3.node !== null && e3.vsPu !== null),
        c2 = 0,
        d3 = 0,
        f3 = 0,
        p3 = n2.maxRemoteRounds ?? 15;
      for (let e3 of o3) {
        let t3 = v2.vm[e3.node];
        e3.initialError = e3.vsPu - t3;
      }
      let m3 = new Map(l2.generators.filter(e3 => e3.qControl === `FIXED_Q`).map(e3 => [e3.id, e3.qFixedMvar])),
        g3 = Float64Array.from(v2.vm),
        x3 = Float64Array.from(v2.va);
      for (; c2 < p3; c2++) {
        let t3 = 0,
          i3 = false,
          a3 = new Map(l2.generators.filter(e3 => e3.qControl === `FIXED_Q`).map(e3 => [e3.id, e3.qFixedMvar])),
          s3 = Float64Array.from(v2.vm),
          m4 = Float64Array.from(v2.va);
        for (let e3 of o3) {
          let n3 = v2.vm[e3.node],
            a4 = e3.vsPu - n3;
          if (t3 = Math.max(t3, Math.abs(a4)), Math.abs(a4) <= 1e-4) continue;
          a4 * e3.previousError < 0 && Math.abs(a4) > Math.abs(e3.previousError) && (e3.gain = Math.max(e3.gain / 2, 0.02)), e3.previousError = a4;
          let o4 = b2.rows[e3.node].get(e3.node),
            s4 = o4 ? o4.im : 0,
            c3 = Math.max(-0.08, Math.min(0.08, a4 * -s4 * Math.max(n3, 0.5) * e3.gain)) * l2.baseMva,
            u3 = e3.machines.map(e4 => r3.get(e4)).filter(e4 => e4 !== void 0),
            f4 = u3.reduce((e4, t4) => e4 + Math.max(t4.participation, 0), 0) || u3.length;
          for (let e4 of u3) {
            let t4 = c3 * (Math.max(e4.participation, 0) || 1) / f4,
              n4 = e4.qFixedMvar ?? e4.qMvar,
              r4 = Math.min(e4.qMaxMvar, Math.max(e4.qMinMvar, n4 + t4));
            Math.abs(r4 - n4) > 1e-12 && (i3 = true, (r4 === e4.qMinMvar || r4 === e4.qMaxMvar) && d3++), e4.qFixedMvar = r4;
          }
        }
        if (!i3) {
          O2 = {
            rounds: c2,
            groups: o3.length,
            settled: t3 <= 1e-4 ? o3.length : 0,
            maxVoltageErrorPu: t3,
            limitedMachines: d3
          }, t3 > 1e-4 && _2.push({
            severity: `WARNING`,
            code: `REMOTE_REGULATION_OUTER_LOOP_UNSETTLED`,
            message: `Remote voltage regulation stopped with ${o3.length} group(s) at limits or ineffective; maximum residual setpoint error ${t3.toFixed(6)} pu.`
          });
          break;
        }
        b2 = q(l2);
        let h3 = X(e2, l2, v2, b2, y2, n2, S2, u2);
        if (S2 += h3.iteration, T2 += h3.lineSearchReductions, h3.status !== `CONVERGED`) {
          f3++;
          for (let e3 of l2.generators) a3.has(e3.id) && (e3.qFixedMvar = a3.get(e3.id));
          v2.vm.set(s3), v2.va.set(m4);
          for (let e3 of o3) e3.gain = Math.max(e3.gain / 2, 0.02);
          b2 = q(l2);
          let r4 = X(e2, l2, v2, b2, y2, n2, S2, u2);
          if (S2 += r4.iteration, T2 += r4.lineSearchReductions, E2 = r4.power, r4.status !== `CONVERGED` || f3 >= 3) {
            O2 = {
              rounds: c2 + 1,
              groups: o3.length,
              settled: 0,
              maxVoltageErrorPu: t3,
              limitedMachines: d3
            }, _2.push({
              severity: `WARNING`,
              code: `REMOTE_REGULATION_OUTER_LOOP_UNSETTLED`,
              message: `Remote voltage regulation round broke convergence; the last converged Q state is reported.`
            }), _2.push({
              severity: `ERROR`,
              code: `REMOTE_REGULATION_RESTORE_NOT_CONVERGED`,
              message: `The in-loop rollback re-solve failed; the calculation cannot be published as converged.`
            });
            break;
          }
          continue;
        }
        E2 = h3.power;
        let g4 = 0;
        for (let e3 of o3) g4 = Math.max(g4, Math.abs(e3.vsPu - v2.vm[e3.node]));
        if (g4 <= 1e-4) {
          O2 = {
            rounds: c2 + 1,
            groups: o3.length,
            settled: o3.length,
            maxVoltageErrorPu: g4,
            limitedMachines: d3
          };
          break;
        }
        c2 === p3 - 1 && (O2 = {
          rounds: c2 + 1,
          groups: o3.length,
          settled: 0,
          maxVoltageErrorPu: g4,
          limitedMachines: d3
        }, _2.push({
          severity: `WARNING`,
          code: `REMOTE_REGULATION_OUTER_LOOP_UNSETTLED`,
          message: `Remote voltage regulation did not settle within ${p3} outer rounds; maximum residual setpoint error ${g4.toFixed(6)} pu.`
        }));
      }
      O2 ||= {
        rounds: c2,
        groups: o3.length,
        settled: o3.length,
        maxVoltageErrorPu: 0,
        limitedMachines: d3
      };
      let w3 = 0;
      for (let e3 of o3) Math.abs(e3.vsPu - v2.vm[e3.node]) > Math.max(Math.abs(e3.initialError), 1e-3) && w3++;
      if (w3) {
        for (let e3 of o3) for (let t3 of e3.machines) {
          let e4 = r3.get(t3);
          e4 && (e4.qControl = `REGULATING`, e4.qFixedMvar = null, e4.vsPu !== null && v2.busType[e4.bus] === 1 && (v2.busType[e4.bus] = 2, v2.vm[e4.bus] = e4.vsPu));
        }
        b2 = q(l2);
        let a3 = X(e2, l2, v2, b2, y2, n2, S2, u2);
        if (S2 += a3.iteration, T2 += a3.lineSearchReductions, E2 = a3.power, a3.status !== `CONVERGED`) {
          for (let e3 of l2.generators) m3.has(e3.id) && (e3.qFixedMvar = m3.get(e3.id));
          for (let e3 of o3) for (let t3 of e3.machines) {
            let e4 = r3.get(t3);
            e4 && (e4.qControl = `FIXED_Q`);
          }
          v2.vm.set(g3), v2.va.set(x3);
          for (let e3 of o3) for (let t3 of e3.machines) {
            let e4 = r3.get(t3);
            e4 && v2.busType[e4.bus] === 2 && (v2.busType[e4.bus] = 1);
          }
          b2 = q(l2);
          let a4 = X(e2, l2, v2, b2, y2, n2, S2, u2);
          if (S2 += a4.iteration, T2 += a4.lineSearchReductions, E2 = a4.power, a4.status !== `CONVERGED`) return {
            ...J(h2, i2, _2, `NON_CONVERGED`, performance.now() - t2),
            iterations: S2,
            outerRounds: C2,
            maxPMismatchPu: a4.power.maxP,
            maxQMismatchPu: a4.power.maxQ,
            diagnostics: {
              remoteRegulation: O2
            }
          };
        }
        O2 = {
          ...O2,
          revertedGroups: w3
        }, _2.push({
          severity: `WARNING`,
          code: `REMOTE_REGULATION_TERMINAL_PV_FALLBACK`,
          message: `${w3} of ${o3.length} remote regulation group(s) diverged in the outer loop; those machines fall back to terminal-bus PV regulation at the remote setpoint value, which is an approximation of IREG control.`
        }), _2.push({
          severity: `WARNING`,
          code: `REMOTE_REGULATION_OUTER_LOOP_UNSETTLED`,
          message: `Remote setpoints are not enforced for the reverted groups; treat this result as approximate for IREG control.`
        });
      }
    }
    if (_2.some(e3 => e3.code === `REMOTE_REGULATION_RESTORE_NOT_CONVERGED`)) return {
      ...J(h2, i2, _2, `NON_CONVERGED`, performance.now() - t2),
      iterations: S2,
      outerRounds: C2,
      maxPMismatchPu: E2?.maxP ?? null,
      maxQMismatchPu: E2?.maxQ ?? null,
      diagnostics: {
        remoteRegulation: O2
      }
    };
    let k2 = {
      rounds: 0,
      tapMoves: 0,
      shuntMoves: 0,
      tapAtLimit: 0,
      shuntAtLimit: 0,
      continuousShunts: 0,
      rolledBack: false
    };
    if (n2.automaticAdjustments) {
      let t3 = /* @__PURE__ */new Map();
      for (let n3 = 0; n3 < e2.network.buses.length; n3++) {
        let r4 = e2.network.buses[n3].connectionKey,
          i4 = s2.busToNode[n3];
        t3.has(r4) || t3.set(r4, i4);
      }
      let r3 = /* @__PURE__ */new Map(),
        i3 = n2.maxAdjustmentRounds ?? 10,
        a3 = {
          tapMoves: 0,
          shuntMoves: 0,
          tapAtLimit: 0,
          shuntAtLimit: 0,
          continuousShunts: 0
        };
      for (let o3 = 0; o3 < i3; o3++) {
        let s3 = l2.branches.map(e3 => ({
            tapFrom: e3.tapFrom,
            yff: {
              ...e3.yff
            },
            yft: {
              ...e3.yft
            },
            ytf: {
              ...e3.ytf
            },
            ytt: {
              ...e3.ytt
            }
          })),
          c2 = l2.shunts.map(e3 => e3.bMvar),
          d3 = et(l2, v2, t3, r3);
        if (a3.tapMoves += d3.tapMoves, a3.shuntMoves += d3.shuntMoves, a3.tapAtLimit = Math.max(a3.tapAtLimit, d3.tapAtLimit), a3.shuntAtLimit = Math.max(a3.shuntAtLimit, d3.shuntAtLimit), a3.continuousShunts += d3.continuousShunts, !d3.tapMoves && !d3.shuntMoves) {
          k2 = {
            ...d3,
            ...a3,
            rounds: o3
          };
          break;
        }
        b2 = q(l2);
        let f3 = X(e2, l2, v2, b2, y2, n2, S2, u2);
        if (S2 += f3.iteration, T2 += f3.lineSearchReductions, f3.status !== `CONVERGED`) {
          l2.branches.forEach((e3, t5) => {
            let n3 = s3[t5];
            e3.tapFrom = n3.tapFrom, e3.yff = {
              ...n3.yff
            }, e3.yft = {
              ...n3.yft
            }, e3.ytf = {
              ...n3.ytf
            }, e3.ytt = {
              ...n3.ytt
            };
          }), l2.shunts.forEach((e3, t5) => {
            e3.bMvar = c2[t5];
          }), b2 = q(l2);
          let t4 = X(e2, l2, v2, b2, y2, n2, S2, u2);
          S2 += t4.iteration, E2 = t4.power, _2.push({
            severity: `WARNING`,
            code: `AUTO_ADJUSTMENT_NON_CONVERGED_ROLLBACK`,
            message: `An automatic tap/switched-shunt pass broke convergence; the pass was rolled back and the last converged state is reported.`
          }), k2 = {
            ...d3,
            ...a3,
            rounds: o3 + 1,
            rolledBack: true
          };
          break;
        }
        E2 = f3.power, o3 === i3 - 1 && (k2 = {
          ...d3,
          ...a3,
          rounds: o3 + 1
        }, _2.push({
          severity: `WARNING`,
          code: `AUTO_ADJUSTMENT_ROUND_LIMIT`,
          message: `Automatic adjustments did not settle within the configured round limit; the current tap/shunt state is reported.`
        }));
      }
    }
    O2?.rounds && _2.push({
      severity: `INFO`,
      code: `REMOTE_REGULATION_OUTER_LOOP_APPLIED`,
      message: `Remote voltage regulation converged for ${O2.settled}/${O2.groups} group(s) in ${O2.rounds} outer round(s); ${O2.limitedMachines} machine(s) clamped at Q limits.`
    }), k2.tapMoves && _2.push({
      severity: `INFO`,
      code: `AUTO_TAP_ADJUSTMENT_APPLIED`,
      message: `${k2.tapMoves} automatic tap step(s) across ${k2.rounds} adjustment round(s).`
    }), k2.tapAtLimit && _2.push({
      severity: `INFO`,
      code: `AUTO_TAP_AT_LIMIT`,
      message: `${k2.tapAtLimit} regulating tap(s) reached a ratio limit.`
    }), k2.shuntMoves && _2.push({
      severity: `INFO`,
      code: `AUTO_SWITCHED_SHUNT_ADJUSTMENT_APPLIED`,
      message: `${k2.shuntMoves} switched-shunt block step(s) across ${k2.rounds} adjustment round(s).`
    }), k2.continuousShunts && _2.push({
      severity: `WARNING`,
      code: `SWITCHED_SHUNT_CONTINUOUS_MODE_NOT_ADJUSTED`,
      message: `${k2.continuousShunts} continuous-mode switched shunt(s) kept their initial susceptance; continuous adjustment is not implemented.`
    });
    let A2 = E2 ?? Y(l2, b2, v2, y2),
      j2 = ie(l2, v2, n2.loadModelProfile);
    if (_2.push(...j2), j2.some(e3 => e3.severity === `ERROR`)) return {
      ...J(h2, i2, _2, `BLOCKED`, performance.now() - t2),
      iterations: S2,
      outerRounds: C2,
      maxPMismatchPu: A2.maxP,
      maxQMismatchPu: A2.maxQ
    };
    let M2 = he(l2, v2, A2, n2.reactiveLimitsEnabled, _2),
      N2 = {
        ...v2,
        vm: new Float64Array(i2.buses.length),
        va: new Float64Array(i2.buses.length),
        busType: new Int8Array(i2.buses.length)
      };
    for (let e3 = 0; e3 < i2.buses.length; e3++) {
      let t3 = s2.busToNode[e3];
      N2.vm[e3] = v2.vm[t3], N2.va[e3] = v2.va[t3], N2.busType[e3] = i2.buses[e3].status ? i2.buses[e3].type : 4;
    }
    if (u2) {
      for (let e3 of M2) if (u2.controlledIds.has(e3.id) && e3.qMvar !== null) {
        let t3 = l2.generators.find(t4 => t4.id === e3.id);
        e3.limitState = n2.reactiveLimitsEnabled && e3.qMvar <= t3.qMinMvar + 1e-6 ? `QMIN` : n2.reactiveLimitsEnabled && e3.qMvar >= t3.qMaxMvar - 1e-6 ? `QMAX` : `FREE`;
      }
    }
    let P2 = ye(i2, N2),
      F2 = je(s2, i2, N2, A2, M2, P2);
    if (F2.maxIdealKclResidualMva > Math.max(n2.tolerancePu * i2.baseMva * 10, 1e-5)) return _2.push({
      severity: `ERROR`,
      code: `AC_IDEAL_LINK_KCL_RESIDUAL`,
      message: `Recovered ideal-link terminal balance residual ${F2.maxIdealKclResidualMva.toExponential(3)} MVA exceeds the selected solver tolerance.`
    }), {
      ...J(h2, i2, _2, `NON_CONVERGED`, performance.now() - t2),
      iterations: S2,
      outerRounds: C2,
      maxPMismatchPu: A2.maxP,
      maxQMismatchPu: A2.maxQ,
      diagnostics: {
        idealLinkRecoveryResidualMva: F2.maxIdealKclResidualMva
      }
    };
    let I2 = i2.buses.flatMap((e3, t3) => e3.source ? [{
        id: e3.id,
        connectionKey: e3.connectionKey,
        vmPu: e3.status === 1 ? N2.vm[t3] : null,
        vaDeg: e3.status === 1 ? N2.va[t3] * 180 / Math.PI : null,
        pGenerationMw: e3.status === 1 ? F2.machineByBus.get(t3)?.p ?? 0 : null,
        qGenerationMvar: e3.status === 1 ? F2.machineByBus.get(t3)?.q ?? 0 : null,
        sourceEquipmentId: e3.sourceEquipmentId
      }] : []),
      R2 = new Map(s2.idealBranches.map(e3 => [e3.id, e3])),
      te2 = new Map(P2.map(e3 => [e3.id, e3])),
      re2 = i2.branches.map(e3 => {
        let t3 = R2.get(e3.id),
          n3 = F2.idealFlows.get(e3.id);
        if (!t3 || !n3) return te2.get(e3.id);
        let r3 = te2.get(e3.id),
          a3 = {
            p: n3.p + (r3.pFromMw ?? 0),
            q: n3.q + (r3.qFromMvar ?? 0)
          },
          o3 = {
            p: -n3.p + (r3.pToMw ?? 0),
            q: -n3.q + (r3.qToMvar ?? 0)
          };
        return ve(i2, N2, e3, a3, o3);
      }),
      U2 = [`REMOTE_REGULATION_OUTER_LOOP_UNSETTLED`, `REMOTE_REGULATION_TERMINAL_PV_APPROXIMATION`, `REMOTE_REGULATION_TERMINAL_PV_FALLBACK`, `REMOTE_REGULATION_FIXED_Q_SOURCE_SAVED`, `GENERATOR_DROOP_FIXED_Q_SOURCE_SAVED`, `GENERATOR_DROOP_FIXED_Q_APPROXIMATION`, `VOLTAGE_DROOP_Q_FIXED_APPROXIMATION`, `LOCAL_REGULATION_SOURCE_SAVED_VOLTAGE_HELD`, `PV_WITHOUT_ACTIVE_GENERATOR_FIXED_PQ`, `AC_IDEAL_LINK_SOURCE_VOLTAGE_DISAGREEMENT`];
    F2.allocationApproximationCount && _2.push({
      severity: `WARNING`,
      code: `PER_MACHINE_DISPATCH_UNAVAILABLE`,
      message: `${F2.allocationApproximationCount} unobservable machine dispatch(es) were allocated by RMPCT only for bus-level ideal-link KCL recovery.`
    }), s2.counts.cycleRank && _2.push({
      severity: `INFO`,
      code: `AC_IDEAL_LINK_CYCLE_FLOW_ALLOCATION`,
      message: `Ideal-link cyclic components have non-unique terminal flows; a deterministic source-|X|-weighted solution was used.`
    }), u2 && _2.push({
      severity: `WARNING`,
      code: `AUGMENTED_VOLTAGE_CONTROL_VALIDATION_PENDING`,
      message: `Exact IREG equations and bounded plant sharing are enabled; full source-control/reference validation remains required.`
    });
    let ae2 = u2 || F2.allocationApproximationCount > 0 || s2.counts.cycleRank > 0 || _2.some(e3 => U2.includes(e3.code)) || _2.some(e3 => e3.code === `GENERIC_ZIP_BELOW_PSSE_BREAKPOINT` || e3.code === `BASE_KV_UNAVAILABLE_PER_UNIT_PROFILE` || e3.code === `PER_MACHINE_DISPATCH_UNAVAILABLE`) ? `PARTIAL` : `SUPPORTED`,
      W2 = `CONVERGED`;
    return {
      schema: `ga.psse.calculation.v1`,
      id: h2.id,
      identity: h2,
      method: `NR_POLAR`,
      status: W2,
      classification: V({
        status: W2,
        physicsCoverage: ae2,
        findings: _2
      }),
      physicsCoverage: ae2,
      referenceComparisonStatus: `NOT_COMPARED`,
      source: `GA_PSSE_CALCULATED`,
      baseMva: i2.baseMva,
      iterations: S2,
      outerRounds: C2,
      elapsedMs: performance.now() - t2,
      maxPMismatchPu: A2.maxP,
      maxQMismatchPu: A2.maxQ,
      busResults: I2,
      branchResults: re2,
      generatorResults: M2,
      unsolvedIslands: [],
      diagnostics: {
        sparse: {
          dimension: w2 && typeof w2 == `object` ? w2.dimension ?? null : l2.buses.length,
          nnz: w2 && typeof w2 == `object` ? w2.nnz ?? null : null,
          backend: `KLU_WASM`,
          linearDiagnostics: w2
        },
        initialMismatchPu: {
          p: x2.maxP,
          q: x2.maxQ,
          max: Math.max(x2.maxP, x2.maxQ)
        },
        lineSearchReductions: T2,
        adjustments: k2,
        remoteRegulation: u2 ? ze(u2, v2) : O2,
        activeQLimitBuses: D2.map(e3 => l2.buses[e3].id),
        busCount: i2.buses.length,
        branchCount: i2.branches.length,
        numericalNodeCount: l2.buses.length,
        ybusNnz: b2.nnz,
        initialVoltagePolicy: n2.initialVoltagePolicy,
        controlApproximation: a2.counts,
        idealLinkContraction: s2.counts,
        idealLinkRecovery: {
          method: s2.counts.cycleRank ? `TREE_KCL_OR_MINIMUM_SOURCE_ABS_X` : `TREE_KCL`,
          cycleRank: F2.idealCycleRank,
          maxKclResidualMva: F2.maxIdealKclResidualMva
        },
        sourceSavedVoltageMismatchPreserved: n2.initialVoltagePolicy === `SOURCE_SAVED`
      },
      findings: _2
    };
  }
  function nt(e2, t2) {
    return {
      re: e2.re + t2.re,
      im: e2.im + t2.im
    };
  }
  function Z(e2, t2, n2, r2) {
    let i2 = e2[t2].get(n2) ?? {
      re: 0,
      im: 0
    };
    e2[t2].set(n2, nt(i2, r2));
  }
  function rt(e2, t2) {
    let n2 = e2.buses.map(() => /* @__PURE__ */new Map());
    for (let r2 of e2.branches) {
      if (r2.status !== 1) continue;
      let e3 = Ge(r2.rPu, r2.xPu, r2.tapFrom, r2.tapTo, r2.phaseDeg),
        i2 = Ge(t2 === `ANGLE` ? 0 : r2.rPu, t2 === `ANGLE` ? r2.tapTo * r2.tapTo * r2.xPu : r2.xPu, t2 === `ANGLE` ? 1 : r2.tapFrom, t2 === `ANGLE` ? 1 : r2.tapTo, t2 === `ANGLE` ? r2.phaseDeg : 0, t2 === `VOLTAGE` ? {
          re: r2.yff.re - e3.yff.re,
          im: r2.yff.im - e3.yff.im
        } : {
          re: 0,
          im: 0
        }),
        a2 = {
          re: t2 === `VOLTAGE` ? r2.ytt.re - e3.ytt.re : 0,
          im: t2 === `VOLTAGE` ? r2.ytt.im - e3.ytt.im : 0
        };
      Z(n2, r2.from, r2.from, i2.yff), Z(n2, r2.from, r2.to, i2.yft), Z(n2, r2.to, r2.from, i2.ytf), Z(n2, r2.to, r2.to, nt(i2.ytt, a2));
    }
    if (t2 === `VOLTAGE`) for (let t3 of e2.shunts) t3.status === 1 && Z(n2, t3.bus, t3.bus, {
      re: t3.gMw / e2.baseMva,
      im: t3.bMvar / e2.baseMva
    });
    return n2;
  }
  function it(e2, t2) {
    let n2 = new Map(t2.map((e3, t3) => [e3, t3])),
      r2 = t2.map(() => /* @__PURE__ */new Map());
    for (let i2 = 0; i2 < t2.length; i2++) {
      let a2 = t2[i2];
      for (let [t3, o2] of e2[a2]) {
        let e3 = n2.get(t3);
        e3 !== void 0 && r2[i2].set(e3, -o2.im);
      }
    }
    return G(r2);
  }
  function at(e2, t2) {
    let n2 = Ze(e2, t2),
      r2 = e2.buses.map((e3, t3) => t3).filter(r3 => e2.buses[r3].status === 1 && t2.busType[r3] !== 4 && !n2.has(r3)),
      i2 = e2.buses.map((e3, t3) => t3).filter(n3 => e2.buses[n3].status === 1 && t2.busType[n3] === 1);
    return {
      angleBuses: r2,
      voltageBuses: i2,
      bPrime: it(rt(e2, `ANGLE`), r2),
      bDoublePrime: it(rt(e2, `VOLTAGE`), i2)
    };
  }
  function Q(e2, t2, n2, r2, i2) {
    let a2 = r2 === `BLOCKED` ? `BLOCKED` : `PARTIAL`;
    return {
      schema: `ga.psse.calculation.v1`,
      id: e2.id,
      identity: e2,
      method: `FDNS_XB`,
      status: r2,
      classification: V({
        status: r2,
        physicsCoverage: a2,
        findings: n2
      }),
      physicsCoverage: a2,
      referenceComparisonStatus: `NOT_COMPARED`,
      source: `GA_PSSE_CALCULATED`,
      baseMva: t2.baseMva,
      iterations: 0,
      outerRounds: 0,
      elapsedMs: i2,
      maxPMismatchPu: null,
      maxQMismatchPu: null,
      busResults: t2.buses.filter(e3 => e3.source).map(e3 => ({
        id: e3.id,
        connectionKey: e3.connectionKey,
        vmPu: null,
        vaDeg: null,
        pGenerationMw: null,
        qGenerationMvar: null,
        sourceEquipmentId: e3.sourceEquipmentId
      })),
      branchResults: t2.branches.map(e3 => ({
        id: e3.id,
        sourceEquipmentId: e3.sourceEquipmentId,
        terminalFrom: e3.terminalFrom,
        terminalTo: e3.terminalTo,
        pFromMw: null,
        qFromMvar: null,
        pToMw: null,
        qToMvar: null,
        pLossMw: null,
        qLossMvar: null
      })),
      generatorResults: t2.generators.map(e3 => ({
        id: e3.id,
        sourceEquipmentId: e3.sourceEquipmentId,
        pMw: null,
        qMvar: null,
        limitState: `UNAVAILABLE`
      })),
      unsolvedIslands: [],
      diagnostics: {},
      findings: n2
    };
  }
  function ot(e2) {
    return Math.max(e2.maxP, e2.maxQ);
  }
  function st(e2) {
    let t2 = performance.now(),
      n2 = {
        ...qe,
        ...e2.options
      },
      r2 = e2.scenario ?? ne(e2.network),
      i2 = Ye(e2.network, r2),
      a2 = Ee(e2.model, i2, n2.initialVoltagePolicy ?? `FLAT`),
      o2 = ke(e2.model, a2.network),
      s2 = o2.network,
      l2 = a2.counts.remoteQHeld + a2.counts.droopQHeld + a2.counts.localVoltageSetpointHeld + o2.counts.sourceVoltageDisagreementCount + o2.counts.cycleRank > 0,
      u2 = B({
        mode: `PSSE`,
        sourceSha256: i2.sourceSha256,
        modelHash: i2.modelHash,
        topologyHash: ee(i2),
        normalizedModelHash: i2.modelHash,
        normalizedRevision: i2.revision,
        scenarioHash: r2.hash,
        solver: `FDNS_XB`,
        engineVersion: L,
        algorithmId: `FDNS_XB`,
        algorithmRevision: `psse-fdns-xb-2`,
        controlPolicyId: `${n2.reactiveLimitsEnabled ? `FIXED_CONTROLS_Q_LIMITS` : `FIXED_CONTROLS_NO_Q_LIMITS`}${l2 ? `_SOURCE_SAVED_Q_HOLD` : ``}`,
        controlPolicyRevision: l2 ? `fixed-controls-source-saved-q-hold-1` : `fixed-controls-1`,
        optionsHash: z(n2),
        resultSchemaRevision: `psse-result-1`,
        initialVoltagePolicy: n2.initialVoltagePolicy ?? `FLAT`
      }),
      d2 = c(e2.model, s2, `FDNS_XB`),
      f2 = [...d2.findings, ...a2.findings, ...o2.findings];
    if (d2.status === `BLOCKED` || f2.some(e3 => e3.severity === `ERROR`)) return Q(u2, i2, f2, `BLOCKED`, performance.now() - t2);
    let p2 = Xe(s2, n2.initialVoltagePolicy ?? `FLAT`),
      m2 = Ze(s2, p2),
      h2 = q(s2),
      g2 = U(s2, h2, p2, m2),
      _2 = s2.buses.map((e3, t3) => t3).filter(e3 => s2.buses[e3].status === 1 && p2.busType[e3] !== 4 && !m2.has(e3)),
      v2 = 0,
      y2 = 0,
      b2 = null,
      x2 = [];
    for (; y2 <= (n2.maxQLimitRounds ?? 8); y2++) {
      let r3 = at(s2, p2),
        a3 = r3.voltageBuses,
        o3 = r3.bPrime,
        c2 = r3.bDoublePrime,
        l3 = null,
        d3 = null;
      try {
        o3.N && (l3 = new de(o3)), c2.N && (d3 = new de(c2));
      } catch (e3) {
        return l3?.dispose(), d3?.dispose(), {
          ...Q(u2, i2, [...f2, {
            severity: `ERROR`,
            code: `FDNS_MATRIX_FACTOR_FAILED`,
            message: e3 instanceof Error ? e3.message : String(e3)
          }], `NON_CONVERGED`, performance.now() - t2),
          diagnostics: {
            bPrime: {
              dimension: o3.N,
              nnz: o3.colIdx.length
            },
            bDoublePrime: {
              dimension: c2.N,
              nnz: c2.colIdx.length
            }
          }
        };
      }
      let g3 = false,
        S3 = 0,
        C3 = 1 / 0,
        w3 = 0;
      try {
        for (let r4 = 0; r4 < (n2.maxIterations ?? 40); r4++) {
          if (e2.cancelled?.()) return {
            ...Q(u2, i2, f2, `CANCELLED`, performance.now() - t2),
            iterations: v2,
            outerRounds: y2
          };
          b2 = U(s2, h2, p2, m2);
          let r5 = ot(b2);
          if (e2.progress?.({
            phase: `FDNS_XB`,
            iteration: v2,
            residualPu: r5
          }), r5 <= (n2.tolerancePu ?? 1e-6)) {
            g3 = true;
            break;
          }
          if (r5 >= C3 * (1 - 1e-9) ? S3++ : S3 = 0, C3 = r5, S3 > 8) break;
          let o4 = r5,
            c3 = Float64Array.from(p2.vm),
            x3 = Float64Array.from(p2.va),
            T4 = new Float64Array(_2.length),
            E3 = new Float64Array(a3.length);
          if (l3) {
            let e3 = Float64Array.from(_2, e4 => (b2.specP[e4] - b2.p[e4]) / Math.max(p2.vm[e4], n2.minVoltagePu ?? 1e-3)),
              r6 = l3.solve(e3);
            if (!r6.success || !r6.x) return {
              ...Q(u2, i2, [...f2, {
                severity: `ERROR`,
                code: `FDNS_ANGLE_SOLVE_FAILED`,
                message: `FDNS_XB angle matrix did not solve with an acceptable true residual.`
              }], `NON_CONVERGED`, performance.now() - t2),
              iterations: v2,
              outerRounds: y2,
              diagnostics: {
                linear: r6.diagnostics
              }
            };
            for (let e4 = 0; e4 < _2.length; e4++) T4[e4] = r6.x[e4], p2.va[_2[e4]] += r6.x[e4];
          }
          if (b2 = U(s2, h2, p2, m2), d3) {
            let e3 = Float64Array.from(a3, e4 => (b2.specQ[e4] - b2.q[e4]) / Math.max(p2.vm[e4], n2.minVoltagePu ?? 1e-3)),
              r6 = d3.solve(e3);
            if (!r6.success || !r6.x) return {
              ...Q(u2, i2, [...f2, {
                severity: `ERROR`,
                code: `FDNS_VOLTAGE_SOLVE_FAILED`,
                message: `FDNS_XB voltage matrix did not solve with an acceptable true residual.`
              }], `NON_CONVERGED`, performance.now() - t2),
              iterations: v2,
              outerRounds: y2,
              diagnostics: {
                linear: r6.diagnostics
              }
            };
            for (let e4 = 0; e4 < a3.length; e4++) E3[e4] = r6.x[e4];
          }
          let D3 = false;
          for (let e3 = 1; e3 >= 1 / 128; e3 /= 2) {
            p2.vm.set(c3), p2.va.set(x3);
            for (let t3 = 0; t3 < _2.length; t3++) p2.va[_2[t3]] = x3[_2[t3]] + e3 * T4[t3];
            for (let t3 = 0; t3 < a3.length; t3++) p2.vm[a3[t3]] = c3[a3[t3]] + e3 * E3[t3];
            if (p2.vm.every(e4 => Number.isFinite(e4) && e4 >= (n2.minVoltagePu ?? 1e-3) && e4 <= (n2.maxVoltagePu ?? 8)) && p2.va.every(Number.isFinite)) {
              let t3 = U(s2, h2, p2, m2);
              if (Number.isFinite(t3.norm) && t3.norm < o4 * (1 - 1e-8 * e3)) {
                b2 = t3, D3 = true, e3 < 1 && w3++;
                break;
              }
            }
          }
          if (!D3) {
            p2.vm.set(c3), p2.va.set(x3);
            break;
          }
          v2++;
        }
      } finally {
        l3?.dispose(), d3?.dispose();
      }
      if (b2 = U(s2, h2, p2, m2), !g3 && ot(b2) <= (n2.tolerancePu ?? 1e-6) && (g3 = true), !g3) return {
        ...Q(u2, i2, f2, `NON_CONVERGED`, performance.now() - t2),
        iterations: v2,
        outerRounds: y2,
        maxPMismatchPu: b2.maxP,
        maxQMismatchPu: b2.maxQ,
        diagnostics: {
          algorithm: `FDNS_XB`,
          bPrime: {
            dimension: o3.N,
            nnz: o3.colIdx.length
          },
          bDoublePrime: {
            dimension: c2.N,
            nnz: c2.colIdx.length
          },
          stagnant: S3,
          stepDampingReductions: w3
        }
      };
      if (!n2.reactiveLimitsEnabled) break;
      let T3 = false;
      for (let e3 = 0; e3 < s2.buses.length; e3++) if (p2.busType[e3] === 2 || p2.busType[e3] === 3) {
        let n3 = H(s2, e3);
        if (!n3.units.length) continue;
        let r4 = (b2.q[e3] + b2.loadQ[e3]) * s2.baseMva,
          a4 = n3.minimumQ,
          o4 = n3.maximumQ;
        if (p2.busType[e3] === 3 && (r4 < a4 - 0.02 || r4 > o4 + 0.02)) return f2.push({
          severity: `ERROR`,
          code: `REFERENCE_Q_LIMIT_EXCEEDED`,
          message: `Reference bus requires ${r4.toFixed(4)} Mvar outside [${a4}, ${o4}].`
        }), {
          ...Q(u2, i2, f2, `BLOCKED`, performance.now() - t2),
          iterations: v2,
          outerRounds: y2
        };
        if (p2.busType[e3] === 2 && (r4 < a4 - 0.02 || r4 > o4 + 0.02)) {
          let t3 = r4 < a4 ? a4 : o4;
          p2.busType[e3] = 1, p2.qLimited.set(e3, t3 / s2.baseMva), x2.push(e3), T3 = true;
        }
      }
      if (!T3) break;
      if (y2 === (n2.maxQLimitRounds ?? 8)) return {
        ...Q(u2, i2, [...f2, {
          severity: `ERROR`,
          code: `Q_LIMIT_ROUND_LIMIT`,
          message: `Reactive-limit active set did not settle.`
        }], `NON_CONVERGED`, performance.now() - t2),
        iterations: v2,
        outerRounds: y2
      };
    }
    b2 = U(s2, h2, p2, m2);
    let S2 = ie(s2, p2, n2.loadModelProfile ?? `PSSE_SOURCE`);
    if (f2.push(...S2), S2.some(e3 => e3.severity === `ERROR`)) return {
      ...Q(u2, i2, f2, `BLOCKED`, performance.now() - t2),
      iterations: v2,
      outerRounds: y2,
      maxPMismatchPu: b2.maxP,
      maxQMismatchPu: b2.maxQ
    };
    let C2 = he(s2, p2, b2, n2.reactiveLimitsEnabled ?? true, f2),
      w2 = {
        ...p2,
        vm: new Float64Array(i2.buses.length),
        va: new Float64Array(i2.buses.length),
        busType: new Int8Array(i2.buses.length)
      };
    for (let e3 = 0; e3 < i2.buses.length; e3++) {
      let t3 = o2.busToNode[e3];
      w2.vm[e3] = p2.vm[t3], w2.va[e3] = p2.va[t3], w2.busType[e3] = i2.buses[e3].status ? i2.buses[e3].type : 4;
    }
    let T2 = ye(i2, w2),
      E2 = je(o2, i2, w2, b2, C2, T2);
    if (E2.maxIdealKclResidualMva > Math.max((n2.tolerancePu ?? 1e-6) * i2.baseMva * 10, 1e-5)) return f2.push({
      severity: `ERROR`,
      code: `AC_IDEAL_LINK_KCL_RESIDUAL`,
      message: `Recovered ideal-link terminal balance residual ${E2.maxIdealKclResidualMva.toExponential(3)} MVA exceeds the selected solver tolerance.`
    }), {
      ...Q(u2, i2, f2, `NON_CONVERGED`, performance.now() - t2),
      iterations: v2,
      outerRounds: y2,
      maxPMismatchPu: b2.maxP,
      maxQMismatchPu: b2.maxQ,
      diagnostics: {
        idealLinkRecoveryResidualMva: E2.maxIdealKclResidualMva
      }
    };
    let D2 = i2.buses.flatMap((e3, t3) => e3.source ? [{
        id: e3.id,
        connectionKey: e3.connectionKey,
        vmPu: e3.status === 1 ? w2.vm[t3] : null,
        vaDeg: e3.status === 1 ? w2.va[t3] * 180 / Math.PI : null,
        pGenerationMw: e3.status === 1 ? E2.machineByBus.get(t3)?.p ?? 0 : null,
        qGenerationMvar: e3.status === 1 ? E2.machineByBus.get(t3)?.q ?? 0 : null,
        sourceEquipmentId: e3.sourceEquipmentId
      }] : []),
      O2 = new Map(o2.idealBranches.map(e3 => [e3.id, e3])),
      k2 = new Map(T2.map(e3 => [e3.id, e3])),
      A2 = i2.branches.map(e3 => {
        let t3 = O2.get(e3.id),
          n3 = E2.idealFlows.get(e3.id);
        if (!t3 || !n3) return k2.get(e3.id);
        let r3 = k2.get(e3.id),
          a3 = {
            p: n3.p + (r3.pFromMw ?? 0),
            q: n3.q + (r3.qFromMvar ?? 0)
          },
          o3 = {
            p: -n3.p + (r3.pToMw ?? 0),
            q: -n3.q + (r3.qToMvar ?? 0)
          };
        return ve(i2, w2, e3, a3, o3);
      });
    E2.allocationApproximationCount && f2.push({
      severity: `WARNING`,
      code: `PER_MACHINE_DISPATCH_UNAVAILABLE`,
      message: `${E2.allocationApproximationCount} unobservable machine dispatch(es) were allocated by RMPCT only for bus-level ideal-link KCL recovery.`
    }), o2.counts.cycleRank && f2.push({
      severity: `INFO`,
      code: `AC_IDEAL_LINK_CYCLE_FLOW_ALLOCATION`,
      message: `Ideal-link cyclic components have non-unique terminal flows; a deterministic source-|X|-weighted solution was used.`
    });
    let j2 = [`REMOTE_REGULATION_FIXED_Q_SOURCE_SAVED`, `GENERATOR_DROOP_FIXED_Q_SOURCE_SAVED`, `GENERATOR_DROOP_FIXED_Q_APPROXIMATION`, `VOLTAGE_DROOP_Q_FIXED_APPROXIMATION`, `LOCAL_REGULATION_SOURCE_SAVED_VOLTAGE_HELD`, `PV_WITHOUT_ACTIVE_GENERATOR_FIXED_PQ`, `AC_IDEAL_LINK_SOURCE_VOLTAGE_DISAGREEMENT`],
      M2 = E2.allocationApproximationCount > 0 || o2.counts.cycleRank > 0 || f2.some(e3 => j2.includes(e3.code)) || f2.some(e3 => e3.code === `GENERIC_ZIP_BELOW_PSSE_BREAKPOINT` || e3.code === `BASE_KV_UNAVAILABLE_PER_UNIT_PROFILE` || e3.code === `PER_MACHINE_DISPATCH_UNAVAILABLE`) ? `PARTIAL` : `SUPPORTED`,
      N2 = `CONVERGED`,
      P2 = at(s2, p2);
    return {
      schema: `ga.psse.calculation.v1`,
      id: u2.id,
      identity: u2,
      method: `FDNS_XB`,
      status: N2,
      classification: V({
        status: N2,
        physicsCoverage: M2,
        findings: f2
      }),
      physicsCoverage: M2,
      referenceComparisonStatus: `NOT_COMPARED`,
      source: `GA_PSSE_CALCULATED`,
      baseMva: i2.baseMva,
      iterations: v2,
      outerRounds: y2,
      elapsedMs: performance.now() - t2,
      maxPMismatchPu: b2.maxP,
      maxQMismatchPu: b2.maxQ,
      busResults: D2,
      branchResults: A2,
      generatorResults: C2,
      unsolvedIslands: [],
      diagnostics: {
        algorithm: `FDNS_XB`,
        initialMismatchPu: {
          p: g2.maxP,
          q: g2.maxQ,
          max: Math.max(g2.maxP, g2.maxQ)
        },
        angleMatrix: {
          dimension: _2.length,
          nnz: it(rt(s2, `ANGLE`), _2).colIdx.length
        },
        voltageMatrix: {
          dimension: P2.voltageBuses.length,
          nnz: P2.bDoublePrime.colIdx.length
        },
        activeQLimitBuses: x2.map(e3 => s2.buses[e3].id),
        controlApproximation: a2.counts,
        idealLinkContraction: o2.counts,
        idealLinkRecovery: {
          method: o2.counts.cycleRank ? `TREE_KCL_OR_MINIMUM_SOURCE_ABS_X` : `TREE_KCL`,
          cycleRank: E2.idealCycleRank,
          maxKclResidualMva: E2.maxIdealKclResidualMva
        }
      },
      findings: f2
    };
  }
  let ct = (e2, t2) => e2 !== null && t2 !== null && Math.abs(e2 - t2) <= Math.max(e2, t2) * 1e-9;
  function lt(e2, t2) {
    let n2 = r(e2),
      i2 = [],
      o2 = /* @__PURE__ */new Map();
    for (let t3 of e2.equipment) o2.has(t3.id) || o2.set(t3.id, t3);
    let s2 = t2.branches.filter(t3 => t3.status === 1 && a(e2, t3, n2, o2)),
      c2 = Int32Array.from({
        length: t2.buses.length
      }, (e3, t3) => t3),
      l2 = new Uint8Array(t2.buses.length),
      u2 = e3 => {
        let t3 = e3;
        for (; c2[t3] !== t3;) t3 = c2[t3];
        for (; c2[e3] !== e3;) {
          let n3 = c2[e3];
          c2[e3] = t3, e3 = n3;
        }
        return t3;
      },
      d2 = (e3, t3) => {
        let n3 = u2(e3),
          r2 = u2(t3);
        n3 !== r2 && (l2[n3] < l2[r2] && ([n3, r2] = [r2, n3]), c2[r2] = n3, l2[n3] === l2[r2] && l2[n3]++);
      };
    for (let e3 of s2) {
      let n3 = t2.buses[e3.from],
        r2 = t2.buses[e3.to];
      if (e3.rPu !== 0 || e3.tapFrom !== 1 || e3.tapTo !== 1 || e3.phaseDeg !== 0 || e3.from === e3.to || !n3 || !r2 || n3.status !== 1 || r2.status !== 1 || !ct(n3.baseKv, r2.baseKv)) {
        i2.push({
          severity: `ERROR`,
          code: `DC_IDEAL_LINK_TERMINAL_INCOMPATIBLE`,
          message: `Non-transformer zero-impedance link ${e3.id} cannot be contracted: it requires active endpoints with compatible physical voltage bases, zero phase shift, unity taps and zero resistance.`,
          equipment: e3.sourceEquipmentId
        });
        continue;
      }
      d2(e3.from, e3.to);
    }
    let f2 = [],
      p2 = /* @__PURE__ */new Map(),
      m2 = new Int32Array(t2.buses.length);
    m2.fill(-1);
    for (let e3 = 0; e3 < t2.buses.length; e3++) if (t2.buses[e3].status === 1) {
      let t3 = u2(e3),
        n3 = p2.get(t3);
      n3 === void 0 && (n3 = f2.length, p2.set(t3, n3), f2.push([])), f2[n3].push(e3), m2[e3] = n3;
    }
    let h2 = /* @__PURE__ */new Map();
    for (let e3 of s2) {
      let t3 = u2(e3.from),
        n3 = h2.get(t3);
      n3 || (n3 = {
        buses: f2[p2.get(t3)].slice(),
        branches: []
      }, h2.set(t3, n3)), n3.branches.push(e3);
    }
    let g2 = [...h2.values()],
      _2 = 0;
    for (let e3 of g2) {
      let n3 = Math.max(0, e3.branches.length - e3.buses.length + 1);
      _2 += n3, n3 > 0 && e3.branches.some(e4 => !(e4.xPu > 0 && Number.isFinite(e4.xPu))) && i2.push({
        severity: `ERROR`,
        code: `DC_IDEAL_SWITCH_CYCLE_RECOVERY_UNSUPPORTED`,
        message: `Cyclic ideal-switch component ${e3.buses.map(e4 => t2.buses[e4].id).slice(0, 8).join(`, `)} has signed or zero X. Cyclic recovery is validated only for strictly positive source X.`,
        equipment: e3.branches[0]?.sourceEquipmentId
      });
    }
    return {
      contraction: {
        threshold: n2,
        busToNode: m2,
        nodeBuses: f2,
        branches: s2,
        components: g2,
        cycleRank: _2
      },
      findings: i2
    };
  }
  function ut(e2, t2, n2) {
    let r2 = /* @__PURE__ */new Map(),
      i2 = 0,
      a2 = 0;
    for (let t3 of e2.components) {
      let {
        buses: e3,
        branches: o3
      } = t3;
      if (o3.length === e3.length - 1) {
        let t4 = /* @__PURE__ */new Map();
        for (let n3 of e3) t4.set(n3, []);
        for (let e4 of o3) t4.get(e4.from).push({
          next: e4.to,
          branch: e4
        }), t4.get(e4.to).push({
          next: e4.from,
          branch: e4
        });
        let a3 = e3[0],
          s4 = /* @__PURE__ */new Map([[a3, -1]]),
          c4 = /* @__PURE__ */new Map(),
          l3 = [a3];
        for (let e4 = 0; e4 < l3.length; e4++) {
          let n3 = l3[e4];
          for (let {
            next: e5,
            branch: r3
          } of t4.get(n3) ?? []) s4.has(e5) || (s4.set(e5, n3), c4.set(e5, r3), l3.push(e5));
        }
        if (l3.length !== e3.length) throw Error(`DC_SWITCH_TREE_TOPOLOGY_INVALID`);
        let u3 = /* @__PURE__ */new Map();
        for (let e4 = l3.length - 1; e4 > 0; e4--) {
          let t5 = l3[e4],
            i3 = n2[t5] + (u3.get(t5) ?? 0),
            a4 = s4.get(t5),
            o4 = c4.get(t5);
          u3.set(t5, i3), u3.set(a4, (u3.get(a4) ?? 0) + i3), r2.set(o4.id, o4.from === a4 ? -i3 : i3);
        }
        let d3 = n2[a3] + (u3.get(a3) ?? 0),
          f3 = Math.max(1, e3.reduce((e4, t5) => e4 + Math.abs(n2[t5]), 0));
        i2 = Math.max(i2, Math.abs(d3) / f3);
        continue;
      }
      if (a2++, o3.some(e4 => !(e4.xPu > 0 && Number.isFinite(e4.xPu)))) throw Error(`DC_SWITCH_CYCLE_REQUIRES_POSITIVE_X`);
      let s3 = e3[0],
        c3 = e3.slice(1),
        l2 = new Map(c3.map((e4, t4) => [e4, t4])),
        u2 = c3.map(() => /* @__PURE__ */new Map()),
        d2 = new Float64Array(c3.length);
      for (let e4 = 0; e4 < c3.length; e4++) d2[e4] = n2[c3[e4]];
      for (let e4 of o3) {
        let t4 = 1 / e4.xPu,
          n3 = l2.get(e4.from),
          r3 = l2.get(e4.to);
        n3 !== void 0 && (u2[n3].set(n3, (u2[n3].get(n3) ?? 0) + t4), r3 !== void 0 && u2[n3].set(r3, (u2[n3].get(r3) ?? 0) - t4)), r3 !== void 0 && (u2[r3].set(r3, (u2[r3].get(r3) ?? 0) + t4), n3 !== void 0 && u2[r3].set(n3, (u2[r3].get(n3) ?? 0) - t4));
      }
      let f2 = K(G(u2), d2);
      if (!f2.x || f2.relativeResidual === null || f2.relativeResidual > 1e-8) throw Error(`DC_SWITCH_CYCLE_LAPLACIAN_FAILED`);
      let p2 = /* @__PURE__ */new Map([[s3, 0]]);
      c3.forEach((e4, t4) => p2.set(e4, f2.x[t4]));
      for (let e4 of o3) r2.set(e4.id, (p2.get(e4.from) - p2.get(e4.to)) / e4.xPu);
      i2 = Math.max(i2, f2.relativeResidual);
    }
    let o2 = 0,
      s2 = 1,
      c2 = new Float64Array(t2.buses.length);
    for (let t3 of e2.branches) {
      let e3 = r2.get(t3.id) ?? 0;
      c2[t3.from] += e3, c2[t3.to] -= e3;
    }
    for (let t3 of e2.components) {
      let e3 = 1;
      for (let r3 of t3.buses) e3 += Math.abs(n2[r3]);
      for (let e4 of t3.buses) o2 = Math.max(o2, Math.abs(n2[e4] - c2[e4]));
      s2 = Math.max(s2, e3);
    }
    return i2 = Math.max(i2, o2 / s2), {
      flows: r2,
      relativeResidual: i2,
      cyclicComponentCount: a2,
      cycleRank: e2.cycleRank
    };
  }
  let dt = {
    voltageMagnitudePu: 1,
    loadVoltagePolicy: `SOURCE_SAVED`,
    includeRealShuntConsumption: true,
    realShuntVoltagePolicy: `SOURCE_SAVED`,
    referenceAnglePolicy: `FLAT_REFERENCE`,
    tapPolicy: `PSSE36_DCLF_COMPAT`
  };
  function $(e2, t2, n2, r2, i2, a2 = {}) {
    let o2 = r2 === `BLOCKED` ? `BLOCKED` : `PARTIAL`;
    return {
      schema: `ga.psse.calculation.v1`,
      id: e2.id,
      identity: e2,
      method: `LOSSLESS_DC`,
      status: r2,
      classification: V({
        status: r2,
        physicsCoverage: o2,
        findings: n2
      }),
      physicsCoverage: o2,
      referenceComparisonStatus: `NOT_COMPARED`,
      source: `GA_PSSE_CALCULATED`,
      baseMva: t2.baseMva,
      iterations: 0,
      outerRounds: 0,
      elapsedMs: i2,
      maxPMismatchPu: null,
      maxQMismatchPu: null,
      busResults: t2.buses.filter(e3 => e3.source).map(e3 => ({
        id: e3.id,
        connectionKey: e3.connectionKey,
        vmPu: null,
        vaDeg: null,
        pGenerationMw: null,
        qGenerationMvar: null,
        sourceEquipmentId: e3.sourceEquipmentId
      })),
      branchResults: t2.branches.map(e3 => ({
        id: e3.id,
        sourceEquipmentId: e3.sourceEquipmentId,
        terminalFrom: e3.terminalFrom,
        terminalTo: e3.terminalTo,
        pFromMw: null,
        qFromMvar: null,
        pToMw: null,
        qToMvar: null,
        pLossMw: null,
        qLossMvar: null
      })),
      generatorResults: t2.generators.map(e3 => ({
        id: e3.id,
        sourceEquipmentId: e3.sourceEquipmentId,
        pMw: null,
        qMvar: null,
        limitState: `UNAVAILABLE`
      })),
      unsolvedIslands: [],
      diagnostics: {
        voltageMagnitudePu: 1,
        voltageMagnitudeStatus: `FIXED_DC_ASSUMPTION_NOT_SOLVED`,
        ...a2
      },
      findings: n2
    };
  }
  function ft(e2, t2, r2) {
    let i2 = [],
      a2 = n(e2, `PQBRAK`, 1, 0.7);
    for (let e3 of t2.loads) {
      if (e3.status !== 1) continue;
      let n2 = Math.abs(e3.pMw) > 1e-9,
        o2 = Math.abs(e3.ipMw) > 1e-9,
        s2 = t2.buses[e3.bus],
        c2 = r2 === `SOURCE_SAVED` ? s2.initialVm : 1;
      if (r2 === `SOURCE_SAVED` && (n2 || o2)) {
        if (c2 == null || !Number.isFinite(c2) || !(c2 > 0)) {
          i2.push({
            severity: `ERROR`,
            code: `DC_SOURCE_LOAD_VOLTAGE_UNKNOWN`,
            message: `Saved bus voltage is unavailable for active P/I load ${e3.id}; its PSS/E low-voltage load profile cannot be selected.`,
            equipment: e3.sourceEquipmentId
          });
          continue;
        }
        n2 && (a2.value === null || !Number.isFinite(a2.value)) ? i2.push({
          severity: `ERROR`,
          code: `DC_PQBRAK_UNKNOWN`,
          message: `Source PQBRAK is malformed or unavailable for a nonzero active constant-P load.`,
          equipment: e3.sourceEquipmentId
        }) : n2 && c2 < a2.value && i2.push({
          severity: `ERROR`,
          code: `DC_PQBRAK_LOAD_CURVE_UNSUPPORTED`,
          message: `Active constant-P load ${e3.id} has saved Vm ${c2} pu below source PQBRAK ${a2.value}; the PSS/E low-voltage load curve is not implemented in DC.`,
          equipment: e3.sourceEquipmentId
        }), o2 && c2 < 0.5 && i2.push({
          severity: `ERROR`,
          code: `DC_CONSTANT_I_LOAD_CURVE_UNSUPPORTED`,
          message: `Active constant-I load ${e3.id} has saved Vm ${c2} pu below the validated 0.5 pu PSS/E breakpoint; the low-voltage load curve is not implemented in DC.`,
          equipment: e3.sourceEquipmentId
        });
      }
    }
    return i2;
  }
  function pt(e2) {
    let t2 = performance.now(),
      n2 = {
        ...dt,
        ...e2.options
      },
      r2 = e2.scenario ?? ne(e2.network),
      i2 = Ye(e2.network, r2),
      a2 = B({
        mode: `PSSE`,
        sourceSha256: i2.sourceSha256,
        modelHash: i2.modelHash,
        topologyHash: ee(i2),
        normalizedModelHash: i2.modelHash,
        normalizedRevision: i2.revision,
        scenarioHash: r2.hash,
        solver: `LOSSLESS_DC`,
        engineVersion: L,
        algorithmId: `LOSSLESS_DC`,
        algorithmRevision: `lossless-dc-1`,
        controlPolicyId: `FIXED_CONTROLS`,
        controlPolicyRevision: `fixed-controls-1`,
        optionsHash: z(n2),
        resultSchemaRevision: `psse-result-1`,
        initialVoltagePolicy: n2.referenceAnglePolicy
      }),
      o2 = c(e2.model, i2, `LOSSLESS_DC`),
      s2 = ft(e2.model, i2, n2.loadVoltagePolicy),
      l2 = [...o2.findings, ...s2];
    if (o2.status === `BLOCKED` || s2.some(e3 => e3.severity === `ERROR`)) return $(a2, i2, l2, `BLOCKED`, performance.now() - t2);
    let {
        contraction: u2,
        findings: d2
      } = lt(e2.model, i2),
      f2 = [...l2, ...d2];
    if (f2.some(e3 => e3.severity === `ERROR`)) return $(a2, i2, f2, `BLOCKED`, performance.now() - t2, {
      switchThresholdPu: u2.threshold.valuePu,
      switchThresholdSource: u2.threshold.source,
      switchThresholdPrecision: u2.threshold.scalarPrecision
    });
    let p2 = i2.buses.map((e3, t3) => e3.status === 1 && e3.type === 3 ? t3 : -1).filter(e3 => e3 >= 0),
      m2 = e3 => n2.referenceAnglePolicy === `SOURCE_REFERENCE_ANGLE` ? (i2.buses[e3].initialVaDeg ?? 0) * Math.PI / 180 : 0,
      h2 = /* @__PURE__ */new Map();
    for (let e3 of p2) {
      let t3 = u2.busToNode[e3];
      h2.has(t3) && f2.push({
        severity: `ERROR`,
        code: `DC_CONTRACTED_REFERENCE_COLLISION`,
        message: `More than one reference bus lies inside one ideal-switch contracted node.`,
        equipment: i2.buses[e3].sourceEquipmentId ?? void 0
      }), h2.set(t3, e3);
    }
    if (f2.some(e3 => e3.severity === `ERROR`)) return $(a2, i2, f2, `BLOCKED`, performance.now() - t2);
    let g2 = u2.nodeBuses.map((e3, t3) => t3).filter(e3 => !h2.has(e3)),
      _2 = new Map(g2.map((e3, t3) => [e3, t3])),
      v2 = g2.map(() => /* @__PURE__ */new Map()),
      y2 = new Float64Array(u2.nodeBuses.length),
      b2 = new Float64Array(u2.nodeBuses.length),
      x2 = new Float64Array(u2.nodeBuses.length),
      S2 = new Set(u2.branches.map(e3 => e3.id));
    for (let [e3, t3] of h2) b2[e3] = m2(t3), x2[e3] = b2[e3];
    let C2 = e3 => 1 / (e3.xPu * (n2.tapPolicy === `TAP_AWARE_LOSSLESS` ? e3.tapFrom * e3.tapTo : 1));
    for (let e3 of i2.branches) {
      if (e3.status !== 1 || S2.has(e3.id)) continue;
      let t3 = e3.xPu,
        r3 = n2.tapPolicy === `TAP_AWARE_LOSSLESS` ? e3.tapFrom * e3.tapTo : 1;
      if (t3 === 0 || !Number.isFinite(t3) || !(r3 > 0) || !Number.isFinite(r3)) {
        f2.push({
          severity: `ERROR`,
          code: `DC_BRANCH_REACTANCE_UNSUPPORTED`,
          message: `Lossless DC requires finite nonzero signed reactance and a positive finite tap on ${e3.id}.`,
          equipment: e3.sourceEquipmentId
        });
        continue;
      }
      let i3 = C2(e3),
        a3 = e3.phaseDeg * Math.PI / 180,
        o3 = u2.busToNode[e3.from],
        s3 = u2.busToNode[e3.to],
        c2 = _2.get(o3),
        l3 = _2.get(s3);
      c2 !== void 0 && (v2[c2].set(c2, (v2[c2].get(c2) ?? 0) + i3), l3 !== void 0 && v2[c2].set(l3, (v2[c2].get(l3) ?? 0) - i3)), l3 !== void 0 && (v2[l3].set(l3, (v2[l3].get(l3) ?? 0) + i3), c2 !== void 0 && v2[l3].set(c2, (v2[l3].get(c2) ?? 0) - i3)), y2[o3] += -i3 * a3, y2[s3] += i3 * a3;
    }
    if (f2.some(e3 => e3.severity === `ERROR`)) return $(a2, i2, f2, `BLOCKED`, performance.now() - t2);
    let w2 = G(v2),
      T2 = new Float64Array(g2.length),
      E2 = new Float64Array(i2.buses.length),
      D2 = new Float64Array(i2.buses.length),
      O2 = new Float64Array(i2.buses.length),
      k2 = i2.branches.map(e3 => {
        if (e3.rPu === 0 && e3.xPu === 0) return {
          from: 0,
          to: 0
        };
        let t3 = Ge(e3.rPu, e3.xPu, e3.tapFrom, e3.tapTo, e3.phaseDeg),
          n3 = e3.yff.re - t3.yff.re,
          r3 = e3.ytt.re - t3.ytt.re;
        return Math.abs(n3) < 1e-12 && (n3 = 0), Math.abs(r3) < 1e-12 && (r3 = 0), {
          from: n3,
          to: r3
        };
      });
    for (let e3 of i2.loads) if (e3.status === 1) {
      let t3 = i2.buses[e3.bus],
        r3 = Math.abs(e3.ipMw) + Math.abs(e3.iqMvar) + Math.abs(e3.ypMw) + Math.abs(e3.yqMvar) > 1e-12,
        a3 = n2.loadVoltagePolicy === `SOURCE_SAVED` ? t3.initialVm : 1;
      if ((a3 == null || !(a3 > 0)) && r3) {
        f2.push({
          severity: `ERROR`,
          code: `DC_LOAD_SOURCE_VOLTAGE_UNKNOWN`,
          message: `PSS/E DCLF source working voltage is unavailable for voltage-dependent load ${e3.id}.`,
          equipment: e3.sourceEquipmentId
        });
        continue;
      }
      E2[e3.bus] += re(e3, a3 && a3 > 0 ? a3 : 1, i2.baseMva).p * i2.baseMva;
    }
    for (let e3 of i2.generators) e3.status === 1 && (O2[e3.bus] += e3.pMw);
    if (n2.includeRealShuntConsumption) {
      for (let e3 of i2.shunts) if (e3.status === 1) {
        let t3 = i2.buses[e3.bus],
          r3 = n2.realShuntVoltagePolicy === `SOURCE_SAVED` ? t3.initialVm : 1;
        if (r3 == null || !(r3 > 0)) {
          f2.push({
            severity: `ERROR`,
            code: `DC_REAL_SHUNT_VOLTAGE_UNKNOWN`,
            message: `PSS/E DCLF source working voltage is unavailable at shunt bus ${t3.id}.`,
            equipment: e3.sourceEquipmentId
          });
          continue;
        }
        D2[e3.bus] += e3.gMw * r3 * r3;
      }
      for (let e3 = 0; e3 < i2.branches.length; e3++) {
        let t3 = i2.branches[e3];
        if (t3.status !== 1) continue;
        let r3 = [[t3.from, k2[e3].from], [t3.to, k2[e3].to]];
        for (let [e4, a3] of r3) {
          if (!a3) continue;
          let r4 = i2.buses[e4],
            o3 = n2.realShuntVoltagePolicy === `SOURCE_SAVED` ? r4.initialVm : 1;
          if (o3 == null || !(o3 > 0)) {
            f2.push({
              severity: `ERROR`,
              code: `DC_TERMINAL_SHUNT_VOLTAGE_UNKNOWN`,
              message: `PSS/E DCLF source working voltage is unavailable at branch terminal ${r4.id}.`,
              equipment: t3.sourceEquipmentId
            });
            continue;
          }
          D2[e4] += a3 * o3 * o3 * i2.baseMva;
        }
      }
    }
    if (f2.some(e3 => e3.severity === `ERROR`)) return $(a2, i2, f2, `BLOCKED`, performance.now() - t2);
    let A2 = new Float64Array(u2.nodeBuses.length),
      j2 = new Float64Array(u2.nodeBuses.length),
      M2 = new Float64Array(u2.nodeBuses.length);
    for (let e3 = 0; e3 < i2.buses.length; e3++) {
      let t3 = u2.busToNode[e3];
      t3 < 0 || (A2[t3] += O2[e3], j2[t3] += E2[e3], M2[t3] += D2[e3]);
    }
    for (let e3 = 0; e3 < g2.length; e3++) {
      let t3 = g2[e3],
        n3 = (A2[t3] - j2[t3] - M2[t3]) / i2.baseMva,
        r3 = 0;
      for (let e4 of i2.branches) {
        if (e4.status !== 1 || S2.has(e4.id)) continue;
        let n4 = C2(e4),
          i3 = u2.busToNode[e4.from],
          a3 = u2.busToNode[e4.to];
        i3 === t3 && h2.has(a3) ? r3 += n4 * b2[a3] : a3 === t3 && h2.has(i3) && (r3 += n4 * b2[i3]);
      }
      T2[e3] = n3 - y2[t3] + r3;
    }
    if (e2.cancelled?.()) return $(a2, i2, f2, `CANCELLED`, performance.now() - t2);
    let N2;
    try {
      if (w2.N) {
        if (N2 = K(w2, T2), !N2.x || N2.relativeResidual === null || N2.relativeResidual > 1e-6) return {
          ...$(a2, i2, [...f2, {
            severity: `ERROR`,
            code: `DC_LINEAR_SOLVE_FAILED`,
            message: `Lossless DC sparse matrix did not solve with acceptable true residual.`
          }], `NON_CONVERGED`, performance.now() - t2),
          diagnostics: {
            linear: N2.diagnostics
          }
        };
        for (let e3 = 0; e3 < g2.length; e3++) x2[g2[e3]] = N2.x[e3];
      } else N2 = {
        x: /* @__PURE__ */new Float64Array(),
        relativeResidual: 0,
        diagnostics: {
          dimension: 0,
          nnz: 0
        }
      };
    } catch (e3) {
      return {
        ...$(a2, i2, [...f2, {
          severity: `ERROR`,
          code: `DC_FACTOR_FAILED`,
          message: e3 instanceof Error ? e3.message : String(e3)
        }], `NON_CONVERGED`, performance.now() - t2),
        diagnostics: {
          dimension: w2.N,
          nnz: w2.colIdx.length
        }
      };
    }
    let P2 = new Float64Array(i2.buses.length);
    for (let e3 = 0; e3 < i2.buses.length; e3++) {
      let t3 = u2.busToNode[e3];
      t3 >= 0 && (P2[e3] = x2[t3]);
    }
    let F2 = new Float64Array(i2.buses.length);
    for (let e3 of i2.branches) if (e3.status === 1 && !S2.has(e3.id)) {
      let t3 = i2.baseMva * C2(e3) * (P2[e3.from] - P2[e3.to] - e3.phaseDeg * Math.PI / 180);
      F2[e3.from] += t3, F2[e3.to] -= t3;
    }
    for (let [e3, t3] of h2) {
      let n3 = 0;
      for (let t4 of u2.nodeBuses[e3]) n3 += F2[t4] + E2[t4] + D2[t4] - O2[t4];
      O2[t3] += n3;
    }
    let I2 = new Float64Array(i2.buses.length);
    for (let e3 = 0; e3 < i2.buses.length; e3++) I2[e3] = O2[e3] - E2[e3] - D2[e3] - F2[e3];
    let R2;
    try {
      R2 = ut(u2, i2, I2);
    } catch (e3) {
      return {
        ...$(a2, i2, [...f2, {
          severity: `ERROR`,
          code: `DC_IDEAL_SWITCH_FLOW_RECOVERY_FAILED`,
          message: e3 instanceof Error ? e3.message : String(e3)
        }], `NON_CONVERGED`, performance.now() - t2),
        diagnostics: {
          switchThresholdPu: u2.threshold.valuePu,
          switchThresholdSource: u2.threshold.source,
          switchThresholdPrecision: u2.threshold.scalarPrecision
        }
      };
    }
    if (R2.relativeResidual > 1e-7) return $(a2, i2, [...f2, {
      severity: `ERROR`,
      code: `DC_IDEAL_SWITCH_KCL_RESIDUAL`,
      message: `Ideal-switch terminal recovery residual ${R2.relativeResidual} exceeds the validated tolerance.`
    }], `NON_CONVERGED`, performance.now() - t2, {
      switchRecoveryResidual: R2.relativeResidual
    });
    for (let e3 of u2.branches) {
      let t3 = R2.flows.get(e3.id) ?? 0;
      F2[e3.from] += t3, F2[e3.to] -= t3;
    }
    let te2 = i2.branches.map((e3, t3) => {
        if (e3.status !== 1) return {
          id: e3.id,
          sourceEquipmentId: e3.sourceEquipmentId,
          terminalFrom: e3.terminalFrom,
          terminalTo: e3.terminalTo,
          pFromMw: null,
          qFromMvar: null,
          pToMw: null,
          qToMvar: null,
          pLossMw: null,
          qLossMvar: null
        };
        let r3 = S2.has(e3.id) ? R2.flows.get(e3.id) ?? 0 : i2.baseMva * C2(e3) * (P2[e3.from] - P2[e3.to] - e3.phaseDeg * Math.PI / 180),
          a3 = n2.realShuntVoltagePolicy === `SOURCE_SAVED` ? i2.buses[e3.from].initialVm ?? 1 : 1,
          o3 = n2.realShuntVoltagePolicy === `SOURCE_SAVED` ? i2.buses[e3.to].initialVm ?? 1 : 1,
          s3 = n2.includeRealShuntConsumption ? k2[t3].from * a3 * a3 * i2.baseMva : 0,
          c2 = n2.includeRealShuntConsumption ? k2[t3].to * o3 * o3 * i2.baseMva : 0,
          l3 = r3 + s3,
          u3 = -r3 + c2;
        return {
          id: e3.id,
          sourceEquipmentId: e3.sourceEquipmentId,
          terminalFrom: e3.terminalFrom,
          terminalTo: e3.terminalTo,
          pFromMw: l3,
          qFromMvar: null,
          pToMw: u3,
          qToMvar: null,
          pLossMw: l3 + u3,
          qLossMvar: null
        };
      }),
      H2 = i2.buses.flatMap((e3, t3) => e3.source ? [{
        id: e3.id,
        connectionKey: e3.connectionKey,
        vmPu: null,
        vaDeg: e3.status === 1 ? P2[t3] * 180 / Math.PI : null,
        pGenerationMw: e3.status === 1 ? F2[t3] + E2[t3] + D2[t3] : null,
        qGenerationMvar: null,
        sourceEquipmentId: e3.sourceEquipmentId
      }] : []),
      ie2 = i2.generators.map(e3 => {
        if (e3.status !== 1) return {
          id: e3.id,
          sourceEquipmentId: e3.sourceEquipmentId,
          pMw: null,
          qMvar: null,
          limitState: `UNAVAILABLE`
        };
        let t3 = i2.generators.filter(t4 => t4.status === 1 && t4.bus === e3.bus),
          n3 = p2.includes(e3.bus);
        return n3 && t3.length === 1 ? {
          id: e3.id,
          sourceEquipmentId: e3.sourceEquipmentId,
          pMw: H2.find(t4 => t4.sourceEquipmentId === i2.buses[e3.bus].sourceEquipmentId)?.pGenerationMw ?? null,
          qMvar: null,
          limitState: `UNAVAILABLE`
        } : (n3 && t3.length > 1 && f2.push({
          severity: `WARNING`,
          code: `PER_MACHINE_DISPATCH_UNAVAILABLE`,
          message: `${t3.length} generators share reference bus ${i2.buses[e3.bus].id}; only aggregate active generation is determined.`,
          equipment: e3.id
        }), {
          id: e3.id,
          sourceEquipmentId: e3.sourceEquipmentId,
          pMw: n3 ? null : e3.pMw,
          qMvar: null,
          limitState: `UNAVAILABLE`
        });
      }),
      U2 = 0;
    for (let e3 = 0; e3 < i2.buses.length; e3++) {
      let t3 = i2.buses[e3];
      t3.status === 1 && t3.type !== 3 && (U2 = Math.max(U2, Math.abs((F2[e3] - O2[e3] + E2[e3] + D2[e3]) / i2.baseMva)));
    }
    let ae2 = n2.includeRealShuntConsumption ? i2.branches.reduce((e3, t3, r3) => {
        if (t3.status !== 1) return e3;
        let a3 = n2.realShuntVoltagePolicy === `SOURCE_SAVED` ? i2.buses[t3.from].initialVm ?? 1 : 1,
          o3 = n2.realShuntVoltagePolicy === `SOURCE_SAVED` ? i2.buses[t3.to].initialVm ?? 1 : 1;
        return e3 + (k2[r3].from * a3 * a3 + k2[r3].to * o3 * o3) * i2.baseMva;
      }, 0) : 0,
      W2 = f2.some(e3 => e3.code === `PER_MACHINE_DISPATCH_UNAVAILABLE` || e3.code === `DC_REACTIVE_CONTROL_OMITTED` || e3.code === `BASE_KV_UNAVAILABLE_PER_UNIT_PROFILE`) ? `PARTIAL` : `SUPPORTED`,
      oe2 = `CONVERGED`;
    return {
      schema: `ga.psse.calculation.v1`,
      id: a2.id,
      identity: a2,
      method: `LOSSLESS_DC`,
      status: oe2,
      classification: V({
        status: oe2,
        physicsCoverage: W2,
        findings: f2
      }),
      physicsCoverage: W2,
      referenceComparisonStatus: `NOT_COMPARED`,
      source: `GA_PSSE_CALCULATED`,
      baseMva: i2.baseMva,
      iterations: 1,
      outerRounds: 0,
      elapsedMs: performance.now() - t2,
      maxPMismatchPu: U2,
      maxQMismatchPu: null,
      busResults: H2,
      branchResults: te2,
      generatorResults: ie2,
      unsolvedIslands: [],
      diagnostics: {
        approximation: `LOSSLESS_DC`,
        voltageMagnitudePu: 1,
        voltageMagnitudeStatus: `FIXED_DC_ASSUMPTION_NOT_SOLVED`,
        loadVoltagePolicy: n2.loadVoltagePolicy,
        realShuntConsumptionIncluded: n2.includeRealShuntConsumption,
        realShuntVoltagePolicy: n2.realShuntVoltagePolicy,
        terminalConductanceConsumptionIncluded: n2.includeRealShuntConsumption,
        terminalConductanceConsumptionMw: ae2,
        seriesResistanceAndLosses: `OMITTED_BY_LOSSLESS_DC`,
        tapPolicy: n2.tapPolicy,
        reactanceTapConvention: n2.tapPolicy === `PSSE36_DCLF_COMPAT` ? `b=1/xPu, PSS/E 36.5 DCLF reference profile` : `b=1/(xPu*tapFrom*tapTo), tap-aware lossless profile`,
        switchContraction: {
          thresholdPu: u2.threshold.valuePu,
          thresholdSource: u2.threshold.source,
          thresholdPrecision: u2.threshold.scalarPrecision,
          contractedBranchCount: u2.branches.length,
          contractedBusCount: u2.components.reduce((e3, t3) => e3 + t3.buses.length, 0),
          componentCount: u2.components.length,
          cycleRank: u2.cycleRank,
          cyclicComponentCount: R2.cyclicComponentCount,
          flowRecovery: `TREE_KCL_OR_POSITIVE_X_MINIMUM_ENERGY_CUTSPACE`,
          maxRecoveryRelativeResidual: R2.relativeResidual
        },
        linear: {
          dimension: w2.N,
          nnz: w2.colIdx.length,
          trueResidual: N2.relativeResidual,
          backend: `KLU_WASM`
        },
        referenceBuses: p2.map(e3 => i2.buses[e3].id)
      },
      findings: f2
    };
  }
  let mt = self;
  mt.onmessage = ({
    data: e2
  }) => {
    let t2 = `CALCULATION`;
    try {
      let n2 = t3 => mt.postMessage({
          id: e2.id,
          type: `PROGRESS`,
          ...t3
        }),
        r2 = {
          model: e2.model,
          network: e2.network,
          scenario: e2.scenario,
          options: e2.options
        },
        i2 = e2.method === `NR_POLAR` ? tt({
          ...r2,
          progress: n2
        }) : e2.method === `FDNS_XB` ? st({
          ...r2,
          progress: n2
        }) : pt(r2);
      t2 = `RESULT_SERIALIZATION`, mt.postMessage({
        id: e2.id,
        type: `RESULT`,
        result: i2
      });
    } catch (n2) {
      let r2 = n2 instanceof Error ? n2.message : String(n2),
        i2 = n2 instanceof Error ? n2.stack : void 0;
      try {
        mt.postMessage({
          id: e2.id,
          type: `ERROR`,
          method: e2.method,
          phase: t2,
          error: r2,
          stack: i2
        });
      } catch {}
    }
  };
})();
