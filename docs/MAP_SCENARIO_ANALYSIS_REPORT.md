# Harita, senaryo ve analiz kabul raporu — 2026-10-10

Başlangıç: `1c1f0c54ddcb31765f783aee3e8f3015ca346557`. Dal: `feat/map-scenarios-unified-lf-n1-sc-pf-20261010`. Uygulama ve karne hesaplama kodu: `0504445308c08f67af28a588a3a94b82fe49ed83`. Bu raporun commit'i ayrıca dal geçmişindedir.

Portable: `dist-portable/GridAnalyzer_v7.html`, SHA256 `9c1068c89c3edc18f6b0e34f1e8727e36314eefce90d48c37203e32df4ce94f8`. [CI — yeni dalın çalışmaları](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Afeat%2Fmap-scenarios-unified-lf-n1-sc-pf-20261010). CI son commit için typecheck, lint, 349 test, browser smoke, iki build ve committed/build portable ham bayt eşitliğini denetler; gerçek tamamlanma bağlantısı teslim mesajındadır.

## Uygulanan davranış

- B0 kaynak topolojisidir; değişmez S1/S2 kayıtları kümülatif overlay, ad, parent, manevra günlüğü ve model/StudyCase kimliği taşır. Seçme, adlandırma, dallanma, iki senaryo kıyası, geri alma ve B0'a sıfırlama kullanılabilir. Senaryo defteri IndexedDB'ye kaydedilir.
- Harita / SLD / İşletme tek manevra hizmetini kullanır; birincil eylem senaryo Full AC'dir. N-1 geçici kesintisi kayıt overlay'ini değiştirmez. Enerji verme ve kaynak/ada engelleri korunur.
- Sonuçlar snapshot + model/ayar/kontrol kimliğiyle kabul edilir. LF için 18 sonuç, N1/SC için 6 çalışma LRU sınırı; büyük hesap nesneleri referansla paylaşılır, IndexedDB'den geri yüklenir. Senaryo seçimi LF'yi yeniden hesaplatmaz.
- Harita, Analizler, ⚡ ve SLD ortak analiz/kaynak/metrik/vaka/fault/faz seçiminden ve aynı sonuç kimliğinden okur. SLD'nin kaynak topoloji çizimi korunur; açılır **Analiz sonucu** paneli ortak sayısal katmanı sunar.
- PRE/POST/CHANGE manuel AC veya aynı hibrit profilin bazından gelir. Manuel AC'ye hibrit baz/kısıt listesi karıştırılmaz. DC PRE/POST/fark yalnız P ve tahmini yüklenmedir; `GA_DC_SCREEN` etiketi vardır. NEW/WORSENED/PERSISTENT/RELIEVED/UNKNOWN mevcut hibrit kısıt kayıtlarında korunur; kayıt yoksa gösterim engellenir.
- GA senaryo−GA referans ile GA−PF ayrıdır. FID/partition/uç/metot eksikleri null kalır. SC MAX/MIN Ikss/Skss, BLOCKED ve açık NETWORK_APPROXIMATION ayrımı korunur; Ip/Ib/Ith hesaplanmadan sayı gösterilmez.
- Kapalı gelişmiş filtre, kısa toolbar, mobil drawer, explicit kV/akış/TM/etiket yardım kimlikleri ve yalnız hover/focus tooltip uygulanır. Eski analiz/export/ayar/basemap/zoom/fullscreen/legend işlevleri korunur. Solver çekirdeği, worker protokolü ve N1 sayısal çekirdeği değiştirilmedi.

## Gerçek veri ve kota kaydı

SN3 kabul akışı: B0 LF → S1 (bir hat açık) LF → S2 (aynı hat + bir trafo açık) LF → **1 non-bridge DC N1** → 1 native SC MAX BLOCKED → izin verilen 1 açık yaklaşım SC MAX. LF sonuçlarında 4077 bara / 5140 branch; B0/S1/S2 Newton toplamı 95/94/94, final tur 2, ada NR çözümü 79; solver süreleri 2.75/3.14/2.82 s. N1 1/1, ada ayıran 0, 0.32 s; gerçek SN3 üzerinde yeni AC N1 kabul çözümü yapılmadı. SC yaklaşımı `CALCULATED_NETWORK_APPROXIMATION`, Ip/Ib/Ith null. SN4 model + bağımsız referans kısa smoke 42.27 s; toplu analiz yok.

**Kota sapması:** ilk iki deneme (büyük karne argüman yığını ve drawer'ın manevrayı engellemesi) yeniden başlatıldı. Tüm görevde SN3 **3 import / 5 LF**, kabul edilen son oturumda **1 import / 3 LF / 1 DC N1 / 2 SC** vardır. Binlerce vaka veya fault taranmadı; ek ajan çağrısı yapılmadı.

Gerçek SN3 ölçüm portable SHA256: `0ef407c3a1ec9aea55f85e580e09c5a77a689786ac41366a2fb05b4811e3e352`; bu aday, son portable ile aynı bayt değildir. Sonraki değişiklikler kimlik yayını, görünüm yarışı, viewport, senaryo defteri, PRE yöntem kapıları ve karne paydalarıdır. Final karne, kaydedilmiş gerçek B0 vektörleri + aynı PF referansından tekrar toplandı; sayısal çiftlerin eşleşen/tolerans içi/MAE/P95/maks değerlerinin aynı kaldığı doğrulandı; ek LF çözümü yapılmadı. Son kaynak ve portable ayrıca sentetik uçtan uca test edildi. Final portable için yeniden gerçek SN3 kabul çalışması iddia edilmiyor.

## PF–GA gerçek LF karnesi

Tümü **TANISAL / METOT DOĞRULANMADI**; IEC/PF yöntem paritesi veya genel doğruluk garantisi değildir. `GA-ENGINEERING-1.0`: MW/MVAr/MVA için 1 birim + %1 × |PF|; kV için 0.5 kV + %0.5 × |PF|; pu için 0.005 pu + %0.5 × |PF|.

Kapsam = aynı kimlikte sayısal çift / uygun sayısal PF. Tolerans içi = toleransı geçen çift / eşleşmiş çift. Eksik/invalid/sentinel/NOT_RECORDED PF paydadan çıkarılır; mevcut ama eşleşmeyen sayısal PF kapsamı azaltır. 400/154/66 kV Vpu için sırasıyla 4340/20310/81 sayısal dışı PF hücresi çıkarıldı. Kısa tablo aşağıdadır; **120 strata**, FROM/TO, HV/LV, tüm P/Q/S ve V(kV/pu), neden sayıları ve boş katmanlar [tam toplulaştırılmış CSV](MAP_SCENARIO_PF_SCORECARD.csv) içindedir. Ham FID, ZIP/XLSX ve PF sonuç satırları yayımlanmadı.

| kV | Tür / metrik | Eşleşen / uygun | Kapsam % | Tolerans içi çift / oran % | MAE / P95 / maksimum | Eşleşmeyen |
|---:|---|---:|---:|---:|---|---:|
| 400 | bus / voltagePu | 231/245 | 94.2857 | 231/231 = 100 | 0.00032347 / 0.00142538 / 0.00971953 pu | 14 |
| 400 | line / pFromMw | 328/337 | 97.3294 | 327/328 = 99.6951 | 0.40638 / 1.29722 / 2.7433 MW | 9 |
| 400 | line / qFromMvar | 328/337 | 97.3294 | 251/328 = 76.5244 | 1.79749 / 9.24497 / 37.3926 Mvar | 9 |
| 400 | line / sFromMva | 328/337 | 97.3294 | 311/328 = 94.8171 | 0.684121 / 2.59143 / 11.1171 MVA | 9 |
| 154 | bus / voltagePu | 1483/1530 | 96.9281 | 1424/1483 = 96.0216 | 0.00189063 / 0.00557868 / 0.0826922 pu | 47 |
| 154 | line / pFromMw | 1944/1944 | 100 | 1908/1944 = 98.1481 | 0.133579 / 0.52313 / 7.71554 MW | 0 |
| 154 | line / qFromMvar | 1944/1944 | 100 | 1781/1944 = 91.6152 | 1.16355 / 3.79823 / 243.184 Mvar | 0 |
| 154 | line / sFromMva | 1944/1944 | 100 | 1867/1944 = 96.0391 | 0.480318 / 1.003 / 183.735 MVA | 0 |
| 66 | bus / voltagePu | 14/15 | 93.3333 | 14/14 = 100 | 0.000191038 / 0.00097952 / 0.00097952 pu | 1 |
| 66 | line / pFromMw | 8/8 | 100 | 8/8 = 100 | 0.000536385 / 0.00213263 / 0.00213263 MW | 0 |
| 66 | line / qFromMvar | 8/8 | 100 | 8/8 = 100 | 9.52078e-05 / 0.000197174 / 0.000197174 Mvar | 0 |
| 66 | line / sFromMva | 8/8 | 100 | 8/8 = 100 | 0.000563211 / 0.00212399 / 0.00212399 MVA | 0 |

220 kV sayısal referans yok: oran ve hata null / NO_PF_METRIC_DATA. N1 ve SC karnelerinde doğrulanmış yöntem çifti yok: oran/MAE/P95/maks null; PF katmanları ayrıca okunabilir. Aynı model/StudyCase/PF arşivi/ayar/kontrol/tolerans ve farklı Git SHA kapısı sürüm kıyasını yönetir. Önceki gerçek sürüm karnesi bulunmadığından gelişme yüzdesi üretilmedi.

## Doğrulama ve kalan 5 engel

12 yeni hedefli test + 337 mevcut test = **349 geçti, 0 başarısız, 0 skip**. Typecheck ve mimari lint geçti. Browser smoke; kalite JSON, N1 katalog/ada/kayıp/CSV, LF XLSX, referans yuvaları, PF mismatch, hibrit detay, worker timeout/recovery, iptal, SC, signed canvas ve SLD geçti. Portable smoke aynı senaryoları çevrimdışı tek HTML ile geçti. Son UI: 1440×900'de toolbar sonrası harita 597.77 px; 390×844'te 506.47 px; yatay overflow yok, tooltip viewport içinde ve tıklama boyutu değiştirmiyor, JS hatası yok. Gerçek adayda B0/S1/S2 geri dönüşü yeni LF başlatmadı; S2/SLD/SC/⚡ ortak kimlik kontrol edildi.

1. LF yöntem/control paritesi doğrulanmadığından ölçümler tanısal; özellikle 400 kV Q hata kuyruğu görünür.
2. PF N1 tam post-case/uç/rating verisi eksik; tam N1 paritesi hesaplanamaz. Gerçek kabul vakası DC'dir.
3. IEC kaynak/partition/yöntem kanıtı eksik; SC yaklaşımı IEC paritesi değildir; Ip/Ib/Ith null.
4. 220 kV sayısal PF hücreleri yok; bu katmanda ölçülmüş başarı oranı yok.
5. Önceki aynı kanıtlı gerçek sürüm karnesi yok; sürümler arası gelişme oranı yok.
