/** Private real-source UI/export acceptance. Inputs and outputs stay ignored. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {posix} from 'node:path';
import {createServer} from 'vite';import {chromium} from 'playwright';import assert from 'node:assert/strict';
import {loadBenchmarkModel} from '../src/importers/powerfactory-benchmark/model.ts';
import {sourceSvgOracle} from './sld-v37-native-oracle.ts';
import {pngBrowserAcceptance} from './sld-png-browser-acceptance.mjs';
const dir='local-benchmark-results/sld-final',ids=['M1482','M937','M890','M1583','M1301','M102','M691','M56','M1555','M535','M911','M1074'];await mkdir(dir,{recursive:true});
const cached=process.argv.includes('--cached')?JSON.parse(await readFile(dir+'/fixtures-private.json')):null;
const loaded=cached?{network:cached.network,modelJsonSha256:cached.network.modelHash}:await loadBenchmarkModel(new File([await readFile('.local-fixtures/powerfactory/SN3/20261007_1400_SN3_TR0.zip')],'SN3.zip'));
assert.equal(loaded.modelJsonSha256,'f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6');
const {network,source,raw}=loaded,classes=['ElmBay','ElmTerm','StaCubic','ElmCoup','StaSwitch','ElmSubstat','ElmTr2','ElmTr3','ElmSind','TypTr2'];
const missing=cached?cached.fixtures.filter(f=>f.raw.ElmTerm.length===0).map(f=>f.site):network.sites.filter(s=>source.getEquipmentForSite(s.id,'ElmTerm').length===0);assert.equal(missing.length,65);assert.equal(network.sites.length-missing.length,1554);
const fixtures=cached?.fixtures??[...ids,...missing.map(s=>s.id)].map(id=>{
 const tables=Object.fromEntries(classes.map(cls=>[cls,source.getEquipmentForSite(id,cls).map(r=>({id:String(r.FID),name:String(r.loc_name??r.FID),siteIds:[id],attributes:source.get(cls,r.FID)??r}))]));
 const seen=new Set(tables.StaCubic.map(r=>r.id));for(const row of [...tables.ElmCoup,...tables.StaSwitch,...tables.ElmTr2,...tables.ElmTr3,...tables.ElmSind])for(const field of ['bus1','bus2','bushv','busmv','buslv','fold_id']){const cid=String(row.attributes[field]??''),cub=source.get('StaCubic',cid);if(cub&&!seen.has(cid)){tables.StaCubic.push({id:cid,name:String(cub.loc_name??cid),siteIds:[id],attributes:cub});seen.add(cid);}}
 return {site:network.sites.find(s=>s.id===id),raw:tables};
});
const rawTables=cached?JSON.parse(await readFile('local-benchmark-results/sld-v37-source/raw-tables-private.json')):Object.fromEntries(['ElmTr2','ElmTr3','ElmCoup','StaCubic','ElmTerm','StaSwitch'].map(cls=>[cls,raw[cls]?.Values.map(v=>Object.fromEntries(raw[cls].Attributes.map((a,i)=>[a,v[i]??null])))??[]]));
const result=await readFile('local-benchmark-results/map-lightning-audit-SN3-cache-private.json');assert.equal(JSON.parse(result).network.modelHash,network.modelHash);
const bytes=JSON.stringify({network,fixtures});await writeFile(dir+'/fixtures-private.json',bytes);
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:5534,strictPort:true,watch:{ignored:['**/local-benchmark-results/**']}},plugins:[{name:'private-final-ui',configureServer(s){s.middlewares.use((req,res,next)=>{const data=req.url==='/private-fixture'?bytes:req.url==='/private-result'?result:null;if(!data)return next();res.writeHead(200,{'Content-Type':'application/json'});res.end(data);});}}]});await server.listen();
const html=`<html lang="tr"><meta charset="utf-8"><body><main id="app"></main><script type="module">
${['tokens','layout','catalog','components','analysis','responsive','benchmark','ui-workspace'].map(f=>`import '/src/styles/${f}.css';`).join('\n')}
import{Application}from'/src/app/controller.ts';import{ScenarioStore}from'/src/domain/scenario/overlay.ts';import{createSldView}from'/src/features/sld/sld-view.ts';
const fixture=await(await fetch('/private-fixture')).json(),d=await(await fetch('/private-result')).json();window.ctx=new Application();ctx.network=fixture.network;ctx.scenario=new ScenarioStore(ctx.network.modelHash);ctx.analysisSettings.update(d.settings);ctx.powerFactoryControlContextHash=d.controlHash;ctx.view='sld';ctx.resultStore.expect('base',d.lf.identity);ctx.resultStore.accept('base',d.lf);ctx.hybridResult=d.hybrid;ctx.scResult=d.sc;ctx.scContext=d.scContext;
ctx.catalog=async q=>{const rows=fixture.fixtures.flatMap(f=>f.raw[q.className]??[]).filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i&&(!q.siteId||r.siteIds.includes(q.siteId))&&(!q.search||r.id===q.search));const start=(q.page??0)*(q.pageSize??100);return{rows:rows.slice(start,start+(q.pageSize??100)),total:rows.length,attributes:[]};};const view=createSldView(ctx);document.querySelector('#app').append(view.element);ctx.subscribe(()=>view.render());ctx.notify();window.ready=true;
</script>`;
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],rows=[],sourceProof=[];page.setDefaultTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
try{
 const oldView=execFileSync('git',['show','1e96d0e:src/features/sld/sld-view.ts'],{encoding:'utf8'}).replace(/from '([^']+)'/g,(all,ref)=>ref.startsWith('.')?`from '${posix.normalize('/src/features/sld/'+ref)}'`:all);await writeFile(dir+'/baseline-view-private.ts',oldView);await writeFile(dir+'/baseline-ui-private.css',execFileSync('git',['show','1e96d0e:src/styles/ui-workspace.css']));
 let served=html.replace("from'/src/features/sld/sld-view.ts'","from'/local-benchmark-results/sld-final/baseline-view-private.ts'").replace("'/src/styles/ui-workspace.css'","'/local-benchmark-results/sld-final/baseline-ui-private.css'");
 await page.route('**/final-ui.html',r=>r.fulfill({contentType:'text/html',body:served}));await page.goto('http://127.0.0.1:5534/final-ui.html');await page.waitForFunction(()=>window.ready);await page.getByLabel('Trafo merkezi',{exact:true}).selectOption('M1482');await page.waitForFunction(()=>document.querySelector('svg')?.getAttribute('aria-label')?.startsWith('KAYAS'));await page.screenshot({path:dir+'/BEFORE-UI-1440.png'});
 served=html;await page.goto('http://127.0.0.1:5534/final-ui.html');await page.waitForFunction(()=>window.ready);
 const canonical=await page.evaluate(()=>JSON.stringify(ctx.network));
 for(const id of ids){
  await page.getByLabel('Trafo merkezi',{exact:true}).selectOption(id);
  for(const mode of ['ytbs','technical','LF','N1','SC','operation','compact']){
   await page.getByLabel('SLD görünüm modu',{exact:true}).selectOption(mode);await page.waitForFunction(({id,mode})=>document.querySelector('.ga-sld-view')?.dataset.sldMode===mode&&document.querySelector('svg')?.getAttribute('aria-label')?.startsWith(ctx.network.sites.find(s=>s.id===id).name),{id,mode});
   const metrics=await page.locator('.ga-sld-svg').evaluate(svg=>({switches:svg.querySelectorAll('[data-physical-switch]').length,feeders:svg.querySelectorAll('[data-feeder-marker]').length,hidden:+svg.dataset.hiddenSourceSwitchCount,box:svg.getAttribute('viewBox'),readouts:svg.querySelectorAll('[data-result-status]').length,status:svg.dataset.methodStatus,overflow:svg.querySelectorAll('[data-caption-overflow]').length,hops:svg.querySelectorAll('path[data-rail-passes]').length}));
   rows.push({id,mode,...metrics});
   if(mode==='ytbs'||mode==='LF'){
    const exported=await pngBrowserAcceptance(page),stem=`${dir}/REAL-${id}-${mode}`;await writeFile(stem+'.svg',exported.svg);await writeFile(stem+'.png',exported.png);
    await page.getByRole('button',{name:'Sığdır',exact:true}).click();await page.locator('.ga-sld-diagram').screenshot({path:stem+'-UI.png'});
    const f=fixtures.find(f=>f.site.id===id),byClass=new Map(f.raw.ElmTr2.map(r=>[r.id,r]));
    const winding=sourceSvgOracle(exported.svg.toString(),rawTables,network,[...byClass.keys()]);assert.deepEqual(winding.errors,[],id+' raw winding parity');sourceProof.push({id,mode,winding,pixels:exported.pixels});
   }
  }
  const same=rows.filter(r=>r.id===id);assert.equal(new Set(same.map(r=>r.switches)).size,1,id+' mode inventory');assert.equal(new Set(same.map(r=>r.feeders)).size,1);
  if(id==='M1482')for(const width of [390,720,1366,1440,1920]){await page.setViewportSize({width,height:900});await page.getByLabel('SLD görünüm modu',{exact:true}).selectOption('ytbs');await page.locator('.ga-sld-toolbar').evaluate(e=>e.scrollLeft=0);await page.evaluate(()=>new Promise(requestAnimationFrame));const shape=await page.locator('.ga-sld-toolbar').evaluate(e=>({wrap:getComputedStyle(e).flexWrap,overflow:document.documentElement.scrollWidth>innerWidth+2,height:e.clientHeight}));assert.equal(shape.wrap,'nowrap');assert.equal(shape.overflow,false);assert.ok(shape.height<80);await page.screenshot({path:`${dir}/FINAL-UI-${width}.png`});}
  await page.setViewportSize({width:1440,height:1000});
 }
 for(const site of missing){await page.getByLabel('Trafo merkezi',{exact:true}).selectOption(site.id);await page.waitForFunction(name=>document.querySelector('svg')?.dataset.sourceAvailability==='NO_SOURCE_TOPOLOGY'&&document.querySelector('svg')?.getAttribute('aria-label')?.startsWith(name),site.name);assert.match(await page.locator('svg').textContent(),/kaynak terminal veya ekipman bağlantısı bulunmuyor/);}
 assert.equal(await page.evaluate(()=>JSON.stringify(ctx.network)),canonical);assert.deepEqual(errors,[]);
 const summary={sourceSha256:loaded.modelJsonSha256,stations:network.sites.length,terminalBearing:1554,noSourceScreens:missing.map(s=>({id:s.id,name:s.name})),rows,sourceProof,errors};await writeFile(dir+'/REAL_UI_ACCEPTANCE.json',JSON.stringify(summary,null,2));
 const cards=ids.map(id=>`<h2>${fixtures.find(f=>f.site.id===id).site.name}</h2><div class="row">${['ytbs','LF'].map(mode=>`<figure><figcaption>${mode} · SVG/PNG, full sheet</figcaption><a href="REAL-${id}-${mode}.svg"><img src="REAL-${id}-${mode}.png" loading="lazy"></a></figure>`).join('')}</div>`).join('');await writeFile(dir+'/GALLERY.html',`<!doctype html><meta charset="utf-8"><title>SLD final acceptance</title><style>body{font:14px system-ui;background:white;color:#182833;margin:20px}.row{display:flex;gap:16px}figure{width:48%;margin:0}img{width:100%;border:1px solid #bbb}</style><h1>12 real stations · current full SVG / PNG</h1><p>SN3 ${loaded.modelJsonSha256}. Geometry and source acceptance are separately reported; no missing values are invented.</p>${cards}`);
 console.log('REAL UI PASS',rows.length,'mode checks, 24 full PNG/SVG pairs, 65 explicit missing-source screens, five toolbar viewports.');
}finally{await browser.close();await server.close();}
