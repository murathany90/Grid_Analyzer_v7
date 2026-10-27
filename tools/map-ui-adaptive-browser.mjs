// Map UI modernization acceptance: MapDisplayFilters separation (display-only),
// overflow under viewports/dpr, YTM tri-state menu, adaptive labels, keyboard
// access and LF-view no-analysis-switch. Public synthetic fixture only.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=path.join(root,'tests','fixtures','small-dgs.json');
const port=5184,url=`http://127.0.0.1:${port}/`;
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
      check('NONE scope hides all network geometry',Number(await page.locator('#networkCanvas').getAttribute('data-label-count'))===0);
      await page.locator('.ga-area-menu').getByRole('button',{name:'Tümünü seç'}).click();
      check('Tümünü seç restores Tümü',(await ytmSummary.textContent()).includes('Tümü'));
      await page.keyboard.press('Escape');
      // --- calculation then display-filter churn: solver count and result id frozen ---
      await page.getByRole('button',{name:/LF hesapla/}).click();
      await page.waitForFunction(()=>!/İşleniyor/.test(document.querySelector('.ga-map-status [role=status]')?.textContent||''),null,{timeout:30000});
      const runCount=Number(await page.locator('.ga-map-view').getAttribute('data-run-count'));
      const resultId=await page.locator('.ga-map-view').getAttribute('data-result-id');
      check('LF calculated exactly once',runCount===1&&resultId!=='NOT_RUN',`runs=${runCount} id=${resultId?.slice(0,12)}`);
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
      const canvas=await page.locator('#networkCanvas').boundingBox();
      await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);
      for(let i=0;i<9;i++)await page.mouse.wheel(0,-240);
      await page.waitForTimeout(400);
      const zoomedLabels=Number(await page.locator('#networkCanvas').getAttribute('data-label-count'));
      check('labels on: zoomed view renders labels within budget',zoomedLabels>=1&&zoomedLabels<=260,`${nationalLabels}→${zoomedLabels}`);
      const zoomedAgain=Number(await page.locator('#networkCanvas').evaluate(()=>{const c=document.querySelector('#networkCanvas');c.dispatchEvent(new WheelEvent('wheel',{deltaY:-240,cancelable:true}));return c.dataset.labelCount??'0';}));
      check('labels on: deterministic re-layout at same viewport',zoomedAgain===zoomedLabels,`${zoomedLabels}→${zoomedAgain}`);
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
      // --- Lightning panel + legend coexistence ---
      await page.getByRole('button',{name:'Elektriksel Sonuçlar'}).click();
      await page.locator('.ga-lightning').waitFor();
      const layout=await page.evaluate(()=>{
        const panel=document.querySelector('.ga-lightning').getBoundingClientRect(),legend=document.querySelector('.ga-map-legend').getBoundingClientRect(),toggle=document.querySelector('.ga-lightning-toggle').getBoundingClientRect();
        return{panelVisible:panel.width>0,legendVisible:legend.width>0,toggleVisible:toggle.width>0,overlap:!(panel.left>legend.right||panel.right<legend.left&&true)&&panel.top<legend.bottom&&legend.left<panel.right};
      });
      check('Lightning open keeps legend and toggle rendered',layout.panelVisible&&layout.legendVisible&&layout.toggleVisible);
      await page.screenshot({path:path.join(outDir,'lightning-coexist-1366.png')});
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
