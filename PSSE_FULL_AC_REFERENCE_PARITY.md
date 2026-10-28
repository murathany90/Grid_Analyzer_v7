# PSS/E V5 — bağımsız AC ve lisanslı referans karşılaştırması

## Sonuç ve kapsam

V5, bağımsız seyrek polar Newton çözümüne gerçek uzak bara IREG denklemleri, santral RMPCT paylaşımı, makine aktif üretimi oranında Q paylaşımı ve sınır etkin kümesi ekler. Radyal santral bağlantılarında aktif Q(V) kontrolü, jeneratör terminalindeki Q yerine bağlantı noktasına ulaşan Q ile çözülür. Yeni profil Analizler gelişmiş ayarlarındaki **Uzak bara gerilim kontrolü (IREG/RMPCT)** seçeneğidir; varsayılan kapalıdır. Önceki yaklaşık çözüm korunmuştur.

**Tam kabul henüz sağlanmamıştır.** İki gerçek modelin baz, +%2, +%10, hat açma ve geri alma hesaplarının tamamı GA'da yakınsar. Seçilen yakınsamış PSS/E referanslarına karşı on durumdan dokuzu bütün P95 eşiklerini karşılar. 6.851 baralı modelin +%10 yük durumunda normalize dal Q P95 hatası **%1,4038** olup istenen %1 sınırını aşar. Bu nedenle sonuç sınıfı **SOLVED_APPROXIMATE / PARTIAL** kalır; SOLVED_FULL yayımlanmaz.

## Referans protokolü

- Kullanıcının yeniden taktığı dongle ile PSS/E 36.5.0, Python 3.14 ve 20.000 bara oturumu gerçekten çalıştırılmıştır. Her durumdan önce özgün SAV yeniden yüklenmiştir.
- FNSL tap, alan, faz, DC tap ve şönt otomatik hareketleri kapalı; kaynakta kayıtlı başlangıç, Q sınırları hemen etkin. TOLN ve VCTOLQ 0,001 MVA; VCTOLV 0,000001 pu. GA toleransı 0,00001 pu, 100 MVA tabanında 0,001 MVA'dır.
- Standart Newton `[0,0,0,0,0,0,0,0]` ve non-divergent `[0,0,0,0,0,0,0,1]` ayrı çalıştırılmıştır. İlk modelin bazı baz/hat durumları standart profilde 100 iterasyonda bitmez; non-divergent referansı yakınsar. Yük artışları non-divergent profilde durabilirken standart profilde yakınsar. Her iki denemenin durumu ve seçilen profil kanıtta korunur. Algoritmik adım politikaları özdeş olduğu iddia edilmez.
- PL/QL/IP/IQ/YP/YQ aynı faktörle ölçeklenir. Hat açma iki modelde aynı kaynak uçlar/devre üzerinden uygulanır. Geri almada aynı hat açılıp kapatılır; GA sonuç dizileri bazla birebir eşleşir.
- Vm bağıl hata; P/Q ve jeneratör Q hatası `abs(GA-ref)/max(abs(ref),10)`; açı hatası ortak açı kayması çıkarılarak hesaplanır. Kaynak kimliğiyle eşleşmeyen değerler sayılır; on karşılaştırmada eksik aktif bara/jeneratör/dal ucu yoktur.

Toplu sayısal kanıt: [reference-parity.json](evidence/psse-v5/reference-parity.json). Ham lisanslı çıktılar, her durumun en kötü 20 barası ve gerçek modeller yalnız özel yerel dizindedir; Git ve ZIP'e eklenmez.

## Fiziksel denge ve sınırlamalar

Sonuçlardan bağımsız olarak jeneratör, ZIP yük, şönt ve iki uç dal güçleriyle fiziksel bara KCL ve toplam P/Q dengesi yeniden kurulur. Bu on durumun en büyük fiziksel bara karmaşık güç artığı 0,000889 MVA'nın, toplam mutlak P/Q artıkları 0,000900 MVA'nın altındadır. Bu denge kontrolü referans eşitliği anlamına gelmez. Aynı bağımsız kaynak yük/şönt ve iki uç güç hesabı lisanslı API sonuçlarına da uygulanmıştır; gerçek on referansın en büyük bara KCL artığı 0,002640 MVA altındadır ve üç sargı eksikliği yoktur.

WMOD=3/4 sabit Q kaynak semantiği korunur. Gerçek ikinci SAV'ın +%10 FNSL çıktısında bazı WMOD=4 Q değerlerinin değiştiği gözlenmiştir; aynı tip özgün küçük API örneklerinde Q sabittir. Bu farkın tüm bağlamı çözülmeden kaynak değerleri veya kontrol türleri referansa uydurulmamıştır. İkinci modelin kalan dal Q farkı ve tam kaynak kontrol sadakati açık iştir.

Aktif Q(V) küçük radyal örneklerde, alt/üst eğim, ölü bant ve jeneratör Q sınırıyla doğrulanır. Gerçek modellerde atanmış aktif droop makinesi görülmediği için bunlar büyük-model droop kabulü olarak sunulmaz. Çelişen VS/RMPCT engellenir; desteklenmeyen PCC bağlantılarında kaynak Q açık uyarıyla tutulur. Sürekli şönt kontrolü, ideal çevrimde tekil olmayan akış paylaşımı ve diğer önceki kapsam sınırları devam eder.

Son özgün küçük örnek setinde **14 durumun 13'ü** tanımlı küçük-örnek karşılaştırma eşiklerinde (Vm < 0,0001 pu; makine Q < 0,02 MVAr) eşleşir; Q(V) örneklerinde en büyük Vm farkı 0,000001313 pu'dur. Karma geleneksel/WMOD=4 makineler içeren `remote-shared-fixed` örneği eşleşmez. Bu örneğin PSS/E API jeneratör ve iki uç dal değerleriyle yeniden kurulan fiziksel KCL artığı yaklaşık **200 MVA** olduğu için bu API dökümü geçerli makine-Q doğruluk kanıtı sayılmamıştır. Hem başarısız karşılaştırma hem referans fiziksel denetimi [küçük kontrol kanıtında](evidence/psse-v5/control-reference-parity.json) tutulur. Bu gözlem diğer gerçek-model farklarının kök nedenini tek başına açıklamaz; karma santral kaynak/kontrol semantiği açık doğrulama işidir.

## Kaynak ve yöntem

Kurulu lisanslı DataFormats/POM/API belgeleri ile kullanıcı YTBS kılavuzu yerel olarak incelenmiştir. Q(V) PCC tanımı ve RMPCT/makine paylaşımı için bağımsız küçük deneyler kullanılmıştır. REA gerçekten erişilebilir olup PSSPY314 psspyc.pyd üzerinde AMD64 PE ihracat özeti alınmıştır; bu inceleme FNSL algoritmasını ortaya çıkarmamıştır. Vendor kodu kopyalanmamış, lisans denetimi değiştirilmemiştir. Uygulama özgün TypeScript denklemleridir; offline paketin PSS/E/Python bağımlılığı yoktur.
