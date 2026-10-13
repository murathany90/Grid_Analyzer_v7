# SLD V3 · V0/V4 kaynak ve kapsam

2026-10-13. Kaynak listesi ve tip durumu ayrı kavramlardır. **30/30 fider, 13/13 bara ve 22/22 sembol katalog/matris kapsamı %100**. 30 açık beyanlı sentetik tipte ad/bileşen koruması test edilir; bu, 30 gerçek fiziksel şablonun doğrulandığı anlamına gelmez. Gerçek örneklerde oto / standart iki sargı ayrımı DGS i_auto ile doğrulanır. Bu iki cihaz türü, 30 V0 fiderin tam fiziksel şablon kabul yüzdesi değildir; tüm alt cihazlarıyla doğrulanmış V0 fider şablon sayısı 0/30 kalır. 13 bara tipinin tamamının exact V0 şekil/alt cihaz şablonu doğrulanmış değildir (0/13 tam şablon kabulü); kaynak graph görüntüsü kullanılmaktadır.

V4 sayfa 1, V0 altı çalışma sayfası esas alınmıştır. Bağımsız expected tablo tests/helpers/sld-v3-source-golden.ts içinde ayrı tutulur; expected konumlar physicalStationLayout sonucundan üretilmez.

| Gerilim | Native işlev | Öncelikli slotlar |
|---|---|---|
| 400 | Hat | 1A–7A |
| 400 | Kanıtlı oto / oto bank primer | 1B–3B |
| 400 | Kuplaj / transfer | 4B–5B |
| 400 | Normal primer trafo | 6B–7B |
| 154/66 | Gelen trafo | 1A–3A, 6A–7A |
| 154/66 | Hat | 4A–5A, 4B–7B |
| 154/66 | Primer trafo | 1B–3B |
| MV | Gelen / çıkış | 2 üst, 14 alt; 8 native bara düzeni/blok |
| 220 | Kaynak V4 profili yok | UNSPECIFIED_BY_V4 |

Kaynak 33,6/34,5/17/11 kV değerleri dönüştürülmez. Rezerve cihazlar önce yerleşir, overflow yeni blokta tutulur. BANK'ın gerçek işlevi bilinmiyorsa oto glyph üretilmez. HAT+... ve TRANSFER+KUPLAJ tek hat rolüne düşürülmez; gerçek bileşenleri korunur. M56 ortak primerde oto+normal trafo içerir; bu bir BANK kanıtı sayılmaz.

| V0 fider çeşidi | Kaynak | Uygulanabilirlik / kanıt |
|---|---|---|
| BANK | ÇİZİM KURALLARI!C22:F22 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| BANK OTOTRANSFORMATÖR | ÇİZİM KURALLARI!C23:F23 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| BANK TRANSFORMATÖR | ÇİZİM KURALLARI!C24:F24 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| BARA YÜKSELTME/BÖLÜMLEYİCİ | ÇİZİM KURALLARI!C25:F25 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| BARA YÜKSELTME/BÖLÜMLEYİCİ + ÖLÇÜ | ÇİZİM KURALLARI!C26:F26 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| GRUP | ÇİZİM KURALLARI!C27:F27 | PARTIAL: native jeneratör; V0 işlev/alt tür kanıtı yok |
| HAT | ÇİZİM KURALLARI!C28:F28 | PARTIAL: ElmLne bağlantısı korunur; hat/kablo/yedek işlevi teyitsiz |
| HAT + GRUP | ÇİZİM KURALLARI!C29:F29 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| HAT+BANK | ÇİZİM KURALLARI!C30:F30 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| HAT+BANK+OTOTRANSFORMATÖR | ÇİZİM KURALLARI!C31:F31 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| HAT+OTOTRANSFORMATÖR | ÇİZİM KURALLARI!C32:F32 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| HAT+REAKTÖR | ÇİZİM KURALLARI!C33:F33 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| HAT+TRANSFORMATÖR | ÇİZİM KURALLARI!C34:F34 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| KABLO | ÇİZİM KURALLARI!C35:F35 | PARTIAL: ElmLne bağlantısı korunur; hat/kablo/yedek işlevi teyitsiz |
| KAPASİTÖR | ÇİZİM KURALLARI!C36:F36 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| KAPASİTÖR BANK | ÇİZİM KURALLARI!C37:F37 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| KUPLAJ | ÇİZİM KURALLARI!C38:F38 | PARTIAL: native bara-bağlantı yolu; transfer/işlev beyanı yok |
| OTOPRODÜKTÖR | ÇİZİM KURALLARI!C39:F39 | PARTIAL: native jeneratör; V0 işlev/alt tür kanıtı yok |
| OTOTRANSFORMATÖR | ÇİZİM KURALLARI!C40:F40 | DOCUMENTED_DGS_FUNCTION: i_auto=1/0; kaynak sargılar korunur |
| ÖLÇÜ | ÇİZİM KURALLARI!C41:F41 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| ÖLÇÜ+BARA TOPRAK | ÇİZİM KURALLARI!C42:F42 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| REAKTÖR | ÇİZİM KURALLARI!C43:F43 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| TRANSFER | ÇİZİM KURALLARI!C44:F44 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| TRANSFER+KUPLAJ | ÇİZİM KURALLARI!C45:F45 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| TRANSFORMATÖR | ÇİZİM KURALLARI!C46:F46 | DOCUMENTED_DGS_FUNCTION: i_auto=1/0; kaynak sargılar korunur |
| TRANSFORMATÖR GRUP | ÇİZİM KURALLARI!C47:F47 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| YARDIMCI KAYNAK | ÇİZİM KURALLARI!C48:F48 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| YARDIMCI SERVİS | ÇİZİM KURALLARI!C49:F49 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| YARDIMCI SERVİS + ÖLÇÜ | ÇİZİM KURALLARI!C50:F50 | NOT_AVAILABLE gerçek işlev kanıtı; sentetik açık beyan / native bileşenler korunur |
| YEDEK HAT/KABLO | ÇİZİM KURALLARI!C51:F51 | PARTIAL: ElmLne bağlantısı korunur; hat/kablo/yedek işlevi teyitsiz |

| V0 bara sistemi | Kaynak | Uygulanabilirlik |
|---|---|---|
| (ÜÇ) BARALI SİSTEM | ÇİZİM KURALLARI!C57 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| BARASIZ SİSTEM | ÇİZİM KURALLARI!C58 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| BİR BUÇUK KESİCİLİ SİSTEM | ÇİZİM KURALLARI!C59 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| BYPASSLI TEK BARALI SİSTEM | ÇİZİM KURALLARI!C60 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| ÇİFT BARA + TRANSFER BARALI SİSTEM | ÇİZİM KURALLARI!C61 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| ÇİFT BARALI SİSTEM | ÇİZİM KURALLARI!C62 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| KARE BARA SİSTEMİ | ÇİZİM KURALLARI!C63 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| PARÇALI ÇİFT BARA + TRANSFER BARALI SİSTEM | ÇİZİM KURALLARI!C64 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| PARÇALI ÇİFT BARALI SİSTEM | ÇİZİM KURALLARI!C65 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| PARÇALI TEK BARA + TRANSFER BARALI SİSTEM | ÇİZİM KURALLARI!C66 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| PARÇALI TEK BARALI SİSTEM | ÇİZİM KURALLARI!C67 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| TEK BARA + TRANSFER BARALI SİSTEM | ÇİZİM KURALLARI!C68 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |
| TEK BARALI SİSTEM | ÇİZİM KURALLARI!C69 | SOURCE_GRAPH_ONLY; tüm native bölümler/bağlantılar korunur. Tam V0 fiziksel sistem şablonu ve gerçek tip beyanı NOT_AVAILABLE. |

| V0 kod | İşlev | Eşleme / sınır |
|---|---|---|
| KE-01 | KESİCİ | ElmCoup/StaSwitch aUsage=cbk; iki kontak, kaynak açık/kapalı durumu |
| AY-01 | AYIRICI | aUsage=dct ile genel ayırıcı; motor/kumanda/toprak görev alt türü NOT_AVAILABLE |
| AY-02 | AYIRICI | aUsage=dct ile genel ayırıcı; motor/kumanda/toprak görev alt türü NOT_AVAILABLE |
| AY-03 | AYIRICI | aUsage=dct ile genel ayırıcı; motor/kumanda/toprak görev alt türü NOT_AVAILABLE |
| AY-04 | AYIRICI | aUsage=dct ile genel ayırıcı; motor/kumanda/toprak görev alt türü NOT_AVAILABLE |
| AT-01 | AKIM TRANSFORMATÖRÜ | NOT_AVAILABLE: gerekli kaynak cihazı/alt türü olmadan yerleştirilmez |
| GT-01 | GERİLİM TRANSFORMATÖRÜ | NOT_AVAILABLE: gerekli kaynak cihazı/alt türü olmadan yerleştirilmez |
| GT-02 | GERİLİM TRANSFORMATÖRÜ | NOT_AVAILABLE: gerekli kaynak cihazı/alt türü olmadan yerleştirilmez |
| TK-01 | HAT TIKACI | NOT_AVAILABLE: gerekli kaynak cihazı/alt türü olmadan yerleştirilmez |
| PF-01 | PARAFADR | NOT_AVAILABLE: gerekli kaynak cihazı/alt türü olmadan yerleştirilmez |
| TR-01 | TRANSFORMATÖR | ElmTr2/TypTr2 ve bushv/buslv → StaCubic.fold_id; i_auto oto işlevini doğrular. TR01/02 vektör grubu, TR04 grup/TR05 mobil alt şekil tam şablonu NOT_AVAILABLE |
| TR-02 | TRANSFORMATÖR | ElmTr2/TypTr2 ve bushv/buslv → StaCubic.fold_id; i_auto oto işlevini doğrular. TR01/02 vektör grubu, TR04 grup/TR05 mobil alt şekil tam şablonu NOT_AVAILABLE |
| TR-03 | TRANSFORMATÖR | ElmTr2/TypTr2 ve bushv/buslv → StaCubic.fold_id; i_auto oto işlevini doğrular. TR01/02 vektör grubu, TR04 grup/TR05 mobil alt şekil tam şablonu NOT_AVAILABLE |
| TR-04 | TRANSFORMATÖR | ElmTr2/TypTr2 ve bushv/buslv → StaCubic.fold_id; i_auto oto işlevini doğrular. TR01/02 vektör grubu, TR04 grup/TR05 mobil alt şekil tam şablonu NOT_AVAILABLE |
| TR-05 | TRANSFORMATÖR | ElmTr2/TypTr2 ve bushv/buslv → StaCubic.fold_id; i_auto oto işlevini doğrular. TR01/02 vektör grubu, TR04 grup/TR05 mobil alt şekil tam şablonu NOT_AVAILABLE |
| RE-01 | REAKTÖR | Native shunt/seriesCompensator tutulur; doğrulanmamış shtype enumundan reaktör/kapasitör türü uydurulmaz |
| RE-02 | REAKTÖR | NOT_AVAILABLE: gerekli kaynak cihazı/alt türü olmadan yerleştirilmez |
| ND-01 | NÖTR DİRENÇ | NOT_AVAILABLE: gerekli kaynak cihazı/alt türü olmadan yerleştirilmez |
| KB-01 | KAPASİTÖR BANK | Native shunt/seriesCompensator tutulur; doğrulanmamış shtype enumundan reaktör/kapasitör türü uydurulmaz |
| KB-02 | KAPASİTÖR BANK | Native shunt/seriesCompensator tutulur; doğrulanmamış shtype enumundan reaktör/kapasitör türü uydurulmaz |
| YS-01 | YARDIMCI SERVİS TRANSFORMATÖRÜ | NOT_AVAILABLE: gerekli kaynak cihazı/alt türü olmadan yerleştirilmez |
| GR-01 | GRUP | Native ElmSym/ElmAsm; genel jeneratör işareti, exact V0 alt şablon PARTIAL |

D0–D6'nin elektriksel düğümleri native ElmTerm FID'lerinden gelir. A01/A02/A03/ABK görevi veya CT/VT/koruma bulunmadığında uydurma cihaz eklenmez. StaCubic gerçek ekipman ucu ve terminal bağıdır. iorder mevcut yerel DGS belgesinde seri cihaz sırası olarak tanımlanmadığından SOURCE_ORDER_UNAVAILABLE kalır.

Kaynak SHA-256:
- Tek Hat Şeması Çizim Kuralları_T30.10.2024_V4.pdf: `b94c0504f85a66c54eb08091be03f8cac6cdd6631a07c77c71b2d9058932328f`
- Tek Hat Şeması Çizim Kuralları_T28.03.2024_V0.xlsx: `7689bbf892ba8c88d7c43c5f0074d89df4f5be12a7b20c8c3e7b3673c574c301`
- DIgSILENT DGS_Documentation.pdf s.61 B.1.8 (ElmTr2.i_auto): `3d099845f11a2cd450cd4cfbe7fe563d58b78e291d4cf11051dd4d6076140468`. s.66 StaSwitch on_off/iUse açıklaması; iorder seri sırası tanımı bulunmadı.
