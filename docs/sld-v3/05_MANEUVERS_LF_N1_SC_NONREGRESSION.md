# Gerçek manevra ve hesapların korunması

Gerçek SN3 mevcut canonical/cache snapshot'ı yeniden kullanıldı; yeni model importu veya tam N-1/SC taraması yapılmadı. Hotamış native kapalı hat kesicisi gerçek pointer ile seçildi. Hızlı kart Aç/Kapat/Değiştir + Senaryo Full AC/Kaynağa dön doğrudan görünür. Aç sonrasında LF STALE ve sayısal etiketler kaldırıldı. Kapat ardından Değiştir + Full AC ile gerçek açık kesicili, boş olmayan senaryo çözüldü: **CONVERGED_FULL_NR**. Sonuç scenarioHash tam seçili scenarioHash ile eşleşti; canonical network JSON'u değişmedi. Kaynağa dön ve B0 dönüşü doğrulandı. Özel native FID, hash/settings/control identity ve ekran görüntüleri local-benchmark-results/sld-v3/CURRENT-pointer-private-proof.json içindedir.

İlk koşu base topolojisine dönen toggle zinciriydi; tek başına açık durum sayısal kabulü sayılmadı. Nihai kanıt boş olmayan switchState içerir. Kamu E2E gerçek click/tap/Enter/Space, exact identity, STALE/null, kaynak geri dönüşü ve native immutable koşullarını ayrıca test eder.

LF/DC/N1/SC solver, model parser, hesap settings/evidence/parity kapıları değiştirilmedi. Numerik nonregresyonun kanıtı mevcut 474 test + yeni hedefli testlerdir. SLD yöntemi sonucu görüntüler; hesap başlamamış veya STALE sonucu sıfıra çevirmez. Seçili gerçek AC sonucu olmayan N-1 POST değeri üretilmez. N-1 PARTIAL ve SC IEC 2016 BLOCKED/diagnostic statüleri korunur. Yeni normative IEC/PF paritesi veya bağımsız sayısal N-1 tam kabulü iddiası yoktur.

Tam kabul kapıları ve portable ham byte eşitliği handoff belgesinde PASS olarak kapatılmıştır. Gerçek private kaynak/result dosyaları public commit'e alınmaz.

Tam E2E ilk PF heartbeat kapısında filename-only yükleme durumu görüldü. Hedefli UI düzeltmesi süre/byte göstergesini 0,0 s itibarıyla başlatır; 1 s interval, worker iptali ve yükleme sonrası recovery korunur. Testin 1100 ms kontrolü, koşulları ve sayısal eşikleri değiştirilmedi; hata mesajına tanısal durum eklendi. Solver/worker hesap kodu değişmedi.
