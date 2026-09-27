import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const source=readFileSync('legacy/YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8.html','utf8');
for(const [name,path,exportName,type] of [
  ['TURKEY_OUTLINE','src/map/turkey-outline.ts','turkeyOutline','{type:string;coordinates:number[][][][]}'],
  ['EMBEDDED','src/domain/model/seasonal-reference.ts','seasonalReference','Record<string,[string,number,string,string,number|null,number|null,number|null]>'],
]){
  const line=source.split('\n').find(l=>l.startsWith(`const ${name}=`));
  if(!line)throw Error(`Missing ${name}`);
  const json=line.slice(`const ${name}=`.length).trim().replace(/;$/,'');
  const data=JSON.parse(json);
  mkdirSync(path.slice(0,path.lastIndexOf('/')),{recursive:true});
  writeFileSync(path,`// Static reference asset preserved from v6.8. No uploaded JSON executes as code.\nexport const ${exportName}: ${type} = ${JSON.stringify(data,null,2)};\n`);
}
