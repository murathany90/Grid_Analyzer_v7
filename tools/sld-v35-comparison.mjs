/** Offline V3.3 / V3.4 / V3.5 station comparison. One self-contained HTML file, no network. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const pkg='docs/tek_hat_ornekleri/SLD_V35_YENI_AGENT_DEVIR_PAKETI',out=resolve('local-benchmark-results/sld-v35');
await mkdir(out,{recursive:true});
const stations=[['M937','KARAPINAR','M937_KARAPINAR'],['M1482','KAYAS','M1482_KAYAS'],['M890','TEMELLI','M890_TEMELLI']];
const rows=JSON.parse(await readFile(resolve(out,'layout-private.json'),'utf8'));
const metrics=JSON.parse(await readFile(resolve(out,'metrics-private.json'),'utf8')).rows;
const esc=(s)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const cell=(id,label,file,note)=>`<figure><figcaption>${label} — ${esc(note)}</figcaption><div class="frame">${file}</div><small>${esc(id)}</small></figure>`;
const read=async(f)=>{try{return await readFile(f,'utf8');}catch{return '<p>Eksik</p>';}};
let body='';
for(const [id,name,tag]of stations){const r=rows[id],m=metrics.find(x=>x.id===id);
 const v33=await read(resolve(pkg,`svg/${tag}_V33.svg`)),v34=await read(resolve(pkg,`svg/${tag}_V34.svg`)),v35=await read(resolve(out,`AFTER-${id}.svg`));
 const strip=(s)=>s.replace(/<svg([^>]*)>/,(_,a)=>'<svg'+a.replace(/style="[^"]*"/,'').replace(/width="100%"/,'width="100%"').replace(/height="\d+"/,'height="760"')+'>');
 body+=`<h2>${name} (${id})</h2><p class="m">V3.5 kutusal ölçüm: ${r.width}×${r.height} · ray ${r.rails.length} · en uzun ray ${Math.max(...r.rails.map((x)=>x.length))} · fider ${r.feeders} · fiziksel anahtar ${r.switches} · bara-içi atlama ${m?.barHops} · sahte ray ${m?.duplicateBars} · devam rayı ${m?.continuation} · yalancı ray teması ${m?.falseRail} · çakışma ${m?.visual.overlaps.length} · metin hatası ${m?.visual.textErrors.length}</p><div class="grid">${cell(id,'V3.3',strip(v33),'referans karşılaştırma')}${cell(id,'V3.4',strip(v34),'regresyon')}${cell(id,'V3.5',strip(v35),'yeni')}</div>`;}
const table=['station,V3.3 width,V3.4 width,V3.5 width,V3.3 rails,V3.4 rails,V3.5 rails,V3.5 longest rail,V3.5 barHops,V3.5 feeders,V3.5 switches',
 ...stations.map(([id])=>{const r=rows[id];const v33=metrics.find(x=>x.id===id);return `${id},,,"${id}",,${r.width},,,${Math.max(...r.rails.map((x)=>x.length))},${metrics.find(x=>x.id===id)?.barHops},${r.feeders},${r.switches}`;})].join('\n');
await writeFile(resolve(out,'SLD_V33_V34_V35_KARSILASTIRMA.html'),`<!doctype html><html lang="tr"><meta charset="utf-8"><title>SLD V3.3 / V3.4 / V3.5 karşılaştırma</title><style>body{font:13px system-ui;margin:16px;background:#fff;color:#182833}h2{margin:24px 0 4px}.m{color:#526676;margin:0 0 8px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0;border:1px solid #c9d3d9;padding:6px}figcaption{font-weight:600;margin-bottom:4px}.frame{height:760px;overflow:auto;background:#fff}.frame svg{width:100%;height:auto}small{color:#526776}</style><body><h1>Grid Analyzer v7 — SLD V3.3 / V3.4 / V3.5 gerçek SVG karşılaştırması</h1>${body}<h2>Başa yüklenen CSV</h2><pre>${esc(table)}</pre></body></html>`);
console.log('written',resolve(out,'SLD_V33_V34_V35_KARSILASTIRMA.html'));