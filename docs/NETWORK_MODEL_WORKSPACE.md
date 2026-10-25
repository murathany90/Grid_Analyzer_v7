# Şebeke Modeli çalışma alanı

`feature/unified-network-model-workspace`, `fa3d3e8b676a1440605a5c9e8a5babe400184169` main tabanından geliştirilmiştir. Bu çalışma kullanıcı incelemesi için Draft PR olarak sunulur. Main, auto-merge ve canlı Pages yayını bu aşamanın kapsamı dışındadır.

## Yapı ve veri akışı

Üst menüde Şebeke Modeli; altında Model Özeti, Şebeke Envanteri, İşletme Verileri ve Model Kalitesi bulunur. Harita, SLD, analiz, karşılaştırma, yardım ve ayarlar korunur. Eski `inventory`/`operating` yönlendirme kimlikleri aynı çalışma alanının alt sekmelerine ulaşır.

Veriler mevcut Application, kaynak Worker ve katalogdan gelir. İkinci katalog, iframe, örnek SN7 veri kümesi veya ikinci uygulama yoktur. Yalnız görünür katalog sorgulanır. Sayfalama korunur; kapsam, sınıf, sekme veya model değişince bekleyen yanıtlar ve dışa aktarımlar geçersizleşir. Ortak YTM/TM/gerilim/arama ve ekipman seçimi sekmeler arasında korunur. Açık bir ekipman yönlendirmesi ilgili FID'yi bulabilmek için arama kapsamını değiştirir.

Model yükleme mevcut güvenli JSON/ZIP okuyucusunu ve iptal mekanizmasını kullanır. Model zamanı yalnız kaynak StudyCase adından okunabilir; bulunamazsa belirtilir. Model kimliği JSON dışa aktarımı model karşılaştırması için ad, hash, StudyCase, sınıf sayıları ve yetenekleri taşır; model verisini taşımaz.

İşletme ayrıntısında kaynak DGS, aktif senaryo ve güncel kimlik denetiminden geçen LF sonucu ayrı bloklardır. P/Q değişikliği mevcut ScenarioStore'a kaydedilir; kaynak değişmez. Anahtar ve hat eylemleri mevcut controller komutlarına gider. Şönt/tap/set değerleri mevcut kaynak kapsamına göre gösterilir. Eksik veya eski hesaplar model girdileriyle doldurulmaz. LF saklama/geri yükleme mevcut IndexedDB anahtarlarıyla aynı model/senaryo/ayar kimlik kapısından geçer; hesap motoru değişmez.

## Birleşik kalite

- Kaynak tanıları, kaynak uyarıları ve elektriksel denetim kendi kökenleriyle birleşir. Tekilleştirme kod + sınıf + kanıtlı FID + alan üzerinden yapılır. Genel kaynak uyarılarında özgün mesaj da anahtara dahildir; ayrı sorunlar kaybolmaz.
- Kaynak issue metnindeki sınıf/FID canonical envanterde birebir doğrulanırsa bağlanır. Canonical ekipman olmayan ElmSubstat koordinat bulgularında importer’ın yapılandırılmış issue kaydındaki açık FID korunur; TM ilişkisi tahmin edilmez. İsim benzerliğinden FID üretilmez.
- Tap fallback yalnız kaynak `transformerTapFallbackIds` üzerinden genişletilir. Dönüşüm fallback'i hesaplanan sonuç gibi gösterilmez.
- Q limitleri eksik üreticiler ve kontrolörlerin kanıtlanan üniteleri gösterilir; varsayılan Q limiti yazılmaz.
- Yerel gerilim kontrol çatışmasının ilişkili kayıtları mevcut kapalı anahtar topolojisi ve kaynak ünite ilişkilerinden gelir. Toplu bulgunun özgün kapsamı korunur.
- İndirgenmiş model dışında kalan girdilerin toplu bulgusu ekipman listesi kanıtı yoksa toplu kalır.
- Koordinat/güzergâh eksikleri coğrafi bilgi olarak ayrılır; elektriksel hata sayılmaz. Aynı kaynak güzergâh uyarısı ikinci kez sayılmaz.
- İlk 35 satır kısıtı yoktur. DOM sayfalıdır; CSV/JSON filtrelenen tam listeyi indirir. Eski elektriksel denetim STALE olarak ayrılır; kaynak kayıtları görünmeye devam eder. PARTIAL/BLOCKED ve doğrulanmamış PF/PSS-E için NOT_VERIFIED korunur.

## Doğrulama ve inceleme

`tests/unit/network-model-workspace.test.ts` tekilleştirme, köken, FID kanıtı, coğrafi ayrım, değişmez kaynaklar ve eski katalog yanıtlarının reddini denetler. `tools/network-model-browser.mjs` üretim controller/Worker/IndexedDB ile yükleme, ortak filtre/seçim, görünür sekme sorguları, sıralama/sayfalama, kalite CSV/JSON, harita/SLD yönlendirmesi, P/Q senaryo ayrımı ve LF geri yüklemeyi denetler. Ana E2E komutuna eklenmiştir.

Masaüstü kabul boyutları: 1366×768, 1920×1080 ve 1366×768 %125 ölçek. Mobil/tablet kapsam dışıdır. Yerel özel model test kanıtları `local-benchmark-results/network-model-workspace/` altında kalır; Git'e veya deployment artifact'ına eklenmez.

Yerel SN7 ZIP testi: 587.301 kayıt, 1.625 TM ve 40 DGS sınıfı doğrulanmıştır. Kalite sayıları kaynak model ve denetimden hesaplanır; bu sayılar üretim kodunda sabit değildir. Son doğrulama sonuçları ve portable SHA-256 Draft PR açıklamasında ve teslim raporunda verilir. Portable tabanı `./`, Pages tabanı `/` korunmuştur; Pages build çalıştırmak yayın tetiklemez.

## Kabul kanıtı (2026-10-25)

- Typecheck ve mimari lint başarılı; 749 birim/regresyon testi geçti, atlanan test yok.
- Birleşik çalışma alanı kabulü: dört sekme × üç masaüstü yerleşimi, ortak filtre/seçim, eski sorgu reddi, CSV/JSON, harita/SLD yönlendirmesi, iptal, kaynak/senaryo/LF ayrımı ve IndexedDB LF geri yükleme başarılı.
- Gerçek SN7: 587.301 kayıt / 1.625 TM. 3.404 kaynak uyarısı, 2 yapılandırılmış kaynak tanısı, 1.337 elektriksel kayıt; tekilleştirilmiş toplam 4.807. Kaynak koordinat bulguları coğrafi kategoridedir; bu toplam elektriksel hata sayısı değildir.
- Normal, Pages ve portable build başarılı. Pages build ve portable dosyası yerel tarayıcıda kalite Worker'ı ile ayrıca doğrulandı; hata ve dış ağ isteği yok. Pages yayını tetiklenmedi.
- Tam E2E/CI sonucu ve portable hash PR tesliminde ayrıca doğrulanır. Özel SN7 girişleri ve ayrıntılı kanıtlar yerelde tutulur.

Aşağıdaki görseller yalnız depodaki **kamusal sentetik test modeli** ile üretilmiştir:

![Model Özeti](images/network-model/summary.png)
![Şebeke Envanteri](images/network-model/inventory.png)
![İşletme Verileri](images/network-model/operating.png)
![Model Kalitesi](images/network-model/quality.png)
