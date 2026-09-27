import assert from 'node:assert/strict';
import test from 'node:test';
import {sortResultRows,resultColumns,busVoltageKv,type ResultRow} from '../../src/features/analysis/result-columns';
import {mapDetailText} from '../../src/map/detail-text';
import {deltaColor,deltaMaximum,signedValue} from '../../src/map/delta-style';
import {lineStyle} from '../../src/map/result-style';
import {defaultSettings,SettingsStore} from '../../src/persistence/settings';
import type {BranchResult,BusResult} from '../../src/domain/results/types';
import type {Line} from '../../src/domain/model/network';

const branch=(pf:number,loading:number|null):BranchResult=>({pf,qf:pf/2,pt:-pf,qt:-pf/2,loading,pLoss:1,qLoss:2} as BranchResult);
const row=(id:string,pf:number,loading:number|null):ResultRow=>({id,name:id,cls:'ElmLne',vnKv:154,siteIds:[],source:true,on:true,terms:[],state:'Serviste',branch:branch(pf,loading)});
test('result headers sort complete filtered data numerically, absolute P/Q, missing last in either direction',()=>{
  const rows=[row('a',-900,2),row('b',500,100),row('c',-100,10),row('missing',NaN,null)];
  for(const key of ['p','q','pt','qt']){
    assert.deepEqual(sortResultRows(rows,key,true).map(r=>r.id),['a','b','c','missing']);
    assert.deepEqual(sortResultRows(rows,key,false).map(r=>r.id),['c','b','a','missing']);
  }
  assert.deepEqual(sortResultRows(rows,'loading',true).map(r=>r.id),['b','c','a','missing']);
  assert.deepEqual(sortResultRows(rows,'loading',false).map(r=>r.id),['a','c','b','missing']);
  const many=Array.from({length:35},(_,i)=>row(String(i),i,i));
  assert.deepEqual(sortResultRows(many.filter(r=>r.branch!.pf>=5),'loading',true).slice(0,14).map(r=>r.branch!.loading),Array.from({length:14},(_,i)=>34-i));
  for(const kind of ['line','trafo','bus'] as const)for(const tab of ['results','delta','energize'] as const){const columns=resultColumns(kind,tab);assert.equal(columns.reduce((sum,c)=>sum+c.width,0),100);assert.ok(columns.every(c=>c.metrics.length||c.label==='İşlem'));}
  const keys=resultColumns('line','results').flatMap(c=>c.metrics.map(m=>m.key));assert.deepEqual(keys,['name','voltage','p','q','pt','qt','pLoss','qLoss','loading','state']);
  assert.ok(sortResultRows([{...rows[0],name:'İzmir'},{...rows[1],name:'Çorum'}],'name',false)[0].name==='Çorum');
});
test('bus actual kV uses result nominal voltage times finite pu and remains sortable without fake zero',()=>{
  const bus={vnKv:154,vmPu:1.03564} as BusResult;assert.ok(Math.abs(busVoltageKv(bus)!-159.48856)<1e-8);
  assert.equal(busVoltageKv(undefined),null);assert.equal(busVoltageKv({...bus,vmPu:NaN}),null);
  assert.equal(busVoltageKv({...bus,vmPu:null as unknown as number}),null);
  const rows=[{...row('low',0,0),bus:{...bus,vmPu:.98}},{...row('high',0,0),bus},{...row('none',0,0)}];
  assert.deepEqual(sortResultRows(rows,'vKv',true).map(r=>r.id),['high','low','none']);
  assert.deepEqual(sortResultRows(rows,'v',false).map(r=>r.id),['low','high','none']);
});
test('map hover and selection text follow loading, delta Q/loading/V and nominal modes exactly',()=>{
  const line={id:'H',name:'Hat',sourceClass:'ElmLne',vnKv:154,inService:true} as Line,settings=defaultSettings(),data={settings,names:['A TM','B TM'],inService:false,row:branch(500,70),base:branch(400,40)};
  settings.displayMode='loading';assert.match(mapDetailText(line,data),/Yüklenme 70 %/);assert.doesNotMatch(mapDetailText(line,data),/A P|B P/);
  settings.displayMode='delta';settings.deltaMetric='q';assert.match(mapDetailText(line,data),/ΔQ \+50 MVAr/);assert.doesNotMatch(mapDetailText(line,data),/A P|B P/);
  settings.deltaMetric='loading';assert.match(mapDetailText(line,data),/ΔYük \+30 %/);assert.match(mapDetailText(line,{...data,base:undefined}),/Sonuç yok/);
  settings.deltaMetric='v';assert.match(mapDetailText(line,{...data,endpointVoltages:[{name:'A TM',delta:-.01}]}),/A TM · ΔV -0,01 pu/);
  settings.displayMode='nominal';assert.match(mapDetailText(line,data),/154 kV\nA TM → B TM\nServis dışı/);assert.doesNotMatch(mapDetailText(line,data),/500/);
  settings.displayMode='q';assert.match(mapDetailText(line,{...data,row:{...data.row,qf:NaN}}),/A Q — \/ Sonuç yok/);
});
test('delta sign/intensity uses settings, missing stays grey, and scenario status overrides result color',()=>{
  const s=defaultSettings();s.displayMode='delta';s.deltaMetric='loading';s.deltaLoad=30;
  const brightness=(hex:string)=>[1,3,5].reduce((sum,i)=>sum+parseInt(hex.slice(i,i+2),16),0);
  for(const sign of [-1,1]){const shades=[1,5,15,30].map(v=>deltaColor(v*sign,s));assert.equal(new Set(shades).size,4);assert.ok(shades.every((c,i)=>i===0||brightness(c)<brightness(shades[i-1])));}
  assert.notEqual(deltaColor(30,s),deltaColor(-30,s));assert.equal(deltaColor(0,s),s.deltaNeutral);assert.equal(deltaColor(null,s),'#708596');assert.equal(deltaColor(NaN,s),'#708596');
  const changed={...s,deltaUp:'#990000',deltaDown:'#009900'};assert.notEqual(deltaColor(30,s),deltaColor(30,changed));assert.notEqual(deltaColor(-30,s),deltaColor(-30,changed));
  const line={vnKv:154,inService:true} as Line,off=lineStyle(line,false,'scenario',s,branch(2,90),branch(1,20));assert.equal(off.color,s.colorScenarioOff);assert.ok(off.dash.length);
  assert.equal(lineStyle({...line,inService:false},true,'scenario',s).color,s.colorScenarioOn);
  const store=new SettingsStore();store.update({deltaQ:120,deltaLoad:30},false);store.update({deltaQ:NaN,deltaLoad:0},false);assert.equal(store.value.deltaQ,120);assert.equal(store.value.deltaLoad,30);
  assert.equal(deltaMaximum({...s,deltaMetric:'q',deltaQ:123}),123);assert.equal(signedValue(30.2,1),'+30,2');assert.equal(signedValue(-11.4,1),'-11,4');assert.equal(signedValue(-.001),'0');assert.equal(signedValue(.001),'0');
});
