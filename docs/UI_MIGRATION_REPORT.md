# Grid Analyzer v8.2.5 — UI migration

## Kaynak ve teslim kimliği

- Başlangıç: `fix/ytm-n1-constraints-sc-pf-parity-20261010`, `dc1e3082aed8384a9e7bd41858096a3a5c4fded6`.
- Teslim dalı: `feat/ui-model-analysis-compare-help-20261010`.
- Paket/worker adaptörü: `2036028`.
- Doğrulanan uygulama kaynak HEAD'i: `cba5938c8ec412430fed754ffef507c0b94cd573`. Sonraki rapor commit'i uygulama kaynaklarını veya portable baytlarını değiştirmez.
- [Teslim dalının HEAD'i](https://github.com/murathany90/Grid_Analyzer_v7/tree/feat/ui-model-analysis-compare-help-20261010) ve [bu dalın CI çalışmaları](https://github.com/murathany90/Grid_Analyzer_v7/actions/workflows/ci.yml?query=branch%3Afeat%2Fui-model-analysis-compare-help-20261010). Raporun kendi commit SHA'sını dosya içine yazmak öz başvuru oluşturacağından teslim HEAD'i dal bağlantısında, kesin CI run/SHA ise teslim mesajında verilir.

![Teslim dalının güncel CI durumu](https://github.com/murathany90/Grid_Analyzer_v7/actions/workflows/ci.yml/badge.svg?branch=feat%2Fui-model-analysis-compare-help-20261010)

Main ve başlangıç fix dalına commit/push yapılmadı; yeni dal normal push ile teslim edilir.

## Korunan işlevler ve yeni konumlar

Üst menü: **Model Yükle / Şebeke Envanteri / İşletme Verileri / Harita / Tek Hat Şeması / Analizler / Karşılaştırma / Yardım / Ayarlar**.

| İşlev | Yeni konum / korunan davranış |
|---|---|
| JSON/ZIP seçimi, çok JSON içeren ZIP'te seçim, DGS sınıfları, capability ve uyarı CSV | Model Yükle; tek aktif canonical network, StudyCase/model SHA kartları, yükleme iptali |
| Model kalitesi | Model Yükle; Baz/Senaryo, önem/kategori/kV/grup/arama, sıralama, sayfalama, bulgu ayrıntısı, tüm CSV/JSON işlemleri |
| Envanter ve işletme | Eski ekranlarında; native ekipman, servis senaryosu, geri al/sıfırla ve bağlantı incelemeleri korunur |
| Yük akışı | Analizler → Yük Akışı Analizi; Tam AC/Hızlı AC/DC, Baz/Senaryo/Δ, ayarlar, iptal, gerilim/hat/trafo/üretici/topoloji/tanı/kapasite sonuçları ve XLSX/CSV |
| DC N-1 | Analizler → Kısıt Analizi → DC; hat/trafo, YTM/TM/kV, eski katalog seçimleri ve filtreler, sonuç durumu, senaryolar/yüklenmeler/ada-kayıp/kritik kısıtlar, ayrıntı ve export |
| Hibrit N-1 | Aynı alt sekmede yöntem seçimi; YTM/TM/kV/uç/kesinti tipi, tam katalog ve seçimler, DC→AC, checkpoint devam, duraklat/durdur, profil/limit/mevsim/bütçe/timeout/politika gelişmiş paneli |
| Hibrit vaka ayrıntısı | Eski vaka özeti, BASE/POST/CHANGE/NEW_CONSTRAINTS, kısıt değişimleri, vaka haritası ve P/Q/S/I/V JSON/CSV/XLSX korunur |
| Referanstan tek vaka DC/AC doğrulama | Karşılaştırma N-1 satırını seç → Analizler'e git; tek vaka paneli açılır. Hesaplar Analizler'de, salt okunur ayrıntı/export Karşılaştırma'da da korunur |
| Kısa devre | Analizler → Kısa Devre Analizi; MAX/MIN, YTM/TM/kV, fiziksel terminal seçimi, bütçe/timeout, native kaynak/audit, açık varsayımlar ve JSON/CSV/XLSX |
| PF karşılaştırma | Karşılaştırma; üç referans yuvası, LF/N-1/SC raw tablolar, metrik/kimlik/kapsam, filtre/sıralama/sayfa, tanısal plotlar, kaynak provenansı, CSV/XLSX/JSON ve harita bağlantısı |
| Eski PF JSON/CSV referansı ve ControlContext | Karşılaştırma → Diğer referanslar / ControlContext; karşılaştırma/ayar farkı/topoloji ve XLSX/CSV korunur. LF referansından ControlContext uygulaması ayrıca açıkça başlatılır |
| Harita, tek hat, görünüm ayarları | Korunur; dışarıdan seçilen benchmark/vaka harita kontrollerine senkronize edilir. Referansı olmayan PF katmanı açık nedenle devre dışıdır |
| Yardım | Tek typed sözlük; arama, bölüm seçimi, ilgili ekran ve alan açıklaması bağlantıları |

`quality-n1` eski iç route'u N-1 alt sekmesine yönlendirilir. `model`, `analysis`, `comparison` kimlikleri korunur; `analysis:LF`, `analysis:N1`, `analysis:SC`, `model:quality` yönlendirmeleri eklenir. Özellik bileşenleri oturum boyunca kalır. Sekme geçişi workerı iptal etmez; seçim/sonuç kimliği saklanır. Aynı paneli her render'da DOM'dan çıkarıp ekleme önlenerek klavye odağı korunur.

DC çekirdek satırı kesinti tipi/YTM/TM/kV/başlat/iptal olmak üzere altı kontroldür; eski iki tip checkbox'ı gelişmiş panelde de korunur. İleri ayarlar başlangıçta kapalıdır. Exportlar sonuç bölümündedir. Tek global canlı durum footer'ı kullanılır; sonuçların yöntem/kimlik tanıları ayrıca görünür kalır.

## Referans paket sözleşmesi

1. Eski `loadBenchmark(file)` yalnız **dokuz dosya** kabul etmeye devam eder: LF/N-1/SC için birer XLSX + JSON + LOG. Eski `loadBenchmarkPair` protokol/API'si uyumluluk için korunur; ikinci model dosyası UI'dan kaldırılmıştır.
2. Yeni `loadBenchmarkReferences(file)` tam dokuz dosya veya **tek analize ait üç dosya** kabul eder. Analiz sidecar, log marker ve workbook manifest ile belirlenir; altı dosyalı kısmi birleşim kabul edilmez.
3. ZIP güvenliği/CRC, benzersiz basename, tablo başlıkları, workbook SHA-256 ve byte sayısı, sidecar/manifest StudyCase/StudyTime/modelHash/scenarioHash/topologyHash/project/PF sürümü, requested/effective method ve doğrulama durumu kontrolleri korunur. Her exporter'ın addonVersion/scope/schema bilgisi kendi workbook'u ile doğrulanır; farklı analiz ailelerine aynı addonVersion dayatılmaz.
4. Yuvalar bağımsız ve model bağımlıdır. Yeni paket tamamen doğrulanmadan hiçbir yuva güncellenmez. Aktif model StudyCase'i ve native kesinti/fault FID üyeliği kontrol edilir; önceki yuvalarla exporter kimlik/hash karışımı reddedilir. Kaynak arşiv SHA'sı analiz bazında saklanır.
5. `availableAnalyses` yoksa eski toplam paket şekli üç analiz olarak yorumlanır. Kısmi paketlerde toplam `groups` şekli uyumluluk için boş konteynerlerle korunur; **varlık için `hasReference` / `availableAnalyses` otoritedir**. Boş konteyner referans/sıfır sonuç değildir. Eksik LF kapısı `LF_REFERENCE_NOT_LOADED`, PF harita kapısı `PF_REFERENCE_SLOT_NOT_LOADED` üretir.
6. Yeni model/clear eski yuvaları, legacy referansı, GA snapshots ve benchmark harita seçimini temizler. İşlem model değişiminden sonra tamamlanırsa eski yükleme sonucu reddedilir. Referans ekleme aktif ağı, kontrol bağlamını veya GA hesaplarını sessizce değiştirmez.
7. ControlContext CSV veya LF paketindeki ControlContext **ayrı, açık bir işlemle** uygulanır; mevcut LF/N-1/SC ve harita sonuçları geçersiz kılınır. Eski JSON/CSV karşılaştırması salt okunur Tam AC baz snapshot'ını kullanır; LF ekranındaki sonuç seçimini değiştirmez.

GA'nın JSON byte hash'i ile exporter'ın yapısal hash'i eşit kabul edilmez. Eşleme/method/rating/partition kapıları gevşetilmedi. Native BLOCKED, approximation, NOT_RECORDED, kayıtlı sayısal sıfır, null Δ ve tanısal Δ ayrımı korunur. Ip/Ib/Ith uygulanmamış sonuçlarda null kalır; varsayımlı SC IEC_PASS değildir.

Tek model yolunda `ElmGenstat` adlandırması, eski benchmark model okuyucusunun aynı paylaşılan sınır adaptörüyle `ElmGenStat` okuyucu görünümüne alınır. Orijinal kaynak tabloları değiştirilmez; çakışan iki alias reddedilir. Böylece eski eşli yüklemede bulunan üreticiler yeni tek model yolunda kaybolmaz.

## Yardım kaynağı ve ID'ler

Kaynak: `src/help/registry.ts`; typed alanlar `id`, `title`, `shortText`, `fullText`, `section`, `relatedScreen`, `relatedField`, `tags`, isteğe bağlı `methodCaveat`. Ekran ⓘ açıklamaları ve Yardım aynı kayıtları okur. Hover/focus preview, Enter/Space ile native details, Escape ile kapatma ve mobil dokunma desteklenir.

- Model: `model.modelHash`, `model.quality`.
- LF: `lf.fullAc`, `lf.convergence`, `lf.qLimits`, `lf.stationControlMode`, `lf.voltageBand`.
- N-1: `n1.dcScreen`, `n1.scope`, `n1.dcPromotion`, `n1.acBudget`, `n1.voltageLimits`, `n1.ratingBasis`, `n1.studyProfile`, `n1.constraintState`.
- SC: `sc.faultMode`, `sc.networkApproximation`, `sc.machineXdss`, `sc.externalGridFactor`, `sc.partition`.
- PF: `compare.referencePackage`, `compare.methodGate`, `compare.diagnosticDelta`, `compare.staleGaResult`, `compare.filters`.
- Diğer: `inventory.filter`, `map.display`, `settings.display`.

Önceki yardımın işletme/senaryo, devreye alma, harita/tek hat, renk/açı/gri değer ve kapsam dışı işlev bilgileri korunur; eski iki ZIP akışı ve SC/istasyon kontrolü hakkındaki güncelliğini yitirmiş ifadeler düzeltilir.

## Doğrulama

Son yerel doğrulama turu:

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, 236 kaynak dosya.
- `npm test`: **337/337 PASS**, 0 fail / skipped. Sekiz yeni hedefli test: combined API uyumu, üç ayrı aile, atomik birleştirme/model değişmezliği, StudyCase/mixed hash reddi, SHA/exporter reddi, eksik LF null gate, native FID reddi ve ortak yardım/caveat sözleşmesi.
- `npm run test:e2e`: PASS. Eski kalite/N-1/Full AC/legacy PF/export/topoloji/harita/SLD yolları yeni ekranlarda; ayrıca worker timeout/iptal/toparlanma, hibrit devam, SC MAX/MIN, diagnostic plotlar, signed canvas pikselleri, stres ZIP/OOXML, yeni menü ve klavye yardım bağlantısı.
- `npm run build` ve `npm run build:portable`: PASS.
- Portable sentetik browser smoke: PASS; localhost dışında network istekleri engellenerek çalıştırıldı.
- Gerçek **SN3 final portable smoke: PASS**, aynı aşağıdaki SHA üzerinde, browser pageerror 0. Bir model yükleme → kalite/JSON → LF referansı ve ayrı açık ControlContext → LF baz → seçili DC → default hibrit BLOCKED → açık station-off seçili AC vaka → native SC → açık approximation → LF/N-1/SC ayrı yuvalar → birleşik referans → snapshot korunması → PF CSV → SN4 negatif → klavye yardım bağlantısı → 1366 ve 390 px görünüm.
- SN3 LF önceki portable UI profili ile tutarlı: 4.077 bara, 95 toplam Newton adımı, 2 son Newton adımı, 79 NR çözümü. Bu UI profili, farklı ayarlarla ölçülen 12 adımlı legacy golden hesabı ile karıştırılmadı. Native SC 10 BLOCKED; açık approximation tek seçili fault hesapladı ve Ip/Ib/Ith null doğrulandı. SN4 karışımı reddedildi; önceki üç yuva korundu.
- `git diff dc1e308 --` Full AC / fast AC / domain N-1 / contingency AC / hybrid / short-circuit solver dizinleri: **boş**. Matematik motorları değiştirilmedi.
- Built/committed HTML raw byte eşitliği: **PASS**, 1.516.857 byte.

Portable: `dist-portable/GridAnalyzer_v7.html`

SHA-256: `038bf395517a351469224d5e4e43079494ef660e54235d7f6bf43f9a8004321e`

Gerçek veriler, split ZIP'ler, FID içeren log/JSON ve screenshotlar ignored yerel dizinlerde kaldı; repoya eklenmedi.

## Kalan sınırlar

1. LF sertifikalı parite için mevcut settings/control/topology kanıtları gerekir; EXPLORATORY_ONLY UI değişikliğiyle onaylı hale gelmez.
2. N-1 eksik PF full post-case matrisi/çözüm statüsü ve SC partition/IEC kanıtları tamamlanmadı; certified Δ null kapıları korunur.
3. Exporter yapısal hash ile GA JSON byte hash arasında yeni bir algoritma eşdeğerliği iddia edilmez; ilk bağlamada native/topoloji kapıları ve sonraki yuvalarda exporter hash tutarlılığı kullanılır.
4. Büyük referans paketleri workerda ayrıştırılır; mevcut XLSX/raw veri bellek maliyeti sürer. Oturum dışı benchmark kalıcılığı eklenmedi.
5. Vite'ın mevcut inlineDynamicImports deprecation/standard bundle boyut uyarıları sürer; build ve raw byte release kapısı başarılıdır.
