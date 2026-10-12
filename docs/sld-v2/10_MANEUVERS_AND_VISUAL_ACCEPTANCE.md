# SLD manevra ve görsel kabul

Kesici/ayırıcıya tek gerçek tıklama görünür Hızlı manevra kartını açar. `Aç`, `Kapat`, `Değiştir + Senaryo Full AC hesapla`, `Kaynağa dön` doğrudan erişilir; İşlemler sekmesindeki gelişmiş eylemler de korunur. Kart iki sütunlu ve mobil genişliğe uygundur. Enter/Space seçimi ve dokunma çalışır; kapatma/Escape seçili SVG ekipmanına odağı döndürür. Açık/kapalı kontak biçimleri farklıdır. Gerilim rengi, cihaz konumu, servis durumu ve güncel hesap ayrı kavramlardır.

## Gerçek pointer ve senaryo zinciri

`tools/sld-browser-smoke.mjs` gerçek `.click()`, `.tap()`, Enter/Space, `isVisible()` ve DOM bounding box kullanır. Sentetik click ile kabul sağlanmaz. Gerçek CPU worker Full AC çalışır: güncel sonuç → Aç → STALE ve sayısal etiketlerin kaldırılması → isteğe bağlı Full AC → seçili senaryo hash’iyle kabul edilen sonuç → Kaynağa dön. Kanonik ağ işlem boyunca birebir değişmez. Filtre, zoom/tam SVG export, N-1/SC/LF yöntem seçimi, karşı TM/geri dönüş, envanter ve analiz odağı, model değişimindeki geç kaynak yanıtı ve altı ekran genişliği kontrolleri korunur.

SN3’te aynı işlem gerçek native kesicide uygulandı. Başlangıç main’de kart tek seçimle görünmedi; düzeltmede dört eylem görünür oldu. Açma sonrası LF STALE, yeniden Full AC `CONVERGED_FULL_NR`, sonuç kimliği seçili senaryo hash’iyle aynı, native model değişmedi ve B0’a dönüş doğrulandı. Mevcut kaynak/result snapshotları kullanıldı; bir gerçek isteğe bağlı Full AC hesabı yapıldı. Bu kabul IEC veya PowerFactory sayısal paritesi anlamına gelmez.

Gerçek kanıt: `CURRENT-pointer-private-proof.json`, `BEFORE-pointer-private-proof.json`, `CURRENT-REAL-POINTER.png`, `CURRENT-REAL-FULL-AC.png`. Model, kontrol context’i, ayarlar ve kimlik ayrıntıları bu yerel kayıtlardadır.

## İncelenecek görseller

Yerel `local-benchmark-results/sld-fix-20261013/BEFORE_AFTER_COMPARISON.html` internet gerektirmeyen karşılaştırmadır. TM ve önceki sürüm seçilebilir; zoom ve eşlenmiş kaydırma vardır. Üç sürüm aynı viewBox’ta gösterilir. M1583/M1301/M56 ve ek gerçek M38 için `CURRENT-*.svg/.png`, `BEFORE-*.svg/.png`, `LEGACY-*.svg/.png` ile `COMPARE-*.svg/.png` oluşturuldu. FID/cubicle/rota dökümü aynı klasördedir.

| Kabul alanı | Yerel sonuç | Kanıt / sınır |
|---|---|---|
| fiderUpCorrect | PASS | Üstte beklenen 17/17 hat; alt slotta kalan 154 hatlar V4 ile uyumlu |
| transformerCascadeCorrect | PASS | İki ayrı gerçek 2W, aynı native 154 bara, gerçek 34,5 kV korunur |
| switchChainContinuous | PASS | 525 native glyph ve kontak rotası; gerçek örneklerde belirsiz sıra 0 |
| maneuverVisible | PASS | Tek gerçek seçim, dört eylem, görünür kart ve DOM geometry |
| maneuverScenarioWorks | PASS | Gerçek SN3 STALE → worker Full AC → exact senaryo kimliği → B0 |
| realPointerWorks | PASS | Fare, Enter/Space ve mobil dokunma |
| nonRegression | PASS | Eski 457 + yeni 17 = 474 test; solver diff’i yok |
| CI | PASS | Uygulama `1cab73f` exact [38322226820](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38322226820); portable ham bayt kapısı dahil SUCCESS |

## Korunan sınırlar ve entegrasyon

3/19/11 sınıflanamayan fiderin yönü uydurulmadı; tamamı görünür kalır. Kaynak ototrafo/bank fonksiyonu ve eksik cihaz sıraları için ek veri gerekir. Sekiz MV bara düzeni/14 alt çıkış taşması sentetik sınır testleriyle doğrulandı; gerçek örneklerdeki mevcut native düzenler ayrıca incelendi. Kontak devamlılığı gerçek kaynak geometrisini doğrular, işletme izin sırasını veya enerjilenmeyi hesaplamaz.

IEC 60909-0:2016 BLOCKED, 3W hesap UNSUPPORTED ve N-1 gerçek kontrol fidelity PARTIAL sınırları korunur. Bu görsel onarım normatif IEC tamamlanması, PF paritesi veya tam N-1 kontrol kapsamı sağlamaz.

Yeni görev açıkça otomatik main entegrasyonu yetkisi vermiyor. Feature dalı, artifact ve exact CI kabulü tamamlandıktan sonra kullanıcı bu görselleri ve manevra akışını incelemelidir. Kullanıcının yeni görsel/senaryo kabulü ve main entegrasyonu onayı olmadan main’e merge/fast-forward/push yapılmaz. Dal veya tag silinmez.

Kapanış belge commit’i uygulama/portable baytlarını değiştirmez. Son feature HEAD, onun ayrı CI sonucu ve değişmeyen main SHA’sı yerel `FINAL_RECEIPT.json` / `FINAL_ACCEPTANCE.md` ile görev kapanışında kaydedilir. Kullanıcı kabulü bekleyen statü `READY_FOR_VISUAL_ACCEPTANCE` olup main entegrasyonu tamamlanmış sayılmaz.
