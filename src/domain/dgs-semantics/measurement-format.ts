/** Presentation only. Precision is retained by raw cell titles and exports. */
export function formatWorkspaceNumber(value:unknown,unit='',integer=false):string {
 if(typeof value!=='number'||!Number.isFinite(value))return '—';
 const digits=integer?0:1,abs=Math.abs(value),tiny=!integer&&abs>0&&abs<0.05;
 const options:Intl.NumberFormatOptions=tiny?{minimumSignificantDigits:2,maximumSignificantDigits:3,notation:abs<1e-6?'scientific':'standard'}:{minimumFractionDigits:digits,maximumFractionDigits:digits};
 return (value===0?0:value).toLocaleString('tr-TR',options)+(unit?' '+unit:'');
}
export function measurementSpec(key:string):{unit:string;integer?:boolean}|null {
 if(['nntap','ncapa','ncapx','context.connectedEquipmentCount'].includes(key))return{unit:'',integer:true};
 const units:Record<string,string>={plini:'MW',qlini:'MVAr',pgini:'MW',qgini:'MVAr',Pload:'MW',Qload:'MVAr',Pmin_uc:'MW',Pmax_uc:'MW',q_min:'MVAr',q_max:'MVAr',uknom:'kV',uline:'kV',utrn_h:'kV',utrn_l:'kV',usetp:'pu',strn:'MVA',dline:'km',sline:'kA',rline:'Ω/km',xline:'Ω/km',bline:'µS/km',qrean:'MVAr',qcapn:'MVAr','context.voltageKv':'kV','context.lvKv':'kV','context.ratingMva':'MVA'};
 if(/^operating\.(source|scenario|lf)[PQ]$/.test(key))return{unit:key.endsWith('P')?'MW':'MVAr'};
 return Object.hasOwn(units,key)?{unit:units[key]}:null;
}
