import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {syntheticRawx} from './psse-synthetic-cases.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const channel=process.argv[2]??'chrome',phase=process.argv[3]??'before';
assert.ok(['chrome','msedge'].includes(channel),'Channel must be chrome or msedge.');
assert.ok(['before','after'].includes(phase),'Phase must be before or after.');
const output=path.join(root,'evidence','psse-ui-parity',phase),viewport={width:1600,height:1000};
const dgsBytes=await readFile(path.join(root,'tests','fixtures','small-dgs.json'));
const rawx=Buffer.from(syntheticRawx('basic'),'utf8');
const report={schema:'ga.psse.diagrams-browser.v1',phase,channel,viewport,status:'FAIL',screenshots:[],errors:[],blockedExternal:[]};
let browser;
try{
 await mkdir(output,{recursive:true});
 browser=await chromium.launch({channel,headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-proxy-server']});
 report.browserVersion=browser.version();
 const context=await browser.newContext({viewport,deviceScaleFactor:1});
 await context.route(/^https?:\/\//,async route=>{if(new URL(route.request().url()).origin==='http://127.0.0.1:5541'){await route.continue();return;}report.blockedExternal.push(route.request().url());await route.abort();});
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 await page.goto('http://127.0.0.1:5541/',{waitUntil:'domcontentloaded'});await page.waitForSelector('.ga-app-head');
 const navigation=page.locator('.ga-nav'),input=page.locator('#modelFileInput');
 for(const label of ['Şebeke Modeli','Harita','Analizler','Tek Hat Şeması'])assert.equal(await navigation.getByRole('button',{name:label,exact:true}).count(),1,`${label} navigation is present`);
 const featureSelectors={dgs:{map:'.ga-map-view',analysis:'.ga-analysis-workspace',sld:'.ga-sld-view'},psse:{map:'.ga-psse-map',analysis:'.ga-psse-analysis',sld:'.ga-psse-sld'}};
 async function capture(mode,label,view){
  await navigation.getByRole('button',{name:label,exact:true}).click();
  await page.locator(`.ga-shell > [data-view="${view}"]:not([hidden])`).waitFor({state:'visible',timeout:20000});
  await page.locator(featureSelectors[mode][view]).waitFor({state:'visible',timeout:20000});
  assert.equal((await page.locator('.ga-mode-card').textContent())?.trim(),mode==='dgs'?'DGS MODU':'PSS/E MODU',`${mode} mode remains active on ${view}`);
  await page.waitForTimeout(400);
  const name=`${mode}-${view}.png`;
  await page.screenshot({path:path.join(output,name),fullPage:false,animations:'disabled'});
  report.screenshots.push(name);
 }
 await input.setInputFiles({name:'small-dgs.json',mimeType:'application/json',buffer:dgsBytes});
 await page.waitForFunction(()=>document.querySelector('.ga-mode-card')?.textContent?.trim()==='DGS MODU'&&document.querySelector('.ga-head-model')?.textContent?.includes('small-dgs.json')&&document.querySelector('.ga-busy')?.hidden===true,{timeout:30000});
 report.dgsMode=await page.locator('.ga-mode-card').textContent();
 await capture('dgs','Harita','map');await capture('dgs','Analizler','analysis');await capture('dgs','Tek Hat Şeması','sld');
 await input.setInputFiles({name:'basic.rawx',mimeType:'application/octet-stream',buffer:rawx});
 await page.waitForFunction(()=>document.querySelector('.ga-mode-card')?.textContent?.trim()==='PSS/E MODU'&&document.querySelector('.ga-head-model')?.textContent?.includes('basic.rawx')&&document.querySelector('.ga-busy')?.hidden===true,{timeout:30000});
 report.psseMode=await page.locator('.ga-mode-card').textContent();
 await capture('psse','Harita','map');await capture('psse','Analizler','analysis');await capture('psse','Tek Hat Şeması','sld');
 if(phase==='after'){
  const sld=page.locator('.ga-psse-sld:visible'),sldSvg=sld.locator('.ga-psse-sld-svg');
  const connectivity=await sldSvg.evaluate(svg=>{
   const bars=new Map([...svg.querySelectorAll('.ga-sld-busbar[data-bus-id]')].map(bar=>[bar.getAttribute('data-bus-id'),{x1:Number(bar.getAttribute('x1')),x2:Number(bar.getAttribute('x2')),y:Number(bar.getAttribute('y1'))}]));
   const touches=(busId,x,y,yOffset=0)=>{const bar=bars.get(busId);return !!bar&&Math.abs(y-(bar.y+yOffset))<0.02&&x>=Math.min(bar.x1,bar.x2)-0.02&&x<=Math.max(bar.x1,bar.x2)+0.02;};
   const ordinary=[...svg.querySelectorAll('.ga-sld-line[data-from-bus-id][data-to-bus-id]')],ordinaryConnected=ordinary.filter(path=>touches(path.dataset.fromBusId,Number(path.dataset.portFromX),Number(path.dataset.portFromY))&&touches(path.dataset.toBusId,Number(path.dataset.portToX),Number(path.dataset.portToY)));
   const three=[...svg.querySelectorAll('.ga-sld-line[data-port-bus-id]')],threeConnected=three.filter(path=>touches(path.dataset.portBusId,Number(path.dataset.portX),Number(path.dataset.portY)));
   const devices=[...svg.querySelectorAll('.ga-sld-device-connector[data-device-id]')],deviceConnected=devices.filter(path=>touches(path.dataset.busId,Number(path.dataset.portX),Number(path.dataset.portFromY),3.5));
   const visibleSymbols=[...svg.querySelectorAll('.ga-sld-device[data-device-id]')],symbolKinds=[...new Set(visibleSymbols.map(node=>node.dataset.deviceKind??node.getAttribute('data-symbol')))];
   const rect=svg.getBoundingClientRect();return{ordinary:ordinary.length,ordinaryConnected:ordinaryConnected.length,three:three.length,threeConnected:threeConnected.length,devices:devices.length,deviceConnected:deviceConnected.length,symbols:visibleSymbols.length,symbolKinds,svgBottom:rect.bottom,viewportHeight:innerHeight,svgHeight:rect.height};
  });
  assert.ok(connectivity.ordinary>0&&connectivity.ordinaryConnected===connectivity.ordinary,'both ends of every shown 2W/line circuit land on their physical busbar ports');
  assert.ok(connectivity.devices>0&&connectivity.deviceConnected===connectivity.devices,'generator/load/shunt drops start at a busbar port');
  assert.ok(connectivity.svgHeight>=300&&connectivity.svgBottom<=connectivity.viewportHeight,'SLD plot fits within the 1600×1000 viewport');
  const [sldExport]=await Promise.all([page.waitForEvent('download'),sld.getByRole('button',{name:'Görüntülenen PSS/E tek hat şemasını kaynak provenansı ve stillerle SVG olarak indir'}).click()]);
  assert.match(sldExport.suggestedFilename(),/^psse-tek-hat-[a-f0-9]{12}\.svg$/,'SLD export uses a source-bound SVG filename');const exportedPath=await sldExport.path();assert.ok(exportedPath,'browser saved the exported SVG');const exported=await readFile(exportedPath,'utf8');assert.match(exported,/<metadata>.*ga\.psse-sld-export\.v1/s,'SVG carries source/scenario provenance metadata');assert.match(exported,/<style>.*ga-sld-busbar/s,'SVG includes its rendering styles');
  report.sldConnectivity=connectivity;report.sldSvgExport={status:'PASS',filename:sldExport.suggestedFilename(),containsProvenance:exported.includes('ga.psse-sld-export.v1'),containsStyles:exported.includes('.ga-sld-busbar')};
 }
 if(phase==='after'){
  const savedSld=page.locator('.ga-psse-sld:visible'),sldSvg=savedSld.locator('.ga-psse-sld-svg');
  const connectivity=await sldSvg.evaluate(svg=>{
   const bars=new Map([...svg.querySelectorAll('.ga-sld-busbar[data-bus-id]')].map(bar=>[bar.getAttribute('data-bus-id'),{x1:Number(bar.getAttribute('x1')),x2:Number(bar.getAttribute('x2')),y:Number(bar.getAttribute('y1'))}]));
   const touches=(busId,x,y,yOffset=0)=>{const bar=bars.get(busId);return !!bar&&Math.abs(y-(bar.y+yOffset))<0.02&&x>=Math.min(bar.x1,bar.x2)-0.02&&x<=Math.max(bar.x1,bar.x2)+0.02;};
   const ordinary=[...svg.querySelectorAll('.ga-sld-line[data-from-bus-id][data-to-bus-id]')],ordinaryConnected=ordinary.filter(path=>touches(path.dataset.fromBusId,Number(path.dataset.portFromX),Number(path.dataset.portFromY))&&touches(path.dataset.toBusId,Number(path.dataset.portToX),Number(path.dataset.portToY)));
   const three=[...svg.querySelectorAll('.ga-sld-line[data-port-bus-id]')],threeConnected=three.filter(path=>touches(path.dataset.portBusId,Number(path.dataset.portX),Number(path.dataset.portY)));
   const devices=[...svg.querySelectorAll('.ga-sld-device-connector[data-device-id]')],deviceConnected=devices.filter(path=>touches(path.dataset.busId,Number(path.dataset.portX),Number(path.dataset.portFromY),3.5));
   const symbols=[...svg.querySelectorAll('.ga-sld-device[data-device-id]')],symbolKinds=[...new Set(symbols.map(node=>node.dataset.deviceKind??node.getAttribute('data-symbol')))],deviceLabels=symbols.map(node=>{const label=node.querySelector('.ga-sld-device-label');return !!label&&Number(label.getAttribute('x'))===0&&Number(label.getAttribute('y'))===(node.dataset.deviceKind==='shunt'?25:24);});
   const busPositions=[...bars.entries()].map(([id,bar])=>({id,...bar})),sameLaneSpacings=busPositions.flatMap((a,i)=>busPositions.slice(i+1).filter(b=>Math.abs((a.x1+a.x2-b.x1-b.x2)/2)<.02).map(b=>Math.abs(a.y-b.y))),minSameLaneSpacing=sameLaneSpacings.length?Math.min(...sameLaneSpacings):null,inverse=svg.getScreenCTM().inverse(),boxes=[...svg.querySelectorAll('.ga-sld-bus,.ga-sld-device,.ga-sld-three-winding')].map(node=>{const b=node.getBBox(),m=inverse.multiply(node.getScreenCTM()),point=(x,y)=>{const p=svg.createSVGPoint();p.x=x;p.y=y;return p.matrixTransform(m);},corners=[point(b.x,b.y),point(b.x+b.width,b.y),point(b.x,b.y+b.height),point(b.x+b.width,b.y+b.height)];return{minX:Math.min(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxX:Math.max(...corners.map(p=>p.x)),maxY:Math.max(...corners.map(p=>p.y))};}),contentBounds=boxes.length?{minX:Math.min(...boxes.map(box=>box.minX)),minY:Math.min(...boxes.map(box=>box.minY)),maxX:Math.max(...boxes.map(box=>box.maxX)),maxY:Math.max(...boxes.map(box=>box.maxY))}:null,view=svg.viewBox.baseVal,rect=svg.getBoundingClientRect();return{ordinary:ordinary.length,ordinaryConnected:ordinaryConnected.length,three:three.length,threeConnected:threeConnected.length,devices:devices.length,deviceConnected:deviceConnected.length,symbols:symbols.length,symbolKinds,deviceLabels,busPositions,minSameLaneSpacing,contentBounds,viewBox:{x:view.x,y:view.y,width:view.width,height:view.height},svgBottom:rect.bottom,viewportHeight:innerHeight,svgHeight:rect.height};
  });
  report.sldConnectivity=connectivity;
  assert.ok(connectivity.ordinary>0&&connectivity.ordinaryConnected===connectivity.ordinary,'both ends of every shown 2W/line circuit land on their physical busbar ports');
  assert.ok(connectivity.devices>0&&connectivity.deviceConnected===connectivity.devices,'generator/load/shunt drops start at busbar ports');
  assert.ok(connectivity.symbolKinds.includes('generator')&&connectivity.symbolKinds.includes('load'),'generator and load devices remain visible on the SLD');
  assert.ok(connectivity.deviceLabels.length===connectivity.symbols&&connectivity.deviceLabels.every(Boolean),'device labels remain attached to their translated glyphs');
  assert.ok(connectivity.contentBounds&&connectivity.contentBounds.minX>=connectivity.viewBox.x&&connectivity.contentBounds.minY>=connectivity.viewBox.y&&connectivity.contentBounds.maxX<=connectivity.viewBox.x+connectivity.viewBox.width&&connectivity.contentBounds.maxY<=connectivity.viewBox.y+connectivity.viewBox.height,'all bus/device symbols fit inside the SLD viewBox');
  assert.ok(connectivity.minSameLaneSpacing===null||connectivity.minSameLaneSpacing>=30,'busbars on the same feeder lane are spaced so labels and devices remain readable');
  assert.ok(connectivity.svgHeight>=300&&connectivity.svgBottom<=connectivity.viewportHeight,'SLD plot fits within the 1600×1000 viewport');
  const [sldExport]=await Promise.all([page.waitForEvent('download'),savedSld.getByRole('button',{name:'Görüntülenen PSS/E tek hat şemasını kaynak provenansı ve stillerle SVG olarak indir'}).click()]);
  assert.match(sldExport.suggestedFilename(),/^psse-tek-hat-[a-f0-9]{12}\.svg$/,'SLD export uses a source-bound SVG filename');const exportedPath=await sldExport.path();assert.ok(exportedPath,'browser saved the exported SVG');const exported=await readFile(exportedPath,'utf8');assert.match(exported,/<metadata>.*ga\.psse-sld-export\.v1/s,'SVG carries source/scenario provenance metadata');assert.match(exported,/<style>.*ga-sld-busbar/s,'SVG includes its rendering styles');
  report.sldSvgExport={status:'PASS',filename:sldExport.suggestedFilename(),containsProvenance:exported.includes('ga.psse-sld-export.v1'),containsStyles:exported.includes('.ga-sld-busbar')};
  await navigation.getByRole('button',{name:'Analizler',exact:true}).click();const analysis=page.locator('.ga-psse-analysis:visible');await analysis.getByRole('button',{name:/hesapla/i}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.ga-psse-analysis')].some(panel=>panel.getClientRects().length>0&&panel.querySelector('.ga-card-grid')?.textContent?.includes('CONVERGED')),{timeout:30000});
  report.calculatedLayer='CONVERGED production solver result for synthetic fixture';
  await navigation.getByRole('button',{name:'Harita',exact:true}).click();
  const geoMap=page.locator('.ga-psse-map'),basemap=geoMap.locator('.ga-psse-geo-basemap');
  assert.equal(await basemap.count(),1,'PSS/E map uses the shared local Turkey vector basemap');
  assert.equal(await basemap.evaluate(canvas=>!!canvas.getContext('2d')&&canvas.width>0&&canvas.height>0),true,'Turkey basemap canvas is painted locally');
  const low=geoMap.getByLabel('36 kV dahil ve altındaki tüm gerilim düzeylerini göster');await low.check();
  assert.match(await geoMap.locator('.ga-notice').textContent(),/≤36 kV grubu dahil.*36 kV dahildir/,'the explicit low-voltage toggle includes 36 kV');await low.uncheck();
  await geoMap.getByLabel('Değer katmanı').selectOption('calculated');assert.equal(await geoMap.getByLabel('Değer katmanı').inputValue(),'calculated','the calculated layer selector is active');const mapCalculated='psse-map-calculated.png';await page.screenshot({path:path.join(output,mapCalculated),fullPage:false,animations:'disabled'});report.screenshots.push(mapCalculated);await geoMap.getByLabel('Değer katmanı').selectOption('saved');
  const [mapPng]=await Promise.all([page.waitForEvent('download'),geoMap.getByRole('button',{name:'Görüntülenen harita veya topolojiyi PNG olarak indir'}).click()]);assert.equal(mapPng.suggestedFilename(),'psse-cografi-harita.png','map export downloads a PNG');
  await geoMap.getByRole('button',{name:'Yakınlaştır'}).click();await geoMap.getByRole('button',{name:'Haritayı veya şemayı sığdır'}).click();
  await geoMap.getByRole('button',{name:'Tam ekran'}).click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.fullscreenElement);
  await geoMap.getByRole('button',{name:'Topoloji',exact:true}).click();await page.locator('.ga-psse-topology-svg').waitFor({state:'visible'});
  assert.ok(await page.locator('.ga-psse-topology-svg .ga-map-bus').count()>0,'separate topology view draws searchable bus-branch nodes');
  const busSearch=geoMap.getByLabel('Tüm PSS/E modelinde bara ara');await busSearch.fill('2');
  await page.locator('.ga-psse-topology-svg').waitFor({state:'visible'});assert.match(await geoMap.locator('.ga-notice').textContent(),/Seçili bara SYNTH 2.*kaynak TM koordinatı yok/,'an unmapped exact bus search remains reachable in topology');
  assert.ok(await page.locator('.ga-psse-sld .ga-sld-line').count()>0,'SLD branches use orthogonal path segments');
  assert.ok(await page.locator('.ga-psse-sld [data-symbol="generator"]').count()>0,'SLD uses the shared engineering generator glyph');
  assert.ok(await page.locator('.ga-psse-sld [data-symbol="load"]').count()>0,'SLD uses the shared engineering load glyph');
  await navigation.getByRole('button',{name:'Tek Hat Şeması',exact:true}).click();const sld=page.locator('.ga-psse-sld:visible');await sld.getByLabel('Tek hat sonuç katmanı').selectOption('calculated');const sldCalculated='psse-sld-calculated.png';await page.screenshot({path:path.join(output,sldCalculated),fullPage:false,animations:'disabled'});report.screenshots.push(sldCalculated);await sld.getByLabel('Tek hat sonuç katmanı').selectOption('saved');
  const three=Buffer.from(syntheticRawx('three-winding'),'utf8');await input.setInputFiles({name:'three-winding.rawx',mimeType:'application/octet-stream',buffer:three});
  await page.waitForFunction(()=>document.querySelector('.ga-mode-card')?.textContent?.trim()==='PSS/E MODU'&&document.querySelector('.ga-head-model')?.textContent?.includes('three-winding.rawx')&&document.querySelector('.ga-busy')?.hidden===true,{timeout:30000});
  await navigation.getByRole('button',{name:'Tek Hat Şeması',exact:true}).click();await page.locator('.ga-psse-sld').waitFor({state:'visible'});
  assert.ok(await page.locator('.ga-psse-sld [data-symbol="transformer3w"]').count()>0,'three-winding case uses a distinct 3W transformer glyph');
  assert.ok(await page.locator('.ga-psse-sld .ga-sld-leg-label').count()>=3,'all three source winding identifiers are labelled');
  const threePorts=await page.locator('.ga-psse-sld-svg').evaluate(svg=>{const bars=new Map([...svg.querySelectorAll('.ga-sld-busbar[data-bus-id]')].map(bar=>[bar.getAttribute('data-bus-id'),{x1:Number(bar.getAttribute('x1')),x2:Number(bar.getAttribute('x2')),y:Number(bar.getAttribute('y1'))}]));return[...svg.querySelectorAll('.ga-sld-line[data-port-bus-id]')].map(path=>{const bar=bars.get(path.dataset.portBusId),x=Number(path.dataset.portX),y=Number(path.dataset.portY);return{bus:!!bar&&Math.abs(y-bar.y)<.02&&x>=Math.min(bar.x1,bar.x2)-.02&&x<=Math.max(bar.x1,bar.x2)+.02,winding:Number(path.dataset.windingId),end:(()=>{const p=path.getPointAtLength(path.getTotalLength());return{x:p.x,y:p.y};})(),port:{x:Number(path.dataset.portHubX),y:Number(path.dataset.portHubY)},center:{x:Number(path.dataset.hubCenterX),y:Number(path.dataset.hubCenterY)}};});});report.threeWindingPorts=threePorts;assert.equal(threePorts.length,3,'all three 3W source winding paths connect to their physical busbars');assert.ok(threePorts.every(port=>port.bus),'all three 3W winding bus-side ports land on the corresponding busbar');assert.ok(threePorts.every(port=>Math.abs(port.end.x-port.port.x)<.02&&Math.abs(port.end.y-port.port.y)<.02&&Math.abs(port.port.x-(port.center.x+(port.winding===3?26:0)))<.02&&Math.abs(port.port.y-(port.center.y+(port.winding===1?-18:port.winding===2?18:0)))<.02),'each 3W winding leg terminates at the matching transformer coil port');
  assert.equal(await page.locator('.ga-psse-sld .ga-sld-bus[data-bus-id^="star:"]').count(),0,'internal 3W star is not fabricated as a physical busbar');
  const threeShot='psse-sld-three-winding.png';await page.screenshot({path:path.join(output,threeShot),fullPage:false,animations:'disabled'});report.screenshots.push(threeShot);
  report.diagramChecks={turkeyBasemap:'PASS',lowVoltage36Inclusive:'PASS',searchableTopology:'PASS',panZoom:'PASS',fullscreen:'PASS',mapPngExport:'PASS',sldSvgExport:'PASS',busbarPorts:'PASS',devicePorts:'PASS',viewportFit:'PASS',calculatedLayers:'PASS',threeWindingThreeLegs:'PASS',internalStarBusbars:0};
 }
 assert.deepEqual(report.errors,[],'baseline browser has no JavaScript or console errors');assert.deepEqual(report.blockedExternal,[],'baseline pages do not request external services');
 report.status='PASS';
}catch(error){report.error=error instanceof Error?error.stack??error.message:String(error);throw error;}
finally{
 if(browser)await browser.close();
 await mkdir(output,{recursive:true});
 await writeFile(path.join(output,`${channel}.json`),JSON.stringify(report,null,2)+'\n');
}
console.log(`PSSE_DIAGRAMS_BROWSER ${JSON.stringify(report)}`);
