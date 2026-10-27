# Grid Analyzer · Çevrimdışı PSS/E ve DGS çalışma kitabı

ZIP'i çıkarın ve `index.html` dosyasını Chrome veya Edge'de açın. İnternet, sunucu, Python veya yüklü PSS/E gerekmez. Uygulama `file://` üzerinden çalışır; ağ bağlantısı kapalı CSP kullanır, hesapları yerel Blob worker'larda yürütür ve model dosyasını servise göndermez.

## Model yükleme ve ortak gezinme

Tek model seçicisinden DGS JSON/ZIP veya PSS/E SAV/RAW/RAWX/ZIP yükleyin. ZIP içinde birden fazla desteklenen model varsa açılacak üyeyi açıkça seçin. Başlıkta etkin kaynak **DGS MODU** veya **PSS/E MODU** olarak gösterilir. İki mod aynı **Şebeke Modeli**, **Harita**, **Tek Hat Şeması**, **Analizler**, **Yardım** ve **Ayarlar** gezinme etiketlerini kullanır; her mod kendi veri ve analiz bileşenlerini açar.

PSS/E **Şebeke Modeli** kaydedilmiş kaynak envanterini, kaynak değerlerini, alan birimlerini ve bağlantı topolojisini gösterir. Bunlar hesap sonucu değildir. PSS/E **Harita** ve **Tek Hat Şeması** bara/hat/trafo durumlarını, filtreleri ve seçili hesap sonuçlarını görselleştirir. Paylaşılan tema ve sayı hassasiyeti **Ayarlar**'da; yöntem ve hesap seçenekleri PSS/E **Analizler**'dedir.

## PSS/E çözüm yöntemleri

- **Tam AC · NR_POLAR:** ayrı seyrek polar Newton çözümü, ZIP yükleri, sabit kontrol profili ve seçenek olarak reaktif güç sınırları.
- **FDNS_XB:** bağımsız fast-decoupled XB matrisi ve iterasyonları. NR'ye geri düşmez.
- **Kayıpsız doğrusal DC:** ayrı aktif güç çözümü. Açılar ve aktif güç akışları hesaplanır; Vm, Q, akım ve AC kayıpları üretilmez. PSS/E 36.5 uyumlu kademe profili ve ayrı kademe duyarlı yaklaşım seçenekleri bulunur.

Çözücü toleransı ve AC iterasyon sınırı kullanıcı tarafından ayarlanabilir. Gerilim/termik ihlaller kaynak sınırlarını kullanır; kaynak sınırı bulunmadığında kullanıcıya açık çalışma eşiği olarak işaretlenir. Bir PSS/E senaryosu kaynak modeli veya DGS senaryosunu değiştirmeden cihaz durumunu açıp kapatır.

Sonuç kaynağı ayrı sınıflandırılır: `SOURCE_SAVED`, `GA_PSSE_CALCULATED` ve içe aktarılan salt okunur `PSSE_REFERENCE`. Her GA hesap kimliği kaynak/model, topoloji, senaryo, yöntem, seçenek ve motor sürümünü içerir. CSV ve JSON dışa aktarımları yalnız mevcut hesap durumunu ve kaynak kategorisini açıkça işaretler.

## Hesap kapsamı ve sınırlamalar

Çözücü durumu `CONVERGED` tek başına PSS/E ile tam eşdeğerlik anlamına gelmez. Desteklenmeyen aktif kaynak fiziği çözümü `BLOCKED` yapar; açıkça çözücü dışında bırakılan sınırlı fizik `PARTIAL` olarak raporlanır. Üç yöntemin, seçeneklerin ve karşılaştırmaların ayrıntısı `MODEL_FIDELITY_REPORT.md`, `PSSE_AC_DC_PARITY_REPORT.md` ve `PSSE_SOLVER_RESEARCH.md` içindedir.

- AC çözücüleri PSS/E kaynak THRSHZ'siyle ideal bağlantı olarak sınıflandırılan etkin hatları henüz eş bara grubuna daraltmadığından bu profil **BLOCKED**'dır. Etkin, sıfırdan farklı veya kaynağı bilinmeyen BP/bypass da doğrulanmış bir politika uygulanana kadar bloklanır.
- DC, doğrulanmış sonlu pozitif X ideal bağlantı gruplarını daraltıp uç akışlarını geri kurabilir. Test edilen gerçek şebekede DC çalışır fakat katı PSS/E DCLF rapor yuvarlama karşılaştırma sonucu `DIFFERENCES`'tır; raporda bu farklar sayısal olarak verilir.
- Gerçek modeldeki gerilim-droop ve uzak gerilim kontrolü AC denklem desteği tamamlanmadığından tam büyük model AC parity iddiası yoktur. Bilinmeyen aktif HVDC, FACTS, endüksiyon, kontrol tablosu veya kaynak topolojisi de sessizce varsayılmaz.
- Bilinmeyen fiziksel bara kV değeri boş bırakılır. Bu durumda amper ve akım tabanlı termik değerler kullanılamaz; 3 sargılı iç yıldız düğümüne fiziksel gerilim tabanı atanmaz.

PSS/E kaynak verileri korunur; hesap sonucu olarak yeniden etiketlenmez veya `PSSE_REFERENCE` ile birleştirilmez. Paket hiçbir gerçek SAV/RAW/RAWX model dosyası, lisanslı referans verisi, Siemens DLL/PYD, çalıştırılabilir kod veya tescilli PSS/E belgesi içermez. Kanıt dosyaları sentetik örneklerden ve anonimleştirilmiş toplam karşılaştırmalardan oluşur.

## Pakettekiler

- `index.html`: uygulama, CSS, çalışma kodu ve Blob worker'lar.
- `THIRD_PARTY_LICENSES.txt`: kullanılan açık kaynak bağımlılık lisansları.
- Model sadakati, DGS regresyonu, performans, mimari, araştırma ve parite raporları.
- `evidence/`: kaynak model içermeyen anonimleştirilmiş karşılaştırmalar ve çevrimdışı tarayıcı raporları.
- `source/`: uygulama TypeScript/CSS kaynakları, ilgili testler ve yeniden üretim araçları.
- `git/`: teslim metadata'sı ve paketleme anında mevcutsa commit yamaları.

## Geliştirme

Node.js/npm yalnız kaynak kodu doğrulamak ve dağıtımı üretmek içindir. Tam kaynak checkout'unda `npm ci`, `npm run typecheck`, `npm test`, `node tools/build-psse-web.mjs` ve `node tools/package-psse-web.mjs` komutları kullanılabilir. Yerel PSS/E referans araçları yalnız isteğe bağlı geliştirme karşılaştırmalarıdır; HTML çalışma bağımlılığı değildir.
