# SLD V2 gerçek çizim regresyonu — 2026-10-13

Bu düzeltme `fix/sld-v2-ytbs-layout-switching-regressions` dalındadır. Ana dalın başlangıcı `eae8c08b298a505713341dd0d62a93b1d6d0da78`, eski görsel referans `c8ee28b23095e021d1bae7c9438e3a1469f26b1b` olarak doğrulandı. Başlangıç main CI kaydı: [38316940700](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38316940700). Kullanıcı ZIP’i ve araştırma dalları değiştirilmedi.

## Kaynak ve neden

Yerel V4 PDF s.1 metin ve sayfa görüntüsüyle incelendi. V0 XLSX’in altı sayfası, ÇİZİM TABLOSU B2:F16, BARA ÇİZİM (D0-D4) A14:B50 ve FİDER ÇİZİM (D4-D6) A14:B70 okundu; OOXML’deki açık/kapalı kesici ve ayırıcı vektörleri incelendi. V4 güncel slot/yön önceliğidir; Excel’in D0–D6 ve A01/A02/A03/ABK/AT1/AT2/ATB/AB1/AB2/AH1 görev adları kaynak cihaz varlığını ispatlamaz. Kaynaksız CT/VT/ayırıcı eklenmedi.

Regresyonun nedenleri: bütün terminal derinlikleri aşağı yerleştiriliyordu; tek yerel uçlu hat genel aşağı ekipman dalına düşüyordu; renderer hesaplanan rotaları kullanmayıp ikinci bir geometri oluşturuyordu; cubicle self-loop yalnız ilk bulunan cihaza bağlanıyordu; manevralar varsayılan Genel kartında görünmüyordu. Gerçek fare seçimi ayrıca kaynak izleri bulunmayan kayıtta ayrıntı kartı istisnasını ortaya çıkardı; eksik kaynak izi artık `SOURCE_UNAVAILABLE` gösterilir.

## Uygulama

Yeni akış `classifyFeederRole → resolveVoltageZone → assignYtbsSlot → buildSwitchDeviceChain → routeOrthogonalEdges → render` şeklindedir. Bara/terminal/FID kimlikleri korunur. 400, 154/66 ve MV slotları ayrı atanır; ekipman yerleri hat taşmasından önce ayrılır. 14 çıkıştan veya sekiz kaynak MV bara düzeninden fazlası yeni blokta görünür. Gerçek 33,6/34,5/17 kV değerleri değiştirilmez.

400 kV hatlar önce 1A–7A, diğer iki sargılı primer trafolar 6B–7B, native bara bağlantı fiderleri 4B–5B tercihlerini kullanır. 154 kV hatların 4A/5A ve 4B–7B dağılımı V4’te açıkça vardır: bütün dış hatları koşulsuz yukarı çevirmek bu kurala aykırı olurdu. Trafo gelen/primer sargıları kaynak kV ve uçlardan ayrılır. Ototrafo/bank türü mevcut gerçek kaynakta doğrulanmadığı için ototrafo simgesi veya türü üretilmez; tam ototrafo sınıflama kabulü bu görevde sağlanmış sayılmaz.

`WireSegment`, `SwitchSlot`, `EquipmentPort` tek geometriyi taşır. Teller kontak sınırında biter; açık bıçak tel değildir ve ayrı SVG işaretidir. Tek native anahtar tek glyph taşır. Aynı cubicle’daki birden çok cihazda yalnız benzersiz açık kaynak `iorder` bilgisi varsa sıra çizilir; sıra yoksa cihazlar görünür belirsizlik kaydı olarak tutulur, seri bağlantı icat edilmez. Trafo gövdesi gerilim koridoruna yerleşir; filtre dışındaki sargı kaynak kV/FID devam portuyla gösterilir.

## Gerçek kabul

Aynı SN3 kaynak projeksiyonu, B0, tüm gerilimler ve ortak viewBox kullanıldı. Eski referans, başlangıç main ve düzeltme SVG/PNG’leri üretildi. Gerçek kaynaklar tekrar içe aktarılmadı.

| TM | Native anahtar | Üstte beklenen / doğru hat | Önce yanlış yön | Sınıflanamayan fider | Kontak rotası |
|---|---:|---:|---:|---:|---|
| M1583 | 75 | 2 / 2 | %100 | 0 | PASS |
| M1301 | 50 | 3 / 3 | %100 | 3 | PASS |
| M56 | 276 | 5 / 5 | %100 | 19 | PASS |
| M38 | 124 | 7 / 7 | %100 | 11 | PASS |

525 cihaz için native uç/FID/cubicle, eski/yeni koordinat ve V4 slot karşılaştırması yerel `PRIVATE_REGRESSION_DETAILS.md` ve `GOLDEN-native-private-proof.json` içindedir. Gerçek çizimler/model verileri GitHub’a eklenmedi. Klasör: `local-benchmark-results/sld-fix-20261013/`.

Ek Köylüköy örneğinde ayrı 400/154 ve 154/34,5 kV 2W trafoları iki aynı native 154 kV bara bölümüne yapısal anahtar yollarıyla ulaşır. Ortak hayali terminal oluşturulmadı. Bu, açık anahtarları da içeren kaynak bağlantı kanıtıdır; iki baranın enerjili olarak birleştiği iddiası değildir. 3W fiziksel port sözleşmesi korunur, hesap desteği UNSUPPORTED kalır.

LF/DC/N-1/SC denklemleri ve elektriksel topology solver dosyaları eski referansa göre değişmedi. Mevcut 457 test korunur; 17 yeni geometri/slot/filtre testi eklendi. Tam yerel kabul 474/474, fail/cancel/skip 0’dır. npm ci, typecheck, lint, dört browser smoke, standart/portable build ve offline portable smoke başarılıdır.

Uygulama commit’i `1cab73f7d9ff3f2105f34dc841a13409c6f1edeb` için [exact CI 38322226820](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38322226820) SUCCESS; CI portable ham bayt eşitliği adımı da SUCCESS. Portable 1.731.169 bayt, SHA-256 `946d93551081efe018fbf050524c2499db8e483c6b822a64de8fca50737a602a`, LF-only ve Git HEAD dosyasıyla birebir aynıdır. Son belge commit’inin exact CI sonucu yerel FINAL_RECEIPT.json ve görev kapanışında ayrıca doğrulanır. Bu rapor kullanıcı görsel kabulünün yerine geçmez.
