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

## Doğrulanan kapsam ve sınırlar

Gerçek örnek: 6.851 bara, 2.403 AC hat, 3.703 trafo, 1.618 TM. Anahtarlama elemanları coğrafi hat listesine girmez. Model A→B→A, senaryo izolasyonu, RATE, CSV/XLSX ve çift mount/unmount testleri bulunur. Büyük modelde küçük NR artığı tam AC kanıtı değildir; fizik kapsamına göre APPROXIMATE/BLOCKED/PARTIAL korunur. N-1 ve kısa devre motoru yoktur.

Native Excel'de toplam satırları ve NR-Load içinde 328 geçersiz bara/yük kimliği vardır; bunlar çalışma verisine kopyalanmaz. Rating sıfırken yüzde, native kontrol limit sentinel'leri ve doğrulanmamış enumlar boş kalır. SAV sürüm kapsamı gerçek PSS/E 36.5 örneğiyle doğrulanmıştır. Üç sargılı trafo sentetik kaynak topolojisiyle test edilir; gerçek örnekte tüm trafolar 2W'dir.

GA Web entegrasyonu: [GA_PSSE_INTEGRATION.md](GA_PSSE_INTEGRATION.md).
