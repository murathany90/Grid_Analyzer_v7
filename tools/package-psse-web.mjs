/** Package only authored source, local runtime assets and explicitly selected evidence. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {zipSync,unzipSync,strToU8} from 'fflate';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.resolve(process.argv[2]??path.join(os.homedir(),'Downloads','GA_PSSE_AC_DC_OFFLINE_TEST.zip'));
const base='6ed2aaf527ea245948ffe7344bc6d7c73b63b389';
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
const entries=Object.create(null),sha=b=>createHash('sha256').update(b).digest('hex');
function add(name,data){if(/(^|\/)\.\.(\/|$)|^[\/\\]|\.(?:sav|raw|rawx|dll|pyd|exe|pyc)$/i.test(name))throw Error('Forbidden distribution entry: '+name);if(entries[name])throw Error('Duplicate distribution entry: '+name);entries[name]=new Uint8Array(data);}
function file(source,target=source){add(target,fs.readFileSync(path.join(root,source)));}
function directory(source,target,select=()=>true){const parent=path.join(root,source);if(!fs.existsSync(parent))return;for(const entry of fs.readdirSync(parent,{withFileTypes:true})){const relative=source+'/'+entry.name,destination=target+'/'+entry.name;if(entry.isDirectory())directory(relative,destination,select);else if(entry.isFile()&&select(relative))file(relative,destination);}}
file('dist-psse/index.html','index.html');file('dist-psse/THIRD_PARTY_LICENSES.txt','THIRD_PARTY_LICENSES.txt');
for(const name of ['AGENT_HANDOFF.md','ARCHITECTURE_DECISIONS.md','DGS_REGRESSION_REPORT.md','MODEL_FIDELITY_REPORT.md','PERFORMANCE_REPORT.md','PSSE_SOLVER_RESEARCH.md','PSSE_AC_DC_PARITY_REPORT.md'])file(name,name);
file('docs/PSSE_NATIVE_README_TR.md','README_TR.md');
directory('src','source/src',name=>/\.(?:ts|mts|css|svg|mjs)$/i.test(name)||/(?:^|\/)(?:LICENSE|LICENSE\.txt|THIRD_PARTY_LICENSES\.txt)$/i.test(name));
directory('licenses','source/licenses',name=>/-LICENSE(?:\.txt)?$/i.test(name));
for(const name of fs.readdirSync(path.join(root,'tests/unit')).filter(n=>n.startsWith('psse-')&&n.endsWith('.test.ts')))file('tests/unit/'+name,'source/tests/unit/'+name);
for(const name of fs.readdirSync(path.join(root,'tests/fixtures')).filter(n=>n.startsWith('psse-')&&n.endsWith('.ts')))file('tests/fixtures/'+name,'source/tests/fixtures/'+name);
file('tests/fixtures/small-dgs.json','source/tests/fixtures/small-dgs.json');
for(const name of ['build-psse-web.mjs','package-psse-web.mjs','psse-synthetic-cases.ts','psse-offline-browser.mjs','psse-native-mode-browser.mjs','psse-diagrams-browser.mjs','psse-diagrams-harness.html','psse-diagrams-harness.ts','psse-parity.ts','psse-parity-report.py','psse-reference.py','psse_reference_io.py','psse-reference-index.py','psse-dc-contraction-experiment.ts','psse-dc-diagnostic.ts','psse-fixed-q-diagnostic.py','psse-q-state-reference.py','psse-threshold-metadata.py','psse-pqbrak-metadata.py','psse-generate-sav.py'])if(fs.existsSync(path.join(root,'tools',name)))file('tools/'+name,'source/tools/'+name);
directory('evidence/psse-ac-dc','evidence/psse-ac-dc',name=>/\.(?:json|png|log)$/i.test(name));
directory('local-benchmark-results/psse-offline-browser','evidence/offline-browser',name=>/\.(?:json|png)$/i.test(name));
for(const name of ['package.json','package-lock.json','vite.config.ts','tsconfig.json','.gitattributes'])file(name,'source/'+name);
const revisions=git('rev-list','--reverse',base+'..HEAD').toString().trim().split(/\s+/).filter(Boolean);
revisions.forEach((revision,index)=>add(`git/${String(index+1).padStart(2,'0')}-${revision.slice(0,12)}.patch`,git('format-patch','-1',revision,'--stdout')));
const pushFile=path.join(root,'local-benchmark-results/remote-push-result.json');
const branch=git('branch','--show-current').toString().trim(),head=git('rev-parse','HEAD').toString().trim();let push={status:'NOT_RECORDED'};if(fs.existsSync(pushFile)){try{const saved=JSON.parse(fs.readFileSync(pushFile,'utf8'));if(saved.branch===branch&&saved.head===head)push=saved;}catch{}}
const metadata={branch,base,head,remote:git('remote','get-url','origin').toString().trim(),commits:revisions,push,runtime:'file:// offline IIFE + Blob workers; CSP network access disabled; no backend/Siemens runtime',privateEvidence:'No private/licensed models, executable runtime, or raw model dumps are included'};
add('git/DELIVERY_METADATA.json',strToU8(JSON.stringify(metadata,null,2)+'\n'));
add('SHA256SUMS.txt',strToU8(Object.entries(entries).map(([name,data])=>`${sha(data)}  ${name}`).sort().join('\n')+'\n'));
const archive=zipSync(entries,{level:6});const check=unzipSync(archive);
for(const [name,data]of Object.entries(entries))if(sha(check[name])!==sha(data))throw Error('ZIP roundtrip mismatch: '+name);
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,archive);const digest=sha(archive);fs.writeFileSync(output+'.sha256',digest+'  '+path.basename(output)+'\n');
console.log(JSON.stringify({output,bytes:archive.byteLength,files:Object.keys(entries).length,sha256:digest,htmlSha256:sha(entries['index.html']),metadata,distributionAudit:'PASS: no SAV/RAW/RAWX/DLL/PYD/EXE/PYC source or Siemens runtime files'}));
