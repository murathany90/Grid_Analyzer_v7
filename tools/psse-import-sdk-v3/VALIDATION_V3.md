# PSS/E Import SDK V3 — doğrudan doğrulama kanıtı

Tarih: **26.10.2026, Europe/Istanbul**. Logların UTC tarihi önceki takvim günü
görünebilir. Kaynak SDK ZIP'i değiştirilmedi. Ayrı çalışma klasörü ve
`fix/psse-import-fidelity-v3` dalı kullanıldı.

## Sonuç ve kabul sınırı

| Doğrudan çalıştırılan kontrol | Sonuç | Kanıt |
|---|---:|---|
| Orijinal SDK / RAW–RAWX eşleri | 11/11 PASS | `evidence/v3/original_audit.json` |
| Orijinal SDK / ilave negatif kontroller | 0/12 PASS, 12 kusur yeniden üretildi | aynı JSON ve stdout |
| Düzeltilmiş SDK / aynı değişmemiş denetim betiği | 12/12 PASS | `evidence/v3_negative_tests.json` |
| Genişletilmiş RAW–RAWX karşılaştırması | 11/11 PASS_NORMALIZED_FIELDS | `evidence/v3_raw_rawx_parity.csv` |
| JSON Schema / gerçek RAW ve RAWX Bridge | 22/22 | `evidence/v3_schema_and_fidelity.json` |
| Canonical kimlik/uç/birim/dispatch kontrolleri | 22 model izdüşümü geçti | `evidence/v3_canonical_fidelity.csv` |
| Taşınabilir Python regresyonu | 39/39, skip=0 | `evidence/v3/portable_tests.txt` |
| Kurulu PSS/E native regresyonu | 8/8 | `evidence/v3/native_tests.txt` |
| Gerçek GA tipleriyle TypeScript noEmit | exit=0 | `evidence/v3/tsc.txt`, başarılı CI |
| TypeScript runtime sınırı | 5 kontrol PASS | `evidence/v3/ts_runtime.txt` |
| Gerçek control1 SAV/RAW HTTP dosya yükleme | 2/2 okundu; yanlış SUCCESS/READY=0 | `evidence/v3_ui_uploads.json` |
| GitHub Actions Ubuntu ve Windows | her ikisi SUCCESS; 39 test/OS, skip=0 | `evidence/v3_ci.json`, `evidence/ci/*.log` |

Başarılı CI: https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/40239492817
Test edilen kaynak commit'i: `d529a893ea0bcdea213a81f595ef3cd2c8ba9e64`.
İlk CI'da Python testleri geçti; parent GA tsconfig nedeniyle TypeScript
TS5112 hatası çıktı. Ayrı CI commit'i `--ignoreConfig` ekledi ve sonraki koşu
iki işletim sisteminde tamamen geçti. Bu düzeltme GA kaynaklarını değiştirmedi.

**Bu sonuçlar tam kaynak fiziği veya GA solver eşdeğerliği sertifikası değildir.**
PASS_NORMALIZED_FIELDS, karşılaştırılan normalleştirilmiş alanları ve kimlikleri
ifade eder. Desteklenmeyen fizik, kaynak kalıntısı ve gerçek model Ybus/solver
paritesi ayrı tutuldu. Hiçbir engelli model için başarılı elektriksel yükleme
veya ilgili analizde READY üretilmedi.

## Bağımsız kusurlar ve karşılıkları

| Denetim | Düzeltilmiş davranış |
|---|---|
| P0-INACTIVE-SLACK | Her elektriksel adada devrede slack üretici ve devrede bara aranır; yoksa BLOCKED. |
| P0-DANGLING-GENERATORS | Eksik bara engellenir; Canonical'a sarkan üretici ucu eklenmez. |
| P0-DANGLING-LOADS | Aynı kapı yük, şönt, trafo, kontrol barası ve fiziksel terminal referanslarına uygulanır. |
| P0-DUPLICATE-IDENTITY | Kaynak sınıflarının anahtarları, ters yönlü mükerrer hat/anahtarlar da dahil, denetlenir. |
| P0-UNSUPPORTED-AC-PHYSICS | DC, VSC, çok uçlu DC, FACTS, indüksiyon ve desteklenmeyen kontrol fiziği BLOCKED. |
| P0-NODE-ELECTRICAL-GRAPH | İspatlanmamış terminal/cubicle ilişkisi BLOCKED; node kayıtları solver barası yapılmaz. |
| P1-RATE-SET-SECOND | Hat ve tüm sargılarda 12 limitin tamamı karşılaştırılır. |
| P1-TX-SECOND-TAP | Bütün sargı oranları/açıları/limitleri ve kontrolleri karşılaştırılır; ikinci oran hesaba katılır. |
| P1-LOAD-ZIP | P/I/Z aktif ve reaktif girdileri karşılaştırılır; GA'ya sığmayan etkin ZIP analizi engellenir. |
| P1-GEN-MBASE | MBASE, kaynak empedansı, P/Q limitleri ve gerilim/kontrol girdileri karşılaştırılır. |
| P1-TS-SOURCEREFS | Dizilerden oluşan gerçek SourceRef sözleşmesi; gerçek GA tipleriyle derleme. |
| P1-SOLVED-ASSUMED | RAW/RAWX/SAV saved method çözüm kanıtı sayılmaz; UNKNOWN ve isSolved=false. |

Denetim betiği değiştirilmedi. SHA-256:
`eb7af3877137bb2dad40940a45feaccabc772d1fcefa4278d102adad7cf29cad`.
Orijinal SDK ve yardımcı ZIP hash'leri `evidence/v3_input_hashes.json` içindedir.

## Ek bulunan gerçek kaynak kusurları

- RAW v36 hat kaydındaki BP sütunu nedeniyle ölçüm ucu ve uzunluk yanlış
  kayıyordu; sütunlar düzeltildi. Sayısal isim ve boş başlık için regresyon eklendi.
- RAWX area/zone/owner anahtarları yanlış isimlerden okunup sıfıra düşüyordu.
- caspy şönt BINIT ve adım değerleri pu iken MVAr etiketleniyordu; sistem
  MVA bazıyla dönüştürüldü. Alan alışverişi pu -> MW dönüşümü de düzeltildi.
- caspy trafo kontrol dizileri sargı başına iç içeydi; varsayılan 0/1 ile
  kapanıyordu. Diziler doğru sargıdan okundu, ikinci sargı limitleri korundu.
- Trafo fazı GA'da radyandır; kaynak derecesi açıkça dönüştürüldü. İki sargı
  oranı tek tap primitive'ine alınır, üç sargı yıldızında magnetizasyon bir kez
  birinci terminale konur. CZ dönüşümü ikinci kez uygulanmaz.
- Slack dispatch'i GA'nın generator ve externalGrid listelerine aynı anda
  iki kez verilmez. Kaynak slack ünitesi Canonical externalGrid'e aktarılır;
  tüm üretici envanteri Bridge'de korunur.
- Model hash'i elektriksel girdiler değişince değişir; export saati değişince
  değişmez. Geçersiz sayılar null veya sıfır yerine açık etiketlerle saklanır.
- Eski doğrudan caspy RAW/RAWX yazıcısı kaynak tablolarını eksiltiyordu;
  doğrulanmamış yazıcı kapatıldı, resmî API yolu ayrı bırakıldı.

## Karşılaştırma kapsamı ve elektriksel kapılar

Gerçek eşler: bench, fault_calc_3wdg_auto_neutral_current,
ieee_harmonics_test_case, sample, sample_nb, sample_nb_sec, sample_zils,
sample_zils_nb, sample_zils_nb_sec, savnw ve savnw_nb.

Sütun kapsamı `evidence/v3_source_field_matrix.csv` içinde **her kaynak tablo
alanı** için NORMALIZED_COMPARED veya NOT_COMPARABLE_SOURCE_RESIDUE olarak
listelenir. Özet oranları `evidence/v3_field_coverage.csv` verir. Aktif RAWX
tablolarının sütunları sayılır; normalleştirilmiş karşılaştırmaya giren
sütun / toplam aktif kaynak sütunu oranı model başına **%33,89–%62,13**.
Bu bir sütun kapsam oranıdır; kayıt hücresi veya solver fizik kapsamı değildir.
Koşullu sargı alanları uygulanabilir kayıtlar için değerlendirilir. Geri kalan
alanlar saklanır, test edilmiş elektriksel denklem diye sunulmaz.

Canonical testi ayrıca kimlik benzersizliğini, sarkan uç olmamasını,
hat R/X/B mühendislik birimlerini, P/Q dispatch'ini ve kapı durumlarını denetler.
Sentetik testler iki taplı kaynak primitive'i ile GA tek taplı primitive'in
kompleks 2x2 Y matrisini bağımsız karşılaştırır; üç sargıdaki yıldız bacakları
orijinal çift empedanslarını yeniden verir. **Gerçek modellerin tam Ybus veya
PSS/E–GA yük akışı paritesi yapılmadı.**

bench kaynağındaki sıfır kV değerleri uydurma 100 kV ile kapatılmaz; mühendislik
birimine çevrilemeyen Canonical ağ engellenir. Node-breaker denetimindeki 0/0
node sonucu bir bağlantı başarısı değildir: fiziksel düğümler Bridge'de kalır,
NODE_BREAKER_UNPROVEN nedeniyle LF/N-1/SC bloke edilir.

Native SAV testleri ayrıca savnw, sample, sample_nb, savnw_nb, sample_zils_nb,
bench, fault_calc_3wdg_auto_neutral_current ve iec60909_testnetwork_50Hz dosyalarını
gerçek kurulumdan okur. Küçük savnw SAV için resmî psspy RAWX export'u ile
caspy Bridge karşılaştırması geçer. Bu karşılaştırmada yazıcının 0,001 MW/MVAr
yuvarlaması nedeniyle ayrı 0,001 toleransı kullanılır. 11 RAW/RAWX eşinde
normal varsayılan 1e-4 tolerans korunur.

Kurulu resmî API sample.sav için ierr=2 ve Xplore 50 bara sınırı döndürdü;
`evidence/v3/official_export.json` ile log kaydı bunu gösterir. Lisans kontrolü
aşılmadı. Büyük SAV'nin native okunması, büyük dosya için yük akışı çözümü
yapıldığı anlamına gelmez. SC daima BLOCKED, IEC-verified iddiası yoktur.

## Kullanıcının özel isteği — dört sekmeli gerçek SAV/RAW test HTML'i

`test_ui/index.html`, `app.js`, `style.css`, yerel `server.py` ve
`start_test_ui.cmd` ZIP'e eklendi. Düzen gridfreq.info Şebeke Modeli sekmesindeki
**Model Özeti / Şebeke Envanteri / İşletme Verileri / Model Kalitesi** ayrımını izler.
Canlı site veya GA'nın uygulama kaynakları değiştirilmedi.

Tarayıcıdaki **gerçek Dosya seç iletişimiyle** control1 `.sav` ve `.raw`
seçildi. SAV, uzantısı kontrol edilerek sahte içerikle gösterilmedi; caspy-direct
ile okundu. Her iki dosyada 6.851 bara, 2.403 hat, 3.703 trafo, 2.920 üretici,
2.520 yük ve 1.618 trafo merkezi görüntülendi. Kaynak hash'i/yöntemi, sınıf seçimi,
arama, sayfalama, işletme girdileri ve kalite gerekçeleri kontrol edildi.
Kalite raporu tarayıcıdan gerçekten indirildi. Tarayıcı error/warn kaydı boştu.
Modelde eksik veya uygulanmayan fizik/kontroller bulunduğundan **BLOCKED** ve
`importAccepted=false`, çıkış kodu 2 gösterildi. İnceleme başarısı, başarılı
elektriksel analiz diye sunulmadı. Kaynak FDNS kaydı UNKNOWN olarak gösterildi.

Yerel ZIP ekran kanıtı: `evidence/ui/control1_sav_summary.png`.
Model dosyaları ve tam çevrilmiş kullanıcı modelleri ZIP/Git'e alınmadı.

## Yeniden üretme komutları

SDK klasöründe:

```powershell
python -m pip install -r requirements-test.txt
python -m unittest discover -s tests -v
py -3.14 -m unittest discover -s tests/native -v
python tests/audit_sdk_v3.py --sdk . --examples "C:\Program Files\PTI\PSSE36\36.5\EXAMPLE" --output evidence/v3_negative_tests.json
python tools/validate_v3.py --examples "C:\Program Files\PTI\PSSE36\36.5\EXAMPLE" --output evidence
python tools/check_ga_types.py --ga-root "C:\path\Grid_Analyzer_v7"
npm exec --yes --package=typescript@7.0.2 -- tsc --ignoreConfig --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler integration/canonical-guard.ts runtime/canonical-guard.native.ts
py -3.14 psse_convert.py --input "C:\Program Files\PTI\PSSE36\36.5\control1\20261014_1200_SN3_TR0.sav" --output-dir runtime/check --format all
start_test_ui.cmd
```

Son CLI komutunun beklenen kodu 2, durumu BLOCKED'dir; Bridge/Canonical
inceleme dosyaları oluşur. CLI stdout kayıtları `evidence/v3/control1_*_cli.txt`.
Ham dosya dosya seçimi ve SAV HTTP yüklemesini tekrar etmek için:

```powershell
py -3.14 test_ui/server.py --port 8765 --write-session runtime/ui_session.json
# Diğer terminalde:
python tools/test_ui_uploads.py --session runtime/ui_session.json
```

TypeScript runtime testini yeniden üretmek için sentetik `bridge()` üzerinden
Canonical JSON oluşturun, guard'ı `--ignoreConfig --module commonjs --outDir
runtime/ts` ile derleyin, `runtime/ts/package.json` içine
`{"type":"commonjs"}` koyun ve
`node integration/guard-test.cjs runtime/synthetic.canonical.json` çalıştırın.
CI tarifi `ci/ga-repository-workflow.yml` içindedir; gerçek iş akışı GA deposunun
`.github/workflows/psse-sdk-v3.yml` dosyasına eklenmiştir.

## Git, lisans ve GA agentına teslim

Yerel bağımsız SDK commit'leri:

- `c2ef8f7` — orijinal kaynak baseline; lisanslı fixture yok.
- `5c9905d` — parser, native birimler, kimlik/topoloji ve analiz kapıları.
- `ff3e661` — regresyonlar, gerçek tip sınırı, yerel SAV arayüzü ve rehberler.
- Kanıt/rapor commit'i ile nihai yerel ve remote SHA'lar `DELIVERY_GIT.json` içinde.

GitHub dalı: https://github.com/murathany90/Grid_Analyzer_v7/tree/fix/psse-import-fidelity-v3
Kaynak ve arayüz ayrı commit'lerle push edildi (`c95c8e2`, `b31a295`), CI düzeltmesi
`d529a89`. Yalnız `tools/psse-import-sdk-v3/**` ve yeni SDK CI iş akışı eklenmiştir.
GA `src/**` ve mevcut importer/worker dosyaları değiştirilmedi. Merge yapılmadı.

ZIP, kaynak kodu, testleri, kanıtları, rehberleri, patch'i ve bağımsız SDK Git
bundle'ını taşır. Siemens DLL/PYD/SAV/RAW/RAWX/SEQ, lisans anahtarı ve lisanslı
örnek modeller içermez. Testler örnekleri kullanıcının kurulumundan okur.

GA agentına verilecek ana dosyalar: `GA_IMPORT_HANDOFF.md`,
`schemas/ga-psse-bridge-v1.schema.json`, `integration/canonical-guard.ts`,
`KNOWN_LIMITATIONS.md`, `VALIDATION_V3.md`, `evidence/v3_*.json/csv` ve SDK kaynakları.
Gerçek model aktarımında ayrıca **Bridge JSON + Canonical JSON + manifest** birlikte
verilmelidir. Yeni GA worker/importer yolu ve analiz kapıları uygulanmadan
mevcut DGS yükleme yoluna PSS/E JSON beslenmemelidir.
