# SLD V3.5 — bara/fider yerleşim kurtarma: Aşama 1 teslimi

**Dal:** `fix/sld-v35-bus-layout-recovery` (V3.4 `f85040b24854757ad2ad6cdaa4b098600e40d723` üzerine)
**Kapsam:** yalnız üç gerçek merkez — M937 Karapınar, M1482 Kayaş, M890 Temelli.
**Durum:** **PARTIAL — görsel kabul kullanıcı onayına açık. Main'e merge/push yapılmadı.**

## 1. Düzeltilen kök nedenler (yalnız `connectedStationLayout`)

| V3.4 kodu | V3.5 |
|---|---|
| `packed.flatMap(r=>r.upper/lower)` ile paketlenmiş satırların tek satıra yeniden yığılması (ray başına `barY+i*64` ikinci kez basıldığı için tek satır zorunluydu) | `partitionFeederSides()` tek seferde üst/alt bölmeyi verir; `packFeederRows` çıktısı artık ray geometrisine girmez, dolayısıyla ikinci bir ray basılmaz. `packFeederRows` test sözleşmesi için aynen korunur. |
| `feederAreaUnits(kv)*44` ile 400/154 kV'de 176, `88+branchCount*24` ile dal sayısından türetilen genişlik, `240*ElmTr` ile 480'lik bank kompartımanı | `feederCellWidth(slot,demand)`: yalnız **ölçülmüş kaynak talebi** — gerçek bara ankrajı, gerçek kollar (off-spine *kök* sayısı), paralel sargı sayısı, kanıtlı bara devresi uzunluğu ve o gerilimde çizilen etiket genişliği. |
| MV'de `upper` yalnız trafo sekonderi, **her şey altta** (`kv<=36` filtresi) | MV üst/alt satırları genişliğe göre dengelenir; trafo sekonderi üstte kalır. YTBS referansındaki "fiderler baranın altında üstünde" düzenine uyar. |
| `while(...) x+=16` ile tek fiderin ankrajı kompartımandan dışarı itiliyordu; `anchors` tablosu `barLanes` ile **farklı** koordinatlar tutuyordu | Tek atomik plan: genişlikler ölçülür, sonra **gerçek bara ankrajları** (bir ray için tüm gerçek uçlar dâhil, kardeş grup baraları dâhil) rezerve edilir. Çakışma yalnız **sonraki hücrenin tamamını** kaydırır; çizilmiş bir kontakt, sembol veya ray sonradan oynatılmaz. |
| `barY+i*64` sabit ray aralığı | `railGap = 40 + 20 × maxGerçekAnkraj` (bu merkezlerde 3 ankraj → 100). Sabit 28/64 kullanılmıyor; değer gerçek ek demdemandından türetiliyor. |
| Kardeş bara grubuna (ör. 33.6 kV `TR-A` → `TR-B` bara bölücü kesicisi) hiçbir ankraj rezervasyonu yoktu → iki fider aynı noktaya biniyordu | Kapsam `levelBars` ile gerçek bara FID'lerine genişletildi; kardeş gruba giden kanıtlı bara devresi o rayın kendi kotunu ve rezerve edilmiş bir şeridini kullanır. |

## 2. Ölçülen sonuç (aynı kaynak model / senaryo / anahtar durumu)

| Merkez | V3.3 | V3.4 | **V3.5** | Hedef |
|---|---:|---:|---:|---|
| M937 Karapınar | 1306×1810 | 1538×2030 | **1098×2046** | ≤1437 ✔ |
| M1482 Kayaş | 1322×3238 | 1786×3024 | **1266×3168** | ≤1454 ✔ |
| M890 Temelli | 1354×3898 | 3762×3152 | **1674×3408** | ≤1700 ✔ (V3.3'ten +%23.6) |

En uzun ray: Karapınar 656→888, Kayaş 760→1056, Temelli 1128→1464 (V3.4: 1084 / 1528 / 3552).

Tarayıcı kanıtı (aynı `sld-v34` gerçek kabul araç zinciri, `tools/sld-v35-real.mjs`):

| Merkez | ray | sahte ray | devam rayı | yalancı ray teması | bara üstü atlama | fider | fiziksel anahtar | cihaz/etiket çakışması | metin hatası | seri zincir hatası | paylaşılan ankraj |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| M937 | 4 | 0 | 0 | 0 | **0** | 27/27 | 73/73 | 0 | 0 | 0 | 0 |
| M1482 | 8 | 0 | 0 | 0 | **0** | 30/30 | 128/128 | 0 | 0 | 0 | 0 |
| M890 | 10 | 0 | 0 | 0 | **3** | 57/57 | 267/267 | 0 | 0 | 0 | 0 |

Keskin kabul ölçütleri: kaynak FID kaybı **0**, sahte bağlantı **0**, seri kontak kopması **0**, sahte devam barası **0**, gizlenmiş fider **0**, aynı gerçek düğüm tekrarı **0**, etiket/cihaz çakışması **0** — üç merkezde de sağlandı.

## 3. GERÇEK BAŞARISIZLIKLAR (gizlenmedi)

1. **Temelli'de 3 bara-üstü atlama işareti kaldı.** Üçü de `B5685` (34.5 kV TR-B) rayının **sağ ucunun hemen dışında** (x=1631.5 / 1635 / 1638.5, ray x2=1624); `B92875/B92876/B92879` trafo sekonderi koridor telleri, `B9014` (aynı grubun B-T rayı) bağlantı kaçışını geçiyor. Çizilen bara **içinden hiçbir iletken geçmiyor** (`falseRail=0`). Ray aralığı ölçülerek 60→66→80→100→140 denendi: 60 `SLD_BAR_ESCAPE_BLOCKED` veriyor, 140'te 4 atlama ve +%8 boy. 100 birimde 3 atlama ile duruldu. V3.4'ün 3 atlamasıyla aynı; **kabul kriteri "bara üstü hop = 0" bu madde için sağlanmadı.**
2. **Temelli genişliği V3.3'ün %23.6 üstünde.** V3.3 bu genişliği 150 hop ve 6 sahte "devam" rayıyla almıştı; aynı genişlik kaynak doğruluğu korunarak alınamıyor. Mutlak hedef (≤1700) sağlandı.
3. **Koridor/zarf görünümü.** 400/154 kV ray bantlarında iç raylara ulaşan teller ray ucundan dolanıp geniş dikdörtgen zarf çiziyor. YTBS referansı bunları ray *arası* kısa 90° dönüşle çiziyor. Elektriksel olarak doğru ve hop'sız, görsel olarak referanstan uzak. Bir sonraki aday: iç ray bağlantısını grup dışına çıkarmadan ray arası koridorda çözmek.
4. **Faz 3 kapıları henüz koşmadı:** `tests/unit/portable-byte-provenance.test.ts` (taşınabilir blob ham bayt hash'i) kaynak değiştiği için **1 test/566** başarısız; 4 E2E, `build:portable` ve exact-feature CI görsel onaydan sonra çalıştırılacak. Diğer 565 test geçiyor, `npm run lint` ve `npm run typecheck` temiz.
5. Kaynak modeller, hesap sonuçları ve üretilen SVG/PNG/HTML `local-benchmark-results/sld-v35/` altında `.gitignore` kapsamında tutuldu; Git'e **hiçbir özel model/sonuç dosyası girmedi.**

## 4. Yeniden üretim

```
node --import tsx tools/sld-v35-layout-probe.ts       # tarayıcısız ray/atlama/çakışma ölçümü + bus-fid-rails.csv
node tools/sld-v35-real.mjs                          # gerçek SVG + UI-FIT PNG + kanıt (M937,M1482,M890)
node tools/sld-v35-png.mjs                           # tam çözünürlüklü RENDER-*.png
node tools/sld-v35-comparison.mjs                    # çevrimdışı V3.3/V3.4/V3.5 tek dosya HTML
node --import tsx tools/sld-v35-demand-probe.ts      # kaynak talebi dağılımı
```

Yeni regresyon testleri: `tests/unit/sld-v35-bus-layout.test.ts` (6 test) — tek ray/FID, ray sınırının hücre toplamıyla sınırlı kalması, MV'nin iki satırı, hücre genişliğinin ağırlıktan değil gerçek bağlantıdan gelmesi, ray aralığının sabit olmaması, ankraj benzersizliği ve önceden planlanmışlığı.

## 5. Korunanlar

Anahtar kontak sırası, gerçek bara FID tekilliği, ok renkleri, P/Q/U/I kartları ve kapıları, güvenli fider toplu aç/kapat (DS-CB-DS sırası, BLOCKED), STALE→Full AC→B0, kaynak değişmezliği, mevcut UI araçları ve tüm 565 geçen test değiştirilmedi.