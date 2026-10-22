# Analizler UI sadeleştirme kabulü — 22.10.2026

Dal: `feature/analysis-ux-cleanup`; taban: PR #8 / `d95e50206673fc80a3189db5b6c142c7af262f11`. Test edilen uygulama kaynak commit'i: `2d28f20698b4d24006ba0a66f2a8d8ae694ff9c2`. Sonraki belge commit'i yalnız tasarım/kabul kaydıdır. PR #7, PR #8 ve main merge edilmedi/değiştirilmedi. Sürüm 8.2.5 korunur.

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
- `typecheck`, mimari lint, normal ve portable build PASS. Portable raw byte/LF/determinism gate PASS. SHA256 `8fc752350b7d8122377889fd70d8d7f5653efd93611d347c36b2a01a9ff92038`.
- `npm run test:e2e` sekiz bileşen exit 0. Sonrasında bulunan aile-durumu/süre ve JSON kimlik düzeltmeleri için ilgili 9 test, full unit ve production Worker/UI + 48-görünüm UX kabulü tekrarlandı. Eski büyük benchmark veya bütün eski browser zinciri gereksiz tekrar edilmedi. LF presentation fixture'ının identity options'ı production controller kontratıyla eşleştirildi; gerçek cache kapısı gevşetilmedi.
- Son HEAD için [CI dal kanıtı](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Afeature%2Fanalysis-ux-cleanup). Kesin run URL ve teslim HEAD'i PR/son mesajda ayrıca verilir; yerel PASS, GitHub CI sonucu yerine geçirilmez.
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
- `local-benchmark-results\analysis-ux\PUBLIC-LF-390-1.25.png`: `6076073f9ab57bbf1f9e39406e01cede02a14aebd6cc4579624094a94fe73a2e`
- `local-benchmark-results\analysis-ux\PUBLIC-LF-390-1.png`: `c7ca6bc652cdcdd2b103bff7391d63acd9b77a8b7af6a5e2fee0a99b1df67a11`
- `local-benchmark-results\analysis-ux\PUBLIC-light-1810.png`: `c0cf4d38d14c2277f0e96157ff6e87a4bd23c80f4fa6aadd7b6bcdb0140b4759`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-1366-1.25.png`: `2e4aeee140c25ad07f2e5bcd8668417a1180f537fcdfba9072e42802c7d81b61`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-1366-1.png`: `2cb02a88eff7c75bd3531d21c79ccbb1394d84d30ab13cf8f349f0d5bb72e6e2`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-1810-1.25.png`: `6f9d827bf273eed0cc43bb38a978b6543b19bd4ece9eb0fb389625bd465c9121`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-1810-1.png`: `359df96f68a3c97c3ff688d0c6f93e93a510afe26cf526b40b18988080480612`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-390-1.25.png`: `0c5d01fe70e3b6cd0131d162d648c9f09025ac8ebdd65b52f56f36d82137f3f7`
- `local-benchmark-results\analysis-ux\PUBLIC-N1-390-1.png`: `9fba6faa7388a1c513c7120a59dee17595193c652da0925680b11906f32fc366`
- `local-benchmark-results\analysis-ux\PUBLIC-proof.json`: `983e252594c6f24b60427c188da17f0f30b15e5210f4ac563c2219593363ad9b`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-1366-1.25.png`: `8536dda634a9751122ed1e1b5bf48370d00b6737754a91c10a6c012add50becd`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-1366-1.png`: `f4e9d4584cb5c8e584c19d248a0d7ab52732a4065ed8b00b112e0fa56995b236`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-1810-1.25.png`: `64edd923b964661bab71097990054f03026a55bf2d75b9e738ebee54c6dc3361`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-1810-1.png`: `02eee66e914f9bcc4ba13af45d0a8be00ee2970b93388f38249f90d8ab160afe`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-390-1.25.png`: `9c5b9e9b3b17847c806fcd03be469b3a7cdeb02328e6acc38eb781b3bf786128`
- `local-benchmark-results\analysis-ux\PUBLIC-SC-390-1.png`: `8dd1e76c2eae7dd2d6df1ac0b86b0ff2bfc8725026a060947756d42d613b0787`
- `local-benchmark-results\analysis-ux\PUBLIC-xlsx.xlsx`: `c7f7495d5e7d80345aaf62667d6b16504465088b047a5f8dc13a88ab3fab0f51`
- `local-benchmark-results\analysis-ux\REAL-csv.csv`: `931e77ad64e7817435853b6741834981ee23215a590fd986402b048a3c7cb9b8`
- `local-benchmark-results\analysis-ux\REAL-json.json`: `441ea4b7ecee6a3a151c9f9216ffd96bedf04d58fc1d703680b305a0da7bd7e2`
- `local-benchmark-results\analysis-ux\REAL-light-1810.png`: `c6bbb40eb65b2207fe3ee9d9499206a5916937c77ba087285a010be4e71af2cb`
- `local-benchmark-results\analysis-ux\REAL-N1-1366-1.25.png`: `1d5198a33e851a243096fe1625334c37ae25b4e93bbaf7b9f88f8f6b300db677`
- `local-benchmark-results\analysis-ux\REAL-N1-1366-1.png`: `2a4af08efa897de65b0ebc4439314b0882fe63c95f54d5d15196ef2e5d303be6`
- `local-benchmark-results\analysis-ux\REAL-N1-1810-1.25.png`: `e12db457f09b765e1c8cdf0dc8d73367500ea41fc176c1f3675d43e43cd41d46`
- `local-benchmark-results\analysis-ux\REAL-N1-1810-1.png`: `cdd4e56fe3bae4465eb8ab565273e5ce88b07d41eefd01355f517b321db04653`
- `local-benchmark-results\analysis-ux\REAL-N1-390-1.25.png`: `3a48b590505d9683daf4eca6eb0e296473b2bcb28de04ad13b7c9126112573bc`
- `local-benchmark-results\analysis-ux\REAL-N1-390-1.png`: `bfd6ae6791cf98ccd72fa1eb5145649cb54aa90e9d862b9c53c8b30a10f0e5f0`
- `local-benchmark-results\analysis-ux\REAL-proof.json`: `87e9fa705401f84080b6a9c86eb4e3a6abc7421486a03936e9bd84a4a40d2401`
- `local-benchmark-results\analysis-ux\REAL-SC-1366-1.25.png`: `134f3c822bee6e03748703a728b8a0f70a3b9b644b760d1300d77d9a38a7a44d`
- `local-benchmark-results\analysis-ux\REAL-SC-1366-1.png`: `0779240d250e86596fd9ef4d31caf662712f0aed0a1ccf4dba538104951fbb48`
- `local-benchmark-results\analysis-ux\REAL-SC-1810-1.25.png`: `0befa050cd9265de9b862bfbceea5e2b0abdee28e5a6fd365861728a8392d845`
- `local-benchmark-results\analysis-ux\REAL-SC-1810-1.png`: `5c383e059c5859878c167e05cbfa46b58f5b925e01417678055b28b94cccba71`
- `local-benchmark-results\analysis-ux\REAL-SC-390-1.25.png`: `e144c987b6fd900494c678a056bbe5283603284d5c19099174ad60812110b111`
- `local-benchmark-results\analysis-ux\REAL-SC-390-1.png`: `a3f79312b2870994376ffe4fb32a362b4bcfe09f62e5562b3132395378532be5`
- `local-benchmark-results\analysis-ux\REAL-xlsx.xlsx`: `d8486b60030aff4005e9658cfb5591f3343bfcf3397aa536bd63f71f97a9c446`
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
