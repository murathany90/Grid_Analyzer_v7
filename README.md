# Grid Analyzer

Grid Analyzer, DIgSILENT PowerFactory DGS JSON/ZIP şebekelerini tarayıcıda açan ve envanter, harita, tek hat, senaryo, Full AC, Fast AC, DC ve N-1 analizleri sunan istemci uygulamasıdır. Hesaplanan değerler ölçüm değildir; kaynak model, çalışma durumu ve ayarlara bağlıdır. Sürüm **8.2.5**; Full AC motoru sparse KLU/WASM destekli `BrowserJsEngine`dir. `dist-portable/GridAnalyzer_v7.html` çevrimdışı kullanılabilen tek dosyalık derlemedir.

## Üretim durumu ve kaynaklar

Full AC, DGS + doğrulanmış ControlContext ile çözülür. PowerFactory sayısal sonuçları yalnızca çözümden sonra frozen-state denetimi ve parity ölçümü için okunur. Üretim çözümünde FID düzeltmesi, PF sonucu araması veya ampirik R/X/B/Q katsayısı yoktur. Doğrulanan son aday `pf-parity-v2-validated` annotated tag'idir. Çalışılan `main` SHA'sı `git rev-parse main` ile okunur; SHA dosyanın kendi commit'ine gömülmez.

Doğrulama girdileri:

| Model | DGS ZIP ve ControlContext | PowerFactory LoadFlow CSV |
| --- | --- | --- |
| SN4 | `kontrol1/20261001_1500_SN4_TR0.zip`; `kontrol1/PowerFactory_ControlContext_20261001_1500_SN4_TR0_20261003_224310.csv` | `kontrol1/PowerFactory_LoadFlow_20261001_1500_SN4_TR0_20261003_224310.csv` |
| SN7 | `kontrol1/20261004_1600_SN7_TR0.zip`; `kontrol1/PowerFactory_ControlContext_20261004_1600_SN7_TR0_20261005_205516.csv` | `C:/Users/Murathan Yeniceli/Downloads/PowerFactory_LoadFlow_20261004_1600_SN7_TR0_20261005_205516.csv` |

`kontrol1` içindeki iki Grid Analyzer XLSX sonucu ve PowerFactory station-control DOCX'i korunur. SN7 PowerFactory CSV'si mevcut envanterde Downloads içindedir; doğrulama onu taşımadan okur. Karşılaştırmalar aynı model ve aynı PF export'u kullanır, yalnız ≥66 kV hat/trafo/bara nüfusu üzerinde normalize edilir.

## Full AC denklemleri ve fizik

Her elektrik barasında `I = YV`, `Sᵢ = Vᵢ conj(Iᵢ) = Pᵢ + jQᵢ`. `Pᵢ = |Vᵢ| Σⱼ |Vⱼ|(Gᵢⱼ cos θᵢⱼ + Bᵢⱼ sin θᵢⱼ)` ve `Qᵢ = |Vᵢ| Σⱼ |Vⱼ|(Gᵢⱼ sin θᵢⱼ − Bᵢⱼ cos θᵢⱼ)`. Newton–Raphson, `J Δx = [Pspec−Pcalc, Qspec−Qcalc]` sistemini çözer. Slack açı referansını, PV barası P ve gerilimi, PQ barası P ve Q'yu belirler. Branch uç güçleri çözülmüş kompleks gerilim ve π/admitans modeliyle hesaplanır.

- Hat: `R = TypLne.rline × dline`, `X = TypLne.xline × dline`, `B = TypLne.bline × 10⁻⁶ × dline`; bölümlü hatlarda `ElmLnesec` değerleri toplanır. `ElmScap` seri kolu `R=0, X=−1/bcap` olarak kullanılır.
- İki sargılı trafo: `rₒ = pcutr/(1000·strn)`, `|zₒ|=uktr/100`, `xₒ=√max(0,|zₒ|²−rₒ²)`; seri değerler 100 MVA ve fiziksel bara gerilim tabanına dönüştürülür. Tap için geçerli `mTaps` kV değeri, yoksa `dutap` seçilir. HV tarafı no-load `pfe/curmg` admitansı uç P/Q raporunda da bulunur. LV tap seri eşdeğerinde `ρ²` uygulanır: SN4 frozen-state trafo P/Q %0,05529/%0,38859 ile bunu doğrular. Önceki Formula Set'teki `1/ρ²` ifadesi aynı denetimde %4,12/%5,87 verdiği için uygulanmadı.
- `ElmShnt`: reaktör negatif, kapasitör pozitif Q taşır. Değişken şöntte `ncapa` ile seçilen `mTaps` MVAr kullanılır; sabitte `qrean/qcapn`. `ushnm` ve bağlı baranın nominal kV değeri susceptance tabanını belirler.
- Kaynaktan çözülemeyen değerler tahmin edilmez; ikame edilir veya çıkarılırsa bu görünür olur. İki sargılı trafo tap oranı çözülemezse veya `0,5–1,6` aralığı dışına düşerse `tap=1,0` ikamesi yapılır ve trafo `tapResolution=FALLBACK_*` ile işaretlenir; iki sargılı trafo dışındaki bir dalın parametresi geçersizse dal uyarıyla çıkarılır. Sayımlar `diagnostics.sourceFidelity` altında, kanıt düzeyi `SOURCE_EXACT` veya `PARTIAL` olarak raporlanır. Değişken şöntün etkin kademesi geçersizse `stepProvenance=INVALID_MTAPS` olarak işaretlenir ve sayım `diagnostics.shuntSource.invalidOrMissingStepEntries` altında verilir.
- Yükler sabit P/Q'dur. Dağıtılmış aktif dengelemede uygun yüklerin P'si değişir, Q'su kaynak dispatch'ında sabit kalır. Station dışı generator Q da kaynak `qgini` dispatch'ını korur.

## Integrated station control ve Q sınırları

Zero-droop controller üyelerinde `Qᵢ = qginiᵢ + Kᵢ·ΔQₛ꜀ₒ`; kaynak `cvqq` varsa `Kᵢ=cvqqᵢ/100`, uygun `imode=0` durumda fallback immutable `pgini` payıdır. Dengelemeden sonraki generator P katılım için kullanılmaz. Signed droop için `Qdroop=Srated·100/ddroop` ve `Vtarget=usetp+Qmeas/Qdroop`; SN4/SN7 desteklenen profilde `pQmeas` ilgili generator cubicle'ıdır. Paylaşılan uzak baralı controllerlar aynı sparse Newton sistemine girer. Çözülen değişkenler arasında `Vm`, `Va`, controller `ΔQ` ve etkin P-dengeleme değişkeni bulunur.

`ElmSym.pQlimType` geçerli `IntQlim` eğrisine işaret ederse `cap_P/cap_Qmn/cap_Qmx` noktaları immutable `pgini` üzerinde doğrusal enterpolasyonla değerlendirilir; uçların dışında uç değer korunur. Eğri geçersiz veya yoksa geçerli doğrudan `cQ_min/cQ_max` kullanılır. Station üyesi Qmin/Qmax'a ulaşınca kalan değişim hareketli üyelere dağıtılır. Sınırdaki üyenin yeniden girmesi denklem artığı yönüyle belirlenir: hedef gerilim daha fazla Q gerektiriyorsa QMIN'deki üye, daha az Q gerektiriyorsa QMAX'daki üye serbest bırakılır. Geçmiş Q-dispatch sapmasının işareti yön kararı olarak kullanılmaz. Genel PV→PQ bus limit geçişi de tek yönlü değildir: sınır kendi Newton çözümünde hâlâ bağlıysa üye emekli edilir, içeride kalıyorsa PV'ye döner; karar tamamlayıcılık koşuludur, histerezis değil. Kaynağın Q limiti vermediği üye sınırsız reaktif kaynak sayılmaz: bandı bilinmeyen bir yetenektir, denklemden çözülür ve sınır uygulanmış gibi raporlanmaz.

Etkin station aktif-set sınırları (`maxStationActiveSetRestarts`, `maxStationUnitReleases`) ve controller denklem toleransı gizli sabitler değil, tip ayarlarıdır; `diagnostics.stationControllerSummary.effectiveActiveSetLimits` fiilen kullanılan değerleri raporlar. Doğrulanmış yeniden başlatma bütçesi korunur (SN4 90, SN7 63). Hareketli controller residual'ı, hâlâ Q hareket alanı varken `|Vtarget−Vremote|>0,002 pu` kalmasıdır. Doymuş controllerın aynı residual'ı fiziksel Q sınırının sonucu olabilir; ayrı sayılır. Çözüm sonunda sınırsız/movable residual SN4 ve SN7'de **0**'dır.

## Son PowerFactory karşılaştırması

Normalize ortalama mutlak hata, %. Birincil KPI `abs(|GA|−|PF|)` olarak tanımlıdır ve değiştirilmemiştir. İşaret hatası bu toplama yalnızca küçük tarafın büyüklüğünü kattığı için büyük ters-işaret hataları birincil kapıdan geçebilir; bu nedenle imzalı tanı (signed MAE, p95 ve max `|GA−PF|`, `signDisagreementCount`) ayrı bir `SIGNED_DIAGNOSTICS` kapısıyla değerlendirilir. “Önce” validated `2a163ef8fa2dc6c5d098fe5058eca65569bbb468`; “Sonra” kabul edilen `IntQlim` davranışıdır.

| KPI | SN4 önce | SN4 sonra | SN7 önce | SN7 sonra |
| --- | ---: | ---: | ---: | ---: |
| Hat P | 0,069348 | **0,067189** | 0,163533 | **0,161739** |
| Hat Q | 4,779534 | **4,486271** | 5,691946 | **5,068336** |
| Trafo P | 0,018134 | **0,017830** | 0,085339 | **0,085263** |
| Trafo Q | 3,727118 | **3,469948** | 4,907454 | **3,901936** |
| Bara V | 0,079824 | **0,072193** | 0,102358 | **0,094963** |
| Hizalı açı | 0,133162 | **0,128602** | 0,323144 | **0,313805** |

| İkincil sonuç | SN4 önce → sonra | SN7 önce → sonra |
| --- | ---: | ---: |
| Tüm generator Q MAE, MVAr | 0,212891 → **0,199575** | 0,259819 → **0,192245** |
| Zero-droop generator Q MAE, MVAr | 1,481989 → **1,384396** | 2,063576 → **1,446401** |
| Droop generator Q MAE, MVAr | 0,348045 → **0,331702** | 0,393575 → **0,375352** |
| Hareketli / doymuş residual | 0 / 46 → **0 / 46** | 0 / 41 → **0 / 39** |
| Karşıt Qmin/Qmax generator sayısı | 5 → **5** | 5 → **5** |
| Node motor süresi, s | 4,907 → **4,464** | 2,448 → **2,911** |

SN4 nüfusu: 2.308 hat, 2.892 trafo, 1.733 bara; SN7: 2.303 hat, 2.846 trafo, 1.726 bara. Station dışı Q MAE sırasıyla yaklaşık `4,0×10⁻⁹` ve `3,4×10⁻⁹` MVAr'dır. Frozen PF state denetiminde SN4 hat P/Q `0,00000361/0,00000838%`, trafo P/Q `0,05529/0,38859%`, bus-Q `0,02574 MVAr`; SN7 `0,00000361/0,00000858%`, `0,07503/0,39472%`, `0,02624 MVAr`.

SN7 kalan en büyük Q farkları: ZORLU T7550 HV `258,59 MVAr`, ilişkili H4627 uç Q `230,97 MVAr`; `IntQlim` düzeltmesi KARAKAYA VK1295 total-Q farkını `58,16 → 0,175 MVAr` düşürdü. Beş GA-QMIN/PF-QMAX üyesi hâlâ vardır. Genel λ=0→1 station continuation denemesi bu farkları değiştirmediği için geri alındı. Bu durum mevcut nonlinear aktif sınır seçimi sınırlamasıdır; ekipman denklemleri frozen-state kapısından geçer.

## Çalıştırma ve doğrulama

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run build:portable
node --import tsx tools/frozen-state-audit.ts
node --max-old-space-size=6144 --import tsx tools/sn4-parity.ts
node --import tsx tools/pf-kpi.ts .tmp/sn4-full-ac-result.json kontrol1/PowerFactory_LoadFlow_20261001_1500_SN4_TR0_20261003_224310.csv
node tools/portable-full-ac-benchmark.mjs
```

SN7 için aynı komutlara yukarıdaki ZIP, ControlContext ve Downloads içindeki PF CSV'si verilir. Portable benchmark commit edilmiş `dist-portable` byte'larını kaynakla eşleştirir ve Chromium'da çözer. Son Chromium motor süreleri SN4 **3,09 s**, SN7 **1,89 s**; iki koşuda artifact SHA-256 `7742a11ddbf98328cea4b4c5f4d1093eaa15ada79db3f04586a48261813464a4` kaynakla eşleşti. Full AC motor bütçesi **15 s**'dir.

## Bilinen sınırlar ve geçmiş

Kaynak `IntQlim` için voltage-dependent varyantlar, `inputmod` ve parallel-unit ölçekleri tam modellenmemiştir. Kaynağın Q limiti sağlamadığı generator'lar (SN4'te 7, SN7'de 8 istasyon üyesi) sınırsız kabul edilmez; bunlar `MISSING` olarak sınıflandırılır, denklemden çözülür ve hiçbir sınır uygulanmış gibi raporlanmaz. Genel PV'den Q-limit'a ve geri dönüş artık iki yönlüdür; limit yeniden bağlanan üyeler emekli edilir ve `diagnostics.qLimitActiveSet.generic` altında listelenir. Kaynakta olmayan trafo phase shift varsayılarak eklenmez. Full AC N-1 yerine mevcut ≥66 kV DC aktif güç taraması kullanılır. PowerFactory ile kalan SN7 Q outlierları nedeniyle tek tek santral Q sonuçları genel KPI'larla aynı doğrulukta kabul edilmemelidir.

| Tarihsel aşama | Durum |
| --- | --- |
| 8.2.5 ilk Full AC | Altı KPI ve unsupported droop için tarihsel karşılaştırma: `docs/validation/v8.2.5-finalization.md` |
| Q/V recovery Phase 1–3 | Deneysel geçmiş; üretim semantiği yerine kullanılmaz |
| Final parity v2 | SN4 frozen-state ve integrated station control doğrulandı |
| Final quick fix | Geçerli `IntQlim` önceliği kabul edildi; λ-continuation geri alındı |

Ayrıntılı mimari: `docs/architecture.md`, DGS kaynak profili: `docs/dgs-source-profile.md`, station-control kaynak notu: `docs/DIgSILENT_ElmStactrl_Aktif_Reaktif_Guc_Oturum_Referansi.md`, testler: `tests/unit` ve `tests/regression`.
