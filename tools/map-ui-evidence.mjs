// Map UI before/after evidence: viewport overflow, toolbar geometry, adaptive
// label density and filter-bar screenshots on the public synthetic fixture.
// Usage: node tools/map-ui-evidence.mjs --tag before|after [--out DIR]
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const tagFlag=args.indexOf('--tag')>=0?args[args.indexOf('--tag')+1]:'after';
const outFlag=args.indexOf('--out')>=0?args[args.indexOf('--out')+1]:undefined;
const tag=['before','after'].includes(tagFlag)?tagFlag:'after';
const out=outFlag?path.resolve(outFlag):path.join(root,'local-benchmark-results','map-ui-adaptive-20261027',tag);
const fixture=path.join(root,'tests','fixtures','small-dgs.json');
const port=5183,url=`http://127.0.0.1:${port}/`;

// Public synthetic geometry only (same derivation as browser-smoke): the
// electrical fixture is unchanged, GPS routes are synthetic.
const visualRaw=JSON.parse(await readFile(fixture,'utf8'));
const routeIndex=visualRaw.ElmLne.Attributes.indexOf('GPScoords:MATRIX');
visualRaw.Matrix.Values=[];
visualRaw.ElmLne.Values.forEach((line,i)=>{const is400=line[0].startsWith('L400'),lat=is400?39.9:39.8,lon=is400?32.8:32.7,id='Synthetic_route_'+i;line[routeIndex]=id;[[lat,lon],[lat+(i%6-2.5)*.35,lon+(is400?2.4:-2.4)],[lat,lon]].forEach((point,row)=>point.forEach((value,column)=>visualRaw.Matrix.Values.push([id,row,column,value])));});

await mkdir(out,{recursive:true});
const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true}});await server.listen();
let browser;
const shots=[],metrics={tag,viewport:{}};
try{
  browser=await chromium.launch({headless:true});
  const contexts=[['1366',1366,768,1],['1920',1920,1080,1],['narrow1024',1024,640,1],['dpr125',1536,864,1.25]];
  let page=null;
  for(const[name,width,height,dpr]of contexts){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});
    if(!page){
      page=await context.newPage();page.setDefaultTimeout(20000);
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(url);
      await page.locator('#modelFileInput').setInputFiles({name:'synthetic-map-visual-dgs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(visualRaw))});
      await page.waitForFunction(()=>Boolean(document.querySelector('.ga-head-model')?.textContent?.trim()));
      await page.getByRole('button',{name:'Harita',exact:true}).click();
      await page.locator('.ga-map-wrap').waitFor();
      page._errors=errors;
    }else{
      page=await context.newPage();page.setDefaultTimeout(20000);
      await page.goto(url);
      await page.locator('#modelFileInput').setInputFiles({name:'synthetic-map-visual-dgs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(visualRaw))});
      await page.waitForFunction(()=>Boolean(document.querySelector('.ga-head-model')?.textContent?.trim()));
      await page.getByRole('button',{name:'Harita',exact:true}).click();
      await page.locator('.ga-map-wrap').waitFor();
    }
    await page.waitForTimeout(400);
    const overflow=await page.evaluate(()=>{
      const rows=[...document.querySelectorAll('.ga-map-toolbar-row')].map(row=>({cls:row.className,scrollWidth:row.scrollWidth,clientWidth:row.clientWidth,offsetHeight:row.offsetHeight}));
      const toolbar=document.querySelector('.ga-map-toolbar');
      return{rows,toolbarScroll:toolbar?{scrollWidth:toolbar.scrollWidth,clientWidth:toolbar.clientWidth}:null,docScroll:document.documentElement.scrollWidth>window.innerWidth+1,barHeight:toolbar?.getBoundingClientRect().height??0};
    });
    metrics.viewport[name]={width,height,dpr,overflow};
    await page.locator('.ga-map-view').screenshot({path:path.join(out,`${name}.png`)});
    shots.push(`${name}.png`);
    if(name==='1366'){
      await page.getByRole('checkbox',{name:'Etiketler'}).check();
      await page.waitForTimeout(300);
      await page.locator('.ga-map-view').screenshot({path:path.join(out,'labels-national-1366.png')});shots.push('labels-national-1366.png');
      const canvas=page.locator('#networkCanvas'),box=await canvas.boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
      for(let i=0;i<9;i++)await page.mouse.wheel(0,-240);
      await page.waitForTimeout(500);
      await page.locator('.ga-map-view').screenshot({path:path.join(out,'labels-zoom-1366.png')});shots.push('labels-zoom-1366.png');
      metrics.labelZoom={labelCount:await page.locator('#networkCanvas').evaluate(el=>el.dataset.labelCount??null),paintCount:await page.locator('#networkCanvas').evaluate(el=>el.dataset.paintCount??null)};
      await page.getByRole('checkbox',{name:'Etiketler'}).uncheck();
      await page.waitForTimeout(200);
      await page.getByRole('button',{name:'Sığdır'}).click();
      await page.getByRole('button',{name:'Elektriksel Sonuçlar'}).click();
      await page.waitForTimeout(400);
      await page.locator('.ga-map-view').screenshot({path:path.join(out,'lightning-open-1366.png')});shots.push('lightning-open-1366.png');
    }
    await context.close();
  }
  metrics.pageErrors=page?._errors??[];
  await writeFile(path.join(out,'metrics.json'),JSON.stringify(metrics,null,2));
  await writeFile(path.join(out,'shots.txt'),shots.join('\n'));
  console.log(`map-ui-evidence[${tag}] → ${out}\n`+JSON.stringify(metrics.viewport,null,1));
}finally{
  await browser?.close();
  await new Promise(resolve=>server.httpServer.close(()=>resolve()));
}
