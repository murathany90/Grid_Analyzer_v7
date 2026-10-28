# V4 UIFIX3 — DGS / PSS/E Harita paritesi

Tarih: 28.10.2026 (Europe/Istanbul). Dal: `fix/psse-v1-real-model-parity`.
Başlangıç yerel/uzak HEAD: `d5ef0711626457479b76478683e3fd30b3001f38`; çalışma ağacı başlangıçta temizdi.

## Değişiklikler

- PSS/E haritası ayrı DOM ve CSS ile iki satırlı kompakt filtre çubuğu kullanır: YTM, TM, BM, beş gerilim bandı, hat yerleşimi, Baz/Senaryo/Fark, analiz, kaynak ve metrik. Tek `Sığdır`, tekerlek zoom, sürükleme, tam ekran ve PNG korunur. Akış, TM ve etiket kontrolleri DGS düzenine yakındır.
- Lejant haritanın sol altında, ⚡ düğmesi sağ altında yüzer. Uzun kaynak/hash/koordinat açıklamaları kapalı teknik ayrıntılardadır. TM işaretleri küçültüldü; çizgiler ince, devre dışı ekipman kesiklidir. Akış okları seyrek ve küçüktür; animasyon isteğe bağlıdır, `prefers-reduced-motion` ile durur.
- `mapResultTable(visibleMapBranches)` ve harita altındaki sonuç/provenans alanı kaldırıldı. Hat/trafo uç P/Q, akım ve yükleme sonuçları ⚡ panelinde ve Analizler ekranındadır. Koordinat provenansı, eşleşmeyen bara CSV ve boş şablon Şebeke Modeli → Kalite → Gelişmiş altındadır.
- Kaynak adları ve yalnız doğrulanmış TM ilişkileri önceliklidir. Teknik bara/hat kimlikleri tooltip, ayrıntı ve CSV içinde korunur. Paralel devreler kaynak devre/sargı kimliğiyle ayrılır. Belirsiz ilişkiye şehir/TM adı atanmaz.
- Baz hesabın ikinci senaryo işleminde ezilmesi düzeltildi. Yalnız güncel, yakınsamış, boş senaryoya ait hesap baz olarak saklanır. Senaryodaki aç/kapat işlemi geri alındığında STATUS işlemi gerçekten kaldırılır. Haritadan hesap aynı kaynak/yöntem için son kullanılan ayarlarla yürür.
- ΔVm/ΔVa/ΔP/ΔQ/ΔYük yalnız geçerli baz + senaryo, aynı model/motor/yöntem/hesap ayarları ile sunulur. Eksik miktarlar boş/gri kalır. `SOURCE_SAVED`, `GA_PSSE_CALCULATED` ve `PSSE_REFERENCE` ayrı tutulur; kaynak kaydı dal akışına dönüştürülmez.

## Koordinat sözleşmesi

`viewport-transform.ts` tek affine dönüşümü tanımlar. Dünya noktası `w`, mantıksal merkez `c`, temel ölçek `s`, zoom `z`, mantıksal pan `p`, CSS fit katsayısı `k` için:

`screen = CSS_merkez + k × (p + s × z × (w − c))`.

Zoom hedefinde önce fare konumu aynı dönüşümle dünyaya çevrilir, yeni pan mantıksal birimde hesaplanır. CSS pikseli pan değişkenine yazılmaz. SVG genişletilmiş viewBox ve Canvas ölçek/kaydırması aynı dönüşümden türetilir. DPR yalnız Canvas backing-store çözünürlüğüne girer. Border dahil dış kutu yerine gerçek SVG viewport ölçülür. SVG çocuklarından sürükleme 4 CSS px eşiğiyle tıklamadan ayrılır.

## Kanıt ve kabul

Sonuç: Chrome ve Edge gerçek-model E2E PASS; 898/898 birim/regresyon testi, dokuz aşamalı DGS tarayıcı regresyonu, normal/portable/offline build, typecheck ve lint PASS. İki tarayıcı aynı 2.599.124 bayt HTML SHA-256 205cee951ffca1003809e71f831824a5c0dc09365f8112cf5d214ac1f6c9c2fe üzerinde çalıştırıldı. 1600×1000 ve 1366×768, DPR 1/1.25/2: Canvas/SVG kutu farkı 0 px; gerçek kaynak noktasının affine hizalama farkı en çok 0,000029221 CSS px; fare-anchor bounding-box sapması 0,128 CSS px. Sürükleme, ters zoom, fit, resize ve fullscreen geçti. Toolbar 93 px yüksekliğinde, teknik ayrıntılar başlangıçta kapalıdır. Gerçek şebeke ekranları yerel özel kanıt klasöründe tutulur.

- Gerçek model E2E: [V4_UIFIX3_REAL_MODEL_E2E.md](V4_UIFIX3_REAL_MODEL_E2E.md).
- DGS regresyonu: [DGS_REGRESSION_UIFIX3.md](DGS_REGRESSION_UIFIX3.md).
- Yeniden üretim: `node tools/build-psse-web.mjs`, `node tools/psse-uifix3-browser.mjs chrome`, `node tools/psse-uifix3-browser.mjs msedge`.
- Paket: `node tools/package-psse-uifix3.mjs` yalnız temiz, aynı uzak HEAD ile doğrulanmış çalışma ağacını paketler. Gerçek model ve gerçek şebeke ekranlarını allowlist dışında tutar.

## Korunan sınırlar

PSS/E bus-branch modeli, native SAV decoder, NR/FDNS/DC denklemleri ve DGS node-breaker motoru değiştirilmedi. Tam remote IREG denklemleri bu turda uygulanmadı; mevcut gerçek model `SOLVED_APPROXIMATE` / `LIMITED_PROFILE` sınırı korunur. Görsel parite aynı veri modelini veya geometrik hat güzergâhını iddia etmez: PSS/E hatları doğrulanmış TM koordinatları arasında şematiktir.
