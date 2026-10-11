# 12.10.2026 bağımsız denetim — hedefli düzeltme ve kabul

Denetlenen başlangıç `ae82a5f3de8f3dc1ffd277a37d08290dbba148dd`; düzeltme dalı `codex/analysis-v7-evidence-hardening`. Raporun koddan çıkarımlarını somut kaynak ve negatif testlerle kontrol ettik. Mevcut LF matematik çekirdeği, browser-js-engine ve DC/N-1 screen kaynakları değişmedi. Main `9b1eee94d5ef4548716611fc5447f07727c41d51` korunur; bu düzeltme main merge veya dal/tag temizliği içermez.

## Bulgu / karşılık

| Denetim bulgusu | Yapılan düzeltme | Yeni kanıt |
| --- | --- | --- |
| P1 bilinmeyen station/source enum'ları kabul edilebilir | Aktif controller için yalnız STATION_CONTROL_CONVERGED ve iki kaynak kanıtında SOURCE_BOUNDED kabul edilir. Eksik/failed/unknown durum veya geçersiz destek sayacı PARTIAL kalır. Residual ayrı taşınır. | Gerçek küçük native station sonucu üzerinde FAILED/NOT_RUN/UNKNOWN/boş/undefined ve source-fidelity/counter bozulma testleri; destekli pozitif test de korunur. |
| P2 manuel/hibrit/DC provenance karışması | Ortak selectN1Result aynı case/model/scenario/settings üzerinden seçim yapar. Güncel manuel ret eski hibrit/DC POST'u gölgeler; stale kayıt güncel kaydı gölgeleyemez. Harita, tablo, activeResultId, PF metrik izdüşümü ve kanıt aynı kaynağa bağlanır. | Aynı ctx'de gerçek küçük native hibrit+manuel sonuç; manuel ret; stale; farklı case; PF referansı; eski hibrit gözlemin kıyaslamaya sızmaması. |
| P2 SC source readiness fazla geniş | Canonical jeneratör/dış şebeke için expected/observed/missing-adapter/duplicate matrisi eklenir. Snapshot kimliği kaydedilir. Adapter-only sınıflar tam native ağ envanteri diye sunulmaz; başarılı dar durum ADAPTER_FIELDS_PRESENT'tir. | Canonical kaynağı adapter'dan çıkarınca hem özet PARTIAL hem gerçek fault BLOCKED/null; model kimliği/duplicate kontrolleri. |
| P2 limit çakışması geç bildiriliyor | Tam effective graph ve kapalı kuplaj partition'ı üzerinden preflight; controller ve doğrudan hibrit API'de LF'den önce; UI'da ilk 50 conflict/YTM/profile listesi ve engellenmiş başlat/devam. | İki YTM'yi birleştiren kapalı kuplaj, çelişen/eşit profiller, daha sonra açılan kuplaj; solveBase çağrısı 0. UI sınır barası testi. |
| P3 teknik enum / yoğun SC formu | Ana kanıt/metot kartları Türkçe; ham kod tooltip/JSON/data attributes'ta korunur. AC kapsam funnel ve residual ayrı gösterilir. IEC seçeneği, uygulanmamış Ib/Ith süreleri pasif; Ip/Ib/Ith/sekans eksikleri açıklanır. Terminal ve kontrol ayrıntıları açılır panelde. | Beş viewport, uzun metin, Türkçe ana durum, pasif IEC/time, keyboard/tooltip ve 50 satır sınırı. |
| P3 uzun oturum render maliyeti | Ölçüm sonrası tek snapshot cache: model/result/scenario/settings/source/scope/capacity revision/case-detail değişimi invalidate eder. Filtre/sort/precision kaynak satırlarını tekrar kurmaz. Metadata/fault seçenekleri aynı satır snapshot'ında yeniden map/stringify edilmez. | Yeni invalidation/hydration testleri ve gerçek cached SN3 / 6.278 fiziksel katalogla 20 warm filtre örneği. |

Yeni UI testi ek bir gerçek etkileşim hatası buldu: alan blur/change sırasında aynı formun tekrar DOM'da taşınması, limit kaydet düğmesindeki click'i kaybedebiliyordu. Aynı panelde form/kanıt/tablo gereksiz taşınmaz; kontrol JSON'u açılır ayrıntıya alındı. Başarısız test eşiği gevşetilmeden aynı click akışı geçti.

## Gerçek veri ve performans ayrımı

Bu görevde **yeni DGS importu veya yeni gerçek SN3/SN4/SN7 sayısal hesabı yoktur**. Önceki yerel gerçek SN3 model/sonuç cache'i kullanılarak gerçek harita/⚡, 6.278 fiziksel terminal, 465 PF referans kaydı, eski 3 tanısal SC sonucu ve eski N-1 ayrıntısı yeniden sunuldu; dört desktop viewport, tooltip, sayfalama ve risk listesi geçti. Bu bir cached-result UI kabulüdür; yeni elektriksel/normatif kabul değildir. Testte hesap worker'ı RUN istekleri yasaklandı.

Eski gerçek LF diagnostics yeniden sınıflandırıldı: 4.077 bara / 5.140 branch, 2.0407307441128175e-8 MW residual; CONTROL_FIDELITY_PARTIAL korunur. Cache'in render amaçlı SC context'inde adapter kaynak listesi bulunmadığından source summary PARTIAL kalır; bu, yeni DGS'nin 1.966 kaynağının eksik olduğu iddiası değildir. Dar canonical envanter ile eldeki adapter verisinin kapsamı ayrılır. Özel cache, FID listeleri ve günlükler commit edilmez.

Aynı yerel cached SN3 UI fixture, 6.278 katalog, 5 warm-up + 20 filtre, 50 DOM satırı, aynı Chromium/makine koşullarında:

| Render örnekleri | Medyan | P95 | Maksimum |
| --- | --- | --- | --- |
| Cache öncesi | 125.25 ms | 152.5 ms | 152.9 ms |
| Snapshot cache sonrası | 21.9 ms | 32.4 ms | 33.0 ms |

Bu yalnız kaynak-satırı/filtre sunum maliyetidir; LF/SC solver hızlanması, donanımlar arası sonuç veya bütün uzun oturumlar için garanti değildir. Ayrı sentetik 6.278 katalog viewport kabulünde P95 yaklaşık 26 ms. Kaynak/kimlik/scope değişimindeki invalidation, ham delta ve null/zero ayrımı korunur.

## Son kontroller

- Typecheck / mimari lint: PASS; 288 kaynak dosyası.
- Unit + regression: **422/422 PASS, fail 0, skip 0**. Önceki 414 test korunur; 8 anlamlı test eklendi.
- Üç E2E suite: PASS. Yeni seçili kanıt/limit/5 viewport kabulü Chromium suite'ine eklendi.
- Standard ve portable build: PASS. Portable offline smoke ve raw committed byte kapısı ayrıca doğrulanır.
- Gerçek cached SN3 UI: PASS; gerçek yeni numerical acceptance: NOT_RUN.
- Bağımsız IEC normatif testler ve PF parity: BLOCKED. Tam native station/droop/P dengeleme, KT/KG/KKW, Ip/Ib/Ith, sekans/topraklama ve equipment adapter eksikleri devam eder.

Portable SHA-256: `1ce2b1a18343e95de60a75c12143b55b2930de7d221e5e3d553771d88d22743d` — 1.688.550 byte. Bu düzeltmenin exact commit CI bağlantısı ve final SHA görev kapanışında doğrulanır; önceki feature CI başarıları yeni dalın CI'ı yerine sunulmaz.

Önceki SN7 S2 özgün manevra defteri değil, yeni kontrollü test senaryosuydu. Önceki SN3/SN4 tanısal N-1/SC sonuçları IEC/PF paritesi değildir. Bu görev bunları normatif olarak tamamlamaz.
