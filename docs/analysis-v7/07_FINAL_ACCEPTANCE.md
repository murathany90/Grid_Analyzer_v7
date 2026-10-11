# Son kabul — Analizler / native N-1 / IEC 2016

Teslim durumu **PARTIAL**. Çalışan LF/DC motorları korunarak arayüz, kontrol doğruluğu, gerçek kapsam sayacı, kullanıcı işletme limitleri ve SC yöntem sınırı geliştirildi. Tam native kontrol desteği ve normatif IEC 60909-0:2016 tamamlanmadı. Bağımsız normatif kanıt kapısı kapalıdır; tanısal hesaplar IEC/PF paritesi diye yeniden etiketlenmez.

Başlangıç ve korunan main: `9b1eee94d5ef4548716611fc5447f07727c41d51`. Çalışma dalı: `feat/analysis-ui-native-n1-iec60909-2016`. Main'e merge/push yapılmaz; bu prompt ayrıca onay gerektirir. Dallar/tag'ler otomatik silinmez. Başlangıç main'in bağımsız CI'ı [38169566522](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38169566522) başarılıdır; bu feature CI yerine geçmez.

## Kabul matrisi

| Kapı | Durum | Kanıt / sınır |
| --- | --- | --- |
| LF/DC çekirdeği ve defaults | PASS | Korunan modüller başlangıç main'e göre byte-identical kaynak; 398 mevcut test korunuyor |
| Native N-1 matematik / kimlik / topoloji / kısıt | PASS | Bağımsız radyal POST, paralel, ring, trafo, ada/reference, 33 kV direct AC, false-negative, budget/cancel/resume, rating/endpoint ve regional limit regresyonları |
| Native N-1 tam station/droop/P dengeleme | PARTIAL | Gerçek SN3 30 unsupported ve 6 missing source Q sınırı; 2/660 native POST sayısal, 0 tam AC verified |
| SC matematiksel pozitif bileşen yaklaşımı | PASS | Legacy Ikss/Skss korunur; sparse RHS fiziksel alias reuse yeni doğrulandı |
| IEC 60909-0:2016 normatif motor | BLOCKED | Yetkili metin/bağımsız çözümlü örnekler ve KT/KG/KKW, kaynak/decay/kappa/termik yöntemler kabul edilmedi |
| Ip/Ib/Ith, LL/1LG/2LG | NOT_IMPLEMENTED / BLOCKED | Distinct quantity reasons ve null; açma/termik zaman ayrı girdi; sekans/topraklama kapalı |
| Ekipman uygunluğu | PARTIAL | Ayrı Ib/Ip/Ith/rated-voltage/time API test edildi; native rating adapter/UI tamamlanmadı |
| Analizler UI / harita / ⚡ / SLD | PASS | Dört masaüstü boyutu ve mobil; üç sütun, bounded tablo, export, odak, klavye, iptal/recovery |
| Gerçek SN3 | PASS_WITH_PARTIAL_N1_AND_BLOCKED_NORMATIVE_IEC | Ayrıntı 05 belgesinde; gerçek işlem artifact'i son yalnız UI commit'inden ayrı hash ile izlenir |
| Gerçek SN4 / SN7 yeni hesap | NOT_TESTED | Bu görevde yeniden yüklenmedi; eski tanısal sonuçlar yeni kabul sayılmaz |
| PF normatif parite | BLOCKED | LF/N-1/SC comparable=0; sertifikalı hata istatistiği null, tanısal ayrı |
| `npm ci` | PASS | Transitive dev source-map-js 1.2.2 hedefli lock düzeltmesi; 0 vulnerability |
| typecheck / lint | PASS | 283 source file |
| unit + regression | PASS | **414/414, fail 0, skip 0**; yeni 16 test ve mevcut 398 |
| E2E | PASS | Chromium, PF benchmark, map/lightning olmak üzere üç suite |
| standard / portable build | PASS | Tek HTML, mevcut offline worker/import mimarisi korunur |
| `test:full` control1 harness | SKIPPED / SOURCE_UNAVAILABLE | Tracked control1 gerçek fixture içermiyor; ayrı gerçek SN3 çalışma yukarıda, bu skip PASS değildir |
| Portable raw-byte gate | PASS yerel | Committed HTML ve yeniden derlenen HTML SHA-256 eşleşir; CI aynı kapıyı çalıştırır |
| Feature CI | Görev kapanışında exact SHA ile doğrulanır | [Dal CI](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Afeat%2Fanalysis-ui-native-n1-iec60909-2016); son SHA/run bağlantısı kapanış mesajında |

## Teslim portable

SHA-256: `3cd43b322a42e1a0a3d37113fd3ea84b42d8d4f23d795bdbb70a82f835cc6831` — 1,676,464 byte. Bu hash kaynakla byte-for-byte bağlıdır. Gerçek hesap proof'u: `314f49d4c15da03b21c219926f29d135d241902f3ad4a77d3f3c0b057d014d25`; sonraki tek fark karşılaştırma istatistik paneli/JSON sunumudur. Hesap kaynakları değişmedi; son artifact'ın çevrimdışı sentetik kabulü ayrıca çalıştırıldı. Gerçek ağ tekrar import/hesap yapılmadı.

## Hata düzeltmeleri ve koruma

Dar ⚡ tablo yüksekliği, yinelenen gizli hesap formu ve eski testlerin STRICT/PARTIAL beklentileri hedefli giderildi. Önce yalnız başarısız testler, ardından tam kabul çalıştırıldı. Test silme/skip/eşik gevşetme yok. LF/AC matematiksel çekirdeği veya DC screening değişmedi. Portable provenance testi ve CI raw byte kapısı korunur.

Yerel yeni IEC ZIP'i kullanıcının dosyası olarak korunur; özel paket/model/PF verileri commit edilmez. Yalnız redakte belgeler, kod, sentetik testler ve portable artifact teslim edilir. Uzak ön envanter yalnız main ve mevcut `pf-parity-v2-validated` tag'ini gösterdi; son feature push yeni dal ekler. Bu görev araştırma/feature dallarını veya tag'leri silmez.

Kalan gereken işler: kaynak-exact native kontrol desteği için ayrı LF önerisinin bağımsız testlerle uygulanması; yetkili 2016 applicability/denklemler ve çözümlü örnekler; kaynak düzeltme/katkı, meshed kappa, Ib/Ith, sekans/topraklama/motor ve cihaz anma adapter'ı; gerçek PF POST matrisleri ve aynı elektriksel partition/yöntem/ayar kanıtı. UI başarısı bu kapıları açmaz.
