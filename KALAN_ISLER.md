# Kalan işler — PSS/E SLD V4

Durum: **KISMİ TESLİM; TAMAMLANMADI**. 2026-11-01, Europe/Istanbul.
Dal: `feature/psse-map-ui-data-fixes-v2`. Başlangıç yerel/uzak SHA: `b7acd72858a14f72b85702aa93882b88c9b51f1c` (fetch ve ff-only pull ile doğrulandı). Yerel çalışma ağacı başlangıçta temizdi. Commit/push son SHA Git geçmişinden ve teslim HTML `ga-build-sha` alanından okunabilir.

## P0 — Native görsel kabul (BLOCKED)

`PSSE_GUI_VERIFICATION=BLOCKED` tam kabul anlamındadır; PSS/E kurulumu yok anlamına gelmez. Lisanslı PSS/E 36.5 / Python 3.14 çalıştırıldı. Gerçek Ankara referansı ve üretilen Adatoprakpınar native dosyası açıldı. Son V4 Adatoprakpınar dosyası PSS/E tarafından kaydedildi; `native-v4-4166-gui.json` API kaydında 4 bara, 2 trafo, 2 SYS, 12 Link, 18 Label, 1 üretim ve 1 yük bulunuyor. Font yükseklikleri 78/80/90 (native onda-bir punto), trafo portları ±0.2 olarak okundu.

Açılış kamerası/zoom ve tüm etiket/sembollerin okunabilirliği kabul edilmedi. PSS/E bazı Link genişlik/stillerini kendi görünüm/kaynak ayarlarına çekebiliyor. Dosyanın parse edilebilmesi bu farkları çözmez. Tam aç–kaydet–yeniden aç görsel/semantik karşılaştırması, karmaşık Temelli pilotu, 3W ve switched-shunt display-list indeksi henüz doğrulanmadı. Bazı deneysel Slider getter/visibility çağrılarında PSS/E süreci kapandı; özgün dump çağrılarıyla son küçük pilot kaydı alınabildi. Native GUI testini tam geçti olarak işaretlemeyin.

Sonraki adım: küçük pilotta PSS/E'nin kendi kamera, display-list ve annotation ayarlarını birer değişkenle karşılaştırın; PSS/E kaydı ile export kaydında kimlik bazında port/etiket/stil farkını çıkarın. Ardından aynı işlemi Temelli'de ve gerçek 3W örneğinde tekrarlayın. Bilinmeyen alanı tahmin ederek doldurmayın. SVG scale enjeksiyonu eklenmedi.

Bağımsız kanıt: `psse-studio/tests/fixtures/native-sld-fields.json` bu oturumdaki SetLineStyle/SetLineWidth/SetFontHeight/SetFontName ve SetDisplayListIndex deneylerinin nötr kayıt alanlarını içerir. PSS/E executable 36.5 olmasına rağmen `sliderPy.GetAppVersion()` 35.2.0 döndürdü; ham gözlem fixture'da korunuyor. Kaynak özel SLD/SAV dosyaları Git'e eklenmedi.

## P0 — Yerleşim kabulü (OPEN / başarısız)

Yedi pilotta kaynak MAP/devre paritesi, ayrı OG bara segmentleri, benzersiz trafo X'i, pasif Kayaş 414542 ve 1e-4 konum toleransı geçti. Cihaz–cihaz çakışması 0. **Tüm görsel kabul kriterleri geçmedi.** Aşağıdaki sayılar son gerçek RAW pilot koşusundandır:

| Pilot | Hat–cihaz dahil hard collision | Hat–etiket | Etiket–etiket | 3+ knee rotası (açıklaması açık) | Native kesikli istenen/parse |
|---|---:|---:|---:|---:|---:|
| 4166 ATOPRAKPINAR TM | 0 | 0 | 0 | 7 | 0/0 |
| 4145 KAYAS TM | 3 | 11 | 0 | 13 | 3/3 |
| 4104 TEMELLI TM | 2 | 12 | 0 | 12 | 4/4 |
| 4106 AKKOPRU TM | 0 | 1 | 0 | 9 | 1/1 |
| 4294 BOROSB TM | 0 | 0 | 0 | 6 | 0/0 |
| 4108 BALGAT TM | 0 | 2 | 0 | 8 | 0/0 |
| 4103 SINCAN TM | 2 | 14 | 0 | 21 | 2/2 |

`PSSE_SLD_STRICT_VISUAL=1 npm --prefix psse-studio run test:sld:pilots` exit 1 verir: `visualAcceptance=OPEN`. Bu başarısızlık gizlenmedi. Hat–cihaz/etiket çakışmalarını sıfırlayın, 3+ knee rotalarının her birini inceleyip zorunluluğunu kanıtlayın veya kısaltın. PSS/E fiziksel node-breaker bilgisi olmayan yerlerde baraları elektriksel olarak birleştirmeyin. HV bara rolü/transfer kanıtı yoksa isim vermeyin.

OWNER görünümünün mevcut temsilî bara indirgemesi TM görünümüyle aynı elektriksel sadakat garantisine sahip değil; bu oturumda OWNER için kapsamlı yeniden tasarım yapılmadı. LSZ ve tüm switched-shunt varyantları ayrıca gözden geçirilmeli. Akış oklarının fiziksel yönü/P yön işareti ayrı kabul kontrolü gerektiriyor; bu değişiklik canlı geometri senkronunu doğruluyor.

## P0/P1 — Sonuçlar ve pasifler

Gerçek büyük model sonuçları bu koşuda: NR_POLAR `BLOCKED/BLOCKED`, FDNS_XB `NON_CONVERGED/PARTIAL`, LOSSLESS_DC `CONVERGED/PARTIAL`. Büyük AC için sayısal başarı iddiası yok. İki baralı açık sentetik analitik fixture üzerinde gerçek worker AC/DC hesabı, DC'de MW/açı sınırı, stale/BUSY kapısı ve native Label provenansı test edildi. Bu test büyük modelin çözümünü kanıtlamaz.

Native GA etiketlerinin PSS/E tarafından yeniden açıldıktan sonra kullanıcı etiketinden ayrı kimliğiyle korunması ve pasif temizleme kopyasının PSS/E GUI'de referans bütünlüğü henüz bağımsız doğrulanmadı. Codec düzeyinde ithal arşive Label ekleme/silme, font/provenans ve Link/Port referansları test edildi. UNKNOWN ve açık SYS temizlemede korunuyor; kaynak modeli ve senaryo değiştirilmedi.

## Test ve kanıt matrisi

- Dar codec: 8/8 geçti; TypeScript ve üretilen browser codec; dört gerçek yerel native örnek read-only; nötr PSS/E alan fixture'ı; font/stil/port/kimlik/raw alan koruması.
- Layout unit: 14/14 geçti (`node --test tools/psse-sld/studio_layout.test.cjs`).
- Chrome pointer/UI: canlı drag ve knee sırasında ok/tutamaç eşleşmesi, pointercancel capture bırakma, undo/redo/fit, tekrar export/import ve menü/modal kontrolleri geçti. İlk hata mevcut HTML üzerinde önce yeniden üretildi.
- Yedi gerçek RAW pilot: topoloji/parite kontrolleri geçti, strict görsel kabul **başarısız**.
- Sonuçlar: açık analitik fixture üzerinden gerçek AC/DC worker testi geçti.
- Tam paket test koşusu: 53 geçti, 8 atlandı, 0 başarısız (61 test). Atlananlar mevcut özel workbook/native oracle bağımlılıkları; geçmedi olarak sayılmadı.
- Standart build/entegrasyon: kökten `./build-psse.ps1`, 17/17 geçti. Yeni sonuç testi integration script'ine eklendi. Commit sonrasında aynı teslim build'i yeniden üretilir; `evidence/sld-v4/final-build-integration.log` kullanılır.
- Lint: pakette lint script'i yok; build, JS sözdizimi ve ilgili testler kullanıldı.

Yerel gerçek log/çıktılar (Git dışında): `psse-studio/evidence/sld-v4/{build-integration.log,targeted-tests.log,full-tests.log,strict-visual.log,pilots.json}`. Pilot ekranları: `4166.png`, `4145.png`, `4104.png`, `4106.png`, `4294.png`, `4108.png`, `4103.png`. Native ekran: `native-v4-4166-opening.png`. Native API dump ve PSS/E kaydı: `native-v4-4166-gui.json`, `native-v4-4166-saved.sld`. Önceki aşama native görüntüsü `4166-psse.png` başarı kanıtı değildir; küçük/eksik görünümü belgeliyor.

BOROSB `image(20261031-163451).png` ve `image(20261031-163518).png` bulunamadı: **BLOCKED**. Diğer dört YTBS PNG'si, control1 RAW/SAV/SLD örnekleri, V2/V3 HTML/ZIP ve yerel PSS/E PDF'leri bulundu. ZIP içindeki raporlar başarı kanıtı olarak kullanılmadı.

Tek kullanıcı teslimi: `C:\projelerim\PSS-e_Eklentisi\dist\Grid_Analyzer_PSSE_Portable.html`. Paket içindeki HTML ile SHA-256 eşitliği kök build girişinde denetlenir. HTML ara derleyici çıktısı yerine kökteki teslim kopyası açılmalıdır.

Kota: başlangıç %0, ara kontroller %6/%13/%24/%46/%64/%76/%85 kullanım. Son %10 eşiğine yaklaşırken yeni kapsam açılmadı; kalan P0/P1 yukarıda açık tutuldu. Bu dosya tamamlanma raporu değildir.

P1 UI okunabilirlik açık: yedi pilotta ölçülen görünür metin alt sınırı 4.60 px. Min. 8 px kabulü sağlanmadı; hangi metin sınıfının LOD ölçeğinin dışında kaldığı incelenmeli. Native GUI için başarı iddiası değildir.
