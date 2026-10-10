# Main bütünleştirme kabulü — 2026-10-10

Eski main: `f13567add3a0d4b16d4dc164b6a9cd645d5fa2b5`. Başlangıç final dalı: `431e6c8f3a2b283223b777814d3312f038aa7141`. Kabul edilen uygulama commit'i: `3bfa536dc203876c3779f90ba6a260e9b0a4a4a4`. Main'e kabul edilen integration HEAD: `eb53c267529226a2e25ebb23196b3dd85395b9f5`. Yerel staging: `integration/ga-431e6c8-main-20261010`; main'in atasıdır, yöntem **tek fast-forward**. [Main kabul CI'sı: success](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38070305007).

Portable SHA256: `d9428222d8b7313a14360dcbca91030b47f2b2a5e13e6fa1a84cdac7168da186`. Gerçek mini-kabul bu **commitlenmiş HTML'nin aynı ham baytları** üzerinde, localhost secure context / gerçek Worker / IndexedDB ile yapıldı. Eski aday `0ef407…` ve önceki final `9c1068…` bu kabulün binary'si değildir. Kapanıştaki yalnız belge commitleri portable'ı değiştirmez; main/CI eşitliği ayrıca doğrulanır.

## Hedefli düzeltmeler ve test

B0 PF karnesi empty B0 overlay + B0 LF ile hesaplanır, cache aktif S1/S2'den bağımsızdır. Etiketi B0 kapsamını açıklar. Ayrı S1/S2 PF kanıtı olmadan B0 PF, senaryoya uygulanmaz; GA senaryo−GA baz ayrı kalır.

N1 READY kimliği seçili case/faz/metrik için mevcut sayısal kayda bağlıdır; genel hibrit/DC run kimliğine düşmez. Map'in mevcut model/scenario/settings/metot/partition kapıları kullanılır. Geometri eksikliği sayısal sonucu geçersiz yapmaz. DC yalnız P/tahmini loading üretir; eksik AC Q/V/I null/NOT_RUN. Cache bu seçimin ve kaynak nesnelerinin değişimini izler.

3 yeni hedefli test + önceki 349 = **352 pass / 0 fail / 0 skip**. Typecheck, mimari lint (244 dosya), Chromium smoke, PF benchmark browser smoke, standart ve portable build geçti. Solver/worker/importer/N1 çekirdeğinde bu tur **diff yok**. Araştırma dallarının 3 benzersiz commit'inin uygulama HEAD'inin atası olmadığı ayrıca kontrol edildi; hiçbiri merge/rebase/cherry-pick edilmedi. Ek ajan yok, paket kurulumu yok.

## Gerçek mini-kabul — tek model yüklemesi

SN3: **1 import, 3 LF (B0/S1/S2), 1 non-bridge DC N1, 1 seçili AC N1 denemesi, 2 tek-terminal SC MAX**. S1 bir hat açık; S2 aynı hat + non-bridge trafo açık. B0/S1/S2'de 4077 bara; branch 5140/5139/5138. 95/94/94 toplam Newton, final tur 2 ve 79 ada NR çözümü; solver süreleri 3.19/3.07/2.48 s. Kaynak model değiştirilmedi.

B0 vektör digest'i: `e9cf552fdd356c0fb29464897c193d647537774155c2d094ccdece917b4e6f60` (bara V/açı/P/Q, branch uç P/Q/I/kayıp ve jeneratör P/Q). Önceki gerçek B0 vektör digest'i **aynı**. Kapsam/tolerans/MAE/P95/maks bütün ortak karne satırlarında birebir aynı; solver gerilemesi gözlenmedi.

B0↔S1↔S2 geri dönüşü yeni LF başlatmadı. B0 karnesi S2/S1/B0 seçiliyken aynı kaldı; harita/Analizler/SLD/⚡ S2 LF kimliği aynıydı. DC seçiliyken V metriği NOT_RUN oldu. AC N1 **UNSUPPORTED_CONTROL_CONFIGURATION / UNSUPPORTED_STATION_CONTROL**, sonuç null; başarı/AC paritesi iddia edilmez. Bu bloke denemeden sonra doğrulanmış DC P/loading kaydı korunur; AC gerilim metriği yine NOT_RUN. Tek AC denemesi tekrar edilmedi.

SC native: 1 BLOCKED. Açık kullanıcı varsayımlı yaklaşım: 1 CALCULATED_NETWORK_APPROXIMATION; Ikss 6.7083901 kA, Skss 4647.709 MVA; **Ip/Ib/Ith null**, IEC eşdeğerliği iddiası yok. SN4: 1 import + referans kısa smoke 35.18 s, yeni LF/N1/SC yok. Toplu vaka/fault taraması yok.

Kabul yardımcısı iki kez aynı SN3 tarayıcısına yeniden bağlandı: bloke AC'de DC kaydının korunması beklentisi düzeltildi; CDP download dosyası yerine gerçek export Blob'u okundu. **Tek import ve hesap bütçesi değişmedi**; UI/result kimlikleri taklit edilmedi.

1440×900: kapalı drawer, toolbar 47.23 px, harita 597.77 px. 390×844: toolbar 74.27 px, harita 487.23 px; mobile drawer/bottom sheet. Overflow yok, tooltip viewport içinde, tıklama harita yüksekliğini değiştirmiyor, JS pageerror yok. SC harita/⚡ aynı kimlikteydi.

## Yeni gerçek PF–GA B0 karne — tanısal

Tolerans GA-ENGINEERING-1.0: MW/MVAr/MVA 1 birim + %1×|PF|; kV 0.5 + %0.5×|PF|; pu 0.005 + %0.5×|PF|. Kapsam = eşleşmiş/uygun sayısal PF; tolerans içi = |Δ| eşiğini aşmayan/eşleşmiş. LF yöntemi doğrulanmış PF paritesi değildir. 220 kV sayısal referans yok; N1 PF post-case ve SC IEC/partition kanıtı yok: yüzdeler/hata null. Önceki gerçek ölçüme göre aşağıdaki bütün değerler aynı; gelişme yüzdesi iddia edilmedi.

| kV | Tür/metrik | Eşleşen/uygun | Kapsam % | Tolerans içi / % | MAE / P95 / maks |
|---:|---|---:|---:|---:|---|
| 400 | bus / voltagePu | 231/245 | 94.286 | 231/231 = 100 | 0.00032347 / 0.00142538 / 0.00971953 pu |
| 400 | line / pFromMw | 328/337 | 97.329 | 327/328 = 99.695 | 0.40638 / 1.29722 / 2.7433 MW |
| 400 | line / qFromMvar | 328/337 | 97.329 | 251/328 = 76.524 | 1.79749 / 9.24497 / 37.3926 Mvar |
| 400 | line / sFromMva | 328/337 | 97.329 | 311/328 = 94.817 | 0.684121 / 2.59143 / 11.1171 MVA |
| 154 | bus / voltagePu | 1483/1530 | 96.928 | 1424/1483 = 96.022 | 0.00189063 / 0.00557868 / 0.0826922 pu |
| 154 | line / pFromMw | 1944/1944 | 100 | 1908/1944 = 98.148 | 0.133579 / 0.52313 / 7.71554 MW |
| 154 | line / qFromMvar | 1944/1944 | 100 | 1781/1944 = 91.615 | 1.16355 / 3.79823 / 243.184 Mvar |
| 154 | line / sFromMva | 1944/1944 | 100 | 1867/1944 = 96.039 | 0.480318 / 1.003 / 183.735 MVA |
| 66 | bus / voltagePu | 14/15 | 93.333 | 14/14 = 100 | 0.000191038 / 0.00097952 / 0.00097952 pu |
| 66 | line / pFromMw | 8/8 | 100 | 8/8 = 100 | 0.000536385 / 0.00213263 / 0.00213263 MW |
| 66 | line / qFromMvar | 8/8 | 100 | 8/8 = 100 | 9.52078e-05 / 0.000197174 / 0.000197174 Mvar |
| 66 | line / sFromMva | 8/8 | 100 | 8/8 = 100 | 0.000563211 / 0.00212399 / 0.00212399 MVA |

[120 strata toplulaştırılmış karne](MAIN_INTEGRATION_PF_SCORECARD_20261010.csv); FROM/TO, HV/LV ve Vpu/kV dahildir. ZIP/XLSX, ham FID listesi ve gerçek result JSON'u Git'e alınmadı.

## Silme öncesi dal kaydı

Aşağıdaki son SHA'lar **silmeden önce** `eb53c267529226a2e25ebb23196b3dd85395b9f5` rapor commit'inde kaydedildi. Silme main CI success + aynı portable + gerçek mini-kabul sonrasında yapıldı. Yedi uygulama dalının ayrı ayrı main'in atası olduğu, son SHA'larının değişmediği ve açık PR bulunmadığı tekrar doğrulandı. Üç investigation dalı, kullanıcının açık kesin talimatıyla **kodları taşınmadan atıldı**; ancestry koşulunun investigation'a uygulanmaması bu talimattan kaynaklanır. Uzak main ve tag/release korundu.

| Dal | Silme öncesi son SHA | Sınıf |
|---|---|---|
| `feat/pf-sn3-sn4-benchmark-20261009` | `b85ca2fe35b154cf9f8c5204716ddf2219bf7cb2` | main geçmişindeki uygulama |
| `feat/ga-n1-hybrid-iec60909-20261009` | `0cf28d030c06316488515eeb275407d896fc7f68` | main geçmişindeki uygulama |
| `fix/pf-ga-diagnostic-map-n1-sc-20261009` | `207e42f634830a43783eb261153f2260dc915ffe` | main geçmişindeki uygulama |
| `feat/ytm-n1-full-ac-iec60909-parity-improvements` | `36336c77701601bccea995b4db0e2fe236394548` | main geçmişindeki uygulama |
| `fix/ytm-n1-constraints-sc-pf-parity-20261010` | `dc1e3082aed8384a9e7bd41858096a3a5c4fded6` | main geçmişindeki uygulama |
| `feat/ui-model-analysis-compare-help-20261010` | `1c1f0c54ddcb31765f783aee3e8f3015ca346557` | main geçmişindeki uygulama |
| `feat/map-scenarios-unified-lf-n1-sc-pf-20261010` | `431e6c8f3a2b283223b777814d3312f038aa7141` | main geçmişindeki uygulama |
| `q_parity_investigation` | `18a213915f7b32567f22d2b2617587e9795a0e79` | kullanıcı talimatıyla atılan araştırma |
| `investigation/q-parity-transformer-q-balance` | `f6c79ba77f256590d31727dfe2584fbfaae056aa` | kullanıcı talimatıyla atılan araştırma |
| `investigation/u2909-same-root` | `9be1b81222f7d1f0c344c29b8ff823a66b7f799d` | kullanıcı talimatıyla atılan araştırma |

## Kapanış durumu

**MAIN_ACCEPTED / CI_SUCCESS / REMOTE_CLEANUP_PASS.** Eski main → `eb53c267529226a2e25ebb23196b3dd85395b9f5` tek fast-forward ile push edildi. CI `38070305007`, validate job `114266168843`: **success**, 352 pass / 0 fail / 0 skip; typecheck, lint, iki browser smoke ve build'ler başarılı. CI built ve committed portable ham SHA256'sı yukarıdaki `d9428222…` ile aynı; `COMMITTED_PORTABLE_BYTES OK` logu doğrulandı.

Main'e geçişten sonra aynı gerçek SN3 tarayıcısı ve aynı portable üzerinde SC S2→B0 geçişinde NOT_RUN temizliği, S2'ye dönüşte SC kimliğinin geri gelmesi, kaydı olmayan başka N1 case'inde NOT_RUN ve DC Q metriğinde NOT_RUN doğrulandı. LF'ye dönüşte önceki S2 kimliği korundu. **Yeni import/hesap yok.**

Tablodaki **10 uzak dalın tamamı silindi**. Öncesi/sonrası `ls-remote`, fetch/prune ve ancestry kontrolü yapıldı; kalan uzak dal **yalnız main**, temizlik sonrası SHA `eb53c267529226a2e25ebb23196b3dd85395b9f5`. Üç benzersiz araştırma commit'i silme sonrasında da main'in atası değil. Hiçbir araştırma hesap motoru değişikliği yeniden denenmedi veya taşınmadı. Açık PR yoktu; tag ref'leri birebir korundu, release değiştirilmedi.

Yerel integration staging kabul kaydı olarak korunuyor; uzakta yayınlanmadı. Bu kapanış kaydının sonraki commit'i yalnız raporu değiştirir; kaynak ve portable aynı kalır. Teslim anındaki güncel main SHA ve bu belge commit'inin CI sonucu kullanıcı özetinde ayrıca verilir. [Güncel main CI çalışmaları](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Amain).

## Kalan en çok 5 konu

1. LF yöntem/control eşdeğerliği doğrulanmadı; 400 kV Q ve 154 kV Q/S kuyruk hataları korunuyor, yeni reaktif parite araştırması yapılmadı.
2. Seçili gerçek AC N1 desteklenmeyen station-control nedeniyle bloke; PF tam post-case paritesi yok.
3. SC native/IEC kaynak-partition kanıtı eksik; yaklaşım ayrı ve Ip/Ib/Ith null.
4. 220 kV sayısal PF veri yok; 66 kV %100 sonucu yalnız 8 hat çiftidir.
5. UI karne Git SHA'sı kullanıcı beyanıdır; gerçek teslimin kaynak/portable kanıtı bu rapor + CI'dir. IndexedDB kalıcı depolama kotası için TTL/kota yöneticisi bu hedefli turun kapsamına alınmadı.
