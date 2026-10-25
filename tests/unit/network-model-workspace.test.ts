import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DgsModel} from '../../src/importers/dgs';
import {mapCanonical} from '../../src/importers/dgs/canonical';
import {auditModelQuality} from '../../src/domain/model-quality';
import {unifiedQuality,matchesUnifiedFinding} from '../../src/domain/model-quality/unified';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
import {modelRoute,modelTab} from '../../src/features/model/workspace-state';
import {fetchCatalogAll,fetchMergedPage} from '../../src/features/catalog';
import type {AppContext} from '../../src/app/contracts';

async function fixture(){return mapCanonical(await new DgsModel(JSON.parse(await readFile('tests/fixtures/small-dgs.json','utf8')),'public-model').build(),'public-workspace');}
test('unified quality preserves all source warnings, exact origins and canonical inputs',async()=>{
 const original=await fixture(), warning=Array.from({length:80},(_,i)=>'Source warning '+i),n={...original,warnings:warning,diagnostics:[]},before=JSON.stringify(n),audit=auditModelQuality(n),rows=unifiedQuality(n,audit);
 assert.equal(rows.filter(f=>f.code==='SOURCE_WARNING').length,80);
 assert.equal(JSON.stringify(n),before);
 const q=rows.find(f=>f.code==='GENERATOR_Q_LIMITS_MISSING');assert.ok(q);assert.equal(q.normalizedValue,null);assert.ok(q.entityId);
 const merged=unifiedQuality({...n,diagnostics:[{code:q.code,severity:'WARNING',sourceClass:q.entityClass!,sourceId:q.entityId!,message:q.message}]},audit).filter(f=>f.code===q.code&&f.entityId===q.entityId);
 assert.equal(merged.length,1);assert.deepEqual(merged[0].origins,['AUDIT','SOURCE']);assert.equal(merged[0].evidence.length,2);
 assert.deepEqual(unifiedQuality(n,{...audit,modelHash:'another-model'}).filter(f=>f.origins.includes('AUDIT')),[]);
});
test('tap fallback links only proven FIDs; unbound aggregates never acquire guessed equipment',async()=>{
 const base=await fixture(),id=base.transformers[0].id,n={...base,warnings:[],diagnostics:[{code:'TRANSFORMER_TAP_FALLBACK',sourceClass:'ElmTr2',severity:'WARNING' as const,message:'Aggregate fallback'}],sourceFidelity:{...base.sourceFidelity!,transformerTapFallbackIds:[id]}},rows=unifiedQuality(n,null),tap=rows.filter(f=>f.code==='TRANSFORMER_TAP_FALLBACK');
 assert.equal(tap.length,1);assert.equal(tap[0].entityId,id);assert.equal(tap[0].cause,'CONVERSION');assert.equal(tap[0].sourceRefs[0].sourceId,id);
 const unbound=unifiedQuality({...n,sourceFidelity:{...n.sourceFidelity,transformerTapFallbackIds:[]}},null).find(f=>f.code==='TRANSFORMER_TAP_FALLBACK')!;
 assert.equal(unbound.entityId,null);assert.deepEqual(unbound.sourceRefs,[]);
 const filters={areaId:'',siteId:'',search:'',voltages:allVoltageBands()};assert.equal(matchesUnifiedFinding(unbound,n,filters),true);assert.equal(matchesUnifiedFinding(unbound,n,{...filters,siteId:n.sites[0].id}),false);
});
test('geographical gaps remain informational and separate from electrical audit',async()=>{
 const base=await fixture(),n={...base,sites:base.sites.map(s=>({...s,lat:null,lon:null})),lines:base.lines.map(l=>({...l,coordinates:[]}))},rows=unifiedQuality(n,auditModelQuality(n));
 assert.equal(rows.filter(f=>f.code==='SITE_COORDINATES_MISSING').length,n.sites.length);
 assert.ok(rows.filter(f=>f.category==='GEOGRAPHY').every(f=>f.severity==='INFO'&&f.origins.includes('GEOGRAPHY')));
 const first=rows.find(f=>f.code==='SITE_COORDINATES_MISSING')!;assert.deepEqual(first.siteIds,[first.entityId]);
});
test('legacy navigation keeps one parent and four distinct model tabs',()=>{
 assert.deepEqual(modelRoute('model:quality'),{view:'model',tab:'quality'});assert.equal(modelTab({view:'inventory',networkModelTab:'quality'}),'inventory');assert.equal(modelTab({view:'operating'}),'operating');assert.equal(modelTab({view:'model',networkModelTab:'summary'}),'summary');assert.deepEqual(modelRoute('sld'),{view:'sld'});
});
test('source coordinate issues retain explicit source FIDs and tap text is not counted twice',async()=>{
 const base=await fixture(),id=base.transformers[0].id,n={...base,sourceFidelity:{...base.sourceFidelity!,transformerTapFallbackIds:[id]},diagnostics:[{code:'TRANSFORMER_TAP_FALLBACK',sourceClass:'ElmTr2',severity:'WARNING' as const,message:'Tap fallback'}],warnings:[`Trafo kademe oranı çözülemedi; 1.0: ${id}`,'[Uyarı] ElmSubstat G1: Geçersiz TM koordinatı — 0, 0']};
 const rows=unifiedQuality(n,null),tap=rows.filter(f=>f.code==='TRANSFORMER_TAP_FALLBACK'),geo=rows.find(f=>f.code==='SOURCE_COORDINATES_INVALID')!;
 assert.equal(tap.length,1);assert.equal(tap[0].evidence.length,2);assert.equal(rows.filter(f=>f.code==='SOURCE_WARNING').length,0);
 assert.equal(geo.category,'GEOGRAPHY');assert.equal(geo.entityClass,'ElmSubstat');assert.equal(geo.entityId,'G1');assert.deepEqual(geo.siteIds,[]);assert.equal(geo.sourceRefs[0].field,'GPSlat/GPSlon');
});
test('catalog export and merged pages stop after scope invalidation',async()=>{
 let calls=0,current=true;const ctx={catalog:async()=>{calls++;current=false;return {total:250,rows:[],attributes:[]};}} as unknown as AppContext;
 await assert.rejects(fetchCatalogAll(ctx,'ElmLod',{},100,()=>current),/CATALOG_SCOPE_CHANGED/);assert.equal(calls,1);
 calls=0;current=true;await assert.rejects(fetchMergedPage(ctx,['ElmLod'],{},0,20,()=>current),/CATALOG_SCOPE_CHANGED/);assert.equal(calls,1);
});
