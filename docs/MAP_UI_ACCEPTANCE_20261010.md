# Harita ve ortak arayüz kabulü — 10 Ekim 2026

Uygulama dalı: `fix/map-restore-flow-two-row-toolbar-lightning-20261010`.
Başlangıç ve korunan `main`: `3e20615131f4c419dda80ee1df1a02c2bfcb313f`.
Kod ve portable kabul commit'i: `fe0daac7790df9c8ad2d91b6f0c74031547d4e60`.
Bu raporun eklendiği commit yalnız dokümantasyon içerir; kod ve kabul edilen portable değişmez.

[![Dal CI sonucu](https://github.com/murathany90/Grid_Analyzer_v7/actions/workflows/ci.yml/badge.svg?branch=fix%2Fmap-restore-flow-two-row-toolbar-lightning-20261010)](https://github.com/murathany90/Grid_Analyzer_v7/actions/workflows/ci.yml?query=branch%3Afix%2Fmap-restore-flow-two-row-toolbar-lightning-20261010)

## Değişiklikler

- Harita araçları iki sabit, eşit yükseklikte satıra yerleştirildi. YTM, gerilimler, hat yerleşimi, analiz, kaynak ve senaryo birinci satırda; metrik, koşullu vaka/fault, Akış, TM, Etiketler, arama, sonuç/hesap, sığdır ve tam ekran ikinci satırda. Ölçüm ve Hatlar menüleri daha ayrıntılı seçenekleri korur. Haritadaki TM seç dropdown'u ve ayrı Yardım tuşu kaldırıldı; ana Yardım sekmesi ve diğer sayfaların TM filtreleri korunur.
- Tek gerilim menüsü mevcut ortak Set'i kullanır: **400 / 220 / 154 / 66 / ≤36 kV**. ≤36 grubu 33, 34,5 ve 31,5 kV'yi de kapsar. Tümünü seç, Temizle ve seçili grup sayısı çalışır; boş seçim açıkça gösterilir.
- Eksik, geçersiz veya ilgili nesneye uygulanamayan sonuç nominal topolojinin rengini silmez. Bara gerilimi/açısı ve SC değerleri TM/bara noktalarına uygulanır. Gerçek GA LF P/Q görünümünde gerilim renkleri korunur, akış yönü oklarla gösterilir. PF, fark, SC ve N-1 kaynakları GA LF oklarıyla gösterilmez; kapı ve hesap kimliği kontrolleri korunur.
- ⚡ panelinin azami genişliği **640 px**. Dördüncü **Senaryolar** sekmesi mevcut ScenarioStore ve eylemleri kullanır: seçme, adlandırma, dallanma, karşılaştırma referansı, geri al/sıfırla ve manevra günlüğü. Çip paneli açar; ×, ⚡, Escape, dışarı tıklama ve sekme değiştirme kapatır. İkinci sabit senaryo popup'ı yoktur. LF XLSX, arama, sayfalama ve Analizler dışa aktarım geçidi erişilebilir.
- Kullanıcının ek isteği doğrultusunda ayrı bilgi ikonları **bütün arayüzden** kaldırıldı. Etiket/kontrol üzerinde hover veya klavye odağı aynı merkezi Yardım registry açıklamasını gösterir. Beş gerilim grubunun açıklamaları ayrıdır. Tooltip floating, `pointer-events:none`; Escape/blur/çıkış ile kapanır ve yerleşimi itmez. Tıklama kontrolün mevcut eylemini yürütür.
- Diğer sekmelerin alan, buton, toolbar ve tab hizaları ortak yükseklik/aralıklarla düzeltildi. Tam ekran artık toolbar'ı da içerir; **Çık** erişilebilir. ⚡ tuşu açık panelin altında kalmaz.

Başlıca dosyalar: `src/map/{map-view,benchmark-controls,canvas-renderer,layer-policy,lightning-panel}.ts`, `src/ui/components/{voltage-filter,scenario-workspace}.ts`, `src/help/{context-help,registry}.ts`, `src/features/help/registry-view.ts`, `src/app/app-shell.ts`, `src/styles/ui-workspace.css`. Solver, worker, importer ve domain hesap kodunda değişiklik yok; yeni bağımlılık yok.

## Render edilmiş masaüstü kabulü

Aşağıdaki ölçümler **gerçek SN3 modelinde**, aynı portable ve aynı B0 LF hesabıyla Chromium'dan alındı. Her çözünürlükte iki toolbar satırı 34 px; sayfa/toolbar yatay taşması yok. Panel açılması harita yüksekliğini ve sonuç kimliğini değiştirmedi; tooltip görünmesi haritayı itmedi.

| Ekran | Toolbar | Harita yüksekliği | Panel | Yatay taşma |
|---|---:|---:|---:|---|
| 1920×1080 | 2 × 34 px | 797,70 px | 640 px | Yok |
| 1600×900 | 2 × 34 px | 617,70 px | 640 px | Yok |
| 1440×900 | 2 × 34 px | 617,70 px | 640 px | Yok |
| 1366×768 | 2 × 34 px | 485,70 px | 640 px | Yok |

Git'te paylaşılabilen ekran görüntüleri **sentetik smoke şebekesindendir**. Okların görsel kabulü için yalnız bellek içindeki sentetik güzergâhlar uzatıldı; elektriksel fixture ve gerçek SN3 koordinatları değiştirilmedi.

| Paylaşılabilir görüntü | Kanıt |
|---|---|
| [1920×1080](screenshots/map-ui-20261010/1920.png) | İki satır, nominal renkler, P okları |
| [1600×900](screenshots/map-ui-20261010/1600.png) | Aynı erişilebilir araç yerleşimi |
| [1440×900](screenshots/map-ui-20261010/1440.png) | Harita alanı ve filtre hizası |
| [1366×768](screenshots/map-ui-20261010/1366.png) | Dar masaüstünde ana kontrollerin tamamı |
| [640 px sonuç paneli](screenshots/map-ui-20261010/results-640.png) | Tablo, arama, sayfa geçişi, LF XLSX |
| [Panelde senaryolar](screenshots/map-ui-20261010/scenarios-640.png) | Mevcut senaryo kontrolleri, ikinci popup yok |
| [Analizler](screenshots/map-ui-20261010/analysis.png), [Ayarlar](screenshots/map-ui-20261010/settings.png) | Ortak hizalamalar ve ayrı bilgi ikonlarının kaldırılması |

Gerçek SN3 ekran görüntüleri özel model adları/FID içerdiğinden Git'e alınmadı. Yerel çalışma klasöründe: [1920](../local-benchmark-results/map-ui-real-1920.png), [1600](../local-benchmark-results/map-ui-real-1600.png), [1440](../local-benchmark-results/map-ui-real-1440.png), [1366](../local-benchmark-results/map-ui-real-1366.png), [Q uç okları](../local-benchmark-results/map-ui-real-q.png), [LF sonuç paneli](../local-benchmark-results/map-ui-real-results.png), [manevra günlüğü](../local-benchmark-results/map-ui-real-scenario.png). Bu yerel bağlantılar uzak depoda bulunmaz.

## Tek gerçek SN3 kabulü

**PASS:** bir model importu, açıkça uygulanan mevcut LF ControlContext ve **bir B0 Full AC**. B0 yakınsadı; sonuç paneli, filtreler, görünüm değişimi, S1 dallanması, hat manevrası/günlüğü/geri al ve B0'a dönüş yeni hesap başlatmadı. Worker denetimi: `LOAD_MODEL = 1`, `RUN_AC = 1`, N-1/SC solve = 0. B0 hesap kimliği korundu; LF XLSX gerçek mevcut sonuçtan indirildi. Sekme dışında RAF kalmadı; haritada en fazla bir RAF bekliyor.

Gerçek canvas piksel ölçümü: P animasyonunda 200 ms arayla **7264 → 7327** ok pikseli ve farklı konum checksum'ları; nominal kırmızı/mavi **34602 / 41199** piksel. Vpu seçildiğinde **34841 / 40771** kırmızı/mavi piksel kaldı: bara katmanı hatları griye çevirmedi. Q uç okları mevcut hat arama/odak yakınlaştırmasıyla gerçek canvas üzerinde doğrulandı.

Hesaplanmamış N-1 ve SC görünümleri `NOT_RUN` kaldı; sırasıyla `GA_N1_NOT_CALCULATED_OR_STALE` ve `GA_IEC60909_NOT_COMPUTABLE` nedeni gösterildi. Nominal coğrafya ve gerilim renkleri korundu, LF okları bu analizlerde kullanılmadı. PF yöntem/bağlam uyuşmazlığı kapıları mevcut benchmark browser smoke ile ayrıca doğrulandı.

B0 PF karnesinin bütün ortak satırlarında matched/within/coverage/agreement/MAE/p95/maximum önceki kabul ile birebir aynı. Örnek hat kapsamları:

| kV | Metrik | Tolerans içi / eşleşen |
|---:|---|---:|
| 400 | P giriş | 327 / 328 |
| 400 | Q giriş | 251 / 328 |
| 154 | P giriş | 1908 / 1944 |
| 154 | Q giriş | 1781 / 1944 |

## Test ve artifact

- Dört yeni politika testi: renk fallback/null/sıfır/nesne kapsamı, GA P/Q renkleri ve fark katmanı, gerçek LF akış kapıları, anlaşılır metrik etiketleri. İlgili mevcut testlerle hedefli paket **25/25** geçti.
- Typecheck, mimari lint (**246 kaynak dosyası**), Chromium smoke ve PF benchmark browser smoke geçti. Browser smoke ayrıca genel sekmelerde taşma/ikon yokluğunu, gerçek canvas P/Q oklarını, tek RAF, dört ekran, filtreleri, panel kapanması, senaryo/SLD kimliği ve dışa aktarımı denetler.
- Tam unit/regression: **356 başarılı, 0 başarısız, 0 atlanan**. Standart ve portable build başarılı. Commit'ten sonra raw byte testi geçti; deterministik yeniden üretim ve HEAD artifact'i birebir aynı.
- Portable: `dist-portable/GridAnalyzer_v7.html`; SHA-256 **`afc7312b3e4bbb74833515bd666f52c4c6190c9a7b6c2af438f2cea677a55f17`**. Dal CI kapısı ayrıca Linux build'i ile committed bytes eşitliğini kontrol eder; güncel sonucu yukarıdaki CI bağlantısı gösterir.

## Korunan sınırlar

Masaüstü kabulü yapıldı; yeni mobil/tablet geliştirmesi yapılmadı. Q uç oklarının mevcut yakınlaştırma eşiği (zoom ≥1,7) ve 400/154 kV akış kapsamı korunur. Gerçek SN3'te 9 `NO_GEOMETRY` kayıt bildirimi devam eder; koordinat uydurulmadı. Mevcut PF reaktif güç farkları yukarıdaki karnede görünür; hesap motoru/parite araştırması bu UI değişikliğine alınmadı. Yasak araştırma dallarından commit taşınmadı. `main`e merge yapılmadı.
