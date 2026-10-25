import test from 'node:test';
import assert from 'node:assert/strict';
import {scDisplayTerminal} from '../../src/domain/results/sc-node';
import {voltageGroupValue,selectVoltageGroup,scScopeRows} from '../../src/domain/results/sc-view-scope';
import {analysisUiFixture} from '../helpers/analysis-ui';
import {compactScRows} from '../../src/features/analysis/compact-rows';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
import {currentScResult} from '../../src/domain/results/sc-selection';

test('physical display alias requires the same node membership, nominal voltage and station',()=>{
 const {ctx}=analysisUiFixture(),n=ctx.network!,base=n.buses[0];
 const network={...n,buses:[{...base,sourceId:'FEED',usage:2,name:'Fider 1'},{...base,sourceId:'BUS',usage:0,name:'154 kV Bara'},{...base,sourceId:'WRONG_KV',usage:0,vnKv:400},{...base,sourceId:'OTHER_SITE',usage:0,siteIds:['OTHER']}]};
 assert.equal(scDisplayTerminal(network,['FEED','BUS','WRONG_KV','OTHER_SITE'],base.vnKv,base.siteIds)?.sourceId,'BUS');
 assert.equal(scDisplayTerminal(network,['FEED','WRONG_KV','OTHER_SITE'],base.vnKv,base.siteIds)?.sourceId,'FEED');
 assert.equal(scDisplayTerminal(network,['WRONG_KV'],base.vnKv,base.siteIds),null);
});
test('one shared low-voltage group preserves fractional nominal values and empty/multiple selections',()=>{
 const {ctx}=analysisUiFixture();ctx.filters.voltages=allVoltageBands();assert.equal(voltageGroupValue(ctx),'');selectVoltageGroup(ctx,'low');assert.equal(voltageGroupValue(ctx),'low');
 const rows=[6.3,33.2,33.6,34.5,36,66,154,220,400].map((kv,i)=>({kv,key:String(i),raw:{nodeKind:'PHYSICAL_BUS'}})) as any;
 assert.deepEqual(scScopeRows(ctx,rows).map(r=>r.kv),[6.3,33.2,33.6,34.5,36]);ctx.filters.voltages.clear();assert.equal(scScopeRows(ctx,rows).length,0);ctx.filters.voltages.add('154');ctx.filters.voltages.add('400');assert.equal(voltageGroupValue(ctx),'__selection');
});
test('display representative keeps calculation FID, current and separate electrical nodes',()=>{
 const {ctx}=analysisUiFixture();ctx.ytmStudy=null;ctx.studyOptions=undefined;ctx.filters.areaId='';ctx.filters.siteId='';const n=ctx.network!,before=JSON.stringify(ctx.scResult!.faults);
 ctx.network={...n,buses:n.buses.map((b,i)=>({...b,usage:i===500?0:2,name:i===500?'Fiziksel Bara':'Fider Düğüm'}))};
 const rows=compactScRows(ctx),r=rows.find(r=>r.raw.electricalBusId==='E0')!;assert.equal(r.name,'Fiziksel Bara');assert.equal(r.fid,'B0');assert.equal(r.raw.displayFid,'B500');assert.equal(rows.length,500);assert.equal(JSON.stringify(ctx.scResult!.faults),before);
});
test('SC presentation memo invalidates model metadata, result identity and source-context replacements',()=>{
 const {ctx}=analysisUiFixture();ctx.ytmStudy=null;ctx.studyOptions=undefined;const first=compactScRows(ctx);assert.equal(compactScRows(ctx),first);
 ctx.network={...ctx.network!,buses:ctx.network!.buses.map(b=>({...b,name:'Yeni ad '+b.sourceId,usage:0}))};const changed=compactScRows(ctx);assert.notEqual(changed,first);assert.ok(changed[0].name.startsWith('Yeni ad'));
 assert.ok(currentScResult(ctx));const revision=ctx.scResult!.engineRevision;ctx.scResult!.engineRevision='INVALID_REVISION';assert.equal(currentScResult(ctx),null);ctx.scResult!.engineRevision=revision;assert.ok(currentScResult(ctx));ctx.scContext={modelHash:'OTHER_MODEL',calculateMode:'MAX',sources:[],audit:[],invalidBranches:[]};assert.equal(currentScResult(ctx),null);
});
test('empty and physical-only view scopes never fabricate unclassified buses or merge nodes',()=>{
 const {ctx}=analysisUiFixture(),rows=compactScRows(ctx);ctx.filters.voltages=allVoltageBands();assert.equal(scScopeRows(ctx,rows).length,0);ctx.resultView.scNodeKind='';assert.equal(scScopeRows(ctx,rows).length,500);ctx.filters.voltages.clear();assert.equal(scScopeRows(ctx,rows).length,0);
});
