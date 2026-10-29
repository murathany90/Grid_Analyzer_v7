import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';
const url=pathToFileURL(process.env.PSSE_PORTABLE??process.cwd()+'/dist/Grid_Analyzer_PSSE_Portable.html').href;
const results=[],failures=[],screens=[];
const pause=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const SAV='control1/20261014_1200_SN3_TR0.sav',ZIP='control1/20261014_1200_SN3_TR0(psse_sav+digerdosyalar).zip';
for(const [name,executablePath]of [['Chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['Edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]){
  const browser=await chromium.launch({executablePath,headless:true}),context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true,offline:true}),page=await context.newPage(),errors=[],network=[];
  await page.addInitScript(()=>{
    const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,records=[];window.__psseListenerAudit=records;
    EventTarget.prototype.addEventListener=function(type,fn,options){if((this===window||this===document)&&options?.signal){const record={target:this,type,fn,active:true};records.push(record);add.call(options.signal,'abort',()=>record.active=false,{once:true});}return add.call(this,type,fn,options);};
    EventTarget.prototype.removeEventListener=function(type,fn,options){for(const record of records)if(record.target===this&&record.type===type&&record.fn===fn)record.active=false;return remove.call(this,type,fn,options);};
  });
  page.on('pageerror',e=>errors.push(e.stack));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  try{
    const start=performance.now();await page.goto(url);await page.waitForFunction(()=>!!window.psseStudio);const startup=performance.now()-start;
    const loadStart=performance.now();await page.locator('#pse-file').setInputFiles(SAV);await page.waitForFunction(()=>psseStudio.controller.psseNetwork&&!psseStudio.controller.busy,null,{timeout:60000});const load=performance.now()-loadStart;
    assert.equal(await page.evaluate(()=>psseStudio.controller.psseInspection.equipment.filter(e=>e.kind==='line').length),2403);
    for(const[width,height]of [[1366,768],[1600,900],[1920,1080]]){
      await page.setViewportSize({width,height});await pause(page);const timings={};
      let t=performance.now();await page.locator('[data-route=map]').click();await pause(page);timings.map=performance.now()-t;
      const links=await page.locator('.ga-psse-geo-link').count();assert(links>1500,`AC map lines ${links}`);
      const layout=await page.locator('.ga-psse-geo-stage').evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,toolbar:el.closest('.ga-psse-map').querySelector('.ga-psse-diagram-controls').children.length}));
      assert(layout.rect.bottom<=height+1,`Map bottom ${layout.rect.bottom}>${height}`);assert(layout.scrollWidth<=width,`Horizontal overflow ${layout.scrollWidth}`);assert.equal(await page.locator('.ga-map-scope-row').count(),1);assert.equal(await page.locator('.ga-map-tools-row').count(),1);assert(await page.locator('.psse-scenario-host').isHidden());assert.equal(await page.locator('.ga-map-scope-row').evaluate(e=>e.children.length),7);assert(await page.locator('.ga-map-tools-row').evaluate(e=>e.getBoundingClientRect().height<40));
      await page.evaluate(()=>window.__mapNode=document.querySelector('.ga-psse-geo-link'));
      await page.locator('[data-route=settings]').click();await pause(page);await page.locator('[data-route=map]').click();await pause(page);
      assert(await page.evaluate(()=>window.__mapNode===document.querySelector('.ga-psse-geo-link')),'Map DOM replaced during navigation');
      const menu=page.locator('.ga-v11-ytm');await menu.locator('summary').click();const checks=menu.locator('input[type=checkbox]');assert(await checks.count()>2);
      t=performance.now();await menu.getByRole('button',{name:'Temizle',exact:true}).click();await checks.nth(0).check();await checks.nth(1).check();await pause(page);timings.filter=performance.now()-t;
      assert.equal(await checks.evaluateAll(inputs=>inputs.filter(i=>i.checked).length),2);assert(await page.locator('.ga-psse-geo-link').count()<links);
      const boundary=await page.evaluate(()=>{const menu=document.querySelector('.ga-v11-ytm'),areas=new Set([...menu.querySelectorAll('input[type=checkbox]:checked')].map(e=>e.value)),c=psseStudio.controller,n=c.psseNetwork,m=c.psseInspection,eq=new Map(m.equipment.map(e=>[e.id,e])),branches=new Map(n.branches.map(b=>[b.id,b]));let outside=0,crossing=0;for(const line of document.querySelectorAll('.ga-psse-geo-link')){const b=branches.get(line.dataset.branchId);if(!b)continue;const a=areas.has(String(c.engine.hv(n.buses[b.from],m,eq))),z=areas.has(String(c.engine.hv(n.buses[b.to],m,eq)));if(!a&&!z)outside++;if(a!==z)crossing++;}return {outside,crossing};});assert.equal(boundary.outside,0);assert(boundary.crossing>0,'YTM incident boundary lines missing');
      await menu.getByRole('button',{name:'Tümünü seç',exact:true}).click();await menu.locator('summary').click();await pause(page);
      const stage=page.locator('.ga-psse-geo-stage'),box=await stage.boundingBox(),before=await stage.getAttribute('data-zoom');
      const alignment=await page.locator('.ga-psse-geo-stage').evaluate(el=>{const c=el.querySelector('canvas').getBoundingClientRect(),s=el.querySelector('svg').getBoundingClientRect();return Math.max(Math.abs(c.x-s.x),Math.abs(c.y-s.y),Math.abs(c.width-s.width),Math.abs(c.height-s.height));});assert(alignment<1,'Canvas/SVG alignment');
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-100);await page.waitForTimeout(160);await pause(page);
      assert.notEqual(await stage.getAttribute('data-zoom'),before,'Wheel zoom');
      await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7+35,box.y+box.height*.5+20,{steps:5});await page.mouse.up();await page.waitForTimeout(120);
      await page.getByRole('button',{name:'Sığdır',exact:true}).first().click();await pause(page);
      const link=page.locator('.ga-psse-geo-link').first();await link.dispatchEvent('pointerover');
      await page.locator('.ga-v12-tooltip').waitFor({state:'visible'});await page.screenshot({path:`evidence/${name}-${width}x${height}-map.png`});
      await page.getByRole('button',{name:'Elektriksel sonuçlar paneli',exact:true}).click();const panel=page.locator('.ga-psse-lightning');await panel.waitFor({state:'visible'});
      t=performance.now();await panel.getByLabel('Sonuç tablosu',{exact:true}).selectOption('transformers');await pause(page);timings.panel=performance.now()-t;
      assert(await panel.evaluate(e=>e.clientWidth<=800&&e.querySelector('.ga-psse-lightning-table-wrap').scrollWidth<=e.clientWidth),'Panel horizontal overflow');const headers=await panel.locator('th').allTextContents();assert(headers[0].includes('TM'));assert(headers.some(h=>h.includes('YG/AG')));assert(headers.some(h=>h.includes('YG P')));assert(await panel.locator('tbody tr').count()<=100);
      await panel.getByLabel('Sonuç tablosu',{exact:true}).selectOption('buses');await panel.locator('th button').first().click();
      if(width===1366){
        await fs.mkdir('evidence/downloads',{recursive:true});
        for(const format of ['CSV','XLSX']){const promise=page.waitForEvent('download');await panel.getByRole('button',{name:format,exact:true}).click();const download=await promise,path=`evidence/downloads/${name}-${download.suggestedFilename()}`;await download.saveAs(path);const bytes=await fs.readFile(path);assert(bytes.length>1000);if(format==='XLSX'){assert.equal(bytes.subarray(0,2).toString(),'PK');const zip=unzipSync(bytes);assert(zip['[Content_Types].xml']);const sheet=strFromU8(zip['xl/worksheets/sheet1.xml']);assert(sheet.includes('</worksheet>'));assert.equal((sheet.match(/<row[\s>]/g)??[]).length,6852);}}
      }
      const shot=`evidence/${name}-${width}x${height}-panel.png`;await page.screenshot({path:shot});screens.push(shot);
      await page.locator('[data-route=sld]').click();await pause(page);assert(await page.locator('.ga-psse-sld-svg').count());
      const station=page.getByLabel('Trafo merkezi',{exact:true});await station.selectOption({index:Math.min(25,(await station.locator('option').count())-1)});await pause(page);assert(await page.locator('.ga-sld-busbar').count()>0);
      await page.screenshot({path:`evidence/${name}-${width}x${height}-sld.png`});
      t=performance.now();await page.locator('[data-route=settings]').click();await page.getByLabel('Yüklenme paydası RATE',{exact:true}).selectOption('1');await pause(page);timings.settings=performance.now()-t;assert.equal(await page.evaluate(()=>psseStudio.getState().rateIndex),1);await page.getByLabel('Yüklenme paydası RATE',{exact:true}).selectOption('0');
      results.push({browser:name,version:browser.version(),width,height,startupMs:startup,loadMs:load,links,layout,timings});console.log('PASS',name,width,height);
    }
    await page.locator('[data-route=analysis]').click();
    for(const tab of ['Gauss','Robust Solution']){await page.getByRole('button',{name:tab,exact:true}).click();assert(await page.locator('[data-solve]').isDisabled());assert(await page.locator('[data-dc]').isDisabled());}
    await page.getByRole('button',{name:'Newton',exact:true}).click();assert(await page.locator('[data-solve]').isEnabled());assert(await page.getByLabel('Decoupled Newton-Raphson',{exact:true}).isDisabled());
    assert(await page.getByLabel('Mismatch threshold (MVA) for voltage estimation',{exact:true}).isDisabled());
    await page.locator('[data-solve]').click();await page.waitForFunction(()=>!psseStudio.controller.busy&&!!psseStudio.controller.psseCalculation,null,{timeout:60000});
    const nr=await page.evaluate(()=>({status:psseStudio.getState().resultStatus,hash:psseStudio.controller.psseCalculation.identity.optionsHash,options:psseStudio.controller.psseCalculation.options,coverage:psseStudio.controller.psseCalculation.physicsCoverage}));assert.notEqual(nr.status,'NOT_RUN');if(nr.coverage!=='SUPPORTED')assert.notEqual(nr.status,'CONVERGED');
    await page.getByLabel('Ignore',{exact:true}).check();await pause(page);assert.equal(await page.evaluate(()=>psseStudio.controller.psseCalculation),null);await page.locator('[data-solve]').click();await page.waitForFunction(()=>!psseStudio.controller.busy&&!!psseStudio.controller.psseCalculation,null,{timeout:60000});assert.notEqual(await page.evaluate(()=>psseStudio.controller.psseCalculation.identity.optionsHash),nr.hash);
    if(name==='Chrome'){const promise=page.waitForEvent('download');await page.getByRole('button',{name:'PSS/E Python ZIP',exact:true}).click();const dl=await promise;await dl.saveAs('evidence/downloads/bridge.zip');const entries=unzipSync(await fs.readFile('evidence/downloads/bridge.zip'));assert(entries['PSSE_LOCAL_JOB.json']);assert(entries['PSS_E_LOCAL_REFERENCE_RUNNER_V7.py']);const job=JSON.parse(strFromU8(entries['PSSE_LOCAL_JOB.json']));assert.equal(job.gaResultId,await page.evaluate(()=>psseStudio.controller.psseCalculation.id));}
    results.push({browser:name,nr});await page.screenshot({path:`evidence/${name}-solve.png`});
    await page.locator('[data-dc]').click();await page.waitForFunction(()=>!psseStudio.controller.busy&&!!psseStudio.controller.psseCalculation,null,{timeout:60000});
    assert.equal(await page.evaluate(()=>psseStudio.getState().resultStatus),'APPROXIMATE');
    await page.locator('[data-route=map]').click();await pause(page);const arrows=page.locator('.ga-psse-geo-flow-arrow');assert(await arrows.count()>0,'Real flow arrows');const points=await arrows.first().getAttribute('points');assert(points.split(' ').length===4);const transform=await arrows.first().getAttribute('transform');await page.waitForTimeout(120);assert.notEqual(await arrows.first().getAttribute('transform'),transform);await page.screenshot({path:`evidence/${name}-flow.png`});
    await page.locator('[data-route=analysis]').click();
    const base=await page.evaluate(()=>({id:psseStudio.controller.psseCalculation.id,hash:psseStudio.controller.psseScenario.hash,branch:psseStudio.controller.psseNetwork.branches.find(b=>b.kind==='line'&&b.status===1).sourceEquipmentId}));
    await page.locator('.psse-scenario-workspace summary').click();await page.getByLabel('Senaryo ekipmanı',{exact:true}).selectOption(base.branch);await page.getByLabel('Senaryo işlemi',{exact:true}).selectOption('STATUS');await page.getByLabel('Senaryo değeri',{exact:true}).fill('0');await page.locator('[data-action=apply]').click();await pause(page);
    assert.equal(await page.evaluate(()=>psseStudio.controller.psseCalculation),null);assert.equal(await page.evaluate(()=>psseStudio.controller.psseBaseCalculation.id),base.id);assert.equal(await page.evaluate(()=>psseStudio.getState().resultStatus),'NOT_RUN');
    await page.locator('[data-action=undo]').click();assert.equal(await page.evaluate(()=>psseStudio.controller.psseScenario.hash),base.hash);await page.locator('[data-action=redo]').click();assert.notEqual(await page.evaluate(()=>psseStudio.controller.psseScenario.hash),base.hash);
    await page.locator('[data-action=copy]').click();const saved=await page.evaluate(()=>psseStudio.controller.scenarios.serialize());assert(JSON.parse(saved).items.length>=2);
    await page.locator('.psse-scenario-workspace summary').click();
    await page.locator('#pse-file').setInputFiles(ZIP);await page.waitForFunction(()=>psseStudio.controller.psseAttachments&&!psseStudio.controller.busy,null,{timeout:60000});assert.equal(await page.evaluate(()=>psseStudio.controller.psseInspection.equipment.filter(e=>e.kind==='bus').length),6851);
    await page.locator('[data-route=map]').click();await pause(page);assert(await page.locator('.ga-psse-geo-link').count()>1500);
    const bHash=await page.evaluate(()=>psseStudio.controller.psseInspection.source.sha256);await page.locator('#pse-file').setInputFiles(SAV);await page.waitForFunction(hash=>psseStudio.controller.psseInspection?.source.sha256!==hash&&!psseStudio.controller.busy,bHash,{timeout:60000});await pause(page);assert.equal(await page.evaluate(()=>psseStudio.getState().resultStatus),'NOT_RUN');assert(await page.locator('.ga-psse-geo-link').count()>1500);
    assert.equal(network.length,0,'External network request');assert.equal(errors.length,0,errors.join('\n'));
    // Two simultaneous instances must retain independent model/state/storage and cleanly unmount.
    const lifecycle=await page.evaluate(async()=>{const before=psseStudio.getState(),el=document.createElement('div'),outside=document.createElement('button');outside.textContent='host';document.body.append(el,outside);const oldStyle=getComputedStyle(outside).backgroundColor,second=GridAnalyzerPSSE.mount(el);second.controller.settings.update({rateIndex:2});const isolated=psseStudio.getState().rateIndex===before.rateIndex&&second.getState().rateIndex===2,cssIsolated=oldStyle===getComputedStyle(outside).backgroundColor;second.unmount();el.remove();outside.remove();psseStudio.unmount();return {isolated,cssIsolated,remaining:document.querySelectorAll('.psse-module').length,listeners:__psseListenerAudit.filter(r=>r.active).length,workers:[psseStudio.controller.psseSource.worker,psseStudio.controller.psseCalculationWorker.worker].filter(Boolean).length};});assert(lifecycle.isolated);assert(lifecycle.cssIsolated);assert.equal(lifecycle.remaining,0);assert.equal(lifecycle.listeners,0);assert.equal(lifecycle.workers,0);
    results.push({browser:name,lifecycle,externalRequests:network.length,pageErrors:errors.length});
  }catch(error){failures.push({browser:name,error:error.stack,errors});console.error('FAIL',name,error.message);await page.screenshot({path:`evidence/${name}-failure.png`});}
  finally{await browser.close();}
}
await fs.writeFile('evidence/browser-results.json',JSON.stringify({results,failures,screens},null,2));
assert.equal(failures.length,0,JSON.stringify(failures,null,2));
console.log(`PASS ${results.filter(r=>r.width).length} viewport checks, Chrome + Edge, offline file://`);
