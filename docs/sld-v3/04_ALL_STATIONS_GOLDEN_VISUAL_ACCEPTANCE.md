# Gerçek tek hat görsel inceleme paketi

Önceki kart overview teslimi kullanıcı tarafından reddedildi. Eski otomatik marker kabulü fiziksel tek hat kabulü değildir. Bu düzeltme sonrası insan görsel onayı henüz alınmadı.

SN3 canonical model hash: f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6. Mevcut private canonical/result snapshot yeniden kullanıldı. Yeni model importu, LF veya N-1/SC hesabı yapılmadı; render sırasında solver/import worker istekleri engellendi. Kaynak ve sonuç model hash'leri eşleştirildi.

Beş merkez: M1583 Hotamış, M1301 İç Anadolu DGKÇ, M56 Davutpaşa, M38 Köylüköy, M1555 3S Kale JES. Her merkez dört viewport'ta YTBS ve 1440px'de diğer altı modla kaydedildi: 5 × (4 + 6) = 50 PNG/SVG ekran çifti, ayrıca 50 tam sayfa PNG. Native anahtar sayıları 75/50/276/124/21; toplam 546/546 fiziksel SVG anahtarı. 153/153 native fiderin seçilebilir adı/FID'si var. ElmBay sahibi bulunmayan M38 anahtarı da gerçek kontaklarıyla çizilir, sahte fider eklenmez.

Viewport'lar 1366×768, 1440×900, 1920×1080, 390×900. Modlar YTBS, teknik, LF, N1, SC, işletme ve kompakt. Default okunabilir sayfa ile tüm sayfayı küçülten Sığdır ayrı davranışlardır. SVG tam sayfayı dışa aktarır. Görsel geometri kontrolleri: eksik anahtar 0; fider metni overlap 0; glyph overlap 0; başka gövdeden geçen tel 0; document yatay taşma 0.

İnceleme: local-benchmark-results/sld-v3-connected-correction/REVIEW.html. İlk açılış M56'yı gösterir. Sol tarafta reddedilen kart, sağda yeni bağlı çizim; TM seçimi, okunabilir ölçek, genişliğe sığdır ve SVG bağlantısı vardır. CONNECTED-<TM>-station-ytbs-1440-sheet.png tam çizimdir; aynı stem'in .png dosyası uygulama viewport'udur. .svg bütün native sayfadır.

Kullanıcının işaret ettiği local-benchmark-results/sld-v3/CANDIDATE-M56-station-ytbs-1440.png yolu yeni tam sayfa çizimiyle güncellendi. Önceki kart görüntüsü REJECTED-CARD-M56-station-ytbs-1440.png olarak saklandı. Diğer station alias'ları da yeni çizime yöneltildi. Eski COMPARE_ALL paketi emekli olarak işaretlendi; eski kart metrikleri yeni kabul sayılmaz.

Hotamış ve İç Anadolu kullanıcı örnekleriyle birlikte yeni tam sayfalar görsel olarak incelendi. Yerel V0/V4 kaynakları ve DGS i_auto kanıtı korunur. Kaynakta bulunmayan CT/VT/toprak/kumanda görevi veya fider alt tipi tahmin edilmedi. Tam V0 fiziksel şablon uyumu ve insan çizim onayı tamamlandı denmez.

Bay/regional ortak kontak, yatay/dikey bay, kaynak FID, paralel hat ve gezinme kontrolleri kamu SLD smoke'unda yeniden geçti. Bu turda eski 190 görüntü ve 153 bay taraması tekrar hesaplanmadı; native yeni tam sayfa ve değişen UI hedefli doğrulandı. Yeni sonuç tablosu eski kart tesliminin başarısını sürdürmez.
