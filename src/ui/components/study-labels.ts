import {n1CaseOutcome} from '../../analysis/contingency-hybrid/case-summary';
/** Presentation only. API/export/status attributes retain their original technical codes. */
export function n1CaseLabel(status:string){const outcome=n1CaseOutcome(status);return outcome==='skipped'?'Atlandı / Çözülemedi':outcome==='partial'?'Tanısal · Kısmi':outcome==='success'?'Başarılı':compactStudyLabel(status);}
export function n1CountsLabel(c:{success:number;partial:number;skipped:number;pending:number;cancelled:number}){return `Başarılı ${c.success} · kısmi ${c.partial} · atlanan ${c.skipped} · bekleyen ${c.pending}`+(c.cancelled?` · iptal ${c.cancelled}`:'');}
const labels:Record<string,string>={
  SC_BATCH_NETWORK_APPROXIMATION:'Toplu ağ yaklaşımı sonuçları',SC_BATCH_BLOCKED:'Toplu hesap — tüm arızalar bloke',SC_BATCH_PARTIAL:'Toplu hesap — kısmi veya iptal edilmiş kayıtlar',PARTITION_AMBIGUOUS:'Elektriksel bölüm eşleşmesi belirsiz',CANCELLED:'Hesap iptal edildi',
  ENGINE_CALCULATED:'Sayısal sonuç üretildi',SOURCE_VERIFIED:'Kaynak doğrulandı',METHOD_VERIFIED:'Yöntem doğrulandı',NETWORK_APPROXIMATION:'Ağ yaklaşımı',CALCULATED_NETWORK_APPROXIMATION:'Ağ yaklaşımı hesaplandı',EXPLORATORY_ONLY:'Yalnız tanısal kullanım',BLOCKED:'Kanıt eksik — hesap bloke',NOT_CALCULATED:'Henüz hesaplanmadı',NOT_RUN:'Henüz çalıştırılmadı',STALE_RESULT:'Güncel olmayan sonuç',PARTIAL:'Kısmi doğrulama',PARTIAL_SOLUTION:'Kontrol veya ada doğrulaması kısmi',CONTROL_VERIFIED:'Kontrol davranışı doğrulandı',CONTROL_FIDELITY_PARTIAL:'Kontrol doğruluğu kısmi',UNSUPPORTED_CONTROL_CONFIGURATION:'Kontrol desteği eksik',SOURCE_BOUNDED:'Kaynak sınırları mevcut',PARTIAL_SOURCE_FIDELITY:'Kaynak sınırları eksik',ADAPTER_FIELDS_PRESENT:'Adapter alanları mevcut',SOURCE_UNAVAILABLE:'Kaynak verisi yok',SOURCE_IDENTITY_UNVERIFIED:'Kaynak kimliği doğrulanmadı',PF_REFERENCE_ONLY:'Yalnız PF referansı',
  powerFlow:'Tam AC yük akışı',fastAc:'Hızlı yaklaşık AC',dc:'DC tarama',DC:'DC tarama — yalnız aktif güç',HYBRID:'DC tarama → seçili Full AC',MANUAL_FULL_AC:'Seçili vaka Full AC',HYBRID_FULL_AC:'Hibrit çalışma Full AC',HYBRID_RUN:'Hibrit çalışma',GA_DC_SCREEN:'DC aktif güç taraması',GA_POSITIVE_SEQUENCE_3PH_MAX:'3PH MAX ağ yaklaşımı',GA_POSITIVE_SEQUENCE_3PH_MIN:'3PH MIN ağ yaklaşımı',GA_IEC60909_2016_PREFLIGHT:'IEC 2016 ön kontrolü — bloke',
};
export const studyLabel=(code:string)=>labels[code]??'Teknik durum — ayrıntılara bakın';
/** Short table labels; the original code and reason remain in the row details. */
export function compactStudyLabel(code:string){
  if(/ISLAND_UNSUPPLIED/.test(code))return 'Beslenmiyor';
  if(/THERMAL_LIMIT/.test(code))return 'Aşırı yük';
  if(/VIOLATION/.test(code))return 'İhlal';
  if(/ISLANDING/.test(code))return 'Ada';
  if(/UNSCREENABLE/.test(code))return 'Taranamadı';
  if(/CAPACITY_UNAVAILABLE/.test(code))return 'Kapasite yok';
  if(/RISK_WARNING/.test(code))return 'Yüksek yük';
  if(/STALE/.test(code))return 'Güncel değil';
  if(/BLOCKED|UNSUPPORTED|NOT_COMPUTABLE|AMBIGUOUS/.test(code))return 'Bloke';
  if(/NOT_RUN|NOT_CALCULATED/.test(code))return 'Çalıştırılmadı';
  if(/CANCELLED/.test(code))return 'İptal';
  if(/DIVERGED|NOT_CONVERGED/.test(code))return 'Yakınsamadı';
  if(/PARTIAL/.test(code))return 'Kısmi';
  if(/APPROXIMATION/.test(code))return 'Yaklaşık';
  if(/PF_REFERENCE_ONLY/.test(code))return 'PF referansı';
  if(/CONVERGED|CALCULATED/.test(code))return 'Hesaplandı';
  if(/DC|SCREEN/.test(code))return 'DC tarama';
  return studyLabel(code);
}
export const studyStatusHelp=(code:string)=>`${studyLabel(code)} (${code}). Sayısal sonuç; kaynak, kontrol, normatif yöntem ve PF karşılaştırması için ayrı kanıt gerektirir.`;
