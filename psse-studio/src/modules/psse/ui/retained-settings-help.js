// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.Ty = function Ty(e2) {
  let t2 = ctx.Q(`section`, `ga-panel ga-psse-settings`),
    n2 = ctx.Q(`select`),
    r2 = ctx.Q(`input`),
    i2 = ctx.Q(`p`, `ga-muted`);
  n2.setAttribute(`aria-label`, `Tema`), n2.append(new Option(`Koyu`, `dark`), new Option(`A\xE7\u0131k`, `light`)), r2.type = `number`, r2.min = `0`, r2.max = `8`, r2.step = `1`, r2.setAttribute(`aria-label`, `Ondal\u0131k basamak`);
  let a2 = ctx.Q(`div`, `ga-settings-grid`),
    o2 = ctx.Q(`fieldset`),
    s2 = ctx.Q(`legend`, ``, `G\xF6r\xFCn\xFCm`),
    c2 = ctx.Q(`label`, ``, `Tema`),
    l2 = ctx.Q(`label`, ``, `Ondal\u0131k basamak`);
  c2.append(n2), l2.append(r2), o2.append(s2, c2, l2), a2.append(o2);
  let u2 = ctx.$(`PSS/E hesap ayarlar\u0131na git`, () => e2.setView(`analysis`));
  t2.append(ctx.Q(`h2`, ``, `PSS/E Ayarlar\u0131`), ctx.Q(`p`, `ga-muted`, `Bu g\xF6r\xFCn\xFCm yaln\u0131z payla\u015F\u0131lan tema ve say\u0131 g\xF6sterim hassasiyetini de\u011Fi\u015Ftirir. \xC7\xF6z\xFCc\xFC tolerans\u0131, iterasyon say\u0131s\u0131 ve fizik profilleri PSS/E Analizler ekran\u0131ndad\u0131r.`), a2, u2, ctx.$(`Uygula`, f2), i2);
  function d2() {
    n2.value = e2.settings.value.theme, r2.value = String(e2.settings.value.precision);
  }
  function f2() {
    let t3 = Number(r2.value);
    if (!Number.isInteger(t3) || t3 < 0 || t3 > 8) {
      i2.textContent = `Ondal\u0131k basamak 0\u20138 aras\u0131nda tam say\u0131 olmal\u0131d\u0131r.`;
      return;
    }
    e2.settings.update({
      theme: n2.value,
      precision: t3
    }), i2.textContent = `G\xF6r\xFCn\xFCm ayarlar\u0131 kaydedildi.`, e2.notify();
  }
  let p2 = ``;
  return d2(), {
    element: t2,
    render() {
      let t3 = JSON.stringify([e2.settings.value.theme, e2.settings.value.precision]);
      t3 !== p2 && (p2 = t3, d2()), ctx.document.body.classList.toggle(`ga-light`, e2.settings.value.theme === `light`);
    }
  };
};
ctx.Ey = function Ey(e2) {
  let t2 = ctx.Q(`section`, `ga-panel ga-psse-help`),
    n2 = ctx.Q(`div`, `ga-card-grid`),
    r2 = ctx.Q(`div`, `ga-psse-controls`);
  t2.append(ctx.Q(`h2`, ``, `PSS/E Yard\u0131m`), ctx.Q(`p`, `ga-muted`, `PSS/E girdileri kaynak de\u011Ferleri olarak incelenir. Yaln\u0131z Analizler ekran\u0131nda \xFCretilen GA_PSSE_CALCULATED sonu\xE7lar\u0131 \xE7\xF6z\xFCc\xFC \xE7\u0131kt\u0131s\u0131d\u0131r; SOURCE_SAVED ve PSSE_REFERENCE ayr\u0131 kaynaklard\u0131r.`));
  for (let [e3, t3, r3] of [[`Tam AC \xB7 NR_POLAR`, `Dengeli bus/branch admitans matrisi, tam polar Newton \xE7\xF6z\xFCm\xFC, ZIP y\xFCk karakteristi\u011Fi ve kaynak/\xE7al\u0131\u015Fma reaktif g\xFC\xE7 s\u0131n\u0131r profilleri.`, `Kaynakta kalan droop ve uzak gerilim kontrolleri gibi desteklenmeyen kontroller varsa hesap BLOCKED olur.`], [`FDNS_XB`, `Ba\u011F\u0131ms\u0131z fast-decoupled XB \xE7\xF6z\xFCm\xFC; kendi B\u2032/B\u2033 fakt\xF6rlemesini ve iterasyonlar\u0131n\u0131 kullan\u0131r.`, `Y\xF6ntem AC NR\u2019ye geri d\xFC\u015Fmez. Reaktif s\u0131n\u0131rlar\u0131 etkin profilde referans davran\u0131\u015F\u0131 ayr\u0131ca y\xF6ntem baz\u0131nda do\u011Frulanmal\u0131d\u0131r.`], [`Kay\u0131ps\u0131z do\u011Frusal DC`, `Ayr\u0131 do\u011Frusal aktif g\xFC\xE7 denklemi; a\xE7\u0131k\xE7a se\xE7ilen referans a\xE7\u0131, y\xFCk gerilimi, \u015F\xF6nt gerilimi ve kademe politikalar\u0131 kullan\u0131l\u0131r. Do\u011Frulanm\u0131\u015F ideal ba\u011Flant\u0131 gruplar\u0131 DC\u2019de e\u015F-a\xE7\u0131l\u0131 bara e\u015Fde\u011Ferlemesiyle \xE7\xF6z\xFCl\xFCr.`, `R/X kay\u0131plar\u0131 ve Q/V davran\u0131\u015F\u0131 \xE7\xF6z\xFClmez. PSS/E 36.5 ideal ba\u011Flant\u0131 \xE7evrimleri a\u011F\u0131rl\u0131kl\u0131 ak\u0131\u015F geri kazan\u0131m\u0131 kullan\u0131r; genel AC e\u015Fde\u011Ferli\u011Fi anlam\u0131na gelmez.`], [`Sonu\xE7 ve kapsam`, `Hesap kimli\u011Fi model, topoloji, senaryo, \xE7\xF6z\xFCc\xFC, se\xE7enekler ve motor s\xFCr\xFCm\xFCn\xFC ay\u0131r\u0131r. Kaynak s\u0131n\u0131rlar\u0131 ile \xE7al\u0131\u015Fma e\u015Fi\u011Fi a\xE7\u0131k\xE7a etiketlenir.`, `BLOCKED, PARTIAL, CONVERGED ve referans kar\u015F\u0131la\u015Ft\u0131rma durumlar\u0131 farkl\u0131 anlam ta\u015F\u0131r. PARITY/uyum iddialar\u0131 yaln\u0131z tam e\u015Fle\u015Fen sonu\xE7 sat\u0131rlar\u0131 ve se\xE7eneklerle yap\u0131l\u0131r.`]]) {
    let i2 = ctx.Q(`details`, `ga-help-entry`);
    i2.append(ctx.Q(`summary`, ``, e3), ctx.Q(`p`, ``, t3), ctx.Q(`p`, `ga-notice`, r3)), n2.append(i2);
  }
  return t2.append(n2), r2.append(ctx.$(`PSS/E Analizler`, () => e2.setView(`analysis`)), ctx.$(`PSS/E model \xF6zeti`, () => e2.setView(`model`)), ctx.$(`PSS/E haritas\u0131`, () => e2.setView(`map`)), ctx.$(`Tek hat \u015Femas\u0131`, () => e2.setView(`sld`))), t2.append(r2), {
    element: t2,
    render() {}
  };
};
}
export const initializers = [

];
