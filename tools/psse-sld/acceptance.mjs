import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const html=process.env.GA_SLD_HTML, sav=process.env.GA_SLD_SAV, refs=process.env.GA_SLD_REFERENCE_DIR, out=process.env.GA_SLD_EVIDENCE;
assert.ok(html&&sav&&refs&&out,'Set GA_SLD_HTML/SAV/REFERENCE_DIR/EVIDENCE');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const result={imports:[],layouts:{},errors};
try{
 await page.goto(pathToFileURL(html).href);
 await page.locator('#pse-file, #modelFileInput').first().setInputFiles(sav);
 await page.waitForFunction(()=>((window.psseStudio?.controller??window.__GA_BRIDGE__)?.psseNetwork?.buses?.length||0)>100,null,{timeout:60000});
 await page.getByRole('button',{name:/Tek Hat/i}).first().click();
 await page.waitForSelector('#ga-sld-studio');
 for(const city of ['Ankara','Kayseri','Konya']){
  const fn=fs.readdirSync(refs).find(n=>n.includes(city)&&n.endsWith('.sld'));assert.ok(fn);
  const bytes=[...fs.readFileSync(path.join(refs,fn))];
  const imported=await page.evaluate(async({bytes,fn})=>{const r=await GASldStudio.importOne(new File([new Uint8Array(bytes)],fn));const d=GASldStudio.getActiveDoc();return {r:{ok:r.ok,error:r.error},counts:d?.gaSld?.components?.reduce((a,c)=>(a[c.t]=(a[c.t]||0)+1,a),{})};},{bytes,fn});
  result.imports.push({city,...imported});assert.equal(imported.r.ok,true);
 }
 for(const scope of ['sincan','owner708']){
  result.layouts[scope]=await page.evaluate(async(scope)=>{
   const a=window.GASldStudio;
   if(scope==='sincan'){const s=document.querySelector('[aria-label="SLD editörü trafo merkezi"]');const o=[...s.options].find(o=>/SINCAN|SİNCAN/i.test(o.textContent));if(!o)throw Error('Sincan missing');s.value=o.value;a.newTM(o.value);}
   else {document.querySelector('[aria-label="SLD editörü OWNER bölgesi"]').value='708';a.newOWNER();}
   const d=a.getActiveDoc(), {before,after}=d.gaSld.layoutMetrics;
   const original=structuredClone(d.gaSld);
   const exported=await a.exportNativeSld({skipDownload:true});
   const bytes=exported.ok?[...exported.bytes]:[];
   const plain=doc=>({...doc,rawBytes:undefined,_rawMainList:undefined,_rawLayers:undefined,_rawGroups:undefined,_rawViews:undefined,components:doc.components.map(c=>{const {_rawObj,_rawKnees,...rest}=c;return rest;})});
   return {before,after,exported:{ok:exported.ok,error:exported.error},bytes,doc:plain(d.gaSld),baseline:plain(d.gaSld._layoutBaseline||original)};
  },scope);
  const r=result.layouts[scope];assert.equal(r.exported.ok,true,r.exported.error);fs.writeFileSync(path.join(out,scope+'.json'),JSON.stringify(r.doc));fs.writeFileSync(path.join(out,scope+'_baseline.json'),JSON.stringify(r.baseline));
  if(r.exported.ok){fs.writeFileSync(path.join(out,scope+'.sld'),Buffer.from(r.bytes));const re=await page.evaluate(async({bytes,scope})=>{const r=await GASldStudio.importOne(new File([new Uint8Array(bytes)],scope+'.sld'));return {ok:r.ok,error:r.error};},{bytes:r.bytes,scope});r.reimport=re;assert.equal(re.ok,true);}
  delete r.bytes;delete r.doc;delete r.baseline;
  // A real pointer drag, Undo/Redo, and knee edit on the native re-import.
  const baseline=await page.evaluate(()=>GASldStudio.getActiveDoc().gaSld.components.filter(c=>c.t==='Symbol'&&c.stype==='Busbar').map(c=>({id:c.id,pos:c.pos}))[0]);
  const bar=page.locator(`.ga-studio-sld-symbol[data-sld-id="${baseline.id}"] line.ga-sld-busbar`).first();
  await bar.scrollIntoViewIfNeeded();const bb=await bar.boundingBox();assert.ok(bb);
  await page.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await page.mouse.down();await page.mouse.move(bb.x+bb.width/2+30,bb.y+bb.height/2+20,{steps:8});await page.mouse.up();
  const moved=await page.evaluate(id=>GASldStudio.getActiveDoc().gaSld.components.find(c=>c.id===id).pos,baseline.id);
  assert.notDeepEqual(moved,baseline.pos,'pointer drag did not move bar');
  await page.getByRole('button',{name:'↶ Geri',exact:true}).click();
  const undone=await page.evaluate(id=>GASldStudio.getActiveDoc().gaSld.components.find(c=>c.id===id).pos,baseline.id);assert.deepEqual(undone,baseline.pos);
  await page.getByRole('button',{name:'↷ İleri',exact:true}).click();
  const redone=await page.evaluate(id=>GASldStudio.getActiveDoc().gaSld.components.find(c=>c.id===id).pos,baseline.id);assert.deepEqual(redone,moved);
  await page.getByRole('button',{name:'◆ Knee-Point Ekle/Sil',exact:true}).click();
  const point=await page.locator('.ga-studio-sld-link path.ga-sld-line').evaluateAll(paths=>{
    for(const p of paths)for(const ratio of [.23,.43,.67,.83]){const t=p.getPointAtLength(p.getTotalLength()*ratio),m=p.getScreenCTM(),x=m.a*t.x+m.c*t.y+m.e,y=m.b*t.x+m.d*t.y+m.f,hit=document.elementFromPoint(x,y);if(x>0&&y>0&&x<innerWidth&&y<innerHeight&&hit?.closest('.ga-studio-sld-link')&&!hit.closest('.ga-studio-knee'))return {x,y};}
    return null;
  });assert.ok(point,'no hittable link segment');
  const kneesBefore=await page.evaluate(()=>GASldStudio.getActiveDoc().gaSld.components.filter(c=>c.t==='Link').reduce((n,c)=>n+(c.knees||[]).length,0));
  await page.mouse.click(point.x,point.y);
  const kneesAfter=await page.evaluate(()=>GASldStudio.getActiveDoc().gaSld.components.filter(c=>c.t==='Link').reduce((n,c)=>n+(c.knees||[]).length,0));
  assert.ok(kneesAfter>kneesBefore,'real knee click did not add points');
  await page.getByRole('button',{name:'↖ Seç / Taşı',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'💾 Native .sld Kaydet',exact:true}).click();const file=await download;await file.saveAs(path.join(out,scope+'_edited.sld'));
  const geometry=await page.evaluate(()=>{const d=GASldStudio.getActiveDoc().gaSld;return {...d,rawBytes:undefined,_rawMainList:undefined,_rawLayers:undefined,_rawGroups:undefined,_rawViews:undefined,components:d.components.map(c=>{const {_rawObj,_rawKnees,...r}=c;return r;})};});
  fs.writeFileSync(path.join(out,scope+'_edited.json'),JSON.stringify(geometry));
  const editBytes=[...fs.readFileSync(path.join(out,scope+'_edited.sld'))];
  const editedImport=await page.evaluate(async({editBytes,scope})=>{const r=await GASldStudio.importOne(new File([new Uint8Array(editBytes)],scope+'_edited.sld'));return {ok:r.ok,error:r.error};},{editBytes,scope});assert.equal(editedImport.ok,true);
  r.edit={drag:true,undo:true,redo:true,kneeAdded:kneesAfter-kneesBefore,reimport:true};
  r.textPx=await page.locator('.ga-studio-sld-label text:visible').evaluateAll(texts=>{const px=texts.map(t=>Number(t.getAttribute('font-size'))*Math.abs(t.getScreenCTM()?.a||1)).sort((a,b)=>a-b);return {count:px.length,p50:px[Math.floor(px.length*.5)],p90:px[Math.floor(px.length*.9)]};});
  await page.screenshot({path:path.join(out,scope+'.png'),fullPage:false});
 }
 await page.getByRole('button',{name:'Diğer / Dışa Aktar ▾',exact:true}).click();
 result.menu=await page.locator('.ga-studio-menu:popover-open').evaluate(m=>{const b=m.querySelector('button').getBoundingClientRect();const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {visible:!!m.offsetHeight,hit:!!hit?.closest('.ga-studio-menu')};});
 assert.equal(result.menu.hit,true);
 await page.getByRole('button',{name:/Katman Görünürlüğü/}).click();
 result.menu.click=await page.locator('.ga-studio-modal-backdrop.is-open').count();assert.equal(result.menu.click,1);
 await page.getByRole('button',{name:'Kapat',exact:true}).click();
 await page.getByRole('button',{name:'⚙ Diyagram Ayarları',exact:true}).click();
 result.settings=[];
 for(const tab of await page.locator('.ga-studio-modal-tab').all()){await tab.click();result.settings.push(await page.locator('.ga-studio-modal-backdrop.is-open .ga-studio-modal').boundingBox());}
 await page.getByRole('button',{name:'İptal',exact:true}).click();

 // Settings Apply/Cancel, native grouping, true point-node, project hash guard, reload.
 await page.getByRole('button',{name:'⚙ Diyagram Ayarları',exact:true}).click();
 const oldId=await page.evaluate(()=>GASldStudio.getSettings().annotations.showBusId);
 await page.getByLabel('Bara numarası göster (Bus ID)',{exact:true}).setChecked(!oldId);
 await page.getByRole('button',{name:'İptal',exact:true}).click();
 assert.equal(await page.evaluate(()=>GASldStudio.getSettings().annotations.showBusId),oldId);
 await page.getByRole('button',{name:'⚙ Diyagram Ayarları',exact:true}).click();
 await page.getByLabel('Bara numarası göster (Bus ID)',{exact:true}).setChecked(!oldId);
 await page.getByRole('button',{name:'✓ Uygula',exact:true}).click();
 assert.equal(await page.evaluate(()=>GASldStudio.getSettings().annotations.showBusId),!oldId);
 const bars=page.locator('.ga-studio-sld-symbol line.ga-sld-busbar');
 const selectedIds=[];
 for(let i=0;i<2;i++){const bar=bars.nth(i);const id=await bar.evaluate(el=>Number(el.closest('[data-sld-id]').dataset.sldId));selectedIds.push(id);if(i)await page.keyboard.down('Shift');const r=await bar.boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);if(i)await page.keyboard.up('Shift');}
 await page.keyboard.press('Control+g');
 const grouped=await page.evaluate(ids=>ids.map(id=>GASldStudio.getActiveDoc().gaSld.components.find(c=>c.id===id).groupId),selectedIds);
 assert.ok(grouped[0]&&grouped[0]===grouped[1],'Ctrl+G grouping failed');
 const getPositions=()=>page.evaluate(ids=>ids.map(id=>GASldStudio.getActiveDoc().gaSld.components.find(c=>c.id===id).pos),selectedIds);
 const groupBefore=await getPositions(), first=bars.first(), box=await first.boundingBox();
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2+15,{steps:5});await page.mouse.up();
 const groupAfter=await getPositions();assert.notDeepEqual(groupAfter[1],groupBefore[1],'group member did not follow drag');
 const groupNative=await page.evaluate(async()=>{const r=await GASldStudio.exportNativeSld({skipDownload:true});if(!r.ok)return r;return {ok:r.ok,groups:GASldStudio.parseSldBinary(r.bytes).components.filter(c=>c.groupId).length};});assert.equal(groupNative.ok,true);assert.ok(groupNative.groups>=2);
 await page.keyboard.press('Control+Shift+g');
 const firstId=selectedIds[0];
 await page.locator(`.ga-studio-sld-symbol[data-sld-id="${firstId}"]`).click({button:'right'});
 assert.equal(await page.getByRole('button',{name:/kademe gerçek komşu bara/}).count(),3);
 await page.getByRole('button',{name:'● Nokta / Daire Bara',exact:true}).click();
 const dot=await page.evaluate(async id=>{const r=await GASldStudio.exportNativeSld({skipDownload:true});return {ok:r.ok,error:r.error,stype:r.ok?GASldStudio.parseSldBinary(r.bytes).components.find(c=>c.id===id).stype:null};},firstId);assert.equal(dot.ok,true,dot.error);assert.equal(dot.stype,'Node');
 result.extendedUi={settingsCancel:true,settingsApply:true,groupDrag:true,groupNative:true,pointNative:true,neighborButtons:3};
 const projectDownload=page.waitForEvent('download');await page.evaluate(()=>GASldStudio.exportProject());const projectFile=await projectDownload;await projectFile.saveAs(path.join(out,'workspace.json'));
 const project=JSON.parse(fs.readFileSync(path.join(out,'workspace.json'),'utf8'));assert.ok(project.documents.some(d=>d.native?.base64));
 const rejected=await page.evaluate(project=>{project.source.modelHash='different-model';try{GASldStudio.importProject(project);return false;}catch{return true;}},project);assert.equal(rejected,true);result.extendedUi.modelHashGuard=true;
 const activeId=await page.evaluate(()=>GASldStudio.active());
 await page.waitForTimeout(350);await page.reload();await page.locator('#pse-file, #modelFileInput').first().setInputFiles(sav);await page.waitForFunction(()=>((window.psseStudio?.controller??window.__GA_BRIDGE__)?.psseNetwork?.buses?.length||0)>100,null,{timeout:60000});await page.getByRole('button',{name:/Tek Hat/i}).first().click();
 await page.waitForFunction(id=>window.GASldStudio?.active()===id,activeId,{timeout:20000});
 assert.equal(await page.evaluate(()=>GASldStudio.getSettings().annotations.showBusId),!oldId);
 result.extendedUi.reload=true;
 assert.equal(errors.length,0,errors.join(';'));
}finally{fs.writeFileSync(path.join(out,'browser_results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}
