import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';

const [filename,destination]=process.argv.slice(2);
if(!filename)throw Error('Usage: node tools/verify-psse-uifix3.mjs <archive.zip> [new extraction directory]');
const archive=fs.readFileSync(filename),entries=unzipSync(archive),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const name of ['GridAnalyzer_v7.html','V4_UIFIX3_DGS_MAP_PARITY.md','V4_UIFIX3_REAL_MODEL_E2E.md','DGS_REGRESSION_UIFIX3.md','AGENT_HANDOFF.md','README.txt','THIRD_PARTY_LICENSES.txt','DELIVERY_METADATA.json','SHA256SUMS.txt'])if(!entries[name])throw Error('Required file missing: '+name);
for(const name of Object.keys(entries))if(/^(?:[\\/]|[a-z]:)|[\u0000-\u001f]|\.(?:sav|raw|rawx|dll|pyd|exe|pyc|png|jpe?g|webp)$/i.test(name)||name.replaceAll('\\','/').split('/').includes('..'))throw Error('Private/binary/unsafe distribution entry: '+name);
const manifest=strFromU8(entries['SHA256SUMS.txt']).trim().split('\n');
for(const line of manifest){const digest=line.slice(0,64),name=line.slice(66);if(!entries[name]||sha(entries[name])!==digest)throw Error('Manifest mismatch: '+name);}
if(manifest.length!==Object.keys(entries).length-1)throw Error('Manifest does not cover every payload file.');
const metadata=JSON.parse(strFromU8(entries['DELIVERY_METADATA.json']));
if(metadata.sourceCommit!==metadata.verifiedRemoteHead||metadata.branch!=='fix/psse-v1-real-model-parity'||metadata.htmlSha256!==sha(entries['GridAnalyzer_v7.html']))throw Error('Delivery source/remote/artifact identity mismatch.');
for(const channel of ['chrome','msedge']){const report=JSON.parse(strFromU8(entries[`test-logs/browser-e2e-${channel}.json`]));if(report.artifact.sha256!==metadata.htmlSha256)throw Error('Browser evidence differs from shipped bytes: '+channel);}
let extract=null;
if(destination){extract=path.resolve(destination);if(fs.existsSync(extract))throw Error('Extraction target already exists.');fs.mkdirSync(extract,{recursive:true});for(const [name,bytes]of Object.entries(entries)){const target=path.resolve(extract,name);if(!target.startsWith(extract+path.sep))throw Error('Extraction escaped target.');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}}
console.log(JSON.stringify({status:'PASS',files:Object.keys(entries).length,zipSha256:sha(archive),htmlSha256:metadata.htmlSha256,sourceCommit:metadata.sourceCommit,verifiedRemoteHead:metadata.verifiedRemoteHead,manifestComplete:true,noPrivateModelsRuntimeOrScreenshots:true,extract}));
