# SLD kontrollü düzeltme — NO MERGE

16.10.2026 · Dal `codex/sld-compact-controlled`, taban `a6539676543dde4cfa84f9e48f533197fbc52ecd`.
Başarısız `eb957df` taban alınmadı; yalnız kısa OG bara aralığı kontrolü taşındı.
Eski checkout'taki değiştirilmiş portable HTML ve kullanıcı girdileri korunarak ayrı worktree kullanıldı.

**Karar: Pilot kabulü başarısız; çizim geliştirmesi durduruldu. Main'e merge yok.**

| TM | Main W×H | a653967 W×H | Yeni deneme W×H |
| --- | ---: | ---: | ---: |
| Akköprü M892 | 2606×1635 | 3390×1848 | 2640×1556 |
| Sincan M889 | 3522×2336 | 4446×2814 | 3554×2430 |
| Kayaş M1482 | 1726×2299 | 2526×2778 | 1726×2304 |
| Kayseri Kapasitör M922 | 1606×2204 | 3038×2826 | 1606×2442 |
| Ortaköy M1388 | 1530×1492 | 1946×1848 | 1546×1556 |

**Kök neden:** WIP'nin etiket komşuluğu kontrolü, etiketin kendi çıkışı yerine farklı gerilimdeki
bir trafonun gövdesini referans alıyordu. Bu yerel hata genel `spacing` artışını tetikliyordu:

| WIP pilotu | spacing 1 engeli | spacing 1,5 / 2 engeli | Sonuç |
| --- | --- | --- | --- |
| Sincan | F9377 etiketi → C69081 (B59118→B86385) | F10843 → C69099 (B51111→B78378) | spacing 3; 9999×3916 |
| Kayseri | F8484 etiketi → C59823 (B65637→B92904) | F8483 → C69106 (B65430→B92697) | spacing 3; 3718×4024 |

Yeni denemede genel spacing yeniden denemesi kaldırıldı; geometri tek spacing=1 ile çizildi.
Etiket kendi çıkışına bağlandı; metin/cihaz ihtiyacı ölçülerek rezervler daraltıldı.
26 trafonun native terminal FID'leri ve gövdeye göre gerçek kontak konumları
(`±18` dahil) a653967 ile aynı kaldı. Caption altından aynı eksende devam için optik boşluk denendi.
Ancak mevcut bağımsız oracle, 26 trafo sekonderinde `Missing shared source interval` bildiriyor:
görünür süreklilik kanıtı tamamlanmadı. Bunu PASS saymak için oracle/test eşikleri değiştirilmedi.

Beş pilotta anahtar FID/FROM/TO/durum ve ekipman terminal envanteri aynı;
LF aç/kapat geometri kontrolü aynı. Yabancı-net teması, kollinear yabancı iletken veya açık kontak
köprüsü raporlanmadı. Bu, eksik görünür iletken kanıtını ortadan kaldırmaz.
Fider ok–tam etiket bloğu aralığı 25–27 birime indi. Buna rağmen Akköprü'de dört metin çakışması,
Sincan'da iki metin–iletken çakışması ve bazı dar hücrelerde metin taşması var.
Sincan F15822/F18370'te bazı kaynak yolları hâlâ Manhattan'ın 4,04 katı.
Beş merkezin her biri main'in en az bir W/H sınırını aşıyor. **Okunaklı kompakt şema hedefi tamamlanmadı.**

Aynı SN3 07.10.2026 14:00/B0 LF önbelleği kullanıldı; hesap yeniden çalıştırılmadı.
Önbellek SHA-256 `7743ca0a02de4f89b85dc483ff4a070a54ea02f6c64cf554c3e06b0c3608e191`.
Model/FID/hesap motorları, mevcut testler ve oracle değişmedi. Pilot kapısı başarısız olduğundan
unit, browser smoke, portable build ve CI kabul turuna geçilmedi; tam ağ taraması yapılmadı.
Portable yeniden üretilmedi. Push'ın mevcut otomatik CI tetikleyicisi değiştirilmedi.

**Yerel kanıtlar:** `local-benchmark-results/sld-compact-controlled/`: `GALLERY.html`,
beş `COMPARE-M*.png` (yan yana 1366×768 FIT), tam MAIN/BEFORE/AFTER SVG'leri,
`COMPARISON.csv`, FID başına native port/kontak/path/segment/uzunluk/Manhattan oranlarını içeren
`FEEDER-ROUTES-private.json/.csv` (193 fider × 4 sürüm), `NATIVE-CONTACTS-private.json`,
`ELECTRICAL-private.json`, `ROOT-CAUSE.log` ve spacing başına iki pilotun draft geometrileri.
Gerçek şebeke çizimleri/FID dökümleri Git'e eklenmedi. Commit yalnız başarısız WIP kaydıdır.
