# S2 senaryo farkı, YTM N-1 ve SC iş akışının geri kazanımı

Başlangıç: `d487ce953e6329dcaf815d590b7351f4c6067964`. Uygulama dalı: `fix/restore-scenario-delta-ytm-n1-sc-20261011`. Gerçek model kimlikleri, FID listeleri, model/sayısal vektör hashleri ve ekran görüntüleri yalnız ignored `local-benchmark-results` altında tutuldu.

## Düzeltme ve korunan davranış

Raw `BranchResult.loading` 0/0 çıkarımı ortak, doğrulanmış yüklenme projeksiyonuyla değiştirildi. Hatlarda seçili akım kapasitesi, trafolarda fiziksel rated MVA kullanılıyor; fark yüzde puan (pp). Canonical sonuç şeması ve LF/DC/AC denklemleri değişmedi. Aynı model, motor, güncel ayar, overlay, terminal partition ve açı referansı kapıları harita, Analizler ve ⚡ için ortak. Gerçek sıfır korunuyor; eksik kapasite/sonuç veya uyumsuz kimlik null ve nedeni ile gösteriliyor.

B0/S1/S2 ve seçilebilir referans için PRE/POST/ΔP, ΔQ, ΔkV, Δaçı, Δyüklenme; fiziksel trafo YG/AG uçları; sıfır merkezli pp lejantı; kaynak/metrik tercihini hesap sonrasında koruma eklendi. N-1 ve SC eylemleri mevcut worker hesaplarına bağlandı. N-1 tam çözülmüş dal matrisi, Q, yüklenme ve beslenmeyen yük gösteriliyor. Uyarı eşiği varsayılan %80 ve ayarlanabilir; fiziksel %100 limiti ile DC %90 promosyon politikası ayrı.

SC kapsamı tüm kaynak grafında ölçülüyor. Seçili fiziksel FID, elektriksel partition ve PF kayıt sayısı ayrı. Kaynak hazırlığı ve component factorization tek retained cache ile tekrar kullanılıyor; profil/model/overlay değişimi geçersizleştiriyor. İlk batch varsayılan 10, en çok 20 hedef; devam tamamlanan faultları tekrar çözmüyor. PF MAX sütunu GA BLOCKED olsa da ayrı referans olarak görünür; verified Δ için üyelik/method kapıları korunur. Eksik native alanlar ve gereken bağımsız PF export kanıtları JSON olarak indirilebilir.

## Gerçek veri kabulü

`kontrol1` yerel olarak bulundu, tracked değil. Gerçek SN3/SN4 ZIP, eşleşen PF referansı ve açık ControlContext ile B0 tekrar hesaplandı; önceden doğrulanmış B0 sayısal vektörleri bit düzeyinde aynı kaldı. Her modelde ardışık iki non-bridge hat manevrası ve bir bridge manevrası gerçek UI/worker hesaplarıyla çalıştırıldı. Senaryo seçimi ve IndexedDB kayıtları doğrulandı.

SN7 ZIP bulundu; proje/Downloads/kontrol1 JSON ve export aramasında özgün B0→S1→S2 defteri bulunamadı. Kullanıcının açık izniyle gerçek SN7 üzerinde **NEW_CONTROLLED_SN7_TEST** oluşturuldu; özgün S2 yeniden üretildi iddiası yoktur. SN7 NR yakınsasa da mevcut aktif denge kısmi olduğu için `PARTIAL_GA_COMPARISON` korunur. Kullanıcının açık portable `file://` sekmesi güvenlik politikası nedeniyle okunamadı; o sekmenin IndexedDB'si denetlendi iddiası yoktur. İzole test tarayıcısında uygulamanın IndexedDB yazma/geri çağırma yolu geçti.

Üç modelde B0→S1→S2 için beş metrik harita, Analizler ve ⚡ arasında aynı. Bu son render/persistence denetimi kayıtlı gerçek hesapları kullandı, sıfır yeni solver isteği gönderdi. Örnek SN3 retained hatta S1 ΔP=-0,751456 MW, ΔQ=-4,726285 MVAr, Δyük=-0,625750 pp; S2 ΔP=-8,424769 MW, ΔQ=-7,354015 MVAr, Δyük=+2,500446 pp. İlk temsilci TM'de S2 ΔU=-0,070556 kV, Δaçı=-0,931039°. Bu hat ve TM örnekleri ayrı fiziksel kayıtlardır.

| Ölçüm | SN3 | SN4 |
|---|---:|---:|
| Native tüm gerilim N-1 katalog | 5131 | 5132 |
| Screenable / islanding / unscreenable | 2245 / 2597 / 289 | 2233 / 2610 / 289 |
| Orta Anadolu native/PF outage eşleşmesi | 660 / 660 | 664 / 664 |
| Seçili tanısal non-bridge vaka | AC_CONVERGED_VIOLATION | AC_CONVERGED_VIOLATION |
| Tam matriste yüklenmesi ≥%80 ekipman | 49 | 53 |
| Non-bridge en yüksek yüklenme % | 121,190871 | 452,838112 |
| Bridge vaka / beslenmeyen yük MW | PARTIAL_SOLUTION / 16,921 | PARTIAL_SOLUTION / 23,870 |
| Orta Anadolu SC fiziksel FID | 6278 | 6368 |
| Seçili SC elektriksel partition | 500 | 505 |
| PF MAX kayıt FID eşleşmesi | 573 | 574 |
| Tüm kaynak grafı partition | 4077 | 4088 |
| Tanısal SC seçili hedef / factorization / RHS | 3 / 1 / 3 | 3 / 1 / 3 |

N-1 kullanıcı tarafından ayrıca onaylanan `GA_APPROX_STATION_OFF` profiliyle çalıştı; global LF droop ayarı değiştirilmedi. Profil `CONTROL_FIDELITY_PARTIAL / NOT_PF_PARITY`. Bridge vakasında kalan ağ çözülürken beslenmeyen bölge satırları `ISLAND_UNSUPPLIED` ve null post ile ayrılır. Native droop N-1 destek engeli ve varsayımsız SC BLOCKED kapısı da gerçek worker eylemleriyle doğrulandı.

SC ayrıca onaylanan NETWORK_APPROXIMATION profilinde c_source=c_fault=1,1; eksik makine r=0,01 ve xdss=0,2 pu; converter bağlı terminal bazında -90°; nominal baz normalizasyonu açık. Bunlar native veya IEC doğrulanmış değer gibi sunulmadı. Native aktif kaynak engelleri SN3: 1 dış kaynak c, 393 makine, 1323 converter; SN4: 1 / 391 / 1292.

| Un kV | SN3 GA Ikss kA | SN4 GA Ikss kA |
|---|---:|---:|
| 154 | 1,514373 | 1,848196 |
| 33,6 | 5,485037 | 6,323063 |
| 31,5 | 9,990285 | 10,061398 |

Maksimum SC residual SN3 5,962e-13, SN4 3,929e-13. Üçer seçili faultta PF üyeliği `MISSING_MEMBERS`; birer faultta ayrıca `NOMINAL_BASE_MISMATCH`. GA/PF Δ ve IEC sertifikasyonu **BLOCKED**; Ip/Ib/Ith null. PF sonuçları GA kaynak parametresi olarak kullanılmadı. Tüm 6000+ faultlar brute force çözülmedi.

⚡ N-1/SC panelleri 1366×768, 1440×900, 1600×900, 1920×1080 boyutlarında ≤640 px, sticky header, kendi scroll, en az üç normal satır alanı ve panel içinde pager kabulünü geçti. Uzun trafo tooltip kritik sayıları ve dipnotu kesmiyor.

## Çalıştırma bütçesi ve sınırlar

SN3/SN4/SN7 kaynak ZIP'i birer kez çalışma bağlamına alındı; B0, S1, S2, bridge gerçek hesapları kayıtlandı. N-1 native seçili DC ve destek kapısı, ayrı onaylı non-bridge/bridge tanısal AC; SC native bir engelli hedef ve ayrı üç onaylı hedef/model. Daha sonraki ekran denetimlerinde bu gerçek sonuçlar tekrar kullanıldı. Portable doğrulaması ayrı artifact kabulü olarak kayıtlanır. Özgün SN7 S2 ve IEC/PF paritesi veri engeli nedeniyle doğrulanmış sayılmaz.

## Eski dal temizliği

Silmeden önce aşağıdaki uzak başlar tam SHA ile ve `origin/main` atası olduğu doğrulandı. Yalnız bu üç dal silindi; yeni feature dalı korunur. Investigation dallarından commit taşınmadı.

- `fix/map-restore-flow-two-row-toolbar-lightning-20261010`: `37eb511d9767182e0056719dc4798f36dda08fb8`
- `fix/desktop-map-six-metrics-compact-results-20261011`: `5f336d4da39bab0e828f41ab00d0f7a959da2bde`
- `fix/map-lf-voltage-freeze-island-loading-tooltips-20261011`: `ac3ba1195054cea92c259e3361e8f77ba4ea8749`

## Son doğrulama

Tam unit/regression **390/390**, fail/skip/cancel **0**. Typecheck, 269 kaynak dosyası için architecture lint, standard build, portable build, iki e2e suite ve portable PF benchmark smoke geçti. İlk full unit çalışmasındaki eski `%` beklentisi `pp` ve yanlış birimi reddetme ile düzeltildi. Browser smoke native katalog/recorded DC etiketleri birlikte korunacak şekilde düzeltildi; PF smoke yeni hızlı panelden bağımsız mevcut analiz panelini açıkça hedefler. Test silinmedi, skip/gevşetme yapılmadı.

Portable artifact: **1.638.540 byte**, SHA-256 `c2c5ea9044410aa2fcfdce3b837be27beedcb242486e7166990b3aa713e721ce`. Raw HEAD bytes, deterministik yeniden build ve LF-only provenance unit kapısı geçti. `d902d4a` kaynak/portable commitinde izole Chromium'da gerçek SN3 ZIP bir kez daha yüklendi; gerçek Full AC worker bir kez çalıştı. 4077 bara / 5140 dal, mismatch 2,041e-8 MW, engine 2,579 s, uçtan uca hesap 29,976 s. Portable B0 vektörü önceki doğrulanmış SN3 B0 ile bit düzeyinde aynı. Portable gerçek veri kabulünde kaynak temizdi, artifact raw HEAD ile eşti. Bu ayrı artifact kabulüyle toplam gerçek SN3 ZIP yükleme bütçesi iki; SN4/SN7 birer.

Exact-SHA feature CI ve ayrı main CI başarıları, fast-forward entegrasyonu ve son uzak branch envanteri görev kapanış kaydında belirtilir. Bunlar doğrulanmadan entegrasyon başarılı sayılmaz.
