# SAV binary araştırması ve özgün tarayıcı okuyucu — doğrulanan kapsam

Tarih: 26 Ekim 2026. Bu belge PSS®E 36.5 kurulumundaki gerçek dosyalarda doğrulanan **SFL sürüm 1 / SAV yerleşim 31 / `LILL` gösterimini** anlatır. PSS®E uygulama sürümü ile dosyanın iç yerleşim numarası farklıdır: incelenen 36.5 dosyalarının iç başlığında `31` bulunur. Başka yerleşimler başarı varsayımıyla açılmaz.

Tarayıcı okuyucunun kaynakları `src/importers/psse/sav-container.ts`, `sav-layout.ts` ve `sav-layout-schema.ts` dosyalarıdır. Bunlar JavaScript `Uint8Array` / `DataView` kullanır. Okuyucu dosyadan gerçek elektriksel dizileri çıkarır; hazır JSON, Python, caspy, PSS®E veya Siemens DLL çağırmaz. Geliştirme sırasında kullanılan yerel Siemens kurulumu, araştırma araçları ve karşılaştırma verileri teslim paketinin çalışma bağımlılığı değildir.

## Kanıtın türü ve sınırı

Üç ayrı kanıt kaynağı kullanılmıştır:

1. **REA MCP statik incelemesi:** `rea-agents` 6.8.0 ile yerel stdio MCP bağlantısı kuruldu; gerçek araç şemaları ve bağlantı yanıtı incelendi. Ghidra 12.1.4 / Java 21.0.9 sağlayıcısı ile aşağıdaki beş işlevin tamamında başarılı decompile yanıtı alındı. Ayrıca PE export ve import tabloları gerçek REA araçlarıyla okundu. Bu, statik incelemedir; işlevlerin yürütüldüğü iddiası değildir.
2. **Bağımsız statik çözümleme:** pefile 2024.8.26 ve Capstone 5.0.9 ile tablo tanımları, türler, koşullar ve boyut bağıntıları incelendi. Bu bulgular REA çıktısı diye etiketlenmez.
3. **Yerel çalışma doğrulaması:** kullanıcının kurulu `caspy.Savecase()` okuyucusu ile gerçek dosyalar açıldı; DLL içindeki mantıksal alan konumlarının salt okunur geliştirme izi alındı. Özgün Python araştırma okuyucusu ve nihai TypeScript okuyucusu bu izlerle karşılaştırıldı. Bu geliştirme izi tarayıcıya yüklenmez.

Sanitize edilmiş REA kimlikleri, hedef hash'i, sağlayıcı sürümleri ve beş işlevin durumları [rea-analysis-summary.json](../evidence/rea-analysis-summary.json) içindedir. Yerel araştırmada kullanılan DLL, assembly, pseudocode, Ghidra veritabanı ve ham model dökümleri dağıtılmaz. REA kaynağı: [morluto/rea](https://github.com/morluto/rea).

İncelenen `usrcas.dll` SHA-256: `71792eaea096eb3f2f0f4834e218d2d60cc2788efa5e8ba0be6f124daddbd73f`. PE görüntü tabanı `0x180000000` olduğundan aşağıdaki RVA'lar bu tabana göredir; **SAV dosyası içi ofset değildir**.

| İşlev / türetilen rol | RVA | Kanıt |
|---|---:|---|
| `PSSOPN` export yönlendiricisi | `0x9F800` | REA PE export incelemesi |
| Açma, başlık ve dizin kurulumunun gerçek gövdesi | `0x9FFE0` | REA / Ghidra |
| Sıralı alan dizinini kuran işlev | `0xA0470` | REA / Ghidra |
| Alanın koşulunu, türünü ve dinamik boyutunu değerlendiren işlev | `0xA6360` | REA / Ghidra |
| Paketlenmiş tamsayı başlığını yerel sayaçlara dağıtan işlev | `0x33A0` | REA / Ghidra |
| Alan adını tanım dizininde arayan işlev | `0x1940` | REA / Ghidra |
| `PSSBUS`, `PSSBRN`, `PSSGEN`, `PSSLOD` | `0x5BAC0`, `0x124A0`, `0x8EFE0`, `0x455B0` | REA export; odaklı Capstone incelemesi |
| `PSSTRN`, `PSS3WT`, `PSSNOD`, `PSSSUB` | `0xA4A0`, `0xAD6B0`, `0x56BE0`, `0xAB0A0` | REA export; odaklı geliştirme incelemesi |

`usrcas.dll`, `PTIUtils.dll` içindeki `LOPNSF`, `LRWSC`, `LRWSI`, `LRWAI`, `LRWAR`, `STPOS`, `LSTPOS` ve türlere göre imleç ilerletme işlevlerini kullanır. Bu bağ, dosyanın önce segmentlere, sonra mantıksal türlenmiş dizilere ayrıldığını destekler. Bu modüller okuyucunun dağıtılan bağımlılığı değildir.

## Fiziksel SFL kapsayıcısı

İlk 20 byte `FuP_pHySPCD%PTI_SFL_` imzasıdır. Sonraki ilgili alanlar little-endian `uint32` olarak okunur:

| Fiziksel byte ofseti | Anlam |
|---:|---|
| 20 | SFL sürümü; doğrulanan değer `1` |
| 24 | Ayrılan son kelime sınırı; dosya uzunluğu `12 + 4 × değer` olmalıdır |
| 80 | 328 öğelik kök segment-dizin pointer tablosunun başlangıcı |

SFL pointer'ları, 12 byte fiziksel önekten sonra başlayan akışta **1 tabanlı dört byte kelimelerdir**. Pointer `p` için fiziksel byte adresi `12 + 4 × (p − 1)` olur. Bir kök pointer 100 girişlik dizine gider. Her giriş dört `uint32` içerir: ilk extent pointer'ı, son extent pointer'ı, mantıksal segment uzunluğu ve son extent'in mantıksal başlangıç kelimesi.

Her extent iki `uint32` başlık içerir: sonraki extent pointer'ı ve kapasite kelime sayısı. Veri başlıktan sekiz byte sonra başlar. Extent zinciri sırayla birleştirilir; son extent'in kullanılmayan kapasitesi mantıksal modele katılmaz. Pointer, kapasite, uzunluk, son-extent bilgisi, döngü ve fiziksel aralık çakışmaları veri ayrılmadan önce denetlenir. Kaynak konumları, bir mantıksal alan birden fazla extent'e bölünse de fiziksel aralıklara çevrilebilir.

İncelenen özgün dosyalarda mantıksal veri fiziksel byte 3000'de başlamaktadır. **Okuyucu 3000'i kullanmaz:** kök, dizin ve extent pointer'larını izler. Yeniden konumlandırılmış iki-extent ve fazla kapasite örneklerinin yerel Siemens okuyucusuyla açılması, bu ayrımı ayrıca sınar. Kapsayıcının çözümlenmesi tek başına elektriksel modelin eksiksiz olduğu anlamına gelmez.

## Mantıksal SAV akışı ve türler

İlk segment SAV akışıdır. İlk alan 36 byte `Info` metnidir; ilk dört byte doğrulanan `LILL` gösterimini, byte 4–5 ASCII `31` iç yerleşimini taşır. Bu gösterimin diğer olası varyantları uygulanmış sayılmaz.

Alanların türleri ve boyutları:

| Tür | Kaynak öğe boyutu | Çıktı |
|---|---:|---|
| `I32` | 4 byte | İşaretli tamsayı |
| `F32` | 4 byte | IEEE-754 float |
| `F64` | 8 byte | IEEE-754 double |
| `CHAR` | 1 byte | Byte başına bir kod noktasıyla korunan metin |
| `LOGICAL` | 4 byte | Kaynak tamsayısı; sıfır dışı değerler korunur |
| `C64` | 8 byte | İki `F32`: gerçek, sanal |
| `C128` | 16 byte | İki `F64`: gerçek, sanal |

Her alanın toplam byte uzunluğu sonraki dört-byte sınırına yuvarlanır. Örneğin 21 adet iki-byte yük kimliği 42 veri byte'ı ve iki padding byte'ı tüketir. Padding elektriksel değer diye sunulmaz. `CHAR` dizilerinin byte sadakati korunur; tüm dosya UTF-8 varsayımıyla çözülmez.

Yerleşim 31 başlık sırası aşağıdadır. `Release`, sonraki `Pntrev` dizisinin uzunluğunu belirler; bu nedenle sonraki alanlar örneğe özel sabit dosya adresleriyle aranmaz.

| Alan | Tür ve öğe sayısı |
|---|---|
| `Info` | 36 `CHAR` |
| `Release` | 1 `I32`; incelenen dosyalarda `5` |
| `Pntrev` | `Release` adet `I32` |
| `Headre` | 28 `F32` |
| `Headin` | 71 `I32` |
| `Maxary` | 10 `I32` |
| `Headlo` | 37 `LOGICAL` |
| `Ihanb` | 120 `CHAR` |
| `Title` | 1152 `CHAR` |

`Headre[2]` sistem MVA bazıdır; `Headre[16]` frekanstır. Örneklerde 100 MVA ve 60 Hz; Türkiye modelinde 100 MVA ve 50 Hz gözlenmiştir. İndeksler bu belgede sıfır tabanlıdır.

## Dinamik tablo dizini

Statik araştırmada 621 alan tanımı ve bunları sıralı değerlendiren mekanizma saptandı. İlgili tanım bölgesi DLL RVA `0xC25F8`'dedir; tanım genişliği 28 byte'tır. Alan adı, tür, boyut seçimi, asgari yerleşim ve varlık koşulu ayrı bilgilerdir. Tarayıcıda özgün yazılmış bildirimsel alan şeması kullanılır; tescilli yürütülebilir kod taşınmaz.

`sav-layout-schema.ts`, 621 alanın sırasını ve sayaca bağlı boyut/varlık bağıntılarını açıkça tutar. Okuyucu her mevcut alanın gerçek boyutunu hesaplayarak imleci ilerletir. Bir dizinin olmaması, sıfır uzunlukta mevcut olmasıyla karıştırılmaz. Örneğin `Headlo[16]`, kaynak gerilimin `Volt` (`C64`) veya `Dblvlt` (`C128`) dizisinde saklanmasını seçer.

Her tanımın asgari yerleşimi de şemada saklanır ve okuyucu tarafından sınanır; incelenen 621 tanımda en yüksek asgari yerleşim 31'dir. İki sabit yokluk koşulu tahmini varsayılan değildir: koşul 36'nın native dispatch hedefi doğrudan alanı eklemeden dönen RVA `0xA6EC7`'dir. Koşul 47, yalnız yerleşim 30 için kullanılan uyumluluk bayrağına bağlıdır. Açılış gövdesi RVA `0x9FFE0`, bayrağı sıfırlar; yardımcı RVA `0xA7370`, onu yalnız yerleşim tam 30 olduğunda okuyup değiştirebilir. Bu nedenle desteklenen yerleşim 31'de koşul 47 kesin olarak yanlıştır. Eski sürümün bu uyumluluk yoluna destek verildiği iddia edilmez. Bu kontrol akışı statik RE kanıtıdır; 11 dosyalık testin bu kararı tek başına genel olarak kanıtladığı ileri sürülmez.

Başlıktaki önemli sayaçlar:

| `Headin` indeksi | Doğrulanan kullanım |
|---:|---|
| 0 / 1 / 2 | Bara kaydı / santral grubu / makine |
| 3 | Hat, trafo eşdeğer bacağı ve bara tabanlı sistem anahtarını içerebilen tüm dal kayıtları |
| 4 / 30 | Trafo bacağı / üç sargılı trafo |
| 5 / 34 | Anahtarlamalı şönt / sabit şönt |
| 6 / 7 / 31 | İki terminalli DC / çok terminalli DC / VSC DC |
| 26 / 29 | Yük / FACTS |
| 35 / 36 / 37 | Alan / sahip / bölge |
| 38 / 39 | Endüksiyon makinesi / genel ağ modeli |
| 45 / 46 | TM / node |
| 47 / 48 / 49 | Node anahtar bağlantısı / anahtar aygıt tanımı / terminal ilişkisi |
| 65 / 66 / 67 | Yük tipi / arayüz / arayüz elemanı |
| 68 / 69 | Anahtar termik limit grubu / gerilim droop kontrolörü |

Değişken boyutlu özel alanlar da kaynaktan hesaplanır: `Ratings` uzunluğu, `Ratselector` düşük 12 bitindeki etkin limit sayısı ile dal sayısının çarpımıdır. `Ntbpnt` pozitif nokta sayıları empedans düzeltme tablolarının uzunluğunu verir. `Rsetdesc`, her kaydın kendi tamsayı metin uzunluğu ve dört-byte padding'ini izler. `Nctpak` düşük altı bitleri ilgili tablolardaki nokta sayısını verir. Bu alanlar dosya örneğine göre adreslenmez.

## Kimlikler, bağlantılar ve elektriksel yorumlama

`Numbus` kaydı salt harici bara numarası değildir. İncelenen yerleşimde paketlenmiş değer, `1000 × baraNumarası + bölüm` biçimindedir. `savnw_nb` ve `sample_nb_sec` örneklerinde sıfır dışı bölüm değerleri gerçek yerel okuyucuyla doğrulanmıştır. Örneğin aynı harici bara numarası farklı bölüm kayıtlarında tekrar edebilir. Kaynak paketlenmiş kimlik, kaynak kayıt indeksi ve bölüm saklanmalı; bu kayıtlar yalnız bara numarasıyla birleştirilmemelidir. `Origbus` ayrı bir kaynak eşleme dizisidir.

Yükler `Ldfrst` / `Ldnext`; makineler bara-santral ilişkisi, `Mcfrst` / `Mcnext`; dallar `Ifirst` / `Inext` / `Ito` üzerinden bağlanır. Bu pointer'lar model içindeki kayıt sırasına göre değerlendirilir. `Tapno` ve `Brkno`, dalın hat, trafo bacağı veya sistem anahtarı olarak ayrılmasında gereklidir. Türkiye modelindeki 8669 dalın tamamını hat diye göstermek yanlıştır: 2403 hat, 3703 trafo ve 2563 sistem anahtarı söz konusudur.

Node-breaker dizileri `Nodnum`, `Nodbus`, `Nodsta`, `Ndtm*`, `Brchnf/t`, ekipman-terminal dizileri ve `Nd*` / `Brk*` anahtar bağlantılarını içerir. Bunların ham kaynak dizilerinin okunmuş olması, bütün elektriksel bağlantıların uygulama düzeyinde doğrulandığını tek başına kanıtlamaz. Eksik veya belirsiz bağlantı normalizasyonu kalite bulgusu üretmelidir.

`Dblvlt` / `Volt` kayıtlı karmaşık gerilimi taşır. Buradan `hypot(re, im)` ve `atan2(im, re)` ile bulunan Vm/Va, **kaynakta kayıtlı işletme noktasından türetilir**; GA yük akışı sonucu değildir. `Orgjcode`, kaynak bara tipini korur; iç işletme işaretleri taşıyabilen `Jcode` mutlak değer alınıp bağlamsız yeniden adlandırılmamalıdır.

Makine `Pgenmc`, `Qgenmc`, P/Q sınırları ve yük `Cfdlfr` değerleri sistem MVA bazına göre pu değerlerdir. `Mbase` zaten MVA'dır. `Cfdlfr` her yük için güç, akım ve admitans bileşenlerini içeren üç karmaşık kayıt taşır; yalnız ilk bileşenin alınması yük modelini eksiltir. Bu bileşenlerden bir işletme yükü hesaplanırsa kullanılan kaynak gerilim ve bağıntı ayrıca belirtilmelidir.

`Ratings` değerleri pu güç dizisi değildir; MVA bazına gelişigüzel çarpılmaz. Limitler, seçilen bit sırasına göre **sütunlar halinde** saklanır. Tüm etkin sütunlar ve adları korunur. Trafo limit yorumunu etkileyen `XFRRAT` gibi kaynak seçenekleri ile anahtar `Swdratunt` / `Swdrattyp` birim/tür bilgileri kaybedilmemelidir. Gerçek örneklerde `MVA` ve `AMP` birlikte bulunduğundan bütün limitlere otomatik MVA etiketi konamaz. Okuma ve kaynak birimini koruma, bilinmeyen birim dönüşümünü ispatlamaz.

## Gerçek dosya doğrulaması

[sav-layout-position-parity.json](../evidence/sav-layout-position-parity.json), her dosyanın SHA-256 kimliğini ve bağımsız yerel okuyucudan alınan **621 alan varlık/ofset kararının** özet hash'ini içerir. Bu hash'ler decoder girdisi değildir; yalnız test beklentisidir. TypeScript çıktısındaki tüm mevcut ve mevcut olmayan alan kararlarıyla karşılaştırılır. Test: `node --import tsx --test tests/unit/psse-sav-layout.test.ts`. İsteğe bağlı `PSSE_TEST_ROOT`, geliştirme referans dosyalarının kökünü seçer; referanslar yoksa ilgili gerçek dosya testleri açıkça atlanır.

| Referans | 621 karar | İndeksli dizilerden sonra kalan byte |
|---|---:|---:|
| `savnw` | 621/621 | 464 |
| `sample` | 621/621 | 4996 |
| `bench` | 621/621 | 20 |
| `bench2` | 621/621 | 20 |
| `savnw_nb` | 621/621 | 464 |
| `sample_nb` | 621/621 | 9780 |
| `sample_nb_sec` | 621/621 | 9780 |
| `sample_zils` | 621/621 | 4804 |
| `sample_zils_nb` | 621/621 | 10052 |
| `sample_zils_nb_sec` | 621/621 | 10052 |
| `20261014_1200_SN3_TR0` | 621/621 | 20 |

Bu kapsamda **11/11 dosyada 6831/6831 alan konumu/varlık kararı eşleşmiştir**. Ayrıca tüm okunmuş sayısal değerlerin sonlu olması ve metin byte uzunlukları sınanmıştır. Büyük bara sayacı, NaN float, sonsuz karmaşık gerilim, kırpılmış limit dizisi, bilinmeyen gösterim ve bilinmeyen sürüm negatif kontrolleri bulunmaktadır. Kaydedilen çalıştırmada 12 test geçmiş, 0 test atlanmıştır; çıktı [sav-layout-tests.log](../evidence/sav-layout-tests.log) içindedir.

Bu sonuç **ekipman kimliği, topoloji ve elektriksel parametre SAV↔RAW eşitlik sertifikası değildir**. Bu ayrı doğrulama `SAV_RAW_PARITY_REPORT.md` kapsamındadır. Binary dizi imlecinin doğruluğunu, kaynak alanların uygulama içindeki fiziksel yorumundan ayırır.

## Açık kalan alanlar ve başarı durumu

`bench`, `bench2` ve Türkiye modelinde indeksli dizilerin ardından tam 20 sıfır byte gözlenmiştir. Okuyucu bu durumu `recognizedEmptyExtension` olarak bildirir. Diğer örneklerde sıfır dışı ek kayıtlar vardır; bunların semantiği bu araştırma aşamasında tamamen çözülmemiştir. Ham kalan byte'lar, ofsetleriyle korunur. Bunlar sessizce atılamaz veya modelin bütünü eksiksizmiş gibi raporlanamaz.

SFL sürüm 1 dışı kapsayıcı, `LILL` dışı gösterim, yerleşim 31 dışı SAV sürümü, sınır dışı pointer, negatif/aşırı boyut, kesik dizi ve sonlu olmayan sayısal kayıt açık hata üretir. Elektriksel sınıfın yalnız kaynak dizilerinde korunması ancak uygulama modelinde tam karşılık bulmaması, eksik terminal veya belirsiz bölüm eşlemesi kalite eksikliğidir. Dosya seçiminin bitmesi başarı ya da analiz uygunluğu sayılmaz.

Bu çalışma envanter, kayıtlı işletme verisi ve model kalitesi içindir. Kaynakta bir işletme noktası bulunması, yeniden hesaplanmış yakınsama kanıtı değildir. GA yük akışı, kısa devre ve N-1 bu decoder tarafından hazır ilan edilmez; analiz durumları `BLOCKED` kalır. Eksik model için `READY` üretilmemelidir.
