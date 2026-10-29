import {zipParts} from './archive.js';
export function xesc(v) {
  return String(v ?? "").replace(/[&<>"']/g, x => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[x]);
}
export function excelCol(n) {
  let a = "";
  for (n++; n; n = Math.floor((n - 1) / 26)) a = String.fromCharCode(65 + (n - 1) % 26) + a;
  return a;
}
export function sheetXml(columns, rows) {
  let out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols><col min="1" max="1" width="19" customWidth="1"/><col min="2" max="2" width="27" customWidth="1"/><col min="3" max="40" width="15" customWidth="1"/></cols><sheetData>'];
  const valueStyle = key => /nom\.|\bkv\b|mw\b|mvar|akım|\(a\)/i.test(key) ? 2 : /Δ|θ|°|pu|%/i.test(key) ? 3 : 4;
  const cellStyles=columns.map(key=>valueStyle(String(key??''))),columnNames=columns.map((_,i)=>excelCol(i));
  const pushRow = (values, ri, header) => {
    out.push(`<row r="${ri}"${header ? ' ht="25" customHeight="1"' : ""}>`);
    for (let i = 0; i < values.length; i++) {
      let v = values[i];
      if (v === null || v === void 0 || v === "") continue;
      const ref = columnNames[i] + ri;
      if (typeof v === "number" && Number.isFinite(v)) out.push(`<c r="${ref}" s="${header ? 1 : cellStyles[i]}"><v>${v}</v></c>`);else out.push(`<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ""}><is><t xml:space="preserve">${xesc(v)}</t></is></c>`);
    }
    out.push("</row>");
  }
  pushRow(columns, 1, true);
  for (let i = 0; i < rows.length; i++) pushRow(rows[i], i + 2, false);
  out.push("</sheetData>");
  if (rows.length) for (let i = 0; i < columns.length; i++) {
    const header = String(columns[i] ?? "");
    if (!(header.includes("\u0394") || header.includes("Fark"))) continue;
    const col = excelCol(i),
      high = header.includes("%") ? 2 : header.includes("kV") ? 1 : header.includes("\xB0") ? 0.5 : 10,
      low = header.includes("%") ? 1 : header.includes("kV") ? 0.1 : header.includes("\xB0") ? 0.05 : 1;
    out.push(`<conditionalFormatting sqref="${col}2:${col}${rows.length + 1}"><cfRule type="cellIs" dxfId="0" priority="1" operator="greaterThanOrEqual"><formula>${high}</formula></cfRule><cfRule type="cellIs" dxfId="1" priority="2" operator="greaterThanOrEqual"><formula>${low}</formula></cfRule></conditionalFormatting>`);
  }
  out.push('<autoFilter ref="A1:', excelCol(columns.length - 1), String(rows.length + 1), '"/></worksheet>');
  return out.join("");
}
export function makeWorkbook(sheets,options={}) {
  const files = [];
  const types = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
  const tabs = [];
  const rel = [];
  for (let i = 0; i < sheets.length; i++) {
    const [name, headers, rows] = sheets[i];
    const id = i + 1;
    const sn = name.slice(0, 31).replace(/[\/*?\[\]:]/g, "_");
    tabs.push(`<sheet name="${xesc(sn)}" sheetId="${id}" r:id="rId${id}"/>`);
    rel.push(`<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`);
    types.push(`<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    files.push([`xl/worksheets/sheet${id}.xml`, sheetXml(headers, rows)]);
  }
  rel.push(`<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
  types.push("</Types>");
  files.push(["[Content_Types].xml", types.join("")], ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'], ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tabs.join("")}</sheets></workbook>`], ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel.join("")}</Relationships>`], ["xl/styles.xml", '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17324B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><numFmts count="3"><numFmt numFmtId="164" formatCode="0.0"/><numFmt numFmtId="165" formatCode="0.000"/><numFmt numFmtId="166" formatCode="0.00"/></numFmts><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><dxfs count="2"><dxf><font><color rgb="FFFFFFFF"/></font><fill><patternFill patternType="solid"><fgColor rgb="FF9A2639"/></patternFill></fill></dxf><dxf><font><color rgb="FF633F00"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFFE2AA"/></patternFill></fill></dxf></dxfs></styleSheet>']);
  return new Blob([zipParts(files,options)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
