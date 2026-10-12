/** Render freshly computed private snapshots without repeating import or calculations. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const [input,appRoot=process.cwd(),label='CURRENT']=process.argv.slice(2);
if(!input||!['BASELINE','CURRENT'].includes(label))throw Error('Usage: fresh-private.json [app-root] [BASELINE|CURRENT]');
const data=await readFile(input),out=resolve('local-benchmark-results/engineering-20261012'),port=label==='BASELINE'?5451:5452,url=`http://127.0.0.1:${port}/`;
// Avoid sending a full 169 MB real snapshot as one base64 CDP interception message.
// Stream genuine bytes over loopback; the model and result catalog are not reduced.
const server=await createServer({root:resolve(appRoot),logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'private-real-ui-input',configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url!=='/private-fresh-data'){next();return;}res.writeHead(200,{'Content-Type':'application/json','Content-Length':data.length,'Cache-Control':'no-store'});res.end(data);});}}]});
await server.listen();const privateUrl='/private-fresh-data';
const css=['tokens','layout','catalog','components','analysis','responsive','benchmark','ui-workspace'].map(f=>`import '/src/styles/${f}.css';`).join('');
const html=`<!doctype html><html lang="tr"><meta charset="utf-8"><body><main id="app"></main><script type="module">
${css}
import {Application} from '/src/app/controller.ts';
import {createAnalysisWorkspace} from '/src/features/analysis/analysis-workspace.ts';
import {ScenarioStore} from '/src/domain/scenario/overlay.ts';
const Native=Worker;window.requests=[];window.Worker=class extends Native{postMessage(m,...a){if(/^(RUN_|SC_FAULT_CATALOG)/.test(m.type)){requests.push(m.type);throw Error('Rendered acceptance must not recalculate');}super.postMessage(m,...a);}};
const d=await (await fetch('${privateUrl}')).json();const ctx=new Application();window.ctx=ctx;ctx.network=d.network;ctx.scenario=new ScenarioStore(d.network.modelHash);ctx.analysisSettings.update(d.settings);ctx.powerFactoryControlContextHash=d.controlHash??null;ctx.benchmark=d.benchmark;ctx.filters.areaId=d.areaId;ctx.notify();ctx.resultStore.expect('base',d.lf.identity);ctx.resultStore.accept('base',d.lf);ctx.hybridResult=d.hybrid;ctx.scContext=d.scContext;ctx.scResult=d.sc;ctx.scCatalog=d.catalog;ctx.analysisTab='SC';ctx.view='analysis';ctx.resultView={...ctx.resultView,analysis:'SC',source:'GA',phase:'POST',metric:'ikssKa',faultId:undefined};const w=createAnalysisWorkspace(ctx);document.querySelector('#app').append(w.element);ctx.subscribe(()=>w.render());ctx.notify();window.ready=true;
</script></body></html>`;
let browser,page;const proof={label,inputKind:'FRESH_REAL_MODEL_CALCULATIONS',geometry:[],errors:[],solverRequests:[]};
try{
  browser=await chromium.launch({headless:true,args:['--js-flags=--max-old-space-size=6144']});page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(120000);page.on('pageerror',e=>proof.errors.push(e.message));page.on('crash',()=>proof.errors.push('CHROMIUM_PAGE_CRASH'));
  await page.route('**/fresh-ui.html',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto(url+'fresh-ui.html');await page.waitForFunction(()=>window.ready);
  const w=page.locator('.ga-analysis-workspace'),sc=page.locator('#ga-analysis-SC .ga-workspace-results');
  proof.batchStatus=await sc.getAttribute('data-status');assert.equal(proof.batchStatus,label==='CURRENT'?'SC_BATCH_NETWORK_APPROXIMATION':'NOT_RUN');
  proof.numeric=await page.evaluate(()=>({modelHash:ctx.network.modelHash,catalog:ctx.scCatalog.physicalTerminals,faults:ctx.scResult.faults.map(f=>({ikssKa:f.ikssKa,skssMva:f.skssMva,ipKa:f.ipKa,ibKa:f.ibKa,ithKa:f.ithKa})),residual:ctx.resultStore.get('base','powerFlow').maxMismatchMw}));
  proof.filters=await sc.evaluate(e=>{const input=e.querySelector('[aria-label="Ortak sonuçlarda FID ara"]'),samples=[];for(let i=0;i<25;i++){input.value=i%2?'NO_MATCH_FOR_TIMING':'';const t=performance.now();input.dispatchEvent(new Event('input'));if(i>=5)samples.push(performance.now()-t);if(e.querySelectorAll('tbody tr').length>50)throw Error('Unbounded table');}input.value='';input.dispatchEvent(new Event('input'));samples.sort((a,b)=>a-b);return {samples:samples.length,medianMs:(samples[9]+samples[10])/2,p95Ms:samples[18],maxMs:samples.at(-1)};});
  for(const width of [390,768,1366,1440,1600,1920]){await page.setViewportSize({width,height:width===390?844:width===1366?768:width===1920?1080:900});for(const tab of ['Yük Akışı Analizi','Kısıt Analizi (N-1)','Kısa Devre Analizi']){await w.getByRole('button',{name:tab,exact:true}).click();if(tab==='Kısıt Analizi (N-1)'){await page.locator('#ga-analysis-N1').getByLabel('N-1 hesap yöntemi',{exact:true}).selectOption('HYBRID');await page.evaluate(()=>{ctx.resultView.caseId=ctx.hybridResult.cases.find(c=>c.mapResults)?.outage.caseId;ctx.resultView.metric='postLoadingPercent';ctx.notify();});}const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,tab+' '+width);proof.geometry.push({width,tab,overflow:false});}await page.screenshot({path:out+'/'+label+'-fresh-real-'+width+'.png'});}
  proof.solverRequests=await page.evaluate(()=>requests);assert.deepEqual(proof.solverRequests,[]);assert.deepEqual(proof.errors,[]);proof.status='PASS';
  console.log('FRESH_REAL_UI '+JSON.stringify({label,status:proof.status,batchStatus:proof.batchStatus,catalog:proof.numeric.catalog,filters:proof.filters,viewports:6,solverRequests:0}));
}catch(e){proof.status='FAIL';proof.failure=String(e);process.exitCode=1;console.error('FRESH_REAL_UI '+label+' FAILED; see ignored proof');}
finally{await mkdir(out,{recursive:true});await writeFile(out+'/'+label+'-fresh-real-ui-private.json',JSON.stringify(proof,null,2));await browser?.close();await server.close();}
