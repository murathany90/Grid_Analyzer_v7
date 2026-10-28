/** Extract and launch the delivered public archive in both installed browsers. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {chromium} from 'playwright';
import {syntheticRawx} from './psse-synthetic-cases.ts';
const root=fileURLToPath(new URL('../',import.meta.url)),archive=path.resolve(process.argv[2]??path.join(os.homedir(),'Downloads','GA_PSSE_AC_DGS_MAP_V5_OFFLINE.zip')),sha=bytes=>createHash('sha256').update(bytes).digest('hex'),bytes=fs.readFileSync(archive),entries=unzipSync(bytes);
assert.equal(fs.readFileSync(archive+'.sha256','utf8').split(/\s+/)[0],sha(bytes),'archive SHA sidecar');
const metadata=JSON.parse(new TextDecoder().decode(entries['DELIVERY_METADATA.json'])),manifest=new TextDecoder().decode(entries['SHA256SUMS.txt']);
for(const line of manifest.trim().split('\n')){const match=/^([0-9a-f]{64})  (.+)$/.exec(line);assert.ok(match,'valid SHA manifest row');assert.ok(entries[match[2]],'manifest member exists');assert.equal(sha(entries[match[2]]),match[1],'member SHA '+match[2]);}
assert.equal(sha(entries['index.html']),metadata.htmlSha256);
const extraction=path.join(root,'.tmp','psse-v5-release-'+metadata.sourceCommit.slice(0,12));fs.mkdirSync(extraction,{recursive:true});
for(const [name,data]of Object.entries(entries)){const target=path.resolve(extraction,name);assert.ok(target.startsWith(extraction+path.sep),'archive traversal rejected');assert.ok(!/\.(sav|raw|rawx|dll|pyd|exe|pyc|png|jpg)$/i.test(name),'private/vendor artifact rejected');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);}
const checks=[];
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true,args:['--disable-background-networking','--disable-component-update','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND']});
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768}}),blocked=[],errors=[];await context.route(/^https?:\/\//,async route=>{blocked.push(route.request().url());await route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(pathToFileURL(path.join(extraction,'index.html')).href,{waitUntil:'load'});await page.waitForSelector('.ga-app-head');
  await page.locator('#modelFileInput').setInputFiles({name:'original-public-package-check.rawx',mimeType:'application/octet-stream',buffer:Buffer.from(syntheticRawx('basic'),'utf8')});
  await page.waitForFunction(()=>document.querySelector('.ga-mode-card')?.textContent==='PSS/E MODU');await page.locator('.ga-nav').getByRole('button',{name:'Analizler',exact:true}).click();
  await page.locator('.ga-psse-analysis:visible').getByRole('button',{name:'Hesapla',exact:true}).click();
  await page.waitForFunction(()=>{const cards=[...document.querySelectorAll('.ga-psse-analysis .ga-card')],read=label=>cards.find(c=>c.querySelector('span')?.textContent===label)?.querySelector('strong')?.textContent;return read('Yöntem')==='NR_POLAR'&&['CONVERGED','LIMITED_PROFILE'].includes(read('Durum'));},undefined,{timeout:30000});
  const external=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/^https?:/i.test(r.name)).length);assert.equal(external,0);assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
  checks.push({channel,version:browser.version(),status:'PASS',scheme:'file:',publicFixtureNr:'CONVERGED',externalRequests:external,blockedRequests:blocked.length,errors});
 }finally{await browser.close();}
}
const report={schema:'ga.psse.v5.archive-verification.v1',status:'PASS',sourceCommit:metadata.sourceCommit,zipSha256:sha(bytes),htmlSha256:metadata.htmlSha256,manifest:'PASS',archiveRoundtrip:'PASS',privateOrVendorFilesIncluded:false,checks};
fs.writeFileSync(archive+'.verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
