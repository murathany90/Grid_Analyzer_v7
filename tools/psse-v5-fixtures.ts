/** Original small control fixtures; no user network or vendor source is included. */
import {syntheticRawx} from './psse-synthetic-cases';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
type Row=Record<string,string|number|null>;
const table=(rows:Row[])=>{const fields=[...new Set(rows.flatMap(row=>Object.keys(row)))];return{fields,data:rows.map(row=>fields.map(field=>row[field]??null))};};
function rows(value:{fields:string[];data:unknown[][]}):Row[]{return value.data.map(row=>Object.fromEntries(value.fields.map((field,i)=>[field,row[i]]))as Row);}
export function controlFixture(name:string){
 const raw=JSON.parse(syntheticRawx('basic')),network=raw.network,buses=rows(network.bus),generators=rows(network.generator),lines=rows(network.acline);
 generators[1].ireg=3;generators[1].vs=1.01;
 if(name.startsWith('remote-infeed')){generators[1].wmod=4;generators[1].qg=5;if(name.endsWith('-mixed'))generators.push({...generators[1],machid:'2',wmod:3,wpf:1,pg:0,qg:0,qt:0,qb:0});}
 if(name==='remote-limit'){generators[1].qt=5;generators[1].qb=-5;generators[1].vs=1.08;}
 if(name.startsWith('remote-shared')){
  buses.push({...buses[1],ibus:4,name:'SYNTH 4'});generators[1].pg=40;generators[1].rmpct=70;
  generators.push({...generators[1],ibus:4,pg:20,qt:150,qb:-50,rmpct:30});lines.push({...lines[1],ibus:4,jbus:3},{...lines[0],ibus:1,jbus:4});
  if(name.endsWith('-fixed')){generators[1].pg=30;generators.push({...generators[1],machid:'2',pg:10,qg:20,wmod:4});}
 }
 if(name.startsWith('remote-multi-machine')){
  Object.assign(generators[1],{pg:30,qt:80,qb:-20});generators.push({...generators[1],machid:'2',qt:120,qb:-80});
  if(name.endsWith('-mbase'))generators[2].mbase=200;
  if(name.endsWith('-pg')){generators[1].pg=20;generators[2].pg=40;}
 }
 if(name.startsWith('droop-')){
  const vs=name==='droop-low'||name==='droop-limit'?.94:name==='droop-high'?1.08:1.04;buses[0].vm=vs;generators[0].vs=vs;
  generators[1].droopname='SYNTH_QV';generators[1].wmod=1;generators[1].qt=200;generators[1].qb=-200;
  if(name==='droop-limit'){generators[1].qt=10;generators[1].qb=-10;}
  network.voltagedroop=table([{name:'SYNTH_QV',status:1,regbus:3,qdb:0,qmin:-80,qmax:100,vdblow:.98,vdbhigh:1.02,vlow:.9,vhigh:1.1}]);
  // Radial plant feeder is required: removing the PCC feeder must isolate the controlled plant.
  lines.splice(0,1);
 }
 network.bus=table(buses);network.generator=table(generators);network.acline=table(lines);return JSON.stringify(raw,null,2)+'\n';
}
export const CONTROL_FIXTURES=['remote-single','remote-infeed','remote-infeed-mixed','remote-shared','remote-shared-fixed','remote-multi-machine','remote-multi-machine-mbase','remote-multi-machine-pg','remote-limit','droop-low','droop-deadband','droop-high','droop-limit'];
if(process.argv[1]?.replaceAll('\\','/').endsWith('/psse-v5-fixtures.ts')){const directory=process.argv[2]??'.tmp/psse-v5-fixtures';mkdirSync(directory,{recursive:true});for(const name of CONTROL_FIXTURES)writeFileSync(path.join(directory,name+'.rawx'),controlFixture(name));console.log(JSON.stringify({directory,fixtures:CONTROL_FIXTURES}));}
