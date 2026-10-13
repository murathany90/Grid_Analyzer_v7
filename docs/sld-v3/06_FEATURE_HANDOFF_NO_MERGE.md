# Kart teslimi reddinden sonra feature düzeltmesi

2026-10-13. Dal: fix/sld-v3-compact-v0-v4-visual-acceptance. Önceki bc003644 tesliminin default kart görünümü kullanıcı tarafından reddedildi. Eski CI SUCCESS ve 518 test, o çıktının tek hat çizimi olduğunu kanıtlamadı; görsel kabul iddiası geri çekildi.

Düzeltme runtime kod commit'i: ffd23f1. Main eae8c08b298a505713341dd0d62a93b1d6d0da78 olarak korunur. Main merge/push, dal/tag silme, force-push/reset yok. Nihai belge HEAD'i ve aynı HEAD'in feature CI sonucu teslim mesajında/yerel kapanış kanıtında ayrıca doğrulanır; CI insan görsel onayının yerine geçmez.

Portable SHA-256: 9f1ab09d3910ee6031e0cbc29db4dd8c4c4c02525b56014d4059b04d9dd1c256. Kaynak build'i ve git HEAD blob'u byte düzeyinde eşleşir; LF-only. Belge commit'i runtime/portable byte'larını değiştirmez.

| Kontrol | Güncel durum |
|---|---|
| Typecheck / architecture lint | PASS |
| Tam birim / sayısal regresyon / portable HEAD byte kapısı | 518/518 PASS; skip 0 |
| Hedefli SLD browser / V3 public matrix | PASS |
| Standard ve portable build | PASS |
| Beş gerçek TM, dört viewport, yedi mod | 50 render PASS; 546/546 fiziksel anahtar ve 153/153 fider |
| Gerçek DOM metin/glyph overlap / başka glyph içinden geçen tel | 0 / 0 / 0 |
| Yeni native mühendislik hesabı / model importu | YAPILMADI; mevcut sonuç snapshot'ı kullanıldı |
| Nihai exact feature CI | Push sonrası teslimde doğrulanacak |
| İnsan görsel kabulü | PENDING; önceki kart teslimi REJECTED |

Yeni görsel inceleme: local-benchmark-results/sld-v3-connected-correction/REVIEW.html. Eski işaret edilen CANDIDATE M56 PNG yolu yeni tam sayfa çizimidir; eski kart REJECTED-CARD önekiyle saklanır. SVG bağlı native sayfadır. İlk sayfada okunabilir çizim, uzun merkezlerde kaydırma; Sığdır tüm sayfa, Okunabilir ölçek geri dönüşüdür. Mobilden belgeyi taşırmadan doğal sayfa genişliğinde kaydırılır.

Kaynakta bulunmayan CT/VT, kumanda/toprak görevi, 220 bağımsız profil ve tam V0 alt tip kanıtı eksik kalır. 30/30 fider, 13/13 bara ve 22/22 sembol durum kataloğu tam fiziksel şablon kabulü değildir. LF/N1/SC motoru ve kanıt kapıları korunur; IEC/PF tam parite iddiası yoktur.

Yetki sınırı: kullanıcının SLD_V3_Yerel_Agent_Duzeltme_ve_Kabul_Promptu.md §0 otomatik main merge yetkisi vermez; yeni insan görsel kabulü ve ayrı merge onayı gerekir. Feature düzeltmesi ve doğrulaması tamamlanır; main'e otomatik geçilmez.
