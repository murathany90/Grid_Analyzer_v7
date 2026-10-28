# V4_ONE_HOUR_FIX_REPORT — 60 dakikalık UI düzeltme turu (2026-10-28)

Dal `fix/psse-v1-real-model-parity`, başlangıç HEAD `0972654` (bağımsız kabul raporundaki sürüm). Bu tur yalnız PSS/E UI dosyalarını değiştirdi; DGS referans kodu (`src/map`, `src/features/sld`) **0 dosya** değişti (`git diff 0972654..HEAD --stat -- src/map src/features/sld` boş), native SAV decoder ve Full AC/FDNS/DC motorları değişmedi, tam suite **879/879 PASS**.

## P0 — Harita ve ⚡ (kabul raporundaki kusurlara karşı)

| Kabul kusuru | Bu turdaki çözüm | Kanıt |
|---|---|---|
| ⚡ düğmesi 1600×1000'de y≈1069 px, viewport dışında | Toggle `absolute bottom` yerine araç çubuğu satırına ('⚡ Sonuçlar') taşındı | Ölçüm: düğme merkezi **y=207 px**, viewport içinde; fullscreen dahil her zaman görünür |
| Gerilim checkbox'ları 3 satıra taşıyor, filtre çubuğu sıkışık | 5 bant tek satır (`ga-psse-band-filter`, canlı ölçüm 36 px), zoom düğmeleri tek flex satır, DGS benzeri kolon genişlikleri | Gerçek model ekran görüntüsü `map-1600x1000.png` |
| Akış animasyonu yok | Hesap katmanında transform-tabanlı rAF animasyonu; `prefers-reduced-motion` duyarlı + 'Akış animasyonu' onay kutusu + `document.hidden`'da durur | `map-calculated-1600x1000.png` (gerçek NR sonucuyla oklar) |
| Baz/Senaryo/Fark yok | Controller son yakınsamış hesabı senaryo değişiminde `psseBaseCalculation`'a yükseltir; haritaya **ΔVm fark katmanı** eklendi — yalnız iki gerçek GA hesabı (baz + senaryo) mevcut ve kimlik eşleşiyorsa seçilebilir; dal ΔP/ΔQ yalnız iki tarafta da varsa tooltip'te; uydurma değer yok | `src/app/controller.ts`, `src/features/psse/map-view.ts` (deltaReady guard) |
| Haritadan hat açma doğrulanmadı | Dal iletişim kutusuna 'senaryoda aç/kapat' eylemi eklendi: senaryo kopyasını günceller, kaynak dosyaya dokunmaz, NR_POLAR'ı otomatik yeniden koşturur; geri alma aynı eylemle | Kod: `map-view.ts` scenarioButton; canlı test bu turda senaryo hesabıyla birleşik doğrulanmadı (aşağıda eksikler) |

## EK P1 — Şebeke Modeli kompaktlaştırma (gerçek 6.875 baralı SAV/ZIP ile doğrulandı)

- Tek KPI satırı (TM 1.625 · Bara 6.875 · Hat 2.414 · Trafo 3.715 · Jeneratör 2.932 · Yük 2.516 · Şönt 137 · Anahtar 2.571) — tekrar eden çip satırı silindi; kartlar envanter tablosunu seçer.
- Tek satır model bilgisi: `20261026_1600_SN1_TR0.sav · SAV · 4.3 MB · COMPLETE · 100 MVA · 50 Hz · çözümleme 297.1 ms`; SHA/binary revizyon/teknik tanılar katlanır **Teknik Detaylar**'da.
- Gerilim: uzun ham kV listesi yerine 5 bant gerçek bara sayılarıyla (`400 kV · 577 | 220 kV · 3 | 154 kV · 2.890 | 66 kV · 23 | ≤36 kV · 3.382 | bilinmeyen: 0`); 36 kV dahil tüm alt gerilimler tek ≤36 kV grubunda; Model/Envanter/İşletme tabloları aynı band filtresini kullanır (`catalog.ts queryPsse bands`); kaynak kV değerleri silinmedi.
- Area·Zone·Owner üç kompakt kart, **kaynak SAV sözlüğü adlarıyla**: `BATIANADOLU (3) · 1.104 bara`, `154 KV (2) · 2.690 bara`, `ADANA (718) · 597 bara` (77 BM kodu); ZONE=gerilim sınıfı notu korundu; kartlar katlanır filtreli tabloya açılıyor.
- Ham JSON 'Kaynak tablo kapsamı' artık katlanır **Gelişmiş / Kaynak Veri** içinde sayfalı önizleme (100 satır/sayfa) + indirme; veri kaybı yok.
- Envanter tabloları ad-öncelikli (TM adı · YTM · Gerilim · Tip · İşletme durumu), kimlikler tek sönük ikincil kolonda; ek dosyaları paneli Envanter sekmesine taşındı.

## P1 — SLD ve P2 — Adlandırma (uygulandı ve gerçek modelde doğrulandı)

- **SLD fit:** initial viewBox artık çizilen içerik bbox'ı + 48 birim padding, gerçek sahne ölçüsüne göre (zoom=1 = 'TM sahneye sığar'); zoom aralığı 0,5–8; iki geçişli etiket ölçekleme fit'te metni ≥12 CSS px tutar; bara çizgileri non-scaling (7 px sabit); SVG export yeni viewBox ile uyumlu. 3SKALEJES önceki ~200 px çizimden tüm sahneye çıktı: 154 kV bara (mavi) üstte, 11 kV (yeşil) altta, 2W trafo sembolü, EFELER-1/GERMENOK-1 ortogonal fiderleri, G/L sembolleri — okunur etiketlerle.
- **Gerilim renkleri:** paylaşılan 5-bant eşlemesi (`psseVoltageBand` + ctx.settings DGS paleti).
- **Adlandırma:** `psseAreaLabel`/`psseOwnerLabel` kaynak SAV sözlüğünden 'ORTAANADOLU (4)', 'BURSA (702)' üretir (isim uydurma yok); SLD YTM/OWNER seçenekleri + harita filtreleri bu etiketleri kullanır, değerler ham kod kalır; canlı doğrulama: seçenek listesi 'TRAKYA (1) · SANAL (10) · KUZEYBATI (2) · BATIANADOLU (3)...'.
- 3SKALEJES, ADAPAZARI ve SAKARYA karşılaştırma ekranları `local-benchmark-results/psse-offline-browser/v4uifix-private/` altında (gerçek model verisi içerdiğinden yalnız özel konumda; teslim ZIP'inde sentetik eşdeğerleri var).
- Kesici/ayırıcı zinciri üretilmedi; bus-branch kaynakta olan çizildi.

## P3 — Elektriksel regresyon

- Gerçek model baz Full AC NR bu turda tarayıcıda yeniden koşuldu: `SOLVED_APPROXIMATE`, NR_POLAR, 1 iterasyon — değişiklik yok (⚡ panel tablosunda görüldü).
- Remote-IREG tam denetim denklemleri bu turun kapsamı dışında kaldı; +10% yükte vendor'a göre mean 0,177 pu Vm farkı **açık kalmaya devam ediyor**; hiçbir yerde sahte `SOLVED_FULL` üretilmedi (opt-in remoteRegulation profili önceki turdaki gibi WIP ve kapalı).
- FDNS/DC motorlarına dokunulmadı; 879/879 regresyon PASS.

## Test ve teslim

- `npm run typecheck` temiz; tam suite 879/879 (`.tmp/v4fix-suite.log`); Chrome `file://` smoke PASS (0 dış istek); Edge smoke eklendi.
- Gerçek ekran görüntüleri (özel konum, gerçek şebeke verisi): `local-benchmark-results/psse-offline-browser/v4uifix-private/{model,map,map-calculated,analysis,lightning,sld-default,workspace}-1600x1000.png` + `1366x768` seti.
- Teslim: `GA_PSSE_AC_DC_OFFLINE_TEST_FIXED_V4_UIFIX.zip` (offline build + bu rapor + sentetik ekran görüntüleri + test logları). Gerçek model görüntüleri hassas veri içerdiğinden ZIP'e konulmadı.

## Eksikler (dürüst liste)

1. Remote-IREG tam Jacobian kontrol denklemleri hâlâ açık (P3'teki 0,177 pu senaryo farkının kök nedeni).
2. Senaryo aç/kapat + yeniden hesaplama akışı haritadan tek dal için bağlandı; çoklu işlem yönetimi/geri al yığını UI'da yok (kontroller senaryo kimliğini doğru güncelliyor).
3. FDNS/DC büyük model paritesi ve 6.851 modeli bu turda yeniden test edilmedi (önceki tur kanıtları geçerli).
4. Standalone (`src/standalone/psse-web.ts`) paketi yeni CSS sınıflarını içermiyor (ana uygulama stilli).
5. Baz/Senaryo/Fark yalnız ΔVm + tooltip ΔP/ΔQ; Δ kolonlu tablo görünümü ve animasyonlu delta yok.
