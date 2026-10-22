# N-1 ve kısa devre mühendislik geliştirmesi — 22 Ekim 2026

- Dal: `feature/n1-sc-fast-engineering-analysis`
- Kaynak uygulama commit: `def101abbb36ca0681d7e9f159251fb80ec29d40`; ilk uygulama `0dd3e97606e36a037ecfc5594dc7b5aa00aabcb3`, sözleşme/legacy ada kapısı `237b743be61ddd3e99c66e8344a37e9f8c33b97d`.
- Başlangıç: PR #6 merge `55967fedf0a2f58386c1c2a06c0de031a6dd556e`.
- Yerel kullanıcı dosyaları ve eski dal korunmuştur. Gerçek modeller, ham PF çalışma kitapları, sonuçlar, ekran görüntüleri ve cache Git dışında tutulmuştur.

## Gerçek değişiklik ve kullanım

Analizler ekranının üstündeki **Tek YTM · N-1 + Kısa Devre** bölümünde YTM, profil ve gerilim seçilip **Analiz Et** kullanılır. Varsayılan **Dengeli**. Harita/Lightning içindeki **YTM · N-1 + SC** düğmesi bu ekrana gider. Önceki LF/N-1/SC ve Senaryo alanları korunur.

- N-1 kataloğu LF gerektirmez; seçilen YTM içi ve sınır bağlantıları tüm gerilimlerde alınır. Etkiler tam şebekede hesaplanır. DC sayısal kayıtları ve kapasite belirsizlikleri AC başarısızlığında korunur.
- Dengeli profil üç öncelikli AC vaka dener; erken bir sıra DC indirgemesinde bulunmayan, tam ağda ada ayırmayan gerçek kesintiye ayrılır. Ayrıntılı profil ortak bütçe içinde en fazla 12 AC vaka dener.
- AC_FULL mevcut tam NR/PV-PQ/Q-limit/istasyon dengeleme motorunu kullanır. AC_APPROX, baz çözüm başarısızsa yerel PV ve istasyon kontrolü kapalı açık varsayımlı NR geri dönüşüdür; mevcut aktif dengeleme ayarı korunur; ayrı bir IEC/PF eşdeğerliği veya yeni bağımsız hızlı AC yöntemi değildir. Gerçek SN2/SN3/SN4 çalışmalarında bu geri dönüşe gerek kalmadı; AC_APPROX süresi sıfırdır.
- Kısa devre seri pozitif bileşen/KLU motoru yeniden kullanılır. Aynı elektriksel baradaki terminaller tek RHS ile eşlenir; her hesap modu için bağlı bileşen başına tek ayrıştırma paylaşılır.
- Sıfır kayıtlı converter girdisi ile eksik girdi ayrılır. Eksik kaynak katkıları yalnız açık ENGINEERING_PARTIAL politikasıyla kaynak/bileşen düzeyinde ayrıştırılır. Hatalı hat/trafo empedansı, çözülemeyen bağlantı, geçersiz nominal baz ve kaynak bulunmaması sayısal sonuç üretmez.
- Arka plan Worker, ilerleme/kalan hedef sayısı, aşama checkpointleri, ortak 178 s varsayılan bütçe ve sert Worker sonlandırması vardır. AC süre sonu önceki DC/SC sonuçlarını silmez.
- **Devam**, model/senaryo/ayar/kaynak kimliği aynıysa bitmiş DC ve SC modlarını tekrar hesaplamaz; AC kuyruğunu ilerletir. Değişmiş kimlik eski sonucu reddeder. Tamamlanmamış SC modu yeniden değerlendirilir; tek bir yarım SC modunun RHS seviyesinde kalıcı devamı bu sürümde yoktur.
- En fazla iki AC vaka ayrıntısı bellekte kalır; tarayıcıda hesaplanan diğer ayrıntılar IndexedDB üzerinden yüklenebilir. Tablo DOM sınırı 50 satırdır.
- Özet, N-1 kısıtları, vaka ayrıntıları, bara SC, PF karşılaştırması ve yöntem/veri sekmeleri; düzenlenebilir kullanıcı V/termik eşikleri; arama, sayfalama, CSV/XLSX/JSON dışa aktarma eklendi. Vaka ayrıntısı uç P/Q/S/I, kayıplar, V ve açı içerir.

## Kalite sözleşmesi

`REFERENCE_VALIDATED`, `NATIVE_COMPUTED`, `ENGINEERING_APPROX`, `DC_SCREEN_ONLY`, `NOT_COMPUTABLE`, `REFERENCE_ONLY` mevcut durum kodlarına eklenen alanlardır. Eski Strict API kapıları korunmuştur. Kontrol doğrulaması bağımsız PF doğrulaması değildir.

**Bekleyen / süre bütçesinde denenmeyen vaka**, fiziksel veri eksikliğine eşitlenmez: kalite null/atanmamış kalır ve `pendingCounts` ile durum/gerekçe ayrı raporlanır. `NOT_COMPUTABLE` fiziksel/yöntem asgari koşulları karşılanmayan kayıt içindir. Geçersiz akım ve güçler null; hesaplanmış sıfır ile eksiklik farklıdır.

MAX/MIN görünür mühendislik senaryolarıdır; normatif sıcaklık, kaynak devrede kalma ve IEC düzeltmeleri tamamlanmadığından güvenli ekstrem sınır değiller. SC yöntem profilleri FAST_3PH, ENGINEERING_EXTENDED ve IEC_REFERENCE_VERIFIED ön kontrolüdür. IEC 60909-0:2016 açıkça sabittir; doğrulama kapısı geçilmediği için Verified profili IEC sayısal sonuç üretmez.

## kontrol1 envanteri

Alt dizinleriyle dört ZIP bulundu: iki DGS-JSON model ZIP ve her model yanında bir `Birleşik_LF_N-1_SC_referans_ZIP.zip`. İçlerinde toplam altı XLSX, altı Reference_Package JSON ve altı tanı logu vardır. Bağımsız CSV veya harici ControlContext dosyası yok; ControlContext_Raw LF çalışma kitabındadır.

| Girdi / sayım | SN3 | SN4 |
|---|---:|---:|
| Model | 20261007_1400_SN3_TR0.zip | 20261008_1000_SN4_TR0.zip |
| Çalışma zamanı | 07.10.2026 14:00 | 08.10.2026 10:00 |
| Fiziksel terminal (ham / aktif) | 86.762 / 49.275 | 86.771 / 48.898 |
| Elektriksel bara | 4.077 | 4.088 |
| YTM / kanonik TM-site / ham ElmSubstat | 10 / 1.619 / 4.900 | 10 / 1.619 / 4.900 |
| Hat toplam / aktif | 2.387 / 2.280 | 2.389 / 2.275 |
| Trafo toplam / aktif | 3.700 / 2.851 | 3.699 / 2.857 |
| ElmCoup toplam / kapalı / açık | 95.665 / 45.230 / 50.435 | 95.678 / 44.842 / 50.836 |
| ElmSym toplam / aktif | 1.298 / 642 | 1.297 / 652 |
| Aktif ElmSym constv / constq | 232 / 410 | 245 / 407 |
| ElmGenStat toplam / aktif | 1.542 / 1.323 | 1.541 / 1.292 |
| Aktif ElmGenStat constv / constq | 135 / 1.188 | 98 / 1.194 |
| ElmXnet toplam / aktif | 1 / 1 | 1 / 1 |
| ElmVac toplam / aktif | 12 / 8 | 12 / 8 |
| Aktif N-1 hat + trafo kataloğu | 5.131 | 5.132 |
| DC taranabilir / tam ağ ada ayıran / diğer | 2.245 / 2.597 / 289 | 2.233 / 2.610 / 289 |

StaSwitch ayrı tablosu yoktur; anahtar/kuplaj durumu ElmCoup.on_off üzerinden alınır. Açık/kapalı, outserv ile aynı anlamda sayılmadı. Paralel kenarlar ve ada ayıran kesintiler tam elektriksel çoklu graf üzerinde sınıflanır.

Hatlarda TypLne rline/xline/dline ve kesitler, kapasitelerde nominal sline/kesit çarpanları; trafolarda uktr/pcutr/strn, HV/LV bazları ve mevcut sabit kademeler kullanılır. Bu iki modelde adapterin reddettiği empedans/kademe dalı sayısı sıfırdır. Son koruma negatif/bozuk makine R/X alanını eksik veri varsayımıyla değiştirmez; SN2/SN3/SN4 aktif makine envanterinde bu yeni kapıya düşen kayıt sayısı ayrıca sıfır ölçüldü. İşletme kapasitesi adayları otomatik TEİAŞ limiti sayılmaz; doğrulanmış işletme kapasitesi verilmeyen yerde kaynaklı model nominal bazı, bilinmeyende null kullanılır. Manuel/mevsimsel kapasite arayüzleri korunur; bu tur yeni TEİAŞ işletme kapasitesi ithal edilmedi.

279 hat tipinin pozitif ve sıfır bileşen alanları sayısaldır. 702 makine tipinde xdss, 703 tipte x2sy/x0sy sentinel dışı sayısal kayıt vardır; bunlar aktif kaynak/uygunluk doğrulamasıyla aynı değildir. Trafo uk0tr mevcut; bütün x0tor0 alanları sentinel olduğundan geçerli kabul edilmedi. Negatif/sıfır ağ ve topraklama bağlantıları bu sürümde çözülmez.

Aktif senkron makinelerde doğal R/X eşdeğeri SN3:249, SN4:261; eksik X alanı olan kaynaklar sırasıyla 393/391. SN3 aktif fsce converterlarının hepsinde ngnum=1; 1.262 tanesinde Ikss3PF=0 kayıtlı, 61 tanesinde pozitif. Sıfır kaydı native olarak korunur; eksik akım sıfıra dönüştürülmez. ElmXnet ikss/ikssmin ve R/X, ElmVac R1/X1 bulunur. ElmAsm/ElmTr3/ElmVsc ek kaynak tabloları bu model setinde yoktur.

| Referans satırları | SN3 | SN4 |
|---|---:|---:|
| LF GA_Reference_Raw / ControlContext_Raw | 56.381 / 45.831 | 55.984 / 44.963 |
| N1_Cases_Raw / RecordedExtrema | 660 / 17 | 664 / 20 |
| Tam N-1 kol / bara post matrisi | 0 / 0 | 0 / 0 |
| SC fiziksel / hesap barası / cihaz | 4.689 / 3.769 / 11.571 | 4.686 / 3.768 / 11.533 |

PF 24.0.7; LF addon 1.3.1 ve AC_BALANCED, N-1 VERIFIED_FAMILY_ONLY, SC addon 1.3.0 ve IEC 60909 3PH MAX. Sidecar çalışma vakası ve zamanı model adlarıyla uyumludur. PF yapısal model/topoloji hashleri ile GA dosya hashinin algoritmaları farklıdır; bunlar eşit varsayılmadı. MIN referansı yoktur. SC arıza terminali, nominal kV, arıza tipi/modu, bara üyeliği ve yöntem denetlenir; tam eşleşmeyenler yalnız tanısal kayıttır. PF sonuçları hesap girdisine veya başlangıç gerilimine kopyalanmadı; kalibrasyon yapılmadı.

## Varsayımlar ve etkileri

| Varsayım | Birim / kaynak | Etki |
|---|---|---|
| Eksik makine xdss=0,20 | Makinenin doğal kV/MVA/ngnum bazında pu; ABB 1SDC010001D0204 genel 5–20% aralığından mühendislik seçimi, TEİAŞ üretici doğrulaması yok | Zkk, Ikss, Skss |
| Yalnız eksik rstr için 0,01 | Makine bazında pu; GA açık R/X varsayımı, üretici kanıtı yok | Zkk, Ikss, Skss; mevcut rstr değiştirilmez |
| Pozitif IBR akım fazı -90° | Derece, reaktif ideal akım yaklaşımı; doğal Ikss3PF kA korunur | Ikss/Skss, MIN katkısı açık profil dışlaması |
| MAX 1,1 / MIN 1,0 | pu; görünür GA senaryo faktörü | Kaynak eşdeğeri ve arıza gerilimi, normatif cmax/cmin değildir |
| Seri pozitif bileşen ağ | Yük, hat şarjı ve şöntler dışarıda; KT/KG/KKW uygulanmıyor | Zkk/Ikss/Skss, yönü garanti edilmeyen hata |
| Desteklenmeyen kaynakların kısmi kapsamı | Kaynak FID ve bileşen kaydı | Bilinmeyen yanlılık; güvenli alt/üst sınır değildir |

Varsayımlar kodda `SC_ENGINEERING_ASSUMPTIONS`, dönüştürülen kaynak/FID/ohm/kA kayıtları `sourceModelInputs`, eksik/ihmal edilen kaynaklar componentEvidence içinde izlenir. Kaynak araştırması: [ABB el kitabı](https://library.e.abb.com/public/561a28a17753c444c125714f00360967/1SDC010001D0204.pdf), [DIgSILENT ideal converter akımı açıklaması](https://faq.digsilent.de/en/faq-reader-powerfactory/why-is-the-short-circuit-current-not-changing-after-a-large-impedance.html). Genel kaynaklardan seçilen değerler modele özel referans doğrulaması sayılmaz.

## Gerçek hesap kapsamı ve önce / sonra

| Model / YTM | N-1 aday | Önceden sayısal DC | Sonra farklı DC/AC vaka | Yaklaşık AC | Önce SC hesaplanabilir elektriksel bara | Sonra SC elektriksel / fiziksel terminal |
|---|---:|---:|---:|---:|---:|---:|
| SN2 / Orta Anadolu | 673 | 301 | 302 | 3 | 0 / 509 test edildi | 509 / 5.241 |
| SN3 / Orta Anadolu | 660 | 296 | 297 | 3 | 0 / 500 test edildi | 500 / 6.278 |
| SN3 / Doğu Anadolu | 343 | 151 | 152 | 3 | önceki varsayımsız gate bloke | 275 / 3.397 |
| SN3 / Batı Anadolu | 858 | 342 | 343 | 3 | önceki varsayımsız gate bloke | 708 / 8.713 |
| SN4 / Batı Anadolu | 856 | 342 | 342 (ilk seçim politikası) | 3 | tek terminal baseline bloke | 703 / 8.169 |

SN2 ülke kataloğunun 5.250 adayı korunur. Önceki Strict kabulünde yaklaşık AC sonuçlara izin verilmiyordu; var olan DC sayısal taraması yok sayılmadı. Yeni doğrudan AC örneği, SN2/SN3 bölgelerinde DC dışında birer farklı vakayı sayısal kapsama ekledi. Bütün adayların aynı turda AC çözülmüş olduğu ileri sürülmez.

| Son kalite / bekleyen kayıt (YTM kapsamı) | SN2 Orta Anadolu | SN3 Orta Anadolu |
|---|---:|---:|
| ENGINEERING_APPROX (iki SC modu fiziksel satırları + 3 AC vaka) | 10.485 | 12.559 |
| DC_SCREEN_ONLY (AC ile yükseltilmeyen vakalar) | 299 | 294 |
| NATIVE_COMPUTED / REFERENCE_VALIDATED / REFERENCE_ONLY | 0 / 0 / 0 | 0 / 0 / 0 |
| Fiziksel/yöntem NOT_COMPUTABLE SC satırı | 0 | 0 |
| AC bekleyen / bütçede denenmeyen N-1 | 371 | 363 |

Alias fiziksel satırları kalite sayılarında tekrarlanır; farklı elektriksel bara sayısı yukarıda ayrıca verilmiştir. İlk ham ölçümlerde bekleyen N-1 kayıtlarına NOT_COMPUTABLE atanmıştı; son sözleşme düzeltmesi bunları null kalite + pendingCounts olarak ayırır. Bu düzeltme sayısal değerleri değiştirmez.

SN2 yeni baz LF: 4.180 bara / 5.255 kol, CONVERGED_FULL_NR, mismatch 8,779103968098445e-7 MW, 5,58 s. SN3: 4.077 bara / 5.140 kol, mismatch 3,344170790980927e-6 MW, 5,74 s. Kontrol/aktif dengeleme kanıtı kısmi olduğundan PF paritesi değildir. SN2 ve SN3 native girdilerden üretilen yaklaşık 3PH sonuçlarında birim kimliği Skss=sqrt(3)*kV*Ikss ve residual <1e-6 kontrol edildi. SN3 Orta Anadolu Ikss MAX aralığı yaklaşık 1,514–145,129 kA; en büyükler düşük gerilim üretici baralarını da içerir.

## 180 saniye ve donanım

Intel Core Ultra 7 155U, 14 mantıksal işlemci; 16.605.564.928 bayt RAM; Windows 10.0.26300; Node v26.8.1; Playwright Chromium HeadlessChrome/153.0.8010.12. Gerçek büyük modellerde tarayıcı testinin JS heap sınırı 6 GiB olarak ayarlandı; bu nedenle süreler daha düşük bellekli cihazlar için garanti değildir. Testler sıralı çalıştırıldı.

Ölçüm gerçek Analiz Et click olayından iki requestAnimationFrame sonrası sonuç boyamasına kadardır. İlk model içe aktarma ayrıca ölçüldü; cache sonucu okunarak başarı kaydedilmedi. Her SC modunda tek ayrıştırma ve elektriksel bara başına bir driving-point RHS vardır.

| SN3 YTM | Aday / sayısal DC / yaklaşık AC | Elektriksel / fiziksel SC hedef | MAX / MIN hesaplanan fiziksel | İçe aktarma s | Click → sonuç s |
|---|---:|---:|---:|---:|---:|
| Y9 | 343 / 151 / 3 | 275 / 3397 | 3397 / 3397 | 9.87 | 50.722 |
| Y6 | 660 / 296 / 3 | 500 / 6278 | 6278 / 6278 | 9.68 | 50.136 |
| Y5 | 858 / 342 / 3 | 708 / 8713 | 8713 / 8713 | 9.53 | 50.987 |

Üç gerçek YTM çalışması 180 s hedefinin altındadır. Nihai slot politikasında Doğu Anadolu ve Batı Anadolu ayrıntı önbelleği geri yüklemesi de gerçek Worker ile geçti. Orta Anadolu ölçümü slot politikasını içerir; son pendingCounts/başlık düzeltmeleri sayısal motoru değiştirmez.

| Aşama (s) | Küçük Y9 | Orta Y6 | Büyük Y5 |
|---|---:|---:|---:|
| MODEL_PREPARATION | 0.217 | 0.235 | 0.268 |
| CATALOG | 0.783 | 0.601 | 0.728 |
| DC_SCREEN | 1.113 | 1.203 | 1.111 |
| AC_APPROX | 0.000 | 0.000 | 0.000 |
| AC_FULL | 28.510 | 27.383 | 27.956 |
| SC_SOURCE_PREP | 10.740 | 10.842 | 10.496 |
| SC_FACTORIZATION | 0.194 | 0.176 | 0.154 |
| SC_BATCH | 0.942 | 1.583 | 2.182 |
| REPORT | 8.193 | 8.064 | 8.079 |

REPORT checkpoint/serileştirme/Worker aktarımı ve atanamayan orkestrasyon süresini de kapsar. SC_SOURCE_PREP kaynak adapteri, hash ve hazırlık içindir. SC ayrıştırması ayrıca ayrılmıştır. SN2 Orta Anadolu Node toplamı 43,04 s; SN3 Orta Anadolu 43,81 s; SN4 Batı Anadolu 42,16 s (Node süreleri click-to-paint yerine geçmez).

## PowerFactory sayısal tanıları

SN3 LF için 11.182 normalize kayıt FID ile eşleşir; model/topoloji hash algoritması ve çalışma kontrolü doğrulanmadığı için Strict karşılaştırma kapısı BLOCKED kalır. Aşağıdakiler bağımsız **FID temelli tanısal farklar**, kabul toleransı veya hata sertifikası değildir. Ham açı farkları referans/gauge doğrulaması olmadan hata olarak yorumlanmaz.

| LF metrik | Eşleşen | MAE | P95 mutlak | En büyük mutlak |
|---|---:|---:|---:|---:|
| Hat P FROM MW | 2.289 | 1,7544 | 7,5460 | 93,4046 |
| Hat Q FROM MVAr | 2.289 | 1,8223 | 8,0266 | 241,9178 |
| Trafo P HV MW | 2.851 | 0,2211 | 0,8331 | 12,3974 |
| Trafo Q HV MVAr | 2.851 | 0,7224 | 1,6802 | 244,1157 |
| Bara Vpu, nominal/partition doğrulaması eksik tanı | 4.076 | 0,003002 | 0,006273 | 0,942141 |

En büyük LF tanıları: H4627 Q FROM +241,918 MVAr; T7550 Q HV -244,116 MVAr; B8411 Vpu GA 0,988185 / PF 0,046044. Bunlar ihmal edilebilir farklar değildir; terminal/nominal baz, kaynak/istasyon kontrolü ve çalışma kimliği bağımsız incelenmelidir. Modeli yakınsatmak veya farkı gizlemek için parametre değiştirilmedi.

SN3 Orta Anadolu iki gerçek PF kesintisi H2182 ve H5741 yeniden yaklaşık AC çözüldü. Referansta yalnız iki ilgili termik ekstrem mevcut, P/Q/V post matrisleri yoktur. H6391 ve H5743 yüklenme paydaları doğrulanamadığından karşılaştırılabilir yüzde çifti **0**, eksik/uyumsuz çift **2**; dolayısıyla N-1 MAE/P95 uydurulmadı.

SC SN3 Orta Anadolu: 573 aynı çalışma/FID/kV/MAX sayısal çifti, 11.983 eksik/eşleşmeyen fiziksel-mod kaydı (MIN referansı da yok). Tam elektriksel üyelik kapısını geçen çift 0. FID-only Ikss tanısı MAE 0,834465 kA; P95 2,904855 kA; maksimum 32,563421 kA. SN4 Batı Anadolu: 788 FID çifti, MAE 0,737956 kA, P95 2,651745 kA, maksimum 23,250831 kA; bunlar da doğrulanmış parite değildir.

SN3 Ikss için en kötü 20 FID (GA−PF; tamamı tanısal):

| FID | GA kA | PF kA | Fark kA | Bağıl % |
|---|---:|---:|---:|---:|
| B5332 | 4.527109 | 37.090530 | -32.563421 | -87.794 |
| B9508 | 35.590722 | 22.730197 | 12.860526 | 56.579 |
| B5354 | 30.909731 | 19.055051 | 11.854681 | 62.213 |
| B7964 | 43.503567 | 34.390836 | 9.112731 | 26.498 |
| B5364 | 43.503567 | 34.390836 | 9.112731 | 26.498 |
| B5220 | 21.666812 | 15.122701 | 6.544110 | 43.273 |
| B5383 | 13.925506 | 7.421675 | 6.503831 | 87.633 |
| B105019 | 15.690115 | 10.679469 | 5.010646 | 46.918 |
| B9518 | 15.690115 | 10.679469 | 5.010646 | 46.918 |
| B8544 | 10.236186 | 5.518523 | 4.717663 | 85.488 |
| B8545 | 10.236186 | 5.518523 | 4.717663 | 85.488 |
| B5210 | 16.055002 | 11.489903 | 4.565099 | 39.731 |
| B5115 | 12.867690 | 8.405160 | 4.462530 | 53.093 |
| B5237 | 18.131927 | 13.748273 | 4.383654 | 31.885 |
| B7162 | 18.131927 | 13.748273 | 4.383654 | 31.885 |
| B5111 | 5.412681 | 9.381769 | -3.969088 | -42.306 |
| B7005 | 14.902581 | 11.134392 | 3.768189 | 33.843 |
| B8472 | 14.902581 | 11.134392 | 3.768189 | 33.843 |
| B5349 | 16.850809 | 13.111684 | 3.739125 | 28.518 |
| B5208 | 11.037458 | 7.465668 | 3.571790 | 47.843 |

Neden sınıfları: farklı hash algoritması / üyelik kapısı eksik; doğal xdss eksikliği ve varsayım; ideal IBR fazı ve MIN dışlaması; KT/KG/KKW uygulanmaması; kaynak ve kontrol/işletme ayarı farklılığı; eksik referans matrisi ve termik payda. Bu nedenler farkların olası sınıflarıdır; her en kötü FID için nedensellik bu tur kanıtlanmış değildir. Kaynak katkısı bilinmeyen sonucun yönü veya güvenli sınırı iddia edilmez.

## Test ve kabul

- Mevcut 672 test korundu; 16 yeni çekirdek testiyle **688 test: 688 PASS, 0 başarısız, 0 atlanan**.
- Yeni testler: kısmi kaynak ve bias; geçersiz fizik; sıfır/eksik converter; doğal R alanını koruyan xdss fallback; aynı bara RHS/faktör reuse; MAX/MIN kimliği; IEC kapısı; LF gerektirmeyen DC; Strict başarısızlığında DC; tüm YTM hedefleri; CSV/XLSX/JSON; bayat kimlik ve devam; bütçe sonu null/pending.
- Gerçek test araçları: n1-sc-inventory.ts, n1-sc-engineering-acceptance.ts, n1-sc-pf-comparison.ts ve n1-sc-browser-acceptance.mjs. Girdi konumları kontrol1; SN2 ayrıca Downloads altındaki 20261020_1800_SN2_TR0.zip.
- Tarayıcıda 640/420 px taşma yok, 50 satır sınırı; doğrudan vaka ayrıntısı IndexedDB geri yükleme geçti. Yeni PUBLIC CI tarayıcı testi undo sonrası sonuç tablosu ve üç export biçimini de denetler.
- İlk portable-byte testi commit öncesinde yeni çıktı ile eski HEAD blobunu karşılaştırdığı için başarısızdı; paket kaynak commitine alındıktan sonra 686/686 geçti. İlk büyük tarayıcı testindeki CDP üzerinden 144 MB gövde taşıma başarısızlığı test aracında normal HTTP aktarımıyla düzeltildi; ürün import hatası olarak gösterilmez.
- Tip denetimi, mimari lint, standart ve portable derleme PASS. Ham portable byte/hash testi ve iki ardışık deterministik build PASS. Tarayıcı zincirinin altı bileşeni ayrı loglarla PASS: browser-smoke, pf-benchmark-browser-smoke, map-lightning-audit, n1-diagnostic, sld-browser ve yeni PUBLIC YTM testi. İlk zincir koşusu legacy adalaşma/harita kapısını yakaladı; kısmi beslenen ada sonuçları yalnız yeni mühendislik profiline açılarak eski piksel/durum kapıları korundu. PF browser testi düzeltmeden sonra bütünüyle PASS.

Portable SHA-256: `d56be355dd52c44416c5d842ff9d53fa1641ce8421b3d95ed67c4d38651de759`. Yerel özel kanıtlar `local-benchmark-results/n1-sc-20261022/` altındadır; depoya eklenmedi. GitHub PR/CI kaydı PR açıklamasında takip edilir.

## Kalan kapsam ve sonraki çalışma

IEC KG/KT/KKW, güç istasyonu ünitesi tespiti, sıcaklık düzeltmeli normatif MIN, motor/decay, meshed kappa, ip/Ib/Ith, negatif-sıfır/topraklama ve asimetrik arızalar eksiktir. Bu büyüklükler null kalır. Cihaz duty/geçer kararı Ikss ile ikame edilmez.

Tam PF N-1 post kol/bara matrisleri, aynı hesap yöntemi ve yüklenme paydası; aynı SC fiziksel/elektriksel bara üyeliği; makine üretici xdss/R ve IBR terminal/faz/katkı bilgisi en önemli açık verilerdir. İstasyondaki desteklenmeyen kontrol ve eksik Q sınırları kısmi kaliteyi korur. 180 s, her vakanın tam AC yakınsama garantisi değildir.

Önerilen sıra: eksik gerçek kaynak parametrelerini tamamlamak; en kötü FIDleri bağımsız çalışma ve nominal baz üzerinden incelemek; referans tam matrislerini ihraç etmek; KT/KG alt kümelerini bağımsız örneklerle doğrulamak; daha çok AC vaka için warm-start/faktör paylaşımı; yarım SC modunu RHS seviyesinde devam ettirmek. Kalibrasyon eklenirse eğitim/doğrulama kümeleri ayrılmalıdır.

## Değişen dosyalar

- `dist-portable/GridAnalyzer_v7.html`
- `package.json`
- `src/analysis/contingency-hybrid/index.ts`
- `src/analysis/short-circuit/engineering-profile.ts`
- `src/analysis/short-circuit/index.ts`
- `src/analysis/short-circuit/source-adapter.ts`
- `src/analysis/ytm-study/export.ts`
- `src/analysis/ytm-study/index.ts`
- `src/app/contracts.ts`
- `src/app/controller.ts`
- `src/domain/results/quality.ts`
- `src/features/analysis/analysis-workspace.ts`
- `src/features/analysis/study-actions.ts`
- `src/features/analysis/ytm-study-view.ts`
- `src/importers/powerfactory-benchmark/short-circuit-source.ts`
- `src/styles/analysis.css`
- `src/workers/computation.worker.ts`
- `src/workers/protocol.ts`
- `tests/unit/engineering-ytm.test.ts`
- `tools/n1-sc-browser-acceptance.mjs`
- `tools/n1-sc-engineering-acceptance.ts`
- `tools/n1-sc-inventory.ts`
- `tools/n1-sc-pf-comparison.ts`
- `docs/n1-sc-engineering-development-20261022.md` (bu kabul raporu).
