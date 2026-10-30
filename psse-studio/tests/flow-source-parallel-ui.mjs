import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {assertCanvasMoves} from './flow-pixels.mjs';

const target=process.env.PSSE_PORTABLE??process.cwd()+'/dist/Grid_Analyzer_PSSE_Portable.html',results=[];
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true}),page=await browser.newPage({viewport:{width:1600,height:900},offline:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const translate=CanvasRenderingContext2D.prototype.translate,rotate=CanvasRenderingContext2D.prototype.rotate,clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.translate=function(x,y){if(this.canvas.classList.contains('ga-psse-flow-canvas'))(window.__draws??=[]).push({x,y});return translate.call(this,x,y);};CanvasRenderingContext2D.prototype.rotate=function(angle){if(this.canvas.classList.contains('ga-psse-flow-canvas'))window.__draws.at(-1).angle=angle;return rotate.call(this,angle);};CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.classList.contains('ga-psse-flow-canvas'))window.__draws=[];return clear.apply(this,a);};});
 const paint=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 async function empty(){await page.waitForFunction(()=>document.querySelector('.ga-psse-flow-canvas').dataset.arrowCount==='0');assert.equal(await page.locator('.ga-psse-flow-canvas').evaluate(e=>e.getContext('2d').getImageData(0,0,e.width,e.height).data.some((v,i)=>i%4===3&&v>0)),false);}
 async function audit(mode){
  await assertCanvasMoves(page);
  const result=await page.evaluate(mode=>{
   const canvas=document.querySelector('.ga-psse-flow-canvas'),rect=canvas.getBoundingClientRect(),c=psseStudio.controller,rows=new Map(c.psseCalculation.branchResults.map(r=>[r.id,r])),paths=[];
   for(const p of document.querySelectorAll('.ga-psse-geo-link')){const row=rows.get(p.dataset.branchId);if(!row)continue;const m=p.getScreenCTM(),nums=p.getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number),points=[];for(let i=0;i<nums.length;i+=2)points.push({x:m.a*nums[i]+m.c*nums[i+1]+m.e-rect.left,y:m.b*nums[i]+m.d*nums[i+1]+m.f-rect.top});const lengths=points.slice(1).map((b,i)=>Math.hypot(b.x-points[i].x,b.y-points[i].y));paths.push({points,lengths,length:lengths.reduce((a,b)=>a+b,0),row});}
   let checked=0,maxDistance=0,forward=0,reverse=0;
   for(const draw of __draws.filter(p=>p.x>=0&&p.y>=0&&p.x<rect.width&&p.y<rect.height)){
    let nearest=Infinity,candidates=[];
    for(const path of paths){let walked=0;for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((draw.x-a.x)*dx+(draw.y-a.y)*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(draw.x-a.x-t*dx,draw.y-a.y-t*dy);nearest=Math.min(nearest,distance);if(distance<.01){const fraction=(walked+t*path.lengths[i-1])/path.length,normal=mode==='q'?(fraction<.5?path.row.qFromMvar>=0:path.row.qToMvar<0):path.row.pFromMw>0,angle=Math.atan2(dy,dx)+(normal?0:Math.PI),error=Math.abs(Math.atan2(Math.sin(draw.angle-angle),Math.cos(draw.angle-angle)));if(error<.01)candidates.push(normal);}walked+=path.lengths[i-1];}}
    maxDistance=Math.max(maxDistance,nearest);if(!candidates.length)throw Error('ARROW_DIRECTION_OR_ROUTE_MISMATCH '+mode+' '+nearest);if(candidates[0])forward++;else reverse++;checked++;
   }
   return {checked,maxDistance,forward,reverse};
  },mode);
  assert(result.checked>10&&result.maxDistance<.01,JSON.stringify(result));return result;
 }
 try{
  await page.goto(pathToFileURL(target).href);await page.locator('#pse-file').setInputFiles(channel==='chrome'?'control1/PSS_E_YEREL_TEK_TIK_PAKETI (8)/20261014_1200_SN3_TR0.sav':'control1/20261014_1200_SN3_TR0(psse_sav+digerdosyalar).zip');await page.waitForFunction(()=>psseStudio.controller.psseNetwork&&!psseStudio.controller.busy);await page.locator('[data-route=map]').click();
  const source=page.getByLabel('Değer katmanı',{exact:true}),flow=page.getByLabel('Akış',{exact:true}),metric=page.getByLabel('Harita metriği',{exact:true}),layout=page.getByLabel('Hat yerleşimi',{exact:true}),stage=page.locator('.ga-psse-geo-stage'),canvas=page.locator('.ga-psse-flow-canvas'),card=page.locator('.ga-map-selection');
  assert.equal(await page.evaluate(()=>psseStudio.controller.psseNetwork.buses.filter(b=>b.source).length),6851);
  await source.selectOption('saved');await flow.uncheck();await flow.check();await empty();assert.equal(await source.inputValue(),'saved');assert.equal(await page.evaluate(()=>psseStudio.controller.busy),false);assert.equal(await page.evaluate(()=>psseStudio.controller.psseCalculation),null);
  const saved=await page.locator('.ga-psse-geo-station').first().evaluate(e=>({id:e.dataset.isub,values:e.dataset.v12Rows}));
  await page.evaluate(()=>psseStudio.controller.runPsseCalculation('NR_POLAR',{reactiveLimitsEnabled:false}));await assertCanvasMoves(page);assert.equal(await source.inputValue(),'saved');assert.equal(await page.locator('.ga-psse-geo-station[data-isub="'+saved.id+'"]').getAttribute('data-v12-rows'),saved.values);
  const p=await audit('p');assert(p.forward>0&&p.reverse>0,'Real SAV must exercise both signed P directions');
  for(const value of ['calculated','saved']){await source.selectOption(value);await assertCanvasMoves(page);assert.equal(await source.inputValue(),value);await flow.uncheck();await empty();await flow.check();await assertCanvasMoves(page);assert.equal(await source.inputValue(),value);}
  // Both ends of every selected parallel must be independently hit-testable near its TM.
  await source.selectOption('calculated');await metric.selectOption('p');await layout.selectOption('separated');
  const group=await page.evaluate(()=>{
   const c=psseStudio.controller,n=c.psseNetwork,geo=c.engine.Zs(c.psseInspection,n),stations=new Map(geo.associations.map(a=>[a.connectionKey,String(a.stationIsub)])),byId=new Map(n.branches.map(b=>[b.id,b])),groups=new Map();
   for(const path of document.querySelectorAll('.ga-psse-geo-link')){const b=byId.get(path.dataset.branchId),key=[stations.get(n.buses[b.from].connectionKey),stations.get(n.buses[b.to].connectionKey)].sort().join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push({path,b});}
   for(const group of groups.values()){
    if(group.length<2||group.length>4)continue;const hits=[];let valid=true;
    for(const {path,b}of group){const m=path.getScreenCTM(),scale=Math.hypot(m.a,m.b),length=path.getTotalLength();if(length*scale<70){valid=false;break;}
     for(const side of ['from','to']){let hit;for(const distance of [6,8,10,14,18]){const p=path.getPointAtLength(side==='from'?distance/scale:length-distance/scale),x=m.a*p.x+m.c*p.y+m.e,y=m.b*p.x+m.d*p.y+m.f;if(document.elementFromPoint(x,y)===path){hit={id:b.id,equipmentId:b.sourceEquipmentId,x,y,side};break;}}if(!hit){valid=false;break;}hits.push(hit);}if(!valid)break;
    }if(valid)return hits;
   }throw Error('NO_PARALLEL_WITH_SELECTABLE_TM_ENDS');
  });
  for(const hit of group){await page.mouse.click(hit.x,hit.y);assert.equal(await card.getAttribute('data-equipment-id'),hit.equipmentId);assert.equal(await page.locator('.ga-psse-geo-link.is-focus').getAttribute('data-branch-id'),hit.id);await page.keyboard.press('Escape');}
  await layout.selectOption('standard');assert.equal(await page.locator('.ga-psse-geo-link').first().evaluate(e=>(e.getAttribute('d').match(/L/g)??[]).length),1);await layout.selectOption('separated');
  const box=await stage.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.6);for(let i=0;i<10;i++)await page.mouse.wheel(0,-100);await page.waitForFunction(()=>Number(document.querySelector('.ga-psse-geo-stage').dataset.zoom)>2.9);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+65,box.y+box.height*.6+25,{steps:5});await page.mouse.up();await paint();const zoomPan=await audit('p');
  await metric.selectOption('q');await assertCanvasMoves(page);await source.selectOption('saved');await assertCanvasMoves(page);assert.equal(await source.inputValue(),'saved');assert.equal(await canvas.getAttribute('data-flow-metric'),'q');const q=await audit('q');await flow.uncheck();await empty();await flow.check();await assertCanvasMoves(page);assert.equal(await canvas.getAttribute('data-flow-metric'),'q');assert.equal(await source.inputValue(),'saved');
  // A real P-only DC result must not enable the retained Q mode, even though P is usable.
  await page.evaluate(()=>psseStudio.controller.runPsseCalculation('LOSSLESS_DC'));await empty();assert.equal(await source.inputValue(),'saved');await source.selectOption('calculated');await metric.selectOption('p');await assertCanvasMoves(page);await source.selectOption('saved');await assertCanvasMoves(page);assert.equal(await source.inputValue(),'saved');
  assert.deepEqual(errors,[]);results.push({channel,sourceSAVPreserved:true,noResult:'EMPTY/no auto-solve',p,q,zoomPan,tmEndClicks:group.length,pOnlyDCInQ:'EMPTY',toggle:'MOVING/EMPTY',errors:0});await page.screenshot({path:`evidence/flow-source-parallel-${channel}.png`});console.log('PASS',channel,'SAV/GA independent flow, P/Q + DC gate, both TM ends, reverse direction, zoom/pan');
 }catch(error){await page.screenshot({path:`evidence/flow-source-parallel-${channel}-FAIL.png`});console.error('pageErrors',errors);throw error;}finally{await browser.close();}
}
await fs.writeFile('evidence/flow-source-parallel.json',JSON.stringify(results,null,2));
