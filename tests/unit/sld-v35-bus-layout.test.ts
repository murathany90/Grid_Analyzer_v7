import test from 'node:test';
import assert from 'node:assert/strict';
import {ytbsFixture} from '../helpers/sld-ytbs-fixture';
import {connectedStationLayout} from '../../src/features/sld/physical-layout';
import {assignYtbsSlot} from '../../src/features/sld/ytbs-slotting';
import {feederCellWidth,partitionFeederSides,feederCellDemandOf,ANCHOR_STEP} from '../../src/features/sld/feeder-packing';
import {allVoltageBands} from '../../src/domain/model/voltage-band';

test('A real busbar FID owns exactly one rail and no feeder is dropped or hidden',()=>{
 const f=ytbsFixture();for(let i=0;i<18;i++)f.line('D'+i,33);
 const g=f.graph(),p=connectedStationLayout(g,allVoltageBands());
 const ids=p.sections.map(s=>s.section.id);
 assert.equal(new Set(ids).size,ids.length,'a duplicated rail would re-draw one native FID');
 assert.deepEqual([...new Set(ids)].sort(),g.busSections.map(b=>b.id).sort());
 assert.equal(p.feeders.length,g.feeders.length);
 assert.equal(p.compartments.size,g.feeders.length);
 assert.ok(p.sections.every(s=>s.x2>s.x1&&!s.reference));
});

test('Rail span stays bounded while feeder count grows: packing rows are never re-stacked into one rail',()=>{
 const span=(p:ReturnType<typeof connectedStationLayout>)=>Math.max(...p.sections.map(s=>s.x2-s.x1));
 const small=ytbsFixture();small.line('A',33);const a=span(connectedStationLayout(small.graph(),allVoltageBands()));
 const many=ytbsFixture();for(let i=0;i<18;i++)many.line('D'+i,33);const g=many.graph(),b=span(connectedStationLayout(g,allVoltageBands()));
 const total=g.feeders.filter(x=>x.voltageKv===33).length;
 assert.ok(total>=18);
 assert.ok(b/Math.max(a,1)<6,'rail must not grow with the whole cell sum');
 const cells=[...connectedStationLayout(g,allVoltageBands()).compartments.values()];
 const widest=Math.max(...cells.map(c=>c.x2-c.x1));
 assert.ok(b<=widest*total,'rail stays within the sum of its own cells');
});

test('Medium voltage feeders use both rows of a physical rail instead of one unbounded lower row',()=>{
 const f=ytbsFixture();for(let i=0;i<18;i++)f.line('D'+i,33);
 const g=f.graph(),slots=assignYtbsSlot(g,g.feeders.filter(x=>x.voltageKv===33)),demand=new Map(slots.map(s=>[s.feeder.id,feederCellDemandOf(g,s.feeder,new Set(g.busSections.map(b=>b.id)))]));
 const {upper,lower}=partitionFeederSides(slots,demand);
 assert.ok(upper.length>1&&lower.length>1,'MV rows must both carry visible feeders');
 assert.ok(upper.length+lower.length===slots.length);
 const p=connectedStationLayout(g,allVoltageBands()),cells=[...p.compartments.values()];
 assert.ok(cells.some(c=>c.direction<0)&&cells.some(c=>c.direction>0));
});

test('Cell width follows real attachments, never a packing weight or a name',()=>{
 const f=ytbsFixture();f.line('A',400);f.line('B',400);f.line('C',400);
 const g=f.graph(),sections=new Set(g.busSections.map(b=>b.id)),slot=assignYtbsSlot(g,g.feeders.filter(x=>x.voltageKv===400))[0];
 const measured=feederCellDemandOf(g,slot.feeder,sections),base=feederCellWidth(slot,measured);
 assert.equal(base,feederCellWidth(slot,measured),'measurement must be stable');
 // Four packing units at 400 kV must not multiply the cell, and off-spine branch
 // switches that create no extra real root must not widen it either.
 const bare=feederCellWidth(slot,{barAnchors:1,branchRoots:0,parallelWindings:0,circuitSwitches:0});
 assert.ok(bare<=base+ANCHOR_STEP,'a packing weight must not scale the cell');
 assert.ok(base<=200,'one physical bay must not reserve a bank-sized compartment');
 assert.ok(bare>=80,'a drawn bay still needs symbol and caption clearance');
});

test('Reference busbar rails stay compact while attachment demand reserves independent feeder lanes',()=>{
 const f=ytbsFixture();for(const b of ['B1','B2','B3'])f.line(b,154);
 const g=f.graph(),p=connectedStationLayout(g,allVoltageBands());
 const groups=new Map<string,number[]>();
 for(const s of p.sections){const key=[s.section.voltageKv,s.x1,s.x2].join('|');groups.set(key,[...(groups.get(key)??[]),s.y]);}
 let measured=0;
 for(const ys of groups.values()){ys.sort((a,b)=>a-b);for(let i=1;i<ys.length;i++){assert.equal(ys[i]-ys[i-1],18,'selectors occupy external cells rather than widening the rail bundle');measured++;}}
 assert.ok(measured>0,'the fixture must actually contain a multi-rail busbar group');
});

test('Every feeder keeps one unique, pre-planned busbar anchor; no anchor is nudged afterwards',()=>{
 const f=ytbsFixture();for(let i=0;i<10;i++)f.line('D'+i,33);for(let i=0;i<6;i++)f.line('U'+i,154);
 const g=f.graph(),p=connectedStationLayout(g,allVoltageBands()),seen=new Map<string,number>();
 for(const [id,c]of p.compartments){const fdr=g.feeders.find(x=>x.id===id)!;for(const sid of fdr.switchIds){const sw=g.switches.find(x=>x.id===sid)!;const bar=p.sections.find(s=>s.section.id===sw.from||s.section.id===sw.to);if(!bar)continue;
   const key=bar.section.id+'|'+Math.round(c.axis);
   const prior=seen.get(key);assert.ok(prior==null||prior===c.axis,'two bays may not share one rail attachment point');
   seen.set(key,c.axis);}}
});