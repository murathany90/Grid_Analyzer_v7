# SLD V3.4 — hedefli kabul, 2026-10-14

Dal: `fix/sld-v3-compact-v0-v4-visual-acceptance`. Başlangıç: `faba62bd5d3b23b026c42c122812ef53fe9b238c`. Kod ve portable doğrulama commit'i: `644e5f7` (bu belge sonraki commit'tedir). **Main merge/push yapılmadı; kullanıcı görsel onayı bekleniyor.**

Tek native bara FID'si tek ray olarak çizilir. Farklı terminaller gerçek rayın uçlarından dolaşır; bara hop'u gizlenerek sahte birleşme oluşturulmaz. Fider ankrajları ayrıdır, aynı gerçek düğüm tek kez çizilir. Kuplaj cihazları kaynak uç/sırasıyla ayrı boşluğa yerleştirilir. Seri kesici/ayırıcı kontakları ve cubicle zincirleri korunur. Gerçek açık/devre dışı/unknown çıkış oku ana devre iletkeniyle aynı renktedir; enerji var/yok çıkarımı yapılmaz.

P/Q/U/I kartları native FID üzerinden uç seçer, LV işaretini HV'den türetmez. Hesaplanmamış değer `—` kalır. Bilinmeyen kapasite, ayrıca doğrulanmış P/Q farkını gizlemez. Toplu açmada kesici önce, kapamada kesici son olaydır; alternatif besleme/bypass belirsiz veya kapalıysa toplu komut engellenir. Tekil cihaz manevrası, geri dönüş, analiz katmanları, YTM/gerilim filtreleri, odak, zoom/tam ekran ve export korunur.

## Gerçek kaynak kabulü

SN3 `20261007_1400_SN3_TR0.json`; model SHA-256 `f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6`. Kaynak bir kez yüklendi. Kullanıcı SVG'lerinin **468 anahtar FID ve native ucu** eşleşti; Temelli'nin kaynak B0'dan farklı 12 konumu karşılaştırma senaryosuna alındı. Kullanıcı SVG'lerinde model hash alanı yoktur; bunun ötesinde dosya kimliği iddia edilmez. Önce/sonra aynı kaynak ve aynı çözülen anahtar senaryosudur. B0 sayısal kartları ayrıca etiketlenmiştir; YTBS rakamları GA sonucu gibi kullanılmadı.

| İstasyon | Kaynak fider / doğrudan model dahil | Anahtar | Tek gerçek bara | Hop / tekrar düğüm / devam / yanlış ray geçişi | İletken / etiket çakışması | V3.3 → V3.4 pafta |
| --- | --- | --- | --- | --- | --- | --- |
| Karapınar M937 | 22 / 27 | 73 | 4 | 0 / 0 / 0 / 0 | 0 / 0 | 1306×1810 → 1538×2030 |
| Kayaş M1482 | 28 / 30 | 128 | 8 | 0 / 0 / 0 / 0 | 0 / 0 | 1322×3238 → 1786×3024 |
| Temelli M890 | 53 / 57 | 267 | 10 | 0 / 0 / 0 / 0 | 0 / 0 | 1354×3898 → 3762×3152 |

V3.3 ölçüleri bağımsız kullanıcı raporundan, yeni ölçüler gerçek SVG'dendir. Native port/kontak kopması, farklı terminalin aynı koordinata çökmesi, ayrı fiderin ortak ankraja yığılması ve FID kaybı sıfırdır. Açık kontak köprülenmesi ve kaynak seri sırası bağımsız incidence oracle ile kontrol edildi. Oracle ekipman bağlı gerçek çatallanmayı seri düğüm saymaz; bozuk kontak negatif testi hâlâ reddedilir. Etiket sınırları gerçek metin, gövde ve iletken sınırlarıyla ölçüldü. FIT tüm fiderleri kapsar; yoğun paftanın bütün metninin tek ekranda tam boy okunabildiği iddia edilmez. Ayrıntı için fider odağı/zoom kullanılır.

Sekiz OTR için ayrı HV/LV terminal, ekipman cubicle, bara yolu, anahtar FID ve kontak kanıtı: Kayaş `T5133/T6415/T5134/T5200`, Temelli `T2540/T6385/T5654/T2541`. CSV 468 cihazı ve kaynak yollarını kapsayan 580 satır içerir. **Bazı banka ayırıcılarının diğer ucu kaynakta ekipman cubicle'siz yaprak terminaldir.** Bunlar “Kaynak ucu” olarak korunur; cubicle ad benzerliği sargıya bağlama kanıtı sayılmaz. Kaynakta olmayan cihaz/sargı veya yeni elektriksel bağlantı oluşturulmadı.

Gerçek Karapınar hat fiderinde bir bağımsız yeni deneme: üç cihazın atomik açılması → STALE → **CONVERGED_FULL_NR** → üç cihazın güvenli sırada kapanması → B0. Model değişmedi. Gerçek post LF yalnız bir kez hesaplandı; görüntü yenilemelerinde aynı kimlikteki doğrulanmış sonuç kullanıldı. Bu görev LF/DC/N-1/SC denklemlerini, IEC normatif tamamlanma veya PF parite kabulünü genişletmez; mevcut control-fidelity sınırları korunur.

## Kontroller ve teslim

- Typecheck, architecture lint, standard/portable build: PASS.
- **566/566** test: mevcut 551 + 15 yeni, skip/silme/eşik gevşetme yok.
- Dört E2E: genel Chromium, PF benchmark, harita/elektriksel panel, SLD: PASS. SLD ayrıca 26 native devre/yön, 630 tür/kapsam/mod ve 20 ok durumu/renk örneğini kontrol eder.
- İlk tam kabulde çıkan cubicle kontak ve trafo koridoru hataları hedefli düzeltildi; ilgili kontroller, ardından tam kabul tekrar geçti.
- Portable raw-byte SHA-256: `5d2f5743fba54740a8970170a8af13d22a3b757e6495fe6eff084c7db3d27ba1`. HEAD blob/çalışma dosyası eşitliği tam testte kontrol edildi. Son feature commit'inin exact CI/build-byte kapısı push sonrasında ayrıca doğrulanır; SHA/run URL yerel `CLOSURE.json` ve görev kapanışında kaydedilir.

Yerel özel kanıtlar: `local-benchmark-results/sld-v34/GALLERY.html`, üç önce/sonra SVG/PNG ve YTBS yan yana, dokuz gerçek UI FIT (1366×768 / 1440×900 / 1920×1080), sekiz 4× OTR, on 4× kuplaj/transfer, B0 HV/LV/PQ kartları, fider işletme görüntüleri, `FID-bus-feeder-switch-contact.csv`, ölçüm/kimlik JSON'ları. Bunlar gerçek model verisi içerir ve Git'e eklenmez. Portable: `dist-portable/GridAnalyzer_v7.html`.
