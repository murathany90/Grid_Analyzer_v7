# Analizler UI sadeleştirme kabulü — 22.10.2026

Dal: `feature/analysis-ux-cleanup`; taban: PR #8 / `d95e50206673fc80a3189db5b6c142c7af262f11`. Test edilen uygulama kaynak commit'i: `9a9effe97d569e77ee35492c797191e1fc76bd19`. Sonraki belge commit'i yalnız tasarım/kabul kaydıdır. PR #7, PR #8 ve main merge edilmedi/değiştirilmedi. Sürüm 8.2.5 korunur.

## Sonuç ve kapsam

Üç kolonlu ana ekran ve sekiz dar bağlam kartı yerine tek durum satırı, aileye ait KPI ve tam genişlikte sabit sütunlu liste getirildi. LF hat/trafo/bara, N-1 kesinti/aşırı yük ve SC tekil elektriksel bara görünümü vardır. Teknik kanıt, limitler ve eski araçlar varsayılan kapalı native dialog içindedir. Birlikte çalıştırma yalnız gelişmiş araçlardadır. Standalone eski YTM factory'si ve bütün legacy API'ler korunur.

`runEvidence` ile seçili vaka kanıtı ayrıldı. PF görünümü/toplam çalışma sayıları birbirine dönüştürülmez. Hiç çalışmamış aile COMPLETE alamaz; korunan aile başka çalışmanın süresini alamaz. Stale ve JSON-kopyası kimlik denetimleri, AC verified=0, MAX/MIN kaynak seçimi, null/alias kuralları korunur. Solvers, kaynak adapteri, N-1 kuyruk algoritması, matrisler ve Worker hesap protokolü değiştirilmedi. `ytmReferenceRows` yalnız gerekli üç alanı kabul eden parametre tipine daraltıldı; sayısal eşleme gövdesi değişmedi.

## Kabul matrisi

| ID | Kontrol | Sonuç / kanıt |
|---|---|---|
| UX-01 | Üç aile, tek birincil run, gerçek Worker ayrımı | PASS — yeni UI + mevcut production Worker kabulü; N1 SC çağırmaz, SC N1 çağırmaz |
| UX-02 | Başlıklar ve yatay taşma | PASS — public 48, gerçek restore 32 görünüm; 1810/1366 dahil; header range ≤2 satır, document/table overflow=0 |
| UX-03 | Aynı kaydın run KPI'ı | PASS — 660/296/37/30/0 kamu örneği, PF/seçili vaka değişimi sayıları değiştirmez; aile/süre/kopya kimliği testleri |
| UX-04 | LF FROM/HV/kV/Δ | PASS — signed FROM, HV=TO uç örneği, LF barası 66 dahil; identity gate sonrası +3/-2 fark; üç alt liste DOM kabulü |
| UX-05 | N1 bütün adaylar, yöntem ve isimler | PASS — 660 kayıt/50 DOM; 30 sentetik ve 3 gerçek restore AC karıştırılmadı; AC/DC/PF isim listeleri ayrı; eksik POST açık |
| UX-06 | SC >66, MAX/MIN, alias, PF farkı | PASS — 500 bara / 6278 fiziksel hedef; >66 özet; MAX tanısal fark, MIN PF null; IEC verified=false |
| UX-07 | Eksik ≠0, PF seyrek N1 | PASS — unknown rating, yok POST/PF, ada/divergence/bütçe ayrı; ham durumlar detay/exportta |
| UX-08 | Harita/Lightning/kimlik | PASS — fault/case seçimi ve MAX/MIN sourceHash aynı kayıt çiftinden; eski senaryo/cache/undo kabulü korundu |
| UX-09 | Export/tam kanıt | PASS — her iki 660-satır kümesinde CSV/XLSX/JSON hücre karşılaştırması; tam JSON, mevcut cache ve legacy exportlar |
| UX-10 | Kod/derleme/regresyon | Yerel PASS — 710/710 unit/regression, typecheck/lint, build/portable/raw-byte/determinism; 8 bileşenli tam browser zinciri PASS. Yeni HEAD CI durumu aşağıdaki dal bağlantısından ayrı izlenir |

Bu matriste PASS yazılım/sunum kabulüdür; fizik/IEC/PF sertifikası değildir. PR Draft kalır.

## Ayrı veri kümeleri ve ölçüm

| Küme | N1 aday / DC / AC denenen / sayısal / verified | DC∪AC | SC fiziksel / elektriksel |
|---|---:|---:|---:|
| Kamu sentetik sunum fixture'ı | 660 / 296 / 37 / 30 / 0 | 298 | 6278 / 500 |
| Mevcut gerçek SN3/Y6 snapshot restore | 660 / 296 / 3 / 3 / 0 | 297 | 6278 / 500 |

Kamu fixture'ı bir fizik hesabı değildir; kasıtlı örtüşen AC/DC kümeleri ve karşılaştırma kapısı örneğidir. 298=296+DC dışı iki AC; 296+30 toplanmaz. Kullanıcı ekranındaki 30 ve önceki Excel koşusundaki 38 gerçek AC sayısı bu restore dosyasına kopyalanmadı. Kullanılan gerçek kayıt daha eski 3-AC snapshot'tır. Yeni 178 s hesap veya ülke çapı benchmark yapılmadı; 178/180 s motor sözleşmesi değiştirilmedi. Gösterilen 43.814 s bu eski kaydın süresidir, UI restore veya yeni performans ölçümü değildir.

Gerçek model: `C:\projelerim\YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8\kontrol1\20261007_1400_SN3_TR0_dosyaları\20261007_1400_SN3_TR0.zip`. Snapshot: `local-benchmark-results/n1-sc-20261022/SN3-Y6-BALANCED-study-private.json`; SHA256 `89d8bfe9b0331bdcdf07e098aed445907cc6d214a8ad4e780e8de52cc5d0f527`. Model hash: `f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6`. Aynı scenario/settings identity proof JSON içinde saklanır. Bilinen model/snapshot çiftine geri yükleme yapıldı; toplu model keşfi yapılmadı. Son metadata düzeltmelerinden sonra aynı kontrollü UI örneklemi tekrar kabul edildi, hesap motoru çalıştırılmadı.

Referans Excel `Orta_Anadolu_YTM_GA_PF_9_Sekmeli_Analiz_20261022.xlsx` yerelde bulundu; dokuz sekme adı ve LF/SC/N1 kolon semantiği okundu. Yalnız görünüm oracle'ıdır. İlgili PNG referansı belirtilen yerlerde bulunmadı; okunmuş gibi sunulmaz. Gerçek PF paketleri bu UX turunda yeniden içe aktarılıp parite benchmark'ı yapılmadı. MAX/MIN ve PF-delta testleri kamu fixture'ı + mevcut katı eşleme fonksiyonlarıyla yapıldı. 204/38 gibi eski Excel sayıları yeni koşuya sabitlenmedi.

## Görsel ve etkileşim kanıtı

1366,1440,1600,1810,1920,1024,768,390 px × zoom 1/1.25. Headless Chromium **CSS zoom** kullanıldı; native tarayıcı chrome zoom otomasyonu iddiası yoktur. Ölçüm gerçek DOM/Range üzerinden yapılır; yalnız sayfa overflow testi değildir. Görünen başlık metni yüksekliği iki normal satırı aşmaz; tablo genişliği kullanılabilir alanın >%85'i ve DOM satırı ≤50. Mobil kartlar, açık/koyu tema, Enter/Escape/odak dönüşü, detay ve kaynak kimliği test edildi. PUBLIC/REAL pageerror=[]; eski legacy araç gezinmesinde kalan assertion'lar kaldırılmadı. Eski üç-kolon geometri beklentisi artık ileri araçlar diyaloğundaki tek-kolon beklentisiyle değiştirildi.

Görseller: `local-benchmark-results/analysis-ux/PUBLIC-N1-1810-1.png`, `PUBLIC-SC-390-1.25.png`, `PUBLIC-light-1810.png` ve REAL karşılıkları. 1810/390 koyu ve 1810 açık görselleri ayrıca gözle incelendi. Tam harita karo yükleme/çizim süresi veya tepe RSS ölçülmedi.

Ortam: Windows, Core Ultra 7 155U / 14 mantıksal CPU / 16,605,564,928 bayt RAM; Node v26.8.1; Chromium 153.0.8010.12; browser heap sınırı 6 GiB.

## Doğrulama sırası ve kalanlar

- Başlangıç CI #187, aynı d95e502 HEAD'inde 701 test success idi; yeni PASS diye kullanılmadı.
- Hedefli sunum testleri geliştirildi; full unit/regression son durumda **710/710 PASS** (eski 701 + 9 yeni).
- `typecheck`, mimari lint, normal ve portable build PASS. Portable raw byte/LF/determinism gate PASS. SHA256 `7bf28245012c20a41f3cc82d1fb28697e1a6728c331ec39a82a40a60f1358d95`.
- `npm run test:e2e` sekiz bileşen exit 0. Sonrasında bulunan aile-durumu/süre ve JSON kimlik düzeltmeleri için ilgili 9 test, full unit ve production Worker/UI + 48-görünüm UX kabulü tekrarlandı. Eski büyük benchmark veya bütün eski browser zinciri gereksiz tekrar edilmedi. LF presentation fixture'ının identity options'ı production controller kontratıyla eşleştirildi; gerçek cache kapısı gevşetilmedi.
- Son HEAD için [CI dal kanıtı](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Afeature%2Fanalysis-ux-cleanup). Kesin run URL ve teslim HEAD'i PR/son mesajda ayrıca verilir; yerel PASS, GitHub CI sonucu yerine geçirilmez.
- İlk [CI #189](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/39840255143) typecheck/lint ve 710 testi geçti; Browser smoke Linux Chromium 768 px / %125 görünümünde document/table overflow nedeniyle FAIL oldu. Test eşiği gevşetilmedi. `9a9effe` düzeltmesi gerçek liste genişliği ≤700 CSS px ise container query ile kartlara geçer; aynı görünümde 614 px liste genişliği ve sıfır taşma doğrulandı. 48 public + 32 gerçek restore görünümü, iki derleme ve beş portable byte/determinism testi tekrar PASS. `PUBLIC-N1-768-1.25.png` yeni kusurun düzeltme görselidir. Yeni HEAD CI sonucu PR ve teslim kaydında ayrı belirtilir.
- PF/IEC paritesi hâlâ doğrulanmadı; eski yaklaşık 239 kA farklarının fiziksel nedeni bu UI çalışmasıyla çözülmüş sayılmaz. IEC baskısı **IEC 60909-0:2016**; ip/Ib/Ith ve desteklenmeyen asimetrik hesaplar uydurulmadı. N1 eksik POST ve UNKNOWN_RATING korunur.
- P1 yeni 9-sekmeli Excel raporu eklenmedi. Mevcut tam exportlar, 50 satır sayfalama, legacy komutlar, map/Lightning/SLD ve senaryo/cache kontratları korunur. Ana SC özetindeki >66 eşiği hesaplanan düşük gerilimli özgün sonuçları silmez.
- İzlenen ağaç teslimde temiz; başlangıçtaki üç izlenmeyen kullanıcı alanı korunur. Model, PF XLSX/ZIP, özel JSON veya görseller Git'e eklenmez. Kanıt dosyaları yereldir.

## Yerel kanıt / SHA256

`local-benchmark-results/analysis-ux/delivery-manifest.json` bütün çıktı hashlerini ve test edilen kaynak HEAD'ini içerir.

- `local-benchmark-results\analysis-ux\export-consistency.json`: `e30dbe60fa62a316516ab2789e21f7ec511a3b2c0cda84edc391e2730ff64739`
- `local-benchmark-results\analysis-ux\PUBLIC-csv.csv`: `940b8cb0845aa603673696786784fdd11ae3dd68a26d1c8fb1fd25b11b4848bc`
- `local-benchmark-results\analysis-ux\PUBLIC-json.json`: `2a129eef9eec7ee1d0dfe1f884d430b3759dc36c7e129734004e4dfb5eca71b7`
- `local-benchmark-results\analysis-ux\PUBLIC-LF-1366-1.25.png`: `9e44f5f1ae2705baed53177e49c9014bf6f3cd02973cfce205fa878d23e514a6`
- `local-benchmark-results\analysis-ux\PUBLIC-LF-1366-1.png`: `7237c20967e7b6f263979687a5c94e1edfd4b1846f960371b10a633a8844cc98`
- `local-benchmark-results\analysis-ux\PUBLIC-LF-1810-1.25.png`: `93885a19bbf8b6ff5b2b5cac5503b1c725577a0db2bb758c8a40f43914d5c65d`
- `local-benchmark-results\analysis-ux\PUBLIC-LF-1810-1.png`: `cd2ba639d6de2582f261f300e1acabcfdd78dbb2cb252ae8052a3194744b6e65`
- `local-benchmark-results\analysis-ux\PUBLIC-LF-390-1.25.png`: `08c728b28faf0f845eaa90d54d1b9b729c5e41026c4279a0ee71c5eac40bd969`
- `local-benchmark-results\analysis-ux\PUBLIC-LF-390-1.png`: `43bb1d10ec83e923c0021e52fedd34242a969046f24bfc368cec6fa40d6d834e`
- `local-benchmark-results\analysis-ux\PUBLIC-LF-768-1.25.png`: `37d60bdae00691c3c89f56902cd9d3a868766be51b881fe808c4ed33f1065bd4`
- `local-benchmark-results\analysis-ux\PUBLIC-light-1810.png`: `c0cf4d38d14c2277f0e96157ff6e87a4bd23c80f4fa6aadd7b6bcdb0140b4759`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-1366-1.25.png`: `2e4aeee140c25ad07f2e5bcd8668417a1180f537fcdfba9072e42802c7d81b61`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-1366-1.png`: `8b8c1d4aa81cacd38b7043ca53310094a810bada5762a6ed5b0961ce104ba9aa`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-1810-1.25.png`: `6f9d827bf273eed0cc43bb38a978b6543b19bd4ece9eb0fb389625bd465c9121`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-1810-1.png`: `76a6d278f1cbca60f4d686178e15cfacd13d43cb808c77619798ae9771b37ad1`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-390-1.25.png`: `5ab8bf87acbf3cdf03626f9dabc543ba6bb3037f20d5cfb6b2e6bea639e98f1d`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-390-1.png`: `d6fd791834607d611c3b23be327058b0d4cfa327d20c36720cb8d75d18340a28`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-768-1.25.png`: `c2e3315f0b5cc8cca9a8b399c388710052b06378c7769f3cb9776c93903f598d`
- `local-benchmark-results\analysis-ux\PUBLIC-proof.json`: `40059c9035c26634309665b13a76ffac2cf9d251aa2f325ca9376adfe31805c2`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-1366-1.25.png`: `8536dda634a9751122ed1e1b5bf48370d00b6737754a91c10a6c012add50becd`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-1366-1.png`: `f4e9d4584cb5c8e584c19d248a0d7ab52732a4065ed8b00b112e0fa56995b236`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-1810-1.25.png`: `b55ef33f2590d3555eafda8fce466923c99647a513960fc084fad358e8a1484a`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-1810-1.png`: `02eee66e914f9bcc4ba13af45d0a8be00ee2970b93388f38249f90d8ab160afe`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-390-1.25.png`: `d932a7d7ffc4da41ca3938fca70777f039478d0eb98b70e9ea8c163bfaa4ee56`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-390-1.png`: `87864ca9d391a829f22e89264255caa68212e5fe7b0b427ad4a64d80bae84b1c`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-768-1.25.png`: `2157426a4905d392c9a911f817c2f6f5e271dcd0d81c5b74a502fe36636e87c5`
- `local-benchmark-results\analysis-ux\PUBLIC-xlsx.xlsx`: `258a389587eba19d3582d5132a5811ca0ee418a2df76d00a4822742200a96b08`
- `local-benchmark-results\analysis-ux\REAL-csv.csv`: `931e77ad64e7817435853b6741834981ee23215a590fd986402b048a3c7cb9b8`
- `local-benchmark-results\analysis-ux\REAL-json.json`: `441ea4b7ecee6a3a151c9f9216ffd96bedf04d58fc1d703680b305a0da7bd7e2`
- `local-benchmark-results\analysis-ux\REAL-light-1810.png`: `c6bbb40eb65b2207fe3ee9d9499206a5916937c77ba087285a010be4e71af2cb`
- `local-benchmark-results\analysis-ux\REAL-N1-1366-1.25.png`: `1d5198a33e851a243096fe1625334c37ae25b4e93bbaf7b9f88f8f6b300db677`
- `local-benchmark-results\analysis-ux\REAL-N1-1366-1.png`: `b116b801c5d7140af9b402fa246084f614548e259c9595627d61a2694449130e`
- `local-benchmark-results\analysis-ux\REAL-N1-1810-1.25.png`: `e12db457f09b765e1c8cdf0dc8d73367500ea41fc176c1f3675d43e43cd41d46`
- `local-benchmark-results\analysis-ux\REAL-N1-1810-1.png`: `87d423b466b8530149490e5196f4ec6a37a16d1b5ebaa7f9e68a2adf56e1edc2`
- `local-benchmark-results\analysis-ux\REAL-N1-390-1.25.png`: `90a81383c4e9c3eb7d56e1a9d90a3642833e041f93cc85f1d1182cc38d0d9651`
- `local-benchmark-results\analysis-ux\REAL-N1-390-1.png`: `46f0ef6ea4433485e7b89102bbbd75b8a1af7255e8e06990d8010c35ddd56b6e`
- `local-benchmark-results\analysis-ux\REAL-proof.json`: `c391f79531de02967298cb0962a1d55fb825fa7f75a4cdd20b9671388bbdc51f`
- `local-benchmark-results\analysis-ux\REAL-SC-1366-1.25.png`: `134f3c822bee6e03748703a728b8a0f70a3b9b644b760d1300d77d9a38a7a44d`
- `local-benchmark-results\analysis-ux\REAL-SC-1366-1.png`: `0779240d250e86596fd9ef4d31caf662712f0aed0a1ccf4dba538104951fbb48`
- `local-benchmark-results\analysis-ux\REAL-SC-1810-1.25.png`: `0befa050cd9265de9b862bfbceea5e2b0abdee28e5a6fd365861728a8392d845`
- `local-benchmark-results\analysis-ux\REAL-SC-1810-1.png`: `c0dcff3c7996422abb5bbb9c3e60422271cc171f87641539f8e2953571ef5343`
- `local-benchmark-results\analysis-ux\REAL-SC-390-1.25.png`: `30c56c2da8ca39a1be91e40537c62145ad07391e46677bf17077288c3f6beef8`
- `local-benchmark-results\analysis-ux\REAL-SC-390-1.png`: `e76d6f7577b9593fd801db092ecf17fa8d842037c760d3fc0b2b159a77e590e8`
- `local-benchmark-results\analysis-ux\REAL-xlsx.xlsx`: `e2bd5ac8cafdb41202257022e59373c209c654000570358ad836e6efd124e274`
- `local-benchmark-results\analysis-ux-ci-fix-browser.log`: `ee9cd7c088aed4d62d97dcd22e0a71e2b1afbc6ccd686a6ffedd451f8bb7eeb6`
- `local-benchmark-results\analysis-ux-ci-fix-build.log`: `147504a38764e539e14a01b9989453ec6a3cd8c9ac6d2d5f44c8851efecbc6b3`
- `local-benchmark-results\analysis-ux-ci-fix-bytes.log`: `8fd7b78e512b09062ffbc394f37563c19ca8c04d9625bf7e21cd92f0f55aba7f`
- `local-benchmark-results\analysis-ux-ci-fix-portable.log`: `1eacf4a6c25d848ced31150f1adccc54a85a82663799a966b6544de04c5b9e29`
- `local-benchmark-results\analysis-ux-ci-fix-real.log`: `75850decd3a93f2d837f1ec94f8dfc706bb383e83bff812d72e7bedff1c0df3b`
- `local-benchmark-results\analysis-ux-final-browser-targeted.log`: `ee9cd7c088aed4d62d97dcd22e0a71e2b1afbc6ccd686a6ffedd451f8bb7eeb6`
- `local-benchmark-results\analysis-ux-final-build.log`: `951780a4bbb453aba38c5becb07cc19e62499c607abb6080506ccd593149339c`
- `local-benchmark-results\analysis-ux-final-e2e.log`: `e3c0874dda8383a970bddf941abe7bf6a45c07a436dd3060ead6b360c72addc1`
- `local-benchmark-results\analysis-ux-final-lint.log`: `83035be32b241a8d094e3b96e1385f7c8661072c6c89fc86cea0ab1cfdfbcf2b`
- `local-benchmark-results\analysis-ux-final-portable.log`: `32d9637d96973d24e481a9545d67c7ae712f8e81b644562b33ce258c61966340`
- `local-benchmark-results\analysis-ux-final-presentation-targeted.log`: `245eb3623635ad376816471ed28b3044cde327eca3dc13fab73918e8f6cb1e92`
- `local-benchmark-results\analysis-ux-final-real-restore.log`: `75850decd3a93f2d837f1ec94f8dfc706bb383e83bff812d72e7bedff1c0df3b`
- `local-benchmark-results\analysis-ux-final-typecheck.log`: `4705264512873d100001596d121fc681416c19110314597dc74c7e68e2119a59`
- `local-benchmark-results\analysis-ux-final-unit.log`: `7123c8fbae1b5d3d67c7ac8e88b2a127f058982773e9164d493de3be431524b8`
- `local-benchmark-results\analysis-ux-final-worker-targeted.log`: `266095e04a60b48c1bab645d68afa94eb1c8e1947018dcd6e04855997746089d`
- `local-benchmark-results\analysis-ux-ci189-failure.txt`: `c1cb2004d14b75f3407ede22549fcf43b06eb856b6b72ec9ad1175b84ab621eb`

## Değişen dosyalar

- `dist-portable/GridAnalyzer_v7.html`
- `docs/analysis-workspace-ui-acceptance-20261022.md`
- `docs/analysis-workspace-ui-design.md`
- `package.json`
- `src/analysis/ytm-study/export.ts`
- `src/features/analysis/analysis-dialog.ts`
- `src/features/analysis/analysis-workspace.ts`
- `src/features/analysis/compact-rows.ts`
- `src/features/analysis/compact-study-view.ts`
- `src/features/analysis/comparison-export.ts`
- `src/features/analysis/presentation-scope.ts`
- `src/features/analysis/run-evidence.ts`
- `src/styles/analysis.css`
- `tests/helpers/analysis-ui.ts`
- `tests/unit/analysis-compact-rows.test.ts`
- `tests/unit/analysis-run-evidence.test.ts`
- `tools/analysis-evidence-acceptance.mjs`
- `tools/analysis-navigation.d.mts`
- `tools/analysis-navigation.mjs`
- `tools/analysis-ux-browser.mjs`
- `tools/browser-smoke.mjs`
- `tools/pf-benchmark-browser-smoke.ts`
- `tools/workspace-unification-browser.mjs`


## Merge preflight — 23.10.2026

Merge yapılmadı. PR #7/#8/#9 HEAD başlangıçları 9e8c029/d95e502/0284f44 olarak doğrulandı. PR #9 CI #191 success. Hedefli PR #9 düzeltmeleri: LF başarısız fakat kimliği güncel bir girişim artık stale yerine açık yakınsamama durumu gösterir; sayısal sayaç ve listeler boş kalır. Standalone SC için YTM ve TM filtreleri elektriksel tekilleştirmeden önce uygulanır, sayaçlar aynı kapsamı izler; tam hesap/cache değiştirilmez. 11 hedefli test, typecheck/lint, portable build ve 48 görünüm browser kabulü PASS.

Zorunlu gerçek model LF görünüm kanıtı eksik: analysis-ux/REAL-proof.json yalnız N1/SC içerir (32 görünüm); PUBLIC LF sentetiktir. desktop-final-cache-lf-private.png eski Lightning görünümüdür, yeni PR #9 LF listesinin kabulü sayılamaz. Gerçek N1/SC 1810 ekranları okunabilir, mevcut DOM kanıtında taşma yoktur. Bu eksiklik giderilmeden PR zincirinin hiçbiri merge edilmez; yeni kapsamlı hesap/benchmark başlatılmadı. Özel kanıt dosyaları yerelde kalır. Yeni HEAD CI sonucu PR/teslim kaydında ayrıca verilir.
