/** Development-only native-oracle companion. Not imported by the browser app.
 * Invocation is owned by psse-sav-native-oracle.py; outputs stay in private-re.
 */
import fs from 'node:fs';
import {decodeSav} from '../src/importers/psse/sav';
const jobs=JSON.parse(fs.readFileSync(process.argv[2],'utf8')) as {path:string;output:string}[];
for(const job of jobs){
 const bytes=fs.readFileSync(job.path),model=decodeSav(bytes,job.path.split(/[\\/]/).at(-1)!);
 fs.writeFileSync(job.output,JSON.stringify({source:model.source,case:{baseMva:model.case.baseMva},equipment:model.equipment}));
}
