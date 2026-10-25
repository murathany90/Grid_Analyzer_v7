/** Reuse private, previously calculated SN4 evidence; never solve or alter physics. */
import {readFile,writeFile} from 'node:fs/promises';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {adaptShortCircuitSources} from '../src/importers/powerfactory-benchmark/short-circuit-source';
import {cleanStudy} from '../src/domain/results/sc-persistence';
import {scSourceContextHash} from '../src/analysis/short-circuit';
import assert from 'node:assert/strict';
import {loadBenchmark} from '../src/importers/powerfactory-benchmark';
import {unzipSync} from 'fflate';
const [studyPath,output='.tmp/sc-ui-perf-private.json']=process.argv.slice(2);
if(!studyPath)throw Error('Usage: supplied-study.json [ignored-output.json]');
const {loaded}=deserialize(await readFile('.tmp/sc-three-phase-native.cache'));
const prior=JSON.parse(await readFile('local-benchmark-results/map-lightning-audit-SN4-cache-private.json','utf8'));
const study=cleanStudy(JSON.parse(await readFile(studyPath,'utf8')))!;
const contexts:Record<string,unknown>={};
for(const [key,mode] of [['scMax','MAX'],['scMin','MIN']] as const){const {result}=JSON.parse(await readFile('.tmp/sc-three-phase-'+mode+'.json','utf8'));assert.equal(result.identity.modelHash,loaded.network.modelHash);const context=adaptShortCircuitSources(loaded.raw,loaded.network,undefined,result.sourceOptions);assert.equal(scSourceContextHash(context),result.identity.sourceHash);contexts[mode]=context;study[key]=result;if(mode==='MAX')study.identity.sourceHashMAX=result.identity.sourceHash;else study.identity.sourceHashMIN=result.identity.sourceHash;}
assert.equal(loaded.network.sites.length,1619);assert.equal(prior.lf.identity.modelHash,loaded.network.modelHash);
const settings=JSON.parse(study.identity.optionsHash).analysisSettings;
const benchmark=await loadBenchmark(new File([await readFile('.local-fixtures/sc-final/reference-combined.zip')],'reference-combined.zip'));
const data={network:loaded.network,benchmark,lf:prior.lf,lfSettings:prior.settings,controlHash:prior.controlHash,controlFile:prior.controlFile,hybrid:prior.hybrid,study,settings,contexts};
await writeFile(output,JSON.stringify(data));
const entries=unzipSync(await readFile('.local-fixtures/sc-final/20261008_1000_SN4_TR0.zip')),names=Object.keys(entries).filter(name=>/\.json$/i.test(name));assert.equal(names.length,1);const nativeBytes=entries[names[0]];assert.equal(createHash('sha256').update(nativeBytes).digest('hex'),loaded.network.modelHash);await writeFile('.tmp/sc-ui-native.json',nativeBytes);
console.log(JSON.stringify({output,sites:loaded.network.sites.length,modelHash:loaded.network.modelHash,scMax:study.scMax!.faults.length,scMin:study.scMin!.faults.length,resultDigest:createHash('sha256').update(JSON.stringify([study.scMax,study.scMin])).digest('hex')}));
