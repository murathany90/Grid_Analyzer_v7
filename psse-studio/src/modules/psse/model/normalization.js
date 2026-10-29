// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.bo = function bo(e2, t2, n2, r2 = `identity`) {
  let i2 = e2.operating[t2],
    a2 = e2.kind === `line` ? `BRANCH` : e2.kind === `generator` ? `GENERATOR` : e2.kind === `load` ? `LOAD` : e2.kind === `transformer` ? `TRANSFORMER` : e2.kind === `shunt` ? String(e2.fields.subtype) === `switched` ? `SWITCHED_SHUNT` : `FIXED_SHUNT` : e2.kind === `switch` ? `SYSTEM_SWITCHING_DEVICE` : `BUS`,
    o2 = i2?.field ?? `${a2}.${t2}`,
    s2,
    c2,
    l2 = i2?.offset,
    u2 = /^SAV\.([A-Za-z0-9_]+)\[(\d+)\]/.exec(o2);
  if (u2) s2 = u2[1], c2 = Number(u2[2]);else if (e2.fields.savIndex !== void 0) {
    let n3 = Array.isArray(e2.fields.windings) ? e2.fields.windings[0] : void 0,
      r3 = Number(e2.fields.savBranchIndex ?? n3?.savIndex ?? e2.fields.savIndex);
    Number.isFinite(r3) && r3 > 0 && (c2 = r3), s2 = {
      rpu: `Gb`,
      xpu: `Gb`,
      gi: `Gbline`,
      bi: `Gbline`,
      gj: `Gbline`,
      bj: `Gbline`,
      bpu: `B2s`,
      r12Pu: `Gbtran`,
      x12Pu: `Gbtran`,
      r1_2: `Gbtran`,
      x1_2: `Gbtran`,
      r23Pu: `Gbtran`,
      x23Pu: `Gbtran`,
      r2_3: `Gbtran`,
      x2_3: `Gbtran`,
      r31Pu: `Gbtran`,
      x31Pu: `Gbtran`,
      r3_1: `Gbtran`,
      x3_1: `Gbtran`,
      ratio1Pu: `Windrp`,
      windv1: `Windrp`,
      ratio2Pu: `Windrs`,
      windv2: `Windrs`,
      ang1: `Psangl`,
      mag1: `Gbline`,
      mag2: `Gbline`,
      baskv: `Basvlt`,
      ide: `Jcode`,
      vm: `Volt`,
      va: `Volt`,
      packedNumbus: `Numbus`,
      ibus: `Numbus`
    }[t2];
  }
  return {
    sourceEquipmentId: e2.id,
    sourceField: o2,
    unit: i2?.unit ?? n2,
    equation: r2,
    revision: `psse-normalize-1`,
    ...(s2 === void 0 ? {} : {
      array: s2
    }),
    ...(c2 === void 0 ? {} : {
      index: c2
    }),
    ...(l2 === void 0 ? {} : {
      offset: l2
    })
  };
};
ctx.xo = function xo(e2, t2) {
  let n2 = e2 * e2 + t2 * t2;
  if (!(n2 > 0) || !Number.isFinite(n2)) throw Error(`ZERO_OR_INVALID_SERIES_IMPEDANCE`);
  return {
    re: e2 / n2,
    im: -t2 / n2
  };
};
ctx.To = function To(e2, t2, n2 = 1, r2 = 1, i2 = 0, a2 = {
  re: 0,
  im: 0
}) {
  let o2 = ctx.xo(e2, t2),
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
    yff: ctx.So(ctx.Co(o2, 1 / d2), a2),
    yft: ctx.Co(ctx.wo(o2, p2), -1),
    ytf: ctx.Co(ctx.wo(o2, m2), -1),
    ytt: ctx.Co(o2, 1 / f2)
  };
};
ctx.Eo = function Eo(e2, t2, n2) {
  let r2 = [];
  for (let i2 of t2) {
    let t3 = ctx.vo(e2.fields[i2]);
    t3 === null ? n2.push({
      severity: `ERROR`,
      code: `NORMALIZATION_FIELD_MISSING`,
      message: `${e2.id}.${i2} has no finite source value.`,
      equipment: e2.id
    }) : r2.push(t3);
  }
  return r2;
};
ctx.Do = function Do(e2, t2, n2, r2, i2, a2) {
  let o2 = ``,
    s2 = null,
    c2 = null,
    l2 = null,
    u2 = null,
    d2 = 0,
    f2 = false,
    p2 = 0,
    m2 = null,
    h2 = (Array.isArray(e2.fields.windings) ? e2.fields.windings : [])[0];
  if (h2) {
    if (p2 = ctx.vo(h2.controlMode) ?? 0, p2 === 0) return null;
    o2 = String(h2.controlledConnectionKey ?? ``), m2 = ctx.vo(h2.controlledBus), s2 = ctx.vo(h2.vmax), c2 = ctx.vo(h2.vmin), l2 = ctx.vo(h2.sourceRmax), u2 = ctx.vo(h2.sourceRmin), d2 = ctx.vo(h2.tapPositions) ?? 0, f2 = (ctx.vo(h2.controlledBusSign) ?? 1) < 0;
  } else {
    if (p2 = ctx.vo(e2.fields.cod1) ?? 0, p2 === 0) return null;
    m2 = ctx.vo(e2.fields.cont1), s2 = ctx.vo(e2.fields.vma1), c2 = ctx.vo(e2.fields.vmi1), l2 = ctx.vo(e2.fields.rma1), u2 = ctx.vo(e2.fields.rmi1), d2 = ctx.vo(e2.fields.ntp1) ?? 0;
  }
  if (m2 !== null && !o2 && (o2 = r2.get(m2) ?? ``), h2 === void 0 && l2 !== null && u2 !== null) {
    let r3 = n2.get(i2),
      a3 = r3 === void 0 ? null : t2[r3]?.baseKv,
      o3 = ctx.vo(e2.fields.cw) ?? 1;
    if (o3 === 2 && a3 !== null && a3 > 0) l2 /= a3, u2 /= a3;else if (o3 === 3 && a3 !== null && a3 > 0) {
      let t3 = ((ctx.vo(e2.fields.nomv1) ?? a3) || a3) / a3;
      l2 *= t3, u2 *= t3;
    }
  }
  if (!o2 || !n2.has(o2) || s2 === null || c2 === null || l2 === null || u2 === null || !(l2 > u2) || !(l2 <= 2.5 && u2 >= 0.4)) return a2.push({
    severity: `WARNING`,
    code: `TAP_CONTROL_NOT_ADJUSTABLE`,
    message: `Automatic transformer tap control is present but its band, ratio limits or controlled bus cannot be applied; the tap stays at its source ratio.`,
    equipment: e2.id
  }), null;
  let g2 = d2 > 1 ? (l2 - u2) / (d2 - 1) : null;
  return g2 === null || !(g2 > 0) ? (a2.push({
    severity: `WARNING`,
    code: `TAP_CONTROL_NOT_ADJUSTABLE`,
    message: `Automatic transformer tap control has no resolvable tap step; the tap stays at its source ratio.`,
    equipment: e2.id
  }), null) : {
    regulatedKey: o2,
    regulatedBusExternal: m2,
    regulatesTapSide: o2 === i2,
    vmaxPu: s2,
    vminPu: c2,
    tapMaxPu: l2,
    tapMinPu: u2,
    tapStepPu: g2,
    reverse: f2
  };
};
ctx.Oo = function Oo(e2, t2) {
  return ctx.vo(e2.fields[t2]);
};
ctx.ko = function ko(e2, t2) {
  let n2 = e2.case[t2 === `line` ? `lineRatingUnits` : `transformerRatingUnits`];
  if (n2 === `MVA` || n2 === `CURRENT_EXPRESSED_AS_MVA`) return n2;
  let r2 = e2.case.identification,
    i2 = Array.isArray(r2) ? r2[t2 === `line` ? 4 : 3] : void 0,
    a2 = e2.sourceTables.CASEID?.[0],
    o2 = ctx.vo(i2 ?? a2?.[t2 === `line` ? `nxfrat` : `xfrrat`]);
  return o2 === null ? `UNKNOWN` : o2 > 0 ? `CURRENT_EXPRESSED_AS_MVA` : `MVA`;
};
ctx.Ao = function Ao(e2, t2 = `rate`) {
  return Array.from({
    length: 12
  }, (n2, r2) => ctx.vo(e2[`${t2}${r2 + 1}`]));
};
ctx.jo = function jo(e2, t2) {
  let n2 = ctx.Ao(e2.fields, `wdg${t2}rate`);
  if (n2.some(e3 => e3 !== null)) return n2;
  let r2 = (Array.isArray(e2.fields.windings) ? e2.fields.windings : [])[t2 - 1]?.ratings;
  return Array.isArray(r2) ? Array.from({
    length: 12
  }, (e3, t3) => ctx.vo(r2[t3])) : t2 === 1 ? ctx.Ao(e2.fields, `rate`) : n2;
};
ctx.Mo = function Mo(e2, t2, n2) {
  let r2 = ctx.vo(e2.fields.modsw) ?? 0;
  if (r2 === 0) return null;
  let i2 = ctx.vo(e2.fields.vswhi),
    a2 = ctx.vo(e2.fields.vswlo),
    o2 = (Array.isArray(e2.fields.blocks) ? e2.fields.blocks : []).map(e3 => ({
      steps: ctx.vo(e3.steps) ?? 0,
      susceptanceMvar: ctx.vo(e3.susceptanceMvar) ?? 0
    })).filter(e3 => e3.steps > 0 && e3.susceptanceMvar !== 0);
  if (i2 === null || a2 === null || !o2.length) return n2.push({
    severity: `WARNING`,
    code: `SWITCHED_SHUNT_CONTROL_NOT_ADJUSTABLE`,
    message: `Automatic switched-shunt control is present but its band or block table cannot be applied; the initial susceptance stays fixed.`,
    equipment: e2.id
  }), null;
  let s2 = ctx.vo(e2.fields.swrem) ?? 0;
  return {
    modsw: r2,
    vhiPu: i2,
    vloPu: a2,
    remoteKey: s2 === 0 ? null : t2.get(s2) ?? null,
    blocks: o2
  };
};
ctx.No = function No(e2) {
  let t2 = [],
    n2 = e2.equipment.filter(e3 => e3.kind === `bus`),
    r2 = [],
    i2 = /* @__PURE__ */new Map(),
    a2 = {},
    o2 = 0;
  for (let e3 of n2) {
    let n3 = String(e3.fields.connectionKey ?? e3.buses[0] ?? e3.fields.ibus ?? e3.id),
      s3 = ctx.vo(e3.fields.ibus),
      c3 = ctx.vo(e3.fields.section),
      l3 = ctx.vo(e3.fields.baskv),
      u3 = ctx.vo(e3.fields.ide),
      d3 = e3.status;
    if (i2.has(n3)) {
      t2.push({
        severity: `ERROR`,
        code: `DUPLICATE_CONNECTION_KEY`,
        message: `Connection key ${n3} is repeated.`,
        equipment: e3.id
      });
      continue;
    }
    let f3 = r2.length;
    i2.set(n3, f3), a2[e3.id] = [`bus:${n3}`], (l3 === null || l3 <= 0) && o2++, (u3 === null || ![1, 2, 3, 4].includes(u3) || d3 === null || ![0, 1].includes(d3)) && t2.push({
      severity: `ERROR`,
      code: `BUS_SEMANTICS_UNKNOWN`,
      message: `Bus type or active status is missing or unsupported.`,
      equipment: e3.id
    });
    let p3 = Object.hasOwn(e3.fields, `packedNumbus`) ? `packedNumbus` : `ibus`;
    r2.push({
      id: e3.id,
      connectionKey: n3,
      externalNumber: s3,
      section: c3,
      sourceEquipmentId: e3.id,
      baseKv: l3 !== null && l3 > 0 ? l3 : null,
      type: u3 ?? 4,
      status: d3 ?? 0,
      initialVm: ctx.vo(e3.fields.vm),
      initialVaDeg: ctx.vo(e3.fields.va),
      source: e3.fields.threeWindingStar !== true,
      fieldMap: [ctx.bo(e3, p3, `bus number/packed connection key`, `external bus/section identity`), ctx.bo(e3, `baskv`, `kV`, `source voltage base; unavailable bases stay unknown`), ctx.bo(e3, `ide`, `bus type code`, `PSS/E IDE/Jcode mapping`), ctx.bo(e3, `vm`, `pu`, `saved initial voltage only`), ctx.bo(e3, `va`, `deg`, `saved initial angle only`)]
    });
  }
  let s2 = e2.completeness === `PARTIAL` && e2.findings.length > 0 && e2.findings.every(e3 => e3.code === `UNSPECIFIED_BASE_KV` || e3.code === `INSPECTION_ONLY`),
    c2 = /* @__PURE__ */new Map();
  for (let e3 of r2) e3.externalNumber !== null && !c2.has(e3.externalNumber) && c2.set(e3.externalNumber, e3.connectionKey);
  o2 && t2.push({
    severity: `WARNING`,
    code: `BASE_KV_UNAVAILABLE_PER_UNIT_PROFILE`,
    message: `${o2} source bus voltage bases are unspecified. Per-unit equations may run only when no kV conversion is required; base kV remains unknown and ampere/current metrics are unavailable.`
  }), e2.completeness === `PARTIAL` && !s2 && t2.push({
    severity: `ERROR`,
    code: `SOURCE_MODEL_PARTIAL`,
    message: `The native source inspection is partial; unresolved source records may affect electrical equations.`
  }), e2.case.baseMva > 0 || t2.push({
    severity: `ERROR`,
    code: `INVALID_SYSTEM_BASE`,
    message: `System MVA base must be positive.`
  });
  let l2 = (n3, r3, o3, s3, c3, l3, d3, f3, p3, m3, h2, g2, _2, v2) => {
      let y2 = i2.get(o3),
        b2 = i2.get(s3);
      if (y2 === void 0 || b2 === void 0) {
        t2.push({
          severity: `ERROR`,
          code: `BRANCH_TERMINAL_UNMAPPED`,
          message: `Branch terminals ${o3}/${s3} do not map to buses.`,
          equipment: n3.id
        });
        return;
      }
      if (_2 === null || ![0, 1].includes(_2)) {
        t2.push({
          severity: `ERROR`,
          code: `BRANCH_STATUS_UNKNOWN`,
          message: `Branch status is unknown.`,
          equipment: n3.id
        });
        return;
      }
      try {
        let t3 = ctx.To(l3, d3, f3, p3, m3, h2),
          i3 = ctx.ko(e2, c3 === `line` ? `line` : `transformer`),
          x2 = r3 === `1` ? n3.id : `${n3.id}:w${r3}`,
          S2 = {
            id: x2,
            sourceEquipmentId: n3.id,
            windingId: r3,
            from: y2,
            to: b2,
            fromKey: o3,
            toKey: s3,
            kind: c3,
            rPu: l3,
            xPu: d3,
            tapFrom: f3,
            tapTo: p3,
            phaseDeg: m3,
            ...t3,
            ratingBasis: i3,
            ratingsFromSource: Array(12).fill(null),
            ratingsToSource: Array(12).fill(null),
            rateMva: g2,
            status: _2,
            fieldMap: v2,
            terminalFrom: o3,
            terminalTo: s3
          };
        u2.push(S2), (a2[n3.id] ??= []).push(x2);
      } catch (e3) {
        t2.push({
          severity: `ERROR`,
          code: `BRANCH_PRIMITIVE_INVALID`,
          message: e3 instanceof Error ? e3.message : String(e3),
          equipment: n3.id
        });
      }
    },
    u2 = [];
  for (let n3 of e2.equipment) if (n3.kind === `line`) {
    let [r3, o3, s3] = ctx.Eo(n3, [`rpu`, `xpu`, `bpu`], t2),
      c3 = n3.status,
      l3 = String(n3.fields.connectionKey ?? n3.buses[0] ?? n3.fields.ibus),
      d3 = String(n3.fields.jconnectionKey ?? n3.buses[1] ?? n3.fields.jbus);
    if (r3 === void 0 || o3 === void 0 || s3 === void 0) continue;
    if (c3 !== 0 && c3 !== 1) {
      t2.push({
        severity: `ERROR`,
        code: `BRANCH_STATUS_UNKNOWN`,
        message: `Line status is unknown.`,
        equipment: n3.id
      });
      continue;
    }
    let f3 = ctx.Oo(n3, `gi`) ?? 0,
      p3 = ctx.Oo(n3, `bi`) ?? 0,
      m3 = ctx.Oo(n3, `gj`) ?? 0,
      h2 = ctx.Oo(n3, `bj`) ?? 0,
      g2 = {
        re: f3,
        im: p3 + s3 / 2
      },
      _2 = {
        re: m3,
        im: h2 + s3 / 2
      },
      v2 = ctx.xo(r3, o3),
      y2 = i2.get(l3),
      b2 = i2.get(d3);
    if (y2 === void 0 || b2 === void 0) {
      t2.push({
        severity: `ERROR`,
        code: `BRANCH_TERMINAL_UNMAPPED`,
        message: `Line endpoint key has no bus.`,
        equipment: n3.id
      });
      continue;
    }
    let x2 = {
        rpu: `pu`,
        xpu: `pu`,
        bpu: `pu`,
        gi: `pu`,
        bi: `pu`,
        gj: `pu`,
        bj: `pu`,
        stat: `status`,
        bp: `code`
      },
      S2 = [`rpu`, `xpu`, `bpu`, `gi`, `bi`, `gj`, `bj`, `stat`, `bp`].map(e3 => ctx.bo(n3, e3, x2[e3], e3 === `rpu` || e3 === `xpu` ? `source series impedance` : e3 === `bp` ? `PSS/E bypass flag; active nonzero values require ideal-link treatment` : `per-unit terminal admittance or status`)),
      C2 = ctx.ko(e2, `line`),
      w2 = ctx.Ao(n3.fields),
      T2 = Array.from({
        length: 12
      }, (e3, t3) => ctx.bo(n3, `rate${t3 + 1}`, `MVA equivalent at bus base`, `RATE${t3 + 1}; basis=${C2}`));
    u2.push({
      id: n3.id,
      sourceEquipmentId: n3.id,
      windingId: String(n3.fields.ckt ?? `1`),
      from: y2,
      to: b2,
      fromKey: l3,
      toKey: d3,
      kind: `line`,
      rPu: r3,
      xPu: o3,
      tapFrom: 1,
      tapTo: 1,
      phaseDeg: 0,
      yff: ctx.So(v2, g2),
      yft: ctx.Co(v2, -1),
      ytf: ctx.Co(v2, -1),
      ytt: ctx.So(v2, _2),
      ratingBasis: C2,
      ratingsFromSource: w2,
      ratingsToSource: [...w2],
      rateMva: C2 === `MVA` ? w2[0] : null,
      status: c3,
      fieldMap: [...S2, ...T2],
      terminalFrom: l3,
      terminalTo: d3
    }), a2[n3.id] = [n3.id];
  } else if (n3.kind === `switch` && n3.id.startsWith(`switch:system:`)) {
    let e3 = ctx.Oo(n3, `xpu`),
      r3 = n3.status,
      o3 = String(n3.buses[0] ?? n3.fields.ibus),
      s3 = String(n3.buses[1] ?? n3.fields.jbus);
    if (e3 === null || !Number.isFinite(e3)) {
      t2.push({
        severity: `ERROR`,
        code: `SYSTEM_SWITCH_REACTANCE_UNKNOWN`,
        message: `System switching device series reactance is missing or invalid.`,
        equipment: n3.id
      });
      continue;
    }
    if (r3 === null || ![0, 1].includes(r3)) {
      t2.push({
        severity: `ERROR`,
        code: `SWITCH_STATUS_UNKNOWN`,
        message: `System switching device status is unknown.`,
        equipment: n3.id
      });
      continue;
    }
    let c3 = i2.get(o3),
      l3 = i2.get(s3);
    if (c3 === void 0 || l3 === void 0) {
      t2.push({
        severity: `ERROR`,
        code: `BRANCH_TERMINAL_UNMAPPED`,
        message: `System switching device terminal key has no bus.`,
        equipment: n3.id
      });
      continue;
    }
    let d3 = e3 === 0 ? {
        re: 0,
        im: 0
      } : ctx.xo(0, e3),
      f3 = Array(12).fill(null);
    u2.push({
      id: n3.id,
      sourceEquipmentId: n3.id,
      windingId: String(n3.fields.ckt ?? `1`),
      from: c3,
      to: l3,
      fromKey: o3,
      toKey: s3,
      kind: `line`,
      rPu: 0,
      xPu: e3,
      tapFrom: 1,
      tapTo: 1,
      phaseDeg: 0,
      yff: d3,
      yft: ctx.Co(d3, -1),
      ytf: ctx.Co(d3, -1),
      ytt: d3,
      ratingBasis: `UNKNOWN`,
      ratingsFromSource: f3,
      ratingsToSource: [...f3],
      rateMva: null,
      status: r3,
      fieldMap: [ctx.bo(n3, `xpu`, `pu`), ctx.bo(n3, `stat`, `status`), ctx.bo(n3, `bp`, `code`, `PSS/E bypass flag; active nonzero values require ideal-link treatment`)],
      terminalFrom: o3,
      terminalTo: s3
    }), a2[n3.id] = [n3.id];
  } else if (n3.kind === `transformer`) {
    let s3 = n3.status,
      d3 = String(n3.fields.connectionKey ?? n3.buses[0] ?? n3.fields.ibus),
      f3 = String(n3.fields.jconnectionKey ?? n3.buses[1] ?? n3.fields.jbus),
      p3 = n3.buses.length === 3 || ctx.vo(n3.fields.kbus) !== null && ctx.vo(n3.fields.kbus) !== 0;
    if (s3 === null || ![0, 1, 2, 3, 4].includes(s3)) {
      t2.push({
        severity: `ERROR`,
        code: `TRANSFORMER_STATUS_UNKNOWN`,
        message: `Transformer winding status is unknown.`,
        equipment: n3.id
      });
      continue;
    }
    if (s3 !== 0 && o2 > 0 && ((ctx.vo(n3.fields.cw) ?? 1) !== 1 || (ctx.vo(n3.fields.cm) ?? 1) === 2) && t2.push({
      severity: `ERROR`,
      code: `TRANSFORMER_BASE_KV_CONVERSION_REQUIRED`,
      message: `Active transformer ratio or magnetizing semantics require a physical bus voltage base that is unavailable.`,
      equipment: n3.id
    }), p3) {
      let o3 = [d3, f3, String(n3.buses[2] ?? n3.fields.kconnectionKey ?? n3.fields.kbus)],
        c3 = [ctx.Oo(n3, `r12Pu`) ?? ctx.Oo(n3, `r1_2`), ctx.Oo(n3, `x12Pu`) ?? ctx.Oo(n3, `x1_2`)],
        p4 = [ctx.Oo(n3, `r23Pu`) ?? ctx.Oo(n3, `r2_3`), ctx.Oo(n3, `x23Pu`) ?? ctx.Oo(n3, `x2_3`)],
        m3 = [ctx.Oo(n3, `r31Pu`) ?? ctx.Oo(n3, `r3_1`), ctx.Oo(n3, `x31Pu`) ?? ctx.Oo(n3, `x3_1`)];
      if ([...c3, ...p4, ...m3].some(e3 => e3 === null)) {
        t2.push({
          severity: `ERROR`,
          code: `THREE_WINDING_IMPEDANCE_MISSING`,
          message: `All three pair impedances are required.`,
          equipment: n3.id
        });
        continue;
      }
      let h2 = [c3, p4, m3],
        g2 = [[(h2[0][0] + h2[2][0] - h2[1][0]) / 2, (h2[0][1] + h2[2][1] - h2[1][1]) / 2], [(h2[0][0] + h2[1][0] - h2[2][0]) / 2, (h2[0][1] + h2[1][1] - h2[2][1]) / 2], [(h2[1][0] + h2[2][0] - h2[0][0]) / 2, (h2[1][1] + h2[2][1] - h2[0][1]) / 2]],
        _2 = String(n3.fields.starConnectionKey ?? `@3w:${n3.id}`),
        v2 = i2.get(_2);
      v2 === void 0 ? (v2 = r2.length, i2.set(_2, v2), r2.push({
        id: `star:${n3.id}`,
        connectionKey: _2,
        externalNumber: null,
        section: null,
        sourceEquipmentId: n3.id,
        baseKv: null,
        type: 1,
        status: s3 === 0 ? 0 : 1,
        initialVm: 1,
        initialVaDeg: 0,
        source: false,
        fieldMap: [ctx.bo(n3, `three-winding star bus`, `internal node`, `one derived zero-injection node; no physical kV base`)]
      })) : s3 === 0 && (r2[v2].status = 0), a2[n3.id] = [`star:${n3.id}`];
      for (let a3 = 0; a3 < 3; a3++) {
        let c4 = ctx.vo(n3.fields[`ratio${a3 + 1}Pu`]) ?? ctx.vo(n3.fields[`windv${a3 + 1}`]) ?? 1,
          d4 = ctx.vo(n3.fields[`ang${a3 + 1}`]) ?? 0,
          f4 = {
            re: 0,
            im: 0
          };
        if (a3 === 0) {
          let a4 = ctx.vo(n3.fields.cm) ?? 1,
            s4 = ctx.vo(n3.fields.sbase1_2) ?? e2.case.baseMva,
            c5 = ctx.vo(n3.fields.mag1) ?? 0,
            l3 = ctx.vo(n3.fields.mag2) ?? 0;
          if (a4 === 1) f4 = {
            re: c5,
            im: l3
          };else if (a4 === 2) {
            let a5 = c5 / (1e6 * s4),
              u3 = l3 * l3 - a5 * a5;
            if (u3 < 0) {
              t2.push({
                severity: `ERROR`,
                code: `CM2_INVALID_MAGNETIZING_DATA`,
                message: `CM=2 magnetizing-current radicand is negative.`,
                equipment: n3.id
              });
              continue;
            }
            let d5 = ctx.vo(n3.fields.nomv1),
              p6 = r2[i2.get(o3[0])]?.baseKv ?? d5 ?? 1;
            f4 = {
              re: a5 * s4 / e2.case.baseMva * (p6 / (d5 || p6)) ** 2,
              im: -Math.sqrt(u3) * s4 / e2.case.baseMva * (p6 / (d5 || p6)) ** 2
            };
          } else {
            t2.push({
              severity: `ERROR`,
              code: `CM_UNKNOWN`,
              message: `Unsupported transformer magnetizing code ${a4}.`,
              equipment: n3.id
            });
            continue;
          }
        }
        let p5 = s3 === 0 || s3 === [4, 2, 3][a3] ? 0 : 1;
        l2(n3, String(a3 + 1), o3[a3], _2, `three-winding-leg`, g2[a3][0], g2[a3][1], c4, 1, d4, f4, null, p5, [ctx.bo(n3, `r${a3 + 1}_${a3 === 0 ? 2 : a3 === 1 ? 3 : 1}`, `pu`, `PSS/E pair impedance converted to equivalent star leg`), ctx.bo(n3, `windv${a3 + 1}`, `CW source units`, `CW=${ctx.vo(n3.fields.cw) ?? 1} winding ratio converted to bus base`), ctx.bo(n3, `ang${a3 + 1}`, `deg or rad`, `source winding phase angle converted to radians`), ...Array.from({
          length: 12
        }, (e3, t3) => ctx.bo(n3, `wdg${a3 + 1}rate${t3 + 1}`, `MVA equivalent at winding bus base`, `WINDING ${a3 + 1} RATE${t3 + 1}`))]);
        let m4 = ctx.jo(n3, a3 + 1);
        for (let t3 of u2.filter(e3 => e3.sourceEquipmentId === n3.id && e3.windingId === String(a3 + 1))) t3.ratingBasis = ctx.ko(e2, `transformer`), t3.ratingsFromSource = m4, t3.ratingsToSource = Array(12).fill(null), t3.rateMva = t3.ratingBasis === `MVA` ? m4[0] : null;
      }
    } else {
      let a3 = ctx.Oo(n3, `r12Pu`) ?? ctx.Oo(n3, `r1_2`),
        o3 = ctx.Oo(n3, `x12Pu`) ?? ctx.Oo(n3, `x1_2`),
        p4 = ctx.Oo(n3, `ratio1Pu`) ?? ctx.Oo(n3, `windv1`),
        m3 = ctx.Oo(n3, `ratio2Pu`) ?? ctx.Oo(n3, `windv2`),
        h2 = ctx.Oo(n3, `ang1`) ?? 0;
      if (a3 === null || o3 === null || p4 === null || m3 === null || p4 <= 0 || m3 <= 0) {
        t2.push({
          severity: `ERROR`,
          code: `TRANSFORMER_ELECTRICAL_DATA_MISSING`,
          message: `Transformer impedance and both positive winding ratios are required.`,
          equipment: n3.id
        });
        continue;
      }
      let g2 = ctx.Oo(n3, `cm`) ?? 1,
        _2 = ctx.Oo(n3, `sbase1_2`) ?? e2.case.baseMva,
        v2 = ctx.Oo(n3, `mag1`) ?? 0,
        y2 = ctx.Oo(n3, `mag2`) ?? 0,
        b2 = {
          re: 0,
          im: 0
        };
      if (g2 === 1) b2 = {
        re: v2,
        im: y2
      };else if (g2 === 2) {
        let a4 = v2 / (1e6 * _2),
          o4 = y2 * y2 - a4 * a4;
        if (o4 < 0) {
          t2.push({
            severity: `ERROR`,
            code: `CM2_INVALID_MAGNETIZING_DATA`,
            message: `CM=2 magnetizing-current radicand is negative.`,
            equipment: n3.id
          });
          continue;
        }
        let s4 = ctx.Oo(n3, `nomv1`),
          c3 = r2[i2.get(d3)]?.baseKv ?? s4 ?? 1;
        b2 = {
          re: a4 * _2 / e2.case.baseMva * (c3 / (s4 || c3)) ** 2,
          im: -Math.sqrt(o4) * _2 / e2.case.baseMva * (c3 / (s4 || c3)) ** 2
        };
      } else {
        t2.push({
          severity: `ERROR`,
          code: `CM_UNKNOWN`,
          message: `Unsupported transformer magnetizing code ${g2}.`,
          equipment: n3.id
        });
        continue;
      }
      let x2 = ctx.ko(e2, `transformer`),
        S2 = ctx.jo(n3, 1),
        C2 = ctx.jo(n3, 2),
        w2 = [...Array.from({
          length: 12
        }, (e3, t3) => ctx.bo(n3, `wdg1rate${t3 + 1}`, `MVA equivalent at winding bus base`, `WINDING 1 RATE${t3 + 1}`)), ...Array.from({
          length: 12
        }, (e3, t3) => ctx.bo(n3, `wdg2rate${t3 + 1}`, `MVA equivalent at winding bus base`, `WINDING 2 RATE${t3 + 1}`))];
      l2(n3, String(n3.fields.ckt ?? `1`), d3, f3, `transformer`, a3, o3, p4, m3, h2, b2, ctx.vo(n3.fields.wdg1rate1), s3 === 1 ? 1 : s3 === 0 ? 0 : null, [ctx.bo(n3, `r1_2`, `pu`, `RAW CZ conversion is already normalized; SAV Gbtran is inverted on system base`), ctx.bo(n3, `x1_2`, `pu`, `RAW CZ conversion is already normalized; SAV Gbtran is inverted on system base`), ctx.bo(n3, `windv1`, `CW source units`, `CW=${ctx.vo(n3.fields.cw) ?? 1} winding ratio converted to bus base`), ctx.bo(n3, `windv2`, `CW source units`, `CW=${ctx.vo(n3.fields.cw) ?? 1} winding ratio converted to bus base`), ctx.bo(n3, `ang1`, `deg or rad`, `SAV Psangl radians converted to degrees; RAW source is degrees`), ctx.bo(n3, `mag1`, `CM source units`, `CM-dependent magnetizing conversion on system base`), ctx.bo(n3, `mag2`, `CM source units`, `CM-dependent magnetizing conversion on system base`), ...w2]);
      for (let e3 of u2.filter(e4 => e4.sourceEquipmentId === n3.id)) e3.ratingBasis = x2, e3.ratingsFromSource = S2, e3.ratingsToSource = C2, e3.rateMva = x2 === `MVA` ? S2[0] : null, e3.tapControl = ctx.Do(n3, r2, i2, c2, d3, t2);
    }
  }
  let d2 = [],
    f2 = [],
    p2 = [];
  for (let n3 of e2.equipment) {
    let e3 = String(n3.fields.connectionKey ?? n3.buses[0] ?? n3.fields.ibus),
      r3 = i2.get(e3);
    if (r3 === void 0) continue;
    let o3 = n3.status;
    if (n3.kind === `generator`) {
      let [e4, s3, c3, l3] = ctx.Eo(n3, [`pg`, `qg`, `qt`, `qb`], t2);
      if (e4 === void 0 || s3 === void 0 || c3 === void 0 || l3 === void 0) continue;
      if (o3 === null || ![0, 1].includes(o3)) {
        t2.push({
          severity: `ERROR`,
          code: `GENERATOR_STATUS_UNKNOWN`,
          message: `Generator active status is unknown.`,
          equipment: n3.id
        });
        continue;
      }
      let u3 = ctx.vo(n3.fields.ireg) ?? 0,
        f3 = String(n3.fields.regConnectionKey ?? u3),
        p3 = u3 === 0 ? null : i2.get(f3);
      u3 !== 0 && p3 === void 0 && t2.push({
        severity: `ERROR`,
        code: `REMOTE_REGULATION_BUS_UNKNOWN`,
        message: `Remote voltage regulation bus ${f3} is unresolved.`,
        equipment: n3.id
      });
      let m3 = ctx.vo(n3.fields.wmod) ?? 0,
        h2 = ctx.vo(n3.fields.wpf),
        g2 = l3,
        _2 = c3,
        v2 = null;
      if (m3 === 2) {
        if (h2 === null || h2 === 0 || Math.abs(h2) > 1) t2.push({
          severity: `ERROR`,
          code: `GENERATOR_WMOD_POWER_FACTOR_INVALID`,
          message: `WMOD=2 requires a finite, nonzero power factor with magnitude at most 1.`,
          equipment: n3.id
        });else {
          let t3 = Math.abs(e4) * Math.sqrt(Math.max(0, 1 / (h2 * h2) - 1));
          g2 = -t3, _2 = t3, t3 === 0 && (v2 = 0);
        }
      } else m3 === 3 ? h2 === null || h2 === 0 || Math.abs(h2) > 1 ? t2.push({
        severity: `ERROR`,
        code: `GENERATOR_WMOD_POWER_FACTOR_INVALID`,
        message: `WMOD=3 requires a finite, nonzero power factor with magnitude at most 1.`,
        equipment: n3.id
      }) : (v2 = e4 * Math.tan(Math.acos(Math.abs(h2))) * Math.sign(h2), g2 = v2, _2 = v2) : m3 === 4 ? (v2 = s3, g2 = s3, _2 = s3) : m3 === 0 && c3 === l3 && (v2 = c3, g2 = v2, _2 = v2);
      let y2 = [`pg`, `qg`, `qt`, `qb`, `wmod`, `wpf`, `vs`, `ireg`, `rmpct`].map(e5 => ctx.bo(n3, e5, e5 === `pg` || e5 === `qg` || e5 === `qt` || e5 === `qb` ? `MW/Mvar` : e5 === `wmod` ? `code` : e5 === `wpf` ? `power factor` : `pu`, e5 === `qt` ? `WMOD-specific source Q upper bound` : e5 === `qb` ? `WMOD-specific source Q lower bound` : e5 === `wmod` ? `WMOD 3 uses PF-derived fixed Q; WMOD 4 holds QG` : `identity`));
      d2.push({
        id: n3.id,
        sourceEquipmentId: n3.id,
        bus: r3,
        status: o3,
        pMw: e4,
        qMvar: s3,
        qMinMvar: g2,
        qMaxMvar: _2,
        qControl: v2 === null ? `REGULATING` : `FIXED_Q`,
        qFixedMvar: v2,
        wmod: m3,
        wpf: h2,
        pMinMw: ctx.vo(n3.fields.pb),
        pMaxMw: ctx.vo(n3.fields.pt),
        vsPu: ctx.vo(n3.fields.vs),
        remoteBus: u3 === 0 ? null : p3 ?? -1,
        participation: ctx.vo(n3.fields.rmpct) ?? 100,
        fieldMap: y2
      }), (a2[n3.id] ?? []).push(`gen:${n3.id}`);
    } else if (n3.kind === `load`) {
      let [e4, i3, s3, c3, l3, u3] = ctx.Eo(n3, [`pl`, `ql`, `ip`, `iq`, `yp`, `yq`], t2);
      if ([e4, i3, s3, c3, l3, u3].some(e5 => e5 === void 0)) continue;
      f2.push({
        id: n3.id,
        sourceEquipmentId: n3.id,
        bus: r3,
        status: o3 === 0 ? 0 : 1,
        pMw: e4,
        qMvar: i3,
        ipMw: s3,
        iqMvar: c3,
        ypMw: l3,
        yqMvar: u3,
        fieldMap: [`pl`, `ql`, `ip`, `iq`, `yp`, `yq`].map(e5 => ctx.bo(n3, e5, `MW/Mvar`))
      }), (a2[n3.id] ??= []).push(`load:${n3.id}`);
    } else if (n3.kind === `shunt`) {
      let e4 = n3.fields.subtype === `switched` || n3.id.startsWith(`shunt:switched:`) || n3.fields.modsw !== void 0,
        i3 = e4 ? 0 : ctx.vo(n3.fields.gl),
        s3 = ctx.vo(e4 ? n3.fields.binit : n3.fields.bl);
      if (o3 === null) {
        t2.push({
          severity: `ERROR`,
          code: `SHUNT_STATUS_UNKNOWN`,
          message: `Shunt status is unknown.`,
          equipment: n3.id
        });
        continue;
      }
      if (i3 === null || s3 === null) {
        t2.push({
          severity: `ERROR`,
          code: `SHUNT_ADMITTANCE_MISSING`,
          message: `Shunt admittance is missing.`,
          equipment: n3.id
        });
        continue;
      }
      p2.push({
        id: n3.id,
        sourceEquipmentId: n3.id,
        bus: r3,
        status: o3 === 0 ? 0 : 1,
        gMw: i3,
        bMvar: s3,
        selection: e4 ? `INITIAL_SWITCHED` : `FIXED`,
        fieldMap: e4 ? [ctx.bo(n3, `binit`, `Mvar`, `initial switched-shunt susceptance held fixed`)] : [ctx.bo(n3, `gl`, `MW`), ctx.bo(n3, `bl`, `Mvar`)],
        switchedControl: e4 ? ctx.Mo(n3, c2, t2) : null
      }), (a2[n3.id] ?? []).push(`shunt:${n3.id}`);
    }
  }
  for (let e3 of f2) {
    e3.yqMvar = -e3.yqMvar;
    let t3 = e3.fieldMap.find(e4 => e4.sourceField.toLowerCase().endsWith(`.yq`));
    t3 && (t3.equation = `negative source YQ; consumption-signed reactive impedance coefficient`);
  }
  let m2 = {
    schema: `ga.psse.bus-branch.v1`,
    revision: `psse-normalize-1`,
    sourceSha256: e2.source.sha256,
    sourceFormat: e2.source.format,
    sourceName: e2.source.name,
    baseMva: e2.case.baseMva,
    frequencyHz: e2.case.frequencyHz,
    buses: r2,
    branches: u2,
    generators: d2,
    loads: f2,
    shunts: p2,
    sourceToNumerical: a2,
    findings: t2,
    structuralReadiness: t2.some(e3 => e3.severity === `ERROR`) ? `BLOCKED` : `READY`
  };
  return {
    ...m2,
    modelHash: ctx.yo(m2)
  };
};
}
export const initializers = [
[394, ctx => { ctx.So = (e2, t2) => ({
  re: e2.re + t2.re,
  im: e2.im + t2.im
}); }],
[395, ctx => { ctx.Co = (e2, t2) => ({
  re: e2.re * t2,
  im: e2.im * t2
}); }],
[396, ctx => { ctx.wo = (e2, t2) => {
  let n2 = t2.re * t2.re + t2.im * t2.im;
  return {
    re: (e2.re * t2.re + e2.im * t2.im) / n2,
    im: (e2.im * t2.re - e2.re * t2.im) / n2
  };
}; }],
[406, ctx => { ctx.Po = e2 => Array.from(ctx.z(new TextEncoder().encode(e2)), e3 => e3.toString(16).padStart(2, `0`)).join(``); }]
];
