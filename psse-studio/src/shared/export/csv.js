/** Shortest round-trip decimal; Excel's Turkish locale uses a decimal comma. */
export function comparisonCsv(headers,rows){
  const cell=value=>{
    if(value==null||typeof value==='number'&&!Number.isFinite(value))return '""';
    if(typeof value==='number')return '"'+String(value).replace('.',',')+'"';
    let text=String(value);if(/^[=+@\t\r]/.test(text)||/^(?:\d{1,2}[-/]\d{1,2}|\d{4}[-/]\d{1,2})[-/]\d{1,4}$/.test(text))text='\t'+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(';')).join('\r\n');
}
