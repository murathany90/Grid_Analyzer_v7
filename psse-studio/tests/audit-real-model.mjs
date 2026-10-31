// Optional read-only local acceptance. Private inputs/outputs remain in ignored directories.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {unzipSync,strFromU8} from 'fflate';
import {assertCanvasMoves} from './flow-pixels.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(root,'psse-studio/evidence/audit');
const sav=process.env.PSSE_SAV??path.join(root,'control1/20261014_1200_SN3_TR0.sav');
const refs=process.env.PSSE_SLD_DIR??path.join(root,'control1/sld örnekleri');
const current=process.env.PSSE_PORTABLE??path.join(root,'psse-studio/dist/Grid_Analyzer_PSSE_Portable.html');
const baseline=process.env.PSSE_BASELINE??path.join(root,'dist/Grid_Analyzer_PSSE_Portable.html');
await fs.mkdir(path.join(out,'native'),{recursive:true});
const report={tests:[],nativeGui:'SKIPPED: user requested manual licensed PSS/E 36.5 reopen; no Computer Use',versions:[]};
if(process.env.PSSE_AUDIT_RESUME==='1')report.versions=JSON.parse(await fs.readFile(path.join(out,'acceptance.json'),'utf8')).versions.filter(v=>v.label==='before');
const browser=await chromium.launch({headless:true});
report.browserVersion=browser.version();
try{
 for(const [label,artifact]of [['before',baseline],['after',current]]){
  if(label==='before'&&report.versions.some(v=>v.label==='before'))continue;
  const context=await browser.newContext({viewport:{width:1702,height:842},offline:true,acceptDownloads:true}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  const entry={label,artifact};report.versions.push(entry);page.setDefaultTimeout(30000);
  await page.goto(pathToFileURL(artifact).href);await page.locator('#pse-file').setInputFiles(sav);
  await page.waitForFunction(()=>psseStudio.controller.psseNetwork&&!psseStudio.controller.busy,null,{timeout:60000});
  entry.source=await page.evaluate(()=>({sha:psseStudio.controller.psseInspection.source.sha256,buses:psseStudio.controller.psseNetwork.buses.length}));assert.equal(entry.source.buses,6851);
  assert.equal(await page.locator('#subtabs [data-subs]').count(),17);
  for(let i=0;i<17;i++){await page.locator(`#subtabs [data-subs="${i}"]`).click();assert(await page.locator('#grid-head th').count()>0);}
  await page.locator('#subtabs [data-subs="0"]').click();
  let downloadIndex=0;
  const download=async selector=>{const pending=page.waitForEvent('download',{timeout:90000});await page.locator(selector).click();const d=await pending,p=path.join(out,label+'-'+(++downloadIndex)+'-'+d.suggestedFilename());await d.saveAs(p);return fs.readFile(p);};
  const csv=await download('#export-csv');assert(csv.subarray(0,3).equals(Buffer.from([239,187,191])));const rows=csv.toString('utf8').split('\r\n');assert.equal(rows.length,6852);assert(rows[1].includes('160.76772555593575'));entry.csv={bytes:csv.length,rows:rows.length-1,bom:true,sourcePrecision:true};
  if(label==='after'){await page.getByLabel('CSV sayı biçimi',{exact:true}).selectOption('tr');const tr=await download('#export-csv');assert(tr.toString('utf8').includes('160,76772555593575'));await page.getByLabel('CSV sayı biçimi',{exact:true}).selectOption('invariant');}
  const xlsx=unzipSync(await download('#export-xlsx')),workbook=strFromU8(xlsx['xl/workbook.xml']),names=[...workbook.matchAll(/<sheet name="([^"]+)"/g)].map(m=>m[1]);assert.equal(names.filter(n=>/-ND-/.test(n)).length,17);assert.equal(names.filter(n=>/-NR-/.test(n)).length,11);
  entry.excel={sheets:names.length,cells:{}};
  for(const section of ['ND','NR']){
   const index=names.findIndex(n=>new RegExp('^01-'+section+'-','i').test(n)),xml=strFromU8(xlsx[`xl/worksheets/sheet${index+1}.xml`]);
   for(const cell of section==='ND'?['A2','E2','F2']:['A2','C2','D2']){const fragment=xml.match(new RegExp(`<c r="${cell}"[^>]*>[\\s\\S]*?<\\/c>`))?.[0];assert(fragment);const type=fragment.includes('inlineStr')?'string':'number';entry.excel.cells[section+'-'+cell]={type,fragment};if(label==='after')assert.equal(type,'number');}
  }
  entry.tableSearch=await page.evaluate(()=>{
   const input=document.querySelector('#filter'),samples=[],matches={};
   for(let pass=0;pass<3;pass++)for(const query of ['REYHANLI','393221','MARDIN','__NOT_FOUND__','']){const start=performance.now();input.value=query;input.dispatchEvent(new Event('input',{bubbles:true}));samples.push(performance.now()-start);matches[query]=document.querySelector('[data-page=current]').textContent;}
   samples.sort((a,b)=>a-b);return {cpuMs:{p50:samples[Math.floor(samples.length*.5)],p95:samples[Math.floor(samples.length*.95)]},matches};
  });
  await page.locator('[data-route=map]').click();assert.equal(await page.locator('.ga-v11-voltage input[type=checkbox]').count(),5);
  if(label==='after'){
   const filter=page.locator('.ga-psse-map .ga-psse-filter-menu');await filter.locator('summary').click();
   const owner=filter.getByLabel('BM / Bus OWNER filtresi',{exact:true}),before=await page.locator('.ga-psse-geo-link').count();
   await owner.selectOption('708');assert(await page.locator('.ga-psse-geo-link').count()<before);await owner.selectOption('');await filter.locator('summary').click();
   entry.mapSearch={samples:[]};
   for(const query of ['SINCAN','ANKARA','393221','__NOT_FOUND__','']){
    const start=performance.now(),cpuMs=await page.evaluate(q=>{const input=document.querySelector('.ga-map-search input'),start=performance.now();input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));return performance.now()-start;},query);
    await page.waitForFunction(()=>document.querySelector('[aria-label="Arama eşleşmeleri"]').getAttribute('aria-busy')==='false');
    const count=await page.getByLabel('Arama eşleşmeleri',{exact:true}).locator('option').count();if(query==='__NOT_FOUND__')assert.equal(count,1);else assert(count>1);
    if(query==='SINCAN')assert.match(await page.getByLabel('Arama eşleşmeleri',{exact:true}).textContent(),/SINCAN|SİNCAN/i);
    entry.mapSearch.samples.push({query,cpuMs,settledMs:performance.now()-start,count});
   }
   await page.locator('.ga-map-search input').fill('SINCAN');await page.locator('.ga-map-search input').press('Enter');assert.equal(await page.getByLabel('Arama eşleşmeleri',{exact:true}).getAttribute('aria-busy'),'false');
   await page.locator('[data-route=analysis]').click();await page.locator('[data-solve]').click();await page.waitForFunction(()=>!psseStudio.controller.busy&&!!psseStudio.controller.psseCalculation,null,{timeout:60000});
   entry.calculation=await page.evaluate(()=>({status:psseStudio.controller.psseCalculation.status,coverage:psseStudio.controller.psseCalculation.physicsCoverage}));
   assert.equal(entry.calculation.status,'CONVERGED');assert.equal(entry.calculation.coverage,'PARTIAL');
   await page.locator('[data-route=map]').click();await page.getByLabel('Değer katmanı',{exact:true}).first().selectOption('calculated');
   for(const metric of ['p','q']){await page.getByLabel('Harita metriği',{exact:true}).selectOption(metric);await assertCanvasMoves(page);}entry.pqAnimation='PASS';
  }
  await page.locator('[data-route=sld]').click();await page.locator('#ga-sld-studio').waitFor();
  if(label==='after'){
   assert((await page.getByLabel('SLD editörü OWNER bölgesi',{exact:true}).locator('option[value="708"]').textContent()).includes('ANKARA (708)'));
   const select=page.getByLabel('SLD editörü YTM / AREA',{exact:true}),total=await page.getByLabel('SLD editörü trafo merkezi',{exact:true}).locator('option').count();
   const start=performance.now();await select.selectOption('4');entry.ytmFilterMs=performance.now()-start;assert(await page.getByLabel('SLD editörü trafo merkezi',{exact:true}).locator('option').count()<total);await select.selectOption('');
  }
  entry.sincan=await page.evaluate(()=>{const start=performance.now();GASldStudio.newTM('4103');const d=GASldStudio.getActiveDoc().gaSld,c=psseStudio.controller,n=c.psseNetwork,eq=new Map(c.psseInspection.equipment.map(e=>[e.id,e]));
   const drawn=new Set(d.components.filter(e=>e.t==='Symbol'&&e.stype==='Busbar').map(e=>String(e.map).trim().split(/\s+/)[1]));
   return {elapsedMs:performance.now()-start,title:d.title,scope:d.scope,metrics:GASldStudio.measureMetroLayout(d),sourceBuses:n.buses.filter(b=>/^(SINCAN|SİNCAN)$/i.test(eq.get(b.sourceEquipmentId)?.name)).map(b=>({id:b.sourceEquipmentId,number:b.externalNumber,kv:b.baseKv,status:b.status,ide:eq.get(b.sourceEquipmentId)?.fields.ide,drawn:drawn.has(String(b.externalNumber))}))};});
  if(label==='after'){
   assert.equal(entry.sincan.scope.sourceBusIds.length,12);assert(entry.sincan.sourceBuses.every(b=>b.drawn));
   await page.getByRole('button',{name:'⚙ Diyagram Ayarları',exact:true}).click();
   const settings=page.getByRole('dialog',{name:'Diyagram Ayarları',exact:true});await settings.locator('[data-tab=advanced]').click();
   await settings.getByLabel('MW / MVAr görünürlük eşiği (zoom %)',{exact:true}).fill('0');await settings.getByLabel('MW / MVAr görünürlük eşiği (zoom %)',{exact:true}).dispatchEvent('change');await settings.getByRole('button',{name:'✓ Uygula',exact:true}).click();
   await page.getByRole('button',{name:'−',exact:true}).first().click();await page.evaluate(()=>new Promise(requestAnimationFrame));
   entry.flowLabels=await page.evaluate(()=>{const texts=[...document.querySelectorAll('.ga-studio-pf-badge[data-flow-unit]')],horizontal=texts.filter(t=>t.dataset.flowVertical==='0');return {count:texts.length,aboveBelow:horizontal.every(t=>{const p=t.ownerSVGElement.createSVGPoint();p.x=Number(t.dataset.flowX);p.y=Number(t.dataset.flowY);const line=p.matrixTransform(t.getScreenCTM()),box=t.getBoundingClientRect();return t.dataset.flowUnit==='MVAr'?box.top>line.y:box.bottom<line.y;}),uniquePairs:[...new Set(texts.map(t=>t.parentElement))].every(g=>g.querySelectorAll('[data-flow-unit=MW]').length===1&&g.querySelectorAll('[data-flow-unit=MVAr]').length===1)};});
   assert(entry.flowLabels.count>0);assert(entry.flowLabels.aboveBelow,'P/Q labels overlap their line');assert(entry.flowLabels.uniquePairs,'Duplicate P/Q pair');
   assert(await page.locator('.ga-studio-pf-badge').evaluateAll(nodes=>nodes.every(e=>Number.isFinite(Number(e.getAttribute('x')))&&Number.isFinite(Number(e.getAttribute('y'))))),'Nonfinite result-label coordinates');
   await page.locator('.ga-studio-sld-symbol[data-sld-stype=Busbar]').first().dispatchEvent('pointermove',{clientX:400,clientY:250});
   entry.tooltip=await page.getByRole('tooltip').textContent();assert.match(entry.tooltip,/SINCAN|SİNCAN/i);assert.match(entry.tooltip,/OWNER: ANKARA \(708\)/);assert.match(entry.tooltip,/YTM: .+ \(4\)/);assert.match(entry.tooltip,/kV/);
   const exportNative=async name=>{const r=await page.evaluate(async()=>{const r=await GASldStudio.exportNativeSld({skipDownload:true});if(!r.ok)throw Error(r.error);let text='';for(let i=0;i<r.bytes.length;i+=32768)text+=String.fromCharCode(...r.bytes.subarray(i,i+32768));const p=GASldStudio.parseSldBinary(r.bytes);return {base64:btoa(text),selected:p.selectedObjectId,counts:p.components.reduce((r,c)=>(r[c.t]=(r[c.t]??0)+1,r),{}),layers:p.layers.length};});const bytes=Buffer.from(r.base64,'base64');await fs.writeFile(path.join(out,'native',name),bytes);delete r.base64;return {...r,bytes:bytes.length};};
   entry.native={sincan:await exportNative('Sincan_TM.sld')};
   const start=performance.now();await page.getByLabel('SLD editörü OWNER bölgesi',{exact:true}).selectOption('708');await page.getByRole('button',{name:'🗺 OWNER Çiz',exact:true}).click();
   entry.owner708=await page.evaluate(()=>({title:GASldStudio.getActiveDoc().gaSld.title,metrics:GASldStudio.measureMetroLayout(GASldStudio.getActiveDoc().gaSld)}));entry.owner708.elapsedMs=performance.now()-start;entry.native.owner708=await exportNative('OWNER_708.sld');
   for(const filename of (await fs.readdir(refs)).filter(n=>/\.sld$/i.test(n))){
    await page.locator('#ga-sld-studio input[type=file]').setInputFiles(path.join(refs,filename));await page.waitForFunction(name=>GASldStudio.getActiveDoc()?.name===name,filename);
    entry.native[filename]=await exportNative(filename.replace(/\.sld$/i,'_roundtrip.sld'));
   }
  }
  assert.equal(await page.evaluate(()=>psseStudio.controller.psseInspection.source.sha256),entry.source.sha);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);entry.errors=errors;entry.externalRequests=requests;
  await context.close();console.log('PASS real model',label,JSON.stringify({excel:entry.excel.cells,search:entry.tableSearch.cpuMs,sincan:entry.sincan.metrics,owner:entry.owner708}));
 }
 report.tests.push('17 tables; ND/NR numeric types; BOM/6851 rows/full precision; Turkish CSV; map OWNER/five voltage/P-Q; YTM selection; Sincan 12 source buses; generated and four native SLD exports');report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;throw error;}
finally{await fs.writeFile(path.join(out,'acceptance.json'),JSON.stringify(report,null,2));await browser.close();}
