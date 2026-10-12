# Gerçek istasyon kabulü

Gerçek SN3 kaynak ZIP'inden native katalog/canonical projeksiyon; SN3 mevcut actual LF ve SN4 önceki görevde taze üretilmiş LF/N1/SC snapshot'ları kullanıldı. Çizim görevi real LF/DC/N1/SC denklemlerini yeniden çalıştırmadı. SN4 kaynak modeli ayrıca doğrulanmış snapshot model hash'iyle eşleştirildi; source/result hash uyuşmazlığı harness'i durdurur.

| Kabul | Sonuç | Kanıt |
|---|---|---|
| Hotamış M1583 | PASS | 75/75 anahtar, 154/33,6, iki native HV/LV trafo portu, actual LF uç değerleri |
| İç Anadolu DGKÇ M1301 | PASS | 50/50 anahtar, 3 native 400 bara, 3 GTR; 7 tekrar giderildi; 6 yanlış uç uyarısı çözüldü |
| Ek gerçek 400/154 istasyonu | PASS | 276/276 anahtar; native primary/secondary cubicle eşleşmesi ve actual LF/tap |
| Tüm şebeke iletkenlik eşdeğerliği | PASS | SVG switch from/to/service/closed ile yeniden kurulan buildTopology aynı |
| Karapınar karşı TM / dönüş / aynı FID | PASS | H5084, M1583 → M937 → M1583 |
| SN4 N1 actual POST | PASS sunum | PARTIAL_SOLUTION / HYBRID_FULL_AC; kontrol paritesi iddiası yok |
| SN4 SC actual tanısal | PASS sunum | CALCULATED_NETWORK_APPROXIMATION; IEC/PF paritesi yok |
| Gerçek 3W/ototrafo hesap kabulü | NOT_AVAILABLE / UNSUPPORTED | Kaynak profili ve native hesap desteği eksik |

Üç ana istasyonda tüm kaynak sorun sayaçları 0. Sentetik eksik uç/cubicle/iUsage testlerinde aynı sayaçlar doğru şekilde pozitiftir. Kabul yalnız SVG kimlik sayısı değil ham ElmCoup/ElmTr2 cubicle zinciri ve tüm canonical iletkenlik çıktısı üzerinden yapılır.

Son native akış yönü kontrolü her yerel line port FID'sini gerçek LF pf/pt kaydına bağlar. SN3 üç istasyonunda 12 hesaplanmış hat ucunun giriş/çıkış oku PASS; SN4 aynı kontrollerden PASS geçti. Eksik/0 uç gücüne ok üretilmez. Aynı TM'de iki uçlu hat bağlantısı public synthetic browser fixture'ında ayrıca doğrulandı; 12 gerçek uç testi bu iç hat örneği gibi sunulmaz. Δ etiketleri MW/MVAr/A ve yük farkı pp olarak ayrıdır.

tools/sld-real-acceptance.ts ve tools/sld-real-ui.mjs özel çıktıları ignored local-benchmark-results/sld-v2-20261013 altında saklar. Gerçek model ZIP'i, ağ JSON'u, PF çıktısı, SVG ve ekran görüntüsü GitHub'a eklenmez. CI public sentetik sld-browser-smoke ile etkileşim ve export invariants'ı doğrular.
