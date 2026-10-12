# Teçhizat kartları ve navigasyon

Genel, Elektriksel, Sonuçlar, Kaynak ve kalite, İşlemler sekmeleri eklendi. Kanonik büyüklükler, ham DGS/TypTr2 alanları ve sourceRefs ayrı gösterilir. Sonuç kartı görünüm modunun aynı güvenli overlay projeksiyonunu kullanır. Ham katalog alanları seçimde yüklenir; olmayan alan — kalır. Kaynak eksikleri FID/alan gerekçesiyle erişilebilir.

Hat geçişi gerçek from/to terminal sahiplerinden çözülür. Her iki terminalin tekil TM sahibi yoksa veya aynı TM ise isim eşleşmesi yapılmaz. Paralel hat FID'leri ayrı kalır. Hotamış → H5084 → Karapınar M937 → önceki Hotamış gerçek kaynaklarla doğrulandı; karşı uçta aynı hat seçili kalır. Gerilim/analiz/senaryo filtreleri değiştirilmez; ayrı görünüm geçmişi tutulur.

Bara/anahtar/ekipman bağlı fider eylemleri, trafo diğer sargı odağı, harita, envanter ve analiz eylemleri AppContext.select kimliğini korur. Envanter gelen FID/sınıf seçimine odaklanır. N1 seçili vaka analizi ortak sonuç panelinden erişilir. Başlangıç station görünümünde ekipman tıklaması yalnız kartı açar; fider görünümüne geçiş açık bir eylemdir.

Senaryo aç/kapat yerel overlay ve mevcut AppContext.setStatus kullanır. DGS/CanonicalNetwork mutasyonu yoktur. Kaynağa dönüş ve isteğe bağlı Full AC mevcut uygulama komutlarıdır; fiziksel işletme komutu gönderilmez. Değişen senaryo için eski sonuçlar geçersizleşir.
