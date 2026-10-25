# Grid Analyzer — PSS/E Native Web Test

ZIP'i bir klasöre çıkartın ve **index.html** dosyasına çift tıklayın. Chrome veya Edge üzerinde **Dosya seç** ile SAV, RAW, RAWX veya ZIP yükleyin. ZIP'te birden fazla model varsa açılacak kaydı seçin. İnternet, kurulum, Python, PSS/E, localhost veya sunucu gerekmez.

Dört sekme: **Model Özeti**, **Şebeke Envanteri**, **İşletme Verileri**, **Model Kalitesi**. Envanter türünü, aramayı, nominal gerilimi ve kaynak durumunu seçebilir; sütun başlığıyla sıralayabilir, sayfalayabilir, ekipman ayrıntısını açabilir ve modeli JSON olarak indirebilirsiniz. Dosya içeriği bir servise gönderilmez.

**Kullanıcı özel isteği:** Grid Analyzer'ın Şebeke Modeli sayfasına benzer bağımsız arayüz ve gerçek SAV dosyasını tarayıcıda açma işlevi uygulanmıştır. Yerel kontrol klasörünüzdeki `20261014_1200_SN3_TR0.sav` doğrudan seçilebilir. Kaynak modeller dağıtım ZIP'ine eklenmemiştir.

Doğrulanmış SAV profili: **PTI SFL v1, LILL, layout 31**; PSS/E 36.5 örnekleri ve 6.851 baralı gerçek modelle test edilmiştir. RAW/RAWX: 35/36. Başka bir SAV düzeni sessizce tahmin edilmez, açık hata verir.

Gösterilen Vm/Va, P/Q, kademe ve durumlar kaynakta kayıtlıdır veya kanıtı belirtilen kaynak dönüşümüdür. GA tarafından yeniden hesaplanmış sonuç değildir. Tüm yük akışı, kısa devre ve N-1 analizleri **BLOCKED**'dır. **PARTIAL** kapsamı olan model yalnız tanısal kaynak incelemesidir; kalite sekmesindeki eksikleri okuyun. Veri `READY` diye sunulmaz.

Teslim içeriği:

- `index.html`: tüm çalışma kodu, CSS ve worker içindeki tek dosya.
- Üç teknik rapor; `evidence/` doğrulama kanıtları.
- `validation-private/`: yalnız bu yerel teslim için gerçek model ekran görüntüleri ve ayrıntılı karşılaştırma kanıtları.
- `source/`: özgün decoder, ortak arayüz, otomatik testler ve geliştirme araçları.
- `git/`: ayrı commit yamaları ve dal/push bilgisi.
- `THIRD_PARTY_LICENSES.txt`: açık kaynak bağımlılık lisansları. Siemens DLL, PYD veya tescilli kod içermez.

Kaynak geliştirme için GitHub'daki `feature/ga-native-psse-browser-import` dalını alın. Tam GA checkout'unda `npm ci`, `npm run typecheck`, `npm test`, `node tools/build-psse-web.mjs` komutları kullanılır. Node/npm yalnız geliştirme ve yeniden paketleme içindir. `tools/psse-sav-native-oracle.py` isteğe bağlı geliştirme doğrulamasıdır ve kurulu PSS/E'yi referans olarak kullanır; HTML'in çalışma bağımlılığı değildir.

SAV↔RAW kontrol dosyalarında 7 gerçek çalışma noktası/durum farkı korunmuştur. Eski normalize RAW↔RAWX kapsamı 11/11 geçer; ek CX3 kaynak farkları ayrıca raporlanır. Tam sınırlar ve test kapsamı `SAV_RAW_PARITY_REPORT.md` ile `GA_INTEGRATION_REPORT.md` içindedir.
