# SLD V2 başlangıç ve kaynak denetimi

Başlangıç ve doğrulanmış uzak main: `c8ee28b23095e021d1bae7c9438e3a1469f26b1b`. Main CI [38290018509](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38290018509): SUCCESS. Çalışma dalı: `feat/sld-v2-engineering-topology`.

`npm ci` ve başlangıç testleri: 438/438, fail/cancel/skip 0. Kullanıcının IEC ZIP'i korunur; private girdiler ve gerçek ekran görüntüleri Git'e eklenmez.

Veri zinciri: DGS katalog / CanonicalNetwork → buildStationTopologyGraph → physicalStationLayout → SvgSldRenderer. Elektriksel iletkenlik, electrical-topology ve senaryo effectiveNetwork tarafından sahiplenilir. Görsel port ve bağlantı kaydı elektriksel modeli değiştiremez. ResultStore ve mevcut N1 owner / SC kaynak kimliği sonuç katmanını besler; AppContext.select harita ve envanter kimliğini taşır.

İncelenen sözleşmeler: station-topology, network, electrical-topology, overlay, calculation identity/settings, results types/store/workspace, workspace-results, karşılaştırma ve harita loading/partition/reference kapıları. LF/DC/N1/SC motorlarının kaynak kodu değiştirilmedi.

Referans M1301 SVG: 7 tekrarlı anahtar; 6 belirsiz uç etiketi ve hatalı 0 sayacı. Eski gerçek çizim 50 kaynak anahtarın yalnız 31 farklı kimliğini içeriyordu (38 sembol). Sorun, ortak yol anahtarlarının tekrar çizilmesi ve barasız jeneratör bağlantılarının atlanmasıydı.
