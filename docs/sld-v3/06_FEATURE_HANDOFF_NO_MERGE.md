# Feature kapanışı · main'e otomatik geçiş yok

2026-10-13. Dal `fix/sld-v3-compact-v0-v4-visual-acceptance`.

- Kabul edilen runtime kod SHA: `3b577f1a5c39e266b7693e72e061b8dff605cffb`.
- Aynı kod SHA'sının CI'ı: [SUCCESS](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38382070534); typecheck, lint, tüm testler, dört browser smoke, iki build ve CI portable raw-byte kapısı başarılı.
- Güncel yerel/uzak main: `eae8c08b298a505713341dd0d62a93b1d6d0da78`. [Main CI SUCCESS](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38316940700).
- Portable SHA-256: `3cde3fcaaef4fa6579253d9aa0395b69974ea945520b7b2dbfc05e3edac26906`; 1,757,023 byte; LF-only; dosya ve git HEAD blob'u birebir aynı.
- Kapanış yalnız belge commitidir. Son belge HEAD SHA/CI'ı ayrıca doğrulanır ve nihai teslim mesajında kaydedilir; runtime/portable byte'ları değişmez.

| Yerel kabul kapısı | Sonuç |
|---|---|
| npm ci / typecheck / architecture lint | PASS |
| Mevcut 474 + yeni 44 birim/regresyon | **518/518 PASS**, skip 0 |
| Browser / PF benchmark / map-lightning / SLD | Dört kontrol PASS; yatay bay/focus sonrası SLD hedefli kontrolü ayrıca PASS |
| Standard / portable build | PASS |
| Portable raw HEAD bytes / LF | PASS |
| Portable offline PF browser | PASS; harici ağ istekleri engellendi |
| Offline karşılaştırma HTML | PASS: yerel resimler, filtreler, zoom, eksik referans modlarının açık statüsü |
| Gerçek source render / envanter | 153 fider + 546 native anahtar; atılan 0 |
| Gerçek 5 TM / tüm fiziksel ve fider SVG denetimi | 343 ölçüm; glyph overlap 0 / başka gövdeden geçen tel 0 (bara dahil) |
| Gerçek pointer / manevra / Full AC / B0 | PASS; boş olmayan açık kesici senaryosu, CONVERGED_FULL_NR, exact identity, canonical immutable |

190 aday PNG/SVG çifti, 120 MAIN ve 45 BASE çifti local ignored pakettedir. c8ee28b'nin beş eksik modu NOT_AVAILABLE; başarı gibi kopyalanmaz. Native kaynak/result ve kullanıcının untracked IEC ZIP'i public commit'e alınmamıştır.

M56/M38 dahil overview/focus, yerel N satırları, port/bara koruması, 0–3 bend + visibility fallback, gerçek i_auto kanıtı, ortak bay motoru, yatay/dikey bay ve koordinat dönüşümlü focus, tüm paralel regional FID'ler uygulanmıştır. Sayısal solver/worker kodu değiştirilmedi. Yükleme UI göstergesi ilk frame'de gerçek süre/byte bilgisini verir; 1 s güncelleme, 1100 ms test koşulu ve iptal/recovery korunur. Başarısızlık gizlenmedi, test silinmedi/skip yapılmadı veya eşik gevşetilmedi.

Kapsam: 30/30 fider, 13/13 bara, 22/22 sembol durum kataloğu/matrisi **%100**. Bu oran tam fiziksel V0 normatif kabul oranı değildir. Native oto/standart 2W ayrımı DGS i_auto ile kanıtlanır; tam 30 fider / 13 bara alt cihaz şablon kabulü tamamlanmadı. CT/VT, ayırıcı kumanda/toprak görevleri ve 220 müstakil profil verisi eksiktir. N1 PARTIAL, SC IEC2016 BLOCKED/diagnostic/parite kapıları korunur; yeni IEC/PF tam parite iddiası yoktur.

P0: insan görsel kabulü ve ayrı açık merge onayı **PENDING**. P1: eksik V0 alt tip/cihaz kaynakları, exact 13 bara şablonu, 220 profil, yoğun ilk tüm fiziksel rota maliyeti ve mobil tam etiket yoğunluğu. M56 390px'de tüm işaretler görünse de yaklaşık 6px özet FID tam okunabilirlik/touch hedefi olarak kabul edilmez; seçim/tooltip/focus/zoom gerekir.

Silinen dal/tag: **YOK**. Main ve mevcut tag korundu. Kalan uzak dallar:
- `codex/analysis-v7-evidence-hardening`
- `feat/analysis-ui-native-n1-iec60909-2016`
- `feat/engineering-n1-iec60909-validation`
- `feat/sld-v2-engineering-topology`
- `fix/sld-v2-ytbs-layout-switching-regressions`
- `fix/sld-v3-compact-v0-v4-visual-acceptance`
- `main`

**MAIN: UNCHANGED.** Main push/merge, dal/tag silme, force-push/reset yapılmadı.

Yetki sınırı: kullanıcının SLD_V3_Yerel_Agent_Duzeltme_ve_Kabul_Promptu.md §0: “Bu görev otomatik main merge yetkisi VERMEZ.” Aynı bölüm yeni görsel kabul + merge onayı ister. İnsan kabulü CI veya otomatik geometri ölçümüne indirgenemez.
