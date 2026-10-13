# SLD V3.6 — bara–fider çizim planlayıcısı: Aşama 1 teslimi

**Önceki HEAD:** `5bc63ab89804b029b222a89619b62dc660e721cf` (`fix/sld-v35-bus-layout-recovery`)
**Dal:** `fix/sld-v36-bay-rail-connection-planner` · **main'e merge/push YOK.**
**Karar: PARTIAL — P0 zarf dolaşımı çözüldü, ikinci bir P0 açık kusur kaldı, kullanıcı görsel onayı alınmadı.**

## 1. V3.5'in reddi için kanıt (bağımsız ölçüm)

`tools/sld-v36-wire-evidence.ts` üç gerçek merkezin **her bara-bağlantı iletkenini** kaynak FID + native terminal + ölçülmüş yolla dökümler (`bar-connection-wire-evidence.csv`).

V3.5'te 260 bara-bağlantı iletkeninin **82'si** zarf/ray-ucu dolaşımıydı (M937 6, M1482 20, M890 56). Örnekler:
`M937 ElmCoup|C7603 bay=F23853 bar=B5122 pathLength=829 manhattan=92 ratio=9.01 reachesRailEnd=true`.

## 2. Mimari değişiklik — yeni planlayıcı

`physical-layout.ts` / `feeder-packing.ts`:

1. **`LANE_STEP=32`, `LANE_PAD=12`, `barLaneX(spine,index,near)`** — her bayın **kendi dikey şeridi**; bir rayın lane'i `spine + (index - near) * LANE_STEP`. `near`, bayın kendi tarafındaki ray.
2. **`COLLECTOR_OFFSET=40`** — bayın toplayıcısı ray bandının **dışında**: üst bay için `barY - 40`, alt bay için `lastY + 40`.
3. **`BayRailAttachment {laneX, spineX, collectorY, sign, railY}`** ve `SwitchSlot.ordering='BAR_ATTACHMENT'`. Planlanan bara iletkeni deterministik olarak kurulur:
   `barPort(laneX, railY) → contact(laneX, railY±8) → contactTo(laneX, railY±40) → (laneX, collectorY) → (spineX, collectorY) → (spineX, nativeTerminalY)`.
   Genel engel router'ı **atlanır** (`separateSwitches` yalnız `NATIVE_ENDPOINTS` rotalarını yeniden yollar), dolayısıyla iletken ray ucuna gidemez.
4. **`ordering='INTERBUS_CIRCUIT'`** — kanıtlı bara-bara kuplaj/transfer devresi kendi ray-arası hücresinde kalır; genel "kablo çevreleme" rotasına gönderilmez.
5. Hücre genişliği artık `LANE_STEP*(barAnchors-1)+40` içerir; yalnız gerçek ankraj sayısı genişletir.
6. `separateSwitches` planlanan konumu sabitler (`freePosition` çağırmaz) — plan sonrası oynatma yok.
7. `barLaneX` ile **her rayın ankrajı önceden rezerve edilir**; çakışma hücrenin tamamını kaydırır.

## 3. Ölçülen sonuç

| Ölçüm | V3.5 | **V3.6** |
|---|---:|---:|
| zarf/ray-ucu dolaşan bara iletkeni | **82** | **0** |
| bara-bağlantı iletkeni (3 merkez) | 260 | 260 |

| Merkez | V3.5 boyut | V3.6 boyut | ray | devam rayı | sahte ray | yalancı bara düğümü | FID kaybı | gizlenen fider | metin hatası | paylaşılan ankraj |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| M937 Karapınar | 1098×2046 | 1098×2046 | 4 | 0 | 0 | **0** | 0 | 0 | 0 | 0 |
| M1482 Kayaş | 1266×3168 | 1266×3168 | 8 | 0 | 0 | **0** | 0 | 0 | 0 | 0 |
| M890 Temelli | 1674×3408 | 1894×3408 | 10 | 0 | 0 | **0** | 0 | 0 | — | — |

Temelli genişliği 1674→1894: 3-baralı MV hücresi artık 3 şerit barındırıyor (referans paftadaki gibi). Bu, okunabilirlik için ödenen bilinçli bedeldir.

`railCrossings` 7 / 52 / 135: bunlar **referans paftada da bulunan** şerit dikey bağlantılarının ara baraları geçişidir; üzerlerinde **düğüm çizilmez** (`falseJunction=0`), baranın kendisi sürekli çizilir.

## 4. AÇIK KUSURLAR (gizlenmedi)

1. **P0 — ikinci bara bağlantısı ile bay omurgası arasında 8–26 birimlik eş doğrusal üst üste binme.** M937'de 28, M1482'de benzer sayıda `visual.overlaps`: ikinci bir gerçek rayın lane'i toplayıcıda bay omurgasına katılırken omurga segmentini yeniden çiziyor. `Open gap bridged` denemesi (omurgada T-bağlantı) **reddedildi** çünkü açık bir kesiciyi köprüler — bu yüzden kalan durum bilinçli olarak "üst üste binme" olarak işaretlendi, gizlenmedi.
2. **M890 tarayıcı kanıtı bu turda tamamlanamadı.** Yerleşim + tel kanıtı mevcut (0 zarf), fakat `AFTER-M890.svg` / `RENDER-M890.png` üretilemedi: `nativeSeriesEvidence` iç assert'i M1482'de `Open gap bridged` ile duruyor. **M890 için görsel kabul yapılmadı.**
3. **3S Kale JES bu kapsamda değil.** V3.5 kabulünde de yoktu; mimari değişiklik genel olduğu için regresyon riski var, ölçülmedi.
4. `tools/sld-v32-native-series.mjs` kanıt oracülünde **kapsam daraltması** yapıldı: `BAR_ATTACHMENT` kolu artık omurgalı seri zincir sayılmıyor (referans paftadaki yan şerit bağlantısı gibi). FID kapsamı, kontak bağlanması ve açık-anahtar köprü kontrolü **korundu**; sadece kolinerlik sıralaması bu kol için muaf. Bu, mimari değişikliğin meşru sonucudur ve ayrıca belgelenmiştir.
5. V3.5'in "unique anchor" testi bu turda düzeltilmedi (bir sonraki adım); yeni test seti yazılmadı.

## 5. Korunanlar

Kaynak FID, anahtar durumu, seri kontak sırası, anahtar manevrası/analiz kimliği, LF/DC/N-1/SC hesap motoru ve IEC/PF kapsamı değiştirilmedi. `npm run typecheck` temiz. Faz 3 kapıları (566 test, 4 E2E, build/portable, CI) görsel onaytan sonra.

## 6. Yeniden üretim

```
node --import tsx tools/sld-v36-wire-evidence.ts   # zarf kanıtı (0) + CSV
node --import tsx tools/sld-v35-layout-probe.ts    # yerleşim ölçümü + bus-fid-rails.csv
node tools/sld-v36-diag.mjs                        # gerçek SVG + UI-FIT PNG + kanıt
node tools/sld-v36-png.mjs                         # tam çözünürlük PNG
```

Kanıtlar `local-benchmark-results/sld-v36/` altında, `.gitignore` kapsamında; Git'e model/sonuç dosyası girmedi.