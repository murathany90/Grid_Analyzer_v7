# Yerleşim, etkileşim ve performans

Modlar: YTBS klasik, teknik tek hat, LF, N1, SC, bara/anahtar işletme, kompakt. Yatay native baralar ve dikey anahtar/fider zincirleri korunur; barasız GSU devresi fiziksel bağlı HV koluna hizalanır. Gerilim paleti ayarlardan gelir; işletme durumu, kaynak değişikliği ve analiz alarmı ayrı işaretlerdir. Gerilim rengi enerjilenme kanıtı değildir.

Sonuç etiketleri ve oklar bağımsız aç/kapat; teknik FID; pan/zoom/fit/seçime odak; tam logical-fit SVG export. Sonuç modları port konumlarını değiştirmez. Fider yönü ve bölgesel mevcut görünüm korunur. Mobil toolbar wrap ve uzun ham alanlarda taşma önlenir. 390/768/1366/1440/1600/1920 viewport overflow kontrolü PASS.

M1301, aynı SN3/source/result verisi, aynı teknik checkbox olayı, iki warmup + 10 örnek, browser performance.now → tamamlanmış SVG mutation. Playwright roundtrip dahil değildir:

| Ölçüm | c8ee28b | SLD V2 |
|---|---:|---:|
| Median redraw | 1,5 ms | 3,2 ms |
| Max redraw | 2,0 ms | 3,7 ms |
| Normal mod SVG elemanı | 407 | 548 |
| Farklı fiziksel anahtar | 31 | 50 |

Hızlanma veya DOM küçülmesi iddiası yoktur. İlave gerçek port ve önceden atlanmış anahtarlar taşınır; tekrarlar giderilirken içerik genişledi. Bu makinedeki ölçümde maksimum redraw bir 60 Hz frame süresinin altında kaldı; büyük TM performansı evrensel garanti değildir. Overlay immutable snapshot cache'i model/scenario/settings/source/profile/capacity/referans değişimlerinde yenilenir.

Yerel before/after SVG/PNG ve ölçüm receipt'leri tools/sld-real-ui.mjs ile üretildi; gerçek veriler yayımlanmaz.
