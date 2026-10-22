# PR #7 hedefli fiziksel doğrulama ve düzeltme — 22 Ekim 2026

## Bir sayfalık özet

Dal: `feature/n1-sc-fast-engineering-analysis`. Başlangıç HEAD: `a47d6c4d819b47b497a6c7f99a9a343166adcd3a`. PR: https://github.com/murathany90/Grid_Analyzer_v7/pull/7 (açık; main merge edilmedi).

Bu tur mevcut motoru korur. Kanıtlanan adapter hatası düzeltildi: yalnız eksik R varsayımını kapatmak doğal R değeri mevcut makinelerin eksik X varsayımını da kapatıyordu. R ve X artık bağımsız değerlendirilir; doğal sıfır R korunur, geçersiz verilen değerler varsayımla değiştirilmez. Varsayılan BALANCED sayıları bu düzeltmeyle değişmedi; PF MAE iyileşmesi iddia edilmiyor.

Dengeli N-1 sabit üç vaka yerine gerçek ortak süre bütçesinde, önceki vaka maliyetinden hesaplanan rezervle çalışır. DC riski, kullanıcı seçimi ve DC dışı topolojik olarak çözülebilir örnek önceliklidir. AC artık/boş sonuç/kontrol kapıları korunur. Ada topolojisi, DC kapsamı dışında kalma ve bütçede denenmeme fiziksel BLOCKED durumundan ayrılır. Sonuç kalitesi denenmeyen vakada null kalır; mevcut DC/SC kaybolmaz.

SC pozitif bileşen/KLU matematiğinde bu örneklemle kanıtlanan yeni baz/topoloji hatası bulunmadı. En büyük beş farklı elektriksel bara her model için dinamik seçildi. Doğal kaynaklar, makine tipleri, trafolar, Zkk ve ayrı varsayım ablasyonları kaydedildi. En büyük PF farklarının nedensel açıklaması henüz kanıtlanamadı: UNRESOLVED_CAUSE. PF arıza bazlı kaynak katkı tabloları boş; model/scenario/topoloji hash eşdeğerliği ve tam c/KT/KG/KKW ayarları doğrulanmadı. Parametre kalibrasyonu yapılmadı.

FID/kV ve örtüşen üyelik için FID_KV_PARTITION_SUBSET_DIAGNOSTIC eklendi. Tam üyelik ve bağımsız yöntem kapıları değişmedi; REFERENCE_VALIDATED ve AC verified sayıları sıfırdır. İstatistikler elektriksel bara başına tek ağırlık kullanır. IEC 60909-0:2016 sabittir; lisanslı normatif kabul/bağımsız örnek yokken IEC_VERIFIED açılamaz. AC_APPROX, UI ve belgede açıkça istasyon kontrolü kapalı mevcut NR geri dönüşüdür; yeni hızlı AC yöntemi değildir.

## Keşif ve kimlik kanıtı

Kök, kontrol1/control1, .local-fixtures ve erişilebilir repo model/ref dizinleri tek dosya envanterinde tarandı; node_modules, Git, derleme ve önceki özel sonuç/cache dizinleri hariç tutuldu. 55 dosya: 5 model adayı (iki gerçek modelin kopyaları + bir kamu fixture), 7 PF ZIP, 1 diğer ZIP, 33 diğer JSON, 6 XLSX, 3 CSV. Arşiv kopyaları aynı SC çalışma kitabı SHA ile birleştirildi: iki bağımsız gerçek model/referans çifti. Ayrı LF/N1/SC UI paketleri de keşfedildi; yeni bağımsız model oluşturmadılar. SN2 için bu keşif kapsamına giren referans eşleşmiş yeni çift yoktur. Eski SN2 sayıları yeniden ölçülmüş gibi sunulmaz.

`GridAnalyzer_PR7_Kod_N1_SC_Dogrulama_Raporu_20261022.md` proje kökünde bulunamadı. Önceki kabul raporu okundu; eski CI 688/688 ve portable hash yeniden araştırılmadı. Kullanıcının üç izlenmeyen docs alanı korundu.

DGS IntCase.loc_name ile PF studyCase eşleşir. PF çalışma zamanları aşağıdadır; DGS IntCase ayrı zaman alanı sağlamaz. Study-case kimliğiyle zaman uyumu tanısaldır. GA dosya hashleri ile PF yapısal hashler aynı algoritma kabul edilmez. Her PF karşılaştırması kendi modelindedir; SN3–SN4 farkı doğrudan yöntem hatası sayılmaz. PF manifestleri 3PH/MAX, Rf=Xf=0 ve iopt_cur=0 readback doğrular; c, sıcaklık, kaynak devre politikaları ve düzeltmelerin tam eşdeğerliği kayıtlı değildir. IEC baskı bilgisi kullanıcı beyanıdır. MIN PF referansı yoktur.

- `20261007_1400_SN3_TR0` · PF zamanı `2026-10-07 14:00:00`; DGS `C:\projelerim\YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8\kontrol1\20261007_1400_SN3_TR0_dosyaları\20261007_1400_SN3_TR0.zip` SHA256 `854b098802a0a6c4a45c03b9702fd9b891225dc96c876781a283c488ccc607a7`; ham DGS model hash `f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6`.
  PF `C:\projelerim\YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8\kontrol1\20261007_1400_SN3_TR0_dosyaları\Birleşik_LF_N-1_SC_referans_ZIP.zip` SHA256 `90b8a58518dcfd14f7fbeb94f32918e158886011e822546bddd5c2a4642037bd`; SC workbook SHA256 `70e169eb0f42045b3ab050675bec091199a264a33d9133f88107a4a20b8bb2a0`. PF model/topoloji hash `sha256:3bdd1cb3ef05ca1cca4883675d935bdcc96672d45a679d94bc78c224b13ce50d` / `sha256:e6dacc56bdefe41d111347bccde8d693e66ee5dab317353824582afc961bc564`.
- `20261008_1000_SN4_TR0` · PF zamanı `2026-10-08 10:00:00`; DGS `C:\projelerim\YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8\kontrol1\20261008_1000_SN4_TR0_dosyaları\20261008_1000_SN4_TR0.zip` SHA256 `3f07133052e256e75b0ddcdb00cc1500b03ee01fb9252b00fab17297de88728c`; ham DGS model hash `c738a80b957a540d98e940b0cc910acf195c79495a3f33d252c17dc0461b119f`.
  PF `C:\projelerim\YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8\kontrol1\20261008_1000_SN4_TR0_dosyaları\Birleşik_LF_N-1_SC_referans_ZIP.zip` SHA256 `c5d79f81e9f86c68a78b9352b44c95014f0443dd86fd957bafc7d66859e63a94`; SC workbook SHA256 `d9bd6a635d25c458042606d1c7c91f99c22a8b6450af9d63ecd271566f6962cd`. PF model/topoloji hash `sha256:8a15c098137d2882207ff44fdd14b06f5eb8361f4b2b6f4978016084245798f2` / `sha256:5cb95d0943697ea28097e9f904a90591b3f00e6f37b2c89f95c650d4a790307c`.

## Kanıt 1 — en kötü beş bağımsız SC barası / model

GA/PF Ikss kA; Zkk ve kaynak eşdeğerleri ohm. ΔX, eksik xdss varsayımının kaldırılmasının; Δfaz, yalnız IBR fazının −90° yerine 0° yapılmasının Ikss etkisidir. Bunlar doğruluk kalibrasyonu değildir. Yakın kaynak bağlantısı gerçek FID üzerinden izlenmiştir; hop yakınlığı arıza katkısı kanıtı değildir. Tam kaynak/typ/base/trafo/kademe kayıtları özel JSON kanıtındadır.

| Model | FID / elektriksel grup / kV | GA / PF / fark kA | Zkk R / X Ω | Yakın makine / R-X / trafo tipleri | ΔX / Δfaz kA | Neden |
|---|---|---:|---:|---|---:|---|
| 20261007_1400_SN3_TR0 | B3337 / B26650 / 154 | 6.0535 / 245.7057 / -239.6522 | 2.245823 / 17.200044 | U13556 · rstr=0, xdss=eksik · 33²/18.75/1 baz; TT5838, TT6303 | -0.5044 / -0.3701 | UNRESOLVED_CAUSE |
| 20261007_1400_SN3_TR0 | B4351 / B4351 / 154 | 17.1912 / 253.4857 / -236.2945 | 0.564240 / 5.732914 | U13659 · rstr=0, xdss=eksik · 33²/28.35/1 baz; TT6236, TT6299 | -0.8837 / -0.2080 | UNRESOLVED_CAUSE |
| 20261007_1400_SN3_TR0 | B5046 / B18070 / 154 | 7.1268 / 157.4187 / -150.2919 | 2.708491 / 13.605348 | U14316 · rstr=0, xdss=eksik · 31.5²/18.03/1 baz; TT2824, TT5904 | -0.5456 / -0.0762 | UNRESOLVED_CAUSE |
| 20261007_1400_SN3_TR0 | B5332 / B30549 / 154 | 4.5271 / 37.0905 / -32.5634 | 3.657313 / 21.568555 | U13620 · rstr=0, xdss=eksik · 34.5²/5.365/1 baz; TT5685, TT6074 | -0.2001 / -0.0557 | UNRESOLVED_CAUSE |
| 20261007_1400_SN3_TR0 | B3928 / B3926 / 154 | 24.7208 / 55.7472 / -31.0264 | 0.258530 / 4.088685 | U13474 · rstr=0, xdss=eksik · 31.5²/18.07/1 baz; TT2493, TT2494, TT19514, TT4975 | -2.4773 / -0.8051 | UNRESOLVED_CAUSE |
| 20261008_1000_SN4_TR0 | B3337 / B26650 / 154 | 6.0519 / 245.7073 / -239.6554 | 2.246848 / 17.222695 | U13556 · rstr=0, xdss=eksik · 33²/18.75/1 baz; TT5838, TT6303 | -0.5082 / -0.3751 | UNRESOLVED_CAUSE |
| 20261008_1000_SN4_TR0 | B4351 / B4351 / 154 | 15.9466 / 252.4080 / -236.4613 | 0.606421 / 6.174326 | U13660 · rstr=0, xdss=eksik · 33²/28.35/1 baz; TT6236, TT6299 | -0.7485 / -0.1779 | UNRESOLVED_CAUSE |
| 20261008_1000_SN4_TR0 | B5332 / B30549 / 154 | 4.5244 / 37.0351 / -32.5107 | 3.657270 / 21.550273 | U13620 · rstr=0, xdss=eksik · 34.5²/5.365/1 baz; TT5685, TT6074 | -0.2041 / -0.0496 | UNRESOLVED_CAUSE |
| 20261008_1000_SN4_TR0 | B3928 / B3926 / 154 | 24.7255 / 55.6805 / -30.9550 | 0.258925 / 4.092934 | U13473 · rstr=0, xdss=eksik · 31.5²/18.07/1 baz; TT2493, TT2494, TT19514, TT4975 | -2.5216 / -0.8313 | UNRESOLVED_CAUSE |
| 20261008_1000_SN4_TR0 | B9352 / B9351 / 10 | 72.7566 / 42.9603 / 29.7963 | 0.001180 / 0.087595 | U14102 · rstr=0, xdss=eksik · 10²/100.96/1 baz; TT13032 | -32.0738 / -0.2588 | UNRESOLVED_CAUSE |

Her modelin fiziksel aliasları bu beşli içinde tekrarlanmadı. Mutlak ve bağıl sıralamalar ayrı özel JSON alanlarında saklandı. Arıza başına PF kaynak/branch contribution tabloları 0 kayıt olduğundan, belirli bir PF hatasını tek makineye atfetmek mümkün olmadı. B3337/B4351 gibi büyük farklar incelemeden çıkarılmadı; düşük bir genel MAE bu uçları doğrulamaz.

Ablasyonlar (aynı model ve uyumlu FID/kV/üyelik alt kümesi; MAE / P95 / max kA):

- **20261007_1400_SN3_TR0**:
  `OMIT_MISSING_XDSS`: 0.561969 / 1.360216 / 240.156629 (n=3383).
  `OMIT_MISSING_R`: 0.561969 / 1.360216 / 240.156629 (n=3383).
  `IBR_PHASE_0`: 0.976298 / 2.888475 / 240.022304 (n=3383).
  `ZERO_RECORDED_PHASE_IRRELEVANCE`: 1.012387 / 3.032136 / 239.652217 (n=3383).
  `OMIT_MISSING_R_FIXED`: 1.012387 / 3.032136 / 239.652217 (n=3383).
- **20261008_1000_SN4_TR0**:
  `OMIT_MISSING_XDSS`: 0.511456 / 1.335815 / 240.163611 (n=3378).
  `OMIT_MISSING_R`: 0.511456 / 1.335815 / 240.163611 (n=3378).
  `IBR_PHASE_0`: 0.936469 / 2.991093 / 240.030431 (n=3378).
  `ZERO_RECORDED_PHASE_IRRELEVANCE`: 0.972466 / 3.118385 / 239.655377 (n=3378).
  `OMIT_MISSING_R_FIXED`: 0.972466 / 3.118385 / 239.655377 (n=3378).

Kaynak eşdeğerleri ve converter kapsamı (hesap girdisi yalnız DGS):

- 20261007_1400_SN3_TR0: ElmXnet SL1@B116132 (400 kV): R=73.333333, X=1466.666667 Ω; ElmVac UB4@B5549 (400 kV): R=5.542400, X=55.750400 Ω; ElmVac UB8@B5939 (400 kV): R=1.812800, X=27.260800 Ω; ElmVac UB7@B5551 (400 kV): R=2.371200, X=30.113600 Ω; ElmVac UB16@B9409 (66 kV): R=4355.999564, X=4355.999564 Ω; ElmVac UB15@B9219 (66 kV): R=4355.999564, X=4355.999564 Ω; ElmVac UB23@B119860 (66 kV): R=4355.999564, X=4355.999564 Ω; ElmVac UB22@B9220 (66 kV): R=4355.999564, X=4355.999564 Ω; ElmVac UB9@B5998 (400 kV): R=159999.984000, X=159999.984000 Ω.
  Temsil edilen kaynak bileşeninde 61 pozitif, 1262 kayıtlı sıfır IBR; MAX doğal terminal kA, varsayılan faz −90°, MIN açık dışlama. Örnek gerçek pozitif FID/Ikss: U15263=1.075613 kA@31.5 kV, U15270=1.774207 kA@31.5 kV, U15225=1.670879 kA@33.6 kV, U13114=0.360347 kA@15 kV, U6358=0.075286 kA@11 kV. Tam liste özel kanıttadır.
- 20261008_1000_SN4_TR0: ElmXnet SL1@B116132 (400 kV): R=73.333333, X=1466.666667 Ω; ElmVac UB4@B5549 (400 kV): R=5.542400, X=55.750400 Ω; ElmVac UB8@B5939 (400 kV): R=1.812800, X=27.260800 Ω; ElmVac UB7@B5551 (400 kV): R=2.371200, X=30.113600 Ω; ElmVac UB16@B9409 (66 kV): R=4355.999564, X=4355.999564 Ω; ElmVac UB15@B9219 (66 kV): R=4355.999564, X=4355.999564 Ω; ElmVac UB23@B119860 (66 kV): R=4355.999564, X=4355.999564 Ω; ElmVac UB22@B9220 (66 kV): R=4355.999564, X=4355.999564 Ω; ElmVac UB9@B5998 (400 kV): R=159999.984000, X=159999.984000 Ω.
  Temsil edilen kaynak bileşeninde 57 pozitif, 1235 kayıtlı sıfır IBR; MAX doğal terminal kA, varsayılan faz −90°, MIN açık dışlama. Örnek gerçek pozitif FID/Ikss: U15259=1.075613 kA@31.5 kV, U15268=1.774207 kA@31.5 kV, U15223=1.670879 kA@33.6 kV, U13114=0.360347 kA@15 kV, U6358=0.075286 kA@11 kV. Tam liste özel kanıttadır.

R ablasyonunun eski davranışı X varsayımını da devre dışı bırakıyordu. `OMIT_MISSING_R_FIXED` artık BALANCED ile aynı sonucu verir: bu modellerin ilgili doğal R değerleri mevcut olduğundan 0,01 pu varsayımı etkisizdir. Yeni sentetik analitik test hem yalnız X hem yalnız R eksikliğini ve negatif doğal R reddini doğrular. Kayıtlı sıfır converterların fazını değiştirmek ΔIkss=0 üretir; sıfırdan katkı türetilmedi. MIN politikası, ayrı 1,0 gerilim ve IBR dışlama senaryosudur; MAX PF sonucuyla MAE kabulü yapılmaz. Hiçbir varsayım PF MAE optimizasyonuna göre değiştirilmedi.

## Kanıt 2 — yeni N-1 önce/sonra ve ortak süre

| Model / YTM | Tur | Aday / DC / farklı AC / verified | DC∪AC farklı vaka | Topolojik ada / sayısal olmayan | Süre s | SC fiziksel / elektriksel |
|---|---|---:|---:|---:|---:|---:|
| 20261007_1400_SN3_TR0 / Trakya YTM (Y3) | Önce: taze 3 AC politikası (yalnız N-1) | 495 / 227 / 3 / 0 | 228 | 258 / 267 | 33.915 | — |
| 20261007_1400_SN3_TR0 / Trakya YTM (Y3) | FAST ortak N-1 + SC | 495 / 227 / 0 / 0 | 227 | 258 / 268 | 7.836 | 4769 / 388 |
| 20261007_1400_SN3_TR0 / Trakya YTM (Y3) | BALANCED ortak N-1 + SC | 495 / 227 / 23 / 0 | 228 | 258 / 267 | 170.186 | 4769 / 388 |
| 20261008_1000_SN4_TR0 / Dogu Akdeniz YTM (Y11) | Önce: taze 3 AC politikası (yalnız N-1) | 496 / 220 / 3 / 0 | 221 | 236 / 275 | 37.920 | — |
| 20261008_1000_SN4_TR0 / Dogu Akdeniz YTM (Y11) | FAST ortak N-1 + SC | 496 / 220 / 0 / 0 | 220 | 236 / 276 | 10.055 | 4085 / 369 |
| 20261008_1000_SN4_TR0 / Dogu Akdeniz YTM (Y11) | BALANCED ortak N-1 + SC | 496 / 220 / 16 / 0 | 221 | 236 / 275 | 172.848 | 4085 / 369 |
| 20261007_1400_SN3_TR0 / Trakya YTM (Y3) | Chromium click-to-paint (production Worker/view harness) | 495 / 227 / 28 / 0 | 228 | 258 / 267 | 176.051 | 4769 / 388 |

İlk dar döngüde her modelde yalnız iki AC vaka çalıştırıldı; sonra yukarıdaki taze üç-vaka politikası ve yeni ortak FAST/BALANCED ölçüldü. AC sayısal kapsam artışı, DC∪AC farklı vaka sayısıyla aynı ölçü değildir. Bir DC dışı örnek zaten önceki seçimde vardır; ek AC vakalar çoğunlukla mevcut DC risklerinin kontrolüdür. Tam post-matris veya tam PF uyumlu N-1 iddiası yoktur. Diğer YTM’ler aday kataloğunda sayıldı; sayısal performans kabul örneklemi aday sayısının medyanındaki YTM’dir. Bütün ülke YTM’leri ayrı ayrı benchmark edilmedi.

Alt nedenler / kapasite:

- 20261007_1400_SN3_TR0: FAST sayısal olmayan nedenler `{"TOPOLOGY_ISLANDING:ISLANDING; AC_BALANCE_NOT_EVALUATED": 258, "DC_UNSCREENABLE:OUTSIDE_DC_MODEL; AC_NOT_REQUESTED": 10}`; BALANCED `{"NOT_EVALUATED_BUDGET:GLOBAL_TIME_BUDGET; NEXT_CASE_RESERVE": 267}`. Topolojik ada tek başına beslenemeyen yük kanıtı sayılmaz. 9 UNKNOWN_RATING kaydının tamamı ElmScap; seri kompanzatör kapasitesi kanonik modelde yok. FID'ler: K21, K24, K23, K26, K25, K16, K27, K19, K18. Yüklenme null, P/Q/akım mevcut. Model nominal/user/unknown kaynak kategorileri korunur; TEİAŞ verified kapasite ithal edilmedi.
- 20261008_1000_SN4_TR0: FAST sayısal olmayan nedenler `{"TOPOLOGY_ISLANDING:ISLANDING; AC_BALANCE_NOT_EVALUATED": 236, "DC_UNSCREENABLE:OUTSIDE_DC_MODEL; AC_NOT_REQUESTED": 40}`; BALANCED `{"NOT_EVALUATED_BUDGET:GLOBAL_TIME_BUDGET; NEXT_CASE_RESERVE": 275}`. Topolojik ada tek başına beslenemeyen yük kanıtı sayılmaz. 9 UNKNOWN_RATING kaydının tamamı ElmScap; seri kompanzatör kapasitesi kanonik modelde yok. FID'ler: K21, K24, K23, K26, K25, K16, K27, K19, K18. Yüklenme null, P/Q/akım mevcut. Model nominal/user/unknown kaynak kategorileri korunur; TEİAŞ verified kapasite ithal edilmedi.

Yeni PF çalışma kitabı şekil denetimi:

- 20261007_1400_SN3_TR0: N1_Cases=660, RecordedExtrema=17, tam CaseBranch/CaseVoltage=0/0. Bütün extrema kayıtlarında post güç ucu ve termik payda kanıtı eksik; REFERENCE_EXTREMA_ONLY, sayısal karşılaştırılabilir kayıt 0. Base P/Q, post P/Q yerine kullanılmadı. N1 workbook SHA256 `36e23e3d43e3cf5595549ed56991339d68342ff404b91d81dd35e83d48410658`.
- 20261008_1000_SN4_TR0: N1_Cases=664, RecordedExtrema=20, tam CaseBranch/CaseVoltage=0/0. Bütün extrema kayıtlarında post güç ucu ve termik payda kanıtı eksik; REFERENCE_EXTREMA_ONLY, sayısal karşılaştırılabilir kayıt 0. Base P/Q, post P/Q yerine kullanılmadı. N1 workbook SHA256 `8a3d880775a5ec75423dc946c31001a7ca223676dad48f9307e53aebff9db98f`.

## Kanıt 3 — SC profilleri / PF tanısal hata

| Model | Eşleşen fiziksel / bağımsız elektriksel | Tam partition / alt küme | FAST MAE / P95 / max kA | BALANCED MAE / P95 / max kA | Native varsayımsız sayısal |
|---|---:|---:|---:|---:|---:|
| 20261007_1400_SN3_TR0 | 4245 / 3383 | 0 / 3383 | 0.723336 / 1.667325 / 240.637719 | 1.012387 / 3.032136 / 239.652217 | 0 |
| 20261008_1000_SN4_TR0 | 4239 / 3378 | 0 / 3378 | 0.657446 / 1.619263 / 240.652468 | 0.972466 / 3.118385 / 239.655377 | 0 |

Bu tablo tam ülke PF örtüşmesini, N-1 tablosundaki SC sayıları seçilen YTM’nin bütün hedeflerini gösterir. Fiziksel/elektriksel sayılar sabit kodlanmadı. Tam üyelikte eksik iç terminaller vardır; alt-küme uygunluğu sertifika değildir. PF MIN mevcut olmadığından MIN hata istatistiği yoktur. Doğal varsayımsız strict kaynak kapsamı sonucu null bırakır; hesaplanmış sıfır diye gösterilmedi.

## Performans, yöntem sınırları ve tekrar üretim

- 20261007_1400_SN3_TR0 BALANCED aşamaları ms: `{"MODEL_PREPARATION": 213.54320000000007, "CATALOG": 763.7301999999909, "DC_SCREEN": 1267.9983000000066, "AC_APPROX": 0, "AC_FULL": 160618.3862, "SC_SOURCE_PREP": 2492.78379999999, "SC_FACTORIZATION": 112.43360000000393, "SC_BATCH": 1167.977400000018, "REPORT": 2312.2302999999956}`; ölçüm sonu RSS 1771.7 MiB (anlık, tepe ölçümü değil).
- 20261008_1000_SN4_TR0 BALANCED aşamaları ms: `{"MODEL_PREPARATION": 153.5100000000093, "CATALOG": 834.6324000000022, "DC_SCREEN": 1400.8756999999896, "AC_APPROX": 0, "AC_FULL": 163499.97719999996, "SC_SOURCE_PREP": 2151.143299999996, "SC_FACTORIZATION": 81.85710000000836, "SC_BATCH": 586.9065999999875, "REPORT": 2682.304700000066}`; ölçüm sonu RSS 1713.7 MiB (anlık, tepe ölçümü değil).

Donanım: Intel Core Ultra 7 155U, 14 mantıksal işlemci, 16.605.564.928 bayt RAM; Windows, Node v26.8.1. Yukarıdaki Node ölçümleri import/PF dosyası okuma dışında kaynak hazırlama dahil ortak motor süreleridir. Browser click-to-paint/Worker ölçümü aşağıdaki kabul kaydındadır; Node süresi UI süresi gibi sunulmaz. Yeni warm-start/NR hazırlık paylaşımı/cache hızlandırması uygulanmadı ve başarı iddia edilmiyor. Mevcut SC bileşen ayrıştırma/RHS alias paylaşımı korunur. AC maliyeti baskın darboğazdır.

Tekrar üretim: `node --import tsx tools/n1-sc-followup.ts discover`, her keşfedilen çift için `targeted <index>` (ilk döngü en fazla iki AC), sonra `bench <index>`. Gerçek veriler yalnız `local-benchmark-results/pr7-followup/` içindedir ve Git dışıdır. UI smoke kamu fixture + ayrı gerçek model harness kullanır; harness production Application/view/Worker kullanır, tüm harita uygulamasının açılış benchmarkı değildir.

- VERIFIED: yeni adapter R/X ayrımı ve geçersiz parametre regresyonu; subset/strict ayrımı; alias ağırlıksız istatistik; endpoint/kapasite paydası kapıları. Bunlar bağımsız PF/IEC sayısal doğrulama anlamına gelmez.
- APPROX: seri pozitif bileşen 3PH Zkk/Ikss/Skss; mühendislik MAX/MIN; DC; kontrol sadakati kısmi NR N-1; AC_APPROX station-off fallback.
- NOT_IMPLEMENTED / NOT_VERIFIED: normatif KT/KG/KKW, bağımsız IEC örnek kabulü, PF kaynak katkı paritesi, tam N-1 post matrisi paritesi, ip/Ib/Ith, negatif/sıfır/topraklama/asimetrik arızalar, yeni hızlı AC ve warm-start.

Kalan geliştirme: en kötü FID’lerde aynı anlık topoloji ve arıza başına kaynak katkısı PF exportu; üretici onaylı xdss/R ve converter faz/katkı politikaları; eşleşmiş c ve düzeltme ayarları; daha çok DC dışı AC vaka seçimi; seri kompanzatör kapasite ithalatı. Daha düşük MAE tek başına doğruluk kanıtı yapılmayacak.

## Son kabul / Git kaydı

Doğrulanan kaynak/HEAD SHA: `ac6c70d5be9e385d4a9b3c09f4302ae44d82c66d`. Hesap değişiklikleri `3361616`, görünüm/belge/portable `47cbb26`, legacy timeout uyumluluğu `ac6c70d` ayrı commitlerdir. Bu rapor ayrı belge commitidir; final belge commit SHA Git/PR geçmişindedir. Dal push hedefi `origin/feature/n1-sc-fast-engineering-analysis`; PR açık kalır.

- Son unit/regression: **695/695 PASS** (önceki 688 korunur, 7 yeni hedefli regresyon). İlk tam turdaki tek legacy timeout durum hatası düzeltildi; ilgili testler ve son tam tur geçti. Sonuçlar: `local-benchmark-results/pr7-unit-final.log`. İlk typecheck tanısında yalnız yeni özel diagnostic aracının iki çıkarım tipi düzeltildi; son typecheck PASS.
- Son typecheck / lint / normal build / portable build PASS. Portable deterministik byte kontrolü unit suite içinde PASS; SHA256 `66315db379fee67d006023291362202e03ad8fde685408d54278be6d38f3785c`.
- `npm run test:e2e`: altı bileşenin tamamı PASS (harita, PF benchmark, Lightning, N1 diagnostic, SLD, PUBLIC YTM). PUBLIC sentetik fixture SC parametre eksikliğini null/BLOCKED gösterir; gerçek modelin hesaplanmış SC sayısıyla karıştırılmadı. CSV/XLSX/JSON, senaryo undo ve cache testi PASS.
- Gerçek SN3/Trakya/Y3: **click-to-paint 176.051 s**, Worker/controller elapsed 176.032 s; import ayrıca 7.065 s. Chromium **153.0.8010.12**, Windows NT 10.0.26300.0, 6 GiB browser heap limiti; 495 aday, 227 DC, 28 farklı AC, 0 verified, DC∪AC 228; 4.769 fiziksel / 388 elektriksel SC hedefi, MAX/MIN her fiziksel hedefte hesaplandı. Tüm kapsam durumu mevcut; tam AC bütün vakalar için tamamlandı iddiası yoktur. 640 ve 420 px: document width viewport ile aynı, 50 DOM satır, case-cache geri yükleme PASS; uncaught sayfa JS hatası 0.
- Gerçek harness Vite geliştirme WebSocket bağlantısında Chromium local-network-access console uyarıları üretti. HTTP model, Worker, sonuç, export/DOM akışları tamamlandı; bu uyarılar IEC/PF veya sayısal hata diye etiketlenmedi. HMR üretim analiz bağımlılığı değildir.
- 180 s kapısı ölçülen iki Node YTM turu ve bir gerçek browser YTM için geçti. Bütün YTM/donanım kombinasyonları için garanti veya ülke çapı tam AC sertifikası değildir. AC verified=0, tam partition=0, normatif IEC kapısı kapalı, SC kök neden kapısı **UNRESOLVED**; bunlar geçilmiş kabul edilmedi.
- CI: [PR #7 güncel kontroller](https://github.com/murathany90/Grid_Analyzer_v7/pull/7/checks). Yerel kabul yukarıdadır; yeni push CI sonucu bu bağlantı/PR açıklaması üzerinden izlenir. Eski 688-test CI başarısı yeni 695-test CI sonucu yerine kullanılmadı.


Değişen dosyalar: `dist-portable/GridAnalyzer_v7.html`, `docs/short-circuit-architecture.md`, `src/analysis/contingency-ac/post-results.ts`, `src/analysis/contingency-hybrid/index.ts`, `src/analysis/short-circuit/index.ts`, `src/analysis/ytm-study/export.ts`, `src/analysis/ytm-study/index.ts`, `src/domain/benchmark/sc-partition.ts`, `src/features/analysis/ytm-study-view.ts`, `src/importers/powerfactory-benchmark/short-circuit-source.ts`, `tests/unit/pr7-followup.test.ts`, `tools/n1-sc-followup.ts`.

Özel kanıt dosyalarının SHA256 kayıtları (model/ref dosyaları push edilmedi):

- `local-benchmark-results\pr7-followup\before-0.json`: `990080f68a7a9e6a098c24241e256412728cf94551cc2bc5c171698b1850b3f8`
- `local-benchmark-results\pr7-followup\before-1.json`: `f8eb45b7051f9997cf6e59d8734fb0fa4baa067568bc415a9b7844f000c71c94`
- `local-benchmark-results\pr7-followup\bench-0.json`: `39672cbe9d97bcd8aee9f643ab75ecfb36b36737c93552e978ce6704e1ed6578`
- `local-benchmark-results\pr7-followup\bench-1.json`: `069cd28b86217aac521cc831ad2e9a7eb85a44e34b31e26106b50a93e2ddc1e5`
- `local-benchmark-results\pr7-followup\inventory.json`: `b07d3b028cadd5cce598fbaeba82b490a84cc83bd3f1a0b907a34380739d6c27`
- `local-benchmark-results\pr7-followup\pairs.json`: `69417d8f1adba14e16612e0ae211fad8024ca54e7595eb4d32fa7d695a81d258`
- `local-benchmark-results\pr7-followup\targeted-0.json`: `cf1ba083d526d93baaea331afe107424f32488c2e062f1fb13aa31263f40690d`
- `local-benchmark-results\pr7-followup\targeted-1.json`: `2a8c72379cb46597cd54697fa804139637d34f2b09013ef84e7245761f8a552c`
