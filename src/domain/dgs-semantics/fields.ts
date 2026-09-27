/** Labels/units only for fields already interpreted by the DGS mapper; unknowns remain raw. */
export const FieldSemantic: Readonly<Record<string,string>> = {
  FID:'Teknik kimlik',loc_name:'Ad',fold_id:'Üst kaynak kaydı',typ_id:'Tip referansı',
  uknom:'Nominal gerilim (kV)',uline:'Hat tipi gerilimi (kV)',utrn_h:'YG gerilimi (kV)',utrn_l:'AG gerilimi (kV)',
  pgini:'P başlangıç (MW)',qgini:'Q başlangıç (MVAr)',plini:'P yük (MW)',qlini:'Q yük (MVAr)',
  Pload:'Aktif güç girdisi (MW)',Qload:'Reaktif güç girdisi (MVAr)',usetp:'Gerilim set değeri (pu)',
  nntap:'Kademe pozisyonu',outserv:'Servis durumu',on_off:'Anahtar pozisyonu',dline:'Hat uzunluğu (km)',
  strn:'Nominal güç (MVA)',sline:'Nominal akım (kA)',rline:'Direnç (Ω/km)',xline:'Reaktans (Ω/km)',
  bline:'Süseptans (µS/km)',fline:'Kapasite çarpanı',qrean:'Reaktör gücü (MVAr)',qcapn:'Kapasitör gücü (MVAr)',
  ncapa:'Etkin şönt kademe sayısı',ncapx:'Şönt kademe sınırı',rembar:'Uzak bara referansı',psym:'Bağlı ünite referansları',
  bus1:'Birinci uç hücresi',bus2:'İkinci uç hücresi',bushv:'YG uç hücresi',buslv:'AG uç hücresi',obj_id:'Bağlı ekipman referansı',
};
export const fieldLabel=(field:string):string=>FieldSemantic[field]||field;
export function semanticValue(field:string,value:unknown):string {
  if(value==null||value==='')return '—';
  if(field==='outserv'&&(value===0||value===1||typeof value==='boolean'))return Number(value)===1?'Servis dışı':'Serviste';
  if(field==='on_off'&&(value===0||value===1||typeof value==='boolean'))return Number(value)===1?'Kapalı':'Açık';
  if(typeof value==='object')return JSON.stringify(value);
  return String(value);
}
