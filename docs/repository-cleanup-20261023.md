# Repo dokümantasyon ve temizlik — 23.10.2026

Taban `main/87343a3360ce4f28a9bed06437a94601ac166596`; dal `feature/repository-docs-cleanup`. Hesap motoru, uygulama sürümü ve SLD algoritmaları değiştirilmedi. README kullanıcı ZIP’inden alındı, güncel runner/yüklenme bazı/offline kapsamı ve belge yolları düzeltildi. ZIP içeriği veri girdisidir; raporlardaki eski agent talimatları yeni görev kapsamını genişletmez.

## Taşınan izlenen dosyalar

- `GRID_ANALYZER_V7_VERAGRID_DERIVED_DEVELOPMENT_PROMPT.md` → `docs/history/GRID_ANALYZER_V7_VERAGRID_DERIVED_DEVELOPMENT_PROMPT.md`
- `VERAGRID_GRID_ANALYZER_DGS_LOADFLOW_COMPARISON.md` → `docs/history/VERAGRID_GRID_ANALYZER_DGS_LOADFLOW_COMPARISON.md`
- `docs/final-report.md` → `docs/history/migration/final-report.md`
- `docs/checkpoints.md` → `docs/history/migration/checkpoints.md`
- `docs/v6.8-feature-inventory.md` → `docs/history/migration/v6.8-feature-inventory.md`
- `docs/v6.8-to-v7-regression.md` → `docs/history/migration/v6.8-to-v7-regression.md`
- `docs/v7.0.1-stabilization.md` → `docs/history/migration/v7.0.1-stabilization.md`
- `docs/analysis-v7/01_BASELINE_AUDIT.md` → `docs/history/analysis-v7/01_BASELINE_AUDIT.md`
- `docs/analysis-v7/02_UI_UX_IMPLEMENTATION.md` → `docs/history/analysis-v7/02_UI_UX_IMPLEMENTATION.md`
- `docs/analysis-v7/03_NATIVE_N1_METHOD.md` → `docs/history/analysis-v7/03_NATIVE_N1_METHOD.md`
- `docs/analysis-v7/04_IEC60909_2016_METHOD.md` → `docs/history/analysis-v7/04_IEC60909_2016_METHOD.md`
- `docs/analysis-v7/05_PF_GA_VALIDATION.md` → `docs/history/analysis-v7/05_PF_GA_VALIDATION.md`
- `docs/analysis-v7/06_PERFORMANCE_BENCHMARK.md` → `docs/history/analysis-v7/06_PERFORMANCE_BENCHMARK.md`
- `docs/analysis-v7/07_FINAL_ACCEPTANCE.md` → `docs/history/analysis-v7/07_FINAL_ACCEPTANCE.md`
- `docs/analysis-v7/08_INDEPENDENT_AUDIT_FIXES.md` → `docs/history/analysis-v7/08_INDEPENDENT_AUDIT_FIXES.md`
- `docs/analysis-v7/09_ENGINEERING_BASELINE_AUDIT.md` → `docs/history/analysis-v7/09_ENGINEERING_BASELINE_AUDIT.md`
- `docs/analysis-v7/10_NATIVE_N1_CONTROL_VALIDATION.md` → `docs/history/analysis-v7/10_NATIVE_N1_CONTROL_VALIDATION.md`
- `docs/analysis-v7/11_IEC60909_IMPLEMENTATION_AND_EVIDENCE.md` → `docs/history/analysis-v7/11_IEC60909_IMPLEMENTATION_AND_EVIDENCE.md`
- `docs/analysis-v7/12_PF_NUMERICAL_COMPARISON.md` → `docs/history/analysis-v7/12_PF_NUMERICAL_COMPARISON.md`
- `docs/analysis-v7/13_UI_PERFORMANCE_ACCEPTANCE.md` → `docs/history/analysis-v7/13_UI_PERFORMANCE_ACCEPTANCE.md`
- `docs/analysis-v7/14_FINAL_ENGINEERING_ACCEPTANCE.md` → `docs/history/analysis-v7/14_FINAL_ENGINEERING_ACCEPTANCE.md`
- `docs/analysis-v7/15_MAIN_MERGE_RECORD.md` → `docs/history/analysis-v7/15_MAIN_MERGE_RECORD.md`
- `docs/MAIN_INTEGRATION_ACCEPTANCE_20261010.md` → `docs/history/ui/MAIN_INTEGRATION_ACCEPTANCE_20261010.md`
- `docs/MAP_DESKTOP_TOOLTIP_LIGHTNING_ACCEPTANCE_20261011.md` → `docs/history/ui/MAP_DESKTOP_TOOLTIP_LIGHTNING_ACCEPTANCE_20261011.md`
- `docs/MAP_LF_VOLTAGE_FREEZE_ISLAND_LOADING_ACCEPTANCE_20261011.md` → `docs/history/ui/MAP_LF_VOLTAGE_FREEZE_ISLAND_LOADING_ACCEPTANCE_20261011.md`
- `docs/MAP_LOADING_LIGHTNING_N1_SC_MAIN_ACCEPTANCE_20261011.md` → `docs/history/ui/MAP_LOADING_LIGHTNING_N1_SC_MAIN_ACCEPTANCE_20261011.md`
- `docs/MAP_SCENARIO_ANALYSIS_REPORT.md` → `docs/history/ui/MAP_SCENARIO_ANALYSIS_REPORT.md`
- `docs/MAP_UI_ACCEPTANCE_20261010.md` → `docs/history/ui/MAP_UI_ACCEPTANCE_20261010.md`
- `docs/UI_MIGRATION_REPORT.md` → `docs/history/ui/UI_MIGRATION_REPORT.md`
- `docs/DIgSILENT_ElmStactrl_Aktif_Reaktif_Guc_Oturum_Referansi.md` → `docs/reference/DIgSILENT_ElmStactrl_Aktif_Reaktif_Guc_Oturum_Referansi.md`
- `docs/rust-wasm-roadmap.md` → `docs/roadmaps/rust-wasm-roadmap.md`
- `docs/tauri-roadmap.md` → `docs/roadmaps/tauri-roadmap.md`

## Silinen dosyalar ve kanıt

- `control1/README.md`: Removed obsolete fixture-directory placeholder; private kontrol1 inventory replaces it.
- `docs/migration-plan.md`: Unreferenced obsolete initial plan; architecture and current README supersede it.
- `docs/v7.0.2-stabilization.md`: No inbound code/CI/doc references; obsolete release synopsis, complete original remains in linked Git history.
- `docs/v7.0.3-stabilization.md`: No inbound code/CI/doc references; obsolete release synopsis, complete original remains in linked Git history.
- `docs/MAP_SCENARIO_PF_SCORECARD.csv`: Byte-identical duplicate of MAIN_INTEGRATION_PF_SCORECARD_20261010.csv; preserve canonical CSV and redirect links.

`tests/`, `tools/`, `docs/` izlenen envanterinde boş dosya yoktu. Tek bayt-eşit tekrar CSV yukarıda birleştirildi. Testler, sentetik fixture’lar, manuel/opt-in araçlar ve SLD golden/negatif denetimleri korundu. Bir aracın CI’da çağrılmaması tek başına kullanılmadığını kanıtlamaz; bu nedenle araç veya test silinmedi. Tarihsel sayısal kabul kanıtları referanssız olsa bile gelişi güzel kaldırılmadı. Eski sürüm özetleri dışında geçmiş raporlar indeksli arşivde korunur.

## Yerel veri ve araç davranışı

Özel envanter yalnız `kontrol1/KONTROL1_TEST_VERI_ENVANTERI.md` içine kondu. Dört gerçek ZIP’in önce/sonra hash denetimi yerel raporda tutulur; model/PF dosyaları değiştirilmez. İki önceden Git dışı kök V7.5/V7.6 raporu içerikleri korunarak yok sayılan `docs/history/local/` altına taşındı. Yerel eski envanter varsa değiştirmeden önce Git dışı yedeği saklanır. Bu özel dosyalar stage edilmez.

`test:full` dinamik çalışma adlarıyla yalnız model ZIP’i seçer; PF ZIP’i kullanılmaz. Boyut/CRC/güvenli ZIP yolu ve DGS şeması denetlenir. Filtre eşleşmemesi, eksik kaynak ve LFS pointer SKIP; keşif modu NOT_RUN; tüm sayısal modların gerçek yakınsaması PASS; hata/yakınsamama FAIL. Sonuç JSON’u `local-benchmark-results/` altında yereldir. REQUIRE_MODELS=1 ile SKIP exit 2 olur. Eski sayısal baseline araçları yalnız açık LEGACY_MODEL_JSON yoluyla çalışır; yeni model eski çalışma yerine sessizce konmaz.

## Doğrulama

Typecheck ve mimari lint PASS; 719/719 unit/regression PASS (mevcut 712 + 7 yeni). Sekiz bileşenli tam E2E zinciri exit 0. Normal/portable build ve unit içindeki LF/raw-byte/determinism kapıları PASS; portable SHA256 `2b46f6da4f7489c351cfed018b503df5025758b5231f965d544e6f7c109ab57f`, HEAD blobuyla ham bayt eşitliği korundu. Son belge/link sıkılaştırması sonrası yedi hedefli test tekrar PASS. Kamu Markdown dosya hedeflerinde ve 11 fragment bağlantısında hata yok; özel artifact bağlantısı artık kamu linki gibi sunulmuyor. Büyük gerçek model benchmark’ı çalıştırılmadı; --list iki gerçek model ZIP’ini NOT_RUN olarak buldu ve PASS sayısı 0. Strict eksik-model exit 2 testi geçti. E2E’nin yeniden yazdığı altı izlenen görsel eski baytlarıyla geri kondu; bu PR ekran görseli değiştirmez. GitHub’da bulunmayan yedi tarihsel özel ekran bağlantısı, dosya adı korunarak açık yerel kanıt metnine çevrildi; bozuk resim/indirilebilir kamu linki gibi sunulmaz. Silme/taşıma sonrası linkler ve eski kod yolları yeniden taranır; lint özel dizinlerin yanlışlıkla izlenmesini engeller.

Yerel test logları: `local-benchmark-results/repository-docs-{typecheck,lint,unit,e2e,build,portable,discovery}.log`. Ayrıntılı dosya/hakiki ZIP hash envanteri `local-benchmark-results/repository-docs-layout.json` içinde Git dışında kalır.
