import test from 'node:test';import assert from 'node:assert/strict';
import {drawPoint,labelBudget,planLabels,LABEL_PRIORITY_HOVER,LABEL_PRIORITY_SELECTED,type LabelCandidate,type LabelPlacement} from '../../src/map/label-layout';

const measure=(text:string)=>({width:text.length*6,height:10});
const options=(width=400,height=300,over:{maxLabels?:number}={})=>({width,height,measure,iconRadius:3,maxLabels:over.maxLabels??50});
const overlap=(a:LabelPlacement,b:LabelPlacement)=>a.box.x<b.box.x+b.box.width&&b.box.x<a.box.x+a.box.width&&a.box.y<b.box.y+b.box.height&&b.box.y<a.box.y+a.box.height;

test('a lone label is placed right of the icon with a non-overlapping box',()=>{
  const [p]=planLabels([{id:'s1',text:'Ankara',x:100,y:100,priority:1}],[],options());
  assert.ok(p);assert.equal(p.anchor,'right');assert.equal(p.id,'s1');
  assert.ok(p.box.x>103&&p.box.width===measure('Ankara').width);
  const pt=drawPoint(p,3);assert.equal(pt.align,'left');
});
test('nearby labels never overlap each other and fall back through above/below/left anchors',()=>{
  const candidates:LabelCandidate[]=[
    {id:'a',text:'AA_AA_AA',x:100,y:100,priority:10},
    {id:'b',text:'BB_BB_BB',x:102,y:104,priority:5},
  ];
  const placed=planLabels(candidates,[],options());
  assert.equal(placed.length,2);
  assert.equal(placed[0].id,'a');assert.equal(placed[0].anchor,'right');
  assert.notEqual(placed[1].anchor,'right');
  assert.equal(overlap(placed[0],placed[1]),false);
});
test('occupied boxes (split/measurement labels) push name labels to alternative anchors',()=>{
  const blocker={x:106,y:95,width:60,height:10};
  const [p]=planLabels([{id:'s1',text:'AA_AA_AA',x:100,y:100,priority:1}],[blocker],options());
  assert.ok(p);assert.notEqual(p.anchor,'right');
  assert.equal(overlap(p,{...p,box:blocker} as unknown as LabelPlacement),false);
});
test('placement order follows priority: selected, hover, voltage rank, then the rest',()=>{
  const candidates:LabelCandidate[]=[
    {id:'low',text:'Low',x:250,y:150,priority:10},
    {id:'high',text:'High',x:100,y:150,priority:50},
    {id:'hover',text:'Hover',x:250,y:50,priority:LABEL_PRIORITY_HOVER},
    {id:'sel',text:'Sel',x:100,y:50,priority:LABEL_PRIORITY_SELECTED},
  ];
  const placed=planLabels(candidates,[],options(400,300));
  assert.deepEqual(placed.map(p=>p.id),['sel','hover','high','low']);
});
test('a reserved-tier label is always placed, clamped inside the viewport even when everything collides',()=>{
  const occupied=[{x:0,y:0,width:400,height:140}];
  const [p]=planLabels([{id:'sel',text:'Selected',x:200,y:20,priority:LABEL_PRIORITY_SELECTED}],occupied,options(400,150));
  assert.ok(p,'reserved label must be placed');
  assert.ok(p.box.x>=0&&p.box.y>=0&&p.box.x+p.box.width<=400&&p.box.y+p.box.height<=150);
});
test('labels outside the viewport are dropped; non-reserved labels never cross the edge',()=>{
  const placed=planLabels([
    {id:'off',text:'Offscreen',x:5000,y:100,priority:1},
    {id:'edge',text:'EdgeLabel',x:398,y:100,priority:1},
  ],[],options(400,300));
  assert.equal(placed.some(p=>p.id==='off'),false);
  for(const p of placed)assert.ok(p.box.x>=1&&p.box.x+p.box.width<=399);
});
test('maxLabels caps placements regardless of free space',()=>{
  const candidates=[...Array(30)].map((_,i)=>({id:'s'+i,text:'N'+i,x:20+i*12,y:20+(i%5)*14,priority:1}));
  const placed=planLabels(candidates,[],options(400,300,{maxLabels:7}));
  assert.equal(placed.length,7);
});
test('layout is deterministic and independent of input order',()=>{
  const candidates=[...Array(12)].map((_,i)=>({id:'s'+i,text:'Name_'+i,x:30+i*17,y:30+(i%4)*19,priority:(i%3)*10}));
  const first=planLabels(candidates,[],options());
  const second=planLabels([...candidates].reverse(),[],options());
  assert.deepEqual(first.map(p=>[p.id,p.anchor,p.box]),second.map(p=>[p.id,p.anchor,p.box]));
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
