import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
import {nativeHarness} from './native-harness.mjs';
import {zipParts} from '../src/shared/export/archive.js';
import {comparisonCsv} from '../src/shared/export/csv.js';
import {loadResultValues} from '../src/modules/psse/model/native-results.js';
import {equipmentKindLabel} from '../src/modules/psse/model/equipment-kind.js';
const {studio,model,network}=await nativeHarness();
const reference=await fs.readFile(process.env.PSSE_REFERENCE_JSON??'.local/native-excel.json','utf8').then(JSON.parse).catch(()=>null);
test('all 8669 solver branches retain their physical equipment labels',()=>{
  const equipment=new Map(model.equipment.map(e=>[e.id,e])),counts={};for(const branch of network.branches){const label=equipmentKindLabel(equipment.get(branch.sourceEquipmentId));counts[label]=(counts[label]??0)+1;}assert.deepEqual(counts,{Hat:2403,Anahtarlama:2563,Trafo:3703});
});
test('NR Load retains every valid source ID, including disconnected and inactive loads',()=>{
  const cfg=studio.corpus.nr.find(t=>t.name==='Load'),data=studio.liveDataset(cfg,'nr'),bus=cfg.columns.indexOf('Bus  Number'),id=cfg.columns.indexOf('Id');assert(bus>=0&&id>=0);
  const keys=new Set(data.rows.map(r=>[r[bus],r[id]].join('|'))),sources=model.equipment.filter(e=>e.kind==='load');assert.equal(keys.size,2520);assert.equal(data.rows.length,sources.length);
  for(const source of sources)assert(keys.has([source.fields.ibus,source.fields.loadid].join('|')),source.id);
  const inactive={status:0,pMw:10,qMvar:2,ipMw:3,iqMvar:1,ypMw:4,yqMvar:1};assert.equal(loadResultValues(inactive,null).totalinserviceactualmva,0);assert.equal(loadResultValues(inactive,null).nominalmva,Math.hypot(10,2));
});
test('native NR Load unmatched rows are rejected by identity; 400 disconnected source loads remain reportable',{skip:!reference},()=>{
  const native=reference['NR-Load'],sources=new Map(model.equipment.filter(e=>e.kind==='load').map(e=>[[e.fields.ibus,String(e.fields.loadid).trim()].join('|'),e])),seen=new Set();let unmatched=0;
  for(const row of native.rows){const id=[row[0],String(row[2]).trim()].join('|');if(sources.has(id))seen.add(id);else unmatched++;}
  assert.equal(unmatched,328);assert.equal(seen.size,2120);const disconnected=[...sources].filter(([id])=>!seen.has(id));assert.equal(disconnected.length,400);for(const [,e]of disconnected){assert.equal(e.fields.stat,0);assert.equal(studio.busAt(e.fields.ibus).fields.ide,4);}
});
test('34 native fill differences have explicit source reasons, not invented percentages',{skip:!reference},()=>{
  const native=reference;let rated=0,sentinel=0;
  for(const name of ['AC Line','2 Winding']){const cfg=studio.corpus.nr.find(t=>t.name===name),data=studio.liveDataset(cfg,'nr'),ref=native['NR-'+name];let count=0;for(let i=0;i<cfg.columns.length;i++)if(!data.rows.some(r=>r[i]!=null&&r[i]!=='')&&ref.rows.some(r=>r[i]!=null&&r[i]!=='')){count++;const reason=data.availability[i]?.code;assert(reason,cfg.columns[i]);if(reason==='ZERO_RATE')rated++;if(reason==='NATIVE_CONTROL_SENTINEL'){sentinel++;assert(ref.rows.every(r=>r[i]===-2));}}assert.equal(count,name==='AC Line'?14:20);}
  assert.equal(rated,32);assert.equal(sentinel,2);
});
test('CSV round-trips P/Q and small deltas without display rounding',()=>{
  const values=[8.99831451847458,8.998326301574707,Math.abs(8.99831451847458-8.998326301574707),-16.140851670342244,1e-17,0],csv=comparisonCsv(values.map((_,i)=>'v'+i),[values]),fields=csv.split('\r\n')[1].split(';').map(v=>Number(v.slice(1,-1).replace(',','.')));assert.deepEqual(fields,values);assert(fields[2]>0&&fields[2]<.0001);assert(comparisonCsv(['Name'],[['=SUM(1,2)']]).includes('\t=SUM'));
});
test('full native workbook uses DEFLATE and preserves every XML part and style',async()=>{
  const sheets=[...studio.corpus.nd.map(cfg=>[cfg.name,cfg.columns,studio.liveDataset(cfg,'nd').rows]),...studio.corpus.nr.map(cfg=>['NR-'+cfg.name,cfg.columns,studio.liveDataset(cfg,'nr').rows])];
  const stored=await studio.makeWorkbook(sheets,{level:0}).arrayBuffer(),compressed=await studio.makeWorkbook(sheets).arrayBuffer(),before=unzipSync(new Uint8Array(stored)),after=unzipSync(new Uint8Array(compressed));assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort());
  for(const name of Object.keys(before))assert.equal(Buffer.compare(Buffer.from(before[name]),Buffer.from(after[name])),0,name);
  assert(compressed.byteLength<stored.byteLength*.2);assert(strFromU8(after['xl/workbook.xml']).includes('NR-Load'));assert(after['xl/styles.xml']);
  console.log('XLSX bytes',stored.byteLength,'→',compressed.byteLength,'28 native sheets, all XML identical');
});
test('XLSX aborts rather than mixing SAV and GA sheets when source changes during export',async()=>{
  const timer=studio.window.setTimeout,notice=studio.notice,download=studio.download;let message='',downloads=0;
  studio.window.setTimeout=fn=>{studio.nativeResultSource='ga';fn();};studio.notice=s=>message=s;studio.download=()=>downloads++;
  try{await studio.exportXlsx();assert.equal(downloads,0);assert(message.includes('kaynağı değişti'));assert.equal(studio.exportingXlsx,false);}
  finally{studio.nativeResultSource='saved';studio.window.setTimeout=timer;studio.notice=notice;studio.download=download;}
});

