import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { syntheticBenchmarkPair } from '../tests/helpers/benchmark-model';
import { createServer } from 'node:http';
import { readFile,mkdir } from 'node:fs/promises';

const port=5180,url=`http://127.0.0.1:${port}/`,portable=process.argv.includes('--portable');
const artifact=portable?await readFile('dist-portable/GridAnalyzer_v7.html'):null;
const server=portable?createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(artifact);}).listen(port,'127.0.0.1'):spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({headless:true});
try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await delay(250);}if(!ready)throw Error('Benchmark smoke server unavailable');
  const page=await browser.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
  if(portable)await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto(url);await page.getByRole('button',{name:'KARŞILAŞTIRMA',exact:true}).click();
  const pair=syntheticBenchmarkPair(),view=page.locator('section[data-view="comparison"]');
  for(const [label,file] of [['Model ZIP',pair.model],['Benchmark ZIP',pair.benchmark]] as const)await view.getByLabel(label,{exact:true}).setInputFiles({name:file.name,mimeType:'application/zip',buffer:Buffer.from(await file.arrayBuffer())});
  await view.getByRole('button',{name:'İki ZIP’i aç',exact:true}).click();await page.waitForFunction(()=>document.querySelector('footer [role="status"]')?.textContent?.startsWith('Benchmark hazır'));
  await view.locator('tbody tr').first().waitFor();if(!(await view.textContent())?.includes('GA_NOT_CALCULATED'))throw Error('PF-only gate missing');
  await view.getByRole('button',{name:'JSON',exact:true}).click();
  await view.getByRole('button',{name:'GA Tam AC baz hesabı',exact:true}).click();await page.waitForFunction(()=>document.querySelector('footer [role="status"]')?.textContent?.includes('NR yakınsadı'));
  if(!(await view.locator('.ga-notice').first().textContent())?.includes('EXPLORATORY_ONLY'))throw Error('Unverified synthetic settings were incorrectly accepted for parity');
  await view.getByRole('button',{name:'N-1',exact:true}).click();await view.locator('tbody tr').first().click();
  await view.getByRole('button',{name:'Seçili vaka: GA Full AC doğrula',exact:true}).click();await page.waitForFunction(()=>document.querySelector('footer [role="status"]')?.textContent?.startsWith('N-1 AC'));
  await view.getByText(/GA_AC_POST_CONTINGENCY · ISLAND_UNSUPPLIED/).waitFor();
  await view.getByRole('button',{name:'Kısa Devre',exact:true}).click();await view.getByLabel('Karşılaştırma metriği').selectOption('ikssKa');
  if(!(await view.locator('tbody').textContent())?.includes('RECORDED_NUMERIC_ZERO'))throw Error('SC numeric zero lost');
  await view.getByLabel('Karşılaştırma metriği').selectOption('ipKa');if(!(await view.locator('tbody').textContent())?.includes('NOT_RECORDED'))throw Error('SC missing value became zero');
  await view.locator('summary').filter({hasText:'GA IEC 60909 kaynak hazırlığı'}).click();await view.getByText(/NOT_COMPUTABLE · IEC edisyonu/).waitFor();
  const download=page.waitForEvent('download');await view.getByRole('button',{name:'CSV',exact:true}).click();if((await download).suggestedFilename()!=='PF_Benchmark.csv')throw Error('Benchmark export unavailable');
  await page.getByRole('button',{name:'Harita',exact:true}).click();await page.getByLabel('Benchmark harita analizi').selectOption('SC');
  if(!await page.getByLabel('Benchmark harita kaynağı').locator('option[value="GA"]').isDisabled())throw Error('GA SC map incorrectly enabled');
  if(!await page.getByLabel('Benchmark harita kaynağı').locator('option[value="DELTA"]').isDisabled())throw Error('SC delta map incorrectly enabled');
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'KARŞILAŞTIRMA',exact:true}).click();await view.locator('tbody tr').first().waitFor();
  if(portable){await mkdir('local-benchmark-results',{recursive:true});await page.screenshot({path:'local-benchmark-results/portable-benchmark-mobile.png',fullPage:true});}
  if(errors.length)throw Error(errors.join('\n'));console.log('BENCHMARK_BROWSER_SMOKE OK: two ZIP / PF-only / LF / N1 AC island / SC zero-null / export / map gates / mobile');
}finally{await browser.close();if('kill' in server)server.kill();else server.close();}
