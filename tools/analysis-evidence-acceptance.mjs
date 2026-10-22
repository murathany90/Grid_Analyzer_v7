import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

/** Real components + actual tiny native results; no mocked solver requests or real-model recalculation. */
export async function auditAnalysisEvidence(browser,url){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  const css=['tokens','layout','catalog','components','analysis','responsive','benchmark','ui-workspace'].map(f=>`import '/src/styles/${f}.css';`).join('');
  const html=`<!doctype html><html lang="tr"><meta charset="utf-8"><body><main id="app"></main><script type="module">
${css}
import {Application} from '/src/app/controller.ts';
import {createAnalysisWorkspace} from '/src/features/analysis/analysis-workspace.ts';
import {scAuditFixture} from '/tests/helpers/study-audit.ts';
import {acNetwork} from '/tests/helpers/ac-network.ts';
import {runHybridN1} from '/src/analysis/contingency-hybrid/index.ts';
import {validateAcOutages} from '/src/analysis/contingency-ac/index.ts';
import {ScenarioStore} from '/src/domain/scenario/overlay.ts';
import {studyEvidence} from '/src/features/analysis/study-evidence.ts';
window.workerRequests=[];const Native=Worker;window.Worker=class extends Native{postMessage(m,...a){if(/^RUN_/.test(m.type)){workerRequests.push(m.type);throw Error('Evidence UI must not recalculate');}super.postMessage(m,...a);}};
const ctx=new Application();window.ctx=ctx;const f=scAuditFixture(70);ctx.benchmark=f.benchmark;
const base=acNetwork(),sites=['A','B'].map(id=>({...base.buses[0],id,sourceId:id,sourceClass:'ElmSite',areaId:id,areaName:'YTM '+id,lat:null,lon:null,voltages:[100]}));
ctx.network={...base,sites,buses:base.buses.map(b=>({...b,siteIds:b.id==='B1'?['A','B']:['A']}))};ctx.scenario=new ScenarioStore(ctx.network.modelHash);ctx.view='analysis';ctx.analysisTab='N1';ctx.resultView={...ctx.resultView,analysis:'N1',source:'GA',caseId:'N1:ElmLne:BYPASS',metric:'postPmw',phase:'POST'};
ctx.hybridResult=await runHybridN1(ctx.network,ctx.scenario.current,{analysisSettings:ctx.analysisSettings.value,studyProfile:'NATIVE_PARTIAL_CONTROLS',selectedCandidateIds:['ElmLne:BYPASS'],policy:{acBudgetCases:1}});
ctx.n1AcResults=await validateAcOutages(ctx.network,ctx.scenario.current,[{caseId:'N1:ElmLne:BYPASS',sourceClass:'ElmLne',fid:'BYPASS'}],{analysisSettings:ctx.analysisSettings.value,controlPolicy:'ALLOW_PARTIAL'});
const w=createAnalysisWorkspace(ctx);document.querySelector('#app').append(w.element);ctx.subscribe(()=>w.render());ctx.notify();window.evidence=()=>studyEvidence(ctx);
window.largeSc=()=>{const f=scAuditFixture(6278);ctx.network=f.network;ctx.scenario=f.ctx.scenario;ctx.benchmark=f.benchmark;ctx.scResult=f.result([f.fault(0,'CALCULATED_NETWORK_APPROXIMATION'),f.fault(1),f.fault(2,'CALCULATED_NETWORK_APPROXIMATION')]);ctx.hybridResult=null;ctx.n1AcResults=[];ctx.resultView={...f.ctx.resultView};ctx.analysisTab='SC';ctx.notify();ctx.scResult=f.result([f.fault(0,'CALCULATED_NETWORK_APPROXIMATION'),f.fault(1),f.fault(2,'CALCULATED_NETWORK_APPROXIMATION')]);ctx.notify();};
window.ready=true;
</script></body></html>`;
  const target=new URL('analysis-evidence.html',url).href,proof={dataset:'SYNTHETIC_UI_AND_TINY_NATIVE_RESULTS',geometry:[],errors};
  try{
    await page.route('**/analysis-evidence.html',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto(target);await page.waitForFunction(()=>window.ready);
    const workspace=page.locator('.ga-analysis-workspace'),n1=page.locator('#ga-analysis-N1');
    const openLegacy=async(panel,family)=>{for(const text of ['Gelişmiş / eski '+family+' komutları','Ekipman PRE/POST ve gelişmiş '+family+' sonuçları']){const summary=panel.getByText(text,{exact:true});if(!await summary.locator('..').evaluate(e=>e.open))await summary.click();}};await openLegacy(n1,'N1');
    await n1.getByLabel('N-1 hesap yöntemi',{exact:true}).selectOption('HYBRID');
    proof.manual=await page.evaluate(()=>window.evidence());assert.equal(proof.manual.recordSource,'MANUAL_FULL_AC');assert.equal(proof.manual.coverage.AC_ATTEMPTED,1);
    await workspace.locator('.ga-analysis-evidence details summary').click();assert.match(await workspace.locator('.ga-analysis-evidence pre').textContent(),/MANUAL_FULL_AC/);
    const advanced=n1.getByText('Gelişmiş N-1 ayarları',{exact:true}).locator('..');await advanced.locator('summary').first().click();
    await n1.getByLabel('Hibrit YTM kapsamı',{exact:true}).selectOption('A');await n1.getByLabel('AC min Vpu',{exact:true}).fill('.97');await n1.getByRole('button',{name:'Bu YTM / gerilim için limitleri kaydet',exact:true}).click();
    await n1.getByLabel('Hibrit YTM kapsamı',{exact:true}).selectOption('B');await n1.getByLabel('AC min Vpu',{exact:true}).fill('.95');await n1.getByRole('button',{name:'Bu YTM / gerilim için limitleri kaydet',exact:true}).click();
    const preflight=n1.getByLabel('İşletme limit profili ön kontrolü',{exact:true});assert.equal(await preflight.getAttribute('data-status'),'BLOCKED');assert.equal(await n1.getByRole('button',{name:'Otomatik hibrit (DC → Full AC)',exact:true}).isDisabled(),true);await preflight.locator('summary').click();assert.match(await preflight.textContent(),/ElmTerm:B1/);assert.match(await preflight.textContent(),/A:\*/);assert.match(await preflight.textContent(),/B:\*/);
    await n1.getByRole('button',{name:'Özel limitleri temizle',exact:true}).click();assert.equal(await n1.getByRole('button',{name:'Otomatik hibrit (DC → Full AC)',exact:true}).isEnabled(),true);
    await page.evaluate(()=>{window.largeSc();ctx.resultView.faultId=undefined;ctx.notify();});const sc=page.locator('#ga-analysis-SC');await openLegacy(sc,'SC');await sc.locator('.ga-workspace-results[data-status="SC_BATCH_NETWORK_APPROXIMATION"]').waitFor();
    assert.equal(await sc.locator('.ga-workspace-results').getAttribute('data-status'),'SC_BATCH_NETWORK_APPROXIMATION');assert.match(await sc.locator('.ga-result-context').textContent(),/Toplu ağ yaklaşımı sonuçları/);
    for(const type of ['LL','1LG','2LG'])assert.equal(await sc.getByLabel('SC arıza türü',{exact:true}).locator('option[value="'+type+'"]').isDisabled(),true);
    assert.equal(await sc.getByLabel('SC yöntem edisyonu',{exact:true}).locator('option[value=IEC2016]').isDisabled(),true);
    await sc.getByText('Gelişmiş / Açık varsayımlar',{exact:true}).click();assert.equal(await sc.getByLabel('Kesici açma süresi s',{exact:true}).isDisabled(),true);assert.equal(await sc.getByLabel('Termik temizleme süresi s',{exact:true}).isDisabled(),true);
    for(const width of [1366,1440,1600,1920,768,390]){
      await page.setViewportSize({width,height:width===1366?768:width===1920?1080:width===390?844:900});
      for(const label of ['Yük Akışı Analizi','Kısıt Analizi (N-1)','Kısa Devre Analizi']){
        await workspace.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' '+width);
        const statuses=await workspace.locator('.ga-analysis-layout:visible .ga-study-verdict strong').allTextContents();assert.ok(statuses.every(s=>!/_/.test(s)),statuses.join());
        if(label==='Kısa Devre Analizi')assert.equal(await sc.getByLabel('Ortak sonuç metriği',{exact:true}).inputValue(),'ikssKa');
      }
      proof.geometry.push({width,rows:await sc.locator('.ga-study-table tbody tr').count(),overflow:false});assert.ok(proof.geometry.at(-1).rows<=50);
    }
    await sc.getByLabel('Ortak sonuç metriği',{exact:true}).selectOption('skssMva');await workspace.getByRole('button',{name:'Yük Akışı Analizi',exact:true}).click();await workspace.getByRole('button',{name:'Kısa Devre Analizi',exact:true}).click();assert.equal(await sc.getByLabel('Ortak sonuç metriği',{exact:true}).inputValue(),'skssMva');await sc.getByLabel('Ortak sonuç metriği',{exact:true}).selectOption('ikssKa');
    await page.setViewportSize({width:1440,height:900});const shared=sc.locator('.ga-workspace-results');assert.equal(Number(await shared.getAttribute('data-ga-calculated-count')),2);assert.equal(Number(await shared.getAttribute('data-ga-blocked-count')),1);
    proof.filters=await shared.evaluate(e=>{const input=e.querySelector('[aria-label="Ortak sonuçlarda FID ara"]'),times=[];for(let i=0;i<25;i++){input.value=i%2?'Terminal 1':'';const t=performance.now();input.dispatchEvent(new Event('input'));if(i>=5)times.push(performance.now()-t);if(e.querySelectorAll('tbody tr').length>50)throw Error('Unbounded rows');}input.value='';input.dispatchEvent(new Event('input'));times.sort((a,b)=>a-b);return {catalog:Number(e.dataset.totalFaultCatalogCount),samples:times.length,medianMs:(times[9]+times[10])/2,p95Ms:times[18],maxMs:times.at(-1)};});assert.equal(proof.filters.catalog,6278);
    assert.deepEqual(await page.evaluate(()=>workerRequests),[]);assert.deepEqual(errors,[]);
    await page.evaluate(()=>{ctx.network=null;ctx.notify();});assert.equal(await sc.getByText('Kısa devre analizi için önce bir şebeke modeli yükleyin.',{exact:true}).isVisible(),true);assert.equal(await sc.getByLabel('SC yöntem edisyonu',{exact:true}).isVisible(),false);
    await mkdir('local-benchmark-results/analysis-hardening-20261012',{recursive:true});await writeFile('local-benchmark-results/analysis-hardening-20261012/ui-proof.json',JSON.stringify(proof,null,2));await page.screenshot({path:'local-benchmark-results/analysis-hardening-20261012/sc-1440.png'});
    console.log('ANALYSIS_EVIDENCE_AUDIT '+JSON.stringify({status:'PASS',geometry:proof.geometry,filters:proof.filters,solverRequests:0}));
  }catch(e){console.log('EVIDENCE_UI_PAGE_ERRORS '+JSON.stringify(errors));console.log('EVIDENCE_UI_FAILURE '+JSON.stringify(await page.evaluate(()=>({status:ctx.status,analysis:ctx.analysisTab,areas:[...document.querySelector('[aria-label="Hibrit YTM kapsamı"]').selectedOptions].map(o=>o.value),profiles:document.querySelector('.ga-limit-preflight')?.outerHTML,fields:[...document.querySelectorAll('#ga-analysis-N1 input[type=number]')].map(i=>[i.getAttribute('aria-label'),i.value]),text:document.querySelector('#ga-analysis-N1 .ga-analysis-options')?.textContent.slice(0,3000)}))));throw e;}finally{await page.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=5378,url='http://127.0.0.1:'+port+'/',server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',windowsHide:true});let browser;
  try{for(let i=0;i<80;i++){try{if((await fetch(url)).ok)break;}catch{}await delay(250);}browser=await chromium.launch({headless:true});await auditAnalysisEvidence(browser,url);}finally{await browser?.close();server.kill('SIGTERM');}
}
