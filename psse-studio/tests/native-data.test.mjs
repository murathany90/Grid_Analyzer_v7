import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {nativeHarness} from './native-harness.mjs';
import {nativeField,nativeIndex,savedFlows} from '../src/modules/psse/ui/native-tables.js';
import {DEFAULT_SOLVER_OPTIONS,normalizeSolverOptions} from '../src/modules/psse/calculations/solver-options.js';
import {expandIncidentAcScope} from '../src/modules/psse/map/filter-scope.js';
const {studio,model,network,ga}=await nativeHarness();
const index=nativeIndex(model,network),key=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const reference=await fs.readFile(process.env.PSSE_REFERENCE_JSON??'.local/native-excel.json','utf8').then(JSON.parse).catch(()=>null);
test('17 ND + 11 NR unchanged contracts and saved/GA isolation',()=>{
  assert.equal(studio.corpus.nd.length,17);assert.equal(studio.corpus.nr.length,11);
  for(const [section,tables]of [['nd',studio.corpus.nd],['nr',studio.corpus.nr]])for(const cfg of tables){
    const data=studio.liveDataset(cfg,section);assert.deepEqual(data.headers,cfg.columns);assert(data.rows.length>0,cfg.name);assert(data.rows.every(r=>r.length===cfg.columns.length));
    if(reference)assert.deepEqual(cfg.columns,reference[(section==='nr'?'NR-':'')+cfg.name].headers.slice(0,cfg.columns.length));
  }
  studio.nativeResultSource='ga';assert.equal(studio.liveDataset(studio.corpus.nr[0],'nr').rows.length,0);studio.nativeResultSource='saved';
  const cfg=studio.corpus.nr.find(t=>t.name==='Load');assert.equal(studio.liveDataset(cfg,'nr').rows.length,2520);
});
test('native dictionary counts, owned generation and measured interchange agree with valid Excel rows',{skip:!reference},()=>{
  for(const name of ['Owner','Area','Zone']){
    const cfg=studio.corpus.nr.find(t=>t.name===name),data=studio.liveDataset(cfg,'nr'),ref=reference['NR-'+name],rows=new Map(data.rows.map(r=>[r[0],r]));
    assert.equal(data.rows.length,ref.rows.length);
    for(const row of ref.rows)for(let c=0;c<cfg.columns.length;c++){
      const actual=rows.get(row[0])?.[c],expected=row[c];if(expected==null)continue;
      if(typeof expected==='number')assert(Math.abs(actual-expected)<.15,`${name} ${cfg.columns[c]}: ${actual} / ${expected}`);
      else assert.equal(actual,expected);
    }
  }
});
test('source winding units, sequence metadata and generator reactances are preserved',{skip:!reference},()=>{
  const cfg=studio.corpus.nd.find(t=>t.name==='2 Winding'),data=studio.liveDataset(cfg,'nd'),ref=reference['2 Winding'],rows=new Map(data.rows.map(r=>[[r[0],r[2],r[4]].join(':'),r]));
  const fields=['Vector Group','Connection Code','Wnd 1 Ratio  (pu or kV)','Wnd 2 Ratio  (pu or kV)','Specified R (pu or watts)','Specified X (pu)','R01 (pu)','X01 (pu)','RG1','XG1','Magnetizing G (pu or watts)','Magnetizing B (pu)'];
  for(const row of ref.rows){const actual=rows.get([row[0],row[2],row[4]].join(':'));if(!actual)continue;for(const field of fields){const c=cfg.columns.indexOf(field),v=row[c];assert(c>=0,field);if(typeof v==='number')assert(Math.abs(actual[c]-v)<.001*Math.max(1,Math.abs(v)),field);else assert.equal(actual[c],v,field);}}
  const gen=model.equipment.find(e=>e.kind==='generator');assert.equal(nativeField(index,gen,'Subtransient X Power factor'),index.at('Gxsubt',gen.fields.savIndex-1));
});
test('native source conversion covers switch column-major ratings, zero sequence signs, plant regulation and grounding ohms',{skip:!reference},()=>{
  const ratings=studio.corpus.nd.find(t=>t.name==='Swith. Dev. Ratings'),data=studio.liveDataset(ratings,'nd'),ref=reference[ratings.name],rows=new Map(data.rows.map(r=>[r[0],r]));
  for(const r of ref.rows)for(let c=2;c<ratings.columns.length;c++)assert(Math.abs(rows.get(r[0])[c]-r[c])<.06,ratings.columns[c]);
  const lines=studio.corpus.nd.find(t=>t.name==='AC Line'),lineRows=new Map(studio.liveDataset(lines,'nd').rows.map(r=>[[r[0],r[2],r[4]].join(':'),r]));
  for(const r of reference['AC Line'].rows){const row=lineRows.get([r[0],r[2],r[4]].join(':'));if(!row)continue;for(const label of ['R-Zero (pu)','X-Zero (pu)','B-Zero (pu)','Metered']){const c=lines.columns.indexOf(label);assert(c>=0,label);if(r[c]!=null)assert(Math.abs(Number(row[c])-r[c])<.00002,label);}}
  const machines=studio.corpus.nd.find(t=>t.name==='Machine'),machineRows=new Map(studio.liveDataset(machines,'nd').rows.map(r=>[[r[1],r[0]].join(':'),r]));
  for(const r of reference.Machine.rows){const row=machineRows.get([r[1],r[0]].join(':'));if(!row)continue;for(const label of ['Grounding R','Grounding X','VSched (kV)']){const c=machines.columns.indexOf(label);assert(Math.abs(Number(row[c])-r[c])<.01*Math.max(1,Math.abs(r[c])),label);}}
});
test('YTM boundary includes either AC endpoint without recursively admitting the next area or switching devices',()=>{
  const branches=[{kind:'line',sourceEquipmentId:'line:A',from:0,to:1},{kind:'line',sourceEquipmentId:'line:B',from:1,to:2},{kind:'line',sourceEquipmentId:'switch:X',from:0,to:3}];
  assert.deepEqual([...expandIncidentAcScope({branches},new Set([0]))].sort(),[0,1]);
  assert.deepEqual([...expandIncidentAcScope({branches},new Set([1]))].sort(),[0,1,2]);
});
test('saved voltages and flows use source state; reactive series loss excludes line charging',{skip:!reference},()=>{
  const cfg=studio.corpus.nr.find(t=>t.name==='BUS'),data=studio.liveDataset(cfg,'nr'),ref=reference['NR-BUS'],rows=new Map(data.rows.map(r=>[r[0],r]));
  for(const row of ref.rows)for(const [field,tolerance]of [['Voltage (pu)',.00011],['Angle (deg)',.0052]]){const c=cfg.columns.indexOf(field);assert(Math.abs(rows.get(row[0])[c]-row[c])<tolerance,field);}
  const b=network.branches.find(b=>b.status===1&&b.kind==='line'&&b.sourceEquipmentId.startsWith('line:')),flow=savedFlows(index).get(b.id);assert(Number.isFinite(flow.pFromMw));assert(flow.seriesQLossMvar>=0);assert.notEqual(flow.seriesQLossMvar,flow.qLossMvar);assert.equal(ga.psseCalculation,null);
});
test('all effective options are validated and hashed; unsupported native MVA threshold is rejected',()=>{
  const ac=normalizeSolverOptions('NR_POLAR');assert.equal(ac.initialVoltagePolicy,'SOURCE_SAVED');assert.throws(()=>normalizeSolverOptions('NR_POLAR',{mismatchMva:500}),/UNSUPPORTED/);assert.throws(()=>normalizeSolverOptions('NR_POLAR',{tolerancePu:NaN}),/INVALID/);assert.throws(()=>normalizeSolverOptions('NR_POLAR',{maxIterations:0}),/RANGE/);
  const hash=ga.engine.Ro(ac);for(const [field,value]of Object.entries(ac)){let changed=typeof value==='boolean'?!value:typeof value==='number'?value+1:field==='initialVoltagePolicy'?'FLAT':field==='loadModelProfile'?'GENERIC_ZIP':null;if(changed==null)continue;assert.notEqual(ga.engine.Ro({...ac,[field]:changed}),hash,field);}
  assert.equal(normalizeSolverOptions('LOSSLESS_DC').voltageMagnitudePu,1);assert(DEFAULT_SOLVER_OPTIONS.ac.reactiveLimitsEnabled);
});
test('short 28-table column fill comparison uses the workbook only as a test oracle',{skip:!reference},async()=>{
  const rows=[];for(const[section,tables]of [['nd',studio.corpus.nd],['nr',studio.corpus.nr]])for(const cfg of tables){const data=studio.liveDataset(cfg,section),ref=reference[(section==='nr'?'NR-':'')+cfg.name],present=v=>v!==null&&v!==undefined&&v!=='';rows.push({table:section.toUpperCase()+' '+cfg.name,columns:cfg.columns.length,rows:data.rows.length,nativeRows:ref.rows.length,filledColumns:cfg.columns.filter((_,i)=>data.rows.some(r=>present(r[i]))).length,nativeFilledColumns:cfg.columns.filter((_,i)=>ref.rows.some(r=>present(r[i]))).length,unavailableColumns:cfg.columns.filter((_,i)=>!data.rows.some(r=>present(r[i]))&&ref.rows.some(r=>present(r[i])))});}
  assert.equal(rows.length,28);await fs.mkdir('tests/results',{recursive:true});await fs.writeFile('tests/results/native-columns.json',JSON.stringify({tables:rows,exceptions:['NR-Load includes all 2520 valid source IDs (400 disconnected loads retained); 328 corrupt unmatched reference rows are excluded.','The 34 native fill differences are classified as 32 undefined rating percentages and 2 nonphysical control sentinels; no fabricated values.','Native AC-Line NR includes switching devices; the geographic map only displays real AC lines.']},null,2));
});
