# N-1 / SC çalışma alanı bütünleştirme kabulü

Kaynak: `9e8c029ac90a2cd8d8e0e65e0a2dada7a3ffafde`; dal: `feature/n1-sc-workspace-unification`; taban dal: `feature/n1-sc-fast-engineering-analysis`. PR #7 ve main değiştirilmedi/merge edilmedi. Sürüm: `8.2.5`.

## Kapsam ve sonuç

Üretim Analizler ekranındaki ayrı üst Tek YTM kartı kaldırıldı. Ana Yük Akışı, N-1 ve Kısa Devre sekmeleri korunur. Aynı kapsam/profil kontrol bileşeni N-1/SC arasında taşınır; YTM/TM kimlikleri modelden gelir. Eski tek-vaka, DC/hibrit ve bağımsız SC araçları gelişmiş details alanındadır. Eski standalone factory/API, geriye uyumluluk testi için korunur; üretim üstünde ikinci bir ana kart mount edilmez.

Worker/controller/engine isteğine families ve scModes eklendi. N-1-only hiçbir SC adapter/fault çağrısı yapmaz. SC-only N-1 katalog/DC/AC başlatmaz; tüm elektriksel hedefleri hesaplayıp fiziksel aliaslara dağıtır. Birlikte çalışma ikincil bir düğmedir. Yeni solver veya paralel sonuç deposu yoktur: mevcut YTM kaydı ve mevcut ScenarioResults/IndexedDB çalışma alanı kullanılır.

MAX/MIN seçimi Analizler ve Lightning için aynı ScResult nesnesine işaret eder. Model/senaryo/ayar/kapsam/profil denetlenir; karşı mod yalnız aynı moddan kaynak-hash çapası varsa korunur. Eski standalone SC yeni YTM çifti gibi kullanılamaz. Modele/ayarlara göre geçersiz kalan sonuç sıfırla doldurulmaz. Kayıt/yeniden aç, senaryo undo ve cache geri yükleme kapsamı korunur.

Süre bütçesi dolan yeni tur, aynı bağlamdaki önceki geçerli AC vakasını retained_prior ile korur. AC_RETAINED ve AC_CALCULATED_THIS_ATTEMPT ayrılır; eski hesap yeni hesap gibi gösterilmez. Kapsam/ayar değişiminde veya gerçek başarısız/invalid POST kanıtında bu fallback uygulanmaz. Gerekirse eski PRE kaydı retained_base olarak işaretlenir. COMPLETE yalnız iş akışı durumudur; AC/PF/IEC doğrulaması değildir.

## Otomatik UI / Worker kabulü

Kamu sentetik fixture + gerçek üretim Application, Worker, AnalysisWorkspace ve Lightning bileşenleri çalıştırıldı. Tarayıcı harness tam harita karo/render açılış benchmarkı değildir. N-1 ve SC çağrı ayrımı yalnız DOM gizleyerek değil Worker mesajları ve motor aşama izleriyle doğrulandı.

- N-1-only: ADAPT_SC_CONTEXT=0, SC_FAULT=0. Vaka/FID Analizler → Lightning → Analizler aynı kalır; IndexedDB vaka ayrıntısı korunur.
- SC-only: iki adapter MAX/MIN; N1/HYBRID/DC/AC aşamaları=0. Önceki N-1 sayıları kayıtta kalabilir; bu turda yeniden hesaplandığı iddia edilmez.
- MIN → Lightning MAX → Analizler aynı fiziksel fault FID ve kaynak/result kimliğiyle geçer. Karşı modun kaynağı kanıtlanamazsa null bırakılır.
- 640/420/390 px: document yatay taşması yok, en çok 50 birincil tablo DOM satırı; arama/sıralama, CSV/XLSX/JSON, undo, SC iptalinde N-1 korunması, yeniden yükleme testi. Uncaught JS hatası=0.
- Legacy tarayıcı testlerinde yalnız yeni gelişmiş details alanını açan navigasyon eklendi; eski doğrulama iddiaları kaldırılmadı.

## Gerçek model — ayrı ailelerin ölçümü

Model: `C:\projelerim\YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8\kontrol1\20261007_1400_SN3_TR0_dosyaları\20261007_1400_SN3_TR0.zip`; import 7.671 s; YTM `Y6`; Chromium `153.0.8010.12`. Model keşfi tekrarlanmadı; önceki hashli pairs.json kullanıldı. Yerel kaynak model ve PF dosyaları Git dışıdır.

Bu kota sınırlı tarayıcı kabulünde her eylem için **25 saniye kullanıcı bütçesi** seçildi. Varsayılan uygulama bütçesi 178 s, sert üst sınır 180 s korunur. Bu ölçümler önceki 178 s tam bütçe turuyla hızlanma kıyası değildir.

| Aile | İş akışı | Aday / DC | Sayısal AC / bu tur / önceki | DC∪AC | SC fiziksel / elektriksel | MAX / MIN yaklaşık satır | Controller ms / click-to-paint ms |
|---|---|---:|---:|---:|---:|---:|---:|
| N1 | COMPLETE | 660 / 296 | 1 / 1 / 0 | 297 | 0 / 0 | 0 / 0 | 18755.6 / 19045 |
| SC | COMPLETE | 660 / 296 | 1 / 0 / 1 | 297 | 6278 / 500 | 6278 / 6278 | 15508.7 / 15917 |
| N1+SC | COMPLETE | 660 / 296 | 1 / 0 / 1 | 297 | 6278 / 500 | 6278 / 6278 | 25313.1 / 25666 |

AC_VERIFIED bütün gerçek ölçümlerde 0. Orta Anadolu kapsamında 660 adaydan 297 adet DC∪AC sayısal, 363 adet bu tur sayısal sonuçsuzdur; bu sayı fiziksel çözülemezlik hükmü değildir. SC-only satırının önceki AC sütunu saklanan aile sonucunu belirtir. SC-only satırında katalog/N-1/AC önceki aileden saklanmış kayıtlardır; SC turunun aşama izinde N-1 çağrısı yoktur. N-1-only satırında SC sayısı 0 olması beklenir. BUDGET_EXHAUSTED, varsa geçerli DC/SC ve retained AC kayıtlarını silmez; bütün adayların AC çözüldüğü ileri sürülmez.

- N1: model hash `f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6`, scenario hash `[["busOrTerminalStatus",[]],["generatorDispatch",[]],["lineStatus",[]],["loadAdjustments",[]],["restoredTerminals",[]],["switchState",[]],["transformerStatus",[]]]`; aşamalar ms `{"MODEL_PREPARATION": 204.80000001192093, "CATALOG": 678.9000000357628, "DC_SCREEN": 1168.300000011921, "AC_APPROX": 0, "AC_FULL": 13477.600000023842, "SC_SOURCE_PREP": 0, "SC_FACTORIZATION": 0, "SC_BATCH": 0, "REPORT": 3225.9999999403954}`.
- SC: model hash `f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6`, scenario hash `[["busOrTerminalStatus",[]],["generatorDispatch",[]],["lineStatus",[]],["loadAdjustments",[]],["restoredTerminals",[]],["switchState",[]],["transformerStatus",[]]]`; aşamalar ms `{"MODEL_PREPARATION": 203.5, "CATALOG": 0, "DC_SCREEN": 0, "AC_APPROX": 0, "AC_FULL": 0, "SC_SOURCE_PREP": 9801.799999952316, "SC_FACTORIZATION": 96.60000002384186, "SC_BATCH": 1147.7000000476837, "REPORT": 4259.099999964237}`.
- N1+SC: model hash `f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6`, scenario hash `[["busOrTerminalStatus",[]],["generatorDispatch",[]],["lineStatus",[]],["loadAdjustments",[]],["restoredTerminals",[]],["switchState",[]],["transformerStatus",[]]]`; aşamalar ms `{"MODEL_PREPARATION": 161.69999998807907, "CATALOG": 594.6999999880791, "DC_SCREEN": 1186.300000011921, "AC_APPROX": 0, "AC_FULL": 10038.5, "SC_SOURCE_PREP": 8143.199999988079, "SC_FACTORIZATION": 83.30000001192093, "SC_BATCH": 1141.9999999403954, "REPORT": 3963.400000035763}`.

Donanım: Windows NT 10.0.26300, Intel Core Ultra 7 155U, 14 mantıksal CPU, 16.605.564.928 bayt RAM, Node v26.8.1, Chromium 153.0.8010.12; browser heap sınırı 6 GiB; bu tur tepe RSS ölçülmedi. Controller süresi kaynak hazırlama/Worker/taşıma dahil; click-to-paint tarayıcı harness süresidir; Node deneyleri aşağıda ayrıdır.

## N-1 farklı sayısal kapsam — kontrollü önce/sonra

Önce 2 DC-dışı/non-islanding gerçek trafo kesintisi seçildi: ElmTr2:T12764, ElmTr2:T12860; 2 sayısal, verified 0, süre 9.723 s. Sonra aynı model/YTM/donanım/ayar, 6 AC güvenlik tavanı ve 25 s bütçeyle yalnız sıra politikası karşılaştırıldı. Eski tek doğrudan AC örneği ile yeni DC risk/doğrudan AC dönüşümlü sırası karşılaştırılır. Yeni bağımsız hızlı AC veya warm-start eklenmedi.

| Politika / aynı YTM | Aday / DC | AC denenen / sayısal / verified | DC dışı sayısal | DC∪AC / oran | Node süre s |
|---|---:|---:|---:|---:|---:|
| Önce: tek örnek / Y3 | 495 / 227 | 6 / 6 / 0 | 1 | 228 / 46.06% | 22.176 |
| Dönüşümlü / Y3 | 495 / 227 | 6 / 6 / 0 | 3 | 230 / 46.46% | 22.517 |

Farklı kapsam 228→230 (%46.06→%46.46); sayısal olmayan kalan 267→265; aynı 6 AC vaka. İyileşme seçim kapsamındadır; çalışma süresi azalmadı ve performans hızlanması iddia edilmiyor. Nodal residual ve kontrol kapıları gevşetilmedi. Önceki PR #7 Trakya 23 ve Doğu Akdeniz 16 AC sayıları farklı 178 s deneyleridir; bu tablonun yerine kullanılmadı.

ElmScap rating uydurulmadı. Önceki gerçek modeldeki 9 seri kompanzatör UNKNOWN_RATING kaydı kaynak eksikliği olarak kalır. V/P/Q/I var olduğunda gösterilir; kapasite bazlı yüklenme null, TEIAS_VERIFIED değil.

## SC kök neden kapısı — başarısız / açık

Önceki manifestteki iki uygun modelin elektriksel bara başına hata sırası ve SHA kanıtı yeniden kullanıldı; yeni toplu ZIP keşfi veya ülke çapı SC benchmark yapılmadı. Her modelin önceki tam örnekleminden en kötü 5 farklı elektriksel bara dinamik seçildi ve PF ham satırları tekrar okundu. SC R/X, machine/converter ve seyrek matematik çekirdeğinde bu tur kanıtlanan yeni hata yok; spekülatif kalibrasyon yok.

| Model | En kötü FID | kV | GA / PF Ikss kA | Zkk R / X Ω | Durum |
|---|---|---:|---:|---:|---|
| 20261007_1400_SN3_TR0 | B3337 | 154 | 6.0535 / 245.7057 | 2.245823 / 17.200044 | METHOD_UNMATCHED / UNRESOLVED_CAUSE |
| 20261007_1400_SN3_TR0 | B4351 | 154 | 17.1912 / 253.4857 | 0.564240 / 5.732914 | METHOD_UNMATCHED / UNRESOLVED_CAUSE |
| 20261007_1400_SN3_TR0 | B5046 | 154 | 7.1268 / 157.4187 | 2.708491 / 13.605348 | METHOD_UNMATCHED / UNRESOLVED_CAUSE |
| 20261007_1400_SN3_TR0 | B5332 | 154 | 4.5271 / 37.0905 | 3.657313 / 21.568555 | METHOD_UNMATCHED / UNRESOLVED_CAUSE |
| 20261007_1400_SN3_TR0 | B3928 | 154 | 24.7208 / 55.7472 | 0.258530 / 4.088685 | METHOD_UNMATCHED / UNRESOLVED_CAUSE |
| 20261008_1000_SN4_TR0 | B3337 | 154 | 6.0519 / 245.7073 | 2.246848 / 17.222695 | METHOD_UNMATCHED / UNRESOLVED_CAUSE |
| 20261008_1000_SN4_TR0 | B4351 | 154 | 15.9466 / 252.4080 | 0.606421 / 6.174326 | METHOD_UNMATCHED / UNRESOLVED_CAUSE |
| 20261008_1000_SN4_TR0 | B5332 | 154 | 4.5244 / 37.0351 | 3.657270 / 21.550273 | METHOD_UNMATCHED / UNRESOLVED_CAUSE |
| 20261008_1000_SN4_TR0 | B3928 | 154 | 24.7255 / 55.6805 | 0.258925 / 4.092934 | METHOD_UNMATCHED / UNRESOLVED_CAUSE |
| 20261008_1000_SN4_TR0 | B9352 | 10 | 72.7566 / 42.9603 | 0.001180 / 0.087595 | METHOD_UNMATCHED / UNRESOLVED_CAUSE |

### Önceki hashli kaynak/trafo izinin yeniden kullanımı

Aşağıdaki iz sayısal çekirdeği değişmemiş önceki targeted JSON kayıtlarından alınır; yeni PF katkı kanıtı veya bu tur tekrar hesaplanan ablasyon değildir. Tüm sourceInputs (FID/outserv/native R/X, raw/type bazları), fiziksel üyeler ve trafo tipi/kademe kayıtları yerel dosyada kalır. Yakın kaynak örneği katkı dağılımı kanıtı değildir.

| Model / arıza FID | Kaynak snapshot sayısı; yakın aktif kaynak örneği | Yakın trafo / tip / tap / uk% |
|---|---|---|
| 20261007_1400_SN3_TR0 / B3337 | 1974; ElmSym:U13556 @B3345 R/X=0/11.616 ohm, I=None kA, xdss=, rstr=0, ASSUMED; baz 33 kV/18.75 MVA; ElmGenStat:U14619 @B3345 R/X=None/None ohm, I=0 kA, xdss=None, rstr=None, NATIVE; baz 33 kV/33.603970000000004 MVA; ElmXnet:SL1 @B116132 R/X=73.33333333333333/1466.6666666666665 ohm, I=None kA, xdss=None, rstr=None, ASSUMED; baz 400 kV/None MVA; ElmVac:UB4 @B5549 R/X=5.5424/55.7504 ohm, I=None kA, xdss=None, rstr=None, NATIVE; baz 400 kV/None MVA | T5838/TT5838; tap=1.086904761904762; uk=11.799999999999999%; baz=154/31.5 kV; T6303/TT6303; tap=1.0926339285714282; uk=12.33%; baz=154/33.6 kV |
| 20261007_1400_SN3_TR0 / B4351 | 1974; ElmSym:U13659 @B4355 R/X=0/7.682539682539683 ohm, I=None kA, xdss=, rstr=0, ASSUMED; baz 33 kV/28.35 MVA; ElmGenStat:U14716 @B4355 R/X=None/None ohm, I=0 kA, xdss=None, rstr=None, NATIVE; baz 33 kV/19.08154 MVA; ElmXnet:SL1 @B116132 R/X=73.33333333333333/1466.6666666666665 ohm, I=None kA, xdss=None, rstr=None, ASSUMED; baz 400 kV/None MVA; ElmVac:UB16 @B9409 R/X=4355.9995644/4355.9995644 ohm, I=None kA, xdss=None, rstr=None, NATIVE; baz 66 kV/None MVA | T6236/TT6236; tap=1.0738095238095238; uk=12.5%; baz=154/31.5 kV; T6299/TT6299; tap=1.068080357142857; uk=12.73%; baz=154/33.6 kV |
| 20261007_1400_SN3_TR0 / B5046 | 1974; ElmSym:U14316 @B5692 R/X=0/11.006655574043261 ohm, I=None kA, xdss=, rstr=0, ASSUMED; baz 31.5 kV/18.03 MVA; ElmGenStat:U15348 @B5692 R/X=None/None ohm, I=0 kA, xdss=None, rstr=None, NATIVE; baz 31.5 kV/19.186 MVA; ElmXnet:SL1 @B116132 R/X=73.33333333333333/1466.6666666666665 ohm, I=None kA, xdss=None, rstr=None, ASSUMED; baz 400 kV/None MVA; ElmVac:UB9 @B5998 R/X=159999.984/159999.984 ohm, I=None kA, xdss=None, rstr=None, NATIVE; baz 400 kV/None MVA | T2824/TT2824; tap=1.025; uk=12.22%; baz=154/31.5 kV; T5904/TT5904; tap=1.01953125; uk=12.35%; baz=154/33.6 kV |
| 20261007_1400_SN3_TR0 / B5332 | 1974; ElmSym:U13620 @B5331 R/X=0/44.37092264678472 ohm, I=None kA, xdss=, rstr=0, ASSUMED; baz 34.5 kV/5.365 MVA; ElmGenStat:U14674 @B5331 R/X=None/None ohm, I=0 kA, xdss=None, rstr=None, NATIVE; baz 34.5 kV/69.62401 MVA; ElmXnet:SL1 @B116132 R/X=73.33333333333333/1466.6666666666665 ohm, I=None kA, xdss=None, rstr=None, ASSUMED; baz 400 kV/None MVA; ElmVac:UB9 @B5998 R/X=159999.984/159999.984 ohm, I=None kA, xdss=None, rstr=None, NATIVE; baz 400 kV/None MVA | T5685/TT5685; tap=1.025; uk=14.400000000000002%; baz=154/34.5 kV; T6074/TT6074; tap=1.1166294642857142; uk=12.36%; baz=154/33.6 kV |
| 20261007_1400_SN3_TR0 / B3928 | 1974; ElmSym:U13474 @B3931 R/X=0/10.982291090204761 ohm, I=None kA, xdss=, rstr=0, ASSUMED; baz 31.5 kV/18.07 MVA; ElmGenStat:U14538 @B3931 R/X=None/None ohm, I=0 kA, xdss=None, rstr=None, NATIVE; baz 31.5 kV/120.523216 MVA; ElmXnet:SL1 @B116132 R/X=73.33333333333333/1466.6666666666665 ohm, I=None kA, xdss=None, rstr=None, ASSUMED; baz 400 kV/None MVA; ElmVac:UB4 @B5549 R/X=5.5424/55.7504 ohm, I=None kA, xdss=None, rstr=None, NATIVE; baz 400 kV/None MVA | T2493/TT2493; tap=0.9656765676567656; uk=11.98%; baz=380/158 kV; T2494/TT2494; tap=0.9656765676567656; uk=12.07%; baz=380/158 kV |
| 20261008_1000_SN4_TR0 / B3337 | 1953; ElmSym:U13556 @B3345 R/X=0/11.616 ohm, I=None kA, xdss=, rstr=0, ASSUMED; baz 33 kV/18.75 MVA; ElmGenStat:U14619 @B3345 R/X=None/None ohm, I=0 kA, xdss=None, rstr=None, NATIVE; baz 33 kV/33.603970000000004 MVA; ElmXnet:SL1 @B116132 R/X=73.33333333333333/1466.6666666666665 ohm, I=None kA, xdss=None, rstr=None, ASSUMED; baz 400 kV/None MVA; ElmVac:UB4 @B5549 R/X=5.5424/55.7504 ohm, I=None kA, xdss=None, rstr=None, NATIVE; baz 400 kV/None MVA | T5838/TT5838; tap=1.086904761904762; uk=11.799999999999999%; baz=154/31.5 kV; T6303/TT6303; tap=1.0926339285714282; uk=12.33%; baz=154/33.6 kV |
| 20261008_1000_SN4_TR0 / B4351 | 1953; ElmSym:U13660 @B4355 R/X=0/7.682539682539683 ohm, I=None kA, xdss=, rstr=0, ASSUMED; baz 33 kV/28.35 MVA; ElmGenStat:U14719 @B4355 R/X=None/None ohm, I=0 kA, xdss=None, rstr=None, NATIVE; baz 33 kV/19.08154 MVA; ElmXnet:SL1 @B116132 R/X=73.33333333333333/1466.6666666666665 ohm, I=None kA, xdss=None, rstr=None, ASSUMED; baz 400 kV/None MVA; ElmVac:UB16 @B9409 R/X=4355.9995644/4355.9995644 ohm, I=None kA, xdss=None, rstr=None, NATIVE; baz 66 kV/None MVA | T6236/TT6236; tap=1.0738095238095238; uk=12.5%; baz=154/31.5 kV; T6299/TT6299; tap=1.068080357142857; uk=12.73%; baz=154/33.6 kV |
| 20261008_1000_SN4_TR0 / B5332 | 1953; ElmSym:U13620 @B5331 R/X=0/44.37092264678472 ohm, I=None kA, xdss=, rstr=0, ASSUMED; baz 34.5 kV/5.365 MVA; ElmGenStat:U14674 @B5331 R/X=None/None ohm, I=0 kA, xdss=None, rstr=None, NATIVE; baz 34.5 kV/69.62401 MVA; ElmXnet:SL1 @B116132 R/X=73.33333333333333/1466.6666666666665 ohm, I=None kA, xdss=None, rstr=None, ASSUMED; baz 400 kV/None MVA; ElmVac:UB9 @B5998 R/X=159999.984/159999.984 ohm, I=None kA, xdss=None, rstr=None, NATIVE; baz 400 kV/None MVA | T5685/TT5685; tap=1.025; uk=14.400000000000002%; baz=154/34.5 kV; T6074/TT6074; tap=1.1166294642857142; uk=12.36%; baz=154/33.6 kV |
| 20261008_1000_SN4_TR0 / B3928 | 1953; ElmSym:U13473 @B3931 R/X=0/10.982291090204761 ohm, I=None kA, xdss=, rstr=0, ASSUMED; baz 31.5 kV/18.07 MVA; ElmGenStat:U14537 @B3931 R/X=None/None ohm, I=0 kA, xdss=None, rstr=None, NATIVE; baz 31.5 kV/120.523216 MVA; ElmXnet:SL1 @B116132 R/X=73.33333333333333/1466.6666666666665 ohm, I=None kA, xdss=None, rstr=None, ASSUMED; baz 400 kV/None MVA; ElmVac:UB4 @B5549 R/X=5.5424/55.7504 ohm, I=None kA, xdss=None, rstr=None, NATIVE; baz 400 kV/None MVA | T2493/TT2493; tap=0.9656765676567656; uk=11.98%; baz=380/158 kV; T2494/TT2494; tap=0.9656765676567656; uk=12.07%; baz=380/158 kV |
| 20261008_1000_SN4_TR0 / B9352 | 1953; ElmSym:U14102 @B9351 R/X=0/0.19809825673534076 ohm, I=None kA, xdss=, rstr=0, ASSUMED; baz 10 kV/100.96 MVA; ElmGenStat:U14484 @B5623 R/X=None/None ohm, I=0 kA, xdss=None, rstr=None, NATIVE; baz 34.5 kV/4.4879999999999995 MVA; ElmXnet:SL1 @B116132 R/X=73.33333333333333/1466.6666666666665 ohm, I=None kA, xdss=None, rstr=None, ASSUMED; baz 400 kV/None MVA; ElmVac:UB4 @B5549 R/X=5.5424/55.7504 ohm, I=None kA, xdss=None, rstr=None, NATIVE; baz 400 kV/None MVA | T13032/TT13032; tap=1.0375; uk=16.84%; baz=154/10 kV |

- Tarihsel iz: `local-benchmark-results\pr7-followup\targeted-0.json`; SHA256 `cf1ba083d526d93baaea331afe107424f32488c2e062f1fb13aa31263f40690d`.
- Tarihsel iz: `local-benchmark-results\pr7-followup\targeted-1.json`; SHA256 `2a8c72379cb46597cd54697fa804139637d34f2b09013ef84e7245761f8a552c`.

Kaynak sayısı her arıza için aynı bağlı bileşenin snapshot kapsamıdır; bağımsız fault katkı hesabı sayısı değildir. Kayıtlı rstr=0 ve converter Ikss3PF=0 korunur; eksik xdss açık 0.20 pu varsayımıyla ayrılır. Bu iz tek başına 239 kA farkını açıklamaya yetmez.


PF Metric_Dictionary ikssKa=kA (m:Ikss), skssMva=MVA (m:Skss) yazar. Seçilen on ham kayıtta Skss=√3·Un·Ikss sayısal tutarlılık artığı 0 çıktı; 154 kV / 245–253 kA kaydı kendi içinde yaklaşık 65–68 GVA ile tutarlı. Bu cebirsel ilişki bağımsız birim, source-topology veya yöntem doğrulaması değildir; yanlış ölçek/bara ya da doğru fizik sonucuna hükmetmek için yeterli değildir. PF kaydı otomatik yanlış sayılmadı.

Arıza-bazlı kaynak katkısı ve arıza-bazlı kol akımı tabloları iki pakette de 0. c/KT/KG/KKW, source availability/temperature ve tam topology/scenario hash semantiği yok. Önceki tam partition=0; alt küme SN3 4.245 fiziksel/3.383 elektriksel, SN4 4.239/3.378. Strict auditScPartition gevşetilmedi; subset yalnız tanı. Önceki BALANCED MAE/P95/max: SN3 1.012387/3.032136/239.652217 kA; SN4 0.972466/3.118385/239.655377 kA. Bu tur yeni PF paritesi veya MAE iyileşmesi hesaplanmış gibi sunulmaz.

PF yeniden export için gerekli asgari kanıt şeması:

```json
{
  "identity": [
    "studyCase",
    "studyTime",
    "nativeDgsSha256",
    "modelHashAlgorithm",
    "topologyHashAlgorithm",
    "scenarioHash"
  ],
  "fault": [
    "faultId",
    "physicalTerminalFid",
    "electricalBusMembers",
    "nominalKv",
    "3PH",
    "MAX_or_MIN",
    "c",
    "RfOhm",
    "XfOhm",
    "IEC60909-0:2016",
    "effectiveOptionsReadback"
  ],
  "result": [
    "IkssKa",
    "SkssMva",
    "ZkkROhm",
    "ZkkXOhm",
    "availability"
  ],
  "sourceContribution": [
    "faultId",
    "sourceClass",
    "sourceFid",
    "typeFid",
    "outserv",
    "sourceTerminalFid",
    "voltageMvaBases",
    "rstr",
    "xdss",
    "ngnum",
    "R1Ohm",
    "X1Ohm",
    "nativeIkssInputKa",
    "converterPhaseDeg",
    "terminalOrMachineBasis",
    "recordedZeroSemantics",
    "complexContributionKa",
    "parallelMultiplier",
    "KT_KG_KKW_applicability_factor_provenance"
  ],
  "branchContribution": [
    "faultId",
    "branchClass",
    "branchFid",
    "endpointFid",
    "tap",
    "nominalBases",
    "complexCurrentKa"
  ],
  "validation": [
    "explicitUnitsAndPhaseDefinition",
    "readbackVsRequested",
    "completePerFaultSourceCoverage"
  ]
}
```

Sonraki deney: aynı arıza/bölüm ve readback ayarlarında bu paketi üretip önce toplam kompleks katkı ve Zkk bazını karşılaştırmak. Kaynaklar sadece DGS girdileridir; PF sonuçları solver girdisine kopyalanmadı.

## Doğrulama sınıfları / son kontroller

- VERIFIED (yazılım): aile çağrı ayrımı, mevcut sekmelere yerleşim, mode/FID kimlik geçişi, missing/stale/retention kapıları, hedefli regresyonlar. PF/IEC fizik doğrulaması anlamına gelmez.
- APPROX: DC, native partial-control NR, seri pozitif bileşen 3PH Zkk/Ikss/Skss; MAX/MIN mühendislik senaryoları. AC_APPROX mevcut station-off NR fallback olarak açıklanır.
- NOT_IMPLEMENTED / UNRESOLVED: normatif IEC 60909-0:2016 KT/KG/KKW kabulü, bağımsız örnekler, ip/Ib/Ith, negatif/sıfır/toprak/asimetrik arızalar, PF tam üyelik ve N-1 post-matris paritesi, en kötü SC kaynak nedenleri. IEC_VERIFIED ve REFERENCE_VALIDATED açılmadı.

Portable SHA256: `acced50cce95d17bbd96b8c7a0ffe8e3631fdf415ed56e1e26cb77857838aa12`.

- Kaynak değişiklikleri: `9d73f55` (P0 UI/Worker/saklama), `ce93866` (P1 kuyruk), son kabul/portable commit'i (bütçe retention, Lightning aile Devam kapısı, ortak SC stale header kapısı, tarayıcı navigasyonu). Teslim HEAD ve kesin CI koşumu PR kaydında ve son teslim mesajında verilir.
- Son yerel doğrulama: **701/701** unit/regression PASS (eski 695 + 6 yeni); typecheck PASS; mimari lint PASS (445 kaynak); normal build PASS; portable build PASS; committed raw-byte hash/LF/determinism testleri PASS. Sürüm **8.2.5**.
- `npm run test:e2e`: **7/7 zincir PASS**, exit 0. Yeni controller/Worker/bileşen kabulü dahil; legacy assertion silinmedi. Kamu fixture SC 6/6 BLOCKED kalır; sayısal gerçek SC kanıtı değildir. Gerçek testte MAX/MIN her biri 6.278 yaklaşık / 500 elektriksel bara.
- İlk tarayıcı turu: yeni details bölümü açılmadığı için legacy helper selectOption timeout; helper navigasyonu ve native toggle sonrası render beklemesi düzeltildi. Tek helper CLI denemesinde Windows Vite başlangıcı/diagnostic ctx yokluğu görüldü; in-process helper ve son tam zincir PASS. Son aile-resume ve header-scope düzeltmeleri nedeniyle unit/portable kontrolleri tekrarlandı; önceki PASS son kod için körlemesine kullanılmadı.
- Yeni PUBLIC/REAL kabulünde pageerror listesi boş. Legacy standalone YTM testinde Vite HMR istemcisinin kapanış sırasında send uyarısı loglandı; test exit 0, kendi pageerror listesi boş. Bu uyarı fiziksel veya IEC doğrulaması değildir.
- Görseller `local-benchmark-results/workspace-unification/REAL-{390,420,640}.png`; 420 px görseli ayrıca gözle incelendi. Gerçek ana uygulama/Worker/Lightning bileşen harness ölçümüdür; tam map-tile render performansı ölçülmedi.
- Son CI dal kanıtı: [workspace-unification CI](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Afeature%2Fn1-sc-workspace-unification). Yerel PASS ile GitHub durumu ayrı kanıtlardır; teslimde run URL ve HEAD ayrıca verilir.
- PR hedefi draft/stacked `feature/n1-sc-fast-engineering-analysis`; #7 tabanı uzakta `9e8c029ac90a2cd8d8e0e65e0a2dada7a3ffafde`, main `55967fedf0a2f58386c1c2a06c0de031a6dd556e`; merge yapılmadı. Özel modeller/ref dosyaları push edilmedi. Başlangıçtaki üç izlenmeyen kullanıcı alanı korunur.


## Yerel kanıt yolları / SHA256

Özel model/reference ve aşağıdaki kanıt JSON’ları push edilmez. Önceki envanter ve tüm özel kullanıcı dosyaları korunur.

- `local-benchmark-results\workspace-unification\direct-ac-proof.json`: `b281ed90a8e6420dd5b75a2102447348444629607d7d7b60ec5bc30412476a2a`
- `local-benchmark-results\workspace-unification\PUBLIC-390.png`: `054077be4aa2c3bf57ea74b160f81b36d977afa16611c85149bc9fe390062cbd`
- `local-benchmark-results\workspace-unification\PUBLIC-420.png`: `50195b1893352553116e726896c7b73a3ff87069c23de0e7397ba48f64fcc2e5`
- `local-benchmark-results\workspace-unification\PUBLIC-640.png`: `8f333a6423a39338ffb9bd1da7002bffbc7422a2d779fced7268a6ae0a517ca5`
- `local-benchmark-results\workspace-unification\PUBLIC-csv.csv`: `8c67f8258d6246975d1ec00faff4db1576f90bd667917d12f664e4290fc67cf2`
- `local-benchmark-results\workspace-unification\PUBLIC-json.json`: `e99ddeb71a7354764598e8264efa4045e69351b1a8eebb81a77de8c39ca12a07`
- `local-benchmark-results\workspace-unification\PUBLIC-proof.json`: `f1dc7fc7d36aabca8f63e6dd8d8705817b482f2fed58708086b030ade58df4a8`
- `local-benchmark-results\workspace-unification\PUBLIC-xlsx.xlsx`: `1ee070ca99bee38c16e545cda10e10a175057d9148df763b07bcde20b8f1189d`
- `local-benchmark-results\workspace-unification\queue-before-after.json`: `64f6d0aa66474ca64335c267a053d0892b373146ba20c127adc5024b6b1f063c`
- `local-benchmark-results\workspace-unification\REAL-390.png`: `7e156856d5eca4ffc95e48cc6805ee92c0a9fadd201b19a39b90274b5ba2dd82`
- `local-benchmark-results\workspace-unification\REAL-420.png`: `e4f03e22905a2e32bd40e39bf4dc12adea07caf52910932b6576cbde06caa6d0`
- `local-benchmark-results\workspace-unification\REAL-640.png`: `9b3e96fdca6d6fef5711dfb0ef1024708d709c8bd6c9ffb884e81cb131ed3386`
- `local-benchmark-results\workspace-unification\REAL-proof.json`: `3f6a6a1be98592c0b7278c975ca599e506a2ef4e765eecf855165cbaa8f08118`
- `local-benchmark-results\workspace-unification\sc-cause-review.json`: `cc0a90825a1ba282a19d117fe991975304311748625ba4bba99d247cf6a245ee`
- `local-benchmark-results\unification-final-build.log`: `3bb78cd5cb3db926e1ac76b23372c26d8ff8032b9ff4c2a22a742842ab645f6d`
- `local-benchmark-results\unification-final-e2e-retry.log`: `44405d840f4503c86d733d125b9e51691190234879dc28a0e138633e6a70b5f3`
- `local-benchmark-results\unification-final-e2e.log`: `1a9a99dfbb878c6e671a280cab9a73970b99c4e9e3ec34faa6819168a0363bb3`
- `local-benchmark-results\unification-final-lint.log`: `5809591497502dedd22eef71641d20cc21554fe0f1b6aa21222581357f4b0480`
- `local-benchmark-results\unification-final-portable.log`: `9a1b319e054f3267f6538696ba10ea99289a560d5dc0f6c61cd4c7dd07dd5e39`
- `local-benchmark-results\unification-final-typecheck.log`: `4705264512873d100001596d121fc681416c19110314597dc74c7e68e2119a59`
- `local-benchmark-results\unification-final-unit.log`: `89cedbb391b3a71cbc8df286e5388a4a4503a91a0193bc9adfab73afe091d6e0`

Değişen izlenen dosyalar: `dist-portable/GridAnalyzer_v7.html`, `docs/n1-sc-workspace-unification-acceptance.md`, `package.json`, `src/analysis/contingency-hybrid/index.ts`, `src/analysis/short-circuit/index.ts`, `src/analysis/ytm-study/export.ts`, `src/analysis/ytm-study/index.ts`, `src/app/contracts.ts`, `src/app/controller.ts`, `src/domain/benchmark/map-layer.ts`, `src/domain/results/sc-selection.ts`, `src/domain/results/workspace.ts`, `src/features/analysis/analysis-workspace.ts`, `src/features/analysis/study-actions.ts`, `src/features/analysis/study-evidence.ts`, `src/features/analysis/ytm-study-view.ts`, `src/map/layer-policy.ts`, `src/workers/protocol.ts`, `tests/unit/workspace-unification.test.ts`, `tools/analysis-evidence-acceptance.mjs`, `tools/browser-smoke.mjs`, `tools/pf-benchmark-browser-smoke.ts`, `tools/workspace-unification-browser.mjs`, `tools/workspace-unification-physics.ts`.
