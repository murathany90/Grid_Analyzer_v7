# Sargı portları ve hesap kapsamı

Trafolar sağdaki ortak köprü yerine kendi native HV/LV terminal konumları arasına çizilir. Barasız GSU/jeneratör devresinin tamamı bağlı olduğu HV fideriyle hizalanır. Paralel trafolar ayrı FID ve semboldür; gerilim oranından ototrafo sınıfı çıkarılmaz.

Gerçek kabul: Hotamış 154/33,6, M1301 400/17 ve ek gerçek 400/154 istasyonu. HV/LV uçları ham ElmTr2 bushv/buslv → StaCubic fold_id ile karşılaştırıldı. 400/154 fixture içinde her iki gerilim grubunun native anahtarları ve açık/kapalı durumları korunur; gerçek LF P/Q/I, yüklenme, kademe görüntüsü yerel kabul çıktısında bulunur.

TypTr2 anma gerilimi işletme barasıyla eşitlenmez: M1301 kaynak tipinin HV anması 380 kV, bağlı barası 400 kV'dir. Ham MVA, sargı bağlantı kodları, Uk, Pcu/P0, tap tarafı/aralığı ve kaynak alanları Elektriksel / Kaynak ve kalite kartlarında ayrıdır. Kanonik R/X ve tap, solver dönüşümü ve sourceRefs ile birlikte gösterilir. Kaynakta faz bilgisi yokken kanonik 0 doğrulanmış kaynak fazı sayılmaz.

| Kapsam | Durum |
|---|---|
| Kaynak portlu iki sargı görünümü ve 400/154 bağlantısı | PASS |
| 400/33, 400/17, 154/33,6, 154/34,5 kaynak değer sözleşmesi | Native alanlar; mevcut hesap modeli korunur |
| Ototrafo tipi | PARTIAL: mevcut DGS profilinde doğrulanmış ayırt edici alan yok |
| ElmTr3 kaynak portları | Fiziksel cubicle uçları varsa gösterilir; eksikler sayılır |
| Üç sargı elektriksel hesap | UNSUPPORTED; iki sargı denklemi icat edilmedi |
| Gerçek ototrafo/3W kabul | NOT_AVAILABLE; gerçek örnek iddiası yok |

transformer-presentation ve bağımsız 400/154 / 400/154/33 fiziksel sözleşme testleri bu sınırları korur. Sembol kütüphanesi CT/VT, parafudr, topraklama, trafo, jeneratör, yük, reaktör/kapasitör ve çıkış destekler; kaynakta bulunmayan cihazlar otomatik yerleştirilmez.
