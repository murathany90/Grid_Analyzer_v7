// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.Jv = function Jv(e2, t2 = {}) {
  let n2 = ctx.Q(`section`, `ga-psse-lightning`),
    r2 = ctx.Q(`header`, `ga-psse-lightning-head`),
    i2 = ctx.Q(`strong`, ``, `\u26A1 Elektriksel Sonu\xE7lar`),
    a2 = ctx.Q(`small`),
    o2 = ctx.Q(`div`, `ga-psse-lightning-body`);
  n2.hidden = !t2.embedded, t2.embedded && n2.classList.add(`is-embedded`), n2.setAttribute(`aria-label`, `PSS/E elektriksel sonu\xE7lar`);
  let s2 = `LF`,
    c2 = `source`,
    l2 = `lines`,
    u2 = 0,
    d2 = false,
    f2 = () => {
      n2.hidden = true;
    },
    p2 = ctx.$(`\u2212`, () => {
      o2.hidden = !o2.hidden, p2.textContent = o2.hidden ? `\u25A1` : `\u2212`;
    }, `Paneli k\xFC\xE7\xFClt / geri a\xE7`),
    m2 = ctx.$(`\xD7`, f2, `Sonu\xE7 panelini kapat`);
  r2.append(i2, a2, p2, m2), n2.append(r2, o2);
  let h2 = ctx.Q(`nav`, `ga-psse-lightning-tabs`);
  h2.setAttribute(`aria-label`, `Elektriksel sonu\xE7 sekmeleri`);
  for (let [e3, t3] of [[`LF`, `Y\xFCk Ak\u0131\u015F\u0131`], [`SCENARIOS`, `Senaryolar`]]) {
    let n3 = ctx.$(t3, () => {
      s2 = e3, u2 = 0, ie2();
    });
    n3.dataset.tab = e3, h2.append(n3);
  }
  for (let [e3, t3] of [[`K\u0131s\u0131t (N-1)`, `Bu pakette PSS/E N-1 sonu\xE7 motoru yok.`], [`K\u0131sa Devre`, `Bu pakette PSS/E k\u0131sa devre sonu\xE7 motoru yok; .iec bir k\u0131sa devre sonucu de\u011Fildir.`]]) {
    let n3 = ctx.$(e3, () => {});
    n3.disabled = true, n3.title = t3, h2.append(n3);
  }
  h2.append(h2.querySelector(`[data-tab="SCENARIOS"]`));
  let g2 = ctx.Q(`p`, `ga-psse-lightning-status`),
    _2 = ctx.Q(`p`, `ga-psse-lightning-context`),
    v2 = ctx.Q(`div`, `ga-psse-lightning-tools`),
    y2 = ctx.Q(`select`),
    b2 = ctx.Q(`select`),
    x2 = ctx.Q(`input`),
    S2 = ctx.Q(`div`, `ga-psse-lightning-table-wrap`),
    C2 = ctx.Q(`table`, `ga-table ga-psse-lightning-table`),
    w2 = ctx.Q(`div`, `ga-psse-lightning-pager`);
  g2.setAttribute(`role`, `status`), y2.setAttribute(`aria-label`, `Sonu\xE7 katman\u0131`);
  for (let e3 of ctx.Kv) y2.append(new Option(e3.label, e3.key));
  b2.setAttribute(`aria-label`, `Sonu\xE7 tablosu`), b2.append(new Option(`Hatlar`, `lines`), new Option(`Trafolar`, `transformers`), new Option(`Baralar`, `buses`)), b2.append(new Option(`Jenerat\xF6rler`, `generators`)), x2.type = `search`, x2.placeholder = `Ekipman / TM ad\u0131 ara`, x2.setAttribute(`aria-label`, `Elektriksel sonu\xE7larda ekipman veya TM ad\u0131 ara`), y2.onchange = () => {
    c2 = y2.value, d2 = true, u2 = 0, ie2();
  }, b2.onchange = () => {
    l2 = b2.value, u2 = 0, ie2();
  }, x2.oninput = () => {
    u2 = 0, ie2();
  }, v2.append(y2, b2, x2);
  const v10Metric = ctx.Q("select"),
    v10Rate = ctx.Q("select");
  v10Metric.setAttribute("aria-label", "Metrik");
  for (const [key, label] of [["name", "Ad"], ["p", "P (MW)"], ["q", "Q (MVAr)"], ["loss", "Kay\u0131p P (MW)"], ["loading", "Y\xFCkleme (%)"]]) v10Metric.append(new Option(label, key));
  v10Rate.setAttribute("aria-label", "Y\xFCkleme paydas\u0131");
  for (let idx = 0; idx < 12; idx++) {
    const label = idx < 3 ? `RATE ${["A", "B", "C"][idx]}` : `RATE ${idx + 1}`;
    v10Rate.append(new Option(label, String(idx)));
  }
  v10Metric.onchange = () => {
    v10Sort = {
      key: v10Metric.value,
      desc: v10Metric.value !== "name"
    };
    u2 = 0;
    ie2();
  };
  v10Rate.onchange = () => {
    ctx.window.__GA_PSSE_RATE_INDEX__ = Number(v10Rate.value);
    u2 = 0;
    ie2();
    ctx.document.dispatchEvent(new Event("ga-psse-v10-rate-change"));
  };
  v2.append(v10Metric);
  S2.append(C2);
  let T2 = ctx.Q(`select`);
  T2.setAttribute(`aria-label`, `Trafo sarg\u0131 t\xFCr\xFC`), T2.append(new Option(`T\xFCm trafolar`, `all`), new Option(`2 sarg\u0131l\u0131`, `2w`), new Option(`3 sarg\u0131l\u0131`, `3w`)), T2.onchange = () => {
    u2 = 0, ie2();
  }, v2.append(T2);
  let E2 = ctx.Q(`select`);
  E2.setAttribute(`aria-label`, `Sonu\xE7lar\u0131 s\u0131rala`), E2.append(new Option(`Ad \u2191`, `name-asc`), new Option(`Ad \u2193`, `name-desc`), new Option(`B\xFCy\xFCkl\xFCk \u2193`, `value-desc`)), E2.onchange = () => {
    u2 = 0, ie2();
  }, E2.hidden = true;
  v2.append(E2);
  let D2 = [],
    O2 = [],
    k2 = ctx.$(`CSV`, () => ctx.Os(ctx.As([...O2, [], ...D2]), `GA_PSSE_${l2}_${c2}.csv`, `text/csv;charset=utf-8`)),
    A2 = ctx.$(`XLSX`, () => ctx.qd([{
      name: `Sonuclar`,
      rows: D2
    }, {
      name: `Kaynak`,
      rows: O2
    }], `GA_PSSE_${l2}_${c2}.xlsx`));
  v2.append(k2, A2);
  let j2 = ctx.$(`\u2190`, () => {
      u2--, ie2();
    }, `\xD6nceki sonu\xE7 sayfas\u0131`),
    M2 = ctx.Q(`span`, `ga-muted`),
    N2 = ctx.$(`\u2192`, () => {
      u2++, ie2();
    }, `Sonraki sonu\xE7 sayfas\u0131`);
  w2.append(j2, M2, N2,k2,A2,ctx.$('Hesapla',()=>e2.runPsseCalculation('NR_POLAR')),ctx.$('Analizler',()=>e2.setView('analysis')));
  // Same control order and footer placement as the GA main lightning panel.
  v2.replaceChildren(ctx.ly('Ekipman',b2),ctx.ly('Görünüm',y2),ctx.ly('Metrikler',v10Metric),x2,T2);
  let P2 = ctx.Q(`div`, `ga-psse-lightning-tools`),
    F2 = ctx.Q(`select`);
  F2.setAttribute(`aria-label`, `Senaryo hesap y\xF6ntemi`), F2.append(new Option(`Newton\u2013Raphson`, `NR_POLAR`), new Option(`FDNS`, `FDNS_XB`), new Option(`DC`, `LOSSLESS_DC`)), F2.value = `NR_POLAR`;
  let I2 = false;
  F2.onchange = () => {
    I2 = true;
  };
  let L2 = ctx.$(`Yeniden hesapla`, () => {
      e2.runPsseCalculation(F2.value).catch(t3 => e2.setMessage(t3 instanceof Error ? t3.message : `PSS/E hesab\u0131 tamamlanamad\u0131.`));
    }, `Se\xE7ili PSS/E y\xF6ntemini son kullan\u0131lan y\xF6ntem ayarlar\u0131yla yeniden hesapla`),
    R2 = ctx.$(`T\xFCm i\u015Flemleri geri al`, () => {
      e2.setPsseScenario([]), e2.setMessage(`PSS/E senaryosu baz durumuna d\xF6nd\xFC; NR yeniden hesaplan\u0131yor.`), e2.runPsseCalculation(`NR_POLAR`).catch(t3 => e2.setMessage(t3 instanceof Error ? t3.message : `PSS/E hesab\u0131 tamamlanamad\u0131.`)), ie2();
    }, `Senaryodaki t\xFCm i\u015Flemleri geri al`);
  P2.append(F2, L2, R2);
  let z2 = ctx.Q(`details`, `ga-psse-lightning-provenance`),
    B2 = ctx.Q(`div`);
  z2.append(ctx.Q(`summary`, ``, `Kaynak ve hesap ayr\u0131nt\u0131lar\u0131`), B2), o2.append(h2, g2, _2, v2, P2, S2, w2);
  z2.hidden = true;
  P2.hidden = true;
  function V2(e3) {
    return c2 === `base` ? e3.base : c2 === `scenario` ? e3.scenario : null;
  }
  function H2(e3, t3) {
    return Object.fromEntries(Object.keys(e3).map(n3 => [n3, ctx.zv(e3[n3], t3[n3])]));
  }
  function U2(e3, t3) {
    let n3 = V2(t3),
      r3 = [`Dosya: ${e3.model.source.name}`, `Kaynak: ${ctx.Tv(e3)} \xB7 SHA-256 ${e3.model.source.sha256}`, `Model: ${e3.base.modelHash}`, `Senaryo: ${e3.scenario.hash}`];
    for (let [e4, n4] of [[`Baz`, t3.base], [`Senaryo`, t3.scenario]]) n4 && r3.push(`${e4}: ${n4.source} \xB7 ${n4.method} \xB7 ${ctx.Vo(n4)} \xB7 ${n4.classification} \xB7 fizik ${n4.physicsCoverage} \xB7 iterasyon ${n4.iterations} \xB7 max \u0394P/\u0394Q ${ctx.ov(n4.maxPMismatchPu, 7)}/${ctx.ov(n4.maxQMismatchPu, 7)} pu \xB7 se\xE7enek ${n4.identity.optionsHash}`);
    n3 && r3.push(`G\xF6r\xFCnen hesap: ${n3.identity.id}`), e3.lastCalculation && !e3.calculation && r3.push(`Son hesap yay\u0131mlanm\u0131yor: ${e3.lastCalculation.status} \xB7 ${e3.lastCalculation.classification} \xB7 ${e3.lastCalculation.physicsCoverage}`), B2.replaceChildren(...r3.map(e4 => ctx.Q(`p`, `ga-muted`, e4)));
  }
  function W2(e3) {
    let t3 = ctx.Q(`thead`),
      n3 = ctx.Q(`tr`);
    for (let t4 of e3) n3.append(ctx.Q(`th`, ``, t4));
    return t3.append(n3), t3;
  }
  function G2(e3, t3) {
    let n3 = ctx.Q(`tr`);
    n3.title = t3;
    for (let t4 of e3) n3.append(ctx.Q(`td`, ``, t4));
    return n3;
  }
  function K2(e3) {
    let t3 = Math.max(1, Math.ceil(e3.length / ctx.Gv));
    return u2 = Math.max(0, Math.min(u2, t3 - 1)), j2.disabled = u2 === 0, N2.disabled = u2 === t3 - 1, M2.textContent = `${e3.length.toLocaleString(`tr-TR`)} sonu\xE7 \xB7 ${u2 + 1}/${t3}`, e3.slice(u2 * ctx.Gv, (u2 + 1) * ctx.Gv);
  }
  let v10Sort = {
    key: "name",
    desc: false
  };
  function v10LF(workspace, comparison) {
    const source = c2 === "source",
      diff = c2 === "delta",
      result = c2 === "base" ? comparison.base : c2 === "scenario" ? comparison.scenario : null;
    const baseRows = new Map(comparison.base?.branchResults?.map(r3 => [r3.id, r3]) ?? []),
      scenarioRows = new Map(comparison.scenario?.branchResults?.map(r3 => [r3.id, r3]) ?? []),
      rows = new Map(result?.branchResults?.map(r3 => [r3.id, r3]) ?? []);
    const names = ctx.Lv(workspace.model, workspace.base),
      network = source || c2 === "base" ? workspace.base : workspace.network,
      rawById = new Map(workspace.model.equipment.map(eq => [eq.id, eq]));
    const search = ctx.lv(x2.value),
      rateIndex = ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0,
      ratingLabel = rateIndex < 3 ? ["RATE A", "RATE B", "RATE C"][rateIndex] : `RATE ${rateIndex + 1}`;
    const num = ctx.v10SafeNumber,
      fmt = value => value === null ? "\u2014" : value.toLocaleString("tr-TR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2
      }),
      modelRows = [];
    const branchValue = branch => {
      const r3 = result ? rows.get(branch.id) : null,
        base = baseRows.get(branch.id),
        scenario = scenarioRows.get(branch.id);
      const valid = entry => entry && entry.sourceEquipmentId === branch.sourceEquipmentId && entry.terminalFrom === branch.terminalFrom && entry.terminalTo === branch.terminalTo ? entry : null;
      const a3 = valid(r3),
        b3 = valid(base),
        s3 = valid(scenario),
        select = prop => source ? null : diff ? num(s3?.[prop]) !== null && num(b3?.[prop]) !== null ? s3[prop] - b3[prop] : null : num(a3?.[prop]);
      const loss = source ? null : diff ? ctx.v10Loss(s3) !== null && ctx.v10Loss(b3) !== null ? ctx.v10Loss(s3) - ctx.v10Loss(b3) : null : ctx.v10Loss(a3);
      const load = source ? null : diff ? ctx.v10RatePct(branch, s3, rateIndex) !== null && ctx.v10RatePct(branch, b3, rateIndex) !== null ? ctx.v10RatePct(branch, s3, rateIndex) - ctx.v10RatePct(branch, b3, rateIndex) : null : ctx.v10RatePct(branch, a3, rateIndex);
      return {
        p: select("pFromMw"),
        q: select("qFromMvar"),
        pTo: select("pToMw"),
        loss,
        loading: load
      };
    };
    if (l2 === "lines" || l2 === "transformers") {
      const grouped = l2 === "lines" ? network.branches.filter(br2 => br2.kind === "line" && String(br2.sourceEquipmentId).startsWith("line:")).map(br2 => [br2]) : ctx.Bv(network.branches, "transformers", T2.value);
      for (let group of grouped) {
        const threeWinding = l2 === 'transformers' && group.length === 3;
        if(threeWinding) group=[...group].sort((a,b)=>(network.buses[b.from]?.baseKv??0)-(network.buses[a.from]?.baseKv??0));
        const br2 = group[0],
          from = network.buses[br2.from],
          to2 = network.buses[br2.to];
        const values = group.map(br3 => branchValue(br3));
        const pick = key => {
          const available = values.map(v3 => v3[key]).filter(v3 => v3 !== null);
          return available.length ? key === "loading" ? Math.max(...available) : available[0] : null;
        };
        const flip = l2 === "transformers" && from && to2 && (from.baseKv ?? 0) < (to2.baseKv ?? 0),
          fromBus = from,
          raw = rawById.get(br2.sourceEquipmentId),
          sourceTrafoName = String(raw?.fields?.name ?? raw?.name ?? "").trim(),
          trafoName = sourceTrafoName || "Ads\u0131z trafo",
          stationName = (fromBus ? names.station(fromBus) || names.bus(fromBus) : "\u2014").replace(/\s*\d+(?:[.,]\d+)?\s*kV.*$/i, "").trim(),
          ratio = threeWinding ? group.map(br=>network.buses[br.from]?.baseKv??'?').join('/') : from?.baseKv != null && to2?.baseKv != null ? `${Math.max(from.baseKv,to2.baseKv).toLocaleString("tr-TR", {
            maximumFractionDigits: 1
          })}/${Math.min(from.baseKv,to2.baseKv).toLocaleString("tr-TR", {
            maximumFractionDigits: 1
          })}` : "\u2014";
        const name = l2 === "transformers" ? trafoName : names.branch(br2),
          item = {
            name,
            station: stationName || "\u2014",
            ratio,
            p: threeWinding ? values[0].p : flip ? pick("pTo") : pick("p"),
            q: threeWinding ? values.slice(1).every(v=>v.p!==null)?values.slice(1).reduce((sum,v)=>sum+v.p,0):null : l2 === "transformers" ? flip ? pick("p") : pick("pTo") : pick("q"),
            loss: threeWinding ? values.every(v=>v.loss!==null)?values.reduce((sum,v)=>sum+v.loss,0):null : pick("loss"),
            loading: pick("loading"),
            technical: group.map(br3 => names.branchTitle(br3)).join(" | "),
            status: group.every(br=>br.status===1)?'Serviste':group.some(br=>br.status===1)?'Kısmi servis':'Devre dışı'
          };
        if (search && !ctx.lv(item.name + " " + item.station + " " + item.ratio + " " + item.technical).includes(search)) continue;
        modelRows.push(item);
      }
    } else if (l2 === "buses") {
      const actual = new Map(result?.busResults?.map(r3 => [r3.connectionKey, r3]) ?? []),
        base = new Map(comparison.base?.busResults?.map(r3 => [r3.connectionKey, r3]) ?? []),
        scenario = new Map(comparison.scenario?.busResults?.map(r3 => [r3.connectionKey, r3]) ?? []);
      for (const bus of network.buses.filter(b3 => b3.source)) {
        const a3 = actual.get(bus.connectionKey),
          b3 = base.get(bus.connectionKey),
          s3 = scenario.get(bus.connectionKey);
        const value = key => source ? key === "vmPu" ? ctx.Sv(bus, workspace.model) : key === "vaDeg" ? ctx.Cv(bus, workspace.model) : null : diff ? num(s3?.[key]) !== null && num(b3?.[key]) !== null ? s3[key] - b3[key] : null : num(a3?.[key]);
        const voltage = value("vmPu"),
          item = {
            name: names.bus(bus) + " \xB7 " + (names.station(bus) ?? ""),
            p: voltage === null || bus.baseKv === null ? null : voltage * bus.baseKv,
            q: value("vaDeg"),
            loss: null,
            loading: bus.baseKv,
            status: bus.status === 1 ? "Serviste" : "Devre d\u0131\u015F\u0131",
            technical: names.busTitle(bus)
          };
        if (search && !ctx.lv(item.name + " " + item.technical).includes(search)) continue;
        modelRows.push(item);
      }
    }
    const labels = l2 === "buses" ? ["Bara / TM", "Gerilim (kV)", "A\u00e7\u0131 (\u00b0)", "Durum"] : l2 === "transformers" ? ["TM", "Trafo ad\u0131", "YG/AG (kV)", "YG P (MW)", "AG P (MW)", "Kay\u0131p P (MW)", "Y\xFCk %", "Durum"] : ["Hat \u0130smi", "P (MW)", "Q (MVAr)", "Kay\u0131p P (MW)", "Y\xFCk %", "Durum"];
    const keys = l2 === "buses" ? ["name", "p", "q", "status"] : l2 === "transformers" ? ["station", "name", "ratio", "p", "q", "loss", "loading", "status"] : ["name", "p", "q", "loss", "loading", "status"];
    const sort = v10Sort;
    modelRows.sort((a3, b3) => {
      const x3 = a3[sort.key],
        y3 = b3[sort.key];
      const nullX = x3 === null || x3 === void 0,
        nullY = y3 === null || y3 === void 0;
      if (nullX !== nullY) return nullX ? 1 : -1;
      let order = typeof x3 === "number" && typeof y3 === "number" ? x3 - y3 : String(x3 ?? "").localeCompare(String(y3 ?? ""), "tr", {
        numeric: true
      });
      return (sort.desc ? -1 : 1) * order || a3.name.localeCompare(b3.name, "tr", {
        numeric: true
      });
    });
    D2 = [labels, ...modelRows.map(row => keys.map(key => row[key]))];
    O2 = [["Alan", "De\u011Fer"], ["Katman", c2], ["Y\xFCklenme paydas\u0131", ratingLabel], ["Kaynak SHA-256", workspace.model.source.sha256], ["Fizik kapsam\u0131", result?.physicsCoverage ?? "SOURCE_SAVED"]];
    a2.textContent = c2 === "source" ? "Kaynak" : c2 === "delta" ? "Senaryo \u2212 Baz" : c2 === "scenario" ? "Senaryo" : "Baz";
    _2.textContent = source ? "Kaynak kayd\u0131 \xB7 Ak\u0131\u015F verisi yok" : "GA \xB7 " + (result?.method ?? "") + " \xB7 " + (result?.physicsCoverage ?? "");
    const tablehead = ctx.Q("thead"),
      heading = ctx.Q("tr");
    for (let idx = 0; idx < keys.length; idx++) {
      const key = keys[idx],
        button = ctx.$(`${labels[idx]} ${sort.key === key ? sort.desc ? "\u2193" : "\u2191" : "\u2195"}`, () => {
          sort.desc = sort.key === key ? !sort.desc : key !== "name";
          sort.key = key;
          if (key !== "status") v10Metric.value = key;
          u2 = 0;
          ie2();
        });
      button.classList.add("ga-v10-sort");
      const th2 = ctx.Q("th");
      th2.append(button);
      heading.append(th2);
    }
    tablehead.append(heading);
    const tb = ctx.Q("tbody");
    for (const item of K2(modelRows)) {
      const tr2 = ctx.Q("tr");
      tr2.title = item.technical;
      for (const key of keys) {
        const td2 = ctx.Q("td");
        td2.textContent = ["name", "station", "ratio", "status"].includes(key) ? item[key] : fmt(item[key]);
        if (key === "name" || key === "station") td2.className = "ga-v10-entity-cell";
        tr2.append(td2);
      }
      tb.append(tr2);
    }
    if (!tb.children.length) {
      const tr2 = ctx.Q("tr"),
        td2 = ctx.Q("td", "ga-empty", "Bu filtre i\xE7in kaynakta uygun kay\u0131t yok.");
      td2.colSpan = keys.length;
      tr2.append(td2);
      tb.append(tr2);
    }
    C2.dataset.v12Kind = l2;
    C2.replaceChildren(tablehead, tb);
    k2.disabled = A2.disabled = !modelRows.length;
  }
  function q2(e3, t3) {
    if ([`lines`, `transformers`, `buses`].includes(l2)) {
      v10LF(e3, t3);
      return;
    }
    let n3 = ctx.Lv(e3.model, e3.base),
      r3 = V2(t3),
      i3 = ctx.Wv(r3),
      o3 = ctx.Wv(t3.base),
      s3 = ctx.Wv(t3.scenario),
      u3 = ctx.lv(x2.value),
      d3 = c2 === `source`,
      f3 = c2 === `delta`,
      p3 = d3 || c2 === `base` ? e3.base : e3.network,
      m3 = ctx.Kv.find(e4 => e4.key === c2).label;
    a2.textContent = m3, _2.textContent = d3 ? `${ctx.Tv(e3)} \xB7 Vm/Va ve \xFCretim kaynak kayd\u0131d\u0131r; dal ak\u0131\u015F\u0131 kaynak katman\u0131nda yoktur.` : f3 ? `Fark = Senaryo \u2212 Baz; yaln\u0131z uyumlu hesaplar kar\u015F\u0131la\u015Ft\u0131r\u0131l\u0131r.` : `${m3} \xB7 ${r3.method} \xB7 ${ctx.Vo(r3)} \xB7 ${r3.classification} \xB7 fizik ${r3.physicsCoverage}${r3.method === `LOSSLESS_DC` ? ` \xB7 DC Vm, Q, ak\u0131m ve y\xFCkleme hesaplamaz.` : ``}`;
    let h3 = c2 === `delta` ? [t3.base, t3.scenario] : [r3];
    O2 = [[`Provenans`, `De\u011Fer`], [`Katman`, m3], [`Kaynak dosya`, e3.model.source.name], [`Kaynak SHA-256`, e3.model.source.sha256], [`Model hash`, e3.base.modelHash], [`Senaryo hash`, e3.scenario.hash], [`Kaynak s\u0131n\u0131f\u0131`, d3 ? e3.model.source.format === `SAV` ? `SOURCE_SAVED` : `SOURCE_INPUT` : f3 ? `GA_PSSE_CALCULATED_DIFFERENCE` : r3?.source ?? `UNAVAILABLE`], [`Profil notu`, r3?.method === `LOSSLESS_DC` ? `LOSSLESS_DC Vm, Q, ak\u0131m ve MVA y\xFCkleme \xE7\xF6zmez.` : `Say\u0131sal yak\u0131nsama ile tam fizik kapsam\u0131 ayr\u0131 raporlan\u0131r.`], ...h3.flatMap((e4, t4) => e4 ? [[`Hesap ${t4 + 1}`, JSON.stringify(e4.identity)], [`Kaynak s\u0131n\u0131f\u0131 ${t4 + 1}`, e4.source], [`Y\xF6ntem ${t4 + 1}`, e4.method], [`Numerik durum ${t4 + 1}`, e4.status], [`Yay\u0131mlama durumu ${t4 + 1}`, ctx.Vo(e4)], [`Fizik kapsam ${t4 + 1}`, e4.physicsCoverage], [`Durum ${t4 + 1}`, `${e4.status} \xB7 ${e4.classification} \xB7 ${e4.physicsCoverage}`]] : [])];
    let g3 = [],
      v3,
      y3,
      b3 = new Map(e3.model.equipment.map(e4 => [e4.id, e4])),
      S3 = e4 => e4 == null || !Number.isFinite(e4) ? `` : String(e4),
      w3 = e4 => e4.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi, e5 => ctx.ov(Number(e5), 2)),
      j3 = (e4, t4) => `${S3(e4)} / ${S3(t4)}`;
    if (l2 === `buses`) {
      v3 = [`Bara / TM`, `kV`, f3 ? `\u0394Vm pu` : r3?.method === `LOSSLESS_DC` ? `Vm pu (DC\u2019de \xE7\xF6z\xFClmez)` : `Vm pu`, f3 ? `\u0394Va \xB0` : `Va \xB0`, f3 ? `\u0394P gen MW` : `P gen MW`, f3 ? `\u0394Q gen Mvar` : `Q gen Mvar`, `Kaynak kimli\u011Fi`, `Kaynak alanlar\u0131 ve e\u015Fleme`];
      let t4 = /* @__PURE__ */new Map();
      for (let n4 of e3.base.generators) {
        if (n4.status !== 1) continue;
        let r4 = e3.base.buses[n4.bus].connectionKey,
          i4 = t4.get(r4) ?? {
            p: 0,
            q: 0
          };
        i4.p += n4.pMw, i4.q += n4.qMvar, t4.set(r4, i4);
      }
      g3 = p3.buses.filter(e4 => e4.source).map(r4 => {
        let a3 = d3 ? {
          vmPu: ctx.Sv(r4, e3.model),
          vaDeg: ctx.Cv(r4, e3.model),
          pGenerationMw: t4.get(r4.connectionKey)?.p ?? 0,
          qGenerationMvar: t4.get(r4.connectionKey)?.q ?? 0
        } : i3.bus(r4);
        f3 && (a3 = H2(o3.bus(r4), s3.bus(r4)));
        let c3 = n3.bus(r4),
          l3 = n3.busTitle(r4),
          u4 = [c3, S3(r4.baseKv), S3(a3.vmPu), S3(a3.vaDeg), S3(a3.pGenerationMw), S3(a3.qGenerationMvar), `${r4.id} \xB7 ${r4.sourceEquipmentId ?? ``} \xB7 ${r4.connectionKey}`, JSON.stringify({
            fieldMap: r4.fieldMap,
            source: b3.get(r4.sourceEquipmentId ?? ``) ?? null
          })];
        return {
          name: c3,
          search: l3,
          score: Math.abs(a3.vmPu ?? 0),
          technical: l3,
          cells: u4,
          exportCells: [c3, r4.baseKv, a3.vmPu, a3.vaDeg, a3.pGenerationMw, a3.qGenerationMvar, u4[6], u4[7]],
          display: u4.map((e4, t5) => t5 > 0 && t5 < 6 ? e4 ? ctx.ov(Number(e4), t5 === 2 ? 4 : 2) : `\u2014` : e4)
        };
      });
    } else if (l2 === `generators`) {
      v3 = [`Jenerat\xF6r / TM`, f3 ? `\u0394P MW` : `P MW`, f3 ? `\u0394Q Mvar` : `Q Mvar`, `Q durumu`, `Kaynak kimli\u011Fi`, `Kaynak alanlar\u0131 ve e\u015Fleme`];
      let e4 = e5 => new Map(e5?.generatorResults.map(e6 => [e6.id, e6]) ?? []),
        i4 = e4(r3),
        a3 = e4(t3.base),
        o4 = e4(t3.scenario);
      g3 = p3.generators.map(e5 => {
        let s4 = t4 => {
            let n4 = t4.get(e5.id);
            return n4?.sourceEquipmentId === e5.sourceEquipmentId ? n4 : null;
          },
          c3 = s4(i4),
          l3 = s4(a3),
          u4 = s4(o4),
          p4 = d3 ? e5.pMw : f3 ? ctx.zv(l3?.pMw, u4?.pMw) : c3?.pMw,
          m4 = d3 ? e5.qMvar : f3 ? ctx.zv(t3.base?.method === `LOSSLESS_DC` ? null : l3?.qMvar, t3.scenario?.method === `LOSSLESS_DC` ? null : u4?.qMvar) : r3?.method === `LOSSLESS_DC` ? null : c3?.qMvar,
          h4 = n3.equipment(e5.sourceEquipmentId),
          g4 = `${e5.id} \xB7 ${e5.sourceEquipmentId}`,
          _3 = [h4, S3(p4), S3(m4), d3 ? e5.qControl : f3 ? `\u2014` : c3?.limitState ?? `\u2014`, g4, JSON.stringify({
            fieldMap: e5.fieldMap,
            source: b3.get(e5.sourceEquipmentId) ?? null
          })];
        return {
          name: h4,
          search: g4,
          technical: g4,
          score: Math.abs(m4 ?? 0),
          cells: _3,
          exportCells: [h4, p4, m4, _3[3], g4, _3[5]],
          display: [h4, ctx.ov(p4), ctx.ov(m4), _3[3], g4, `CSV / XLSX`]
        };
      });
    } else {
      v3 = [l2 === `lines` ? `Hat` : `Trafo`, `Tip`, `Durum`, `${f3 ? `\u0394` : ``}P 1 / 2 MW`, `${f3 ? `\u0394` : ``}Q 1 / 2 Mvar`, `${f3 ? `\u0394` : ``}I 1 / 2 A`, `${f3 ? `\u0394` : ``}Y\xFCkleme 1 / 2 %`, `RATE1\u202612 (1/2) / temel`, `Kaynak kimli\u011Fi ve sarg\u0131 ayr\u0131nt\u0131s\u0131`, `Kaynak alanlar\u0131 ve e\u015Fleme`], y3 = [`Ad`, `Tip`, `Durum`, ...[`Sarg\u0131 1`, `Sarg\u0131 2`, `Sarg\u0131 3`].flatMap(e4 => [`P1 MW`, `Q1 Mvar`, `P2 MW`, `Q2 Mvar`, `I1 A`, `I2 A`, `Y\xFCkleme 1 %`, `Y\xFCkleme 2 %`].map(t4 => `${e4} ${t4}`)), `RATE1\u202612 (1/2) / temel`, `Kaynak kimli\u011Fi ve sarg\u0131 ayr\u0131nt\u0131s\u0131`, `Kaynak alanlar\u0131 ve e\u015Fleme`];
      let a3 = new Map(e3.base.branches.map(e4 => [e4.id, e4])),
        c3 = (e4, t4) => {
          let n4 = e4.get(t4.id);
          return n4 && n4.sourceEquipmentId === t4.sourceEquipmentId && n4.terminalFrom === t4.terminalFrom && n4.terminalTo === t4.terminalTo ? n4 : null;
        },
        u4 = new Map(r3?.branchResults.map(e4 => [e4.id, e4]) ?? []),
        m4 = new Map(t3.base?.branchResults.map(e4 => [e4.id, e4]) ?? []),
        h4 = new Map(t3.scenario?.branchResults.map(e4 => [e4.id, e4]) ?? []);
      g3 = ctx.Bv(p3.branches, l2, T2.value).map(e4 => {
        let t4 = e4[0],
          r4 = t4.kind === `three-winding-leg`,
          g4 = b3.get(t4.sourceEquipmentId),
          _3 = g4?.name?.trim(),
          v4 = e4.map(e5 => {
            let t5 = p3.buses[e5.from].source ? p3.buses[e5.from] : p3.buses[e5.to];
            return n3.station(t5) ?? n3.bus(t5);
          }),
          y4 = r4 ? `${_3 && _3 !== t4.sourceEquipmentId ? _3 : v4.join(` / `)} \xB7 3 sarg\u0131l\u0131 trafo` : n3.branch(t4),
          x3 = e4.map(e5 => {
            let t5 = d3 ? ctx.qv() : i3.branch(e5);
            return f3 && (t5 = H2(o3.branch(e5), s3.branch(e5))), {
              branch: e5,
              v: t5
            };
          }),
          C3 = e5 => x3.map(({
            branch: t5,
            v: n4
          }) => `${r4 ? `S${t5.windingId}: ` : ``}${e5(n4)}`).join(` \xB7 `),
          T3 = x3.map(({
            branch: e5
          }) => `${r4 ? `S${e5.windingId}: ` : ``}${e5.ratingsFromSource.map(S3).join(`,`)} / ${e5.ratingsToSource.map(S3).join(`,`)} \xB7 ${e5.ratingBasis}`).join(` \xB7 `),
          E3 = x3.map(({
            branch: e5
          }) => `${n3.branchTitle(e5)} \xB7 ${e5.id} \xB7 sarg\u0131 ${e5.windingId} \xB7 ${e5.terminalFrom} \u2192 ${e5.terminalTo}`).join(` | `),
          D3 = x3.map(({
            branch: e5
          }) => {
            let t5 = e5.status === 1 ? `Serviste` : `Devre d\u0131\u015F\u0131`,
              n4 = a3.get(e5.id)?.status === 1 ? `Serviste` : `Devre d\u0131\u015F\u0131`;
            return `${r4 ? `S${e5.windingId}: ` : ``}${f3 ? `${n4} \u2192 ` : ``}${t5}`;
          }).join(` \xB7 `);
        return {
          name: y4,
          search: E3,
          technical: E3,
          score: Math.max(0, ...x3.flatMap(({
            v: e5
          }) => [Math.abs(e5.loadingFromPct ?? 0), Math.abs(e5.loadingToPct ?? 0)])),
          cells: [y4, r4 ? `3 sarg\u0131l\u0131` : l2 === `transformers` ? `2 sarg\u0131l\u0131` : `2 u\xE7lu`, D3, C3(e5 => j3(e5.pFromMw, e5.pToMw)), C3(e5 => j3(e5.qFromMvar, e5.qToMvar)), C3(e5 => j3(e5.iFromA, e5.iToA)), C3(e5 => j3(e5.loadingFromPct, e5.loadingToPct)), T3, `${t4.sourceEquipmentId} \xB7 ${E3}`, JSON.stringify({
            source: g4 ?? null,
            windings: x3.map(({
              branch: e5
            }) => ({
              id: e5.id,
              windingId: e5.windingId,
              fieldMap: e5.fieldMap,
              ratingsFromSource: e5.ratingsFromSource,
              ratingsToSource: e5.ratingsToSource,
              ratingBasis: e5.ratingBasis,
              calculated: d3 ? null : f3 ? {
                base: c3(m4, e5),
                scenario: c3(h4, e5)
              } : c3(u4, e5)
            }))
          })],
          exportCells: [y4, r4 ? `3 sarg\u0131l\u0131` : l2 === `transformers` ? `2 sarg\u0131l\u0131` : `2 u\xE7lu`, D3, ...Array.from({
            length: 3
          }, (e5, t5) => {
            let n4 = x3[t5]?.v;
            return [n4?.pFromMw, n4?.qFromMvar, n4?.pToMw, n4?.qToMvar, n4?.iFromA, n4?.iToA, n4?.loadingFromPct, n4?.loadingToPct].map(e6 => e6 ?? null);
          }).flat(), T3, `${t4.sourceEquipmentId} \xB7 ${E3}`, JSON.stringify({
            source: g4 ?? null,
            windings: x3.map(({
              branch: e5
            }) => ({
              id: e5.id,
              windingId: e5.windingId,
              fieldMap: e5.fieldMap,
              ratingsFromSource: e5.ratingsFromSource,
              ratingsToSource: e5.ratingsToSource,
              ratingBasis: e5.ratingBasis,
              calculated: d3 ? null : f3 ? {
                base: c3(m4, e5),
                scenario: c3(h4, e5)
              } : c3(u4, e5)
            }))
          })],
          display: [y4, r4 ? `3 sarg\u0131l\u0131` : l2 === `transformers` ? `2 sarg\u0131l\u0131` : `2 u\xE7lu`, D3, ...[C3(e5 => j3(e5.pFromMw, e5.pToMw)), C3(e5 => j3(e5.qFromMvar, e5.qToMvar)), C3(e5 => j3(e5.iFromA, e5.iToA)), C3(e5 => j3(e5.loadingFromPct, e5.loadingToPct))].map(e5 => w3(e5).replace(/(^|: | · ) \/ /g, `$1\u2014 / `).replace(/\/ (?= · |$)/g, `/ \u2014`)), x3.map(({
            branch: e5
          }) => `${r4 ? `S${e5.windingId}: ` : ``}${ctx.ov(e5.ratingsFromSource[0], 1)} / ${ctx.ov(e5.ratingsToSource[0], 1)} \xB7 ${e5.ratingBasis}`).join(` \xB7 `), t4.sourceEquipmentId, `CSV / XLSX`]
        };
      });
    }
    g3 = g3.filter(e4 => !u3 || ctx.lv(`${e4.name} ${e4.search}`).includes(u3)), g3.sort((e4, t4) => E2.value === `value-desc` ? t4.score - e4.score || e4.name.localeCompare(t4.name, `tr`, {
      numeric: true
    }) : e4.name.localeCompare(t4.name, `tr`, {
      numeric: true
    }) * (E2.value === `name-desc` ? -1 : 1));
    let M3 = e4 => {
        let t4 = [],
          n4 = 0;
        for (; n4 < e4.length;) {
          let r4 = Math.min(n4 + 3e4, e4.length);
          r4 < e4.length && /[\uD800-\uDBFF]/.test(e4[r4 - 1]) && r4--, t4.push(e4.slice(n4, r4)), n4 = r4;
        }
        return t4.length ? t4 : [``];
      },
      N3 = y3 ?? v3,
      P3 = g3.map(e4 => {
        let t4 = [...(e4.exportCells ?? e4.cells)],
          n4 = String(t4.pop() ?? ``);
        return {
          cells: t4,
          chunks: M3(n4)
        };
      }),
      F3 = Math.max(1, ...P3.map(e4 => e4.chunks.length));
    D2 = [[...N3.slice(0, -1), ...Array.from({
      length: F3
    }, (e4, t4) => `${N3.at(-1)} (${t4 + 1}/${F3})`)], ...P3.map(e4 => [...e4.cells, ...Array.from({
      length: F3
    }, (t4, n4) => e4.chunks[n4] ?? ``)])], k2.disabled = A2.disabled = !g3.length;
    let I3 = ctx.Q(`tbody`),
      L3 = ctx.Q(`caption`, ``, l2 === `buses` ? `\xDCretim P/Q se\xE7ili katmandan; kaynak katman\u0131nda jenerat\xF6r kay\u0131tlar\u0131 toplam\u0131d\u0131r.` : l2 === `generators` ? `\xDCretim de\u011Ferleri se\xE7ili kaynaktan gelir.` : `U\xE7 de\u011Ferleri ilgili u\xE7tan ekipmana do\u011Frudur. \xDC\xE7 sarg\u0131l\u0131 trafo tek kay\u0131tt\u0131r; sarg\u0131lar ayr\u0131 g\xF6sterilir. T\xFCm RATE ve kaynak alanlar\u0131 CSV / XLSX i\xE7indedir.`);
    for (let e4 of K2(g3)) I3.append(G2(e4.display ?? e4.cells, e4.technical));
    if (!I3.children.length) {
      let e4 = ctx.Q(`td`, `ga-empty`, `Aramayla e\u015Fle\u015Fen sonu\xE7 yok.`);
      e4.colSpan = v3.length;
      let t4 = ctx.Q(`tr`);
      t4.append(e4), I3.append(t4);
    }
    C2.replaceChildren(L3, W2(v3), I3);
  }
  function ee2(t3, n3) {
    let r3 = ctx.Lv(t3.model, t3.base),
      i3 = ctx.Q(`tbody`),
      o3 = {
        STATUS: `Servis durumu`,
        GENERATOR_P: `Jenerat\xF6r P (MW)`,
        LOAD_SCALE: `Y\xFCk \xF6l\xE7e\u011Fi`,
        FIXED_TAP: `Kademe`,
        FIXED_PHASE: `Faz`,
        FIXED_SHUNT: `\u015E\xF6nt`
      };
    a2.textContent = `Senaryo`, _2.textContent = `${t3.scenario.operations.length} senaryo i\u015Flemi. Geri alma kaynak dosyay\u0131 de\u011Fi\u015Ftirmez; g\xFCncel sonu\xE7 i\xE7in yeniden hesaplay\u0131n. ${n3.scenario ? `Senaryo hesab\u0131 g\xFCncel.` : t3.scenario.operations.length ? `Senaryo hesab\u0131 bekleniyor.` : `Baz durum.`}`;
    let s3 = K2([...t3.scenario.operations]);
    for (let n4 of s3) {
      let a3 = n4.action === `STATUS` ? n4.value === true || n4.value === 1 ? `Serviste` : `Devre d\u0131\u015F\u0131` : String(n4.value),
        s4 = G2([o3[n4.action], r3.equipment(n4.equipmentId), a3], n4.equipmentId),
        c3 = ctx.Q(`td`),
        l3 = ctx.$(`Geri al`, () => {
          let i4 = t3.scenario.operations.filter(e3 => e3.equipmentId !== n4.equipmentId || e3.action !== n4.action);
          e2.setPsseScenario(i4), e2.setMessage(`${r3.equipment(n4.equipmentId)} i\u015Flemi geri al\u0131nd\u0131; NR yeniden hesaplan\u0131yor.`), e2.runPsseCalculation(`NR_POLAR`).catch(t4 => e2.setMessage(t4 instanceof Error ? t4.message : `PSS/E hesab\u0131 tamamlanamad\u0131.`)), ie2();
        }, `${r3.equipment(n4.equipmentId)} senaryo i\u015Flemini geri al`);
      l3.disabled = e2.busy, c3.append(l3), s4.append(c3), i3.append(s4);
    }
    if (!s3.length) {
      let e3 = ctx.Q(`tr`),
        t4 = ctx.Q(`td`, `ga-empty`, `Senaryo i\u015Flemi yok. Haritadaki hat veya trafo ayr\u0131nt\u0131s\u0131ndan servis durumunu de\u011Fi\u015Ftirebilirsiniz.`);
      t4.colSpan = 4, e3.append(t4), i3.append(e3);
    }
    C2.replaceChildren(W2([`\u0130\u015Flem`, `Ekipman / TM`, `De\u011Fer`, `Geri alma`]), i3);
  }
  let J2 = ``,
    te2 = null,
    ne2 = null,
    re2 = null;
  function ie2() {
    if (n2.hidden) return;
    for (let e3 of h2.querySelectorAll(`button[data-tab]`)) e3.setAttribute(`aria-pressed`, String(e3.dataset.tab === s2));
    let t3 = ctx.uv(e2);
    if (T2.hidden = l2 !== `transformers`, v2.hidden = s2 !== `LF`, P2.hidden = s2 !== `SCENARIOS`, !t3) {
      a2.textContent = ``, g2.textContent = `PSS/E modeli bekleniyor.`, _2.textContent = ``, C2.replaceChildren(), w2.hidden = true, z2.hidden = true;
      return;
    }
    w2.hidden = false, z2.hidden = false;
    let r3 = ctx.Rv(t3, e2.psseBaseCalculation),
      i3 = {
        source: true,
        base: !!r3.base,
        scenario: !!r3.scenario,
        delta: r3.ready
      };
    for (let e3 of y2.options) e3.disabled = !i3[e3.value], e3.title = e3.value === `delta` && !r3.ready ? r3.reason ?? `` : ``;
    d2 || (c2 = i3.scenario ? `scenario` : i3.base ? `base` : `source`), i3[c2] || (c2 = `source`), y2.value = c2;
    let o3 = t3.lastCalculation;
    if (!I2 && o3 && (F2.value = o3.method), L2.disabled = e2.busy, R2.disabled = e2.busy || !t3.scenario.operations.length, F2.disabled = e2.busy, g2.textContent = e2.busy ? `Hesaplan\u0131yor\u2026` : e2.psseWorkerError ? `Hesap hatas\u0131: ${e2.psseWorkerError.message}` : o3 && !t3.calculation ? `Son hesap ${o3.status} \xB7 ${o3.classification}. Bu hesap g\xFCncel sonu\xE7 katman\u0131nda kullan\u0131lamaz.` : c2 === `delta` ? `Uyumlu baz ve senaryo hesab\u0131.` : c2 === `source` ? `Kaynak kayd\u0131 g\xF6steriliyor.` : `G\xFCncel hesap sonucu g\xF6steriliyor.`, U2(t3, r3), s2 === `LF`) {
      let e3 = JSON.stringify([t3.scenario.hash, c2, l2, T2.value, x2.value, E2.value, u2, v10Sort.key, v10Sort.desc, v10Rate.value]);
      (e3 !== J2 || t3.model !== re2 || r3.scenario !== te2 || r3.base !== ne2) && (q2(t3, r3), J2 = e3, re2 = t3.model, te2 = r3.scenario, ne2 = r3.base);
    } else J2 = ``, ee2(t3, r3);
  }
  let ae2 = e3 => {
      e3 && (s2 = e3), n2.hidden = false, o2.hidden = false, p2.textContent = `\u2212`, ie2();
    },
    oe2 = e3 => {
      n2.hidden ? ae2(e3) : f2();
    },
    se2 = e3 => {
      e3.key === `Escape` && !n2.hidden && f2();
    },
    ce2 = e3 => {
      let t3 = e3.target;
      !n2.hidden && t3 instanceof Element && !n2.contains(t3) && !t3.closest(`[data-psse-lightning-toggle]`) && f2();
    };
  return t2.embedded || (ctx.document.addEventListener(`keydown`, se2), ctx.document.addEventListener(`pointerdown`, ce2)), {
    element: n2,
    render: ie2,
    open: ae2,
    close: f2,
    toggle: oe2,
    dispose: () => {
      ctx.document.removeEventListener(`keydown`, se2), ctx.document.removeEventListener(`pointerdown`, ce2);
    }
  };
};
}
export const initializers = [

];
