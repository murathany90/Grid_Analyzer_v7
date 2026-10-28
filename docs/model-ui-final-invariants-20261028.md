# PR #18 son kod denetimi — model yükleme ve UI değişmezlikleri (v8.2.5)

Tarih: 2026-10-28 · Dal: `fix/model-ui-final-invariants-v1` · Taban: `main` @ `82c3a69` (PR #18)
Kapsam: denetim bulgularının kaynak/testlerle yeniden doğrulanması ve düzeltilmesi. Solver, elektriksel topoloji, PSS/E dalları değiştirilmedi; PR #16/#17/#18 geliştirmeleri ve 58 e2e kontrolü korundu.

## Bulgu 1 — `loadBenchmarkPair()` model geçiş sıfırlaması (DOĞRULANDI, düzeltildi)

**Kod kanıtı:** `src/app/controller.ts` — eski `loadBenchmarkPair` yalnız geçici sonuçları/selection sıfırlıyor, **`filters`, `mapDisplay`, `resultView`, `analysisTab`, `modelQualityScenarioHash/AnalysisScope`, `n1Progress`, `n1CatalogIdentity`** alanlarını hiç dokunmadan bırakıyordu; `loadFiles` ise bu sıfırlamayı kendi gövdesinde (PR #18 ile) yapıyordu — iki giriş yolu farklı sözleşmelerle çalışıyordu.

**Düzeltme:** ortak model geçiş mantığı iki özel yönteme ayrıştırıldı: `beginModelLoad(totalBytes,message)` (uçuştaki işleri iptal eder, geçici sonuçlar/selection/önbellekleri düşürür, job üretir) ve `adoptLoadedModel()` (yeni model benimsenince model-bağlı `filters/mapDisplay/resultView/analysisTab` + model kalitesi + N-1 durumunu sıfırlar). `loadFiles`, `loadBenchmarkPair` ve `clearModel` aynı sözleşmeyi kullanır. Başarısız yüklemede önceki model durumu bilinçli olarak korunur (mevcut davranış).

**Test:** yeni `tools/model-transition-browser.mjs` (test:e2e zincirine eklendi, sc-engine kalıbında harness sayfa + gerçek `Application`): `loadFiles` A→B→A ve `loadBenchmarkPair` (gerçek sentetik model+referans ZIP, `syntheticBenchmarkPair`) için 11 kontrol — filtreler (YTM/TM/arama/gerilim), harita kapsamı (areaMode/areaIds/siteId/capacitySeason), `resultView` (metric/caseId/faultId/fid), `analysisTab`, selection ve geçici sonuçlar her iki yolda da temiz. İlk koşuda bulgu aynen tekrarlandı (benchmark-pair sonrası kirli durum), düzeltme sonrası **11/11**.

## Bulgu 2 — SC paneli TM odağının filtre atlaması (DOĞRULANDI, anlam netleşti)

**Kod kanıtı:** `canvas-renderer.ts` görünürlük bloğu — `mapDisplay.siteId` doluysa YTM **ve gerilim** filtreleri tamamen atlanıyordu; `areaMode:'NONE'` veya boş gerilim seçiminde "boş harita" örtüsünün **üzerine** hayalet TM çiziliyordu (çelişki).

**Düzeltme:** odağın anlamı açıkça sınırlandı — (1) odak **yalnız YTM alan kapsamını** geçersiz kılar ve yalnız görüntüleme kapsamı boş değilken etkilidir; (2) **gerilim görüntüleme filtresi odaklı TM'ye de uygulanır** (artık atlanmaz); (3) `NONE`/boş gerilim durumunda boş harita korunur, odaklanan TM çizilmez ve örtü mesajı nedeni açıkça söyler: "Odaklanan TM kapsam boş olduğu için gizli; YTM/gerilim kapsamını genişletin." Analitik `filters.siteId` yine hiçbir harita yoluna yazılmaz.

**Testler (e2e, SC paneli + gerçek olay akışı):** kapsam daraltılırken kapsam dışı TM odağı → `visibleSites=1` + `mapSiteId=odak`; **YTM NONE + odak → `visibleSites=0` + örtüde açıklayıcı mesaj**; **gerilim Temizle + odak → TM yine gizli**; odağı temizleme → kapsam görünümüne dönüş.

## Bulgu 3 — Kapasite ayrımının sayısal doğrulaması (yeni birim test)

`tests/unit/map-loading-study-table.test.ts`: nominal (0,1 kA) ve yaz (0,2 kA) limitli sentetik hatta `mapLoadingValues(network,result,'summer')` görüntüleme paydası değişir — **yüklenme % 80→40, uç yüzdeleleri 20/80→10/40, payda 100→200 A** — ama **MW/MVA uç girdileri, hesap sonucunun baytları, mühendislik kapasite oturumu (season='nominal', revision sabit — N-1 katalog kimliğinin girdisi) ve nominal projeksiyon önbelleği değişmez**. `displayBranches(network,result,'summer')` ayrı doğrulandı. Harita görüntüleme seçimi yalnız görüntüleme paydasını değiştirir; hesap varsayımı (mühendislik oturumu) dokunulmaz.

## Bulgu 4 — ZIP inceleme/açma iptalinin gerçek durdurulması (düzenlendi)

**Bulgu:** iptal yalnız generation sayacını ilerletiyordu; **CPU-bound `inspectModelFile`/`extract` döngüleri sonuna kadar çalışmaya devam ediyordu** (bellek: çıkarılan Blob'lar doğal bitişte atılıyordu). Eski üretim sonucunun uygulanması zaten generation korumasıyla engelleniyordu (korundu).

**Düzeltme:** `model-file.ts` — `inspectModelFile(file,signal?)` ve `extract(entry,signal?)` kooperatif `AbortSignal` kabul eder; 64 KiB'lik parça döngülerinin sınırında `checkAbort` ile düşük gecikmeli durur (en fazla bir parça işi). `model-view.ts` her yükleme için kendi `AbortController`'ını oluşturur; iptal düğmesi `abort()` çağırır ve iptal edilmiş yüklemenin hata mesajı 'Model yüklenemedi' ile EZİLMEZ (iptal mesajı korunur). SN1 kabulünde gerçek uzun yüklemede iptal + aynı dosya yeniden seçimi doğrulanır.

## Bulgu 5 — CRC negatif testinin nedeni ve durum doğruluğu (güçlendirildi)

e2e artık CRC hatasının **tam Türkçe nedenini** doğrular ('CRC doğrulaması başarısız' — `model-file.ts:44`) ve doğru durum를 assert eder: ayıklama aşaması hatasında **önceki model ve görüntüleme kapsamı korunur** (başlık değişmez, `areaScope` aynı), `input.value=''` ile yeniden seçim mümkün. Kalıcı teşhis: 768/390 taşma durumunda geniş element dökümü (`WIDE@…`).

## 768 px SC analiz taşması (önceden var olan — hedefli düzeltme UYGULANDI)

**Kök neden:** `analysis-evidence` kabulünde 768px'te belgeyi taşan öğe `table.ga-compact-table` (1080px iç min-genişlik; sarmalayıcı `.ga-compact-table-host` yatay kaydırma içermiyordu) — temiz main'de de mevcuttu.
**Düzeltme:** `src/styles/analysis.css` — `.ga-compact-table-host`'a `overflow-x:auto` (tek özellik): tablo artık konağın içinde yatay kayar, belge taşmaz. **Doğrulama:** `browser-smoke` tam geçti; `ANALYSIS_EVIDENCE_AUDIT PASS` — 768 ve 390 dahil tüm genişliklerde `overflow:false` (önceki koşulda WIDE@768 dökümü mevcuttu).

## Test envanteri

| Katman | Sonuç |
|---|---|
| typecheck / mimari lint | temiz / 513 dosya ✓ |
| `npm test` (DGS regresyonları dahil) | 788 test · 787 ✓ · 1 bilinen (portable-bytes, commit sonrası 5/5) |
| `GA_DESKTOP_ONLY=1 npm run test:e2e` | tam zincir ✓ — map-ui-adaptive **58 kontrol** (korundu) + **yeni model-transition 11 kontrol** |
| SN1 gerçek model (yerel, git-dışı) | 18/18 — iptal+aynı-dosya, 1.625 TM, etiket bütçeleri, churn sonrası `runs=1` + kimlik `LF-c179e317d81…` bit-aynı |

Portable blob tazelendi (commit sonrası byte kapısı yeşil).

## Kalan sınırlamalar

- ZIP CRC hatası ayıklama aşamasında yakalanır; denetim aşamasındaki bozukluklar 'bozuk veya tamamlanmamış arşiv' gibi ayrı nedenlerle reddedilir — önceki model bilinçli olarak korunur.
- ZIP iptali kooperatiftir: en fazla bir 64 KiB parçalık iş sonrası durur (sınırlı gecikme); üretim koruması eski sonucun uygulanmasını her koşulda engeller.
- Sıfır-ElmSite DGS'de ithalatçı hiyerarşiden TM türetir (tasarım); dayanıklılık iddiası çökmezlik + YTM menüsü işlevselliğidir.
- Kapasite görüntüleme sezonu haritada 'loading' görünümünün paydasını değiştirir; lejant sezon satırıyla şeffaftır. Mühendislik oturumu ile bilinçli olarak ayrıdır.
