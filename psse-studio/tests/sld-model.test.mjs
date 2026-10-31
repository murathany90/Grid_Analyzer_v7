import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../../tools/psse-sld/studio_model.js',import.meta.url),'utf8')+';globalThis.build=buildSldModelIndex;',context);

test('synthetic cleanup preserves open SYS and UNKNOWN; removes dependent Link and Label records only',()=>{
 vm.runInContext('globalThis.clean=removeSldPassiveComponents;',context);
 const doc={components:[{id:1,t:'Symbol'},{id:2,t:'Symbol'},{id:3,t:'Symbol'},{id:4,t:'Symbol'},
  {id:10,t:'Link',p1:{sym:1},p2:{sym:2}},{id:11,t:'Link',p1:{sym:3},p2:{sym:4}},
  {id:20,t:'Label',owner:1},{id:21,t:'Label',owner:10},{id:22,t:'Label',owner:3}]};
 const removed=context.clean(doc,c=>({1:'PASSIVE',2:'ACTIVE',3:'OPEN',4:'UNKNOWN'})[c.id]);
 assert.deepEqual([...removed].sort((a,b)=>a-b),[1,10,20,21]);assert.deepEqual(doc.components.map(c=>c.id),[2,3,4,11,22]);
});
test('SLD station/YTM/OWNER indexes preserve source IDs and distinguish uncertain name candidates',()=>{
 const model={equipment:[{id:'substation:1',kind:'substation',name:'Plant',fields:{isub:1}},{id:'substation:2',kind:'substation',name:'Other',fields:{isub:2}},
  {id:'bus:a',kind:'bus',name:'Unrelated name',fields:{isub:1,area:4,owner:708}},{id:'bus:b',kind:'bus',name:'Plant',fields:{area:4,owner:708}},{id:'bus:c',kind:'bus',name:'Plant-extra',fields:{area:4,owner:708}},{id:'bus:d',kind:'bus',name:'Plant',fields:{area:9,owner:707}}],binaryArrays:{Numown:{values:[708]},Owname:{values:['ANKARA      ']},Numare:{values:[4,9]},Arnam:{values:['AREA FOUR   AREA NINE   ']}}};
 const network={buses:model.equipment.filter(e=>e.kind==='bus').map((e,i)=>({source:true,sourceEquipmentId:e.id,externalNumber:i+1,connectionKey:i+1})),branches:[]};
 const index=context.build(model,network);assert.equal(index.ownerNames.get('708'),'ANKARA');assert.equal(index.areaNames.get('4'),'AREA FOUR');
 assert.deepEqual([...index.stationBuses.get('1').indices],[0,1]);assert.equal(index.stationBuses.get('1').provenance,'INFERRED_EXACT_SOURCE_NAME');
 assert(!index.busStation.has(2),'name prefix was treated as source topology');assert(!index.busStation.has(3),'unrelated OWNER/AREA was assigned by name');assert.equal(index.busStation.get(0),'1');
});
