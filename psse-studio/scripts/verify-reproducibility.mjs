import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const file='dist/Grid_Analyzer_PSSE_Portable.html',hash=async()=>crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'),before=await hash();
execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});
const after=await hash();if(before!==after)throw Error('BUILD_NOT_REPRODUCIBLE');
await fs.writeFile('evidence/reproducibility.json',JSON.stringify({command:'node scripts/build.mjs',before,after,identical:true},null,2));console.log('Reproducible HTML:',after);
