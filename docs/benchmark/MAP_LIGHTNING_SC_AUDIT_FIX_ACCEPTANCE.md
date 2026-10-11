# Harita / ⚡ / SC denetim düzeltmesi kabul kaydı

Başlangıç: `84d0472613a487396f3cfcf79f21cc071ec6b8a2`. Uygulama commit'i: `6da32f3eacfa0e0e11bcf1e886a8a0b1065b3b18`. Bu tur UI, sorgu performansı ve sunum kimliğiyle sınırlıdır. LF/DC/N-1/SC hesap motorları, importer/worker, canonical sonuç şemaları ve `package-lock.json` değişmedi. Önceki incelemede geri çekilen HV/LV bulgusu için doğru +7/−7 yolu korundu.

| Bulgu | Önce → sonra | Kaynak ve kabul |
|---|---|---|
| F01 | Her SC satırında PF tablo taraması → mevcut kaynak güvenli PF indeksi; sorgu/sort ardından en çok 50 DOM satırı | [study-result-rows.ts:22](../../src/features/analysis/study-result-rows.ts#L22), [query:71](../../src/features/analysis/study-result-rows.ts#L71); yeni unit test 2 |
| F02 | PF sayı GA hazırlığına karışıyordu → GA/PF/BLOCKED/NOT_RUN/hedef/katalog/partition ayrı; null sıfıra çevrilmez | [rows:62](../../src/features/analysis/study-result-rows.ts#L62), [UI:43](../../src/features/analysis/workspace-results.ts#L43); test 1: GA BLOCKED + PF 6 kA = GA 0 / PF 1 / bloke 1 |
| F03 | Seçili fault tüm listeyi daraltıyordu → varsayılan tüm kapsam, seçili/hesaplanan/bloke/PF görünümü; TM, terminal, kV, ayrı GA/PF kA/MVA; arama, null-son sort, sayfa, seçili odak, doubleclick harita tooltip | [UI:16](../../src/features/analysis/workspace-results.ts#L16), [map:22](../../src/map/map-view.ts#L22); test 1–4 ve browser 70 katalog / 50 DOM / seçili 1 |
| F04 | AC N-1 açı literal — → doğrulanmış fiziksel POST uç açıları; PRE/CHANGE referans/ada uyumu kapısı; DC açı/Q/U null | [tooltip:59](../../src/map/equipment-tooltip.ts#L59); test 6: iki uç, reverse, bridge/eksik uç, aynı/farklı referans, DC |
| F05 | Δ yük özeti akış/kayıp/tap/durumu eziyordu → iki satır özet ve klavyeyle açılan Detay; P/Q kayıp metric eşlemesi; precision 1/2 | [tooltip:110](../../src/map/equipment-tooltip.ts#L110), [özet:127](../../src/map/equipment-tooltip.ts#L127), [CSS:54](../../src/styles/ui-workspace.css#L54); test 8 ve 340×205 browser sınırı |
| F06 | Vaka beslenmeyen MW her ekipmanda yineleniyordu → başlıkta bir vaka toplamı; ekipman null; yeni görünüm CSV/XLSX'te CASE_TOTAL/ELEMENT | [UI:28](../../src/features/analysis/workspace-results.ts#L28), [export:4](../../src/features/analysis/study-export.ts#L4); test 7: 16,921 MW bir defa |
| F07 | Katalog/partition tamamlanmış gibi yorumlanabiliyordu → ortak YTM/TM/gerilim kapsamı, hedef/işlenen/başarılı/bloke/iptal/kalan ve max 20 batch; ağ kesilmez | [state:10](../../src/features/analysis/sc-study-state.ts#L10), [actions:50](../../src/features/comparison/calculation-actions.ts#L50); test 4–5, browser aynı kimlik 10+20=30 |
| F08 | Native station/droop ve IEC kabulü eksikti → sınır korunur; bu UI turu normatif hesap yeteneği kazandırmaz | Solver değişikliği yok; NETWORK_APPROXIMATION ve GA_APPROX_STATION_OFF ayrı tanısal profiller; Ip/Ib/Ith null; IEC/PF Δ null |
| F09 | Model/fault/katalog/sayısal seviye kolay karışıyordu → fiziksel fault sonuçları yalnız tam FID'ye bağlanır; yabancı model resultId reddedilir; sourceMethod ve sayaçlar ayrı | [rows:25](../../src/features/analysis/study-result-rows.ts#L25), [workspace:30](../../src/domain/results/workspace.ts#L30); test 1/3, browser farklı kaynak kimliği eski batch'i birleştirmez |

Yeni sekiz test [map-lightning-audit.test.ts](../../tests/unit/map-lightning-audit.test.ts); browser kabulü [map-lightning-audit-browser-smoke.mjs](../../tools/map-lightning-audit-browser-smoke.mjs). Çalışan testi silme/skip veya kabul eşiği gevşetme yapılmadı. Eski SC tek satır beklentisi tam katalog + NOT_RUN satırları doğrulayacak şekilde güçlendirildi. Eski export'lar korunur; CASE_TOTAL/ELEMENT yalnız eklenen ortak görünüm export'udur.

## Ölçüm ve gerçek veri kabulünün sınırı

4.689 **sentetik** PF kaydı ile son hedefli ölçüm: indeksli tam projeksiyon **63,4631 ms**, sort/arama/sayfa sorgusu **2,8274 ms**, `heapUsed` aralık farkı **13.713.576 bayt**. Bu değer tepe bellek veya gerçek şebeke çözücü performansı değildir; hard threshold konulmadı. İlk sayfa DOM üst sınırı 50'dir. BLOCKED GA yanında PF gerçek 0 değeri ayrıca korunur.

SN3/SN4 kabulü önceki gerçek worker sonuçlarının ignored cache'inden yapılmıştır: **0 yeni model importu, 0 yeni solver/faktorizasyon isteği**. Büyük cache'in ilk browser aktarımı bellek yüzünden başarısız oldu; yerel sunum projeksiyonuna geçildi. Projeksiyon native geometri/elektriksel alanları ve aynen LF sonucunu korur; ilgisiz source attributes ve kullanılmayan referans tablolarını içermez. Bu bir yeniden native kaynak audit'i veya yeni sayısal analiz değildir. Yerel source bağları ve önceki B0 LF vektör SHA-256'ları birebir doğrulandı. Cache arşivi yeni rapora eklenen birleşik ZIP'le byte-identical diye sunulmadı. Gerçek FID, model hash, kaynak dosyası ve ekran görüntüsü Git'e alınmadı.

| Ölçülen / bağlı veri | SN3 | SN4 |
|---|---:|---:|
| Model study case | 20261007_1400_SN3_TR0 | 20261008_1000_SN4_TR0 |
| Bağlı PF N-1 / fiziksel SC / elektriksel SC referansı | 660 / 4689 / 3769 | 664 / 4686 / 3768 |
| Seçili YTM native fiziksel fault kataloğu | 6278 | 6368 |
| GA sayısal / bloke / NOT_RUN | 3 / 0 / 6275 | 3 / 0 / 6365 |
| Aynı kapsamda kV/kimlik/sentinel/duplicate kapısını geçen sayısal PF fault | 465 | 466 |
| Tam target identity'ye bağlı mevcut partition sayacı | — | — |
| Cache UI sıcak SC projeksiyon ölçümü | 94,4 ms | 83 ms |
| Tam AC post matrisinde ≥%80 **ElmLne** risk satırı | 16 | 6 |

465/466 sayısal PF, rapordaki 573/574 ham FID örtüşmesiyle aynı ölçü değildir; ham örtüşme geçerli kV/tekil sayısal referans kanıtı sayılmaz. PF bütün modeldeki 4689/4686 kayıt, seçili YTM native 6278/6368 fault kataloğu değildir. Cache'te tam scope target-hash eşleşmeli partition kataloğu bulunmadığı için — gösterildi; önceki 500/505 sayısı yeni kabul sonucu gibi taşınmadı. Yalnız üç GA fault sayısaldır; hepsi veya tüm partition'lar hesaplandı iddiası yoktur. Bu GA/PF sütunları **IEC/PF paritesi sağlamaz**.

Cache kabulünde N-1 risk filtresi için YTM görünümü açılıp tam post matrisinin 16/6 hat sonucu kullanıldı; SC fault tablosunda seçili YTM kapsamı korunur. Trafolar riskli hat sayılmaz. Kullanıcı alarmı %80, fiziksel yük limiti %100 olarak kalır.

## Masaüstü ve test kabulü

SN3 ve SN4 gerçek cache N-1/SC UI replay'i **1366×768, 1440×900, 1600×900, 1920×1080** boyutlarında geçti: 640 px ⚡, kapalı hesap seçenekleri, en az üç satır, kendi scroll'u, sticky başlık, sayfa taşması yok. SC ilk sayfa 50 satır; üç GA fault görünür, diğerleri NOT_RUN. 1366'da replay tablo yüksekliği SC 254,94 px / N-1 252,94 px. Tam uygulamanın mevcut sentetik browser smoke'unda N-1 147,70 px / SC 149,70 px; bunlar farklı harness ölçümleridir. İki toolbar satırı ve mevcut harita/analiz/scenario/export işlevleri eski E2E'de korundu.

Tooltip ölçümü **340×151,91 px**; Δ/Detay **340×185,66 px** ve alt sınır 1072 ≤ 1080; Tab odak/Detay/ESC yeniden açma geçti. Hesap bütçesi testi gerçek controller'a **sentetik mock worker cevapları** verir: 10+20 aynı kimlik 30 BLOCKED kayıt; sourceHash değişince yalnız yeni 1 kayıt. Bu 30 gerçek SC çözümü değildir.

Yerel tam test bir kez **398: 397 pass / 1 fail** çalıştı; tek hata yeni portable'ın henüz eski HEAD artifact'ine karşı karşılaştırılmasıydı. Güncel portable uygulama commit'ine alındı; başarısız portable-byte dosyası **5/5**, son yeni unit dosyası **8/8** geçti. Test kaldırılmadı/skip edilmedi. Typecheck, lint (274 kaynak), üç E2E suite, standart build, portable build ve `git diff --check` geçti. Son küçük iptal/sunum değişikliğinden sonra yalnız yeni browser suite tekrarlandı; kapsamlı gerçek analiz tekrarlanmadı. Final commit'in bütün 398 testi exact-HEAD CI ile ayrıca doğrulanacaktır.

Portable: **1.649.720 bayt**, raw SHA-256 `13e658ad0350a2fc8ee808e23c44e7cf993f60d1f360ed9da10ad4a647068630`. İki ardışık build deterministik; committed blob ile aynı ve LF-only.

## Yayın / dal temizliği

Bu belge hazırlığında feature `codex/map-lightning-sc-multifault-audit-20261011`; feature CI, main FF, ayrı main CI ve uzaktaki dal/tag kapanış kanıtı yayın kapıları geçtikten sonra eklenecektir. Başarısız CI ile merge veya dal silme yapılmaz.

## Açık hesap yetenekleri / veri gereksinimi

- Varsayımsız native station/droop Full AC N-1 tamamlanmış değildir. `GA_APPROX_STATION_OFF` yalnız açık tanısal profil; native kontrol davranışına eşdeğer değildir.
- Normatif IEC 60909 ve PF yöntem paritesi yoktur. IEC edition/factor, KG/KT/KKW, tam kaynak/konverter üyeliği ve nominal temel kanıtı gerekir. `MISSING_MEMBERS`/nominal mismatch reddi sürer; Ip/Ib/Ith ve 1LG/LL/2LG mevcut olmayan yeteneklerdir.
- PF N-1 tam post dal/bara matrisi yoktur; metadata/extrema P/Q/U post paritesi sağlamaz. DC yalnız P taraması; seçili Full AC doğrulaması ayrı sonuçtur.
- Kompakt hybrid cache açı referans üyeliği taşımadığında POST mevcut açı gösterilir, PRE/CHANGE uyumu ispatlanamıyorsa null + ANGLE_REFERENCE_UNKNOWN/MISMATCH. Site CHANGE açısı da yeterli referans kanıtı olmadan null kalır.
- SN7 özgün B0→S1→S2 defteri bulunmadı. Önceki `NEW_CONTROLLED_SN7_TEST` yeni kontrollü testtir, özgün S2 değildir; bu tur SN7 yeniden import/analiz yapılmadı.
