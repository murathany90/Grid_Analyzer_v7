# SLD_HANDOFF
- **Branch:** `fix/psse-sld-roundtrip-ui-v2`
- **Native CArchive Serializer:** Köprüsüz `serializeSldBinary()` tamamlandı; PSS®E 36.5 (v2.0.51.1 & v2.0.49.3) tam binary yazımı sağlandı.
- **Geometrik Parite (T1-T3):** Kayseri #100 taşıma (0.2,-0.2)->(1.7,0.55), ortogonal knee ekleme, Sincan TM (73 sym/77 link/427 label) ve Ankara 708 (416 sym/218 link/1704 label) %100 parite ile PSS®E 36.5 GUI'de test edilip doğrulandı.
- **0 Symbol / 0 Link Parser Hatası:** `CSldLayer` (21/22 ObList) ve `CSldPointNode` v51 yapı farkları çözüldü, tüm nesneler eksiksiz okunuyor.
- **UI & Ayarlar (T4):** Modal gövde yüksekliği 480px sabitlendi, Dışa Aktar menüsü z-index:100000 ile öne alındı, showBusId varsayılanı false yapıldı, Grupla/Grubu Çöz (Ctrl+G) ve bara popup eklendi.
- **Oturum Kalıcılığı:** IndexedDB (`GridAnalyzer_SLD_Store`) ile gaSld, native byte'lar ve modelHash tam saklanıyor.
- **Güvenlik (T5):** `psse_sld_converter.py` HTTP bridge için 50 MB payload sınırı eklendi.
- **Build & Test:** `python tools/psse-sld/generate_studio_bundle.py && npx tsc --noEmit && npm run build:portable`
