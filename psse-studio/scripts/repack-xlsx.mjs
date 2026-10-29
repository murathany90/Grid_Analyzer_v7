import fs from 'node:fs/promises';import path from 'node:path';import {unzipSync} from 'fflate';import {zipParts} from '../src/shared/export/archive.js';
const [source,target]=process.argv.slice(2);if(!source||!target||source===target)throw Error('Usage: node scripts/repack-xlsx.mjs input.xlsx separate-output.xlsx');
const sourcePath=await fs.realpath(source),targetPath=await fs.realpath(target).catch(()=>path.resolve(target));if((process.platform==='win32'?sourcePath.toLowerCase()===targetPath.toLowerCase():sourcePath===targetPath))throw Error('Source workbook must not be overwritten.');
const original=await fs.readFile(source),parts=unzipSync(original),compressed=zipParts(Object.entries(parts)),verified=unzipSync(compressed);
if(Object.keys(parts).length!==Object.keys(verified).length)throw Error('XLSX_PART_COUNT_CHANGED');
for(const [name,data]of Object.entries(parts))if(!verified[name]||Buffer.compare(Buffer.from(data),Buffer.from(verified[name]))!==0)throw Error('XLSX_CONTENT_CHANGED:'+name);
await fs.writeFile(target,compressed);console.log(JSON.stringify({sourceBytes:original.length,outputBytes:compressed.length,reductionPct:100*(1-compressed.length/original.length),parts:Object.keys(parts).length,identicalUncompressedParts:true}));
