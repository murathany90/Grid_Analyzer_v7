# Bütün TM’ler için ortak tek hat çizimi

TM kimliğine bağlı çizim ayrımı kaldırıldı. Kayaş, Temelli, Karapınar, İç Anadolu DGKC ve diğer merkezler aynı kaynak topolojisi, bara, fider, anahtar ve kuplaj kurallarını kullanır. Referans resimler çizim düzenini belirler; elektriksel bağlantı veya cihaz oluşturmaz.

## Değişiklikler

- Normal baralar ve transfer barası 18 birim aralıkla kompakt bir demet oluşturur. Anahtar hücreleri demetin dışında yerleşir; yabancı baradan geçen iletkenler gerçek görünür kesintiyle ayrılır.
- Kaynakta doğrulanmış kuplaj/transfer devreleri kendi hücrelerinde çizilir. Kardeş bara gruplarının henüz oluşturulmamış olması paftayı durdurmaz. Uzak bara girişlerinin ve aynı baydan aynı baraya çıkan birden fazla ayırıcının ayrı eksenleri vardır.
- Fiderin nominal gerilimi bağlı olduğu baranın geriliminden farklı yazılmışsa gerçek bağlantı korunur ve fider çizimden düşmez. Ortak terminal başka bir fiderin yerleşimi tarafından taşınmaz.
- OTR kesici/ayırıcıları kaynak cihaz türünü, FID’yi, FROM/TO uçlarını ve açık/kapalı durumunu korur. Gerçek sargı uçları ve kaynakta mevcut seri zincirler birlikte gösterilir.
- Yoğun merkezlerde yerleşim daha geniş hücrelerle yeniden denenir. Yazı sığmadığında pafta ve çerçeve büyür; bütün merkez kaybolmaz. Barasız GTR/jeneratör bileşenleri ayrı ama kompakt yerleşir.
- Gerilim bilgisi olmayan TM’ler seçim listesinden saklanmaz. Kaynak terminal/ekipman bağlantısı bulunmayan merkezlerde açık bir veri eksikliği mesajı gösterilir.
- Şönt reaktör, kapasitör bataryası, seri reaktör ve seri kapasitör ayrı sembol türleridir. Şönt sınıfı kanonik modelin kaynakla çözümlenen Q değerinden, seri eleman sınıfı çözümlenen X değerinden belirlenir; cihaz adı sınıflandırma kanıtı değildir. Geçersiz/belirsiz reaktif veri açıkça genel reaktif eşdeğer olarak gösterilir. Şöntün tek kaynak terminali korunur; kaynakta olmayan toprak veya nötr bağlantısı eklenmez.
- Seri elemanların FROM/TO FID’leri iki ayrı sembol kontağına bağlanır; aynı kontaktan iki terminal çizerek elemanın görsel kısa devre olması engellenir. `ElmSind` kayıtları gerçek `bus1/bus2 → StaCubic.fold_id` uçlarıyla gösterilebilir; kanonik hesap desteği bulunmadığı paftada belirtilir. SN3 modelinde bu sınıfa ait kayıt yoktur; kural kaynak cubicle’ları içeren test modeliyle denetlenir.

## Gerçek model doğrulaması

SN3 modelinde 1.619 TM kaydı vardır. Terminal verisi olan **1.554 merkez**, normal ve LF görünümünde **3.108 ayrı tarayıcı çizimi** ile doğrulandı: çizim hatası ve kaynak bara/anahtar/ekipman/fider sayısı kaybı **0**. İlk yerleşim taramasında 139 merkezde çizimi durduran hata bulunmuştu; son taramada 0.

Kalan 65 TM kaydında kaynak terminali yoktur. Bunlara cihaz veya bağlantı uydurulmaz; merkez seçilebilir ve eksik kaynak durumu gösterilir. Ayrıca 31 merkezde 60 adet çözülemeyen kaynak fider ilişkisi raporlanır; bu durum pafta üretimini engellemez.

11 gerçek merkezde normal ve LF olmak üzere 22 SVG, üretim yerleşiminden bağımsız kaynak/kontak oracülüyle ayrıca incelendi: kaynak uç hatası, açık kontak köprüsü, üst üste iletken ve yabancı terminal birleşmesi **0**. Bu ayrıntılı geometri kontrolü örnek 11 merkez içindir; bütün 1.554 merkez için yapılan kontrol çizim üretimi ve cihaz envanteri kapsamındadır.

Kayaş OTR kaynak sınırlaması devam eder: örneğin T5133’ün HV cubicle’ı `ft00-13064`, B89867 terminaline bağlıdır; C112442 ayırıcısının diğer ucu B102871’dir. Kaynakta sargı bu son uca bağlı değildir. Ad benzerliğiyle bağlantı değiştirilmedi; bu kaynak uçları ve durumları görünür bırakıldı. Referansla tam elektriksel eşleşme için eksik kaynak ilişkilerinin düzeltilmesi gerekir.

Reaktif çizim denetimi ayrıca 104 gerçek merkezde 208 SVG'yi kapsar: 124 şönt reaktör, 15 kapasitör bataryası ve 15 seri kapasitör. Kaynak türü/terminali, ayrı seri kontaklar, görünür kaynak iletken kapsamı, açık kontakların köprülenmemesi ve yabancı iletken temasları birlikte kontrol edilir. Reaktif semboller artık `?` göstermez. Barasız devrelerin ortak iletkenleri de tek kez çizilir. Ortak HV terminali olan ayrı GSU LV adalarına ayrı geometri ayrılır. Sembol kontaklarına yaklaşım alanı başka devrelerin güzergâhına verilmez.

## Kontroller ve teslim

584 mevcut test ile 5 yeni reaktif ekipman/GSU testi birlikte korundu; toplam 589 birim/regresyon testi geçti; silinen veya atlanan test yok. Typecheck, lint, normal/portable build ve dört E2E geçti. Eski geometri kontrolleri yeni kompakt çizim sözleşmesine güncellendi; SVG `M` kesintileri gerçek kesinti olarak okunur ve bağımsız kaynak iletken kapsamı kontrolü eklenmiştir. Eski yatay kuplaj ve geniş bara aralığı beklentileri, kullanıcının istediği ortak referans düzeniyle değiştirilmiştir.

Portable dosya committed blob ile ham byte düzeyinde aynı ve LF satır sonlarıyla üretilir. Kod geliştirme dalına commit/push edilir; `main` birleştirilmez.

Yerel teslim klasörü: `local-benchmark-results/sld-all-stations/`. Paket `ALL_TM_SLD_DELIVERY.zip`; karşılaştırma sayfası `TEK_HAT_KARSILASTIRMA.html`. CSV dosyaları bütün merkezlerin çizim envanterini ve örnek merkezlerin gerçek kaynak kontak izlerini içerir. Ham özel model ve fixture dosyaları teslim ZIP’ine veya Git’e eklenmez.
