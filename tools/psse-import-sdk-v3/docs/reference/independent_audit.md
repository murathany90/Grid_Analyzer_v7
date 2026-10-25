# GA_PSSE_IMPORT_SDK(2) — Kaynak Kod ve Elektriksel Sadakat Denetimi

**Denetim tarihi:** 26 Ekim 2026  
**Girdi:** `GA_PSSE_IMPORT_SDK(2).zip`, agent çalışma günlüğü, PSS®E 36.5 `EXAMPLE.zip`.  
**Yöntem:** ZIP kaynakları çıkartıldı; Python modülleri doğrudan çalıştırıldı; 11 RAW/RAWX çiftinde SDK validatörü çağrıldı; ayrı sentetik negatif testler ve node–bara erişilebilirlik hesabı çalıştırıldı. Orijinal dosyalara değişiklik yapılmadı.

## Yönetici değerlendirmesi

**Koşullu RED: SDK'nın RAW/RAWX verisi aktarma düzeyi ilerlemiş ancak GA'nın gerçek elektriksel hesap modeline üretim aktarımı güvenilir değil.** SDK `ModelValidator` ile 11/11 RAW–RAWX çifti PASS verirken aşağıda yeni eklenen 12/12 sadakat/yanlış-başarı testi FAIL verdi. `StandaloneSavDecoder`, tescilli SAV'nin tamamını çözmüyor; başlık/segment tanısı sunuyor. Native `caspy` işlevleri bu Linux ortamında bağımsız yeniden test edilemedi.

## Doğrulanan pozitif sonuçlar

- ZIP okunabildi: 58 girdi; Python kaynakları sözdizimsel olarak çalıştı.
- SDK unit suite: `python -m unittest discover -s tests -v` → **16 koşulan test, 13 başarılı, 3 atlanan**, 0 failure. Atlananlar Windows/caspy/Windows SAV dosyası gerektiriyor; taşınabilir tüm senaryoların kapsandığı iddia edilemez.
- Gerçek 11 `.raw`/`.rawx` dosya çifti mevcut `ModelValidator` ile **11/11 PASS**. Bunlar tam solver/Ybus doğruluğu değil, validatörün baktığı alanlarda model-parite kontrolüdür.
- Önceki sürümdeki iki kez CZ2 ölçekleme, RAW satır-bölüm ayrıştırma ve doğrudan sahte SAV barası üretme kusurları hedefli testlerde gözlenmedi.

## Yeniden üretilen başarısızlıklar — Kritik P0

| ID | Kaynak | Kanıt | Kabul koşulu |
|---|---|---|---|
| P0-INACTIVE-SLACK | `canonical_mapper.py` aktifliği dikkate almadan `has_swing = len(ext_grids_out)>0` | `savnw` slack jeneratörü servis dışına alındı; hâlâ LF `READY` | İşletmedeki slack ve adalara göre referans doğrulanmalı; aksi `BLOCKED` |
| P0-DANGLING-GENERATORS | `canonical_mapper.py` jeneratörlerin referans baralarını denetlemiyor | Yeni jeneratör `ibus=999999` ile korunuyor, LF `READY` | Bilinmeyen referans reddedilmeli ve sebepler raporlanmalı |
| P0-DANGLING-LOADS | aynı mapper'daki yük eşlemesi | `bus_999999` yükü korunuyor, LF `READY` | Yük/şönt/jeneratör/uzak kontrol terminali için bağlantı doğrulaması |
| P0-DUPLICATE-IDENTITY | `validator.py` ve mapper, dictionary key'e indirgeyerek duplicate girişleri kaçırıyor | 24 kayıt, 23 tekil bara; validatör PASS ve LF READY | Her sınıf için benzersiz ID, çatışma halinde FAIL/BLOCKED |
| P0-UNSUPPORTED-AC-PHYSICS | `rawx_parser.py` unsupported raporluyor; `canonical_mapper.py` analizi hâlâ READY bırakıyor | `sample.rawx` DC, VSC DC, FACTS, asenkron makineler bulunuyor; LF/N-1 READY | Elektriksel davranışa etkili eksik cihaz varsa model `PARTIAL`/`BLOCKED`, kapsam nedenleri yazılmalı |
| P0-NODE-ELECTRICAL-GRAPH | `canonical_mapper.py` node'ları `buses` listesine ekliyor ama kaynak terminal–bara elektriksel kenarları kurmuyor | `sample_nb`: 292 fiziksel `node_*`, 0 tanesi `bus_*` bileşenine hat/trafo/anahtar kenarlarıyla erişiyor; LF READY | Fiziksel düğüm modeli ayrı tutulmalı veya kanıtlı terminal ilişkisiyle bağlanmalı; şüphede LF/N-1/SC BLOCKED |

**Not:** Node testi, oluşturulan CanonicalNetwork içindeki line/transformer/closed-switch kenarlarına dayanır. `parentId` / `sourceRefs` elektriksel hat/anahtar bağlantısı değildir; ileride farklı topoloji solver sözleşmesi kullanılıyorsa onun kaynak koduyla ayrıca ispatlanmalıdır.

## Yeniden üretilen başarısızlıklar — Yüksek P1

| ID | Kanıt | Beklenen |
|---|---|---|
| P1-RATE-SET-SECOND | `rateSet[1]` 1234567 olmasına rağmen validatör PASS | rate1..rate12 / limit tipi/sıcaklık kapsamı ayrımı |
| P1-TX-SECOND-TAP | `winding2.ratioPu` 1.88 olunca PASS | 2W/3W tüm sargı/tap/phase/limit karşılaştırması |
| P1-LOAD-ZIP | `pCurrentMw/qCurrentMvar` alanları 99999 olunca PASS | CP/CI/CZ P–Q parametreleri ve GA fiziği uyumluluğu |
| P1-GEN-MBASE | `mbaseMva` 99999 olunca PASS | makine bazı ve reaktif/aktif sınır kontrolü |
| P1-TS-SOURCEREFS | `GA_IMPORT_HANDOFF.md` `sourceRefs: { psseBus: b.ibus }` kullanıyor; GA `Record<string, readonly SourceRef[]>` bekliyor | Tip güvenli alan provenansı; `any` ile gizleme yok |
| P1-SOLVED-ASSUMED | `raw_parser.py` ve `rawx_parser.py` `solutionStatus.isSolved=True` sabitliyor | çözüme dair kaynak kanıtı yoksa `unknown` ve hesabı koşullu açma |

## Diğer mimari riskler

- Node-breaker şalterleri arasındaki grafik fiziksel düğümlere bağlıyken gerçek AC cihazları ayrı bara ağında kalıyor. `switchingManeuvers=BLOCKED` yazılması tek başına LF/N-1'in güvenli olması için yeterli değildir.
- `shortCircuit3Phase` kapsamı bazı durumlarda "IEC 60909 / ANSI" gibi doğrulanmış normatif çözüm izlenimi yaratıyor. Sequence/synchronous machine/eşdeğer kaynak verileri ve normatif yöntem ayrıca doğrulanmalı.
- `CanonicalNetwork` içindeki `siteIds` bazılarında `area_N` kullanıyor ancak aynı kimlikle `Site` kaydı üretilmiyor. Coğrafi/istasyon bağlamı eksik kalabilir.
- Bridge→Canonical sayısal ve topoloji kontrolü ayrı raporlanmalı. RAW–RAWX geçmesi, iki parser aynı alanları atlıyorsa hatayı yakalamaz.
- `GA_IMPORT_HANDOFF.md` örnek TypeScript fonksiyonu dönüş tipini `any` tutuyor; `src/domain/model/network.ts` sözleşmesiyle TypeScript derlemesi kanıtlanmamıştır.
- GitHub `main` 26.10.2026 saatinde `70c098a93f6cd34f5f83a3f90701dd9ef5ca5a3f`: `src/workers/computation.worker.ts` içindeki `LOAD_MODEL` girişi halen `DgsModel(normalizeSourceClassAliases(raw)...` çağırıyor. Bridge JSON / Canonical JSON'un GA arayüzüne kendiliğinden entegre olduğu iddiası doğru değil.

## Tekrar üretim komutları

```bash
# Python stdlib kullanır; --sdk çıkartılmış SDK kökü, --examples PSS/E EXAMPLE dizini
python tests/audit_sdk_v3.py --sdk /path/to/GA_PSSE_IMPORT_SDK --examples /path/to/EXAMPLE --output /tmp/audit_results.json

# Mevcut SDK birim testleri, SDK kökünde:
python -m unittest discover -s tests -v
```

Yukarıdaki `audit_sdk_v3.py` negatif kontrollerden biri bile başarısızsa **exit code 2** döndürür. Betik SDK üzerinde değişiklik yapmaz. `evidence/independent_results.json` ve `evidence/audit_stdout.txt` kanıt içerir.

## Kabul kararının değişmesi için zorunlu kanıt

1. 11 RAW/RAWX çiftinde aynı veya daha yüksek alan kapsamı ve sıfır yanıltıcı PASS.
2. Bütün 12 yeni negatif kontrolün PASS olması ve bu kontrollerin otomatik CI testlerine eklenmesi.
3. Fiziksel node–terminal–elektriksel bus ilişkilerinin açık veri alanlarıyla kanıtı veya fail-closed kısıtlar.
4. Native SAV→Bridge testinin Siemens kurulumlu Windows'ta gerçek test çıktılarıyla belgelenmesi; bağımsız SAV decoder'ın yalnız diagnostic olduğunun açıkça korunması.
5. GA'da yeni kaynak biçimi adaptörü ve tip güvenli `CanonicalNetwork` eşlemesi gerçek `tsc`/build ile doğrulanması; henüz GA koduna dokunulmaması.

**Karar:** PSS/E agentına hedefli v3 düzeltme görevi verilebilir; GA agentına production entegrasyonu için henüz devredilmemeli.
