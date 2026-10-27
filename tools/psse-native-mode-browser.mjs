import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {zipSync,strToU8} from 'fflate';
import {syntheticRawx} from './psse-synthetic-cases.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const channel=process.argv[2]??'chrome';
assert.ok(['chrome','msedge'].includes(channel),'Channel must be chrome or msedge.');
if(process.argv[3])assert.ok(path.isAbsolute(process.argv[3]),'Optional HTML path must be absolute.');
const html=path.resolve(process.argv[3]??path.join(root,'dist-psse','index.html'));
const savPath='C:\\Users\\Murathan Yeniceli\\Downloads\\20261014_1200_SN3_TR0.sav';
const rawPath='C:\\Users\\Murathan Yeniceli\\Downloads\\20261014_1200_SN3_TR0.raw';
const dgsPath=path.join(root,'tests','fixtures','small-dgs.json');
const referencePath=path.join(root,'evidence','psse-ac-dc','synthetic-basic-reference.json');
const privateDir=path.join(root,'local-benchmark-results','psse-native-mode-browser',channel);
const reportPath=path.join(root,'evidence','psse-ac-dc','native-browser',`${channel}.json`);
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const countsExpected={bus:6851,line:2403,transformer:3703,generator:2920,load:2520};
const report={schema:'ga.psse.native-mode-browser.v1',status:'FAIL',urlScheme:'file:',channel,browserVersion:null,htmlSha256:null,htmlBytes:null,sourceFormats:{},sourceCounts:{},sourceSha256:{},loadTimingsMs:{},heapBytesAfterSavLoad:null,heapScope:'performance.memory snapshot for the main frame only; worker allocations excluded',heapSnapshotsAfterRealDc:null,dcResult:null,cancellation:null,syntheticResult:null,csvDownload:null,externalRequests:0,blockedNetworkRequests:0,consoleErrorCount:0,failedStep:'setup'};
let browser=null,errors=[],externalRequests=[],blockedRequests=[],failure=null;
const progress=(step)=>{report.failedStep=step;};
const modelFile=(name,bytes,mimeType='application/octet-stream')=>({name,mimeType,buffer:Buffer.from(bytes)});
function parseLocaleInteger(value){const normalized=String(value??'').trim().replaceAll('.','').replace(',','.');const parsed=Number(normalized);return Number.isInteger(parsed)?parsed:null;}
async function waitForMode(page,mode,formatOrName=null,timeout=120000){
 await page.waitForFunction(({mode,formatOrName})=>{
  const card=document.querySelector('.ga-mode-card')?.textContent?.trim(),model=document.querySelector('.ga-head-model')?.textContent??'',busy=document.querySelector('.ga-busy');
  return card===mode&&(formatOrName===null||model.includes(formatOrName))&&busy?.hidden===true;
 },{mode,formatOrName},{timeout});
}
async function openView(page,label){await page.locator('.ga-nav').getByRole('button',{name:label,exact:true}).click();}
async function getNativeSnapshot(page){
 await openView(page,'Şebeke Modeli');
 const summaryTab=page.locator('#ga-psse-workspace-tab-summary');await summaryTab.waitFor({state:'visible',timeout:30000});await summaryTab.click();
 const summaryPanel=page.locator('#ga-psse-workspace-panel-summary');await summaryPanel.waitFor({state:'visible',timeout:30000});await summaryPanel.locator('.ga-model-identity').waitFor({state:'visible',timeout:30000});
 return page.evaluate(()=>{
  const panel=document.querySelector('#ga-psse-workspace-panel-summary'),identities=[...(panel?.querySelectorAll('.ga-model-identity')??[])],visibleIdentities=identities.filter(item=>item.getClientRects().length>0),model=visibleIdentities[0]??null;
  const format=`${model?.textContent??''} ${document.querySelector('.ga-head-model')?.textContent??''}`.match(/\b(SAV|RAW|RAWX)\b/i)?.[1]?.toUpperCase()??null;
  const sha=model?.querySelector('.ga-model-sha')?.textContent?.trim()??null;
  const cards=[...(panel?.querySelectorAll('.ga-card-grid .ga-card')??[])].map(card=>({label:card.querySelector('span')?.textContent?.trim()??'',value:card.querySelector('strong')?.textContent?.trim()??''}));
  const byLabel=Object.fromEntries(cards.map(card=>[card.label,card.value]));
  const equipmentCounts={bus:byLabel['Bara']??null,line:byLabel['Hat']??null,transformer:byLabel['Trafo']??null,generator:byLabel['Jeneratör']??null,load:byLabel['Yük']??null};
  return{format,sha256:sha,equipmentCounts,visibleIdentityCount:visibleIdentities.length,heapBytes:typeof performance.memory?.usedJSHeapSize==='number'?performance.memory.usedJSHeapSize:null};
 });
}
function normalizedCounts(snapshot){return Object.fromEntries(Object.entries(snapshot.equipmentCounts).map(([key,value])=>[key,parseLocaleInteger(value)]));}
async function waitForCalculation(page,timeout=180000){
 const panel=page.locator('.ga-psse-analysis');
 await panel.waitFor({state:'visible',timeout:30000});
 await panel.getByText('CONVERGED',{exact:true}).waitFor({state:'visible',timeout});
 return panel;
}
async function cardValue(panel,label){return panel.locator('.ga-card').evaluateAll((cards,label)=>{const card=cards.find(item=>item.querySelector('span')?.textContent?.trim()===label);return card?.querySelector('strong')?.textContent?.trim()??null;},label);}
async function resultIdentity(panel){return panel.locator('.ga-psse-identity code').allTextContents();}
async function captureHeapSnapshots(context,browser,page){
 let mainFrame=null;
 try{const session=await context.newCDPSession(page);try{const heap=await session.send('Runtime.getHeapUsage');mainFrame={usedSizeBytes:heap.usedSize,totalSizeBytes:heap.totalSize,embedderHeapUsedBytes:heap.embedderHeapUsedSize,backingStorageBytes:heap.backingStorageSize};}finally{await session.detach();}}catch{return{kind:'point-in-time; not peak',mainFrame:null,calculationWorkers:{available:false,targetCount:0,reason:'main-frame CDP snapshot unavailable'}};}
 let devtools=null;
 try{
  devtools=await browser.newBrowserCDPSession();const {targetInfos}=await devtools.send('Target.getTargets');const workers=targetInfos.filter(target=>target.type==='worker');const snapshots=[];
  for(const target of workers){let sessionId=null;try{
   ({sessionId}=await devtools.send('Target.attachToTarget',{targetId:target.targetId,flatten:false}));
   const requestId=Date.now()+snapshots.length+1,heap=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{devtools.off('Target.receivedMessageFromTarget',receive);reject(new Error('worker snapshot timeout'));},5000);
    const receive=event=>{if(event.sessionId!==sessionId)return;let message;try{message=JSON.parse(event.message);}catch{return;}if(message.id!==requestId)return;clearTimeout(timeout);devtools.off('Target.receivedMessageFromTarget',receive);if(message.error)reject(new Error('worker snapshot unavailable'));else resolve(message.result);};
    devtools.on('Target.receivedMessageFromTarget',receive);
    devtools.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:requestId,method:'Runtime.getHeapUsage',params:{}})}).catch(error=>{clearTimeout(timeout);devtools.off('Target.receivedMessageFromTarget',receive);reject(error);});
   });
   snapshots.push({usedSizeBytes:heap.usedSize,totalSizeBytes:heap.totalSize,embedderHeapUsedBytes:heap.embedderHeapUsedSize,backingStorageBytes:heap.backingStorageSize});
  }catch{}finally{if(sessionId)await devtools.send('Target.detachFromTarget',{sessionId}).catch(()=>{});}}
  const calculationWorkers=snapshots.length?{available:true,targetCount:snapshots.length,snapshots}:{available:false,targetCount:workers.length,reason:workers.length?'worker CDP snapshot unavailable':'no worker target exposed'};
  return{kind:'point-in-time; not peak',mainFrame,calculationWorkers};
 }catch{return{kind:'point-in-time; not peak',mainFrame,calculationWorkers:{available:false,targetCount:0,reason:'browser worker targets are not exposed'}};}finally{if(devtools)await devtools.detach().catch(()=>{});}
}
async function downloadTextFrom(page,button,extension){
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),button.click()]);
 const file=await download.path();assert.ok(file,`${extension} download has a temporary path`);
 return{download,bytes:await readFile(file)};
}
async function visibleNativeCounts(page,expectedFormat){
 const snapshot=await getNativeSnapshot(page),counts=normalizedCounts(snapshot);
 // waitForMode above verifies the visible source heading before navigation; its heading can change when the model tab opens.
 snapshot.format=snapshot.format??expectedFormat;
 assert.equal(snapshot.visibleIdentityCount,1,'exactly one source identity is visible in the active PSS/E summary panel');
 assert.match(snapshot.sha256??'',/^[0-9a-f]{64}$/i,'source SHA-256 is visible in the PSS/E model summary');
 return{snapshot,counts};
}

try{
 progress('read-final-html');
 const htmlBytes=await readFile(html);report.htmlBytes=htmlBytes.byteLength;report.htmlSha256=sha(htmlBytes);
 const savBytes=await readFile(savPath),rawBytes=await readFile(rawPath),dgsBytes=await readFile(dgsPath),referenceBytes=await readFile(referencePath);
 const browserArgs=['--disable-background-networking','--disable-component-update','--disable-sync','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND'];
 await mkdir(privateDir,{recursive:true});await mkdir(path.dirname(reportPath),{recursive:true});
 progress('launch-browser');
 browser=await chromium.launch({channel,headless:true,args:browserArgs});report.browserVersion=browser.version();
 const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});
 await context.route(/^https?:\/\//,async route=>{blockedRequests.push(route.request().url());await route.abort();});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 progress('load-file-html');const firstLoad=Date.now();await page.goto(pathToFileURL(html).href,{waitUntil:'load'});await page.waitForSelector('.ga-app-head');await page.locator('#modelFileInput').waitFor({state:'attached'});
 const navLabels=['Şebeke Modeli','Harita','Tek Hat Şeması','Analizler'];for(const label of navLabels)assert.equal(await page.locator('.ga-nav').getByRole('button',{name:label,exact:true}).count(),1,`native navigation ${label}`);
 const input=page.locator('#modelFileInput');

 progress('load-native-sav');const savStarted=Date.now();await input.setInputFiles(modelFile('actual-case.sav',savBytes));await waitForMode(page,'PSS/E MODU','SAV');report.loadTimingsMs.sav=Date.now()-savStarted;
 let snapshot=await visibleNativeCounts(page,'SAV');report.sourceFormats.sav=snapshot.snapshot.format;report.sourceSha256.sav=snapshot.snapshot.sha256;report.sourceCounts.sav=snapshot.counts;report.heapBytesAfterSavLoad=snapshot.snapshot.heapBytes;
 assert.equal(snapshot.snapshot.format,'SAV');assert.deepEqual(snapshot.counts,countsExpected,'native SAV inventory counts');assert.equal(snapshot.snapshot.sha256,sha(savBytes),'SAV source hash is exact');
 await page.screenshot({path:path.join(privateDir,'actual-sav-loaded.png'),fullPage:true});

 progress('load-native-raw');const rawStarted=Date.now();await input.setInputFiles(modelFile('actual-case.raw',rawBytes));await waitForMode(page,'PSS/E MODU','RAW');report.loadTimingsMs.raw=Date.now()-rawStarted;
 snapshot=await visibleNativeCounts(page,'RAW');report.sourceFormats.raw=snapshot.snapshot.format;report.sourceSha256.raw=snapshot.snapshot.sha256;report.sourceCounts.raw=snapshot.counts;
 assert.equal(snapshot.snapshot.format,'RAW');assert.deepEqual(snapshot.counts,countsExpected,'native RAW inventory counts');assert.equal(snapshot.snapshot.sha256,sha(rawBytes),'RAW source hash is exact');assert.notEqual(snapshot.snapshot.sha256,report.sourceSha256.sav,'RAW and SAV remain distinguishable source inputs');
 await page.screenshot({path:path.join(privateDir,'actual-raw-loaded.png'),fullPage:true});

 progress('load-in-memory-sav-zip');const zipStarted=Date.now();const savZip=zipSync({'models/actual-case.sav':new Uint8Array(savBytes)});await input.setInputFiles(modelFile('actual-case.zip',savZip,'application/zip'));
 // A one-member PSS/E archive is intentionally extracted without showing the mixed-member picker.
 await waitForMode(page,'PSS/E MODU','SAV');report.loadTimingsMs.savZip=Date.now()-zipStarted;
 snapshot=await visibleNativeCounts(page,'SAV');report.sourceFormats.savZip=snapshot.snapshot.format;report.sourceSha256.savZip=snapshot.snapshot.sha256;report.sourceCounts.savZip=snapshot.counts;
 assert.equal(snapshot.snapshot.format,'SAV');assert.deepEqual(snapshot.counts,countsExpected,'native SAV ZIP inventory counts');assert.equal(snapshot.snapshot.sha256,report.sourceSha256.sav,'ZIP member bytes retain SAV source identity');
 await page.screenshot({path:path.join(privateDir,'actual-sav-zip-loaded.png'),fullPage:true});

 progress('calculate-real-dc');await openView(page,'Analizler');const actualPanel=page.locator('.ga-psse-analysis');await actualPanel.waitFor({state:'visible',timeout:30000});await actualPanel.getByLabel('PSS/E çözüm yöntemi').selectOption('LOSSLESS_DC');
 const dcStarted=Date.now();await actualPanel.getByRole('button',{name:'Hesapla',exact:true}).click();await page.waitForFunction(()=>[...(document.querySelector('.ga-psse-analysis')?.querySelectorAll('.ga-card')??[])].some(card=>card.querySelector('span')?.textContent?.trim()==='Durum'&&card.querySelector('strong')?.textContent?.trim()==='LIMITED_PROFILE'),null,{timeout:300000});report.loadTimingsMs.realDc=Date.now()-dcStarted;
 const publicationStatus=await cardValue(actualPanel,'Durum'),coverage=await cardValue(actualPanel,'Fizik kapsamı'),sourceCards=await actualPanel.locator('.ga-card').evaluateAll(cards=>cards.filter(card=>card.querySelector('span')?.textContent?.trim()==='Kaynak').map(card=>({value:card.querySelector('strong')?.textContent?.trim()??null,title:card.getAttribute('title')})));
 assert.equal(publicationStatus,'LIMITED_PROFILE','real SAV DC partial result is published with the LIMITED_PROFILE badge');assert.equal(coverage,'PARTIAL','real SAV DC scope remains explicitly partial');assert.ok(sourceCards.some(card=>card.value==='GA hesaplandı'&&card.title==='GA_PSSE_CALCULATED'),'real DC result exposes calculated PSS/E provenance');
 progress('export-real-dc-status');const realJsonDownload=await downloadTextFrom(page,actualPanel.getByRole('button',{name:'GA hesap sonucunu JSON indir',exact:true}),'json');const realExport=JSON.parse(realJsonDownload.bytes.toString('utf8'));
 assert.equal(realExport.source,'GA_PSSE_CALCULATED','real DC export preserves calculation provenance');assert.equal(realExport.identity?.mode,'PSSE','real DC export preserves PSS/E identity');assert.equal(realExport.numericalStatus,'CONVERGED','real DC numerical status remains available in the exported result');assert.equal(realExport.publicationStatus,'LIMITED_PROFILE','real DC export carries its limited-profile publication status');assert.equal(realExport.diagnostics?.voltageMagnitudeStatus,'FIXED_DC_ASSUMPTION_NOT_SOLVED','DC 1 pu remains an explicit model assumption');
 assert.ok(Array.isArray(realExport.busResults)&&realExport.busResults.length>0,'real DC export contains bus results');assert.ok(realExport.busResults.every(bus=>bus.vmPu===null),'lossless DC does not fabricate AC bus voltage magnitudes');
 await actualPanel.getByRole('button',{name:'Baralar',exact:true}).click();const busVmUnavailable=await actualPanel.locator('.ga-psse-result-table table').evaluate(table=>{const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent?.trim()??''),vmHeader=headers.find(header=>header.includes('Vm'))??'',vmIndex=headers.indexOf(vmHeader),values=[...table.querySelectorAll('tbody tr')].map(row=>row.querySelectorAll('td')[vmIndex]?.textContent?.trim()??null);return{vmHeader,vmIndex,values};});
 assert.equal(busVmUnavailable.vmHeader,'Vm (DC’de çözülmez)','DC result table labels the fixed 1 pu assumption as unsolved Vm');assert.ok(busVmUnavailable.vmIndex>=0&&busVmUnavailable.values.length>0&&busVmUnavailable.values.every(value=>value==='—'),'DC result table visibly reports bus Vm as unavailable');
 await actualPanel.getByRole('button',{name:'Dallar',exact:true}).click();
 const unavailable=await actualPanel.locator('.ga-psse-result-table table').evaluate(table=>{const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent?.trim()??''),row=table.querySelector('tbody tr'),cells=[...(row?.querySelectorAll('td')??[])].map(td=>td.textContent?.trim()??''),required=['Q1 Mvar','Q2 Mvar','S1 MVA','S2 MVA','I1 A','I2 A'];return Object.fromEntries(required.map(label=>[label,headers.includes(label)?cells[headers.indexOf(label)]:null]));});
 assert.deepEqual(unavailable,{'Q1 Mvar':'—','Q2 Mvar':'—','S1 MVA':'—','S2 MVA':'—','I1 A':'—','I2 A':'—'},'DC Q, MVA and current values remain unavailable');
 await actualPanel.getByRole('button',{name:'Jeneratörler',exact:true}).click();
 const generatorQ=await actualPanel.locator('.ga-psse-result-table table tbody tr:first-child td').nth(2).textContent();assert.equal(generatorQ?.trim(),'—','DC machine Q is unavailable');
 const actualIdentity=await resultIdentity(actualPanel);await writeFile(path.join(privateDir,'actual-real-dc-identity.json'),JSON.stringify({sourceSha256:report.sourceSha256.sav,identityFields:actualIdentity,numericalStatus:realExport.numericalStatus,publicationStatus:realExport.publicationStatus,physicsCoverage:coverage,method:'LOSSLESS_DC'},null,2));
 report.heapSnapshotsAfterRealDc=await captureHeapSnapshots(context,browser,page);
 await page.screenshot({path:path.join(privateDir,'actual-real-dc.png'),fullPage:true});
 report.dcResult={status:publicationStatus,numericalStatus:realExport.numericalStatus,publicationStatus:realExport.publicationStatus,physicsCoverage:coverage,source:'GA_PSSE_CALCULATED',qAndCurrentUnavailable:true,mainFrameHeapBytesAfterSavLoad:report.heapBytesAfterSavLoad};

 progress('cancel-real-dc-by-source-change');await actualPanel.getByRole('button',{name:'Dallar',exact:true}).click();await actualPanel.getByRole('button',{name:'Hesapla',exact:true}).click();await page.locator('.ga-busy').waitFor({state:'visible',timeout:15000});const cancellationStarted=Date.now();
 await input.setInputFiles(modelFile('small-dgs.json',dgsBytes,'application/json'));await waitForMode(page,'DGS MODU','small-dgs');const elapsedUntilDgsLoadedMs=Date.now()-cancellationStarted;
 const cancelWaitMs=Math.max(5000,(report.loadTimingsMs.realDc??0)+1000);await page.waitForTimeout(cancelWaitMs);
 assert.equal(await page.locator('.ga-mode-card').textContent(),'DGS MODU');assert.ok((await page.locator('.ga-head-model').textContent())?.includes('small-dgs.json'),'DGS source remains active after the canceled PSS/E request');
 await openView(page,'Analizler');assert.equal(await page.locator('.ga-psse-analysis').isVisible(),false,'PSS/E result panel is not visible while DGS is active');
 report.cancellation={secondDcStartedWhileBusy:true,sourceChangedToDgs:true,dgsRemainedAfterWait:true,waitMs:cancelWaitMs,elapsedUntilDgsLoadedMs,stalePsseResultVisible:false};
 await page.screenshot({path:path.join(privateDir,'dgs-after-dc-source-change.png'),fullPage:true});

 progress('reload-synthetic-psse');const synthetic=syntheticRawx('basic'),syntheticBytes=Buffer.from(synthetic,'utf8');await input.setInputFiles(modelFile('basic.rawx',syntheticBytes));await waitForMode(page,'PSS/E MODU','basic.rawx');await openView(page,'Analizler');const syntheticPanel=page.locator('.ga-psse-analysis');await syntheticPanel.waitFor({state:'visible',timeout:30000});
 assert.ok(await syntheticPanel.getByText('Bu PSS/E senaryosu için GA_PSSE_CALCULATED sonucu yok.',{exact:true}).isVisible(),'switching back to synthetic PSS/E starts without the old real-model result');
 await syntheticPanel.getByLabel('Jeneratör reaktif güç sınırları').uncheck();await syntheticPanel.getByLabel('PSS/E çözüm yöntemi').selectOption('NR_POLAR');const syntheticStarted=Date.now();await syntheticPanel.getByRole('button',{name:'Hesapla',exact:true}).click();await syntheticPanel.getByText('CONVERGED',{exact:true}).waitFor({state:'visible',timeout:30000});const syntheticSolveMs=Date.now()-syntheticStarted;
 const syntheticSourceCards=await syntheticPanel.locator('.ga-card').evaluateAll(cards=>cards.filter(card=>card.querySelector('span')?.textContent?.trim()==='Kaynak').map(card=>card.getAttribute('title')));assert.ok(syntheticSourceCards.includes('GA_PSSE_CALCULATED'),'synthetic AC result exposes calculated PSS/E provenance');

 progress('export-synthetic-result-json');const jsonDownload=await downloadTextFrom(page,syntheticPanel.getByRole('button',{name:'GA hesap sonucunu JSON indir',exact:true}),'json');const exported=JSON.parse(jsonDownload.bytes.toString('utf8'));
 assert.equal(exported.schema,'ga.psse.calculation.v1');assert.equal(exported.source,'GA_PSSE_CALCULATED');assert.equal(exported.identity.mode,'PSSE');assert.equal(exported.identity.sourceSha256,sha(syntheticBytes));assert.match(exported.identity.modelHash,/^[0-9a-f]{64}$/);assert.match(exported.identity.scenarioHash,/^[0-9a-f]{64}$/);assert.equal(exported.id,exported.identity.id);assert.equal(exported.numericalStatus,'CONVERGED');assert.equal(exported.publicationStatus,'CONVERGED');assert.ok(Array.isArray(exported.busResults)&&exported.busResults.length>0&&exported.busResults.every(bus=>Number.isFinite(bus.vmPu)),'synthetic AC retains solved Vm values');
 progress('export-synthetic-csv');await syntheticPanel.getByRole('button',{name:'Baralar',exact:true}).click();const syntheticVmValues=await syntheticPanel.locator('.ga-psse-result-table table').evaluate(table=>{const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent?.trim()??''),index=headers.findIndex(header=>header.includes('Vm'));return[...table.querySelectorAll('tbody tr')].map(row=>row.querySelectorAll('td')[index]?.textContent?.trim()??null);});assert.ok(syntheticVmValues.length>0&&syntheticVmValues.every(value=>value&&value!=='—'),'synthetic AC bus table retains solved Vm');const csvDownload=await downloadTextFrom(page,syntheticPanel.getByRole('button',{name:'Seçili hesap tablosunu CSV indir',exact:true}),'csv');const csv=csvDownload.bytes.toString('utf8');assert.ok(csv.startsWith('\uFEFF'),'CSV includes its UTF-8 BOM');assert.ok(csv.includes('GA_PSSE_CALCULATED'),'CSV retains source provenance');assert.ok(csv.includes('Vm (pu)'),'CSV includes the selected result table');assert.ok(csv.includes('Numerical status'),'CSV includes numerical status');assert.ok(csv.includes('Publication status'),'CSV includes publication status');assert.ok(csv.includes('Profile note'),'CSV includes the profile note column');

 progress('compare-synthetic-reference');const referenceInput=syntheticPanel.locator('input[type="file"][aria-label="PSS/E referans JSON"]');await referenceInput.setInputFiles(modelFile('synthetic-basic-reference.json',referenceBytes,'application/json'));
 const referencePanel=syntheticPanel.locator('.ga-panel').filter({hasText:'PSS/E_REFERENCE karşılaştırması'}),referenceSummary=referencePanel.locator('p').first();await referenceSummary.getByText(/PSSE_REFERENCE · MATCHED/).waitFor({timeout:10000});
 const foreign=structuredClone(JSON.parse(referenceBytes.toString('utf8')));foreign.source.sha256='0'.repeat(64);await referenceInput.setInputFiles(modelFile('foreign-source-reference.json',Buffer.from(JSON.stringify(foreign)),'application/json'));
 await referenceSummary.getByText(/Referans reddedildi: Kaynak SHA-256/).waitFor({timeout:10000});assert.doesNotMatch(await referencePanel.innerText(),/MATCHED/,'foreign-source reference is rejected and no prior MATCHED message or detail remains visible');
 await page.screenshot({path:path.join(privateDir,'synthetic-reference-rejected.png'),fullPage:true});
 const external=(await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>/^https?:/i.test(name))));externalRequests=external;
 assert.deepEqual(externalRequests,[],'offline file page made no external requests');assert.deepEqual(blockedRequests,[],'offline page did not try blocked external URLs');assert.deepEqual(errors,[],'browser had no JS or console errors');
 report.syntheticResult={status:'CONVERGED',numericalStatus:exported.numericalStatus,publicationStatus:exported.publicationStatus,source:'GA_PSSE_CALCULATED',referenceBeforeForeign:'MATCHED',foreignReference:'rejected; prior MATCHED cleared',solveMs:syntheticSolveMs,jsonIdentity:{mode:exported.identity.mode,sourceSha256:exported.identity.sourceSha256,modelHash:exported.identity.modelHash,scenarioHash:exported.identity.scenarioHash,resultId:exported.identity.id}};
 report.csvDownload={status:'PASS',selectedTable:'buses',containsIdentity:true,containsSourceUnits:true};report.externalRequests=externalRequests.length;report.consoleErrorCount=errors.length;report.status='PASS';report.failedStep=null;
}catch(error){failure=error;report.status='FAIL';report.errorClass=error instanceof Error?error.name:'UnknownError';report.consoleErrorCount=errors.length;report.externalRequests=externalRequests.length;}
finally{
 if(browser){try{await browser.close();}catch{report.status='FAIL';if(!failure)failure=new Error('Browser close failed');}}
 if(failure)await writeFile(path.join(privateDir,'failure-detail.txt'),failure instanceof Error?(failure.stack??failure.message):String(failure));
 report.externalRequests=externalRequests.length;report.blockedNetworkRequests=blockedRequests.length;report.consoleErrorCount=errors.length;
 await mkdir(path.dirname(reportPath),{recursive:true});await mkdir(privateDir,{recursive:true});
 await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
}
if(failure){console.error(`PSSE_NATIVE_MODE_BROWSER FAIL at ${report.failedStep} (${report.errorClass??'Error'}); sanitized report: ${path.relative(root,reportPath)}`);process.exitCode=1;}else console.log(`PSSE_NATIVE_MODE_BROWSER ${JSON.stringify(report)}`);
