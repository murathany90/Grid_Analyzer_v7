# Native SAV / RAW / RAWX doğrulama raporu

## Sonuç ve kapsam

Tarayıcı decoder'ı gerçek SAV baytlarından elektriksel kayıtları okur. Hazır JSON, Python dönüşümü veya Siemens DLL çağrısı üretim yolunda bulunmaz. Desteklenen binary profil **PTI SFL v1 / LILL / layout 31**'dir; doğrulanmamış profiller açık hata ile reddedilir. RAW/RAWX kapsamı doğrulanmış 35/36 düzenleridir.

Üç farklı kontrol birbirine karıştırılmamıştır:

1. **Binary alan konumları:** 11 gerçek SAV'da 621 alanın varlık/konum kararlarının tamamı, toplam **6.831/6.831**, geliştirme sırasında yerel okuyucudan alınan bağımsız konum kanıtıyla eşleşti.
2. **SAV elektriksel kayıtları:** 11 gerçek SAV'da yerel PSS/E 36.5 okuyucusuyla **841.231** kimlik, bağlantı ve parametre kontrolü geçti. İlk yedi modelde 386.414; `bench2`, `sample_zils`, `sample_zils_nb`, `sample_zils_nb_sec` ek kontrolünde 454.817 eşleşme vardır. Hedef kontrol modelindeki sayı **277.131**'dir. Bu geliştirme doğrulamasında caspy kullanılmıştır; HTML'de veya decoder'ın çalışma yolunda kullanılmaz.
3. **Ayrı kaynak dosyaları arasındaki karşılaştırma:** RAW/RAWX'in önceki normalize alan kapsamı **11/11 PASS** olarak korundu. SAV/RAW dosyaları birbirleriyle ayrıca karşılaştırıldı; gerçek kaynak farkları aşağıda açıkça korunmuştur.

Kanıtlar: `evidence/sav-layout-position-parity.json`, `sav-native-oracle-parity.json`, `sav-native-extra-oracle-parity.json`, `native-raw-rawx-parity.json`, `sav-raw-parity.json`. Yeniden üretim araçları `tools/psse-sav-native-oracle.py`, `psse-raw-parity.ts`, `psse-sav-raw-parity.ts` dosyalarıdır. Ek dört modeli tekrar çalıştırmak için aynı Python geliştirme aracında `--case bench2 --case sample_zils --case sample_zils_nb --case sample_zils_nb_sec --output evidence/sav-native-extra-oracle-parity.json` seçeneklerini kullanın. Siemens modülü veya model baytları dağıtılmaz.

## Gerçek kontrol modeli

`20261014_1200_SN3_TR0.sav` doğrudan tarayıcıda çözülmüştür:

| Kayıt | SAV | RAW |
|---|---:|---:|
| Bara | 6.851 | 6.851 |
| AC hat | 2.403 | 2.403 |
| Trafo | 3.703 | 3.703 |
| Jeneratör | 2.920 | 2.920 |
| Yük | 2.520 | 2.520 |
| Sabit şönt | 139 | 139 |
| Sistem anahtarı | 2.563 | 2.563 |
| TM | 1.618 | 1.618 |
| Gerilim droop kontrolü | 236 | 236 |

AC hat yönleri karşılaştırmada kanonikleştirilmiştir; yön ters ise uç şöntleri de karşılıklı eşlenir. Decoder kaynak yönünü değiştirmez. Tüm karşılaştırılan ekipman kimlikleri ve dış terminal ilişkileri eşleşmiştir; eksik kayıt yoktur.

**239.048** sayısal alan kontrolünde kaynak RAW'ın yazım hassasiyeti ve binary kayan nokta toleransı dikkate alındı. Termik değerlerin tek ondalık basamakla, uzunlukların farklı ondalık sayılarıyla yazılması yanlış model farkı sayılmadı. Trafo empedansında RAW CZ birimi sistem MVA bazına çevrilirken yazım toleransı aynı dönüşümle taşınır. Genel sayısal taban toleransı `max(0.000002, abs(reference)*0.000002)`, MW/Mvar için en az `0.0006`, Vm için `0.000011`, Va için `0.00025°`'dir. Va farkı 360° modülünde karşılaştırılır. Daha kaba RAW yazımı için ilgili kaynak hücrenin son basamağının yarısı uygulanır. Araç toleransları açık kodda tutar; değerleri birbirine eşitlemez.

Bu toleranslardan sonra **7 gerçek fark** kalmıştır: dört baranın IDE durum kodu, bir jeneratörün P'si ve iki jeneratörün Q'su. SAV değerleri bağımsız yerel SAV okuyucusuyla eşleşmektedir. İki dosyanın aynı kayıtlı işletme noktası olduğu varsayılmamış; bu farklar decoder tarafından gizlenmemiştir. Ayrıntılı kaynak kimlikleri ve değerler yalnız yerel teslimin özel doğrulama dosyasındadır. Bu nedenle **SAV↔RAW tam sayısal eşitlik PASS iddiası yapılmaz**.

## Diğer modeller ve önemli kaynak ayrımları

`savnw`, `sample`, `bench`, `bench2`, `savnw_nb`, `sample_nb`, `sample_nb_sec`, `sample_zils`, `sample_zils_nb`, `sample_zils_nb_sec` ve gerçek kontrol modelinin baytları incelenmiştir. On bir modelde yerel okuyucuyla raporun tanımladığı elektriksel alanlar karşılaştırılmıştır. Sıfır empedanslı hat/node-breaker varyantları da bu karşılaştırmaya dahildir. SAV↔RAW karşılaştırması bazı örneklerde kayıtlı çalışma noktası farkları bulur; örneğin `sample_nb_sec` için 74 alan farkı vardır. Bunlar çalışan RAW okuyucu ile SAV başarısı taklit edilerek kapatılmamıştır.

- SAV üç sargılı trafonun iç yıldız eşdeğer baralarını da saklar; `sample`'daki dört ek SAV barası açıkça `threeWindingStar` olarak işaretlenir. Üç sargılı ekipman birleştirilirken özgün üç kol, tüm sargılar ve yıldız kayıtları korunur. Bu yardımcı baralar, daraltılmış ekipman grafiğinde ayrı fiziksel ada sayılmaz.
- Node-breaker SAV'da aynı dış bara numarasının farklı kesimleri olabilir. `1000 * dışBara + kesim` paketlenmiş kimliği korunur; farklı kesimler tek baraya birleştirilmez. RAW'ın toplulaştırılmış bara gösterimiyle fark ayrıca raporlanır. Node/anahtar/terminal bağlantıları kaynak indekslerinden çözülür.
- caspy `casswd` tablosunun NSTATUS/STYPE etiketlerinin bazı sistem anahtarlarında ters olduğu bağımsız RAW karşılaştırmasıyla görüldü. Decoder `Brknst → nstat`, `Brktyp → stype` eşlemesini kullanır ve özgün iki alanı da saklar; yanlış oracle etiketi kopyalanmaz.
- RAW/RAWX'in ek winding CX3 alanında altı `sample` varyantında toplam **12 kaynak farkı** vardır. Eski normalize kapsamın 11/11 sonucu bu ek alanların eşit olduğunu söylemez. Ayrıntı `evidence/NATIVE_RAW_PARITY_SCOPE.md` içindedir.
- Termik limitler on iki rating alanıyla korunur. XFRRAT/NXFRAT ve rating set açıklamaları saklanır. Kaynak rating modu doğrulanmadan tüm değerler amper veya yalnız MVA gibi etiketlenmez.

## Eksikler ve başarının sınırı

SAV'nin sıfır olmayan bazı ek blokları, switched-shunt paketli bazı kontrol/durum ayrıntıları, DC/FACTS kontrol denklemlerinin tamamı ve bazı genel model ilişkileri henüz bütünüyle yorumlanmaz. Baytları ve alanları korunur, ilgili model **PARTIAL** gösterilir. `bench` gibi nominal kV=0 olan kaynaklarda gerilim tabanı uydurulmaz ve kapsam kısmi olarak işaretlenir.

Bu çalışma envanter ve kayıtlı işletme noktası okuyucusudur. Tüm GA analizleri **BLOCKED**'dır; kaynak gerilim, açı veya P/Q kaydı bir yakınsama sertifikası değildir. Kısa devre sıra parametreleri sonuç olarak sunulmaz. Bilinmeyen ek bloklardan analiz sonucu uydurulmaz. Desteklenmeyen düzen, bozuk sayım, kesilmiş blok, kopuk terminal, mükerrer kimlik ve döngülü/öksüz kayıt zinciri başarısız yükleme üretir.

Bağımsız HTML ve GA entegrasyonu gerçek tarayıcıda test edilmiştir. `file://` kabul koşusunda tarayıcı çevrimdışıdır; HTTP(S) isteği ve tarayıcı hatası sıfırdır. Python/PSS/E bulunmayan ikinci bir fiziksel bilgisayarda ayrıca test yapılmamıştır; bu sınır GA entegrasyon raporunda belirtilmiştir.
