import {testViewport} from './desktop-test-options.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

async function download(page,name){const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const file=await pending,stream=await file.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return {name:file.suggestedFilename(),bytes:Buffer.concat(chunks)};}
export async function pngBrowserAcceptance(page){
  await page.clock.setFixedTime(new Date(2026,11,11,10,0));
  await page.getByRole('button',{name:'Yakınlaştır +',exact:true}).click();const viewport=await page.locator('.ga-sld-svg').getAttribute('viewBox');
  const svg=await download(page,'SVG indir'),png=await download(page,'PNG indir');
  const box=svg.bytes.toString().match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  assert.notEqual(box.join(' '),viewport,'Export is the complete page after zoom');
  assert.equal(png.bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.match(png.name,/^.+\([^)]+\)_11\.12\.26_1000\.png$/);assert.equal(svg.name,png.name.replace(/\.png$/,'.svg'));assert.ok(!/[<>:"/\\|?*\x00-\x1f]/.test(png.name));
  const pixels=await page.evaluate(async base64=>{const blob=await(await fetch('data:image/png;base64,'+base64)).blob(),image=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d');c.drawImage(image,0,0);const edge=[...c.getImageData(0,0,1,1).data];let ink=0;for(let y=0;y<canvas.height;y+=Math.max(1,Math.floor(canvas.height/100)))for(let x=0;x<canvas.width;x+=Math.max(1,Math.floor(canvas.width/100))){const p=c.getImageData(x,y,1,1).data;if(p[0]<240||p[1]<240||p[2]<240)ink++;}image.close();return {width:canvas.width,height:canvas.height,edge,ink};},png.bytes.toString('base64'));
  const scale=Math.min(2,16384/box[2],16384/box[3],Math.sqrt(32000000/(box[2]*box[3])));
  assert.equal(pixels.width,Math.floor(box[2]*scale));assert.equal(pixels.height,Math.floor(box[3]*scale));assert.deepEqual(pixels.edge,[255,255,255,255]);assert.ok(pixels.ink>10,'PNG contains real colored geometry and text');
  return {svg:svg.bytes,png:png.bytes,box,pixels};
}
export async function offlinePngAcceptance(browser){
  const page=await browser.newPage({viewport:testViewport(1366,900)}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>{external.push(r.request().url());return r.abort();});
  try{
    await page.goto(pathToFileURL(resolve('dist-portable/GridAnalyzer_v7.html')).href);
    const raw=JSON.parse(await readFile('tests/fixtures/small-dgs.json','utf8')),site=raw.ElmSite,index=site.Attributes.indexOf('loc_name');for(const row of site.Values)row[index]='Çığ İstasyonu — Şönt / Trafo '+row[index];
    await page.locator('#modelFileInput').setInputFiles({name:'unicode-offline.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
    await page.waitForFunction(()=>document.querySelector('.ga-mode-card')?.textContent?.trim()==='DGS MODU'&&document.querySelector('.ga-head-model')?.textContent?.includes('unicode-offline.json')&&document.querySelector('.ga-busy')?.hidden===true);
    await page.locator('.ga-nav').getByRole('button',{name:'Tek Hat Şeması',exact:true}).click();await page.waitForSelector('.ga-sld-svg [data-physical-switch]');
    const result=await pngBrowserAcceptance(page);assert.match(result.svg.toString(),/Çığ İstasyonu/);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    console.log('SLD offline file:// PNG/SVG PASS: full sheet after zoom, Unicode source, white background, colored content, no network.');
  }finally{await page.close();}
}
