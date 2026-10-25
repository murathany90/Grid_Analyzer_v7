# 3F MAX/MIN kullanıcı kabulü — 25 Ekim 2026

Karar: **MERGE_CANDIDATE — işlevsel PASS**. 3F PowerFactory/IEC sayısal paritesi doğrulanmış değildir.

Branch: `feature/sc-pf-parity-ui`. Başlangıç HEAD: `acc6b55470dba0f4dde232c5318cbd1309782369`.
Test edilen son hesap/UI/portable commit'i: `13c065c95c38bb0b99cefb715a59aa8c3d31791b`.
Nihai dokümantasyon commit'inin SHA'sı Git HEAD ve teslim mesajında verilir.

## Kapsam ve kaldırma kanıtı

Kullanıcının son kararı uygulanmıştır: uygulamanın kısa devre hesabı yalnız **3PH / 3F MAX ve MIN** içindir. SC1–SC8 görüntüleri, kullanıcı denetim raporu, yerel CSV/çalışma JSON'u ve mevcut branch kaynakları esas alınmıştır. Denetim belgesinin eski 1F onarım önerisi, kullanıcının 1F'yi kaldırma kararının yerine geçirilmemiştir.

- `src/analysis/short-circuit/sequence-network.ts` silindi: `buildNegativeSequenceEngine`, `buildZeroSequenceEngine`, `NegativeSequenceEngine`, `ZeroSequenceEngine`, `ScSequenceData`, `ScNegativeSequenceSource`, sıfır bileşen hat/trafo/kompanzatör tipleri kaldırıldı.
- `calculateThreePhase` içindeki 1LG yolu ve ikinci/üçüncü sekans hazırlama/çözme/serbest bırakma kodları çıkarıldı. Eski fault türüyle doğrudan API çağrısı `SC_UNSUPPORTED_FAULT_TYPE` ile reddedilir.
- Native adaptörün yalnız bu özelliğe ait sekans/nötr parametre çıkarımı; context, sonuç, MAX/MIN çalışma yuvaları, cache ve IndexedDB alanları kaldırıldı. Kaynak hazırlık denetimindeki toprak/eksik sıfır bileşen durumları da çıkarıldı.
- `scResult1Lg`, `sc1LgMax/Min`, `ikss1F`, negatif/sıfır ağları ve 1F UI/harita/yardım/export yolları üretim kaynaklarında bulunmuyor. Test, kaynak ağacını ve reddedilen API çağrısını denetliyor.
- `tests/unit/short-circuit-1lg.test.ts` ve eski karma `sc-final-safety.test.ts` kaldırıldı; geçerli 3F kimlik, kapsam, devam ve kalıcılık denetimleri yeni 3F regresyonlarıyla korundu. Ortak mini DGS fixture'ın yalnız sekans/nötr sütunları çıkarıldı.
- Eski aktif 3F/1F yürütme/kabul belgeleri kaldırıldı. Ortak pozitif ağ, topoloji, empedans, trafo ve kaynak bileşenleri korunmuştur; fiziksel katsayı veya PF sonucundan türetilen düzeltme eklenmemiştir.

## Kullanıcıya görünen düzeltmeler

| Alan | Son davranış |
|---|---|
| PF harita / TM tooltip / ⚡ | Tek PF kaynak hücresi seçimi; TM maksimumu, temsilci bara FID'si ve nominal kV görünür. Başka bara seçili olsa da TM maksimumu kaybolmaz. PF mevcut sayısı ile doğrulanmış karşılaştırma sayısı ayrıdır. |
| ⚡ paneli | Yalnız 3F Ikss, sabit kA; modelden gerilim filtresi, TM/Bara/kV/akım sıralaması; 50 satırlık sayfalar; ayrı × ve Escape ile kapanan kompakt ayrıntı. Kaynak GA/PF açıkça yazılır. |
| Analizler | YTM → TM → gerilim → MAX/MIN → Analiz Et. İlk hesap öncesi MIN seçimi korunur. 3F GA/PF, tanısal fark ve gerçek 3F durumları gösterilir. Sonuç modalı küçük, başlığı ve × düğmesi görünür; teknik ayrıntılar kapalı başlar. |
| Kimlik / eşleme | Elektriksel düğüm bir kez sayılır, tüm fiziksel alias FID'leri korunur. Farklı TM'ye yayılan tek düğümde kapsam ve temsilci FID yerel TM'ye göre seçilir. Harita maksimumu ve tablo aynı 3F sonucundan gelir. |
| Düğüm sınıfı | Native `ElmTerm.iUsage` ve gerçek ekipman/anahtarlama uçları kanıt olarak saklanır. Fiziksel bara/fider/yardımcı/belirsiz filtresi vardır. İsim/akım büyüklüğünden sınıf uydurulmaz; hiçbir düğüm silinmez. 6,3 / 33,6 / 34,5 kV korunur. |
| Kalıcılık / dosya | Eski IndexedDB ve çalışma JSON'ları allowlist ile temizlenir. Uygun eski 3F kaynak/profile/model/senaryo kimliği doğrulanarak taşınır; eski 1F alanları yüklenmez/yeni kayda aktarılmaz. Uyumsuz JSON mevcut sonuçları bozmaz. |
| Export | CSV/XLSX/JSON aynı güncel 3F satırları, FID, elektriksel kimlik, MAX/MIN ve kaynak kanıtını taşır. Eksik sayılar null/— kalır. |

## Gerçek SN4 kanıtı ve PF sınırı

Yerel kullanıcı çalışması: `20261008_1000_SN4_TR0`, Y6 / BALANCED / `C80522=true` senaryosu; 6.368 fiziksel hedef, 505 elektriksel düğüm. Özel model/referans/CSV/JSON dosyaları commit edilmemiştir.

`tools/sc-three-phase-sn4.ts` ile native kaynak ve gerçek birleşik LF/N-1/SC referans paketinden alınan yeni hesap:

| Kontrol | MAX | MIN |
|---|---:|---:|
| Çözülen elektriksel düğüm | 505/505 | 505/505 |
| Sağlanan çalışma JSON'una göre en büyük 3F farkı | 0 kA | 0 kA |
| Faktorizasyon / RHS | 1 / 505 | 1 / 505 |
| Harita TM maksimumu karşılaştırması | 186 | 186 |
| PF verisi bulunan düğüm | 471 | 0 — MIN referansı yok |
| Yöntem paritesi doğrulanan karşılaştırma | 0 | 0 |

Örnek: BOGAZLIYAN, B5332, 154 kV, PF **37,03513252787906 kA**; aynı harita değeri/FID tooltip'te **37,035 kA** olarak görünür.

**PF 3F: NOT_VERIFIED.** MAX'teki 471 ortak düğümün salt tanısal MAE'si **0,6054457654 kA**, en büyük farkı **32,5225906295 kA**'dır. Bu bir yöntem/IEC parite başarısı değildir. Daha eski farklı 12 elektriksel baralı benchmark'ın **MAE 42,1076219267 kA**, maksimum **239,5726196770 kA** sonucu korunur; farklı kapsamlar birbirinin iyileştirmesi gibi sunulmaz. B3337/B4351 sapmalarının fiziksel nedenleri ve cihaz bazlı katkı matrisi halen çözülmemiştir.

3F motoru pozitif bileşen ağ yaklaşımıdır. MAX/MIN varsayımları, kaynak eksiklikleri ve yöntem kanıtı görünür kalır. Sertifikalı IEC 60909 çözümü, bağımsız PowerFactory sayısal paritesi veya ekipman dayanım sertifikasyonu iddia edilmez. **1F: REMOVED**; referans eksikliği etiketiyle aktif özellik gibi sunulmaz.

## Çalıştırılan doğrulamalar

- Son tam unit/regresyon: **734/734 PASS**, 0 fail, 0 skip. Hedefli ana paket **51/51 PASS**; son PF eşleme ve hazırlık sözleşmesi paketleri ayrı ayrı **10/10 PASS**.
- İlk tam koşu 733/734 idi: geçerli ama haritaya bağlanamayan PF kaydı sayacı düzeltildi; fixture'a gerekli 3PH/MAX/gerilim/arıza empedansı bilgisi açıkça eklendi, `noGeometry=1` beklentisi korundu. Son tam koşu 734/734 geçti.
- TypeScript ve mimari lint: PASS, 472 üretim kaynak dosyası.
- Masaüstü E2E: **9 senaryonun tamamının son gözlenen koşusu PASS**. İlk tam paket **8/9** geçti; genel `browser-smoke.mjs` gelişmiş araçlar penceresi beklemesinde zaman aşımına uğradı. Ara hedefli tekrar, kaynak düzenlemesi/Vite sayfa yenilemesiyle kesildi ve kabul kanıtı sayılmadı. Kaynaklar sabitlenerek yapılan son hedefli `browser-smoke.mjs` **PASS** oldu; başarılı diğer sekiz senaryo tekrar koşturulmadı. Tek bir tam paket koşusunda 9/9 elde edildiği iddia edilmez. Son koşuda açık kalan başarısız test yoktur.
- Kapsam Windows 1366×768, 1920×1080; ayrıca SC browser kanıtında %125 CSS yakınlaştırma. Mobil/tablet kabulü çalıştırılmadı. LF/N-1/SLD ve senaryo/IndexedDB denetimleri korundu.
- Gerçek worker'lı SC browser: bağımsız analitik MAX/MIN, iptal/checkpoint/devam, altı gerçek CSV/XLSX/JSON indirmesinin okunması, Lightning/table FID-akım eşliği, dokuz bozuk kimlik reddi, kayıt hatası, eski IndexedDB/JSON temizleme, PF-only çok baralı TM eşliği.
- Gerçek SN4 hesabı Node motoru ve ortak UI veri sağlayıcılarıyla doğrulandı. Tarayıcı E2E'si gerçek uygulama/worker'larda küçük analitik model ve birleşik sentetik referans kullanır; tam SN4 tarayıcıda yeniden hesaplanmış gibi sunulmaz.
- Portable: gerçek **`file://`**, dış ağ erişimi engelli, MAX/MIN hesap + yeniden yükleme değerleri birebir; 0 tarayıcı hatası, 0 dış HTTP isteği.

## Portable ve Git bütünlüğü

Dosya: `dist-portable/GridAnalyzer_v7.html`, **2.043.634 byte**.

SHA-256: `db8fecc2964dbcf021f41a9decf0b3dc87e666ac766a994cfe3cf7b6ba8bfe1d`.

Disk dosyası ile `git show HEAD:dist-portable/GridAnalyzer_v7.html` ham byte eşliği doğrulandı. Tam regresyon portable'ın deterministik yeniden oluşturulmasını da denetler. Son push ve uzak HEAD eşliği teslim kapanışında ayrıca doğrulanır. Başlangıçtan kalan kullanıcıya ait untracked belgeler/klasörler korunmuştur; tracked çalışma ağacı teslim sonunda temiz olmalıdır.

Yerel ayrıntılı loglar `local-benchmark-results/sc-3ph-*`, gerçek SN4 kanıtı `sc-three-phase-sn4-private.json`, browser/portable kanıtları `sc-three-phase-engine/proof.json` ve `sc-three-phase-portable/proof.json` altındadır. Bunlar özel yerel kanıtlardır ve Git'e eklenmez.
