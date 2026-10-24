/** Actual standalone final artifact: file:// load, native import, worker calculation and reload. */
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {navigateAnalysis,closeAnalysisDialogs} from './analysis-navigation.mjs';
const path=resolve('dist-portable/GridAnalyzer_v7.html'),bytes=await readFile(path),out='local-benchmark-results/sc-portable';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1366,height:768},acceptDownloads:true}),errors=[],external=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:\/\//,r=>{external.push(r.request().url());return r.abort();});
async function importModel(){await navigateAnalysis(page,'Model Yükle');await page.locator('#modelFileInput').setInputFiles('tests/fixtures/sc-mini-dgs.json');await page.waitForFunction(()=>!!document.querySelector('.ga-head-model')?.textContent&&!/Yükleniyor/.test(document.querySelector('footer [role="status"]')?.textContent??''));await navigateAnalysis(page,'Analizler');await closeAnalysisDialogs(page);await page.getByRole('button',{name:'Kısa Devre Analizi',exact:true}).click();}
async function exported(tag){const event=page.waitForEvent('download');await page.locator('.ga-analysis-compact .ga-compact-study').getByRole('button',{name:'JSON',exact:true}).click();const download=await event,file=out+'/'+tag+'.json';await download.saveAs(file);return JSON.parse(await readFile(file,'utf8'));}
try{
 await page.goto(pathToFileURL(path).href);await importModel();const primary=page.locator('.ga-analysis-compact .ga-compact-study');await primary.getByLabel('Toplu analiz YTM',{exact:true}).selectOption('AREA');await primary.getByRole('button',{name:'Analiz Et',exact:true}).click();await page.waitForFunction(()=>document.querySelector('footer [role="status"]')?.textContent?.startsWith('YTM tamamlandı'));
 const max=await exported('MAX');assert.equal(max.rows.length,2);const lv=max.rows.find(r=>r.Bara_FID==='SYN-B1'),z1=10*(10/110)**2+.1;assert.ok(Math.abs(lv['3F_Ikss_kA']-1.1*10/(Math.sqrt(3)*z1))<1e-6);assert.ok(Math.abs(lv['1F_Ikss_kA']-Math.sqrt(3)*1.1*10/Math.hypot(.06,2*z1+.08))<1e-6);
 await primary.getByLabel('Görüntülenen SC modu',{exact:true}).selectOption('MIN');const min=await exported('MIN');assert.equal(min.mode,'MIN');assert.ok(Math.abs(min.rows.find(r=>r.Bara_FID==='SYN-B1')['1F_Ikss_kA']-lv['1F_Ikss_kA']/1.1)<1e-6);
 await page.screenshot({path:out+'/portable-1366.png'});await page.reload();await importModel();await primary.getByLabel('Görüntülenen SC modu',{exact:true}).selectOption('MAX');const restored=await exported('restored-MAX');assert.deepEqual(restored.rows,max.rows);await primary.getByLabel('Görüntülenen SC modu',{exact:true}).selectOption('MIN');const restoredMin=await exported('restored-MIN');assert.deepEqual(restoredMin.rows,min.rows);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const proof={evidenceClass:'B_PORTABLE',urlScheme:'file:',artifactBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),browser:browser.version(),viewport:{width:1366,height:768},computedMaxRows:max.rows.length,computedMinRows:min.rows.length,reload:'MAX_MIN_IDENTITY_VALUES_EXACT',errors,external};await writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log('SC_PORTABLE_BROWSER '+JSON.stringify(proof));
}finally{await browser.close();}
