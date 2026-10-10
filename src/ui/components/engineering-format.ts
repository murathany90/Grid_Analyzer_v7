const formatters=new Map<string,Intl.NumberFormat>();
/** Display only. Canonical results and export values keep their original precision. */
export function formatEngineering(value:unknown,precision=1,options:{signed?:boolean;unit?:string}={}){
  if(typeof value!=='number'||!Number.isFinite(value))return '—';const digits=Number.isFinite(precision)?Math.max(0,Math.min(8,Math.round(precision))):1,key=digits+'|'+!!options.signed;
  let formatter=formatters.get(key);if(!formatter){formatter=new Intl.NumberFormat('tr-TR',{minimumFractionDigits:digits,maximumFractionDigits:digits,signDisplay:options.signed?'exceptZero':'auto'});formatters.set(key,formatter);}
  const normalized=Math.round(Math.abs(value)*10**digits)===0?0:value;return formatter.format(normalized)+(options.unit?' '+options.unit:'');
}
