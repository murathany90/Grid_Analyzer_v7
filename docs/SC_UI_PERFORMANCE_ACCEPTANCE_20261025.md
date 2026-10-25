# 3F masaüstü UI ve performans kabulü — 25.10.2026

**Karar: MERGE_CANDIDATE — işlevsel PASS. PF 3F sayısal paritesi: NOT_VERIFIED.**

Branch `feature/sc-pf-parity-ui`; başlangıç `cb0ee5f04b7cea9ed85d342823578597f5251aab`.
Test edilen uygulama/HTML commit'i `da40f68edbe3d1b6c45415e3456c5958eca3ddc2`. Son dokümantasyon HEAD'i teslim mesajında ve Git'te bulunur.

## Değişiklik ve veri sınırı

- LF P/Q/Yük başlıkları ve sayıları sağa hizalandı; iki kolonlu GA/PF/Δ düzeni kullanılıyor. PF yoksa tek GA satırı gösterilir. Mevcut sayısal işaretler, birimler ve export değerleri korunur. Kontrol kapsamı ile NR yakınsamasının farklı olduğu açıklanır.
- Harita, ⚡ ve Analizler aynı `ctx.filters` YTM/TM/gerilim kapsamını kullanır. Tümü / 400 / 220 / 154 / 66 / ≤36 kV grupları ortak mevcut operasyonel sınıflandırmadan gelir. Ham nominal kV değişmez. Kapsam seçimi hesap kaydını silmez; hesap ayarı değişikliği eski kimlik denetimini korur.
- Aynı elektriksel düğümün, aynı nominal kV ve görünür TM kapsamındaki native `iUsage=0` alias'ı deterministik görüntüleme temsilcisidir. Kaynak/hesap FID'si değişmez; görüntüleme FID'si ayrıca saklanır ve export edilir. Fiziksel bara kanıtı yoksa mevcut fider/yardımcı/belirsiz sınıf korunur. Varsayılan filtre fiziksel baralardır; tüm düğümler seçilebilir.
- Sincan **7 → 7** bağımsız düğüm olarak kaldı: 154 B-1A, 154 B-1B, 400 B-1, TR-6, TR-A, TR-B, TR-C. Ad değişimi alias kanıtından gelir; akımlar birleştirilmez.
- ⚡ kapsam satırında YTM, TM, GA/PF, MAX/MIN, gerilim ve kayıt sayısı görünür. %125'te bu satırın kesilmesini önlemek için yer ayrıldı; tablo ve sayfalama panel içinde kalır.
- Pointermove/wheel çizimleri tek rAF kuyruğunda birleştirilir. Model/geometri, görünür ekipman, LF gösterim projeksiyonu, SC satırları ve değişmeyen tablo DOM'u yeniden kullanılır. Model/array referansı, sonuç/kimlik, kaynak context'i, senaryo, kapsam, kapasite, mod, ekran ve seçim değişiklikleri ilgili cache'i geçersiz kılar. Ekran yolları değişince akış uzunlukları birlikte yenilenir.
- PF referans görüntülemesi GA hesabı veya LF parite preflight'ını çalıştırmaz. Ortak hücre parser'ı, 3PH/MAX/rf=xf=0, tekil FID/kV, geçerli/sentinel olmayan değer ve kaynak hücresi kuralları korunur. Bu yol yalnız **NOT_COMPARABLE / PF_REFERENCE_ONLY** üretir; karşılaştırma izni vermez.

`src/analysis/`, `src/importers/`, `package.json` ve lock dosyalarında bu tur değişiklik yoktur. 3F motoru, fiziksel katsayılar ve PF kaynak dosyaları değiştirilmedi; yeni bağımlılık eklenmedi. 1F geri getirilmedi.

## Gerçek model ve ölçüm yöntemi

Gerçek SN4: `20261008_1000_SN4_TR0`, **1.619 TM**. Native JSON SHA-256:
`c738a80b957a540d98e940b0cc910acf195c79495a3f33d252c17dc0461b119f`.

Daha önce doğrulanmış gerçek MAX/MIN kayıtları ve gerçek referans paketi uygulamanın mevcut veri yollarına yüklenmiştir. Ülke modeli kısa devre hesabı yeniden çalıştırılmamıştır. Her moddaki 505 kayıt ve tüm fiziksel alias'lar korunmuştur. MAX+MIN kayıtlarının önce/sonra digest'i birebir:
`ed9aa3088d64ff945a21e35445a63ef7e8070831f0602e31a522927e15ea68c7`.

Windows Chromium **153.0.8010.12**, Chrome DevTools Protocol trace / Performance metrics, PerformanceObserver measure ve Long Tasks kullanıldı. Pan testi 12 burst × 12 pointermove, zoom testi 8 wheel olayıdır; gecikme iki rAF sonuna kadar ölçülür. Bunlar kontrollü etkileşim ölçümleridir, genel FPS sertifikası değildir. İlk veri yükleme ayrı tutulur. Pan/zoom izi önce ve renderer düzeltmesinden sonra kaydedildi; ölçümün bulduğu PF geçiş sorunu ayrıca hedefli ölçüldü.

| Ölçüm | Önce | Sonra |
|---|---:|---:|
| SC öncesi pan p95 | 353,4 ms | 48,8 ms |
| SC sonrası pan p95 | 254,8 ms | 41,2 ms |
| SC sonrası zoom p95 | 32,7 ms | 36,0 ms |
| SC sonrası `map.paint` p95 | 13,0 ms | 19,0 ms |
| Aynı hareket dizisinde tam çizim | 152 | 20 |
| SC sonrası pan/zoom Long Tasks | 12 / toplam 1.284 ms | 0 / 0 ms |
| İlk SC `map.project` | 6.415,5 ms | 654,1 ms |
| İlk PF kaynak geçişi | 4.212,8 ms | 185,8 ms |

Warm pan/zoom sırasında `map.project` yeniden hesaplanmadı. Çizim başına p95 tek başına her durumda düşmemiştir; ana kazanım olayların birleştirilmesi ve tekrarların kaldırılmasıdır. SC öncesi/sonrası farklı renkli TM sayıları varsayılan fiziksel bara filtresinden kaynaklanır: tüm düğümlerde 505 kayıt/186 TM, fiziksel filtrede 471 kayıt/179 TM. Bu bir sayısal sonuç değişimi değildir.

Son ayrı kontrol ölçümleri: panel kapat/aç 29,2/29,6 ms; MIN/MAX 376,7/393,4 ms; PF/GA 185,8/167,8 ms; ≤36/Tümü 102,9/190,0 ms; YTM değiştir/geri dön 67,7/371,0 ms. Bu kontrol dizisinde **8 Long Task, maksimum 366 ms** kaldı; tüm UI için sıfır Long Task iddia edilmez. SC sonrası örnek JS heap 795.708.736 → 507.014.944 byte; son kontrol dizisinde 394.001.544 → 453.503.016 byte gözlendi. GC etkileri nedeniyle bunlar kalıcı bellek tüketimi veya sızıntısızlık garantisi değildir.

## Kabul kanıtı

- Hedefli unit/regresyon: **79/79 PASS**, 0 fail, 0 skip. LF/N-1/SLD, 3F analitik MAX/MIN, kaynak/kimlik/kapsam cache geçersizliği, alias ayrımı ve 1F yokluğu dahildir.
- TypeScript ve mimari lint: **PASS** (476 kaynak dosyası).
- Tek hedefli Chromium kabul aracı fazlar halinde tamamlandı: gerçek modelde 11 farklı kapsam/mod/kaynak durumu; harita/⚡/Analizler kayıt ve FID/akım eşliği; PF tooltip kaynak hücresi; Sincan 7 düğüm; native kaynak işçisiyle SLD; geçerli kapsamındaki bir kayıtlı N-1 vakası; MAX/MIN IndexedDB 505/505 kayıt.
- Gerçek modelde MAX ve MIN için **6 CSV/XLSX/JSON dosyası × 505 kayıt** okunup FID, görüntüleme FID'si, elektriksel ID, nominal kV ve ham akım üzerinden doğrulandı. PF kaynağındaki 386 referans grubu GA'nın 505 düğümüyle aynı parite evreni sayılmaz.
- 1366×768, 1920×1080 ve %125 CSS yakınlaştırmada document genişliği viewport'u aşmadı. ⚡ kapsam satırında scrollHeight=clientHeight=28; sayfalama panel içinde. LF'nin üç sayısal kolonu %125'te görünür. Mobil/tablet çalıştırılmadı.
- 10 değişmeyen `notify()` çağrısı **0 yeni harita çizimi** üretti ve aynı SC satır DOM'u korundu.
- Son portable gerçek `file://` üzerinden açıldı, mini native fixture ile gerçek worker MAX/MIN çalıştı; dış HTTP isteği ve tarayıcı hatası **0**.

Genel eski E2E ve tam regresyon paketi yeniden çalıştırılmadı. Kabul düzeneğindeki kaynak yükleme, seçici, responsive bekleme ve Windows dosya izleyicisi sorunları giderilip kayıtlı kanıttan devam edildi; başarısız ara koşular PASS sayılmadı. Mevcut sayısal benchmark tekrarlanmadı. Son gerekli kontrollerde açık başarısızlık yoktur.

## Görseller, trace ve teslim

Özel model, referans, indirme, görüntü ve trace dosyaları Git'e eklenmemiştir. Yerel kanıt kökü `local-benchmark-results/sc-ui-performance/`:

- Önce/sonra LF: `before/LF-1366.png`, `after/LF-1366.png`; 1920 ve %125 sonrası görüntüler de vardır.
- Önce/sonra SC: `before/SC-1366-1.25.png`, `after/SC-1366-1.25.png`; `after/SINCAN-1366.png`.
- Gerçek Chrome izleri: `before/chrome-trace-private.json`, `after/chrome-trace-private.json`.
- Ham ölçüm/kabul: `before/proof-private.json`, `after/proof-private.json`; son geçişler `sc-ui-controls-final.log`; son portable `sc-ui-screens-final.log`.

Portable `dist-portable/GridAnalyzer_v7.html`: **2.051.809 byte**.
SHA-256: `52f55be7dfed756d58a02b5ab15161eeffb37a3ac25f12c12859aabc7e05a8e4`.
Disk dosyası ile commit edilmiş Git blob'u ham byte olarak eşittir. Son push/uzak HEAD ve tracked ağaç kontrolü teslim mesajı ile yerel `sc-ui-delivery-final.json` kaydında verilir. Önceden var olan kullanıcı untracked dosyaları korunur.

Kalan sınır: PF 3F/IEC sayısal paritesi doğrulanmadı; önceki sapma bulguları geçerlidir. Soğuk filtre/mod dönüşümleri birkaç yüz ms sürebilir. Uzun süreli bellek sızıntısı veya her donanım/Chrome sürümünde performans garantisi bu kabulün kapsamında değildir. Uygulama sertifikalı IEC 60909 çözümü olarak sunulmaz.
