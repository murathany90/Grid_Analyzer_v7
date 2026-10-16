# SLD kompakt pilot denemesi — NO MERGE

16.10.2026. Dal: `fix/sld-compact-visual-final`.

Başlangıç `codex/sld-label-topology-fixes` / `a6539676543dde4cfa84f9e48f533197fbc52ecd`
olarak doğrulandı. İzlenen çalışma ağacı temizdi; mevcut üç izlenmeyen kullanıcı
girdisine dokunulmadı. Main karşılaştırması: `e73682426c403baa5092c16406a50768d1d0908e`.
Ekli ZIP raporu ve beş pilotun PNG referansları incelendi. Referans görüntülerinin
farklı model/senaryo değerleri sayısal doğruluk kanıtı olarak kullanılmadı.

## Karar

**NO MERGE. İstenen kompaktlık sağlanamadı. Pilot kapısında çalışma durduruldu.**

Sincan ve Kayseri Kapasitör büyüdü. Akköprü'de üç, Sincan'da bir, Kayseri
Kapasitör'de iki metin çakışması kaldı (ölçüm native SVG ölçeğinde). Kayaş'ta
alan küçüldü; Ortaköy'ün alanı başlangıç feature'ından küçük, main'den %3,1 büyük.
Bu kısmi sonuçlar görsel kabul sağlamaz. 1366×768 ve 1920×1080 fit önizlemeleri
incelendi; özellikle büyük iki pilotta yakınlaştırmadan okunabilirlik başarısız.

| TM | Main W×H | Başlangıç feature W×H | Deneme W×H | Alan / feature | Alan / main |
| --- | ---: | ---: | ---: | ---: | ---: |
| Akköprü | 2606×1635 | 3390×1848 | 2749×1470 | −%35,5 | −%5,1 |
| Sincan | 3522×2336 | 4446×2814 | 9999×3916 | +%213,0 | +%376,0 |
| Kayaş | 1726×2299 | 2526×2778 | 1518×2242 | −%51,5 | −%14,2 |
| Kayseri Kapasitör | 1606×2204 | 3038×2826 | 3718×4024 | +%74,3 | +%322,7 |
| Ortaköy | 1530×1492 | 1946×1848 | 1601×1470 | −%34,5 | +%3,1 |

W/H, SVG dünya birimidir; tabloda yuvarlanmıştır. Tam değerler yerel CSV/JSON'dadır.

## Sınırlı deneme

- SLD hücrelerindeki 640/352 sabit genişlikleri, gerçek cihaz sayısı/kol ihtiyacı
  ve aynı fontla ölçülen iki satırlık metin talebiyle değiştirme denendi.
- Üst/alt etiket ve çıkış alanları, sabit iki isim + P/Q satırı ve 24 birim hedef
  boşlukla birlikte planlandı. LF görünürlüğü pafta/iletken/isim koordinatlarını
  değiştirmedi. Ancak ortak bant ve ekipman paketleme sonrasında bazı fiderlerin
  etiketleri hâlâ uzakta: ölçülen tam etiket bloğu–ok aralıkları Akköprü 25–621,
  Sincan 25–749, Kayaş 25–525, Kayseri 25–237, Ortaköy 25–409 birim. **Başarısız.**
- Trafo altındaki iki caption satırından sonra aynı eksende devam eden bir glyph
  çıkış bölgesi denendi. Sonuç kutusu sağda kaldı. Paketleme bazı trafoları hâlâ
  uzaklaştırdığı için istasyon genelinde düzenli sekonder güzergâhı sağlanamadı.
- Gerçek komşu OG bara uçlarının kısa aralığına yabancı gerilim seviyesindeki
  baraların engel sayılması düzeltildi. Beş pilotta bulunan beş tek cihazlı OG
  bölücüde iki bağlantı kolu 16/16 birim ve simetrik; gerçek cihaz türü/FROM-TO ve
  açık kontak korundu. Çok cihazlı devreler tek cihaza indirgenmedi.
- Reaktif semboller değiştirilmedi. Şönt/seri uçları, mevcut bypass anahtarları
  ve anahtar durumları başlangıçla aynı kaldı.

Yerleşim denemesi, yoğun iki pilotta mevcut `[1, 1.5, 2, 3]` aralık geri
dönüşünün büyümesini önleyemedi. Bu kapı başarısızlığından sonra yeni refaktör
veya ikinci çizim düzeltme turu yapılmadı.

## Kanıt ve kapsam

Üç sürümde aynı `20261007_1400_SN3_TR0.zip` modelinin mevcut SN3/B0 LF önbelleği
kullanıldı; hesap tekrar çalıştırılmadı. Önbellek SHA-256:
`7743ca0a02de4f89b85dc483ff4a070a54ea02f6c64cf554c3e06b0c3608e191`.

Her pilotta graph JSON değişmezliği, switch FID/FROM/TO/state ve equipment
terminal envanterlerinin üç sürümde eşitliği doğrulandı. Mevcut bağımsız SVG
oracle'ında kaynak kontak, açık kontak köprüsü, yabancı net teması ve üst üste
iletken hatası sıfırdı. Bu sınırlı çizim kontrolü sayısal motor paritesi veya
tüm şebeke kabulü değildir. Model, kaynak FID'ler ve LF/DC/N-1/SC motor kodları
değiştirilmedi. Mevcut testler ve eşikler değiştirilmedi.

Kullanıcının pilot kapısı gereği unit/regression, browser smoke, portable build
ve CI kabul doğrulaması aşamasına geçilmedi; tam şebeke taraması yapılmadı.
Portable HTML yeniden üretilmedi; bu dal bir teslim/merge adayı değildir.
GitHub'ın mevcut push CI tetikleyicisi değiştirilmedi; otomatik CI sonucu bu
başarısız görsel denemeyi kabul edilmiş hale getirmez.

## Yerel çıktılar

Gerçek şebeke SVG/PNG'leri ve FID ayrıntıları Git'e eklenmedi.
`local-benchmark-results/sld-compact-final/` altında:

- `GALLERY.html`: beş TM için önce/sonra, 1366/1920 önizleme seçimi ve main SVG'leri.
- `MAIN-*.svg`, `BEFORE-*.svg`, `AFTER-*.svg`: aynı model/senaryoda tam paftalar.
- `*-1366.png`, `*-1920.png`: iki ekran boyutunda fit önizlemeleri.
- `COMPARISON.csv`, `COMPARISON.json`: W×H, alan, ok–etiket ve kuplaj mesafeleri.
- `*-metrics.json`: kontak/oracle/metin bulguları ve LF görünürlük kontrolü.

Üretim: `node tools/sld-compact-pilots.mjs MAIN`, `BEFORE`, `AFTER` (her biri
yalnız beş pilot). Kaydedilmiş SVG'leri native ölçekte ölçüp raporlama:
`node --import tsx tools/sld-compact-report.mjs`. Son komut modeli yeniden çizmez.

Çizim kaynakları yalnız `src/features/sld/` içinde değişti; iki yardımcı araç
ve bu rapor denemenin yeniden incelenmesi içindir. Main'e merge yapılmadı.
