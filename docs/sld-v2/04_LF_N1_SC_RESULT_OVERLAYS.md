# Sonuç katmanları ve provenance

Yeni bir LF/N1/SC hesap motoru yoktur. Katman mevcut immutable sonuçların sunum projeksiyonudur; kimlik uymazsa değer üretmez.

| Sunum | Sahip / zorunlu kanıt | Eksik kanıtta davranış |
|---|---|---|
| LF | ResultStore; exact model/scenario/type/engine/version/options; aktif settings hash + kontrol bağlamı | STALE / NOT_RUN, boş sayısal katman |
| LF Senaryo−Baz | Seçili saklı referans; mevcut scenarioLfComparison partition/açı referansı/kapasite kapıları | Uyuşmayan hücre null; bilinen servis dışı sıfır ayrı kaynak gerekçesi |
| N1 AC | Mevcut seçili manual > hybrid owner; aynı model/scenario/settings/case | Reddedilen güncel POST eski sayılara düşmez |
| N1 DC | Seçili güncel tarama; yalnız mevcut P ve tahmini yük | Q/U/I null; DC_SCREENED / AC_UNVERIFIED |
| SC | Model/scenario/profileHash/sourceHash; tekil fiziksel fault/alias | STALE veya eşleşmeyen fault için sayı yok |
| IEC 2016 | Mevcut normatif yöntem kapısı | BLOCKED; Ikss/Skss de null |

LF iki uç P/Q/S/I, fiziksel uç FID ve anma/işletme U, loading baz/mevsim/limit, P/Q kaybı ve kademe bilgisi taşır. Yerel giriş/çıkış oku native terminal FID'sine göre ilgili solver pf veya pt işaretinden gelir; TO = -FROM tahmini yapılmaz. Aynı TM'nin iç hatlarında her iki gerçek port bağlantısı çizilir. Kayıp pf+pt / qf+qt; sıfıra zorlanmaz. Bilinmeyen kapasite eski placeholder yüklenmesine düşmez. Bara nominal tabanı ve açı referansı uyuşmazsa hücre gizlenir. Jeneratör gerçek P/Q ve Q sınırları/modu gösterilir.

N1 BASE/POST/CHANGE aynı case owner's projeksiyonudur. Full AC yokken DC sonuç AC diye etiketlenmez; AC verified/unverified sayaçları değişmez. SC Ikss/Skss yalnız CALCULATED_NETWORK_APPROXIMATION + doğrulanmış profil/sunum kimliğinde görünür; Ip/Ib/Ith null kalır. Tanısal değerler IEC/PF paritesi değildir.

Gerçek SN3 LF ve önceki çalışmanın taze SN4 LF/N1/SC kayıtları yeniden hesaplanmadan render edildi. SN4 N1 ekranı PARTIAL_SOLUTION; SC ekranı NETWORK_APPROXIMATION / IEC-PF PARITY_UNVERIFIED. Render harness solver/import isteklerini yasaklar. Gerçek modeller/sonuçlar ve ekran görüntüleri local-benchmark-results altında kalır.
