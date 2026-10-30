# SLD_HANDOFF
- **Branch / Ref Commit:** `fix/psse-sld-visual-native-parity` (base `572d997d`)
- **Tamamlanan Değişiklikler:**
  - `src/features/psse/sld-binary-codec.ts` & `tools/psse-sld/studio_runtime.js`: Tüm gömülü örnek profiller ve sahte şablonlar kaldırıldı; CArchive (`2.0.48–2.0.51`) binary doğrulayıcı (`Ankara_fake.sld` reddi), %100 sembol/port/link/knee/etiket çıkarıcı (`parseSldBinary`) ve yerinde binary yamalayıcı (`patchSldBinary`) uygulandı.
  - `tools/psse-sld/studio_style.css` & `studio_runtime.js`: Yan paneller ve sıfırdan eleman ekleme araçları kaldırıldı (%98.9 tam genişlik Canvas); 4 sekmeli PSS®E `⚙ Diyagram Ayarları` modalı, kopmayan `Symbol -> Port -> Link -> Knee -> Port` modeli, Tek Tık SAV -> TM (varsayılan YATAY) ve 23 OWNER bölge çizimi eklendi.
  - `tools/psse-sld/psse_sld_converter.py` & `psse_sld_build.py`: `sliderPy` port tahsisi (`GetLink() is None`) ve yerel köprü doğrulaması düzeltildi; Sincan TM (`583`), Ankara OWNER 708 (`2342`), Ankara (`2794`), Kayseri (`1984`) ve Konya (`1600`) `.sld` dosyaları PSS®E 36.5'te 0 hata ile doğrulandı.
- **Kalan Sorun:** SAV'dan yeni çizilen şemaların sıfırdan `.sld` CArchive kaydı için yerel `psse_sld_converter.py serve` köprüsü (PSS®E 36.5 `sliderPy`) gereklidir; köprü kapalıyken sahte dosya üretilmez ve açık uyarı verilir.
- **Sonraki İşlem:** İsteğe bağlı olarak sıfırdan CArchive `CLink`/`CSldSymbol` binary serileştirmesini tarayıcıya taşımak.
- **Build Komutu:** `python tools/psse-sld/generate_studio_bundle.py && npm run typecheck && npm run build`
