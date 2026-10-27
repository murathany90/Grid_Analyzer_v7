import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';
const root=fileURLToPath(new URL('../',import.meta.url)),filename=process.argv[2];
if(!filename)throw Error('Usage: node tools/verify-psse-web-package.mjs <ZIP> [fresh extraction directory]');
const archive=fs.readFileSync(filename),entries=unzipSync(archive),hash=b=>createHash('sha256').update(b).digest('hex');
const reports=entries['AC_ROOT_CAUSE_AND_SOLUTION.md']?['AC_ROOT_CAUSE_AND_SOLUTION.md','PSSE_AC_FDNS_DC_PARITY.md','YTBS_AREA_ZONE_OWNER_MAPPING.md','GEO_COORDINATE_FIT_AUDIT.md','SLD_TM_PARITY.md','DGS_REGRESSION.md']:['SAV_BINARY_RE_SPEC.md','SAV_RAW_PARITY_REPORT.md','GA_INTEGRATION_REPORT.md'];
for(const required of ['index.html','README_TR.md',...reports,'SHA256SUMS.txt','git/DELIVERY_METADATA.json'])if(!entries[required])throw Error('Missing delivery entry: '+required);
const sums=strFromU8(entries['SHA256SUMS.txt']).trim().split('\n');
for(const line of sums){const digest=line.slice(0,64),name=line.slice(66);if(!entries[name]||hash(entries[name])!==digest)throw Error('Manifest mismatch: '+name);}
const extract=path.resolve(process.argv[3]??path.join(root,'private-re','release-smoke-'+Date.now()));
if(fs.existsSync(extract))throw Error('Refusing to overwrite an existing extraction directory');
fs.mkdirSync(extract);
for(const [name,data]of Object.entries(entries)){
 if(/^[\\/]|^[a-z]:|[\u0000-\u001f]|\.(?:dll|pyd|exe|pyc|sav|raw|rawx)$/i.test(name)||name.replaceAll('\\','/').split('/').includes('..'))throw Error('Forbidden or unsafe delivery path: '+name);
 const destination=path.resolve(extract,name);if(!destination.startsWith(extract+path.sep))throw Error('Extraction escaped destination');
 fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,data);
}
const result={status:'PASS',zip:path.resolve(filename),zipSha256:hash(archive),zipBytes:archive.length,files:Object.keys(entries).length,manifestEntries:sums.length,htmlSha256:hash(entries['index.html']),extract,html:path.join(extract,'index.html'),noVendorRuntimeFiles:true};
fs.mkdirSync(path.join(root,'local-benchmark-results'),{recursive:true});fs.writeFileSync(path.join(root,'local-benchmark-results','zip-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
