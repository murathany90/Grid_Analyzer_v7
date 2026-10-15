/** Presentation only: preserve the complete source name in titles/audit records. */
export function localDeviceName(name:string,station:string):string {
 const value=name.trim(),prefix=station.trim();
 return prefix&&value.slice(0,prefix.length).toLocaleUpperCase('tr-TR')===prefix.toLocaleUpperCase('tr-TR')&&/^[\s_-]/.test(value.slice(prefix.length))?value.slice(prefix.length).replace(/^[\s_-]+/,''):value;
}
export function feederCaption(name:string,station:string,kv:number):string {
 let value=localDeviceName(name,station).replace(/^\d+(?:[.,]\d+)?\s*kV\s*/i,'').replace(/ EIH FIDERI$/,'');
 // Some source ElmBay names encode the decimal separator implicitly (336/345).
 // Restore that notation only in a low-voltage coupler caption, never in data.
 if(kv>0&&kv<=36)value=value.replace(/^(\d{2})(\d)(\s+Kuplaj\b)/i,(all,a,b,tail)=>Number(`${a}.${b}`)<=36?`${a},${b}${tail}`:all);
 return value;
}
export function windingCaption(name:string,station:string):boolean {
 return /^(?:BANK|G?TR)[- .]*[\p{L}\d]+\s+(?:PR(?:IMER)?|SEK(?:ONDER)?)(?:\.|\s|$)/iu.test(localDeviceName(name,station));
}
/** Word-based two-line label; keep overlong source words accessible in the title. */
export function captionLines(name:string,limit=18):string[] {
 const words=name.trim().split(/\s+/),rows:string[]=[];let row='';
 for(const word of words){if(row&&row.length+word.length+1>limit){rows.push(row);row=word;}else row+=(row?' ':'')+word;}
 if(row)rows.push(row);const shorten=(s:string)=>s.length>limit?s.slice(0,limit-1)+'…':s;
 return rows.length<=2?rows.map(shorten):[shorten(rows[0]),shorten(rows.slice(1).join(' '))];
}
/** Natural rail order at every voltage; source spelling and FIDs stay intact. */
export function mvBarOrder(name:string):number {
 const value=name.toLocaleUpperCase('tr-TR').replace(/[–—_]/g,'-');
 if(/(?:^|[\s-])B[\s.-]*T(?:$|[\s.-]|[A-Z])/u.test(value))return 10000;
 const section=value.match(/(?:^|[\s-])(?:TR|BARA|TB|B)[\s.-]*(\d+|[A-Z])(?=$|[\s().-]|[A-Z\d])/u)?.[1]
  ??value.match(/(?:^|[\s-])([A-Z])\s+BARASI\b/u)?.[1];
 return section?(/^\d+$/.test(section)?Number(section)-1:section.charCodeAt(0)-65):1000;
}
