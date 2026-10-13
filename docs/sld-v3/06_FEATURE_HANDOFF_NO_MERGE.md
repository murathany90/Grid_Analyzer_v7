# Feature teslimi · main'e otomatik geçiş yok

Dal: `fix/sld-v3-compact-v0-v4-visual-acceptance`. Başlangıç feature 1f261fb16acd61557339d5ba5e04a53b4d63830e; main eae8c08b298a505713341dd0d62a93b1d6d0da78. Kapanışta yerel/uzak main ve tag/dal envanteri tekrar doğrulanacaktır.

Geometri, kanıtlı ototrafo işlevi, V0/V4 katalog/bağımsız golden, ortak bay motoru, tüm paralel regional FID'ler, responsive overview/focus, native terminal ve bara koruması uygulanmıştır. LF/DC/N1/SC solver kodu değiştirilmemiştir. Kullanıcının untracked IEC ZIP'i ve gerçek ignored dosyaları commit'e alınmaz.

Tam kalite kapıları bu code commit sonrası çalıştırılacak: npm ci, typecheck, architecture lint, eski 474 + 44 yeni test, dört E2E, standard/portable build, portable raw HEAD byte eşitliği, offline ve exact feature CI. Kontrol başarısızsa hedefli düzeltme yapılır; test/eşik/skip değişikliğiyle gizlenmez. Nihai kapanış belgesi gerçek kapı sonuçlarıyla güncellenecektir.

P0: yeni insan görsel kabulü ve açık merge onayı PENDING; mevcut doğrulanmış sayısal motorlar korunur. P1: 13 bara fiziksel alt şablonu/eksik V0 görevleri, CT/VT kaynakları, 220 müstakil profil, yoğun full-detail ilk rota maliyeti ve mobil tam metin yoğunluğu. IEC2016/PF tam parite ve N1 tam native kapsam tamamlandı iddiası yoktur.

**MAIN: UNCHANGED. Main push/merge, dal/tag silme, force-push/reset yapılmayacaktır.**

Yetki sınırı: kullanıcının SLD_V3_Yerel_Agent_Duzeltme_ve_Kabul_Promptu.md §0: “Bu görev otomatik main merge yetkisi VERMEZ.” Aynı bölüm yeni görsel kabul + merge onayı ister. Bu paket değerlendirilip açık yeni onay verilmeden entegrasyon tamamlanmış sayılmaz.
