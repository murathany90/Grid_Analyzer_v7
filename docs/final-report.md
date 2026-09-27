# Grid Analyzer v7 — migration teslim raporu

## 1. Repository

[murathany90/Grid_Analyzer_v7](https://github.com/murathany90/Grid_Analyzer_v7).
Özgün v6.8 HTML `legacy/` altında korundu. İki gerçek JSON `control1/` altında
Git LFS ile yüklendi; toplam yaklaşık 286 MB. Çalışma klasöründeki özgün kaynaklar silinmedi.

## 2. Branch

`feature/v7-architecture-migration`. Çalışma `main` üzerine doğrudan yazılmadı.

## 3. Base commit

`4fa11d85155b025db75cdb95794895a64e4bc2c7` — v6.8 kaynak ve model baz çizgisi.

## 4. Final commit

Uygulama entegrasyon commit'i `449e28f`; ilk doğrulanmış dağıtım/evidence commit'i
`ac85af9a595d70b1e46d4cc61590d4cd7854fb4e`. Bu raporu ve son kanıtları içeren nihai
teslim commit'i PR'ın `head.sha` alanıdır; tam SHA teslim mesajında ayrıca verilir.
Raporun içerdiği ölçümler ayrı zamanlarda yapılan açıkça belirtilmiş testlere aittir.

## 5. PR URL

[PR #1](https://github.com/murathany90/Grid_Analyzer_v7/pull/1), hedef `main`.
PR açık ve birleştirilmemiştir. Bağlayıcının PR yazma yetkisi 403 döndürdü;
aynı depoya push yapabilen mevcut Git kimliğiyle GitHub REST üzerinden açıldı.
Ardından PR'ın hedefi, kaynak dalı, commit'i ve durumu GitHub'dan yeniden okundu.

## 6. CI URL

[İlk başarılı PR CI çalışması](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/36331054814).
[Dalın güncel CI çalışmaları](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Afeature%2Fv7-architecture-migration).
Workflow: strict typecheck, mimari lint, birim/regresyon testleri, standart ve
portable derlemeler, portable HTML artifact yüklemesi. Büyük model workflow'u
ayrıca elle çalıştırılabilir; normal CI 286 MB LFS indirmez. Son push'un CI durumu
teslimden önce yeniden doğrulanır.

## 7. Architecture

Raw DGS → CanonicalNetwork → ScenarioOverlay ile effective network → topology →
analysis engine → CalculationResult → ResultStore → UI. Raw kaynak worker'da kalır;
harita ve solver DGS tablolarından doğrudan elektriksel anlam çıkarmaz.
Platform sınırları, akış diyagramı ve bellek sahipliği [architecture.md](architecture.md) içindedir.

## 8. Module tree

`src/app`, `importers/dgs`, `domain/{model,scenario,calculation,results}`, `topology`,
`analysis/{api,power-flow,fast-ac,dc,diagnostics}`, `workers`, `map`, `features`,
`persistence`, `ui/components`, `styles`. Full NR; Ybus, Jacobian, sparse linear
solver, matematik, kontrol ve sonuç uyarlama modüllerine ayrıldı. Üretim npm
bağımlılığı yok; TypeScript, Vite ve test araçları geliştirme bağımlılıklarıdır.

## 9. v6.8 feature preservation

Model yükleme/sınıf sayıları/tanı, envanter ve kaynak detayları, işletme girdileri,
harita/filtre/akış, hat-trafo-bara sonuçları, senaryo/fark/devreye alma, SLD,
üç analiz motoru, kapasite kaynakları, ayarlar ve dışa aktarım yolları taşındı.
Görsel kimlik koyu renkli, kompakt masaüstü arayüz olarak korundu.
Kaynakta gizlenmiş çoklu model/saatlik trend ve devre dışı harici ölçüm yüklemeleri
aktif ürün özelliği olarak yeniden açılmadı. Otomatik SLD kapsam sınırları ve
tam olarak tarayıcıda sınanmayan yollar ayrıca işaretlendi; yüzde 100 PowerFactory
veya piksel eşdeğerliği iddiası yok.

Kaynak incelemesi: [feature inventory](v6.8-feature-inventory.md).
Kabul kanıtı ve sınırlar: [regression checklist](v6.8-to-v7-regression.md).

## 10. v6.8 bugs found/fixed

| V6.8 BUG | V7 FIX / evidence |
|---|---|
| Boş tıklamada seçimi temizleme kapatılsa da eski listener seçimi siliyordu. | Tek kontrollü handler; kapalıyken ADANA seçimi korundu, açıkken aynı boş noktada temizlendi. |
| YTM/gerilim filtresi görünmeyen ekipmanın seçimini bırakıyordu. | Filtre değişimi seçimi, TM odağını ve sayfayı birlikte sıfırlar; tarayıcıda gözlendi. |
| DC, yalnız trafo/bara değişmiş senaryoyu seçmeyebiliyordu. | Tüm motorlar aynı effective network overlay'ini alır; domain regresyonu mevcut. |
| Model aktivasyonu başlığı v6.8'den v6.5'e geri çekiyordu. | Sabit v7 shell başlığı; büyük model yüklendikten sonra da v7 kaldı. |
| Son izinli Q-limit turunda PV→PQ dönüşümü sonrası çözülmemiş durum başarılı dönebiliyordu. | Açık `Q_LIMIT_MAX_ROUNDS`; son tur dönüşüm testi başarısız durumu doğrular. |

Migration sırasında bulunan yeni sorunlar da düzeltildi: kaynak worker yaşam
döngüsü, kaybolan import tanıları, iki uçlu katalog kapsamı, katalog sayfalarında
tekrarlanan tam tarama, SVG'nin gereksiz büyütülmesi ve gecikmiş SLD içerikleri.

## 11. UI improvements

Name birincil, FID teknik kimlik olarak ikincil. Elektriksel panel 14 kayıt/sayfa
gösterir; 1280×720 ölçümünde 10 satır tamamen görünür ve yatay tablo taşması yoktur.
390×844 ölçümünde sayfa/panel yatay taşma yapmadı. Sticky başlık, arama/sıralama,
satır detayları, status badge, araç ipuçları ve klavye seçimi eklendi/korundu.
Uzun kaynak uyarıları 35 satırla sınırlı gösterilir; tamamı CSV'ye çıkarılabilir.

## 12. DGS import

40 sınıf ve 576 binin üzerinde kayıt içeren gerçek modeller işlendi. Attribute
indeksleri, class/FID indeksleri, parent ilişkileri, StaCubic uçları ve Matrix
koordinatları korundu. Kaynak tablolar/row/cell nesneleri yerinde dondurulur;
katalog nesneleri ayrık kopyadır. Filtreli/sıralı satır indeksleri model başına
16 sorgu / 1,5 milyon indeksle sınırlandırılmış önbellekte tutulur.
[DGS profile](dgs-source-profile.md) kaynak şemalarını belgeliyor.

## 13. CanonicalNetwork

Terminal, hat, trafo, üretim, yük, şönt, seri kompanzasyon, dış bağlantı, anahtar,
kontrolör, sınır ve TM kayıtları platformdan bağımsız tiplerle temsil edilir.
Kaynak referansları, adlar, birimler ve destek durumu korunur. Üç faz/toprak kısa
devresi ve N−1 `BLOCKED`; yük akışı kontrol kapsamı nedeniyle `PARTIAL` etiketlidir.

## 14. Scenario architecture

Hat, trafo, switch ve terminal servis durumları ayrı overlay haritalarındadır.
Üretim/yük değişimleri ve restored terminals aynı imzaya katılır. Kaynak JSON ve
baz canonical kayıtları UI işlemleriyle değiştirilmez. Undo/reset, sanal yolun
terminal ve anahtarlarını da geri alır. Tek ekipmanın “Kaynağa dön” işlemi o
ekipmanın durumunu sıfırlar; bütün sanal devreye alma için genel undo/reset kullanılır.

## 15. ResultStore

Her analiz türü için baz/senaryo ayrı saklanır. Kimlik: modelHash, scenarioHash,
analysisType, engine, engineVersion, optionsHash. Eski hesaplar kabul edilmez.
Fark için aynı model/motor/seçenekler ve iki yakınsamış sonuç gerekir; eksik
değerler sıfır yerine `—` olur. Kapasite sunumu çözücü sonucunu değiştirmeyen,
model ve kapasite revision'ına göre önbelleklenen ayrı bir katmandır.

## 16. Power flow migration

Full NR bütün gerilim seviyelerini ve referansın bağlı adasını kullanır. PV/PQ,
Q-limit dönüşümü, snapshot tap, şönt ve seri kompanzasyon davranışı taşındı.
Fast AC/DC açıkça 66 kV+ indirgenmiş ağ olarak etiketlidir. DC; V/Q/kayıp
hesaplamış gibi değer üretmez. Aynı sayısal girdide eski ve yeni NR'nin
Vm/Va/P/Q sonuçları Node'da bit düzeyinde eşittir. Canonical hazırlamayla Vm farkı
en çok yaklaşık 1,73e−13 pu; parametre farkları kayan nokta işlem sırasındadır.
[Numerical parity evidence](validation/numerical-parity.json).

## 17. Worker architecture

Import ve hesap için ayrı worker yaşam döngüsü vardır. JSON parse, hash,
canonical map, topology ve solve UI thread'inden ayrıdır. İptal, hesap worker'ını
sonlandırır; kaynak katalog korunur. Model/scenario değişince generation token
eski sonucu engeller. Sayısal sonuç tamponları transfer listesiyle aktarılır.
Canonical model hesap worker'ına bir kez kopyalanır; her hesapta raw JSON parse edilmez.

## 18. Map migration

Türkiye geometrisi ve kaynak güzergâhları offline paket içindedir. Kamera/layout
değişmedikçe projeksiyon yeniden kurulmaz. Ayrı Canvas akış katmanı; yönlü,
yoğunluğu sınırlı oklar çizer. Nominal/yüklenme/fark görünümü, paralel hat ayrımı,
YTM/gerilim/TM seçimi ve boş tıklama tercihi ortak state'e bağlıdır.

## 19. SLD migration

SVG station, gerçek terminal/anahtar referanslarına dayalı bay ve bir-adımlı
bölgesel görünüm vardır. Fiderler 20 kayıt/sayfa; seçme, aç/kapa, servis değişimi,
haritaya gitme ve SVG indirme sağlanır. SVG doğal ölçekte, kaydırılabilir alandadır.
Bölgesel görünüm en fazla 37 TM/85 dal; ekipman stubları sınırlı ve ek adet etiketlidir.
Kaynak ucu çözülemeyen bağlantı uydurulmaz. Düzenleyici veya özgün PowerFactory
sayfa yerleşimi değildir. [SLD editor roadmap](sld-editor-architecture.md).

## 20. Analysis migration

Özet, gerilim, hat, trafo, üretici, topology, tanı ve kapasite sekmeleri vardır.
Kapasite; TypLne.sline × kesit/hat fline çarpanları ve sınırlayıcı kesiti korur.
315 gömülü mevsimsel kayıt ancak FID/kV/±1 MVA nominal eşleşmesinde kullanılır.
Manuel yaz/kış kapasitesi model oturumuna özgüdür; harita ve analiz aynı seçimi
kullanır. Doğrulanmamış işletme adayı limit yapılmaz. Manuel 20/40 MVA testi
haritada sırasıyla %21,6/%10,8 yüklenme verdi.

## 21. Settings/persistence

Tema, hassasiyet, envanter sayfa boyutu, TM boyutu, güzergâh, renkler, eşikler,
kalınlıklar, fark eşiği, akış hızı/yoğunluğu, lejand ve seçim tercihleri localStorage'dadır.
IndexedDB model metadata ve hash'e bağlı senaryo saklar; geri yüklenmiş senaryo
hesap beklediğini açıkça belirtir. Raw 143 MB dosyalar IndexedDB'ye kopyalanmaz.
Depolama erişimi olmayan ortamlarda uygulama oturum içinde çalışır.

## 22. Full-model test

Talepteki 25 Eylül dosyaları bulunmadı; gerçek 23 Eylül modelleri yeniden
adlandırılmadan discovery ile kullanıldı.

| Dosya | Byte | Kayıt | Çözüm barası / dal | Baz Full AC | H2525 dışı senaryo |
|---|---:|---:|---:|---|---|
| 20260923_1200_SN3_TR0.json | 143026320 | 576001 | 4115 / 5192 | Yakınsadı, 13 adım / 4 tur | LINEAR_SOLVER_FAILED |
| 20260923_1600_SN3_TR0.json | 143047373 | 576074 | 4170 / 5256 | Yakınsadı, 10 adım / 3 tur | Yakınsadı, 10 adım |

Her iki modelde Fast AC ve DC yakınsadı. Her ikisinde bir elektriksel bara
referans adası dışındadır. [Tam rapor](validation/full-model-results.json).

## 23. Numerical tests

26 testin tamamı geçti; bunların içindeki Full NR self-test paketi eski yedi
vakayı korur. İki/üç bara, PV→PQ, tap, negatif X, aktif kayıp ve eksik slack;
ayrıca son Q-limit turu, Fast AC başlangıç/refinement ve DC iki bara sınandı.
PowerFactory referans dosyası olmadığı için bu sonuç dış referans doğrulaması değildir.

## 24. Scenario tests

Hat/trafo/switch/bus/üretim/yük overlay'leri, kaynak değişmezliği, restored terminal,
başarılı/engelli devreye alma yolu, reset, eski sonuç reddi, iç içe seçenek
kimliği, silinen/eklenen branch delta ve kapasite sunum önbelleği sınandı.
Tarayıcıda küçük modelin baz/hat-outage/energization hesapları yakınsadı.

## 25. UI tests

[Browser observations](validation/browser-validation.json): JSON yükleme, gerçek
model, hesap sırasında gezinme, iptal, line/trafo/bus tabloları, sayfalama,
filtreler, baz/senaryo/fark, devreye alma/reset, kaynak worker'ın korunması,
ayar kalıcılığı, boş tıklama tercihi, kapasite değişimi, SLD ve responsive ölçümler.
Bu testler etkileşimli tarayıcı gözlemleridir; CI'da headless UI paketi var denmez.
SVG indirme düğmesi çalıştırıldı; indirilen byte'lar bağımsız okunmadı.
Gerçek modelde KEBAN HES'in 28 fideri 20 + 8 kayıt olarak iki sayfada görüldü;
ikinci sayfadaki GTR-5 sekonder fideri 4 gerçek terminal ve 3 ElmCoup anahtarıyla açıldı.

## 26. Performance

| Node ölçümü | 12:00 | 16:00 |
|---|---:|---:|
| JSON parse | 0,63 s | 0,88 s |
| DGS import/index | 1,13 s | 1,35 s |
| Canonical map | 1,97 s | 1,67 s |
| Topology/preparation | 0,20 s | 0,21 s |
| Full AC | 8,74 s | 7,17 s |
| Seçilen senaryo AC | 3,73 s, başarısız | 5,76 s, yakınsadı |

Tarayıcı 12:00 modeli: worker yükleme 3,08 s, preparation 0,252 s, Full AC
9,27 s / 13 adım. Son derlemenin tekrar kontrolünde yükleme 3,23 s ve Full AC
8,99 s / 13 adım gözlendi. Eski v6.8
tarayıcı ölçümü 6,95 s sonunda LINEAR_SOLVER_FAILED; Node'da eski kernel aynı
girdide yakınsadığından bu iki süre hızlanma oranı olarak karşılaştırılmadı.
Map-ready ve güvenilir browser heap: NOT_AVAILABLE. Node heap byte ölçümleri
JSON raporda before/parse/canonical/solve olarak bulunur; GC ve ikinci model
birinciyle aynı process'te olduğundan bunlar tepe bellek ölçümü değildir.

## 27. Known limitations

PowerFactory referansı yok; station/secondary dış kontrol döngüsü yok; faz
kaydırması v6.8 gibi sıfır varsayılır. Full NR ilk dış referans adasını çözer.
12:00 seçili kesinti senaryosu yakınsamaz. Browser/Node baseline farkının kesin
nedeni kanıtlanmadı. SLD otomatik ve kapsamı sınırlıdır. CSV/SVG indirilen
byte'larının bağımsız tarayıcı kontrolü ve doğrudan file:// çalıştırma teyidi yoktur.
Portable sayfa aynı derlenmiş içerikle HTTP üzerinden sınandı. Günlük CI gerçek
LFS modellerini indirmez; büyük model kanıtı yerel çalışmaya aittir.

## 28. Rust/WASM roadmap

[Roadmap](rust-wasm-roadmap.md): typed buffer ABI, memory sahipliği, hata/ilerleme
sözleşmesi, engine adapter ve JS/WASM sayısal parity kapıları. Bu sprintte Rust portu yok.

## 29. Short-circuit roadmap

[Roadmap](short-circuit-architecture.md): IEC 60909 kapsamı, pozitif/negatif/sıfır
sekans veri yeterliliği, topraklama/trafo/inverter katkı gereksinimleri ve doğrulama
vakaları. Analiz uygulanmadı; model capability bunu açıkça BLOCKED gösterir.

## 30. N-1 roadmap

[Roadmap](contingency-architecture.md): değişmez outage senaryoları, islanding,
DC screening sonrası AC doğrulama, paralel iş sınırı, sonuç kimlikleri ve
başarısız vakaların görünürlüğü. Contingency çözümü uygulanmadı.

## 31. Tauri roadmap

[Roadmap](tauri-roadmap.md): aynı domain/engine sınırı üstünde gelecekteki masaüstü
adapter'ı, güvenli dosya erişimi, packaging ve WebView/WASM doğrulaması. Tauri
kurulmadı ve build başlatılmadı.

## 32. Browser testing instructions

1. [Portable HTML](../dist-portable/GridAnalyzer_v7.html) dosyasını GitHub'da
   **Download raw file** ile indirin; Chromium/Edge'de açın.
2. Model → JSON seç. Hızlı başlangıç için `tests/fixtures/small-dgs.json`; gerçek
   model için clone sonrası `git lfs pull` ile `control1/` dosyalarını alın.
3. Analizler → Tam AC. Harita → ⚡ → hat seç → Değiştir + hesapla → Senaryo Δ.
4. Devreye Alma → kaynak dışı hat → Servise al → Hesapla; ardından Sıfırla.
5. Tek Hat Şeması → TM/fider/bölgesel kapsam → SVG indir.
6. Analizler → Hat kapasiteleri → nominal/yaz/kış ve manuel değer; haritada aynı
   kapasite türünün seçildiğini kontrol edin.
7. Alternatif geliştirme akışı: `npm ci`, `npm run dev`. Dağıtım:
   `npm run build` veya `npm run build:portable`.

## AGENT USAGE

| Agent | Model | Task | Time | Token usage |
|---|---|---|---|---|
| Ana ajan | GPT-6 runtime; istenen Sol/xhigh seçimi runtime tarafından ayrıca doğrulanamıyor | Mimari, topology, state, worker, entegrasyon, browser, GitHub | Yaklaşık 17:40'tan final teslimine; exact runtime toplamı NOT_EXPOSED | NOT_EXPOSED |
| feature_inventory | GPT-6 Luna / xhigh | Kaynak inventory; model/envanter/işletme/SVG SLD | Ölçülen bölümler 28m29s + 19m37s | NOT_EXPOSED |
| dependency_map | GPT-6 Luna / xhigh | Bağımlılık haritası; solver extraction/parity; kapasite | Toplam runtime süresi NOT_EXPOSED | NOT_EXPOSED |
| dgs_importer | GPT-6 Luna / xhigh | Importer; regression/CI; roadmap; catalog/security | Son ek bölümler yaklaşık 7 + 3 dakika; toplam NOT_EXPOSED | NOT_EXPOSED |

`TOKEN_USAGE = NOT_EXPOSED_BY_RUNTIME`. Exact token toplamı veya toplam agent
CPU süresi tahmin edilmedi. TOTAL WALL TIME: yaklaşık 80–90 dakika;
kesin başlangıç/bitiş runtime metriği yoktur. Nihai saat teslim mesajındaki
gözlenen saate göre raporlanır. Parallel ajan süreleri toplam wall time değildir.
