// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.wy = function wy(e2) {
  let t2 = ctx.Q(`section`, `ga-feature ga-psse-diagram ga-psse-sld`),
    n2 = ctx.Q(`header`, `ga-feature-heading`),
    r2 = ctx.Q(`div`, `ga-psse-diagram-controls`),
    i2 = ctx.Q(`section`, `ga-psse-sld-stage`),
    a2 = ctx.Q(`div`, `ga-psse-map-stats`),
    o2 = ctx.Q(`p`, `ga-notice`),
    s2 = ctx.Q(`div`, `ga-psse-diagram-legend`),
    c2 = ctx.Q(`div`, `ga-psse-sld-canvas`),
    l2 = ctx.Q(`div`, `ga-psse-diagram-results`);
  n2.append(ctx.Q(`h2`, ``, `PSS/E Tek Hat \u015Eemas\u0131`), ctx.Q(`p`, `ga-muted`, `Kaynak baralar ve normalize bus-branch kay\u0131tlar\u0131ndan \xFCretilen elektrik tek hatt\u0131. Trafo, \xFC\xE7 sarg\u0131l\u0131 trafo, jenerat\xF6r ve y\xFCk sembolleri ayr\u0131 g\xF6sterilir; fiziksel node-breaker terminali t\xFCretilmez.`));
  let u2 = ctx.Q(`input`);
  u2.type = `search`, u2.placeholder = `Bara numaras\u0131, kimli\u011Fi veya ad\u0131`, u2.setAttribute(`aria-label`, `Tek hat g\xF6r\xFCn\xFCm\xFCnde PSS/E baras\u0131 ara`);
  let d2 = ctx.Q(`select`);
  d2.setAttribute(`aria-label`, `Arama e\u015Fle\u015Fmeleri`);
  let f2 = ctx.Q(`select`);
  f2.setAttribute(`aria-label`, `Gerilim grubu filtresi`);
  let p2 = ctx.Q(`input`);
  p2.type = `checkbox`, p2.checked = true, p2.setAttribute(`aria-label`, `36 kV dahil ve alt\u0131ndaki t\xFCm gerilim d\xFCzeylerini g\xF6ster`), ctx.Q(`label`, `ga-check`).append(p2, ctx.document.createTextNode(`\u226436 kV dahil (36 kV i\xE7erir)`));
  let m2 = ctx.Q(`select`);
  m2.setAttribute(`aria-label`, `YTM / AREA filtresi`);
  let h2 = ctx.Q(`select`);
  h2.setAttribute(`aria-label`, `BM / Bus OWNER filtresi`);
  let g2 = ctx.Q(`select`);
  g2.setAttribute(`aria-label`, `Trafo merkezi`);
  let _2 = ctx.Q(`select`);
  _2.setAttribute(`aria-label`, `Servis durumu filtresi`), _2.append(new Option(`T\xFCm durumlar`, `all`), new Option(`Serviste`, `in`), new Option(`Devre d\u0131\u015F\u0131`, `out`)), _2.value = `in`;
  let v2 = ctx.Q(`select`);
  v2.setAttribute(`aria-label`, `Kom\u015Fuluk derinli\u011Fi`);
  for (let [e3, t3] of [[1, `1 kademe`], [2, `2 kademe`], [3, `3 kademe`]]) v2.append(new Option(t3, String(e3)));
  v2.value = `2`;
  let y2 = ctx.Q(`select`);
  y2.setAttribute(`aria-label`, `Tek hat sonu\xE7 katman\u0131`), y2.append(new Option(`SOURCE_SAVED / kaynak`, `saved`), new Option(`GA_PSSE_CALCULATED / hesap`, `calculated`));
  let b2 = ctx.$(`Se\xE7ili baraya odaklan`, () => {
      let e3 = A2?.network.buses.findIndex(e4 => e4.id === d2.value) ?? -1;
      e3 >= 0 && (D2 = A2.network.buses[e3].id, z2());
    }, `Aranan baray\u0131 merkeze al`),
    x2 = ctx.$(`\u2212`, () => {
      O2 = Math.max(0.5, Number((O2 - 0.15).toFixed(2))), z2();
    }, `Uzakla\u015Ft\u0131r`),
    S2 = ctx.$(`+`, () => {
      O2 = Math.min(8, Number((O2 + 0.15).toFixed(2))), z2();
    }, `Yak\u0131nla\u015Ft\u0131r`),
    C2 = ctx.$(`S\u0131\u011Fd\u0131r`, () => {
      O2 = 1, z2();
    }, `G\xF6r\xFCn\xFCm\xFC s\u0131\u011Fd\u0131r`),
    w2 = ctx.$(`SVG d\u0131\u015Fa aktar`, () => B2(), `G\xF6r\xFCnt\xFClenen PSS/E tek hat \u015Femas\u0131n\u0131 kaynak provenans\u0131 ve stillerle SVG olarak indir`),
    T2 = ctx.Q(`div`, `ga-psse-zoom-controls`);
  T2.append(x2, S2, C2, b2, w2), r2.append(ctx.gy(`Bara ara \xB7 t\xFCm model`, u2), ctx.gy(`E\u015Fle\u015Fen bara`, d2), ctx.gy(`YTM / AREA`, m2), ctx.gy(`Trafo Merkezi`, g2), ctx.gy(`Gerilim grubu`, f2), ctx.gy(`BM / Bus OWNER`, h2), ctx.gy(`Servis durumu`, _2), ctx.gy(`De\u011Fer katman\u0131`, y2), T2), i2.append(a2, o2, c2, l2), t2.append(n2, r2, i2);
  let E2 = ctx.Mv(t2),
    D2 = null,
    O2 = 1,
    k2 = `saved`,
    A2 = null,
    j2 = null,
    M2 = /* @__PURE__ */new Map();
  function N2(e3) {
    return A2?.model !== j2 && (j2 = A2?.model ?? null, M2 = new Map(j2?.equipment.map(e4 => [e4.id, e4]) ?? [])), M2.get(e3) ?? null;
  }
  for (let e3 of [f2, m2, h2, _2]) e3.onchange = z2;
  g2.onchange = () => {
    D2 = null, z2();
  }, p2.onchange = z2, y2.onchange = () => {
    k2 = y2.value, z2();
  }, d2.onchange = () => {
    d2.value && (D2 = d2.value, z2());
  }, u2.addEventListener(`input`, () => {
    I2();
    let e3 = ctx.lv(u2.value),
      t3 = A2?.network.buses.filter(t4 => [t4.id, t4.connectionKey, t4.externalNumber].some(t5 => ctx.lv(t5) === e3)) ?? [];
    t3.length === 1 && (D2 = t3[0].id), z2();
  }), u2.addEventListener(`keydown`, e3 => {
    e3.key === `Enter` && (e3.preventDefault(), d2.options.length > 1 && (d2.selectedIndex = 1, d2.dispatchEvent(new Event(`change`))));
  });
  function P2() {
    if (!A2) return;
    let e3 = A2.network,
      t3 = A2.model;
    [...new Set(e3.buses.filter(e4 => e4.source).map(e4 => ctx.yv(e4.baseKv)))].sort((e4, t4) => e4 === `unknown` ? 1 : t4 === `unknown` ? -1 : Number(t4) - Number(e4)), ctx._y(f2, ctx.rv(e3), `T\xFCm gerilim gruplar\u0131`), ctx._y(m2, [...new Set(e3.buses.filter(e4 => e4.source).map(e4 => ctx.hv(e4, t3, M2)))].filter(e4 => e4 && e4 !== `\u2014`).map(e4 => ({
      value: e4,
      label: ctx._v(t3, e4)
    })).sort((e4, t4) => e4.label.localeCompare(t4.label, `tr`)), `T\xFCm YTM / AREA`), ctx._y(h2, [...new Set(e3.buses.filter(e4 => e4.source).map(e4 => ctx.gv(e4, t3, M2)))].filter(e4 => e4 && e4 !== `\u2014`).map(e4 => ({
      value: e4,
      label: ctx.vv(t3, e4)
    })).sort((e4, t4) => e4.label.localeCompare(t4.label, `tr`)), `T\xFCm BM / OWNER`);
  }
  function F2() {
    if (!A2) return;
    let e3 = ctx.iv(A2.model, A2.network).filter(e4 => !m2.value || e4.busIndices.some(e5 => ctx.hv(A2.network.buses[e5], A2.model, M2) === m2.value));
    return ctx._y(g2, e3.map(e4 => ({
      value: e4.id,
      label: `${e4.name} \xB7 ${e4.busIndices.length} bara`
    })), `TM se\xE7in`), !g2.value && e3.length && (g2.value = e3[0].id), e3;
  }
  function I2() {
    if (!A2) {
      ctx._y(d2, [], `Bara ara / se\xE7`);
      return;
    }
    let e3 = ctx.lv(u2.value),
      t3 = A2.network.buses.filter(t4 => !e3 || ctx.lv(ctx.pv(t4, A2.model, M2)).includes(e3)),
      n3 = t3.slice(0, 60);
    ctx._y(d2, n3.map(e4 => ({
      value: e4.id,
      label: `${e4.id} \xB7 ${e4.connectionKey} \xB7 ${ctx.bv(e4.baseKv)} \xB7 ${e4.source ? `bara` : `i\xE7 star d\xFC\u011F\xFCm\xFC`}`
    })), `Bara ara / se\xE7`), d2.title = t3.length > 60 ? `\u0130lk 60 e\u015Fle\u015Fme; ${t3.length} e\u015Fle\u015Fme var.` : `${t3.length} e\u015Fle\u015Fme`, D2 && n3.some(e4 => e4.id === D2) && (d2.value = D2);
  }
  function L2(e3, t3, n3) {
    let r3 = t3.buses[e3],
      i3 = r3.sourceEquipmentId ? N2(r3.sourceEquipmentId) : null,
      a3 = {
        vmPu: ctx.Sv(r3, A2.model, M2),
        vaDeg: ctx.Cv(r3, A2.model, M2)
      },
      o3 = n3.buses.get(r3.connectionKey);
    E2.open(i3, `${r3.source ? `Bara` : `\u0130\xE7 y\u0131ld\u0131z d\xFC\u011F\xFCm\xFC`} \xB7 ${r3.id}`, {
      normalizedBus: r3,
      sourceSaved: a3,
      calculated: o3 ?? null,
      scenarioHash: A2.scenario.hash
    });
  }
  function R2(e3, t3 = {}) {
    let n3 = N2(e3.sourceEquipmentId),
      r3 = k2 === `calculated` ? ctx.Cy(A2).branches.get(e3.id) ?? null : null;
    E2.open(n3, `${e3.kind === `three-winding-leg` ? `\xDC\xE7 sarg\u0131l\u0131 trafo sarg\u0131s\u0131` : e3.kind === `transformer` ? `\u0130ki sarg\u0131l\u0131 trafo` : `Hat`} \xB7 ${e3.id}`, {
      normalizedBranch: e3,
      calculated: r3 ?? null,
      layer: k2,
      scenarioHash: A2.scenario.hash,
      ...t3
    });
  }
  function z2() {
    if (A2 = ctx.uv(e2), !A2) {
      o2.textContent = e2.psseNetwork && e2.psseScenario && e2.psseScenario.networkHash !== e2.psseNetwork.modelHash ? `PSS/E senaryosu ba\u015Fka bir kaynak modeline ait; ge\xE7erli tek hat i\xE7in senaryoyu yenileyin.` : `PSS/E bus-branch modeli ve senaryosu bekleniyor.`, a2.replaceChildren(), c2.replaceChildren(), l2.replaceChildren(), s2.replaceChildren();
      return;
    }
    A2.model !== j2 && (j2 = A2.model, M2 = new Map(j2.equipment.map(e3 => [e3.id, e3]))), P2();
    let t3 = F2() ?? [];
    I2(), y2.options[0].textContent = `${ctx.Tv(A2)} / kaynak`;
    let n3 = A2.network,
      r3 = A2.model,
      i3 = ctx.yy(n3),
      u3 = /* @__PURE__ */new Set();
    n3.buses.forEach((e3, t4) => {
      e3.source && (p2.checked || !ctx.xv(e3.baseKv)) && (f2.value && ctx.yv(e3.baseKv) !== f2.value || m2.value && ctx.hv(e3, r3, M2) !== m2.value || h2.value && ctx.gv(e3, r3, M2) !== h2.value || ctx.wv(e3.status, _2.value) && u3.add(t4));
    });
    let v3 = D2 ? n3.buses.findIndex(e3 => e3.id === D2) : -1,
      b3 = v3 >= 0 ? t3.find(e3 => e3.busIndices.includes(v3)) : void 0;
    b3 && (g2.value = b3.id);
    let x3 = t3.find(e3 => e3.id === g2.value);
    if (x3) {
      let e3 = new Set(x3.busIndices);
      for (let t4 of u3) e3.has(t4) || u3.delete(t4);
    }
    let S3 = v3 >= 0 ? ctx.Sy(n3, v3, i3, u3) : -1;
    if ((S3 < 0 || !u3.has(S3)) && (S3 = ctx.Av(n3, u3, _2.value)), S3 < 0) {
      o2.textContent = `Bu filtrelerle e\u015Fle\u015Fen fiziksel bara yok.`, a2.replaceChildren(), c2.replaceChildren(), l2.replaceChildren();
      return;
    }
    D2 = n3.buses[S3].id, Array.from(d2.options).some(e3 => e3.value === D2) && (d2.value = D2);
    let C3 = ctx.by(n3, x3 ? [...u3] : [S3], _2.value),
      w3 = ctx.xy(C3.indices, n3),
      T3 = new Set(C3.indices),
      z3 = ctx.Cy(k2 === `calculated` ? A2 : {
        ...A2,
        calculation: null
      }),
      B3 = /* @__PURE__ */new Map();
    for (let e3 of C3.indices) B3.set(e3, {
      generators: [],
      loads: [],
      shunts: []
    });
    for (let e3 of n3.generators) B3.get(e3.bus)?.generators?.push(e3);
    for (let e3 of n3.loads) B3.get(e3.bus)?.loads?.push(e3);
    for (let e3 of n3.shunts) B3.get(e3.bus)?.shunts?.push(e3);
    let W3 = e3 => {
        n3.buses[e3];
        let t4 = Math.min(3, B3.get(e3)?.generators.length ?? 0) + Math.min(3, B3.get(e3)?.loads.length ?? 0),
          r4 = t4 ? t4 * 34 + 18 : 0,
          i4 = Math.min(3, B3.get(e3)?.shunts.length ?? 0),
          a3 = i4 ? i4 * 40 + 20 : 0;
        return Math.max(220, r4, a3);
      },
      G2 = A2.lastCalculation,
      K2 = k2 === `calculated` && A2.calculation ? `${A2.calculation.method} \xB7 ${ctx.Vo(A2.calculation)} \xB7 ${A2.calculation.physicsCoverage}${A2.calculation.method === `LOSSLESS_DC` ? ` \xB7 Vm \xE7\xF6z\xFClmez` : ``}` : k2 === `calculated` ? `uyumlu hesap yok` : `${V2(A2)}`,
      q2 = n3.buses.filter(e3 => e3.source && e3.baseKv !== null && e3.baseKv <= 36).length;
    a2.replaceChildren(ctx.Q(`span`, `ga-psse-status-item`, `bara ${n3.buses.filter(e3 => e3.source).length} \xB7 filtre ${u3.size} \xB7 g\xF6r\xFCn\xFCr ${C3.indices.length}`), ctx.Q(`span`, `ga-psse-status-item`, `dal/sarg\u0131 ${C3.branches.length} \xB7 sonu\xE7 ${K2}`), ctx.Q(`span`, `ga-psse-status-item`, `\u226436 kV ${p2.checked ? `a\xE7\u0131k` : `kapal\u0131`} (${q2})`));
    let ee2 = v3 >= 0 && !n3.buses[v3].source;
    o2.textContent = `TM: ${x3?.name ?? `kaynak TM e\u015Fle\u015Fmesi yok; yaln\u0131z se\xE7ili bara`} \xB7 Odak: ${ctx.fv(n3.buses[S3], r3, M2)} (${n3.buses[S3].connectionKey}) \xB7 ${ctx.bv(n3.buses[S3].baseKv)} \xB7 senaryo ${A2.scenario.hash.slice(0, 12)} (${A2.scenario.operations.length} i\u015Flem) \xB7 ${C3.omittedBuses || C3.omittedBranches ? `g\xF6r\xFCn\xFCr s\u0131n\u0131r ${C3.omittedBuses} bara / ${C3.omittedBranches} dal-sarg\u0131 g\xF6sterilmiyor` : `se\xE7ili TM baralar\u0131, ba\u011Fl\u0131 ekipman ve d\u0131\u015F hat fiderleri g\xF6steriliyor`} \xB7 ${ctx.Ev(A2)}${ee2 ? ` \xB7 y\u0131ld\u0131z aramas\u0131 fiziksel sarg\u0131 baras\u0131na ta\u015F\u0131nd\u0131` : ``}${G2 && G2.status !== `CONVERGED` ? ` \xB7 son hesap ${G2.status}, renk katman\u0131na al\u0131nmad\u0131` : ``}.`, o2.title = o2.textContent, s2.replaceChildren(H2(`Gerilim d\xFCzeyi`, `400 \xB7 220 \xB7 154 \xB7 66 \xB7 \u226436 kV \xB7 bilinmiyor`, `palette`), H2(k2 === `calculated` ? `Hesap y\xFCklemesi` : `Kaynak ak\u0131\u015F\u0131`, k2 === `calculated` ? `<80% \xB7 80\u2013100% \xB7 \u2265100% \xB7 bilinmiyor` : `Kaynak katman\u0131nda dal ak\u0131\u015F\u0131 yok`, k2 === `calculated` ? `loading` : `missing`), H2(`Sembol / durum`, `Hat \xB7 2W/3W trafo \xB7 G/L/\u015E\xF6nt \xB7 kesik = devre d\u0131\u015F\u0131`, `missing`));
    let J2 = ctx.sv(`svg`, {
        viewBox: `0 0 ${ctx.my} ${ctx.hy}`,
        role: `img`,
        "aria-label": `PSS/E tek hat \u015Femas\u0131; bara, hat, iki ve \xFC\xE7 sarg\u0131l\u0131 trafo, jenerat\xF6r ve y\xFCk sembolleri`,
        class: `ga-psse-sld-svg`
      }),
      te2 = z3.branches,
      ne2 = /* @__PURE__ */new Map(),
      re2 = /* @__PURE__ */new Map();
    for (let e3 of C3.branches) if (e3.kind !== `three-winding-leg`) {
      let t4 = [e3.from, e3.to].sort((e4, t5) => e4 - t5).join(`:`);
      (ne2.get(t4) ?? (ne2.set(t4, []), ne2.get(t4))).push(e3);
    }
    for (let e3 of ne2.values()) e3.sort((e4, t4) => e4.id.localeCompare(t4.id));
    for (let e3 of C3.three) {
      let t4 = [...e3.terminals].sort((e4, t5) => e4 - t5).join(`:`);
      (re2.get(t4) ?? (re2.set(t4, []), re2.get(t4))).push(e3);
    }
    for (let e3 of re2.values()) e3.sort((e4, t4) => e4.sourceEquipmentId.localeCompare(t4.sourceEquipmentId));
    for (let t4 of C3.branches) {
      if (t4.kind === `three-winding-leg` || !T3.has(t4.from) || !T3.has(t4.to)) continue;
      let r4 = w3.get(t4.from),
        i4 = w3.get(t4.to),
        a3 = ne2.get([t4.from, t4.to].sort((e3, t5) => e3 - t5).join(`:`)),
        o3 = (a3.indexOf(t4) - (a3.length - 1) / 2) * 15,
        s3 = i4.x >= r4.x ? 1 : -1,
        c3 = r4.x + s3 * W3(t4.from) / 2,
        l3 = i4.x - s3 * W3(t4.to) / 2,
        u4 = (c3 + l3) / 2 + o3,
        d3 = (r4.y + i4.y) / 2,
        f3 = te2.get(t4.id),
        p3 = k2 === `calculated` ? ctx.Ov(f3?.loadingFromPct ?? f3?.loadingToPct) : ctx.vy(n3.buses[t4.from].baseKv, e2),
        m3 = ctx.sv(`g`, {
          class: `ga-sld-branch ${t4.status === 0 ? `is-out` : ``}`,
          tabindex: `0`,
          role: `button`,
          "aria-label": `${t4.id} ${t4.terminalFrom} to ${t4.terminalTo}`,
          "data-from-bus-id": n3.buses[t4.from].id,
          "data-to-bus-id": n3.buses[t4.to].id
        }),
        h3 = ctx.sv(`path`, {
          d: `M ${c3} ${r4.y} H ${u4} V ${i4.y} H ${l3}`,
          fill: `none`,
          stroke: p3,
          class: `ga-sld-line ${t4.status === 0 ? `is-out` : ``}`,
          "data-from-bus-id": n3.buses[t4.from].id,
          "data-to-bus-id": n3.buses[t4.to].id,
          "data-port-from-x": String(c3),
          "data-port-from-y": String(r4.y),
          "data-port-to-x": String(l3),
          "data-port-to-y": String(i4.y)
        });
      m3.append(h3), t4.kind === `transformer` && ctx.ah(m3, `transformer2w`, u4, d3, p3).setAttribute(`transform`, `translate(${u4} ${d3}) rotate(90)`);
      let g3 = ctx.sv(`text`, {
        x: String(u4),
        y: String(d3 - 13),
        class: `ga-sld-ckt-label`
      });
      g3.textContent = `ckt ${t4.windingId}`, m3.append(g3);
      let _3 = ctx.sv(`title`);
      _3.textContent = `${t4.kind === `transformer` ? `2 sarg\u0131l\u0131 trafo` : `Hat`} \xB7 ${t4.id} \xB7 ckt ${t4.windingId} \xB7 ${t4.terminalFrom} \u2192 ${t4.terminalTo} \xB7 P ${ctx.ov(f3?.pFromMw)} / ${ctx.ov(f3?.pToMw)} MW \xB7 Q ${ctx.ov(f3?.qFromMvar)} / ${ctx.ov(f3?.qToMvar)} Mvar \xB7 S ${ctx.ov(f3?.sFromMva)} / ${ctx.ov(f3?.sToMva)} MVA \xB7 I ${ctx.ov(f3?.iFromA, 1)} / ${ctx.ov(f3?.iToA, 1)} A \xB7 y\xFCk ${ctx.ov(f3?.loadingFromPct, 1)} / ${ctx.ov(f3?.loadingToPct, 1)}% \xB7 ${t4.status === 1 ? `serviste` : `devre d\u0131\u015F\u0131`}`, m3.append(_3);
      let v4 = () => R2(t4);
      m3.addEventListener(`click`, v4), m3.addEventListener(`keydown`, e3 => {
        (e3.key === `Enter` || e3.key === ` `) && (e3.preventDefault(), v4());
      }), J2.append(m3);
    }
    let ie2 = C3.branches.filter(e3 => e3.kind !== `three-winding-leg` && T3.has(e3.from) !== T3.has(e3.to));
    for (let t4 of ie2) {
      let i4 = T3.has(t4.from) ? t4.from : t4.to,
        a3 = i4 === t4.from ? t4.to : t4.from,
        o3 = w3.get(i4),
        s3 = ie2.filter(e3 => e3.from === i4 || e3.to === i4),
        c3 = o3.x + (s3.indexOf(t4) - (s3.length - 1) / 2) * Math.min(34, 200 / Math.max(1, s3.length - 1)),
        l3 = o3.y - 92,
        u4 = te2.get(t4.id),
        d3 = ctx.vy(n3.buses[i4].baseKv, e2),
        f3 = ctx.sv(`g`, {
          class: `ga-sld-feeder`,
          "data-source-branch": t4.id
        }),
        p3 = ctx.sv(`path`, {
          d: `M ${c3} ${o3.y} V ${l3}`,
          class: `ga-sld-line ${t4.status === 0 ? `is-out` : ``}`,
          stroke: d3
        }),
        m3 = ctx.sv(`text`, {
          x: String(c3),
          y: String(l3 - 9),
          class: `ga-sld-ckt-label`,
          transform: `rotate(-35 ${c3} ${l3 - 9})`
        });
      if (m3.textContent = `${ctx.fv(n3.buses[a3], r3, M2).slice(0, 22)} \xB7 ${t4.windingId}`, f3.append(p3, m3), u4) {
        let e3 = ctx.sv(`text`, {
            x: String(c3 + 7),
            y: String(l3 + 25),
            class: `ga-sld-leg-label`
          }),
          n4 = i4 === t4.from ? u4.pFromMw : u4.pToMw,
          r4 = i4 === t4.from ? u4.qFromMvar : u4.qToMvar;
        e3.textContent = `${(n4 ?? 0) >= 0 ? `\u2191` : `\u2193`} ${ctx.ov(n4, 1)} MW / ${ctx.ov(r4, 1)} MVAr`, f3.append(e3);
      }
      f3.addEventListener(`click`, () => R2(t4)), J2.append(f3);
    }
    for (let t4 of C3.three) {
      let r4 = N2(t4.sourceEquipmentId),
        i4 = String(r4?.fields.ckt ?? `\u2014`),
        a3 = t4.terminals.filter(e3 => T3.has(e3)).map(e3 => w3.get(e3)).filter(Boolean);
      if (!a3.length) continue;
      let o3 = a3.reduce((e3, t5) => e3 + t5.x, 0) / a3.length,
        s3 = a3.reduce((e3, t5) => e3 + t5.y, 0) / a3.length;
      if (a3.some(e3 => Math.hypot(e3.x - o3, e3.y - s3) < 70)) {
        let e3 = Array.from({
          length: 12
        }, (e4, t5) => ({
          x: o3 + Math.cos(t5 * Math.PI / 6) * 74,
          y: s3 + Math.sin(t5 * Math.PI / 6) * 74
        })).sort((e4, t5) => Math.min(...a3.map(e5 => Math.hypot(e5.x - t5.x, e5.y - t5.y))) - Math.min(...a3.map(t6 => Math.hypot(t6.x - e4.x, t6.y - e4.y))))[0];
        o3 = e3.x, s3 = e3.y;
      }
      let c3 = [...t4.terminals].sort((e3, t5) => e3 - t5).join(`:`),
        l3 = re2.get(c3) ?? [],
        u4 = (l3.indexOf(t4) - (l3.length - 1) / 2) * 38;
      o3 += u4, s3 -= u4 * 0.35;
      for (let r5 of t4.legs) {
        let a4 = n3.buses[r5.from].source ? r5.from : r5.to;
        if (!T3.has(a4)) continue;
        let c4 = w3.get(a4),
          l4 = o3 >= c4.x ? 1 : -1,
          u5 = c4.x + l4 * W3(a4) / 2,
          d4 = Number(r5.windingId),
          f4 = d4 === 3 ? o3 + 26 : o3,
          p4 = d4 === 1 ? s3 - 18 : d4 === 2 ? s3 + 18 : s3,
          m4 = (u5 + f4) / 2 + (d4 - 2) * 8,
          h3 = te2.get(r5.id),
          g3 = k2 === `calculated` ? ctx.Ov(h3?.loadingFromPct ?? h3?.loadingToPct) : ctx.vy(n3.buses[a4].baseKv, e2),
          _3 = ctx.sv(`path`, {
            d: `M ${u5} ${c4.y} H ${m4} V ${p4} H ${f4}`,
            fill: `none`,
            stroke: g3,
            class: `ga-sld-line ${r5.status === 0 ? `is-out` : ``}`,
            "data-port-bus-id": n3.buses[a4].id,
            "data-port-x": String(u5),
            "data-port-y": String(c4.y),
            "data-port-hub-x": String(f4),
            "data-port-hub-y": String(p4),
            "data-hub-center-x": String(o3),
            "data-hub-center-y": String(s3),
            "data-winding-id": String(d4)
          });
        J2.append(_3);
        let v4 = ctx.sv(`text`, {
          x: String(m4),
          y: String((c4.y + s3) / 2 - 6),
          class: `ga-sld-leg-label`
        });
        v4.textContent = `w${r5.windingId} \xB7 ckt ${i4}`;
        let y3 = ctx.sv(`title`);
        y3.textContent = `\xDC\xE7 sarg\u0131l\u0131 trafo ${t4.sourceEquipmentId} \xB7 ckt ${i4} \xB7 kaynak sarg\u0131 ${r5.windingId} \xB7 ${r5.terminalFrom} \u2192 ${r5.terminalTo} \xB7 P ${ctx.ov(h3?.pFromMw)} / ${ctx.ov(h3?.pToMw)} MW \xB7 Q ${ctx.ov(h3?.qFromMvar)} / ${ctx.ov(h3?.qToMvar)} Mvar \xB7 S ${ctx.ov(h3?.sFromMva)} / ${ctx.ov(h3?.sToMva)} MVA \xB7 I ${ctx.ov(h3?.iFromA, 1)} / ${ctx.ov(h3?.iToA, 1)} A \xB7 y\xFCk ${ctx.ov(h3?.loadingFromPct, 1)} / ${ctx.ov(h3?.loadingToPct, 1)}%`, v4.append(y3), J2.append(v4);
      }
      let d3 = ctx.sv(`g`, {
        class: `ga-sld-three-winding`,
        tabindex: `0`,
        role: `button`,
        "aria-label": `\xDC\xE7 sarg\u0131l\u0131 trafo ${r4?.id ?? t4.sourceEquipmentId} \xB7 ckt ${i4}`
      });
      ctx.ah(d3, `transformer3w`, o3, s3, ctx.vy(n3.buses[t4.terminals[0]]?.baseKv ?? null, e2));
      let f3 = ctx.sv(`text`, {
        x: String(o3),
        y: String(s3 + 34),
        class: `ga-sld-ckt-label`
      });
      f3.textContent = `3W \xB7 ckt ${i4}`, d3.append(f3);
      let p3 = ctx.sv(`title`);
      p3.textContent = `\xDC\xE7 sarg\u0131l\u0131 PSS/E transformer ${t4.sourceEquipmentId} \xB7 ckt ${i4} \xB7 \xFC\xE7 normalize kaynak sarg\u0131s\u0131 \xB7 i\xE7 y\u0131ld\u0131z d\xFC\u011F\xFCm\xFC busbar olarak g\xF6sterilmez`, d3.append(p3);
      let m3 = () => E2.open(r4, `\xDC\xE7 sarg\u0131l\u0131 trafo \xB7 ${t4.sourceEquipmentId}`, {
        threeWindingLegs: t4.legs,
        internalStarBuses: n3.buses.filter((e3, n4) => !e3.source && t4.legs.some(e4 => e4.from === n4 || e4.to === n4)),
        scenarioHash: A2.scenario.hash
      });
      d3.addEventListener(`click`, m3), d3.addEventListener(`keydown`, e3 => {
        (e3.key === `Enter` || e3.key === ` `) && (e3.preventDefault(), m3());
      }), J2.append(d3);
    }
    for (let t4 of C3.indices) {
      let i4 = n3.buses[t4],
        a3 = w3.get(t4),
        o3 = ctx.Sv(i4, r3, M2),
        s3 = z3.buses.get(i4.connectionKey),
        c3 = k2 === `calculated` ? s3?.vmPu : o3,
        l3 = ctx.vy(i4.baseKv, e2),
        u4 = W3(t4),
        d3 = ctx.bv(i4.baseKv),
        f3 = ctx.sv(`g`, {
          class: `ga-sld-bus ${i4.status === 0 ? `is-out` : ``}`,
          tabindex: `0`,
          role: `button`,
          "aria-label": `Bara ${ctx.fv(i4, r3, M2)} \xB7 ${d3}`,
          "data-bus-id": i4.id
        }),
        p3 = ctx.sv(`line`, {
          x1: String(a3.x - u4 / 2),
          y1: String(a3.y),
          x2: String(a3.x + u4 / 2),
          y2: String(a3.y),
          stroke: l3,
          class: `ga-sld-busbar ${i4.status === 0 ? `is-out` : ``}`,
          "data-bus-id": i4.id
        });
      f3.append(p3);
      let m3 = ctx.sv(`text`, {
        x: String(a3.x),
        y: String(a3.y - 16),
        class: `ga-sld-bus-label`
      });
      m3.textContent = `${ctx.fv(i4, r3, M2).slice(0, 26)} \xB7 ${i4.externalNumber ?? i4.id}`;
      let h3 = ctx.sv(`text`, {
        x: String(a3.x),
        y: String(a3.y + 23),
        class: `ga-sld-kv`
      });
      h3.textContent = `${d3} \xB7 Vm ${ctx.ov(c3, 3)} pu${k2 === `calculated` ? ` \xB7 \u03B4 ${ctx.ov(s3?.vaDeg, 2)}\xB0` : ``}`;
      let g3 = ctx.sv(`title`);
      g3.textContent = `${i4.id} \xB7 ${i4.connectionKey} \xB7 ${ctx.fv(i4, r3, M2)} \xB7 ${d3} \xB7 ${k2 === `calculated` ? `GA_PSSE_CALCULATED vm=${ctx.ov(s3?.vmPu, 5)} pu / angle=${ctx.ov(s3?.vaDeg, 4)}\xB0` : `${ctx.Tv(A2)} vm=${ctx.ov(o3, 5)} pu / angle=${ctx.ov(ctx.Cv(i4, r3, M2), 4)}\xB0`} \xB7 ${i4.status === 1 ? `serviste` : `devre d\u0131\u015F\u0131`}`, f3.append(m3, h3, g3), f3.addEventListener(`click`, () => L2(t4, n3, z3)), f3.addEventListener(`keydown`, e3 => {
        (e3.key === `Enter` || e3.key === ` `) && (e3.preventDefault(), L2(t4, n3, z3));
      }), J2.append(f3);
      let _3 = B3.get(t4),
        v4 = [];
      for (let e3 of _3.generators.slice(0, 3)) v4.push([`G`, `generator`, N2(e3.sourceEquipmentId), v4.length]);
      for (let e3 of _3.loads.slice(0, 3)) v4.push([`L`, `load`, N2(e3.sourceEquipmentId), v4.length]);
      let y3 = (v4.length - 1) * 34 / 2;
      v4.forEach(([e3, t5, n4, r4]) => {
        let o4 = n4?.status === 0,
          s4 = a3.x - y3 + Number(r4) * 34,
          c4 = a3.y + 61,
          l4 = a3.y + 3.5,
          u5 = c4 - (t5 === `generator` ? 13 : 14),
          d4 = ctx.sv(`path`, {
            d: `M ${s4} ${l4} V ${u5}`,
            fill: `none`,
            stroke: t5 === `generator` ? `#48bd8f` : `#e1a764`,
            class: `ga-sld-line ga-sld-device-connector ${o4 ? `is-out` : ``}`,
            "data-bus-id": i4.id,
            "data-device-id": n4?.id ?? ``,
            "data-device-kind": t5,
            "data-port-x": String(s4),
            "data-port-from-y": String(l4),
            "data-port-to-y": String(u5)
          });
        J2.append(d4);
        let f4 = ctx.ah(J2, t5, s4, c4, t5 === `generator` ? `#48bd8f` : `#e1a764`);
        f4.dataset.status = o4 ? `out-of-service` : `in-service`, f4.dataset.deviceId = n4?.id ?? ``, f4.dataset.deviceKind = t5, f4.classList.add(`ga-sld-device`), o4 && f4.classList.add(`is-out`), f4.setAttribute(`tabindex`, `0`), f4.setAttribute(`role`, `button`), f4.setAttribute(`aria-label`, `${t5 === `generator` ? `Jenerat\xF6r` : `Y\xFCk`} ${n4?.id ?? ``}`);
        let p4 = ctx.sv(`text`, {
          x: `0`,
          y: `24`,
          class: `ga-sld-device-label`
        });
        p4.textContent = `${e3} \xB7 ${n4?.fields.ireg && t5 === `generator` ? `uzak reg` : ``}`;
        let m4 = t5 === `generator` ? z3.generators.get(n4?.id ?? ``) : null,
          h4 = t5 === `generator` ? n4?.operating.pg?.value : n4?.operating.pl?.value,
          g4 = t5 === `generator` ? n4?.operating.qg?.value : n4?.operating.ql?.value,
          _4 = ctx.sv(`title`);
        _4.textContent = `${t5 === `generator` ? `Jenerat\xF6r` : `Y\xFCk`} ${n4?.name || n4?.id} \xB7 ${k2 === `calculated` ? `P=${ctx.ov(t5 === `generator` ? m4?.pMw : null)} MW / Q=${ctx.ov(t5 === `generator` ? m4?.qMvar : null)} Mvar` : `${ctx.Tv(A2)} P=${ctx.ov(typeof h4 == `number` ? h4 : null)} MW / Q=${ctx.ov(typeof g4 == `number` ? g4 : null)} Mvar`} \xB7 ${o4 ? `devre d\u0131\u015F\u0131` : `serviste`}`, f4.append(_4, p4), f4.addEventListener(`click`, e4 => {
          e4.stopPropagation(), E2.open(n4, `${t5 === `generator` ? `Jenerat\xF6r` : `Y\xFCk`} \xB7 ${n4?.id ?? ``}`, {
            sourceSaved: {
              pMw: h4,
              qMvar: g4
            },
            calculated: m4,
            scenarioHash: A2.scenario.hash
          });
        });
      });
      for (let e3 of _3.shunts.slice(0, 3)) {
        let t5 = N2(e3.sourceEquipmentId),
          n4 = a3.x + (_3.shunts.indexOf(e3) - (Math.min(3, _3.shunts.length) - 1) / 2) * 40,
          r4 = a3.y + 120,
          o4 = a3.y + 3.5,
          s4 = r4 - 18,
          c4 = ctx.sv(`path`, {
            d: `M ${n4} ${o4} V ${s4}`,
            fill: `none`,
            stroke: `#c69b55`,
            class: `ga-sld-line ga-sld-device-connector ${e3.status === 0 ? `is-out` : ``}`,
            "data-bus-id": i4.id,
            "data-device-id": t5?.id ?? e3.id,
            "data-device-kind": `shunt`,
            "data-port-x": String(n4),
            "data-port-from-y": String(o4),
            "data-port-to-y": String(s4)
          });
        J2.append(c4);
        let l4 = ctx.ah(J2, `reactive-equivalent`, n4, r4, `#c69b55`);
        l4.dataset.deviceId = t5?.id ?? e3.id, l4.classList.add(`ga-sld-device`), l4.dataset.deviceId = t5?.id ?? e3.id, l4.dataset.deviceKind = `shunt`, e3.status === 0 && l4.classList.add(`is-out`), l4.setAttribute(`tabindex`, `0`), l4.setAttribute(`role`, `button`), l4.setAttribute(`aria-label`, `\u015E\xF6nt ${t5?.id ?? e3.id}`);
        let u5 = ctx.sv(`text`, {
          x: `0`,
          y: `25`,
          class: `ga-sld-device-label`
        });
        u5.textContent = `\u015E\xF6nt \xB7 ${ctx.ov(e3.bMvar, 1)} Mvar`;
        let d4 = ctx.sv(`title`);
        d4.textContent = `Kaynak \u015F\xF6nt ${t5?.name || t5?.id} \xB7 ${e3.selection === `INITIAL_SWITCHED` ? `ba\u015Flang\u0131\xE7 kademesi sabit tutuldu` : `sabit \u015F\xF6nt`} \xB7 G=${ctx.ov(e3.gMw, 3)} MW \xB7 B=${ctx.ov(e3.bMvar, 3)} Mvar \xB7 kaynak kay\u0131t`, l4.append(d4, u5), l4.addEventListener(`click`, n5 => {
          n5.stopPropagation(), E2.open(t5, `\u015E\xF6nt \xB7 ${e3.id}`, {
            normalizedShunt: e3,
            scenarioHash: A2.scenario.hash
          });
        });
      }
    }
    c2.replaceChildren(J2, s2);
    let ae2 = {
        width: Math.max(360, c2.clientWidth || 1400),
        height: Math.max(300, c2.clientHeight || 620)
      },
      oe2 = {
        "ga-sld-bus-label": 12,
        "ga-sld-kv": 10,
        "ga-sld-leg-label": 9,
        "ga-sld-ckt-label": 9,
        "ga-sld-device-label": 9
      },
      se2 = J2.getBBox();
    for (let e3 = 0; e3 < 2; e3++) {
      let e4 = se2.width + 96,
        t4 = se2.height + 96,
        n4 = Math.min(ae2.width / e4, ae2.height / t4),
        r4 = Math.min(3, Math.max(1, 1 / n4));
      for (let e5 of Array.from(J2.querySelectorAll(`text`))) {
        let t5 = Array.from(e5.classList).find(e6 => e6 in oe2);
        t5 && (e5.style.fontSize = `${((oe2[t5] ?? 9) * r4).toFixed(2)}px`);
      }
      se2 = J2.getBBox();
    }
    let ce2 = (se2.width + 96) / O2,
      le2 = (se2.height + 96) / O2;
    J2.setAttribute(`viewBox`, `${se2.x + se2.width / 2 - ce2 / 2} ${se2.y + se2.height / 2 - le2 / 2} ${ce2} ${le2}`), J2.dataset.stationId = x3?.id ?? ``, l2.replaceChildren(U2(C3.branches, n3, z3));
  }
  function B2() {
    let n3 = c2.querySelector(`svg.ga-psse-sld-svg`);
    if (!n3 || !A2) return;
    let r3 = n3.viewBox.baseVal,
      i3 = Math.max(1, r3.width),
      a3 = Math.max(1, r3.height),
      o3 = Math.max(720, Math.round(1280 * a3 / i3)),
      s3 = n3.cloneNode(true),
      l3 = getComputedStyle(t2),
      u3 = l3.getPropertyValue(`--panel`).trim() || `#102033`,
      d3 = l3.getPropertyValue(`--text`).trim() || `#e8eef5`,
      f3 = l3.getPropertyValue(`--muted`).trim() || `#a9bac8`,
      p3 = l3.getPropertyValue(`--accent`).trim() || `#55b7d2`,
      m3 = l3.getPropertyValue(`--edge`).trim() || `#33465a`;
    s3.setAttribute(`xmlns`, `http://www.w3.org/2000/svg`), s3.setAttribute(`width`, `1280`), s3.setAttribute(`height`, String(o3)), s3.setAttribute(`style`, `--panel:${u3};--sld-paper:${u3};--text:${d3};--muted:${f3};--accent:${p3};--edge:${m3};font-family:system-ui,Segoe UI,sans-serif`);
    let h3 = ctx.sv(`rect`, {
        x: String(r3.x - i3),
        y: String(r3.y - a3),
        width: String(i3 * 3),
        height: String(a3 * 3),
        fill: u3
      }),
      g3 = ctx.sv(`metadata`);
    g3.textContent = JSON.stringify({
      schema: `ga.psse-sld-export.v1`,
      source: {
        format: A2.model.source.format,
        sha256: A2.model.source.sha256
      },
      scenarioHash: A2.scenario.hash,
      layer: k2 === `saved` ? ctx.Tv(A2) : `GA_PSSE_CALCULATED`,
      calculation: A2.calculation ? {
        method: A2.calculation.method,
        status: A2.calculation.status,
        publicationStatus: ctx.Vo(A2.calculation),
        physicsCoverage: A2.calculation.physicsCoverage
      } : null,
      description: `PSS/E bus-branch SLD; no node-breaker terminals are inferred.`
    });
    let _3 = ctx.sv(`style`);
    _3.textContent = `.ga-sld-busbar{stroke-width:7;stroke-linecap:round}.ga-sld-busbar.is-out,.ga-sld-line.is-out,.ga-sld-device.is-out{stroke-dasharray:5 4;opacity:.58}.ga-sld-bus-label{fill:${d3};font:12px system-ui,sans-serif;text-anchor:middle;paint-order:stroke;stroke:${u3};stroke-width:3px;stroke-linejoin:round}.ga-sld-kv,.ga-sld-leg-label{fill:${f3};font:10px system-ui,sans-serif;text-anchor:middle;paint-order:stroke;stroke:${u3};stroke-width:3px}.ga-sld-line{stroke-width:2;fill:none}.ga-sld-ckt-label,.ga-sld-device-label{fill:${d3};font:9px system-ui,sans-serif;text-anchor:middle;paint-order:stroke;stroke:${u3};stroke-width:3px}.ga-sld-xfmr-coil{fill:${u3};stroke:${p3};stroke-width:2}.ga-sld-3w-coil{fill:${u3};stroke:#c6a45b;stroke-width:2}.ga-sld-device{stroke:${d3};stroke-width:1.3}.ga-sld-device-connector{stroke-width:1.7}.ga-sld-three-winding{cursor:pointer}.ga-sld-export-legend{font:10px system-ui,sans-serif;fill:${d3}}`;
    let v3 = Math.min(320, i3 * 0.3) / 320,
      y3 = 320 * v3,
      b3 = ctx.sv(`g`, {
        class: `ga-sld-export-legend`,
        transform: `translate(${r3.x + i3 - y3 - Math.max(10, i3 * 0.012)} ${r3.y + Math.max(10, i3 * 0.012)}) scale(${v3.toFixed(3)})`
      }),
      x3 = ctx.sv(`rect`, {
        x: `0`,
        y: `0`,
        width: `320`,
        height: `104`,
        rx: `6`,
        fill: u3,
        stroke: m3,
        "stroke-width": `1`
      });
    b3.append(x3);
    let S3 = ctx.sv(`text`, {
      x: `10`,
      y: `16`
    });
    S3.textContent = `Gerilim taban\u0131 \xB7 PSS/E kaynak`, b3.append(S3);
    let C3 = [e2.settings.value.color400, e2.settings.value.color220, e2.settings.value.color154, e2.settings.value.color66, e2.settings.value.colorLow, `#758698`],
      w3 = [`400`, `220`, `154`, `66`, `\u226436`, `bilinmiyor`];
    C3.forEach((e3, t3) => {
      let n4 = 13 + t3 * 42;
      b3.append(ctx.sv(`circle`, {
        cx: String(n4),
        cy: `34`,
        r: `5`,
        fill: e3
      }));
      let r4 = ctx.sv(`text`, {
        x: String(n4),
        y: `49`,
        "text-anchor": `middle`,
        "font-size": `8`
      });
      r4.textContent = w3[t3], b3.append(r4);
    });
    let T3 = ctx.sv(`text`, {
      x: `10`,
      y: `69`
    });
    T3.textContent = k2 === `calculated` ? `Hesap y\xFCklemesi: <80% \xB7 80\u2013100% \xB7 \u2265100% \xB7 bilinmiyor` : `Kaynak katman\u0131: dal P/Q/y\xFCkleme sonucu yok`;
    let E3 = ctx.sv(`text`, {
      x: `10`,
      y: `88`
    });
    E3.textContent = `Kesik \xE7izgi = devre d\u0131\u015F\u0131 \xB7 G/L/\u015E\xF6nt = kaynak ekipman`, b3.append(T3, E3), s3.insertBefore(h3, s3.firstChild), s3.insertBefore(_3, h3.nextSibling), s3.insertBefore(g3, _3.nextSibling), s3.append(b3);
    let D3 = new Blob([new XMLSerializer().serializeToString(s3)], {
        type: `image/svg+xml;charset=utf-8`
      }),
      O3 = URL.createObjectURL(D3),
      j3 = ctx.Q(`a`);
    j3.href = O3, j3.download = `psse-tek-hat-${A2.model.source.sha256.slice(0, 12)}.svg`, j3.click(), ctx.window.setTimeout(() => URL.revokeObjectURL(O3), 1e3);
  }
  function V2(e3) {
    return e3.model.source.format === `SAV` ? `SOURCE_SAVED` : `SOURCE_INPUT`;
  }
  function H2(t3, n3, r3) {
    let i3 = ctx.Q(`div`, `ga-psse-legend-item`);
    i3.append(ctx.Q(`strong`, ``, t3));
    let a3 = ctx.Q(`span`, `ga-psse-legend-chips`),
      o3 = r3 === `voltage` ? [`#a84859`, `#d36b5c`, `#d9a441`, `#4fbf91`, `#48a9c7`, `#8074d4`] : r3 === `loading` ? [`#50b98b`, `#e3a944`, `#e25f66`, `#65788b`] : r3 === `palette` ? [e2.settings.value.color400, e2.settings.value.color220, e2.settings.value.color154, e2.settings.value.color66, e2.settings.value.colorLow, `#758698`] : [`#65788b`];
    for (let e3 of o3) {
      let t4 = ctx.Q(`i`, ``);
      t4.style.backgroundColor = e3, a3.append(t4);
    }
    return i3.append(a3, ctx.Q(`small`, ``, n3)), i3;
  }
  function U2(e3, t3, n3) {
    let r3 = ctx.Q(`div`, ``),
      i3 = ctx.Q(`h3`, ``, `P/Q \xB7 MVA \xB7 ak\u0131m \xB7 y\xFCkleme \xB7 kaynak sarg\u0131 e\u015Flemesi`),
      a3 = ctx.Q(`table`, `ga-table`),
      o3 = ctx.Q(`thead`),
      s3 = ctx.Q(`tr`);
    for (let e4 of [`Dal / kaynak sarg\u0131`, `Tip`, `U\xE7lar`, `Durum`, `P 1/2 MW`, `Q 1/2 Mvar`, `S 1/2 MVA`, `I 1/2 A`, `Y\xFCkleme 1/2 %`, `RATE temeli`]) s3.append(ctx.Q(`th`, ``, e4));
    o3.append(s3);
    let c3 = ctx.Q(`tbody`);
    for (let t4 of e3.slice(0, 140)) {
      let e4 = ctx.Q(`tr`),
        r4 = n3.branches.get(t4.id),
        i4 = t4.kind === `line` ? `Hat` : t4.kind === `transformer` ? `2 sarg\u0131l\u0131 trafo` : `3 sarg\u0131l\u0131 trafo`;
      for (let n4 of [`${t4.sourceEquipmentId} \xB7 w${t4.windingId}`, i4, `${t4.terminalFrom} \u2192 ${t4.terminalTo}`, t4.status === 1 ? `Serviste` : `Devre d\u0131\u015F\u0131`, `${ctx.ov(r4?.pFromMw)} / ${ctx.ov(r4?.pToMw)}`, `${ctx.ov(r4?.qFromMvar)} / ${ctx.ov(r4?.qToMvar)}`, `${ctx.ov(r4?.sFromMva)} / ${ctx.ov(r4?.sToMva)}`, `${ctx.ov(r4?.iFromA, 1)} / ${ctx.ov(r4?.iToA, 1)}`, `${ctx.ov(r4?.loadingFromPct, 1)} / ${ctx.ov(r4?.loadingToPct, 1)}`, t4.ratingBasis]) e4.append(ctx.Q(`td`, ``, n4));
      e4.tabIndex = 0, e4.addEventListener(`click`, () => R2(t4)), e4.addEventListener(`keydown`, e5 => {
        e5.key === `Enter` && R2(t4);
      }), c3.append(e4);
    }
    return a3.append(o3, c3), r3.append(i3, a3, ctx.Q(`p`, `ga-muted`, `G\xF6sterilen ${Math.min(140, e3.length)} dal/sarg\u0131; ${e3.length} g\xF6r\xFCn\xFCr e\u015Fle\u015Fme. 3W sarg\u0131lar kaynak ekipman kimli\u011Fi + windingId ile e\u015Fle\u015Ftirilmi\u015Ftir. P/Q/ak\u0131m/y\xFCkleme s\xFCtunlar\u0131 yaln\u0131z kimli\u011Fi e\u015Fle\u015Fen GA_PSSE_CALCULATED sonucu varsa doldurulur.`)), r3;
  }
  let lastContextKey = "";
  function renderCached(){const key=JSON.stringify([e2.psseNetwork?.modelHash,e2.psseScenario?.hash,e2.psseCalculation?.id,e2.settings.value,c2.clientWidth]);if(key===lastContextKey)return;lastContextKey=key;z2();}
  let v12SldQueued = false,
    W2 = e2.subscribe(() => {
      if (e2.view !== `sld` || v12SldQueued) return;
      v12SldQueued = true;
      ctx.window.requestAnimationFrame(() => {
        v12SldQueued = false;
        renderCached();
      });
    });
  return {
    element: t2,
    render: renderCached,
    dispose: W2
  };
};
}
export const initializers = [

];
