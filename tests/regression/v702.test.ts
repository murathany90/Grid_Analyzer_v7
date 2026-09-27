import assert from 'node:assert/strict';
import test from 'node:test';
import {zipSync,strToU8} from 'fflate';
import {ScenarioStore,emptyScenario,scenarioChanged,scenarioSignature,calculationScenario} from '../../src/domain/scenario/overlay';
import {applyEnergization,type EnergizationPlan} from '../../src/topology/energization';
import {csvCell,csvDocument} from '../../src/ui/components/dom';
import {catalogCsv} from '../../src/ui/components/semantic-catalog';
import {aggregateStationVoltages,flowMagnitude,flowScale,branchMapDelta,stationVoltageDeltas} from '../../src/map/electrical-overlays';
import type {BusResult,BranchResult} from '../../src/domain/results/types';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
import {layoutStation,feederSwitchPaths,stationTerminalLinks,type StationTopologyGraph} from '../../src/domain/model/station-topology';
import {fullDiagramClone} from '../../src/features/sld/sld-renderer';
import {inspectModelFile} from '../../src/importers/model-file';

test('energization rollback and undo are atomic, preserve prior and later explicit edits, and shared prerequisites',()=>{
  const plan:EnergizationPlan={lineId:'H123',ready:true,restoredTerminals:['T1','T2'],closeSwitches:['C1','C2'],paths:[['T1','B1'],['T2','B2']],blockers:[]};
  const store=new ScenarioStore();store.setStatus('switchState','prior',true,false);const before=structuredClone(store.current),revision=store.revision;
  store.replace(applyEnergization(store.current,plan));assert.equal(store.revision,revision+1);store.undo();assert.deepEqual(store.current,before);
  store.replace(applyEnergization(store.current,plan));store.setStatus('lineStatus','H123',false,false);
  assert.deepEqual(store.current.switchState,before.switchState);assert.deepEqual(store.current.restoredTerminals,[]);assert.deepEqual(store.current.lineStatus,{});
  store.replace(applyEnergization(store.current,plan));store.setStatus('switchState','C2',true,false);
  const persisted=new ScenarioStore();persisted.replace(JSON.parse(JSON.stringify(store.current)));persisted.setStatus('lineStatus','H123',false,false);
  assert.deepEqual(persisted.current.switchState,{prior:true,C2:true});assert.deepEqual(persisted.current.restoredTerminals,[]);
  const priorRestore=new ScenarioStore();priorRestore.replace({...emptyScenario(),restoredTerminals:['T1'],busOrTerminalStatus:{T1:false}});priorRestore.replace(applyEnergization(priorRestore.current,plan));priorRestore.setStatus('lineStatus','H123',false,false);assert.deepEqual(priorRestore.current.restoredTerminals,['T1']);assert.equal(priorRestore.current.busOrTerminalStatus.T1,false);
  const shared=new ScenarioStore();shared.replace(applyEnergization(shared.current,plan));shared.replace(applyEnergization(shared.current,{...plan,lineId:'H124',restoredTerminals:[],closeSwitches:[]}));
  shared.setStatus('lineStatus','H123',false,false);assert.equal(shared.current.switchState.C1,true);assert.deepEqual(shared.current.restoredTerminals,['T1','T2']);
  shared.setStatus('lineStatus','H124',false,false);assert.equal(scenarioChanged(shared.current),false);assert.equal(scenarioSignature(shared.current),scenarioSignature(emptyScenario()));
});
test('explicit calculation role uses empty base while preserving and isolating the active scenario',()=>{
  const store=new ScenarioStore();store.setStatus('lineStatus','L1',false,true);const snapshot=structuredClone(store.current);
  const base=calculationScenario(store.current,'base'),scenario=calculationScenario(store.current,'scenario');
  assert.deepEqual(base,emptyScenario());assert.deepEqual(scenario,snapshot);assert.notEqual(scenario,store.current);assert.deepEqual(store.current,snapshot);
  assert.notEqual(scenarioSignature(base),scenarioSignature(scenario));
});
test('typed engineering/raw CSV uses deterministic Turkish decimals, BOM/sep and formula guards',()=>{
  const values=[12.3,.9765,-13.52,154];assert.deepEqual(values.map(csvCell),['"12,3"','"0,9765"','"-13,52"','"154"']);
  assert.equal(csvCell(NaN),'""');assert.equal(csvCell(Infinity),'""');assert.equal(csvCell(1.23e-8),'"1,23e-8"');
  for(const text of ['=1+1','+CMD','@SUM(A1)','-1+2','\t=1','\ufeff@A1','\u0000-2'])assert.ok(csvCell(text).startsWith('"\''));
  assert.equal(csvDocument([values]),'\uFEFFsep=;\r\n"12,3";"0,9765";"-13,52";"154"');
  const row={id:'T',name:'Bara',siteIds:[],attributes:{uknom:12.3}},columns=[{key:'uknom',label:'Nominal gerilim'}];
  for(const raw of [false,true]){const csv=catalogCsv([row],'ElmTerm',['uknom'],raw,columns);assert.ok(csv.startsWith('\uFEFFsep=;\r\n'));assert.ok(csv.includes('"12,3"'));assert.ok(!csv.includes('"12.3"'));}
});
test('P/Q magnitude and V station aggregation respect missing values, voltage filters and terminal identity',()=>{
  const branch={pf:-221.8,pt:222,qf:-13.52,qt:20,loading:80} as BranchResult;
  assert.equal(flowMagnitude(branch,'p'),222);assert.equal(flowMagnitude(branch,'q'),20);assert.equal(flowMagnitude({...branch,qt:NaN},'q'),null);assert.equal(flowMagnitude(undefined,'p'),null);assert.ok(flowScale([branch,undefined],'p')>0);
  assert.equal(branchMapDelta(branch,{...branch,qf:1.48},'q'),15);assert.equal(branchMapDelta(undefined,branch,'p'),null);
  const bus=(id:string,kv:number,vm:number):BusResult=>({id,name:id,terms:[id],siteIds:['TM'],vnKv:kv,vmPu:vm,angleRad:.1,pMw:0,qMvar:0});
  const rows=[bus('154 B-1',154,1.012),bus('154 B-2',154,.976),bus('400 B',400,.92),bus('unknown',154,NaN)];
  const filtered=aggregateStationVoltages(rows,new Set(['154'])).get('TM')!;assert.equal(filtered.count,2);assert.equal(filtered.groups[0].min,.976);assert.equal(filtered.groups[0].max,1.012);assert.equal(filtered.worst.name,'154 B-2');assert.equal(filtered.worst.vnKv*filtered.worst.vmPu,150.304);
  assert.equal(aggregateStationVoltages(rows,allVoltageBands()).get('TM')?.worst.name,'400 B');
  assert.equal(stationVoltageDeltas(rows,[{...rows[1],vmPu:.966}],allVoltageBands()).get('TM')!<0,true);assert.equal(stationVoltageDeltas(rows,[{...rows[1],terms:['new']}],allVoltageBands()).size,0);
});
test('full SVG export clones the logical fit box without mutating a panned/zoomed live viewport',()=>{
  const attrs=new Map([['viewBox','266 24 708 635']]);
  const root={style:{width:'100%',height:'60vh'},setAttribute(k:string,v:string){attrs.set(k,v);},getAttribute(k:string){return attrs.get(k);},cloneNode(){const copied=new Map(attrs);return{style:{...this.style},setAttribute(k:string,v:string){copied.set(k,v);},getAttribute(k:string){return copied.get(k);}};}};
  const clone=fullDiagramClone(root as unknown as SVGSVGElement,[0,0,2600,1800]);assert.equal(clone.getAttribute('viewBox'),'0 0 2600 1800');assert.equal(clone.getAttribute('width'),'2600');assert.equal(clone.getAttribute('height'),'1800');assert.equal(attrs.get('viewBox'),'266 24 708 635');assert.equal(root.style.height,'60vh');
});
test('full station keeps 23/34 feeders and every voltage level, with actual selector switch paths',()=>{
  const levels=[400,154,31.5,6.3],graph:StationTopologyGraph={siteId:'TM',busSections:levels.map(kv=>({id:'B'+kv,name:'B'+kv,voltageKv:kv,groupId:'G',groupName:'G',inService:true})),feeders:[],terminals:[],switches:[],equipment:[],voltageLevels:levels,sourceFeederCount:34,unresolvedEndpoints:0};
  graph.feeders=Array.from({length:34},(_,i)=>({id:'F'+i,name:'Fider '+i,sourceClass:'ElmBay',voltageKv:levels[i%4],terminalIds:['B'+levels[i%4],'T'+i],busSectionIds:['B'+levels[i%4]],switchIds:[],equipmentKeys:[]}));
  for(const count of [23,34]){const layout=layoutStation({...graph,feeders:graph.feeders.slice(0,count)},allVoltageBands());assert.equal(layout.feeders.length,count);assert.deepEqual(layout.levels.map(l=>l.kv),levels);assert.equal(layout.omitted,0);assert.ok(layout.width>=1200);assert.ok(layout.feeders.every(p=>p.x<layout.width&&p.y<layout.height));}
  const feeder={...graph.feeders[0],busSectionIds:['B1','B2'],terminalIds:['B1','B2','J','T'],switchIds:['I1','I2','C'],equipmentKeys:['ElmLne|H']};
  graph.switches=[{id:'I1',from:'B1',to:'J',kind:'isolator',bayId:'F0'},{id:'I2',from:'B2',to:'J',kind:'isolator',bayId:'F0'},{id:'C',from:'J',to:'T',kind:'breaker',bayId:'F0'}];graph.equipment=[{id:'H',name:'Hat',sourceClass:'ElmLne',terminals:['T','remote'],kind:'line'}];
  assert.deepEqual(feederSwitchPaths(graph,feeder),[{busId:'B1',switchIds:['I1','C']},{busId:'B2',switchIds:['I2','C']}]);
  const terminal={id:'J15',vnKv:15,inService:true} as import('../../src/domain/model/network').Bus;
  const sharedGraph={...graph,busSections:[],voltageLevels:[15],terminals:[terminal],equipment:[{id:'G',name:'Generator',sourceClass:'ElmSym',kind:'generator',terminals:['J15']},{id:'TR',name:'Transformer',sourceClass:'ElmTr2',kind:'transformer',terminals:['remote','J15']}],feeders:[{...feeder,id:'GF',voltageKv:15,terminalIds:['J15'],equipmentKeys:['ElmSym|G']},{...feeder,id:'TF',voltageKv:15,terminalIds:['J15'],equipmentKeys:['ElmTr2|TR']}]};
  const links=stationTerminalLinks(sharedGraph,layoutStation(sharedGraph,allVoltageBands()));assert.equal(links.length,1);assert.equal(links[0].terminal.id,'J15');assert.equal(links[0].points.length,2);
  assert.deepEqual(stationTerminalLinks({...sharedGraph,terminals:[]},layoutStation(sharedGraph,allVoltageBands())),[]);

});
test('browser ZIP loader accepts JSON, single/multiple JSON ZIP and rejects corruption, traversal and bombs',async()=>{
  const plain=new File(['{"ElmTerm":{}}'],'model.json',{type:'application/json'}),direct=await inspectModelFile(plain);assert.equal(await direct.extract(direct.entries[0]),plain);
  for(const names of [['one.json'],['one.json','folder/two.json']]){const payload=Object.fromEntries(names.map(name=>[name,strToU8('{"name":"'+name+'"}')]));payload['ignore.txt']=strToU8('ignore');const archive=await inspectModelFile(new File([zipSync(payload)],'models.zip'));assert.equal(archive.entries.length,names.length);const selected=archive.entries.at(-1)!;assert.equal(JSON.parse(await (await archive.extract(selected)).text()).name,selected.name);}
  await assert.rejects(inspectModelFile(new File(['broken'],'bad.zip')),/ZIP okunamadı/);
  await assert.rejects(inspectModelFile(new File([zipSync({'../model.json':strToU8('{}')})],'unsafe.zip')),/güvensiz/);
  await assert.rejects(inspectModelFile(new File([zipSync({'bomb.json':new Uint8Array(2*1024*1024)})],'bomb.zip')),/güvenlik/);
  const bytes=zipSync({'model.json':strToU8('{"x":1}')},{level:0});bytes[30+'model.json'.length]^=1;const corrupt=await inspectModelFile(new File([bytes],'corrupt.zip'));await assert.rejects(corrupt.extract(corrupt.entries[0]),/CRC/);
});
