// Model-transition invariants: loadFiles and loadBenchmarkPair must both drop
// model-scoped filters, map display scope, result view context and transient
// results/selection. Harness page exposes the Application instance (the repo's
// established pattern for ctx-level assertions, cf. sc-engine-browser).
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {zipSync,strToU8} from 'fflate';
import {syntheticBenchmarkPair} from '../tests/helpers/benchmark-model.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixtureA=await readFile(path.join(root,'tests','fixtures','small-dgs.json'),'utf8');
const port=5212,url=`http://127.0.0.1:${port}/`;
const outDir=path.join(root,'local-benchmark-results','model-transition-20261028');await mkdir(outDir,{recursive:true});
const modelB=JSON.parse(fixtureA);modelB.ElmSite.Values[0][modelB.ElmSite.Attributes.indexOf('loc_name')]='B Model Station';
const pfPair=syntheticBenchmarkPair(true,true);
const pfReferenceZip=Buffer.from(await pfPair.benchmark.arrayBuffer());
const pfModelJson=JSON.stringify(pfPair.raw);
// Serve the pair from the dev server root so the browser fetches the exact
// bytes (serializing Buffers through page.evaluate would corrupt the ZIP).
await writeFile(path.join(root,'pf-model.json'),pfModelJson);
await writeFile(path.join(root,'pf-reference.zip'),pfReferenceZip);

const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true,hmr:false}});await server.listen();
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(20000);
const results=[];const check=(name,ok,detail='')=>{results.push({name,ok,detail});console.log(`${ok?'✔':'✖'} ${name}${detail?' · '+detail:''}`);if(!ok)results.failed=true;};
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const html=`<!doctype html><html lang="tr"><meta charset="utf-8"><body><main id="app"></main><script type="module">
import '/src/styles/tokens.css';import '/src/styles/layout.css';import '/src/styles/components.css';import '/src/styles/map.css';import '/src/styles/ui-workspace.css';
import {Application} from '/src/app/controller.ts';import {createMapView} from '/src/map/map-view.ts';
window.ctx=new Application();const map=createMapView(ctx);document.querySelector('#app').append(map.element);ctx.view='map';const render=()=>map.render();ctx.subscribe(render);render();window.ready=true;
</script></body></html>`;
try{
  await writeFile(path.join(root,'model-transition-test.html'),html);
  await page.goto(url.replace(/\/$/,'')+'/model-transition-test.html');
  await page.waitForFunction(()=>window.ready);
  const loadJson=async(name,text)=>{await page.evaluate(async([name,text])=>{await ctx.loadFiles([new File([text],name)]);},[name,text]);await page.waitForFunction(()=>!ctx.busy,null,{timeout:60000});};
  const dirty=async prefix=>{await page.evaluate(prefix=>{ctx.filters.areaId=prefix+'-AREA';ctx.filters.siteId=prefix+'-TM';ctx.filters.search=prefix+'-SEARCH';ctx.mapDisplay.areaMode='SELECTED';ctx.mapDisplay.areaIds=[prefix+'-AREA'];ctx.mapDisplay.siteId=prefix+'-TM';ctx.mapDisplay.capacitySeason='summer';ctx.resultView.metric='postPmw';ctx.resultView.caseId=prefix+'-CASE';ctx.resultView.faultId=prefix+'-FAULT';ctx.resultView.fid=prefix+'-FID';ctx.analysisTab='N1';ctx.selection={id:prefix+'-SEL',sourceClass:'ElmLne'};ctx.notify();},prefix);};
  const state=()=>page.evaluate(()=>({areaId:ctx.filters.areaId,siteId:ctx.filters.siteId,search:ctx.filters.search,voltages:ctx.filters.voltages.size,areaMode:ctx.mapDisplay.areaMode,mapAreaIds:JSON.stringify(ctx.mapDisplay.areaIds),mapSiteId:ctx.mapDisplay.siteId,mapSeason:ctx.mapDisplay.capacitySeason,metric:ctx.resultView.metric,caseId:ctx.resultView.caseId,faultId:ctx.resultView.faultId,fid:ctx.resultView.fid,analysisTab:ctx.analysisTab,selection:JSON.stringify(ctx.selection),modelHash:ctx.network?.modelHash.slice(0,10),n1:!!ctx.n1Result,benchmark:!!ctx.benchmark}));

  await loadJson('model-a.json',fixtureA);
  const aState=await state();
  await dirty('A');
  await loadJson('model-b.json',JSON.stringify(modelB));
  const bState=await state();
  check('loadFiles A→B: filters reset',bState.areaId===''&&bState.siteId===''&&bState.search===''&&bState.voltages===5,JSON.stringify(bState));
  check('loadFiles A→B: map display scope reset',bState.areaMode==='ALL'&&bState.mapAreaIds==='[]'&&bState.mapSiteId===''&&bState.mapSeason==='inherit');
  check('loadFiles A→B: result view context and analysis tab reset',bState.metric==='pFromMw'&&bState.caseId===undefined&&bState.faultId===undefined&&bState.fid===undefined&&bState.analysisTab==='LF');
  check('loadFiles A→B: selection and transient results dropped',bState.selection==='null'&&bState.n1===false&&bState.modelHash!==aState.modelHash);
  await dirty('B');
  await loadJson('model-a.json',fixtureA);
  const a2=await state();
  check('loadFiles B→A: model A identity restored, B state not carried',a2.modelHash===aState.modelHash&&a2.areaId===''&&a2.metric==='pFromMw'&&a2.selection==='null'&&a2.analysisTab==='LF');

  // loadBenchmarkPair must follow the same transition contract.
  await dirty('P');
  await page.evaluate(async pfModelName=>{const modelBlob=await(await fetch('/pf-model.json')).blob(),referenceBlob=await(await fetch('/pf-reference.zip')).blob();await ctx.loadBenchmarkPair(new File([modelBlob],pfModelName),new File([referenceBlob],'pf-reference.zip'));},pfPair.model.name.replace(/zip$/,'json'));
  await page.waitForFunction(()=>!ctx.busy,null,{timeout:60000});
  const pairStatus=await page.evaluate(()=>ctx.status);
  const pState=await state();
  check('loadBenchmarkPair: benchmark adopted',pState.benchmark===true,pState.modelHash+' · status='+pairStatus.slice(0,80));
  check('loadBenchmarkPair: filters reset',pState.areaId===''&&pState.siteId===''&&pState.search===''&&pState.voltages===5);
  check('loadBenchmarkPair: map display scope reset',pState.areaMode==='ALL'&&pState.mapAreaIds==='[]'&&pState.mapSiteId===''&&pState.mapSeason==='inherit');
  check('loadBenchmarkPair: result view context and analysis tab reset',pState.metric==='pFromMw'&&pState.caseId===undefined&&pState.faultId===undefined&&pState.analysisTab==='LF');
  check('loadBenchmarkPair: selection dropped',pState.selection==='null');
  check('no page errors in transition harness',errors.length===0,errors.join(' | '));
  await writeFile(path.join(outDir,'results.json'),JSON.stringify(results,null,2));
  console.log(`\nmodel-transition acceptance: ${results.filter(r=>r.ok).length}/${results.length} checks passed`);
}finally{
  await browser?.close();
  for(const f of ['model-transition-test.html','pf-model.json','pf-reference.zip']){try{await writeFile(path.join(root,f),'');await (await import('node:fs/promises')).unlink(path.join(root,f));}catch{}}
  await new Promise(resolve=>server.httpServer.close(()=>resolve()));
  setTimeout(()=>process.exit(results.some(r=>r.ok===false)||errors.length?1:0),300).unref();
}
