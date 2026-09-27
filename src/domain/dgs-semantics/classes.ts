/** Class spellings verified against dgs-source-profile.md and the existing importer. */
export const DgsSemanticDictionary: Readonly<Record<string,string>> = {
  ElmArea:'Yük Tevzi Bölgesi', ElmSite:'Trafo Merkezi', ElmSubstat:'Bara Grubu / Şalt Bölümü',
  ElmTerm:'Bara / Düğüm', ElmBay:'Fider / Bay', ElmLne:'Enerji İletim Hattı', ElmLnesec:'Hat Kesiti',
  ElmTr2:'İki Sargılı Güç Transformatörü', ElmSym:'Senkron Üretim Ünitesi', ElmGenStat:'Statik Üretim Ünitesi',
  ElmLod:'Yük', ElmShnt:'Şönt', ElmCoup:'Kesici / Kuplaj Anahtarı', StaSwitch:'Anahtar',
  StaCubic:'Hücre / Bağlantı Noktası', TypLne:'Hat Tipi', TypTr2:'Trafo Tipi', TypSwitch:'Anahtar Tipi',
  TypSym:'Senkron Ünite Tipi', Matrix:'Koordinat / Matris Verisi', ElmNet:'Şebeke', ElmZone:'Bölge',
  ElmXnet:'Harici Şebeke', ElmVac:'Uluslararası Bağlantı', ElmScap:'Seri Kompanzasyon',
  ElmStactrl:'Santral Gerilim Kontrolörü', ElmSecctrl:'İkincil Kontrolör', ElmBoundary:'Sınır',
  IntQlim:'Reaktif Güç Limit Eğrisi', IntFolder:'Klasör', IntCase:'Çalışma Durumu', IntVersion:'Model Sürümü',
  SetTime:'Model Zamanı', ComLdf:'Yük Akışı Ayarları', ComOpf:'Optimizasyon Ayarları',
  ComSimoutage:'Kesinti Analizi Ayarları', ComOutage:'Kesinti Tanımı', General:'Genel Model Bilgileri',
};
export const classLabel = (name:string):string => `${DgsSemanticDictionary[name] || 'Diğer / Teknik Veri'} (${name})`;
