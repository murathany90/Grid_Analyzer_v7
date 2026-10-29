import assert from 'node:assert/strict';
export async function assertCanvasMoves(page){
  await page.waitForFunction(()=>Number(document.querySelector('.ga-psse-flow-canvas')?.dataset.arrowCount)>0);
  const first=await page.locator('.ga-psse-flow-canvas').evaluate(e=>{window.__flowPixels=e.getContext('2d').getImageData(0,0,e.width,e.height).data;return Number(e.dataset.frame);});
  await page.waitForFunction(t=>Number(document.querySelector('.ga-psse-flow-canvas').dataset.frame)>t+300,first);
  const changed=await page.locator('.ga-psse-flow-canvas').evaluate(e=>{const pixels=e.getContext('2d').getImageData(0,0,e.width,e.height).data;let n=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==__flowPixels[i])n++;return n;});assert(changed>100,'Visible Canvas arrow pixels must change');
}
