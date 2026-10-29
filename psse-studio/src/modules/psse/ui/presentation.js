import {loadingAtTerminals} from '../calculations/rating.js';
// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.nv = function nv(e2) {
  return e2 === `<=36` ? `\u226436 kV` : e2 === `unknown` ? `kV bilinmiyor` : `${Number(e2).toLocaleString(`tr-TR`)} kV`;
};
ctx.rv = function rv(e2) {
  return [...new Set(e2.buses.filter(e3 => e3.source).map(e3 => ctx.tv(e3.baseKv)))].sort((e3, t2) => e3 === `unknown` ? 1 : t2 === `unknown` ? -1 : e3 === `<=36` ? 1 : t2 === `<=36` ? -1 : Number(t2) - Number(e3)).map(e3 => ({
    value: e3,
    label: ctx.nv(e3)
  }));
};
ctx.iv = function iv(e2, t2) {
  let n2 = e2.equipment.filter(e3 => e3.kind === `substation`),
    r2 = new Map(n2.map(e3 => [String(e3.fields.isub ?? e3.id), e3])),
    i2 = /* @__PURE__ */new Map();
  for (let e3 of n2) {
    let t3 = ctx.qs(e3.name);
    i2.set(t3, [...(i2.get(t3) ?? []), e3]);
  }
  let a2 = new Map(e2.equipment.map(e3 => [e3.id, e3])),
    o2 = /* @__PURE__ */new Map();
  return t2.buses.forEach((e3, t3) => {
    if (!e3.source) return;
    let n3 = e3.sourceEquipmentId ? a2.get(e3.sourceEquipmentId) : void 0;
    if (!n3) return;
    let s2 = n3.fields.isub,
      c2 = s2 != null && s2 !== ``,
      l2 = i2.get(ctx.qs(n3.name)) ?? [],
      u2 = c2 ? r2.get(String(s2)) : l2.length === 1 ? l2[0] : void 0;
    if (!u2) return;
    let d2 = String(u2.fields.isub ?? u2.id),
      f2 = o2.get(d2);
    f2 || (f2 = {
      id: d2,
      name: u2.name,
      busIndices: []
    }, o2.set(d2, f2)), f2.busIndices.push(t3);
  }), [...o2.values()].sort((e3, t3) => e3.name.localeCompare(t3.name, `tr`));
};
ctx.uv = function uv(e2) {
  let t2 = e2.psseNetwork,
    n2 = e2.psseInspection,
    r2 = e2.psseScenario;
  if (!t2 || !n2 || !r2 || r2.networkHash !== t2.modelHash) return null;
  let i2 = e2.psseCalculation ?? null;
  try {
    let e3 = ctx.fs(t2, r2);
    return {
      base: t2,
      network: e3,
      model: n2,
      scenario: r2,
      calculation: ctx.Wo(i2, {
        sourceSha256: n2.source.sha256,
        network: t2,
        effectiveNetwork: e3,
        scenario: r2
      }) && i2.status === `CONVERGED` && i2.physicsCoverage !== `BLOCKED` ? i2 : null,
      lastCalculation: i2
    };
  } catch {
    return null;
  }
};
ctx.dv = function dv(e2, t2, n2) {
  return e2.sourceEquipmentId ? n2?.get(e2.sourceEquipmentId) ?? t2.equipment.find(t3 => t3.id === e2.sourceEquipmentId) ?? null : null;
};
ctx.fv = function fv(e2, t2, n2) {
  let r2 = ctx.dv(e2, t2, n2);
  return String(r2?.fields.name ?? r2?.name ?? e2.id);
};
ctx.pv = function pv(e2, t2, n2) {
  let r2 = ctx.dv(e2, t2, n2);
  return [e2.id, e2.connectionKey, e2.externalNumber, r2?.name, r2?.fields.name, r2?.fields.ibus, r2?.fields.packedNumbus].filter(e3 => e3 != null).join(` \xB7 `);
};
ctx.mv = function mv(e2, t2) {
  return ctx.cv(e2?.fields[t2]);
};
ctx.hv = function hv(e2, t2, n2) {
  return ctx.mv(ctx.dv(e2, t2, n2), `area`);
};
ctx.gv = function gv(e2, t2, n2) {
  return ctx.mv(ctx.dv(e2, t2, n2), `owner`);
};
ctx._v = function _v(e2, t2) {
  let n2 = ctx.Ws(e2, t2);
  return n2 ? `${n2} (${t2})` : t2;
};
ctx.vv = function vv(e2, t2) {
  let n2 = ctx.Gs(e2, t2);
  return n2 ? `${n2} (${t2})` : t2;
};
ctx.yv = function yv(e2) {
  return ctx.tv(e2);
};
ctx.bv = function bv(e2, t2 = 0) {
  return e2 === null || !Number.isFinite(e2) ? `kV bilinmiyor` : `${ctx.ov(e2, t2)} kV`;
};
ctx.xv = function xv(e2) {
  return e2 !== null && Number.isFinite(e2) && e2 <= 36;
};
ctx.Sv = function Sv(e2, t2, n2) {
  let r2 = ctx.dv(e2, t2, n2)?.operating.vm?.value;
  return typeof r2 == `number` && Number.isFinite(r2) ? r2 : e2.initialVm;
};
ctx.Cv = function Cv(e2, t2, n2) {
  let r2 = ctx.dv(e2, t2, n2)?.operating.va?.value;
  return typeof r2 == `number` && Number.isFinite(r2) ? r2 : e2.initialVaDeg;
};
ctx.wv = function wv(e2, t2) {
  return t2 === `all` || (t2 === `in` ? e2 === 1 : e2 === 0);
};
ctx.Tv = function Tv(e2) {
  return e2.model.source.format === `SAV` ? `SOURCE_SAVED` : `SOURCE_INPUT`;
};
ctx.Ev = function Ev(e2) {
  let t2 = e2.lastCalculation;
  return t2 ? e2.calculation ? `GA_PSSE_CALCULATED \xB7 ${t2.method} \xB7 ${ctx.Vo(t2)} \xB7 fizik kapsam\u0131 ${t2.physicsCoverage}${t2.method === `LOSSLESS_DC` ? ` \xB7 Vm \xE7\xF6z\xFClmez` : ``}` : t2.status === `CONVERGED` ? `Son hesap ba\u015Fka model veya senaryoya ait (${t2.physicsCoverage}) \xB7 renk katman\u0131 kullan\u0131lamaz` : `Son hesap ${t2.status} (${t2.physicsCoverage}) \xB7 renk katman\u0131 kullan\u0131lamaz` : `GA_PSSE_CALCULATED \xB7 hesap yok`;
};
ctx.Dv = function Dv(e2) {
  return e2 == null || !Number.isFinite(e2) ? `#64748b` : e2 < 0.9 ? `#a84859` : e2 < 0.95 ? `#d36b5c` : e2 < 0.98 ? `#d9a441` : e2 <= 1.02 ? `#4fbf91` : e2 <= 1.05 ? `#48a9c7` : `#8074d4`;
};
ctx.Ov = function Ov(e2) {
  return e2 == null || !Number.isFinite(e2) ? `#65788b` : e2 >= 100 ? `#e25f66` : e2 >= 80 ? `#e3a944` : `#50b98b`;
};
ctx.kv = function kv(e2, t2, n2, r2, i2, a2, o2) {
  let s2 = Array.from({
    length: e2.buses.length
  }, () => []);
  for (let n3 of e2.branches) ctx.wv(n3.status, i2) && t2.has(n3.from) && t2.has(n3.to) && (s2[n3.from].push({
    bus: n3.to,
    branch: n3
  }), s2[n3.to].push({
    bus: n3.from,
    branch: n3
  }));
  let c2 = /* @__PURE__ */new Map([[n2, 0]]),
    l2 = [n2];
  for (let e3 = 0; e3 < l2.length; e3++) {
    let t3 = l2[e3],
      n3 = c2.get(t3);
    if (!(n3 >= r2)) for (let e4 of s2[t3]) c2.has(e4.bus) || (c2.set(e4.bus, n3 + 1), l2.push(e4.bus));
  }
  let u2 = [...c2.keys()].sort((e3, t3) => c2.get(e3) - c2.get(t3) || e3 - t3),
    d2 = u2.slice(0, a2),
    f2 = new Set(d2),
    p2 = e2.branches.filter(e3 => ctx.wv(e3.status, i2) && f2.has(e3.from) && f2.has(e3.to));
  return {
    busIndices: d2,
    depthByBus: c2,
    branches: p2.slice(0, o2),
    omittedBuses: Math.max(0, u2.length - d2.length),
    omittedBranches: Math.max(0, p2.length - o2)
  };
};
ctx.Av = function Av(e2, t2, n2) {
  let r2 = new Uint32Array(e2.buses.length);
  for (let i3 of e2.branches) ctx.wv(i3.status, n2) && t2.has(i3.from) && t2.has(i3.to) && (r2[i3.from]++, r2[i3.to]++);
  let i2 = -1,
    a2 = -1;
  for (let e3 of t2) {
    let t3 = r2[e3];
    t3 > a2 && (i2 = e3, a2 = t3);
  }
  return i2;
};
ctx.jv = function jv(e2, t2, n2, r2, i2) {
  let a2 = /* @__PURE__ */new Map();
  for (let n3 of e2) {
    let e3 = t2.get(n3) ?? 1;
    (a2.get(e3) ?? (a2.set(e3, []), a2.get(e3))).push(n3);
  }
  let o2 = /* @__PURE__ */new Map(),
    s2 = r2 / 2,
    c2 = i2 / 2;
  o2.set(n2, {
    x: s2,
    y: c2
  });
  for (let [e3, t3] of a2) {
    if (e3 === 0) continue;
    let n3 = Math.min(r2, i2) * 0.43,
      a3 = Math.max(68, n3 * (0.44 + 0.18 * Math.min(e3, 3))),
      l2 = -Math.PI / 2;
    t3.forEach((e4, n4) => {
      let r3 = l2 + n4 / t3.length * Math.PI * 2;
      o2.set(e4, {
        x: s2 + Math.cos(r3) * a3,
        y: c2 + Math.sin(r3) * a3
      });
    });
  }
  return o2;
};
ctx.v10RatePct = function v10RatePct(branch,row,index=0,network=ctx.window.__GA_BRIDGE__?.psseNetwork){const pair=loadingAtTerminals(branch,row,index,network);const values=[pair.from,pair.to].filter(v=>typeof v==='number'&&Number.isFinite(v));return values.length?Math.max(...values):null;};
ctx.v10SafeNumber = value => typeof value==='number'&&Number.isFinite(value)?value:null;
ctx.v10Loss = function v10Loss(row) {
  if (!row) return null;
  const a2 = ctx.v10SafeNumber(row.pLossMw);
  if (a2 !== null) return a2;
  const p2 = ctx.v10SafeNumber(row.pFromMw),
    q2 = ctx.v10SafeNumber(row.pToMw);
  return p2 !== null && q2 !== null ? p2 + q2 : null;
};
ctx.Mv = function Mv(host) {
  const dlg = ctx.Q("dialog", "ga-psse-diagram-dialog ga-v10-detail"),
    header = ctx.Q("header"),
    title = ctx.Q("h3"),
    close = ctx.$("Kapat", () => dlg.close());
  const meta = ctx.Q("p", "ga-muted"),
    grid = ctx.Q("dl", "ga-v10-detail-grid");
  header.append(title, close);
  dlg.append(header, meta, grid);
  host.append(dlg);
  const fmt = v2 => v2 === null || v2 === void 0 || v2 === "" ? "\u2014" : typeof v2 === "number" ? Number.isFinite(v2) ? v2.toLocaleString("tr-TR", {
    maximumFractionDigits: 4
  }) : "\u2014" : String(v2);
  const row = (key, val) => {
    let dt2 = ctx.Q("dt", "", key),
      dd2 = ctx.Q("dd", "", fmt(val));
    grid.append(dt2, dd2);
  };
  return {
    dialog: dlg,
    open: (source, caption, extra = {}) => {
      title.textContent = caption;
      grid.replaceChildren();
      meta.textContent = source ? `${source.kind ?? "Ekipman"} \xB7 ${source.status === 1 ? "Serviste" : source.status === 0 ? "Devre d\u0131\u015F\u0131" : "Durum bilinmiyor"}` : "Kaynak ekipman kayd\u0131 bulunamad\u0131";
      row("Ad", source?.name || caption);
      row("Kaynak ekipman", source?.id);
      row("Nominal gerilim (kV)", source?.nominalKv);
      const b2 = extra.normalizedBranch,
        bus = extra.normalizedBus,
        calc = extra.calculated;
      if (b2) {
        row("Ekipman t\xFCr\xFC", b2.kind === "line" ? "AC iletim hatt\u0131" : b2.kind === "three-winding-leg" ? "\xDC\xE7 sarg\u0131l\u0131 trafo" : "Trafo");
        row("Kaynak ba\u011Flant\u0131 u\xE7lar\u0131", `${fmt(b2.terminalFrom)} \u2192 ${fmt(b2.terminalTo)}`);
        row("Devre kimli\u011Fi", source?.fields?.ckt ?? b2.windingId);
        row("Servis", b2.status === 1 ? "Serviste" : "Devre d\u0131\u015F\u0131");
        row("RATE A (1/2)", `${fmt(b2.ratingsFromSource?.[0])} / ${fmt(b2.ratingsToSource?.[0])} ${fmt(b2.ratingBasis)}`);
        row("RATE B (1/2)", `${fmt(b2.ratingsFromSource?.[1])} / ${fmt(b2.ratingsToSource?.[1])} ${fmt(b2.ratingBasis)}`);
        row("RATE C (1/2)", `${fmt(b2.ratingsFromSource?.[2])} / ${fmt(b2.ratingsToSource?.[2])} ${fmt(b2.ratingBasis)}`);
        row("P (1/2) MW", `${fmt(calc?.pFromMw)} / ${fmt(calc?.pToMw)}`);
        row("Q (1/2) MVAr", `${fmt(calc?.qFromMvar)} / ${fmt(calc?.qToMvar)}`);
        row("Kay\u0131p P (MW)", ctx.v10Loss(calc));
        row("Y\xFCklenme (%)", ctx.v10RatePct(b2, calc, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0));
      }
      if (bus) {
        row("Bara numaras\u0131", bus.externalNumber);
        row("Ba\u011Flant\u0131 anahtar\u0131", bus.connectionKey);
        row("Vm (pu)", calc?.vmPu);
        row("Va (\xB0)", calc?.vaDeg);
      }
      row("Sonu\xE7 kayna\u011F\u0131", calc ? "G\xFCncel GA hesap \xE7\u0131kt\u0131s\u0131" : "Hesap sonucu mevcut de\u011Fil");
      if (!dlg.open) dlg.showModal();
    }
  };
};
ctx.Fv = function Fv(e2) {
  if (!e2) return ``;
  let t2 = /* @__PURE__ */new Set([e2.id, String(e2.fields.connectionKey ?? ``), String(e2.fields.ibus ?? ``), String(e2.fields.packedNumbus ?? ``)]);
  return [ctx.Pv(e2.fields.name), ctx.Pv(e2.name)].find(e3 => e3 && !t2.has(e3)) ?? ``;
};
ctx.Iv = function Iv(e2) {
  return typeof e2 == `number` && Number.isSafeInteger(e2) && e2 >= 0 ? String(e2) : typeof e2 == `string` && /^\d+$/.test(e2.trim()) ? String(Number(e2.trim())) : null;
};
ctx.Lv = function Lv(e2, t2) {
  let n2 = ctx.Nv.get(e2);
  n2 || (n2 = /* @__PURE__ */new WeakMap(), ctx.Nv.set(e2, n2));
  let r2 = n2.get(t2);
  if (r2) return r2;
  let i2 = new Map(e2.equipment.map(e3 => [e3.id, e3])),
    a2 = new Map(t2.buses.map(e3 => [e3.connectionKey, e3])),
    o2 = /* @__PURE__ */new Map(),
    s2 = /* @__PURE__ */new Map();
  for (let t3 of e2.equipment) {
    if (t3.kind !== `substation`) continue;
    let e3 = ctx.Iv(t3.fields.isub) ?? ctx.Iv(t3.id),
      n3 = ctx.qs(ctx.Fv(t3));
    e3 !== null && o2.set(e3, [...(o2.get(e3) ?? []), t3]), n3 && s2.set(n3, [...(s2.get(n3) ?? []), t3]);
  }
  let c2 = e3 => e3.sourceEquipmentId ? i2.get(e3.sourceEquipmentId) : void 0,
    l2 = e3 => {
      if (!e3.source) return null;
      let t3 = c2(e3);
      if (!t3) return null;
      let n3 = t3.fields.isub,
        r3 = n3 != null && n3 !== ``,
        i3 = ctx.Iv(n3),
        a3 = r3 ? i3 === null ? [] : o2.get(i3) ?? [] : s2.get(ctx.qs(ctx.Fv(t3))) ?? [];
      return a3.length === 1 && ctx.Fv(a3[0]) || null;
    },
    u2 = e3 => {
      if (!e3.source) return `3 sarg\u0131l\u0131 trafo ortak d\xFC\u011F\xFCm\xFC`;
      let t3 = ctx.Fv(c2(e3)),
        n3 = /* @__PURE__ */new Set([e3.id, e3.connectionKey, String(e3.externalNumber ?? ``)]);
      return (t3 && !n3.has(t3) ? t3 : ``) || l2(e3) || `Ad\u0131 kay\u0131tl\u0131 olmayan bara`;
    },
    d2 = e3 => e3 !== null && Number.isFinite(e3) && e3 > 0 ? `${e3.toLocaleString(`tr-TR`, {
      maximumFractionDigits: 2
    })} kV` : ``,
    f2 = e3 => [a2.get(e3.fromKey) ?? t2.buses[e3.from], a2.get(e3.toKey) ?? t2.buses[e3.to]].map(e4 => e4 ? [l2(e4) || u2(e4), d2(e4.baseKv)].filter(Boolean).join(` `) : `Kaynak ucu e\u015Fle\u015Fmedi`).join(` \u2192 `),
    v9Net = t2,
    v9Bus = a2,
    p2 = e3 => {
      let t3 = i2.get(e3.sourceEquipmentId),
        n3 = ctx.Fv(t3),
        r3 = e3.kind === `line` ? `Hat` : e3.kind === `transformer` ? `Trafo` : `3 sarg\u0131l\u0131 trafo`,
        a3 = t3?.fields.ckt ?? (e3.kind === `three-winding-leg` ? null : e3.windingId);
      if (e3.kind === `line` && !String(e3.sourceEquipmentId).startsWith(`line:`)) return `Anahtarlama te\xE7hizat\u0131 \xB7 ${f2(e3)}`;
      if (e3.kind === `line`) {
        const from = v9Bus.get(e3.fromKey) ?? v9Net.buses[e3.from],
          to2 = v9Bus.get(e3.toKey) ?? v9Net.buses[e3.to];
        const name = bus => {
          if (!bus) return "Bara bilinmiyor";
          const raw = l2(bus) || u2(bus);
          return String(raw).replace(/^\s*\d+(?:[.,]\d+)?\s*kV\s*/i, "").trim() || "Ad\u0131 bilinmeyen bara";
        };
        const kv2 = from?.baseKv ?? to2?.baseKv;
        const level = kv2 !== null && Number.isFinite(kv2) && kv2 > 0 ? `${kv2.toLocaleString("tr-TR", {
          maximumFractionDigits: 2
        })} kV` : "kV bilinmiyor";
        return `${level} ${name(from)}-${name(to2)}`;
      }
      return [n3, f2(e3), r3, a3 != null && String(a3).trim() ? `Devre ${String(a3).trim()}` : ``, e3.kind === `three-winding-leg` ? `Sarg\u0131 ${e3.windingId}` : ``].filter(Boolean).join(` \xB7 `);
    },
    m2 = {
      bus: u2,
      station: l2,
      branch: p2,
      equipment: e3 => {
        let n3 = i2.get(e3),
          r3 = t2.branches.find(t3 => t3.sourceEquipmentId === e3);
        if (r3) return p2(r3);
        let o3 = t2.buses.find(t3 => t3.sourceEquipmentId === e3);
        if (o3) return u2(o3);
        let s3 = ctx.Fv(n3);
        if (s3) return s3;
        let c3 = String(n3?.fields.connectionKey ?? n3?.buses[0] ?? ``),
          l3 = a2.get(c3),
          d3 = n3?.kind === `generator` ? `Jenerat\xF6r` : n3?.kind === `load` ? `Y\xFCk` : n3?.kind === `shunt` ? `\u015E\xF6nt` : n3?.kind === `switch` ? `Anahtar` : `Ekipman`;
        return l3 ? `${d3} \xB7 ${u2(l3)}` : `Ad\u0131 kay\u0131tl\u0131 olmayan ekipman`;
      },
      busTitle: e3 => `${u2(e3)} \xB7 ${e3.id} \xB7 ba\u011Flant\u0131 ${e3.connectionKey}${e3.externalNumber === null ? `` : ` \xB7 bara ${e3.externalNumber}`}`,
      branchTitle: e3 => `${p2(e3)} \xB7 ${e3.id} \xB7 kaynak ${e3.sourceEquipmentId} \xB7 ${e3.terminalFrom} \u2192 ${e3.terminalTo}`,
      busSearchText: e3 => {
        let t3 = c2(e3);
        return [u2(e3), l2(e3), e3.id, e3.connectionKey, e3.externalNumber, t3?.fields.name, t3?.name].filter(e4 => e4 != null).join(` \xB7 `);
      }
    };
  return n2.set(t2, m2), m2;
};
ctx.Rv = function Rv(e2, t2) {
  let n2 = ctx.Fo(e2.base),
    r2 = e2.scenario.operations.length === 0 ? e2.calculation : t2,
    i2 = r2 && r2.status === `CONVERGED` && r2.physicsCoverage !== `BLOCKED` && ctx.Wo(r2, {
      sourceSha256: e2.model.source.sha256,
      network: e2.base,
      effectiveNetwork: e2.base,
      scenario: n2
    }) ? r2 : null,
    a2 = e2.calculation,
    o2 = e2.scenario.operations.length > 0 && a2 && a2.status === `CONVERGED` && a2.physicsCoverage !== `BLOCKED` && ctx.Wo(a2, {
      sourceSha256: e2.model.source.sha256,
      network: e2.base,
      effectiveNetwork: e2.network,
      scenario: e2.scenario
    }) ? a2 : null;
  if (!i2) return {
    base: i2,
    scenario: o2,
    ready: false,
    reason: `Baz senaryoda ayn\u0131 model i\xE7in ge\xE7erli bir hesap gerekli.`
  };
  if (!o2) return {
    base: i2,
    scenario: o2,
    ready: false,
    reason: `Senaryo i\u015Flemi ve bu senaryo i\xE7in g\xFCncel bir hesap gerekli.`
  };
  let s2 = i2.identity,
    c2 = o2.identity,
    l2 = i2.method === o2.method && i2.baseMva === o2.baseMva && s2.optionsHash === c2.optionsHash && s2.algorithmRevision === c2.algorithmRevision && s2.controlPolicyId === c2.controlPolicyId && s2.controlPolicyRevision === c2.controlPolicyRevision && s2.initialVoltagePolicy === c2.initialVoltagePolicy;
  return {
    base: i2,
    scenario: o2,
    ready: l2,
    reason: l2 ? null : `Baz ve senaryo y\xF6ntemi veya hesap ayarlar\u0131 farkl\u0131; fark \xFCretilemez.`
  };
};
ctx.zv = function zv(e2, t2) {
  return typeof e2 == `number` && Number.isFinite(e2) && typeof t2 == `number` && Number.isFinite(t2) ? t2 - e2 : null;
};
ctx.Bv = function Bv(e2, t2, n2 = `all`) {
  let r2 = /* @__PURE__ */new Map();
  for (let i2 of e2) {
    if (t2 === `lines` && i2.kind !== `line` || t2 === `transformers` && (i2.kind === `line` || n2 === `2w` && i2.kind !== `transformer` || n2 === `3w` && i2.kind !== `three-winding-leg`)) continue;
    let e3 = i2.kind === `three-winding-leg` ? `three:${i2.sourceEquipmentId}` : `branch:${i2.id}`,
      a2 = r2.get(e3);
    a2 ? a2.push(i2) : r2.set(e3, [i2]);
  }
  return [...r2.values()].map(e3 => e3.sort((e4, t3) => e4.windingId.localeCompare(t3.windingId, `tr`, {
    numeric: true
  })));
};
ctx.Wv = function Wv(e2) {
  let t2 = e2?.status === `CONVERGED` && e2.physicsCoverage !== `BLOCKED` ? e2 : null,
    n2 = t2?.method === `LOSSLESS_DC`,
    r2 = new Map(t2?.busResults.map(e3 => [e3.connectionKey, e3]) ?? []),
    i2 = new Map(t2?.branchResults.map(e3 => [e3.id, e3]) ?? []);
  return {
    bus(e3) {
      let t3 = r2.get(e3.connectionKey);
      return !t3 || t3.id !== e3.id || t3.sourceEquipmentId !== e3.sourceEquipmentId ? ctx.Vv() : {
        vmPu: n2 ? null : ctx.Uv(t3.vmPu),
        vaDeg: ctx.Uv(t3.vaDeg),
        pGenerationMw: ctx.Uv(t3.pGenerationMw),
        qGenerationMvar: n2 ? null : ctx.Uv(t3.qGenerationMvar)
      };
    },
    branch(e3) {
      let t3 = i2.get(e3.id);
      return !t3 || t3.sourceEquipmentId !== e3.sourceEquipmentId || t3.terminalFrom !== e3.terminalFrom || t3.terminalTo !== e3.terminalTo ? ctx.Hv() : {
        pFromMw: ctx.Uv(t3.pFromMw),
        qFromMvar: n2 ? null : ctx.Uv(t3.qFromMvar),
        pToMw: ctx.Uv(t3.pToMw),
        qToMvar: n2 ? null : ctx.Uv(t3.qToMvar),
        iFromA: n2 ? null : ctx.Uv(t3.iFromA),
        iToA: n2 ? null : ctx.Uv(t3.iToA),
        loadingFromPct: n2 ? null : ctx.Uv(t3.loadingFromPct),
        loadingToPct: n2 ? null : ctx.Uv(t3.loadingToPct)
      };
    }
  };
};
ctx.$v = function $v(e2) {
  let {
    width: t2,
    height: n2,
    center: r2,
    scale: i2,
    zoom: a2,
    panX: o2,
    panY: s2
  } = e2;
  if (![t2, n2, i2, a2].every(e3 => Number.isFinite(e3) && e3 > 0) || ![r2.x, r2.y, o2, s2].every(Number.isFinite)) throw Error(`PSSE_VIEWPORT_INVALID`);
  let c2 = i2 * a2,
    l2 = e3 => {
      let r3 = Math.min(e3.width / t2, e3.height / n2);
      return Number.isFinite(r3) && r3 > 0 ? r3 : 1;
    },
    u2 = e3 => ({
      x: t2 / 2 + o2 + (e3.x - r2.x) * c2,
      y: n2 / 2 + s2 + (e3.y - r2.y) * c2
    }),
    d2 = e3 => ({
      x: r2.x + (e3.x - t2 / 2 - o2) / c2,
      y: r2.y + (e3.y - n2 / 2 - s2) / c2
    }),
    f2 = (e3, r3) => {
      let i3 = l2(r3);
      return {
        x: r3.left + r3.width / 2 + (e3.x - t2 / 2) * i3,
        y: r3.top + r3.height / 2 + (e3.y - n2 / 2) * i3
      };
    },
    p2 = (e3, r3) => {
      let i3 = l2(r3);
      return {
        x: t2 / 2 + (e3.x - r3.left - r3.width / 2) / i3,
        y: n2 / 2 + (e3.y - r3.top - r3.height / 2) / i3
      };
    };
  return {
    project: u2,
    unproject: d2,
    screenScale: l2,
    svgToScreen: f2,
    screenToSvg: p2,
    worldToScreen: (e3, t3) => f2(u2(e3), t3),
    screenToWorld: (e3, t3) => d2(p2(e3, t3)),
    svgViewBox: e3 => {
      let r3 = l2(e3),
        i3 = e3.width / r3,
        a3 = e3.height / r3;
      return {
        x: t2 / 2 - i3 / 2,
        y: n2 / 2 - a3 / 2,
        width: i3,
        height: a3
      };
    },
    canvasTransform: (e3, t3 = 1) => {
      let n3 = l2(e3),
        i3 = Number.isFinite(t3) && t3 > 0 ? t3 : 1,
        a3 = c2 * n3;
      return {
        a: a3 * i3,
        b: 0,
        c: 0,
        d: a3 * i3,
        e: (e3.width / 2 + o2 * n3 - r2.x * a3) * i3,
        f: (e3.height / 2 + s2 * n3 - r2.y * a3) * i3
      };
    }
  };
};
ctx.ey = function ey(e2, t2, n2, r2) {
  if (!Number.isFinite(r2) || r2 <= 0) throw Error(`PSSE_VIEWPORT_ZOOM_INVALID`);
  let i2 = ctx.$v(e2),
    a2 = i2.screenToSvg(t2, n2),
    o2 = i2.unproject(a2),
    s2 = e2.scale * r2;
  return {
    ...e2,
    zoom: r2,
    panX: a2.x - e2.width / 2 - (o2.x - e2.center.x) * s2,
    panY: a2.y - e2.height / 2 - (o2.y - e2.center.y) * s2
  };
};
ctx.ty = function ty(e2, t2, n2) {
  let r2 = ctx.$v(e2).screenScale(n2);
  return {
    ...e2,
    panX: e2.panX + t2.x / r2,
    panY: e2.panY + t2.y / r2
  };
};
ctx.cy = function cy(e2) {
  return e2 === null || !Number.isFinite(e2) || e2 <= 0 ? `unknown` : e2 >= 300 ? `b400` : e2 >= 180 ? `b220` : e2 >= 100 ? `b154` : e2 > 36 ? `b66` : `blow`;
};
ctx.ly = function ly(e2, t2) {
  let n2 = ctx.Q(`label`, `ga-psse-diagram-control`);
  return n2.append(ctx.Q(`span`, `ga-muted`, e2), t2), n2;
};
ctx.uy = function uy(e2, t2, n2) {
  let r2 = e2.value;
  e2.replaceChildren(new Option(n2, ``), ...t2.map(e3 => new Option(e3.label, e3.value))), t2.some(e3 => e3.value === r2) && (e2.value = r2);
};
ctx.dy = function dy(e2) {
  return [...e2].filter(e3 => e3 !== `\u2014`).sort((e3, t2) => e3.localeCompare(t2, `tr`)).map(e3 => ({
    value: e3,
    label: e3
  }));
};
ctx.fy = function fy(e2, t2) {
  let n2 = t2.settings.value;
  return {
    b400: n2.color400,
    b220: n2.color220,
    b154: n2.color154,
    b66: n2.color66,
    blow: n2.colorLow,
    unknown: `#758698`
  }[ctx.cy(e2)];
};
}
export const initializers = [
[1027, ctx => { ctx.av = `http://www.w3.org/2000/svg`; }],
[1028, ctx => { ctx.ov = (e2, t2 = 2) => e2 == null || !Number.isFinite(e2) ? `\u2014` : e2.toLocaleString(`tr-TR`, {
  maximumFractionDigits: t2,
  useGrouping: false
}); }],
[1029, ctx => { ctx.sv = (e2, t2 = {}) => {
  let n2 = ctx.document.createElementNS(ctx.av, e2);
  for (let [e3, r2] of Object.entries(t2)) n2.setAttribute(e3, r2);
  return n2;
}; }],
[1030, ctx => { ctx.cv = e2 => e2 == null || e2 === `` ? `\u2014` : String(e2); }],
[1031, ctx => { ctx.lv = e2 => String(e2 ?? ``).trim().toLocaleLowerCase(`tr-TR`); }],
[1059, ctx => { ctx.Nv = /* @__PURE__ */new WeakMap(); }],
[1060, ctx => { ctx.Pv = e2 => typeof e2 == `string` ? e2.trim() : ``; }],
[1067, ctx => { ctx.Vv = () => ({
  vmPu: null,
  vaDeg: null,
  pGenerationMw: null,
  qGenerationMvar: null
}); }],
[1068, ctx => { ctx.Hv = () => ({
  pFromMw: null,
  qFromMvar: null,
  pToMw: null,
  qToMvar: null,
  iFromA: null,
  iToA: null,
  loadingFromPct: null,
  loadingToPct: null
}); }],
[1069, ctx => { ctx.Uv = e2 => typeof e2 == `number` && Number.isFinite(e2) ? e2 : null; }],
[1071, ctx => { ctx.Gv = 100; }],
[1072, ctx => { ctx.Kv = [{
  key: `source`,
  label: `Kaynak kayd\u0131`
}, {
  key: `base`,
  label: `Baz`
}, {
  key: `scenario`,
  label: `Senaryo`
}, {
  key: `delta`,
  label: `Fark (Senaryo \u2212 Baz)`
}]; }],
[1073, ctx => { ctx.qv = () => ({
  pFromMw: null,
  qFromMvar: null,
  pToMw: null,
  qToMvar: null,
  iFromA: null,
  iToA: null,
  loadingFromPct: null,
  loadingToPct: null
}); }],
[1075, ctx => { ctx.Yv = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2
}; }],
[1082, ctx => { ctx.ny = 1200; }],
[1083, ctx => { ctx.ry = 690; }],
[1084, ctx => { ctx.iy = Math.min(ctx.ny / 21, ctx.ry / 11.5); }],
[1085, ctx => { ctx.ay = 120; }],
[1086, ctx => { ctx.oy = 240; }],
[1087, ctx => { ctx.sy = [{
  id: `b400`,
  label: `400 kV`,
  min: 300
}, {
  id: `b220`,
  label: `220 kV`,
  min: 180
}, {
  id: `b154`,
  label: `154 kV`,
  min: 100
}, {
  id: `b66`,
  label: `66 kV`,
  min: 36
}, {
  id: `blow`,
  label: `\u226436 kV`,
  min: 0
}]; }]
];
