# Ortak kontak zinciri ve bölgesel görünüm

Bay artık ayrı BFS/self-loop çizicisi kullanmaz. Aynı physicalStationLayout ve buildSwitchDeviceChain; native terminal → fiziksel FROM kontak, TO kontak → native terminal segmentleri kullanılır. Kaynak terminali ile glyph kontağı birleştirilmez. Açık ayırıcı/kesici aralığı tel ile kapatılmaz. Bir FID tek fiziksel glyph; hit hedefi ince telden ayrıdır.

Paketleme sırasında native uçlar ve bara gövdeleri korunan alandır. Taşınan kontaklara seri zincir yeniden bağlanır. Port isimleri/gerilimleri sabit kalır; çizim optimizer'ı kanonik modele yazmaz. Tek cubicle anahtarı yalnız gerçek ekipman lead'ine bağlanır. Çoklu self-loop sırası ancak ayrı doğrulanmış sourceOrder kanıtıyla bağlanabilir; ham iorder kabul edilmez. Kanıt yoksa bağlantısız fiziksel işaret ve SOURCE_ORDER_UNAVAILABLE uyarısı kalır.

Barless GSU için jeneratör/yük/dış kaynak native kökü bulunur; sahte bara eklenmez. Aynı terminaldeki farklı gerçek cihazlar ayrı gövdelere paketlenir. Üç sargı görünümü fiziksel üç kontakla PARTIAL kalır; hesap motoruna 2W olarak çevrilmez.

Regional her paralel FID'yi ayrı path, etiket, hit hedefi ve seçilebilir satır olarak gösterir. Karşı TM düğmesi geçmişe scope/bay kaydı ekler; önceki TM düğmesi geri döner. Sayfa sınırı 12 komşudur; görünür komşuya ait hiçbir paralel FID first+N arkasına saklanmaz. Bu mini bağlantı şeması physical terminal-wire dağılımından ayrı raporlanır.

44 yeni bağımsız test: katalog/slot tablosu, source auto kanıtı, raw iorder reddi, 220 profil sınırı, yoğun genel bakış, paylaşılan bay portları, 0/1/2/3 dönüş ve visibility fallback. Mevcut zincir/filtre/3W testleri korunmuştur. Kamu browser kabulü: 30 açık beyanlı sentetik tip × 3 kapsam × 7 mod = 630 çizim; bağımsız DOM glyph sınırları, paralel FID ve gezinme callback'i.

Geometri modlar arasında source graph/gerilim/compact/focus anahtarıyla tekrar kullanılır. Kaynak graph değişince cache sahibi de değişir. Sonuç numarası, durum, N1/SC yöntemi veya STALE bilgisi geometri cache’ine konmaz.
