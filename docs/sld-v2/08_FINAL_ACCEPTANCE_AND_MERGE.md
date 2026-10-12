# SLD V2 son kabul ve entegrasyon

Başlangıç main: c8ee28b23095e021d1bae7c9438e3a1469f26b1b. Feature: feat/sld-v2-engineering-topology.

Uygulama zinciri: 93fcd73 (native topoloji/port/overlay/UI), 19a3fe9 (portable), 2f1a078 (model değişiminde gecikmiş kaynak yanıtı), d67e209b51f6560d6d272b5c55d5fb421eb5bcf8 (analiz eylemi AppContext yönlendirmesi ve güncel portable). Kabul raporları ayrı commit'te kaydedilir; bu belge kendi commit SHA'sını içine gömmez.

| Kapı | Yerel sonuç |
|---|---|
| npm ci / başlangıç | PASS; 438/438 |
| typecheck / lint | PASS; 303 kaynak dosyası |
| Nihai unit/regression | 457/457; 438 korundu + 19 yeni; fail/cancel/skip 0 |
| E2E | 4 akış PASS; son SLD odaklı düzeltmeler ayrıca browser kabulünden geçti |
| Standard build / portable build | PASS |
| Git HEAD ham portable blob = rebuild | PASS; mevcut byte kapısı korunur |
| Portable offline browser | PASS; gerçek CPU worker / import / analiz / export / cancellation akışları |
| Gerçek kaynak topoloji / SN3-SN4 sunum | PASS; 07 raporundaki kapsam ve sınırlar |
| Exact feature CI | SUCCESS; 7b660d0a8c2c6ba9cb3a6b0afb095e3a9b1d2ad0; [38313119790](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38313119790) |
| Main FF / ayrı main CI | SUCCESS; c8ee28b → aynı 7b660d0; [38313537307](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38313537307) |

Portable: dist-portable/GridAnalyzer_v7.html, 1.722.554 byte. SHA-256: 6bdeeadbabd7750aeba1e960d97c168eb3c5632ba7bce30029c0c19a2611d03b.

Son UI kontrolünde LF/N1/SC mod geçişinin önceki aile metriğini taşıdığı gerçek browser assertion'ıyla üretildi. 7ddc466b6d11e48b6a1d9966867702f23bdbfd36 düzeltmesi aile metrik belleği/defaultlarını, LF'ye dönüşte geçerli aktif senaryo rolünü ve eski benchmarkMap'in temizlenmesini ekler. Aynı aileye tıklamak seçili metriği değiştirmez. Yeni kontrol PASS, 457/457 yeniden PASS; aşağıdaki CI kayıtları ilk entegrasyona aittir, bu ek düzeltmenin exact feature/main CI'ı ayrıca doğrulanır.

68345e1f800ce58721e3394101e14870e0b3b93a akış okunu yerel native terminalin pf/pt işaretine bağlar, iç hatların iki ucunu korur ve Δ işaretlerini gerçek akış yönünden ayırır. Güncel SN3/SN4 render ve whole-network topoloji kabulü PASS; hesap motorları değişmedi.

Değişen kaynaklar: src/domain/model/station-topology.ts; src/features/sld/{sld-renderer,sld-view,physical-layout,result-overlay,navigation,symbols,transformer-presentation}.ts; src/features/inventory/inventory-view.ts; src/styles/ui-workspace.css. Ayrıca package.json E2E zinciri, sld-v2-engineering unit testleri, v702 kaynak metadata fixture'ı, sld-browser-smoke / sld-real-ui / sld-real-acceptance araçları ve mimari/kabul belgeleri güncellendi.

Korunan sınırlar: ototrafo sınıflandırması kaynakta doğrulanmadı; 3W elektriksel motor UNSUPPORTED; IEC 60909-0:2016 normatif tamamlanma BLOCKED; Ip/Ib/Ith null; real N1/SC tanısal sonuçlar PF/IEC paritesi sağlamaz. Önceki SN7 S2 kontrollü yeni test senaryosudur, özgün işletme S2'si değildir.

Mevcut LF/DC/N1/SC motor kaynakları değişmedi. Başlangıçtaki 438 test silinmedi/skip edilmedi/gevşetilmedi. v702 fixture yalnız yeni StationTopologyGraph kaynak metadata alanlarıyla genişletildi; tüm eski assertions korunur.

GitHub PR bağlantısı 403 Resource not accessible by integration döndürdü. Promptun açık fallback yetkisi kullanıldı: fetch ile main c8ee28b ve feature 7b660d0 doğrulandı, ancestry başarılı, main --ff-only ile güncellendi ve pushlandı. Aynı SHA için ayrı head_branch=main CI SUCCESS doğrulandı. Motor kaynaklarında baseline'a göre diff yok; portable hash aynıdır.

Dal/tag silinmedi, force push/reset kullanılmadı. Korunan uzak dallar: main, feat/sld-v2-engineering-topology, codex/analysis-v7-evidence-hardening, feat/analysis-ui-native-n1-iec60909-2016, feat/engineering-n1-iec60909-validation. pf-parity-v2-validated tag'i korunur. Feature SHA main'in atasıdır.

Bu kapanış belgesi yukarıdaki uygulama kabulü ve entegrasyon run'larını sabitler. Belge commitini taşıyan nihai uzak main SHA ve kendi exact main CI sonucu, içerik/SHA döngüsü oluşturmadan yerel FINAL_RECEIPT.json ve son kullanıcı tesliminde kaydedilir. Kaynak kodu ve portable byte'ları belge commitinde değişmez.
