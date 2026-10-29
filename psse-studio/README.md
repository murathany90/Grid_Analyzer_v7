# Grid Analyzer PSS/E Studio

Bağımsız PSS/E modülü. GA Web DGS dosyaları değiştirilmez. Aktif geliştirme bu dizindedir; HTML yalnız build çıktısıdır.

## Kullanım ve build

`dist/Grid_Analyzer_PSSE_Portable.html` dosyasını Chrome/Edge ile açın; SAV/RAW/RAWX/ZIP seçin. İnternet, CDN, sunucu veya kurulum gerekmez. Model dosyaları HTML içine gömülmez.

```powershell
npm ci
npm run build
npm test
npm run test:browser
```

Node.js 22+ gerekir. Build ayrıca host için `dist/psse-module.js` ve `dist/psse-module.css` üretir. Başka teslim dizini için `node scripts/build.mjs --out-dir=C:/teslim/dist` kullanılabilir.

Gerçek model testleri yerel `control1/` örneklerini kullanır. Native Excel yalnız test oracle'ıdır (`python scripts/read-native-reference.py <workbook.xlsx>`): salt okunur dışa alınan JSON yolu `PSSE_REFERENCE_JSON` ile verilebilir; yoksa `.local/native-excel.json` aranır ve Excel karşılaştırmaları atlanır. `tests/results/native-columns.json` 28 tablonun kısa doluluk çıktısıdır. Chrome/Edge testleri üç masaüstü boyutunda doğrudan çevrimdışı `file://` açar. Yerel özel modeller, workbook, ekran görüntüleri ve decode edilmiş ağlar Git'e eklenmez.

## Kaynak sınırları

- `src/core`: host adapter, storage ve yaşam döngüsü.
- `src/modules/psse/importers`, `model`, `calculations`: bağımsız parser, kimlikler, NR/FDNS/DC ve typed solver options.
- `scenarios`: sabit baz, doğrulanan overlay, undo/redo, kopya ve kaydet/yükle.
- `map`, `sld`, `analysis`, `ui`: iki satırlı harita, TM şeması, kompakt Newton ekranı ve native tablolar.
- `src/shared/styles/studio.css`: eski 12 CSS katmanı birleştirilmiş tek stil kaynağı.

17 ND + 11 NR başlığı/sırası korunur. NR kaynak seçimi SAV kayıtlı durum ile güncel GA hesabını ayırır. SAV akışları kayıtlı Vm/Va, kaynak admitansı ve anahtarlama Zflow değerlerinden türetilir; GA yakınsaması olarak sunulmaz. Native seri reaktif kayıp, terminal Q toplamından ayrı tutulur. OWNER sahiplik payları ve AREA/ZONE ölçülen uç alışverişi kaynak kimlikleriyle hesaplanır.

RATE yalnız Ayarlar'dadır; harita, tooltip, SLD ve dışa aktarma aynı paydaları kullanır. Hesap seçeneği değişince eski sonuç temizlenir. Native MVA tahmin eşiği GA pu toleransına dönüştürülmez. Desteksiz kontroller ve Gauss/Robust Solve pasiftir.

Harita seçimi GA biçimindeki köşe kartında açılır; seçilen hat/TM vurgulanır. Sonuç paneli 640 px genişliğindedir. Tap ve switched shunt otomatiği tek ortak kontrolle yönetilir. XLSX tüm sekme, kolon ve stilleri koruyarak DEFLATE kullanır; CSV sayıları ekran yuvarlaması olmadan aktarır. İsteğe bağlı mevcut workbook sıkıştırması: `node scripts/repack-xlsx.mjs input.xlsx output.xlsx` (ayrı çıktı, açılmış ZIP parçaları birebir doğrulanır).

## Doğrulanan kapsam ve sınırlar

Gerçek örnek: 6.851 bara, 2.403 AC hat, 3.703 trafo, 1.618 TM. Anahtarlama elemanları coğrafi hat listesine girmez. Model A→B→A, senaryo izolasyonu, RATE, CSV/XLSX ve çift mount/unmount testleri bulunur. Büyük modelde küçük NR artığı tam AC kanıtı değildir; fizik kapsamına göre APPROXIMATE/BLOCKED/PARTIAL korunur. N-1 ve kısa devre motoru yoktur.

Native Excel'de toplam satırları ve NR-Load içinde 328 geçersiz bara/yük kimliği vardır; bunlar çalışma verisine kopyalanmaz. Rating sıfırken yüzde, native kontrol limit sentinel'leri ve doğrulanmamış enumlar boş kalır. SAV sürüm kapsamı gerçek PSS/E 36.5 örneğiyle doğrulanmıştır. Üç sargılı trafo sentetik kaynak topolojisiyle test edilir; gerçek örnekte tüm trafolar 2W'dir.

NR Load tüm 2.520 gerçek kaynak kimliğini kapsar; Excel NR'de eksik olan 400 servis dışı/type-4 bara yükü de korunur. 34 doluluk farkının 32'si sıfır RATE yüzdeleri, ikisi native `-2` kontrol kodlarıdır; iki kontrol alanının SAV eşlemesi doğrulanmadığından boş kalır. 28 tablonun 689 kolonluk şeması korunur. Hedefli testler: `node --test tests/parity.test.mjs tests/native-data.test.mjs tests/data-export-v2.test.mjs`; Chrome/Edge: `node tests/parity-ui.mjs`; RATE/metrik/senaryo: `node tests/map-policies-ui.mjs`. Excel oracle ve özel referans paketinin yerel dosyaları bu testler için gereklidir; atlanan testler doğrulama sayılmaz.

Canvas P/Q animasyonu GA hız/yoğunluk kurallarını kullanır; yalnız Akış tiki ile açılıp kapanır. Ayrık devreler aynı TM uçlarına bağlanır; tek hover yöneticisi ve çok baralı TM özeti bulunur. Panel metrikleri kolonları değiştirir, sıralama bağımsızdır. XML/ZIP işlemleri offline worker'dadır. Aynı 36 sayfalı örnekte dışa aktarma 20,2 → 8,9 sn, en uzun ana thread işi 6,9 → 0,50 sn ölçüldü; açılmış 41 ZIP parçası birebir eşleşti.

GA Web entegrasyonu: [GA_PSSE_INTEGRATION.md](GA_PSSE_INTEGRATION.md).

Akış animasyonu sistem hareket azaltma tercihinden bağımsızdır; ek izin veya ayar gerektirmez. Kaynak/görünümde geçerli P/Q yoksa ok üretilmez. Sonuç satırları fiziksel kimlikle haritayı odaklar; boş tıklama/Escape yalnız seçimi temizler. ⚡ Senaryolar bölümünde yeni/kopya/adlandır/sil, undo/redo ve kaydet/yükle bulunur; baz korunur. 768–1920 px hedefli son kontrol: `node tests/final-ui.mjs`.
