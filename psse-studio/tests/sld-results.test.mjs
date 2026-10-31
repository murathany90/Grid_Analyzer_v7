import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';import {chromium} from 'playwright';
test('public analytical fixture: actual AC/DC solve, current identity, native result labels and last profile',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1366,height:900},offline:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(process.env.PSSE_PORTABLE??new URL('../dist/Grid_Analyzer_PSSE_Portable.html',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')).href);await page.locator('#pse-file').setInputFiles(new URL('./fixtures/two-bus.raw',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));await page.waitForFunction(()=>psseStudio.controller.psseNetwork&&!psseStudio.controller.busy);
  await page.locator('[data-route=sld]').click();await page.locator('#ga-sld-studio').waitFor();
  assert.equal(await page.evaluate(()=>psseStudio.controller.runLastPsseCalculation()),false);assert.equal(await page.evaluate(()=>psseStudio.controller.view),'analysis');await page.locator('[data-route=sld]').click();
  await page.evaluate(async()=>{
   const d={format:'ga-sld-v1',fileVersion:'2.0.51.1',layers:[{n:0,desc:'Public analytical fixture',vis:'Visible'}],components:[
    {id:1,t:'Symbol',stype:'Busbar',map:'BU 1',pos:[0,0],len:3,width:.05,rot:90,layer:0,color:255},
    {id:2,t:'Symbol',stype:'Busbar',map:'BU 2',pos:[0,-4],len:3,width:.05,rot:90,layer:0,color:255},
    {id:3,t:'Symbol',stype:'Branch',psse:'Branch',sdef:32,map:'LI 1 2 1',pos:[0,-2],rot:270,layer:0,color:255},
    {id:10,t:'Link',p1:{sym:1,idx:0,pos:[0,0]},p2:{sym:3,idx:0,pos:[0,-1.884]},layer:0,color:255},
    {id:11,t:'Link',p1:{sym:2,idx:0,pos:[0,-4]},p2:{sym:3,idx:1,pos:[0,-2.116]},layer:0,color:255},
    {id:20,t:'Label',owner:1,text:'GA manual note',pos:[1,.4],layer:0,color:255,fh:9}]};
   const r=await GASldStudio.importOne(new File([GASldStudio.serializeSldBinary(d)],'analytical.sld'));if(!r.ok)throw Error(r.error);
   await psseStudio.controller.runPsseCalculation('NR_POLAR',{});
  });
  assert.equal(await page.evaluate(()=>psseStudio.controller.psseCalculation.status),'CONVERGED');
  assert(await page.evaluate(()=>GASldStudio.embedCalculatedResults()));const ac=await page.evaluate(()=>GASldStudio.getActiveDoc().gaSld.components.filter(c=>c.gaResult).map(c=>({id:c.id,text:c.text,identity:c.gaResult})));assert(ac.length>=3);assert(ac.some(c=>c.text.includes('pu')));assert(ac.some(c=>c.text.includes('MVAr')));
  assert(await page.evaluate(()=>GASldStudio.embedCalculatedResults()));assert.deepEqual(await page.evaluate(()=>GASldStudio.getActiveDoc().gaSld.components.filter(c=>c.gaResult).map(c=>c.id)),ac.map(c=>c.id));
  assert(await page.evaluate(()=>psseStudio.controller.runLastPsseCalculation()));assert.equal(await page.evaluate(()=>psseStudio.controller.lastPsseSolveProfile.method),'NR_POLAR');
  await page.evaluate(async()=>{await psseStudio.controller.runPsseCalculation('LOSSLESS_DC',{});GASldStudio.embedCalculatedResults();});
  const dc=await page.evaluate(()=>{const d=GASldStudio.getActiveDoc().gaSld,r=GASldStudio.parseSldBinary(GASldStudio.serializeSldBinary(d));return {labels:d.components.filter(c=>c.gaResult),native:r.components.filter(c=>c.gaResult),badges:[...document.querySelectorAll('.ga-studio-pf-badge')].map(e=>e.textContent),manual:r.components.find(c=>c.id===20)?.text};});
  assert(dc.labels.length>=3);assert(!dc.labels.some(c=>/pu|kV|MVAr|MVA/.test(c.text)));assert(!dc.badges.some(t=>/pu|kV|MVAr|MVA/.test(t)));assert.equal(dc.manual,'GA manual note');assert.equal(dc.native.length,dc.labels.length);assert(dc.native.every(c=>c.gaResult.method==='LOSSLESS_DC'));
  await page.evaluate(()=>{psseStudio.controller.busy=true;psseStudio.controller.notify();});assert.equal(await page.locator('.ga-studio-sld-label').filter({hasText:'GA 50'}).count(),0);assert(!await page.evaluate(()=>GASldStudio.embedCalculatedResults()));
  await page.evaluate(()=>{psseStudio.controller.busy=false;const load=psseStudio.controller.psseNetwork.loads[0];psseStudio.controller.apply({equipmentId:load.sourceEquipmentId,action:'LOAD_SCALE',value:.9});});
  assert.equal(await page.evaluate(()=>psseStudio.controller.runLastPsseCalculation()),false);assert.equal(await page.evaluate(()=>psseStudio.controller.view),'analysis');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
