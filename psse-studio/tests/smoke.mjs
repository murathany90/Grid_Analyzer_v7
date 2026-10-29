import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}});page.on('pageerror',e=>console.log('PAGEERROR',e.stack));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
await page.goto(pathToFileURL(process.cwd()+'/dist/Grid_Analyzer_PSSE_Portable.html').href);await page.waitForTimeout(700);
console.log('BOOT',await page.evaluate(()=>({exists:!!window.psseStudio,text:document.body.innerText.slice(0,800)})));
if(await page.evaluate(()=>!!window.psseStudio)){
  await page.locator('#pse-file').setInputFiles('control1/20261014_1200_SN3_TR0.sav');
  await page.waitForFunction(()=>window.psseStudio.controller.psseNetwork&&!window.psseStudio.controller.busy,{},{timeout:60000});
  console.log('LOADED',await page.evaluate(()=>({state:psseStudio.getState(),counts:{buses:psseStudio.controller.psseNetwork.buses.length,branches:psseStudio.controller.psseNetwork.branches.length}})));
  await page.locator('[data-route=map]').click();await page.waitForTimeout(800);await page.screenshot({path:'evidence/smoke-map.png'});
  console.log('MAP',await page.evaluate(()=>({text:document.querySelector('#app').innerText.slice(0,1300),svg:document.querySelectorAll('.ga-psse-geo-svg>*').length})));
  await page.locator('[data-route=sld]').click();await page.waitForTimeout(400);await page.screenshot({path:'evidence/smoke-sld.png'});
  console.log('SLD',await page.evaluate(()=>document.querySelector('#app').innerText.slice(0,1000)));
}
await browser.close();
