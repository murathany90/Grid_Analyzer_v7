/** Local wall-clock time and Unicode names, safe for Windows and browser downloads. */
export function sldExportFilename(site:{name:string;id:string}|null|undefined,extension:'svg'|'png',now=new Date()):string {
  const safe=(value:string,fallback:string)=>value.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/g,'').slice(0,120)||fallback;
  const pad=(value:number)=>String(value).padStart(2,'0');
  return `${safe(site?.name??'','TM')}(${safe(site?.id??'','TM')})_${pad(now.getDate())}.${pad(now.getMonth()+1)}.${pad(now.getFullYear()%100)}_${pad(now.getHours())}${pad(now.getMinutes())}.${extension}`;
}
