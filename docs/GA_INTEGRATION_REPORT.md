# Grid Analyzer native PSS/E entegrasyon raporu

## Kullanıcı özel isteği

Kullanıcının özel isteği uygulanmıştır: Grid Analyzer'ın **Şebeke Modeli** düzenini izleyen, **Model Özeti / Şebeke Envanteri / İşletme Verileri / Model Kalitesi** sekmelerine sahip bağımsız bir test uygulaması hazırlanmıştır. `dist-psse/index.html` dosyası çift tıklama ile `file://` üzerinden çalışır. SAV, RAW, RAWX ve ZIP içindeki seçilen kaynak dosya tarayıcıda çözümlenir. Hazır model JSON'u yükleyerek SAV başarısı gösterilmez; bağımsız dosya seçimi `.json` kabul etmez.

Üretim komutu:

```text
node tools/build-psse-web.mjs
```

Çıktı klasik IIFE JavaScript, CSS ve Blob worker kodunu tek HTML'e gömer. `THIRD_PARTY_LICENSES.txt` yerel bağımlılıkların lisanslarını içerir. Çalışma zamanında CDN, modül indirme, Python, PSS/E, caspy, Siemens DLL, backend veya localhost kullanımı yoktur. HTML içerik güvenliği ilkesi `connect-src 'none'` ile bağlantıları engeller. Yüklenen dosyalar herhangi bir servise gönderilmez.

## GA uygulamasındaki durum

- `Application.psseInspection`, PSS/E kaynak incelemesini tutar. PSS/E etkinken `Application.network` **null** kalır. Model, DGS kanonik modeline veya mevcut hesap worker'ına geçirilmez.
- DGS JSON/ZIP dosyaları mevcut yükleme, katalog, senaryo, sonuç ve IndexedDB yollarını kullanmaya devam eder. Arşiv okuyucusunun varsayılanı hâlâ yalnız JSON'dur; yeni uzantılar açık bir seçenekle etkinleştirilir. CRC, boyut, sıkıştırma oranı ve yol güvenliği kontrolleri korunur.
- Mevcut dört sekmeli GA kabuğu ve bağımsız uygulama aynı `src/features/psse/psse-view.ts` bileşenlerini ve aynı `decodePsse()` decoder'ını kullanır.
- Envanterde kaynakta bulunan TM, bara, hat, trafo, jeneratör, yük, şönt, anahtar, node, terminal ve diğer kayıt türleri gösterilir. Arama, kaynak durum kodu ve kesin nominal kV filtresi, sayısal sıralama, 20–100 satır sayfalama, kaynak ayrıntısı ve JSON indirme vardır.
- İşletme sekmesi kaynak Vm/Va, P/Q, kademe ve durum alanlarını gösterir. Hücre kanıtında kaynak alanı, birim, özgün değer ve mevcutsa binary ofset bulunur. Görsel yuvarlama kaynak verisini değiştirmez; ayrıntı ve JSON özgün değeri korur. Bu değerler GA tarafından hesaplanmış sonuçlar olarak sunulmaz.
- Kalite sekmesi decoder bulgularını ve kapsamı gösterir. Eksik kapsam `PARTIAL` olarak görünür. Mevcut yük akışı, kısa devre ve N-1 yöntemleri her PSS/E modelinde **BLOCKED** durumundadır; `READY` üretilmez.
- Model değişimi veya başarısız SAV yüklemesi eski etkin modeli ve sonuçları koruyarak başarı izlenimi yaratmaz. İptal ve gecikmiş worker yanıtları iş kimliğiyle ayrılır.

Başlıca entegrasyon dosyaları: `src/app/contracts.ts`, `controller.ts`, `app-shell.ts`, `features/model/model-view.ts`, `network-model-workspace.ts`, `importers/model-file.ts`, `features/psse/`, `workers/psse-*`, `standalone/psse-web.ts` ve `styles/psse.css`.

## Çalıştırılan kontroller

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| TypeScript tür kontrolü | PASS | `npm run typecheck` |
| Odaklı birim/regresyon testleri | **37/37 PASS**, sıfır SKIP | `evidence/native-raw-web-tests.log` |
| RAW/RAWX önceki normalize kapsam | **11/11 PASS_NORMALIZED_FIELDS** | `evidence/native-raw-rawx-parity.json` |
| Gerçek 6.851 baralı SAV, `file://`, tarayıcı çevrimdışı | PASS | `evidence/native-web/20261014_1200_SN3_TR0.sav.browser-proof.json` |
| Gerçek 6.851 baralı RAW, `file://`, tarayıcı çevrimdışı | PASS | Aynı klasörde `.raw.browser-proof.json` |
| Node-breaker `sample_nb.rawx`, `file://`, tarayıcı çevrimdışı | PASS | Aynı klasörde `sample_nb.rawx.browser-proof.json` |
| Gerçek SAV'ın mevcut GA sayfasına yüklenmesi | PASS | `evidence/native-web/ga-integration-proof.json` |
| Mevcut DGS Şebeke Modeli tarayıcı regresyonu | PASS | `evidence/native-web/dgs-regression-proof.json` |

37 odaklı testin tam dosya kapsamı:

```text
node --import tsx --test tests/unit/psse-raw.test.ts tests/unit/psse-web-integration.test.ts tests/regression/v702.test.ts tests/unit/network-model-workspace.test.ts
```

Dosya bazında: `psse-raw.test.ts` **18** (7 sentetik tokenizer/yapısal/negatif/parite testi + 11 gerçek RAW/RAWX çifti), `psse-web-integration.test.ts` **6**, `v702.test.ts` **7**, `network-model-workspace.test.ts` **6**.

Bağımsız tarayıcı kabul komutu:

```text
node tools/psse-web-browser.mjs <gerçek SAV/RAW/RAWX dosyası> [beklenen bara sayısı]
```

Bu kontrol HTML'i `file://` ile açar ve tarayıcıyı çevrimdışı yapar. Kaynak dosyayı gerçek decoder worker'ına verir, dışa aktarılan modeli doğrular, dört sekmenin ekran görüntüsünü alır, aynı kaynak baytlarını içeren ZIP'i tekrar açar ve bozuk SAV'ın reddedildiğini denetler. Gerçek SAV/RAW ve node-breaker RAWX koşularında **HTTP(S) isteği: 0; tarayıcı hatası: 0**. JSON kanıtı test edilen HTML'in SHA-256 kimliğini de içerir.

Hedef SAV'da gözlenen kayıtlar: **6.851 bara, 2.403 hat, 3.703 trafo, 2.920 jeneratör, 2.520 yük, 139 şönt, 2.563 anahtar, 1.618 TM**. Bunlar kaynak envanter sayılarıdır; hesap başarısı değildir.

GA entegrasyon kontrolü:

```text
node tools/psse-ga-browser.mjs <gerçek SAV dosyası>
node tools/network-model-browser.mjs
```

GA testi geliştirme araçlarıyla geçici bir test sunucusu kullanır; bu sunucu bağımsız HTML'in çalışma gereksinimi değildir. Test, `ctx.network === null` sınırını, doğrudan LF/kalite/N-1 çağrılarının sonuç üretememesini, **Analiz Et** düğmesinin pasifliğini, SAV→DGS→SAV geçişlerini ve bozuk SAV sonrası temiz durumu doğrular. DGS regresyonu normal JSON/ZIP yükleme, gecikmiş katalog yanıtlarının elenmesi, dört sekme, sıralama, dışa aktarım, senaryo/sonuç ayrımı, yerel geri yükleme ve masaüstü/zoom geometrisini doğrular.

## Sınırlar ve teslim ayrımı

- Bu aşama kaynak envanteri, kayıtlı işletme noktası ve model kalitesi incelemesidir. PSS/E kaynakları GA harita/tek hat/senaryo düzenleyicisine veya mevcut çözücülere uyarlanmış değildir.
- Desteklenmeyen DC/FACTS ve diğer elektriksel modeller korunur ve kapsam bulgusu üretir. Bu kategorilerde RAW çok satırlı kaynak kayıt sayısı ile RAWX tablo satır sayısı aynı fiziksel cihaz sayısı anlamına gelmez; tam elektriksel parite iddiası yapılmaz.
- Eski normalize RAW/RAWX kapsamı 11/11 korunmuştur. Ek karşılaştırılan winding kompanzasyon alanlarında kaynak dosyaların kendisinden gelen 12 CX3 farkı ayrıca raporlanır; değerler eşitlenmez. Kapsam: `evidence/NATIVE_RAW_PARITY_SCOPE.md`.
- SAV payload düzen kimliği, PSS/E yazılım sürümü ve RAW revizyon numarası ayrı kavramlardır. Desteklenen binary kapsam ve hata koşulları `SAV_BINARY_RE_SPEC.md` içinde açıklanır.
- Python/PSS/E yüklü olmayan ikinci bir fiziksel bilgisayarda ayrıca çalıştırma yapılmamıştır. Kanıt, mevcut Windows bilgisayarında çevrimdışı tarayıcı ve `file://` ile bağımsız çalışmayı doğrular; HTML'in çalışma akışında yerel kurulumlara çağrı yoktur.
- Gerçek model adlarını, ekipmanlarını ve kayıtlarını içeren ekran görüntüleri yalnız yok sayılan `local-benchmark-results/psse-native-web/` ve `local-benchmark-results/psse-ga-integration/` dizinlerinde tutulur. Kullanıcıya verilecek yerel ZIP'e eklenebilir. Git'e ayrılan kanıtlar yalnız sayım/kimlik özeti, hash, durum ve hata sayılarıdır; gerçek model baytları, kaynak kayıtları ve özel ekran görüntüleri yayımlanmaz.

Siemens kodu, DLL/PYD dosyası veya lisanslı örnek model bu uygulamanın dağıtım dosyalarına eklenmemiştir.
