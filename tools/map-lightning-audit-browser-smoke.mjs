import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {assertStudyPanel,assertLongTooltip} from './map-panel-acceptance.mjs';

const privatePath=process.env.GA_AUDIT_PRIVATE_CACHE,privateData=privatePath?await readFile(privatePath,'utf8'):null;
const port=5372,server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true}});await server.listen();
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
  proof.filterTiming=await shared.evaluate(e=>{const input=e.querySelector('[aria-label="Ortak sonuçlarda FID ara"]'),times=[];for(let i=0;i<25;i++){input.value=i%2?'NO_MATCH_FOR_TIMING':'';const t=performance.now();input.dispatchEvent(new Event('input'));if(i>=5)times.push(performance.now()-t);if(e.querySelectorAll('tbody tr').length>50)throw Error('Unbounded filter DOM');}input.value='';input.dispatchEvent(new Event('input'));times.sort((a,b)=>a-b);return {catalog:Number(e.dataset.totalFaultCatalogCount),samples:times.length,medianMs:(times[9]+times[10])/2,p95Ms:times[18],maxMs:times.at(-1)};});
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
  if(!privateData){
    // One focused LF/workspace regression: actual controller, source worker, solver and IndexedDB.
    const workspaceHtml=`<!doctype html><html lang="tr"><meta charset="utf-8"><body><main id="app"></main><script type="module">
      ${css}
      import {Application} from '/src/app/controller.ts';
      import {createLightningPanel} from '/src/map/lightning-panel.ts';
      import {BrowserDatabase} from '/src/persistence/database.ts';
      import {workspaceKey} from '/src/domain/results/workspace.ts';
      const raw=await (await fetch('/tests/fixtures/small-dgs.json')).json();
      raw.ElmCoup.Values.forEach((row,i)=>{row[raw.ElmCoup.Attributes.indexOf('aUsage')]=i?'dct':'cbk';row[raw.ElmCoup.Attributes.indexOf('on_off')]=1;});
      const file=new File([JSON.stringify(raw)],'workspace-ui-fixture.json',{type:'application/json'}),ctx=new Application();window.ctx=ctx;
      await ctx.loadFiles([file]);ctx.view='map';
      const panel=createLightningPanel(ctx);document.querySelector('#app').append(panel.element);ctx.subscribe(()=>panel.render());
      const db=new BrowserDatabase();window.db=db;window.cacheKey=()=>workspaceKey(ctx);
      window.seedLegacy=async()=>{const key=workspaceKey(ctx);await db.put('scenario:'+ctx.network.modelHash,ctx.scenario.current);await db.put('workspace:'+key,{old:true});await db.put('lf:'+key+':powerFlow',{old:true});window.oldKey=key;};
      await ctx.run('powerFlow','base');window.base=ctx.resultStore.get('base');
      if(!ctx.scenario.canUndo)await ctx.run('powerFlow','scenario');
      panel.open('RESULTS');window.ready=true;
    </script></body></html>`;
    await page.route('**/workspace.html',r=>r.fulfill({contentType:'text/html',body:workspaceHtml}));
    await page.goto('http://127.0.0.1:'+port+'/workspace.html');await page.waitForFunction(()=>window.ready);
    const panel=page.locator('.ga-lightning'),view=panel.getByLabel('Elektriksel sonuç görünümü'),table=panel.locator('.ga-result-table');
    assert.equal(await page.evaluate(()=>!!window.base?.converged),true);
    await view.selectOption('delta');assert.equal(await table.isVisible(),true);assert.match(await table.locator('thead').textContent(),/Baz.*Senaryo.*ΔP/);
    assert.equal(await panel.locator('.ga-workspace-results').isVisible(),false);assert.equal(await view.inputValue(),'delta');assert.equal(await panel.getByRole('button',{name:'Başlat',exact:true}).isVisible(),false);
    for(const role of ['base','scenario','delta']){await view.selectOption(role);assert.equal(await table.isVisible(),true);assert.equal(await view.inputValue(),role);assert.equal(await panel.locator('.ga-workspace-results').isVisible(),false);assert.equal(await panel.locator('.ga-delta-summary').isVisible(),role==='delta');}
    const metrics=panel.getByLabel('Elektriksel sonuç metrikleri');assert.equal(await metrics.inputValue(),'pq-loading');
    const identities=await page.evaluate(()=>JSON.stringify([ctx.resultStore.get('base').identity,ctx.resultStore.get('scenario').identity]));
    for(const mode of ['p-loading','pq','pq-loading']){await metrics.selectOption(mode);const headers=await table.locator('thead').textContent();assert.equal(/ΔQ/.test(headers),mode!=='p-loading');assert.equal(/ΔYük/.test(headers),mode!=='pq');assert.equal(/ΔKayıp P/.test(headers),true);}
    await metrics.selectOption('pq');await panel.getByRole('button',{name:'Sonuç panelini kapat',exact:true}).click();await page.evaluate(()=>{document.querySelector('.ga-lightning').hidden=false;ctx.notify();});assert.equal(await metrics.inputValue(),'pq');await metrics.selectOption('pq-loading');
    await page.evaluate(()=>{const p=document.querySelector('.ga-lightning');p.style.width='min(640px,calc(100vw - 14px))';p.style.height='460px';p.style.bottom='auto';});
    const layout=await panel.evaluate(p=>({context:p.querySelector('.ga-lightning-context').getBoundingClientRect().height,table:p.querySelector('.ga-result-scroll').getBoundingClientRect().height,pagerInFooter:!!p.querySelector('.ga-lightning-footer .ga-pager')}));assert.ok(layout.context<=53);assert.ok(layout.table>=235);assert.ok(layout.pagerInFooter);proof.lfLayout=layout;
    if(process.env.GA_LIGHTNING_SCREENSHOT)await panel.screenshot({path:process.env.GA_LIGHTNING_SCREENSHOT});
    await panel.getByLabel('Elektriksel sonuç ekipmanı').selectOption('bus');
    for(const mode of ['voltage','angle','voltage-angle']){await metrics.selectOption(mode);const headers=await table.locator('thead').textContent();assert.doesNotMatch(headers,/pu/);assert.equal(/kV/.test(headers),mode!=='angle');assert.equal(/Açı/.test(headers),mode!=='voltage');}
    await panel.getByLabel('Elektriksel sonuç ekipmanı').selectOption('line');assert.equal(await metrics.inputValue(),'pq-loading');assert.equal(await page.evaluate(()=>JSON.stringify([ctx.resultStore.get('base').identity,ctx.resultStore.get('scenario').identity])),identities);
    const originalViewport=page.viewportSize();await page.setViewportSize({width:420,height:768});
    for(const family of ['N1','SC']){await panel.locator('[data-family="'+family+'"]').click();assert.equal(await panel.locator('.ga-workspace-results').isVisible(),true);const overflow=await panel.locator('.ga-study-actions').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false,'Study actions must wrap without squeezing');}
    await panel.locator('[data-family="LF"]').click();assert.equal(await panel.locator('.ga-workspace-results').isVisible(),false);assert.equal(await table.isVisible(),true);await page.setViewportSize(originalViewport);
    await panel.getByLabel('Elektriksel sonuçlarda ara').fill('L400-01');assert.equal(await table.locator('tbody tr[data-row]').count(),1);await panel.getByLabel('Elektriksel sonuçlarda ara').fill('');
    await table.locator('[data-sort="deltaP"]').click();assert.equal(await table.locator('[data-sort="deltaP"]').getAttribute('aria-pressed'),'true');
    if(await panel.getByRole('button',{name:'Sonraki',exact:true}).isEnabled()){await panel.getByRole('button',{name:'Sonraki',exact:true}).click();assert.match(await panel.locator('.ga-lightning-paging .ga-pager').textContent(),/2\//);await panel.getByRole('button',{name:'Önceki',exact:true}).click();}
    for(const kind of ['trafo','bus','line']){await panel.getByLabel('Elektriksel sonuç ekipmanı').selectOption(kind);assert.equal(await table.isVisible(),true);}
    const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Elektriksel sonuçları XLSX indir'}).click();assert.match((await download).suggestedFilename(),/\.xlsx$/);
    const before=await page.evaluate(()=>JSON.stringify(ctx.network));
    await page.evaluate(async()=>{await ctx.setStatus('lineStatus',ctx.network.lines[0].id,false,true);await ctx.setStatus('transformerStatus',ctx.network.transformers[0].id,false,true);await ctx.setStatus('switchState',ctx.network.switches[0].id,false,true);});
    assert.deepEqual(await page.evaluate(()=>[ctx.scenario.snapshots.length,ctx.scenario.historyLength,ctx.scenario.selected.events.length,ctx.resultStore.get('scenario')===null,ctx.resultStore.get('base')===window.base]),[2,3,3,true,true]);
    assert.equal(await page.evaluate(()=>JSON.stringify(ctx.network)),before);
    await panel.getByRole('button',{name:'Senaryolar',exact:true}).click();const journal=panel.locator('.ga-scenario-log');await journal.locator(':scope > summary').click();
    await page.waitForFunction(()=>document.querySelector('.ga-scenario-log')?.textContent?.includes('Kesici'));assert.match(await journal.textContent(),/400 kV Bay.*Kesici/);
    assert.equal(await panel.locator('.ga-scenario-workspace select,.ga-scenario-workspace input').count(),0);assert.doesNotMatch(await journal.textContent(),/switchState|lineStatus|true|false|\b[SB]\d+\b/);
    await page.reload();await page.waitForFunction(()=>window.ready);assert.deepEqual(await page.evaluate(()=>[ctx.scenario.historyLength,ctx.scenario.selected.events.length]),[3,3]);
    await panel.getByRole('button',{name:'Senaryolar',exact:true}).click();for(let i=0;i<3;i++)await panel.getByRole('button',{name:'Geri Al',exact:true}).click();assert.equal(await panel.getByRole('button',{name:'Geri Al',exact:true}).isDisabled(),true);
    await page.evaluate(()=>ctx.setFeederStatus(ctx.network.switches.map(s=>s.id),false));await journal.locator(':scope > summary').click();assert.equal(await journal.locator('ol > li').count(),1);await journal.getByText('Toplu manevra · 2 cihaz',{exact:false}).click();assert.match(await journal.textContent(),/Kesici.*Kapalı → Açık/);assert.match(await journal.textContent(),/Ayırıcı.*Kapalı → Açık/);
    await panel.getByRole('button',{name:'Geri Al',exact:true}).click();assert.deepEqual(await page.evaluate(()=>ctx.scenario.current.switchState),{});
    await page.evaluate(async()=>{await ctx.setFeederStatus(ctx.network.switches.map(s=>s.id),false);await window.seedLegacy();});
    await panel.getByRole('button',{name:'Senaryoyu Sıfırla',exact:true}).click();
    await page.waitForFunction(async()=>!(await db.get('scenario:'+ctx.network.modelHash)));
    assert.deepEqual(await page.evaluate(async()=>[ctx.scenario.historyLength,ctx.scenario.selected.events.length,ctx.resultStore.get('scenario'),ctx.resultStore.get('base')===window.base,await db.get('workspace:'+window.oldKey),await db.get('lf:'+window.oldKey+':powerFlow')]),[0,0,null,true,undefined,undefined]);
    assert.equal(await page.evaluate(async()=>JSON.stringify((await db.get('lf:'+window.cacheKey()+':powerFlow')).identity)===JSON.stringify(window.base.identity)),true);
    await page.reload();await page.waitForFunction(()=>window.ready);assert.deepEqual(await page.evaluate(()=>[ctx.scenario.historyLength,ctx.scenario.selected.events.length,Object.keys(ctx.scenario.current.switchState).length]),[0,0,0]);
    await page.evaluate(()=>{ctx.resultStore.clear();ctx.notify();});await view.selectOption('delta');assert.match(await panel.locator('.ga-base-notice').textContent(),/Baz sonucu bulunmuyor/);assert.equal(await panel.locator('.ga-base-notice').getByRole('button',{name:'Baz Hesapla',exact:true}).isVisible(),true);assert.equal(await panel.locator('.ga-workspace-results').isVisible(),false);
    assert.doesNotMatch(await panel.innerText(),/\bB0\b|\bS[123]\b|\bworking\b/);proof.scenarioWorkspace='PASS';assert.deepEqual(proof.errors,[]);
  }
  console.log('MAP_LIGHTNING_AUDIT_BROWSER_SMOKE '+JSON.stringify(proof));
}catch(e){if(page&&privateData)await page.screenshot({path:'local-benchmark-results/map-lightning-audit-failure-private.png'}).catch(()=>{});throw e;}finally{await browser?.close();await server.close();}
