# Kart çıktısının reddi ve bağlı tek hat düzeltmesi

2026-10-13. Kullanıcı CANDIDATE-M56-station-ytbs-1440.png çıktısını reddetti. Önceki default overview elektriksel bir şema değildi: fider kartları ve elektriksel olmayan ayraçlar çiziliyor, cihaz kimlikleri yalnız metadata içinde tutuluyordu. CI ve marker sayıları bu yanlış ürün kararını yakalamadı. Önceki overview görsel kabul iddiası geri çekilmiştir.

stationOverviewPage artık connectedStationLayout üretir. Aynı native bölüm FID'lerine ait yatay baralar, terminal düğümleri, FROM/TO kontakları, kesici/ayırıcı sembolleri ve ekipman lead'leri gerçekten çizilir. Kart/divider çizicisi kaldırıldı. Bay ve tam sayfa ortak buildSwitchDeviceChain, gövde paketleme ve ortogonal kontak rotalama işlevlerini kullanır. Gerilimler, kaynak FID'leri, mevcut oto/standart trafo kanıtı ve sourceOrder eksikliği korunur. Uzun OG sayfasında tekrar eden baralar aynı FID'ye ait açık devam referansıdır; farklı bölümler birleştirilmez. Barasız GSU/jeneratör bileşeni gerçek HV ucu altında hizalanır, sahte bara eklenmez.

Etiket yerleştirme gerçek SVG metin ve glyph sınırlarını dünya koordinatlarına dönüştürür. Yazı taşınır; elektriksel terminal veya tel uçları yazıya uydurulmaz. Kaynak anahtarları fiziksel SVG kontağıyla sayılır; metadata sayısı başarı kanıtı olarak kullanılmaz.

| TM | Fider | Fiziksel anahtar | Sayfa, world px | 1440px min yazı | Min anahtar hit yüksekliği |
|---|---:|---:|---|---:|---:|
| M1583 | 22 | 75 | 1440 × 1584 | 8.99px | 33.95px |
| M1301 | 19 | 50 | 1440 × 1396 | 8.99px | 33.95px |
| M56 | 69 | 276 | 1440 × 3624 | 8.99px | 33.95px |
| M38 | 35 | 124 | 1440 × 2614 | 8.99px | 33.95px |
| M1555 | 8 | 21 | 1440 × 1368 | 8.99px | 33.95px |

50 gerçek ekran ölçümünde fiziksel anahtar eksiltmesi 0, glyph overlap 0, başka cihaz gövdesinden geçen tel 0, fider yazısı overlap 0. Bara yolları tel/glyph kontrolüne dahildir. Baralar ve gerilim katmanı lead'leri uzun olabilir; çizgi uzunluğunu küçültmek tek başına kalite kanıtı değildir. Önceki kart/tiny-fit yüzdelik kıyasları güncel çizimin metriği değildir.

Varsayılan sayfa okunabilir genişlikte ve kaydırılabilir açılır. M56'nın 3624px sayfasının bütün yazılarının 900px yüksekliğinde aynı anda okunabildiği iddia edilmez. Sığdır tüm sayfayı küçültür; Okunabilir ölçek geri döndürür. 390px cihazda sayfa doğal genişlikte yatay/dikey kaydırılır, belge yatay taşmaz. Native hit hedefleri yaklaşık 34px ve en küçük metin 9px kalır. 1366px'de min metin 8.52px; teknik terminal kimlikleri daha küçüktür. Tam isimler tooltip/fider odağında korunur.

LF/N1/SC genel sayfası kısa sonuç etiketleri ve tam değerlerin tooltip'lerini kullanır; detay ve ortak sonuç tabloları korunur. Özel kullanıcı renkleri, işletme rengi, senaryo değişim rengi ve STALE kapıları korunur. Sayısal sonuçlar geometri cache'ine alınmaz.

Yeni kanıt: local-benchmark-results/sld-v3-connected-correction/CONNECTED-layout_metrics.json. İnsan görsel kabulü PENDING; eski kart çıktısı REJECTED.
