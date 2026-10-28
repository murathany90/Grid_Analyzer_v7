import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const channel=process.argv[2]??'msedge';
const html=path.resolve(process.argv[3]??path.join(root,'dist-psse','index.html'));
const psseZip=path.resolve(process.argv[4]??'C:/Users/Murathan Yeniceli/Downloads/20261026_1600_SN1_TR0.zip');
const dgsZip=path.resolve(process.argv[5]??'C:/Users/Murathan Yeniceli/Downloads/20261026_1700_SN1_TR0.zip');
const out=path.resolve(process.argv[6]??path.join(root,'local-benchmark-results','psse-offline-browser','uifix3-private',channel));
const aggregate=path.resolve(process.argv[7]??path.join(root,'evidence','psse-uifix3',`browser-e2e-${channel}.json`));
const sourceHash=createHash('sha256').update(await readFile(html)).digest('hex');
const report={schema:'ga.psse.uifix3.browser-e2e.v1',status:'FAIL',browser:{channel},artifact:{sha256:sourceHash,bytes:(await readFile(html)).byteLength},offline:{scheme:'file:',externalRequestCount:0,blockedRequestCount:0},workflow:{psseZipImport:false,dgsZipImport:false,fullAcNr:false,mapFlows:false,lightningSourceFlowsMissing:false,lightningCalculatedPqil:false,lightningDelta:false,branchScenarioRecalculated:false,baseScenarioDelta:false,undo:false,calculationOptionsReused:false},map:{viewports:[],wheelAnchorDriftCssPx:null,childDragPan:false,fullscreen:[]},errors:[]};
await mkdir(out,{recursive:true});
await mkdir(path.dirname(aggregate),{recursive:true});
const browser=await chromium.launch({channel,headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND']});
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,acceptDownloads:true});
const blocked=[];
await context.route(/^https?:\/\//,async route=>{blocked.push(route.request().url());await route.abort();});
const page=await context.newPage();
await page.addInitScript(()=>{
  window.__psseWorkerRequests=[];
  const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(message,...transfer){if(message?.type==='RUN'&&message?.method)window.__psseWorkerRequests.push({method:message.method,options:structuredClone(message.options??{})});return post.call(this,message,...transfer);};
  const stroke=CanvasRenderingContext2D.prototype.stroke;
  CanvasRenderingContext2D.prototype.stroke=function(...args){
    if(this.canvas?.classList.contains('ga-psse-geo-basemap')){const m=this.getTransform();window.__uifix3CanvasTransform={a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f,dpr:devicePixelRatio};}
    return stroke.apply(this,args);
  };
});
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});

async function waitLoaded(mode){
  await page.waitForFunction(expected=>document.querySelector('.ga-mode-card')?.textContent?.trim()===expected&&document.querySelector('.ga-busy')?.hidden===true,mode,{timeout:240000});
}
async function uploadZip(file,mode,preferredExtension){
  await page.locator('#modelFileInput').setInputFiles(file);
  const chooser=page.getByRole('dialog',{name:'ZIP içinden model seç'});
  if(await chooser.count()&&await chooser.isVisible()){
    const select=chooser.getByLabel('ZIP içindeki model dosyası');
    const choices=await select.locator('option').evaluateAll(nodes=>nodes.map(node=>({value:node.value,label:node.textContent??''})));
    const selected=choices.find(choice=>choice.value.toLowerCase().endsWith(preferredExtension)||choice.label.toLowerCase().endsWith(preferredExtension));
    assert.ok(selected,`ZIP includes a ${preferredExtension} model`);
    await select.selectOption(selected.value);
    await chooser.getByRole('button',{name:'Seçilen modeli yükle',exact:true}).click();
  }
  await waitLoaded(mode);
}
async function go(label){await page.locator('.ga-nav').getByRole('button',{name:label,exact:true}).click();}
async function canvasMetrics(dpr,width,height){
  const session=await context.newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
  await page.waitForFunction(({w,h,d})=>window.innerWidth===w&&window.innerHeight===h&&Math.abs(window.devicePixelRatio-d)<.001,{w:width,h:height,d:dpr});
  await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('.ga-psse-geo-stage canvas');if(!canvas)return false;const box=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio;
    return Math.abs(canvas.width-box.width*dpr)<=1.1&&Math.abs(canvas.height-box.height*dpr)<=1.1;
  },undefined,{timeout:10000});
  const metric=await page.locator('.ga-psse-geo-stage').evaluate(stage=>{
    const canvas=stage.querySelector('canvas'),svg=stage.querySelector('svg'),toolbar=stage.closest('.ga-psse-map')?.querySelector('.ga-psse-diagram-controls');
    if(!canvas||!svg)throw Error('Basemap canvas or geography SVG is missing');
    const a=canvas.getBoundingClientRect(),b=svg.getBoundingClientRect(),s=stage.getBoundingClientRect(),dpr=window.devicePixelRatio;
    const toolbarRect=toolbar?.getBoundingClientRect(),station=stage.querySelector('.ga-psse-geo-station'),circle=station?.querySelector('circle'),m=window.__uifix3CanvasTransform;
    if(!station||!circle||!m)throw Error('Canvas transform or source-coordinate station hook is missing');
    const worldX=Number(station.dataset.worldX),worldY=Number(station.dataset.worldY),pt=svg.createSVGPoint();pt.x=Number(circle.getAttribute('cx'));pt.y=Number(circle.getAttribute('cy'));const actual=pt.matrixTransform(circle.getScreenCTM()),expectedX=a.x+(m.a*worldX+m.c*worldY+m.e)/dpr,expectedY=a.y+(m.b*worldX+m.d*worldY+m.f)/dpr;
    return{viewport:{width:innerWidth,height:innerHeight,dpr},toolbar:{height:toolbarRect?.height??0},stage:{width:s.width,height:s.height},canvas:{width:a.width,height:a.height,pixelWidth:canvas.width,pixelHeight:canvas.height},svg:{width:b.width,height:b.height},scaleErrorCssPx:Math.max(Math.abs(canvas.width-a.width*dpr),Math.abs(canvas.height-a.height*dpr)),overlayErrorCssPx:Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.width-b.width),Math.abs(a.height-b.height)),basemapPointAlignmentErrorCssPx:Math.hypot(actual.x-expectedX,actual.y-expectedY),canvasTransform:{a:m.a,d:m.d,e:m.e,f:m.f},screenScale:Number(stage.dataset.screenScale),zoom:Number(stage.dataset.zoom),pan:{x:Number(stage.dataset.panX),y:Number(stage.dataset.panY)}};
  });
  assert.ok(metric.stage.width>300&&metric.stage.height>260,'map viewport is visible');
  assert.ok(metric.scaleErrorCssPx<=1.1,`canvas backing store matches DPR ${dpr}`);
  assert.ok(metric.overlayErrorCssPx<=1.1,'basemap canvas and geography SVG share the same overlay bounds');
  assert.ok(metric.basemapPointAlignmentErrorCssPx<=1.1,`projected source station matches actual Canvas stroke transform at DPR ${dpr} (${metric.basemapPointAlignmentErrorCssPx.toFixed(2)} px)`);
  assert.ok(metric.screenScale>0&&Number.isFinite(metric.screenScale),'map exposes a finite screen scale');
  report.map.viewports.push(metric);
  await session.detach();
  return metric;
}

try{
  await page.goto(pathToFileURL(html).href,{waitUntil:'load'});
  await page.waitForSelector('.ga-app-head');
  await uploadZip(psseZip,'PSS/E MODU','.sav');
  report.workflow.psseZipImport=true;
  await page.screenshot({path:path.join(out,'psse-model-1600x1000.png')});

  await go('Analizler');
  const panel=page.locator('.ga-psse-analysis:visible');
  const method=panel.getByLabel('PSS/E çözüm yöntemi');
  await method.selectOption('NR_POLAR');
  const options=panel.locator('details.ga-psse-analysis-options');
  if(!await options.evaluate(node=>node.open))await options.locator('summary').click();
  await panel.getByLabel('AC ilk gerilim').selectOption('SOURCE_SAVED');
  const baselineStarted=Date.now();
  await panel.getByRole('button',{name:'Hesapla',exact:true}).click();
  await page.waitForFunction(()=>{
    const cards=[...document.querySelectorAll('.ga-psse-analysis .ga-card')];
    const method=cards.find(card=>card.querySelector('span')?.textContent==='Yöntem')?.querySelector('strong')?.textContent;
    const status=cards.find(card=>card.querySelector('span')?.textContent==='Durum')?.querySelector('strong')?.textContent;
    const classification=cards.find(card=>card.querySelector('span')?.textContent==='Çözüm sınıfı')?.querySelector('strong')?.textContent;
    return method==='NR_POLAR'&&['CONVERGED','LIMITED_PROFILE'].includes(status)&&['SOLVED_FULL','SOLVED_APPROXIMATE'].includes(classification);
  },undefined,{timeout:240000});
  report.workflow.fullAcNr=true;
  const firstRequest=(await page.evaluate(()=>window.__psseWorkerRequests.filter(item=>item.method==='NR_POLAR'))).at(-1);
  assert.equal(firstRequest?.options?.initialVoltagePolicy,'SOURCE_SAVED','the first AC NR worker request uses saved source voltages');
  const baselineCards=await panel.locator('.ga-card').evaluateAll(cards=>Object.fromEntries(cards.map(card=>[card.querySelector('span')?.textContent??'',card.querySelector('strong')?.textContent??''])));
  const sourceCard=panel.locator('.ga-card').filter({hasText:'Kaynak'});
  assert.equal(await sourceCard.locator('strong').textContent(),'GA hesaplandı','result identifies an application calculation');
  assert.equal(await sourceCard.getAttribute('title'),'GA_PSSE_CALCULATED','the exact result source is present in provenance');
  report.workflow.baseline={method:'NR_POLAR',initialVoltage:'SOURCE_SAVED',numericalStatus:'CONVERGED',publicationStatus:baselineCards.Durum??'LIMITED_PROFILE',classification:baselineCards['Çözüm sınıfı']??'SOLVED_APPROXIMATE',source:'GA_PSSE_CALCULATED',elapsedMs:Date.now()-baselineStarted};
  await panel.screenshot({path:path.join(out,'psse-full-ac-1600x1000.png')});

  await go('Harita');
  const map=page.locator('.ga-psse-map:visible');
  const stage=map.locator('.ga-psse-geo-stage');
  await stage.waitFor({timeout:20000});
  const initial=await canvasMetrics(1,1600,1000);
  assert.ok(await map.locator('.ga-psse-geo-station title').filter({hasText:'SOURCE_SAVED'}).count()>0,'saved source data remains labeled as source-saved');
  await map.getByLabel('Değer katmanı',{exact:true}).selectOption('calculated');
  assert.ok(await map.locator('.ga-psse-geo-station title').filter({hasText:'GA_PSSE_CALCULATED'}).count()>0,'calculated map values are labeled as application-calculated');
  const metric=map.getByLabel('Harita metriği');
  await metric.selectOption('p');
  assert.match(await map.locator('.ga-psse-diagram-legend').textContent(),/Aktif güç P \(MW\)/,'real calculated active power flow is displayed');
  const finiteBranchP=await map.locator('.ga-psse-geo-link[data-branch-id] title').evaluateAll(nodes=>nodes.some(node=>/P=[+-]?(?:\d+(?:[,.]\d+)?|[,.]\d+)(?:e[+-]?\d+)? MW/i.test(node.textContent??'')));
  const calculatedFlowArrows=await map.locator('.ga-psse-geo-flow-arrow[data-branch-id]').count();
  assert.equal(finiteBranchP,true,'at least one real branch title exposes a finite calculated P flow');
  assert.ok(calculatedFlowArrows>0,'calculated map renders nonzero directional flow arrows');
  report.workflow.mapFlows={finiteBranchP:true,calculatedFlowArrows:true};
  await page.screenshot({path:path.join(out,'psse-map-1600x1000.png')});

  const lightning=map.locator('.ga-psse-lightning');
  await map.locator('.ga-psse-lightning-toggle').click();
  await lightning.waitFor({timeout:10000});
  const lightningLayer=lightning.getByLabel('Sonuç katmanı'),lightningKind=lightning.getByLabel('Sonuç tablosu');
  await lightningLayer.selectOption('source');await lightningKind.selectOption('branches');
  const sourceBranchRows=await lightning.locator('.ga-psse-lightning-table tbody tr').evaluateAll(rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent?.trim()??'')));
  assert.ok(sourceBranchRows.length>0&&sourceBranchRows.every(row=>row.slice(2).every(cell=>cell==='— / —')),'source branch layer never invents solved P/Q/current/loading values');
  assert.ok(sourceBranchRows.every(row=>row[0]!==''&&!/^(?:line:|branch:)/i.test(row[0])),'lightning table uses name-first branch labels');
  report.workflow.lightningSourceFlowsMissing=true;
  await lightningLayer.selectOption('base');
  const calculatedBranchRows=await lightning.locator('.ga-psse-lightning-table tbody tr').evaluateAll(rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent?.trim()??'')));
  const finite=/[+-]?(?:\d+(?:[,.]\d+)?|[,.]\d+)(?:e[+-]?\d+)?/i;
  assert.ok([2,3,4,5].every(index=>calculatedBranchRows.some(row=>finite.test(row[index]??''))),'calculated panel has real P, Q, current and loading values');
  report.workflow.lightningCalculatedPqil=true;
  await page.screenshot({path:path.join(out,'psse-lightning-1600x1000.png')});
  await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(180);
  await page.screenshot({path:path.join(out,'psse-lightning-1366x768.png')});
  await page.setViewportSize({width:1600,height:1000});await page.waitForTimeout(120);
  await lightning.locator('button[title="Sonuç panelini kapat"]').click();

  const wheelTarget=map.locator('.ga-psse-geo-station').first();
  const wheelBox=await wheelTarget.boundingBox();
  assert.ok(wheelBox,'map has a visible station for anchored zoom');
  const wheelX=wheelBox.x+wheelBox.width/2,wheelY=wheelBox.y+wheelBox.height/2;
  const stationKey=await wheelTarget.getAttribute('data-isub');
  await page.mouse.move(wheelX,wheelY);
  const beforeWheel=await wheelTarget.boundingBox();
  await page.mouse.wheel(0,-120);
  await page.waitForTimeout(80);
  const afterWheel=await map.locator(`.ga-psse-geo-station[data-isub="${stationKey}"]`).boundingBox();
  assert.ok(beforeWheel&&afterWheel,'wheel target survives redraw');
  const wheelDrift=Math.hypot((afterWheel.x+afterWheel.width/2)-(beforeWheel.x+beforeWheel.width/2),(afterWheel.y+afterWheel.height/2)-(beforeWheel.y+beforeWheel.height/2));
  report.map.wheelAnchorDriftCssPx=Number(wheelDrift.toFixed(3));
  assert.ok(wheelDrift<=2,`wheel zoom stays anchored at pointer (${wheelDrift.toFixed(2)} CSS px)`);
  const zoomed=await stage.evaluate(node=>({zoom:Number(node.dataset.zoom),x:Number(node.dataset.panX),y:Number(node.dataset.panY)}));
  await page.mouse.move(wheelX,wheelY);await page.mouse.wheel(0,120);await page.waitForTimeout(60);
  const afterOppositeWheel=await stage.evaluate(node=>({zoom:Number(node.dataset.zoom),x:Number(node.dataset.panX),y:Number(node.dataset.panY)}));
  assert.ok(zoomed.zoom>1&&afterOppositeWheel.zoom<zoomed.zoom,'opposite wheel input reverses the zoom direction');
  const wheelRoundtrip={zoomError:Math.abs(afterOppositeWheel.zoom-1),panError:Math.hypot(afterOppositeWheel.x,afterOppositeWheel.y)};
  assert.ok(wheelRoundtrip.zoomError<1e-9&&wheelRoundtrip.panError<.1,'opposite wheel input restores the exact initial map transform');
  report.map.wheelRoundtrip=wheelRoundtrip;

  await map.locator('button[title="Türkiye altlığını sığdır"]').click();
  const panStart=await stage.evaluate(node=>({x:Number(node.dataset.panX),y:Number(node.dataset.panY)}));
  const child=map.locator('.ga-psse-geo-station').first(),childBox=await child.boundingBox();
  assert.ok(childBox,'SVG child is available for a pan drag');
  const cx=childBox.x+childBox.width/2,cy=childBox.y+childBox.height/2;
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+48,cy+19,{steps:5});await page.mouse.up();
  const panEnd=await stage.evaluate(node=>({x:Number(node.dataset.panX),y:Number(node.dataset.panY)}));
  assert.ok(Math.hypot(panEnd.x-panStart.x,panEnd.y-panStart.y)>1,'dragging an SVG child pans the map');
  assert.equal(await page.locator('.ga-psse-diagram-dialog[open]').count(),0,'dragging a station does not open its detail dialog');
  report.map.childDragPan=true;
  await map.locator('button[title="Türkiye altlığını sığdır"]').click();
  const fitState=await stage.evaluate(node=>({zoom:Number(node.dataset.zoom),x:Number(node.dataset.panX),y:Number(node.dataset.panY)}));
  assert.deepEqual(fitState,{zoom:1,x:0,y:0},'fit returns to the exact initial map transform after zoom and pan');
  report.map.fitRoundtrip=true;

  const branchLines=map.locator('.ga-psse-geo-link[data-branch-id]');
  const candidate=await map.evaluate(root=>{
    const arrowIds=new Set([...root.querySelectorAll('.ga-psse-geo-flow-arrow[data-branch-id]')].map(arrow=>arrow.getAttribute('data-branch-id')));
    return [...root.querySelectorAll('.ga-psse-geo-link[data-branch-id]')].find(line=>{
      const title=line.querySelector('title')?.textContent??'',id=line.getAttribute('data-branch-id');
      return title.includes('serviste')&&!/3W sargısı/i.test(title)&&arrowIds.has(id);
    })?.getAttribute('data-branch-id')??null;
  });
  assert.ok(candidate,'a served branch with a real calculated directional arrow is available');
  const selectedBranchToken=candidate;
  const selectedLine=map.locator(`.ga-psse-geo-link[data-branch-id="${selectedBranchToken}"]`);
  const selectedLabel=await selectedLine.getAttribute('aria-label');
  assert.ok(selectedLabel,'map line exposes its accessible branch name');
  await selectedLine.focus();await selectedLine.press('Enter');
  const dialog=page.locator('.ga-psse-diagram-dialog[open]');
  await dialog.waitFor({timeout:10000});
  assert.equal(await dialog.locator('h3').textContent(),selectedLabel,'keyboard activation opens the selected branch details');
  const outage=dialog.locator('.ga-psse-dialog-scenario');
  assert.equal(await outage.isVisible(),true,'selected branch can be opened through its map detail');
  await outage.click();
  await page.waitForFunction(()=>!document.querySelector('.ga-busy:not([hidden])')&&document.querySelector('.ga-psse-map-stage')?.textContent?.includes('(1 işlem)'),undefined,{timeout:240000});
  const afterScenarioRequests=await page.evaluate(()=>window.__psseWorkerRequests.filter(item=>item.method==='NR_POLAR'));
  assert.ok(afterScenarioRequests.length>=2,'the branch operation triggers another NR worker request');
  assert.deepEqual(afterScenarioRequests[1].options,firstRequest.options,'scenario NR reuses the baseline options');
  report.workflow.branchScenarioRecalculated=true;
  await go('Analizler');
  await page.waitForFunction(()=>{
    const cards=[...document.querySelectorAll('.ga-psse-analysis .ga-card')];
    const status=cards.find(card=>card.querySelector('span')?.textContent==='Durum')?.querySelector('strong')?.textContent;
    const classification=cards.find(card=>card.querySelector('span')?.textContent==='Çözüm sınıfı')?.querySelector('strong')?.textContent;
    return ['CONVERGED','LIMITED_PROFILE'].includes(status)&&['SOLVED_FULL','SOLVED_APPROXIMATE'].includes(classification);
  },undefined,{timeout:30000});
  await go('Harita');
  await map.getByLabel('LF görünümü').selectOption('base');
  await map.getByLabel('Harita metriği').selectOption('p');
  assert.match(await map.locator('.ga-psse-diagram-legend').textContent(),/Aktif güç P \(MW\)/,'Baz flow layer is available');
  await map.getByLabel('LF görünümü').selectOption('scenario');
  assert.equal(await map.getByLabel('Değer katmanı').inputValue(),'calculated','Senaryo view uses GA-calculated results');
  assert.equal(await map.locator(`.ga-psse-geo-flow-arrow[data-branch-id="${selectedBranchToken}"]`).count(),0,'the opened branch has no flow arrow in the active scenario view');
  await map.getByLabel('LF görünümü').selectOption('delta');
  assert.match(await map.locator('.ga-psse-diagram-legend').textContent(),/Senaryo − baz/,'Fark view uses compatible base and scenario calculations');
  report.workflow.baseScenarioDelta=true;
  await map.locator('.ga-psse-lightning-toggle').click();
  await lightningLayer.selectOption('delta');await lightningKind.selectOption('branches');
  assert.match(await lightning.locator('.ga-psse-lightning-context').textContent(),/Fark = Senaryo − Baz/,'lightning panel labels the comparison as scenario minus base');
  const deltaRows=await lightning.locator('.ga-psse-lightning-table tbody tr').evaluateAll(rows=>rows.map(row=>[...row.cells].map(cell=>cell.textContent?.trim()??'')));
  assert.ok(deltaRows.some(row=>[2,3,4,5].some(index=>finite.test(row[index]??''))),'lightning delta table publishes compatible finite differences');
  report.workflow.lightningDelta=true;
  await lightning.locator('button[title="Sonuç panelini kapat"]').click();

  const technical=map.locator('.ga-psse-map-details');
  if(!await technical.evaluate(node=>node.open))await technical.locator('summary').click();
  await map.getByLabel('Servis durumu filtresi').selectOption('all');
  const scenarioBranch=map.locator(`.ga-psse-geo-link[data-branch-id="${selectedBranchToken}"]`);
  await scenarioBranch.waitFor({timeout:10000});
  await scenarioBranch.focus();await scenarioBranch.press('Enter');
  const undoDialog=page.locator('.ga-psse-diagram-dialog[open]');
  const undo=undoDialog.locator('.ga-psse-dialog-scenario');
  await undo.waitFor({timeout:10000});
  assert.equal(await undo.isVisible(),true,'the changed branch exposes its scenario undo action');
  await undoDialog.getByRole('button',{name:'Kapat',exact:true}).click();
  const station=map.locator('.ga-psse-geo-station').first();
  await station.focus();await station.press('Enter');
  const stationDialog=page.locator('.ga-psse-diagram-dialog[open]');
  await stationDialog.waitFor({timeout:10000});
  assert.equal(await stationDialog.locator('.ga-psse-dialog-scenario').isVisible(),false,'opening station details does not retain a stale branch action');
  await stationDialog.getByRole('button',{name:'Kapat',exact:true}).click();
  await scenarioBranch.focus();await scenarioBranch.press('Enter');
  const finalUndoDialog=page.locator('.ga-psse-diagram-dialog[open]');
  const finalUndo=finalUndoDialog.locator('.ga-psse-dialog-scenario');
  await finalUndo.waitFor({timeout:10000});
  await finalUndo.click();
  await page.waitForFunction(()=>document.querySelector('.ga-psse-map-stage')?.textContent?.includes('(0 işlem)')&&!document.querySelector('.ga-busy:not([hidden])'),undefined,{timeout:240000});
  const afterUndoRequests=await page.evaluate(()=>window.__psseWorkerRequests.filter(item=>item.method==='NR_POLAR'));
  assert.ok(afterUndoRequests.length>=3,'undo triggers a third NR worker request');
  assert.deepEqual(afterUndoRequests[2].options,firstRequest.options,'undo NR reuses the baseline options');
  report.workflow.calculationOptionsReused=true;
  report.workflow.undo=true;
  await map.locator('button[title="Türkiye altlığını sığdır"]').click();
  await page.screenshot({path:path.join(out,'psse-map-undo-1600x1000.png')});

  // Browser emulation checks the shared canvas/SVG transform at three pixel ratios and two sizes.
  for(const dpr of [1,1.25,2])for(const size of [{width:1600,height:1000},{width:1366,height:768}])await canvasMetrics(dpr,size.width,size.height);
  const fullscreenResults=[];
  if(await technical.evaluate(node=>node.open))await technical.locator('summary').click();
  for(const dpr of [1,1.25,2]){
    const before=await canvasMetrics(dpr,1600,1000);
    await map.getByRole('button',{name:'Tam ekran',exact:true}).click();
    await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('ga-psse-map'),undefined,{timeout:10000});
    const during=await page.evaluate(()=>{
      const root=document.querySelector('.ga-psse-map'),stage=root?.querySelector('.ga-psse-geo-stage');
      const toolbar=root?.querySelector('.ga-psse-diagram-controls'),details=root?.querySelector('.ga-psse-map-details');
      const r=root?.getBoundingClientRect(),s=stage?.getBoundingClientRect();
      const t=toolbar?.getBoundingClientRect(),d=details?.getBoundingClientRect();
      return{width:s?.width??0,height:s?.height??0,rootWidth:r?.width??0,rootHeight:r?.height??0,toolbarHeight:t?.height??0,detailsHeight:d?.height??0,detailsOpen:details?.hasAttribute('open')??false,availableMapHeight:(r?.height??0)-(t?.height??0)-(d?.height??0)-40,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},fullscreen:document.fullscreenElement===root};
    });
    fullscreenResults.push({dpr,width:during.width,height:during.height,rootWidth:during.rootWidth,rootHeight:during.rootHeight,toolbarHeight:during.toolbarHeight,detailsHeight:during.detailsHeight,detailsOpen:during.detailsOpen,availableMapHeight:during.availableMapHeight,passed:during.fullscreen});
    report.map.fullscreen=fullscreenResults;
    assert.equal(during.fullscreen,true);
    assert.ok(during.rootWidth>=during.viewport.width-5&&during.rootHeight>=during.viewport.height-5,'map root fills the fullscreen viewport');
    assert.equal(during.detailsOpen,false,'technical details are closed in fullscreen layout');
    assert.ok(during.width>=during.rootWidth-50&&during.height>=during.availableMapHeight-10,'map stage fills available fullscreen space under the compact toolbar');
    if(dpr===2)await page.screenshot({path:path.join(out,'psse-map-fullscreen-dpr2.png')});
    await map.locator('button').filter({hasText:'Çık'}).click();
    await page.waitForFunction(()=>document.fullscreenElement===null,undefined,{timeout:10000});
    await page.setViewportSize({width:1600,height:1000});
  }
  report.map.fullscreen=fullscreenResults;
  await canvasMetrics(1,1366,768);
  await page.screenshot({path:path.join(out,'psse-map-1366x768.png')});
  await canvasMetrics(1,1600,1000);

  // The matching local DGS ZIP is a user-owned model. Capture only local screenshots; report no model fingerprint or data values.
  await uploadZip(dgsZip,'DGS MODU','.json');
  report.workflow.dgsZipImport=true;
  await page.screenshot({path:path.join(out,'dgs-model-1600x1000.png')});
  await go('Harita');
  const dgsMap=page.locator('.ga-map-view:visible');
  await dgsMap.waitFor({timeout:30000});
  await page.screenshot({path:path.join(out,'dgs-map-1600x1000.png')});
  await page.setViewportSize({width:1366,height:768});
  await page.waitForTimeout(250);
  await page.screenshot({path:path.join(out,'dgs-map-1366x768.png')});

  const external=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>/^https?:/i.test(name)));
  report.offline.externalRequestCount=external.length;
  report.offline.blockedRequestCount=blocked.length;
  report.browser.version=browser.version();
  assert.deepEqual(external,[],'no remote resources were loaded');
  assert.deepEqual(blocked,[],'strict offline CSP generated no attempted network requests');
  assert.deepEqual(report.errors,[],'no page or console errors');
  assert.equal(report.workflow.undo,true);
  report.status='PASS';
}catch(error){
  report.errors.push(error instanceof Error?error.message:String(error));
  throw error;
}finally{
  await browser.close();
  report.privacy={privateScreenshots:true,modelNamesHashesValuesAndCoordinatesOmitted:true,screenshotDirectory:'local-benchmark-results/psse-offline-browser/uifix3-private'};
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  await writeFile(aggregate,JSON.stringify(report,null,2)+'\n');
  console.log('PSSE_UIFIX3_BROWSER '+JSON.stringify(report));
}
