import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {analysisUiFixture} from '../helpers/analysis-ui';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {loadBenchmark} from '../../src/importers/powerfactory-benchmark';
import {ScenarioStore} from '../../src/domain/scenario/overlay';
import {compactScRows} from '../../src/features/analysis/compact-rows';
import {buildBenchmarkMapData} from '../../src/domain/benchmark/map-layer';
import {equipmentCard} from '../../src/map/equipment-tooltip';
import {placeScPopup} from '../../src/map/sc-bus-popup';

test('PF TM maximum keeps its actual source cell when its display alias has another current',async()=>{
 const pair=syntheticBenchmarkPair(true,true),loaded=await loadBenchmarkModel(pair.model),{ctx}=analysisUiFixture(),n=loaded.network;
 ctx.network={...n,buses:[{...n.buses[0],usage:0,siteIds:['S0']},{...n.buses[1],vnKv:100,usage:2,siteIds:['S0']},{...n.buses[0],id:'SYN-B2',sourceId:'SYN-B2',usage:0,name:'Independent low bus',siteIds:['S0']}]};ctx.scenario=new ScenarioStore(n.modelHash);ctx.filters.areaId='';ctx.filters.siteId='';ctx.scResult=null;ctx.ytmStudy=null;ctx.benchmark=await loadBenchmark(pair.benchmark);ctx.resultView={...ctx.resultView,source:'PF',analysis:'SC',scNodeKind:''};
 const table=ctx.benchmark.groups.SC.tables.SC_BusResults_Raw;table.rows.push([...table.rows[0]]);table.rowNumbers.push(6);
 const set=(row:number,key:string,value:any)=>{const i=table.headers.indexOf(key);assert.ok(i>=0,key);table.rows[row][i]=value;};
 for(const [i,fid,key,ka] of [[0,'SYN-B0','HIGH',1],[1,'SYN-B1','HIGH',6],[2,'SYN-B2','LOW',3]] as const){set(i,'physicalTerminalFid',fid);set(i,'electricalBusKey',key);set(i,'nominalKv',100);set(i,'ikssKa',ka);}
 const rows=compactScRows(ctx,'PF');assert.equal(rows.length,2);const high=rows.find(r=>r.key==='HIGH')!;assert.equal(high.fid,'SYN-B1');assert.equal(high.raw.displayFid,'SYN-B0');assert.equal(high.metrics.ikss.pf,6);
 const selection={analysis:'SC' as const,source:'PF' as const,metric:'ikss3FKa',table:'SC_BusResults_Raw',scMode:'MAX' as const,nodeKind:''};ctx.benchmarkMap=selection;
 const max=buildBenchmarkMapData(ctx,selection).sites.get('S0')!;assert.equal(max.value,6);assert.equal(max.representativeFid,'SYN-B0');assert.equal(max.sourceFaultFid,'SYN-B1');assert.equal(max.sourceCellKey,high.raw.sourceCellKey);assert.notEqual(max.sourceCellKey,rows.find(r=>r.key==='LOW')!.raw.sourceCellKey);
 const card=equipmentCard(ctx,ctx.network.sites[0]);assert.deepEqual(card.rows[0],['6,000','SYN-B1','100']);assert.equal(card.sourceCellKey,max.sourceCellKey);assert.deepEqual(table.rows.map(r=>r[table.headers.indexOf('ikssKa')]),[1,6,3]);
 // Reverse the input so the low bus is encountered first: maximum replacement must
 // move the entire source tuple, while keeping the high bus's physical display alias.
 const reversed={...table,rows:[...table.rows].reverse(),rowNumbers:[...table.rowNumbers].reverse()};
 ctx.benchmark={...ctx.benchmark,groups:{...ctx.benchmark.groups,SC:{...ctx.benchmark.groups.SC,tables:{...ctx.benchmark.groups.SC.tables,SC_BusResults_Raw:reversed}}}};
 const replacement=buildBenchmarkMapData(ctx,selection).sites.get('S0')!;assert.equal(replacement.value,6);assert.equal(replacement.sourceFaultFid,'SYN-B1');assert.equal(replacement.displayFid,'SYN-B0');assert.equal(replacement.sourceCellKey,max.sourceCellKey);
});
test('popup placement stays inside the map and outside the result panel and legend',()=>{
 const obstacles=[{left:700,top:8,width:640,height:500},{left:8,top:350,width:230,height:180}];
 for(const anchor of [{x:800,y:240},{x:10,y:10},{x:400,y:480}]){const p=placeScPopup(anchor,{width:310,height:170},{width:1350,height:540},obstacles)!;assert.ok(p);assert.ok(p.left>=8&&p.top>=8&&p.left+310<=1342&&p.top+170<=532);for(const r of obstacles)assert.ok(p.left+310<=r.left||p.left>=r.left+r.width||p.top+170<=r.top||p.top>=r.top+r.height);}
});

test('popup uses the gap between selection and legend at desktop 125 percent zoom',()=>{
 const obstacles=[{left:8.8,top:246.5,width:245,height:217.6},{left:8.8,top:8.8,width:258.2,height:30.4},{left:412.3,top:7.8,width:638.9,height:396.4}];
 const p=placeScPopup({x:540,y:300},{width:310,height:175},{width:1059,height:472},obstacles)!;assert.ok(p);assert.ok(p.left+310<412.3&&p.top>39.2&&p.top+175<246.5);
});
