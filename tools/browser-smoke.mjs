import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=path.join(root,'tests','fixtures','small-dgs.json');
const port=5179,url=`http://127.0.0.1:${port}/`;
const server=spawn(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});
let browser;
try{
 let ready=false;for(let attempt=0;attempt<80;attempt++){try{const response=await fetch(url);if(response.ok){ready=true;break;}}catch{}await delay(250);}
 if(!ready)throw new Error('Vite smoke server did not become ready.');
 browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(20000);
 await page.goto(url);await page.locator('#modelFileInput').setInputFiles(fixture);
 await page.waitForFunction(()=>Boolean(document.querySelector('.ga-head-model')?.textContent?.trim()));
 await page.getByRole('button',{name:'Analizler',exact:true}).click();
 await page.getByRole('button',{name:/Baz Hesapla.*Tam AC/}).click();
 await page.waitForFunction(()=>document.querySelector('footer [role="status"]')?.textContent?.includes('Yakınsadı'));
 await page.getByRole('button',{name:'Harita',exact:true}).click();
 await page.getByRole('button',{name:'Elektriksel Sonuçlar'}).click();
 await page.locator('.ga-result-table tbody tr[data-row]').first().waitFor();
 await page.getByRole('button',{name:'Tek Hat Şeması',exact:true}).click();
 await page.locator('.ga-sld-svg').waitFor();
 console.log('Chromium smoke passed: load → Full AC → map → Lightning results → SLD.');
}finally{
 await browser?.close();server.kill('SIGTERM');
}
