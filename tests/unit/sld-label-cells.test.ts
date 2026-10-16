import test from 'node:test';import assert from 'node:assert/strict';
import {inspectLabelCells,sameLabelGeometry,type LabelBox,type LabelCell} from '../../tools/sld-label-cell-oracle';
import {transformerCardRows} from '../../src/features/sld/result-labels';
import {ytbsFixture} from '../helpers/sld-ytbs-fixture';
import {connectedStationLayout} from '../../src/features/sld/physical-layout';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
import {inspectPilotSvg} from '../../tools/sld-v36-pilot-oracle.mjs';
const cell:LabelCell={id:'F',axis:100,band:150,side:'UP',kv:33,ordinary:true,x1:30,x2:170};
const title:LabelBox={id:'T',owner:'F',role:'title',text:'Actual feeder',anchorX:100,x1:60,x2:140,y1:140,y2:154};
test('Independent label oracle rejects a remote caption and a caption moved into its neighbor cell',()=>{
 assert.deepEqual(inspectLabelCells([title],[cell],[]).errors,[]);
 for(const dx of [-800,144]){const bad={...title,anchorX:100+dx,x1:title.x1+dx,x2:title.x2+dx};assert.ok(inspectLabelCells([bad],[cell],[]).errors.some(e=>e.startsWith('LABEL_OUTSIDE_CELL')));}
});
test('Independent label oracle rejects text/conductor, text/glyph and text/text overlaps',()=>{
 assert.ok(inspectLabelCells([title],[cell],[{owner:'OTHER',terminal:'B',a:[100,120],b:[100,180]}]).errors.some(e=>e.startsWith('TEXT_WIRE')));
 assert.ok(inspectLabelCells([title],[cell],[],[{...title,owner:'DEVICE'}]).errors.some(e=>e.startsWith('TEXT_GLYPH')));
 assert.ok(inspectLabelCells([title,{...title,id:'T2',owner:'OTHER'}],[cell],[]).errors.some(e=>e.startsWith('TEXT_TEXT')));
});
test('LF on/off oracle rejects a changed native endpoint, label or page instead of accepting equal inventories',()=>{
 const a={ports:[[10,20]],labels:[[100,150]],viewBox:[0,0,640,900]};assert.ok(sameLabelGeometry(a,structuredClone(a)));
 for(const b of [{...a,ports:[[11,20]]},{...a,labels:[[101,150]]},{...a,viewBox:[0,0,640,901]}])assert.equal(sameLabelGeometry(a,b),false);
});
test('Independent SVG oracle rejects a foreign-net T and a conductor bridging a real open contact',()=>{
 const f=ytbsFixture(),g=f.graph(),wire=(terminal:string,d:string)=>`<path data-connection="true" data-native-terminal="${terminal}" d="${d}"/>`;
 const t=inspectPilotSvg('<svg>'+wire('A','M0,100 L100,100')+wire('B','M50,50 L50,100')+'</svg>',g,'all');assert.ok(t.foreignTouches.length);
 const s=g.switches[0],open=`<g data-id="${s.id}" data-physical-switch="ElmCoup|${s.id}" data-from="${s.from}" data-to="${s.to}" data-state="OPEN" data-contact-in="50,84" data-contact-out="50,116"/>`;
 assert.ok(inspectPilotSvg('<svg>'+open+wire(s.from,'M50,70 L50,130')+'</svg>',g,'all').errors.some(e=>e.startsWith('Open gap bridged')));
});
test('Fixed transformer readout always has four native-side rows and retains the quantity gate',()=>{
 assert.deepEqual(transformerCardRows(undefined,'ElmTr2|T','HV'),['P — MW','Q — MVAr','Yük — %','Kademe — k.']);
});
test('Ordinary MV upper/lower exits reserve common bands and both natural name lines before LF visibility',()=>{
 const f=ytbsFixture();for(let i=0;i<10;i++)f.line('ORDINARY'+i,33);const g=f.graph(),before=JSON.stringify(g),l=connectedStationLayout(g,allVoltageBands());
 for(const side of [-1,1]){const c=[...l.compartments].filter(([id,c])=>c.units===1&&c.direction===side&&g.feeders.find(f=>f.id===id)?.name.includes('ORDINARY')).map(([,c])=>c);assert.ok(c.length>1);assert.equal(new Set(c.map(c=>c.titleY)).size,1);assert.ok(c.every(c=>c.flowY===c.titleY+33));}
 assert.equal(JSON.stringify(g),before);
});

test('An unrelated bar at the same nominal voltage cannot pin a GSU component inside another voltage group',()=>{
 const f=ytbsFixture();f.term('UNRELATED_11',11,'G11',true);f.term('GSU_HV',154,'GSU_BAY');f.sw('GSU_CB','M','GSU_HV','GSU_BAY','cbk');f.term('GSU_LV',11,'GSU_SUBSTATION');
 f.n.transformers.push({...f.n.transformers[0],id:'GSU',sourceId:'GSU',name:'GSU',from:'GSU_HV',to:'GSU_LV',vnKv:154,lvKv:11});
 const g=f.graph(),before=JSON.stringify(g),l=connectedStationLayout(g,allVoltageBands());assert.ok(l.ports.get('GSU_LV')!.y>Math.max(...l.sections.map(b=>b.y)));assert.equal(JSON.stringify(g),before);
});

test('A fully pruned source bay keeps its own source-only cell clear of electrical geometry',()=>{
 const g=ytbsFixture().graph();g.feeders.push({...g.feeders[0],id:'EMPTY',name:'Source only',voltageKv:33,terminalIds:[],busSectionIds:[],switchIds:[],equipmentKeys:[]});const before=JSON.stringify(g),l=connectedStationLayout(g,allVoltageBands()),f=l.feeders.find(f=>f.feeder.id==='EMPTY')!,c=l.compartments.get('EMPTY')!;
 assert.ok(f.y>Math.max(...l.equipment.map(e=>e.y+100),...[...l.ports.values()].map(p=>p.y+100)));assert.equal(c.axis,f.x);assert.ok(c.x1<f.x&&c.x2>f.x);assert.equal(JSON.stringify(g),before);
});
