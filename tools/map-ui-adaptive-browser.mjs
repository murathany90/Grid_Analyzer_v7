// Map UI modernization acceptance: MapDisplayFilters separation (display-only),
// overflow under viewports/dpr, YTM tri-state menu, adaptive labels, keyboard
// access and LF-view no-analysis-switch. Public synthetic fixture only.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {zipSync,strToU8} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=path.join(root,'tests','fixtures','small-dgs.json');
const port=5186,url=`http://127.0.0.1:${port}/`;
const outDir=path.join(root,'local-benchmark-results','map-ui-adaptive-20261027','acceptance');
await mkdir(outDir,{recursive:true});

const visualRaw=JSON.parse(await readFile(fixture,'utf8'));
const routeIndex=visualRaw.ElmLne.Attributes.indexOf('GPScoords:MATRIX');
visualRaw.Matrix.Values=[];
visualRaw.ElmLne.Values.forEach((line,i)=>{const is400=line[0].startsWith('L400'),lat=is400?39.9:39.8,lon=is400?32.8:32.7,id='Synthetic_route_'+i;line[routeIndex]=id;[[lat,lon],[lat+(i%6-2.5)*.35,lon+(is400?2.4:-2.4)],[lat,lon]].forEach((point,row)=>point.forEach((value,column)=>visualRaw.Matrix.Values.push([id,row,column,value])));});
// Metadata-only second YTM (fold_id parent change): exercises multi-area
// display scope without touching any electrical attribute.
if(visualRaw.ElmSite?.Values?.length){
  const fold=visualRaw.ElmSite.Attributes.indexOf('fold_id');
  if(fold>=0)visualRaw.ElmSite.Values[visualRaw.ElmSite.Values.length-1][fold]='SYNTHETIC_AREA_B';
}

const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true}});await server.listen();
let browser;const results=[];const check=(name,ok,detail='')=>{results.push({name,ok,detail});if(!ok)throw new Error(`${name} failed ${detail}`);console.log(`✔ ${name}${detail?' · '+detail:''}`);};
try{
  browser=await chromium.launch({headless:true});
  for(const [name,width,height,dpr] of [['1366',1366,768,1],['1920',1920,1080,1],['narrow1024',1024,640,1],['dpr125',1536,864,1.25]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});
    const page=await context.newPage();page.setDefaultTimeout(20000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);
    await page.locator('#modelFileInput').setInputFiles({name:'synthetic-map-visual-dgs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(visualRaw))});
    await page.waitForFunction(()=>Boolean(document.querySelector('.ga-head-model')?.textContent?.trim()));
    await page.getByRole('button',{name:'Harita',exact:true}).click();
    await page.locator('.ga-map-wrap').waitFor();
    await page.waitForTimeout(300);
    const overflow=await page.evaluate(()=>({
      rows:[...document.querySelectorAll('.ga-map-toolbar-row')].map(row=>({cls:row.className,over:row.scrollWidth>row.clientWidth+1})),
      doc:document.documentElement.scrollWidth>window.innerWidth+1,
      barRows:document.querySelectorAll('.ga-map-toolbar-row').length,
      scopeControls:document.querySelectorAll('.ga-map-scope-row>.ga-map-menu,.ga-map-scope-row>.ga-map-control,.ga-map-scope-row>.ga-map-scenario-chip').length,
      lineMenuGone:document.querySelector('.ga-map-line-menu')===null,
    }));
    check(`${name}: toolbar rows wrap without horizontal overflow`,!overflow.rows.some(r=>r.over)&&!overflow.doc,JSON.stringify(overflow.rows.filter(r=>r.over)));
    check(`${name}: scope row holds 7 controls and Hatlar menu is removed`,overflow.barRows===2&&overflow.scopeControls===7&&overflow.lineMenuGone,`scope=${overflow.scopeControls}`);
    if(name==='1366'){
      // --- YTM tri-state menu ---
      const ytmSummary=page.locator('.ga-area-menu>summary');
      check('YTM menu counter starts at Tümü',(await ytmSummary.textContent()).includes('Tümü'));
      await ytmSummary.click();
      const search=page.locator('.ga-area-menu input[type=search]');
      check('YTM menu has a search input',await search.isVisible());
      const boxes=page.locator('.ga-area-menu .ga-area-list input[type=checkbox]');
      const total=await boxes.count();
      // ALL renders every box pre-checked: unchecking one is the SELECTED transition.
      await boxes.nth(0).uncheck();
      check(`YTM counter shows 1/${total} after unchecking one of ${total}`,(await ytmSummary.textContent()).includes(`1/${total}`),(await ytmSummary.textContent()).trim());
      check('map area scope dataset is SELECTED',await page.locator('.ga-map-view').getAttribute('data-area-scope')==='SELECTED');
      const analysisScope=await page.evaluate(()=>document.querySelector('.ga-map-view').dataset.areaScope);
      check('analysis scope untouched: filters.areaId not written by map menu',analysisScope==='SELECTED');
      await page.locator('.ga-area-menu').getByRole('button',{name:'Temizle'}).click();
      check('Temizle yields Yok (not Tümü)',(await ytmSummary.textContent()).includes('Yok'));
      check('NONE scope reports zero visible lines and sites',await page.locator('#networkCanvas').getAttribute('data-visible-lines')==='0'&&await page.locator('#networkCanvas').getAttribute('data-visible-sites')==='0');
      check('NONE scope hides all network geometry',Number(await page.locator('#networkCanvas').getAttribute('data-label-count'))===0);
      await page.locator('.ga-area-menu').getByRole('button',{name:'Tümünü seç'}).click();
      check('Tümünü seç restores Tümü',(await ytmSummary.textContent()).includes('Tümü'));
      check('restored scope shows lines and sites again',Number(await page.locator('#networkCanvas').getAttribute('data-visible-lines'))>0&&Number(await page.locator('#networkCanvas').getAttribute('data-visible-sites'))>0);
      await page.keyboard.press('Escape');
      // --- calculation then display-filter churn: solver count and result id frozen ---
      await page.getByRole('button',{name:/LF hesapla/}).click();
      await page.waitForFunction(()=>!/İşleniyor/.test(document.querySelector('.ga-map-status [role=status]')?.textContent||''),null,{timeout:30000});
      const runCount=Number(await page.locator('.ga-map-view').getAttribute('data-run-count'));
      const resultId=await page.locator('.ga-map-view').getAttribute('data-result-id');
      check('LF calculated exactly once',runCount===1&&resultId!=='NOT_RUN',`runs=${runCount} id=${resultId?.slice(0,12)}`);
      const analysisSiteBefore=await page.locator('.ga-map-view').getAttribute('data-analysis-site-id');
      check('analytical siteId starts empty on the map',analysisSiteBefore==='',`siteId=${analysisSiteBefore}`);
      await page.getByRole('checkbox',{name:'Etiketler'}).check();
      await ytmSummary.click();await boxes.nth(0).uncheck();await page.keyboard.press('Escape');
      await page.locator('.ga-map-view .ga-voltage-menu>summary').click();
      await page.locator('.ga-map-view .ga-voltage-menu').getByRole('button',{name:'Temizle'}).click();
      await page.locator('.ga-map-view .ga-voltage-menu').getByRole('button',{name:'Tümünü seç'}).click();
      await page.keyboard.press('Escape');
      await page.locator('select[aria-label="Hat yerleşimi"]').selectOption('separated');
      await page.locator('select[aria-label="Hat yerleşimi"]').selectOption('standard');
      await page.locator('select[aria-label="Sonuç göster"]').selectOption('delta');
      await page.locator('select[aria-label="Sonuç göster"]').selectOption('base');
      await page.getByRole('checkbox',{name:'Etiketler'}).uncheck();
      await ytmSummary.click();await page.locator('.ga-area-menu').getByRole('button',{name:'Tümünü seç'}).click();await page.keyboard.press('Escape');
      const runAfter=Number(await page.locator('.ga-map-view').getAttribute('data-run-count'));
      const resultAfter=await page.locator('.ga-map-view').getAttribute('data-result-id');
      check('repeated map display-filter churn triggers zero extra solver runs',runAfter===runCount,`runs=${runAfter}`);
      check('result identity hash unchanged after filter churn',resultAfter===resultId);
      check('analytical filters.siteId untouched by map display churn',await page.locator('.ga-map-view').getAttribute('data-analysis-site-id')===analysisSiteBefore);
      check('map TM scope stays empty without explicit TM selection',await page.locator('.ga-map-view').getAttribute('data-map-site-id')==='');
      check('computed LF result still displayed after filters removed',/NR yakınsadı/.test(await page.locator('.ga-map-status [role=status]').textContent()));
      // --- LF görünümü must not switch analysis while N-1 selected ---
      await page.locator('select[aria-label="Benchmark harita analizi"]').selectOption('N1');
      await page.locator('select[aria-label="Sonuç göster"]').selectOption('delta');
      const statusBar=await page.locator('.ga-map-status').getAttribute('data-analysis');
      check('LF görünümü change does not switch N-1 analysis',statusBar==='N1',`status=${statusBar}`);
      check('no solver run from display-only LF görünümü switch',Number(await page.locator('.ga-map-view').getAttribute('data-run-count'))===runCount);
      // --- adaptive labels ---
      await page.locator('select[aria-label="Benchmark harita analizi"]').selectOption('');
      await page.getByRole('checkbox',{name:'Etiketler'}).check();
      await page.waitForTimeout(250);
      const nationalLabels=Number(await page.locator('#networkCanvas').getAttribute('data-label-count'));
      check('labels on: national zoom draws a bounded subset',nationalLabels>=0&&nationalLabels<=260,`count=${nationalLabels}`);
      // Deterministic zoom: identical wheel sequences from fit, evaluated only
      // after repainting settled, must produce the identical label layout.
      const paintStable=async()=>{let prev=await page.locator('#networkCanvas').evaluate(el=>el.dataset.paintCount??'0');for(let i=0;i<25;i++){await page.waitForTimeout(150);const next=await page.locator('#networkCanvas').evaluate(el=>el.dataset.paintCount??'0');if(next===prev)return;prev=next;}};
      const zoomByWheel=async steps=>{await page.getByRole('button',{name:'Sığdır'}).click();await page.waitForTimeout(200);const box=await page.locator('#networkCanvas').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);for(let i=0;i<steps;i++)await page.mouse.wheel(0,-240);await paintStable();return Number(await page.locator('#networkCanvas').getAttribute('data-label-count'));};
      const zoomA=await zoomByWheel(9);
      check('labels on: zoomed view renders labels within budget',zoomA>=1&&zoomA<=260,`${nationalLabels}→${zoomA}`);
      const zoomB=await zoomByWheel(9);
      check('labels on: identical zoom sequences repaint identically after paint settles',zoomA===zoomB,`${zoomA} vs ${zoomB}`);
      await page.screenshot({path:path.join(outDir,'labels-zoom-acceptance.png')});
      await page.getByRole('button',{name:'Sığdır'}).click();
      await page.getByRole('checkbox',{name:'Etiketler'}).uncheck();
      check('labels off: dataset resets to 0',Number(await page.locator('#networkCanvas').getAttribute('data-label-count'))===0);
      // --- keyboard access ---
      await page.locator('.ga-area-menu>summary').focus();
      await page.keyboard.press('Enter');
      check('YTM menu opens via keyboard',await page.locator('.ga-area-menu input[type=search]').isVisible());
      await page.keyboard.press('Escape');
      check('Escape closes map menus',!await page.locator('.ga-area-menu input[type=search]').isVisible().catch(()=>false));
      // --- Lightning panel + legend coexistence (strict rectangle disjointness) ---
      await page.getByRole('button',{name:'Elektriksel Sonuçlar',exact:true}).click();
      await page.locator('.ga-lightning').waitFor();
      await page.waitForTimeout(300);
      const rects=await page.evaluate(()=>{
        const r=sel=>{const b=document.querySelector(sel).getBoundingClientRect();return{left:b.left,top:b.top,right:b.right,bottom:b.bottom};};
        return{panel:r('.ga-lightning'),legend:r('.ga-map-legend'),toggle:r('.ga-lightning-toggle'),visible:!!document.querySelector('.ga-lightning-body')&&!document.querySelector('.ga-lightning-body').hidden};
      });
      const intersects=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
      check('Lightning open keeps legend and toggle rendered',rects.panel.right>rects.panel.left&&rects.legend.right>rects.legend.left&&rects.toggle.right>rects.toggle.left);
      check('Lightning panel never covers the legend',!intersects(rects.panel,rects.legend),JSON.stringify({panel:rects.panel,legend:rects.legend}));
      check('Lightning panel never covers the toggle button',!intersects(rects.panel,rects.toggle));
      await page.screenshot({path:path.join(outDir,'lightning-coexist-1366.png')});
      await page.getByRole('button',{name:'Elektriksel Sonuçlar',exact:true}).click();
      // --- P2: explanatory empty-map message for the YTM NONE state ---
      await page.locator('.ga-map-view .ga-area-menu>summary').evaluate(el=>{el.parentElement.open=true;});
      await page.locator('.ga-map-view .ga-area-menu').getByRole('button',{name:'Temizle'}).click();
      await page.keyboard.press('Escape');
      await page.locator('.ga-map-empty').waitFor({state:'visible'});
      const emptyText=await page.locator('.ga-map-empty').textContent();
      check('NONE state shows an explanatory empty-map message',/YTM seçili değil/.test(emptyText||''),(emptyText||'').slice(0,60));
      await page.locator('.ga-map-view .ga-area-menu>summary').evaluate(el=>{el.parentElement.open=true;});
      await page.locator('.ga-map-view .ga-area-menu').getByRole('button',{name:'Tümünü seç'}).click();
      await page.keyboard.press('Escape');
      check('empty overlay hides again after Tümünü seç',!await page.locator('.ga-map-empty').isVisible());
      // --- P0: the shared voltage filter must follow model replacement (stale Set regression) ---
      await page.locator('#modelFileInput').setInputFiles({name:'synthetic-map-visual-dgs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(visualRaw))});
      await page.waitForFunction(()=>Boolean(document.querySelector('.ga-head-model')?.textContent?.trim()));
      await page.getByRole('button',{name:'Tek Hat Şeması',exact:true}).click();
      await page.locator('.ga-sld-svg').waitFor();
      const sldSites=page.locator('select[aria-label="Trafo merkezi"]');
      const siteOptionsBefore=await sldSites.locator('option').count();
      check('SLD lists sites after a second model load',siteOptionsBefore>=1,`options=${siteOptionsBefore}`);
      const sldVoltages=page.locator('.ga-voltage-layers[aria-label="SLD gerilim grupları"]');
      await sldVoltages.locator('input[data-help-id="map.voltage.400"]').uncheck();
      await sldVoltages.locator('input[data-help-id="map.voltage.154"]').uncheck();
      await page.waitForTimeout(400);
      const siteOptionsNarrowed=await sldSites.locator('option').count();
      check('shared voltage filter writes to the CURRENT filters set after model replacement',siteOptionsNarrowed<siteOptionsBefore,`${siteOptionsBefore}→${siteOptionsNarrowed}`);
      await sldVoltages.locator('input[data-help-id="map.voltage.400"]').check();
      await sldVoltages.locator('input[data-help-id="map.voltage.154"]').check();
      await page.waitForTimeout(300);
      check('re-checking bands restores the SLD site list',await sldSites.locator('option').count()===siteOptionsBefore);
      await page.getByRole('button',{name:'Şebeke Modeli',exact:true}).click();
      await page.locator('.ga-model-view').waitFor();
      // --- model file input hygiene: CRC failure keeps the input re-usable ---
      const modelAName=await page.locator('.ga-head-model').textContent();
      const zipA=zipSync({'model-a.json':strToU8(JSON.stringify(visualRaw))},{level:0});
      const corrupt=Buffer.from(zipA);corrupt[corrupt.length>>1]^=0xff;
      await page.locator('#modelFileInput').setInputFiles({name:'corrupt.zip',mimeType:'application/zip',buffer:corrupt});
      await page.waitForFunction(()=>/Model yüklenemedi/.test(document.querySelector('footer [role=status]')?.textContent||''));
      check('ZIP CRC failure surfaces the exact Turkish CRC reason',/CRC doğrulaması başarısız/.test(await page.locator('footer [role=status]').textContent()),(await page.locator('footer [role=status]').textContent()).slice(0,60));
      check('CRC failure keeps the previous model and its display scope',modelAName===await page.locator('.ga-head-model').textContent()&&await page.locator('.ga-map-view').getAttribute('data-area-scope')==='ALL');
      check('failed load clears the file input for re-picking',await page.locator('#modelFileInput').evaluate(el=>el.value===''));
      // --- multi-JSON ZIP: selection dialog, cancel path, then explicit pick ---
      const modelB=JSON.parse(JSON.stringify(visualRaw));
      modelB.ElmSite.Values[0][modelB.ElmSite.Attributes.indexOf('loc_name')]='B Model Station';
      const zipMulti=zipSync({'a-model.json':strToU8(JSON.stringify(visualRaw)),'b-model.json':strToU8(JSON.stringify(modelB))},{level:0});
      const zipDialog=page.locator('dialog[aria-label="ZIP içinden model seç"]');
      await page.locator('#modelFileInput').setInputFiles({name:'multi.zip',mimeType:'application/zip',buffer:Buffer.from(zipMulti)});
      await zipDialog.waitFor();
      await zipDialog.getByRole('button',{name:'Vazgeç'}).click();
      await page.waitForTimeout(250);
      check('ZIP dialog cancel clears the file input',await page.locator('#modelFileInput').evaluate(el=>el.value===''));
      await page.locator('#modelFileInput').setInputFiles({name:'multi.zip',mimeType:'application/zip',buffer:Buffer.from(zipMulti)});
      await zipDialog.waitFor();
      await zipDialog.locator('select[aria-label="ZIP JSON dosyası"]').selectOption({index:1});
      await zipDialog.getByRole('button',{name:'Seçilen JSON’u yükle'}).click();
      const previousHeader=modelAName??'';
      await page.waitForFunction(prev=>document.querySelector('.ga-head-model')?.textContent?.trim()&&document.querySelector('.ga-head-model').textContent!==prev,previousHeader,{timeout:30000});
      const modelBName=await page.locator('.ga-head-model').textContent();
      check('second ZIP entry loads as model B',modelBName!==modelAName,`${modelAName?.slice(0,24)} → ${modelBName?.slice(0,24)}`);
      await page.getByRole('button',{name:'Harita',exact:true}).click();
      await page.locator('.ga-map-wrap').waitFor();
      check('model B starts with a clean display scope',await page.locator('.ga-map-view').getAttribute('data-area-scope')==='ALL'&&await page.locator('.ga-map-view').getAttribute('data-analysis-site-id')===''&&await page.locator('.ga-map-view').getAttribute('data-map-site-id')==='');
      check('model B does not inherit A result identity',await page.locator('.ga-map-view').getAttribute('data-result-id')==='NOT_RUN');
      // --- degenerate model (no explicit ElmSite rows): importer derives sites
      // from the parent hierarchy; the map must render and the YTM menu work ---
      const modelZero=JSON.parse(JSON.stringify(visualRaw));modelZero.ElmSite.Values=[];
      await page.locator('#modelFileInput').setInputFiles({name:'zero-sites.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(modelZero))});
      await page.waitForFunction(()=>Boolean(document.querySelector('.ga-head-model')?.textContent?.trim()));
      await page.waitForTimeout(400);
      const zeroSites=Number(await page.locator('#networkCanvas').getAttribute('data-visible-sites'));
      check('degenerate no-ElmSite model loads and the map renders',await page.locator('#networkCanvas').getAttribute('data-visible-lines')!==null);
      await page.locator('.ga-map-view .ga-area-menu>summary').evaluate(el=>{el.parentElement.open=true;});
      check('degenerate model keeps the YTM menu functional',await page.locator('.ga-map-view .ga-area-menu').isVisible());
      await page.keyboard.press('Escape');
      // --- A→B→A: returning to A restores only A's own workspace results ---
      await page.locator('#modelFileInput').setInputFiles({name:'synthetic-map-visual-dgs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(visualRaw))});
      await page.waitForFunction(prev=>document.querySelector('.ga-head-model')?.textContent?.trim()&&document.querySelector('.ga-head-model').textContent!==prev,modelBName,{timeout:30000});
      await page.waitForTimeout(600);
      check('A→B→A: model A identity restored',modelAName===await page.locator('.ga-head-model').textContent());
      check('A→B→A: A workspace result identity restored, B identity not carried',await page.locator('.ga-map-view').getAttribute('data-result-id')===resultId,`id=${(await page.locator('.ga-map-view').getAttribute('data-result-id'))?.slice(0,14)}`);
      check('A→B→A: display scope reset clean',await page.locator('.ga-map-view').getAttribute('data-area-scope')==='ALL'&&await page.locator('.ga-map-view').getAttribute('data-analysis-site-id')===''&&await page.locator('.ga-map-view').getAttribute('data-map-site-id')==='');
      // --- N-1 display context: map display churn never runs solvers ---
      await page.locator('select[aria-label="Benchmark harita analizi"]').selectOption('N1');
      const n1Runs=Number(await page.locator('.ga-map-view').getAttribute('data-run-count'));
      await page.locator('.ga-map-view .ga-area-menu>summary').evaluate(el=>{el.parentElement.open=true;});
      await page.locator('.ga-map-view .ga-area-menu').getByRole('button',{name:'Temizle'}).click();
      await page.locator('.ga-map-view .ga-area-menu').getByRole('button',{name:'Tümünü seç'}).click();
      await page.keyboard.press('Escape');
      check('N-1 display context: YTM churn triggers zero solver runs',Number(await page.locator('.ga-map-view').getAttribute('data-run-count'))===n1Runs);
      // --- SC panel TM focus must not conflict with the map YTM scope ---
      await page.locator('.ga-map-view .ga-area-menu>summary').evaluate(el=>{el.parentElement.open=true;});
      const areaBoxes=page.locator('.ga-map-view .ga-area-menu .ga-area-list input');
      if(await areaBoxes.count()>1)await areaBoxes.nth(1).uncheck();
      await page.keyboard.press('Escape');
      const scopedSites=await page.locator('#networkCanvas').getAttribute('data-visible-sites');
      await page.getByRole('button',{name:'Elektriksel Sonuçlar',exact:true}).click();
      await page.locator('.ga-lightning').getByRole('button',{name:'Kısa Devre',exact:true}).click();
      await page.locator('.ga-lightning-sc-panel').waitFor();
      const scTm=page.locator('select[aria-label="Seçili TM"]');
      const pickTm=async value=>{const r=await page.evaluate(v=>{const s=document.querySelector('select[aria-label="Seçili TM"]');s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}));return{selValue:s.value,mapSite:document.querySelector('.ga-map-view')?.getAttribute('data-map-site-id'),visible:document.querySelector('#networkCanvas')?.getAttribute('data-visible-sites')};},value);await page.waitForTimeout(250);return{...r,visible:await page.locator('#networkCanvas').getAttribute('data-visible-sites'),mapSite:await page.locator('.ga-map-view').getAttribute('data-map-site-id')};};
      const focusId=await page.evaluate(()=>{const s=document.querySelector('select[aria-label="Seçili TM"]');return s.options[1]?.value??'';});
      await pickTm({index:1});
      await page.waitForTimeout(300);
      const focusPick=await pickTm(focusId);
      check('SC panel TM focus overrides the YTM display scope (no contradiction)',focusPick.visible==='1'&&focusPick.mapSite===focusId,`site=${focusId} mapSite=${focusPick.mapSite} visible=${focusPick.visible}`);
      await pickTm('');
      await page.waitForTimeout(200);
      check('clearing the SC TM focus restores the YTM-scoped view',await page.locator('#networkCanvas').getAttribute('data-visible-sites')===scopedSites);
      // Explicit focus semantics: an explicit YTM NONE keeps the empty map — the
      // focused TM is NOT drawn over the empty overlay, and the overlay says so.
      // NOTE: the Lightning panel closes on Escape, so menus are toggled via
      // the open property instead of keyboard in this section.
      const toggleMenu=(sel,open)=>page.locator(sel).evaluate((el,v)=>{el.parentElement.open=v;},open);
      await toggleMenu('.ga-map-view .ga-area-menu>summary',true);
      await page.locator('.ga-map-view .ga-area-menu').getByRole('button',{name:'Temizle'}).click();
      await toggleMenu('.ga-map-view .ga-area-menu>summary',false);
      await pickTm({index:1});
      await page.waitForTimeout(300);
      const nonePick=await pickTm(focusId);
      check('YTM NONE keeps the empty map: focused TM is not drawn',nonePick.visible==='0'&&nonePick.mapSite===focusId,`mapSite=${nonePick.mapSite} visible=${nonePick.visible}`);
      const noneEmptyText=await page.locator('.ga-map-empty').textContent();
      check('empty overlay states the focused TM is hidden by the empty scope',await page.locator('.ga-map-empty').isVisible()&&/Odaklanan TM kapsam boş/.test(noneEmptyText||''),(noneEmptyText||'').slice(-46));
      await toggleMenu('.ga-map-view .ga-area-menu>summary',true);
      await page.locator('.ga-map-view .ga-area-menu').getByRole('button',{name:'Tümünü seç'}).click();
      await toggleMenu('.ga-map-view .ga-area-menu>summary',false);
      await pickTm('');
      // Voltage display filter still applies to the focused TM: clearing the
      // voltage bands hides even the focused TM with the explicit message.
      await toggleMenu('.ga-map-view .ga-voltage-menu>summary',true);
      await page.locator('.ga-map-view .ga-voltage-menu').getByRole('button',{name:'Temizle'}).click();
      await toggleMenu('.ga-map-view .ga-voltage-menu>summary',false);
      await pickTm({index:1});
      await page.waitForTimeout(300);
      const voltPick=await pickTm(focusId);
      check('voltage display filter still applies to the focused TM',voltPick.visible==='0'&&/gerilim grubu/.test(await page.locator('.ga-map-empty').textContent()||''),`mapSite=${voltPick.mapSite} visible=${voltPick.visible}`);
      await pickTm('');
      await toggleMenu('.ga-map-view .ga-voltage-menu>summary',true);
      await page.locator('.ga-map-view .ga-voltage-menu').getByRole('button',{name:'Tümünü seç'}).click();
      await toggleMenu('.ga-map-view .ga-voltage-menu>summary',false);
      await page.locator('.ga-lightning').getByRole('button',{name:'Kapat',exact:true}).click().catch(()=>{});
      await page.getByRole('button',{name:'Elektriksel Sonuçlar',exact:true}).click();
      // --- capacity: map choice is display-only, engineering session untouched ---
      await page.locator('select[aria-label="Benchmark harita analizi"]').selectOption('');
      await page.locator('.ga-map-options>summary').click();
      await page.locator('select[aria-label="Harita kapasite sınırı"]').selectOption('summer');
      await page.keyboard.press('Escape');
      check('map keeps its own capacity display choice',await page.locator('.ga-map-view').getAttribute('data-capacity-season')==='summer');
      check('map capacity choice leaves the engineering session untouched',await page.locator('.ga-map-view').getAttribute('data-session-capacity-season')==='nominal',`session=${await page.locator('.ga-map-view').getAttribute('data-session-capacity-season')}`);
      await page.locator('.ga-map-options>summary').click();
      await page.locator('select[aria-label="Harita kapasite sınırı"]').selectOption('inherit');
      await page.keyboard.press('Escape');
      check('no page errors during acceptance',errors.length===0,errors.join(' | '));
    }
    await context.close();
  }
  await writeFile(path.join(outDir,'results.json'),JSON.stringify(results,null,2));
  console.log(`\nmap-ui-adaptive acceptance: ${results.length} checks passed`);
}finally{
  await browser?.close();
  await new Promise(resolve=>server.httpServer.close(()=>resolve()));
  setTimeout(()=>process.exit(0),500).unref();
}
