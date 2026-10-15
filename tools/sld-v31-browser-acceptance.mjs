import assert from 'node:assert/strict';

/** Independently inspect rendered source inventory, fixed contacts and native rail crossings. */
export async function nativeSld31Evidence(page,fixture){
 return page.locator('.ga-sld-svg').evaluate((root,f)=>{
  const physical=[...root.querySelectorAll('[data-physical-switch]')],equipment=[...root.querySelectorAll('[data-equipment-center]')],errors=[];
  const expected=new Set(f.graph.switches.map(s=>s.sourceClass+'|'+s.sourceId)),keys=physical.map(g=>g.dataset.physicalSwitch);
  for(const key of expected)if(keys.filter(k=>k===key).length!==1)errors.push('Switch identity '+key);
  for(const key of keys)if(!expected.has(key))errors.push('Invented switch '+key);
  const toWorld=(node,x,y)=>new DOMPoint(x,y).matrixTransform(root.getScreenCTM().inverse().multiply(node.getScreenCTM()));
  for(const g of physical){
   const contacts=[...g.querySelectorAll('[data-symbol-contact]')].map(c=>toWorld(c,Number(c.getAttribute('cx')),Number(c.getAttribute('cy')))),declared=[g.dataset.contactFrom,g.dataset.contactTo].map(s=>s.split(',').map(Number));
   for(const p of declared)if(!contacts.some(c=>Math.hypot(c.x-p[0],c.y-p[1])<.01))errors.push('Detached contact '+g.dataset.id);
   const sw=f.graph.switches.find(s=>s.sourceClass+'|'+s.sourceId===g.dataset.physicalSwitch),usage=String((f.raw[sw.sourceClass]??[]).find(r=>r.id===sw.sourceId)?.attributes.aUsage??'').toLowerCase(),profile=g.querySelector('[data-switch-profile]')?.dataset.switchProfile;
   const want=usage==='cbk'?'KE-01':['dct','sdc'].includes(usage)?'GENERIC_DISCONNECTOR':'UNSPECIFIED';if(profile!==want)errors.push('Unproved subtype '+g.dataset.id);
   const kind={cbk:'breaker',dct:'isolator',sdc:'load-break-disconnector',swt:'load-switch'}[usage]??'switch';if(g.dataset.deviceKind!==kind)errors.push('DGS kind mismatch '+g.dataset.id);
   if(g.dataset.from!==sw.from||g.dataset.to!==sw.to)errors.push('Changed native endpoints '+g.dataset.id);
  }
  const actualEquipment=equipment.map(g=>g.dataset.class+'|'+g.dataset.id),nativeEquipment=new Set(f.graph.equipment.map(e=>e.sourceClass+'|'+e.id));
  for(const k of nativeEquipment)if(actualEquipment.filter(e=>e===k).length!==1)errors.push('Equipment coverage '+k);
  for(const k of actualEquipment)if(!nativeEquipment.has(k))errors.push('Invented equipment '+k);
  for(const node of root.querySelectorAll('[data-symbol="earth-switch"],[data-symbol="current-transformer"],[data-symbol="voltage-transformer"],[data-motor]'))errors.push('Unproved reference device '+node.outerHTML.slice(0,80));
  const rails=[...root.querySelectorAll('[data-semantic="busbar-section"]')].map(g=>{const n=g.querySelector('[data-connection]').getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);return {fid:g.dataset.id??g.dataset.sourceReference,x1:Math.min(n[0],n[2]),x2:Math.max(n[0],n[2]),y:n[1]};});
  const transformers=[];
  for(const g of equipment.filter(g=>g.dataset.class==='ElmTr2')){
   const e=f.graph.equipment.find(e=>e.id===g.dataset.id),t=f.graph.terminals.find(t=>t.id===e.terminals[0]),lv=f.graph.terminals.find(t=>t.id===e.terminals[1]),center=g.dataset.equipmentCenter.split(',').map(Number);
   if(g.dataset.hvTerminal!==e.terminals[0]||g.dataset.lvTerminal!==e.terminals[1])errors.push('Winding identity '+e.id);
   if(t.vnKv>=300&&lv.vnKv<=40){
    const primary=f.graph.feeders.find(b=>b.terminalIds.includes(e.terminals[0])),own=rails.filter(r=>primary?.busSectionIds.includes(r.fid));if(own.length&&center[1]<=Math.max(...own.map(r=>r.y)))errors.push('Transformer outside HV zone '+e.id);
    const wire=g.querySelector(`path[data-native-terminal="${e.terminals[1]}"]`),numbers=wire.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number),crossings=[];
    for(let i=2;i<numbers.length;i+=2){const a=[numbers[i-2],numbers[i-1]],b=[numbers[i],numbers[i+1]];for(const r of rails)if(Math.abs(a[0]-b[0])<.001&&a[0]>=r.x1&&a[0]<=r.x2&&r.y>Math.min(a[1],b[1])+.01&&r.y<Math.max(a[1],b[1])-.01)crossings.push(r.fid);}
    if(crossings.length)errors.push('LV crosses unrelated rail '+e.id+': '+crossings.join(','));transformers.push({fid:e.id,hv:e.terminals[0],lv:e.terminals[1],center,routing:g.dataset.secondaryRouting,crossings});
   }
  }
  return {switches:keys.length,equipment:actualEquipment.length,transformers,errors};
 },fixture);
}

export async function sld31UiAcceptance(page,fullscreenPath){
 assert.equal(await page.getByLabel('Şema kapsamı',{exact:true}).count(),0);assert.equal(await page.locator('.ga-sld-view > .ga-toolbar').count(),1);
 const panel=page.locator('.ga-sld-side-panel');if(await panel.isVisible())await page.getByRole('button',{name:'Paneli kapat',exact:true}).click();
 await page.getByRole('button',{name:'Sığdır',exact:true}).click();await page.evaluate(()=>new Promise(requestAnimationFrame));
 const before=await page.locator('.ga-sld-diagram').boundingBox();assert.ok(before.height>page.viewportSize().height*.65,'Canvas consumes the remaining screen');
 const selected=await page.evaluate(()=>JSON.stringify(ctx.selection)),box=await page.locator('.ga-sld-svg').getAttribute('viewBox');
 await page.getByRole('button',{name:'SVG indir',exact:true}).scrollIntoViewIfNeeded();assert.ok(await page.getByRole('button',{name:'SVG indir',exact:true}).isVisible());assert.ok(await page.getByRole('button',{name:'PNG indir',exact:true}).isVisible());assert.equal(await page.locator('.ga-sld-svg').getAttribute('viewBox'),box);
 await page.getByRole('button',{name:'Bilgi ve sonuçlar',exact:true}).click();assert.ok(await panel.isVisible());await page.getByRole('button',{name:'Paneli kapat',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.stringify(ctx.selection)),selected);
 await page.getByRole('button',{name:'Tam ekran',exact:true}).click();await page.waitForFunction(()=>document.fullscreenElement||document.querySelector('.ga-sld-expanded'));const full=await page.locator('.ga-sld-diagram').boundingBox();assert.ok(full.height>page.viewportSize().height*.8);
 if(fullscreenPath)await page.screenshot({path:fullscreenPath});
 await page.getByRole('button',{name:'Tam ekrandan çık',exact:true}).click();await page.waitForFunction(()=>!document.fullscreenElement&&!document.querySelector('.ga-sld-expanded'));assert.equal(await page.evaluate(()=>JSON.stringify(ctx.selection)),selected);
 return {canvasHeight:before.height,fullscreenCanvasHeight:full.height,selectionPreserved:true};
}

export async function sld31NegativeSvgAcceptance(page){
 const result=await page.evaluate(async()=>{
  const {ytbsFixture}=await import('/tests/helpers/sld-ytbs-fixture.ts'),{SvgSldRenderer}=await import('/src/features/sld/sld-renderer.ts'),{allVoltageBands}=await import('/src/domain/model/voltage-band.ts');
  const f=ytbsFixture();f.n.transformers=[];f.line('X',400);f.source.bays=f.source.bays.map(b=>({...b,name:'motor CT VT topraklama 400/33',attributes:{feederFunction:'ÖLÇÜ+BARA TOPRAK'}}));const g=f.graph(),original=JSON.stringify(f.n),host=document.createElement('div');host.style.width='1440px';host.style.height='900px';document.body.append(host);
  const items=[...g.equipment.map(e=>({id:e.id,name:e.name,sourceClass:e.sourceClass,busIds:e.terminals,siteIds:['S'],inService:true})),...g.switches.map(s=>({id:s.id,name:s.id,sourceClass:s.sourceClass,busIds:[s.from,s.to],siteIds:['S'],inService:true,closed:true}))];
  const d={scope:'station',station:{id:'S',name:'No reference equipment'},orientation:'vertical',selectedId:null,groups:[],equipment:items,bays:[],selectedBay:null,terminals:[],switches:[],regionalSites:[],regionalBranches:[],unresolvedSwitches:0,graph:g,voltageBands:allVoltageBands(),page:0,technical:false,scenario:ctx.scenario.current,settings:ctx.settings.value,n1Detail:null,selectedN1IslandId:null,lod:'overview'};
  const renderer=new SvgSldRenderer();renderer.render(host,d,()=>{});const invented=host.querySelectorAll('[data-transformer-type],[data-symbol="earth-switch"],[data-symbol="current-transformer"],[data-symbol="voltage-transformer"],[data-motor]').length,switches=host.querySelectorAll('[data-physical-switch]').length;
  d.scenario={...d.scenario,switchState:{...d.scenario.switchState,H_CB:false}};items.find(e=>e.id==='H_CB').closed=false;renderer.render(host,d,()=>{});const updated=host.querySelector('[data-physical-switch="ElmCoup|H_CB"] [data-symbol-state]').dataset.symbolState,unchanged=JSON.stringify(f.n)===original;host.remove();return {invented,switches,expected:g.switches.length,updated,unchanged};
 });assert.equal(result.invented,0);assert.equal(result.switches,result.expected);assert.equal(result.updated,'OPEN');assert.equal(result.unchanged,true);return result;
}
