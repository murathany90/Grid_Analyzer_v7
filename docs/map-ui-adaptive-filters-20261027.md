# Harita UI/UX Modernizasyonu — MapDisplayFilters, Adaptif TM Etiketleri, Filtre Çubuğu (v8.2.5)

Tarih: 2026-10-27 · Dal: `feature/map-ui-adaptive-filters-v1` · Taban: `main` @ `70c098a` (PR #15 sonrası)

## Amaç ve temel ilke

Harita görselleştirmesi modernize edildi; **temel mimari ilke**: haritadaki tüm YTM, TM, gerilim, metrik, hat yerleşimi, etiket, zoom ve gösterim filtreleri **yalnız görselleştirme içindir**. Bunun için `MapDisplayFilters` adlı bağımsız harita görüntüleme durumu tanımlandı; YTM ve gerilim seçimleri analizlerin kullandığı ortak `ctx.filters` alanlarından ayrıldı. Analiz davranışları, hesaplama kapsamı, elektriksel topoloji, senaryo, model/sonuç hash'leri ve sonuç önbellekleri **değişmedi**.

## Mimari değişiklikler

| Bileşen | Dosya | Değişiklik |
|---|---|---|
| `MapDisplayFilters` sözleşmesi | `src/app/contracts.ts` | `MapAreaScopeMode = 'ALL'\|'NONE'\|'SELECTED'` + `MapDisplayFilters {areaMode, areaIds, voltages}`; `ctx.mapDisplay` (zorunlu alan) ve `ctx.stats.runs` (hesaplama sayacı, test kanıtı) eklendi |
| Tri-state kapsam | `src/map/area-scope.ts` (yeni) | `areaInScope`, `scopeAreaFilter`, `mapScopeKey`, `mapAreaScopeLabel` (`Tümü`/`Yok`/`n/N`), `initialMapDisplayFilters`. Boş dizi belirsizliği yok: **Temizle = NONE (hiçbir YTM görünmez)**, Tümü = ALL, kısmi = SELECTED |
| YTM multi-select | `src/ui/components/area-filter.ts` (yeni) | Aranabilir (`tr-TR`), checkbox'lı, Tümünü seç/Temizle, `n/N` sayaç, `role=group aria-label='YTM filtresi'`, klavye erişilebilir; `summary.id='mapArea'` (eski odak sözleşmesi korunur) |
| Gerilim filtresi genelleme | `src/ui/components/voltage-filter.ts` | `createVoltageFilterFor(target)` — harita kendi `mapDisplay.voltages` Set'ine yazar (getter ile dinamik çözümleme; model değişiminde eski referans tuzağı yok); SLD/analiz/envanter ortak filtresi ve `ctx.filters.voltages` davranışı birebir korundu |
| Controller | `src/app/controller.ts` | Model yükleme/temizlemede `mapDisplay` sıfırlanır; çalışma dosyası geri yüklemede `mapDisplayForStudy(ytmId)` ile tohumlanır (`filters.areaId`'ye örtük geri düşüş YOK); `stats.runs` tüm hesap giriş noktalarında (`run`, `runN1Screen`, `runSc`, `runHybrid`, `runN1AcValidation`, `runYtmStudy`, `runModelQuality`) artar |
| Renderer | `src/map/canvas-renderer.ts` | Görünürlük/anahtarlar (`renderKey`, `visibleKey`, `benchmarkCache`, `hitKey`, `lfKey`) `mapDisplay` bazlı; `filters.areaId`/`voltages` harita görünürlüğünden tamamen çıktı |
| Sunum katmanı | `src/map/layer-policy.ts`, `src/map/equipment-tooltip.ts` | `representativeStationBus`, `representativeReferenceBySite`, topoloji kartı filtreleri `mapDisplay.voltages` okur (harita gerilim filtresi artık analiz tablolarını etkilemez) |
| Test kancaları | `src/map/map-view.ts` | `root.dataset.runCount`, `root.dataset.areaScope`; renderer `dataset.labelCount` |

## Filtre çubuğu yeniden tasarımı

- **"Hatlar" menüsü kaldırıldı**; `Hat yerleşimi` (Standart/Ayrık → `settings.layoutMode`) ve `LF görünümü` (Baz/Senaryo/Fark → `resultStore.role` + `resultView.source/phase` + `benchmarkMap` bağlantıları korunarak) üst çubuğa iki bağımsız select olarak getirildi.
- **Birinci satır** (7 kontrol, sabit 7-kanatlı grid): YTM · Gerilim · Hat yerleşimi · LF görünümü · Analiz · Kaynak · Senaryo/Baz chip'i.
- **İkinci satır** (esnek, sarmalı): Metrik · Kesinti/Arıza · Akış · TM · Etiketler · Sade güzergâh · Hat/FID arama+Bul · Sonuçlar/Hesapla · Yenile · Sığdır · Tam ekran · Ölçüm.
- **Metrik genişliği** `flex:0 1 240px; max-width:260px; min-width:175px` (eski genişlik ~1/3 satırdı); uzun seçenek metinleri `option.title` + seçili `title` tooltip'i ile korunuyor.
- **Sarma düzeltmesi**: eski sabit `height:34px` → `min-height:34px`; ≤1100px'te scope satırı esnek sarılır ve satır doğal büyür (`fitViewport` ResizeObserver ile yeniden ölçer). Masaüstünde (≥1100px) 7 kontrol tek satırda 34px. Bulunan tarayıcı tuhaflığı: bu Chromium'da kapalı `<details>` içeriği esnek/grid iç boyutuna boyut sızdırıyordu; `.ga-map-menu:not([open])>.ga-map-menu-body{display:none}` ile giderildi.
- **Harita yüksekliği**: `fitViewport()` artık toolbar ve durum çubuğunun **gerçek ölçüsünü** (`getBoundingClientRect`) kullanıyor (sabit 38/46px pay yerine); toolbar'da `ResizeObserver` satır sarmasında harita yüksekliğini yeniden hesaplar; fullscreen payı gerçek ölçüye göre 30px.
- Menü gövdeleri artık kapalıyken DOM'dan tamamen çekiliyor; açık gövde `z-index:15` ile mevcut katman düzeninde.

## LF görünümü davranış düzeltmesi

Eski `role.onchange` seçimi **N-1/SC'deyken analiz sekmesini LF'e zorluyordu**. Artık `LF görünümü` yalnız LF görüntüleme bağlamını değiştirir (`resultStore.role`; `source`/`phase` yalnız `analysis==='LF'` iken), `analysisTab`/`resultView.analysis`'e dokunmaz ve **hiçbir hesaplamayı tetiklemez**. e2e kanıtı: N-1 seçiliyken görünüm değişimi `status=N1` kalır, `runCount` artmaz.

## Adaptif TM etiketleri

Eski uygulama `fillText(s.name,x+5,y-5)` idi — zoom eşiği yok, çakışma önleme yok; Türkiye genelinde tüm adlar üst üste çiziliyordu.

Yeni saf motor `src/map/label-layout.ts` + renderer entegrasyonu:

- **Bütçe DPR'den bağımsız** (CSS piksel): `labelBudget(width,height,zoom)` = `min(200, max(10, alan/2800)) × zoom ölçek küçük (0.4–1.5)`, üst sınır 260. Ekran yoğunluğu yapay olarak etiket sayısını artırmaz.
- **Öncelik**: seçili TM (`1e9`) > hover TM (`5e8`) > maksimum gerilim bandı (400=5 … ≤36=1) > `localeCompare('tr')` + id ile deterministik eşitlik kırılımı.
- **Çakışma**: 64px uzamsal grid üzerinde dikdörtgen testi; **split-bus bara etiketleri, Q (MVAr) ölçüm etiketleri, trafo işaretleri ve tüm TM ikon kutuları** işgal kümesine dahil — TM adları bunların üstüne binmez.
- **Yerleşim adayları** sırası [sağ, üst, alt, sol]; kenardan taşan aday elenir; seçili/hover etiketi her durumda yerleşir (görünüm içine kelepçelenir).
- **Determinizm**: aynı girdi → aynı çıktı (girdi sırasından bağımsız); `measureText` sonuçları `Map` ile önbelleklenir; hover değişimi **yalnız etiketler açıkken** yeniden çizim tetikler (renderKey'e koşullu `hovered` dahil).
- Etiketler kapalıyken davranış korunur: yalnız seçili TM etiketi + hover tooltip; TM koordinatı, adı, FID değişmez.
- Ölçüm kanıtı: `dataset.labelCount` — SN1 gerçek modelinde ulusal görünümde 140 / yakın zoomda bütçe içinde (aşağıda).

## Lejant, durum mesajları, genel UI

- **Lejant** nominal dalı artık `mapDisplay.voltages` ile senkron: seçili olmayan gerilim gruplarının renk çipleri gösterilmez; hiçbir grup yoksa "Gerilim grubu seçilmedi".
- **Sonuç yok/STALE mesajları** (`layer-policy.ts`): `N-1 sonucu yok (NOT_RUN) · … · tarama çalıştırın`, `SC sonucu yok (NOT_RUN) · … · arıza hesabı çalıştırın`, `LF sonucu yok (NOT_RUN / STALE) · … · Hesapla'yı kullanın` — teknik kodlar metinde korunur ve **yeni `mapStatusDetail(ctx)`** ayrıntı paneline (`Ayrıntı` ▸ `method=`, `status=` satırları) yazılır. Hesaplanmamış veri sayısal katman olarak gösterilmez (`colorNoResult` kapısı, `NO_DATA` gerekçesi ve kilit mantığı değişmedi).
- Lightning paneli açıkken lejant + ⚡ düğmesi görünür kalır (e2e iddiası); SC popup yerleşim algoritması ve z-index katmanları (tooltip 50 > ayrıntı 30 > menü 15 > popup 8 > panel 6) doğrulandı.

## Görüntüleme–analiz ayrımı kabulü (kritik)

Sentetik modelde LF hesaplandıktan sonra harita filtreleri defalarca değiştirildi (YTM işaretle/kaldır, gerilim Temizle/Tümü, hat yerleşimi, LF görünümü, etiketler):

- `stats.runs` **1'de sabit** (sıfır ek solver çağrısı),
- `data-result-id` (sonuç kimliği/hash) **bit olarak değişmedi**,
- filtreler kaldırıldığında hesaplanmış LF sunumu aynen geri geldi (`NR yakınsadı`).

## Test envanteri ve kanıtlar

| Katman | Sonuç |
|---|---|
| `npm run typecheck` | temiz |
| `npm run lint` (mimari) | 512 dosya geçti |
| `npm test` | 784 test · **783 geçti** · 1 bilinen (aşağıda) |
| `npm run test:e2e` (GA_DESKTOP_ONLY=1, CI muadili) | 10 betik zinciri **yeşil** (`browser-smoke`, PF benchmark, map lightning, N-1 diag, SLD, N-1/SC, workspace, analysis-ux, network-model, **map-ui-adaptive**) |
| `tools/map-ui-adaptive-browser.mjs` (zincire eklendi) | **30/30 kontrol** |
| Yeni birim testler | `map-area-scope` (6) + `map-label-layout` (10) + `map-status-messages` (3) = **19 test** |
| Uyarlanan mevcut testler | `desktop-map-presentation`, `map-presentation-index`, `map-island-loading-tooltip`, `map-scale` fikstürü → `mapDisplay`; `browser-smoke` YTM/Hatlar adımları yeni bileşenlere geçirildi (iddia zayıflatılmadan) |

Bilinen tek birim hatası: `portable-byte-provenance` — test, taze derlemeyi **`git show HEAD:`** ile karşılaştırır; tazelenen `dist-portable/GridAnalyzer_v7.html` bu dala commit'lendiği için commit sonrası yeşildir (CI'daki aynı kapı).

### Taşma/viewport kanıtı (`tools/map-ui-evidence.mjs`, `metrics.json`)

1366×768, 1920×1080, 1024×640 (dar CSS viewport) ve deviceScaleFactor 1.25 (ayrı bağlam; tarayıcı zoom etkisi ayrı değerlendirilir: %125 zoom ≈ daha küçük CSS viewport + dpr — her ikisi de ayrı bağlamlarda test edildi): tüm satırlarda `scrollWidth === clientWidth`, belge düzeyinde yatay kaydırma yok, iki fiziksel satır, scope 7 kontrol.

### SN1 gerçek-model kabulü (`tools/map-sn1-acceptance.mjs`, yerel, git dışı)

Model `20261026_1700_SN1_TR0.zip` (referans: kullanıcının 27.10 modeli). Kanıt: `local-benchmark-results/map-sn1-acceptance-20261027/` (yerel; Git'e eklenmedi).

- İçe aktarma ~14-16 s; **10 YTM** listelendi; Tüm YTM sayacı doğru.
- Ulusal görünümde etiketler açık: **140 etiket** çizildi (bütçe ≤260; eski davranışta tüm adlar çiziliyordu).
- Orta Anadolu YTM tek seçim → `1/10` SELECTED kapsamı + ekran görüntüsü (80 etiket); Tümünü seç → `Tümü`.
- Yakın zoomda yoğun TM etiketleme: **28 etiket** (bütçe içinde); ekran görüntüleri `sn1-tumu-labels.png`, `sn1-orta-anadolu.png`, `sn1-zoom-dense.png`, `sn1-after-churn.png`.
- LF hesap sonrası 4 tur filtre churn: **solver çağrısı `runs=1` sabit, sonuç kimliği `LF-c179e317d81…` bit olarak değişmedi, `NR yakınsadı` sunumu korundu** (yukarıdaki ayrım kabulünün büyük şebeke tekrarı).
- SN3/SN4 (`kontrol1`) bu kabulün **yerine geçmez**; ayrı yerel koşular mevcut `test:full` altyapısıyla ayrıdır.

### Önce/sonra ekran görüntüleri

Sentetik (`tests/fixtures/small-dgs.json` — elektriksel fikstür değişmez, yalnız sentetik GPS/kip tuhaflıkları türetilir): `docs/screenshots/map-ui-adaptive-20261027/{before,after}/` — 1366 tam görünüm, etiketler açık ulusal, yakın zoom, Lightning açık. Gerçek-model görüntüleri yerelde tutuldu.

## Bulunan ve düzeltilen sorunlar

1. **TM etiketlerinde çakışma** — tamamen çare (bütçe + çakışma motoru).
2. **"Hatlar" iç içe menüsü** — kaldırıldı, iki select doğrudan çubukta.
3. **Metrik kontrolünün aşırı genişliği** — 260px üst sınıra çekildi.
4. **LF görünümünün N-1/SC'de analizi LF'e zorlaması** — kaldırıldı.
5. **Kapalı menü gövdelerinin layout'a boyut sızdırması** (Chromium `content-visibility` tuhaflığı) — `display:none` kuralı.
6. **Harita yüksekliği sabit pay** — gerçek ölçüm + ResizeObserver.
7. **Model yenilemede harita gerilim filtresinin eski Set'e yazması riski** — hedef getter'ı dinamik çözümler.
8. **Lejantın seçili gerilimlerle ilgisiz olması** — senkronlandı.
9. **Sonuç-yok durumunun yalnız teknik kod olması** — Türkçe yönlendirme + ayrıntıda kod.

## Kalan sınırlar (bu dal kapsamı dışı)

- **Önceden var olan**: `Kısa Devre Analizi` görünümünde 768px genişlikte yatay taşma — **temiz `main`'de de mevcut** (aynı assertion aynı şekilde kırılıyor; CI `GA_DESKTOP_ONLY=1` olduğu için 768 turu atlanır). Bu dal harita kapsamlıdır; ayrı bir düzeltme konusu olarak kaydedildi.
- Tarayıcı zoom (Ctrl±) doğrudan otomasyonla ayarlanamadığı için %125 etkisi iki ayrı mekanizma ile ayrı ayrı test edildi (dar CSS viewport + deviceScaleFactor 1.25).
- `filters.areaId`'yi analiz ekranlarından (YTM çalışması, envanter ortak kapsam) besleme davranışı bilinçli olarak korundu; harita artık bu alanı yazmaz — eski "haritadan YTM seç → analiz tabloları da daralır" davranışı istemli olarak kaldırıldı (görüntüleme/analiz ayrımı gereği).

## Komutlar

```
npm run typecheck && npm run lint && npm test
GA_DESKTOP_ONLY=1 npm run test:e2e
node tools/map-ui-evidence.mjs --tag after
node tools/map-sn1-acceptance.mjs <SN1.zip>   # yerel kabul, git dışı kanıt
```
