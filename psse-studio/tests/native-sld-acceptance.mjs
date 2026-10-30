import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {fileURLToPath,pathToFileURL} from 'node:url';import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url)),html=process.env.PSSE_PORTABLE??root+'dist/Grid_Analyzer_PSSE_Portable.html',baseline=process.env.PSSE_BASELINE,sav=process.env.PSSE_SAV,refs=process.env.PSSE_SLD_DIR,out=process.env.PSSE_EVIDENCE;
assert(baseline&&sav&&refs&&out,'Set PSSE_BASELINE/SAV/SLD_DIR/EVIDENCE');await fs.mkdir(out,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),counts=c=>c.reduce((r,x)=>(r[x.t]=(r[x.t]||0)+1,r),{}),report={artifact:{path:html,sha256:hash(await fs.readFile(html)),bytes:(await fs.stat(html)).size},browsers:[]};
const plain=d=>({...d,rawBytes:undefined,_rawMainList:undefined,_rawLayers:undefined,_rawGroups:undefined,_rawViews:undefined,components:d.components.map(c=>{const {_rawObj,_rawKnees,...rest}=c;return rest;})});
const pause=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true});const result={browser:channel,views:[],native:[],errors:[],externalRequests:[]};report.browsers.push(result);
 try{
  let before;
  for(const [label,target] of [['before',baseline],['after',html]]){
   const ctx=await browser.newContext({offline:true,viewport:{width:1366,height:768}}),page=await ctx.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>result.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))result.externalRequests.push(r.url());});
   await page.goto(pathToFileURL(target).href);await page.locator('#pse-file').setInputFiles(sav);await page.waitForFunction(()=>psseStudio.controller.psseNetwork&&!psseStudio.controller.busy,null,{timeout:60000});
   const model=await page.evaluate(()=>{const c=psseStudio.controller;return {sourceHash:c.psseInspection.source.sha256,networkHash:c.psseNetwork.modelHash,buses:c.psseNetwork.buses.length,branches:c.psseNetwork.branches.length,counts:Object.fromEntries([...new Set(c.psseInspection.equipment.map(x=>x.kind))].map(k=>[k,c.psseInspection.equipment.filter(e=>e.kind===k).length])),nav:[...document.querySelectorAll('#v8-nav button')].map(b=>b.textContent)};});
   await page.screenshot({path:path.join(out,channel+'-'+label+'-model.png')});await page.locator('[data-route=map]').click();await pause(page);
   const map=await page.evaluate(()=>({voltage:[...document.querySelectorAll('.ga-v11-voltage input')].map(e=>({value:e.value,checked:e.checked})),stations:[...document.querySelectorAll('.ga-psse-geo-station')].map(e=>({id:e.dataset.id,transform:e.getAttribute('transform'),text:e.textContent})),links:[...document.querySelectorAll('.ga-psse-geo-link')].map(e=>({id:e.dataset.equipmentId,d:e.getAttribute('d')}))}));
   const fingerprint={model,mapHash:hash(JSON.stringify(map)),stations:map.stations.length,links:map.links.length};if(label==='before')before=fingerprint;else assert.deepEqual(fingerprint,before,'Baseline model/map changed');
   for(const width of [1366,768]){await page.setViewportSize({width,height:768});await pause(page);const geometry=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,root:!!document.querySelector('#pse-root'),nav:!!document.querySelector('#v8-nav')}));assert(geometry.document<=width);await page.screenshot({path:path.join(out,`${channel}-${label}-map-${width}.png`)});result.views.push({label,...geometry,...fingerprint});}await page.setViewportSize({width:1366,height:768});
   if(label==='before'){await ctx.close();continue;}
   await page.locator('[data-route=sld]').click();await page.locator('#ga-sld-studio').waitFor();await page.waitForFunction(()=>document.querySelector('[aria-label="SLD editörü OWNER bölgesi"]').options.length>1);
   result.ownerOptions=await page.getByLabel('SLD editörü OWNER bölgesi',{exact:true}).locator('option').count()-1;assert.equal(result.ownerOptions,23);
   const filenames=await fs.readdir(refs),kayseri=filenames.find(n=>n.includes('Kayseri')&&n.endsWith('.sld'));assert(kayseri);
   for(const name of ['kayseri_endpoint','sincan_edited','owner708_edited']){
    let start=performance.now();
    if(name==='kayseri_endpoint'){await page.locator('#ga-sld-studio input[type=file]').setInputFiles(path.join(refs,kayseri));await page.waitForFunction(()=>GASldStudio.getActiveDoc()?.origin==='NATIVE_SLD');}
    else if(name==='sincan_edited'){const s=page.getByLabel('SLD editörü trafo merkezi',{exact:true});const value=await s.locator('option').evaluateAll(opts=>opts.find(o=>/SINCAN|SİNCAN/i.test(o.textContent))?.value);assert(value);await s.selectOption(value);await page.getByRole('button',{name:'⚡ TM Çiz',exact:true}).click();}
    else{await page.getByLabel('SLD editörü OWNER bölgesi',{exact:true}).selectOption('708');await page.getByRole('button',{name:'🗺 OWNER Çiz',exact:true}).click();}
    const elapsedMs=performance.now()-start;
    const original=await page.evaluate(()=>{const d=GASldStudio.getActiveDoc().gaSld;return {counts:d.components.reduce((r,x)=>(r[x.t]=(r[x.t]||0)+1,r),{}),layout:d.layoutMetrics};});
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'💾 Native .sld Kaydet',exact:true}).click();const dl=await download;const filepath=path.join(out,channel+'-'+name+'.sld');await dl.saveAs(filepath);const bytes=await fs.readFile(filepath);
    const exported=await page.evaluate(bytes=>{const d=GASldStudio.parseSldBinary(new Uint8Array(bytes));return {...d,rawBytes:undefined,_rawMainList:undefined,_rawLayers:undefined,_rawGroups:undefined,_rawViews:undefined,components:d.components.map(c=>{const {_rawObj,_rawKnees,...r}=c;return r;})};},[...bytes]);
    const jsonDl=page.waitForEvent('download');await page.evaluate(()=>GASldStudio.exportGaSldJson());const jd=await jsonDl,jsonPath=path.join(out,channel+'-'+name+'.gasld.json');await jd.saveAs(jsonPath);const json=JSON.parse(await fs.readFile(jsonPath,'utf8'));assert.deepEqual(counts(json.components),original.counts);
    await page.locator('#ga-sld-studio input[type=file]').setInputFiles(filepath);await page.waitForFunction(n=>GASldStudio.getActiveDoc().name.includes(n),path.basename(filepath,'.sld'));
    const re=await page.evaluate(()=>{const d=GASldStudio.getActiveDoc().gaSld;return d.components.reduce((r,x)=>(r[x.t]=(r[x.t]||0)+1,r),{});});assert.deepEqual(re,original.counts);
    const previousId=await page.evaluate(()=>GASldStudio.active());await page.locator('#ga-sld-studio input[type=file]').setInputFiles(jsonPath);await page.waitForFunction(id=>GASldStudio.active()!==id,previousId);assert.deepEqual(await page.evaluate(()=>GASldStudio.getActiveDoc().gaSld.components.reduce((r,x)=>(r[x.t]=(r[x.t]||0)+1,r),{})),original.counts);
    await page.evaluate(async bytes=>{const r=await GASldStudio.importOne(new File([new Uint8Array(bytes)],'verified-native.sld'));if(!r.ok)throw Error(r.error);return r.ok;},[...bytes]);
    await page.screenshot({path:path.join(out,channel+'-'+name+'-native.png')});
    if(channel==='chrome'){await fs.writeFile(path.join(out,name+'.sld'),bytes);await fs.writeFile(path.join(out,name+'.json'),JSON.stringify(exported));}
    result.native.push({name,counts:original.counts,reimport:re,jsonRoundtrip:counts(json.components),bytes:bytes.length,sha256:hash(bytes),elapsedMs,layout:original.layout});
   }
   assert((await page.locator('.ga-studio-tab').count())>=3);const after=await page.evaluate(()=>{const c=psseStudio.controller;return {sourceHash:c.psseInspection.source.sha256,networkHash:c.psseNetwork.modelHash,buses:c.psseNetwork.buses.length,branches:c.psseNetwork.branches.length,counts:Object.fromEntries([...new Set(c.psseInspection.equipment.map(x=>x.kind))].map(k=>[k,c.psseInspection.equipment.filter(e=>e.kind===k).length])),nav:[...document.querySelectorAll('#v8-nav button')].map(b=>b.textContent)};});assert.deepEqual(after,model,'Native editing changed the model');await ctx.close();
  }
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.externalRequests,[]);console.log('Latest Studio native acceptance PASS',channel,result.native.map(x=>({name:x.name,counts:x.counts,elapsedMs:Math.round(x.elapsedMs)})));
 }finally{await browser.close();await fs.writeFile(path.join(out,'browser_acceptance.json'),JSON.stringify(report,null,2));}
}
