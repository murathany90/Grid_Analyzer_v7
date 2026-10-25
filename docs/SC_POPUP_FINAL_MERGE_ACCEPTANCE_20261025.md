# SC bara popup ve PF kaynak kimliği — nihai kabul

Tarih: 25.10.2026. Referans HEAD: `88f3a73e7e9b58a9360329af29a5d72778fd23b9`.
Uygulama commit'i: `8f061edfccab0a84457c3bea6977d19fe0ce2d6b`.
Test fixture düzeltmesi ve kabul edilen kod HEAD'i: `7a0e2cfa1d114417c20c684a5a3871e7bb903188`.
Dal: `feature/sc-pf-parity-ui`. İşlevsel kabul: **PASS**. Yalnız fast-forward main teslimine uygundur.
Bu raporu içeren teslim commit'i de feature ve main üzerinde aynı HEAD olacaktır; kesin uzak HEAD teslim yanıtında verilir.

## Düzeltme

- PF TM maksimumu, akımla aynı kaydın `sourceFaultFid` / `sourceCellKey` bilgisini taşır. `representativeFid` / `displayFid` yalnız fiziksel görüntüleme alias'ıdır. Alias'a tekrar PF hücresi araması yapılmaz. Maksimum değişince kaynak kimliği alanları da birlikte değişir.
- Aynı TM'de iki farklı elektriksel düğüm ve üç referans terminali için regresyon: kaynak B1 = 6 kA, görüntüleme B0 = 1 kA, bağımsız B2 = 3 kA. B0 adı kullanılsa da 6 kA'nın kaynak B1 hücresi korunur. Ters kayıt sırası da sınanır. Bunlar açıkça sentetik birim testi değerleridir.
- Hover tooltip, harita projeksiyonu, kompakt satır ve dışa aktarım gerçek kaynak FID'sini korur. Dışa aktarıma iki açık kimlik alanı eklenmiştir; mevcut sayısal alanlar korunmuştur.
- `.ga-lightning-sc-detail-host` ve alt detay CSS'i kaldırıldı. Liste/pager yüksekliği seçimle değişmez; tek liste kaydırma alanı kalır.
- Bağımsız, 310 CSS px genişliğinde harita popup'ı mevcut `compactScRows` verisini gösterir. Kaynak/görüntüleme/elektriksel düğüm/TM/hücre kimlikleri ayrı tutulur. X, Escape, aynı satıra tekrar tıklama ve başka satıra geçme desteklenir.
- Yerleşim harita/ekran sınırları, panel, seçim bilgisi ve lejantı hesaba katar; %125 görünümde seçim ile lejant arasındaki boşluğu kullanır. Ayrı scrollbar veya alt tablo yoktur.
- Gerçek TM koordinatına renderer projeksiyonu ile bağlanır; satır seçimi zoom yapmaz. Pan/zoom sonrasında rAF çiziminden konumu güncellenir. Doğrulanabilir koordinat yoksa konum üretilmez.
- Kaynak, mod, YTM, TM, gerilim, düğüm sınıfı, model, senaryo veya sonuç kimliği değişince kapanır. Panel kapatma/küçültme de seçimi temizler. Hover bileşeni bağımsız kalır. Document Escape dinleyicisi ve popup DOM'u dispose edilir. Değişmeyen bildirimlerde popup DOM'u korunur.
- `Analizlerde detay` mevcut teknik dialogu açar; 3F Zkk, gerekçe, yöntem ve kaynak kanıtları korunmuştur. Yeni hesap motoru, sonuç deposu veya bağımlılık yoktur.

## Gerçek SN4 kanıtı

Kaynak model 1.619 TM'dir. Mevcut kaydedilmiş MAX/MIN sonuçları kullanılmıştır; ülke modeli yeniden hesaplanmamış ve benchmark tekrarlanmamıştır.

| TM / bara | Hesap/kaynak FID | Görüntüleme FID | Elektriksel ID | GA 3F MAX kA |
|---|---|---|---|---:|
| BOZOK / 154 B-1 | B83880 | B9447 | B9447 | 15,82232896035569 |
| BOZOK / 400 B-1 | B99530 | B9444 | B19728 | 10,119332817548768 |
| BOZOK / TR-A | B99626 | B9454 | B9455 | 8,363504755519216 |

BOZOK PF TM maksimumu: **15,704619306312406 kA**, kaynak **B9447**, 154 kV. Kaynak hücresi `SC_BusResults_Raw`, kayıt satırı **3465**, sütun **Z**. Harita, tooltip, ⚡ popup ve Analizler JSON bu kayıtta eşleşti. Bu kaynak FID'nin GA hesap FID'sinden farklı olması gizlenmedi; yöntem paritesi veya onaylı sayısal fark olarak sunulmadı.

Sincan'ın **7 ayrı elektriksel düğümü** korunmuş ve popup ile sınanmıştır. GA MAX ve MIN için 505'er kayıt, CSV/XLSX/JSON'un her birinde kaynak FID, görüntüleme FID, elektriksel ID, ad, nominal kV ve akım üzerinden doğrulanmıştır. PF BOZOK JSON'unda kaynak hücre ve akım da denetlenmiştir.

Kaydedilmiş SN4 MAX/MIN nesnelerinin SHA-256 özeti değişmedi:
`ed9aa3088d64ff945a21e35445a63ef7e8070831f0602e31a522927e15ea68c7`.

## Test sonuçları

| Kontrol | Sonuç |
|---|---|
| Typecheck / mimari lint | PASS / PASS |
| Hedefli birim testleri | 37/37 PASS; fixture onarımı sonrası ilgili dosyalar 6/6 PASS |
| Nihai tam unit/regresyon | **743/743 PASS**, 0 fail, 0 skip; 9,906 s |
| Windows Chromium hedefli kabul | **11/11 kabul grubu PASS**; Chromium 153.0.8010.12 |
| Ekranlar | 1366×768, 1920×1080 ve 1366×768 / CSS %125 PASS; mobil/tablet çalıştırılmadı |
| LF / N-1 / SLD | LF satırları ve boş PF üçlüsü yokluğu, saklı tek N-1 vaka görünümü, gerçek kaynaklı Sincan SLD PASS |
| IndexedDB | MAX 505 / MIN 505 kayıt saklama PASS; kimlik/legacy regresyonları tam pakette PASS |
| 1F yokluğu / hesap güvenliği | Tam paket ve dışa aktarım şeması PASS; 1F geri eklenmedi |
| Offline portable | `file://`, dış ağ istekleri engelli; gerçek mini worker MAX/MIN 2'şer satır, 0 ağ isteği, 0 sayfa hatası PASS |
| Portable Git byte eşliği | Çalışma dosyası ile commit blob'u aynı; deterministik yeniden build testleri PASS |

İlk tam koşu **742/743** sonuçlandı: eski `pf-benchmark-map` testi `as never` ile eksik AppContext üretip `filters.areaId` erişiminde hata verdi. Fixture mevcut ortak fixture ile tamamlandı; sayısal veya gate beklentisi kaldırılmadı. İlgili 6 test ve onarım sonrası nihai tam kabul 743/743 geçti. İlk hata günlüğü korunmuştur; çözülmemiş başarısız test yoktur.

Performans smoke: açık popup ile 12 pointermove tek rAF çiziminde birleşti; **33,0 ms**, **1 yeni çizim**. Pan ve wheel sonrası aynı gerçek TM bağı korundu. Değişmeyen 10 notify çağrısı popup başlık DOM'unu korudu. Bu tek etkileşim örneği bir p95 veya yeni kapsamlı performans benchmark'ı değildir. Önceki ayrıntılı ölçümler `SC_UI_PERFORMANCE_ACCEPTANCE_20261025.md` içinde korunmuştur.

Tekrarlanabilir hedefli komut: `node tools/sc-popup-browser-acceptance.mjs`. Yerel gerçek model önbelleği gerekir ve Git'e eklenmez. `--before` yalnız 88f3a73 UI dosyalarını Vite üzerinden okuyarak öncesi ekranını alır; çalışma ağacını değiştirmez.

## Yerel ekranlar / günlükler

Özel model ekranları, ham dışa aktarımlar ve günlükler Git'e eklenmemiştir. Yerel kanıt dizini: `local-benchmark-results/sc-popup-final/`.

- Önce: `before-bottom-detail-1366.png`.
- Sonra: `popup-1366-1.png`, `popup-1920-1.png`, `popup-1366-1.25.png`.
- Ek: `popup-PF-BOZOK-1366.png`, `popup-SINCAN-1366.png`, `analysis-technical-detail-1366.png`, `portable-1366.png`.
- Tam test günlükleri: `.tmp/sc-popup-full-regression.log` (ilk koşu), `.tmp/sc-popup-final-regression.log` (nihai PASS).
- Yapılandırılmış gerçek model kabul kanıtı: `local-benchmark-results/sc-popup-final/proof-private.json`.

## Portable ve sınırlar

Dosya: `dist-portable/GridAnalyzer_v7.html` — **2.058.508 byte**.
SHA-256: `ce5f1fb806a38fa2873ac8bd8fee32385e47c40ae13372b8f8819e6d25bc2ca6`.

**PF 3F yöntem/sayısal paritesi: NOT_VERIFIED.** GA çözümü ağ yaklaşımıdır; sertifikalı IEC 60909 çözümü olarak tanıtılmaz. PF MIN referansı mevcut değildir. 1F özellik olarak kaldırılmıştır.

Önceki gerçek SN4 karşılaştırmasının **12 elektriksel bara, MAE ≈ 42,108 kA, maksimum fark ≈ 239,573 kA** tanısal sonucu korunur; bu turda tekrar çalıştırılmamıştır. Fiziksel katsayı, PF referans girdisi veya 3F hesap algoritması değiştirilmemiştir.

Merge koşulu: mevcut `origin/main` = `e04a9e99a0a2bf23cbe88f9e34ba1bb5a6bd043f` değişmeden feature'ın atası olmalı; yalnız `--ff-only`, normal push, eşit uzak main/feature HEAD ve aynı portable blob ile teslim. Force push, rebase/reset, özel veri ekleme, yeni dal/PR veya dal silme yapılmaz. Mevcut kullanıcı untracked dosyaları korunur.
