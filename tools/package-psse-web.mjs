/** Package only authored source, local runtime assets and explicitly selected evidence. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {zipSync,unzipSync,strToU8} from 'fflate';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.argv[2]??path.join(os.homedir(),'Downloads','GA_PSSE_NATIVE_WEB_TEST.zip');
const base='70c098a93f6cd34f5f83a3f90701dd9ef5ca5a3f';
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
const entries=Object.create(null),sha=b=>createHash('sha256').update(b).digest('hex');
function add(name,data){if(/(^|\/)\.\.(\/|$)|^[\/\\]|\.(?:sav|raw|rawx|dll|pyd|exe|pyc)$/i.test(name))throw Error('Forbidden distribution entry: '+name);if(entries[name])throw Error('Duplicate distribution entry: '+name);entries[name]=new Uint8Array(data);}
function file(source,target=source){add(target,fs.readFileSync(path.join(root,source)));}
function directory(source,target,select=()=>true){const parent=path.join(root,source);if(!fs.existsSync(parent))return;for(const entry of fs.readdirSync(parent,{withFileTypes:true})){const relative=source+'/'+entry.name,destination=target+'/'+entry.name;if(entry.isDirectory())directory(relative,destination,select);else if(entry.isFile()&&select(relative))file(relative,destination);}}
file('dist-psse/index.html','index.html');file('dist-psse/THIRD_PARTY_LICENSES.txt','THIRD_PARTY_LICENSES.txt');
for(const name of ['SAV_BINARY_RE_SPEC.md','SAV_RAW_PARITY_REPORT.md','GA_INTEGRATION_REPORT.md'])file('docs/'+name,name);
file('docs/PSSE_NATIVE_README_TR.md','README_TR.md');
directory('src/importers/psse','source/src/importers/psse');directory('src/features/psse','source/src/features/psse');directory('src/standalone','source/src/standalone');
for(const name of ['psse-import.worker.ts','psse-protocol.ts','psse-transport.ts'])file('src/workers/'+name,'source/src/workers/'+name);
file('src/importers/model-file.ts','source/src/importers/model-file.ts');file('src/ui/components/dom.ts','source/src/ui/components/dom.ts');
for(const name of ['tokens.css','layout.css','catalog.css','components.css','network-model.css','psse.css'])file('src/styles/'+name,'source/src/styles/'+name);
for(const name of fs.readdirSync(path.join(root,'tests/unit')).filter(n=>n.startsWith('psse-')&&n.endsWith('.test.ts')))file('tests/unit/'+name,'source/tests/unit/'+name);
file('tests/fixtures/psse-synthetic-sav.ts','source/tests/fixtures/psse-synthetic-sav.ts');
for(const name of fs.readdirSync(path.join(root,'tools')).filter(n=>/^(?:psse-|build-psse-|package-psse-|verify-psse-)/.test(n)))file('tools/'+name,'source/tools/'+name);
for(const name of ['package.json','package-lock.json','vite.config.ts','tsconfig.json','.gitattributes'])file(name,'source/'+name);
directory('evidence','evidence');
directory('local-benchmark-results/psse-native-web','validation-private/standalone',name=>/\.(?:png|json)$/.test(name));
directory('local-benchmark-results/psse-ga-integration','validation-private/ga-integration',name=>/\.(?:png|json)$/.test(name));
if(fs.existsSync(path.join(root,'local-benchmark-results/psse-sav-raw-parity-details.json')))file('local-benchmark-results/psse-sav-raw-parity-details.json','validation-private/sav-raw-parity-details.json');
const revisions=git('rev-list','--reverse',base+'..HEAD').toString().trim().split(/\s+/).filter(Boolean);
revisions.forEach((revision,index)=>add(`git/${String(index+1).padStart(2,'0')}-${revision.slice(0,12)}.patch`,git('format-patch','-1',revision,'--stdout')));
const pushFile=path.join(root,'local-benchmark-results/remote-push-result.json');
const metadata={branch:git('branch','--show-current').toString().trim(),base,head:git('rev-parse','HEAD').toString().trim(),remote:git('remote','get-url','origin').toString().trim(),commits:revisions,push:fs.existsSync(pushFile)?JSON.parse(fs.readFileSync(pushFile,'utf8')):{status:'NOT_RECORDED'},runtime:'file:// classic JavaScript + Blob worker; no network/backend/Siemens runtime',privateEvidence:'Included only in this local user delivery; not committed to Git'};
add('git/DELIVERY_METADATA.json',strToU8(JSON.stringify(metadata,null,2)+'\n'));
add('SHA256SUMS.txt',strToU8(Object.entries(entries).map(([name,data])=>`${sha(data)}  ${name}`).sort().join('\n')+'\n'));
const archive=zipSync(entries,{level:6});const check=unzipSync(archive);
for(const [name,data]of Object.entries(entries))if(sha(check[name])!==sha(data))throw Error('ZIP roundtrip mismatch: '+name);
fs.mkdirSync(path.dirname(output),{recursive:true});
if(fs.existsSync(output)&&sha(fs.readFileSync(output))!==sha(archive)){const backup=output.replace(/\.zip$/i,'.previous-'+new Date().toISOString().replace(/[:.]/g,'-')+'.zip');fs.copyFileSync(output,backup);}
fs.writeFileSync(output,archive);const digest=sha(archive);fs.writeFileSync(output+'.sha256',digest+'  '+path.basename(output)+'\n');
console.log(JSON.stringify({output,bytes:archive.byteLength,files:Object.keys(entries).length,sha256:digest,htmlSha256:sha(entries['index.html']),metadata,distributionAudit:'PASS: no SAV/RAW/RAWX/DLL/PYD/EXE/PYC source or Siemens runtime files'}));
