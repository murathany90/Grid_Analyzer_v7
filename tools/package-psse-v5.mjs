/** Public-only V5 delivery; user models and grid screenshots are deliberately excluded. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync,strToU8} from 'fflate';
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.resolve(process.argv[2]??path.join(os.homedir(),'Downloads','GA_PSSE_AC_DGS_MAP_V5_OFFLINE.zip'));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const branch=git('branch','--show-current'),head=git('rev-parse','HEAD');
if(branch!=='fix/psse-v1-real-model-parity')throw Error('Unexpected delivery branch');
const remoteHead=git('ls-remote','origin','refs/heads/'+branch).split(/\s+/)[0];
if(remoteHead!==head)throw Error('Push and verify the packaged source commit first');
if(git('status','--porcelain','--untracked-files=normal'))throw Error('Package only a clean checkout');
const entries=Object.create(null);
function add(name,bytes){if(entries[name]||/^(?:[\\/]|[a-z]:)|(?:^|\/)\.\.(?:\/|$)|\.(?:sav|raw|rawx|dll|pyd|exe|pyc|png|jpg)$/i.test(name))throw Error('Unsafe package entry '+name);entries[name]=new Uint8Array(bytes);}
function file(source,destination=source){add(destination,fs.readFileSync(path.join(root,source)));}
file('dist-psse/index.html','index.html');file('dist-psse/THIRD_PARTY_LICENSES.txt','THIRD_PARTY_LICENSES.txt');
for(const name of ['PSSE_FULL_AC_REFERENCE_PARITY.md','DGS_PSSE_MAP_UI_PARITY.md','MODEL_FIDELITY.md','DGS_REGRESSION.md','AGENT_HANDOFF.md'])file(name);
for(const name of fs.readdirSync(path.join(root,'evidence/psse-v5')).sort())if(/^[a-z0-9_-]+\.(json|log)$/i.test(name)&&!name.includes('initial'))file('evidence/psse-v5/'+name);
const htmlSha256=sha(entries['index.html']),browserChecks={};
for(const channel of ['chrome','msedge']){
 const report=JSON.parse(new TextDecoder().decode(entries[`evidence/psse-v5/browser-e2e-${channel}.json`]));
 if(report.status!=='PASS'||report.artifact?.sha256!==htmlSha256||report.offline.externalRequestCount!==0||report.offline.blockedRequestCount!==0||report.errors.length)throw Error('Browser evidence does not pass on these exact offline bytes: '+channel);
 browserChecks[channel]={status:report.status,version:report.browser.version,artifactMatches:true};
}
const protectedChanges=git('diff','--name-only','c06446764b9cc49863b9b26ba1454607fd362377','--','src/map','src/features/sld','src/analysis/power-flow','src/importers/psse');
if(protectedChanges)throw Error('Protected DGS/native importer sources changed');
const validation=JSON.parse(new TextDecoder().decode(entries['evidence/psse-v5/validation.json']));if(validation.status!=='PASS')throw Error('Final implementation validation is incomplete');
const parity=JSON.parse(new TextDecoder().decode(entries['evidence/psse-v5/reference-parity.json']));
const passed=parity.cases.filter(c=>c.parity?.thresholdsPass).length;
const metadata={schema:'ga.psse.v5.delivery.v1',createdAt:new Date().toISOString(),branch,sourceCommit:head,verifiedRemoteHead:remoteHead,htmlSha256,htmlBytes:entries['index.html'].length,browserChecks,validationStatus:validation.status,electricalAcceptance:passed===parity.cases.length?'THRESHOLDS_PASS_WITH_DOCUMENTED_CONTROL_LIMITATIONS':'PARTIAL',referenceCases:parity.cases.length,referenceThresholdPasses:passed,classificationPolicy:'SOLVED_APPROXIMATE while full source/control validation remains incomplete',protectedSourcesUnchanged:true,privateInputsAndGridScreenshotsIncluded:false};
add('DELIVERY_METADATA.json',strToU8(JSON.stringify(metadata,null,2)+'\n'));
add('README.txt',strToU8(`Grid Analyzer V5 offline\n\nDouble-click index.html in Chrome or Edge. No server, internet, Python or PSS/E runtime is required. Import your own DGS JSON/ZIP or PSS/E SAV/RAW/RAWX/ZIP.\n\nOptional NR control: Analysis advanced options -> IREG/RMPCT. Default legacy approximation is preserved. Numerical convergence and complete physical fidelity are separate. Read PSSE_FULL_AC_REFERENCE_PARITY.md for the remaining reference gap.\n\nBranch: ${branch}\nCommit / verified remote HEAD: ${head}\nHTML SHA-256: ${htmlSha256}\n\nPrivate models, licensed vendor files and actual-grid screenshots are excluded.\n`));
add('SHA256SUMS.txt',strToU8(Object.entries(entries).map(([name,data])=>`${sha(data)}  ${name}`).sort().join('\n')+'\n'));
const archive=zipSync(entries,{level:6}),roundtrip=unzipSync(archive);for(const [name,data]of Object.entries(entries))if(sha(data)!==sha(roundtrip[name]))throw Error('ZIP roundtrip mismatch '+name);
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,archive);fs.writeFileSync(output+'.sha256',sha(archive)+'  '+path.basename(output)+'\n');
console.log(JSON.stringify({status:'PASS',output,bytes:archive.length,files:Object.keys(entries).length,zipSha256:sha(archive),...metadata}));
