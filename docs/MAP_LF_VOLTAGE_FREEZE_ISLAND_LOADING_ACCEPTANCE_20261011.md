# Harita LF donması, Ada/Kuplaj, yüklenme ve tooltip kabulü — 2026-10-11

Dal: `fix/map-lf-voltage-freeze-island-loading-tooltips-20261011`.
Doğrulanmış ata: `5f336d4da39bab0e828f41ab00d0f7a959da2bde`.
Kod, test, anonim ekran görüntüleri ve portable uygulama commit'i: **`f9bba67566371dabcc15ea6dd80b7d1f4c36a62b`**. Bu rapor onu izleyen belge commit'indedir; kendi SHA'sını kendi içine yazmaz. Final HEAD ve o HEAD'in tamamlanmış CI run URL'si kapanış mesajında ayrıca verilir.

CI sonuç görünümü: [yalnız bu dalın CI çalışmaları](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Afix%2Fmap-lf-voltage-freeze-island-loading-tooltips-20261011). Push sonrası kontrol, tam final HEAD'e ait çalışmanın tüm adımlarının başarılı olmasıdır; başka commit'in yeşil sonucu kabul edilmez.

Korunan `main`: `3e20615131f4c419dda80ee1df1a02c2bfcb313f`.
Önceki uygulama dalı hâlâ ata SHA'sındadır. Merge/rebase/cherry-pick veya dal silme yapılmadı. Investigation motor değişiklikleri taşınmadı. Alt agent kullanılmadı.

## Sonuç ve ölçüm sınırı

P0 kabul sınırları geçti: gerçek, yakınsamış B0 LF hazırken SN3/SN4 kV ve açı seçimleri ilk kullanımda 3 saniyenin, sıcak kullanımda 1 saniyenin altında tamamlandı. Canvas'ta gerçek sayısal renklerin bulunduğu doğrulandı. Görünüm/filtre değişiklikleri yeni solver isteği üretmedi. Sekiz LF tercihi, açık Ada/Kuplaj kapısı, doğrulanmış kapasite, uç kimliği ve ayar hassasiyeti uygulandı.

200 ms bir UI işi hedefi her soğuk ölçümde sağlanmadı: ilk gerçek SN4 denemesi 210,2 ms, son SN3 soğuk denemesi 211,5 ms. Sıcak geçişler 39,7–63,3 ms aralığında kaldı. Bütün UI görevlerinin 200 ms altında olduğu veya kapsamlı Long Task/peak heap denetimi yapıldığı iddia edilmez. Progressive/yield altyapısı eklenmedi; algoritmadaki tekrar kaldırıldı.

## Donmanın nedeni ve düzeltme

Eski `representativeStationBus`, her TM için tüm fiziksel terminal dizisini filtreliyor, aynı terminal `Map`'ini yeniden oluşturuyor, çözümlü baraları tekrar tarayıp sıralıyordu. 1.619 TM'de aynı büyük dizi tahsis ve taramaları tekrarlanıyordu. PF TM temsilcisinde satır başına terminal `find` taraması da aynı sorunu büyütüyordu. LF hesabının bitmiş olması, bu sunum maliyetini ortadan kaldırmıyordu.

Yeni model indeksi fiziksel terminal, site-terminal ilişkisi, nominal katmanlar, ekipman ve site-trafolarını bir kez kurar. Sonuç indeksi CalculationIdentity ve çözümlü dizi kimliğiyle fiziksel terminal/partition ve site+nominal temsilcisini bir kez kurar. Aktif bandın en yüksek nominal kV'si; aynı nominalde en yüksek sonlu `vmPu`; eşitlikte stabil bus ID seçilir. U ve açı aynı elektriksel bus'tan gelir. Fiziksel terminal, nominal, partition, duplicate ve açı referansı kontrolleri korunur. Null sonuç sayıya dönüştürülmez.

PF temsilcisi benzersiz FID+nominal hücreyi fiziksel terminal/site ile eşleştirir; duplicate, sentinel, invalid ve null dışlanır. PF açı aynı seçilen PF terminaline bağlanır. N1 bara projeksiyonu da aynı partition indeksini kullanır. Model/dizi, scenario signature, sonuç/identity, kaynak, metrik, aktif band, baseline, hesap ayarları, ControlContext ve kapasite revision değişiklikleri önbelleği geçersiz kılar.

Renderer sonucu projekte etme, viewport/path çizimi ve animasyon yollarını ayrı önbelleklerle yürütür. Topoloji yalnız açık topoloji modunda hazırlanır. Mouse hit adayları muhafazakâr ekran grid'iyle daralır; son karar eski tam segment mesafe hesabıdır. Performans işaretleri `map.index`, `map.solution-index`, `map.project`, `map.paint`, `tooltip.render`; her aşama yalnız son örneğini saklar, sürekli hover geçmişi biriktirmez.

## Sentetik stres

Node 26.5.1, anonim fixture, açık GC. Aynı süreçte eski yol yalnız **100 TM** için ölçüldü; yeni yol **1.619 TM'nin tamamı** için ölçüldü. 1.619/100 çarpımı tahmindir; eski tam harita süresi değildir. Heap değerleri süreç örnekleri arasındaki farktır; peak allocation değildir. Ölçüm sırasında başka kabul/build işleri de çalışıyordu.

| Anonim ölçek | Eski 100 TM | Eski 1.619 tahmini | Yeni tümü soğuk | Yeni tümü sıcak | Eski/yeni heap artışı |
|---|---:|---:|---:|---:|---:|
| 49.275 fiziksel / 4.077 solved | 660,9 ms | 10,70 s | 93,0 ms | 3,38 ms | 100,7 / 32,3 MiB |
| 48.898 fiziksel / 4.088 solved | 850,6 ms | 13,77 s | 54,5 ms | 2,96 ms | 94,3 / 32,7 MiB |

Ölçülen eski 100 seçim ile yeni seçimler deepEqual; soğuk/sıcak tüm seçimler deepEqual. Unit testi tüm site temsilcilerini bağımsız beklenen seçimle karşılaştırır; array/model/identity invalidation, farklı nominal/partition, null/zero ve duplicate hücreler ayrıca sınanır.

Tekrarlanabilir araç: `node --expose-gc --import tsx tools/map-presentation-stress.ts`. Sentetik boyutlar gerçek veri yerine kullanılmaz. Gerçek network snapshot'ları servis dışı/stub terminaller dahil SN3'te 86.762, SN4'te 86.771 fiziksel terminal içerir; sayısal LF sonucu sırasıyla 4.077/4.088 bus ve 5.140/5.141 branch'tir. Her ikisinde 1.619 site vardır.

## Gerçek tarayıcı kabulü ve bütçe

Kullanıcı raporundaki önceki portable `6cdb14ebba00841dead9dcc5e1c27e496aa40721b64dfda7244f01ae973ec3be` / 1.593.889 bayt için **SN4 yakınsamış B0 → kV >110 saniye donma** bağımsız önceki kanıttır. Bu çalışmada eski portable üzerinde bu donma yeniden üretilmedi. Sonuçsuz 20 ms ekran, başarılı LF sunum kanıtı olarak kullanılmadı.

Kendi gerçek kabulümüz normal localhost/HTTP Chrome, üretim `Application` ve tam shell, gerçek Worker kimlikleriyle yapıldı. Worker digest shim'i, `about:blank` veya güvenlik bayrağı kullanılmadı. İçe alma/solve süreleri aşağıdaki seçim sürelerine dahil değildir: model ve B0 LF zaten hazırdır. Ölçüm gerçek dropdown change olayından senkron UI render dönüşüne kadar sürer.

| Aşama | Model | İlk kV | İlk açı | Sıcak kV | Sıcak açı |
|---|---|---:|---:|---:|---:|
| A, sonraki özellikler/build öncesi | SN3 cache | 124,8 ms | 49,1 ms | 39,7 ms | 46,9 ms |
| A, bir gerçek import + bir RUN_AC | SN4 | 210,2 ms | 59,7 ms | 63,3 ms | 59,8 ms |
| Son kod, doğru referans + kayıtlı B0 replay | SN3 | 211,5 ms | 41,5 ms | 42,3 ms | 53,1 ms |
| Son kod, aynı gerçek B0 replay | SN4 | 138,0 ms | 41,4 ms | 51,1 ms | 44,3 ms |

A aşamasındaki seçimden sonraki `setTimeout(0)` heartbeat 0–0,4 ms idi. Bu, seçim tamamlandıktan sonraki olay döngüsü kontrolüdür; 210 ms senkron iş sırasında timer çalıştığı iddia edilmez. Seçimler ve ardışık filtre/hover kontrolleri tamamlandı; devam eden uzun kilitlenme oluşmadı.

Son replay'de SN3 1.514, SN4 1.516 sayısal TM değeri vardı. Bağımsız canvas pixel kontrolü beklenen U renklerini 1.508/1.510 TM merkezinde; açı renklerini 1.508/1.496 merkezde buldu. Üst üste marker, kenar çizgisi ve konum yuvarlaması nedeniyle her merkez için pixel eşitliği beklenmez. Sadece dropdown veya dataset sayacı ile PASS verilmedi.

| Kaynak | Bu işte gerçek model import | B0 Full AC | Son replay import/solve | Filtre/metrikte RUN_AC |
|---|---:|---:|---:|---:|
| SN3, kimliği doğrulanmış önceki gerçek B0 cache | 0 | 0 | 0 / 0 | 0 |
| SN4, mevcut gerçek ZIP + kendi PF referansı | 1 | 1 | 0 / 0 | 0 |

SN3'ün eski model cache'inde bulunan benchmark arşivi, önceki kabuldeki referans arşiviyle farklıydı. Bu kaynak skor kanıtı olarak kullanılmadı. Gerçek güncel referans ZIP'i tekrar okundu, doğrulanmış referans yuvası üretildi; ControlContext hash, model kimliği ve önceki karne referans arşivi aynı olduğu doğrulandı. İlk teşhis ve son doğru hazırlıkta toplam iki **referans paketi okuması** yapıldı; ilave model import veya LF solve yapılmadı. Workbook üzerinden sunulan PF referansının numeric file kimliği mevcut paired-import sınırıyla aynı şekilde kullanıldı. Ham metaveri değiştirilmedi. Final skorlar `EXPLORATORY_ONLY`, fiziksel/endpoint gate `COMPATIBLE` durumundadır; bağımsız tam yöntem paritesi iddiası yoktur.

Development Vite HMR websocket'inin Chrome yerel ağ erişimi uyarıları yalnız bilinen HMR mesajları olarak ayrıldı; pageerror ve diğer console error sıfırdı. Normal portable HTTP smoke ayrıca çalıştırıldı; bu development istisnasına dayanmaz. Gerçek cache replay, normal production-source HTTP shell testidir; portable içinde yeni gerçek solve testi olarak sunulmaz.

## Sayısal değişmezlik ve PF karne

SN3 eski kabul LF vektörleri ile bu işte kullanılan gerçek B0 vektörleri **deepEqual**. UI öncesi/sonrası aynı serileştirmede SHA eşitliği de geçti. SN4 bu işin bir gerçek RUN_AC sonucunun UI/replay öncesi-sonrası SHA eşitliği geçti. Eski main için bağımsız SN4 tam LF vektör karşılaştırması elde yoktur; SN4'te o matematiksel regresyon PASS diye yazılmaz. Motor dosyalarında sıfır diff ayrı kaynak kanıtıdır.

Sabit serileştirme, sırayı değiştirmeden üç dizi:

```text
bus:       [id,vnKv,vmPu,angleRad,pMw,qMvar]
branch:    [sourceClass,id,pf,qf,pt,qt,ifA,itA,pLoss,qLoss]
generator: [id,pMw,qMvar]
JSON.stringify([busRows,branchRows,generatorRows])
```

| Model | Kanonik LF SHA-256 |
|---|---|
| SN3 | `e9cf552fdd356c0fb29464897c193d647537774155c2d094ccdece917b4e6f60` |
| SN4 | `6328d6ae3a92cfbada116afca1ff9f3396ab4ca1789c45a717679d9313fd59e9` |

Yakınsama mismatch: SN3 `2.0407307441128175e-8 MW`, SN4 `2.0918028004190958e-7 MW`. Raw sonuç, loss, compare delta ve JSON/XLSX değerleri yuvarlanmadı.

SN3 aynı referans/ControlContext/ayarlar altında önceki karneyle ortak **56 LF satırının bütün alanları deepEqual**:

| SN3 hat metriği | Tolerans içinde / eşleşen | Sayısal PF uygun kayıt |
|---|---:|---:|
| 400 kV P | 327 / 328 | 337 |
| 400 kV Q | 251 / 328 | 337 |
| 154 kV P | 1908 / 1944 | 1944 |
| 154 kV Q | 1781 / 1944 | 1944 |

Bu tanısal karne sayıları SN4'e kopyalanmadı. GA−PF yöntem kapıları gevşetilmedi.

## Sekiz görünüm, renk ve topoloji

| LF seçeneği | Kaynak/değer | Sunum ve kapı |
|---|---|---|
| Bara Gerilimi (kV) | Aynı nominalde `vmPu × vnKv`; PF native kV | Temsilci bara; renk için bir kez nominalle normalize; aynı TM'de başka nominal karışmaz |
| Bara Açısı (°) | Aynı temsilci bus `angleRad × 180/π`; PF aynı FID | GA referans adası yoksa null; yöntem/ada karşılaştırma kapıları korunur |
| Hat Aktif Güç (MW) | Kanonik from `pf`, native PF hücresi | İmzalı mevcut büyüklük rengi, normal TM |
| Hat Reaktif Güç (MVAr) | Kanonik from `qf`, native PF hücresi | P işareti Q'ya uygulanmaz; gerçek Q uç animasyonu korunur |
| Yüklenme (%) | Doğrulanmış akım limiti / trafo rated MVA | Hat+trafo heat palette; bilinmeyen gri/kesikli; operational aday limit olmaz |
| Trafo Aktif Güç (MW) | Fiziksel nominalden doğrulanmış YG uç P | YG/AG belirsizse null; trafo glyph; hat P animasyonu yok |
| Trafo Reaktif Güç (MVAr) | Aynı YG uç Q | Aynı orientation/kimlik kapısı; hat P animasyonu yok |
| Ada / Kuplaj Topolojisi | Güncel scenario effective network | GA yapısal mod; çözümsüzken yapısal olduğu açık; PF/fark kaynağında kapalı |

Tek dropdown'da iki optgroup: yedi elektriksel, bir topoloji. B-1/B-2 işaretleri yalnız açık Ada/Kuplaj ve mevcut N1 ada görünümünde; normal LF/PF/SC görünümlerinde sıfır. Yakınlaştırma 2 altındayken kuplaj ayrıntısı çizilmez. Route uçları, marker, legend ve hit yolu aynı kapıyı kullanır.

Açık kuplaj ile ayrı elektriksel bağlı bileşen ayrıdır. Gerçekte SN3 425, SN4 412 açık ayrık istasyon; her ikisinde kabul edilen ilişkiler `SAME_COMPONENT_VIA_ALTERNATE_PATH` idi. Bunlar kaynaksız ada gibi boyanmaz. Ayrı bileşen ve scenario ile kapatma davranışı anonim unit fixture'da sınandı. STRUCTURAL/HEURISTIC/AMBIGUOUS güveni ve servis bilgisi korunur.

Yüklenme mevcut domain `selectedCapacity`/`selectedLineLoading` ve post-result assembler yardımcılarını **değiştirmeden** kullanır. Hat maksimumu ve gerçek `ifA/itA` uçları doğrulanmış A paydasına; trafo uç S değerleri doğrulanmış rated MVA'ya bağlanır. Kaynak, basis, season ve status sunum kayıtlarında saklanır. Nominal/yaz/kış/operational seçimi capacity revision ile güncellenir. Yaz/kış veya manuel GA paydasıyla native PF paydasının aynı olduğu kanıtlanmadan yüklenme DELTA/EXPLORATORY_DELTA kapalıdır.

Son gerçek sonuçta SN3 5.131 bilinen/9 bilinmeyen, SN4 5.132 bilinen/9 bilinmeyen branch yükü vardı; bilinen temeller `CURRENT_A`/`APPARENT_MVA`. Gerçek sıfır ayrı kalır. Varsayılan yedi renk aralığı ≤25, >25–50, >50–65, >65–80, >80–90, >90–100, >100; kullanıcı eşikleri izlenir, >100 kırmızıdır. Normal beş nominal renk diğer katmanlarda korunur. P animasyonu yalnız güncel GA LF'de, doğrulanmış iki uç P işaretiyle; PF/N1/SC'de sahte P oku yoktur.

## Tooltip ve hassasiyet

Kart 340 px, max 350 px/max 205 px; güvenli DOM ve viewport clamp. Gerçek TM kartı 340×118,7 px ölçüldü; iki uçlu kartın alan ve clamp sözleşmesi unit/sentetik browser ile kontrol edildi. Başlık/kısa footer sığdırılır; tam ayrıntı seçim, ⚡, Analizler ve XLSX'te korunur. FID/JSON/provenance dökümü hover'a taşınmaz.

Hat uç adı yalnız fiziksel terminal → tek doğrulanmış site ilişkisinden gelir. Örneğin anonim kart `A · Gerçek uç TM`, `B · Gerçek uç TM`; aynı TM iki farklı terminale sahip olabilir. Eşleme yok/çokluysa `Uç A/B • FID` ve `TM_BELIRSIZ`; hat adı parçalanarak isim uydurulmaz. Trafo kartı YG/AG ve kanonik A/B'yi birlikte belirtir; sıralama YG önce olsa da P yönü kanonik A/B'ye bağlıdır.

```text
TM / Uç | P (MW) | Q (MVAr) | Yük (%) | U (kV) | Açı (°)
```

Yük P/Q'dan hemen sonra; doğrulanmış uç paydası varsa iki uç, aksi durumda sadece kayıtlı tek maksimum footer. Null `—`, gerçek zero `0,0`; kayıp P/Q, Tap, servis, GA/PF/N1 AC/DC/SC BLOCKED kaynağı korunur. Kanonik pozitif P terminalden branch'e giriş demektir: `pf>0,pt<0` A→B; tersi B→A; zero/null/aynı işaret belirsiz. Raw P/Q veya negatif uç işareti çevrilmez.

Ortak `formatEngineering`: tr-TR, precision 0–8, nonfinite/null `—`, negative zero düzeltmesi. Yeni kurulum/reset 1; persisted 2 korunur. Gerçekte açık hover kartı precision 1→2 değişiminde kaybolmadan yenilendi. Ayar, LF vektörü ve export precision'ını değiştirmez.

## Masaüstü matrix

| Viewport | Toolbar | Satır/belge taşması | Harita yüksekliği | Kanıt |
|---|---|---|---:|---|
| 1920×1080 | 2×34 px | 0 / 0 | 835,8 px | SYNTHETIC_BROWSER_PASS + REAL_SN3_PASS + REAL_SN4_PASS |
| 1600×900 | 2×34 px | 0 / 0 | 655,8 px | Aynı üç seviye |
| 1440×900 | 2×34 px | 0 / 0 | 655,8 px | Aynı üç seviye |
| 1366×768 | 2×34 px | 0 / 0 | 523,8 px | Aynı üç seviye |

| Kontrol | Bu işte kanıt seviyesi ve sınır |
|---|---|
| LF sekiz seçenek ve normal/Ada marker ayrımı | SYNTHETIC_BROWSER_PASS, REAL_SN3_PASS, REAL_SN4_PASS |
| Sayısal U/açı canvas renkleri | REAL_SN3_PASS, REAL_SN4_PASS; null/band/duplicate unit guard |
| YTM, beş gerilim multiselect, boş filtre | SYNTHETIC_BROWSER_PASS, REAL_SN3_PASS, REAL_SN4_PASS |
| Ayrık/standart hat, sade güzergâh | SYNTHETIC_BROWSER_PASS; sade güzergâh ayrıca REAL_SN3_PASS/REAL_SN4_PASS; gerçek layout geçişi NOT_TESTED |
| Flow, RAF 1/0, kapalı/tab değişimi | SYNTHETIC_BROWSER_PASS; iki gerçek modelde max 1, kapatınca 0 |
| Search/Bul, focus, selection/SLD | SYNTHETIC_BROWSER_PASS; gerçek TM focus/hover REAL_SN3_PASS/REAL_SN4_PASS; yeni gerçek line search/SLD NOT_TESTED |
| Full screen, yardım, kamera | SYNTHETIC_BROWSER_PASS; yeni gerçek fullscreen NOT_TESTED |
| Tooltip boyut/clamp ve açık precision yenileme | SYNTHETIC_BROWSER_PASS + REAL_SN3_PASS + REAL_SN4_PASS |
| Scenario history/restore, PF mismatch, ⚡ panel/paging/XLSX | SYNTHETIC_BROWSER_PASS; önceki gerçek kabul ayrı geçmiş kanıt, bu işte yeni gerçek export/restore NOT_TESTED |
| Aynı SN3 PF karne | REAL_SN3_PASS; 56 satır deepEqual; SN4'e skor ataması yok |
| N1 DC/AC faz ve Q/U kapıları, mevcut N1 ada/risk | SYNTHETIC_BROWSER_PASS + unit; yeni gerçek N1 solve NOT_TESTED |
| SC kaynak/partition/stale ve BLOCKED | SYNTHETIC_BROWSER_PASS + unit; gerçek SN3 B0 BLOCKED snapshot'ı aynı model/scenario kimliğiyle rehydrated, yeni gerçek SC solve NOT_TESTED |
| Servis/kapasite/sezon/operational/unknown | Unit + SYNTHETIC_BROWSER_PASS; iki gerçek modelde nominal known/unknown haritası REAL_SN3_PASS/REAL_SN4_PASS; yeni gerçek yaz/kış geçişi NOT_TESTED |
| Mobile UI geliştirmesi | NOT_TESTED / kapsam dışı; mevcut smoke'ın eski mobile kontrolü korunur |

Anonim masaüstü görüntüleri: [1366](screenshots/map-freeze-20261011/1366.png), [1920](screenshots/map-freeze-20261011/1920.png). Görsel olarak incelendi. Önceki altı metrik görüntüleri değiştirilmedi. Gerçek isim/FID içeren görüntüler ve ham ZIP/JSON/loglar yalnız ignore edilen yerel kabul dizinindedir; commit edilmedi.

## Gates, portable ve dosya kapsamı

`npm run typecheck` PASS; mimari lint **258 kaynak dosyası PASS**. Hedefli indeks/loading/topology/tooltip testleri PASS. Tam unit/regression **372/372**, skipped 0, fail 0. İlk tam koşuda yalnız henüz eski HEAD portable blob'u nedeniyle byte testinin fail olması, kod+portable commit sonrası tam koşuda kapandı; saklanmadı.

Mevcut desktop browser smoke ve PF benchmark browser smoke PASS. Standart build, portable build ve normal HTTP portable PF smoke PASS. Final CI ayrıca aynı tam testleri, iki browser smoke'ı, iki build'i ve committed raw-byte gate'i tam final HEAD üzerinde çalıştırır.

| Portable | Değer |
|---|---|
| Dosya | `dist-portable/GridAnalyzer_v7.html` |
| Bayt | **1.607.251** |
| SHA-256 | **`2ee9c498d3b77e4876a4045a8e5d6c45c5a0661f3872805bc2b06033d985023a`** |
| Committed blob == fresh build | PASS |
| LF-normalized scratch kaynaklardan aynı byte | PASS |
| CRLF sayısı | 0 / 0 |

Orijinal `node --import tsx tools/portable-byte-check.ts` üç gate'i de true, failures [] verdi. Standart üretim bundle'ındaki mevcut büyük-chunk/deprecated build uyarıları bu kapsamda bağımlılık/derleme mimarisi değiştirilerek giderilmedi.

Değişiklik grupları: `src/map/{presentation-index,presentation-timing,screen-hit-grid,loading-presentation,topology-presentation,layer-policy,canvas-renderer,benchmark-controls,equipment-tooltip,result-style}.ts`; `src/ui/components/engineering-format.ts`; settings default/precision yardım etiketi; `ui-workspace.css`; üç map unit dosyası ve anonim scale helper; browser/stress araçları; iki anonim screenshot; portable; bu rapor.

Ata → uygulama commit'i diff'inde `src/analysis`, `src/domain`, `src/workers`, `src/importers`, `package.json`, lock dosyaları **sıfır değişiklik**. Export veya sonuç schema'sı değiştirilmedi. Stage edilen liste ham/private içerik içermedi; `git diff --check` geçti. Bu iş yalnız yeni dalda iki mantıksal commit olarak yayınlanır; main entegrasyonu yapılmaz.

## Desteklenmeyenler

N1 DC Q/U/angle üretmez. Kimlikli gerçek AC POST yoksa NOT_RUN/ISLANDING/unsupported sonucu numeric boyanmaz; kaynaksız N1 angle reference uydurulmaz. PRE/CHANGE için doğrulanmış uç loading yoksa null tutulur. PF N1 POST ve IEC yöntem paritesi mevcut kanıt sınırını aşmaz.

Native IEC eksik kaynak/partition kimliğinde SC BLOCKED ve null kalır; NETWORK_APPROXIMATION bağımsız IEC eşdeğeri olarak gösterilmez, Ip/Ib/Ith desteği bu UI işiyle genişletilmez. Her gerçek modele yeni N1/SC solve yapılmadı. GA−PF ve seasonal loading için yöntem/payda kanıtı bulunmayan durumlar BLOCKED kalır.

İlk soğuk UI işinde yaklaşık 211 ms üst sınır gözlendi; 200 ms hedefindeki bu küçük sapma ve kapsamlı long-task/peak heap ölçümünün yokluğu bilinen performans sınırlarıdır. Eski portable gerçek donmasının aynı makinede yeniden ölçüldüğü veya SN4 eski-main LF matematiksel eşitliğinin kanıtlandığı iddia edilmez.
