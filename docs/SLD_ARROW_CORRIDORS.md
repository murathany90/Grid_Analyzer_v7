# SLD kolon / ok / koridor düzeltmesi — NO MERGE

Yeni dal: `codex/sld-arrow-corridors`; taban `a653967`. Yalnız SLD çizim katmanı değişti.
TM/FID özel kuralı, model/anahtar/hesap motoru değişikliği yok.

- Normal çıkışlar önce yerleştirilir ve kendi native x kolonunu terk edemez. Metin alanı gerçek fontla ölçülür.
- İsim + MW/MVAr bloğu gerçek oka bağlanır; etiket uğruna çıkış başka hücreye taşınmaz.
- Şöntün sağa açılan gerçek koluna tek taraflı alan ayrılır; simetrik boş koridor rezervi küçültülür.
- Trafo adı/MVA gövdenin hemen altında, eksenin 8 birim solunda biter; sonuçlar sağda kalır. Sekonder ekseni ve gerçek kontaklar korunur; optik kesinti veya sahte T eklenmez.
- Sekonderler ortak kaynak uçlarını koruyarak caption altındaki geçiş düzleminden gider. Yabancı bara geçişleri mevcut ayrı koridorlarını kullanır.
- Kuplaj etiketi kendi hücresinde tutulur; sonraki gerilim alanına düşmez. Gerçek komşu OG bara aralığını başka gerilimdeki bir bara engelleyemez.

| Örnek | Taban a653967 W×H | Yeni W×H | Alan değişimi |
| --- | ---: | ---: | ---: |
| Diana Otel GES | 874×1830 | 686×1462 | −%37,3 |
| Akköprü | 3390×1848 | 2624×1462 | −%38,8 |
| Derinkuyu | 1966×1884 | 1662×1498 | −%32,8 |
| Konya Kuzey | 2718×2778 | 1846×2120 | −%48,2 |

Aynı SN3/B0 önbelleğiyle 1366×768 ve 1920×1080 FIT görselleri incelendi.
Önceki `025c3b7` ile çizilebilen üç örneğin alanı da küçüldü; Derinkuyu bu eski dalda aynı kaynakla `SLD_ROUTE_BLOCKED` veriyor.
Dört yeni örnekte native envanter/durumlar ve LF görünürlük geometrisi aynı; metin çakışması,
açık kontak köprüsü, kayıp kaynak iletkeni ve yabancı net teması kontrolleri sıfır hata.
Normal hat çıkışının kolon sapması 0; ok–tam etiket bloğu aralığı 21–23 birim.
Bu dört örnekle sınırlı görsel kontroldür; tam şebeke taraması yapılmadı.

Tip denetimi ve ilgili mevcut 27 unit test geçti; son OG aralık düzenlemesinden sonra
ilgili 12 test tekrar geçti. Testler/oracle/eşikler değiştirilmedi. Portable build ve geniş benchmark çalıştırılmadı.

Yerel galeri, önce/sonra SVG/PNG ve ölçümler: `local-benchmark-results/sld-arrow-corridors/GALLERY.html`,
`COMPARE-M*.png`, `CHECKS.json`. Gerçek şebeke görselleri Git'e eklenmedi.
**Main'e merge yok; kullanıcı görsel onayı bekleniyor.**
