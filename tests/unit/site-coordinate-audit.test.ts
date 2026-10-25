import test from 'node:test';
import assert from 'node:assert/strict';
import {DgsModel,type DgsRawData} from '../../src/importers/dgs';
import {mapCanonical} from '../../src/importers/dgs/canonical';
import {unifiedQuality,matchesUnifiedFinding} from '../../src/domain/model-quality/unified';
import {allVoltageBands} from '../../src/domain/model/voltage-band';

async function model(groups:unknown[][]){const raw:DgsRawData={ElmNet:{Attributes:['FID','loc_name'],Values:[['A1','Bölge']]},ElmSite:{Attributes:['FID','loc_name','fold_id'],Values:[['S1','TM','A1']]},ElmSubstat:{Attributes:['FID','loc_name','fold_id','GPSlat','GPSlon'],Values:groups}},before=JSON.stringify(raw),m=await new DgsModel(raw,'coordinate-fixture').build();assert.equal(JSON.stringify(raw),before);return m;}
test('one valid attached group suppresses invalid sibling GPS issues without changing GPS inputs',async()=>{
 const m=await model([['G0','Sıfır','S1',0,0],['G1','Geçerli','S1',39.9,32.8],['G2','Boş','S1','','']]);assert.equal(m.sites[0].lat,39.9);assert.equal(m.sites[0].lon,32.8);assert.equal(m.issues.filter(i=>i.code?.startsWith('SITE_COORDINATES')||i.kind==='Geçersiz TM koordinatı').length,0);
});
test('all invalid groups produce exactly one source-linked site issue retained by area/site filters',async()=>{
 const m=await model([['G0','Sıfır','S1',0,0],['G1','Boş','S1','','']]),issues=m.issues.filter(i=>i.code==='SITE_COORDINATES_MISSING');assert.equal(issues.length,1);assert.equal(issues[0].evidence?.reason,'NO_VALID_GROUP_COORDINATES');assert.equal(m.sites[0].lat,null);
 const n=mapCanonical(m,'geo-fixture'),rows=unifiedQuality(n,null).filter(f=>f.code==='SITE_COORDINATES_MISSING');assert.equal(rows.length,1);assert.deepEqual(rows[0].siteIds,['S1']);assert.ok(rows[0].sourceRefs.some(r=>r.sourceClass==='ElmSubstat'&&r.sourceId==='G0'));assert.ok(matchesUnifiedFinding(rows[0],n,{areaId:'A1',siteId:'S1',voltages:allVoltageBands(),search:''}));
});
test('no attached group has an explicit reason and no synthetic location',async()=>{
 const m=await model([]),issue=m.issues.find(i=>i.code==='SITE_COORDINATES_MISSING')!;assert.equal(issue.evidence?.reason,'NO_ATTACHED_SUBSTATION');assert.equal(m.sites[0].lat,null);assert.equal(m.sites[0].lon,null);
});
test('conflicting valid pairs retain first source, angular threshold and explicit Haversine kilometres',async()=>{
 const m=await model([['G1','Bir','S1',39,32],['G2','İki','S1',40,33],['G3','Üç','S1',41,34]]),issues=m.issues.filter(i=>i.code==='SITE_COORDINATES_CONFLICT');assert.equal(issues.length,1);assert.equal(m.sites[0].lat,39);assert.equal(issues[0].evidence?.thresholdUnit,'degree');assert.equal(issues[0].evidence?.distanceMethod,'Haversine');assert.equal(issues[0].evidence?.distanceUnit,'km');const conflicts=issues[0].evidence?.conflicts as {distanceKm:number}[];assert.equal(conflicts.length,2);assert.ok(conflicts[0].distanceKm>100);assert.ok(issues[0].sourceRefs?.some(r=>r.sourceId==='G2'));
});
test('multiple valid groups within the existing threshold produce no conflict',async()=>{const m=await model([['G1','Bir','S1',39,32],['G2','İki','S1',39.05,32.05]]);assert.equal(m.issues.filter(i=>i.code==='SITE_COORDINATES_CONFLICT').length,0);});
