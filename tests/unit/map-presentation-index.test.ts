import test from 'node:test';import assert from 'node:assert/strict';
import {mapScaleFixture} from '../helpers/map-scale';
import {modelPresentationIndex,solutionPresentationIndex,resultPresentationIndex,highestNominalBySite} from '../../src/map/presentation-index';
import {representativeStationBus,referenceCellIndex} from '../../src/map/layer-policy';
import {ScreenHitGrid} from '../../src/map/screen-hit-grid';
import {acNetwork} from '../helpers/ac-network';
test('model and solution indices invalidate on model, arrays and calculation identity; partitions remain distinct',()=>{
  const {network,result,ctx}=mapScaleFixture(12,10,2),index=modelPresentationIndex(network),solution=solutionPresentationIndex(network,result.buses,'B0');assert.equal(modelPresentationIndex(network),index);assert.equal(solutionPresentationIndex(network,result.buses,'B0'),solution);assert.notEqual(solutionPresentationIndex(network,result.buses,'S1'),solution);
  const selected=representativeStationBus(ctx,'SITE0',result);assert.equal(selected.nominal,400);assert.equal(selected.bus?.angleRad,result.buses.find(b=>b.id===selected.bus?.id)?.angleRad);ctx.filters.voltages=new Set(['154']);assert.equal(representativeStationBus(ctx,'SITE0',result).nominal,154);ctx.filters.voltages=new Set();assert.equal(representativeStationBus(ctx,'SITE0',result).bus,null);
  const replacement={...network,buses:[...network.buses]};assert.notEqual(modelPresentationIndex(replacement),index);network.buses=[...network.buses];assert.notEqual(modelPresentationIndex(network),index);assert.equal(highestNominalBySite(network,new Set()).get('SITE0'),null);
  const wrong={...result,buses:[{...result.buses[0],vnKv:154}]};assert.equal(resultPresentationIndex(network,wrong).solution.byTerminal.size,0);
  const ambiguous={...result,buses:[result.buses[1],{...result.buses[1],id:'OTHER'}]};assert.equal(resultPresentationIndex(network,ambiguous).solution.byTerminal.get('TERM1'),null);
});
test('SN3/SN4 sized anonymous index stress completes all sites, reuses warm indices and keeps exact selected raw values',()=>{
  for(const [physical,solved] of [[49275,4077],[48898,4088]]){const {ctx,result,network}=mapScaleFixture(physical,solved),start=performance.now();const cold=network.sites.map(s=>representativeStationBus(ctx,s.id,result));assert.ok(performance.now()-start<3000);const warm=network.sites.map(s=>representativeStationBus(ctx,s.id,result));assert.deepEqual(warm,cold);
    for(const s of network.sites){const nominal=400,expected=result.buses.filter(b=>b.siteIds.includes(s.id)&&b.vnKv===nominal).sort((a,b)=>b.vmPu-a.vmPu||a.id.localeCompare(b.id))[0]??null;assert.equal(cold[Number(s.id.slice(4))].bus,expected);}assert.equal(result.buses[0].vmPu,0);
  }
});
test('PF reference index rejects duplicate native FID/nominal cells without merging different voltage partitions',()=>{
  const row={sourceClass:'ElmTerm',fid:'T',nominalKv:154,pf:{value:0}},other={...row,nominalKv:400,pf:{value:1}};const index=referenceCellIndex([row,other,{...row}] as never);assert.equal(index.get('ElmTerm|T|154'),null);assert.equal(index.get('ElmTerm|T|400'),other);
});
test('screen grid preserves exact-hit candidates at segment ends and tile boundaries; viewport rebuild removes old positions',()=>{
  const lines=acNetwork().lines,paths=new Map([[lines[0].id,[[0,10],[192,10]]],[lines[1].id,[[0,300],[192,300]]]]) as Map<string,[number,number][]>,grid=new ScreenHitGrid(lines,paths,400,400);assert.ok(grid.candidates(96,14).has(lines[0]));assert.ok(grid.candidates(195,10).has(lines[0]));assert.equal(grid.candidates(96,14).has(lines[1]),false);assert.equal(new ScreenHitGrid(lines,new Map([[lines[0].id,[[0,200],[192,200]]]]),400,400).candidates(96,14).has(lines[0]),false);
});
