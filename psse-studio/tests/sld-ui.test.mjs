import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const artifact=process.env.PSSE_PORTABLE??new URL('../dist/Grid_Analyzer_PSSE_Portable.html',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
const open=async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1366,height:768},offline:true,acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept('public-test'));
 await page.goto(pathToFileURL(artifact).href);await page.locator('#v8-nav').waitFor();await page.locator('[data-route=sld]').click();await page.locator('#ga-sld-studio').waitFor();
 await page.evaluate(async()=>{
  const d={format:'ga-sld-v1',fileVersion:'2.0.51.1',layers:[{n:0,desc:'Public test',vis:'Visible'}],components:[
   ...[[1,0,0],[2,5,4],[3,10,0]].map(([id,x,y])=>({id,t:'Symbol',stype:'Busbar',map:'BU '+id,pos:[x,y],len:3,width:.1,rot:90,layer:0,color:255})),
   {id:10,t:'Link',p1:{sym:1,idx:0,pos:[0,0]},p2:{sym:2,idx:0,pos:[5,4]},knees:[[0,2],[5,2]],layer:0,color:255},
   {id:20,t:'Label',owner:1,pos:[-1,.4],text:'Public bus',layer:0,color:255} ]};
  const r=await GASldStudio.importOne(new File([GASldStudio.serializeSldBinary(d)],'public.sld'));if(!r.ok)throw Error(r.error);
 });
 return {browser,page,errors};
};
const button=(page,name)=>page.getByRole('button',{name,exact:true}).first();
const settings=page=>page.getByRole('dialog',{name:'Diyagram Ayarları',exact:true});

test('live symbol/knee drag keeps arrows, handles and paths together before release; cancellation releases capture',async()=>{
 const {browser,page,errors}=await open();
 const geometry=()=>page.evaluate(()=>{
  const l=GASldStudio.getActiveDoc().gaSld.components.find(c=>c.id===10),g=document.querySelector('.ga-studio-sld-link[data-sld-id="10"]');
  const pts=[l.p1.pos,...(l.knees||[]),l.p2.pos].map(p=>[+(p[0]*90).toFixed(2),+(-p[1]*90).toFixed(2)]);
  let length=0,expected='';for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len>length){length=len;expected=`translate(${((a[0]+b[0])/2).toFixed(1)} ${((a[1]+b[1])/2).toFixed(1)}) rotate(${(Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI).toFixed(1)})`;}}
  return {arrow:g.querySelector('path:not(.ga-sld-line)')?.getAttribute('transform'),expected,arrows:g.querySelectorAll('path:not(.ga-sld-line)').length,knees:[...g.querySelectorAll('.ga-studio-knee')].map(e=>[+e.getAttribute('cx'),+e.getAttribute('cy')]),expectedKnees:pts.slice(1,-1)};
 });
 try{
  const point=await page.locator('.ga-studio-sld-symbol[data-sld-id="2"] line').evaluate(e=>{const p=e.ownerSVGElement.createSVGPoint();p.x=450;p.y=-360;const q=p.matrixTransform(e.getScreenCTM());return {x:q.x,y:q.y};});
  const before=await geometry();assert.equal(before.arrow,before.expected);
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+110,point.y-55,{steps:5});
  const live=await geometry();assert.notEqual(live.expected,before.expected);assert.equal(live.arrow,live.expected,'arrow stayed at old coordinates during symbol drag');assert.deepEqual(live.knees,live.expectedKnees);
  await page.mouse.up();
  const hit=await page.locator('.ga-sld-line').evaluate(e=>{const p=e.getPointAtLength(e.getTotalLength()*.4),q=p.matrixTransform(e.getScreenCTM());return {x:q.x,y:q.y};});await page.mouse.move(hit.x,hit.y);const box=await page.locator('.ga-studio-knee').first().boundingBox();assert(box);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+70,box.y+35,{steps:4});
  const kneeLive=await geometry();assert.equal(kneeLive.arrow,kneeLive.expected,'arrow stayed at old coordinates during knee drag');assert.deepEqual(kneeLive.knees,kneeLive.expectedKnees);await page.mouse.up();
  for(const action of [()=>GASldStudio.undo(),()=>GASldStudio.redo(),()=>GASldStudio.fit()]){await page.evaluate(action);const x=await geometry();assert.equal(x.arrow,x.expected);assert.equal(x.arrows,1);}
  const ids=await page.evaluate(()=>[...document.querySelectorAll('svg.ga-studio-drawing [data-sld-id]')].map(e=>e.dataset.sldId));assert.equal(new Set(ids).size,ids.length);
  const roundtrip=await page.evaluate(()=>{const d=GASldStudio.getActiveDoc().gaSld,r=GASldStudio.parseSldBinary(GASldStudio.serializeSldBinary(d)),byId=new Map(r.components.map(c=>[c.id,c]));return d.components.filter(c=>c.t==='Link').every(c=>['p1','p2'].every(k=>c[k].sym===byId.get(c.id)[k].sym&&c[k].pos.every((v,i)=>Math.abs(v-byId.get(c.id)[k].pos[i])<=1e-4)));});assert(roundtrip);
  await page.evaluate(()=>{GASldStudio.getSettings().layout.showFlowArrows=false;GASldStudio.translateSymbolById(1,0,0);});assert.equal(await page.locator('.ga-sld-flow-arrow').count(),0);
  const cancelPoint=await page.locator('.ga-studio-sld-symbol[data-sld-id="2"] line').evaluate(e=>{const p=e.ownerSVGElement.createSVGPoint();p.x=(e.x1.baseVal.value+e.x2.baseVal.value)/2;p.y=(e.y1.baseVal.value+e.y2.baseVal.value)/2;const q=p.matrixTransform(e.getScreenCTM());return {x:q.x,y:q.y};});
  await page.evaluate(()=>document.querySelector('svg.ga-studio-drawing').addEventListener('gotpointercapture',e=>globalThis.testPointerId=e.pointerId));await page.mouse.move(cancelPoint.x,cancelPoint.y);await page.mouse.down();await page.mouse.move(cancelPoint.x+12,cancelPoint.y+8);
  assert(await page.evaluate(()=>document.querySelector('svg.ga-studio-drawing').hasPointerCapture(testPointerId)));
  const cancelled=await page.evaluate(()=>{const svg=document.querySelector('svg.ga-studio-drawing'),id=testPointerId;svg.dispatchEvent(new PointerEvent('pointercancel',{pointerId:id,bubbles:true}));return !svg.hasPointerCapture(id);});assert(cancelled);await page.mouse.up();
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('SLD modal tabs, Apply/Cancel/defaults, ESC/focus, top-layer and unclipped menus at 768/1366/1702',async()=>{
 const {browser,page,errors}=await open();
 try{
  for(const width of [768,1366,1702]){
   await page.setViewportSize({width,height:842});
   for(const menu of [' align Hizala ▾','Diğer / Dışa Aktar ▾']){
    await button(page,menu).click();const popup=page.locator('.ga-studio-menu:popover-open');await popup.waitFor({state:'visible'});
    assert(await popup.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+10,r.top+10);return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.contains(hit);}),'Menu clipped or covered');
    await button(page,'⚙ Diyagram Ayarları').click();await settings(page).waitFor({state:'visible'});
    assert.equal(await page.locator('.ga-studio-menu:popover-open').count(),0);
    assert(await button(page,' align Hizala ▾').evaluate(e=>{const r=e.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('dialog[open]');}),'Toolbar above modal');
    for(const tab of ['annotations','coloring','layout','advanced']){await settings(page).locator(`[data-tab=${tab}]`).click();assert(await settings(page).locator('.ga-studio-modal-body input,.ga-studio-modal-body select').count()>0);}
    await page.keyboard.press('Escape');assert(await settings(page).isHidden());assert(await button(page,'⚙ Diyagram Ayarları').evaluate(e=>document.activeElement===e));
   }
  }
  await button(page,'⚙ Diyagram Ayarları').click();await settings(page).getByLabel('Bara adı göster (Bus Name)',{exact:true}).uncheck();
  assert.equal(await page.locator('.ga-studio-sld-label[data-sld-id="20"]').count(),0);await page.keyboard.press('Escape');assert.equal(await page.locator('.ga-studio-sld-label[data-sld-id="20"]').count(),1);
  await button(page,'⚙ Diyagram Ayarları').click();await settings(page).locator('[data-tab=coloring]').click();
  const color=settings(page).getByLabel('Genel Etiket Metin Rengi',{exact:true});await color.evaluate(e=>e.value='#ff00aa');await color.dispatchEvent('input');await button(page,'✓ Uygula').click();assert.equal(await page.locator('.ga-studio-sld-label[data-sld-id="20"] text').getAttribute('fill'),'#ff00aa');
  await button(page,'⚙ Diyagram Ayarları').click();await settings(page).locator('[data-tab=layout]').click();await settings(page).getByLabel(/Show Grid/).check();await button(page,'✓ Uygula').click();assert(await page.locator('.ga-studio-stage').evaluate(e=>e.classList.contains('is-grid')));
  await button(page,'⚙ Diyagram Ayarları').click();await settings(page).locator('[data-tab=advanced]').click();
  const field=settings(page).getByLabel('MW / MVAr görünürlük eşiği (zoom %)',{exact:true});await field.fill('5');await field.dispatchEvent('change');await button(page,'✓ Uygula').click();assert.equal(await page.evaluate(()=>GASldStudio.getSettings().advanced.flowLabelZoom),5);
  await button(page,'⚙ Diyagram Ayarları').click();await settings(page).locator('[data-tab=advanced]').click();await settings(page).getByLabel('MW / MVAr görünürlük eşiği (zoom %)',{exact:true}).fill('80');await button(page,'İptal').click();assert.equal(await page.evaluate(()=>GASldStudio.getSettings().advanced.flowLabelZoom),5);
  await button(page,'⚙ Diyagram Ayarları').click();await button(page,'↺ Varsayılanları Yükle').click();await button(page,'✓ Uygula').click();assert.equal(await page.evaluate(()=>GASldStudio.getSettings().advanced.flowLabelZoom),20);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('SLD editor actions, orthogonal knee drag, Undo/Redo, every export and safe failed import',async()=>{
 const {browser,page,errors}=await open();
 const bar=id=>({click:async()=>{
  // SVG line getBoundingClientRect has zero height; target its painted stroke.
  const point=await page.locator(`.ga-studio-sld-symbol[data-sld-id="${id}"] .ga-sld-busbar`).evaluate(e=>{
   const p=e.ownerSVGElement.createSVGPoint();p.x=(e.x1.baseVal.value+e.x2.baseVal.value)/2;p.y=(e.y1.baseVal.value+e.y2.baseVal.value)/2;
   const q=p.matrixTransform(e.getScreenCTM());return {x:q.x,y:q.y};
  });await page.mouse.click(point.x,point.y);
 }});
 const component=id=>page.evaluate(id=>GASldStudio.getActiveDoc().gaSld.components.find(c=>c.id===id),id);
 const menu=async name=>{await button(page,'Diğer / Dışa Aktar ▾').click();await page.getByRole('button',{name}).click();};
 try{
  await bar(1).click();const original=(await component(1)).rot;await button(page,'↻ 90° Döndür').click();assert.notEqual((await component(1)).rot,original);await button(page,'↶ Geri').click();assert.equal((await component(1)).rot,original);await button(page,'↷ İleri').click();assert.notEqual((await component(1)).rot,original);
  await button(page,'▬ Yatay Bara').click();await button(page,'▮ Dikey Bara').click();await button(page,'↶ Geri').click();
  for(const action of ['Sola Hizala','Yatay Ortala','Üste Hizala','Dikey Ortala','Yatay Eşit Dağıt','Dikey Eşit Dağıt']){
   await bar(1).click();await page.keyboard.down('Shift');await bar(2).click();await bar(3).click();await page.keyboard.up('Shift');
   await button(page,' align Hizala ▾').click();await button(page,action).click();await button(page,'↶ Geri').click();
  }
  await bar(1).click();await page.keyboard.down('Shift');await bar(2).click();await page.keyboard.up('Shift');await menu(/Seçilileri Grupla/);assert((await component(1)).groupId);await menu(/Grubu Çöz/);assert(!(await component(1)).groupId);
  await bar(1).click();await menu(/Seçiliyi Kilitle/);assert((await component(1)).locked);const lockedRotation=(await component(1)).rot;await button(page,'↻ 90° Döndür').click();assert.equal((await component(1)).rot,lockedRotation);await menu(/Seçiliyi Kilitle/);assert(!(await component(1)).locked);
  await menu(/Seçili Nesne Özellikleri/);await page.getByRole('dialog',{name:'Nesne / Katman Özellikleri',exact:true}).waitFor({state:'visible'});await page.keyboard.press('Escape');
  await menu(/Katman Görünürlüğü/);await page.keyboard.press('Escape');
  for(const tool of ['route90','knee','label','select']){await page.locator(`[data-ga-tool=${tool}]`).click();assert(await page.locator(`[data-ga-tool=${tool}]`).evaluate(e=>e.classList.contains('is-active')));}
  const linkPoint=()=>page.locator('.ga-studio-sld-link .ga-sld-line').first().evaluate(e=>{const p=e.getPointAtLength(e.getTotalLength()*.4),q=p.matrixTransform(e.getScreenCTM());return {x:q.x,y:q.y};});
  await page.locator('[data-ga-tool=route90]').click();let hit=await linkPoint();await page.mouse.click(hit.x,hit.y);await button(page,'↶ Geri').click();await button(page,'↷ İleri').click();
  await page.locator('[data-ga-tool=knee]').click();const kneeBefore=(await component(10)).knees.length;hit=await linkPoint();await page.mouse.click(hit.x,hit.y);const kneeAfter=(await component(10)).knees.length;assert(kneeAfter>kneeBefore);
  const removePoint=await page.locator('.ga-studio-knee').first().evaluate(e=>{const p=e.ownerSVGElement.createSVGPoint();p.x=e.cx.baseVal.value;p.y=e.cy.baseVal.value;const q=p.matrixTransform(e.getScreenCTM());return {x:q.x,y:q.y};});await page.mouse.click(removePoint.x,removePoint.y);assert((await component(10)).knees.length<kneeAfter);
  await page.locator('[data-ga-tool=label]').click();const labelBefore=(await component(20)).pos,barBefore=(await component(1)).pos;
  const textBox=await page.locator('.ga-studio-sld-label[data-sld-id="20"] text').boundingBox();assert(textBox);await page.mouse.move(textBox.x+textBox.width/2,textBox.y+textBox.height/2);await page.mouse.down();await page.mouse.move(textBox.x+textBox.width/2+25,textBox.y+textBox.height/2+15,{steps:3});await page.mouse.up();assert.notDeepEqual((await component(20)).pos,labelBefore);assert.deepEqual((await component(1)).pos,barBefore);
  await page.locator('[data-ga-tool=select]').click();
  await page.locator('.ga-studio-sld-link').first().hover();const knee=page.locator('.ga-studio-knee').first(),box=await knee.boundingBox();assert(box);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+30,box.y+24,{steps:4});await page.mouse.up();
  const orthogonal=await page.evaluate(()=>GASldStudio.getActiveDoc().gaSld.components.filter(c=>c.t==='Link').every(c=>{const p=[c.p1.pos,...(c.knees||[]),c.p2.pos];return p.slice(1).every((b,i)=>Math.abs(b[0]-p[i][0])<1e-4||Math.abs(b[1]-p[i][1])<1e-4);}));assert(orthogonal,'Knee drag created diagonal');
  await button(page,'↶ Geri').click();await button(page,'↷ İleri').click();
  await button(page,'✨ Çakışmaları Azalt').click();await bar(1).click();
  const svg=page.locator('.ga-studio-drawing'),view=await svg.getAttribute('viewBox');await button(page,'+').click();assert.notEqual(await svg.getAttribute('viewBox'),view);await button(page,'−').click();await button(page,'🎯 Odakla').click();await button(page,'⛶ Sığdır').click();await button(page,'⛶ Tam Ekran').click();await page.waitForFunction(()=>!!document.fullscreenElement);await button(page,'⛶ Tam Ekran').click();await page.waitForFunction(()=>!document.fullscreenElement);
  const download=async(action,extension)=>{const pending=page.waitForEvent('download');await action();const d=await pending;assert(d.suggestedFilename().endsWith(extension));const p=await d.path(),bytes=await fs.readFile(p);assert(bytes.length>0);return bytes;};
  const native=await download(()=>button(page,'💾 Native .sld Kaydet').click(),'.sld');
  for(const [name,extension]of [[/Native .sld Farklı Kaydet/,'.sld'],[/\.gasld.json İndir/,'.json'],[/Proje JSON/,'.json'],[/SVG/,'.svg'],[/PNG/,'.png']])await download(()=>menu(name),extension);
  const before=await page.evaluate(()=>GASldStudio.getDocuments().length);await menu(/Sekmeyi Kopyala/);assert.equal(await page.evaluate(()=>GASldStudio.getDocuments().length),before+1);
  await page.locator('.ga-studio-tab-rename').last().click();await page.locator('.ga-studio-tab-dup').last().click();await page.locator('.ga-studio-tab-close').last().click();
  const chooser=page.waitForEvent('filechooser');await button(page,'📂 .sld Aç').click();await(await chooser).setFiles({name:'public-reopen.sld',mimeType:'application/octet-stream',buffer:native});await page.waitForFunction(()=>GASldStudio.getActiveDoc()?.name==='public-reopen.sld');
  const result=await page.evaluate(async()=>{const active=GASldStudio.active(),r=await GASldStudio.importOne(new File([new Uint8Array([1,2,3])],'broken-public.sld'));return {ok:r.ok,error:r.error,preserved:active===GASldStudio.active()};});assert(!result.ok);assert(result.preserved);assert(result.error.includes('broken-public.sld'));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
