import test from 'node:test';import assert from 'node:assert/strict';
import {areaInScope,initialMapDisplayFilters,mapAreaScopeLabel,mapDisplayForStudy,mapScopeKey,scopeAreaFilter} from '../../src/map/area-scope';
import {allVoltageBands} from '../../src/domain/model/voltage-band';

test('initial map display scope shows every area and voltage band without touching analytical filters',()=>{
  const scope=initialMapDisplayFilters();
  assert.equal(scope.areaMode,'ALL');assert.deepEqual(scope.areaIds,[]);assert.equal(scope.siteId,'');
  assert.deepEqual([...scope.voltages].sort(),[...allVoltageBands()].sort());
});
test('tri-state YTM scope: ALL shows everything, NONE shows nothing, SELECTED is the union of chosen ids',()=>{
  const all=initialMapDisplayFilters();
  assert.equal(areaInScope(all,'A'),true);assert.equal(areaInScope(all,''),true);
  const none={areaMode:'NONE' as const,areaIds:[]};
  assert.equal(areaInScope(none,'A'),false);
  const selected={areaMode:'SELECTED' as const,areaIds:['A','C']};
  assert.equal(areaInScope(selected,'A'),true);assert.equal(areaInScope(selected,'C'),true);
  assert.equal(areaInScope(selected,'B'),false);assert.equal(areaInScope(selected,''),false);
});
test('scopeAreaFilter builds a stable per-frame predicate and never falls back to filters.areaId',()=>{
  const selected=scopeAreaFilter({areaMode:'SELECTED',areaIds:['X','Y']});
  assert.equal(selected('X'),true);assert.equal(selected('Z'),false);
  assert.equal(scopeAreaFilter({areaMode:'ALL',areaIds:[]})('anything'),true);
  assert.equal(scopeAreaFilter({areaMode:'NONE',areaIds:[]})('anything'),false);
  // An analytical areaId on the shared filters object must not leak into the map scope.
  const filters={areaId:'X',siteId:'',voltages:allVoltageBands(),search:''};
  assert.equal(scopeAreaFilter(initialMapDisplayFilters())(filters.areaId),true);
  assert.equal(scopeAreaFilter({areaMode:'NONE',areaIds:[]})(filters.areaId),false);
});
test('counter label covers Tümü / Yok / n/N states deterministically',()=>{
  assert.equal(mapAreaScopeLabel({areaMode:'ALL',areaIds:[]},10),'Tümü');
  assert.equal(mapAreaScopeLabel({areaMode:'NONE',areaIds:[]},10),'Yok');
  assert.equal(mapAreaScopeLabel({areaMode:'SELECTED',areaIds:['a','b']},10),'2/10');
});
test('mapScopeKey is order-insensitive, separates mode/ids/voltages and includes the map TM + capacity scopes',()=>{
  const a=mapScopeKey({areaMode:'SELECTED',areaIds:['b','a'],voltages:new Set(['154','400']),siteId:'',capacitySeason:'inherit'});
  const b=mapScopeKey({areaMode:'SELECTED',areaIds:['a','b'],voltages:new Set(['400','154']),siteId:'',capacitySeason:'inherit'});
  assert.equal(a,b);
  assert.notEqual(a,mapScopeKey({areaMode:'SELECTED',areaIds:['a'],voltages:new Set(['400','154']),siteId:'',capacitySeason:'inherit'}));
  assert.notEqual(a,mapScopeKey({areaMode:'ALL',areaIds:['a','b'],voltages:new Set(['400','154']),siteId:'',capacitySeason:'inherit'}));
  // The map TM scope participates in cache keys, the analytical siteId does not.
  assert.notEqual(a,mapScopeKey({areaMode:'SELECTED',areaIds:['a','b'],voltages:new Set(['400','154']),siteId:'TM9',capacitySeason:'inherit'}));
  // The map-only capacity display choice participates; it never touches the engineering session.
  assert.notEqual(a,mapScopeKey({areaMode:'SELECTED',areaIds:['a','b'],voltages:new Set(['400','154']),siteId:'',capacitySeason:'summer'}));
});
test('model change resets the display scope; study restore seeds SELECTED+TM without mutating filters',()=>{
  const stale={areaMode:'SELECTED' as const,areaIds:['old-area'],voltages:new Set(['154']),siteId:'OLD_TM',capacitySeason:'inherit' as const};
  const fresh=initialMapDisplayFilters();
  assert.notDeepEqual(fresh.areaIds,stale.areaIds);assert.equal(fresh.areaMode,'ALL');assert.equal(fresh.areaIds.length,0);assert.equal(fresh.siteId,'');
  const filters={areaId:'study-area',siteId:'TM1',voltages:allVoltageBands(),search:'q'};
  const seeded=mapDisplayForStudy('study-area','TM1');
  assert.equal(seeded.areaMode,'SELECTED');assert.deepEqual(seeded.areaIds,['study-area']);assert.equal(seeded.siteId,'TM1');
  // The analytical filters object is untouched by the map-scope seed.
  assert.equal(filters.areaId,'study-area');assert.equal(filters.siteId,'TM1');assert.equal(filters.voltages.size,allVoltageBands().size);
  assert.equal(mapDisplayForStudy('').areaMode,'ALL');assert.equal(mapDisplayForStudy('').siteId,'');
});
