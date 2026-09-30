import type { ModelQualityCategory, ModelQualityFinding, ModelQualitySeverity } from '../../domain/model-quality';
import type { N1CandidateStatus } from '../../domain/n1';

export const severityOrder: readonly ModelQualitySeverity[] = ['BLOCKER', 'ERROR', 'WARNING', 'INFO'];
export const severityLabels: Record<ModelQualitySeverity, string> = {
  BLOCKER: 'Engelleyici', ERROR: 'Hata', WARNING: 'Uyarı', INFO: 'Bilgi',
};
export const categoryLabels: Record<ModelQualityCategory, string> = {
  TOPOLOGY: 'Topoloji', ELECTRICAL_DATA: 'Elektriksel Veri', CAPACITY: 'Kapasite',
  CONTROLLER: 'Kontrolör', REDUCED_MODEL: 'İndirgenmiş Model', PROVENANCE: 'Kaynak İzlenebilirliği',
};
export const n1StatusLabels: Record<N1CandidateStatus, string> = {
  ISLANDING: 'İndirgenmiş ağda ada ayrılması',
  SCREENED_VIOLATION: 'Tahmini limit aşımı',
  SCREENED_NO_VIOLATION: 'DC taramasında ihlal görülmedi',
  CAPACITY_UNAVAILABLE: 'Kapasite bilgisi yetersiz',
  UNSCREENABLE: 'Taranamıyor',
};

const qualityDescriptions: Record<string, readonly [string, string, string]> = {
  BUS_VN_INVALID: ['Geçersiz Bara Gerilimi', 'Baranın nominal gerilimi geçersiz.', 'Bu bara için gerilim bazı güvenilir biçimde oluşturulamaz.'],
  LINE_R_INVALID: ['Geçersiz Hat Direnci', 'Hat direnci geçersiz.', 'Güç akışı modelinde hat empedansı hatalı veya eksik olabilir.'],
  LINE_X_INVALID: ['Geçersiz Hat Reaktansı', 'Hat reaktansı pozitif ve sonlu olmalıdır.', 'Mevcut güç akışı ve DC modelleri pozitif reaktans gerektirir.'],
  LINE_LENGTH_INVALID: ['Geçersiz Hat Uzunluğu', 'Hat uzunluğu geçersiz.', 'Elektriksel parametreler fiziksel uzunluğu yansıtmayabilir.'],
  LINE_CAPACITY_UNAVAILABLE: ['Hat Kapasitesi Yok', 'Kullanılabilir hat kapasitesi bulunamadı.', 'Bu hattın termik yüklenmesi ve limit aşımı değerlendirilemez.'],
  LINE_ENDPOINT_UNRESOLVED: ['Hat Ucu Çözümlenemedi', 'Hat uçlarından biri ağ topolojisinde bulunamadı.', 'Hat elektriksel topolojide temsil edilmeyebilir.'],
  TRANSFORMER_R_INVALID: ['Geçersiz Trafo Direnci', 'Trafo direnci geçersiz.', 'Trafo empedansı hatalı veya eksik olabilir.'],
  TRANSFORMER_X_INVALID: ['Geçersiz Trafo Reaktansı', 'Trafo reaktansı pozitif ve sonlu olmalıdır.', 'Trafo empedansı hatalı veya eksik olabilir.'],
  TRANSFORMER_TAP_INVALID: ['Geçersiz Trafo Tapı', 'Trafo tap oranı geçersiz.', 'Gerilim dönüşüm oranı hatalı modellenebilir.'],
  TRANSFORMER_RATING_INVALID: ['Geçersiz Trafo Gücü', 'Trafo nominal gücü geçersiz.', 'Trafo yüklenmesi güvenilir biçimde değerlendirilemez.'],
  TRANSFORMER_ENDPOINT_UNRESOLVED: ['Trafo Ucu Çözümlenemedi', 'Trafo uçlarından biri ağ topolojisinde bulunamadı.', 'Trafo elektriksel topolojide temsil edilmeyebilir.'],
  GENERATOR_Q_LIMITS_MISSING: ['Üretici Q Limitleri Yok', 'Üreticinin reaktif güç limitleri eksik.', 'Reaktif limitler bu ünite için uygulanamaz.'],
  GENERATOR_Q_LIMITS_REVERSED: ['Üretici Q Limitleri Ters', 'Qmin, Qmax değerinden büyük.', 'Üreticinin reaktif çalışma aralığı tutarsız.'],
  GENERATOR_VM_SET_INVALID: ['Geçersiz Üretici Gerilim Hedefi', 'Üreticinin gerilim hedefi geçersiz.', 'Gerilim kontrol hedefi hatalı olabilir.'],
  REFERENCE_VM_SET_INVALID: ['Geçersiz Referans Gerilimi', 'Referans kaynağının gerilim hedefi geçersiz.', 'Referans baranın gerilim hedefi hatalı olabilir.'],
  CONTROLLER_REMOTE_UNRESOLVED: ['Uzak Kontrol Barası Çözümlenemedi', 'Kontrolörün uzak barası bulunamadı.', 'Uzak gerilim kontrolü eşlenemez.'],
  CONTROLLER_UNIT_UNRESOLVED: ['Kontrol Ünitesi Çözümlenemedi', 'Kontrolörün bağlı üretici ünitesi bulunamadı.', 'Kontrol katılımı ve reaktif dağıtımı eksik kalır.'],
  CONTROLLER_Q_LIMITS_UNAVAILABLE: ['Kontrolör Q Limitleri Yok', 'Bağlı ünitelerden en az birinin Q limiti yok.', 'Kontrolörün reaktif dağıtımı ünite limitleriyle sınırlandırılamaz.'],
  MATERIAL_PROVENANCE_MISSING: ['Kaynak Referansı Yok', 'Önemli elektriksel verinin kaynak alanı belirtilmemiş.', 'Değer kaynak dosyadaki alana kadar izlenemez.'],
  ISLAND_WITHOUT_REFERENCE: ['Referans Kaynağı Olmayan Ada', 'Bu elektrik adasında referans kaynak bulunamadı.', 'Bu ada için güç akışı çözülemez.'],
  ISLAND_MULTIPLE_REFERENCES: ['Birden Fazla Referans Kaynağı', 'Elektrik adasında birden fazla referans kaynak var.', 'Aktif güç dengeleme semantiği yalnız kısmen belirlenmiş.'],
  CONTROLLER_REMOTE_NO_REFERENCE: ['Kontrol Adasında Referans Yok', 'Kontrolörün bulunduğu adada referans kaynak yok.', 'Bu adanın güç akışı referansı tanımlı değil.'],
  CONTROLLER_DUPLICATE_UNIT_OWNERSHIP: ['Çakışan Kontrol Ünitesi', 'Bir ünite birden fazla kontrolöre atanmış.', 'Reaktif kontrol sahipliği belirsiz olabilir.'],
  CONTROLLER_LOCAL_VOLTAGE_CONFLICT: ['Gerilim Kontrolü Çakışması', 'Yerel ve uzak gerilim kontrolü çakışıyor.', 'Birden fazla kontrolör uyumsuz gerilim hedefi isteyebilir.'],
  REDUCED_MODEL_INPUTS_EXCLUDED: ['İndirgenmiş Modelde Dışlanan Girdiler', 'Bazı güç enjeksiyonları indirgenmiş modele alınamadı.', 'İndirgenmiş sonuç tüm etkin enjeksiyonları içermez.'],
  SERIES_COMPENSATION_UNRESOLVED: ['Seri Kompanzasyon Çözümlenemedi', 'Bazı seri kompanzatörler indirgenmiş modelde temsil edilemedi.', 'İndirgenmiş dal reaktansı seri kompanzasyonu içermeyebilir.'],
};

export function qualityPresentation(finding: ModelQualityFinding): { title: string; message: string; impact: string } {
  const [title, message, impact] = qualityDescriptions[finding.code] ?? ['Model Bulgusu', 'Model verisi incelenmeli.', 'Hesaplama etkisi için kaynak veri kontrol edilmeli.'];
  return { title, message, impact };
}
