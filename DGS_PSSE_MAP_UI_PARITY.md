# V5 — DGS / PSS/E harita ve sonuç arayüzü

PSS/E arayüzü ayrı dosyalar ve bağımsız bus-branch modeliyle korunmuştur. DGS `src/map` ve `src/features/sld` kaynakları değiştirilmemiştir. Mevcut DGS renk ve sunum yardımcıları yeniden kullanılır.

- İki kompakt araç satırı: YTM, gerilim, hat yerleşimi/Baz-Senaryo-Fark menüsü, analiz, kaynak ve senaryo; ikinci satır metrik, akış, TM, etiket, sade güzergâh, arama, sonuç, yenile, tek Sığdır ve tam ekran. TM/BM/servis/eşleşme ayrıntıları filtre menüsündedir.
- Beş gerilim bandı ve DGS paleti; küçük TM noktaları, ince hatlar, seyrek akış okları, sol altta metrik lejantı ve sağ altta yüzen ⚡. Animasyon isteğe bağlı ve reduced-motion uyumludur. Harita altı sonuç tablosu yoktur.
- P/Q/I/kayıp/yükleme dal geometrisinde; Vm/Va/gerilim ihlali gerçek bara noktalarında gösterilir. Yalnız uygun gerçek sonuç olan metrikler açılır. SOURCE_SAVED katmanında dal akışı üretilmez. Baz ve senaryo kimliği uygun değilse fark gösterilmez.
- ⚡ ve Analizler aynı ayrı Hatlar/Trafolar/Baralar sunumunu kullanır. Gerçek adlar öndedir; teknik kimlikler tooltip ve dışa aktarma provenance alanlarında kalır. 3 sargılı bir kaynak trafo bir satırdır; sargı ayrıntıları aynı satırda korunur. 2/3 sargı filtreleri, arama, sıralama ve sayfalama vardır.
- CSV ve XLSX hesap sayılarıyla, uç/sargı ve kaynak kimliğiyle üretilir. Kaynak P/Q yoksa hücreler boştur. SLD gerilim bantlarını ve kaynak adlarını kullanır; kaynakta olmayan ayırıcı/kesici çizilmez.
- Canvas Türkiye altlığı ve SVG için aynı dünya→ekran dönüşümü kullanılır. Tekerlek odağı, sürükleme, resize, DPR ve fullscreen davranışı gerçek Chrome/Edge file:// kabul aracıyla ölçülür.

Tarayıcı sonuçlarının durumu, test edilen HTML SHA-256 ve ölçümler [Chrome kanıtında](evidence/psse-v5/browser-e2e-chrome.json) ve [Edge kanıtında](evidence/psse-v5/browser-e2e-msedge.json) bulunur. Başarısız/eksik deneme başarılı sayılmaz. Gerçek 1600×1000 ve 1366×768 DGS/PSS/E karşılaştırma PNG'leri yalnız yerel özel kanıt dizininde tutulur.

Son **2.617.997 bayt** HTML, SHA-256 `f2251cd05ed55260365632a5030266f99c7607d64b10077a74d32ad01424fcc0`, Chrome 156.0.8078.48 ve Edge 156.0.4314.50 üzerinde PASS almıştır. Canvas/SVG sınır farkı 0 CSS px, kaynak nokta/altlık dönüşüm farkı en fazla 0,000030 CSS px, tekerlek odağı sınır kutusu farkı 0,128 CSS px'dir. DPR 1/1,25/2, iki çözünürlük, resize, sürükleme, Sığdır ve üç fullscreen denemesi geçmiştir. Gerçek modelde 3 sargılı trafo bulunmadığından bir kaynak trafo/üç sargı kabulü özgün küçük örnekle ayrıca çalıştırılmıştır. CSV/XLSX kaynak sınıfı, yöntem, sayısal/yayımlama durumu ve fizik kapsamını açık metadata olarak taşır; DC Vm başlığı çözülmediğini belirtir.

Görsel yakınlık, ayrı kaynak veri modellerinin aynı eleman sayısına veya aynı elektrik hesabına dönüşmesi anlamına gelmez. Kaynak yan dosyaları Şebeke Modeli envanterinde kalır; koordinat eşleştirme/provenance raporları Kalite/Gelişmiş altındadır. Tam elektriksel kabul sınırları [AC raporunda](PSSE_FULL_AC_REFERENCE_PARITY.md) açıklanır.
