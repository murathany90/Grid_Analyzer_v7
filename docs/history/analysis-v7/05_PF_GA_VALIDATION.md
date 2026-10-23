# PF–GA bağımsız kabul ve gerçek SN3

Kabul iki ayrı sınıftadır: bağımsız matematiksel/kontrol regresyonları ve gerçek SN3 Orta Anadolu portable çalışması. Hiçbir PF sayısal sonucu GA hesap girdisi yapılmadı. Native DGS model ve bağımsız PF 24.0.7 LF/N-1/SC workbook paketleri birer kez yüklendi; native ControlContext yalnız kontrol girdisi olarak uygulandı. Özel dosyalar, FID listeleri, workbook hücreleri, sonuçlar, günlükler ve görüntüler ignored alanda tutulur.

## Bağımsız regresyon

LF/DC hesap çekirdekleri ve varsayılan ayarlar başlangıç main'e göre değişmedi. 3/5-bus radyal Full AC POST bağıntıları V, açı, P/Q, S ve aktif/reaktif kayıpla denetlenir. Gerçek destekli station, desteklenmeyen remote, eksik Q sınırı ve çözülmeyen aktif dengeleme ayrı kabul kapılarından geçer. Üç eski harita testinin eksik dengeleme içeren fixture'ı açık NATIVE_PARTIAL_CONTROLS olarak seçildi; STRICT reddi ve AC_VERIFIED=0 ayrıca doğrulanır. Eski testler silinmedi/skip edilmedi, eşikler gevşetilmedi.

SC matematik testleri empedans/baz/birim, paralel/radyal/trafo, kaynak katkıları, sentinel/açık anahtar/ada, iptal ve sparse cache kapsamındadır. IEC örnekleri ve PF normatif eşleşme testleri başarılı sayılmaz; gerekli bağımsız kaynak bulunmadığı için BLOCKED kalır.

## Yeni gerçek kabul

Hesapları gerçekten çalıştıran portable: kaynak `51409ae68200c6a0cb17c4606ea7a522b890f25d`, SHA-256 `314f49d4c15da03b21c219926f29d135d241902f3ad4a77d3f3c0b057d014d25`. Sonraki `6da9e84` commit'i yalnız karşılaştırma istatistiklerinin sunum/dışa aktarımını ve HTML derlemesini değiştirir. Bu iki commit arasında analysis/worker/model/N-1/scenario/calculation/benchmark hesap kaynakları birebir aynıdır; gerçek modeller yeniden yüklenip aynı hesaplar gereksiz tekrarlanmadı. Son teslim portable'ın ayrıca sentetik çevrimdışı kabulü ve raw-byte kapısı vardır. Gerçek ölçümlerin artifact hash'i bu nedenle son UI artifact'inden ayrı kaydedilir.

| Kabul | Gerçek sonuç | Yorum |
| --- | --- | --- |
| Global B0 LF | 4.077 elektriksel bara / 5.140 branch; residual 2.0407307441128175e-8 MW | Başlangıç sayıları ve residual birebir korunuyor |
| OA kapsamı | 500 elektriksel bara / 660 branch / 203 TM | Matematiksel ağ global kalır, filtre yalnız hedef/sunum seçer |
| Station kanıtı | 270 aktif, 240 destekli, 186 satisfied, 54 limitte, 30 unsupported; 6 eksik Q sınırı | Nodal yakınsama station/source fidelity'yi tamamlamaz |
| STRICT N-1 | Mevcut gerçek B0 LF yeniden kullanılarak BLOCKED; 0 POST denemesi | UNSUPPORTED_STATION_CONTROL / MISSING_SOURCE_REACTIVE_LIMIT |
| Native açık PARTIAL N-1 | Aynı LF ayarları; 400 kV nonbridge ve 154 kV bridge olmak üzere 2 gerçek POST | İkisi PARTIAL_SOLUTION; varsayılan station modu kapatılmadı |
| N-1 kapsam sayacı | Katalog 660; seçili 2; dışarıda 658; DC_SCREENED=1; AC_ATTEMPTED=2; AC_NUMERICALLY_SOLVED=2; AC_CALCULATED=2; AC_VERIFIED=0; AC_UNVERIFIED=660 | Tüm katalog güvenli veya tam AC doğrulanmış ilan edilmez |
| N-1 kısıt satırları | PERSISTENT 27 / WORSENED 49 / NEW 3 / UNKNOWN_RATING 18 / UNSOLVED_ISLAND 1 | İki vakadaki satır toplamları; evrensel vaka/ekipman sayısı değildir |
| SC native katalog | 6.278 fiziksel terminal / 500 elektriksel partition | Başlangıç sayıları korunuyor |
| SC native seçili 3PH MAX | 3/3 BLOCKED; 0 factor/RHS | Eksik native kaynak/nominal baz kanıtı gizlenmez |
| SC açık tanısal profil | İlk batch 4 fiziksel hedef, 3 RHS, 1 factor, 1 alias reuse; sonraki alias ile toplam 5 fiziksel hedef / 3 RHS / 1 factor / 2 reuse | 3 elektriksel driving-point hesabı; NETWORK_APPROXIMATION |
| SC kaynak varsayımları | 1.717 assumed / 257 native kaynak | Eksik makine x″=.2 pu, r=.01 pu; converter −90°, terminal baz ve nominal normalizasyon açık seçildi; IEC düzeltmeleri yok |
| SC 2016 isteği | 3/3 BLOCKED; 0 factor/RHS; Ikss/Skss/Ip/Ib/Ith null | Normatif tamamlanma kapısı korunuyor |
| PF sertifikalı karşılaştırma | LF=0, N-1=0, SC=0 | Kontrol/yöntem, PF tam POST matrisi ve partition/IEC kanıtı eksik; normatif hata istatistikleri null |

N-1 iki POST residual'ı 1.0641420383761258e-8 ve 2.0406016459917353e-8 MW. Bunlar yalnız sayısal çözüm kanıtıdır. Fiziksel kaynak doğruluğu ve PF paritesi sağlamaz. SC tanısal Ikss/Skss sayısaldır; Ip/Ib/Ith null ve desteklenmiyor. Native veya normatif blocked sonuçlar sıfır akım ya da uygun ekipman diye gösterilmez.

## Sınırlar

Bu görev SN7 özgün S2'yi yeniden üretmedi. Önceki SN7 S2 kabulü özgün manevra defteri değil, yeni kontrollü test senaryosuydu. SN3/SN4'ün önceki tanısal N-1/SC sonuçları da IEC/PF paritesi sağlamaz. Bu sürümün yeni gerçek çalışması yalnız yukarıdaki sınırlı SN3 kabulüdür; eski PASS'lar yeni gerçek SN4/SN7 hesabı gibi sunulmaz.

Tam native station/droop/P dengeleme, IEC KT/KG/KKW ve kaynak katkıları, Ip/Ib/Ith, sekans/topraklama, motor modelleri ve gerçek ekipman anma verisi kapsamı tamamlanmamıştır. Ayrı LF çekirdek önerisi `03_NATIVE_N1_METHOD.md`, normatif engeller `04_IEC60909_2016_METHOD.md` içindedir.
