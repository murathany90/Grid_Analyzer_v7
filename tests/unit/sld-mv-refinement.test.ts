import test from 'node:test';import assert from 'node:assert/strict';
import {captionLines,feederCaption,localDeviceName,mvBarOrder,windingCaption} from '../../src/features/sld/caption-text';
import {connectedStationLayout} from '../../src/features/sld/physical-layout';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
import {ytbsFixture} from '../helpers/sld-ytbs-fixture';
import {sourceCircuit} from '../helpers/sld-v32-circuits';
import {feederReadout} from '../../src/features/sld/feeder-readout';
import type {SldResultOverlay} from '../../src/features/sld/result-overlay';
import {stationSummary} from '../../src/features/sld/station-summary';
import {sldDrawingGraph} from '../../src/features/sld/source-switch-policy';
import {sourceLeafCircuit} from '../helpers/sld-v38-circuits';

test('Device captions strip only the owning station prefix and retain decimal coupler notation',()=>{
 assert.equal(localDeviceName('ADATOPRAKPINAR TR-B','ADATOPRAKPINAR'),'TR-B');assert.equal(localDeviceName('BAGLUM A-OTR-1','BAGLUM'),'A-OTR-1');assert.equal(localDeviceName('BAGLUMLU TR-B','BAGLUM'),'BAGLUMLU TR-B');
 assert.equal(feederCaption('336 Kuplaj','TM',33.6),'33,6 Kuplaj');assert.equal(feederCaption('345 Kuplaj','TM',33),'34,5 Kuplaj');assert.equal(feederCaption('33,6 Kuplaj','TM',33.6),'33,6 Kuplaj');assert.equal(feederCaption('33.6 Kuplaj','TM',33.6),'33.6 Kuplaj');assert.equal(feederCaption('336 HAT','TM',33.6),'336 HAT');assert.equal(feederCaption('400 Kuplaj','TM',33.6),'400 Kuplaj');
 for(const s of ['BANK-A PRIMER FIDERI','BANK-B SEKONDER FIDERI','TR-A SEK.','TR-3 PR.'])assert.ok(windingCaption(s,'TM'));assert.ok(!windingCaption('TR-A YUKU','TM'));assert.ok(!windingCaption('TRAKYA HATTI','TM'));
});
test('Long captions wrap at words in at most two rows',()=>{assert.deepEqual(captionLines('Bara Bolucu Kesicisi A-B',17),['Bara Bolucu','Kesicisi A-B']);assert.deepEqual(captionLines('AKASYA GES-1',17),['AKASYA GES-1']);assert.equal(captionLines('A B C D E F G H I J K L',7).length,2);});
test('MV letter order includes C and later sections before the transfer rail',()=>{assert.deepEqual(['TR-C','TR-B','TR-A','TR-D','B-T'].sort((a,b)=>mvBarOrder(a)-mvBarOrder(b)),['TR-A','TR-B','TR-C','TR-D','B-T']);
 const f=ytbsFixture();f.term('LB',33,'GB',true);f.term('LC',33,'GC',true);const g=f.graph();g.busSections.find(b=>b.id==='L')!.name='TR-A';g.busSections.find(b=>b.id==='LB')!.name='TR-B';g.busSections.find(b=>b.id==='LC')!.name='TR-C';g.busSections.reverse();const before=structuredClone(g),p=connectedStationLayout(g,allVoltageBands());assert.deepEqual(p.sections.filter(b=>b.section.voltageKv===33).sort((a,b)=>a.x1-b.x1).map(b=>b.section.name),['TR-A','TR-B','TR-C']);assert.deepEqual(g,before);
});
test('A proven MV DS-CB-DS cell centers its breaker and mirrors selectors independently of FROM/TO orientation',()=>{
 const f=ytbsFixture();f.term('LB',33,'G33',true);f.term('CA',33,'COUP');f.term('CB',33,'COUP');f.sw('D1','L','CA','COUP');f.sw('CBREAK','CA','CB','COUP','cbk',false);f.sw('D2','CB','LB','COUP');const g=f.graph(),before=structuredClone(g),positions=[];
 for(const reverse of [false,true]){const graph=structuredClone(g);if(reverse)for(const sw of graph.switches)[sw.from,sw.to]=[sw.to,sw.from];const p=connectedStationLayout(graph,allVoltageBands()),a=p.routes.find(r=>r.sw.id==='D1')!,b=p.routes.find(r=>r.sw.id==='D2')!,cb=p.routes.find(r=>r.sw.id==='CBREAK')!;assert.equal(cb.x,(a.x+b.x)/2);assert.equal(a.y,b.y);assert.equal(Math.abs(cb.rotation!),90);assert.ok(cb.y>a.y);for(const r of [a,b,cb]){assert.deepEqual(r.wires[0].points.at(-1),r.contactFrom);assert.deepEqual(r.wires[1].points[0],r.contactTo);for(const w of r.wires)for(let i=1;i<w.points.length;i++)assert.ok(w.points[i][0]===w.points[i-1][0]||w.points[i][1]===w.points[i-1][1]);}positions.push([a.x,a.y,b.x,b.y,cb.x,cb.y]);}
 assert.deepEqual(positions[0],positions[1]);assert.deepEqual(g,before);
});
test('MV outgoing cells alternate along the rail while incoming winding feeders keep the upper side',()=>{
 const f=ytbsFixture();for(let i=0;i<8;i++)f.line('OUT'+i,33);const g=f.graph(),p=connectedStationLayout(g,allVoltageBands()),out=p.feeders.filter(f=>/^FOUT/.test(f.feeder.id)).sort((a,b)=>a.x-b.x);assert.equal(out.length,8);const directions=out.map(f=>p.compartments.get(f.feeder.id)!.direction);for(let i=1;i<directions.length;i++)assert.notEqual(directions[i],directions[i-1]);assert.equal(p.compartments.get('FL')!.direction,-1);
});
test('Model generator uses a full feeder lead without adding source switches',()=>{
 const f=ytbsFixture();f.n.generators=[...f.n.generators,{...sourceCircuit('isolator-breaker').network.generators[0],id:'MODEL',sourceId:'MODEL',sourceClass:'ElmGenStat',name:'LSZ TR-A',bus:'L',siteIds:['S'],inService:true}];const g=f.graph(),before=structuredClone(g),p=connectedStationLayout(g,allVoltageBands()),model=p.equipment.find(e=>e.equipment.id==='MODEL')!;assert.ok(Math.abs(model.y-model.nativePorts[0].y)>=200);assert.deepEqual(g,before);assert.equal(p.routes.length,g.switches.length);
});
test('Feeder readout chooses a real result-bearing key and exact native TO values',()=>{
 const f=sourceCircuit('isolator-breaker-isolator'),g=f.graph,feeder=g.feeders.find(f=>f.id==='F')!,native=g.equipment.find(e=>e.id==='LINE')!;g.equipment.unshift({id:'NO_RESULT',name:'Auxiliary',sourceClass:'ElmLod',terminals:[native.terminals[0]],kind:'load'});feeder.equipmentKeys.unshift('ElmLod|NO_RESULT');const overlay:SldResultOverlay={status:'CONVERGED',method:'FIXTURE',phase:'BASE',outageKey:null,entries:new Map([['ElmLne|LINE',{status:'CONVERGED',method:'FIXTURE',values:{fromTerminal:'REMOTE',toTerminal:native.terminals[0],pFromMw:10,pToMw:-9.8,qFromMvar:3,qToMvar:-2.7},lines:[],direction:10,alarm:false}]])};
 const r=feederReadout(g,feeder,overlay);assert.equal(r.key,'ElmLne|LINE');assert.equal(r.side,'TO');assert.deepEqual(r.rows,['-9.8 MW','-2.7 MVAr']);assert.ok(r.shown);
 overlay.entries.get('ElmLne|LINE')!.status='STALE';assert.deepEqual(feederReadout(g,feeder,overlay).rows,['— MW','— MVAr']);
});
test('A bare bay never borrows aggregate bus P/Q or source load setpoints',()=>{
 const f=sourceCircuit('isolator-breaker-isolator'),g=f.graph,feeder=g.feeders.find(f=>f.id==='F')!;feeder.equipmentKeys=[];const overlay:SldResultOverlay={status:'CONVERGED',method:'FIXTURE',phase:'BASE',outageKey:null,entries:new Map(feeder.terminalIds.map(id=>['ElmTerm|'+id,{status:'CONVERGED',method:'FIXTURE',values:{pMw:999,qMvar:123},lines:[],direction:null,alarm:false}]))};const r=feederReadout(g,feeder,overlay);assert.equal(r.reason,'NO_RESULT_BEARING_EQUIPMENT');assert.equal(r.shown,false);assert.deepEqual(r.rows,['— MW','— MVAr']);
});
test('Sheet summary separates intentionally hidden source leaves from undrawn devices',()=>{
 const f=sourceLeafCircuit(),before=structuredClone(f.graph),drawing=sldDrawingGraph(f.graph),drawn=drawing.switches.length+drawing.equipment.length,summary=stationSummary(f.graph,drawing,drawn);
 assert.equal(summary.hidden,f.graph.switches.length-drawing.switches.length);assert.ok(summary.hidden>0);assert.equal(summary.missing,0);assert.equal(summary.drawn,drawn);assert.equal(summary.bars,drawing.busSections.length);assert.equal(summary.breakers,drawing.switches.filter(s=>s.kind==='breaker').length);assert.deepEqual(f.graph,before);
});
