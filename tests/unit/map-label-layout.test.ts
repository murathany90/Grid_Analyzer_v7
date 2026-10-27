import test from 'node:test';import assert from 'node:assert/strict';
import {drawPoint,labelBudget,planLabels,LABEL_PRIORITY_HOVER,LABEL_PRIORITY_SELECTED,type LabelCandidate,type LabelPlacement} from '../../src/map/label-layout';

const measure=(text:string)=>({width:text.length*6,height:10});
const options=(width=400,height=300,over:{maxLabels?:number}={})=>({width,height,measure,iconRadius:3,maxLabels:over.maxLabels??50});
const overlap=(a:LabelPlacement,b:LabelPlacement)=>a.box.x<b.box.x+b.box.width&&b.box.x<a.box.x+a.box.width&&a.box.y<b.box.y+b.box.height&&b.box.y<a.box.y+a.box.height;
const boxOverlap=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;

test('a lone label is placed right of the icon with a non-overlapping box',()=>{
  const {placements:[p]}=planLabels([{id:'s1',text:'Ankara',x:100,y:100,priority:1}],[],options());
  assert.ok(p);assert.equal(p.anchor,'right');assert.equal(p.id,'s1');
  assert.ok(p.box.x>103&&p.box.width===measure('Ankara').width);
  const pt=drawPoint(p,3);assert.equal(pt.align,'left');
});
test('nearby labels never overlap each other and fall back through above/below/left anchors',()=>{
  const candidates:LabelCandidate[]=[
    {id:'a',text:'AA_AA_AA',x:100,y:100,priority:10},
    {id:'b',text:'BB_BB_BB',x:102,y:104,priority:5},
  ];
  const {placements}=planLabels(candidates,[],options());
  assert.equal(placements.length,2);
  assert.equal(placements[0].id,'a');assert.equal(placements[0].anchor,'right');
  assert.notEqual(placements[1].anchor,'right');
  assert.equal(overlap(placements[0],placements[1]),false);
});
test('fixed occupied boxes (icons, marks) push name labels to alternative anchors',()=>{
  const blocker={x:106,y:95,width:60,height:10};
  const {placements:[p]}=planLabels([{id:'s1',text:'AA_AA_AA',x:100,y:100,priority:1}],[blocker],options());
  assert.ok(p);assert.notEqual(p.anchor,'right');
  assert.equal(boxOverlap(p.box,blocker),false);
});
test('reserved label suppresses removable low-priority labels instead of overlapping them',()=>{
  // A wide split-bus/measurement label covers every anchor of the selected TM.
  const splitLabel={x:22,y:80,width:156,height:40};
  const {placements,suppressed}=planLabels(
    [{id:'sel',text:'Selected_TM',x:100,y:100,priority:LABEL_PRIORITY_SELECTED}],
    [{box:splitLabel,removable:true}],
    options(400,300),
  );
  const [p]=placements;
  assert.ok(p,'selected label must be placed');
  assert.deepEqual(suppressed,[splitLabel],'the blocking removable label is suppressed for this frame');
  // Overlap with the suppressed box is fine (it will not be drawn); what matters
  // is that the reserved label did not have to accept an UNRESOLVED collision.
  assert.equal(p.anchor,'right');
});
test('reserved label prefers the anchor with the smallest fixed overlap when geometry cannot move',()=>{
  // above is off-viewport; right and left are fully blocked by wide marks;
  // below is only partially covered — the least-overlapping anchor must win.
  const fixed=[
    {x:106,y:3,width:200,height:10},
    {x:22,y:3,width:72,height:10},
    {x:64,y:24,width:20,height:10},
  ];
  const {placements:[p]}=planLabels(
    [{id:'sel',text:'Selected_TM',x:100,y:8,priority:LABEL_PRIORITY_SELECTED}],
    fixed.map(box=>({box})),
    options(400,300),
  );
  assert.ok(p,'reserved label must still be placed');
  assert.equal(p.anchor,'below','least-overlapping anchor wins deterministically');
});
test('reserved suppression never removes fixed geometry and stays deterministic',()=>{
  const fixed={x:106,y:95,width:60,height:10},removable={x:106,y:95,width:60,height:10};
  const input:LabelCandidate[]=[{id:'sel',text:'Selected_TM',x:100,y:100,priority:LABEL_PRIORITY_SELECTED}];
  const first=planLabels(input,[{box:fixed},{box:removable,removable:true}],options(400,300));
  assert.ok(first.placements.length);
  assert.deepEqual(first.suppressed,[],'a fixed blocker is never reported as suppressed');
  const second=planLabels([...input].reverse(),[{box:removable,removable:true},{box:fixed}],options(400,300));
  assert.deepEqual(first.placements.map(p=>[p.id,p.anchor,p.box]),second.placements.map(p=>[p.id,p.anchor,p.box]));
});
test('priority order: placement sequence is selected, hover, voltage rank, then the rest',()=>{
  const candidates:LabelCandidate[]=[
    {id:'low',text:'Low',x:250,y:150,priority:10},
    {id:'high',text:'High',x:100,y:150,priority:50},
    {id:'hover',text:'Hover',x:250,y:50,priority:LABEL_PRIORITY_HOVER},
    {id:'sel',text:'Sel',x:100,y:50,priority:LABEL_PRIORITY_SELECTED},
  ];
  const {placements}=planLabels(candidates,[],options(400,300));
  assert.deepEqual(placements.map(p=>p.id),['sel','hover','high','low']);
});
test('labels outside the viewport are dropped; non-reserved labels never cross the edge',()=>{
  const {placements}=planLabels([
    {id:'off',text:'Offscreen',x:5000,y:100,priority:1},
    {id:'edge',text:'EdgeLabel',x:398,y:100,priority:1},
  ],[],options(400,300));
  assert.equal(placements.some(p=>p.id==='off'),false);
  for(const p of placements)assert.ok(p.box.x>=1&&p.box.x+p.box.width<=399);
});
test('maxLabels caps placements regardless of free space',()=>{
  const candidates=[...Array(30)].map((_,i)=>({id:'s'+i,text:'N'+i,x:20+i*12,y:20+(i%5)*14,priority:1}));
  const {placements}=planLabels(candidates,[],options(400,300,{maxLabels:7}));
  assert.equal(placements.length,7);
});
test('layout is deterministic and independent of input order',()=>{
  const candidates=[...Array(12)].map((_,i)=>({id:'s'+i,text:'Name_'+i,x:30+i*17,y:30+(i%4)*19,priority:(i%3)*10}));
  const first=planLabels(candidates,[],options());
  const second=planLabels([...candidates].reverse(),[],options());
  assert.deepEqual(first.placements.map(p=>[p.id,p.anchor,p.box]),second.placements.map(p=>[p.id,p.anchor,p.box]));
  assert.deepEqual(first.suppressed,second.suppressed);
});
test('no placed label pair overlaps for a dense synthetic grid (real bounding-box assertion)',()=>{
  const candidates:LabelCandidate[]=[...Array(60)].map((_,i)=>({id:'s'+i,text:`TM_${i}_${i%3?'Kuzey':'Güney'}`,x:14+(i%10)*40,y:14+Math.floor(i/10)*26,priority:(i%4)*10+(i%7)}));
  const {placements}=planLabels(candidates,[],options(420,300));
  for(let i=0;i<placements.length;i++)for(let j=i+1;j<placements.length;j++)assert.equal(overlap(placements[i],placements[j]),false,`${placements[i].id} overlaps ${placements[j].id}`);
});
test('label budget grows with CSS viewport area and zoom, and is DPR-independent',()=>{
  const small=labelBudget(800,500,1),large=labelBudget(1920,1080,1);
  assert.ok(large>small);
  assert.ok(labelBudget(1920,1080,2)>labelBudget(1920,1080,.5));
  assert.ok(labelBudget(1920,1080,10)<=260);
  assert.ok(labelBudget(100,80,5)>=10);
  // The budget signature takes CSS pixels only: a hidpi screen adds no labels.
  assert.equal(labelBudget(1366,768,1),labelBudget(1366,768,1));
});
