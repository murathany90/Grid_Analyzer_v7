import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const artifact=process.env.PSSE_PORTABLE??root+'dist/Grid_Analyzer_PSSE_Portable.html';
test('standalone Studio gate: latest host, native editor and immutable offline round-trip',async()=>{
 const html=await fs.readFile(artifact,'utf8');
 assert(html.includes('name="ga-studio-native-sld" content="1"'),'Build is missing the standalone native SLD integration marker');
 const begin=html.indexOf('globalThis.__GA_PSSE_BUILD__=')+'globalThis.__GA_PSSE_BUILD__='.length,end=html.indexOf(';',begin),identity=JSON.parse(html.slice(begin,end));
 assert.match(identity.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(identity.schema,2);
 const style=html.slice(html.indexOf('<style>')+7,html.indexOf('</style>')),app=html.slice(end+1,html.lastIndexOf('</script>'));
 assert.equal(identity.bundleSha256,crypto.createHash('sha256').update(app+'\0'+style).digest('hex'));
 assert.equal(identity.dirty,!!execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8'}).trim(),'dirty must include sibling SLD source changes');
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1366,height:768},offline:true});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 try{
  await page.goto(pathToFileURL(artifact).href);await page.locator('#v8-nav').waitFor();assert.equal(await page.locator('#pse-root').count(),1);
  assert.deepEqual(await page.locator('#v8-nav button').allTextContents(),['Şebeke Modeli','Harita','Tek Hat Şeması','Analizler','Karşılaştırma','Ayarlar','Yardım']);
  assert.equal(await page.evaluate(()=>document.querySelector('meta[name="ga-build-sha"]').content),await page.evaluate(()=>__GA_PSSE_BUILD__.gitSha));
  await page.locator('#pse-file').setInputFiles(root+'tests/fixtures/two-bus.raw');await page.waitForFunction(()=>psseStudio.controller.psseNetwork&&!psseStudio.controller.busy);
  const before=await page.evaluate(()=>{const c=psseStudio.controller;return {source:c.psseInspection.source.sha256,network:c.psseNetwork.modelHash,buses:c.psseNetwork.buses.length,branches:c.psseNetwork.branches.length};});
  await page.locator('[data-route=sld]').click();await page.locator('#ga-sld-studio').waitFor();
  const roundtrip=await page.evaluate(async()=>{
   const a=GASldStudio,doc={format:'ga-sld-v1',fileVersion:'2.0.51.1',layers:[{n:0,desc:'Public synthetic',vis:'Visible'}],components:[
    {id:1,t:'Symbol',stype:'Busbar',map:'BU 1',layer:0,color:255,pos:[0,0],len:3,width:.1,rot:90},
    {id:2,t:'Symbol',stype:'Busbar',map:'BU 2',layer:0,color:255,pos:[4,2],len:2,width:.1,rot:90},
    {id:3,t:'Link',layer:0,color:255,p1:{sym:1,idx:0,pos:[1,0]},p2:{sym:2,idx:0,pos:[4,2]},knees:[[1,1],[4,1]]},
    {id:4,t:'Label',layer:0,color:255,pos:[0,-.3],owner:1,text:'Public synthetic'}]};
   const initial=a.serializeSldBinary(doc);assertNative(await a.importOne(new File([initial],'synthetic.sld')));
   const original=a.getActiveDoc().gaSld.components.find(c=>c.id===1).pos.slice();a.translateSymbolById(1,.2,.1);a.undo();const undo=a.getActiveDoc().gaSld.components.find(c=>c.id===1).pos;a.redo();
   const exported=await a.exportNativeSld({skipDownload:true});assertNative(exported);const reparsed=a.parseSldBinary(exported.bytes);assertNative(await a.importOne(new File([exported.bytes],'synthetic-roundtrip.sld')));
   return {undo:JSON.stringify(undo)===JSON.stringify(original),counts:reparsed.components.reduce((r,c)=>(r[c.t]=(r[c.t]||0)+1,r),{}),tabs:a.getDocuments().length,bytes:exported.bytes.length};
   function assertNative(r){if(!r.ok)throw Error(r.error??'Native SLD failed');}
  });
  assert(roundtrip.undo);assert.deepEqual(roundtrip.counts,{Symbol:2,Link:1,Label:1});assert(roundtrip.tabs>=2);assert(roundtrip.bytes>100);
  assert(await page.locator('.ga-studio-sld-symbol').count()>0);assert(await page.locator('.ga-studio-stage svg').count()>0);
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'💾 Native .sld Kaydet',exact:true}).click();assert((await dl).suggestedFilename().endsWith('.sld'));
  const after=await page.evaluate(()=>{const c=psseStudio.controller;return {source:c.psseInspection.source.sha256,network:c.psseNetwork.modelHash,buses:c.psseNetwork.buses.length,branches:c.psseNetwork.branches.length};});assert.deepEqual(after,before);
  await page.locator('[data-route=map]').click();assert.equal(await page.locator('.ga-v11-voltage input[type=checkbox]').count(),5);
  const rawx={network:{owner:{fields:['iowner','owname'],data:[[1,'Public Owner']]},area:{fields:['iarea','isw','pdes','ptol','arname'],data:[[1,1,0,10,'Public Area']]},caseid:{fields:['ic','sbase','rev','basfrq','title1','title2'],data:[0,100,36,50,'Public RAWX fixture','']},bus:{fields:['ibus','name','baskv','ide','area','zone','owner','vm','va'],data:[[1,'Public 1',154,3,1,1,1,1,0],[2,'Public 2',154,1,1,1,1,1,0]]},acline:{fields:['ibus','jbus','ckt','rpu','xpu','bpu','stat'],data:[[1,2,'01',.01,.1,0,1]]}}};
  await page.locator('#pse-file').setInputFiles({name:'public-two-bus.rawx',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(rawx))});
  await page.waitForFunction(()=>psseStudio.controller.psseInspection?.source.format==='RAWX'&&!psseStudio.controller.busy);
  assert.equal(await page.evaluate(()=>psseStudio.controller.psseNetwork.buses.length),2);
  assert.equal(await page.evaluate(()=>psseStudio.controller.psseInspection.equipment.find(e=>e.kind==='line').fields.ckt),'01');
  await page.locator('[data-route=model]').click();assert((await page.locator('#grid-body').innerText()).includes('Public Owner'));assert((await page.locator('#grid-body').innerText()).includes('Public Area'));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 }finally{await browser.close();}
});
