# Kayaş V3.6 — 400 kV pilot düzeltmesi

14 Ekim 2026. Başlangıç ve doğrulanmış uzak feature HEAD: `53ed79a9da067722c5124f8e81a18d70d5438b15`.
Dal: `codex/kayas-v36-400kv-pilot`. **Tam teslim PARTIAL; main merge yok; kullanıcı görsel onayı bekleniyor.**

Bu çalışma kullanıcı tarafından uygulanması istenen `KAYAS_V36_YEREL_AGENT_HEDEFLI_DUZELTME_PROMPTU.md` içindeki ilk pilot kapısıyla sınırlıdır. YTBS raster yalnız çizim referansıdır. Uygulama değişikliği Kayaş `M1482` için 400 kV katmanında etkinleşir; diğer merkezlere otomatik yayılmaz.

## Değişiklik ve bağımsız kanıt

- Bara ayırıcıları ray bandı dışındaki bağımsız şeritlerde bulunur. Her kol kendi **gerçek source terminalinin** kotunda sonlanır; ortak collector/spine üzerinde yeniden çizim ve kesici üzerinden geri dönüş yoktur. Ters `from/to` yönü de korunur.
- Yabancı ray geçişinde iletkenin SVG `d` yolu gerçekten iki subpath'e ayrılır; ray sürekli kalır. Bu bir elektriksel açık kontak değildir. `data-source-conductor` tam kaynak yolunu, `data-rail-passes` doğrulanabilir yerel optik geçişi taşır. Hop yalnız gizlenmez; kesişimde gerçek görünür izolasyon boşluğu bulunur.
- Aynı source-terminal iletkeninin paylaşılan aralığı yalnız bir kez çizilir; `data-conductor-owners` ve `data-shared-conductors` gerçek sahipleri korur. Farklı terminal kimlikleri birleştirilmez. Bağımsız orakül kaynak yolunun her aralığının görünür aynı-net birleşiminde var olduğunu ayrıca doğrular.
- Kuplaj/transfer anahtar zinciri `nativeBarCircuit` ile kaynak grafından belirlenir. Üçüncü ray kolu gerçek ortak düğüme bağlanır; kontak taşıyıp telleri eski konumda bırakma yoktur. Özel hücreler sonradan packer ile kaydırılmaz.
- A bankası `T5133/T6415`: HV `B89867`, LV `B89868`; B bankası `T5134/T5200`: HV `B77157`, LV `B89936`. Ortak terminal çiftleri ve kaynak ElmBay ekipman üyeliği bank ilişkisini kanıtlar. Sıra **A1–A2 | B3–B4**, x `302–462 | 642–802`. İsimden elektriksel bağlantı kurulmaz.

| Bağımsız ölçüm | Pilot sonucu |
|---|---:|
| Gerçek anahtar / tekil FID | 128 / 128 |
| Kaynak ElmBay / görünür toplam fider | 28 / 30 (2 model fideri dahil) |
| Gerçek bara / trafo | 8 / 6 |
| 400 kV bara hop | 15 → 0 |
| 400 kV açık kontak köprüsü | 0 |
| 400 kV aynı/yabancı net üst üste çizimi | 0 |
| 400 kV yabancı terminal T/uç teması | 0 |
| Optik olarak yalıtılan gerçek ray geçişi | 16 |
| Sahte terminal / kopuk source uç / kopuk kontak | 0 (pilot) |

`tools/sld-v36-pilot-oracle.mjs` üretim layout/renderer modülünü çağırmaz; SVG'nin **M/L subpath** geometrisini, owner/source terminal kimliklerini ve bağımsız gerçek kaynak grafını okur. Negatif kontroller bilerek eklenen açık kontak köprüsünü, mükerrer iletkeni ve uydurma `data-from` terminalini reddeder. Eski testler ve kabul orakülleri değiştirilmemiştir.

## Açık kusurlar ve kapsam sınırı

Tam M1482 paftası **1346×3208**: önceki 1266×3168'e göre küçülmedi. Kuplaj üçüncü kolundaki sembol açıklığı için yalnız 400 kV ray aralığı 100→120 oldu. Tek ekran/yükseklik hedefi bu pilotta çözülmedi.

154 kV'de **37 bara hop** ve alt bölgede bağımsız ölçümün bulduğu **6 açık kontak köprüsü** kaldı: `C106765`, `C110465`, `C68251`, `C68254`, `C95831`, `C95834`. TR-A/TR-B düşey ayrımı, uzun alt gerilim dolaşmaları, sonuç kartları ve alt bank etiketleri sonraki aşamadır. Tam SLD için PASS verilmez.

Dokuz ekipmansız kaynak yaprak terminali korunur; sargıya bağlanmaz: `B102868`, `B102871`, `B102869`, `B102876`, `B102875`, `B102874`, `B102872`, `B102878`, `B102877`. Her birinin adı ve gerçek anahtar FID'si `source-leaves.csv` içindedir; ilgili terminale bağlı ekipman kaydı yoktur.

M937/M890/M1555 gerçek source grafından yeni SVG, tam PNG ve UI-FIT PNG üretildi. Bunlar regresyon kanıtıdır; görsel kabul değildir. M890'da önceki açık kontak köprüleri/paylaşılan ankrajlar, M937 ve M1555'te eski overlap kusurları sürmektedir. CURRENT LF hesabı çalıştırılmadı; NOT_RUN sayıları üretilmez. Model/scenario ve analiz motorları değiştirilmedi.

## Yeniden üretim ve yerel çıktılar

Kanıt dizini: `local-benchmark-results/sld-v36-kayas-pilot/` (özel model içerir, Git dışında).

```powershell
node --import tsx tools/sld-v36-fourth-fixture.ts
node tools/sld-v36-kayas-pilot.mjs
node tools/sld-v36-pilot-validation.mjs
node tools/sld-v36-pilot-gallery.mjs
node tools/sld-v36-kayas-pilot.mjs --labels
```

- `AFTER-M1482.svg`, `AFTER-M937.svg`, `AFTER-M890.svg`, `AFTER-M1555.svg`
- `UI-FIT-*.png`, `RENDER-*.png`, `CLOSEUP-4x-*.png`
- `KAYAS-YTBS-ESKI-YENI.html/.png`: aynı panel genişliğinde YTBS / kullanıcının eski `(2)` portable SVG'si / yeni pilot.
- `KAYAS-V36-PILOT-ESIT-OLCEK.png`: `(3)` V3.6 ve yeni SVG, birebir aynı 1 CSS px/SVG birim ölçeğinde. YTBS raster ile SVG'nin ortak fiziksel uzunluk birimi olmadığı açıkça belirtilir.
- `independent-conductors.csv`, `source-leaves.csv`, `oracle-private.json`, `metrics-private.json`, test logları.
- Başlangıçta değiştirilmiş portable dosya **build öncesinde** `USER-PORTABLE-BEFORE.html` olarak korundu. Kullanıcının diğer yerel dosyaları commit'e dahil edilmez.

## Teslim kapıları

Kod commit'i `5dbe1ab1fc4c663e46d569b19b6eaaa19ff01805` uzak geliştirme dalına push edildi.

| Kapı | Sonuç |
|---|---|
| Hedefli test | 9/9 PASS |
| Bağımsız source/SVG orakülü | 400 kV pilot PASS; 3 negatif mutasyon reddedildi |
| Typecheck / mimari lint | PASS |
| Tam unit/regression | **573/575 PASS, 2 FAIL, 0 skip** |
| E2E genel UI / PF benchmark / map lightning | 3/3 PASS |
| E2E SLD | **FAIL**: `Foreign native conductors cross real rails: 1` |
| Standard / portable build | PASS |
| Committed portable ham byte eşitliği | PASS, CRLF yok |
| Exact kod-HEAD CI | **FAIL**, unit/regression adımında 573/575; sonraki CI adımları çalışmadı |
| Tam model hesabı (`test:full`) | **SKIPPED / SOURCE_UNAVAILABLE**, `control1/*.json` yok |
| CURRENT LF / kullanıcı görsel kabulü | Bekliyor |

İki unit hatası: `sld-v3-independent.test.ts` içindeki dense-sheet beklentisi (`INTERBUS_CIRCUIT` / `NATIVE_ENDPOINTS`) ve `SLD_BAR_ESCAPE_BLOCKED: UNASSIGNED`. **İkisi de 53ed79a başlangıç kaynaklarından ayrı dizinde yeniden üretildi.** Aynı başlangıçta SLD E2E foreign-rail hatası ve Temelli LF `SLD_LABEL_PACKING_UNRESOLVED: T5654` de yeniden üretildi. Eski testler silinmedi, skip edilmedi ve beklenen değerleri değiştirilmedi.

Exact kod-HEAD CI: [run 38594412170](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38594412170). Typecheck/lint başarılı, unit/regression başarısız. Yerel portable SHA-256 (commit blobuyla birebir): `94a8ab333d79274fe848a928e6d0d757ae02d58ad7d1ef33a8593afc6a066d38`.

Geliştirme dalını mevcut feature dalına hedefleyen draft PR oluşturma girişimi GitHub bağlayıcısında `403 Resource not accessible by integration` döndü; PR oluşmadı. Commit/push ve CI doğrulaması tamamlandı.

**154/33,6 kV yerleşimine geçiş ve main merge için kullanıcı görsel kabulü gereklidir.** Bu gereklilik uygulanması istenen promptun “Önce sadece Kayaş 400 kV ... Sonra 154 kV ve 33,6 kV bölgesine geç” ve “Başarılı pilot olmadan ... refactor'u yapma” kapısından gelir.
