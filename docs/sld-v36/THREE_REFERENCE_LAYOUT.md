# Üç referansa göre tek hat yerleşimi

14 Ekim 2026. Dal: `codex/sld-three-reference-layout`. Başlangıç: `d250213`.

Kullanıcının ikinci talebi önceki 400 kV pilotunu reddederek üç gerçek referans çizime yaklaşılmasını istedi. Bu nedenle Kayaş, Karapınar ve Temelli'nin tüm gerilim bölgeleri düzenlendi; 3S Kale JES gerçek grafıyla regresyon kontrolü yapıldı. Main merge yapılmadı.

## Önceki görüntünün nedeni ve düzeltme

Kuplaj/transfer anahtarlarının yatay olarak rayların arasına yerleştirilmesi, üçüncü kol için 120 birim ray aralığı gerektiriyordu. Referansta anahtarlar ray bandının dışında, düşey hücrelerdedir. Yeni planlayıcı kaynak grafıyla kanıtlanan zinciri **bara altına dikey** yerleştirir. HV normal/transfer rayları **18 birim** aralıkla dar bir demet oluşturur; native ankrajlar ve optik yabancı-ray geçişleri korunur.

Üst ve alt fiderlerin bütün bara geçiş şeritleri birlikte rezerve edilir. Aynı x şeridinin farklı raylara ait başka fider tarafından kullanılması önlenir. Hücre kaydırıldığında o sıranın kalan hücreleri de birlikte ilerler. Ekipman router'ı ayırıcı ve kuplajın önceden planlanmış iletkenlerini de engel olarak dikkate alır.

Gerçek section kesicisi yan yana OG baraları arasındaki boşlukta çizilir. Başka bir fider üzerinden geri dönüş yapılmaz. OG'nin bağımsız source grupları aynı y seviyesinde, ayrı x aralıklarındadır; 33,6/34,5 gibi farklı nominal değerler yalnız aynı **görsel** seviyeyi kullanır, elektriksel olarak birleşmez. Temelli'de TR-C solda, TR-A/TR-B/B-T sağda; transfer barası alttadır.

## OTR ayırıcıları ve kaynak sınırı

A1/A2 ve B3/B4 bank üyeliği ortak gerçek HV/LV terminal çiftlerinden gelir. İki sargı hücresi korunur. Sargıya bağlı olmayan native ayırıcı dalları artık sargı düşey eksenlerinin dışındaki ayrı alanda bulunur ve **Bağımsız uç** olarak açıklanır.

Örneğin Kayaş `C112442`, kaynakta `B89867 → B102871` anahtarıdır. `T5133.bushv = ft00-13064` cubicle'ı ise kaynakta **B89867** terminalindedir; B102871'de değildir. Bu nedenle referans görüntüye bakarak sargıyı ayırıcının sonrasına taşımak gerçek modeli değiştirir. B102871 ve diğer sekiz kaynak yaprağı korunur; ad benzerliğinden fiziksel bağlantı eklenmez. Ayırıcıların gerçek source uçları, açık/kapalı durumları, kontak aralığı ve manevra FID'leri korunur.

## Bağımsız ölçüm

| Merkez | Pafta | Kaynak bay / anahtar / bara / trafo | Bara hop / kontak köprüsü / çift çizim / yabancı uç teması |
|---|---|---|---|
| Karapınar M937 | 1422×1374 | 22 / 73 / 4 / 2 | 0 / 0 / 0 / 0 |
| Kayaş M1482 | 1726×2230 | 28 / 128 / 8 / 6 | 0 / 0 / 0 / 0 |
| Temelli M890 | 2606×2266 | 53 / 267 / 10 / 7 | 0 / 0 / 0 / 0 |
| 3S Kale JES M1555 | 640×1196 | 6 / 21 / 2 / 1 | 0 / 0 / 0 / 0 |

Kayaş yüksekliği 3208→2230 (yaklaşık %30,5 düşüş). Karapınar 2046→1374; Temelli 3408→2266. Temelli genişler: bağımsız OG rayları yatay, komşu hücreler birbirinin şeridini kullanmaz. Pafta genel görünümü ile okunabilir yakın plan ayrı çıktılardır; tek ekran yazı okunabilirliği ayrıca kullanıcı görsel değerlendirmesine tabidir.

Bağımsız orakül üretim renderer/layout modülünü çağırmaz; gerçek source grafı ve SVG M/L subpath'lerini inceler. Her merkezde dört kasıtlı kusur (açık kontak köprüsü, çift segment, silinmiş paylaşılan kaynak iletkeni, uydurma terminal) reddedilir. Toplam **16 negatif mutasyon**. Tüm gerçek FID'ler ve görünür fiderler korunur.

Önceki DOM orakülü paylaşılan iletkenin tek kez çizilmesini ve M ile ayrılan optik geçişleri düz çizgi sanıyordu. `sld-v34-evidence.mjs` M başlangıçlarını ayrı segment olarak okur; source yolunun her aralığının görünür aynı-net birleşiminde gerçekten bulunduğunu **ek olarak doğrular**. Port kontrolü atlanmaz. Eski testler silinmez/skip edilmez; yeni kaynak-geometri testleri eklenir.

LF görünümü ayrıca dört merkezde yeniden üretildi: topoloji, port, glyph, metin ve ray kontrolleri temiz. Önceki Temelli LF etiket yerleşim hatası giderildi. Bu doğrulama **NOT_RUN** etiket görünümüdür; yeni CURRENT LF hesabı veya PowerFactory sayısal paritesi iddiası değildir.

## Çıktılar ve tekrar üretim

Kanıtlar `local-benchmark-results/sld-v37-three-references/` altında, Git dışında tutulur. Kullanıcının önceki portable çıktısı `PORTABLE-BEFORE.html` olarak saklanır.

```powershell
node tools/sld-v37-reference-capture.mjs
node tools/sld-v37-reference-validation.mjs
node tools/sld-v37-reference-gallery.mjs
node tools/sld-v37-reference-capture.mjs --labels
node tools/sld-v37-reference-validation.mjs --labels
```

Üç YTBS/yeni karşılaştırma HTML/PNG'si, dört gerçek AFTER SVG ve UI-FIT ekran görüntüsü, Kayaş 400/154 kV kuplaj-transfer ile A/B OTR 4× yakın planları, source/native/owner iletken CSV'si ve bağımsız ölçüm JSON'u teslim edilir.

Yeni üç unit testi dar ray/dikey kuplaj/açık kontak, farklı nominal OG gruplarının aynı kotta ayrı yerleşimi ve OTR bağımsız uçlarını doğrular. **578/578 unit/regression testi, 4/4 E2E, typecheck, mimari lint, standard/portable build PASS.** Hiçbir test skip edilmedi.

Önceki iki genel SLD hatası da üretim kodunda giderildi: legacy kuplaj hücresi kendi sınırlarında kalır; kaynakta ElmBay'e atanmayan anahtara ayrı gerçek bara ankrajı ayrılır. Legacy native-uç sözleşmesi korunur; `fixedCell` geometrinin tekrar oynatılmasını önler. Strict no-crossing eski görünümde yabancı rayı geçen kol harici koridordan **gerçek son native düğüme** gider; omurgada açık kontağı dolanan upstream birleşim yoktur. Üç referans görünümünde kısa yerel optik geçişler kullanılır. Eski 13 native devre × 2 yön orakülü ve kasıtlı negatif arıza kontrolleri de geçer.

Portable çıktısının ham byte SHA-256 değeri commit blobuyla eşittir, CRLF yoktur: `1b264d98db5a64917bb4a3b738ff45a608a765ed067542dc3734c7aa2b06f6f5`. Doğrulanan kaynak commit'i: `3d004dc8d97290fac04e66665d5d17a90a5edd2a`. [Kaynak commit CI](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38606763920) ve nihai HEAD CI sonucu teslim paketinin `FINAL_VALIDATION.md` dosyasındadır. Kullanıcının diğer yerel dosyaları commit'e alınmaz.
