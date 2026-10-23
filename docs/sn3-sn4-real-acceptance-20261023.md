# Gerçek SN3/SN4 sayısal çalıştırma ve tanısal karşılaştırma — 23 Ekim 2026

Hesaplanan kaynak: `32e708c13559fa2ebe7e2a51ec49025f7b40de1f` (8.2.5). Çalışma dalı: `feature/sn3-sn4-real-acceptance`. Bu değişiklik yalnız anonim özet raporudur; motor, model parametreleri, test içerikleri ve portable HTML değişmez. Yeni sayısal sonuçlar hesaplandı; eski sonuç cache'i kabul kanıtı yerine kullanılmadı.

**Kabul kapsamı:** iki gerçek modelin sayısal çalıştırması ve regresyonu. PF fiziksel paritesi / IEC doğrulaması kabul edilmedi. Büyük LF/SC uç farklar açık kalır; düşük ortalama hata bu uçların doğruluğunu kanıtlamaz. Bu raporun birleştirilmesi hesap motoruna yeni bir fiziksel doğrulama statüsü vermez.

## Girdi ve kimlik

SN3 `20261007_1400_SN3_TR0`, SN4 `20261008_1000_SN4_TR0`; her birinin kendi birleşik LF/N-1/SC referansı kullanıldı. Dört ZIP'in CRC ve SHA-256'ları, altı XLSX'in manifest boyut/hashleri, sidecar/log/çalışma kitabı kimlikleri ve üç analiz ailesinin Study Case/Study Time tutarlılığı doğrulandı. Test sonrasında özgün dört ZIP hashinin değişmediği de denetlenir. Tam yollar ve hashler yalnız yerel kanıttadır.

DGS IntCase bağımsız zaman alanı içermiyor; model zaman eşleşmesi Study Case kimliğinden türetilir. PF yapısal model/topoloji hashleri DGS dosya SHA'sıyla aynı algoritma sayılmaz. LF terminal/endpoint preflight `COMPATIBLE`; PF ayarlarının bazı semantikleri yalnız ham enum olduğundan karşılaştırma `EXPLORATORY_ONLY` kalır. Kaynak ControlContext'ten yalnız FID ile doğrulanan i_scale/cvqq ve kontrol kaynak alanları uygulanır; PF sayısal LF/SC sonuçları çözüm girdisine kopyalanmaz.

## Gerçek LF / Fast AC / DC

| Ölçü | SN3 | SN4 |
|---|---:|---:|
| Fiziksel model terminali / elektriksel çözüm barası | 86762 / 4077 | 86771 / 4088 |
| Çözülen dal (hat / trafo / seri kompanzatör) | 5140 (2280 / 2851 / 9) | 5141 (2275 / 2857 / 9) |
| `test:full` toplam model süresi, sn | 9,267 | 8,403 |
| `test:full` baz NR iterasyon / artığı, MW | 12 / 1,02933e-6 | 11 / 5,33851e-6 |
| Varsayılan istasyon kontrollü LF motor süresi, sn | 4.737 | 5.155 |
| Varsayılan LF artığı, MW | 2,04073e-8 | 2,09180e-7 |
| Varsayılan LF gerilim aralığı, pu | 0,836209–1,291393 | 0,888846–1,209602 |
| Düzenlenebilir 0,9–1,1 pu sınırı dışındaki baralar | 34 | 30 |

`npm run test:full`: **2 PASS, 0 FAIL, 0 SKIP, 0 NOT_RUN**. Her modelde baz NR, bir kesinti sonrası NR, Fast AC (`CONVERGED_REDUCED_AC`) ve DC (`CONVERGED_DC`) çalıştı. Bu runner'ın varsayılan istasyon kontrolü kapalı yolu ile uygulamanın varsayılan ayarlı istasyon kontrollü LF yolu ayrıca ayrıldı; ikisi de yakınsadı. Kaynak kontrol sadakati ve PF yöntem paritesi sayısal yakınsamadan ayrı değerlendirilir.

Varsayılan LF'de sonlu olmayan bara/dal değeri ve -1e-6 MW altında aktif dal kaybı yok. İki uç P toplamı ile P kaybı farkı sıfır; Q karşılığı en fazla 1,43e-14 MVAr. Hat FROM işaretleri korunur: pozitif/negatif P taşıyan dal sayıları SN3 2977/2153, SN4 3045/2091. Toplam aktif dal kaybı 980,480 / 1036,415 MW. Kapasitif Q nedeniyle toplam reaktif dal kaybı negatif olabilir; kırpılmadı. Dokuz seri kompanzatörün kapasitesi bilinmiyor; yüklenme yüzde değerleri null kalır. Genel sınırlar TEİAŞ onaylı limit olarak sunulmaz.

LF tanısal farklar; her hücre **eşleşen n / MAE / P95 / maksimum mutlak fark**:

| Miktar ve uç | SN3 | SN4 |
|---|---:|---:|
| Bara U, kV | 4077 / 0.145801 / 0.4509 / 12.7346 | 4088 / 0.12556 / 0.354467 / 12.8743 |
| Bara U, pu | 4076 / 0.00242546 / 0.00545292 / 0.942124 | 4087 / 0.00212937 / 0.00353581 / 0.954597 |
| Hizalanmış açı, derece | 4077 / 0.112845 / 0.0806459 / 119.047 | 4088 / 0.121351 / 0.0968702 / 121.412 |
| Hat FROM P, MW | 2280 / 0.172358 / 0.815807 / 7.71554 | 2275 / 0.165222 / 0.816357 / 7.74148 |
| Hat FROM Q, MVAr | 2280 / 1.25067 / 5.05466 / 243.184 | 2275 / 0.991862 / 2.99439 / 234.1 |
| Trafo HV P, MW | 2851 / 0.0303499 / 0.0853266 / 6.81322 | 2857 / 0.0241626 / 0.0586798 / 7.57356 |
| Trafo HV Q, MVAr | 2851 / 0.511957 / 0.521268 / 244.13 | 2857 / 0.364483 / 0.353794 / 247.244 |

Hiçbir LF hücresi sertifikalı parite olarak sayılmaz. Bara PF sayısal kayıtları 4628/4644; GA çözüm kapsamı 4077/4088'dir. Aktif olmayan/sonuç kaydedilmeyen ham terminal satırları eşleşmiş sıfır sonuç sayılmadı. Hat P/Q için 2289/2284 PF satırından 2280/2275 aynı sınıf/FID/uç hücresi tanısal eşleşir. Trafo yüzdelerinde karşılaştırılabilir payda kapısı korunur; bilinmeyen veya uyuşmayan kapasite yüzdeleri zorla karşılaştırılmadı.

Kontrol kapalı koşunun U MAE'si 2,0122 / 3,6619 kV civarındayken varsayılan kontrol ayarlarıyla yukarıdaki değerler elde edildi; bu bir parametre kalibrasyonu değildir. Büyük açı, Q ve yüklenme sapmaları korunmuştur. En kötü kayıtların kaynak terminali, makinesi, trafo tipi/bağlantısı ve PF kaynak hücresi yerel kanıtta incelendi; bu uçların tekil nedensel açıklaması **UNRESOLVED_CAUSE** kalır.

## Süre bütçeli temsilî N-1

Orta Anadolu kapsamı, bütün gerilim seviyeleri ve iki uç YTM ilişkisi üzerinden seçildi. Sadece iki AC pilotu (PF kataloğunda bulunan bir hat ve bir trafo) çalıştırıldı; bütün vakalar tam AC çözülmüş gibi sunulmaz. Açık istasyon kontrolü kapalı yaklaşık profil, kısmi kontrol politikası, 60 sn toplam ve 20 sn/vaka hard worker bütçeleri kullanıldı.

| Ölçü | SN3 | SN4 |
|---|---:|---:|
| Model global aday / topolojik ada / DC dışı | 5131 / 2597 / 289 | 5132 / 2610 / 289 |
| YTM aday / PF aday / eşleşen kesinti | 660 / 660 / 660 | 664 / 664 / 664 |
| DC sayısal / farklı AC pilotu / AC verified | 296 / 2 / 0 | 295 / 2 / 0 |
| DC∪AC farklı sayısal vaka | 296 | 295 |
| AC denenmeyen (DC sonucu varsa korunur) | 658 | 662 |
| Pilot maksimum nodal artığı, MW | 0,00368220 | 0,00488358 |
| Kapsam + DC + iki AC toplamı, sn | 23,167 | 20,383 |

İki pilot da `PARTIAL_SOLUTION`; tam kontrol/PF doğrulaması değiller. Topolojik ada sayısı beslenemeyen yük sayısı değildir. PF'de 17/20 ekstrem satır var; tam kesinti sonrası Branch/Voltage matrisleri 0/0. Uç, payda ve aynı vaka kanıtı olmayan PF yüzdeleri GA global maksimumuyla karşılaştırılmadı: **REFERENCE_EXTREMA_ONLY**, sayısal N-1 karşılaştırması **0**; MAE/maksimum fark null.

İlk yerel denemede özel worker betiğine strict kontrol politikası gönderilmiş ve tüm kapsam explicit seçim yapılmıştı. Üretimdeki açık kısmi-kontrol politikası ve yalnız iki pilot seçimiyle yerel betik düzeltildi, yeniden çalıştırıldı; ilk engellenmiş kayıtlar silinmedi. Bu bir uygulama motoru düzeltmesi değildir.

## Yaklaşık üç faz SC

Her PF fiziksel terminali kendi modelinin FID+kV+elektriksel üyelik grubuyla eşleştirildi. Fiziksel aliaslar bağımsız hata gözlemi olarak ağırlıklandırılmadı. Aşağıdaki payda benzersiz elektriksel baradır; statü **FID_KV_PARTITION_SUBSET_DIAGNOSTIC**.

| Model / profil | Eşleşen fiziksel / elektriksel | Ikss MAE / P95 / max, kA | Skss MAE / max, MVA |
|---|---:|---:|---:|
| SN3 FAST_MAX | 4245 / 3383 | 0.723336 / 1.667325 / 240.637719 | 186.237669 / 64186.700240 |
| SN3 BALANCED_MAX | 4245 / 3383 | 1.012387 / 3.032136 / 239.652217 | 188.726488 / 63923.831546 |
| SN4 FAST_MAX | 4239 / 3378 | 0.657446 / 1.619263 / 240.652468 | 168.647589 / 64190.634349 |
| SN4 BALANCED_MAX | 4239 / 3378 | 0.972466 / 3.118385 / 239.655377 | 180.029389 / 63924.674498 |

BALANCED MIN ayrıca 3383/3378 baranın tamamında hesaplandı; PF MIN kaydı **0**, MIN fark istatistikleri null. MAX Ikss aralığı SN3 1,1652–120,8572 kA, SN4 1,1646–119,8795 kA; MIN 1,0458–107,9639 / 1,0459–107,0552 kA. Bunlar mühendislik senaryolarıdır, güvenli alt/üst sınır değildir. Geçersiz sayısal sonuç 0; `Skss = sqrt(3) × Un × Ikss` birim özdeşliği artığı 0. Her yaklaşık profil tek seyrek ayrıştırmayla 3383/3378 RHS çözdü.

BALANCED kaynak modelinde 455/449 eksik makine parametresi varsayımla temsil edilir; eksik xdss 0,2 pu, yalnız eksik R için 0,01 pu, IBR açısı -90 derece; MIN'de IBR dışlama politikası açık kalır. Bu varsayımlar PF hatasını düşürmek için ayarlanmadı. Varsayımsız native profilde her modelin beş gerçek hedeflik kontrol örneklemi 0 sayısal / 5 NOT_COMPUTABLE üretti; bütün ülke için native başarı sayısı çıkarılmadı.

Tam elektriksel üyelik paritesi 0; alt-küme eşleşmesi 3383/3378. **REFERENCE_VALIDATED = 0, IEC verified = 0.** Proje normatif referansı yalnız IEC 60909-0:2016'dır; bu yaklaşık pozitif bileşen profili normatif IEC hesabı değildir. KT/KG/KKW, bağımsız normatif örnek kabulü, ip/Ib/Ith, negatif/sıfır bileşen/topraklama ve asimetrik arızalar tamamlanmış sayılmaz. Yaklaşık 240 kA'lık en kötü PF farkları gizlenmedi ve nedenleri çözülmüş gösterilmedi.

## Doğrulama ve özel kanıt

Yerel kontrol sonuçları: **typecheck PASS; lint PASS; 719/719 unit/regression PASS (0 fail/skip); sekiz E2E komutu PASS; normal ve portable build PASS; raw-byte SHA-256 eşitliği ve LF-only PASS.** Portable SHA-256 `2b46f6da4f7489c351cfed018b503df5025758b5231f965d544e6f7c109ab57f` değişmedi. Sentetik E2E tarafından yenilenen altı izlenen PNG yerel kanıta kopyalanıp başlangıç baytlarına geri alındı; PR’a ekran görüntüsü eklenmedi. Kamu testleri/sentetik sekiz E2E komutu, iki gerçek model hesaplarından ayrı kanıttır. GitHub zorunlu `validate` ve merge sonrası [main CI](https://github.com/murathany90/Grid_Analyzer_v7/actions/workflows/ci.yml?query=branch%3Amain) ayrıca başarılı olmalıdır; yerel test sonucu CI başarısı yerine geçmez.

Detaylar yalnız Git dışı `local-benchmark-results/sn3-sn4-real-acceptance-20261023/` altında: `input-inventory.json`, `full-model-results.json`, `pf-lf-SN*-diagnostic-cells.json`, `SN*-lf-default-full.json`, `SN*-lf-default-audit.json`, `SN*-n1-full.json`, `SN*-n1-summary.json`, `SN*-sc-*.json`, `SN*-physical-invariants.json`, doğrulama logları ve SHA-256 manifesti. Yerel sürücü `.tmp/sn3-sn4-real-acceptance.ts`; iki orijinal model/PF yolu argüman olarak verilir, `--audit-retest` varsayılan LF ve düzeltilmiş iki AC pilotunu çalıştırır. Bu sürücü ve ham sonuçlar yayımlanmaz. Windows/Node, CPU/RAM ve kaynak commit bilgileri özel kimlik kanıtında kayıtlıdır; Node süreleri tarayıcı click-to-paint ölçümü değildir, bu tur yeni bir 180 sn UI benchmarkı değildir.

Tekrar üretim: [gerçek model runner](../tools/full-model.ts) ile `REQUIRE_MODELS=1 npm run test:full`; [mevcut PF kabul aracı](../tools/pf-benchmark-acceptance.ts) ile her çiftte `--solve --diagnostic`; yerel sürücü üretim N-1/SC ve [karşılaştırma kapılarını](../src/domain/benchmark/comparison.ts) kullanır. Kısıtlar [önceki fiziksel denetim](n1-sc-pr7-followup-fix-20261022.md) ile tutarlıdır; önceki sayılar yeni sonuç yerine kullanılmadı.

Kanıtlanan yeni bir hesap/baz/topoloji kaynak kodu hatası veya ampirik model müdahalesi yok. PF/IEC fiziksel kabul kapıları geçilmedi; bu PR yalnız çalıştırma/regresyon kanıtının yayınlanması içindir. SLD geliştirmesi yapılmadı.
