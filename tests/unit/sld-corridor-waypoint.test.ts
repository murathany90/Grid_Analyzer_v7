import test from 'node:test';import assert from 'node:assert/strict';
import {clearCorridorWaypoint} from '../../src/features/sld/corridor-waypoint';
import type {Point} from '../../src/features/sld/physical-layout';
test('A foreign long LV corridor cannot own a new winding waypoint, even at its endpoint',()=>{
  const wires=[{terminal:'LV_OTHER',points:[[100,0],[100,2000]] as Point[]}],before=structuredClone(wires);
  for(const point of [[100,500],[100,0]] as Point[]){const p=clearCorridorWaypoint(point,'LV','TR',[],wires);assert.ok(p[0]!==100||p[1]<0||p[1]>2000);}
  assert.deepEqual(wires,before);
});
test('A real same-terminal bank waypoint remains fixed; source FID, not coordinates, owns its junction',()=>{
  const point:Point=[100,500],wires=[{terminal:'LV',points:[[100,0],[100,2000]] as Point[]}];
  assert.equal(clearCorridorWaypoint(point,'LV','TR',[],wires),point);
});
test('Waypoint search respects equipment and glyph obstacles while escaping a foreign net',()=>{
  const p=clearCorridorWaypoint([100,500],'LV','TR',[{id:'OTHER_GLYPH',x1:90,x2:110,y1:490,y2:510}],[{terminal:'FOREIGN',points:[[0,500],[2000,500]]}]);
  assert.ok(p[1]<490||p[1]>510);
});
