import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const out=resolve('local-benchmark-results/sld-v36');
const widths={M937:1300,M1482:1300,M890:1500};
const browser=await chromium.launch({headless:true});
for(const [id,w]of Object.entries(widths)){
 const svg=await readFile(resolve(out,`AFTER-${id}.svg`),'utf8');
 const box=svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
 const [,vw,vh]=box??['','1000','1000'];
 const scale=Number(w)/Number(vw),height=Math.round(Number(vh)*scale);
 const page=await browser.newPage({viewport:{width:Math.round(Number(w)),height:Math.min(height,40000)}});
 await page.setContent(`<body style="margin:0;background:#fff">${svg.replace(/ style="[^"]*"/,'').replace('<svg','<svg width="'+w+'" height="'+height+'"')}</body>`);
 await page.screenshot({path:resolve(out,`RENDER-${id}.png`),fullPage:true});
 await page.close();console.log(id,w+'x'+height);
}
await browser.close();