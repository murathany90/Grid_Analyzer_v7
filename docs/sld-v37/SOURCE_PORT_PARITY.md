# V3.7 — kaynak sargı uçları ve kaynak yaprakları

Başlangıç: `9f555f08fd11cdd293260d6b5a3335c2e8294727`. Bağımsız denetimdeki 50 uç, ham SN3 DGS ile yeniden incelendi. Görsel onay tamamlanmadan mühendislik kabulünün bütünü için PASS iddia edilmez.

## Kayaş pilotu: bağlantı değiştirilmedi

Kaynak JSON SHA-256: `f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6`.

| Kaynak kayıt | Cubicle | Ham terminal | Canonical | İstasyon/SVG |
|---|---|---|---|---|
| T5133.bushv | ft00-13064 | B89867 | B89867 | B89867 |
| T5133.buslv | ft00-15612 | B89868 | B89868 | B89868 |
| C112442.bus1 | fc1-112442 | B89867 | B89867 | B89867 |
| C112442.bus2 | fc2-112442 | B102871 | B102871 | B102871 |

`StaCubic.obj_id` sargı cubicle'larında T5133, ayırıcı cubicle'larında C112442'dir. C112442 ham `aUsage=dct`, `on_off=1`. B102871 üzerinde yalnız `fc2-112442` vardır; sargı/hat cubicle'ı yoktur. T6415 de kendi kaynak cubicle'ıyla B89867'ye bağlıdır. Yakınlık veya ad benzerliği, ayırıcı sonuna sargı taşımak için kanıt değildir. Pilotun doğru sınıfı **RAW_SOURCE_LEAF**; bu, saha bağlantısının doğrulandığı anlamına gelmez.

## Ortak doğrulama ve gösterim

- Her sargı için raw cubicle/fold/obj, canonical terminal ve projeksiyon terminali karşılaştırılır. Eksik transformer veya değiştirilmiş port, eşleme kusuru olarak raporlanır; sayısal model sessizce düzeltilmez.
- Kaynak yaprakları `graph.issues` sayısından ayrı envanter ve durum taşır. Doğrulanmış kaynak yaprağı hata sayısını yapay olarak artırmaz; eksik kanıt `INSUFFICIENT_SOURCE/UNKNOWN` kalır.
- Eski “Bağımsız uç” metni yerine seçilebilir **Kaynak yaprağı** açıklaması, terminal FID'si ve kaynak/kalite panelinde raw kanıt vardır. Ekran altı doğrulanmış ve belirsiz yaprakları ayrı sayar.
- Bütün TM'ler aynı algoritmayı kullanır. T5133, TM adı veya örnek ID'si üretim kodunda istisna seçmez. Açık kontaklar ve gerçek bypass korunur. LF/DC/N-1/SC denklemleri değişmedi.
- Köprüler yalnız kaynak geometrisindeki adayın görünür yabancı iletkenlerde de karşılığı varsa çizilir. Gerçek kesişimler sırf hop sayısını azaltmak için gizlenmez; yoğunluk ve konum listesi ayrıca teslim edilir.

## Kanıt kapsamı

1.554 kaynak terminalli TM'de **3.700 trafo / 7.400 sargı** ham–canonical–projeksiyon eşleşmesi verdi. Bağımsız raporun 11 normal SVG'sindeki **50/50** yaprak ham DGS'de aynı sınıftadır. Bunlar sıfırlanacak hata hedefi değildir. Kayaş 9, Temelli 12 ve İç Anadolu 3 yaprağı korunur ve açıklanır. Küçükbakkalköy bankaları ayrıca denetlenir.

Yerel teslim: `local-benchmark-results/sld-v37-source/`. Ham tam model, özel fixture ve kaynak tablo önbelleği Git'e eklenmez. CSV'ler, raw pilot kaydı, gerçek SVG/PNG yakın planlar, önce/sonra/YTBS galerisi ve exact-commit CI kaydı teslim paketindedir. Yazılım kapıları ile operatörün görsel kabulü ayrı raporlanır. Main'e merge yapılmaz.
