# Kök neden, yeni sayfa modeli ve ölçümler

Kaynak graph, sayfa graph ve port/cihaz geometrisi ayrıldı. Önceki lane=200/blockWidth=2980, uzun katman ilerlemesi, bypass'ı kısa yol sayan BFS ve sınıflanamayanları sağ kuyrukta toplama kaldırıldı. Yeni lane=76, 380 yüksekliğinde ayrıntı blokları; genel bakışta çerçeveli gerilim panelleri ve tüm fider işaretleri vardır. Özet A/B ayıracı elektriksel bara değildir. Kaynak terminal/FID'leri birleştirilmez.

Native zincir rank'i gerçek ekipman uçlarından kurulur. Sabit native terminal konumları, cihaz gövdeleri ve bara gövdeleri korunur. 0/1/2/3 dönüşlü ortogonal adaylar engel/kesişim/koridor/uzunluk maliyetiyle seçilir. Dar kontak koridorunda visibility/A* fallback daha çok dönüşe izin verir. Tel bir başka glyph'in içinden geçtiğinde adaptive yeniden rota yapılır. Source graph başına ve gerilim/compact/focus anahtarına göre geometri cache'i vardır; LF/N1/SC sayısal sonuç ve kimlik cache'lenmez. Kesişim puanı aynı strict kuralla, bir defalık hazırlanmış segmentlerden hesaplanır.

| TM | Fider işaretleri | Native anahtar | Sınıflanamayan | Gerçek oto |
|---|---:|---:|---:|---:|
| M1583 | 22 | 75 | 0 | 0 |
| M1301 | 19 | 50 | 3 | 0 |
| M56 | 69 | 276 | 19 | 2 |
| M38 | 35 | 124 | 11 | 4 |
| M1555 | 8 | 21 | 1 | 0 |

| TM | BASE genel P50/P95/max CSS px | MAIN genel P50/P95/max | Aday tüm fiziksel genel P50/P95/max | Aynı native fider Aday P50/P95/max |
|---|---|---|---|---|
| M1583 | 42.4/87.7/1106.2 | 8.9/28.6/1227.1 | 6.8/31.8/384.0 | 36.8/289.6/289.6 |
| M1301 | 13.3/927.4/1492.4 | 8.9/97.5/869.5 | 10.3/38.3/233.7 | 35.9/283.1/283.1 |
| M56 | 4.0/43.5/1201.4 | 3.6/10.4/1384.1 | 7.5/37.0/194.5 | 36.8/289.6/289.6 |
| M38 | 26.0/802.6/852.2 | 5.4/58.3/755.5 | 9.1/49.4/189.1 | 35.9/283.1/283.1 |
| M1555 | 53.9/419.1/474.0 | 9.6/116.1/347.7 | 14.0/52.1/317.7 | 36.8/289.6/289.6 |

Tablo aynı viewport/B0/model verisindedir. BASE=c8ee28b, MAIN=eae8c08; her referansın kendi default fit'i ölçüldü. CSS px tek başına iyileşme ölçütü değildir: çok küçültülen eski şeklin tel P95'i küçük ama yazısı okunamaz olabilir. Aday overview'de fiziksel tel yoktur; bu sıfır, tel kısalması yüzdesi olarak sunulmaz. Aday tüm fiziksel ayrıntı ve aynı kaynak fider odakları ayrı karşılaştırılır. Regional mini-bağlantı çizgileri ayrı listedir; native cihaz lead P95'i ile karıştırılmaz.

Uzun native lead inceleme eşiği 400 world px; istasyonlar arası gerilim koridoru/blok devamı istisnası kayıtlıdır. CSS maksimumları viewBox/BCR ölçeğiyle hesaplanır. Native focus ve tüm istasyon source-audit: başka glyph gövdesini kesen tel 0. Aday SVG DOM gerçek glyph BCR + path segmentleri: 0 glyph overlap, 0 wire/glyph intersection (bara çizgileri dahil). Eski sürümlerde data-device-glyph yoktur; boş eski overlap listesi PASS kanıtı sayılmaz.

Genel bakış minimum yazı CSS px:

| TM | 1366×768 | 1440×900 | 1920×1080 | 390×900 |
|---|---:|---:|---:|---:|
| M1583 | 8.26 | 8.46 | 9.00 | 8.41 |
| M1301 | 8.26 | 8.46 | 9.00 | 8.41 |
| M56 | 6.01 | 8.30 | 8.50 | 6.01 |
| M38 | 6.65 | 7.98 | 8.24 | 7.27 |
| M1555 | 8.26 | 8.46 | 9.00 | 8.41 |

M56 mobilde tüm 69 işaret görünürken küçük FID özeti yaklaşık 6 px olabilir; tam ad veya her cihaza dokunulabilir büyüklük iddiası yoktur. Fider seçicisinden odağa geçmek, zoom ve tooltip gerekir. Yoğun tüm fiziksel istasyon default fit'i de okunabilir ayrıntı iddiası taşımaz. Yeni default overview daha büyük etiketlidir; ayrıntı bir fiderde açılır. İlk tüm fiziksel M56 rota üretimi ağırdır; mod değişimleri cached geometriyi tekrar kullanır. Bu performans sınırı P1 olarak korunur.

Sınıflanamayan 34 fider panelin kendi N satırlarında yer alır; sınırsız sağ kuyruk yoktur. FID/gerilim/slot/konum/bbox private source-audit-private.json ve CANDIDATE-layout_metrics.json içinde kayıtlıdır. M1301=3, M56=19, M38=11, KALE=1, Hotamış=0. Varsayımlı tür sınıflandırmasıyla sıfıra indirilmez.
