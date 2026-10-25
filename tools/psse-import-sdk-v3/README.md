# PSS/E Import SDK V3 — elektriksel sadakat onarımı

SAV, RAW ve RAWX kaynaklarını Bridge JSON'a okur, GA'nın gerçek
CanonicalNetwork tipine kontrollü bir AC izdüşümü üretir. Eksik uçlar,
mükerrer kimlikler, referanssız adalar ve desteklenmeyen fizik başarılı
elektriksel yükleme olarak raporlanmaz. GA uygulamasının kaynakları değiştirilmedi.

## Kullanıcının özel isteği: gerçek SAV/RAW test HTML'i

ZIP'i bir klasöre açın ve **`start_test_ui.cmd`** çalıştırın. Python 3.14 ve
yerel PSS/E 36.5 kurulumunu kullanır; tarayıcıda yerel adresi açar.
`test_ui/index.html`, sunucu üzerinden çalışır. Tarayıcı tek başına SAV okuyamaz.

**Dosya seç** ile gerçek `.sav`, `.raw` veya `.rawx` seçilebilir. `control1`
kısayolları şu klasördeki gerçek dosyaları okur:
`C:\Program Files\PTI\PSSE36\36.5\control1`.

Dört alt sekme: **Model Özeti**, **Şebeke Envanteri**, **İşletme Verileri**,
**Model Kalitesi**. Envanterde sınıf seçimi, arama ve sayfalama; kaynak kimliği,
kapasite gerekçeleri ve Bridge/Canonical/kalite raporu indirme vardır.
SAV, kurulu Siemens caspy ile gerçekten okunur; dosya uzantısına bakarak
sahte demo verisi üretilmez. Dosyalar yalnızca yerel döngü adresinde işlenir.

Bu test arayüzü gridfreq.info'nun dört sekmeli düzenini izleyen ayrı bir
SDK inceleme aracıdır. Canlı siteye veya mevcut GA importer'ına eklenmedi.
İnceleme için okunabilen bir dosya, elektriksel analiz kabulü anlamına gelmez.
Yeni bir yük akışı çözümü çalıştırılmaz; kaynak çözüm durumu UNKNOWN gösterilir.

## CLI

```powershell
py -3.14 psse_convert.py --input "C:\path\model.sav" --output-dir output --format all
python psse_convert.py --input "C:\path\model.raw" --output-dir output --format all
python psse_convert.py --input "C:\path\model.rawx" --output-dir output --format all
```

SAV için PSS/E'nin kurulu Python sürümü gerekir; bu makinede Python 3.14.
Siemens caspyc ile UTF-8 modu kullanılmamalı; gerekirse `set PYTHONUTF8=0`.
Kurulum yolu `GA_PSSE_DIR` ile değiştirilebilir. DLL/PYD/lisans pakette yoktur.

Çıktılar: `.ga-psse.json`, `.canonical.json`, `.manifest.json`.
`SUCCESS` yalnızca güç akışı kapısı READY olduğunda verilebilir. PARTIAL,
BLOCKED, DIAGNOSTIC_ONLY ve doğrulama hataları **çıkış kodu 2** üretir.
Bu durumlarda üretilen dosyalar inceleme içindir; manifest `importAccepted=false` taşır.
İşlenemeyen kaynak FAILED olur. CLI çıkış kodu 0'ı model okundu göstergesi diye
yorumlamayın; manifestteki durumu ve her analiz kapısını denetleyin.

Doğrudan caspy RAW/RAWX yazıcısı tüm tablolar için kanıtlanmadığı için kapalıdır.
Sadık SAV -> RAW/RAWX dışa aktarımı için `--engine official` kullanın; Siemens
API'sinin kurulu lisans/kapasite sınırları geçerlidir. Bağımsız SAV binary
inceleyicisi DIAGNOSTIC_ONLY'dir; elektriksel parser olarak kullanılmaz.

## Test ve entegrasyon

```powershell
python -m pip install -r requirements-test.txt
python -m unittest discover -s tests -v
py -3.14 -m unittest discover -s tests/native -v
python tests/audit_sdk_v3.py --sdk . --examples "C:\Program Files\PTI\PSSE36\36.5\EXAMPLE" --output evidence/v3_negative_tests.json
python tools/validate_v3.py
```

Taşınabilir testler özgün sentetik verilerdir; Siemens kurulumu gerektirmez ve
skip içermez. Native testler ayrı komutla, kurulu örnekler üzerinde çalışır.
Lisanslı örnek modeller teslim veya Git'e eklenmez.

`VALIDATION_V3.md` doğrudan test kanıtlarını, `GA_IMPORT_HANDOFF.md` GA sınırını,
`KNOWN_LIMITATIONS.md` engelli kapsamı açıklar. SourceRef dizileri ve gerçek
GA tipleriyle kontrol edilen TypeScript sınırı `integration/` altındadır.
