# SN3 OA: yeni gerçek portable kabulü

Tarih: 11.10.2026. İncelenen kaynak ve hesap motoru: `d714e1b0ca128ca7b61f2871445449311ef46847`. Çalışma dalı: `audit/sn3-oa-real-run-20261011`.

**Karar: audit-only / source NO-OP.** Gerçek veri koşuları tamamlandı; bu kabul kapsamında hesap veya UI kaynak hatası doğrulanmadı. LF sayısal yakınsama, tanısal N-1/SC çalışması ve UI kabulü mevcut. Tam native kontrol doğruluğu, PF LF/N-1 ve IEC 60909 paritesi doğrulanmadı. Bu belge parite sertifikası değildir. Kod, motorlar, global analiz varsayılanları ve portable baytları değişmedi. Main entegrasyonu ayrıca kullanıcı onayı gerektirir.

## Kaynak ve yöntem

İstenen üç öncelikli dosya adı yerel aramada bulunamadı: `GridAnalyzer_v7(20261011-174347).html`, `20261007_1400_SN3_TR0(2).zip`, `Birleşik_LF_N-1_SC_referans_ZIP(1).zip`. Yerelde bulunan aynı SN3 study paketinin `20261007_1400_SN3_TR0.zip` ve `zip.zip` dosyaları kullanıldı. Portable yerine kullanılan repository artifact'ı istenen bayt hash'i ile birebir eşleşti. Kaynak bütünlüğü doğrulandı; dosya adlarının aynı olduğu iddia edilmiyor.

- Portable: 1.649.720 bayt; SHA-256 `13e658ad0350a2fc8ee808e23c44e7cf993f60d1f360ed9da10ad4a647068630`.
- Model ZIP: 9.854.955 bayt; tek JSON girdisi 144.472.947 bayt. DGS JSON kaynağı; ayrı bir DGS metin dosyası parse edilmedi.
- PF ZIP: 15.279.113 bayt; üç workbook, üç manifest ve üç log. LF/N-1/SC workbook boyutları 11.463.212 / 310.108 / 4.811.204 bayt. Üç SHA-256 ve boyut kendi manifestleriyle doğrulandı.
- Üç manifest study case `20261007_1400_SN3_TR0`, study zamanı `2026-10-07 14:00:00`, PF 24.0.7. Model/topoloji/senaryo manifest kimlikleri eşleşiyor. LF/N-1 addon 1.3.1, SC addon 1.3.0. Export UTC zamanları farklıdır; aynı study zamanı ile aynı export zamanı karıştırılmadı.
- JSON bayt hash'i ile PF yapısal model hash'i farklı algoritmaların kimlikleridir; eşdeğer oldukları varsayılmadı. Özel yollar, FID'ler, model hash'leri ve tam sayısal vektörler bu belgeye alınmadı.

Playwright Chromium, gerçek ZIP dosyalarını native file input ve worker importer üzerinden aldı. Orijinal portable HTML localhost route'unda baytları değiştirilmeden sunuldu. `file://` için de gerçek model UI/worker importu geçti; file modunda ek solver çalıştırılmadı. OA, modeldeki tek **Orta Anadolu YTM** site/area association'ından bulundu: 203 site. Filtre analiz hedefini belirledi; matematiksel ağ kırpılmadı.

CDP koşullu breakpoint yalnız mevcut Application/CanvasRenderer nesnesine erişim sağladı. Worker gözlemcisi gerçek `postMessage` çağrılarını ve cevaplarını kaydetti; model, solver veya sonuç mock'u kullanılmadı. Hat/trafo tooltip testinde mevcut renderer'a gerçek model ekipmanı ve ekran köşesi verildi. Profil/filtre/view değişimleri native controller/DOM üzerinden yapıldı. Native analiz ayarlarının sonunda aynı kaldığı ayrıca doğrulandı.

Özel kanıtlar ignored `local-benchmark-results/OA_SN3_REAL_WORKFLOW_PRIVATE.json`, kaynak/ilk deneme kayıtları ve export doğrulama kaydındadır. SCREEN kimliklerinin özel manifestinde viewport, filtreler, kaynak ailesi, model/senaryo/sonuç kimliği, görüntülenen DOM satırı, timestamp ve PNG hash'i bulunur. PNG/CSV/XLSX/JSON ve test harness'leri Git'e dahil edilmez.

## Kabul matrisi

PASS bir iş akışının sınandığını gösterir; parite kapısındaki BLOCKED durumunu kaldırmaz.

| Kontrol | Durum | Gerçek kanıt / payda |
|---|---|---|
| Kaynak/portable bütünlüğü | PASS | 3/3 workbook manifest doğrulaması; exact portable hash |
| Localhost + file gerçek importer | PASS | Toplam 4 gerçek model importu; file 1, localhost 3 |
| OA full-network native B0 LF | PASS | 4.077 çözülen elektriksel bara / 5.140 branch; OA altkümesi 500 bara / 660 branch |
| Tam native LF kontrol fidelity | BLOCKED | CURRENT_PROFILE_PARTIAL / PARTIAL_SOURCE_FIDELITY |
| PF LF sertifikalı karşılaştırma | BLOCKED | 30.182 OA reference-cell projeksiyonu; nComparable=0 |
| N-1 katalog/topoloji | PASS | Global 5.131 aday; OA 660: 352 nonbridge + 308 bridge |
| N-1 CURRENT_SETTINGS | BLOCKED | Gerçek base LF ardından BASE_FULL_AC_NOT_VERIFIED; native N-1 AC çağrısı yok |
| Onaylı N-1 DC → seçili Full AC | PASS | GA_APPROX_STATION_OFF: DC 1 çağrı, AC 4 çağrı; 2 çözülen ihlal + 2 kısmi vaka |
| PF N-1 POST paritesi | BLOCKED | 660/660 capability unverified; 0 full bus/branch POST satırı |
| OA SC fiziksel/elektriksel katalog | PASS | 6.278 fiziksel hedef / 500 elektriksel partition |
| Varsayımsız native SC | BLOCKED | Gerçek 3 fault; BLOCKED 3, sayısal 0, factor/RHS 0/0 |
| Onaylı tanısal SC / iptal / devam | PASS | NETWORK_APPROXIMATION; 20 + 3 fault, 23 sonuç / 14 elektriksel partition |
| IEC 60909 / Ip / Ib / Ith | BLOCKED | nIECComparable=0; Ip/Ib/Ith 23/23 null |
| Gerçek dört viewport / native ⚡ | PASS | 1366×768, 1440×900, 1600×900, 1920×1080; yatay sayfa taşması yok |
| SC katalog/arama/sort/focus/ESC | PASS | Tam 6.278 katalog, DOM en çok 50, tek seçili fault=1; sticky/scroll |
| PF ve GA SC sayaçları | PASS | GA 23, PF 465, GA çalışmadı 6.255; kaynak aileleri ayrı |
| Native hat/trafo tooltip | PASS | Gerçek OA ekipmanları, 340 px genişlik; köşe ve klavye Detay açıkken viewport içinde |
| OA ters HV/LV gerçek trafo vakası | NOT_EXECUTED | Bu scope'ta ters bağlanmış native test trafosu bulunmadı |
| Gerçek UNKNOWN_CAPACITY tooltip | NOT_EXECUTED | Solved OA hat/trafo subset'inde bu durumdaki ekipman bulunmadı |
| Gerçek XLSX/CSV/JSON içeriği | PASS | 7 dosya; sayısal XLSX, BOM/semicolon/TR decimal CSV, null ve gerçek sıfır ayrımı |
| CASE_TOTAL / ELEMENT | PASS | N-1 export 660 ELEMENT + 1 CASE_TOTAL; aggregate MW=0, ELEMENT MW=null |
| Yeni iki manevra / gerçek delta | PASS | S2 ve S4 LF yakınsadı; aşağıdaki OA GA−GA değerleri; yeni test defteri |
| IndexedDB sonuç geri yükleme | PASS | B0/S2/S4/B0, ayrıca S1/S2; yeni solver çağrısı olmadan |
| Özgün SN7 S2 yeniden üretimi | NOT_EXECUTED | Bu çalışma yeni kontrollü SN3 OA defteridir; önceki yeni SN7 S2 de özgün S2 değildir |
| Alt faz süreleri / strict peak heap | NOT_MEASURED | Aşağıdaki ölçülen kapsam dışındaki alt fazlara süre uydurulmadı |

## LF sonuç ve kontrol kanıtı

B0 `CONVERGED_FULL_NR`, son NR iterasyonu 2, Q-limit round 2; global max mismatch **2.0407307441128175e−8 MW**. Telemetri 79 full NR solve, toplam 95 Newton iterasyonu ve 77 outer control round bildiriyor. NR, active balance ve station control yakınsadı. Kontrol/source fidelity yine **PARTIAL**; sayısal yakınsama ile PF/native full fidelity eşitlenmedi. Bir PV→PQ QMIN olayı kayıtlı. Çözülen ada 4.077 bara/5.140 branch, tek reference, CONVERGED. Ayrı peak residual vektörü ölçülmedi.

Active balance `DISTRIBUTED_ADJUSTABLE_LOADS`, 1.947 eligible load, 1 iterasyon; final correction 0. Native station/droop kaynak kapsamı kısmi. DGS source tanısındaki SOURCE_EXACT etiketi, kontrol provenance'ının PARTIAL_SOURCE_FIDELITY kapısını kaldırmaz. OA özel satır projeksiyonu Pfrom/Pto, Qfrom/Qto, S/akım, terminal Vpu/kV/açı ve loading denominator/source alanlarını korur.

Station controller telemetrisi: active 270, supported 240, satisfied 186, unsupported 30; droop active 135, safe/controlled 105/105, remote conflict 0. Kaynak Q-limit'i eksik controller 6; SOURCE_BOUNDED 264. Kaynakta olmayan limit üretilmedi. Station voltage residual max 0.03453334091686355 pu, mean 0.00132875636340129 pu; bu controller residual'ı çok küçük nodal MW mismatch ile aynı büyüklük değildir. Full control doğruluğu bu nedenle yakınsamadan çıkarılamaz.

PF yöntem etiketi VERIFIED_EXACT yalnız PF exportuna aittir. GA preflight **EXPLORATORY_ONLY**: PF calculation-setting semantics eksik veya raw enum-only. 7.970 hücrede keşif amaçlı imzalı GA−PF farkı var; doğrulanmış LF farkı yok. Physical identity/endpoint/partition/method kapıları atlanmadı; açı adası/reference alignment ayrıca sertifikalı sayılmadı. PF gerçek sıfır hücre 41, sentinel 0 kayıtlı; eksik hücre sıfır yapılmadı.

### Metrik/band paydaları

`nGA` bu tabloda PF reference-cell projeksiyonunda GA değeri bulunan hücre sayısıdır; global/OA solved bara sayısı değildir. `nPF` mevcut PF hücresi, `nMatched` identity eşleşen hücre, `nBlocked` sertifikalı fark üretilemeyen hücre sayısıdır. Çift yönlü hat/trafo metrikleri farklı satırlardır. nComparable bütün gruplarda 0: sertifikalı bias/MAE/RMSE/median/P95/P99/max/worstFID **null**. 220 ve 66 kV için OA reference projeksiyonunda satır yok; her ölçülen metrik için bu iki bandın sayımları 0 ve istatistikleri null. Bir metrikte bulunmayan diğer bandlar da 0/null; 0 hata olarak yorumlanmaz.

| Metrik | Band kV | nGA | nPF | nMatched | nComparable | nBlocked | Sertifikalı hata |
| --- | --- | --- | --- | --- | --- | --- | --- |
| voltagePu | 400 | 29 | 30 | 29 | 0 | 509 | null |
| voltagePu | 220 | 0 | 0 | 0 | 0 | 0 | null |
| voltagePu | 154 | 189 | 193 | 189 | 0 | 2735 | null |
| voltagePu | 66 | 0 | 0 | 0 | 0 | 0 | null |
| voltagePu | ≤36 | 282 | 329 | 282 | 0 | 3034 | null |
| voltageKv | 400 | 29 | 30 | 29 | 0 | 509 | null |
| voltageKv | 220 | 0 | 0 | 0 | 0 | 0 | null |
| voltageKv | 154 | 189 | 193 | 189 | 0 | 2735 | null |
| voltageKv | 66 | 0 | 0 | 0 | 0 | 0 | null |
| voltageKv | ≤36 | 282 | 329 | 282 | 0 | 3034 | null |
| angleDeg | 400 | 29 | 30 | 29 | 0 | 509 | null |
| angleDeg | 220 | 0 | 0 | 0 | 0 | 0 | null |
| angleDeg | 154 | 189 | 193 | 189 | 0 | 2735 | null |
| angleDeg | 66 | 0 | 0 | 0 | 0 | 0 | null |
| angleDeg | ≤36 | 282 | 329 | 282 | 0 | 3034 | null |
| pFromMw | 400 | 53 | 53 | 53 | 0 | 114 | null |
| pFromMw | 220 | 0 | 0 | 0 | 0 | 0 | null |
| pFromMw | 154 | 253 | 253 | 253 | 0 | 546 | null |
| pFromMw | 66 | 0 | 0 | 0 | 0 | 0 | null |
| pFromMw | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| qFromMvar | 400 | 53 | 53 | 53 | 0 | 114 | null |
| qFromMvar | 220 | 0 | 0 | 0 | 0 | 0 | null |
| qFromMvar | 154 | 253 | 253 | 253 | 0 | 546 | null |
| qFromMvar | 66 | 0 | 0 | 0 | 0 | 0 | null |
| qFromMvar | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| sFromMva | 400 | 53 | 53 | 53 | 0 | 114 | null |
| sFromMva | 220 | 0 | 0 | 0 | 0 | 0 | null |
| sFromMva | 154 | 253 | 253 | 253 | 0 | 546 | null |
| sFromMva | 66 | 0 | 0 | 0 | 0 | 0 | null |
| sFromMva | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| pToMw | 400 | 53 | 53 | 53 | 0 | 114 | null |
| pToMw | 220 | 0 | 0 | 0 | 0 | 0 | null |
| pToMw | 154 | 253 | 253 | 253 | 0 | 546 | null |
| pToMw | 66 | 0 | 0 | 0 | 0 | 0 | null |
| pToMw | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| qToMvar | 400 | 53 | 53 | 53 | 0 | 114 | null |
| qToMvar | 220 | 0 | 0 | 0 | 0 | 0 | null |
| qToMvar | 154 | 253 | 253 | 253 | 0 | 546 | null |
| qToMvar | 66 | 0 | 0 | 0 | 0 | 0 | null |
| qToMvar | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| sToMva | 400 | 53 | 53 | 53 | 0 | 114 | null |
| sToMva | 220 | 0 | 0 | 0 | 0 | 0 | null |
| sToMva | 154 | 253 | 253 | 253 | 0 | 546 | null |
| sToMva | 66 | 0 | 0 | 0 | 0 | 0 | null |
| sToMva | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| pHvMw | 400 | 61 | 61 | 61 | 0 | 114 | null |
| pHvMw | 220 | 0 | 0 | 0 | 0 | 0 | null |
| pHvMw | 154 | 293 | 293 | 293 | 0 | 546 | null |
| pHvMw | 66 | 0 | 0 | 0 | 0 | 0 | null |
| pHvMw | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| qHvMvar | 400 | 61 | 61 | 61 | 0 | 114 | null |
| qHvMvar | 220 | 0 | 0 | 0 | 0 | 0 | null |
| qHvMvar | 154 | 293 | 293 | 293 | 0 | 546 | null |
| qHvMvar | 66 | 0 | 0 | 0 | 0 | 0 | null |
| qHvMvar | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| sHvMva | 400 | 61 | 61 | 61 | 0 | 114 | null |
| sHvMva | 220 | 0 | 0 | 0 | 0 | 0 | null |
| sHvMva | 154 | 293 | 293 | 293 | 0 | 546 | null |
| sHvMva | 66 | 0 | 0 | 0 | 0 | 0 | null |
| sHvMva | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| pLvMw | 400 | 61 | 61 | 61 | 0 | 114 | null |
| pLvMw | 220 | 0 | 0 | 0 | 0 | 0 | null |
| pLvMw | 154 | 293 | 293 | 293 | 0 | 546 | null |
| pLvMw | 66 | 0 | 0 | 0 | 0 | 0 | null |
| pLvMw | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| qLvMvar | 400 | 61 | 61 | 61 | 0 | 114 | null |
| qLvMvar | 220 | 0 | 0 | 0 | 0 | 0 | null |
| qLvMvar | 154 | 293 | 293 | 293 | 0 | 546 | null |
| qLvMvar | 66 | 0 | 0 | 0 | 0 | 0 | null |
| qLvMvar | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| sLvMva | 400 | 61 | 61 | 61 | 0 | 114 | null |
| sLvMva | 220 | 0 | 0 | 0 | 0 | 0 | null |
| sLvMva | 154 | 293 | 293 | 293 | 0 | 546 | null |
| sLvMva | 66 | 0 | 0 | 0 | 0 | 0 | null |
| sLvMva | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| iFromA | 400 | 53 | 53 | 53 | 0 | 114 | null |
| iFromA | 220 | 0 | 0 | 0 | 0 | 0 | null |
| iFromA | 154 | 253 | 253 | 253 | 0 | 546 | null |
| iFromA | 66 | 0 | 0 | 0 | 0 | 0 | null |
| iFromA | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| iToA | 400 | 53 | 53 | 53 | 0 | 114 | null |
| iToA | 220 | 0 | 0 | 0 | 0 | 0 | null |
| iToA | 154 | 253 | 253 | 253 | 0 | 546 | null |
| iToA | 66 | 0 | 0 | 0 | 0 | 0 | null |
| iToA | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| loadingPercent | 400 | 114 | 114 | 114 | 0 | 114 | null |
| loadingPercent | 220 | 0 | 0 | 0 | 0 | 0 | null |
| loadingPercent | 154 | 546 | 546 | 546 | 0 | 546 | null |
| loadingPercent | 66 | 0 | 0 | 0 | 0 | 0 | null |
| loadingPercent | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| pLossMw | 400 | 114 | 114 | 114 | 0 | 114 | null |
| pLossMw | 220 | 0 | 0 | 0 | 0 | 0 | null |
| pLossMw | 154 | 546 | 546 | 546 | 0 | 546 | null |
| pLossMw | 66 | 0 | 0 | 0 | 0 | 0 | null |
| pLossMw | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| qLossMvar | 400 | 114 | 114 | 114 | 0 | 114 | null |
| qLossMvar | 220 | 0 | 0 | 0 | 0 | 0 | null |
| qLossMvar | 154 | 546 | 546 | 546 | 0 | 546 | null |
| qLossMvar | 66 | 0 | 0 | 0 | 0 | 0 | null |
| qLossMvar | ≤36 | 0 | 0 | 0 | 0 | 0 | null |
| pResultMw | 400 | 0 | 0 | 0 | 0 | 0 | null |
| pResultMw | 220 | 0 | 0 | 0 | 0 | 0 | null |
| pResultMw | 154 | 0 | 0 | 0 | 0 | 0 | null |
| pResultMw | 66 | 0 | 0 | 0 | 0 | 0 | null |
| pResultMw | ≤36 | 64 | 64 | 64 | 0 | 64 | null |
| qResultMvar | 400 | 0 | 0 | 0 | 0 | 0 | null |
| qResultMvar | 220 | 0 | 0 | 0 | 0 | 0 | null |
| qResultMvar | 154 | 0 | 0 | 0 | 0 | 0 | null |
| qResultMvar | 66 | 0 | 0 | 0 | 0 | 0 | null |
| qResultMvar | ≤36 | 64 | 64 | 64 | 0 | 64 | null |

### Keşif istatistikleri — yöntem doğrulanmamış GA−PF

Bu tablo normatif hata/parite değildir. Bias imzalı; diğer istatistikler mutlak farklardan gelir. Median/P95/P99 burada nearest-rank yüzdebirimlerdir. Worst FID'ler özel kayıtta kalır; W kimlikleri yalnız redakte grup işaretidir. Sertifikalı istatistikler üstteki gibi null'dır.

| Metrik / band | n keşif | Bias | MAE | RMSE | Median abs | P95 abs | P99 abs | Max abs | Worst (redakte) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| voltagePu|154 | 189 | 0.0006 | 0.0007 | 0.0018 | 0.0003 | 0.0019 | 0.0115 | 0.0161 | W001 |
| voltageKv|154 | 189 | 0.095 | 0.1007 | 0.2777 | 0.0427 | 0.2913 | 1.7681 | 2.4756 | W002 |
| angleDeg|154 | 189 | 0.0168 | 0.0217 | 0.0283 | 0.0213 | 0.0304 | 0.107 | 0.1766 | W003 |
| voltagePu|≤36 | 282 | 0.0005 | 0.0006 | 0.0016 | 0.0003 | 0.0019 | 0.0102 | 0.0156 | W004 |
| voltageKv|≤36 | 282 | 0.0164 | 0.0186 | 0.05 | 0.009 | 0.0581 | 0.3213 | 0.4926 | W005 |
| angleDeg|≤36 | 282 | 0.0182 | 0.0236 | 0.0319 | 0.0229 | 0.0426 | 0.1289 | 0.2339 | W006 |
| voltagePu|400 | 29 | 0.0003 | 0.0003 | 0.0005 | 0.0002 | 0.001 | 0.0022 | 0.0022 | W007 |
| voltageKv|400 | 29 | 0.1261 | 0.1261 | 0.2094 | 0.0764 | 0.4054 | 0.8641 | 0.8641 | W008 |
| angleDeg|400 | 29 | 0.0192 | 0.0192 | 0.0206 | 0.0217 | 0.0272 | 0.0282 | 0.0282 | W009 |
| pFromMw|400 | 53 | -0.0768 | 0.3191 | 0.3814 | 0.293 | 0.6559 | 0.8985 | 0.8985 | W010 |
| qFromMvar|400 | 53 | -0.5534 | 1.2099 | 2.3116 | 0.434 | 5.919 | 9.5051 | 9.5051 | W011 |
| sFromMva|400 | 53 | 0.3639 | 0.4794 | 0.8596 | 0.3115 | 1.6704 | 4.7599 | 4.7599 | W012 |
| pToMw|400 | 53 | 0.0789 | 0.3209 | 0.3834 | 0.2935 | 0.6542 | 0.8974 | 0.8974 | W013 |
| qToMvar|400 | 53 | 0.504 | 1.1785 | 2.1815 | 0.4845 | 5.9025 | 8.9146 | 8.9146 | W014 |
| sToMva|400 | 53 | 0.0953 | 0.4348 | 0.6674 | 0.328 | 1.1178 | 3.3531 | 3.3531 | W015 |
| pHvMw|400 | 61 | -0.0272 | 0.0546 | 0.0982 | 0.0518 | 0.0918 | 0.6351 | 0.6351 | W016 |
| qHvMvar|400 | 61 | 0.2255 | 0.4884 | 1.3413 | 0.1158 | 1.8174 | 6.636 | 6.636 | W017 |
| sHvMva|400 | 61 | 0.1335 | 0.1459 | 0.3706 | 0.0752 | 0.5435 | 2.2414 | 2.2414 | W018 |
| pLvMw|400 | 61 | 0.0275 | 0.0546 | 0.0985 | 0.0517 | 0.0904 | 0.6371 | 0.6371 | W019 |
| qLvMvar|400 | 61 | -0.2108 | 0.4739 | 1.3035 | 0.1109 | 1.6593 | 6.2883 | 6.2883 | W020 |
| sLvMva|400 | 61 | 0.1116 | 0.1242 | 0.2977 | 0.07 | 0.2751 | 1.6755 | 1.6755 | W021 |
| iFromA|400 | 53 | 0.4213 | 0.6272 | 1.1499 | 0.3432 | 2.3812 | 6.2253 | 6.2253 | W022 |
| iToA|400 | 53 | -0.0391 | 0.6278 | 1.1097 | 0.4158 | 2.1914 | 6.0064 | 6.0064 | W023 |
| loadingPercent|400 | 63 | 0.0311 | 0.0442 | 0.127 | 0.0139 | 0.1034 | 0.8308 | 0.8308 | W024 |
| pLossMw|400 | 114 | 0.0012 | 0.0018 | 0.004 | 0.0007 | 0.0105 | 0.0158 | 0.0237 | W025 |
| qLossMvar|400 | 114 | -0.0151 | 0.0511 | 0.1396 | 0.0093 | 0.2243 | 0.3477 | 1.2317 | W026 |
| pFromMw|154 | 253 | 0.0021 | 0.0599 | 0.0929 | 0.0388 | 0.2013 | 0.2917 | 0.5231 | W027 |
| qFromMvar|154 | 253 | 0.0202 | 0.2998 | 1.0141 | 0.0709 | 0.9053 | 7.3998 | 8.6757 | W028 |
| sFromMva|154 | 253 | 0.0207 | 0.0864 | 0.2027 | 0.0423 | 0.2796 | 1.0729 | 1.684 | W029 |
| pToMw|154 | 253 | -0.002 | 0.0599 | 0.093 | 0.0391 | 0.1956 | 0.2711 | 0.5402 | W030 |
| qToMvar|154 | 253 | -0.0234 | 0.2998 | 1.0109 | 0.0737 | 0.9069 | 7.1529 | 8.6898 | W031 |
| sToMva|154 | 253 | 0.0282 | 0.084 | 0.1878 | 0.0422 | 0.3014 | 1.0144 | 1.706 | W032 |
| pHvMw|154 | 293 | -0.004 | 0.0242 | 0.052 | 0.0106 | 0.0843 | 0.2492 | 0.3839 | W033 |
| qHvMvar|154 | 293 | 0.0138 | 0.0158 | 0.0951 | 0.0006 | 0.0456 | 0.8489 | 0.9798 | W034 |
| sHvMva|154 | 293 | 0.0206 | 0.0281 | 0.0597 | 0.0114 | 0.1437 | 0.2733 | 0.3869 | W035 |
| pLvMw|154 | 293 | 0.0041 | 0.0241 | 0.0522 | 0.0106 | 0.0847 | 0.2501 | 0.3858 | W036 |
| qLvMvar|154 | 293 | -0.0129 | 0.0138 | 0.0948 | 2.8610e-8 | 0.024 | 0.8165 | 1.0039 | W037 |
| sLvMva|154 | 293 | 0.0193 | 0.028 | 0.0607 | 0.0113 | 0.1338 | 0.2715 | 0.4162 | W038 |
| iFromA|154 | 253 | -0.004 | 0.3325 | 0.7935 | 0.147 | 1.4 | 3.8567 | 6.2818 | W039 |
| iToA|154 | 253 | 0.0188 | 0.3199 | 0.7547 | 0.1338 | 1.3757 | 4.2822 | 5.8476 | W040 |
| loadingPercent|154 | 387 | -0.0071 | 0.0562 | 0.2992 | 0.0128 | 0.1797 | 0.5335 | 5.5124 | W041 |
| pLossMw|154 | 546 | 0.0001 | 0.0005 | 0.0019 | 0.0001 | 0.0016 | 0.0095 | 0.0205 | W042 |
| qLossMvar|154 | 546 | -0.001 | 0.0056 | 0.0203 | 0.0008 | 0.0205 | 0.0861 | 0.247 | W043 |
| pResultMw|≤36 | 64 | -8.8844e-8 | 3.7872e-7 | 1.0127e-6 | 4.7684e-8 | 1.3733e-6 | 4.8828e-6 | 4.8828e-6 | W044 |
| qResultMvar|≤36 | 64 | -0.3397 | 0.3397 | 1.2379 | 1.4901e-9 | 1.6593 | 6.2883 | 6.2883 | W045 |

## N-1 ve SC kapsamı

Native N-1 gate gerçek CURRENT_SETTINGS base LF sonucundan BLOCKED verdi. Önceden kullanıcı tarafından onaylanmış GA_APPROX_STATION_OFF profili ayrı koşuldu; global analiz ayarları değiştirilmedi. Seçili OA outage'ları tam ağda çözüldü. DC yalnız P taraması; V/Q sonuçları Full AC POST'tur. Aşağıdaki dört deterministik gerçek vaka anonimleştirilmiştir; iki köprü vakası PARTIAL_SOLUTION'dır ve tam başarı sayılmaz. Unsupplied MW gerçek 0 değeridir; kısmi adalarda sıfırdan tam besleme güvencesi çıkarılmaz.

| Vaka | Topoloji / kV | DC | AC POST | Vpu min/max | Max yük % | Case solver ms | Unsupplied MW | Unknown rating |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OA-1 | NON_ISLANDING / 400 | SCREENED_VIOLATION | AC_CONVERGED_VIOLATION | 0.7703 / 1.2441 | 110.6456 | 1025.8 | 0 | 9 |
| OA-2 | NON_ISLANDING / 400 | SCREENED_VIOLATION | AC_CONVERGED_VIOLATION | 0.7709 / 1.2444 | 123.7681 | 1007.8 | 0 | 9 |
| OA-3 | ISLANDING / 154 | ISLANDING | PARTIAL_SOLUTION | 0.7782 / 1.2454 | 109.3929 | 1104.3 | 0 | 9 |
| OA-4 | ISLANDING / 154 | ISLANDING | PARTIAL_SOLUTION | 0.7782 / 1.2454 | 109.393 | 1391.8 | 0 | 9 |

İlk seçili çözülen vaka için **≥80% riskli OA hat=1**, aynı POST'ta full-network hat=11. Önceki cached 16 ile farklı vaka/scope'un sayıları eşitlenmedi. 100% termik ve Vpu ihlalleri dört-vaka kayıtlarında ayrı; toplam UNKNOWN_RATING 36 ve UNSOLVED_ISLAND 2. CASE_TOTAL yalnız başlık/export aggregate'ıdır.

PF 660 vakanın ham `status` alanı **RESULT_STATUS_NOT_RECORDED**; literal CAPABILITY_UNVERIFIED export edildiği iddiası düzeltilmiştir. Capability/method kapısında bunun anlamı **660/660 unverified**'dır. 15 recorded-extrema-only yüklenme, 645 missing; full POST branch/bus matrisi 0/0. Recorded extrema, solved-method kanıtı değildir. Seçili 4/4 vaka ID'si PF case listesinde eşleşti; crosswalk özel kayıtta tutulur; N-1 PF MAE/RMSE dahil normatif hata hücreleri null'dır.

SC native source-readiness global component matrix'i PARTIAL_SOURCE 7.676, METHOD_UNVERIFIED 1.299, MISSING_SOURCE_MODEL 1.542, MISSING_ZERO_SEQUENCE 3.700 sayar; bunlar fault veya OA terminal sayısı değildir. Native 3 fault sayısal sonuç vermedi. Kullanıcı onaylı NETWORK_APPROXIMATION profili 3PH/MAX, c=1.1, rf/xf=0; edition/native IEC evidence unverified olarak ayrı tutuldu.

Tanısal SC'de gerçek worker dispatch ardından Durdur yapıldı: 0/23 işlenmiş, ilk batch 20 iptal, kalan 23. Devam 20 + 3 fault çözdü; 23 fiziksel fault için 14 unique electrical partition, kümülatif 1 faktorizasyon / 23 RHS. 154/34.5/33.6/31.5 kV örnekleri, aynı ve farklı partition hedefleri mevcut. Tüm 23 hedefte PF üyelik kümesi eksik; 4 hedefte nominal base mismatch de var. Yöntem ve source edition kapıları da açık kalır; normatif GA−PF kA ve Ip/Ib/Ith null.

PF 4.689 physical / 3.769 electrical toplamları global referans kapsamıdır; GA OA 6.278 physical / 500 electrical katalogla aynı payda değildir. UI'deki 465 mevcut PF reference kaydı da yeni GA solve sayısı değildir. SC JSON gerçekten 23 CALCULATED_NETWORK_APPROXIMATION sonucu içerir; hiçbiri IEC sonucu olarak etiketlenmedi.

## Senaryo ve dışa aktarma

Yeni kontrollü **SN3 OA** testinde ardışık iki gerçek hat açma manevrası yapıldı. Native branchScenario ile setStatus ayrı child ürettiğinden gerçek defter B0→S1(boş)→S2(ilk manevra)→S3(boş)→S4(ikinci manevra). S1/S2 mantıksal adları ile gerçek kayıt kimlikleri karıştırılmadı. Her iki manevra LF'si yeni worker çağrısıdır. Sonraki IndexedDB kontrolleri bu yeni sonuçların restore'udur, yeni hesap değildir. Özgün SN7 S2 ile aynı olduğu iddia edilmez.

Aşağıdaki delta B0'a göre GA−GA'dır; 739 fiziksel branch projeksiyonu, 10.600 birleşik OA terminal/branch hücre projeksiyonu. Bunlar B0 solved 660 branch/500 electrical bus ile farklı paydalardır. Bara metriklerinde 4.243 null korunur; eksik sonuçlar sahte sıfır yapılmaz. Native harita/⚡ karşılaştırması ve Analizler sonuç/restore görünümü sınandı; bütün metriklerin her UI yüzeyinde tek tek görsel eşitliği kanıtlanmış sayılmaz.

| Kayıt | Metrik | Hücre | Sayısal | Sıfır dışı | Null | Min Δ | Max Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S2 | pFromMw | 739 | 739 | 652 | 0 | -512.377 | 907.3121 |
| S2 | qFromMvar | 739 | 739 | 653 | 0 | -149.3703 | 62.1633 |
| S2 | voltageKv | 10600 | 6357 | 6129 | 4243 | -1.6013 | 0.9214 |
| S2 | angleDeg | 10600 | 6357 | 6278 | 4243 | -1.4726 | 1.8289 |
| S2 | loadingPercent | 739 | 739 | 650 | 0 | -44.0089 | 12.7051 |
| S4 | pFromMw | 739 | 739 | 657 | 0 | -377.3023 | 907.3121 |
| S4 | qFromMvar | 739 | 739 | 656 | 0 | -149.3703 | 133.5098 |
| S4 | voltageKv | 10600 | 6357 | 6160 | 4243 | -5.4628 | 1.5429 |
| S4 | angleDeg | 10600 | 6357 | 6278 | 4243 | -3.2194 | 7.7063 |
| S4 | loadingPercent | 739 | 739 | 653 | 0 | -65.2889 | 61.0609 |

İndirilen gerçek dosyalarda LF XLSX 4.077 bara, 5.140 branch, 1.965 generator + Diagnostics; LF CSV 5.140 branch + provenance. SC study CSV/XLSX 6.278 ELEMENT, GA Ikss 23, PF Ikss 465. N-1 study CSV/XLSX 660 ELEMENT + tek CASE_TOTAL, CASE_TOTAL MW=0, bütün ELEMENT unsuppliedLoadMW boş/null. XLSX sayısal XML hücreleri numeric tipinde ve CSV ondalık-virgül sayılarıyla eşleşti. SC JSON 23 diagnostic fault, factor/RHS 1/23, Ip/Ib/Ith null. Export özel dosya hash'leri ignored kanıtta. LF native JSON düğmesi yok; JSON kabulü gerçek SC exportuyla yapıldı.

## Süre ve bellek

Toplam gerçek worker analiz çağrıları **LF / N-1 / SC = 6 / 5 / 4**. LF: 5 native ayarlı çağrı (iki B0, native N-1 base, iki yeni manevra) + 1 station-off tanısal base. N-1: 1 DC screen + 4 AC validate. SC: 1 native BLOCKED + 1 dispatch sonrası iptal + 2 başarılı tanısal batch. İptal edilen SC çağrısı sayıya dahil, başarılı süre dağılımına dahil değildir. Katalog, import, preflight ve IndexedDB restore ek solver çağrısı sayılmaz.

Tek yerel host, Node performance.now/process.hrtime.bigint ve page performance.mark; worker interval başlangıç postMessage, bitiş gerçek sonuç cevabı. UI wall interval import/notify/render/serialization işlerini içerir; solver elapsed ile aynı ölçüm değildir. Süre median'ı ortadaki iki örneğin ortalaması, P95 nearest-rank. n=1 bir dağılım güveni sağlamaz. Farklı vaka/batch boyutları aynı işin beş tekrarı olarak sunulmadı. Tam hesap/model importu yalnız beş örnek uğruna tekrar edilmedi.

| Kapsam | n | Min ms | Median ms | P95 ms |
| --- | --- | --- | --- | --- |
| Gerçek model UI import (localhost), wall | 3 | 7424.8091 | 7490.0675 | 7939.4178 |
| Gerçek model UI import (file), wall | 1 | 7339.9469 | 7339.9469 | 7339.9469 |
| PF ZIP UI import/manifest, wall | 3 | 18104.3284 | 19898.336 | 23609.0937 |
| Native LF worker (B0/base/S2/S4; farklı durumlar) | 5 | 6994.5 | 9463.3 | 10028.5 |
| Tanısal station-off base LF worker | 1 | 6771 | 6771 | 6771 |
| Tanısal N-1 DC worker, 4 hedef | 1 | 532.2 | 532.2 | 532.2 |
| Tanısal N-1 AC worker, 4 farklı vaka | 4 | 7048 | 7804.65 | 9133.7 |
| SC gerçek katalog worker | 1 | 1295 | 1295 | 1295 |
| N-1 gerçek katalog worker | 1 | 418.2 | 418.2 | 418.2 |
| SC approximation context worker | 2 | 1544.4 | 1663.6 | 1782.8 |
| Model LOAD_MODEL worker | 3 | 4323.8 | 4636.1 | 4754.3 |
| Gerçek LF preflight worker | 2 | 5561 | 5778.8 | 5996.6 |
| SC native BLOCKED worker, 3 fault | 1 | 889.2 | 889.2 | 889.2 |
| SC tanısal worker, 20 ve 3 batch | 2 | 1505 | 3000.9 | 4496.8 |
| Gerçek native UI pan + 2 frame | 5 | 70.3561 | 83.8834 | 99.8646 |
| Gerçek native UI filter + 2 frame | 5 | 47.364 | 49.907 | 54.4586 |
| IndexedDB dört scenario restore, wall | 1 | 10988.096 | 10988.096 | 10988.096 |
| OA LF matching/statistics, wall | 1 | 9739.6434 | 9739.6434 | 9739.6434 |

Native B0 engine telemetry total 2.981,4 ms: prepare 210, base NR 316, classification 14,2, control-limit restart NR toplam 2.283,2, final NR 48,6, result map 8,9 ms. Bu değerler worker round-trip 6.994,5 ms ve uygulama wall 16.137,9 ms ile farklı kapsamdadır. Telemetrideki ölçülmemiş jacobian/sensitivity/symbolic alt sayaç 0'ları “0 ms maliyet” kabul edilmedi. N-1 case solver elapsed değerleri vaka tablosunda; IPC sürelerinden ayrı.

SC engine elapsed 20 fault için 1.180,1 ms, son 3 fault için ek 868,7 ms; birleştirilmiş toplam 2.048,8 ms. Factor/RHS sayıları ölçüldü, ayrı factor ve RHS süreleri NOT_MEASURED. ZIP decompress/JSON parse/canonical normalization/geometry/first paint ayrı saatleri, export ve tooltip süreleri NOT_MEASURED; toplam importer ya da UI filtresi süresiyle doldurulmadı. IndexedDB restore ölçümü dört senaryo seçimini içerir, browser cold reopen süresi değildir.

Main-thread heap 1.915 olay örneği; en büyük gözlenen usedJSHeapSize **1.841.318.394 bayt**. Bu örneklenmiş maksimumdur, strict peak veya tüm worker/process RSS değildir. Worker peak ve browser peak NOT_MEASURED.

Dört harness hatası kaydedildi: bir yardımcı syntax hatası, yanlış sort label ve canvas selector timeoutları, testin köşeye yerleştirdiği tooltip temizlenmeden tıklama timeout'u. İlk hook/readiness denemeleri de özel kayıtta. Bunlar uygulama solver başarısı/süre örneği sayılmadı. Gerçek model importu ilk yardımcı denemelerde tekrarlandığı için toplam 4'tür. Başarılı kontroller hedefli devamlarla tamamlandı; bu hatalar nedeniyle hesap motoru değiştirilmedi. Yeni real screenshot sayısı aşağıdaki 32 benzersiz artifact'tır; önceki deneme/cached/sentetik screenshotlar sayılmadı.

## Yeni gerçek screenshot manifesti (redakte)

PNG'ler yerel özel ignored dizinde kalır; yalnız placeholder ve SHA burada. Her sahne yeni SN3 OA importundan gelen gerçek sonuç/modeldir. SC dört viewport görüntüsü ayrıca görsel olarak incelendi; yatay tablo scroll bilinçli, sayfa taşması yok. Aşağıdaki bütün sahnelerde aynı model snapshot kullanıldı; source family ve senaryo farkı manifestte ayrıdır. Legend renklerinin bütün satırlarla tek tek eşitliği ayrıca NOT_MEASURED.

| Kanıt | Sahne | Viewport | Scenario / kaynak | Yerel placeholder | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| SCREEN_1 | LF_B0_OA_nominal | 1440×900 | B0 / LF / GA | private://OA/01.png | e862fcf4df8ac9730c1417aba6a2ae6ba0932908f40426079efc6fb816fa8d32 |
| SCREEN_2 | SC_NATIVE_BLOCKED | 1440×900 | B0 / SC / GA | private://OA/02.png | 49c43ee8dba46a2a50a50d99a7a7bd8a71f39ffefb81d0699ba8647148939785 |
| SCREEN_3 | SC_APPROVED_23 | 1366×768 | B0 / SC / GA | private://OA/03.png | b22bf6301941133db4aa76913dd7b2a025b202762814ccdb5e8353bcb4d42949 |
| SCREEN_4 | SC_APPROVED_23 | 1440×900 | B0 / SC / GA | private://OA/04.png | 3432cb9163b4c1121a52db15ef6e7b6225de2496462f03e9ecf67eb019d2b584 |
| SCREEN_5 | SC_APPROVED_23 | 1600×900 | B0 / SC / GA | private://OA/05.png | 67dcdb9d8d547d2d8902e87749902f9325bebd6483c54d4553be832585dd11f1 |
| SCREEN_6 | SC_APPROVED_23 | 1920×1080 | B0 / SC / GA | private://OA/06.png | 46fed318abf876635da5e7abc1d0c20e545f771d016dad6242ba0c5e144d6d23 |
| SCREEN_7 | SC_REAL_SELECTED_TOOLTIP | 1440×900 | B0 / SC / GA | private://OA/07.png | 2cef5a8dc91586be1265b83759b53350217ab53f8130da92c9bf74c878b74946 |
| SCREEN_8 | N1_REAL_POST | 1366×768 | B0 / N1 / GA | private://OA/08.png | a4ae2008aa39ac36e2c8a76312bd8eef5251a77d5e3cde08e05c4395609f4cb3 |
| SCREEN_9 | N1_REAL_POST | 1440×900 | B0 / N1 / GA | private://OA/09.png | ca786dde29d370fdfc80e5a84fd3199af2ad53da197b01b5eb846d77ad48fdcc |
| SCREEN_10 | N1_REAL_POST | 1600×900 | B0 / N1 / GA | private://OA/10.png | 1034d20a7af399c4c3e366d379ce41157e26ee40a83f6f29e115c159e7be1a48 |
| SCREEN_11 | N1_REAL_POST | 1920×1080 | B0 / N1 / GA | private://OA/11.png | 014a81025317f071d99928eba8b1d7a115ff9e32211af186e0d182a7d7574952 |
| SCREEN_12 | N1_REAL_RISK | 1440×900 | B0 / N1 / GA | private://OA/12.png | ba9f94854f018a46a05d5e7e26c0d8dac003cc53db934cf874a79ac9fc5cdb6c |
| SCREEN_13 | N1_REAL_CHANGE | 1440×900 | B0 / N1 / GA | private://OA/13.png | f6de188244f58eb6b284adb943e8d81001206e06ef95359207d3701a0cef2232 |
| SCREEN_14 | LF_REAL_OA_LOADING | 1366×768 | B0 / LF / GA | private://OA/14.png | af46895e00c598fc383d2f75bde2405150defdca8ae0b2dc6591a1e96bd72f8e |
| SCREEN_15 | LF_REAL_OA_LOADING | 1440×900 | B0 / LF / GA | private://OA/15.png | a9580150a91db01910bae7d13191fbe1043833549d6067bc4d7a999aca79ec26 |
| SCREEN_16 | LF_REAL_OA_LOADING | 1600×900 | B0 / LF / GA | private://OA/16.png | 247e968f49e5fc0148079d2dc380c4a03dccbe78b8ad97d848cad4c9ef2a14bb |
| SCREEN_17 | LF_REAL_OA_LOADING | 1920×1080 | B0 / LF / GA | private://OA/17.png | 946852dc504d8f7e7bf6cb7dcaf5da6a46289ec9448a6ab6667d7f8a37a772c0 |
| SCREEN_18 | LF_REAL_pFromMw | 1440×900 | B0 / LF / GA | private://OA/18.png | bd8ae6dea907627a3a283141b6804931973876bf372252baf1586d10448b5164 |
| SCREEN_19 | LF_REAL_qFromMvar | 1440×900 | B0 / LF / GA | private://OA/19.png | 3bbc1159443a24dad64c2c2ba42aa49282a5770f01d32eb27861252b71b77b74 |
| SCREEN_20 | LF_REAL_voltagePu | 1440×900 | B0 / LF / GA | private://OA/20.png | e4d64ac70fe7aab29fd7133737c51e93ca449d281c147feee33b4a357ca4a34b |
| SCREEN_21 | LF_REAL_voltageKv | 1440×900 | B0 / LF / GA | private://OA/21.png | e4d64ac70fe7aab29fd7133737c51e93ca449d281c147feee33b4a357ca4a34b |
| SCREEN_22 | LF_REAL_angleDeg | 1440×900 | B0 / LF / GA | private://OA/22.png | f77d874d508e36f6f5285919e5ccba98f6da14ddab910e800037f5d502740b67 |
| SCREEN_23 | LF_REAL_island | 1440×900 | B0 / LF / GA | private://OA/23.png | f4d7ed510352d992d6724fc08ae66fc2d9df5f3268c371a04e2e1141cd3e65b9 |
| SCREEN_24 | LF_REAL_LINE_TOOLTIP | 1440×900 | B0 / LF / GA | private://OA/24.png | 5ee716ced04c41e6e5701e97020155e94588f8a210372e914c9f286a963ccda7 |
| SCREEN_25 | LF_REAL_TRAFO_TOOLTIP | 1440×900 | B0 / LF / GA | private://OA/25.png | fed8f2931131b957d6c75e67d4f944ff71f2c964eb85b82335f49e13d674b80f |
| SCREEN_26 | S2_NEW_CONTROLLED_REAL_DELTA | 1440×900 | S4 / LF / Senaryo−Baz | private://OA/26.png | 358def1b5eba19d75ef643a6eaf4e23d8373065ece9f32f6cab3b6981f42ad08 |
| SCREEN_27 | S2_NEW_CONTROLLED_REAL_TRAFO_TOOLTIP | 1440×900 | S4 / LF / Senaryo−Baz | private://OA/27.png | 0fe5f9d573685f7a56c6f13e0d44f548a43fa2820903a0a5cbcfaeff734f7095 |
| SCREEN_28 | ANALYSES_REAL_LF | 1440×900 | B0 / LF / Senaryo−Baz | private://OA/28.png | dd90f9eaaec03a3b5adf2ccd2403c49e69fee72910640d9d31d6f015a2bbeb22 |
| SCREEN_29 | FILE_URL_REAL_OA_NOMINAL | 1440×900 | B0 / LF / GA | private://OA/29.png | 020ef4866612fbc4f7128e365accf2295978f2616b7a936020987e5e0ddf401e |
| SCREEN_30 | S2_REAL_TOOLTIP_DETAILS_OPEN | 1440×900 | S4 / LF / Senaryo−Baz | private://OA/30.png | d2d029d0d60759b051f1f3e87fa3f945a53b1c443a4a5ae6b2a3aa71a35e86e0 |
| SCREEN_31 | SC_REAL_PF_REFERENCE | 1440×900 | B0 / SC / PF | private://OA/31.png | 5ca18704cd6b4b89093ff1f1b2bca65a31a0d65db5ab253422c93139d92149b7 |
| SCREEN_32 | S1_FIRST_MANEUVER_REAL_DELTA | 1440×900 | S2 / LF / Senaryo−Baz | private://OA/32.png | adbececa72c2be752f46c41859b17e4cb7318b7e1d708ceae5e4728d3d777439 |

## Regresyon ve entegrasyon

Başlangıç kaynağında istenen `npm ci`, typecheck, lint (274 dosya), **398/398 test / fail 0 / skip 0**, üç browser smoke suite, standard build, portable build ve committed raw-byte gate geçti. Önceki HV/LV +7/−7 iddiası yeniden açılmadı; sentetik/unit reversed endpoint testleri geçti, gerçek OA reversed trafo kabulü bunlarla eşitlenmedi. Baseline E2E'nin yeniden ürettiği dört tracked sentetik PNG audit diff'inden geri alındı.

Kaynak dosyaları, testler, eşikler ve portable değişmediği için yeni FAILING implementation regression/fix commit'i yok. Yalnız bu redakte doküman audit dalında commit edilir. Dalın exact SHA CI sonucu kapanış mesajında immutable run bağlantısıyla verilir; [dal CI görünümü](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Aaudit%2Fsn3-oa-real-run-20261011). Önceki main CI: [38160042251](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38160042251).

Uzak ön kontrol main=`d714e1b0ca128ca7b61f2871445449311ef46847`, araştırma/önceki feature dalları yok; mevcut tag korundu. Bu görev yeni main merge veya dal/tag silme yapmaz. Tam native station/droop N-1, IEC 60909 source/correction/member kanıtları, Ip/Ib/Ith, asimetrik SC ve doğrulanmış PF N-1 POST matrisi kabul eksikleri olarak kalır.
