/** Optional private input audit. No private source data is committed or uploaded. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {DgsModel,type DgsRawData} from '../src/importers/dgs';
import {mapCanonical} from '../src/importers/dgs/canonical';
const input=process.argv[2];if(!input)throw Error('Provide a local SN7 ZIP/JSON path; this audit never uploads the input.');
await mkdir('.tmp',{recursive:true});await mkdir('local-benchmark-results/network-model-workspace',{recursive:true});
const beforePath=resolve('.tmp/dgs-reviewed-before.ts');await writeFile(beforePath,execFileSync('git',['show','837076302b1f0ab2ee2fc9c1b9eecb6b7faa72ad:src/importers/dgs/index.ts']));
const Before=(await import(pathToFileURL(beforePath).href)).DgsModel as typeof DgsModel;
const zip=await readFile(input),bytes=/\.zip$/i.test(input)?Object.entries(unzipSync(zip)).find(([name])=>/\.json$/i.test(name))![1]:zip,raw=JSON.parse(new TextDecoder().decode(bytes)) as DgsRawData;
const before=await new Before(raw,'SN7-independent').build(),after=await new DgsModel(raw,'SN7-independent').build();
const other=(m:DgsModel)=>m.issues.filter(i=>i.kind!=='Geçersiz TM koordinatı'&&!i.code?.startsWith('SITE_COORDINATES_'));assert.deepEqual(other(after),other(before),'all other source issues must remain identical');
const hash=createHash('sha256').update(bytes).digest('hex'),a=mapCanonical(before,hash),b=mapCanonical(after,hash);
for(const key of ['buses','lines','transformers','generators','loads','switches','shunts','stationControllers','externalGrids','seriesCompensators','capabilities'] as const)assert.deepEqual(b[key],a[key],key+' must remain electrically unchanged');
assert.deepEqual(after.sites.map(s=>[s.FID,s.lat,s.lon]),before.sites.map(s=>[s.FID,s.lat,s.lon]));
const missing=after.issues.filter(i=>i.code==='SITE_COORDINATES_MISSING'),proof={records:b.records,sites:b.sites.length,sourceGroups:b.classCounts.ElmSubstat,inputSha256:hash,oldInvalidGroupWarnings:before.issues.filter(i=>i.kind==='Geçersiz TM koordinatı').length,newInvalidGroupWarnings:after.issues.filter(i=>i.kind==='Geçersiz TM koordinatı').length,validSites:after.sites.filter(s=>s.lat!=null&&s.lon!=null).length,missingSites:missing.length,noAttachedGroup:missing.filter(i=>i.evidence?.reason==='NO_ATTACHED_SUBSTATION').length,conflicts:after.issues.filter(i=>i.code==='SITE_COORDINATES_CONFLICT').length,otherSourceIssuesUnchanged:true,electricalCanonicalArraysUnchanged:true,siteCoordinatesUnchanged:true};
assert.equal(proof.records,587301);assert.equal(proof.sites,1625);assert.equal(proof.sourceGroups,4925);assert.equal(proof.oldInvalidGroupWarnings,3150);assert.equal(proof.newInvalidGroupWarnings,0);assert.equal(proof.validSites,1560);assert.equal(proof.missingSites,65);assert.equal(proof.noAttachedGroup,65);assert.equal(proof.conflicts,0);
await writeFile('local-benchmark-results/network-model-workspace/SN7-coordinate-independent-proof.json',JSON.stringify(proof,null,2));console.log('SN7_COORDINATE_AUDIT '+JSON.stringify(proof));

