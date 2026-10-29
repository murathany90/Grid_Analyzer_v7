import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
for(const[label,file]of [['V12','backups/v12_guncel.original.html'],['Modular','dist/Grid_Analyzer_PSSE_Portable.html']]){
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const start=performance.now();await page.goto(pathToFileURL(process.cwd()+'/'+file).href);await page.waitForFunction(()=>!!(window.psseStudio||window.__GA_BRIDGE__));await frame(page);const startup=performance.now()-start;
  const loadStart=performance.now();await page.locator('#pse-file').setInputFiles('control1/20261014_1200_SN3_TR0.sav');await page.waitForFunction(()=>{const c=window.psseStudio?.controller??window.__GA_BRIDGE__;return c.psseNetwork&&!c.busy;});await frame(page);const load=performance.now()-loadStart;
  const times=[];let mapNode;
  for(let i=0;i<5;i++){
    const elapsed=await page.evaluate(async()=>{const navigate=window.psseStudio?.navigate??window.__GA_PSSE_V9__.navigate;navigate('settings');await new Promise(resolve=>requestAnimationFrame(resolve));const t=performance.now();navigate('map');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return performance.now()-t;});times.push(elapsed);
    if(i===0)await page.evaluate(()=>window.__benchNode=document.querySelector('.ga-psse-geo-link'));
  }
  const stable=await page.evaluate(()=>window.__benchNode===document.querySelector('.ga-psse-geo-link'));
  const sorted=[...times.slice(1)].sort((a,b)=>a-b),median=(sorted[1]+sorted[2])/2;
  results.push({label,startupMs:startup,loadMs:load,mapNavigationMs:times,medianRevisitMs:median,stableMapDom:stable,htmlBytes:(await fs.stat(file)).size,errors});await page.close();
}
await browser.close();await fs.writeFile('evidence/performance-comparison.json',JSON.stringify({browser:'Chrome',viewport:'1600x900',samples:results,note:'Same machine, offline file://. Wall time includes two animation frames; five visits per build. Single startup/import sample, not a statistical throughput guarantee.'},null,2));console.log(JSON.stringify(results,null,2));
