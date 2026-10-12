# Fiziksel anahtar ve bağlantı düzeltmeleri

Çizim artık feederSwitchPaths yollarını tekrar tekrar sembole dönüştürmez. Her kaynak switch kendi native uç çiftiyle bir kez çizilir; fiziksel anahtar anahtarı sourceClass + sourceId'dir. Cubicle switch bir bara birleştirme kenarı oluşturmaz. aUsage cbk/dct korunur; diğer kullanım sınıfı kesiciye dönüştürülmez. OPEN / CLOSED / OUT_OF_SERVICE / UNKNOWN ayrı durumları vardır.

Native terminal noktaları paylaşılır; bara, bay terminali, ekipman terminali, ekipman ve cubicle kaynak referansları korunur. Kullanımı eksik terminalden bara tahmin edilmez. Çift bara, transfer bağlantısı, iki selector / tek kesici, çift kesici, bir buçuk kesici, açık kuplaj, bölme ve paralel kaynak yolları bağımsız sentetik topoloji testleriyle korunur. Mimari adından çıkarım yapılmaz.

| Gerçek istasyon | Kaynak anahtar | Eski farklı kimlik / sembol | Yeni farklı kimlik / sembol | Tekrar giderilen |
|---|---:|---:|---:|---:|
| M1583 | 75 | 75 / 75 | 75 / 75 | 0 |
| M1301 | 50 | 31 / 38 | 50 / 50 | 7 |
| Ek 400/154 fixture | 276 | 268 / 352 | 276 / 276 | 84 |

M1301: C96797, C96796, C97000, C69217, C69216, C109126, C69420 tek sembol. Toplam 91 tekrarlı sembol kaldırıldı; önce görünmeyen gerçek anahtarlar da gösterildi.

Kaynak hata kayıtları kind/class/FID/field/reference/reason taşır. Sayaçlar: invalidSwitchEndpoints, unresolvedFeederTerminals, unresolvedEquipmentConnections, missingCubicleReferences, ambiguousBusSections, unsupportedEquipmentConnections; diagramUnresolvedTotal kayıt toplamıdır. M1301'in altı eski yanlış uyarısı mevcut jeneratör–trafo terminal ve switch zincirleriyle çözüldü. Üç kabul istasyonunda tüm sayaçlar 0; eksik kaynak sentetik testlerinde pozitif kalır.

Kabul yalnız sembol sayımı değildir: SVG from/to → ham ElmCoup bus1/bus2 → StaCubic fold_id kontrol edildi; SVG'den switch durumlarıyla yeniden oluşturulan tüm şebeke electrical-topology çıktısı başlangıçla eşittir. Hiçbir güç sistemi kenarı eklenmedi/silinmedi. Araç: tools/sld-real-acceptance.ts.
