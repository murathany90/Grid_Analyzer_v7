// REAL-MODEL acceptance (local only, never committed evidence): dense TM
// label layout, YTM display scope and display-vs-analysis separation on a
// full Turkish transmission model.
// Usage: node tools/map-sn1-acceptance.mjs [path-to-model.zip] [outdir]
// Defaults to the newest SN1 zip found under kontrol1/ or Downloads/.
import {mkdir,writeFile,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argModel=process.argv[2],argOut=process.argv[3];
const outDir=path.resolve(argOut||path.join(root,'local-benchmark-results','map-sn1-acceptance-20261027'));
const port=5195,url=`http://127.0.0.1:${port}/`;
async function findModel(){
  if(argModel)return path.resolve(argModel);
  const candidates=[];
  for(const dir of [path.join(root,'kontrol1'),path.join(os.homedir(),'Downloads')]){
    if(!existsSync(dir))continue;
    for(const entry of await readdir(dir)){if(/SN1.*TR0.*\.zip$/i.test(entry))candidates.push(path.join(dir,entry));}
  }
  candidates.sort();return candidates.at(-1);
}
const model=await findModel();
if(!model){console.error('SN1 model zip not found; pass the path as argv[2].');process.exit(2);}
console.log('model:',model);
await mkdir(outDir,{recursive:true});
const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true}});await server.listen();
let browser;const results=[];const check=(name,ok,detail='')=>{results.push({name,ok,detail});console.log(`${ok?'✔':'✖'} ${name}${detail?' · '+detail:''}`);if(!ok)results.failed=true;};
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1920,height:1080}});
  const page=await context.newPage();page.setDefaultTimeout(300000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  const started=Date.now();
  await page.locator('#modelFileInput').setInputFiles(model);
  await page.waitForFunction(()=>Boolean(document.querySelector('.ga-head-model')?.textContent?.trim()),null,{timeout:600000});
  const importSeconds=(Date.now()-started)/1000;
  check('SN1 model imported',true,`${importSeconds.toFixed(1)} s`);
  await page.getByRole('button',{name:'Harita',exact:true}).click();
  await page.locator('.ga-map-wrap').waitFor();
  await page.waitForTimeout(1500);
  // --- Tüm YTM: national view with labels on ---
  await page.getByRole('checkbox',{name:'Etiketler'}).check();
  await page.waitForTimeout(800);
  const ytmSummary=page.locator('.ga-map-view .ga-area-menu>summary');
  const counter=(await ytmSummary.textContent()).trim();
  const areaCount=await page.locator('.ga-map-view .ga-area-menu .ga-area-list input').count();
  check('Tüm YTM counter',counter.includes('Tümü'),counter);
  const nationalLabels=Number(await page.locator('#networkCanvas').getAttribute('data-label-count'));
  check('national view label budget bounded',nationalLabels>=1&&nationalLabels<=260,`labels=${nationalLabels} of ${areaCount} YTM`);
  await page.locator('.ga-map-view').screenshot({path:path.join(outDir,'sn1-tumu-labels.png')});
  // --- Orta Anadolu YTM display scope ---
  await ytmSummary.click();
  const ortaInput=page.locator('.ga-map-view .ga-area-menu .ga-area-list label',{hasText:/Orta Anadolu/i}).locator('input');
  if(await ortaInput.count()){
    await page.locator('.ga-map-view .ga-area-menu').getByRole('button',{name:'Temizle'}).click();
    await ortaInput.check();
    const selectedCounter=(await ytmSummary.textContent()).trim();
    check('Orta Anadolu single-YTM SELECTED scope',selectedCounter.includes(`1/${areaCount}`),selectedCounter);
    await page.waitForTimeout(600);
    await page.locator('.ga-map-view').screenshot({path:path.join(outDir,'sn1-orta-anadolu.png')});
    const zoomedLabels=Number(await page.locator('#networkCanvas').getAttribute('data-label-count'));
    check('filtered view renders labels',zoomedLabels>=1,`labels=${zoomedLabels}`);
    await page.locator('.ga-map-view .ga-area-menu').getByRole('button',{name:'Tümünü seç'}).click();
    check('Tümünü seç restores Tümü on SN1',(await ytmSummary.textContent()).includes('Tümü'));
  }else{
    check('Orta Anadolu YTM found in list',false,'label not found; check model naming');
  }
  await page.keyboard.press('Escape');
  // --- near zoom on dense center ---
  const canvas=await page.locator('#networkCanvas').boundingBox();
  await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
  for(let i=0;i<12;i++)await page.mouse.wheel(0,-240);
  await page.waitForTimeout(800);
  const denseLabels=Number(await page.locator('#networkCanvas').getAttribute('data-label-count'));
  check('near zoom dense labeling within budget',denseLabels>=1&&denseLabels<=260,`labels=${denseLabels}`);
  await page.locator('.ga-map-view').screenshot({path:path.join(outDir,'sn1-zoom-dense.png')});
  await page.getByRole('button',{name:'Sığdır'}).click();
  // --- compute LF (unless a previous session's result was auto-restored) then churn display filters ---
  let runCount=Number(await page.locator('.ga-map-view').getAttribute('data-run-count'));
  let resultId=await page.locator('.ga-map-view').getAttribute('data-result-id');
  if(resultId==='NOT_RUN'){
    await page.locator('[data-help-id="map.calculate"]').first().click();
    await page.waitForFunction(()=>!/İşleniyor/.test(document.querySelector('.ga-map-status [role=status]')?.textContent||''),null,{timeout:600000});
    runCount=Number(await page.locator('.ga-map-view').getAttribute('data-run-count'));
    resultId=await page.locator('.ga-map-view').getAttribute('data-result-id');
  }
  check('LF result present on SN1',runCount>=1&&resultId!=='NOT_RUN',`runs=${runCount} id=${resultId?.slice(0,14)}`);
  await ytmSummary.click();
  const boxes=page.locator('.ga-map-view .ga-area-menu .ga-area-list input');
  const n=await boxes.count();
  for(let round=0;round<4;round++){
    await page.locator('.ga-map-view .ga-area-menu>summary').evaluate(el=>{el.parentElement.open=true;});
    await boxes.nth(round%n).uncheck();
    await page.locator('.ga-map-view .ga-area-menu').getByRole('button',{name:'Tümünü seç'}).click();
    await page.locator('.ga-map-view .ga-voltage-menu>summary').evaluate(el=>{el.parentElement.open=true;});
    await page.locator('.ga-map-view .ga-voltage-menu').getByRole('button',{name:'Temizle'}).click();
    await page.locator('.ga-map-view .ga-voltage-menu').getByRole('button',{name:'Tümünü seç'}).click();
    await page.keyboard.press('Escape');
    await page.locator('select[aria-label="Hat yerleşimi"]').selectOption(round%2?'separated':'standard');
  }
  const runAfter=Number(await page.locator('.ga-map-view').getAttribute('data-run-count'));
  const resultAfter=await page.locator('.ga-map-view').getAttribute('data-result-id');
  check('display-filter churn triggers zero extra solver runs',runAfter===runCount,`runs=${runAfter}`);
  check('result identity unchanged after churn',resultAfter===resultId);
  check('computed LF result still displayed after churn',/NR yakınsadı/.test(await page.locator('.ga-map-status [role=status]').textContent()));
  await page.locator('.ga-map-view').screenshot({path:path.join(outDir,'sn1-after-churn.png')});
  check('no page errors on SN1',errors.length===0,errors.slice(0,3).join(' | '));
  await writeFile(path.join(outDir,'proof.json'),JSON.stringify({model:path.basename(model),importSeconds,results,areaCount,labels:{national:nationalLabels,dense:denseLabels},timestamp:new Date().toISOString()},null,2));
}finally{
  await browser?.close();
  try{await server.close();}catch{}
  setTimeout(()=>process.exit(results.some(r=>r.ok===false)?1:0),300).unref();
}
