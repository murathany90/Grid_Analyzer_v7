import {desktopOnly,desktopWidths,testViewport} from './desktop-test-options.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const [path,tag='SN3',area='Y9']=process.argv.slice(2);
if(!path)throw Error('Usage: node tools/n1-sc-browser-acceptance.mjs model.zip tag area');
const port=5387,out='local-benchmark-results/n1-sc-20261022',input=await readFile(path),json=path.endsWith('.zip')?Object.entries(unzipSync(input)).find(([name])=>name.endsWith('.json'))[1]:input;
const server=await createServer({plugins:[{name:'private-model-http',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/private-model.json')return next();res.setHeader('Content-Type','application/json');res.end(Buffer.from(json.buffer,json.byteOffset,json.byteLength));});}}],logLevel:'error',server:{hmr:false,host:'127.0.0.1',port,strictPort:true,watch:{ignored:['**/local-benchmark-results/**','**/.tmp/**']}}});await server.listen();
const browser=await chromium.launch({headless:true,args:['--js-flags=--max-old-space-size=6144']}),page=await browser.newPage({viewport:testViewport(640,800)}),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>console.error('BROWSER_RENDERER_CRASH'));page.on('console',m=>{if(m.type()==='error')console.error('BROWSER_CONSOLE '+m.text());});
try{
 await mkdir(out,{recursive:true});console.log('BROWSER '+browser.version());
 await page.route('**/ytm-harness',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="tr"><meta charset="utf-8"><body><main id="app"></main><script type="module">
 ${['tokens','layout','components','analysis','responsive','benchmark','ui-workspace'].map(f=>`import '/src/styles/${f}.css';`).join('')}
 import {Application} from '/src/app/controller.ts';import {createYtmStudyView} from '/src/features/analysis/ytm-study-view.ts';
 const ctx=new Application();window.ctx=ctx;const view=createYtmStudyView(ctx);document.querySelector('#app').append(view.element);ctx.subscribe(()=>view.render());view.render();window.ready=true;
 </script></body></html>`}));
 await page.goto(`http://127.0.0.1:${port}/ytm-harness`);await page.waitForFunction(()=>window.ready);
 const importMs=await page.evaluate(async()=>{const t=performance.now(),b=await(await fetch('/private-model.json')).blob();await ctx.loadFiles([new File([b],'native-model.json')]);return performance.now()-t;});assert.ok(await page.evaluate(()=>!!ctx.network));console.log(tag+' browser imported '+importMs);
 const chosenArea=area==='AUTO'?await page.getByLabel('Toplu analiz YTM',{exact:true}).inputValue():area;
 await page.getByLabel('Toplu analiz YTM',{exact:true}).selectOption(chosenArea);assert.equal(await page.getByLabel('Toplu analiz profili',{exact:true}).inputValue(),'BALANCED');
 await page.getByRole('button',{name:'Analiz Et',exact:true}).evaluate(b=>b.addEventListener('click',()=>{window.clickStarted=performance.now();},{capture:true,once:true}));
 await page.getByRole('button',{name:'Analiz Et',exact:true}).click();
 await page.waitForFunction(()=>!ctx.busy&&ctx.ytmStudy&&ctx.ytmStudy.status!=='RUNNING',{},{timeout:185000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const result=await page.evaluate(()=>({clickToPaintMs:performance.now()-window.clickStarted,elapsedMs:ctx.ytmStudy.elapsedMs,status:ctx.ytmStudy.status,n1Counts:ctx.ytmStudy.n1?.counts,catalog:ctx.ytmStudy.catalog.length,cases:ctx.ytmStudy.n1?.cases.length,targets:ctx.ytmStudy.faultTargets.length,electrical:ctx.ytmStudy.electricalTargets,max:ctx.ytmStudy.scMax?.counts,min:ctx.ytmStudy.scMin?.counts,stages:ctx.ytmStudy.stageMs,quality:ctx.ytmStudy.qualityCounts,browser:navigator.userAgent}));
 assert.equal(result.catalog,result.cases);assert.ok(result.targets>0);assert.ok(result.clickToPaintMs<=180000,JSON.stringify(result));
 const detailCache=await page.evaluate(async()=>{const first=ctx.hybridResult?.cases.find(c=>c.acSolved);return first?{caseId:first.outage.caseId,loaded:await ctx.loadHybridCaseDetail(first.outage.caseId)}:null;});if(detailCache)assert.equal(detailCache.loaded,true);
 const geometry=[];
 for(const width of (desktopOnly?[640]:[640,420])){await page.setViewportSize(testViewport(width,800));await page.getByRole('button',{name:'Bara bazlı kısa devre',exact:true}).click();await page.screenshot({path:`${out}/${tag}-${area}-ytm-${width}-private.png`});const g=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,rows:document.querySelectorAll('tbody tr').length,cells:document.querySelectorAll('tbody td').length}));assert.ok(g.document<=g.width,JSON.stringify(g));assert.ok(g.rows<=50);geometry.push(g);}
 if(tag==='PUBLIC'){
  await page.evaluate(async()=>{const l=ctx.network.lines.find(l=>l.inService);await ctx.setStatus('lineStatus',l.id,false,l.inService,false);});assert.equal(await page.locator('tbody tr').count(),0);
  await page.evaluate(()=>ctx.undoScenario());assert.ok(await page.locator('tbody tr').count()>0,'undo must restore the table after invalidating its row cache');
  const downloads={};for(const name of ['CSV','JSON','XLSX']){const event=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const d=await event,p=`${out}/PUBLIC-visible.${name.toLowerCase()}`;await d.saveAs(p);downloads[name]=await readFile(p);}
  const exported=JSON.parse(downloads.JSON.toString('utf8'));assert.equal(exported.rows.length,result.targets);assert.ok(downloads.CSV.toString('utf8').includes('Ikss_MAX_kA'));assert.ok(unzipSync(downloads.XLSX)['xl/worksheets/sheet1.xml']);
 }
 assert.deepEqual(errors,[]);const proof={tag,area,importMs,result,detailCache,geometry,errors};await writeFile(`${out}/${tag}-${area}-browser-proof.json`,JSON.stringify(proof,null,2));console.log('YTM_BROWSER '+JSON.stringify(proof));
}finally{await browser.close();await server.close();}

