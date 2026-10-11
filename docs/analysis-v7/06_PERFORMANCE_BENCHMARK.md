# Performans ve ölçüm koşulları

Yeni gerçek SN3 portable kabulü bir soğuk model importu ve bir PF referans importu içerir. İki seçili native N-1 vakası ve sınırlı SC hedefleri hesaplandı; 660 vakanın tam AC taraması veya 6.278 hedefin tamamında fault çözümü yapılmadı. STRICT ön kontrol mevcut gerçek B0 LF'yi tekrar kullanır. Browser worker gerçek engine cevapları gözlenmiştir; sahte worker sayısalları gerçek kabul değildir.

| Ölçüm | Süre / işlem sayısı |
| --- | --- |
| Model UI import duvar saati | 7.694 s (worker 4.485 s) |
| PF UI import duvar saati | 20.326 s (worker 19.557 s) |
| B0 LF engine | 2.936 s |
| B0 LF worker cevap | 7.768 s |
| B0 LF UI + bağımsız PF preflight | 18.285 s |
| Mevcut gerçek LF ile STRICT ön kontrol | .279 s; 0 POST |
| OA N-1 kataloğu | .491 s; 660 hedef |
| Native PARTIAL hibrit B0 + DC + 2 POST + UI | 46.670 s |
| İki N-1 POST engine | 3.024 s / 2.740 s |
| OA SC katalog UI | 2.763 s; 6.278 fiziksel / 500 elektriksel |
| Native 3 fault bloke UI | 2.932 s; 0 RHS |
| SC tanısal ilk batch UI / engine | 6.608 s / 1.345 s; 4 fiziksel / 3 RHS / 1 factor |
| Sonraki fiziksel alias batch UI | 1.854 s; toplam 5 fiziksel / 3 RHS / 1 factor / 2 reuse |
| IEC preflight UI | 2.999 s; 0 RHS/factor |
| Gözlenen ana browser JS heap maksimumu | 745,919,760 byte (yaklaşık 711 MiB) |
| Son portable | 1,676,464 byte; tek HTML |

Heap ölçümü precise-memory-info Chromium ana sayfasındandır; toplam işletim sistemi/worker belleği veya taşınabilir bellek garantisi değildir. Engine süresi, serialization/worker cevap süresi ve UI duvar saati ayrı ölçümlerdir. Sonraki UI istatistik commit'inin gerçek ağ duvar saati yeniden ölçülmedi.

Eski heterogeneous LF worker ölçümleri n=5, medyan 9.463 s ve P95 10.028 s; eski tek engine B0 2.981 s idi. Donanım/koşullar ve örnek sayısı eşitlenmediği için hız artışı/regresyon oranı iddia edilmez. Doğrulanan iyileştirme işlem sayısıdır: aynı elektriksel partition'ın farklı fiziksel aliasları Zkk RHS'ini tekrar çözmez; Rf/Xf değişimi cached Zkk üzerinden akımı yeniden hesaplar. Kaynak/model/senaryo değişimi hazırlığı geçersiz kılar. KLU leased factor temizliği ve iptal koruması korunur.

Ortak tabloda DOM en çok 50 satır; katalog ve hesaplanan sayılar ayrıdır. Büyük sonuçlar sayfalı gösterilir, karşılaştırma tanısal grafiklerinde mevcut 1000 nokta örnekleme sınırı korunur. Gerçek çalışma 5 özel ekran görüntüsü içerir; sentetik UI dört masaüstü boyutu ve mobilde ayrı denetlenir.

