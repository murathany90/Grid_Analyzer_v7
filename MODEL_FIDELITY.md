# V5 — model ve sonuç sadakati

Native SAV/RAW/RAWX decoder ve DGS node-breaker modeli bu oturumda değiştirilmemiştir. Özgün kaynak, normalize bus-branch ağ ve senaryo operasyonları ayrı kalır. Senaryo çözümü kaynak ağı değiştirmeyen kopyada çalışır. Yan dosya envanteri ve koordinat kökeni korunur.

`SOURCE_SAVED`, `GA_PSSE_CALCULATED`, `PSSE_REFERENCE` ayrı kökenlerdir. Kaynakta kayıtlı bara Vm/Va, GA hesabı olarak sunulmaz. Kayıtlı kaynak dal P/Q'su yoksa akış hücresi/oku oluşturulmaz. Yakınsamayan çözüm NOT_CONVERGED kalır; uyumsuz baz/senaryo için ΔP/ΔQ/ΔVm/ΔYük yayımlanmaz.

Yeni NR profilinde IREG hedefi ayrı kontrol denklemi, santral toplam Q'su ayrı bilinmeyendir. RMPCT santral başına sayılır; aynı santraldeki makineler aktif üretim oranında, sınırlar ve yeniden dağıtım ile paylaşır. Aktif radyal Q(V), bağlantı noktasındaki reaktif gücü ve kaynak eğrisini kullanır. Eşit gerilimli ideal bağlantı daraltması ve kaynak düğümlerine KCL geri açılımı korunur. Desteklenmeyen veya çelişen kontroller saklanmaz; uyarı/engel üretilir.

Hesap motor kimliği `GA_PSSE_ENGINE_4` olmuştur. Yeni algoritma/kontrol revizyonu ve seçenek hash'i eski sonuçların yeni denklemlerle geçerli sayılmasını engeller. FDNS ve DC yöntemleri bağımsız motorlarını kullanmayı sürdürür; yeni IREG seçeneği yalnız NR'dadır. Önceki yaklaşık NR profili varsayılan olarak korunur.

Tam parite tamamlanmamıştır: ikinci büyük model +%10 yük durumunda dal Q P95 %1,4038; kaynak WMOD=4 davranış farkı ve tüm kontrol kapsamı açıktır. Bu profil için SOLVED_FULL engellidir. Büyük modellerde aktif atanmış droop görülmemesi, küçük radyal örneklerin büyük-model droop kanıtı sayılmasını engeller.

Karma sabit Q / düzenleyen makine içeren küçük santral örneğinde lisanslı API dökümünün kendi makine Q ve dal uçları da fiziksel KCL ile tutarlı değildir. Bu örnek başarıya çevrilmemiştir; 14 küçük örnekte 13 eşleşme ve bir açık uyumsuzluk ayrı raporlanır. Kaynak değerini değiştiren bir uyarlama veya referansa yapay düzeltme eklenmemiştir.

Özel SAV/RAW, lisanslı belgeler, Siemens ikilileri, ham API referansları ve gerçek şebeke ekranları Git/ZIP dışında kalır. Offline teslim yalnız uygulama HTML'i, lisans bildirimleri, bu raporlar ve anonim toplu kanıtlar içerir. [AC kabul ayrıntıları](PSSE_FULL_AC_REFERENCE_PARITY.md) ve [UI kapsamı](DGS_PSSE_MAP_UI_PARITY.md) ayrı raporlanır.
