import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {assertStudyPanel,assertLongTooltip} from './map-panel-acceptance.mjs';

const privatePath=process.env.GA_AUDIT_PRIVATE_CACHE,privateData=privatePath?await readFile(privatePath,'utf8'):null;
const port=5372,server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',windowsHide:true});
const css=['tokens','layout','catalog','components','map','analysis','responsive','benchmark','ui-workspace'].map(f=>`import '/src/styles/${f}.css';`).join('');
const html=`<!doctype html><html lang="tr"><meta charset="utf-8"><body><main id="app"></main><script type="module">
${css}
import {Application} from '/src/app/controller.ts';
import {createMapView} from '/src/map/map-view.ts';
import {scAuditFixture} from '/tests/helpers/study-audit.ts';
import {ScenarioStore} from '/src/domain/scenario/overlay.ts';
import {workspaceMapSelection} from '/src/domain/results/workspace.ts';
import {studyResultRows} from '/src/features/analysis/study-result-rows.ts';
window.solverRequests=[];const Native=Worker;window.Worker=class extends Native{postMessage(m,...a){if(/^(RUN_|SC_FAULT_CATALOG)/.test(m.type)){window.solverRequests.push(m.type);throw Error('Audit must reuse cached results');}super.postMessage(m,...a);}};
const ctx=new Application();window.ctx=ctx;
const fixture=scAuditFixture(70),data=${privateData?'await (await fetch("/private-acceptance")).json()':'null'};
ctx.network=data?.network??fixture.network;ctx.benchmark=data?.benchmark??fixture.benchmark;
ctx.scenario=data?new ScenarioStore(ctx.network.modelHash,ctx.network.studyCase):fixture.ctx.scenario;
if(data){ctx.analysisSettings.update(data.settings);ctx.powerFactoryControlContextHash=data.controlHash;ctx.powerFactoryControlContextNumericFile=data.controlFile;ctx.resultStore.expect('base',data.lf.identity);ctx.resultStore.accept('base',data.lf);ctx.scContext=data.scContext;ctx.hybridResult=data.hybrid;ctx.scCatalog=data.catalog;ctx.filters.areaId=data.areaId??'';}
ctx.scResult=data?.sc??fixture.result([fixture.fault(0,'CALCULATED_NETWORK_APPROXIMATION'),fixture.fault(1),fixture.fault(2,'CALCULATED_NETWORK_APPROXIMATION')]);
ctx.resultView.analysis='SC';ctx.resultView.source='GA';ctx.resultView.metric='ikssKa';ctx.resultView.faultId=ctx.scResult.faults[0].physicalTerminalFid;ctx.resultView.phase='POST';ctx.benchmarkMap=workspaceMapSelection(ctx);ctx.view='map';
const map=createMapView(ctx);document.querySelector('#app').append(map.element);ctx.subscribe(()=>map.render());ctx.notify();
window.inspect=()=>{const t=performance.now(),s=studyResultRows(ctx,ctx.benchmarkMap);return {catalog:s.catalogCount,ga:s.gaCalculatedCount,pf:s.pfReferenceCount,blocked:s.gaBlockedCount,notRun:s.gaNotRunCount,partition:s.uniqueElectricalPartitionCount,ms:performance.now()-t,rows:s.rows.slice(0,3).map(r=>({status:r.status,ga:r.ikss,pf:r.pfIkss}))};};
window.ready=true;
</script></body></html>`;
let browser,page;const proof={dataset:privatePath?'ACTUAL_CACHED_MODEL':'SYNTHETIC_UI_FIXTURE',geometry:[],errors:[]};
try{
  for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:'+port)).ok)break;}catch{}await delay(250);}
  browser=await chromium.launch({headless:true,args:['--js-flags=--max-old-space-size=6144']});page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(30000);page.on('pageerror',e=>proof.errors.push(e.message));
  await page.route('**/audit.html',r=>r.fulfill({contentType:'text/html',body:html}));if(privateData)await page.route('**/private-acceptance',r=>r.fulfill({contentType:'application/json',body:privateData}));
  await page.goto('http://127.0.0.1:'+port+'/audit.html');await page.waitForFunction(()=>window.ready);await page.getByRole('button',{name:'Elektriksel Sonuçlar',exact:true}).click();const shared=page.locator('.ga-lightning .ga-workspace-results');
  proof.sc=await page.evaluate(()=>window.inspect());assert.ok(proof.sc.catalog>=3);assert.ok(await shared.locator('tbody tr').count()>=3);assert.ok(await shared.locator('tbody tr').count()<=50);
  if(!privateData)assert.deepEqual([proof.sc.ga,proof.sc.pf,proof.sc.blocked,proof.sc.notRun],[2,70,1,67]);
  for(const width of [1366,1440,1600,1920]){await page.setViewportSize({width,height:width===1366?768:width===1920?1080:900});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));proof.geometry.push({family:'SC',width,...await assertStudyPanel(page,shared,{rowsRequired:true})});}
  await shared.getByLabel('SC liste kapsamı',{exact:true}).selectOption('SELECTED');assert.equal(await shared.locator('tbody tr').count(),1);await shared.getByLabel('SC liste kapsamı',{exact:true}).selectOption('ALL');
  await shared.getByRole('button',{name:'Sonraki',exact:true}).click();assert.ok(await shared.locator('tbody tr').count()>0);await shared.getByRole('button',{name:'Önceki',exact:true}).click();
  await shared.locator('tbody tr').first().dblclick();assert.equal(await page.locator('.ga-map-tooltip').isVisible(),true);proof.tooltip=await assertLongTooltip(page);
  proof.deltaTooltip=await page.evaluate(async()=>{const {renderEquipmentCard,tooltipPosition}=await import('/src/map/equipment-tooltip.ts'),host=document.createElement('div');host.className='ga-map-tooltip';document.body.append(host);renderEquipmentCard(host,{title:'Test trafo adı '.repeat(8),context:'GA SENARYO−BAZ • S2 • LF',status:'PARTIAL_GA_COMPARISON',headers:['TM / Uç','P (MW)','Q (MVAr)','ΔYük (pp)','U (kV)','Açı (°)'],rows:[['YG · A · Uzun TM adı','+100,00','−40,00','25,50','400,00','+12,00'],['AG · B · İkinci TM','−99,00','+35,00','25,50','154,00','−5,00']],note:'B0 54,60% · S2 80,10% · Δ +25,50 pp\nP: B → A · ΔKayıp P/Q +1,00/+2,00 · Serviste · Tap 2,00',details:'P: B → A · ΔKayıp P/Q +1,00/+2,00 · Serviste · Tap 2,00 · '.repeat(4)});const rect=host.getBoundingClientRect(),p=tooltipPosition(innerWidth-5,innerHeight-5,rect.width,rect.height,innerWidth,innerHeight);host.style.left=p.left+'px';host.style.top=p.top+'px';const box=host.getBoundingClientRect(),summary=host.querySelector('summary');summary.focus();summary.click();const result={width:box.width,height:box.height,bottom:box.bottom,viewportHeight:innerHeight,focusAccessible:document.activeElement===summary,detailsOpen:host.querySelector('details').open,detailsContent:host.querySelector('details p').textContent};host.remove();return result;});assert.ok(proof.deltaTooltip.width<=340&&proof.deltaTooltip.height<=205&&proof.deltaTooltip.bottom<=proof.deltaTooltip.viewportHeight);assert.ok(proof.deltaTooltip.focusAccessible&&proof.deltaTooltip.detailsOpen);assert.match(proof.deltaTooltip.detailsContent,/Tap 2,00/);
  if(!privateData){proof.batchMerge=await page.evaluate(async()=>{const {scAuditFixture}=await import('/tests/helpers/study-audit.ts'),f=scAuditFixture(70),first=f.result(Array.from({length:10},(_,i)=>f.fault(i))),second=f.result(Array.from({length:20},(_,i)=>f.fault(i+10))),saved={sc:ctx.scResult,context:ctx.scContext,request:ctx.calculation.request,prepare:ctx.prepareCalculationWorker,bounded:ctx.boundedWorker};let reply=second,requests=0;ctx.scResult=first;ctx.scContext={modelHash:ctx.network.modelHash};ctx.prepareCalculationWorker=async()=>true;ctx.boundedWorker=async fn=>fn();ctx.calculation.request=async()=>{requests++;return structuredClone(reply);};try{await ctx.runSc(second.faults.map(x=>x.physicalTerminalFid),second.profile);const merged=ctx.scResult.faults.length,blocked=ctx.scResult.counts.BLOCKED;reply=f.result([f.fault(30)]);reply.identity.sourceHash='CHANGED_SOURCE';await ctx.runSc(['B30'],reply.profile);return {kind:'SYNTHETIC_MOCK_WORKER_REPLIES_TO_REAL_CONTROLLER',first:10,second:20,merged,blocked,changedIdentityRows:ctx.scResult.faults.length,requests};}finally{ctx.scResult=saved.sc;ctx.scContext=saved.context;ctx.calculation.request=saved.request;ctx.prepareCalculationWorker=saved.prepare;ctx.boundedWorker=saved.bounded;ctx.notify();}});assert.deepEqual([proof.batchMerge.merged,proof.batchMerge.blocked,proof.batchMerge.changedIdentityRows,proof.batchMerge.requests],[30,30,1,2]);}
  if(privateData){
    await page.evaluate(()=>{ctx.filters.areaId='';ctx.resultView.analysis='N1';ctx.resultView.caseId=ctx.hybridResult.cases.find(c=>c.mapResults)?.outage.caseId;ctx.resultView.metric='postLoadingPercent';ctx.resultView.phase='POST';ctx.benchmarkMap={analysis:'N1',source:'GA',metric:'postLoadingPercent',caseId:ctx.resultView.caseId,table:'N1_RecordedExtrema_Raw',n1Layer:'POST'};ctx.notify();});
    await shared.getByLabel('N-1 riskli hatlar',{exact:true}).check();proof.riskLines=Number(await shared.getAttribute('data-filtered-count'));assert.equal(proof.riskLines,JSON.parse(privateData).tag==='SN3'?16:6);
    for(const width of [1366,1440,1600,1920]){await page.setViewportSize({width,height:width===1366?768:width===1920?1080:900});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));proof.geometry.push({family:'N1',width,...await assertStudyPanel(page,shared,{rowsRequired:true})});}
  }
  await page.keyboard.press('Escape');assert.equal(await page.locator('.ga-lightning').isVisible(),false);await page.getByRole('button',{name:'Elektriksel Sonuçlar',exact:true}).click();assert.equal(await page.locator('.ga-lightning').isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>window.solverRequests),[]);assert.deepEqual(proof.errors,[]);proof.status='PASS';
  if(privateData){const data=JSON.parse(privateData);await mkdir('local-benchmark-results',{recursive:true});await page.screenshot({path:'local-benchmark-results/map-lightning-audit-'+data.tag+'-private.png'});await writeFile('local-benchmark-results/map-lightning-audit-'+data.tag+'-ui-private.json',JSON.stringify(proof,null,2));}
  console.log('MAP_LIGHTNING_AUDIT_BROWSER_SMOKE '+JSON.stringify(proof));
}catch(e){if(page&&privateData)await page.screenshot({path:'local-benchmark-results/map-lightning-audit-failure-private.png'}).catch(()=>{});throw e;}finally{await browser?.close();server.kill('SIGTERM');}
