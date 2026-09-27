import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {parseDgs} from '../../src/importers/dgs/index';
import {catalogPage} from '../../src/importers/dgs/catalog';
import {mapCanonical} from '../../src/importers/dgs/canonical';
import {voltageBand,voltageMatches,allVoltageBands} from '../../src/domain/model/voltage-band';
import {ScenarioStore,emptyScenario} from '../../src/domain/scenario/overlay';
import {branchDelta,deltaSummary} from '../../src/domain/results/delta';
import {buildStationTopologyGraph,layoutStation,type StationSources} from '../../src/domain/model/station-topology';
import type {BranchResult} from '../../src/domain/results/types';
import {classLabel} from '../../src/domain/dgs-semantics/classes';
import {engineeringColumns,catalogCsv} from '../../src/ui/components/semantic-catalog';
const source=async()=>parseDgs(await readFile(new URL('../fixtures/small-dgs.json',import.meta.url),'utf8'),'small-dgs.json');
test('voltage buckets use source nominal values at every boundary, retaining unknowns only in all-band scope',()=>{
  assert.deepEqual([0,NaN,36,36.1,99.9,100,170,179.9,180,299.9,300,380,400].map(voltageBand),[null,null,'low','66','66','154','154','154','220','220','400','400','400']);
  assert.equal(voltageMatches(170,new Set(['154'])),true);assert.equal(voltageMatches(170,new Set(['220'])),false);
  assert.equal(voltageMatches(null,allVoltageBands()),true);assert.equal(voltageMatches(null,new Set()),false);
});
test('nine-terminal bus action is one history entry and revision; one undo restores the entire previous overlay',()=>{
  const store=new ScenarioStore();store.setStatus('lineStatus','line',false,true);const before=structuredClone(store.current),revision=store.revision,history=store.historyLength;
  const terminals=Array.from({length:9},(_,i)=>({id:`T${i}`,source:i!==8}));
  store.setBusStatus(terminals,false);assert.equal(store.historyLength,history+1);assert.equal(store.revision,revision+1);assert.equal(Object.keys(store.current.busOrTerminalStatus).length,8);
  store.undo();assert.deepEqual(store.current,before);assert.equal(store.historyLength,history);
  store.setBusStatus(terminals,true);store.setBusStatus(terminals,'source');assert.deepEqual(store.current.busOrTerminalStatus,{});
  store.restoreTerminals(['T8','other']);store.setBusStatus(terminals,'source');assert.deepEqual(store.current.restoredTerminals,['other']);store.undo();assert.deepEqual(store.current.restoredTerminals,['T8','other']);
});
test('catalog semantic context follows actual parent and cubicle references with voltage-band filtering',async()=>{
  const model=await source(),term=catalogPage(model,{className:'ElmTerm',search:'T154-PV'}).rows[0];
  assert.equal(term.context?.voltageKv,154);assert.equal(term.context?.sites[0].id,'S154');assert.equal(term.context?.groups[0].id,'G154');assert.ok(term.context!.connectedEquipmentCount!>0);
  const generator=catalogPage(model,{className:'ElmGenStat',voltageBands:['154']}).rows[0];assert.equal(generator.context?.voltageKv,154);assert.equal(generator.context?.terminals[0].id,'T154-PV');assert.equal(catalogPage(model,{className:'ElmGenStat',voltageBands:['400']}).total,0);
  const tr=catalogPage(model,{className:'ElmTr2'}).rows[0];assert.equal(tr.context?.voltageKv,400);assert.equal(tr.context?.lvKv,154);assert.ok(tr.context!.ratingMva!>0);
});
test('scenario delta retains Q and active/reactive losses without inventing missing branch data',()=>{
  const before={pf:10,qf:5,loading:95,pLoss:.2,qLoss:1} as BranchResult,after={...before,pf:13,qf:3,loading:105,pLoss:.5,qLoss:.4};
  const d=branchDelta(before,after);assert.equal(d.pMw,3);assert.equal(d.qMvar,-2);assert.equal(d.loading,10);assert.ok(Math.abs(d.pLoss!-.3)<1e-12);assert.equal(d.qLoss,-.6);
  assert.deepEqual(branchDelta(before,undefined),{pMw:null,qMvar:null,loading:null,pLoss:null,qLoss:null});
  const summary=deltaSummary([{baseBranch:before,branch:after}]);assert.equal(summary.newOverloads,1);assert.equal(summary.resolvedOverloads,0);assert.equal(summary.maxQ,2);assert.equal(summary.maxV,null);
});
test('station topology and busbar/feeder layout remain deterministic when source rows are reordered',async()=>{
  const model=await source(),network=mapCanonical(model,'small');const sources:StationSources={bays:catalogPage(model,{className:'ElmBay',siteId:'S154'}).rows,terminals:catalogPage(model,{className:'ElmTerm',siteId:'S154'}).rows,cubicles:catalogPage(model,{className:'StaCubic',siteId:'S154'}).rows,switches:catalogPage(model,{className:'ElmCoup',siteId:'S154'}).rows,substats:catalogPage(model,{className:'ElmSubstat',siteId:'S154'}).rows};
  const a=buildStationTopologyGraph(network,'S154',sources),b=buildStationTopologyGraph({...network,buses:[...network.buses].reverse(),lines:[...network.lines].reverse()},'S154',{...sources,bays:[...sources.bays].reverse(),terminals:[...sources.terminals].reverse()});
  assert.deepEqual(a,b);const layout=layoutStation(a,allVoltageBands());assert.ok(layout.sections.length);assert.ok(layout.feeders.length<=12);assert.ok(layout.sections.every(s=>s.x2>s.x1));assert.equal(layout.width,1240);assert.deepEqual(layout,layoutStation(b,allVoltageBands()));
});
test('engineering and technical CSV keep name-first presentation and lossless raw/context fields',async()=>{
  const model=await source(),page=catalogPage(model,{className:'ElmTerm',pageSize:1}),columns=engineeringColumns('ElmTerm',page.attributes),technical=catalogCsv(page.rows,'ElmTerm',page.attributes,true,columns),engineering=catalogCsv(page.rows,'ElmTerm',page.attributes,false,columns);
  const header=technical.split('\r\n')[0].split(';').map(h=>h.replaceAll('"','').replace('\uFEFF',''));assert.equal(header.filter(h=>h==='FID').length,1);assert.ok(header.includes('fold_id'));assert.ok(header.includes('sourceReferences'));assert.ok(technical.includes('ElmSubstat'));
  assert.ok(engineering.startsWith('\uFEFF"Ekipman";"Teknik kimlik";"Nominal gerilim (kV)"'));assert.ok(classLabel('UnknownClass').includes('Diğer / Teknik Veri (UnknownClass)'));
});
