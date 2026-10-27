# Model yükleme ve UI durum denetimi — son regresyon turu (v8.2.5)

Tarih: 2026-10-28 · Dal: `fix/model-loader-ui-state-v1` · Taban: `main` @ `6fd6c9d` (PR #17 sonrası)
Kapsam: model yükleme/iptal, model değiştirme durum temizliği, harita izolasyonu (SC panel TM köprüsü + Kapasite ayrımı), Şebeke Modeli filtre temizliği. Analiz motorları, elektriksel topoloji, PSS/E dalları değiştirilmedi; PR #16/#17 UI modernizasyonu ve mevcut 42 e2e kontrolü korundu (güçlendirildi: **58 kontrol**).

## P1 — Model dosyası iptali ve yeniden seçim (`src/features/model/model-view.ts`)

**Bug:** `load()`'un `finally` bloğu yalnız kendi üretim (generation) numarası güncelse temizlik yapıyordu; **iptal yolu** (`loadGeneration++` ile) `finally`'i erken döndürüyordu ve `input.value` temizlenmiyordu. Tarayıcı `value` dolu kaldıkça aynı dosya için `change` olayı ateşlemediğinden **iptal/tekrar seçim sonrası aynı JSON/ZIP bir daha yüklenemiyordu**; ayrıca ZIP seçim diyaloğu açıkken iptal edilince diyaloğu kimse kapatmıyordu ve `choose` düğmesi devre dışı kalabiliyordu.

**Önceki davranış:** iptal → aynı dosyayı tekrar seç → hiçbir şey olmaz. **Sonraki:** iptal → `input.value=''`, `choose` etkin, açık ZIP diyaloğu kapatılır (`abortEntrySelection`), yeniden seçim çalışır. `finally` bilinçli olarak üretim korumalı kalır (yeni yükleme durumunu ezmemek için) — iptal temizliği iptal işleyicisinde yapılır.

**Testler:** SN1 kabulü — uzun yükleme sırasında iptal → `busy` biter + `input.value===''` + aynı dosya yeniden yüklenir (18/18); sentetik e2e — ZIP diyaloğu 'Vazgeç' → `input.value===''` + yeniden seçim; CRC hatalı ZIP → Türkçe hata + `input.value===''` + uygulama ayakta.

## P1 — A→B→A model değiştirmede durum taşınması (`src/app/controller.ts`)

**Bulgu:** `loadFiles` filtreleri/mapDisplay'i sıfırlıyordu ama **`resultView`'ı sıfırlamıyordu** — eski modelin metric/caseId/faultId/fid görüntüleme bağlamı yeni modele taşınıyordu. `clearModel` aynı eksikteydi.

**Düzeltme:** model yükleme ve `clearModel` artık `resultView=initialResultView()` + `analysisTab='LF'` yapar; filtreler/mapDisplay/sonuç deposu zaten hash anahtarlı sıfırlanıyor. IndexedDB geri yüklemesi modelHash anahtarlıdır: **A'ya dönüş, yalnız A'nın kendi çalışma alanı sonuçlarını getirir** (B'nin kimliği taşınmaz).

**Test (sentetik e2e):** A hesaplanır (`result-id` kaydedilir) → B (mutasyonlu ikinci model) yüklenir → `areaScope=ALL`, `analysisSiteId/mapSiteId=''`, `result-id=NOT_RUN` (A kimliği taşınmaz) → sıfır-ElmSite bozuk model yüklenir, harita çökmez → A'ya dönüş → model kimliği geri gelir **ve A'nın LF sonuç kimliği IndexedDB'den bit-bit restore edilir**.

## P1 — Harita izolasyonu

**SC panel TM ↔ YTM kapsam çelişkisi:** SC paneli TM seçimi hem analitik bağlamı (`filters.siteId`) hem harita TM kapsamını (`mapDisplay.siteId`) günceller; seçilen TM aktif YTM görüntüleme kapsamının DIŞINDAYSA eski görünürlük filtresi onu gizliyordu (çelişki). **Düzeltme:** açık TM odağı (`mapDisplay.siteId`) YTM/gerilim kapsam filtrelerini o TM ve hatları için geçersiz kılar (`canvas-renderer.ts`) — odaklanan TM her koşulda görünür; odağı temizleyince kapsam görünümü döner. Test: kapsam tek YTM'ye daraltılır, SC panelinden kapsam dışı TM seçilir → `visibleSites=1` + `mapSiteId=odak`; temizle → kapsam görünümüne dönüş.

**Kapasite ayrımı (görsel seçim ↔ hesaplama varsayımı):** harita Kapasite seçimi `setCapacitySeason` ile **küresel mühendislik oturumunu** değiştiriyordu — bu oturum analiz tablolarının yüklenme paydalarını ve N-1 kataloğu kapsamını da belirliyordu; bir görüntüleme çubuğu denetiminin analitik varsayımı sessizce değiştirmesi sorunu. **Düzeltme:** `MapDisplayFilters.capacitySeason:'inherit'|sezon` (contracts) — harita seçimi artık yalnız **harita yüklenme paydasını** değiştirir: `displayBranches` ve `mapLoadingValues` isteğe bağlı sezon parametresi aldı (kendi önbellek anahtarları sezonlu), renderer `lfKey`/flowRows ve `layer-policy` benchmark yüklenme katmanı etkin harita sezonunu kullanır. **Küresel mühendislik oturumu artık yalnız Kapasite görünümünden** (`capacity-view.ts` — mevcut mühendislik denetimi) değişir; harita seçimi onu asla yazmaz. Test: haritada 'summer' → `data-capacity-season=summer` + `data-session-capacity-season=nominal` (yeni dataset kancaları).

## P2 — Şebeke Modeli 'Filtreleri temizle' (`network-model-workspace.ts`)

**Bug:** düğme YTM/TM/aramayı sıfırlıyor ama **gerilim bantlarını sıfırlamıyordu** (checkbox'lar daralmış kalıyordu) ve seçimi temizlemiyordu. **Düzeltme:** + `filters.voltages=allVoltageBands()` + `ctx.selection=null`. SLD/Envanter/İşletme/Model Kalitesi filtreleri model değişiminde modelHash anahtarlı yeniden kurulumla zaten tazeleniyordu; A→B→A e2e SLD listesinin modele göre değiştiğini doğrular.

## Test envanteri

| Katman | Sonuç |
|---|---|
| typecheck / mimari lint | temiz / 512 dosya ✓ |
| `npm test` (DGS regresyonları dahil) | 787 test · 786 ✓ · 1 bilinen (portable-bytes, commit sonrası 5/5) |
| `GA_DESKTOP_ONLY=1 npm run test:e2e` | tam zincir ✓ — **map-ui-adaptive 42 → 58 kontrol** (hiçbiri kaldırılmadı/zayıflatılmadı) |
| Yeni e2e kontrolleri | CRC hatası + input hijyeni, çoklu-JSON ZIP diyaloğu (Vazgeç + seçim), sıfır-ElmSite bozuk model dayanıklılığı, A→B→A (kimlik + kapsam + IndexedDB restore), N-1 bağlamında churn=0 solver, SC panel TM odak çelişkisizliği, Kapasite görüntüleme/oturum ayrımı |
| SN1 gerçek model (yerel, git-dışı kanıt) | **18/18** — iptal+aynı-dosya, 1.625 TM arayüzü, 10 YTM, ulusal 140 / Orta Anadolu 1/10 kapsamı 80 / yakın zoom 28 etiket, churn sonrası `runs=1` + sonuç kimliği `LF-c179e317d81…` bit-aynı + Newton/ayrıntı değerleri ve `filters.siteId` korunur |

Portable blob tazelendi (COMMITTED_PORTABLE_BYTES kapısı, commit sonrası yeşil).

## Kalan sınırlar

- ZIP CRC hatası **ayıklama (extract) aşamasında** yakalanır: denetim (inspect) başarılı olduktan sonra hata, önceki model korunur (bilinçli davranış — mevcut oturum bozulmaz); denetim aşamasındaki bozukluklar 'JSON veya ZIP dosyaları seçin' iletisiyle reddedilir.
- Sıfır-ElmSite DGS modellerinde ithalatçı sahiplik hiyerarşisinden TM türetmeye devam eder (tasarım); test bu nedenle 'sıfır TM' yerine 'bozuk/eksik modelde çökmemek + YTM menüsü işlevsel' iddiasını doğrular.
- Harita Kapasite seçimi görüntüleme-özel olsa da 'loading' görünümünde payda farkı kullanıcıya legend ayrıntısında yansır (sezon satırı); mühendislik oturumu ile harita seçimi bilinçli olarak ayrı kalır.
- SC analiz görünümündeki önceden var olan 768px taşması kapsam dışıdır (bkz. önceki raporlar).
