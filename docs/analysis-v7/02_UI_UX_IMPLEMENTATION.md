# Analizler UI/UX uygulaması

Mevcut LF, DC, hibrit N-1 ve kısa devre ekranları aynı model/senaryo bağlamında üç sütunlu çalışma alanına yerleştirildi. Sol panel hesap seçeneklerini, orta panel sonuçları, sağ panel sayısal/kaynak/yöntem/PF kanıtını gösterir. LF'nin özet, üretici, topoloji, tanı, kapasite ve eski dışa aktarma sekmeleri korunur; `LF sonuç görünümü` ile ortak tabloya geçilir. Dar ekranda kanıt paneli alta, mobilde paneller tek sütuna iner.

## Ortak tablo

- Ad/FID araması; native YTM, TM ve nominal gerilim filtresi.
- Birincil ve çoklu sıralama; eksik/sonlu olmayan değerler sona, sayısal sıfır normal sıraya alınır.
- Sayfa başına en çok 50 DOM satırı; sütun gizleme ve sırasını değiştirme.
- 0–6 ondalık; A/kA gösterim seçimi hesap değerini veya uygulamanın genel ayarını değiştirmez.
- Filtrelenmiş tüm sayfalardan CSV/XLSX/JSON; dışa aktarma hesap birimlerini ve eski güvenli hücre yazıcılarını kullanır.
- Satır ayrıntısı, harita ve SLD odağı; Enter haritaya geçirir. Harita/SLD seçimi mevcut ortak seçim deposunda kalır.
- N-1 ölçüm ucu seçimi; BASE/POST/fark, Q, yüklenme ve aynı kapasite temelinden fark. Açı, uç akımı/S, açı farkı, kayıp ve tap metrikleri genişletildi.
- SC fiziksel terminal ve elektriksel partition ayrımı, `null`/0 semantiği korunur. Ip/Ib/Ith desteklenmediğinde etkinleştirilmez.

Sağ panelin dört durumu birbirinden bağımsızdır. Sayısal yakınsama kaynak doğrulaması, kontrol doğruluğu, IEC yöntemi veya PF paritesi anlamına gelmez. Türkçe tooltip açıklamaları ve açılır kanıt/günlük JSON'u bulunur. Kanıt yokken SOURCE_VERIFIED/METHOD_VERIFIED üretilmez.

Manuel Full AC doğrulamada varsayılan STRICT kontrol kapısı korunur. Kullanıcı `Aynı ayarlar · eksik kontrol PARTIAL` seçerse aynı LF ayarlarıyla sayısal sonuç tutulur; kontrol eksikliği ve NOT_PF_PARITY açıkça kalır. Hibritte eşdeğer açık profil NATIVE_PARTIAL_CONTROLS'tur.

## Doğrulama

`tools/browser-smoke.mjs` dört masaüstü boyutunda (1366×768, 1440×900, 1600×900, 1920×1080) üç sütun, belge taşması, bağımsız dört kanıt ve 50 satır sınırını kontrol eder. Sütun gösterimi, çoklu sıralama, JSON indirme ve klavye odağı da denetlenir. PF smoke STRICT reddini ve açık PARTIAL kabulünü ayrı test eder. Harita/⚡ denetimi sıfır/eksik sonuç, sticky başlık, sayfalama, uzun tooltip ve batch birleştirmeyi korur.

İlk tarayıcı denemelerinde dar ⚡ panelin tablo yüksekliği ve gizli yinelenen hesap formu bulundu. Panel filtreleri daraltılabilir yapıldı; Analizler ortak tablosunda ikinci hesap formu oluşturulması kaldırıldı. Eski STRICT test beklentisi açık tanısal seçimi denetleyecek şekilde genişletildi; hesap kapısı ve eşikler gevşetilmedi. 1366 px başlıkları tablo içi yatay kaydırmayla okunur tutulur.

Son kabul, gerçek veri ve CI sonuçları `07_FINAL_ACCEPTANCE.md` içinde verilir. Ekran görüntüleri ve gerçek model kanıtları özel/ignored alandadır.
