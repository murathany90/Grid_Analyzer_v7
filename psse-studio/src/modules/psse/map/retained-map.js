import {motionPolicy,flowSource} from './motion-policy.js';
import {parallelPath} from './parallel-path.js';
import {createFlowLayer} from './flow-layer.js';
import {createMapTooltip} from './tooltip.js';
import {stationState,stationBusGroups,stationRepresentative} from './station-state.js';
import {createMapSelection} from './selection-card.js';
import {expandIncidentAcScope} from './filter-scope.js';
// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.py = function py(e2) {
  let s2 = ctx.Q(`section`, `ga-feature ga-psse-diagram ga-psse-map`),
    c2 = ctx.Q(`header`, `ga-feature-heading`),
    l2 = ctx.Q(`div`, `ga-psse-diagram-controls`),
    u2 = ctx.Q(`div`, `ga-psse-map-modebar`),
    d2 = ctx.Q(`section`, `ga-psse-map-stage`),
    f2 = ctx.Q(`div`, `ga-psse-map-stats`),
    p2 = ctx.Q(`p`, `ga-notice`),
    m2 = ctx.Q(`div`, `ga-psse-diagram-legend`),
    h2 = ctx.Q(`div`, `ga-psse-geo-stage`),
    g2 = ctx.Q(`canvas`, `ga-psse-geo-basemap`),
    _2 = ctx.sv(`svg`, {
      viewBox: `0 0 ${ctx.ny} ${ctx.ry}`,
      preserveAspectRatio: `none`,
      role: `img`,
      "aria-label": `T\xFCrkiye kaynak koordinatl\u0131 PSS/E \u015Febeke haritas\u0131`,
      class: `ga-psse-geo-svg`
    }),
    v2 = ctx.Q(`div`, `ga-psse-map-canvas`);
  c2.append(ctx.Q(`h2`, ``, `PSS/E Co\u011Frafi \u015Eebeke Haritas\u0131`), ctx.Q(`p`, `ga-muted`, `T\xFCrkiye vekt\xF6r altl\u0131\u011F\u0131 \xB7 PSS/E kaynak TM koordinatlar\u0131 \xB7 \xE7izgiler TM noktalar\u0131 aras\u0131nda \u015Fematik ve do\u011Frusald\u0131r.`));
  let y2 = ctx.Q(`input`);
  y2.type = `search`, y2.placeholder = `TM, bara veya hat ad\u0131`, y2.setAttribute(`aria-label`, `T\xFCm PSS/E modelinde bara ara`);
  let b2 = ctx.Q(`select`);
  b2.setAttribute(`aria-label`, `Arama e\u015Fle\u015Fmeleri`);
  let x2 = /* @__PURE__ */new Map(),
    S2 = ctx.Q(`div`, `ga-psse-band-filter`);
  for (let e3 of ctx.sy) {
    let t3 = ctx.Q(`input`);
    t3.type = `checkbox`, t3.checked = true, t3.id = `ga-psse-band-${e3.id}`, t3.setAttribute(`aria-label`, `${e3.label} gerilim band\u0131 filtresi`);
    let n3 = ctx.Q(`label`, `ga-check`);
    n3.append(t3, ctx.document.createTextNode(e3.label)), S2.append(n3), x2.set(e3.id, t3);
  }
  let C2 = S2,
    w2 = ctx.Q(`select`);
  let v11AreaAll = true,
    v11Areas = /* @__PURE__ */new Set(),
    v11AreaKey = "",
    v11AreaOptions = [];
  const v11YtmMenu = ctx.Q("details", "ga-map-menu ga-area-menu ga-v11-ytm"),
    v11YtmSummary = ctx.Q("summary"),
    v11YtmTitle = ctx.Q("span", "", "YTM"),
    v11YtmCount = ctx.Q("span", "", "T\xFCm\xFC"),
    v11YtmBody = ctx.Q("div", "ga-map-menu-body"),
    v11YtmSearch = ctx.Q("input"),
    v11YtmList = ctx.Q("div", "ga-area-list"),
    v11YtmActions = ctx.Q("div", "ga-menu-actions");
  v11YtmSearch.type = "search";
  v11YtmSearch.placeholder = "YTM ara";
  v11YtmSummary.append(v11YtmTitle, v11YtmCount);
  v11YtmActions.append(ctx.$("T\xFCm\xFCn\xFC se\xE7", () => v11SelectYtmAll(true)), ctx.$("Temizle", () => v11SelectYtmAll(false)));
  v11YtmBody.append(v11YtmSearch, v11YtmList, v11YtmActions);
  v11YtmMenu.append(v11YtmSummary, v11YtmBody);
  function v11AllowsArea(value) {
    return v11AreaAll || v11Areas.has(String(value));
  }
  function v11SetAreasAll() {
    v11AreaAll = true;
    v11Areas.clear();
    v11YtmCount.textContent = "T\xFCm\xFC";
  }
  function v11SelectYtmAll(all) {
    v11AreaAll = all;
    v11Areas = new Set(all ? v11AreaOptions.map(a3 => a3.value) : []);
    v11RenderYtm();
    v9FitScope();
    ct2();
  }
  function v11RenderYtm() {
    const ids = v11AreaOptions.map(a3 => a3.value);
    if (v11AreaAll) v11Areas = new Set(ids);
    const checked = ids.filter(id2 => v11Areas.has(id2)).length;
    v11YtmCount.textContent = checked === ids.length ? "T\xFCm\xFC" : checked ? `${checked}/${ids.length}` : "Se\xE7im yok";
    for (const input of v11YtmList.querySelectorAll("input[type=checkbox]")) input.checked = v11Areas.has(input.value);
    v11FilterYtm();
  }
  function v11FilterYtm() {
    const term = v11YtmSearch.value.trim().toLocaleLowerCase("tr-TR");
    for (const row of v11YtmList.children) row.hidden = !!term && !row.textContent.toLocaleLowerCase("tr-TR").includes(term);
  }
  v11YtmSearch.addEventListener("input", v11FilterYtm);
  function v11BuildYtm() {
    const items = [...w2.options].filter(o3 => o3.value).map(o3 => ({
        value: o3.value,
        label: o3.textContent ?? o3.value
      })),
      key = items.map(o3 => o3.value + "|" + o3.label).join(";");
    if (key === v11AreaKey) return;
    v11AreaKey = key;
    v11AreaOptions = items;
    v11AreaAll = true;
    v11Areas = new Set(items.map(o3 => o3.value));
    v11YtmList.replaceChildren();
    for (const a3 of items) {
      const row = ctx.Q("label", "ga-check"),
        inp = ctx.Q("input");
      inp.type = "checkbox";
      inp.value = a3.value;
      inp.checked = true;
      inp.onchange = () => {
        v11AreaAll = false;
        if (inp.checked) v11Areas.add(inp.value);else v11Areas.delete(inp.value);
        v11AreaAll = v11Areas.size === v11AreaOptions.length;
        v11RenderYtm();
        v9FitScope();
        ct2();
      };
      row.append(inp, ctx.document.createTextNode(a3.label));
      v11YtmList.append(row);
    }
    v11RenderYtm();
  }
  const v11VoltageMenu = ctx.Q("details", "ga-map-menu ga-voltage-menu ga-v11-voltage"),
    v11VoltSummary = ctx.Q("summary"),
    v11VoltLabel = ctx.Q("span", "", "Gerilim"),
    v11VoltCount = ctx.Q("span", "", "T\xFCm\xFC"),
    v11VoltBody = ctx.Q("div", "ga-map-menu-body");
  v11VoltSummary.append(v11VoltLabel, v11VoltCount);
  v11VoltBody.append(C2);
  v11VoltageMenu.append(v11VoltSummary, v11VoltBody);
  function v11RenderVoltage() {
    const total = x2.size,
      selected = [...x2.values()].filter(inp => inp.checked).length;
    v11VoltCount.textContent = selected === total ? "T\xFCm\xFC" : `${selected}/${total}`;
  }
  w2.setAttribute(`aria-label`, `YTM / AREA filtresi`);
  let T2 = ctx.Q(`select`);
  T2.setAttribute(`aria-label`, `BM / Bus OWNER filtresi`);
  let E2 = ctx.Q(`select`);
  E2.setAttribute(`aria-label`, `Harita trafo merkezi`);
  let D2 = ctx.Q(`select`);
  D2.setAttribute(`aria-label`, `Servis durumu filtresi`), D2.append(new Option(`T\xFCm durumlar`, `all`), new Option(`Serviste`, `in`), new Option(`Devre d\u0131\u015F\u0131`, `out`)), D2.value = `all`;
  let O2 = ctx.Q(`select`);
  O2.setAttribute(`aria-label`, `De\u011Fer katman\u0131`);
  O2.append(new Option(`Kaynak kayıt`, `saved`),new Option(`GA hesap`, `calculated`));
  let j2 = ctx.$(`Co\u011Frafi harita`, () => {
      be2 = `map`, ct2();
    }),
    M2 = ctx.$(`Topoloji`, () => {
      be2 = `topology`, ct2();
    });
  j2.className += ` is-active`, u2.append(j2, M2);
  let N2 = ctx.$(`S\u0131\u011Fd\u0131r`, () => {
      v9FitScope(), be2 = `map`, ct2();
    }, `Se\xE7ili YTM/TM kapsam\u0131n\u0131 s\u0131\u011Fd\u0131r; t\xFCm\xFC se\xE7iliyken T\xFCrkiye`),
    P2 = ctx.$(`Tam ekran`, () => {
      ctx.document.fullscreenElement === s2 ? ctx.document.exitFullscreen() : s2.requestFullscreen();
    }),
    F2 = ctx.$(`PNG`, () => void st2(), `G\xF6r\xFCnen haritay\u0131 PNG olarak indir`);
  N2.setAttribute(`aria-label`, `S\u0131\u011Fd\u0131r`);
  let I2 = e2.settings.value.flowDefault!==false,
    L2 = true,
    R2 = false,
    z2 = false,
    B2 = (e3, t3, n3) => {
      let r3 = ctx.Q(`label`, `ga-check`),
        i3 = ctx.Q(`input`);
      return i3.type = `checkbox`, i3.checked = t3, i3.setAttribute(`aria-label`, e3), i3.onchange = () => {
        n3(i3.checked), ct2();
      }, r3.append(i3, ctx.document.createTextNode(e3)), r3;
    },
    V2 = B2(`Ak\u0131\u015F`, I2, e3 => {
      e2.settings.update({flowDefault:e3});
    }),
    H2 = B2(`TM`, L2, e3 => {
      L2 = e3;
    }),
    U2 = B2(`Etiketler`, R2, e3 => {
      R2 = e3;
    }),
    G2 = ctx.$(`\u26A1`, () => {
      he2.element.hidden ? he2.open() : he2.element.hidden = true;
    }, `Elektriksel sonu\xE7lar`);
  G2.addEventListener(`pointerdown`, e3 => e3.stopPropagation()), G2.classList.add(`ga-psse-lightning-toggle`), G2.dataset.psseLightningToggle = ``, G2.setAttribute(`aria-label`, `Elektriksel sonu\xE7lar paneli`);
  let K2 = ctx.Q(`select`);
  K2.setAttribute(`aria-label`, `LF g\xF6r\xFCn\xFCm\xFC`), K2.append(new Option(`Baz`, `base`), new Option(`Senaryo`, `scenario`), new Option(`Fark`, `delta`));
  K2.value=e2.scenarios?.selected&&e2.scenarios.selected!=='base'?'scenario':'base';
  let q2 = ctx.Q(`select`);
  q2.setAttribute(`aria-label`, `Harita metri\u011Fi`), q2.append(new Option(`Nominal gerilim`, `nominal`), new Option(`Bara Gerilimi (kV)`, `vm`), new Option(`Bara Va (\xB0)`, `va`), new Option(`Bara gerilim ihlali`, `violation`), new Option(`Aktif g\xFC\xE7 P (MW)`, `p`), new Option(`Reaktif g\xFC\xE7 Q (Mvar)`, `q`), new Option(`Y\xFCkleme (%)`, `loading`));
  let ee2 = ctx.Q(`select`);
  ee2.setAttribute(`aria-label`, `Hat yerle\u015Fimi`), ee2.append(new Option(`Standart`, `standard`), new Option(`Ayr\u0131k hatlar`, `separated`));ee2.value='separated';
  let J2 = ctx.Q(`select`);
  J2.setAttribute(`aria-label`, `Analiz`), J2.append(new Option(`Nominal \u015febeke`, `nominal`), new Option(`Y\u00fck Ak\u0131\u015f\u0131`, `lf`));
  let te2 = ctx.Q(`div`, `ga-psse-map-toolbar-row`),
    ne2 = ctx.Q(`div`, `ga-psse-map-toolbar-row`),
    re2 = ctx.Q(`details`, `ga-map-menu ga-map-line-menu`),
    ie2 = ctx.Q(`div`, `ga-map-menu-body`);
  ie2.append(ctx.ly(`Hat yerle\u015Fimi`, ee2), ctx.ly(`LF g\xF6r\xFCn\xFCm\xFC`, K2)), re2.append(ctx.Q(`summary`, ``, `Hatlar`), ie2);
  let ae2 = ctx.Q(`details`, `ga-map-menu ga-psse-filter-menu`),
    oe2 = ctx.Q(`div`, `ga-map-menu-body`);
  oe2.append(ctx.ly(`TM`, E2), ctx.ly(`BM / OWNER`, T2), ctx.ly(`Servis durumu`, D2), ctx.ly(`E\u015Fle\u015Fmeler`, b2)), ae2.append(ctx.Q(`summary`, ``, `Filtreler`), oe2);
  let se2 = ctx.Q(`details`, `ga-map-menu ga-map-options`),
    ce2 = ctx.Q(`div`, `ga-map-menu-body`);
  ce2.append(F2, ctx.$(`Harita Ayarlar\u0131`, () => e2.setView(`settings`))), se2.append(ctx.Q(`summary`, ``, `\xD6l\xE7\xFCm`), ce2);
  let le2 = ctx.$(`Baz \xB7 Sonu\xE7 yok`, () => he2.open(`SCENARIOS`), `Senaryolar\u0131 a\xE7`);
  le2.classList.add(`ga-map-scenario-chip`), le2.dataset.psseLightningToggle = ``;
  let ue2 = ctx.$(`Sonu\xE7lar`, () => he2.open(`LF`), `Elektriksel sonu\xE7lar\u0131 a\xE7`);
  ue2.dataset.psseLightningToggle = ``;
  let de2 = ctx.$(`\u21BB`, () => void e2.runPsseCalculation(`NR_POLAR`).catch(t3 => e2.setMessage(t3 instanceof Error ? t3.message : `PSS/E hesab\u0131 tamamlanamad\u0131.`)), `Yeniden hesapla`),
    fe2 = ctx.$(`Bul`, () => {
      b2.options.length > 1 ? (b2.selectedIndex = 1, b2.dispatchEvent(new Event(`change`))) : e2.setMessage(`E\u015Fle\u015Fme bulunamad\u0131.`);
    }),
    pe2 = ctx.Q(`div`, `ga-map-search`);
  pe2.append(y2, fe2);
  y2.placeholder = "Hat / TM ara";y2.maxLength=80;
  te2.className="ga-map-toolbar-row ga-map-scope-row";ne2.className="ga-map-toolbar-row ga-map-tools-row";l2.classList.add("ga-map-toolbar");
  te2.append(v11YtmMenu, v11VoltageMenu, ctx.ly(`Hat yerle\u015fimi`, ee2), ctx.ly(`LF g\u00f6r\u00fcn\u00fcm\u00fc`, K2),ctx.ly(`Analiz`,J2), ctx.ly(`Kaynak`, O2), le2);
  ne2.append(ctx.ly(`Metrik`, q2), ae2, V2, H2, U2, pe2, ue2, de2, N2, P2, se2);
  l2.append(te2,ne2);
  let me2 = ctx.Q(`details`, `ga-psse-map-details`);
  me2.append(ctx.Q(`summary`, ``, `Teknik ayr\u0131nt\u0131lar`), c2, u2, f2, p2), h2.append(g2, _2, m2, G2), d2.append(h2, v2), me2.remove(), s2.append(l2, d2);
  let he2 = ctx.Jv(e2,{onSelect:focusEquipment,onScenarioChange:()=>{K2.value=e2.scenarios.selected==='base'?'base':'scenario';O2.value='calculated';lt2();}});
  h2.append(he2.element);
  const openResults=he2.open;he2.open=tab=>{he2.setScope({layer:Ee2,role:K2.value});openResults(tab);};
  const tooltip=createMapTooltip(h2,node=>({title:node.dataset.v12Title,lines:[node.dataset.v12Sub].filter(Boolean),columns:(node.dataset.v12Cols??'').split('|').filter(Boolean),rows:(node.dataset.v12Rows??'').split(';').filter(Boolean).map(row=>row.split('|'))}));
  let selectedStation=null;
  function highlightSelection(){
    const glyphScale=Math.max(.01,We2().k);
    for(const node of _2.querySelectorAll('.is-focus'))node.classList.remove('is-focus');
    for(const station of _2.querySelectorAll('.ga-psse-geo-station')){const circle=station.querySelector('circle');if(circle){circle.setAttribute('r',String((station.dataset.isub===String(selectedStation)?Math.max(6,e2.settings.value.siteSize):Math.max(['vm','va','violation'].includes(q2.value)?4.5:3.2,e2.settings.value.siteSize))/glyphScale));circle.setAttribute('stroke','#9bb9c2');}}
    for(const node of _2.querySelectorAll('[data-branch-id],[data-isub],[data-bus-id]'))if(node.classList.contains('ga-psse-geo-link')&&node.dataset.branchId===Se2||node.dataset.isub===String(selectedStation)||node.dataset.busId===xe2)node.classList.add('is-focus');
  }
  const ge2=createMapSelection(e2,{
    context:()=>({workspace:Y2,layer:Ee2,role:K2.value,stationBuses:id=>stationBusGroups(Y2.network,De2.associations).get(String(id))??[],allows:source=>allowedEquipment(source)}),
    onSelect:selection=>{Se2=selection.branchId??null;xe2=selection.busId??null;selectedStation=selection.stationId??null;highlightSelection();he2.setSelection(selection.equipmentId??null);},
    onActivate:()=>{K2.value='scenario';O2.value='calculated';lt2();},
    onResults:options=>he2.focus({...options,layer:Ee2,role:K2.value}),
    onSld:station=>{e2.setView('sld');ctx.window.requestAnimationFrame(()=>{const select=ctx.document.querySelector('.ga-psse-sld select[aria-label="Trafo merkezi"]');if(select&&station!=null&&[...select.options].some(o=>o.value===String(station))){select.value=String(station);select.dispatchEvent(new Event('change'));}});}
  });h2.append(ge2.element);
  let _e2=new ctx.jg();
  let v10Settings = null;
  function v10MapSettings() {
    if (v10Settings?.open) return;
    if (!v10Settings) {
      v10Settings = ctx.Q("dialog", "ga-psse-diagram-dialog ga-v10-settings");
      let head = ctx.Q("header"),
        label = ctx.Q("h3", "", "Harita Ayarlar\u0131"),
        close = ctx.$("Kapat", () => v10Settings.close());
      head.append(label, close);
      const form = ctx.Q("div", "ga-v10-settings-grid");
      v10Settings.append(head, form);
      s2.append(v10Settings);
      const options = [["400 kV", "color400", "color"], ["220 kV", "color220", "color"], ["154 kV", "color154", "color"], ["66 kV", "color66", "color"], ["\u226436 kV", "colorLow", "color"], ["Veri yok", "colorNoResult", "color"], ["Devre d\u0131\u015F\u0131", "colorOut", "color"], ["Senaryo devre d\u0131\u015F\u0131", "colorScenarioOff", "color"], ["Senaryo serviste", "colorScenarioOn", "color"], ["D\xFC\u015F\xFCk V rengi", "voltageLowColor", "color"], ["N\xF6tr V rengi", "voltageNeutralColor", "color"], ["Y\xFCksek V rengi", "voltageHighColor", "color"], ["Negatif a\xE7\u0131", "angleNegativeColor", "color"], ["N\xF6tr a\xE7\u0131", "angleNeutralColor", "color"], ["Pozitif a\xE7\u0131", "anglePositiveColor", "color"], ["400 kV kal\u0131nl\u0131\u011F\u0131 (px)", "width400", "number"], ["154 / 220 / 66 kV kal\u0131nl\u0131\u011F\u0131 (px)", "widthMid", "number"], ["Di\u011Fer hat kal\u0131nl\u0131\u011F\u0131 (px)", "widthOther", "number"], ["TM simge boyutu", "siteSize", "number"], ["Baz harita saydaml\u0131\u011F\u0131", "basemapOpacity", "number"]];
      for (const [title, key, type] of options) {
        const item = ctx.Q("label", "ga-v10-setting"),
          span = ctx.Q("span", "", title),
          inp = ctx.Q("input");
        inp.type = type;
        inp.dataset.setting = key;
        if (type === "number") {
          inp.min = key === "basemapOpacity" ? "0" : "0.5";
          inp.max = key === "basemapOpacity" ? "1" : "12";
          inp.step = key === "basemapOpacity" ? "0.05" : "0.1";
        }
        inp.addEventListener("change", () => {
          const value = type === "number" ? Number(inp.value) : inp.value;
          e2.settings.update({
            [key]: value
          });
          ct2();
        });
        item.append(span, inp);
        form.append(item);
      }
      for (let idx = 0; idx < 7; idx++) {
        const it3 = ctx.Q("label", "ga-v10-setting"),
          text = ctx.Q("span", "", `Y\xFCklenme kademe ${idx} rengi`),
          inp = ctx.Q("input");
        inp.type = "color";
        inp.dataset.setting = "loadingColor" + idx;
        inp.onchange = () => {
          e2.settings.update({
            [inp.dataset.setting]: inp.value
          });
          ct2();
        };
        it3.append(text, inp);
        form.append(it3);
      }
      const srow = ctx.Q("label", "ga-v10-setting"),
        stext = ctx.Q("span", "", "Ak\u0131\u015F h\u0131z\u0131"),
        ssel = ctx.Q("select");
      ssel.dataset.setting = "flowSpeed";
      for (const [val, title] of [["slow", "Yava\u015F"], ["normal", "Normal"], ["fast", "H\u0131zl\u0131"]]) ssel.append(new Option(title, val));
      ssel.onchange = () => {
        e2.settings.update({
          flowSpeed: ssel.value
        });
        ct2();
      };
      srow.append(stext, ssel);
      form.append(srow);
      const den = ctx.Q("label", "ga-v10-setting"),
        dl2 = ctx.Q("span", "", "Ak\u0131\u015F yo\u011Funlu\u011Fu"),
        di2 = ctx.Q("input");
      di2.type = "number";
      di2.min = "1";
      di2.max = "12";
      di2.dataset.setting = "flowDensity";
      di2.onchange = () => {
        e2.settings.update({
          flowDensity: Number(di2.value)
        });
        ct2();
      };
      den.append(dl2, di2);
      form.append(den);
      const v11RateRow = ctx.Q("label", "ga-v10-setting"),
        v11RateTitle = ctx.Q("span", "", "Y\xFCklenme paydas\u0131 (t\xFCm g\xF6r\xFCn\xFCm/\xE7\u0131kt\u0131lar)"),
        v11RateSelect = ctx.Q("select");
      v11RateSelect.setAttribute("aria-label", "Y\xFCklenme paydas\u0131 RATE");
      for (let i3 = 0; i3 < 12; i3++) v11RateSelect.append(new Option(i3 < 3 ? "RATE " + ["A", "B", "C"][i3] : "RATE " + (i3 + 1), String(i3)));
      v11RateSelect.onchange = () => {
        ctx.window.__GA_PSSE_RATE_INDEX__ = Number(v11RateSelect.value);
        try {
          ctx.window.localStorage.setItem("ga-psse-v11-rating", v11RateSelect.value);
        } catch {}
        ;
        ctx.document.dispatchEvent(new Event("ga-psse-v10-rate-change"));
      };
      v11RateRow.append(v11RateTitle, v11RateSelect);
      form.append(v11RateRow);
      const th2 = ctx.Q("div", "ga-v10-thresholds"),
        tl2 = ctx.Q("strong", "", "Y\xFCklenme e\u015Fikleri (%)");
      th2.append(tl2);
      for (let idx = 0; idx < 6; idx++) {
        let lab = ctx.Q("label", "", `E\u015Fik ${idx + 1}`),
          input = ctx.Q("input");
        input.type = "number";
        input.step = "1";
        input.min = "0";
        input.max = "500";
        input.dataset.threshold = String(idx);
        input.addEventListener("change", () => {
          let vals = [...e2.settings.value.thresholds],
            value = Number(input.value);
          if (!Number.isFinite(value) || value < 0 || value > 500) {
            input.value = String(vals[idx]);
            return;
          }
          vals[idx] = value;
          vals.sort((a3, b3) => a3 - b3);
          e2.settings.update({
            thresholds: vals
          });
          ct2();
        });
        lab.append(input);
        th2.append(lab);
      }
      form.append(th2);
      const pal = ctx.Q("label", "ga-v10-setting"),
        pall = ctx.Q("span", "", "P/Q y\xFCklenme paleti"),
        pals = ctx.Q("select");
      pals.dataset.setting = "palette";
      for (const [value, text] of [["voltage", "DGS \xF6zel renkler"], ["green", "DGS ye\u015Fil palet"]]) pals.append(new Option(text, value));
      pals.onchange = () => {
        e2.settings.update({
          palette: pals.value
        });
        ct2();
      };
      pal.append(pall, pals);
      form.append(pal);
      const qb = ctx.Q("div", "ga-v10-thresholds");
      qb.append(ctx.Q("strong", "", "Reaktif y\xFCklenme bazlar\u0131 ve Q e\u015Fikleri"));
      for (const [text, key] of [["400 kV Q baz (MVAr)", "qBase400Mvar"], ["154 kV Q baz (MVAr)", "qBase154Mvar"]]) {
        const lab = ctx.Q("label", "", text),
          input = ctx.Q("input");
        input.type = "number";
        input.min = "1";
        input.max = "10000";
        input.dataset.setting = key;
        input.onchange = () => {
          e2.settings.update({
            [key]: Number(input.value)
          });
          ct2();
        };
        lab.append(input);
        qb.append(lab);
      }
      for (let idx = 0; idx < 6; idx++) {
        const lab = ctx.Q("label", "", `Q e\u015Fi\u011Fi ${idx + 1} (%)`),
          input = ctx.Q("input");
        input.type = "number";
        input.min = "0";
        input.max = "300";
        input.dataset.qthreshold = String(idx);
        input.onchange = () => {
          let vals = [...e2.settings.value.qThresholds];
          vals[idx] = Number(input.value);
          e2.settings.update({
            qThresholds: vals
          });
          ct2();
        };
        lab.append(input);
        qb.append(lab);
      }
      form.append(qb);
    }
    for (const inp of v10Settings.querySelectorAll("[data-setting]")) inp.value = String(e2.settings.value[inp.dataset.setting] ?? "");
    for (const inp of v10Settings.querySelectorAll("[data-threshold]")) inp.value = String(e2.settings.value.thresholds?.[Number(inp.dataset.threshold)] ?? "");
    for (const inp of v10Settings.querySelectorAll("[data-qthreshold]")) inp.value = String(e2.settings.value.qThresholds?.[Number(inp.dataset.qthreshold)] ?? "");
    v10Settings.querySelector('select[aria-label="Y\xFCklenme paydas\u0131 RATE"]')?.setAttribute("data-current-rate", String(ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0));
    const rateSelect = v10Settings.querySelector('select[aria-label="Y\xFCklenme paydas\u0131 RATE"]');
    if (rateSelect) rateSelect.value = String(ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0);
    v10Settings.showModal();
  }
  let be2 = `map`,
    xe2 = null,
    Se2 = null,
    Ce2 = 1,
    we2 = 0,
    Te2 = 0,
    Ee2 = `saved`,
    Y2 = null,
    De2 = null,
    Oe2 = null,
    ke2 = /* @__PURE__ */new Map(),
    Ae2 = /* @__PURE__ */new Map();
  function je2(e3) {
    return e3 ? ke2.get(e3) ?? null : null;
  }
  function Ne2(branch,row){ge2.open(je2(branch.sourceEquipmentId),Fe2(branch),{normalizedBranch:branch,stationId:Ae2.get(Y2.network.buses[branch.from].connectionKey)?.isub});}
  function Pe2() {
    if (!Y2) return;
    Y2.model !== Oe2 && (Oe2 = Y2.model, ke2 = new Map(Oe2.equipment.map(e4 => [e4.id, e4])), De2 = ctx.Zs(Oe2, Y2.base), Ae2 = new Map(De2.associations.map(e4 => {
      let t4 = De2.stations.find(t5 => t5.isub === e4.stationIsub);
      return [e4.connectionKey, t4];
    })));
    let e3 = Y2.network,
      t3 = Y2.model;
    [...new Set(e3.buses.filter(e4 => e4.source).map(e4 => ctx.yv(e4.baseKv)))].sort((e4, t4) => e4 === `unknown` ? 1 : t4 === `unknown` ? -1 : Number(t4) - Number(e4)), ctx.uy(w2, ctx.dy(new Set(e3.buses.filter(e4 => e4.source).map(e4 => ctx.hv(e4, t3, ke2)))).map(e4 => ({
      ...e4,
      label: ctx._v(t3, e4.value)
    })), `T\xFCm YTM / AREA`), ctx.uy(T2, ctx.dy(new Set(e3.buses.filter(e4 => e4.source).map(e4 => ctx.gv(e4, t3, ke2)))).map(e4 => ({
      ...e4,
      label: ctx.vv(t3, e4.value)
    })), `T\xFCm BM / OWNER`), ctx.uy(E2, (De2?.stations ?? []).filter(e4 => !w2.value || De2.associations.some(t4 => t4.stationIsub === e4.isub && v11AllowsArea(String(t4.busSourceFields.area)))).map(e4 => ({
      value: e4.isub,
      label: e4.name
    })), `T\xFCm TM`), v11BuildYtm(), v11RenderVoltage(), Ie2();
  }
  function Fe2(e3) {
    return Y2 ? ctx.Lv(Y2.model, Y2.base).branch(e3) : `Hat`;
  }
  function Ie2() {
    if (!Y2) {
      ctx.uy(b2, [], `Ara / se\xE7`);
      return;
    }
    let e3 = ctx.lv(y2.value),
      t3 = ctx.Lv(Y2.model, Y2.base),
      n3 = Y2.network.buses.filter(n4 => !e3 || ctx.lv(t3.busSearchText(n4)).includes(e3)),
      r3 = e3 ? Y2.network.branches.filter(n4 => n4.kind === `line` && String(n4.sourceEquipmentId).startsWith(`line:`) && ctx.lv(`${Fe2(n4)} ${t3.branchTitle(n4)}`).includes(e3)) : [],
      i3 = [...n3.map(e4 => ({
        value: `bus:${e4.id}`,
        label: `${t3.bus(e4)} \xB7 ${ctx.bv(e4.baseKv)}`
      })), ...r3.map(e4 => ({
        value: `branch:${e4.id}`,
        label: Fe2(e4)
      }))];
    ctx.uy(b2, i3.slice(0, 60), `Ara / se\xE7`), b2.title = i3.length > 60 ? `\u0130lk 60 sonu\xE7 g\xF6steriliyor; toplam ${i3.length}. Daha \xF6zg\xFCl arama yaz\u0131n.` : `${i3.length} e\u015Fle\u015Fme`;
  }
  function Le2(t3) {
    if (!Y2) return;
    let n3 = Y2.network,
      r3 = Ae2.get(n3.buses[t3.from].connectionKey),
      i3 = Ae2.get(n3.buses[t3.to].connectionKey);
    if (!r3 || !i3) {
      e2.setMessage(`Hat u\xE7lar\u0131 i\xE7in kaynak koordinat\u0131 bulunamad\u0131.`);
      return;
    }
    v11SetAreasAll(), T2.value = ``, E2.value = ``, D2.value = `all`;
    for (let e3 of x2.values()) e3.checked = true;
    let a3 = ctx.kg(r3.longitude, r3.latitude),
      o3 = ctx.kg(i3.longitude, i3.latitude);
    we2 = -(a3[0] + o3[0]) / 2 * He2(), Te2 = -(a3[1] + o3[1]) / 2 * He2(), xe2 = null, Se2 = t3.id, be2 = `map`;
  }
  function focusEquipment(id){
    if(!Y2)return;const source=ke2.get(id);if(!source){e2.setMessage('Kaynak ekipman kimliği bulunamadı.');return;}if(!allowedEquipment(source)){e2.setMessage('Ekipman YTM / gerilim kapsamı dışında.');return;}
    const net=ze2(),branches=net.branches.filter(b=>b.sourceEquipmentId===id),bus=source.kind==='bus'?net.buses.find(b=>b.sourceEquipmentId===id):source.kind==='generator'?net.buses[net.generators.find(g=>g.sourceEquipmentId===id)?.bus]:null,indices=bus?[net.buses.indexOf(bus)]:[...new Set(branches.flatMap(b=>[b.from,b.to]).filter(i=>net.buses[i]?.source))],stations=source.kind==='substation'?De2.stations.filter(st=>st.sourceEquipmentId===id):indices.map(i=>Ae2.get(net.buses[i].connectionKey));
    if(!stations.length||stations.some(st=>!st||!Number.isFinite(st.longitude)||!Number.isFinite(st.latitude))){e2.setMessage('Kaynak TM koordinatı eksik; harita odağı değiştirilmedi.');return;}
    const points=stations.map(st=>ctx.kg(st.longitude,st.latitude)),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;Ce2=Math.max(3,Math.min(10,ctx.ny*.65/(Math.max(.05,Math.max(...xs)-Math.min(...xs))*ctx.iy),ctx.ry*.65/(Math.max(.05,Math.max(...ys)-Math.min(...ys))*ctx.iy)));we2=-cx*ctx.iy*Ce2;Te2=-cy*ctx.iy*Ce2;be2='map';
    const sameStation=stations.every(st=>st.isub===stations[0].isub);if(h2.clientWidth<1280)he2.close();ge2.open(source,source.kind==='line'?Fe2(branches[0]):source.name,{normalizedBranch:branches[0],normalizedBus:bus,stationId:stations[0].isub,highlightStation:sameStation});ct2();e2.setMessage('Harita · '+source.name);
  }
  function Re2() {
    return ctx.sy.filter(e3 => !x2.get(e3.id).checked);
  }
  function v13IncidentYtm(branch,network){
    const admits=bus=>v11AllowsArea(ctx.hv(bus,Y2.model,ke2))&&(!T2.value||String(ctx.gv(bus,Y2.model,ke2))===T2.value)&&(!E2.value||String(Ae2.get(bus.connectionKey)?.isub)===E2.value);
    return admits(network.buses[branch.from])||admits(network.buses[branch.to]);
  }
  function ze2() {
    return Ee2 === `saved` || K2.value === `base` ? Y2.base : Y2.network;
  }
  function Be2() {
    let e3 = ze2(),
      t3 = Re2(),
      n3 = t3.length === 0,
      r3 = w2.value,
      i3 = T2.value,
      a3 = D2.value,
      o3 = /* @__PURE__ */new Set();
    e3.buses.forEach((e4, s3) => {
      if (e4.source) {
        if (!n3) {
          let n4 = ctx.cy(e4.baseKv);
          if (n4 === `unknown` || t3.some(e5 => e5.id === n4)) return;
        }
        !v11AllowsArea(ctx.hv(e4, Y2.model, ke2)) || i3 && String(ctx.gv(e4, Y2.model, ke2)) !== i3 || ctx.wv(e4.status, a3) && (E2.value && String(Ae2.get(e4.connectionKey)?.isub) !== E2.value || o3.add(s3));
      }
    });
    o3=expandIncidentAcScope(e3,o3);
    for (let t4 of e3.branches) {
      if (!ctx.wv(t4.status, a3)) continue;
      let n4 = e3.buses[t4.from],
        r4 = e3.buses[t4.to];
      n4.source && !r4.source && o3.has(t4.from) && o3.add(t4.to), r4.source && !n4.source && o3.has(t4.to) && o3.add(t4.from);
    }
    return o3;
  }
  function allowedEquipment(source){if(!Y2)return false;const net=ze2(),scope=Be2();return source.kind==='substation'?De2.associations.some(a=>String(a.stationIsub)===String(source.fields.isub)&&net.buses.some((b,i)=>b.connectionKey===a.connectionKey&&scope.has(i))):source.kind==='bus'?net.buses.some((b,i)=>b.sourceEquipmentId===source.id&&scope.has(i)):source.kind==='generator'?net.generators.some(g=>g.sourceEquipmentId===source.id&&scope.has(g.bus)):net.branches.some(b=>b.sourceEquipmentId===source.id&&(b.kind==='line'?scope.has(b.from)&&scope.has(b.to):scope.has(b.from)||scope.has(b.to))&&v13IncidentYtm(b,net));}
  function v9FitScope() {
    if (!Y2 || !De2) {
      Ce2 = 1;
      we2 = Te2 = 0;
      return;
    }
    const area = !v11AreaAll,
      owner = T2.value,
      site = E2.value;
    let stations = De2.stations;
    if (area || owner) {
      const selected = new Set([...Be2()].map(i=>ze2().buses[i].connectionKey)),
        ids = new Set(De2.associations.filter(a3 => selected.has(a3.connectionKey)).map(a3 => a3.stationIsub));
      stations = stations.filter(t3 => ids.has(t3.isub));
    }
    if (!site && !area && !owner || !stations.length) {
      Ce2 = 1;
      we2 = Te2 = 0;
      return;
    }
    const pts = stations.filter(t3 => Number.isFinite(t3.longitude) && Number.isFinite(t3.latitude)).map(t3 => ctx.kg(t3.longitude, t3.latitude));
    if (!pts.length) {
      Ce2 = 1;
      we2 = Te2 = 0;
      return;
    }
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const [x3, y3] of pts) {
      x0 = Math.min(x0, x3);
      x1 = Math.max(x1, x3);
      y0 = Math.min(y0, y3);
      y1 = Math.max(y1, y3);
    }
    const dx = Math.max(1.2, x1 - x0),
      dy2 = Math.max(0.9, y1 - y0);
    Ce2 = Math.max(1, Math.min(9, ctx.ny * 0.76 / (dx * ctx.iy), ctx.ry * 0.76 / (dy2 * ctx.iy)));
    we2 = -(x0 + x1) * ctx.iy * Ce2 / 2;
    Te2 = -(y0 + y1) * ctx.iy * Ce2 / 2;
  }
  function Ve2() {
    return {
      width: ctx.ny,
      height: ctx.ry,
      center: {
        x: 0,
        y: 0
      },
      scale: ctx.iy,
      zoom: Ce2,
      panX: we2,
      panY: Te2
    };
  }
  function He2() {
    return ctx.iy * Ce2;
  }
  function Ue2(e3) {
    let [t3, n3] = ctx.kg(e3.longitude, e3.latitude);
    return ctx.$v(Ve2()).project({
      x: t3,
      y: n3
    });
  }
  function We2() {
    let e3 = _2.getBoundingClientRect();
    return {
      rect: e3,
      k: ctx.$v(Ve2()).screenScale(e3)
    };
  }
  let renderedGeometry=[],renderedFlows=[],geometryScale=0;
  function refreshGeometry(scale){
    if(!renderedGeometry.length||Math.abs(scale-geometryScale)<1e-8)return;
    geometryScale=scale;
    for(const item of renderedGeometry){item.flow.path=parallelPath(item.from,item.to,{...item.options,scale});item.element.setAttribute('d',item.flow.path.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '));}
    flowLayer.setLines(renderedFlows);
  }
  let v11SvgBasis = null,
    v11SettleTimer = 0;
  function Ge2() {
    h2.dataset.detail = Ce2 < 1.5 ? `low` : `high`;
    let {
        rect: t3,
        k: n3
      } = We2(),
      r3 = ctx.$v(Ve2()).svgViewBox(t3),
      i3 = ctx.window.devicePixelRatio || 1;
    g2.width !== Math.max(1, Math.round(t3.width * i3)) && (g2.width = Math.max(1, Math.round(t3.width * i3))), g2.height !== Math.max(1, Math.round(t3.height * i3)) && (g2.height = Math.max(1, Math.round(t3.height * i3))), g2.style.width = `100%`, g2.style.height = `100%`, _2.setAttribute(`viewBox`, `${r3.x} ${r3.y} ${r3.width} ${r3.height}`), _2.setAttribute(`preserveAspectRatio`, `xMidYMid meet`);
    if (v11SvgBasis) {
      const ratio = Ce2 / v11SvgBasis.zoom;
      const tx = ctx.ny / 2 + we2 - ratio * (ctx.ny / 2 + v11SvgBasis.panX),
        ty2 = ctx.ry / 2 + Te2 - ratio * (ctx.ry / 2 + v11SvgBasis.panY);
      for (const group of _2.children) if (group.tagName.toLowerCase() === "g") group.setAttribute("transform", `matrix(${ratio} 0 0 ${ratio} ${tx} ${ty2})`);
      refreshGeometry(n3*ratio);
    }
    _e2.render(g2, t3.width, t3.height, ctx.iy * n3 * Ce2, we2 * n3, Te2 * n3, Ce2, e2.settings.value), Object.assign(h2.dataset, {
      zoom: String(Ce2),
      panX: String(we2),
      panY: String(Te2),
      screenScale: String(n3)
    });
  }
  let v10Frame = 0;
  function v10Viewport() {
    if (v10Frame) return;
    v10Frame = ctx.window.requestAnimationFrame(() => {
      v10Frame = 0;
      if (!Y2 || be2 !== `map`) return;
      Ge2();
    });
  }
  function Ke2(e3) {
    xe2 = e3.id, Se2 = null, v11SetAreasAll(), T2.value = ``, E2.value = ``, D2.value = `all`;
    for (let e4 of x2.values()) e4.checked = true;
    let t3 = Ae2.get(e3.connectionKey);
    if (!t3) {
      be2 = `topology`;
      return;
    }
    let [n3, r3] = ctx.kg(t3.longitude, t3.latitude);
    we2 = -n3 * He2(), Te2 = -r3 * He2(), be2 = `map`;
  }
  function qe2() {
    return !!Y2 && ctx.Rv(Y2, e2.psseBaseCalculation).ready;
  }
  function Je2(t3) {
    let n3 = q2.value === `loading` ? `loading` : q2.value === `q` ? `q` : q2.value === `vm` || q2.value === `va` ? `v` : `p`;
    return ctx.fu(t3, {
      ...e2.settings.value,
      deltaMetric: n3
    });
  }
  function Ye2() {
    let e3 = new Map(Y2.base.branches.map(e4 => [e4.id, e4])),
      t3 = new Map(Y2.base.buses.map(e4 => [e4.connectionKey, e4]));
    return {
      branch: t4 => {
        let n3 = e3.get(t4.id);
        return !!n3 && t4.sourceEquipmentId === n3.sourceEquipmentId && t4.terminalFrom === n3.terminalFrom && t4.terminalTo === n3.terminalTo;
      },
      bus: e4 => {
        let n3 = t3.get(e4.connectionKey);
        return !!n3 && e4.id === n3.id && e4.sourceEquipmentId === n3.sourceEquipmentId;
      }
    };
  }
  function Xe2() {
    if (!Y2) return;
    let t3 = ctx.Rv(Y2, e2.psseBaseCalculation),
      n3 = Ee2 === `saved`,
      r3 = Ee2 === `delta`,
      i3 = K2.value === `base` ? t3.base : t3.scenario,
      a3 = e3 => [...e3].some(e4 => typeof e4 == `number` && Number.isFinite(e4)),
      o3 = Ye2(),
      s3 = new Map(t3.base?.busResults.filter(o3.bus).map(e3 => [e3.connectionKey, e3]) ?? []),
      c3 = new Map(t3.base?.branchResults.filter(o3.branch).map(e3 => [e3.id, e3]) ?? []),
      l3 = e3 => n3 ? a3(Y2.base.buses.filter(e4 => e4.source).map(t4 => e3 === `vmPu` ? ctx.Sv(t4, Y2.model, ke2) : ctx.Cv(t4, Y2.model, ke2))) : r3 ? t3.ready && t3.scenario.busResults.filter(o3.bus).some(t4 => ctx.zv(s3.get(t4.connectionKey)?.[e3], t4[e3]) !== null) : a3(i3?.busResults.filter(o3.bus).map(t4 => t4[e3]) ?? []),
      u3 = e3 => {
        let s4 = t4 => e3 === `iFromA` ? t4?.iFromA ?? t4?.iToA : e3 === `loadingFromPct` ? t4?.loadingFromPct ?? t4?.loadingToPct : t4?.[e3];
        return !n3 && (r3 ? t3.ready && t3.scenario.branchResults.filter(o3.branch).some(t4 => {
          let n4 = c3.get(t4.id);
          return e3 === `loadingFromPct` ? (ctx.zv(n4?.loadingFromPct, t4.loadingFromPct) ?? ctx.zv(n4?.loadingToPct, t4.loadingToPct)) !== null : ctx.zv(s4(n4), s4(t4)) !== null;
        }) : a3(i3?.branchResults.filter(o3.branch).map(s4) ?? []));
      },
      d3 = Y2.base.buses.some(e3 => {
        let t4 = ke2.get(e3.sourceEquipmentId ?? ``)?.fields;
        return [t4?.nvlo, t4?.nvhi].every(e4 => e4 != null && e4 !== `` && Number.isFinite(Number(e4)) && Number(e4) > 0);
      }),
      f3 = {
        nominal: true,
        vm: l3(`vmPu`),
        va: l3(`vaDeg`),
        violation: !r3 && l3(`vmPu`) && d3,
        p: u3(`pFromMw`),
        q: u3(`qFromMvar`),
        current: !r3 && u3(`iFromA`),
        loss: !r3 && u3(`pLossMw`),
        loading: u3(`loadingFromPct`)
      };
    for (let opt of q2.options) {
      opt.disabled = !f3[opt.value];
      opt.title = opt.disabled ? n3 ? `Kaynak SAV kayd\u0131 bu metrik i\xE7in \xE7\xF6z\xFCmlenmi\u015F hat/trafo P-Q-I-kay\u0131p-y\xFCklenme sonu\xE7lar\u0131 i\xE7ermez. \xD6nce NR/FDNS hesaplay\u0131p Kaynak: GA hesap se\xE7in.` : r3 && !t3.ready ? t3.reason ?? `Baz ve senaryo hesap kimlikleri uyu\u015Fmuyor; fark g\xF6sterilemez.` : `Se\xE7ili g\xFCncel ${i3?.method ?? `GA`} hesap sonucunda bu metrik yok veya yaln\u0131z desteklenmeyen fizik s\xF6z konusu.` : `Bu metrik se\xE7ili ${n3 ? `kaynak kay\u0131t` : `GA hesap`} anl\u0131k g\xF6r\xFCnt\xFCs\xFCnden okunur.`;
    }
    q2.title = q2.selectedOptions[0]?.title ?? ``;
    O2.title = n3 ? `Kaynakta kaydedilmi\u015F Vm/Va ile hesaplanan ak\u0131\u015Flar ayr\u0131 tutulur.` : `Yaln\u0131z model/senaryo/ayar kimli\u011Fi ge\xE7erli GA hesab\u0131 kullan\u0131l\u0131r.`;
  }
  function Ze2() {
    m2.replaceChildren();
    let t3 = q2.value,
      n3 = Ee2 === `delta`;
    if (t3 === `nominal`) {
      let t4 = ctx.Q(`div`, `ga-psse-nominal-legend`);
      t4.append(ctx.Q(`strong`, ``, `Nominal gerilim`));
      for (let n4 of ctx.sy) {
        let r4 = ctx.Q(`div`),
          i4 = ctx.Q(`i`);
        i4.style.backgroundColor = ctx.fy(n4.min === 0 ? 36 : n4.min + 1, e2), r4.append(i4, ctx.document.createTextNode(n4.label)), t4.append(r4);
      }
      t4.append(ctx.Q(`small`, ``, `Gri: veri yok \xB7 kesik: devre d\u0131\u015F\u0131`)), m2.append(t4);
      return;
    }
    let r3 = (n3 ? `Senaryo \u2212 baz \xB7 ` : ``) + ({
        vm: `Bara Gerilimi (kV)`,
        va: `Bara Va (\xB0)`,
        violation: `Bara gerilim ihlali`,
        p: `Hat / trafo P (MW)`,
        q: `Hat / trafo Q (Mvar)`,
        current: `Hat / trafo ak\u0131m\u0131 I (A)`,
        loss: `Hat / trafo aktif kayb\u0131 (MW)`,
        loading: `Hat / trafo y\xFCkleme (%)`
      }[t3] ?? t3),
      settings=e2.settings.value,description=t3==='violation'?'İhlal · sınır içinde · veri yok':t3==='vm'?`Renk: V/Vn (%) · ${[settings.voltageMin,settings.voltageNeutral,settings.voltageMax].map(v=>ctx.ov(v*100,1)).join(' / ')}`:t3==='loading'?`RATE ${(ctx.window.__GA_PSSE_RATE_INDEX__??0)+1} · ${settings.thresholds.map(v=>ctx.ov(v,1)).join(' / ')} %`:t3==='q'?'Negatif Q · nötr · pozitif Q':t3==='va'?'Negatif açı · nötr · pozitif açı':'Negatif P · nötr · pozitif P';
    m2.append(ot2(r3,description,n3?'delta':t3==='vm'?'voltage':t3==='loading'?'loading':t3==='violation'?'violation':'delta'));
  }

  let v9ScaleCache = {
    result: null,
    metric: null,
    scale: 100
  };
  function v9MetricScale() {
    if (!["p","current","loss"].includes(q2.value)) return 100;
    if (!Y2) return 100;
    let snap = ctx.Rv(Y2, e2.psseBaseCalculation),
      calc = K2.value === `base` ? snap.base : snap.scenario;
    if (!calc) return 100;
    if (v9ScaleCache.result === calc && v9ScaleCache.metric === q2.value) return v9ScaleCache.scale;
    let vals = calc.branchResults.map(r3 => q2.value === `current` ? Math.max(Math.abs(r3.iFromA ?? 0), Math.abs(r3.iToA ?? 0)) : q2.value==='p'?Math.max(Math.abs(r3.pFromMw??0),Math.abs(r3.pToMw??0)):Math.abs(r3.pLossMw ?? 0)).filter(v3 => Number.isFinite(v3) && v3 > 0).sort((a3, b3) => a3 - b3),
      scale = Math.max(q2.value === `current` ? 1 : 0.01, vals[Math.floor(vals.length * 0.95)] ?? 1);
    v9ScaleCache = {
      result: calc,
      metric: q2.value,
      scale
    };
    return scale;
  }
  function Qe2(t3, n3) {
    let r3 = e2.settings.value;
    if (q2.value === `va`) return ctx.yg(t3 ?? void 0, r3.angleMin, r3.angleNeutral, r3.angleMax, r3.angleNegativeColor, r3.angleNeutralColor, r3.anglePositiveColor, r3.colorNoResult);
    let i3 = q2.value === `p` ? r3.deltaP : q2.value === `q` ? r3.deltaQ : n3;
    return ctx.yg(t3 ?? void 0, -i3, 0, i3, r3.angleNegativeColor, r3.angleNeutralColor, r3.anglePositiveColor, r3.colorNoResult);
  }
  function $e2(e3) {
    return q2.value === `p` ? e3?.pFromMw : q2.value === `q` ? e3?.qFromMvar : q2.value === `current` ? e3?.iFromA ?? e3?.iToA : q2.value === `loss` ? e3?.pLossMw : q2.value === `loading` ? e3?.loadingFromPct ?? e3?.loadingToPct : null;
  }
  function et2(e3, t3) {
    return q2.value === `loading` ? ctx.zv(e3?.loadingFromPct, t3?.loadingFromPct) ?? ctx.zv(e3?.loadingToPct, t3?.loadingToPct) : ctx.zv($e2(e3), $e2(t3));
  }
  let statusBase=null,baseStatuses=new Map();
  function v12LineStyle(branch, metric, load, flow, delta) {
    flow=typeof flow==='number'&&Number.isFinite(flow)?flow:null;
    const opt = e2.settings.value,
      kv2 = Y2.base.buses[branch.from]?.baseKv ?? Y2.base.buses[branch.to]?.baseKv ?? 0;
    const band = ctx.cy(kv2);
    const nominal = ctx.fy(kv2, e2);
    const baseWidth = kv2 >= 300 ? opt.width400 : kv2 > 36 ? opt.widthMid : opt.widthOther;
    if(statusBase!==Y2.base){statusBase=Y2.base;baseStatuses=new Map(Y2.base.branches.map(b=>[b.id,b.status]));}
    if(K2.value!=='base'&&baseStatuses.get(branch.id)!==branch.status)return {color:branch.status===1?opt.colorScenarioOn:opt.colorScenarioOff,width:Math.max(baseWidth,2.5),opacity:.9,dash:branch.status===1?'none':'8 5'};
    if (branch.status !== 1) return {
      color: opt.colorOut,
      width: baseWidth,
      opacity: 0.5,
      dash: "8 5"
    };
    let color = nominal,
      width = baseWidth,
      opacity = 0.9;
    if (["vm","va","violation"].includes(metric)){color="#526879";opacity=.6;}else if (metric === "loading") color = ctx.Cg(load, opt);else if (metric === "q") {
      const mag = flow === null ? null : Math.abs(flow),
        qbase = kv2 >= 300 ? opt.qBase400Mvar : opt.qBase154Mvar,
        rate = mag === null ? null : 100 * mag / qbase;
      color = rate === null ? opt.colorNoResult : (opt.palette === "green" ? ["#d8f3df", "#c5ecd1", "#abe4bc", "#68ca8e", "#47b87d", "#329f68", "#176943"] : [opt.loadingColor0, opt.loadingColor1, opt.loadingColor2, opt.loadingColor3, opt.loadingColor4, opt.loadingColor5, opt.loadingColor6])[Math.min(6, opt.qThresholds.filter(v3 => rate >= v3).length)];
    } else if (metric === "p") {
      if (flow === null) {
        color = opt.colorNoResult;
        opacity = 0.6;
      } else {
        const m3 = Math.min(1, Math.abs(flow) / v9MetricScale());
        width = Math.min(5, baseWidth + 0.3 + 1.5 * m3 * opt.magnitudeIntensity);
        opacity = Math.min(1, 0.35 + 0.65 * m3 * opt.magnitudeIntensity);
      }
    } else if (["current", "loss"].includes(metric)) {
      color = flow === null ? opt.colorNoResult : Qe2(flow, v9MetricScale());
    } else if (metric === "delta") {
      color = Je2(delta);
    }
    return {
      color,
      width,
      opacity,
      dash: "none"
    };
  }
  function tt2(t3, n3, r3, i3) {
    if (q2.value === `nominal`) return ctx.fy(Y2.base.buses[t3.from].baseKv, e2);
    let a3 = q2.value === `loading` ? ctx.v10RatePct(t3, n3, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0) : $e2(n3);
    return Ee2 === `delta` ? Je2(i3 ? q2.value === `loading` ? ctx.v10RatePct(t3, n3, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0) !== null && ctx.v10RatePct(t3, r3, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0) !== null ? ctx.v10RatePct(t3, n3, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0) - ctx.v10RatePct(t3, r3, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0) : null : et2(r3, n3) : null) : q2.value === `loading` ? ctx.Cg(a3, e2.settings.value) : Qe2(a3, v9MetricScale());
  }
  let flowAvailable=false,flowMode='p';
  const policy=()=>motionPolicy({requested:e2.settings.value.flowDefault!==false,available:flowAvailable,mode:flowMode,zoom:Ce2});
  const flowLayer=createFlowLayer({stage:h2,svg:_2,window:ctx.window,settings:()=>e2.settings.value,state:()=>({enabled:e2.view==='map'&&e2.modelMode==='PSSE'&&be2==='map'&&policy().enabled,mode:flowMode,zoom:Ce2,selected:Se2})});
  function rt2(){I2=e2.settings.value.flowDefault!==false;V2.querySelector('input').checked=I2;V2.querySelector('input').disabled=false;V2.removeAttribute('title');flowLayer.refresh();}

  function it2(t3) {
    renderedGeometry=[];renderedFlows=[];geometryScale=0;
    if (h2.hidden = be2 !== `map`, v2.hidden = be2 !== `topology`, Ge2(), _2.replaceChildren(), v11SvgBasis = {
      zoom: Ce2,
      panX: we2,
      panY: Te2
    }, !De2 || !Y2) return [];
    let n3 = ze2(),
      r3 = /* @__PURE__ */new Map();
    for (let [e3, i4] of n3.buses.entries()) {
      let n4 = Ae2.get(i4.connectionKey);
      n4 && t3.has(e3) && (r3.get(n4.isub) ?? (r3.set(n4.isub, []), r3.get(n4.isub))).push(e3);
    }
    const v10Stations = /* @__PURE__ */new Set();
    const activeBuses = new Set();
    for(const branch of n3.branches)if(branch.status===1&&(branch.kind==='transformer'||branch.kind==='three-winding-leg'||branch.kind==='line'&&String(branch.sourceEquipmentId).startsWith('line:'))){activeBuses.add(branch.from);activeBuses.add(branch.to);}
    for(const group of [n3.generators,n3.loads,n3.shunts])for(const equipment of group)if(equipment.status===1)activeBuses.add(equipment.bus);
    for (const [idx, bus] of n3.buses.entries()) {
      if (t3.has(idx) && bus.status === 1 && activeBuses.has(idx)) {
        let site = Ae2.get(bus.connectionKey);
        if (site) v10Stations.add(site.isub);
      }
    }
    for (const branch of n3.branches) {
      if (branch.kind !== `line` || !String(branch.sourceEquipmentId).startsWith(`line:`) || branch.status !== 1 || !t3.has(branch.from) || !t3.has(branch.to)) continue;
      for (const index of [branch.from, branch.to]) {
        const site = Ae2.get(n3.buses[index]?.connectionKey);
        if (site) v10Stations.add(site.isub);
      }
    }
    const v12MapSettings = e2.settings.value,glyphScale=Math.max(.01,We2().k||1);
    let i3 = /* @__PURE__ */new Map();
    for (let e3 of De2.associations) (i3.get(e3.stationIsub) ?? (i3.set(e3.stationIsub, []), i3.get(e3.stationIsub))).push(e3);
    let a3 = new Set(i3.keys()),
      s3 = De2.stations.filter(e3 => v10Stations.has(e3.isub) && (r3.get(e3.isub)?.length ?? 0) > 0).map(e3 => ({
        station: e3,
        ...Ue2(e3)
      })),
      c3 = new Set(s3.map(e3 => e3.station.isub)),
      l3 = /* @__PURE__ */new Map();
    for (let [e3, r4] of n3.buses.entries()) {
      let n4 = Ae2.get(r4.connectionKey);
      n4 && t3.has(e3) && r4.baseKv !== null && l3.set(n4.isub, Math.max(l3.get(n4.isub) ?? -1 / 0, r4.baseKv));
    }
    let u3 = Ye2(),
      d3 = ctx.Rv(Y2, e2.psseBaseCalculation),
      f3 = Ee2 === `saved` ? null : K2.value === `base` ? d3.base : d3.scenario,
      p3 = new Map(f3?.branchResults.filter(u3.branch).map(e3 => [e3.id, e3]) ?? []),
      m3 = new Map(f3?.busResults.filter(u3.bus).map(e3 => [e3.connectionKey, e3]) ?? []),
      g3 = Ee2 === `delta`,
      y3 = g3 && d3.ready,
      b3 = new Map(d3.base?.branchResults.filter(u3.branch).map(e3 => [e3.id, e3]) ?? []),
      x3 = new Map(d3.base?.busResults.filter(u3.bus).map(e3 => [e3.connectionKey, e3]) ?? []),
      S3 = /* @__PURE__ */new Map(),
      C3 = [], drawnSegments = new Map(),
      w3 = /* @__PURE__ */new Map();
    const animationNetwork=K2.value==='base'?Y2.base:Y2.network,
      animationResult=flowSource(K2.value==='base'?d3.base:K2.value==='scenario'?d3.scenario:null,flowMode),
      animationRows=new Map(animationResult?.branchResults.filter(u3.branch).map(row=>[row.id,row])??[]),
      animationBranches=new Map(animationNetwork.branches.map(branch=>[branch.id,branch]));
    for (let e3 of n3.branches) {
      if (e3.kind !== `line` && e3.kind !== `three-winding-leg` || e3.kind === `line` && !String(e3.sourceEquipmentId).startsWith(`line:`)) continue;
      if (!ctx.wv(e3.status, D2.value)) continue;
      if (e3.kind === `three-winding-leg`) {
        let r5 = n3.buses[e3.from].source ? e3.from : n3.buses[e3.to].source ? e3.to : -1;
        if (r5 < 0 || !t3.has(r5)) continue;
        let i5 = Ae2.get(n3.buses[r5].connectionKey);
        if (!i5 || !c3.has(i5.isub)) continue;
        (w3.get(e3.sourceEquipmentId) ?? (w3.set(e3.sourceEquipmentId, []), w3.get(e3.sourceEquipmentId))).push({
          branch: e3,
          busIndex: r5,
          station: i5
        });
        continue;
      }
      let r4 = n3.buses[e3.from],
        i4 = n3.buses[e3.to];
      if (!t3.has(e3.from) || !t3.has(e3.to)||!v13IncidentYtm(e3,n3)) continue;
      let a4 = Ae2.get(r4.connectionKey),
        o3 = Ae2.get(i4.connectionKey);
      if (!a4 || !o3 || a4.isub === o3.isub || !c3.has(a4.isub) || !c3.has(o3.isub)) continue;
      let s4 = [a4.isub, o3.isub].sort().join(`|`);
      (S3.get(s4) ?? (S3.set(s4, []), S3.get(s4))).push(e3), C3.push(e3);
    }
    for (let e3 of S3.values()) e3.sort((e4, t4) => e4.id.localeCompare(t4.id));
    let T3 = ctx.sv(`g`, {
      class: `ga-psse-geo-links`
    });
    for (let t4 of C3) {
      let r4 = n3.buses[t4.from],
        i4 = n3.buses[t4.to],
        a4 = Ae2.get(r4.connectionKey),
        o3 = Ae2.get(i4.connectionKey),
        s4 = Ue2(a4),
        c4 = Ue2(o3),
        l4 = S3.get([a4.isub, o3.isub].sort().join(`|`)),
        v3 = p3.get(t4.id),
        x4 = ctx.v10RatePct(t4, v3, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0),
        C4 = b3.get(t4.id),
        w4 = q2.value === `p` ? v3?.pFromMw : q2.value === `q` ? v3?.qFromMvar : q2.value === `current` ? v3?.iFromA ?? v3?.iToA : q2.value === `loss` ? ctx.v10Loss(v3) : q2.value === `loading` ? x4 : null;
      q2.value === `p` ? C4?.pFromMw : q2.value === `q` ? C4?.qFromMvar : q2.value === `current` ? C4?.iFromA ?? C4?.iToA : q2.value === `loss` ? C4?.pLossMw : q2.value === `loading` && (C4?.loadingFromPct ?? C4?.loadingToPct);
      const pathOptions={index:l4.indexOf(t4),count:l4.length,separated:ee2.value==='separated',forward:String(a4.isub)<String(o3.isub)},route=parallelPath(s4,c4,{...pathOptions,scale:glyphScale});drawnSegments.set(t4.id,{from:s4,to:c4,points:route,options:pathOptions});
      let E4 = y3 ? q2.value === `loading` ? ctx.v10RatePct(t4, v3, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0) !== null && ctx.v10RatePct(t4, C4, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0) !== null ? ctx.v10RatePct(t4, v3, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0) - ctx.v10RatePct(t4, C4, ctx.window.__GA_PSSE_RATE_INDEX__ ?? 0) : null : et2(C4, v3) : null,
        style = v12LineStyle(t4, g3 ? "delta" : q2.value, x4, w4, E4),
        D3 = style.color,
        O4 = ctx.sv(`path`, {
          d:route.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' '),fill:'none',
          stroke: D3,
          "stroke-width": String(style.width),
          opacity: String(style.opacity),
          "stroke-dasharray": style.dash,
          class: `ga-psse-geo-link ${t4.status === 0 ? `is-out` : ``} ${t4.id === Se2 ? `is-focus` : ``}`,
          "data-branch-id": t4.id,
          "data-branch-kind": t4.kind,
          tabindex: `0`,
          role: `button`,
          "aria-label": Fe2(t4)
        }),
        k4 = ctx.sv(`title`);
      k4.textContent = `${Fe2(t4)} \xB7 ${t4.id} \xB7 ${t4.status === 1 ? `serviste` : `devre d\u0131\u015F\u0131`} \xB7 P=${ctx.ov(v3?.pFromMw)} MW / Q=${ctx.ov(v3?.qFromMvar)} Mvar / y\xFCk=${ctx.ov(x4, 1)}%${y3 ? ` \xB7 \u0394P=${ctx.ov(ctx.zv(C4?.pFromMw, v3?.pFromMw))} MW \xB7 \u0394Q=${ctx.ov(ctx.zv(C4?.qFromMvar, v3?.qFromMvar))} Mvar \xB7 \u0394y\xFCk=${ctx.ov(ctx.zv(C4?.loadingFromPct, v3?.loadingFromPct) ?? ctx.zv(C4?.loadingToPct, v3?.loadingToPct), 1)}%` : ``}`, O4.dataset.v12Title = Fe2(t4);
      O4.dataset.v12Sub = `Kaynak: ${baseStatuses.get(t4.id)===1?"Serviste":"Devre dışı"} · ${K2.value==='base'?'Baz':'Senaryo'}: ${t4.status===1?"Serviste":"Devre dışı"} · ${Ee2==="saved"?"Kaynak SAV":f3?`GA · ${f3.method} · ${f3.physicsCoverage}`:"NOT_RUN"}`;
      O4.dataset.v12Cols = "TM / U\xE7|P (MW)|Q (MVAr)|Y\xFCk (%)";
      O4.dataset.v12Rows = `A \xB7 ${ctx.Lv(Y2.model, Y2.base).station(r4) ?? ctx.Lv(Y2.model, Y2.base).bus(r4)}|${ctx.ov(v3?.pFromMw, 1)}|${ctx.ov(v3?.qFromMvar, 1)}|${ctx.ov(v3?.loadingFromPct, 1)};B \xB7 ${ctx.Lv(Y2.model, Y2.base).station(i4) ?? ctx.Lv(Y2.model, Y2.base).bus(i4)}|${ctx.ov(v3?.pToMw, 1)}|${ctx.ov(v3?.qToMvar, 1)}|${ctx.ov(v3?.loadingToPct, 1)}`;
      O4.addEventListener(`click`, () => Ne2(t4, v3)), O4.addEventListener(`keydown`, e3 => {
        (e3.key === `Enter` || e3.key === ` `) && (e3.preventDefault(), O4.dispatchEvent(new MouseEvent(`click`, {
          bubbles: true
        })));
      }), T3.append(O4);renderedGeometry.push({element:O4,from:s4,to:c4,options:pathOptions,id:t4.id});
    }
    let E3 = [],
      O3 = /* @__PURE__ */new Map();
    for (let [e3, t4] of w3) {
      let n4 = [...new Set(t4.map(e4 => e4.station.isub))].sort().join(`|`);
      (O3.get(n4) ?? (O3.set(n4, []), O3.get(n4))).push(e3);
    }
    for (let e3 of O3.values()) e3.sort((e4, t4) => e4.localeCompare(t4));
    for (let [e3, t4] of w3) {
      let n4 = [...new Map(t4.map(e4 => [e4.station.isub, e4])).values()];
      if (n4.length < 2) continue;
      let r4 = n4.map(e4 => ({
        leg: e4,
        ...Ue2(e4.station)
      }));
      if (r4.length < 2) continue;
      let i4 = r4.reduce((e4, t5) => e4 + t5.x, 0) / r4.length,
        a4 = r4.reduce((e4, t5) => e4 + t5.y, 0) / r4.length,
        o3 = O3.get(n4.map(e4 => e4.station.isub).sort().join(`|`)) ?? [],
        s4 = (o3.indexOf(e3) - (o3.length - 1) / 2) * 16;
      i4 += s4, a4 -= s4 * 0.35;
      let c4 = je2(e3);
      for (let t5 of r4) {
        let {
            leg: n5,
            x: r5,
            y: o4
          } = t5,
          s5 = (Number(n5.branch.windingId) - 2) * 2.5,
          l5 = p3.get(n5.branch.id),
          u5 = ctx.sv(`line`, {
            x1: String(r5),
            y1: String(o4),
            x2: String(i4 + s5),
            y2: String(a4 + s5),
            stroke: tt2(n5.branch, l5, b3.get(n5.branch.id), y3),
            "stroke-width": String(v12MapSettings.widthOther),
            "stroke-dasharray": n5.branch.status === 1 ? `none` : `8 5`,
            class: `ga-psse-geo-link ${n5.branch.status === 0 ? `is-out` : ``}`
          }),
          d4 = ctx.sv(`title`);
        u5.dataset.branchId=n5.branch.id;u5.dataset.branchKind=n5.branch.kind;u5.dataset.v12Title=(c4?.name??e3)+' · Sargı '+n5.branch.windingId;u5.dataset.v12Sub=(n5.branch.status===1?'Serviste':'Devre dışı')+' · '+(f3?.physicsCoverage??'NOT_RUN');u5.dataset.v12Cols='Uç|P (MW)|Q (Mvar)|Yük (%)';u5.dataset.v12Rows=n5.station.name+'|'+ctx.ov(l5?.pFromMw,1)+'|'+ctx.ov(l5?.qFromMvar,1)+'|'+ctx.ov(l5?.loadingFromPct,1)+';Yıldız|'+ctx.ov(l5?.pToMw,1)+'|'+ctx.ov(l5?.qToMvar,1)+'|'+ctx.ov(l5?.loadingToPct,1);d4.textContent = `\xDC\xE7 sarg\u0131l\u0131 trafo ${e3} \xB7 kaynak sarg\u0131 ${n5.branch.windingId} \xB7 ${n5.station.name} \u2192 \u015Fematik ortak ba\u011Flant\u0131 \xB7 ortak ba\u011Flant\u0131 noktas\u0131 yaln\u0131z yerle\u015Fim i\xE7indir, TM koordinat\u0131 de\u011Fildir \xB7 P ${ctx.ov(l5?.pFromMw,1)} MW \xB7 Q ${ctx.ov(l5?.qFromMvar,1)} Mvar \xB7 y\xFCk ${ctx.ov(l5?.loadingFromPct, 1)}%`, u5.setAttribute("aria-label",u5.dataset.v12Title), u5.addEventListener(`click`, () => ge2.open(c4, Fe2(n5.branch), {
          normalizedBranch: n5.branch,
          calculated: l5 ?? null,
          scenarioHash: Y2.scenario.hash
        })), T3.append(u5), E3.push(n5.branch);
      }
      let l4 = ctx.sv(`g`, {
        class: `ga-psse-geo-threew`,
        "aria-label": `\xDC\xE7 sarg\u0131l\u0131 trafo ${c4?.id ?? e3}; ortak d\xFC\u011F\xFCm yeri \u015Fematik`
      });
      ctx.ah(l4, `transformer3w`, i4, a4, `#d0b56e`);
      let u4 = ctx.sv(`title`);
      u4.textContent = `\xDC\xE7 sarg\u0131l\u0131 trafo ${c4?.name ?? e3} \xB7 yeri g\xF6rsel ortalamad\u0131r, TM veya kaynak koordinat\u0131 de\u011Fildir`;l4.dataset.v12Title=c4?.name??e3;l4.dataset.branchId=r4[0].leg.branch.id;l4.dataset.v12Sub='3 sargı · '+(f3?.physicsCoverage??'NOT_RUN');l4.dataset.v12Cols='Sargı / TM|P (MW)|Q (Mvar)|Yük (%)';l4.dataset.v12Rows=r4.map(v=>{const row=p3.get(v.leg.branch.id);return v.leg.station.name+'|'+ctx.ov(row?.pFromMw,1)+'|'+ctx.ov(row?.qFromMvar,1)+'|'+ctx.ov(row?.loadingFromPct,1);}).join(';');l4.addEventListener('click',()=>ge2.open(c4,c4?.name??e3,{normalizedBranch:r4[0].leg.branch}));T3.append(l4);
    }
    _2.append(T3);
    flowAvailable=C3.some(display=>{const b=animationBranches.get(display.id),r=animationRows.get(display.id);return b?.status===1&&[400,154].includes(animationNetwork.buses[b.from]?.baseKv)&&(flowMode==='q'?[r?.qFromMvar,r?.qToMvar].some(v=>Number.isFinite(v)&&Math.abs(v)>=.1):Number.isFinite(r?.pFromMw)&&Number.isFinite(r?.pToMw)&&r.pFromMw*r.pToMw<0&&Math.abs(r.pFromMw)>=.15);});
    renderedFlows=C3.map(display=>{const branch=animationBranches.get(display.id),row=animationRows.get(display.id),segment=drawnSegments.get(display.id);return segment&&branch?{id:branch.id,a:segment.from,b:segment.to,path:segment.points,status:branch.status,kv:animationNetwork.buses[branch.from]?.baseKv,pFrom:row?.pFromMw,pTo:row?.pToMw,qFrom:row?.qFromMvar,qTo:row?.qToMvar,loading:ctx.v10RatePct(branch,row,ctx.window.__GA_PSSE_RATE_INDEX__??0,animationNetwork)}:null;}).filter(Boolean);
    const flowById=new Map(renderedFlows.map(flow=>[flow.id,flow]));for(const item of renderedGeometry)item.flow=flowById.get(item.id);geometryScale=glyphScale;flowLayer.setLines(renderedFlows);
    let k3 = ctx.sv(`g`, {
      class: `ga-psse-geo-stations`
    });
    for (let [t4, a4] of s3.entries()) {
      let {
          station: o3,
          x: s4,
          y: c4
        } = a4,
        u4 = r3.get(o3.isub) ?? [],
        d4 = l3.get(o3.isub) ?? null,
        f4 = ctx.fy(d4, e2),
        p4 = String(o3.isub)===String(selectedStation)||u4.some(e3 => n3.buses[e3].id === xe2),
        h3 = ctx.sv(`g`, {
          class: `ga-psse-geo-station ${p4 ? `is-focus` : ``}`,
          "data-isub": o3.isub,
          "data-world-x": String(ctx.kg(o3.longitude, o3.latitude)[0]),
          "data-world-y": String(ctx.kg(o3.longitude, o3.latitude)[1]),
          tabindex: `0`,
          role: `button`,
          "aria-label": `TM ${o3.name} \xB7 ${u4.length} fiziksel bara`,
          "data-v12-title": o3.name,
          "data-v12-sub": `TM \xB7 ${Ee2 === `saved` ? `Kaynak kay\u0131t` : `GA hesap`}`
        }),
        _3 = ctx.sv(`circle`, {
          cx: String(s4),
          cy: String(c4),
          r: String((p4?Math.max(5.5,v12MapSettings.siteSize):Math.max(3.2,v12MapSettings.siteSize))/glyphScale),
          fill: `#b9e1e4`,
          stroke: p4 ? `#fff` : `#9bb9c2`,
          "stroke-width": p4 ? `1.5` : `.6`
        }),
        v3 = ctx.sv(`circle`, {
          cx: String(s4),
          cy: String(c4),
          r: `0`,
          fill: `#102033`
        });
      h3.append(_3, v3);
      const allBusIds=stationBusGroups(n3,De2.associations).get(String(o3.isub))??[],
        aggregate=stationState(n3,allBusIds,{result:f3,baseResult:y3?d3.base:null,saved:Ee2==='saved',sourceById:ke2}),
        sourceAggregate=stationState(Y2.base,allBusIds,{saved:true,sourceById:ke2}),
        visible=stationState(n3,u4,{result:f3,baseResult:y3?d3.base:null,saved:Ee2==='saved',sourceById:ke2}),
        representative=stationRepresentative(visible,q2.value,{delta:y3});
      if(['vm','va','violation'].includes(q2.value)){
        const color=aggregate.service==='OUT_OF_SERVICE'?v12MapSettings.colorOut:!representative?v12MapSettings.colorNoResult:
          q2.value==='violation'?(representative.vm<representative.low||representative.vm>representative.high?'#e25f66':'#50b98b'):
          q2.value==='vm'?(y3?Je2(representative.vm):ctx.bg(representative.vm,v12MapSettings)):Qe2(representative.va,30);
        _3.setAttribute('fill',color);_3.setAttribute('r',String(Math.max(p4?6:4.5,v12MapSettings.siteSize)/glyphScale));
        if(representative){h3.dataset.metricBusId=representative.id;h3.dataset.metricValue=String(q2.value==='va'?representative.va:representative.vm);}
      }
      if (R2 && (t4 % Math.max(1, Math.ceil(3 / Ce2)) === 0 || p4)) {
        let e3 = ctx.sv(`text`, {
          x: String(s4 + 9),
          y: String(c4 - 8),
          class: `ga-psse-geo-label`
        });
        e3.style.fontSize=String(12/glyphScale)+"px";e3.textContent = o3.name, h3.append(e3);
      }
      h3.dataset.stationService=aggregate.service;h3.dataset.stationCoverage=aggregate.coverage;
      h3.dataset.v12Sub=`Kaynak: ${sourceAggregate.active}/${sourceAggregate.count} bara · ${K2.value==='base'?'Baz':'Senaryo'}: ${aggregate.status} (${aggregate.active}/${aggregate.count})`;
      const highest=stationRepresentative(aggregate),primary=highest?n3.buses[allBusIds.find(i=>n3.buses[i].id===highest.id)]:null;
      h3.dataset.tooltipBusId=highest?.id??'';
      h3.dataset.v12Cols='Nominal (kV)|Gerilim (kV)|Açı (°)';
      h3.dataset.v12Rows=`${ctx.ov(highest?.baseKv,1)}|${Number.isFinite(highest?.vm)&&highest.baseKv>0?ctx.ov(highest.vm*highest.baseKv,1):'—'}|${ctx.ov(highest?.va,1)}`;
      let w4 = () => {
        let e3 = je2(o3.sourceEquipmentId);
        ge2.open(e3, `Kaynak TM \xB7 ${o3.name}`, {
          stationId:o3.isub,normalizedBus:primary,sourceCoordinates: {
            latitude: o3.latitude,
            longitude: o3.longitude,
            provenance: `PsseModel source substation latitude/longitude`
          },
          associatedBuses: i3.get(o3.isub) ?? [],
          scenarioHash: Y2.scenario.hash
        });
      };
      h3.addEventListener(`click`, w4), h3.addEventListener(`keydown`, e3 => {
        (e3.key === `Enter` || e3.key === ` `) && (e3.preventDefault(), w4());
      }), k3.append(h3);
    }
    for(const nativeTitle of k3.querySelectorAll('[data-v12-title] title'))nativeTitle.remove();
    return k3.style.display = L2 ? `` : `none`, _2.append(k3), rt2(), [...C3, ...E3];
  }
  function at2(t3) {
    if (v2.replaceChildren(), !Y2) return;
    let n3 = Ye2(),
      r3 = ze2(),
      i3 = xe2 ? r3.buses.findIndex(e3 => e3.id === xe2) : -1,
      a3 = i3 >= 0 ? i3 : -1;
    if ((a3 < 0 || !t3.has(a3)) && (a3 = ctx.Av(r3, t3, D2.value), xe2 = a3 >= 0 ? r3.buses[a3].id : null), a3 < 0) return;
    let o3 = ctx.kv(r3, t3, a3, 2, D2.value, ctx.ay, ctx.oy),
      s3 = ctx.jv(o3.busIndices, o3.depthByBus, a3, ctx.ny, ctx.ry);
    new Set(o3.busIndices);
    let c3 = ctx.sv(`svg`, {
        viewBox: `0 0 ${ctx.ny} ${ctx.ry}`,
        role: `img`,
        "aria-label": `PSS/E bus-branch topoloji g\xF6r\xFCn\xFCm\xFC`,
        class: `ga-psse-map-svg ga-psse-topology-svg`
      }),
      l3 = ctx.Rv(Y2, e2.psseBaseCalculation),
      u3 = Ee2 === `saved` ? null : K2.value === `base` ? l3.base : l3.scenario,
      d3 = new Map(u3?.branchResults.filter(n3.branch).map(e3 => [e3.id, e3]) ?? []),
      f3 = new Map(u3?.busResults.filter(n3.bus).map(e3 => [e3.connectionKey, e3]) ?? []),
      p3 = /* @__PURE__ */new Map();
    for (let e3 of r3.generators) p3.set(e3.bus, (p3.get(e3.bus) ?? 0) + 1);
    for (let e3 of r3.loads) p3.set(e3.bus, (p3.get(e3.bus) ?? 0) + 1);
    let h3 = /* @__PURE__ */new Map();
    for (let e3 of o3.branches) {
      let t4 = [e3.from, e3.to].sort((e4, t5) => e4 - t5).join(`:`);
      (h3.get(t4) ?? (h3.set(t4, []), h3.get(t4))).push(e3);
    }
    for (let e3 of h3.values()) e3.sort((e4, t4) => e4.id.localeCompare(t4.id));
    for (let e3 of o3.branches) {
      let t4 = s3.get(e3.from),
        r4 = s3.get(e3.to),
        i4 = h3.get([e3.from, e3.to].sort((e4, t5) => e4 - t5).join(`:`)),
        a4 = (i4.indexOf(e3) - (i4.length - 1) / 2) * 8,
        o4 = r4.x - t4.x,
        u4 = r4.y - t4.y,
        f4 = Math.hypot(o4, u4) || 1;
      d3.get(e3.id)?.loadingFromPct ?? d3.get(e3.id)?.loadingToPct;
      let p4 = ctx.sv(`line`, {
          x1: String(t4.x - u4 / f4 * a4),
          y1: String(t4.y + o4 / f4 * a4),
          x2: String(r4.x - u4 / f4 * a4),
          y2: String(r4.y + o4 / f4 * a4),
          stroke: tt2(e3, d3.get(e3.id), l3.base?.branchResults.find(t5 => n3.branch(t5) && t5.id === e3.id), l3.ready),
          "stroke-width": `2`,
          "stroke-dasharray": e3.status === 1 ? `none` : `5 4`,
          class: `ga-psse-geo-link`
        }),
        m3 = ctx.sv(`title`);
      m3.textContent = `${Fe2(e3)} \xB7 ${e3.id} \xB7 ${e3.terminalFrom} \u2192 ${e3.terminalTo} \xB7 ${e3.status === 1 ? `serviste` : `devre d\u0131\u015F\u0131`}`, p4.append(m3), p4.addEventListener(`click`, () => Ne2(e3, d3.get(e3.id))), c3.append(p4);
    }
    for (let e3 of o3.busIndices) {
      let t4 = r3.buses[e3],
        i4 = s3.get(e3),
        o4 = f3.get(t4.connectionKey),
        u4 = ctx.Sv(t4, Y2.model, ke2),
        d4 = l3.base?.busResults.find(e4 => n3.bus(e4) && e4.connectionKey === t4.connectionKey)?.vmPu,
        m3 = Ee2 === `saved` ? u4 : Ee2 === `delta` ? l3.ready ? ctx.zv(d4, o4?.vmPu) : null : o4?.vmPu,
        h4 = Ee2 === `delta` ? m3 == null ? `#758698` : Je2(m3) : ctx.Dv(m3),
        g3 = ctx.sv(`g`, {
          class: `ga-map-bus ${t4.status === 0 ? `is-out` : ``} ${t4.id === r3.buses[a3].id ? `is-focus` : ``}`,
          "data-bus-id": t4.id,
          tabindex: `0`,
          role: `button`
        }),
        _3 = ctx.sv(t4.source ? `circle` : `rect`, t4.source ? {
          cx: String(i4.x),
          cy: String(i4.y),
          r: t4.id === r3.buses[a3].id ? `11` : `8`,
          fill: h4
        } : {
          x: String(i4.x - 6),
          y: String(i4.y - 6),
          width: `12`,
          height: `12`,
          fill: h4,
          transform: `rotate(45 ${i4.x} ${i4.y})`
        }),
        v3 = ctx.sv(`text`, {
          x: String(i4.x),
          y: String(i4.y - 15),
          class: `ga-map-bus-label`
        });
      v3.textContent = `${ctx.Lv(Y2.model, Y2.base).bus(t4)} \xB7 ${ctx.bv(t4.baseKv)}${(p3.get(e3) ?? 0) > 0 ? ` \xB7 E${p3.get(e3)}` : ``}`;
      let y3 = ctx.sv(`title`);
      y3.textContent = `${t4.id} \xB7 ${ctx.fv(t4, Y2.model, ke2)} \xB7 ${ctx.bv(t4.baseKv)} \xB7 ${Ee2 === `calculated` ? `GA_PSSE_CALCULATED Vm=${ctx.ov(o4?.vmPu, 1)} pu \xB7 Va=${ctx.ov(o4?.vaDeg, 1)}\xB0` : `${ctx.Tv(Y2)} Vm=${ctx.ov(u4, 1)} pu \xB7 Va=${ctx.ov(ctx.Cv(t4, Y2.model, ke2), 2)}\xB0`}`, g3.append(_3, v3, y3);
      let b3 = () => {
        xe2 = t4.id;
        let e4 = je2(t4.sourceEquipmentId);
        ge2.open(e4, `Bara \xB7 ${ctx.Lv(Y2.model, Y2.base).bus(t4)}`, {
          normalizedBus: t4,
          calculated: o4 ?? null,
          scenarioHash: Y2.scenario.hash
        });
      };
      g3.addEventListener(`click`, b3), g3.addEventListener(`keydown`, e4 => {
        (e4.key === `Enter` || e4.key === ` `) && (e4.preventDefault(), b3());
      }), c3.append(g3);
    }
    v2.replaceChildren(c3, m2);
  }
  function ot2(t3, n3, r3) {
    let i3 = ctx.Q(`div`, `ga-psse-legend-item`);
    i3.append(ctx.Q(`strong`, ``, t3));
    let a3 = ctx.Q(`span`, `ga-psse-legend-chips`),
      o3 = r3 === `voltage` ? [e2.settings.value.voltageLowColor, e2.settings.value.voltageNeutralColor, e2.settings.value.voltageHighColor] : r3 === `violation` ? [`#e25f66`, `#50b98b`, `#758698`] : r3 === `delta` ? [e2.settings.value.deltaDown, e2.settings.value.deltaNeutral, e2.settings.value.deltaUp] : r3 === `loading` ? ctx.Sg(e2.settings.value) : r3 === `palette` ? [e2.settings.value.color400, e2.settings.value.color220, e2.settings.value.color154, e2.settings.value.color66, e2.settings.value.colorMid, e2.settings.value.colorLow, `#758698`] : [`#65788b`];
    for (let e3 of o3) {
      let t4 = ctx.Q(`i`, ``);
      t4.style.backgroundColor = e3, a3.append(t4);
    }
    return i3.append(a3, ctx.Q(`small`, ``, n3)), i3;
  }
  async function st2() {
    if (be2 !== `map`) {
      e2.setMessage(`PNG d\u0131\u015Fa aktar\u0131m\u0131 co\u011Frafi harita g\xF6r\xFCn\xFCm\xFCnde kullan\u0131labilir.`);
      return;
    }
    let t3 = We2().rect,
      n3 = _2.cloneNode(true),
      r3 = ctx.sv(`style`);
    r3.textContent = `.ga-psse-geo-link{vector-effect:non-scaling-stroke;opacity:.82}.ga-psse-geo-station circle{vector-effect:non-scaling-stroke}.ga-psse-geo-label{font:10px system-ui;fill:#e9f2fa;paint-order:stroke;stroke:#0c1c2c;stroke-width:3px}`, n3.prepend(r3), n3.setAttribute(`xmlns`, `http://www.w3.org/2000/svg`), n3.setAttribute(`width`, String(t3.width)), n3.setAttribute(`height`, String(t3.height));
    let i3 = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(n3)], {
      type: `image/svg+xml`
    }));
    try {
      let e3 = new Image();
      await new Promise((t5, n5) => {
        e3.onload = () => t5(), e3.onerror = () => n5(Error(`SVG g\xF6r\xFCnt\xFCs\xFC olu\u015Fturulamad\u0131.`)), e3.src = i3;
      });
      let t4 = ctx.Q(`canvas`);
      t4.width = g2.width, t4.height = g2.height;
      let n4 = t4.getContext(`2d`);
      n4.drawImage(g2, 0, 0), n4.drawImage(e3, 0, 0, t4.width, t4.height);
      let r4 = ctx.Q(`a`);
      r4.download = `PSS-E-Harita.png`, r4.href = t4.toDataURL(`image/png`), r4.click();
    } catch (t4) {
      e2.setMessage(`PNG d\u0131\u015Fa aktar\u0131lamad\u0131: ${t4 instanceof Error ? t4.message : String(t4)}`);
    } finally {
      URL.revokeObjectURL(i3);
    }
  }
  function ct2() {
    if (he2.render(), Y2 = ctx.uv(e2), !Y2) {
      p2.textContent = e2.psseNetwork && e2.psseScenario && e2.psseScenario.networkHash !== e2.psseNetwork.modelHash ? `PSS/E senaryosu ba\u015Fka bir modelin a\u011F\u0131na ba\u011Fl\u0131. Ge\xE7erli modeli a\xE7\u0131n veya senaryoyu yenileyin.` : `PSS/E modeli ve senaryosu bekleniyor.`, f2.replaceChildren(), m2.replaceChildren(), _2.replaceChildren(), v2.replaceChildren();
      return;
    }
    O2.value=Ee2==='delta'?'calculated':Ee2;
    ge2.render();Pe2(), Y2.model !== Oe2 && (Oe2 = Y2.model, ke2 = new Map(Y2.model.equipment.map(e3 => [e3.id, e3])), De2 = ctx.Zs(Oe2, Y2.base), Ae2 = (()=>{const stations=new Map(De2.stations.map(station=>[station.isub,station]));return new Map(De2.associations.map(association=>[association.connectionKey,stations.get(association.stationIsub)]));})());
    let t3 = Y2.network,
      n3 = Y2.model,
      r3 = Re2(),
      i3 = r3.length === 0,
      a3 = Be2(),
      o3 = t3.buses.filter(e3 => e3.source).length,
      s3 = t3.buses.filter(e3 => e3.source && ctx.xv(e3.baseKv)).length,
      c3 = t3.buses.filter(e3 => e3.source && e3.baseKv === null).length,
      l3 = xe2 ? t3.buses.find(e3 => e3.id === xe2) : null;
    f2.replaceChildren(ctx.Q(`span`, `ga-psse-status-item`, `TM ${De2.counts.sourceStations} \xB7 koordinat ${De2.counts.validCoordinateStations}`), ctx.Q(`span`, `ga-psse-status-item`, `e\u015Fle\u015Fen ${De2.associations.length}/${o3} \xB7 e\u015Fle\u015Fmeyen ${De2.counts.unmatchedBuses}`), ctx.Q(`span`, `ga-psse-status-item`, `filtre ${a3.size} \xB7 gerilim ${ctx.sy.length - r3.length}/${ctx.sy.length} band (${s3} \u226436 kV) \xB7 kV bilinmeyen ${c3}`), ctx.Q(`span`, `ga-psse-status-item`, be2 === `map` ? `Co\u011Frafi harita` : `Topoloji`)), j2.classList.toggle(`is-active`, be2 === `map`), M2.classList.toggle(`is-active`, be2 === `topology`), le2.textContent = `${Ee2==='saved'?'Baz · SAV':K2.value==='base'?'Baz':K2.value==='delta'?'Fark':e2.scenarios?.item.name??'Senaryo'} · ${ctx.Rv(Y2,e2.psseBaseCalculation)[K2.value==='base'?'base':'scenario']?'LF':'—'}`;le2.title=`${e2.scenarios?.item.name??'Baz'} · ${Y2.scenario.operations.length} işlem`, de2.disabled = e2.busy, Xe2(), q2.selectedOptions[0]?.disabled && (q2.value = `nominal`), Ze2();
    let u3 = l3 && !Ae2.has(l3.connectionKey);
    if (p2.textContent = `Model SHA-256 ${De2.sourceSha256.slice(0, 12)} \xB7 senaryo ${Y2.scenario.hash.slice(0, 12)} (${Y2.scenario.operations.length} i\u015Flem). Koordinat ili\u015Fkileri: ${De2.counts.explicitReferences} a\xE7\u0131k isub + ${De2.counts.exactNameAliases} tekil tam-ad e\u015Fle\u015Fmesi; ${De2.counts.ambiguousBuses} belirsiz, ${De2.counts.unmatchedBuses} e\u015Fle\u015Fmeyen bara; ${De2.counts.unreferencedStations} ge\xE7erli koordinatl\u0131 TM ili\u015Fkisiz. ${i3 ? `T\xFCm gerilim bantlar\u0131 se\xE7ili (bilinmeyen kV ${c3} bara dahil).` : r3.some(e3 => e3.id === `blow`) ? `\u226436 kV band\u0131 gizli (${s3} bara); kV bilinmeyen ${c3} bara ayr\u0131 kal\u0131r.` : `${r3.length} gerilim band\u0131 gizli.`}  ${u3 ? `Se\xE7ili bara ${ctx.fv(l3, n3, ke2)} i\xE7in kaynak TM koordinat\u0131 yok; Topoloji g\xF6r\xFCn\xFCm\xFCne ge\xE7in.` : ctx.Ev(Y2)}.`, p2.title = p2.textContent, u3) {
      let e3 = ctx.$(`Topolojide a\xE7`, () => {
        be2 = `topology`, ct2();
      }, `Se\xE7ili baray\u0131 topoloji g\xF6r\xFCn\xFCm\xFCnde a\xE7`);
      p2.append(ctx.document.createTextNode(` `), e3);
    }
    be2 === `map` ? (h2.append(m2), it2(a3), v2.replaceChildren()) : (h2.hidden = true, v2.hidden = false, at2(a3));
    he2.setFilterScope({busIds:a3,branchIds:new Set(t3.branches.filter(b=>(b.kind==='line'?a3.has(b.from)&&a3.has(b.to):a3.has(b.from)||a3.has(b.to))&&v13IncidentYtm(b,t3)).map(b=>b.id))});he2.render();ge2.render();tooltip.hide();lastContextKey=contextKey();
  }
  Ee2 = 'calculated';O2.value=Ee2;
  J2.onchange=()=>{q2.value=J2.value==="nominal"?"nominal":"p";flowMode='p';ct2();};
  let lt2 = () => {
    Ee2 = O2.value === `saved` ? `saved` : K2.value === `delta` ? `delta` : `calculated`, Ee2 === `delta` && !qe2() && Y2 && e2.setMessage(ctx.Rv(Y2, e2.psseBaseCalculation).reason ?? `Uyumlu baz ve senaryo hesaplar\u0131 gerekir.`), ct2();
  };
  O2.onchange = () => {
    lt2();
  }, K2.onchange = () => {
    K2.value !== `base` && (O2.value = `calculated`), lt2();
  };
  for (let e3 of x2.values()) e3.onchange = () => {
    v11RenderVoltage();
    ct2();
  };
  for (let e3 of [D2, ee2]) e3.onchange = ct2;
  // A SAV-only metric fallback must not silently turn a requested Q animation into P.
  q2.onchange=()=>{flowMode=q2.value==='q'?'q':'p';ct2();};
  for (let z3 of [T2, E2]) z3.onchange = () => {
    v9FitScope(), ct2();
  };
  y2.addEventListener(`input`, () => {
    Ie2();
    let e3 = ctx.lv(y2.value),
      t3 = Y2?.network.buses.filter(t4 => [t4.id, t4.connectionKey, t4.externalNumber].some(t5 => ctx.lv(t5) === e3)) ?? [];
    if(t3.length === 1){Ke2(t3[0]);ct2();}
  }), y2.addEventListener(`keydown`, e3 => {
    e3.key === `Enter` && (e3.preventDefault(), fe2.click());
  }), b2.onchange = () => {
    if (!b2.value || !Y2) return;
    let [e3, ...t3] = b2.value.split(`:`),
      n3 = t3.join(`:`);
    if (e3 === `bus`) {
      let e4 = Y2.network.buses.find(e5 => e5.id === n3);
      e4 && Ke2(e4);
    } else if (e3 === `branch`) {
      let e4 = Y2.network.branches.find(e5 => e5.id === n3);
      e4 && Le2(e4);
    }
    ct2();
  };
  let lastContextKey = "",lastBookId=e2.scenarios?.selected;
  const contextKey=()=>JSON.stringify([e2.psseNetwork?.modelHash,e2.scenarios?.selected,e2.psseScenario?.hash,e2.psseCalculation?.id,e2.psseBaseCalculation?.id,e2.settings.value,h2.clientWidth,h2.clientHeight]);
  function renderCached(){if(lastBookId!==e2.scenarios?.selected){lastBookId=e2.scenarios?.selected;K2.value=lastBookId==='base'?'base':'scenario';Ee2='calculated';O2.value='calculated';}ge2.render();const key=contextKey();if(key===lastContextKey&&Y2?.model===e2.psseInspection){he2.render();if(K2.value==='scenario')le2.textContent=(e2.scenarios?.item.name??'Senaryo')+' · '+(Y2.calculation?'LF':'—');rt2();return;}ct2();lastContextKey=contextKey();}
  let v12MapQueued = false,
    dt2 = e2.subscribe(() => {
      if (e2.view !== `map` || v12MapQueued) return;
      v12MapQueued = true;
      ctx.window.requestAnimationFrame(() => {
        v12MapQueued = false;
        renderCached();
      });
    }),
    ft2 = new AbortController(),
    pt2 = null,
    mt2 = false,
    ht2 = 0;
  h2.addEventListener(`pointerdown`, e3 => {
    be2 === `map` && Y2 && e3.button === 0 && (e3.target === g2 || _2.contains(e3.target)) && (pt2 = {
      x: e3.clientX,
      y: e3.clientY,
      panX: we2,
      panY: Te2,
      moved: false
    });
  }, {
    signal: ft2.signal
  }), h2.addEventListener(`pointermove`, e3 => {
    if (!pt2 || !Y2) return;
    let t3 = e3.clientX - pt2.x,
      n3 = e3.clientY - pt2.y;
    if (!pt2.moved && Math.hypot(t3, n3) < 4) return;
    pt2.moved || (pt2.moved = true, h2.setPointerCapture(e3.pointerId));
    let r3 = ctx.ty({
      ...Ve2(),
      panX: pt2.panX,
      panY: pt2.panY
    }, {
      x: t3,
      y: n3
    }, We2().rect);
    we2 = r3.panX, Te2 = r3.panY, v10Viewport();
  }, {
    signal: ft2.signal
  }), h2.addEventListener(`pointerup`, () => {
    if(!pt2)return;
    mt2 = !!pt2.moved;pt2 = null;if(!mt2)return;
    ctx.window.clearTimeout(ht2), ht2 = ctx.window.setTimeout(() => {
      mt2 = false;
      if (Y2 && be2 === `map` && e2.view==='map') ct2();
    }, 140);
  }, {
    signal: ft2.signal
  }), h2.addEventListener(`pointercancel`, () => {
    pt2 = null;
  }, {
    signal: ft2.signal
  }), h2.addEventListener(`click`, e3 => {
    mt2 && e3.detail > 0 && (e3.preventDefault(), e3.stopImmediatePropagation()), mt2 = false;
  }, {
    capture: true,
    signal: ft2.signal
  }), h2.addEventListener('click',event=>{const target=event.target;if(!(target instanceof Element)||target.closest('.ga-psse-geo-link,.ga-psse-geo-station,.ga-psse-geo-bus,.ga-psse-geo-threew,.ga-map-selection,.ga-psse-lightning,.ga-psse-diagram-legend,button,input,select,summary,details'))return;if(target===h2||target===g2||_2.contains(target)){ge2.close();for(const menu of s2.querySelectorAll('.ga-map-menu[open]'))menu.open=false;}},{signal:ft2.signal}),ctx.document.addEventListener('keydown',event=>{if(e2.view==='map'&&event.key==='Escape')ge2.close();},{signal:ft2.signal}), h2.addEventListener(`wheel`, e3 => {
    if (be2 !== `map` || !Y2 || !(e3.target === g2 || _2.contains(e3.target))) return;
    e3.preventDefault();
    let t3 = Math.max(0.65, Math.min(64, Ce2 * (e3.deltaY < 0 ? 1.12 : 1 / 1.12)));
    if (t3 === Ce2) return;
    let n3 = ctx.ey(Ve2(), {
      x: e3.clientX,
      y: e3.clientY
    }, We2().rect, t3);
    ({
      zoom: Ce2,
      panX: we2,
      panY: Te2
    } = n3), v10Viewport();
    ctx.window.clearTimeout(v11SettleTimer);
    v11SettleTimer = ctx.window.setTimeout(() => {
      if (Y2 && be2 === `map`) ct2();
    }, 190);
  }, {
    passive: false,
    signal: ft2.signal
  });
  ctx.document.addEventListener("ga-psse-v10-rate-change", () => {
    ct2();
    he2.render();
  }, {
    signal: ft2.signal
  });
  let gt2 = () => {
      be2 === `map` && Ge2();
    },
    _t2 = 0,
    vt2 = `ResizeObserver` in ctx.window ? new ResizeObserver(() => {
      ctx.window.cancelAnimationFrame(_t2), _t2 = ctx.window.requestAnimationFrame(() => {
        ctx.window.cancelAnimationFrame(_t2), gt2();
      });
    }) : null;
  vt2 && vt2.observe(h2), ctx.window.addEventListener(`resize`, gt2);
  let yt2 = () => {
    P2.textContent = ctx.document.fullscreenElement === s2 ? `\xC7\u0131k` : `Tam ekran`, P2.setAttribute(`aria-label`, P2.textContent), gt2();
  };
  return ctx.document.addEventListener(`fullscreenchange`, yt2), {
    element: s2,
    render: renderCached,
    dispose: () => {
      dt2(), ft2.abort(), ctx.window.clearTimeout(ht2), ge2.dispose(), he2.dispose(), tooltip.dispose(), flowLayer.dispose(), vt2?.disconnect(), ctx.window.cancelAnimationFrame(_t2), ctx.window.cancelAnimationFrame(v10Frame), ctx.window.removeEventListener(`resize`, gt2), ctx.document.removeEventListener(`fullscreenchange`, yt2);
    }
  };
};
}
export const initializers = [

];
