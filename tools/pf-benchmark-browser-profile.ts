/** Private real-fixture browser measurement; output remains ignored. */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {cpus,totalmem} from 'node:os';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const [model,benchmark,tag='browser-profile']=process.argv.slice(2),portable=process.argv.includes('--portable'),channel=process.argv.includes('--edge')?'msedge':'chrome',port=5182;
if(!model||!benchmark)throw Error('model.zip benchmark.zip tag [--portable] [--edge]');
const html=portable?await readFile('dist-portable/GridAnalyzer_v7.html'):null;
const server=portable?createServer((_q,r)=>{r.setHeader('Content-Type','text/html');r.end(html);}).listen(port,'127.0.0.1'):spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({channel,headless:true,args:['--js-flags=--max-old-space-size=6144']});
try{
  for(let i=0;i<80;i++){try{if((await fetch(`http://127.0.0.1:${port}/`)).ok)break;}catch{}await delay(250);}
  const page=await browser.newPage(),errors:string[]=[],snapshots:unknown[]=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(190000);
  await page.addInitScript(()=>{
    const w=window as typeof window&{profile:{workers:number;terminated:number;stages:string[];maxEventLoopLagMs:number}};w.profile={workers:0,terminated:0,stages:[],maxEventLoopLagMs:0};const Native=Worker;
    window.Worker=class extends Native{constructor(url:string|URL,opts?:WorkerOptions){super(url,opts);w.profile.workers++;this.addEventListener('message',e=>{if(e.data.type==='PROGRESS'&&!w.profile.stages.includes(e.data.stage))w.profile.stages.push(e.data.stage);});}terminate(){w.profile.terminated++;super.terminate();}};
    let last=performance.now();setInterval(()=>{const now=performance.now();w.profile.maxEventLoopLagMs=Math.max(w.profile.maxEventLoopLagMs,now-last-100);last=now;},100);
  });
  await page.goto(`http://127.0.0.1:${port}/`);await page.getByRole('button',{name:'KARŞILAŞTIRMA',exact:true}).click();const view=page.locator('section[data-view="comparison"]');
  await view.getByLabel('Model ZIP',{exact:true}).setInputFiles(model);await view.getByLabel('Benchmark ZIP',{exact:true}).setInputFiles(benchmark);
  const session=await page.context().newCDPSession(page);await session.send('Performance.enable');const started=performance.now();await view.getByRole('button',{name:'İki ZIP’i aç',exact:true}).click();
  let status='NOT_VERIFIED',loadedMs:number|null=null,next=0,checkpoint=[5,30,60,120,180];
  while(performance.now()-started<185000){
    await delay(500);const elapsed=performance.now()-started;
    const state=await Promise.race([page.evaluate(()=>({footer:document.querySelector('footer [role="status"]')?.textContent,profile:(window as typeof window&{profile:unknown}).profile})),delay(5000).then(()=>null)]);
    if(elapsed>=checkpoint[next]*1000||String(state?.footer).startsWith('Benchmark hazır')){const metrics=await session.send('Performance.getMetrics');snapshots.push({elapsedMs:elapsed,state,metrics:metrics.metrics.filter((m:{name:string})=>['JSHeapUsedSize','JSHeapTotalSize','TaskDuration','ScriptDuration'].includes(m.name)),nodeRssBytes:process.memoryUsage().rss});next++;}
    if(String(state?.footer).startsWith('Benchmark hazır')){status='LOADED';loadedMs=elapsed;break;}if(String(state?.footer).startsWith('Benchmark yüklenemedi')){status='FAILED';break;}
  }
  let computation='NOT_RUN',map='NOT_VERIFIED';if(status==='LOADED'){
    await view.getByRole('button',{name:'GA Tam AC baz hesabı',exact:true}).click();await page.waitForFunction(()=>document.querySelector('footer [role="status"]')?.textContent?.includes('NR yakınsadı'),{},{timeout:180000});computation='CONVERGED';
    await page.getByRole('button',{name:'Harita',exact:true}).click();await page.getByLabel('Benchmark harita analizi').selectOption('LF');await page.getByLabel('Benchmark harita metriği').selectOption('voltagePu');await page.getByLabel('Tanısal harita farklarını onayla').check();await page.getByLabel('Benchmark harita kaynağı').selectOption('EXPLORATORY_DELTA');await delay(1000);
    map=await page.locator('.ga-map-legend').textContent().catch(()=>null)??'LEGEND_SELECTOR_NOT_VERIFIED';await mkdir('local-benchmark-results',{recursive:true});await page.screenshot({path:`local-benchmark-results/${tag}-map.png`});
  }else await view.getByRole('button',{name:'İptal',exact:true}).click();
  await mkdir('local-benchmark-results',{recursive:true});const final=await session.send('Performance.getMetrics');const report={portableSha256:html?createHash('sha256').update(html).digest('hex'):null,inputBytes:{model:(await stat(model)).size,benchmark:(await stat(benchmark)).size},hardware:{cpu:cpus()[0]?.model,logicalCpus:cpus().length,systemMemoryBytes:totalmem()},tag,channel,browserVersion:browser.version(),platform:process.platform,origin:`http://127.0.0.1:${port}`,portable,status,loadedMs,computation,map,snapshots,errors,finalProfile:await page.evaluate(()=>(window as typeof window&{profile:unknown}).profile),finalMetrics:final.metrics.filter((m:{name:string})=>['JSHeapUsedSize','JSHeapTotalSize','TaskDuration','ScriptDuration'].includes(m.name))};
  await writeFile(`local-benchmark-results/${tag}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({tag,status,loadedMs,computation,errors}));
}finally{await browser.close();if('kill'in server)server.kill();else server.close();}
