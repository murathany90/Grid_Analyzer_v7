# Beş gerçek istasyon · ALL-VIEW görsel kabul paketi

SN3 ZIP SHA-256 `854b098802a0a6c4a45c03b9702fd9b891225dc96c876781a283c488ccc607a7`; canonical model hash `f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6`. KALE JES kaynak site ID'si **M1555**. M1583 Hotamış, M1301 İç Anadolu DGKÇ, M56 Davutpaşa, M38 Koyluköy aynı mevcut B0 sonucu/settings ile görüntülendi. Yeni import veya analiz render kabulüne dahil değildir.

Aday: 155 PNG + SVG çiftinde 5 TM × 3 kapsam × 7 mod, dört viewport ve 7 modda tüm fiziksel istasyon ayrıntısı; ayrıca 153 fiderin gerçek DOM ölçümü. Toplam **308 ölçüm satırı**. MAIN 120 çift; BASE 45 çift. c8ee28b'de LF/N1/SC/işletme/compact modları yoktur: NOT_AVAILABLE/MODE_NOT_IMPLEMENTED_IN_REFERENCE, başarılı ekran gibi kopyalanmaz. Aynı fider odağında üç sürüm de kaynak fixture'ın ilk native FID'sini seçer; farklı fider P95'leri karşılaştırılmaz.

Genel bakış: 22+19+69+35+8=153 native fider işareti; atılan 0, işaret overlap 0, SVG dışı işaret 0, document yatay taşma 0. Native cihaz anahtarları data-represented-keys/title içinde tutulur; küçük marker fiziksel elektriksel sembol gibi sunulmaz. Tüm voltajlar source değerleriyle, 220 profili yoksa UNSPECIFIED_BY_V4 etiketiyle kalır. LF/N1/SC yöntem/faz/statüsü overview footer'ında ayrıca görünür.

Aday station/bay/region: YTBS, teknik, LF, N1, SC, işletme, kompakt ve SVG export. 1366×768, 1440×900, 1920×1080, 390×900 default fit kaydedildi. Kısıtlı mobil yoğunluğu 02 belgesinde açıklanmıştır. İki gerçek açık/kapalı kesici golden ve boş olmayan açık senaryo Full AC kanıtı ayrı dosyadadır.

Offline paket: `local-benchmark-results/sld-v3/COMPARE_ALL.html`. TM/kapsam/mod/viewport filtresi, üçlü görüntü, zoom, eşleştirilmiş kaydırma, SVG bağlantıları ve metrik paneli. Source/reference/result artefaktları ignored/private'dır; public repo'ya taşınmamıştır.

Dosyalar:
- `M1583`: `CANDIDATE-M1583-station-ytbs-1440.png` / `.svg`; diğer sürümler BASE/MAIN önekiyle.
- `M1301`: `CANDIDATE-M1301-station-ytbs-1440.png` / `.svg`; diğer sürümler BASE/MAIN önekiyle.
- `M56`: `CANDIDATE-M56-station-ytbs-1440.png` / `.svg`; diğer sürümler BASE/MAIN önekiyle.
- `M38`: `CANDIDATE-M38-station-ytbs-1440.png` / `.svg`; diğer sürümler BASE/MAIN önekiyle.
- `M1555`: `CANDIDATE-M1555-station-ytbs-1440.png` / `.svg`; diğer sürümler BASE/MAIN önekiyle.

Kullanıcı promptunda anılan image(20261013-065453).png ve image(20261013-065543).png özgün yerel dosyaları bulunamadı: SOURCE_UNAVAILABLE. Yüklenen Hotamış/İç Anadolu örnekleri ve yerel V0/V4 kaynakları referans olarak kullanıldı; bulunamayan görüntüye FID veya sayısal hata isnat edilmedi.

**Otomatik geometrik kabul PASS, insan görsel kabulü PENDING. CI PASS mühendislik fiziksel çizim onayı yerine geçmez.** Tam V0 fiziksel alt tipleri, kapama motoru/toprak görevi, CT/VT ve 220 profili kanıtı eksiktir.

Native anahtar envanteri: 546/546 genel bakışta temsil edilir. M38’de native ElmBay sahibi olmayan tek gerçek anahtar ayrı bağımsız kaynak işaretiyle tutulur; ona sahte fider eklenmez. 153 fider sayısı değişmez. Tüm istasyon fiziksel ayrıntısında bu anahtarın gerçek kontakları da vardır.
