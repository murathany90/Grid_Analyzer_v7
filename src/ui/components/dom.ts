export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
let defaultDigits=2;
export const configureFormat=(digits:number)=>{defaultDigits=digits;};
export const format = (value: unknown, digits = defaultDigits): string => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value).toLocaleString('tr-TR', { maximumFractionDigits: digits }) : '—';
export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); e.className = className; if (text !== undefined) e.textContent = text; return e;
}
export function button(text: string, action: () => void, title = text): HTMLButtonElement { const b = element('button', 'ga-button', text); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.onclick = action; return b; }
export function downloadText(text: string, name: string, mime = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], {type:mime})), a = element('a'); a.href=url; a.download=name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(v: unknown): string {
  if(typeof v==='number')return '"'+(Number.isFinite(v)?String(v).replace('.',','):'')+'"';
  let s=String(v??'');
  if(/^[\s\u0000-\u001f\u007f]*[=+@-]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
export const csvDocument=(rows:readonly (readonly unknown[])[]):string=>'\uFEFFsep=;\r\n'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
