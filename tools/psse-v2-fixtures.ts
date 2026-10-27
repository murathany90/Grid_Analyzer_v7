/** Original public eligibility discriminators, derived from the authored three-bus fixture. */
import fs from 'node:fs';
import path from 'node:path';
import {syntheticRawx} from './psse-synthetic-cases';
export type PsseV2Fixture='pv-no-generator'|'pq-no-generator'|'pv-inactive-generator'|'dc-no-slack'|'dc-island'|'dc-large-core-loss'|'dc-loadtype-tag'|'dc-empty-island';
export function psseV2Fixture(name:PsseV2Fixture):string{
 const data=JSON.parse(syntheticRawx(name==='dc-large-core-loss'?'cm2':'basic'));
 const n=data.network,genBus=n.generator.fields.indexOf('ibus'),genStatus=n.generator.fields.indexOf('stat'),busType=n.bus.fields.indexOf('ide');
 if(name==='dc-loadtype-tag'){
  n.load.data[0][n.load.fields.indexOf('loadtype')]='SYNTH_CLASS';
  return JSON.stringify(data,null,2)+'\n';
 }
 if(name==='dc-empty-island'){
  const extra=[...n.bus.data[1]];extra[n.bus.fields.indexOf('ibus')]=4;extra[n.bus.fields.indexOf('name')]='EMPTY BUS';n.bus.data.push(extra);
  const inactive=[...n.generator.data[1]];inactive[genBus]=4;inactive[genStatus]=0;n.generator.data.push(inactive);
  return JSON.stringify(data,null,2)+'\n';
 }
 if(name==='dc-large-core-loss'){
  const t=n.transformer,at=(field:string)=>t.fields.indexOf(field);
  t.data[0][at('mag1')]=10_000_000;t.data[0][at('mag2')]=.25;t.data[0][at('windv1')]=1.1;t.data[0][at('windv2')]=.97;
  n.bus.data[0][n.bus.fields.indexOf('vm')]=1.2;n.generator.data[0][n.generator.fields.indexOf('vs')]=1.2;
  return JSON.stringify(data,null,2)+'\n';
 }
 if(name==='pv-inactive-generator')n.generator.data.find((row:unknown[])=>row[genBus]===2)[genStatus]=0;
 else n.generator.data=n.generator.data.filter((row:unknown[])=>row[genBus]!==2);
 if(name==='pq-no-generator')n.bus.data[1][busType]=1;
 if(name==='dc-no-slack')n.generator.data.forEach((row:unknown[])=>row[genStatus]=0);
 if(name==='dc-island')n.acline.data=n.acline.data.filter((row:unknown[])=>row[n.acline.fields.indexOf('jbus')]!==3);
 n.caseid.data[n.caseid.fields.indexOf('title2')]=name;
 return JSON.stringify(data,null,2)+'\n';
}
if(process.argv[1]&&path.basename(process.argv[1])==='psse-v2-fixtures.ts'){
 const directory=process.argv[2]??'.tmp/psse-v2-fixtures';fs.mkdirSync(directory,{recursive:true});
 for(const name of ['pv-no-generator','pq-no-generator','pv-inactive-generator','dc-no-slack','dc-island','dc-large-core-loss','dc-loadtype-tag','dc-empty-island'] as PsseV2Fixture[])fs.writeFileSync(path.join(directory,name+'.rawx'),psseV2Fixture(name));
 console.log(directory);
}
