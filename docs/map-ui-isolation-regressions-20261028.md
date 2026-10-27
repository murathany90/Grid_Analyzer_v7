# Harita UI izolasyon regresyonları — PR #16 denetim bulgularının düzeltilmesi (v8.2.5)

Tarih: 2026-10-28 · Dal: `fix/map-ui-isolation-regressions-v1` · Taban: `main` @ `ff3e9ca` (PR #16)
Kapsam: bağımsız kod denetiminde bulunan P0/P1/P2 regresyonları. Analiz motorları, elektriksel topoloji, senaryo/model hash zincirleri ve PSS/E dalları **değiştirilmedi**; PR #16'nın UI modernizasyonu korunudu.

## P0 — Paylaşılan gerilim filtresinin eski Set referansına yazması (gerileme, düzeltildi)

**Bulgu:** PR #16 öncesinde `createVoltageFilter` `ctx.filters.voltages.add/delete` çağrılarını her olayda yeniden çözümlüyordu; PR #16'daki `createVoltageFilterFor` genellemesi Set'i bileşen kurulumunda bir kez yakaladı. Controller her model yüklemede `filters` nesnesini yenisiyle değiştirdiği için Şebeke Modeli, SLD, Analizler, Envanter ve İşletme görünümlerinin gerilim filtreleri **eski Set'e** yazıyor, güncel analiz kapsamı değişmiyordu.

**Düzeltme:** `src/ui/components/voltage-filter.ts` — paylaşılan `createVoltageFilter` artık hedefi dinamik getter ile verir (`get voltages(){return ctx.filters.voltages;}`); `createVoltageFilterFor` hedefi her kullanımda çözer. Harita hedefi de aynı kalıptadır (PR #16).

**Test:** `tools/map-ui-adaptive-browser.mjs` — aynı model ikinci kez yüklendikten sonra SLD gerilim menüsünden 400 kV + 154 kV bantları kaldırılır ve `Trafo merkezi` listesinin daraldığı (2→0) ile yeniden işaretlenince geri döndüğü gözlemlenir. Yanlış Set'e yazım durumunda liste değişmezdi.

## P1a — Harita TM görüntüleme kapsamı `MapDisplayFilters`'a taşındı (düzeltildi)

**Bulgu:** Harita YTM/gerilim filtreleri ve haritada boş alana tıklama hâlâ ortak `ctx.filters.siteId`'yi temizliyordu; renderer görünürlüğü de bu analitik alanı okuyordu.

**Düzeltme:**
- `MapDisplayFilters` sözleşmesine `siteId` eklendi (`src/app/contracts.ts`); `initialMapDisplayFilters`/`mapDisplayForStudy(ytmId,tmId)`/`mapScopeKey` güncellendi (`src/map/area-scope.ts`).
- Renderer görünürlük, `renderKey`, `visibleKey`, `hitKey`, benchmark önbellek anahtarı ve boş tıklama temizliği artık `ctx.mapDisplay.siteId` kullanır (`src/map/canvas-renderer.ts`); `ctx.filters.siteId` harita görünürlüğünden tamamen çıktı.
- Harita YTM/gerilim değişimleri artık `mapDisplay.siteId`'yi temizler (`area-filter.ts`, `map-view.ts`); **`filters.siteId` hiçbir harita kontrolü tarafından yazılmaz**.
- TM odaklama davranışı korundu: Lightning SC panelinin TM seçimi hem analitik bağlamı (`filters.siteId`, SC kapsam/geçerlilik) hem harita daraltmasını (`mapDisplay.siteId`) günceller (`lightning-sc-panel.ts`).

**Test:** e2e — churn öncesi/sonrası `data-analysis-site-id` değişmezliği + `data-map-site-id` boşluğu; SN1 — gerçek modelde aynı invariance.

## P1b — Öncelikli etiket için çakışan fallback yerine baskılama (düzeltildi)

**Bulgu:** Seçili/hover TM etiketinin tüm ankraları doluysa motor kelepçelenmiş bir ankra yardımıyla **çakışmayı zorunlu kabul edebiliyordu**.

**Düzeltme:** `src/map/label-layout.ts` — işgal kutuları artık `OccupiedBox{box,removable?}`: split-bus bara etiketleri ve Q (MVAr) ölçüm etiketleri "kaldırılabilir düşük öncelikli etiket", ikonlar ve trafo işaretleri "sabit geometri" olarak işaretlenir. Öncelikli (seçili/hover) etiket için tüm ankralar yalnız kaldırılabilir kutularla çakışıyorsa o kutular **bu karede çizimden baskılanır** (`LabelPlan.suppressed`) ve renderer bunları çizmez (split etiketleri + `drawQArrows`); hiçbir sabit geometri engeli olmayan ankra seçilir. Sabit geometri tüm ankraları kapatırsa, son çare olarak **en küçük sabit-çakışma alanlı** ankra deterministik seçilir (sağ-öncelik eşitlik kırılımıyla). Düşük öncelikli adaylar için davranış değişmedi (çakışıyorsa atlanır).

**Test:** `tests/unit/map-label-layout.test.ts` — kaldırılabilir etiketin baskılandığı (ve `suppressed` döndüğü), sabit geometri karşısında en küçük çakışma ankranın seçildiği, sabitlerin asla baspılmadığı, 60 adaylık yoğun ızgarada **çift bazlı gerçek bounding-box çakışmasızlığı**; mevcut determinizm/bütçe/öncelik iddiaları yeni API ile korundu.

## P2 — YTM `NONE` durumunda açıklayıcı boş harita mesajı (düzeltildi)

`map-view.ts` — `Temizle` sonrası artık "Görüntüleme kapsamında YTM seçili değil · YTM menüsünden "Tümünü seç" ile tüm YTM'leri geri getirin." mesajı gösterilir; gerilim-grubu boşluğundaki eski mesaj ayrıdır. Overlay, YTM `NONE` veya gerilim boşluğunda görünür.

## Test güçlendirmesi (`tools/map-ui-adaptive-browser.mjs`, 30 → 42 kontrol; hiçbir mevcut kontrol kaldırılmadı/zayıflatılmadı)

- `filters.areaId/siteId` değişmezliği: churn öncesi/sonrası `data-analysis-site-id` sabitliği + `data-map-site-id` boşluğu.
- Model değişimi sonrası ortak gerilim filtresi (P0 bloğu, SLD gözlemlenebilir davranış).
- Görünür hat/TM sayıları: renderer `dataset.visibleLines/visibleSites`; NONE → 0/0, Tümü → >0.
- Gerçek etiket bounding-box çakışmaları: birim testte 60 adaylı ızgara çift-bazlı çakışmasızlık + baskılama senaryoları.
- Lightning/lejant: görsel varlık kontrolü **kesin dikdörtgen ayrıklığına** yükseltildi (panel–lejant, panel–⚡ düğmesi).
- Deterministik zoom: aynı tekerlek dizisi `Sığdır`'dan iki kez uygulandığında, **boyama durulduktan sonra** (`paintCount` sabitlenene dek beklenerek) etiket düzeni bit-bit aynı.
- P2 mesajı: NONE durumunda açıklayıcı metin + overlay'in geri gizlenmesi.

## SN1 gerçek-model kabulü (yerel, git dışı)

`tools/map-sn1-acceptance.mjs` güçlendirildi: filtre churn sonrası **sonuç kimliği** yanında **mühendislik ayrıntı değerleri** (`Ayrıntı` panelindeki Newton/iterasyon metni) ve `filters.siteId` değişmezliği de iddia ediliyor. Diğer kabul adımları (10 YTM, ulusal 140 / Orta Anadolu 1/10 kapsamı 80 / yakın zoom 28 etiket, 4 tur churn'de `runs` sabitliği) korundu.

## Doğrulama

- `npm run typecheck` ✓ · `npm run lint` ✓ · `npm test` 787 test (786 ✓ + commit sonrası yeşile dönen portable-bytes kapısı) — DGS regresyonları dahil
- `GA_DESKTOP_ONLY=1 npm run test:e2e` tam zincir ✓ (42 kontrollü yeni kabul dahil)
- `node tools/map-sn1-acceptance.mjs <SN1.zip>` — CI dışı yerel kabul
- Portable blob tazelendi; exact-HEAD CI `validate` + Pages deploy + canlı `gridfreq.info` doğrulaması merge sonrası yapılır.

## Kalan sınırlar

- Öncelikli etiketin sabit geometri (başka TM ikonu/trafo işareti) ile son çare kelepçelenmesi: ikonlar veri taşıdığından kaldırılamaz; metin ikon üzerine binse de seçili etiket okunur kalır — baskılama yalnız etiket sınıfına uygulanır.
- SC paneli TM seçiminin haritayı daraltmaya devam etmesi bilinçli bir köprüdür (analitik bağlam ve görüntüleme kapsamı aynı anda güncellenir); harita tarafı yine `filters`'a yazmaz.
- SC analiz görünümündeki önceden var olan 768px yatay taşması bu dalın kapsamı dışıdır (bkz. `docs/map-ui-adaptive-filters-20261027.md`).
