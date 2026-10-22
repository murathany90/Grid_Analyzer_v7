# Analizler çalışma alanı — uygulanan sunum tasarımı

Kaynak şartnameler: kullanıcı tarafından verilen `GridAnalyzer_Analizler_UI_Sadelestirme_Coding_Agent_Promptu_20261022.md` ve `GridAnalyzer_Analizler_UI_UX_Tasarim_Dokumani_20261022.md`. Taban PR #8, `d95e50206673fc80a3189db5b6c142c7af262f11`.

## Tek sonuç sahibi

`runEvidence` aynı güncel ailenin çalışma sayıları/kimliği/süresidir. `selectedCaseEvidence` mevcut seçili vaka kanıtını korur. Seçili vaka veya PF görünümü toplam GA sayısını değiştirmez. Hiç çalışmamış aile başka ailenin COMPLETE durumunu alamaz. Korunan aile kaydı kendi süresiyle etiketlenir. JSON kopyaları nesne adresine göre değil sonuç kimliğine göre kapsam denetimine girer.

Mevcut model, senaryo, ayar, kapsam, profil, kaynak ve MAX/MIN geçerlilik kapıları kullanılır. Yeni kalıcı sonuç deposu yoktur. Saf sunum satırları ve görünümdeki geçici sıralama/arama/sayfalama durumu hesap sonuçlarını değiştirmez.

## Birincil akış

Üç aile sekmesi → ortak YTM/TM/gerilim/profil → bir Analiz Et → çalışma durumu/KPI → tam genişlikte liste. N1-only/SC-only Worker ayrımı korunur. Birlikte çalıştırma, eski tek-vaka/DC/hibrit/SC araçları ve eski ayrıntılı tablolar yalnız kapalı **Gelişmiş araçlar** diyaloğundadır. Mevcut legacy factory ve API'ler kaldırılmadı.

- LF: Hatlar / Trafolar / Baralar. Hat FROM, trafo fiziksel HV, bara kV ve ≥66 kV. P/Q/yük hücrelerinde GA/PF/Δ; dar masaüstünde metrik seçimi. Delta mevcut karşılaştırma/kimlik kapısından gelir; native GA projeksiyonu aynı değilse fark null kalır.
- N-1: Kesinti, kV, DC, AC, maks. yük, >%100 etkilenen, detay. AC varsa aynı vakanın AC değeri, yoksa `~DC`; eksik değer sıfır olmaz. Aşırı yüklenen ekipman görünümü yöntem + vaka + ekipman anahtarıyla türetilir. AC/DC/PF kayıtları detayda ayrı listelerdir; PF seyrek extrema tam POST matrisi değildir.
- SC: TM, bara/FID, kV, GA Ikss, PF Ikss, Δ, detay. Elektriksel bara başına bir satır; fiziksel aliaslar detayda. Özet listesi >66 kV; tüm gerilimlerde hesaplanan özgün sonuçlar/tam JSON ve gelişmiş araçlar korunur. MAX/MIN mevcut kayıt çiftine işaret eder. PF MIN yoksa PF ve fark null kalır. Alt küme tanısı sertifika değildir.

## Okunabilirlik ve ayrıntı

Ana listede sabit 6–7 sütun, tam genişlik, normal kelime kırılması, iki satırlık ad ve tam başlık/title bulunur. Üretim listesi ham `recordHeaders()` ile sütun üretmez. 50 satır sayfalama, Türkçe metadata araması ve sayısal/null-sonda sıralama kullanılır. ≤767 px satır kartlarıdır. Eski 1200/1320 px geniş tablolar yeni ana listede kullanılmaz.

Bir ana sayfa kaydırması vardır. Açık native dialog kendi kaydırmasını kullanır. Enter ayrıntıyı açar, Escape yalnız diyaloğu kapatır ve odağı geri verir; analizi iptal etmez. Haritada göster caseId/faultId/FID ve SC modunu korur.

CSV/XLSX/JSON aynı filtreli tam alanları dışa aktarır; 50 satırlık DOM sınırı export sınırı değildir. Tam çalışma JSON özgün hesap nesnelerini ve elde bulunan matrisleri korur. Detayda ilk 20 POST kaydı gösterilir; olmayan matris üretilmez. Ayrıntı JSON'u ve mevcut cache yüklemesi korunur.

## Doğruluk sınırı

AC sayısal ≠ AC verified; DC ≠ Full AC; yaklaşık SC ≠ IEC verified; missing ≠ zero. Proje baskısı yalnız **IEC 60909-0:2016**. Solver, parametreler, Worker hesap protokolü ve fiziksel kabul kapıları değiştirilmedi. 9 sekmeli yeni Excel raporu P1 olarak ertelendi; mevcut tam exportlar korunur. Kabul ve kanıtlar `analysis-workspace-ui-acceptance-20261022.md` dosyasındadır.
