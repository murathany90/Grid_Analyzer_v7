# YTM bazlı N-1 ve native kısa devre geliştirme sonuçları

Başlangıç: `207e42f634830a43783eb261153f2260dc915ffe`. Çalışma dalı: `feat/ytm-n1-full-ac-iec60909-parity-improvements`. Özel ZIP/XLSX, gerçek FID listeleri ve cihaz sonuçları bu raporda veya Git'te bulunmaz. Yerel pilotlar 2026-10-09 tarihinde çalıştırılmıştır.

## Çalışan hesap ve kapsam

YTM seçimi native site/area ilişkilerinden, ekipmanın iki ucundan yapılır. Tüm/tek/çoklu YTM, iç/sınır/her ikisi ve 400/154/33 kV bantları vardır. Trafolarda iki sargının gerilim seviyesi dikkate alınır. Seçim yalnız kesinti/fault hedeflerini filtreler; bağlı şebeke ve dış YTM kaynakları çözümde kalır. Eski DC ekranının ≥66 kV varsayılan kapsamı korunur; tam katalog çağrısı alt gerilimleri de tutar.

Baz Full AC → uygun DC taraması → açık seçim/kritik/belirsiz vakalarda Full AC çalışır. DC kapsamı dışındaki alt gerilim vakaları doğrudan AC'ye gider. Seçili kapsamın tamamı AC'ye alınabilir. Varsayılan parti 10, eşzamanlı çözüm 1'dir; iptal, checkpoint, bütçe ve devam desteklenir. Tam katalog/vaka listeleri 50 kayıtla sayfalanır. Vaka haritası, bara V/açı, iki uç P/Q/S/I, mevsimsel akım/MVA yüklenmesi, kısıt, belirsiz rating, ada ve beslenemeyen yük; yerel CSV/XLSX/JSON çıktılarında korunur.

| Ölçüm | SN3 | SN4 |
|---|---:|---:|
| Tam native N-1 ekipman kataloğu | 5.131 | 5.132 |
| Tek YTM / iç / sınır kapsamı | 858 / 834 / 24 | 856 / 832 / 24 |
| İki YTM birlikte | 1.632 | 1.620 |
| Tek YTM'de 33 kV sargı/bant kapsamı | 325 | 324 |
| Pilot seçilen / AC sonuç üretilen | 9 / 9 | 9 / 9 |
| Hibrit pilotta DC ihlal / ada | 7 / 1 | 7 / 1 |
| Kısıt ihlalli tam AC / kısmi çözüm | 8 / 1 | 8 / 1 |
| Vaka-bara gerilim ihlali kayıtları | 439 | 762 |
| Vaka-dal termik ihlali kayıtları | 27 | 18 |
| Vaka-dal bilinmeyen rating kayıtları | 81 | 81 |
| En büyük AC mismatch (MW) | 4,4721e-6 | 4,7666e-5 |
| Ada vakasında beslenemeyen yük (MW) | 43,4 | 56,462 |

İlk hibrit parti 5, devam partisi kalan 3 vakayı çözdü; bitmiş checkpoint'e tekrar devam etmek ek çözüm yapmadı. Dokuzuncu vaka 154/31,5 kV trafosudur; 33 kV kapsam seçimiyle çalıştırılmıştır. Bu trafo mevcut DC gerilim kapsamındadır. Gerçek seçilen YTM'de salt <66 kV ekipman bulunmadığından salt 33 kV doğrudan-AC yolu analitik hedefli testte doğrulandı. Pilotlar tüm katalog veya 660/664 PF vakası için kapsamlı güvenlik sonucu değildir.

DC temiz-vaka AC örneklemesi uygulanmıştır. Bu gerçek pilotun seçilmiş sekiz vakasında DC temiz vaka yoktur; gerçek yalancı-negatif oranı ölçülmedi. Küçük bağımsız ağ testinde DC temiz vakanın AC gerilim ihlali tespit edilmiştir. Bilinmeyen rating, kısmi çözüm ve çalıştırılmamış vakalar hiçbir zaman şebeke güvenli sonucu oluşturmaz. PF tam vaka-sonrası matrisleri eksik olduğundan gerçek N-1 tanısal karşılaştırma hücresi ve sertifikalı fark 0'dır.

## Native SC adaptörü ve yaklaşık hesap

`ElmVac.R1/X1` alanlarının büyük/küçük harf hatası giderildi; fiziksel ohm değeri 99.999 sentinel'iyle karıştırılmaz. Native MAX/MIN `ElmXnet` kA/MVA ve R/X, `ElmSym/TypSym` rstr/xdss makine pu bazları ve paralel adet, `ElmLne/ElmLnesec` kesit R/X/uzunluğu, `ElmTr2/TypTr2` anma bazları ve çözümlenmiş tap kontrol edilir. Kaynak tipi/FID, birim, dönüşüm ve varsayım audit içinde tutulur. Girişler yalnız native DGS veya açık kullanıcı varsayımıdır; PF workbook çözülmüş Ikss/Skss kullanılmaz.

Full Size Converter `Ikss3PF` native kA girdisi ideal akım kaynağı olarak KLU çözümüne süperpoze edilir; pasif empedansa dönüştürülmez. Bu yol açık akım açısı ve bağlı-terminal baz varsayımı gerektirir; native `ngnum=1` doğrulanır. Başka paralel adet belirsiz katkı olarak kalır. MIN konverter dışlama politikası kaynak referansında ayrıca kayıtlıdır. Yalnız akım kaynağı bulunan, gerilim eşdeğeri olmayan bileşen de BLOCKED kalır.

| Ölçüm | SN3 | SN4 |
|---|---:|---:|
| Seçilen fiziksel fault (400/154/34,5 kV) | 3 | 3 |
| Varsayımsız native yol: hesap / BLOCKED | 0 / 3 | 0 / 3 |
| Açık yaklaşım MAX: hesap / BLOCKED | 3 / 0 | 3 / 0 |
| Açık yaklaşım MIN: hesap / BLOCKED | 3 / 0 | 3 / 0 |
| Açık kaynak varsayımlarıyla hazır aktif kaynak | 1.974 | 1.953 |
| Eksik makine R/X varsayımı gereken kaynak | 393 | 391 |
| Native dal adaptöründe geçersiz dal | 0 | 0 |
| MAX en büyük doğrusal residual | 5,962e-13 | 6,474e-13 |
| PF Ikss/Skss tanısal / sertifikalı hücre | 0 / 0 | 0 / 0 |

Pilotun açık varsayımları: dış kaynak `c_source=1,1`; MAX fault `c=1,1`, MIN fault `c=1`; konverter akımı bağlı terminal bazında ve açı −90°; farklı nominal gerilimle birleştirilmiş baralarda canonical baz normalizasyonu; yalnız eksik makinelerde native anma bazında `r=0,01 pu`, `xdss=0,2 pu`. Bunlar kullanıcı tarafından açılan ayrı NETWORK_APPROXIMATION yolundadır, varsayımsız yolun sessiz varsayılanı değildir. Sonuçlar **CALCULATED_NETWORK_APPROXIMATION**; IEC edisyonu null, Ip/Ib/Ith null ve dengesiz arızalar BLOCKED kalır.

Kaynak dayanakları: yerel PowerFactory 2024 AC Voltage Source §2 (basılı s.2), Synchronous Machine §3.2 (s.15), Static Generator §4.1.5 (s.21) metin ve sayfa görüntüsüyle incelendi. Native makine modeli altgeçici r+jx; konverter girdisi kA akımıdır. [DIgSILENT konverter FAQ](https://www.digsilent.de/index.php/en/faq-reader-powerfactory/why-is-the-short-circuit-current-not-changing-after-a-large-impedance.html) ideal akım kaynağı yaklaşımını destekler. Bu kaynaklar IEC edisyonu/KG/KT/KKW veya PF paritesini doğrulamaz.

PF karşılaştırması aynı fiziksel fault, tam elektriksel partition, nominal kV, MAX/MIN, 3PH ve Rf/Xf koşullarını zorunlu tutar. Bu üç gerçek fault için partition koşulları tamamlanmadığından MAE/P95/maksimum hata **NOT_MEASURED**; ham sayı benzerliğiyle fark üretilmedi. UI'da YTM/gerilim tanısal istatistikleri, ayrı EXPLORATORY_DELTA haritası, eksik için gri/null ve export korunur. MIN sonucu MAX PF tablosuyla eşleştirilemez.

## LF ve korunan motorlar

Baz Full AC sayısal sonuçlarının zaman alanları çıkarılmış özel yerel digest'i önceki sonuçla birebir eşittir. SN3: 4.077 bara, 12 iterasyon, mismatch 1,0294e-6 MW; SN4: 4.088 bara, 11 iterasyon, mismatch 5,3386e-6 MW. Motor, eski DC, DGS importer ve istasyon kontrolü değiştirilmedi.

LF native `ElmGenstat`→`ElmGenStat` sınıf alias'ı yalnız gerçek native FID üyeliği kanıtıyla kabul edildi. Tanısal hücreler 62.369→65.015 ve 62.427→65.011; sertifikalı fark hâlâ 0. DC/Hızlı AC ekranları gerçek yöntemi gösterir; NR/Newton etiketleri yalnız Full AC'ye aittir.

Düşük PF gerilim, >1.400 yüzde puan trafo yüklenme farkı ve büyük trafo/jeneratör Q farkı için native FID, nominal baz, type anma, çözümlenmiş tap, phase kaynak eksikliği, istasyon kontrol üyeliği ve ham ComLdf seçenekleri yerelde denetlendi. Düşük gerilimli terminallerin kaynak nominal bazları mevcut; büyük yüklenme farkındaki trafo için kaynak MVA ve tap çözülüyor. Kontrol/partition/yüklenme yöntemi eşdeğerliği kanıtlanmadı. Solver ayarı veya PF sonucuna uydurma yapılmadı; anomaliler çözülmüş sayılmıyor.

## Doğrulama ve teslim

Yedi yeni hedefli test; mevcut katalog, hibrit, SC karşılaştırma ve browser smoke genişletildi. Son kontrol sonucu teslim commit'inde güncellenir. Standalone portable HTML: `dist-portable/GridAnalyzer_v7.html`.

## Kalan kritik engeller

1. Eksik native makine xdss ve konverter akım baz/açı/ünite-trafo semantiği; açık varsayımlı sayılar IEC doğrulaması değildir.
2. IEC edisyonu, c_source/fault c ve KG/KT/KKW için normatif kanıt; Ip/Ib/Ith ve dengesiz dizi/topraklama girdileri eksik.
3. PF N-1 tam post-case P/Q/S/I/V tabloları ve doğrulanmış vaka/rating koşulları eksik.
4. Gerçek SC fault partition uyumu ölçülen noktalarda tamamlanmadı; PF hata istatistiği ölçülemedi.
5. LF istasyon kontrolü/phase/ComLdf semantiği ve gerilim-yüklenme-Q anomalileri çözülmedi; büyük gerçek modelde tüm katalog performansı doğrulanmadı.
