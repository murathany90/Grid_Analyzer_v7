import {zipSync,strToU8} from 'fflate';
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
function column(index){let result='';for(index++;index;index=Math.floor((index-1)/26))result=String.fromCharCode(65+(index-1)%26)+result;return result;}
export function sheetXml(rows){
  return declaration+'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((row,r)=>`<row r="${r+1}">`+row.map((value,c)=>{const ref=column(c)+(r+1);if(value==null)return `<c r="${ref}"/>`;if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"><v>${value}</v></c>`;if(typeof value==='boolean')return `<c r="${ref}" t="b"><v>${Number(value)}</v></c>`;return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')+'</row>').join('')+'</sheetData></worksheet>';
}
export function createWorkbook(sheets){
  const used=new Set(),names=sheets.map((sheet,i)=>{const base=String(sheet.name||'Sheet'+(i+1)).replace(/[\\/?*\[\]:]/g,' ').slice(0,31)||'Sheet';let name=base,suffix=1;while(used.has(name.toLowerCase())){const tail=' '+ ++suffix;name=base.slice(0,31-tail.length)+tail;}used.add(name.toLowerCase());return name;});
  const contentTypes=declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>';
  const workbook=declaration+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+names.map((name,i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>';
  const relationships=declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+'</Relationships>';
  const files={'[Content_Types].xml':strToU8(contentTypes),'xl/workbook.xml':strToU8(workbook),'xl/_rels/workbook.xml.rels':strToU8(relationships),'_rels/.rels':strToU8(declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')};
  sheets.forEach((sheet,i)=>files[`xl/worksheets/sheet${i+1}.xml`]=strToU8(sheetXml(sheet.rows)));
  // Fixed ZIP timestamps keep byte-for-byte portable builds/exports reproducible.
  return zipSync(files,{level:6,mtime:new Date(2000,0,1)});
}
