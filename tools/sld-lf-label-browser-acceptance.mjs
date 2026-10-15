import assert from 'node:assert/strict';

/** Fixture quantities are deliberate signed endpoint probes, not real-model results. */
export async function lfLabelBrowserAcceptance(page){
 const rows=await page.evaluate(async()=>{
  const {sourceCircuit}=await import('/tests/helpers/sld-v32-circuits.ts'),{SvgSldRenderer}=await import('/src/features/sld/sld-renderer.ts'),{allVoltageBands}=await import('/src/domain/model/voltage-band.ts'),{emptyScenario}=await import('/src/domain/scenario/overlay.ts'),{defaultSettings}=await import('/src/persistence/settings.ts');
  const reports=[];
  for(const circuit of ['isolator-breaker-isolator','hv-lv-corridor']){
   const f=sourceCircuit(circuit),graph=f.graph,before=JSON.stringify(graph),host=document.createElement('div');host.style.width='1440px';host.style.height='1000px';document.querySelector('#app').replaceChildren(host);const renderer=new SvgSldRenderer();
   const entries=new Map(graph.equipment.map(e=>[e.sourceClass+'|'+e.id,{status:'CONVERGED',method:'FIXTURE_SIGN_PROBE',values:{fromTerminal:e.terminals[0],toTerminal:e.terminals[1],pFromMw:12.3,qFromMvar:4.5,pToMw:-11.9,qToMvar:-4,loadingPercent:85,tapPosition:7},lines:[],direction:12.3,alarm:false}]));
   for(const b of graph.busSections)entries.set('ElmTerm|'+b.id,{status:'CONVERGED',method:'FIXTURE_SIGN_PROBE',values:{voltageKv:b.voltageKv*1.01},lines:[],direction:null,alarm:false});
   const diagram={scope:'station',station:f.network.sites[0],selectedId:null,orientation:'vertical',groups:[],equipment:[...graph.switches.map(s=>({id:s.id,sourceClass:s.sourceClass,name:s.id,busIds:[s.from,s.to],siteIds:['S'],inService:true,closed:true})),...graph.equipment.map(e=>({id:e.id,name:e.name,sourceClass:e.sourceClass,busIds:e.terminals,siteIds:['S'],voltageKv:400,lvKv:154,inService:true}))],bays:f.source.bays,selectedBay:null,terminals:[],switches:[],regionalSites:[],regionalBranches:[],unresolvedSwitches:0,graph,voltageBands:allVoltageBands(),page:0,technical:false,scenario:emptyScenario(),settings:defaultSettings(),n1Detail:null,selectedN1IslandId:null,showArrows:false,overlay:{entries,status:'CONVERGED',method:'FIXTURE_SIGN_PROBE',phase:'POST',outageKey:null}};
   const frames=[];
   for(const [mode,showResults,status]of [['ytbs',false,'CONVERGED'],['LF',false,'CONVERGED'],['LF',true,'CONVERGED'],['LF',true,'STALE'],['LF',false,'STALE']]){
    for(const entry of entries.values())entry.status=status;
    renderer.render(host,{...diagram,mode,showResults},()=>{});const svg=host.querySelector('svg'),xml=new DOMParser().parseFromString(renderer.exportSvg(),'image/svg+xml');
    const titles=[...svg.querySelectorAll('[data-label-zone=title]')].map(e=>{const b=e.getBBox(),m=e.getCTM();return [e.textContent,b.x,b.y,m.a,m.d,m.e,m.f];});
    const geometry=[...svg.querySelectorAll('[data-equipment-center],[data-physical-switch],path[data-connection]')].map(e=>[e.getAttribute('data-id'),e.getAttribute('data-equipment-center'),e.getAttribute('data-contact-in'),e.getAttribute('data-contact-out'),e.getAttribute('d')]);
    frames.push({mode,showResults,status,titles,geometry,box:xml.documentElement.getAttribute('viewBox'),feeders:[...svg.querySelectorAll('[data-feeder-marker]')].map(g=>({texts:[...g.querySelectorAll('text')].map(t=>t.textContent),rows:[...g.querySelectorAll('[data-result-layer] text')].map(t=>t.textContent)})),transformers:[...svg.querySelectorAll('[data-equipment-caption]')].map(g=>({rows:[...g.querySelectorAll('[data-result-layer] text')].map(t=>t.textContent),ports:[...g.querySelectorAll('[data-result-port]')].map(p=>[p.dataset.resultPort,p.dataset.nativeTerminal])})),bus:[...svg.querySelectorAll('[data-result-layer=bus] text')].map(t=>t.textContent),otherVoltage:[...svg.querySelectorAll('[data-result-layer]:not([data-result-layer=bus]) text')].filter(t=>/kV|\bA\b|Kayıp|HV|LV/.test(t.textContent)).map(t=>t.textContent)});
   }
   reports.push({circuit,frames,unchanged:JSON.stringify(graph)===before});
  }
  return reports;
 });
 for(const report of rows){assert.ok(report.unchanged);const first=report.frames[0];for(const frame of report.frames){assert.deepEqual(frame.geometry,first.geometry,'LF never moves physical ports/conductors');assert.deepEqual(frame.titles,first.titles,'LF never moves names');assert.equal(frame.box,first.box,'LF never changes the complete page bounds');assert.deepEqual(frame.otherVoltage,[]);for(const f of frame.feeders){assert.ok(f.texts.length<=3);assert.ok(f.rows.length<=2);if(!frame.showResults)assert.equal(f.texts.length,1);}}
  const on=report.frames[2],stale=report.frames[3];for(const f of on.feeders)if(f.rows.length){assert.match(f.rows[0],/^-?\d+\.\d MW$/);assert.match(f.rows[1],/^-?\d+\.\d MVAr$/);}for(const f of stale.feeders)if(f.rows.length)assert.deepEqual(f.rows,['— MW','— MVAr']);
  for(const t of on.transformers){assert.deepEqual(t.rows,['12.3 MW','4.5 MVAr','85.0 %   7 kademe']);assert.equal(t.ports.length,1);assert.equal(t.ports[0][0],'HV');}for(const t of stale.transformers)assert.deepEqual(t.rows,['— MW','— MVAr','— %   — kademe']);
 }
 assert.ok(rows.some(r=>r.frames[2].transformers.length));console.log('SLD minimal LF labels PASS: native signs, 2/3 rows, one winding summary, stale gates, voltage only at bars, identical ports/routes/names/page with LF on/off.');
}
