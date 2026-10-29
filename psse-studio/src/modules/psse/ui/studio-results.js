// Migrated V12 studio. Private per-instance bindings; no DGS controller.
export function define(ctx) {
  ctx.controlOption = function controlOption(title, items, name, selected) {
    return `<fieldset><legend>${ctx.esc(title)}</legend>${items.map(([value, text]) => `<label class="optline" title="${ctx.esc(text)} \xB7 PSS/E GUI ayar\u0131; GA motorunda destek seviyesi y\xF6ntem ve profil baz\u0131nda de\u011Fi\u015Fir."><input type="radio" name="${name}" value="${ctx.esc(value)}" ${value === selected ? "checked" : ""}/> ${ctx.esc(text)}</label>`).join("")}</fieldset>`;
  };
  ctx.renderSolve = function renderSolve() {
    const host = ctx.$$("#solve-content");
    host.innerHTML = `<div class="solve-card">
    <div class="solve-tabs">${["Newton", "Gauss", "Robust Solution"].map(s => `<button class="solve-tab ${ctx.controlTab === s ? "selected" : ""}" data-solvetab="${ctx.esc(s)}">${ctx.esc(s)}</button>`).join("")}</div>
    <div class="solve-main" id="method-form"></div>
    <div class="solve-bottom"><button class="btn primary" id="solve-run">Solve \u2014 GA Motoru</button><button class="btn" id="solve-dc">GA DC</button><button class="btn" id="solve-export">Hesap JSON indir</button><button class="btn primary" id="psspy-bundle">PSS/E PYTHON K\xD6PR\xDC ZIP \xB7 V7</button><span id="method-badge"></span></div>
    <div class="disclaimer">Ye\u015Fil = GA kar\u015F\u0131l\u0131\u011F\u0131 do\u011Fruland\u0131; turuncu = GA yakla\u015F\u0131k/s\u0131n\u0131rl\u0131; k\u0131rm\u0131z\u0131 = GA desteklemiyor. Desteklenmeyen GUI se\xE7enekleri hesaba sessizce uygulanmaz.</div>
  </div><section class="log-table"><h3>G\xFCncel GA \xE7\xF6z\xFCm g\xFCnl\xFC\u011F\xFC</h3><div class="table-wrap" id="solver-logs"></div></section>`;
    ctx.$$$("[data-solvetab]").forEach(b => b.onclick = () => {
      ctx.controlTab = b.dataset.solvetab;
      ctx.renderSolve();
    });
    const form = ctx.$$("#method-form");
    if (ctx.controlTab === "Newton") {
      form.innerHTML = `<div class="method-col">${ctx.controlOption("Preferred Solution method", [["NR_POLAR", "Full Newton-Raphson"], ["FDNS_XB", "Fixed slope decoupled Newton-Raphson (GA FDNS-XB yakla\u015F\u0131k profil)"], ["DNR", "Decoupled Newton-Raphson (GA uygulanmad\u0131)"]], "method", "NR_POLAR")}
    ${ctx.controlOption("Tap adjustment", [["lock", "Lock taps"], ["step", "Stepping"], ["direct", "Direct"]], "taps", "lock")}
    ${ctx.controlOption("Area interchange control", [["disable", "Disabled"], ["tie", "Tie lines only"], ["tie-load", "Tie lines and loads"]], "area", "disable")}
    ${ctx.controlOption("Preferred VAR limits", [["automatic", "Apply automatically"], ["immediate", "Apply immediately"], ["ignore", "Ignore"], ["iteration", "Apply at ... iterations"]], "varlim", "immediate")}
   </div><div class="method-col">
    ${ctx.controlOption("Switched shunt adjustments", [["lock", "Lock all"], ["enable", "Enable all"], ["continuous", "Enable continuous, disable discrete"]], "shunts", "lock")}
    ${ctx.selectHtml("Initial voltage / start", "start", [["saved", "Do not flat start"], ["flat", "Flat start"]], "saved")}
    <label class="optline"><input type="checkbox" id="nondive"> Non-divergent solution</label>
    <label class="optline"><input type="checkbox" id="phase"> Adjust phase shift</label>
    <label class="optline"><input type="checkbox" id="dc-tap"> Adjust DC taps</label>
    ${ctx.selectHtml("On solution failure", "failmode", [["restore", "Restore best found solution"], ["leave", "Leave failed state"]], "restore")}
    <label class="select-line">VAR limit iteration <input type="number" id="variteration" value="99" min="1"></label>
    <label class="select-line">Mismatch threshold (MVA) for voltage estimation <input type="number" id="mismatch" value="500" step="0.1"></label>
    <label class="select-line">Minimum VAR band (Mvar) <input type="number" id="varband" value="5" step="0.1"></label>
    <label class="optline"><input type="checkbox" id="remote"> GA uzak IREG/RMPCT kontrol\xFC (deneysel)</label>
   </div>`;
    } else if (ctx.controlTab === "Gauss") {
      form.innerHTML = `<div class="method-col">${ctx.controlOption("Solution method", [["GS", "Gauss-Seidel"], ["MGS", "Modified Gauss-Seidel"]], "method", "GS")}
   ${ctx.controlOption("Area interchange control", [["disable", "Disabled"], ["tie", "Tie lines only"], ["tie-load", "Tie lines and loads"]], "area", "disable")}</div><div class="method-col">
   ${ctx.controlOption("Switched shunt adjustments", [["lock", "Lock all"], ["enable", "Enable all"], ["continuous", "Enable continuous, disable discrete"]], "shunts", "lock")}
   ${ctx.selectHtml("Initial voltage / start", "start", [["saved", "Do not flat start"], ["flat", "Flat start"]], "saved")}
   <label class="optline"><input type="checkbox" id="ignore-var"> Ignore VAR limits</label><label class="optline"><input type="checkbox" id="dc-tap"> Adjust DC taps</label><label class="optline"><input type="checkbox" id="tap-adjust"> Adjust taps</label></div>`;
    } else {
      form.innerHTML = '<div class="unsupported-note">Robust Solution sekmesi g\xF6nderilen ekran g\xF6r\xFCnt\xFClerinde yaln\u0131z sekme ad\u0131 olarak g\xF6r\xFCl\xFCyor. Kaynak taraf\u0131ndan desteklenmeyen y\xF6ntem/parametre uydurulmad\u0131.</div>';
    }
    ctx.$$('[id="solve-run"]').onclick = async () => {
      const method = form.querySelector('input[name="method"]:checked')?.value || "";
      const chosen = name => form.querySelector(`input[name="${name}"]:checked`)?.value;
      const unsupported = [];
      if (chosen("taps") && chosen("taps") !== "lock") unsupported.push("Tap Stepping/Direct");
      if (chosen("shunts") && chosen("shunts") !== "lock") unsupported.push("Switched shunt automatic");
      if (chosen("area") && chosen("area") !== "disable") unsupported.push("Area interchange");
      if (chosen("varlim") && ["automatic", "iteration"].includes(chosen("varlim"))) unsupported.push("VAR limits timing");
      if (form.querySelector("#phase")?.checked) unsupported.push("Phase shift adjustment");
      if (form.querySelector("#dc-tap")?.checked) unsupported.push("DC taps adjustment");
      if (form.querySelector("#nondive")?.checked) unsupported.push("PSS/E non-divergent option");
      if (unsupported.length) {
        ctx.notice("GA taraf\u0131ndan uygulanmayan PSS/E kontrolleri: " + unsupported.join(", ") + ". Se\xE7enekleri kald\u0131r\u0131n; sessizce yok say\u0131lmayacak.");
        return;
      }
      if (!["NR_POLAR", "FDNS_XB"].includes(method)) {
        ctx.notice(`${method || ctx.controlTab} GA motorunda uygulanm\u0131\u015F de\u011Fil; sonu\xE7 olu\u015Fturulmad\u0131.`);
        return;
      }
      const options = {
        sourceUnits: "MVA_MVAR_DEG_PER_UNIT",
        initialVoltagePolicy: ctx.$$("#start")?.value === "flat" ? "FLAT" : "SOURCE_SAVED",
        reactiveLimitsEnabled: form.querySelector('input[name="varlim"]:checked')?.value !== "ignore",
        remoteRegulation: !!ctx.$$("#remote")?.checked,
        remoteChasing: !!ctx.$$("#remote")?.checked,
        automaticAdjustments: false
      };
      await ctx.execute(method, options);
    };
    ctx.$$('[id="solve-dc"]').onclick = () => ctx.execute("LOSSLESS_DC", {});
    ctx.$$('[id="psspy-bundle"]').onclick = () => {
      try {
        const manifest = ctx.optionsManifest();
        if (!ctx.lastSuccessfulGaJob) {
          ctx.notice("\xD6nce GA Full AC NR \xE7\xF6z\xFCm\xFCn\xFC \xE7al\u0131\u015Ft\u0131r\u0131n; son ba\u015Far\u0131l\u0131 ayarlar olmadan paket olu\u015Fturulmaz.");
          return;
        }
        const content = ctx.zipBundle([["PSSE_LOCAL_JOB.json", JSON.stringify(manifest, null, 2)], ["PSS_E_LOCAL_REFERENCE_RUNNER_V7.py", ctx.textBundle(ctx.RUNNER_B64)], ["PSS_E_TEK_TIKLA_CALISTIR.bat", ctx.textBundle(ctx.BAT_B64)], ["README.txt", "1) Bu ZIP dosyasini SAV ile ayni klasore cikarin.\r\n2) PSS_E_TEK_TIKLA_CALISTIR.bat cift tiklayin.\r\n3) Python 3.14 x64 ve lisansli PSS/E 36.5 PSSPY314 gereklidir.\r\n4) GA_PSSE_REFERENCE_V1.json dosyasini HTML > GA Sonuclari > Referans iceri aktar.\r\n5) Kaynak SHA-256 ve kontrol ayarlari uyusmazsa hesap durdurulur."]]);
        ctx.download("PSS_E_YEREL_TEK_TIK_PAKETI.zip", content, "application/zip");
        ctx.notice("Son ba\u015Far\u0131l\u0131 GA Full AC ayarlar\u0131yla PSS/E yerel paket indirildi. SAV ile ayn\u0131 klas\xF6re \xE7\u0131kar\u0131n.");
      } catch (e) {
        ctx.notice("Yerel paket olu\u015Fturulamad\u0131: " + e.message);
      }
    };
    ctx.$$('[id="solve-export"]').onclick = () => {
      if (!ctx.result()) {
        ctx.notice("\xD6nce \xE7\xF6z\xFCm \xFCretin.");
        return;
      }
      ctx.download("GA_PSSE_HESAP_SONUCU.json", JSON.stringify({
        source: ctx.fileSha(),
        result: ctx.result()
      }, null, 2), "application/json");
    };
    const diag = ctx.$$("#method-badge");
    form.querySelectorAll("label.optline").forEach(x => {
      const i = x.querySelector("input");
      if (!i) return;
      const value = i.value;
      const green = i.name === "taps" && value === "lock" || i.name === "shunts" && value === "lock" || i.name === "area" && value === "disable" || i.name === "varlim" && ["immediate", "ignore"].includes(value);
      const orange = i.name === "method" && ["NR_POLAR", "FDNS_XB"].includes(value) || i.id === "remote" || i.id === "ignore-var";
      x.classList.add(green ? "support-green" : orange ? "support-orange" : "support-red");
      x.title = (green ? "GA: do\u011Frudan desteklenen se\xE7enek. " : orange ? "GA: yakla\u015F\u0131k/s\u0131n\u0131rl\u0131 destek. " : "GA: hen\xFCz desteklenmiyor; \xE7al\u0131\u015Ft\u0131r\u0131l\u0131rken kontrol edilir. ") + x.textContent.trim();
    });
    diag.innerHTML = '<span class="badge warning">Full NR: yakla\u015F\u0131k</span> <span class="badge warning">FDNS: ko\u015Fula ba\u011Fl\u0131</span> <span class="badge warning">DC: s\u0131n\u0131rl\u0131</span> <span class="badge danger">Gauss / Robust: yok</span>';
    const logHost = ctx.$$("#solver-logs");
    if (ctx.result()) {
      const logs = {
        columns: ["\xD6l\xE7\xFCt", "De\u011Fer"],
        rows: [["Y\xF6ntem", ctx.result().method], ["Numerik durum", ctx.result().status], ["Kapsam", ctx.result().physicsCoverage], ["S\u0131n\u0131f", ctx.result().classification], ["NR/FDNS ad\u0131m\u0131", ctx.result().iterations], ["P uyumsuzlu\u011Fu pu", ctx.tinyMismatch(ctx.result().maxPMismatchPu)], ["Q uyumsuzlu\u011Fu pu", ctx.tinyMismatch(ctx.result().maxQMismatchPu)], ["Motor s\xFCresi ms", ctx.result().elapsedMs]]
      };
      const t = ctx.h("table"),
        r = ctx.h("tr");
      for (const col of logs.columns) {
        const cell = ctx.h("th");
        cell.textContent = col;
        r.append(cell);
      }
      const head = ctx.h("thead");
      head.append(r);
      t.append(head);
      const body = ctx.h("tbody");
      for (const row of logs.rows) {
        const tr = ctx.h("tr");
        for (let i = 0; i < logs.columns.length; i++) {
          const cell = ctx.h("td");
          cell.textContent = ctx.displayCell(row[i], logs.columns[i]);
          tr.append(cell);
        }
        body.append(tr);
      }
      t.append(body);
      logHost.append(t);
    }
  };
  ctx.resultCards = function resultCards() {
    const r = ctx.result(),
      ref = ctx.reference?.solver || null,
      b = ctx.benchmark(),
      refOptions = ref?.options || ctx.reference?.job?.profile || {},
      gaOpts = ctx.lastSuccessfulGaJob?.profile || {},
      short = x => typeof x === "string" ? x : JSON.stringify(x);
    const ga2 = [["GA \xB7 Y\xF6ntem / ayarlar", `${r.method} \xB7 ${gaOpts.taps || "lock"} tap \xB7 ${gaOpts.shunts || "lock"} \u015F\xF6nt \xB7 ${gaOpts.varLimits || "immediate"} Q limit`], ["GA \xB7 Hesap sonucu", `${r.status} / ${r.classification} / ${r.physicsCoverage}`], ["GA \xB7 \u0130terasyon / art\u0131k", `${r.iterations} ad\u0131m \xB7 \u0394P ${ctx.tinyMismatch(r.maxPMismatchPu)} pu \xB7 \u0394Q ${ctx.tinyMismatch(r.maxQMismatchPu)} pu`], ["GA \xB7 Swing / sal\u0131n\u0131m", ctx.swingSummary("ga")], ["GA\u2013PSS/E \xB7 P / Q (\u226566 kV)", b ? `P: ort. ${ctx.fmtStat(b.p.mean, "MW", 3)} \xB7 maks. ${ctx.fmtStat(b.p.max, "MW", 3)} (${b.p.count}) | Q: ort. ${ctx.fmtStat(b.q.mean, "MVAr", 3)} \xB7 maks. ${ctx.fmtStat(b.q.max, "MVAr", 3)} (${b.q.count})` : "Referans JSON gerekli"]];
    const pe = [["PSS/E \xB7 Y\xF6ntem / ayarlar", ref ? `FNSL \xB7 ${Array.isArray(refOptions) ? refOptions.join(" / ") : "Referans profili"}` : "Referans y\xFCklenmedi"], ["PSS/E \xB7 Hesap sonucu", ref ? `ierr ${ref.ierr} \xB7 solved ${ref.solved}` : "\u2014"], ["PSS/E \xB7 \u0130terasyon / mismatch", ref ? `${ref.iterations ?? "\u2014"} ad\u0131m \xB7 ${ctx.fmtStat(Number(ref.mismatchMva), "MVA", 3)}` : "\u2014"], ["PSS/E \xB7 Swing / sal\u0131n\u0131m", ctx.reference ? ctx.swingSummary("psse") : "\u2014"], ["GA\u2013PSS/E \xB7 V / a\xE7\u0131 (\u226566 kV)", b ? `V: ort. ${ctx.fmtStat(b.v.mean, "kV")} \xB7 maks. ${ctx.fmtStat(b.v.max, "kV")} (${b.v.count}) | \u03B8: ort. ${ctx.fmtStat(b.a.mean, "\xB0", 3)} \xB7 maks. ${ctx.fmtStat(b.a.max, "\xB0", 3)} (${b.a.count})` : "Referans JSON gerekli"]];
    return {
      ga: ga2,
      pe
    };
  };
  ctx.filteredGaRows = function filteredGaRows(set) {
    const q = ctx.gaResultSearch.trim().toLocaleLowerCase("tr-TR"),
      filtered = set.rows.map((row, i) => ({
        row,
        area: set.area[i],
        matched: set.matched[i]
      })).filter(x => (!ctx.reference || ctx.gaIncludeUnmatched || x.matched) && (ctx.gaYtm === "all" || x.area === ctx.gaYtm) && (!q || x.row.some(v => String(v ?? "").toLocaleLowerCase("tr-TR").includes(q))));
    if (ctx.gaSortCol >= 0) filtered.sort((a, b) => {
      const x = a.row[ctx.gaSortCol],
        y = b.row[ctx.gaSortCol],
        nx = ctx.numberOrNull(x),
        ny = ctx.numberOrNull(y);
      const d = nx != null && ny != null ? nx - ny : String(x ?? "").localeCompare(String(y ?? ""), "tr", {
        numeric: true
      });
      return d * ctx.gaSortDir;
    });
    return filtered.map(x => x.row);
  };
  ctx.renderGaResults = function renderGaResults() {
    const host = ctx.$$("#solve-content");
    host.replaceChildren();
    const r = ctx.result();
    const tools = ctx.h("div", "reference-import");
    const label = ctx.h("label");
    label.textContent = "Lisansl\u0131 PSS/E referans JSON: ";
    const input = ctx.h("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async e => {
      try {
        await ctx.parseReferenceFile(e.target.files[0]);
      } catch (error) {
        ctx.notice("PSS/E referans\u0131: " + String(error));
      }
    };
    label.append(input);
    tools.append(label);
    const status = ctx.h("span");
    status.textContent = ctx.reference ? `\u2713 SHA e\u015Fle\u015Fti \xB7 ${ctx.reference.branches.length} dal \xB7 ${ctx.reference.buses.length} bara \xB7 GA/PSS-E solver profili ayr\u0131ca kontrol edilmeli` : "Referans y\xFCklenmedi";
    tools.append(status);
    host.append(tools);
    if (!ctx.live()) {
      const empty = ctx.h("p", "psse-empty-state");
      empty.textContent = "\xD6nce model y\xFCkleyin.";
      host.append(empty);
      return;
    }
    if (!r) {
      const d = ctx.h("div", "psse-empty-state");
      d.innerHTML = 'Hen\xFCz GA hesap sonucu yok. <button class="btn primary">Full AC NR hesapla</button>';
      d.querySelector("button").onclick = () => ctx.execute("NR_POLAR", {
        sourceUnits: "MVA_MVAR_DEG_PER_UNIT",
        initialVoltagePolicy: "SOURCE_SAVED"
      });
      host.append(d);
      return;
    }
    const cards = ctx.h("div", "gares-dual");
    const cc = ctx.resultCards();
    for (const [title, items] of [["GA ANAL\u0130Z", cc.ga], ["PSS/E REFERANS", cc.pe]]) {
      const group = ctx.h("section", "gares-card-group");
      const groupHeading = ctx.h("h3");
      groupHeading.textContent = title;
      group.append(groupHeading);
      const grid = ctx.h("div", "gares-five");
      for (const [caption, value] of items) {
        const card = ctx.h("article");
        const small = ctx.h("small"),
          strong = ctx.h("strong");
        small.textContent = caption;
        strong.textContent = value;
        card.append(small, strong);
        card.title = value;
        grid.append(card);
      }
      group.append(grid);
      const detail = ctx.h("details", "gares-settings-detail"),
        summary = ctx.h("summary");
      summary.textContent = "Tam hesap ayarlar\u0131 / provenans";
      detail.append(summary);
      const raw = ctx.h("pre");
      raw.textContent = JSON.stringify(title === "GA ANAL\u0130Z" ? ctx.lastSuccessfulGaJob?.profile || {} : ctx.reference?.solver || {}, null, 2);
      detail.append(raw);
      group.append(detail);
      cards.append(group);
    }
    host.append(cards);
    const opts = ctx.h("div", "gares-actions");
    for (const [title, k] of [["Bara sonu\xE7lar\u0131", "buses"], ["Hatlar", "lines"], ["Trafolar", "transformers"], ["Jenerat\xF6rler", "generators"]]) {
      const b = ctx.h("button", "btn");
      b.textContent = title;
      if (k === ctx.gaResultKind) b.classList.add("is-selected");
      b.onclick = () => {
        ctx.gaResultKind = k;
        ctx.gaResultPage = 0;
        ctx.gaSortCol = -1;
        ctx.renderGaResults();
      };
      opts.append(b);
    }
    host.append(opts);
    const hostGrid = ctx.h("div", "gares-result-grid");
    hostGrid.id = "gares-table";
    host.append(hostGrid);
    ctx.renderGaResultRows(ctx.gaResultKind);
  };
  ctx.renderGaResultRows = function renderGaResultRows(kind) {
    ctx.gaResultKind = kind;
    const host = ctx.$$("#gares-table");
    if (!host) return;
    const set = ctx.gaRows(kind),
      rows = ctx.filteredGaRows(set),
      pages = Math.max(1, Math.ceil(rows.length / ctx.gaPageSize));
    ctx.gaResultPage = Math.min(ctx.gaResultPage, pages - 1);
    host.replaceChildren();
    host.append(ctx.gaFilterRow(kind));
    const tableWrap = ctx.h("div", "table-wrap gares-scroll"),
      table = ctx.h("table", "gares-comparison"),
      header = ctx.h("thead"),
      tr = ctx.h("tr");
    table.dataset.kind = kind;
    for (let i = 0; i < set.headers.length; i++) {
      const th = ctx.h("th"),
        button = ctx.h("button");
      button.type = "button";
      button.className = "sort-col";
      button.textContent = set.headers[i] + (ctx.gaSortCol === i ? ctx.gaSortDir === 1 ? " \u25B2" : " \u25BC" : "");
      button.onclick = () => {
        if (ctx.gaSortCol === i) ctx.gaSortDir *= -1;else {
          ctx.gaSortCol = i;
          ctx.gaSortDir = 1;
        }
        ctx.gaResultPage = 0;
        ctx.renderGaResultRows(kind);
      };
      th.append(button);
      tr.append(th);
    }
    header.append(tr);
    table.append(header);
    const body = ctx.h("tbody");
    for (const row of rows.slice(ctx.gaResultPage * ctx.gaPageSize, (ctx.gaResultPage + 1) * ctx.gaPageSize)) {
      const tr2 = ctx.h("tr");
      for (let i = 0; i < row.length; i++) {
        const td = ctx.h("td"),
          val = row[i],
          col = set.headers[i];
        td.textContent = ctx.displayCell(val, col) || "\u2014";
        td.title = String(val ?? "");
        if ((col.includes("\u0394") || col.includes("Fark")) && val !== null && val !== void 0 && val !== "" && Number.isFinite(Number(val))) {
          const num = Number(val),
            pct = col.includes("%") ? num : null;
          td.className = pct == null ? num >= 10 ? "delta-red" : num >= 1 ? "delta-amber" : "delta-green" : pct >= 2 ? "delta-red" : pct >= 1 ? "delta-amber" : "delta-green";
        }
        tr2.append(td);
      }
      body.append(tr2);
    }
    table.append(body);
    tableWrap.append(table);
    host.append(tableWrap);
    const cov = set.coverage || {};
    const covInfo = ctx.h("div", "gares-coverage");
    covInfo.textContent = `Kimlik e\u015Fle\u015Fmesi ${cov.idMatched || 0}/${cov.source || 0} \xB7 P/Q e\u015Fle\u015Fmesi ${cov.numericPaired || 0} \xB7 Devre d\u0131\u015F\u0131 ${cov.inactive || 0} \xB7 GA hesap verisi eksik ${cov.gaMissing || 0} \xB7 PSS/E anahtar\u0131 eksik ${cov.refMissing || 0}`;
    host.append(covInfo);
    const pager = ctx.h("div", "gares-pager");
    const prev = ctx.h("button", "btn");
    prev.textContent = "\u2039 \xD6nceki";
    prev.disabled = ctx.gaResultPage === 0;
    prev.onclick = () => {
      ctx.gaResultPage--;
      ctx.renderGaResultRows(kind);
    };
    const next = ctx.h("button", "btn");
    next.textContent = "Sonraki \u203A";
    next.disabled = ctx.gaResultPage >= pages - 1;
    next.onclick = () => {
      ctx.gaResultPage++;
      ctx.renderGaResultRows(kind);
    };
    const pageText = ctx.h("span");
    pager.append(prev, pageText);
    pageText.textContent = `${rows.length.toLocaleString("tr-TR")} fiziksel ekipman \xB7 ${ctx.gaResultPage + 1}/${pages}` + (ctx.reference && !ctx.gaIncludeUnmatched ? " \xB7 yaln\u0131z say\u0131sal kar\u015F\u0131la\u015Ft\u0131r\u0131labilenler" : "");
    pager.append(next);
    host.append(pager);
  };
}
export const initializers = [[18, ctx => {
  ctx.currentSolveMethod = "NR_POLAR";
}], [19, ctx => {
  ctx.controlTab = "Newton";
}], [20, ctx => {
  ctx.lastSuccessfulGaJob = null;
}], [34, ctx => {
  ctx.tinyMismatch = n => Number.isFinite(n) && Math.abs(n) > 0 && Math.abs(n) < 5e-4 ? n.toExponential(2) : ctx.nfmt(n, 3);
}], [42, ctx => {
  ctx.result = () => ctx.ga.psseCalculation;
}], [72, ctx => {
  ctx.gaResultKind = "lines";
}], [74, ctx => {
  ctx.gaResultSearch = "";
}], [77, ctx => {
  ctx.gaResultPage = 0;
}]];
