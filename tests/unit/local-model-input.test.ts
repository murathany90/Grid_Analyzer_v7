import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {discoverModelArchives,readLocalDgsArchive,summarizeLocalRuns} from '../../tools/local-model-input';

async function temporary(t:TestContext){
 const dir=await mkdtemp(path.join(tmpdir(),'grid-local-model-'));t.after(async()=>{assert.ok(path.basename(dir).startsWith('grid-local-model-'));await rm(dir,{recursive:true,force:true});});return dir;
}
const model=JSON.stringify({ElmTerm:{Attributes:['FID','uknom'],Values:[['T1',154]]}});
test('discovers dynamic study ZIPs, excludes PF ZIPs and reports missing/filter states',async t=>{
 const dir=await temporary(t),folder=path.join(dir,'arbitrary-study_dosyaları');await mkdir(folder);await writeFile(path.join(folder,'arbitrary-study.zip'),zipSync({'arbitrary-study.json':strToU8(model)}));await writeFile(path.join(folder,'reference.zip'),new Uint8Array());
 const found=await discoverModelArchives(dir);assert.equal(found.models.length,1);assert.match(found.models[0],/arbitrary-study.zip$/);assert.equal((await discoverModelArchives(dir,'ABSENT')).reason,'FILTER_NO_MATCH');assert.equal((await discoverModelArchives(path.join(dir,'missing'))).reason,'SOURCE_UNAVAILABLE');
});
test('valid ZIP extraction hashes original DGS bytes without writing files',async t=>{
 const dir=await temporary(t),file=path.join(dir,'study.zip');await writeFile(file,zipSync({'study.json':strToU8(model)}));const r=await readLocalDgsArchive(file);assert.equal(r.status,'READY');if(r.status==='READY'){assert.equal(r.modelHash,createHash('sha256').update(model).digest('hex'));assert.deepEqual(r.raw,JSON.parse(model));}
});
test('rejects ambiguous, unsafe, malformed and reference-only archives',async t=>{
 const dir=await temporary(t),file=path.join(dir,'study.zip');
 for(const entries of [{'one.json':model,'two.json':model},{'../study.json':model},{'study.json':'{'},{'study.json':'{"analysisType":"LF"}'}]){await writeFile(file,zipSync(Object.fromEntries(Object.entries(entries).map(([k,v])=>[k,strToU8(v)]))));await assert.rejects(readLocalDgsArchive(file));}
});
test('LFS pointers are SKIP, corrupt ZIPs are errors',async t=>{
 const dir=await temporary(t),file=path.join(dir,'study.zip');await writeFile(file,'version https://git-lfs.github.com/spec/v1\noid sha256:x\nsize 123\n');assert.equal((await readLocalDgsArchive(file)).status,'SKIP');await writeFile(file,'not zip');await assert.rejects(readLocalDgsArchive(file));
});
test('summary never turns missing, partial or discovery-only execution into PASS',()=>{
 assert.equal(summarizeLocalRuns([]).status,'SKIP');assert.equal(summarizeLocalRuns(['PASS']).status,'PASS');assert.equal(summarizeLocalRuns(['PASS','SKIP']).status,'SKIP');assert.equal(summarizeLocalRuns(['NOT_RUN']).status,'NOT_RUN');assert.equal(summarizeLocalRuns(['PASS','FAIL']).status,'FAIL');
});
test('runner reports SKIP and strict exit 2 without solving unavailable models',async t=>{
 const dir=await temporary(t),run=(strict:string)=>spawnSync(process.execPath,['--import','tsx','tools/full-model.ts'],{cwd:process.cwd(),encoding:'utf8',env:{...process.env,MODEL_ROOT:dir,MODEL_FILTER:'',REQUIRE_MODELS:strict}});
 const normal=run('0');assert.equal(normal.status,0,normal.stderr);assert.match(normal.stdout,/"status":"SKIP"/);const strict=run('1');assert.equal(strict.status,2,strict.stderr);assert.doesNotMatch(strict.stdout,/"status":"PASS"/);
});
