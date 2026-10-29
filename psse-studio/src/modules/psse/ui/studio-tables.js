import {comparisonCsv} from '../../../shared/export/csv.js';
// Migrated V12 studio. Private per-instance bindings; no DGS controller.
export function define(ctx) {
const sourceIndices=new WeakMap();
ctx.sourceIndex=()=>{
  const model=ctx.sources();if(!model)return {equipment:new Map(),stations:new Map()};
  let index=sourceIndices.get(model);if(!index){index={equipment:new Map(model.equipment.map(e=>[e.id,e])),stations:new Map(model.equipment.filter(e=>e.kind==='substation').map(e=>[Number(e.fields?.isub??e.fields?.isubst??e.fields?.number??e.fields?.id),e]))};sourceIndices.set(model,index);}return index;
};
ctx.displayCell = function displayCell(value, field = "") {
  if (value === null || value === void 0 || value === "") return "";
  const key = String(field).toLocaleLowerCase("en-US");
  if (typeof value === "boolean") return value ? "Evet" : "Hay\u0131r";
  const raw = String(value).trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return String(value);
  if (/(?:^|\W)(?:id|number|num|sıra|satır|bus|bara no|ckt|circuit|zone|owner|area|substation)(?:$|\W)/i.test(key) || /^(?:[+-]?\d+)$/.test(raw)) return String(value);
  const num = Number(raw);
  if (!Number.isFinite(num)) return String(value);
  const digits = /\bpu\b|per unit|\(pu\)/i.test(key) ? 3 : /(?:mw|mvar|mva|kv|volt|angle|deg|açı|current|\bamp\b|\(a\)|^pgen\s*\d+|^qmax\s*\d+|^qmin\s*\d+|^urg$)/i.test(key) ? 1 : 3;
  return num.toLocaleString("tr-TR", {
    minimumFractionDigits: digits === 1 ? 1 : 0,
    maximumFractionDigits: digits
  });
};
ctx.busAt = function busAt(number) {
  const source = ctx.ga.psseInspection;
  if (!source) return;
  let m = ctx.busCache.get(source);
  if (!m) {
    m = new Map(source.equipment.filter(x => x.kind === "bus").map(x => [Number(x.fields?.ibus), x]));
    ctx.busCache.set(source, m);
  }
  return m.get(Number(number));
};
ctx.download = function download(name, text, mime = "text/plain;charset=utf-8") {
  const blob = text instanceof Blob ? text : new Blob([text], {
      type: mime
    }),
    url = URL.createObjectURL(blob),
    a = ctx.document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  ctx.window.setTimeout(() => URL.revokeObjectURL(url), 1e4);
};
ctx.notice = function notice(s) {
  const x = ctx.$$("#notice");
  if (x) x.textContent = s;
};
ctx.showTop = function showTop() {
  const src = ctx.sources();
  ctx.$$("#model-name").textContent = src ? `${src.source.name} \xB7 ${src.source.format} \xB7 ${src.source.sha256.slice(0, 12)}\u2026` : "Model bekleniyor \u2014 SAV / RAW / ZIP y\xFCkleyin";
  const counts = src ? ["substation", "bus", "line", "transformer", "generator", "load"].map(k => src.equipment.filter(e => e.kind === k).length) : [];
  ctx.$$('[data-chip="model"]').textContent = src ? `TM ${ctx.nfmt(counts[0], 0)} \xB7 Bara ${ctx.nfmt(counts[1], 0)} \xB7 Hat ${ctx.nfmt(counts[2], 0)} \xB7 Trafo ${ctx.nfmt(counts[3], 0)}` : "PSS/E 36.5 \xB7 Native GA Decoder";
  const status = ctx.$$("#solver-status");
  status.textContent = ctx.statusLabel();
  const r = ctx.result();
  status.dataset.kind = r ? r.status === "CONVERGED" ? r.classification === "SOLVED_FULL" ? "success" : "warning" : "danger" : "idle";
  ctx.$$('[data-chip="source"]').textContent = ctx.caseMatch() ? "Y\xFCklenen kaynak" : src ? "SOURCE_INPUT \xB7 Y\xFCklenen model" : "Kaynak y\xFCklenmedi";
  ctx.$$('[data-chip="source"]').dataset.kind = ctx.caseMatch() ? "success" : src ? "warning" : "idle";
};
ctx.preload = async function preload() {
  try {
    const encoded = ctx.document.getElementById("pse-reference").textContent.trim(),
      binary = atob(encoded),
      bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    ctx.corpus = JSON.parse(await new Response(stream).text());
    ctx.notice(`PSS/E kolon \u015Femalar\u0131 haz\u0131r \xB7 model y\xFCkleyin`);
    ctx.renderNavigation();
  } catch (error) {
    ctx.notice("Excel referans\u0131 a\xE7\u0131lamad\u0131: " + String(error));
    console.error(error);
  }
};
ctx.tabsHtml = function tabsHtml() {
  let key = ctx.main === "nr" ? "nr" : "nd";
  return (ctx.named[key] || []).map((n, i) => `<button class="subtab ${ctx.tabIndex === i ? "selected" : ""}" data-subs="${i}">${String(i + 1).padStart(2, "0")}-${key.toUpperCase()}-${ctx.esc(n)}</button>`).join("");
};
ctx.renderNavigation = function renderNavigation() {
  ctx.$$$(".nav-btn").forEach(b => b.classList.toggle("selected", b.dataset.main === ctx.main));
  const sub = ctx.$$("#subtabs"),
    intro = ctx.$$("#view-caption"),
    table = ctx.$$("#table-section"),
    others = ctx.$$("#others-section"),
    solve = ctx.$$("#solve-section");
  sub.hidden = !["nd", "nr"].includes(ctx.main);
  table.hidden = !["nd", "nr"].includes(ctx.main);
  others.hidden = ctx.main !== "others";
  solve.hidden = !["solve", "gares"].includes(ctx.main);
  if (ctx.main === "nd" || ctx.main === "nr") {
    sub.innerHTML = ctx.tabsHtml();
    ctx.$$$("#subtabs .subtab").forEach(b => b.onclick = () => {
      ctx.tabIndex = Number(b.dataset.subs);
      ctx.page = 0;
      ctx.renderNavigation();
    });
    intro.textContent = ctx.main === "nd" ? "Network Data \u00b7 kaynak PSS/E envanteri" : "Network Results \u00b7 " + (ctx.nativeResultSource === "ga" ? "GA hesap" : "SAV kay\u0131tl\u0131 durum");
    ctx.$$('[data-ui="source"]')?.classList.remove("hidden");
    ctx.renderTable();
  } else if (ctx.main === "others") {
    intro.textContent = "Network Others \u2022 SAV harici ZIP ekleri (IEC/GCP/MON/CON/JSON)";
    ctx.renderOthers();
  } else if (ctx.main === "gares") {
    intro.textContent = "GA Sonu\xE7lar\u0131 \u2022 ger\xE7ek hesap, provenans ve kaynak PSS/E kolonlar\u0131";
    ctx.renderGaResults();
  } else {
    intro.textContent = "PSS/GA POWER FLOW SOLVE \xB7 PSS/E ayarlar\u0131 ve GA motoru";
    ctx.renderSolve();
  }
};
ctx.selectData = function selectData() {
  if (!ctx.corpus) return {
    headers: ["Kaynak bekleniyor"],
    rows: [],
    source: "NO_MODEL"
  };
  const cfg = ctx.corpus[ctx.main]?.[ctx.tabIndex];
  if (!cfg) return {
    headers: [],
    rows: []
  };
  if (!ctx.live()) return {
    headers: cfg.columns,
    rows: [],
    source: "NO_MODEL",
    note: "Model y\xFCkleyin; eski Excel verileri g\xF6sterilmez."
  };
  return ctx.liveDataset(cfg, ctx.main);
};
ctx.tableField = function tableField(e, label) {
  const field = e.fields || {},
    key = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = {
    "busnumber": ["ibus", "frombus", "number"],
    "busname": ["name"],
    "substationnumber": ["isub"],
    "name": ["name"],
    "id": ["ckt", "machid", "loadid", "shntid"],
    "basekv": ["baskv"],
    "areanum": ["area"],
    "zonenum": ["zone"],
    "ownernum": ["owner"],
    "voltagepu": ["vm"],
    "angledeg": ["va"],
    "frombusnumber": ["ibus"],
    "tobusnumber": ["jbus"],
    "frombusname": ["ibus"],
    "tobusname": ["jbus"],
    "length": ["len"],
    "inservice": ["stat"],
    "stat": ["stat"],
    "status": ["stat"],
    "winding1number": ["ibus"],
    "winding2number": ["jbus"],
    "active": ["pg", "pl"],
    "reactive": ["qg", "ql"],
    "activemw": ["pg", "pl"],
    "reactivemvar": ["qg", "ql"],
    "activelossesmw": ["ploss"],
    "reactivelossesmvar": ["qloss"],
    "activepower": ["pg", "pl"],
    "reactivepower": ["qg", "ql"],
    "generatorrealpoweroutputmw": ["pg"],
    "generatorreactivepoweroutputmvar": ["qg"],
    "rating1": ["rate1"],
    "rating2": ["rate2"],
    "impedance": ["xpu"],
    "chargingbpu": ["bpu"]
  };
  if (Object.hasOwn(field, label)) return field[label];
  if (key === "id") return field.machid ?? field.loadid ?? field.shntid ?? field.ckt ?? field.id ?? "";
  if (key === "name") return e.name ?? field.name ?? field.ad ?? "";
  if (key === "busname") return e.kind === "bus" ? e.name ?? field.name ?? "" : ctx.busAt(field.ibus)?.name ?? "";
  if (key === "frombusname" || key === "tobusname") {
    const busNo = Number(field[key === "frombusname" ? "ibus" : "jbus"]);
    return ctx.busAt(busNo)?.name ?? "";
  }
  if (key === "frombusnumber") return field.ibus ?? "";
  if (key === "tobusnumber") return field.jbus ?? "";
  if (key === "voltagekv" && Number.isFinite(field.vm) && Number.isFinite(field.baskv)) return field.vm * field.baskv;
  if (key === "voltagepu" && Number.isFinite(field.vm)) return field.vm;
  if (key === "normalvmaxkv" && Number.isFinite(field.nvhi) && Number.isFinite(field.baskv)) return field.nvhi * field.baskv;
  if (key === "normalvminkv" && Number.isFinite(field.nvlo) && Number.isFinite(field.baskv)) return field.nvlo * field.baskv;
  if (key === "emergencyvmaxkv" && Number.isFinite(field.evhi) && Number.isFinite(field.baskv)) return field.evhi * field.baskv;
  if (key === "emergencyvminkv" && Number.isFinite(field.evlo) && Number.isFinite(field.baskv)) return field.evlo * field.baskv;
  if (key === "code" && field.ide !== void 0) return field.ide;
  if (["areaname", "zonename", "ownername"].includes(key)) {
    const arrays = ctx.ga.psseInspection?.binaryArrays || {},
      kind = key.replace("name", ""),
      defs = {
        area: ["Numare", "Arnam"],
        zone: ["Numzon", "Zoname"],
        owner: ["Numown", "Owname"]
      },
      [idKey, nameKey] = defs[kind];
    const ids = arrays[idKey]?.values || [],
      packed = (arrays[nameKey]?.values || []).join(""),
      id = Number(field[kind]),
      index = ids.indexOf(id);
    return index < 0 ? "" : packed.slice(index * 12, (index + 1) * 12).trim();
  }
  const FIELD_MAP = {
    "line r pu": "rpu",
    "line x pu": "xpu",
    "charging b pu": "bpu",
    "line g from pu": "gi",
    "line b from pu": "bi",
    "line g to pu": "gj",
    "line b to pu": "bj",
    "r source pu": "zr",
    "x source pu": "zx",
    "rtran pu": "rt",
    "xtran pu": "xt",
    "gentap pu": "gtap",
    "pgen mw": "pg",
    "qgen mvar": "qg",
    "pmax mw": "pt",
    "pmin mw": "pb",
    "qmax mvar": "qt",
    "qmin mvar": "qb",
    "mbase mva": "mbase",
    "mbase": "mbase",
    "regulated bus number": "ireg",
    "regulated node number": "nreg",
    "machine control mode": "wmod",
    "renewable machine power factor": "wpf",
    "voltage droop": "voltageDroopIndex",
    "winding i/o code": "cw",
    "impedance i/o code": "cz",
    "admittance i/o code": "cm",
    "specified r pu or watts": "r1_2",
    "specified x pu": "x1_2",
    "magnetizing g pu or watts": "mag1",
    "magnetizing b pu": "mag2",
    "winding mva base": "sbase1_2",
    "wnd 1 ratio pu or kv": "windv1",
    "wnd 2 ratio pu or kv": "windv2",
    "wnd 1 nominal kv": "nomv1",
    "wnd 2 nominal kv": "nomv2",
    "wnd 1 angle degrees": "ang1",
    "reactance pu": "xpu",
    "rating set name": "rsetnam",
    "switching device type": "stype",
    "close normal": "nstat",
    "tap positions": "",
    "controlled bus": "",
    "controlled bus side": "",
    "auto adjust": "",
    "control mode": "",
    "qmax": "qmax",
    "qmin": "qmin",
    "voltage pu": "vm",
    "angle deg": "va",
    "length": "len",
    "in service": "stat",
    "winding 1 side": "",
    "metered": "meteredBus",
    "bus number": "ibus",
    "owner number": "owner",
    "area num": "area",
    "zone num": "zone",
    "from bus number": "ibus",
    "to bus number": "jbus"
  };
  const canonical = label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const mapped = FIELD_MAP[canonical];
  if (mapped && Object.hasOwn(field, mapped)) {
    if ((canonical === "specified r pu or watts" || canonical === "specified x pu") && field.sbase1_2 && field.cz === 1) return field[mapped] * field.sbase1_2 / 100;
    return field[mapped];
  }
  if (/^rate(\d+) (i as mva|mva)$/.test(canonical)) {
    const n = Number(canonical.match(/^rate(\d+)/)[1]);
    return field["rate" + n] ?? "";
  }
  const rateSlot = {
    "kis": 1,
    "yaz": 2,
    "fider": 3,
    "koruma": 4,
    "isletm": 5,
    "dinami": 6
  }[canonical.split(" ")[0]];
  if (rateSlot && canonical.includes("mva")) return field["rate" + rateSlot] ?? field["wdg1rate" + rateSlot] ?? "";
  if (/^owner [1-4]$/.test(canonical)) {
    const index = Number(canonical.at(-1)) - 1;
    return field.owners?.[index]?.owner ?? "";
  }
  if (/^fraction [1-4]$/.test(canonical)) {
    const index = Number(canonical.at(-1)) - 1;
    return field.owners?.[index]?.fraction ?? "";
  }
  if (canonical === "close") return field.stat ?? "";
  if (canonical === "closed normal") return field.nstat ?? "";
  if (canonical === "code") {
    const bus = ctx.busAt(field.ibus);
    return field.ide ?? bus?.fields?.ide ?? "";
  }
  if (["area num", "zone num", "owner num", "area name", "zone name", "owner name"].includes(canonical) && !Object.hasOwn(field, canonical.split(" ")[0])) {
    const bus = ctx.busAt(field.ibus);
    if (bus) {
      const attr = canonical.split(" ")[0];
      if (canonical.endsWith(" num")) return bus.fields?.[attr] ?? "";
      return ctx.tableField(bus, label);
    }
  }
  if (canonical === "vsched kv") {
    const bus = ctx.busAt(field.ibus);
    return typeof field.vs === "number" ? field.vs * (bus?.fields?.baskv || 0) : "";
  }
  if (canonical === "regulated bus name") {
    const b = ctx.busAt(field.ireg);
    return b?.name ?? "";
  }
  if (canonical === "metered bus number") return field.meteredBus ?? "";
  if (canonical === "bypass") return field.bp ?? "";
  for (const name of aliases[key] || []) if (Object.hasOwn(field, name)) return field[name];
  for (const name of Object.keys(field)) if (name.toLowerCase().replace(/[^a-z0-9]/g, "") === key) return field[name];
  if (key === "frombusname" || key === "tobusname") {
    const b = field[key === "frombusname" ? "ibus" : "jbus"];
    return ctx.busAt(b)?.name ?? b ?? "";
  }
  return "";
};
ctx.liveDataset = function liveDataset(cfg, section) {
  const model = ctx.sources(),
    net = ctx.ga.psseNetwork,
    res = ctx.result(),
    headers = cfg.columns,
    eqById = new Map(model.equipment.map(e => [e.id, e]));
  if (section === "nd") {
    if (cfg.name === "Plant") {
      const groups = /* @__PURE__ */new Map();
      for (const g2 of net.generators) {
        const b = net.buses[g2.bus],
          id = b?.externalNumber;
        if (!b || id === void 0) continue;
        let group = groups.get(id);
        if (!group) {
          group = {
            bus: b,
            pg: 0,
            qg: 0,
            qmax: 0,
            qmin: 0,
            hasSource: true
          };
          groups.set(id, group);
        }
        group.pg += g2.pMw || 0;
        group.qg += g2.qMvar || 0;
        group.qmax += g2.qMaxMvar || 0;
        group.qmin += g2.qMinMvar || 0;
      }
      const rows = [...groups.entries()].map(([id, g2]) => headers.map(label => {
        const k = label.toLowerCase().replace(/[^a-z0-9]/g, ""),
          eq = eqById.get(g2.bus.sourceEquipmentId),
          f = eq?.fields || {};
        return k === "busnumber" ? id : k === "busname" ? eq?.name : k === "areanum" ? f.area : k === "areaname" ? ctx.tableField(eq, "Area Name") : k === "code" ? f.ide : k === "pgenmw" ? g2.pg : k === "qgenmvar" ? g2.qg : k === "qmaxmvar" ? g2.qmax : k === "qminmvar" ? g2.qmin : "";
      }));
      return {
        headers,
        rows,
        source: "DERIVED_FROM_SOURCE",
        note: "Plant: " + rows.length + " jenerat\xF6r baras\u0131, SAV jenerat\xF6r kaynak toplamlar\u0131. PSS/E orijinal raporu de\u011Fildir."
      };
    }
    if (["Branch Rating Name", "Swith. Dev. Rating Name", "Swith. Dev. Ratings"].includes(cfg.name)) {
      const arrays = model.binaryArrays || {},
        val = name => arrays[name]?.values || [],
        packed = name => val(name).join(""),
        cut = (name, i, width) => packed(name).slice(i * width, (i + 1) * width).trim();
      let rows = [];
      if (cfg.name === "Branch Rating Name") {
        rows = Array.from({
          length: 12
        }, (_, i) => ["RATE" + (i + 1), cut("Ratnam", i, 6), cut("Ratdesc", i, 32)]);
      } else if (cfg.name === "Swith. Dev. Rating Name") {
        rows = Array.from({
          length: 12
        }, (_, i) => ["RATE" + (i + 1), cut("Swdratnam", i, 6), val("Swdrattyp")[i] ?? "", cut("Swdratunt", i, 3), cut("Swdratdesc", i, 32)]);
      } else {
        rows = Array.from({
          length: 29
        }, (_, i) => [cut("Rsetname", i, 40), "", ...Array.from({
          length: 12
        }, (_2, j) => val("Swdrate")[i * 12 + j] ?? "")]);
      }
      return {
        headers,
        rows,
        source: "SAV_BINARY_ARRAYS",
        note: cfg.name + ": " + rows.length + " kaynak SAV puantaj/rating kayd\u0131."
      };
    }
    if (["Area", "Owner", "Zone", "Load Type"].includes(cfg.name)) {
      const defs = {
        "Area": ["Numare", "Arnam", 12],
        "Owner": ["Numown", "Owname", 12],
        "Zone": ["Numzon", "Zoname", 12],
        "Load Type": [null, "Ldtypename", 12]
      };
      const [numKey, nameKey, width] = defs[cfg.name],
        arrays = model.binaryArrays || {},
        ids = numKey ? arrays[numKey]?.values || [] : [],
        char = arrays[nameKey]?.values || [];
      const packed = char.join(""),
        size = ids.length || Math.floor(packed.length / width),
        names = Array.from({
          length: size
        }, (_, i) => packed.slice(i * width, (i + 1) * width).trim());
      const rows = names.map((name, i) => headers.map(label => {
        const k = label.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (k === "areanum" || k === "ownernum" || k === "zonenum") return ids[i] ?? "";
        if (k === "areaname" || k === "ownername" || k === "zonename" || k === "name") return name;
        return "";
      }));
      return {
        headers,
        rows,
        source: "SAV_DICTIONARY",
        note: cfg.name + ": " + rows.length + " do\u011Frulanm\u0131\u015F SAV s\xF6zl\xFCk kayd\u0131."
      };
    }
    const kind = ctx.targetKind[cfg.name],
      items = model.equipment.filter(e => {
        if (!kind) return false;
        if (e.kind !== kind) return false;
        if (cfg.name === "Fixed Shunt") return e.fields?.subtype !== "switched";
        if (cfg.name === "Voltage Droop") return String(e.fields?.subtype).toLowerCase() === "voltage-droop";
        if (cfg.name === "Plant") return String(e.fields?.subtype).toLowerCase() === "plant";
        return true;
      });
    return {
      headers,
      rows: items.map(e => headers.map(t => {
        const v = ctx.tableField(e, t);
        return v === null || v === void 0 ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      })),
      source: "NATIVE_SAV",
      note: `${cfg.name}: ${items.length} native ekipman; alanlar kaynak SAV tipine g\xF6re e\u015Flenmi\u015Ftir. Eksik alanlar bo\u015F b\u0131rak\u0131l\u0131r.`
    };
  }
  if (!res || res.status !== "CONVERGED") return {
    headers,
    rows: [],
    source: "NO_CALC",
    note: "GA hesab\u0131 yak\u0131nsam\u0131\u015F durumda de\u011Fil. Power Solve b\xF6l\xFCm\xFCnden desteklenen bir y\xF6ntem \xE7al\u0131\u015Ft\u0131r\u0131n."
  };
  const bs = new Map(res.busResults.map(r => [r.connectionKey, r])),
    br = new Map(res.branchResults.map(r => [r.id, r])),
    g = new Map(res.generatorResults.map(r => [r.id, r]));
  let records = [];
  if (cfg.name === "BUS") records = net.buses.filter(b => b.source).map(b => ({
    kind: "bus",
    bus: b,
    result: bs.get(b.connectionKey)
  }));else if (cfg.name === "AC Line") records = net.branches.filter(b => b.kind === "line").map(b => ({
    kind: "branch",
    branch: b,
    result: br.get(b.id)
  }));else if (cfg.name === "2 Winding") records = net.branches.filter(b => b.kind === "transformer" || b.kind === "three-winding-leg").map(b => ({
    kind: "branch",
    branch: b,
    result: br.get(b.id)
  }));else if (cfg.name === "Machine") records = net.generators.map(b => ({
    kind: "gen",
    gen: b,
    result: g.get(b.id)
  }));else return {
    headers,
    rows: [],
    source: "NOT_MAPPED",
    note: `${cfg.name}: bu sonu\xE7 s\u0131n\u0131f\u0131n\u0131n dinamik GA sekmesi hen\xFCz mevcut de\u011Fildir; orijinal PSS/E kayna\u011F\u0131na ge\xE7ebilirsiniz.`
  };
  const normal = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    headers,
    rows: records.map(rec => headers.map(label => {
      const k = normal(label),
        r = rec.result || {};
      if (rec.kind === "bus") {
        const b = rec.bus;
        if (k === "busnumber") return b.externalNumber ?? "";
        if (k === "busname") return eqById.get(b.sourceEquipmentId)?.name ?? b.id;
        if (k === "basekv") return b.baseKv ?? "";
        if (k === "voltagepu") return r.vmPu ?? "";
        if (k === "angledeg") return r.vaDeg ?? "";
        if (k === "voltageskv" || k === "voltagekv") return r.vmPu && b.baseKv ? r.vmPu * b.baseKv : "";
        if (k === "areanum") return b.area ?? "";
        if (k === "zonenum") return b.zone ?? "";
        if (k === "ownernum") return b.owner ?? "";
      }
      if (rec.kind === "branch") {
        const b = rec.branch,
          a = net.buses[b.from],
          c = net.buses[b.to];
        if (k === "frombusnumber") return a?.externalNumber ?? "";
        if (k === "tobusnumber") return c?.externalNumber ?? "";
        if (k === "frombusname") return eqById.get(a?.sourceEquipmentId)?.name ?? a?.id ?? "";
        if (k === "tobusname") return eqById.get(c?.sourceEquipmentId)?.name ?? c?.id ?? "";
        if (k === "id") return b.id.split(":").at(-1) ?? "";
        if (k === "name") return eqById.get(b.sourceEquipmentId)?.name ?? b.id;
        if (k === "inservice") return b.status;
        if (k === "activemw") return r.pFromMw ?? "";
        if (k === "reactivemvar") return r.qFromMvar ?? "";
        if (k === "activelossesmw") return r.pLossMw ?? "";
        if (k === "reactivelossesmvar") return r.qLossMvar ?? "";
        if (k === "ampscurrent") return r.iFromA ?? "";
        if (k === "puloading" || k === "kismixas mva") return r.loadingFromPct ?? "";
      }
      if (rec.kind === "gen") {
        const a = rec.gen,
          e = eqById.get(a.sourceEquipmentId);
        if (k === "busnumber") return net.buses[a.bus]?.externalNumber ?? "";
        if (k === "busname") return e?.name ?? "";
        if (k === "id") return e?.fields?.machid ?? "";
        if (k === "name") return e?.name ?? "";
        if (k === "realpoweroutputmw" || k === "generatorrealpowermw" || k === "pgenmw") return r.pMw ?? "";
        if (k === "reactivepoweroutputmvar" || k === "qgenmvar") return r.qMvar ?? "";
        if (k === "qmax") return a.qMaxMvar ?? "";
        if (k === "qmin") return a.qMinMvar ?? "";
      }
      return "";
    })),
    source: "GA_PSSE_CALCULATED",
    note: "Native GA sonu\xE7lar\u0131 orijinal Excel kolon adlar\u0131na aktar\u0131ld\u0131; yaln\u0131z do\u011Frudan e\u015Fle\u015Fen say\u0131sal alanlar doludur."
  };
};
ctx.renderTable = function renderTable() {
  const sourceSelect = ctx.root.querySelector("#native-result-source");
  if(sourceSelect)sourceSelect.hidden=ctx.main!=="nr";
  const selection = ctx.selectData(),
    f = ctx.$$("#filter");
  ctx.currentHeaders = selection.headers;
  ctx.currentRows = selection.rows;
  const needle = (ctx.query || "").toLocaleLowerCase("tr-TR");
  let visible = needle ? ctx.currentRows.filter(r => r.some(v => String(v ?? "").toLocaleLowerCase("tr-TR").includes(needle))) : ctx.currentRows;
  const maxPage = Math.max(0, Math.ceil(visible.length / ctx.pageSize) - 1);
  ctx.page = Math.min(ctx.page, maxPage);
  const start = ctx.page * ctx.pageSize,
    subset = visible.slice(start, start + ctx.pageSize);
  const header = ctx.$$("#grid-head"),
    body = ctx.$$("#grid-body");
  header.replaceChildren();
  body.replaceChildren();
  const visibleColumns = selection.headers.map((_, i) => i);
  const th = ctx.h("tr");
  visibleColumns.forEach(i => {
    const c = ctx.h("th");
    c.textContent = selection.headers[i] || `Alan ${i + 1}`;
    const filled = visible.some(r => r[i] !== "" && r[i] !== null && r[i] !== void 0);
    if (!filled) {
      c.classList.add("unmapped-column");
      c.title = selection.availability?.[i]?.message ?? "Bu model/hesap s\u0131n\u0131f\u0131ndan bu kolona do\u011Frulanm\u0131\u015F veri e\u015Flenemedi.";
    }
    th.append(c);
  });
  header.append(th);
  const frag = ctx.document.createDocumentFragment();
  for (const row of subset) {
    const tr = ctx.h("tr");
    for (const i of visibleColumns) {
      const td = ctx.h("td");
      const x = row[i];
      td.textContent = ctx.displayCell(x, selection.headers[i]);
      td.title = String(x ?? "");
      tr.append(td);
    }
    frag.append(tr);
  }
  body.append(frag);
  if (!visible.length) {
    const tr = ctx.h("tr"),
      td = ctx.h("td");
    td.colSpan = Math.max(visibleColumns.length, 1);
    td.className = "psse-empty-state";
    td.textContent = !ctx.live() ? "\xD6nce SAV / RAW / ZIP modelini y\xFCkleyin." : ctx.main === "nr" ? "Bu sonu\xE7 s\u0131n\u0131f\u0131nda veri yok. POWER SOLVE sekmesinde hesap yap\u0131n veya s\u0131n\u0131f hen\xFCz GA sonucuna e\u015Flenmedi." : "Bu ekipman s\u0131n\u0131f\u0131nda kaynak kayd\u0131 yok.";
    tr.append(td);
    body.append(tr);
  }
  ctx.$$('[data-page="current"]').textContent = `${visible.length ? start + 1 : 0}\u2013${Math.min(start + ctx.pageSize, visible.length)} / ${visible.length.toLocaleString("tr-TR")}`;
  ctx.$$('[data-page="index"]').textContent = `Sayfa ${ctx.page + 1}/${maxPage + 1}`;
  ctx.$$('[data-page="prev"]').disabled = ctx.page <= 0;
  ctx.$$('[data-page="next"]').disabled = ctx.page >= maxPage;
  ctx.$$('[data-notice="table"]').textContent = `${selection.source || ""} \xB7 ${selection.note || "Kaynak kolon yap\u0131s\u0131 korunmu\u015Ftur."} \xB7 ${selection.headers.length} Excel kolonu \xB7 ${visibleColumns.filter(i => visible.some(r => r[i] !== "" && r[i] !== null && r[i] !== void 0)).length} alan dolu`;
};
ctx.exportVisible = function exportVisible() {
  const d = ctx.selectData();
  const rows = ctx.query ? d.rows.filter(r => r.some(v => String(v ?? "").toLocaleLowerCase("tr-TR").includes(ctx.query.toLocaleLowerCase("tr-TR")))) : d.rows;
  const cv = x => '"' + String(x ?? "").replaceAll('"', '""') + '"';
  const csv = "\uFEFF" + [d.headers, ...rows].map(r => r.map(cv).join(";")).join("\r\n");
  ctx.download(`PSSE_${ctx.main.toUpperCase()}_${ctx.tabIndex + 1}_${ctx.origin}.csv`, csv, "text/csv;charset=utf-8");
};
ctx.parseSeparatedLine = function parseSeparatedLine(line) {
  let text = String(line).replace(/^\s*(\d+)\s+('(?:[^']|'')*'|"[^"]+")\s*,/, "$1,$2,");
  const out = [];
  let value = "",
    quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) {
        if (text[i + 1] === quote) {
          value += ch;
          i++;
        } else quote = null;
      } else value += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === ",") {
      out.push(value.trim());
      value = "";
    } else value += ch;
  }
  out.push(value.trim());
  return out;
};
ctx.otherBusName = function otherBusName(num) {
  if (!num || !/^-?\d+$/.test(String(num))) return "";
  return ctx.busAt(num)?.name || "";
};
ctx.otherSiteName = function otherSiteName(num) {
  const bus = ctx.busAt(num);
  if (!bus) return "";
  const sb = bus.fields?.isub || bus.fields?.substation || bus.fields?.isubstat;
  if (!sb) return "";
  const site = ctx.sourceIndex().stations.get(Number(sb));
  return site?.name || "";
};
ctx.makeOtherRows = function makeOtherRows(kind, text) {
  const lines = text.split(/\r?\n/),
    rows = [],
    names = {};
  let hdr = [];
  if (kind === "iec" || kind === "gcp") {
    const marker = lines.findIndex(x => /^\s*@!!?\s+I\s*,|^\s*@!!?\s*I\s*,/i.test(x));
    if (marker >= 0) hdr = ctx.parseSeparatedLine(lines[marker].replace(/^\s*@!!?\s*/, ""));
    if (!hdr.length) hdr = kind === "iec" ? ["I", "ID", "MCTYPE", "UrG", "PG", "PFactor", "PolePair", "GSUType", "Ix", "Jx", "Kx", "Ckt", "PT"] : ["I", "ID"];
    const target = ["Kaynak sat\u0131r", "Bara ID", "Bara ad\u0131", "TM ad\u0131", "Makine ID", ...hdr.slice(2).map(x => x.trim())];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || i <= marker || /^(?:0\s*,.*Capability curve|\s*\/)/i.test(line) || line.startsWith("@")) continue;
      const c = ctx.parseSeparatedLine(line),
        number = String(c[0] || "").trim();
      if (!/^\d+$/.test(number)) continue;
      const obj = {
        "Kaynak sat\u0131r": i + 1,
        "Bara ID": number,
        "Bara ad\u0131": ctx.otherBusName(number),
        "TM ad\u0131": ctx.otherSiteName(number),
        "Makine ID": c[1] || ""
      };
      for (let j = 2; j < Math.max(c.length, hdr.length); j++) obj[hdr[j] || "Ek alan " + (j + 1)] = c[j] ?? "";
      obj.__raw = line;
      rows.push(obj);
    }
    for (const item of rows) for (const key of Object.keys(item)) if (key !== "__raw" && !target.includes(key)) target.push(key);
    return {
      rows,
      headers: target,
      semantics: kind === "iec" ? "IEC 60909 k\u0131sa devre jenerat\xF6r parametreleri" : "P-Q jenerat\xF6r kabiliyet e\u011Frisi: PGEN/QMAX/QMIN noktalar\u0131"
    };
  }
  if (kind === "mon") {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const range = line.match(/^MONITOR VOLTAGE RANGE ZONE\s+(\d+)\s+([\d.]+)\s+([\d.]+)/i);
      const ties = line.match(/^MONITOR TIES FROM ZONE\s+(\d+) TO ZONE\s+(\d+)/i);
      const branches = line.match(/^MONITOR BRANCHES IN ZONE\s+(\d+)/i);
      rows.push({
        "Kaynak sat\u0131r": i + 1,
        "\u0130zleme t\xFCr\xFC": range ? "Gerilim s\u0131n\u0131r\u0131" : ties ? "B\xF6lge irtibatlar\u0131" : branches ? "B\xF6lge hatlar\u0131" : "Di\u011Fer",
        "Zone": range?.[1] || branches?.[1] || ties?.[1] || "",
        "Kar\u015F\u0131 Zone": ties?.[2] || "",
        "V min (pu)": range?.[2] || "",
        "V max (pu)": range?.[3] || "",
        __raw: line
      });
    }
    return {
      rows,
      headers: ["Kaynak sat\u0131r", "\u0130zleme t\xFCr\xFC", "Zone", "Kar\u015F\u0131 Zone", "V min (pu)", "V max (pu)"],
      semantics: "MON izleme tan\u0131mlar\u0131; hi\xE7bir y\xFCk ak\u0131\u015F\u0131 sonucu de\u011Fildir"
    };
  }
  if (kind === "con") {
    let contingency = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const mark = line.match(/^CONTINGENCY\s+['"]?([^'"\s]+)['"]?/i);
      if (mark) {
        contingency = mark[1];
        continue;
      }
      if (/^END(?:\s|$)/i.test(line)) {
        contingency = "";
        continue;
      }
      const branch = line.match(/^OPEN LINE FROM BUS\s+(\d+)\s+TO BUS\s+(\d+)\s+CKT\s+(.+)$/i);
      rows.push({
        "Kaynak sat\u0131r": i + 1,
        "K\u0131s\u0131t ID": contingency,
        "\u0130\u015Flem": branch ? "Hat a\xE7" : "Di\u011Fer i\u015Flem",
        "Ba\u015Flang\u0131\xE7 bara ID": branch?.[1] || "",
        "Ba\u015Flang\u0131\xE7 bara ad\u0131": ctx.otherBusName(branch?.[1]),
        "Biti\u015F bara ID": branch?.[2] || "",
        "Biti\u015F bara ad\u0131": ctx.otherBusName(branch?.[2]),
        "Devre": branch?.[3]?.replace(/[\x27\x22]/g, "").trim() || "",
        "Kaynak komut": line,
        __raw: line
      });
    }
    return {
      rows,
      headers: ["Kaynak sat\u0131r", "K\u0131s\u0131t ID", "\u0130\u015Flem", "Ba\u015Flang\u0131\xE7 bara ID", "Ba\u015Flang\u0131\xE7 bara ad\u0131", "Biti\u015F bara ID", "Biti\u015F bara ad\u0131", "Devre", "Kaynak komut"],
      semantics: "PSS/E contingency tan\u0131mlar\u0131; senaryo y\xFCr\xFCt\xFClmedi"
    };
  }
  return {
    rows,
    headers: [],
    semantics: "Kaynak kay\u0131tlar\u0131"
  };
};
ctx.renderOthers = async function renderOthers() {
  const host = ctx.$$("#others-content");
  host.replaceChildren();
  const items = ctx.ga.psseAttachments?.items || [];
  const types = [["iec", "IEC \xB7 K\u0131sa devre"], ["gcp", "GCP \xB7 Q kabiliyet"], ["mon", "MON \xB7 \u0130zleme"], ["con", "CON \xB7 K\u0131s\u0131t"], ["json", "JSON \xB7 Envanter"]];
  const tabs = ctx.h("nav", "others-tabs");
  for (const [type, label] of types) {
    const b = ctx.h("button", "btn " + (ctx.otherKind === type ? "selected" : ""));
    b.textContent = label + (items.some(x => String(x.archiveName).toLowerCase().endsWith("." + type)) ? " \u2713" : "");
    b.onclick = () => {
      ctx.otherKind = type;
      ctx.otherPage = 0;
      ctx.otherQuery = "";
      ctx.otherTable = "";
      ctx.renderOthers();
    };
    tabs.append(b);
  }
  host.append(tabs);
  const item = items.find(x => String(x.archiveName).toLowerCase().endsWith("." + ctx.otherKind));
  if (!item) {
    const msg = ctx.h("p", "psse-empty-state");
    msg.textContent = ctx.otherKind.toUpperCase() + " dosyas\u0131 y\xFCklenen modelde bulunmuyor.";
    host.append(msg);
    return;
  }
  const bar = ctx.h("div", "other-meta");
  bar.innerHTML = `<b>${ctx.esc(item.archiveName)}</b> <span>${ctx.nfmt(item.byteLength, 0)} bayt \xB7 SHA-256 ${ctx.esc(item.sha256)}</span>`;
  const save = ctx.h("button", "btn tiny");
  save.textContent = "Orijinal dosyay\u0131 indir";
  save.onclick = () => ctx.download(item.archiveName, item.file);
  bar.append(save);
  host.append(bar);
  const state = ctx.h("div", "other-controls"),
    info = ctx.h("span", "toolbar-info"),
    search = ctx.h("input");
  search.placeholder = "ID, isim, kolon veya komut ara";
  search.value = ctx.otherQuery;
  search.oninput = e => {
    ctx.otherQuery = e.target.value;
    ctx.otherPage = 0;
    drawOtherData();
  };
  state.append(search);
  const csvBtn = ctx.h("button", "btn tiny");
  csvBtn.textContent = "T\xFCm veriyi CSV indir";
  csvBtn.onclick = () => {
    const d2 = ctx.otherCache.get(item.sha256);
    if (!d2) return;
    const rows = d2.groups ? d2.groups[ctx.otherTable] || [] : d2.rows;
    const keys = d2.groups ? [...new Set(rows.flatMap(x => Object.keys(x || {})))] : d2.headers;
    const cv = x => '"' + String(x ?? "").replaceAll('"', '""') + '"';
    ctx.download("PSSE_" + ctx.otherKind.toUpperCase() + ".csv", "\uFEFF" + [keys, ...rows.map(r => keys.map(k => r[k]))].map(r => r.map(cv).join(";")).join("\r\n"), "text/csv;charset=utf-8");
  };
  state.append(csvBtn, info);
  host.append(state);
  const note = ctx.h("div", "other-description");
  host.append(note);
  const groupSelect = ctx.h("div", "other-group-selector");
  host.append(groupSelect);
  const wrap = ctx.h("div", "table-wrap other-grid"),
    table = ctx.h("table"),
    thead = ctx.h("thead"),
    tbody = ctx.h("tbody");
  table.append(thead, tbody);
  wrap.append(table);
  host.append(wrap);
  const pager = ctx.h("div", "other-pager");
  const prev = ctx.h("button", "btn tiny"),
    next = ctx.h("button", "btn tiny"),
    pageno = ctx.h("span");
  prev.textContent = "\u2039 \xD6nceki";
  next.textContent = "Sonraki \u203A";
  prev.onclick = () => {
    ctx.otherPage--;
    drawOtherData();
  };
  next.onclick = () => {
    ctx.otherPage++;
    drawOtherData();
  };
  pager.append(prev, pageno, next);
  host.append(pager);
  if (!ctx.otherCache.has(item.sha256)) {
    const txt = await item.file.text();
    if (ctx.otherKind === "json") {
      let json;
      try {
        json = JSON.parse(txt);
      } catch (err) {
        json = {
          raw: [{
            error: String(err),
            text: txt
          }]
        };
      }
      ;
      const groups = {};
      for (const [key, value] of Object.entries(json)) {
        const values = Array.isArray(value) ? value : [value];
        groups[key] = values.map((r, i) => r && typeof r === "object" && !Array.isArray(r) ? {
          "#": i + 1,
          ...r
        } : {
          "#": i + 1,
          value: r
        });
      }
      ctx.otherCache.set(item.sha256, {
        rows: Object.values(groups).flat(),
        groups,
        semantics: "YTBS JSON ek alanlar\u0131; \u015Febeke modeli kayna\u011F\u0131ndan ayr\u0131 tutulur"
      });
    } else ctx.otherCache.set(item.sha256, ctx.makeOtherRows(ctx.otherKind, txt));
  }
  const d = ctx.otherCache.get(item.sha256);
  note.textContent = d.semantics + " \xB7 Ham kay\u0131tlar\u0131n tam do\u011Frulu\u011Fu orijinal dosyada ve CSV d\u0131\u015Fa aktar\u0131m\u0131nda korunur.";
  if (d.groups) {
    const sel = ctx.h("select");
    const keys = Object.keys(d.groups);
    if (!keys.includes(ctx.otherTable)) ctx.otherTable = keys[0] || "";
    for (const key of keys) {
      const opt = ctx.h("option");
      opt.value = key;
      opt.textContent = key + " (" + d.groups[key].length + " kay\u0131t)";
      opt.selected = key === ctx.otherTable;
      sel.append(opt);
    }
    sel.onchange = () => {
      ctx.otherTable = sel.value;
      ctx.otherPage = 0;
      drawOtherData();
    };
    const label = ctx.h("label");
    label.textContent = "JSON s\u0131n\u0131f\u0131: ";
    label.append(sel);
    groupSelect.append(label);
  }
  function drawOtherData() {
    const data = ctx.otherCache.get(item.sha256),
      rows = data.groups ? data.groups[ctx.otherTable] || [] : data.rows;
    const q = ctx.otherQuery.toLocaleLowerCase("tr-TR");
    const filtered = q ? rows.filter(r => Object.entries(r).some(([k, v]) => k !== "__raw" && String(v ?? "").toLocaleLowerCase("tr-TR").includes(q))) : rows;
    const pages = Math.max(1, Math.ceil(filtered.length / ctx.otherPageSize));
    ctx.otherPage = Math.min(Math.max(ctx.otherPage, 0), pages - 1);
    const slice = filtered.slice(ctx.otherPage * ctx.otherPageSize, (ctx.otherPage + 1) * ctx.otherPageSize),
      keys = data.groups ? [...new Set(rows.flatMap(r => Object.keys(r || {})))] : data.headers;
    thead.replaceChildren();
    tbody.replaceChildren();
    const tr = ctx.h("tr");
    for (const key of keys) {
      const th = ctx.h("th");
      th.textContent = key;
      tr.append(th);
    }
    thead.append(tr);
    const frag = ctx.document.createDocumentFragment();
    for (const obj of slice) {
      const row = ctx.h("tr");
      row.title = obj.__raw || "";
      for (const key of keys) {
        const cell = ctx.h("td");
        const v = obj[key];
        cell.textContent = typeof v === "object" && v !== null ? JSON.stringify(v) : ctx.displayCell(v, key);
        cell.title = String(v ?? "");
        row.append(cell);
      }
      frag.append(row);
    }
    tbody.append(frag);
    info.textContent = `${filtered.length.toLocaleString("tr-TR")} / ${rows.length.toLocaleString("tr-TR")} kay\u0131t \xB7 ${keys.length} anlaml\u0131 kolon \xB7 ekran maks. 3 ondal\u0131k, indirme tam hassasiyet`;
    pageno.textContent = `Sayfa ${ctx.otherPage + 1}/${pages}`;
    prev.disabled = ctx.otherPage <= 0;
    next.disabled = ctx.otherPage >= pages - 1;
  }
  drawOtherData();
};
ctx.selectHtml = function selectHtml(label, id, values, selected) {
  return `<label class="select-line">${ctx.esc(label)}<select id="${id}">${values.map(([value, text]) => `<option value="${ctx.esc(value)}" ${selected === value ? "selected" : ""}>${ctx.esc(text)}</option>`).join("")}</select></label>`;
};
ctx.refBranchLookup = function refBranchLookup(branch, net) {
  if (!ctx.reference) return null;
  const a = Number(net.buses[branch.from]?.externalNumber),
    b = Number(net.buses[branch.to]?.externalNumber);
  const sourceEq = ctx.sourceIndex().equipment.get(branch.sourceEquipmentId);
  const candidates = [sourceEq?.fields?.ckt, sourceEq?.fields?.id, branch.circuitId, branch.ckt, branch.kind === "three-winding-leg" ? "1" : null, branch.windingId, "1"].filter(x => x !== null && x !== void 0).map(x => String(x).trim());
  for (const id of new Set(candidates)) {
    const direct = ctx.reference.branchIndex?.get(a + "|" + b + "|" + id);
    if (direct) return {
      row: direct,
      reversed: false,
      circuitId: id,
      direction: "EXACT"
    };
    const inverse = ctx.reference.branchIndex?.get(b + "|" + a + "|" + id);
    if (inverse) return {
      row: inverse,
      reversed: true,
      circuitId: id,
      direction: "REVERSE"
    };
  }
  return null;
};
ctx.optionsManifest = function optionsManifest() {
  if (ctx.lastSuccessfulGaJob && ctx.lastSuccessfulGaJob.sourceSha256 === ctx.fileSha()) return JSON.parse(JSON.stringify(ctx.lastSuccessfulGaJob));
  const form = ctx.$$("#method-form"),
    checked = name => form?.querySelector('input[name="' + name + '"]:checked')?.value || "";
  const src = ctx.sources();
  if (!src) throw Error("\xD6nce model y\xFCkleyin.");
  return {
    schema: "GA_PSSE_PSSPY_JOB_V1",
    sourceSha256: src.source.sha256,
    sourceName: src.source.name,
    method: checked("method") || ctx.currentSolveMethod,
    profile: {
      taps: checked("taps") || "lock",
      shunts: checked("shunts") || "lock",
      areaInterchange: checked("area") || "disable",
      varLimits: checked("varlim") || "immediate",
      initialVoltage: ctx.$$("#start")?.value || "saved",
      nondivergent: !!ctx.$$("#nondive")?.checked,
      phase: !!ctx.$$("#phase")?.checked,
      dcTaps: !!ctx.$$("#dc-tap")?.checked,
      mismatchMva: Number(ctx.$$("#mismatch")?.value || 500),
      minimumVarBandMvar: Number(ctx.$$("#varband")?.value || 5),
      varIteration: Number(ctx.$$("#variteration")?.value || 99),
      remoteRegulation: !!ctx.$$("#remote")?.checked
    },
    requestedAt: (/* @__PURE__ */new Date()).toISOString()
  };
};
ctx.execute = async function execute(method, options) {
  if (!ctx.live()) {
    ctx.notice("\xD6nce SAV / RAW / ZIP modeli y\xFCkleyin.");
    return;
  }
  ctx.notice(`GA ${method} hesaplan\u0131yor...`);
  ctx.$$("#solve-run")?.setAttribute("disabled", "");
  ctx.$$("#solve-dc")?.setAttribute("disabled", "");
  try {
    await ctx.ga.runPsseCalculation(method, options);
    const r = ctx.result();
    if (r?.status === "CONVERGED" && method === "NR_POLAR") {
      const candidate = ctx.optionsManifest();
      candidate.method = "NR_POLAR";
      candidate.profile.remoteRegulation = !!options?.remoteRegulation;
      candidate.profile.remoteChasing = !!options?.remoteChasing;
      candidate.gaSolverOptions = {
        ...options
      };
      candidate.gaResultId = r.id;
      candidate.gaResultClassification = r.classification;
      candidate.recordedFrom = "LAST_SUCCESSFUL_GA_RUN";
      ctx.lastSuccessfulGaJob = candidate;
    }
    ctx.notice(r ? `${method} \xB7 ${r.status}/${r.classification} \xB7 ${r.iterations} ad\u0131m \xB7 \u0394P ${ctx.tinyMismatch(r.maxPMismatchPu)} pu / \u0394Q ${ctx.tinyMismatch(r.maxQMismatchPu)} pu` : "Hesap sonucu olu\u015Fturulamad\u0131.");
    ctx.showTop();
    if (ctx.main === "nr") ctx.renderTable();
  } catch (error) {
    ctx.notice("Hesap hatas\u0131: " + String(error));
  } finally {
    ctx.$$("#solve-run")?.removeAttribute("disabled");
    ctx.$$("#solve-dc")?.removeAttribute("disabled");
  }
};
ctx.loadFile = async function loadFile(file) {
  if (!file || ctx.loadPending) return;
  ctx.loadPending = true;
  ctx.origin = "live";
  ctx.page = 0;
  ctx.query = "";
  ctx.lastRendered = "";
  ctx.loadedSignature = "";
  ctx.currentRows = [];
  ctx.currentHeaders = [];
  ctx.$$("#filter").value = "";
  ctx.notice(`${file.name} y\xFCkleniyor...`);
  ctx.reference = null;
  ctx.lastSuccessfulGaJob = null;
  ctx.otherKind = "iec";
  ctx.otherQuery = "";
  ctx.otherTable = "";
  ctx.otherPage = 0;
  ctx.otherCache.clear();
  ctx.$$(`${""}#grid-head`).replaceChildren();
  ctx.$$("#grid-body").replaceChildren();
  ctx.$$("#others-content").replaceChildren();
  try {
    if (/\.zip$/i.test(file.name)) {
      const archive = await ctx.unzipPsseBundle(file);
      await ctx.ga.loadFiles([archive.model], archive.sidecars);
    } else {
      await ctx.ga.loadFiles([file]);
    }
    if (ctx.ga.modelMode !== "PSSE") throw Error("Se\xE7ilen dosya PSS/E modeli olarak a\xE7\u0131lmad\u0131.");
    ctx.origin = "live";
    ctx.loadedSignature = ctx.ga.psseInspection.source.sha256;
    ctx.showTop();
    ctx.notice(`Native ${ctx.ga.psseInspection.source.format} \xE7\xF6z\xFCld\xFC \xB7 ${ctx.ga.psseNetwork.buses.length} bara / ${ctx.ga.psseInspection.equipment.length} envanter kayd\u0131. Hesap sonu\xE7lar\u0131 SOURCE_SAVED ile kar\u0131\u015Ft\u0131r\u0131lmaz.`);
    ctx.page = 0;
    ctx.renderNavigation();
  } catch (error) {
    ctx.origin = "live";
    ctx.currentRows = [];
    ctx.currentHeaders = [];
    ctx.notice("Dosya y\xFCklenemedi: " + String(error));
    ctx.renderNavigation();
  } finally {
    ctx.loadPending = false;
  }
};
ctx.unzipPsseBundle = async function unzipPsseBundle(file) {
  const buffer = await file.arrayBuffer(),
    v = new DataView(buffer),
    bytes = new Uint8Array(buffer),
    td = new TextDecoder("utf-8");
  const u162 = i => v.getUint16(i, true),
    u322 = i => v.getUint32(i, true);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u322(i) === 101010256) {
    end = i;
    break;
  }
  if (end < 0) throw Error("ZIP merkezi dizini bulunamad\u0131.");
  const count = u162(end + 10),
    cdOffset = u322(end + 16);
  if (count > 500) throw Error("ZIP dosya say\u0131s\u0131 s\u0131n\u0131r\u0131n\u0131 a\u015F\u0131yor.");
  let pos = cdOffset,
    total = 0;
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (u322(pos) !== 33639248) throw Error("ZIP merkezi dizini bozuk.");
    const method = u162(pos + 10),
      compressed = u322(pos + 20),
      size = u322(pos + 24),
      len = u162(pos + 28),
      extra = u162(pos + 30),
      comment = u162(pos + 32),
      offset = u322(pos + 42),
      flags = u162(pos + 8),
      name = td.decode(bytes.slice(pos + 46, pos + 46 + len));
    pos += 46 + len + extra + comment;
    if (name.endsWith("/")) continue;
    if (flags & 1) throw Error("\u015Eifreli ZIP desteklenmiyor.");
    if (![0, 8].includes(method)) throw Error("ZIP s\u0131k\u0131\u015Ft\u0131rmas\u0131 desteklenmiyor: " + method);
    if (name.includes("..") || name.startsWith("/")) throw Error("Ge\xE7ersiz ZIP giri\u015F yolu.");
    total += size;
    if (total > 150 * 1024 * 1024 || size > 100 * 1024 * 1024 || compressed > 0 && size / Math.max(compressed, 1) > 500) throw Error("ZIP \xE7\u0131kartma boyutu s\u0131n\u0131r\u0131n\u0131 a\u015F\u0131yor.");
    if (u322(offset) !== 67324752) throw Error("ZIP yerel ba\u015Fl\u0131k ge\xE7ersiz.");
    const begin = offset + 30 + u162(offset + 26) + u162(offset + 28);
    const raw = bytes.slice(begin, begin + compressed);
    let unpacked;
    if (method === 0) unpacked = raw;else {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      unpacked = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    if (unpacked.length !== size) throw Error("ZIP kay\u0131t boyutu uyu\u015Fmuyor: " + name);
    const leaf = name.split("/").at(-1);
    entries.push({
      name: leaf,
      file: new File([unpacked], leaf, {
        lastModified: file.lastModified
      })
    });
  }
  const model = entries.find(x => /\.(sav|raw|rawx)$/i.test(x.name));
  if (!model) throw Error("ZIP i\xE7inde .sav/.raw/.rawx model dosyas\u0131 bulunamad\u0131.");
  const sidecars = entries.filter(x => x !== model && /\.(iec|gcp|mon|con|json)$/i.test(x.name)).map(x => ({
    archiveName: x.name,
    file: x.file
  }));
  return {
    model: model.file,
    sidecars
  };
};
ctx.busIndex = function busIndex() {
  return new Map((ctx.ga.psseNetwork?.buses || []).map(b => [Number(b.externalNumber), b]));
};
ctx.ytmMap = function ytmMap() {
  const ar = ctx.sources()?.binaryArrays || {},
    nums = ar.Numare?.values || [],
    names = (ar.Arnam?.values || []).join("");
  return new Map(nums.map((id, i) => [Number(id), names.slice(i * 12, (i + 1) * 12).trim() || String(id)]));
};
ctx.ytmOfNumber = function ytmOfNumber(no) {
  return ctx.busAt(no)?.fields?.area ?? null;
};
ctx.stationName = function stationName(no) {
  const eq = ctx.busAt(no),
    f = eq?.fields || {},
    sid = Number(f.isub ?? f.isubst ?? f.substation ?? f.substationNumber);
  const sub = ctx.sourceIndex().stations.get(sid);
  return sub?.name || eq?.fields?.substationName || "\u2014";
};
ctx.busName = function busName(no) {
  const e = ctx.busAt(no);
  return e?.name || "\u2014";
};
ctx.refForBus = function refForBus(no) {
  if(!ctx.reference)return null;
  ctx.reference.busIndex??=new Map((ctx.reference.buses||[]).map(b=>[Number(b.busNumber),b]));
  return ctx.reference.busIndex.get(Number(no))||null;
};
ctx.branchTerminal = function branchTerminal(br, record, isHv) {
  const net = ctx.ga.psseNetwork,
    a = net.buses[br?.from],
    b = net.buses[br?.to],
    aKv = Number(a?.baseKv || 0),
    bKv = Number(b?.baseKv || 0);
  const highTo = isHv && bKv > aKv,
    actualFrom = highTo ? b : a,
    actualTo = highTo ? a : b;
  const z = br ? ctx.refBranchLookup(br, net) : null,
    r = z?.row,
    flip = Boolean(z?.reversed) !== Boolean(highTo);
  return {
    from: actualFrom,
    to: actualTo,
    gaP: highTo ? record.pToMw : record.pFromMw,
    gaQ: highTo ? record.qToMvar : record.qFromMvar,
    refP: r ? flip ? r.pToMw : r.pFromMw : null,
    refQ: r ? flip ? r.qToMvar : r.qFromMvar : null,
    gaI: highTo ? record.iToA : record.iFromA,
    loading: highTo ? record.loadingToPct : record.loadingFromPct,
    match: !!r,
    kv: Math.max(aKv, bKv)
  };
};
ctx.genRefIndex = function genRefIndex() {
  return new Map((ctx.reference?.generators || []).map(g => [Number(g.busNumber) + "|" + String(g.id).trim(), g]));
};
ctx.selectPhysicalTransformerLegs = function selectPhysicalTransformerLegs(net, results, byid, source) {
  const chosen = /* @__PURE__ */new Map(),
    score = /* @__PURE__ */new Map();
  for (const value of results) {
    const br = byid.get(value.id),
      eq = source.get(value.sourceEquipmentId);
    if (br?.kind !== "three-winding-leg" || eq?.kind !== "transformer") continue;
    const aa = net.buses[br.from],
      bb = net.buses[br.to];
    const s = Math.max(aa?.source ? Number(aa.baseKv || 0) : -1, bb?.source ? Number(bb.baseKv || 0) : -1);
    if (s > (score.get(eq.id) ?? -2)) {
      score.set(eq.id, s);
      chosen.set(eq.id, br.id);
    }
  }
  return chosen;
};
ctx.ownerType = function ownerType(eq) {
  const owners = Array.isArray(eq?.fields?.owners) ? eq.fields.owners : [];
  const candidates = [...owners.map(x => Number(x.owner)), Number(eq?.fields?.o1), Number(eq?.fields?.owner1)];
  const code = candidates.find(n => Object.hasOwn(ctx.TRANSFORMER_OWNER_TYPES, n));
  return code === void 0 ? "Di\u011Fer / tan\u0131ms\u0131z" : `${code} \xB7 ${ctx.TRANSFORMER_OWNER_TYPES[code]}`;
};
ctx.physicalKv = function physicalKv(b) {
  return Number(b?.baseKv) > 0 ? Number(b.baseKv) : null;
};
ctx.labelBus = function labelBus(b) {
  if (!b) return "\u2014";
  const name = ctx.busName(b.externalNumber);
  return `${name || "Bara"} (${b.externalNumber ?? "?"})`;
};
ctx.gaRows = function gaRows(kind) {
  const r = ctx.result(),
    net = ctx.ga.psseNetwork&&ctx.ga.psseScenario?ctx.ga.engine.fs(ctx.ga.psseNetwork,ctx.ga.psseScenario):ctx.ga.psseNetwork,
    model = ctx.sources();
  if (!r || !net || !model) return {
    headers: [],
    rows: [],
    area: [],
    matched: [],
    excluded: {
      switches: 0,
      internalLegs: 0,
      invalid: 0
    },
    coverage: {}
  };
  const eqMap = new Map(model.equipment.map(e => [e.id, e]));
  const byKey = new Map(net.buses.map(b => [b.connectionKey, b]));
  let headers = [],
    rows = [],
    area = [],
    matched = [];
  const coverage = {
    source: 0,
    idMatched: 0,
    numericPaired: 0,
    inactive: 0,
    gaMissing: 0,
    refMissing: 0
  };
  const excluded = {
    switches: 0,
    internalLegs: 0,
    invalid: 0
  };
  const add = (cells, ytm, hasId, paired, status) => {
    rows.push(cells);
    area.push(ytm == null ? "" : String(ytm));
    matched.push(Boolean(hasId));
    coverage.source++;
    if (hasId) coverage.idMatched++;else coverage.refMissing++;
    if (paired) coverage.numericPaired++;else if (status === 0) coverage.inactive++;else coverage.gaMissing++;
  };
  if (kind === "buses") {
    headers = ["Bara", "Ad\u0131", "kV", "GA V kV", "PSS/E V kV", "|\u0394V| kV", "GA \u03B8\xB0", "PSS/E \u03B8\xB0", "|\u0394\u03B8|\xB0"];
    const refs = new Map((ctx.reference?.buses || []).map(e => [Number(e.busNumber), e]));
    for (const v of r.busResults) {
      const b = byKey.get(v.connectionKey);
      if (!b) continue;
      const no = b.externalNumber,
        source = ctx.busAt(no),
        kv = ctx.physicalKv(b),
        ref = refs.get(Number(no)),
        gaPu = ctx.numberOrNull(v.vmPu),
        refPu = ctx.numberOrNull(ref?.vmPu),
        vGa = gaPu == null || kv == null ? null : gaPu * kv,
        vRef = refPu == null || kv == null ? null : refPu * kv,
        gaA = ctx.numberOrNull(v.vaDeg),
        refA = ctx.numberOrNull(ref?.vaDeg);
      add([no, source?.name || b.id, kv, vGa, vRef, ctx.absDelta(vGa, vRef), gaA, refA, ctx.angleDelta(gaA, refA)], ctx.ytmOfNumber(no), !!ref, vGa != null && vRef != null && gaA != null && refA != null, b.status);
    }
  } else if (kind === "generators") {
    headers = ["Jenerat\xF6r", "Bara ad\u0131", "kV", "Durum", "GA P MW", "PSS/E P MW", "|\u0394P| MW", "GA Q MVAr", "PSS/E Q MVAr", "|\u0394Q| MVAr"];
    const refs = ctx.genRefIndex(),
      gens = new Map(net.generators.map(g => [g.id, g]));
    for (const v of r.generatorResults) {
      const g = gens.get(v.id);
      if (!g) continue;
      const b = net.buses[g.bus],
        no = b?.externalNumber,
        e = eqMap.get(v.sourceEquipmentId),
        id = String(e?.fields?.machid ?? g.id.split(":").at(-1) ?? "1").trim(),
        rf = refs.get(Number(no) + "|" + id),
        p = ctx.numberOrNull(v.pMw),
        q = ctx.numberOrNull(v.qMvar),
        rp = ctx.numberOrNull(rf?.pMw),
        rq = ctx.numberOrNull(rf?.qMvar);
      add([e?.name || v.id, ctx.labelBus(b), ctx.physicalKv(b), g.status === 0 ? "Devre d\u0131\u015F\u0131" : "Serviste", p, rp, ctx.absDelta(p, rp), q, rq, ctx.absDelta(q, rq)], ctx.ytmOfNumber(no), !!rf, p != null && q != null && rp != null && rq != null, g.status);
    }
  } else {
    const isHv = kind === "transformers";
    headers = isHv ? ["Trafo", "YG bara", "YG kV", "AG bara", "AG kV", "Trafo t\xFCr\xFC (Owner)", "GA P MW", "PSS/E P MW", "|\u0394P| MW", "GA Q MVAr", "PSS/E Q MVAr", "|\u0394Q| MVAr"] : ["Hat ad\u0131", "Nom. kV", "Devre", "Durum", "GA P MW", "PSS/E P MW", "|\u0394P| MW", "GA Q MVAr", "PSS/E Q MVAr", "|\u0394Q| MVAr"];
    const bmap = new Map(net.branches.map(b => [b.id, b]));
    const legMap = isHv ? ctx.selectPhysicalTransformerLegs(net, r.branchResults, bmap, eqMap) : null;
    for (const v of r.branchResults) {
      const br = bmap.get(v.id),
        eq = eqMap.get(v.sourceEquipmentId);
      if (!br || !eq) continue;
      if (isHv ? eq.kind !== "transformer" : eq.kind !== "line") {
        if (!isHv && eq.kind === "switch") excluded.switches++;
        continue;
      }
      if (isHv && br.kind === "three-winding-leg" && legMap.get(eq.id) !== br.id) {
        excluded.internalLegs++;
        continue;
      }
      const t = ctx.branchTerminal(br, v, isHv),
        gaP = ctx.numberOrNull(t.gaP),
        gaQ = ctx.numberOrNull(t.gaQ),
        refP = ctx.numberOrNull(t.refP),
        refQ = ctx.numberOrNull(t.refQ);
      const hasId = Boolean(t.match),
        paired = gaP != null && gaQ != null && refP != null && refQ != null;
      if (!paired) excluded.invalid++;
      const endpoints = [net.buses[br.from], net.buses[br.to]].filter(Boolean).sort((a, b) => (ctx.physicalKv(b) || 0) - (ctx.physicalKv(a) || 0));
      const high = endpoints[0],
        low = endpoints[1];
      const cells = isHv ? [eq.name || v.id, ctx.labelBus(high), ctx.physicalKv(high), ctx.labelBus(low), ctx.physicalKv(low), ctx.ownerType(eq), gaP, refP, ctx.absDelta(gaP, refP), gaQ, refQ, ctx.absDelta(gaQ, refQ)] : [eq.name || v.id, ctx.physicalKv(t.from) || t.kv, String(eq.fields?.ckt ?? br.windingId ?? "1"), br.status === 0 ? "Devre d\u0131\u015F\u0131" : "Serviste", gaP, refP, ctx.absDelta(gaP, refP), gaQ, refQ, ctx.absDelta(gaQ, refQ)];
      add(cells, ctx.ytmOfNumber(t.from?.externalNumber), hasId, paired, br.status);
    }
  }
  return {
    headers,
    rows,
    area,
    matched,
    excluded,
    coverage
  };
};
ctx.swingSummary = function swingSummary(kind) {
  const net = ctx.ga.psseNetwork,
    buses = net?.buses || [],
    refSwing = (ctx.reference?.buses || []).filter(b => Number(b.type) === 3),
    candidates = refSwing.length ? refSwing.map(b => buses.find(x => Number(x.externalNumber) === Number(b.busNumber))).filter(Boolean) : buses.filter(b => Number(ctx.busAt(b.externalNumber)?.fields?.ide) === 3),
    bus = candidates[0];
  if (!bus) return "Swing bara (tip 3) bulunamad\u0131";
  const no = bus.externalNumber,
    src = ctx.busAt(no),
    gens = net.generators.filter(g => Number(buses[g.bus]?.externalNumber) === Number(no)),
    eqById = new Map(ctx.sources().equipment.map(e => [e.id, e])),
    refGen = (ctx.reference?.generators || []).filter(g => Number(g.busNumber) === Number(no)),
    gaGen = ctx.result()?.generatorResults || [];
  const gs = kind === "ga" ? gens.map(g => {
    const r = gaGen.find(x => x.id === g.id);
    return {
      pMw: r?.pMw,
      qMvar: r?.qMvar
    };
  }) : refGen;
  const sum = k => {
    const a = gs.map(g => ctx.numberOrNull(g[k])).filter(Number.isFinite);
    return a.length ? a.reduce((x, y) => x + y, 0) : null;
  };
  const limitSum = (key, refKey) => {
    const x = kind === "psse" ? refGen.map(g => ctx.numberOrNull(g[refKey])).filter(Number.isFinite) : [];
    if (x.length === refGen.length && x.length) return x.reduce((a, b) => a + b, 0);
    const y = gens.map(g => ctx.numberOrNull(eqById.get(g.sourceEquipmentId)?.fields?.[key])).filter(Number.isFinite);
    return y.length ? y.reduce((a, b) => a + b, 0) : null;
  };
  return `BUS ${no} \xB7 ${src?.name || "\u2014"} \xB7 ${ctx.fmtStat(Number(bus.baseKv), "kV", 1)} | Pg ${ctx.fmtStat(sum("pMw"), "MW")} \xB7 Qg ${ctx.fmtStat(sum("qMvar"), "MVAr")} | Pmax ${ctx.fmtStat(limitSum("pt", "pMaxMw"), "MW")} / Pmin ${ctx.fmtStat(limitSum("pb", "pMinMw"), "MW")} \xB7 Qmax ${ctx.fmtStat(limitSum("qt", "qMaxMvar"), "MVAr")} / Qmin ${ctx.fmtStat(limitSum("qb", "qMinMvar"), "MVAr")}`;
};
ctx.csvForExcel = comparisonCsv;
ctx.gaFilterRow = function gaFilterRow(kind) {
  const host = ctx.h("div", "gares-filters"),
    sel = ctx.h("select"),
    ytm = ctx.ytmMap();
  sel.title = "Y\xFCk Tevzi Merkezi filtresi";
  sel.innerHTML = '<option value="all">T\xFCm YTM</option>' + [...ytm.entries()].map(([id, name]) => `<option value="${id}">${ctx.esc(name)} (${id})</option>`).join("");
  sel.value = ctx.gaYtm;
  sel.onchange = () => {
    ctx.gaYtm = sel.value;
    ctx.gaResultPage = 0;
    ctx.renderGaResultRows(kind);
  };
  const areaLabel = ctx.h("span");
  areaLabel.textContent = "YTM";
  host.append(areaLabel, sel);
  const search = ctx.h("input");
  search.placeholder = "Ekipman / bara ad\u0131 ara";
  search.value = ctx.gaResultSearch;
  search.oninput = () => {
    ctx.gaResultSearch = search.value;
    ctx.gaResultPage = 0;
    ctx.renderGaResultRows(kind);
  };
  host.append(search);
  if (ctx.reference) {
    const opt = ctx.h("label", "gares-compare-toggle"),
      cb = ctx.h("input");
    cb.type = "checkbox";
    cb.checked = ctx.gaIncludeUnmatched;
    cb.onchange = () => {
      ctx.gaIncludeUnmatched = cb.checked;
      ctx.gaResultPage = 0;
      ctx.renderGaResultRows(kind);
    };
    opt.append(cb, ctx.document.createTextNode(" Eksik e\u015Fle\u015Fmeleri de g\xF6ster"));
    host.append(opt);
  }
  const csv = ctx.h("button", "btn");
  csv.textContent = "Excel uyumlu CSV";
  csv.onclick = () => {
    const set = ctx.gaRows(ctx.gaResultKind),
      matched = ctx.filteredGaRows(set);
    ctx.download("GA_PSSE_" + ctx.gaResultKind + "_Karsilastirma.csv", ctx.csvForExcel(set.headers, matched), "text/csv;charset=utf-8");
  };
  host.append(csv);
  return host;
};
ctx.init = function init() {
  ctx.root.innerHTML = `<header class="psse-header"><div class="psse-brand"><span class="psse-logo">P</span><div><strong>PSS\xAEE RAW / SAV / ZIP</strong><small>Network Data \xB7 Network Results \xB7 Power Flow Solutions</small></div></div>
    <div class="psse-actions"><span class="pill" data-chip="model">PSS/E Native Web</span><label class="btn primary upload-btn" for="pse-file"><input id="pse-file" type="file" accept=".sav,.raw,.rawx,.zip" hidden> <span> <b>\uFF0B</b> Model y\xFCkle</span></label><button class="btn" id="ga-json-download">GA JSON</button></div></header>
    <section class="psse-case"><div id="model-name">Model bekleniyor</div><div><span class="pill" data-chip="source"></span><span id="solver-status" class="pill">NOT_RUN</span></div></section>
    <nav class="psse-mainnav"><button data-main="nd" class="nav-btn selected">Network Data </button><button data-main="nr" class="nav-btn">Network Results </button><button data-main="others" class="nav-btn">Network Others </button><button data-main="solve" class="nav-btn">PSS/GA POWER FLOW SOLVE </button><button data-main="gares" class="nav-btn">GA Sonu\xE7lar\u0131 </button></nav>
    <div class="state-line"><span id="view-caption">Network Data</span><span id="notice">PSS/E kolon \u015Fablonlar\u0131 haz\u0131rlan\u0131yor...</span></div>
    <nav id="subtabs" class="subtabs"></nav><section id="table-section" class="work-area">
      <div class="table-toolbar"><span class="source-label">SOURCE_INPUT / GA_CALCULATED</span><label>Tabloda ara<input id="filter" placeholder="TM, bara, alan veya sat\u0131r de\u011Feri..."></label><button class="btn" id="export-csv">CSV</button><button class="btn primary" id="export-xlsx">Excel indir (.xlsx)</button><span data-notice="table" class="toolbar-info"></span></div>
      <div class="table-wrap"><table id="grid"><thead id="grid-head"></thead><tbody id="grid-body"></tbody></table></div>
      <footer class="grid-footer"><button class="btn" data-page="prev">\u2039 \xD6nceki</button><span data-page="index">Sayfa 1</span><span data-page="current">0</span><button class="btn" data-page="next">Sonraki \u203A</button></footer>
    </section><section id="others-section" class="work-area" hidden><div id="others-content"></div></section><section id="solve-section" class="work-area" hidden><div id="solve-content"></div></section>
    <footer class="psse-foot">Kaynak: y\xFCklenen SAV / RAW / ZIP \xB7 GA ve lisansl\u0131 PSS/E referanslar\u0131 ayr\u0131 tutulur.</footer>`;
  ctx.$$$(".nav-btn").forEach(b => b.onclick = () => {
    ctx.main = b.dataset.main;
    ctx.tabIndex = 0;
    ctx.page = 0;
    ctx.renderNavigation();
  });
  ctx.$$('[id="pse-file"]').onchange = e => ctx.loadFile(e.target.files[0]);
  ctx.$$('[id="filter"]').oninput = e => {
    ctx.query = e.target.value;
    ctx.page = 0;
    ctx.renderTable();
  };
  ctx.$$('[id="export-csv"]').onclick = ctx.exportVisible;
  ctx.$$('[id="export-xlsx"]').onclick = ctx.exportXlsx;
  ctx.$$('[data-page="prev"]').onclick = () => {
    ctx.page--;
    ctx.renderTable();
  };
  ctx.$$('[data-page="next"]').onclick = () => {
    ctx.page++;
    ctx.renderTable();
  };
  ctx.$$('[id="ga-json-download"]').onclick = () => {
    const m = ctx.sources();
    if (!m) {
      ctx.notice("\xD6nce model y\xFCkleyin.");
      return;
    }
    ctx.download(`GA_PSSE_NATIVE_${m.source.sha256.slice(0, 8)}.json`, JSON.stringify({
      model: m,
      network: ctx.ga.psseNetwork,
      calculation: ctx.ga.psseCalculation
    }, null, 1), "application/json");
  };
  const resultSource=ctx.document.createElement("select");resultSource.id="native-result-source";resultSource.setAttribute("aria-label","Network Results kayna\u011f\u0131");resultSource.append(new Option("SAV kay\u0131tl\u0131 durum","saved"),new Option("GA hesap","ga"));resultSource.hidden=true;resultSource.onchange=()=>{ctx.nativeResultSource=resultSource.value;ctx.page=0;ctx.renderNavigation();};ctx.root.querySelector(".table-toolbar").prepend(resultSource);
  ctx.showTop();
  ctx.preload();
  ctx.ga.subscribe(() => {
    if(ctx.root.hidden)return;
    const key = `${ctx.ga.modelMode}|${ctx.ga.psseInspection?.source.sha256 || ""}|${ctx.ga.psseCalculation?.id || ""}`;
    ctx.showTop();
    if (key !== ctx.lastRendered) {
      ctx.lastRendered = key;
      if (ctx.corpus && ["nr", "nd"].includes(ctx.main)) ctx.renderTable();
      if (ctx.main === "others") ctx.renderOthers();
      if (ctx.main === "gares") ctx.renderGaResults();
    }
  });
};
}
export const initializers = [
[0, ctx => { ctx.ga = ctx.window.__GA_BRIDGE__; }],
[1, ctx => { ctx.root = ctx.document.getElementById("pse-root"); }],
[2, ctx => { if (!ctx.ga) {
  ctx.root.textContent = "GA native engine ba\u015Flat\u0131lamad\u0131.";
  return;
} }],
[3, ctx => { ctx.$$ = s => ctx.root.querySelector(s); }],
[4, ctx => { ctx.$$$ = s => [...ctx.root.querySelectorAll(s)]; }],
[5, ctx => { ctx.corpus = null; }],
[6, ctx => { ctx.main = "nd"; }],
[7, ctx => { ctx.tabIndex = 0; }],
[8, ctx => { ctx.origin = "live"; }],
[9, ctx => { ctx.page = 0; }],
[10, ctx => { ctx.query = ""; }],
[11, ctx => { ctx.pageSize = 100; }],
[12, ctx => { ctx.loadedSignature = ""; }],
[13, ctx => { ctx.lastRendered = ""; }],
[14, ctx => { ctx.currentRows = []; }],
[15, ctx => { ctx.currentHeaders = []; }],
[16, ctx => { ctx.lastModel = null; }],
[17, ctx => { ctx.loadPending = false; }],
[22, ctx => { ctx.otherKind = "iec"; }],
[23, ctx => { ctx.otherPage = 0; }],
[24, ctx => { ctx.otherPageSize = 100; }],
[25, ctx => { ctx.otherQuery = ""; }],
[26, ctx => { ctx.otherTable = ""; }],
[27, ctx => { ctx.otherCache = /* @__PURE__ */new Map(); }],
[30, ctx => { ctx.h = (t, c = "", attrs = {}) => {
  const e = ctx.document.createElement(t);
  if (c) e.className = c;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}; }],
[31, ctx => { ctx.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[c]); }],
[32, ctx => { ctx.nfmt = (n, d = 3) => Number.isFinite(n) ? Number(n).toLocaleString("tr-TR", {
  maximumFractionDigits: Math.min(d, 3)
}) : "\u2014"; }],
[37, ctx => { ctx.textBundle = encoded => new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0))); }],
[38, ctx => { ctx.busCache = /* @__PURE__ */new WeakMap(); }],
[40, ctx => { ctx.sources = () => ctx.ga.psseInspection; }],
[41, ctx => { ctx.live = () => ctx.ga.modelMode === "PSSE" && !!ctx.ga.psseInspection; }],
[43, ctx => { ctx.statusLabel = () => ctx.result() ? `${ctx.result().status} / ${ctx.result().classification} / ${ctx.result().physicsCoverage}` : "Hesap hen\xFCz \xE7al\u0131\u015Ft\u0131r\u0131lmad\u0131"; }],
[44, ctx => { ctx.fileSha = () => ctx.sources()?.source?.sha256 ?? null; }],
[45, ctx => { ctx.caseMatch = () => false; }],
[46, ctx => { ctx.tempUrl = null; }],
[73, ctx => { ctx.gaYtm = "all"; }],
[75, ctx => { ctx.gaSortCol = -1; }],
[76, ctx => { ctx.gaSortDir = 1; }],
[78, ctx => { ctx.gaPageSize = 125; }],
[79, ctx => { ctx.numberOrNull = x => x === null || x === void 0 || x === "" || !Number.isFinite(Number(x)) ? null : Number(x); }],
[80, ctx => { ctx.absDelta = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) : null; }],
[81, ctx => { ctx.pctDelta = (a, b, floor) => Number.isFinite(a) && Number.isFinite(b) ? 100 * Math.abs(a - b) / Math.max(Math.abs(b), floor) : null; }],
[82, ctx => { ctx.angleDelta = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? Math.abs(((a - b + 180) % 360 + 360) % 360 - 180) : null; }],
[83, ctx => { ctx.fmtStat = (v, unit = "", digits = 2) => Number.isFinite(v) ? ctx.nfmt(v, digits) + (unit ? " " + unit : "") : "\u2014"; }],
[93, ctx => { ctx.TRANSFORMER_OWNER_TYPES = {
  300: "OTO",
  301: "TE\u0130A\u015E",
  302: "\xD6ZEL",
  303: "STEP-UP"
}; }],
[101, ctx => { ctx.gaIncludeUnmatched = true; }],
[110, ctx => { ctx.u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255]; }],
[119, ctx => { ctx.init(); }]
];
