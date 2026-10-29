// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.Xv = function Xv(e2, t2 = 24) {
  let n2 = [...e2].sort((e3, t3) => ctx.Yv[e3.severity] - ctx.Yv[t3.severity]),
    r2 = {
      ERROR: 0,
      WARNING: 0,
      INFO: 0
    };
  for (let t3 of e2) r2[t3.severity]++;
  return {
    ordered: n2,
    visible: n2.slice(0, Math.max(0, Math.trunc(t2))),
    counts: r2
  };
};
ctx.Qv = function Qv(e2) {
  let t2 = ctx.Q(`section`, `ga-feature ga-psse-analysis`),
    n2 = ctx.Q(`details`, `ga-panel ga-psse-analysis-options`),
    r2 = ctx.Q(`p`, `ga-notice ga-psse-progress`),
    i2 = ctx.Q(`p`, `ga-muted ga-psse-method-readiness`),
    a2 = ctx.Q(`section`, `ga-panel ga-psse-method-panel`),
    o2 = ctx.Q(`p`, `ga-empty`),
    s2 = ctx.Q(`div`, `ga-card-grid`),
    c2 = ctx.Q(`div`, `ga-psse-findings`),
    l2 = ctx.Q(`details`, `ga-psse-worker-diagnostic`),
    u2 = ctx.Q(`section`, `ga-panel ga-psse-violations`),
    d2 = ctx.Q(`div`, `ga-psse-result-table`),
    f2 = ctx.Q(`details`, `ga-panel ga-psse-scenario`);
  a2.append(i2, o2);
  let p2 = ctx.Q(`select`),
    m2 = ctx.Q(`select`),
    h2 = ctx.Q(`input`),
    g2 = ctx.Q(`input`),
    _2 = ctx.Q(`input`),
    v2 = ctx.Q(`input`),
    y2 = ctx.Q(`select`),
    b2 = ctx.Q(`select`),
    x2 = ctx.Q(`select`),
    S2 = ctx.Q(`select`),
    C2 = ctx.Q(`select`),
    w2 = ctx.Q(`input`),
    T2 = ctx.Q(`input`),
    E2 = ctx.$(`Hesapla`, () => void te2()),
    D2 = ctx.$(`\u0130ptal`, () => e2.cancel());
  p2.append(new Option(`Tam AC \xB7 Sparse polar NR`, `NR_POLAR`), new Option(`H\u0131zl\u0131 ayr\u0131\u015Ft\u0131r\u0131lm\u0131\u015F \xB7 XB`, `FDNS_XB`), new Option(`Kay\u0131ps\u0131z do\u011Frusal DC`, `LOSSLESS_DC`)), p2.setAttribute(`aria-label`, `PSS/E \xE7\xF6z\xFCm y\xF6ntemi`), m2.append(new Option(`D\xFCz ba\u015Flang\u0131\xE7 \xB7 1 pu`, `FLAT`), new Option(`Kaynakta kay\u0131tl\u0131 ba\u015Flang\u0131\xE7`, `SOURCE_SAVED`)), m2.setAttribute(`aria-label`, `AC ilk gerilim`), m2.value = `SOURCE_SAVED`, h2.type = `checkbox`, h2.checked = true, h2.setAttribute(`aria-label`, `Jenerat\xF6r reaktif g\xFC\xE7 s\u0131n\u0131rlar\u0131`), g2.type = `checkbox`, g2.checked = false, g2.setAttribute(`aria-label`, `Uzak bara gerilim kontrol\xFC (IREG/RMPCT)`), _2.type = `number`, _2.min = `0.0000000001`, _2.max = `1`, _2.step = `any`, _2.value = `0.000001`, _2.setAttribute(`aria-label`, `AC tolerans\u0131 pu`), v2.type = `number`, v2.min = `1`, v2.max = `500`, v2.step = `1`, v2.value = `40`, v2.setAttribute(`aria-label`, `Maksimum AC iterasyon say\u0131s\u0131`), y2.append(new Option(`PSS/E kaynak karakteristi\u011Fi`, `PSSE_SOURCE`), new Option(`Genel ZIP polinomu`, `GENERIC_ZIP`)), y2.setAttribute(`aria-label`, `Y\xFCk karakteristi\u011Fi profili`), b2.append(new Option(`PSS/E 36.5 DCLF uyumlu`, `PSSE36_DCLF_COMPAT`), new Option(`Kademe duyarl\u0131 do\u011Frusal DC`, `TAP_AWARE_LOSSLESS`)), b2.setAttribute(`aria-label`, `DC trafo kademe profili`), x2.append(new Option(`D\xFCz referans \xB7 0\xB0`, `FLAT_REFERENCE`), new Option(`Kaynak referans a\xE7\u0131s\u0131`, `SOURCE_REFERENCE_ANGLE`)), x2.setAttribute(`aria-label`, `DC referans a\xE7\u0131s\u0131`), S2.append(new Option(`Kaynak kay\u0131tl\u0131 gerilim`, `SOURCE_SAVED`), new Option(`1 pu gerilim`, `UNITY`)), S2.setAttribute(`aria-label`, `DC ger\xE7ek \u015F\xF6nt gerilimi`), C2.append(new Option(`Kaynak kay\u0131tl\u0131 gerilim`, `SOURCE_SAVED`), new Option(`1 pu gerilim`, `UNITY`)), C2.setAttribute(`aria-label`, `DC ZIP y\xFCk gerilimi`), w2.type = T2.type = `number`, w2.step = T2.step = `.01`, w2.value = `.95`, T2.value = `1.05`, w2.min = T2.min = `0`, w2.setAttribute(`aria-label`, `\xC7al\u0131\u015Fma alt gerilim e\u015Fi\u011Fi pu`), T2.setAttribute(`aria-label`, `\xC7al\u0131\u015Fma \xFCst gerilim e\u015Fi\u011Fi pu`);
  let O2 = (e3, t3) => {
      let n3 = ctx.Q(`label`, `ga-psse-control`);
      return n3.append(ctx.Q(`span`, `ga-muted`, e3), t3), n3;
    },
    k2 = ctx.Q(`label`, `ga-psse-control ga-psse-checkbox`);
  k2.append(h2, ctx.Q(`span`, ``, `Q s\u0131n\u0131rlar\u0131n\u0131 uygula`));
  let A2 = ctx.Q(`label`, `ga-psse-control ga-psse-checkbox`);
  A2.append(g2, ctx.Q(`span`, ``, `Uzak bara gerilim kontrol\xFC (IREG/RMPCT)`));
  let j2 = ctx.Q(`div`, `ga-psse-controls`),
    M2 = ctx.Q(`div`, `ga-psse-controls`),
    N2 = ctx.Q(`div`, `ga-psse-primary-controls`);
  N2.append(O2(`Y\xF6ntem`, p2), E2, D2), j2.append(O2(`Ba\u015Flang\u0131\xE7`, m2), k2, A2, O2(`AC tolerans (pu)`, _2), O2(`Maks. AC iterasyon`, v2), O2(`Y\xFCk profili`, y2), O2(`DC tap profili`, b2), O2(`Referans a\xE7\u0131s\u0131`, x2), O2(`Ger\xE7ek \u015F\xF6ntler`, S2), O2(`DC ZIP gerilimi`, C2)), M2.append(O2(`\xC7al\u0131\u015Fma alt Vm e\u015Fi\u011Fi pu`, w2), O2(`\xC7al\u0131\u015Fma \xFCst Vm e\u015Fi\u011Fi pu`, T2)), n2.append(ctx.Q(`summary`, ``, `Geli\u015Fmi\u015F y\xF6ntem se\xE7enekleri`), ctx.Q(`p`, `ga-muted`, `AC tolerans\u0131 ve iterasyon s\u0131n\u0131r\u0131 se\xE7ilen NR / FDNS \xE7\xF6z\xFCc\xFCs\xFCne uygulan\u0131r. Uzak bara gerilim kontrol\xFC yaln\u0131z NR y\xF6nteminde kullan\u0131labilir ve varsay\u0131lan olarak kapal\u0131d\u0131r. DC bu AC kontrollerini kullanmaz. Gerilim ihlallerinde kaynak NVLO/NVHI \xF6nceliklidir; eksik kaynak s\u0131n\u0131rlar\u0131 i\xE7in a\xE7\u0131k \xE7al\u0131\u015Fma e\u015Fikleri kullan\u0131l\u0131r.`), j2, M2);
  let P2 = ctx.Q(`details`, `ga-psse-identity`),
    F2 = ctx.Q(`div`, `ga-psse-identity-grid`);
  P2.append(ctx.Q(`summary`, ``, `Hesap kimli\u011Fi`), F2);
  let I2 = ctx.$(`GA hesap sonucunu JSON indir`, () => {
      re2() && e2.psseCalculation && ctx.Os(JSON.stringify(ctx.Uo(e2.psseCalculation), null, 2), `GA_PSSE_${e2.psseCalculation.method}_${e2.psseCalculation.id}.json`, `application/json`);
    }),
    L2 = ctx.Jv(e2, {
      embedded: true
    }),
    R2 = ctx.Q(`input`);
  R2.type = `file`, R2.accept = `.json,application/json`, R2.className = `ga-visually-hidden`, R2.setAttribute(`aria-label`, `PSS/E referans JSON`);
  let z2 = ctx.$(`PSS/E referans JSON i\xE7e aktar`, () => R2.click()),
    B2 = null,
    V2 = `PSS/E_REFERENCE ayr\u0131 ve salt okunur kaynakt\u0131r; bu profil yaln\u0131z a\xE7\u0131k\xE7a i\xE7e aktar\u0131lan dosyayla kar\u015F\u0131la\u015Ft\u0131r\u0131l\u0131r.`,
    H2 = ctx.Q(`p`, `ga-muted`, V2),
    U2 = ctx.Q(`pre`);
  R2.onchange = async () => {
    try {
      let t3 = R2.files?.[0];
      if (!t3) return;
      let n3 = JSON.parse(await t3.text());
      if (n3.schema !== `ga.psse.reference.v1` || n3.provenance !== `PSSE_REFERENCE`) throw Error(`Ge\xE7ersiz PSS/E_REFERENCE \u015Femas\u0131 veya provenance.`);
      if (n3.source?.sha256 !== e2.psseInspection?.source.sha256) throw Error(`Kaynak SHA-256 y\xFCklenen PSS/E modeliyle e\u015Fle\u015Fmiyor.`);
      B2 = n3, V2 = `PSSE_REFERENCE \xB7 ${t3.name} \xB7 kaynak SHA-256 e\u015Fle\u015Fti \xB7 y\xF6ntem ${String(n3.spec?.method ?? `bilinmiyor`)}. Bu ayr\u0131 oracle sonucu GA sonucu olarak kullan\u0131lmaz.`;
    } catch (e3) {
      B2 = null, U2.textContent = ``, V2 = `Referans reddedildi: ${e3 instanceof Error ? e3.message : String(e3)}`;
    }
    R2.value = ``, ce2();
  };
  let W2 = ctx.Q(`div`, `ga-psse-export-actions`);
  W2.append(I2);
  let G2 = ctx.Q(`section`, `ga-panel`);
  G2.append(ctx.Q(`h3`, ``, `PSS/E_REFERENCE kar\u015F\u0131la\u015Ft\u0131rmas\u0131`), H2, z2, R2, U2), t2.append(ctx.Q(`h2`, ``, `PSS/E \xB7 Analiz`), N2, a2, r2, n2, s2, d2, c2, u2, f2, P2, l2, G2);
  let K2 = /* @__PURE__ */new Map();
  function q2() {
    let t3 = p2.value !== `LOSSLESS_DC`;
    _2.disabled = !t3, v2.disabled = !t3, m2.disabled = !t3, h2.disabled = !t3, g2.disabled = p2.value !== `NR_POLAR`, g2.title = g2.disabled ? `Uzak bara gerilim kontrol\xFC yaln\u0131z NR y\xF6nteminde kullan\u0131labilir.` : ``, y2.disabled = !t3, b2.disabled = t3, x2.disabled = t3, S2.disabled = t3, C2.disabled = t3;
    let n3 = t3 ? `DC tap, referans a\xE7\u0131s\u0131 ve \u015F\xF6nt/y\xFCk gerilimi alanlar\u0131 bu AC y\xF6ntemde kullan\u0131lmaz.` : `AC ba\u015Flang\u0131\xE7, Q s\u0131n\u0131r\u0131, tolerans, iterasyon ve ZIP profili alanlar\u0131 bu DC y\xF6nteminde kullan\u0131lmaz.`;
    for (let e3 of [m2, h2, _2, v2, y2, b2, x2, S2, C2]) e3.disabled ? e3.title = n3 : e3.removeAttribute(`title`);
    let r3 = e2.psseInspection,
      a3 = e2.psseNetwork;
    if (!r3 || !a3) {
      i2.textContent = `Kaynak modeli y\xFCklenince se\xE7ili y\xF6ntem i\xE7in destek kapsam\u0131 g\xF6sterilir.`;
      return;
    }
    let o3 = p2.value,
      s3 = `${a3.modelHash}:${o3}`,
      c3 = K2.get(s3);
    c3 || (c3 = ctx.ls(r3, a3, o3), K2.set(s3, c3));
    let l3 = c3.findings.filter(e3 => e3.severity === `ERROR`);
    i2.textContent = `${o3} \xB7 ${c3.status} \xB7 ${c3.energizedBusCount.toLocaleString(`tr-TR`)} etkin bara / ${c3.islandCount} ada${l3.length ? ` \xB7 ${l3.length} bloklay\u0131c\u0131 bulgu: ${l3.slice(0, 3).map(e3 => e3.code).join(`, `)}` : c3.status === `PARTIAL` ? ` \xB7 s\u0131n\u0131rl\u0131 profil` : ``}. Ayr\u0131nt\u0131 hesap sonras\u0131 t\xFCm bulgularda g\xF6r\xFCn\xFCr.`;
  }
  p2.onchange = () => {
    q2(), ce2();
  }, m2.onchange = h2.onchange = g2.onchange = _2.onchange = v2.onchange = y2.onchange = b2.onchange = x2.onchange = S2.onchange = C2.onchange = w2.onchange = T2.onchange = () => ce2(), q2();
  function ee2() {
    let t3 = e2.psseNetwork,
      n3 = e2.psseScenario;
    if (!t3 || !n3) {
      f2.hidden = true, f2.replaceChildren();
      return;
    }
    f2.hidden = false;
    let r3 = [...t3.branches, ...t3.generators, ...t3.loads, ...t3.shunts],
      i3 = ctx.Q(`summary`, ``, `Ayr\u0131 PSS/E senaryosu`),
      a3 = ctx.Q(`p`, `ga-muted`, `${n3.operations.length} i\u015Flem \xB7 kaynak model ve DGS senaryosundan ba\u011F\u0131ms\u0131z`),
      o3 = ctx.Q(`select`),
      s3 = ctx.Q(`select`),
      c3 = ctx.$(`\u0130\u015Flemi uygula`, () => {
        let t4 = r3.find(e3 => e3.sourceEquipmentId === o3.value),
          i4 = {
            equipmentId: o3.value,
            action: `STATUS`,
            value: Number(s3.value)
          };
        if (!t4) return;
        let a4 = n3.operations.filter(e3 => e3.equipmentId !== i4.equipmentId || e3.action !== i4.action);
        e2.setPsseScenario([...a4, i4]);
      });
    o3.setAttribute(`aria-label`, `Senaryo ekipman\u0131`);
    for (let n4 of [...new Set(r3.map(e3 => e3.sourceEquipmentId))].slice(0, 1e3)) o3.append(new Option(e2.psseInspection ? ctx.Lv(e2.psseInspection, t3).equipment(n4) : `Kaynak ekipman`, n4));
    s3.setAttribute(`aria-label`, `Kaynak ekipman serviste`), s3.append(new Option(`Serviste`, `1`), new Option(`Devre d\u0131\u015F\u0131`, `0`));
    let l3 = ctx.$(`Baz senaryoya d\xF6n`, () => e2.setPsseScenario([])),
      u3 = ctx.Q(`ul`, `ga-psse-operation-list`),
      d3 = ctx.Q(`div`, `ga-psse-controls`);
    d3.append(o3, s3, c3, l3);
    for (let r4 of n3.operations) u3.append(ctx.Q(`li`, ``, `${e2.psseInspection ? ctx.Lv(e2.psseInspection, t3).equipment(r4.equipmentId) : `Kaynak ekipman`} \xB7 ${r4.action} = ${String(r4.value)}`));
    f2.replaceChildren(i3, a3, ctx.Q(`p`, `ga-muted`, `\u0130\u015Flem: kaynak cihaz\u0131n servis durumunu a\xE7/kapat. Ayn\u0131 kaynak cihaz\u0131n ba\u011Fl\u0131 sarg\u0131/dal kay\u0131tlar\u0131 birlikte etkilenir.`), d3, u3);
  }
  function J2() {
    let e3 = p2.value;
    if (e3 === `LOSSLESS_DC`) return {
      method: e3,
      options: {
        tapPolicy: b2.value,
        referenceAnglePolicy: x2.value,
        realShuntVoltagePolicy: S2.value,
        loadVoltagePolicy: C2.value
      }
    };
    let t3 = Number(_2.value),
      n3 = Number(v2.value);
    return !Number.isFinite(t3) || t3 <= 0 || t3 > 1 || !Number.isInteger(n3) || n3 < 1 || n3 > 500 ? null : {
      method: e3,
      options: {
        initialVoltagePolicy: m2.value,
        reactiveLimitsEnabled: h2.checked,
        loadModelProfile: y2.value,
        tolerancePu: t3,
        maxIterations: n3,
        ...(e3 === `NR_POLAR` ? {
          remoteRegulation: g2.checked
        } : {})
      }
    };
  }
  async function te2() {
    let t3 = J2();
    if (!t3) {
      if (p2.value === `LOSSLESS_DC`) return;
      let t4 = Number(_2.value);
      Number(v2.value), e2.setMessage(!Number.isFinite(t4) || t4 <= 0 || t4 > 1 ? `AC tolerans\u0131 0\u2019dan b\xFCy\xFCk ve en fazla 1 pu olmal\u0131d\u0131r.` : `Maksimum AC iterasyon say\u0131s\u0131 1\u2013500 aras\u0131nda tam say\u0131 olmal\u0131d\u0131r.`);
      return;
    }
    await e2.runPsseCalculation(t3.method, t3.options);
  }
  let ne2 = null;
  function re2() {
    let t3 = e2.psseCalculation,
      n3 = e2.psseNetwork,
      r3 = e2.psseScenario,
      i3 = e2.psseInspection?.source.sha256,
      a3 = J2();
    if (!t3 || !n3 || !r3 || !i3 || !a3) return false;
    let o3, s3;
    try {
      o3 = ctx.Ro({
        ...(a3.method === `LOSSLESS_DC` ? ctx.ps : ctx.ds),
        ...a3.options
      }), s3 = JSON.stringify(t3.identity);
    } catch {
      return false;
    }
    if (ne2?.result === t3 && ne2.identitySignature === s3 && ne2.network === n3 && ne2.scenario === r3 && ne2.sourceSha256 === i3 && ne2.method === a3.method && ne2.optionsHash === o3) return ne2.valid;
    let c3 = false;
    try {
      c3 = ctx.Wo(t3, {
        sourceSha256: i3,
        network: n3,
        effectiveNetwork: ctx.fs(n3, r3),
        scenario: r3,
        method: a3.method,
        optionsHash: o3
      });
    } catch {}
    return ne2 = {
      result: t3,
      identitySignature: s3,
      network: n3,
      scenario: r3,
      sourceSha256: i3,
      method: a3.method,
      optionsHash: o3,
      valid: c3
    }, c3;
  }
  function ie2(e3, t3) {
    if (e3.method === `LOSSLESS_DC`) {
      u2.replaceChildren(ctx.Q(`h3`, ``, `Gerilim ve termik ihlaller`), ctx.Q(`p`, `ga-muted`, `LOSSLESS_DC bara gerilim b\xFCy\xFCkl\xFC\u011F\xFC Vm \xE7\xF6zmez; gerilim, MVA, ak\u0131m ve termik ihlal de\u011Ferlendirmesi bu sonu\xE7ta yoktur.`), ctx.Q(`p`, `ga-muted`, `Modelde kullan\u0131lan 1 pu gerilim de\u011Feri yaln\u0131z DC y\xFCk/\u015F\xF6nt varsay\u0131m\u0131d\u0131r; hesaplanan bara Vm de\u011Fildir.`));
      return;
    }
    let n3 = [],
      r3 = new Map(t3.equipment.filter(e4 => e4.kind === `bus`).map(e4 => [e4.id, e4])),
      i3 = e4 => {
        if (typeof e4 == `number`) return Number.isFinite(e4) && e4 > 0 ? e4 : null;
        if (typeof e4 == `string` && e4.trim() !== ``) {
          let t4 = Number(e4);
          return Number.isFinite(t4) && t4 > 0 ? t4 : null;
        }
        return null;
      },
      a3 = Number(w2.value),
      o3 = Number(T2.value),
      s3 = Number.isFinite(a3) && Number.isFinite(o3) && a3 < o3,
      c3 = 0,
      l3 = 0,
      d3 = 0;
    for (let t4 of e3.busResults) {
      if (t4.vmPu === null || t4.vmPu === void 0) continue;
      let e4 = (t4.sourceEquipmentId ? r3.get(t4.sourceEquipmentId) : void 0)?.fields ?? {},
        u3 = i3(e4.nvlo),
        d4 = i3(e4.nvhi);
      (u3 !== null || d4 !== null) && c3++, (u3 === null || d4 === null) && l3++;
      let f4 = u3 ?? (s3 ? a3 : null),
        p4 = d4 ?? (s3 ? o3 : null);
      f4 !== null && t4.vmPu < f4 && n3.push({
        kind: `Gerilim d\xFC\u015F\xFCk`,
        id: t4.id,
        value: `${ctx.Zv(t4.vmPu, 5)} pu`,
        limit: `\u2265 ${ctx.Zv(f4, 5)} pu`,
        basis: u3 === null ? `\xC7al\u0131\u015Fma alt e\u015Fi\u011Fi \xB7 kaynak NVLO yok` : `Kaynak NVLO`,
        severity: (f4 - t4.vmPu) / f4
      }), p4 !== null && t4.vmPu > p4 && n3.push({
        kind: `Gerilim y\xFCksek`,
        id: t4.id,
        value: `${ctx.Zv(t4.vmPu, 5)} pu`,
        limit: `\u2264 ${ctx.Zv(p4, 5)} pu`,
        basis: d4 === null ? `\xC7al\u0131\u015Fma \xFCst e\u015Fi\u011Fi \xB7 kaynak NVHI yok` : `Kaynak NVHI`,
        severity: (t4.vmPu - p4) / p4
      });
    }
    for (let t4 of e3.branchResults) if (t4.loadingBasis !== `UNAVAILABLE`) for (let [e4, r4, i4] of [[`U\xE7 1`, t4.loadingFromPct, t4.ratingsFromSource?.[0] ?? null], [`U\xE7 2`, t4.loadingToPct, t4.ratingsToSource?.[0] ?? null]]) r4 == null || i4 === null || i4 <= 0 || (d3++, r4 > 100 && n3.push({
      kind: `Termik a\u015F\u0131r\u0131 y\xFCk`,
      id: `${t4.id} \xB7 ${e4}`,
      value: `${ctx.Zv(r4, 2)}%`,
      limit: `\u2264 100%`,
      basis: `Kaynak RATE1 \xB7 ${t4.loadingBasis}`,
      severity: r4 / 100 - 1
    }));
    n3.sort((e4, t4) => t4.severity - e4.severity || e4.id.localeCompare(t4.id));
    let f3 = n3.filter(e4 => e4.kind.startsWith(`Gerilim`)).length,
      p3 = `${f3} gerilim \xB7 ${n3.length - f3} termik ihlal \xB7 ${c3} baran\u0131n kaynak gerilim s\u0131n\u0131r\u0131 \xB7 ${l3} baran\u0131n a\xE7\u0131k \xE7al\u0131\u015Fma e\u015Fi\u011Fi \xB7 ${d3} u\xE7ta ge\xE7erli RATE1`,
      m3 = ctx.Q(`tr`);
    for (let e4 of [`\u0130hlal`, `Kaynak ekipman`, `Hesaplanan`, `S\u0131n\u0131r`, `S\u0131n\u0131r kayna\u011F\u0131`]) m3.append(ctx.Q(`th`, ``, e4));
    let h3 = ctx.Q(`thead`);
    h3.append(m3);
    let g3 = ctx.Q(`tbody`);
    for (let e4 of n3.slice(0, 200)) {
      let t4 = ctx.Q(`tr`);
      for (let n4 of [e4.kind, e4.id, e4.value, e4.limit, e4.basis]) t4.append(ctx.Q(`td`, ``, n4));
      g3.append(t4);
    }
    if (!n3.length) {
      let e4 = ctx.Q(`tr`),
        t4 = ctx.Q(`td`, `ga-empty`, `Se\xE7ili s\u0131n\u0131rlar i\xE7inde ihlal yok.`);
      t4.colSpan = 5, e4.append(t4), g3.append(e4);
    }
    let _3 = ctx.Q(`table`, `ga-table`);
    _3.append(h3, g3);
    let v3 = ctx.Q(`div`, `ga-table-wrap`);
    v3.append(_3);
    let y3 = s3 ? `NVLO/NVHI kaynak s\u0131n\u0131rlar\u0131 \xF6nceliklidir; eksik kaynak s\u0131n\u0131r\u0131nda yaln\u0131z a\xE7\u0131k \xE7al\u0131\u015Fma e\u015Fi\u011Fi kullan\u0131l\u0131r. Termik ihlaller yaln\u0131z kaynak RATE1 ve hesaplanm\u0131\u015F u\xE7 y\xFCklemesi olan u\xE7larda de\u011Ferlendirilir.` : `\xC7al\u0131\u015Fma e\u015Fikleri ge\xE7ersiz. Kaynak s\u0131n\u0131r\u0131 olmayan baralar i\xE7in gerilim ihlali de\u011Ferlendirilmedi.`;
    u2.replaceChildren(ctx.Q(`h3`, ``, `Gerilim ve termik ihlaller`), ctx.Q(`p`, `ga-muted`, p3), ctx.Q(`p`, `ga-muted`, y3), v3);
  }
  function ae2() {
    let t3 = e2.psseWorkerError;
    if (!t3) {
      l2.hidden = true, l2.replaceChildren();
      return;
    }
    l2.hidden = false, l2.replaceChildren(ctx.Q(`summary`, ``, `PSS/E worker tan\u0131s\u0131`), ctx.Q(`p`, `ga-notice`, `${t3.method} \xB7 ${t3.phase} \xB7 ${t3.message}`), ctx.Q(`p`, `ga-muted`, `Kaynak ${t3.sourceSha256} \xB7 model ${t3.modelHash} \xB7 senaryo ${t3.scenarioHash}`), ctx.Q(`pre`, `ga-psse-worker-error-stack`, t3.workerStack ?? `Worker stack al\u0131namad\u0131.`));
  }
  function oe2() {
    ae2(), r2.textContent = e2.busy ? `\xC7al\u0131\u015F\u0131yor \xB7 ${e2.status} \xB7 \u0130ptal ile durdurabilirsiniz.` : e2.psseWorkerError ? `Worker hatas\u0131 \xB7 ${e2.psseWorkerError.phase} \xB7 ayr\u0131nt\u0131 altta.` : ``, r2.hidden = !e2.busy && !e2.psseWorkerError;
    let t3 = re2() ? e2.psseCalculation : null,
      n3 = e2.psseInspection,
      l3 = e2.psseNetwork;
    if (!t3 || !n3 || !l3) {
      a2.hidden = false, i2.hidden = !l3, o2.hidden = e2.busy, o2.textContent = e2.busy ? `` : l3 ? `Hen\xFCz hesaplanm\u0131\u015F sonu\xE7 yok. Se\xE7ili y\xF6ntemi \xE7al\u0131\u015Ft\u0131r\u0131n.` : `PSS/E modeli y\xFCkleyerek ba\u015Flay\u0131n.`, d2.hidden = true, s2.hidden = true, c2.hidden = true, u2.hidden = true, P2.hidden = true, G2.hidden = true, W2.hidden = true, s2.replaceChildren(), F2.replaceChildren(), c2.replaceChildren(), u2.replaceChildren(), I2.disabled = true, B2 && (V2 = `NOT_READY \xB7 etkin kaynak ve senaryo i\xE7in g\xFCncel GA_PSSE_CALCULATED sonucu yok; \xF6nceki kar\u015F\u0131la\u015Ft\u0131rma g\xF6sterilmiyor.`, U2.textContent = ``, se2());
      return;
    }
    if (a2.hidden = false, i2.hidden = false, o2.hidden = true, d2.hidden = false, s2.hidden = false, c2.hidden = false, u2.hidden = false, P2.hidden = false, G2.hidden = false, W2.hidden = false, I2.disabled = false, B2) {
      if (e2.psseScenario?.operations.length) V2 = `NOT_READY \xB7 referanslar yaln\u0131z baz senaryoyla kar\u015F\u0131la\u015Ft\u0131r\u0131l\u0131r; etkin PSS/E senaryosunu baz durumuna s\u0131f\u0131rlay\u0131n.`, U2.textContent = ``;else {
        let e3 = ctx.ev(B2, n3, l3, t3);
        V2 = `PSSE_REFERENCE \xB7 ${e3.status} \xB7 ${e3.method ?? `unknown`} \xB7 yaln\u0131z se\xE7ili y\xF6ntem/se\xE7enek profili i\xE7in kar\u015F\u0131la\u015Ft\u0131rma \xB7 ${e3.counts.compared} de\u011Fer kar\u015F\u0131la\u015Ft\u0131r\u0131ld\u0131 / ${e3.counts.missing} e\u015Fle\u015Fmedi.`, U2.textContent = JSON.stringify(e3, null, 2);
      }
      se2();
    }
    let f3 = t3.source === `GA_PSSE_CALCULATED` ? `GA hesapland\u0131` : t3.source,
      p3 = [[`Durum`, ctx.Vo(t3)], [`\xC7\xF6z\xFCm s\u0131n\u0131f\u0131`, t3.classification], [`Fizik kapsam\u0131`, t3.physicsCoverage], [`Kaynak`, f3], [`Y\xF6ntem`, t3.method], [`Newton / ad\u0131m`, String(t3.iterations)], [`S\xFCre`, `${ctx.Zv(t3.elapsedMs, 0)} ms`], [`\u0394P`, ctx.Zv(t3.maxPMismatchPu, 7)], [`\u0394Q`, ctx.Zv(t3.maxQMismatchPu, 7)]];
    s2.replaceChildren(...p3.map(([e3, n4]) => {
      let r3 = ctx.Q(`div`, `ga-card`);
      return e3 === `Kaynak` && (r3.title = t3.source), r3.append(ctx.Q(`span`, `ga-muted`, e3), ctx.Q(`strong`, ``, n4)), r3;
    }));
    let m3 = [[`Sonu\xE7 kimli\u011Fi`, t3.identity.id], [`Kaynak s\u0131n\u0131f\u0131`, t3.source], [`\xC7\xF6z\xFCm y\xF6ntemi`, t3.identity.solver], [`Motor s\xFCr\xFCm\xFC`, t3.identity.engineVersion], [`Model SHA-256`, t3.identity.modelHash], [`Topoloji SHA-256`, t3.identity.topologyHash], [`Senaryo SHA-256`, t3.identity.scenarioHash], [`Se\xE7enek SHA-256`, t3.identity.optionsHash]];
    F2.replaceChildren(...m3.map(([e3, t4]) => {
      let n4 = ctx.Q(`div`, `ga-psse-identity-item`);
      return n4.append(ctx.Q(`span`, `ga-muted`, e3), ctx.Q(`code`, ``, t4)), n4;
    })), ie2(t3, n3);
    let h3 = ctx.Xv(t3.findings),
      g3 = h3.counts,
      _3 = ctx.Q(`p`, `ga-muted`, `${g3.ERROR} hata \xB7 ${g3.WARNING} uyar\u0131 \xB7 ${g3.INFO} bilgi \xB7 ilk ${h3.visible.length}/${h3.ordered.length}`),
      v3 = h3.visible.map(e3 => ctx.Q(`p`, `ga-notice`, `${e3.severity} \xB7 ${e3.code} \xB7 ${e3.message}`)),
      y3 = ctx.Q(`details`, `ga-psse-all-findings`),
      b3 = ctx.Q(`pre`, `ga-psse-findings-json`);
    y3.append(ctx.Q(`summary`, ``, `T\xFCm bulgular \xB7 JSON`), b3), y3.ontoggle = () => {
      y3.open && b3.textContent === `` && (b3.textContent = JSON.stringify(h3.ordered, null, 2));
    }, c2.replaceChildren(ctx.Q(`p`, `ga-notice`, ctx.Ho(t3)), _3, ...v3, ...(h3.ordered.length > h3.visible.length ? [y3] : [])), d2.replaceChildren(W2, L2.element), L2.render(), B2 && se2();
  }
  function se2() {
    H2.textContent = V2;
  }
  D2.disabled = !e2.busy, E2.disabled = e2.busy || !e2.psseNetwork;
  function ce2() {
    D2.disabled = !e2.busy, E2.disabled = e2.busy || !e2.psseNetwork, E2.textContent = e2.busy ? `Hesaplan\u0131yor\u2026` : re2() ? `Yeniden hesapla` : `Hesapla`, E2.title = re2() ? `Mevcut PSS/E model ve senaryo i\xE7in yeniden hesaplar.` : `Se\xE7ili PSS/E y\xF6ntemini \xE7al\u0131\u015Ft\u0131r\u0131r.`, q2(), ee2(), oe2(), se2();
  }
  return {
    element: t2,
    render: ce2,
    dispose: L2.dispose
  };
};
}
export const initializers = [
[1077, ctx => { ctx.Zv = (e2, t2 = 3) => e2 == null ? `\u2014` : e2 !== 0 && Math.abs(e2) < 10 ** -t2 ? e2.toExponential(Math.min(t2, 6)) : e2.toLocaleString(`tr-TR`, {
  maximumFractionDigits: t2,
  useGrouping: false
}); }]
];
