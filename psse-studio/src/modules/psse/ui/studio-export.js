import {makeWorkbook,sheetXml} from '../../../shared/export/workbook.js';
import {workbookJob} from '../../../shared/export/workbook-job.js';
import {equipmentKindLabel} from '../model/equipment-kind.js';
import {zipParts} from '../../../shared/export/archive.js';
// Migrated V12 studio. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.parseReferenceFile = function parseReferenceFile(file) {
  return file.text().then(text => {
    const data = JSON.parse(text),
      m = ctx.sources();
    if (!m) throw Error("\xD6nce kaynak model y\xFCkleyin.");
    const sha = data.sourceSha256 || data.source_sha256 || data.source?.sha256;
    if (!sha || sha.toLowerCase() !== m.source.sha256.toLowerCase()) throw Error("PSS/E referans SHA-256 modeliyle e\u015Fle\u015Fmiyor.");
    if (!["GA_PSSE_REFERENCE_V1", "GA_PSSE_REFERENCE_V2"].includes(data.schema)) throw Error("Desteklenmeyen PSS/E referans \u015Femas\u0131.");
    if (data.solver?.solved !== 0 || data.solver?.ierr !== 0) throw Error("Yak\u0131nsamam\u0131\u015F PSS/E referans\u0131 kabul edilmedi.");
    if (!Array.isArray(data.branches) || !Array.isArray(data.buses) || !Array.isArray(data.generators)) throw Error("Bara/dal/jenerat\xF6r referans\u0131 eksik.");
    const index = /* @__PURE__ */new Map(),
      duplicates = [];
    for (const rec of data.branches) {
      const key = [Number(rec.fromBus), Number(rec.toBus), String(rec.id ?? "1").trim()].join("|");
      if (index.has(key)) duplicates.push(key);else index.set(key, rec);
    }
    if (duplicates.length) throw Error("PSS/E y\xF6nl\xFC dal anahtarlar\u0131 tekrarl\u0131: " + duplicates.length + " kay\u0131t, ilk " + duplicates[0]);
    ctx.reference = data;
    ctx.reference.branchIndex = index;
    ctx.reference.busIndex = new Map(data.buses.map(b=>[Number(b.busNumber),b]));
    ctx.reference.referenceCoverage = {
      indexedBranches: index.size,
      directedPairs: data.branches.length / 2
    };
    ctx.notice("PSS/E referans\u0131: " + index.size + " y\xF6nl\xFC dal, " + data.buses.length + " bara, " + data.generators.length + " jenerat\xF6r.");
    ctx.renderNavigation();
  });
};
ctx.benchmark = function benchmark() {
  const r = ctx.result(),
    net = ctx.ga.psseNetwork;
  if (!r || !net || !ctx.reference) return null;
  const p = [],
    q = [],
    v = [],
    a = [];
  const bn = new Map(net.buses.map(x => [x.connectionKey, x]));
  for (const item of r.busResults) {
    const bus = bn.get(item.connectionKey),
      kv = Number(bus?.baseKv);
    if (!bus || kv < 66) continue;
    const ref = ctx.refForBus(bus.externalNumber);
    if (!ref) continue;
    const dv = ctx.absDelta(ctx.numberOrNull(item.vmPu) == null ? null : ctx.numberOrNull(item.vmPu) * kv, ctx.numberOrNull(ref.vmPu) == null ? null : ctx.numberOrNull(ref.vmPu) * kv),
      da = ctx.angleDelta(ctx.numberOrNull(item.vaDeg), ctx.numberOrNull(ref.vaDeg));
    if (Number.isFinite(dv)) v.push(dv);
    if (Number.isFinite(da)) a.push(da);
  }
  const byid = new Map(net.branches.map(x => [x.id, x])),
    physicalById = new Map(ctx.sources()?.equipment.map(e => [e.id, e]) || []);
  const hvLeg = ctx.selectPhysicalTransformerLegs(net, r.branchResults, byid, physicalById);
  for (const item of r.branchResults) {
    const br = byid.get(item.id),
      src = physicalById.get(item.sourceEquipmentId);
    if (!br || !src || !["line", "transformer"].includes(src.kind)) continue;
    if (src.kind === "transformer" && br.kind === "three-winding-leg" && hvLeg.get(src.id) !== br.id) continue;
    const t = ctx.branchTerminal(br, item, src.kind === "transformer");
    if (Number(t.from?.baseKv || 0) < 66) continue;
    const dp = ctx.absDelta(ctx.numberOrNull(t.gaP), ctx.numberOrNull(t.refP)),
      dq = ctx.absDelta(ctx.numberOrNull(t.gaQ), ctx.numberOrNull(t.refQ));
    if (Number.isFinite(dp)) p.push(dp);
    if (Number.isFinite(dq)) q.push(dq);
  }
  const ag = x => ({
    count: x.length,
    mean: x.length ? x.reduce((s, y) => s + y, 0) / x.length : null,
    max: x.length ? Math.max(...x) : null
  });
  return {
    p: ag(p),
    q: ag(q),
    v: ag(v),
    a: ag(a)
  };
};
ctx.zipBundle=(files,options={})=>new Blob([zipParts(files,options)],{type:'application/zip'});
ctx.makeWorkbook=makeWorkbook;
ctx.sheetXml=sheetXml;
ctx.exportXlsx = async function exportXlsx() {
  if (!ctx.live()) {
    ctx.notice("Excel d\u0131\u015Fa aktarmak i\xE7in SAV/RAW/ZIP modeli y\xFCkleyin.");
    return;
  }
  if(ctx.exportingXlsx)return;
  ctx.exportingXlsx=true;
  const button=ctx.$$('#export-xlsx');if(button)button.disabled=true;
  const snapshot={model:ctx.sources(),network:ctx.ga.psseNetwork,scenario:ctx.ga.psseScenario,result:ctx.result(),rate:ctx.ga.settings?.value?.rateIndex,reference:ctx.reference,nativeResultSource:ctx.nativeResultSource},started=performance.now();
  const check=()=>{if(ctx.sources()!==snapshot.model||ctx.ga.psseNetwork!==snapshot.network||ctx.ga.psseScenario!==snapshot.scenario||ctx.result()!==snapshot.result||ctx.ga.settings?.value?.rateIndex!==snapshot.rate||ctx.reference!==snapshot.reference||ctx.nativeResultSource!==snapshot.nativeResultSource)throw Error('Model / senaryo / sonuç kaynağı değişti; Excel yeniden oluşturulmalı.');};
  try{
  ctx.notice("Network Data ve GA Network Results XLSX olu\u015Fturuluyor...");
  const r = ctx.result(),
    model = ctx.sources();
  const summary = [["Alan", "De\u011Fer"], [["Model", model.source.name], ["Kaynak SHA-256", model.source.sha256], ["Format", model.source.format], ["Revizyon", model.source.revision], ["Sistem baz\u0131 MVA", model.case.baseMva], ["Bara say\u0131s\u0131", model.equipment.filter(e => e.kind === "bus").length], ["Y\xF6ntem", r?.method ?? "NOT_RUN"], ["Durum", r?.status ?? "NOT_RUN"], ["Fizik kapsam\u0131", r?.physicsCoverage ?? "NOT_RUN"], ["\u0394P pu", r?.maxPMismatchPu ?? null], ["\u0394Q pu", r?.maxQMismatchPu ?? null], ["Not", "PSS/E referans de\u011Feri de\u011Fildir; yaln\u0131z y\xFCklenen model ve GA hesab\u0131d\u0131r."]]];
  const sheets = [["00-\xD6zet", summary[0], summary[1]]];
  for (const group of ["nd", "nr"]) for (let i = 0; i < ctx.corpus[group].length; i++) {
    await new Promise(resolve=>ctx.window.setTimeout(resolve,0));check();
    const cfg = ctx.corpus[group][i];
    const set = ctx.liveDataset(cfg,group);
    sheets.push([`${String(i + 1).padStart(2, "0")}-${group.toUpperCase()}-${cfg.name}`, set.headers, set.rows]);
  }
  const datasetsMs=performance.now()-started;
  const attachmentRows = (ctx.ga.psseAttachments?.items ?? []).map(item => [item.archiveName, item.format, item.byteLength, item.sha256]);
  sheets.push(["Network Others", ["Dosya", "Tip", "Bayt", "SHA-256"], attachmentRows]);
  if (r) {
    const net = ctx.ga.psseNetwork,
      eq = new Map(model.equipment.map(e => [e.id, e])),
      byId = new Map(net.branches.map(b => [b.id, b]));
    const headers = ["T\xFCr", "Ekipman ad\u0131", "Kaynak ID", "Ba\u015Flang\u0131\xE7 u\xE7", "Biti\u015F u\xE7", "Nominal kV", "GA P1 MW", "GA Q1 MVAr", "GA P2 MW", "GA Q2 MVAr", "PSS/E P1 MW (referans)", "PSS/E Q1 MVAr (referans)", "PSS/E P2 MW (referans)", "PSS/E Q2 MVAr (referans)", "GA durum"];
    const rows = r.branchResults.map(x => {
      const b = byId.get(x.id),
        from = net.buses[b?.from],
        to = net.buses[b?.to];
      return [equipmentKindLabel(eq.get(x.sourceEquipmentId)), eq.get(x.sourceEquipmentId)?.name || x.id, x.sourceEquipmentId, from?.externalNumber, to?.externalNumber, from?.baseKv, x.pFromMw, x.qFromMvar, x.pToMw, x.qToMvar, ...(() => {
        const m = b ? ctx.refBranchLookup(b, net) : null,
          z = m?.row,
          rev = m?.reversed;
        return z ? [rev ? z.pToMw : z.pFromMw, rev ? z.qToMvar : z.qFromMvar, rev ? z.pFromMw : z.pToMw, rev ? z.qFromMvar : z.qToMvar] : [null, null, null, null];
      })(), r.classification];
    });
    sheets.push(["GA Sonuclari", headers, rows]);
  }
  if (r) {
    for (const [kind, name] of [["buses", "GA-Baralar"], ["lines", "GA-Hatlar"], ["transformers", "GA-Trafolar"], ["generators", "GA-Jeneratorler"]]) {
      const set = ctx.gaRows(kind);
      sheets.push([name, set.headers, set.rows]);
    }
    const cards = ctx.resultCards();
    sheets.push(["GA-PSSE-KPI", ["Kaynak", "\xD6l\xE7\xFCt", "De\u011Fer"], [...cards.ga.map(([a, b]) => ["GA", a, b]), ...cards.pe.map(([a, b]) => ["PSSE", a, b])]]);
  }
  const comparisonMs=performance.now()-started-datasetsMs;
  ctx.xlsxJob=workbookJob(sheets,ctx.window);const blob=await ctx.xlsxJob.promise;
  check();ctx.lastXlsxExport={durationMs:performance.now()-started,datasetsMs,comparisonMs,workbookMs:performance.now()-started-datasetsMs-comparisonMs,bytes:blob.size,sheets:sheets.length};ctx.ga.metrics?.push({action:"xlsx",...ctx.lastXlsxExport});
  ctx.download(`PSSE_${model.source.name.replace(/\.(sav|raw|rawx)$/i, "")}_GA_Cozumu.xlsx`, blob);
  ctx.notice(`Excel olu\u015Fturuldu: ${sheets.length} sekme \xB7 ${Math.round(blob.size / 1024 / 1024)} MiB \xB7 yaln\u0131z y\xFCkl\xFC model.`);
  }catch(error){ctx.notice(error.message);}finally{ctx.xlsxJob=null;ctx.exportingXlsx=false;if(button)button.disabled=false;}
};
}
export const initializers = [
[21, ctx => { ctx.reference = null; }],
[108, ctx => { ctx.enc = new TextEncoder(); }],
[109, ctx => { ctx.u16 = n => [n & 255, n >> 8 & 255]; }],
[111, ctx => { ctx.crcTable = Array.from({
  length: 256
}, (_, i) => {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
  return c >>> 0;
}); }]
];
