/** UIFIX3 delivery uses an explicit public-file allowlist. Real-model screenshots are never included. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync,strToU8} from 'fflate';

const root=fileURLToPath(new URL('../',import.meta.url)),output=path.resolve(process.argv[2]??path.join(os.homedir(),'Downloads','GA_PSSE_AC_DC_OFFLINE_TEST_FIXED_V4_UIFIX3.zip'));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const branch=git('branch','--show-current'),head=git('rev-parse','HEAD');
if(branch!=='fix/psse-v1-real-model-parity')throw Error('Unexpected delivery branch: '+branch);
const remoteLine=git('ls-remote','origin','refs/heads/'+branch),remoteHead=remoteLine.split(/\s+/)[0];
if(remoteHead!==head)throw Error('Remote HEAD differs from the packaged source commit; push/verify first.');
if(git('status','--porcelain','--untracked-files=normal'))throw Error('Package only a clean reviewed checkout.');
const entries=Object.create(null);
function add(name,bytes){if(entries[name]||/^(?:[\\/]|[a-z]:)|(?:^|\/)\.\.(?:\/|$)|\.(?:sav|raw|rawx|dll|pyd|exe|pyc)$/i.test(name))throw Error('Unsafe or duplicate package entry: '+name);entries[name]=new Uint8Array(bytes);}
function file(source,destination=source){add(destination,fs.readFileSync(path.join(root,source)));}
file('dist-psse/index.html','GridAnalyzer_v7.html');
file('dist-psse/THIRD_PARTY_LICENSES.txt','THIRD_PARTY_LICENSES.txt');
for(const name of ['V4_UIFIX3_DGS_MAP_PARITY.md','V4_UIFIX3_REAL_MODEL_E2E.md','DGS_REGRESSION_UIFIX3.md','AGENT_HANDOFF.md'])file(name);
const evidence=path.join(root,'evidence/psse-uifix3');
if(fs.existsSync(evidence))for(const name of fs.readdirSync(evidence).sort())if(/^[a-z0-9_-]+\.(json|log)$/i.test(name))file('evidence/psse-uifix3/'+name,'test-logs/'+name);
// Browser harness outputs contain true grid coordinates/screens. Only sanitized public JSON/logs above are allowed.
const metadata={schema:'ga.psse.uifix3.delivery.v1',createdAt:new Date().toISOString(),branch,sourceCommit:head,verifiedRemoteHead:remoteHead,htmlSha256:sha(entries['GridAnalyzer_v7.html']),htmlBytes:entries['GridAnalyzer_v7.html'].length,realModelScreenshots:'Private local evidence only; excluded from Git and this archive.',solverScope:'Existing NR/FDNS/DC engines; remote IREG remains incomplete; no new SOLVED_FULL claim.'};
add('DELIVERY_METADATA.json',strToU8(JSON.stringify(metadata,null,2)+'\n'));
add('README.txt',strToU8(`Grid Analyzer V4 UIFIX3\n\nOpen GridAnalyzer_v7.html in Chrome or Edge. No server, internet, Python or PSS/E installation is required. Import your own SAV/RAW/RAWX/ZIP or DGS JSON/ZIP.\n\nBranch: ${branch}\nSource commit / verified remote HEAD: ${head}\nOffline HTML SHA-256: ${metadata.htmlSha256}\n\nReports distinguish executed checks from remaining acceptance items. Numerical convergence and full physical coverage are separate. Private models, Siemens runtime and real grid screenshots are excluded.\n`));
add('SHA256SUMS.txt',strToU8(Object.entries(entries).map(([name,data])=>`${sha(data)}  ${name}`).sort().join('\n')+'\n'));
const archive=zipSync(entries,{level:6}),roundtrip=unzipSync(archive);
for(const [name,data]of Object.entries(entries))if(sha(data)!==sha(roundtrip[name]))throw Error('ZIP roundtrip mismatch: '+name);
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,archive);fs.writeFileSync(output+'.sha256',sha(archive)+'  '+path.basename(output)+'\n');
console.log(JSON.stringify({status:'PASS',output,bytes:archive.length,files:Object.keys(entries).length,zipSha256:sha(archive),...metadata}));
