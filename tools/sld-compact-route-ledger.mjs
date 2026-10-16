/** Offline FID/route ledger. Reads saved SVGs; never reloads or solves a model. */
import {readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {SaxesParser} from 'saxes';
import {inspectPilotSvg} from './sld-v36-pilot-oracle.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];},dir=resolve('local-benchmark-results/sld-compact-controlled'),reference=resolve(arg('--reference-dir','local-benchmark-results/sld-compact-final')),privateRoot=resolve(arg('--private-root','.'));
const ids=['M892','M889','M1482','M922','M1388'],fixtures=JSON.parse(await readFile(resolve(privateRoot,'local-benchmark-results/sld-v38/graphs-audited-private.json'),'utf8')).filter(f=>ids.includes(f.site.id));
const parse=xml=>{const stack=[],paths=[],ports=[],equipment=[],switches=[];const parser=new SaxesParser();parser.on('opentag',t=>{const a=t.attributes,parent=stack.at(-1),owner=a['data-id']?a:parent?.owner;stack.push({owner,attrs:a});
 if(a['data-port'])ports.push({id:a['data-port'],semantics:a['data-semantic']});
 if(t.name==='circle'&&parent?.attrs['data-port'])Object.assign(ports.find(p=>p.id===parent.attrs['data-port']),{x:+a.cx,y:+a.cy});
 if(a['data-equipment-center'])equipment.push(a);if(a['data-physical-switch'])switches.push(a);
 if(a['data-connection']&&a['data-native-terminal'])paths.push({owner:owner?.['data-id'],...a});
 });parser.on('closetag',()=>stack.pop());parser.write(xml).close();return{ports,equipment,switches,paths};};
const segments=d=>{let prior;const result=[];for(const m of d.matchAll(/([ML])([\d.-]+),([\d.-]+)/g)){const p=[+m[2],+m[3]];if(m[1]==='L'&&prior)result.push([prior,p]);prior=p;}return result;};
const metrics=d=>{const s=segments(d),start=s[0]?.[0],end=s.at(-1)?.[1],length=s.reduce((sum,[a,b])=>sum+Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),0),manhattan=start&&end?Math.abs(start[0]-end[0])+Math.abs(start[1]-end[1]):0;return{segments:s.length,length,manhattan,ratio:manhattan?length/manhattan:null,start,end};};
const all=[],inventory=[],contactChecks=[],electrical=[];
for(const fixture of fixtures){const graph=fixture.graph,versions={};for(const [v,base,prefix]of [['MAIN',reference,'MAIN'],['BEFORE',reference,'BEFORE'],['FAILED_WIP',reference,'AFTER'],['CURRENT',dir,'AFTER']]){
 const drawing=parse(await readFile(resolve(base,prefix+'-'+fixture.site.id+'.svg'),'utf8'));versions[v]=drawing;
 for(const f of graph.feeders){const equipmentKeys=new Set(f.equipmentKeys),owned=new Set([...f.switchIds,...graph.equipment.filter(e=>equipmentKeys.has(e.sourceClass+'|'+e.id)).map(e=>e.id)]),paths=drawing.paths.filter(p=>owned.has(p.owner)).map(p=>({owner:p.owner,terminal:p['data-native-terminal'],side:p['data-contact-side']??'EQUIPMENT',equipmentContact:p['data-equipment-contact']??null,sourcePath:p['data-source-conductor']??p.d,visiblePath:p.d,source:metrics(p['data-source-conductor']??p.d),visible:metrics(p.d),captionPass:p['data-caption-pass']??null}));
  all.push({version:v,site:fixture.site.id,feeder:f.id,name:f.name,voltageKv:f.voltageKv,nativePorts:drawing.ports.filter(p=>f.terminalIds.includes(p.id)),switches:drawing.switches.filter(s=>f.switchIds.includes(s['data-id'])).map(s=>({id:s['data-id'],from:s['data-from'],to:s['data-to'],state:s['data-state'],contactIn:s['data-contact-in'],contactOut:s['data-contact-out']})),paths,length:paths.reduce((n,p)=>n+p.source.length,0),segments:paths.reduce((n,p)=>n+p.source.segments,0)});
 }
 }
 const oracle=inspectPilotSvg(await readFile(resolve(dir,'AFTER-'+fixture.site.id+'.svg'),'utf8'),graph,'all');electrical.push({site:fixture.site.id,errors:oracle.errors,overlap:oracle.overlap,foreignTouches:oracle.foreignTouches});
 const source=d=>JSON.stringify([d.switches.map(s=>[s['data-physical-switch'],s['data-from'],s['data-to'],s['data-state']]).sort(),d.equipment.map(e=>[e['data-class'],e['data-id'],e['data-terminals']]).sort()]);
 inventory.push({site:fixture.site.id,unchanged:['MAIN','FAILED_WIP','CURRENT'].every(v=>source(versions[v])===source(versions.BEFORE))});
 for(const e of graph.equipment.filter(e=>['transformer','transformer3w'].includes(e.kind))){const offsets=v=>{const item=versions[v].equipment.find(q=>q['data-id']===e.id),center=item?.['data-equipment-center'].split(',').map(Number);return versions[v].paths.filter(p=>p.owner===e.id&&p['data-equipment-contact']).map(p=>{const contact=p['data-equipment-contact'].split(',').map(Number);return{terminal:p['data-native-terminal'],offset:[contact[0]-center[0],contact[1]-center[1]]};}).sort((a,b)=>a.terminal.localeCompare(b.terminal));};
  const before=offsets('BEFORE'),current=offsets('CURRENT');contactChecks.push({site:fixture.site.id,id:e.id,before,current,unchanged:JSON.stringify(before)===JSON.stringify(current)});
 }
}
await writeFile(resolve(dir,'FEEDER-ROUTES-private.json'),JSON.stringify(all,null,2));
const csv=['version,site,feeder,voltage_kV,source_segments,source_length,wire_owner,native_terminal,side,path_segments,path_length,Manhattan,ratio'];
for(const f of all)for(const p of f.paths)csv.push([f.version,f.site,f.feeder,f.voltageKv,f.segments,f.length,p.owner,p.terminal,p.side,p.source.segments,p.source.length,p.source.manhattan,p.source.ratio??''].join(','));
await writeFile(resolve(dir,'FEEDER-ROUTES-private.csv'),csv.join('\n'));
await writeFile(resolve(dir,'NATIVE-CONTACTS-private.json'),JSON.stringify({inventory,contactChecks},null,2));
await writeFile(resolve(dir,'ELECTRICAL-private.json'),JSON.stringify(electrical,null,2));
console.log(JSON.stringify({inventory,transformerContacts:contactChecks.length,contactsUnchanged:contactChecks.every(r=>r.unchanged),perFeederRows:all.length,worstCurrent:all.filter(r=>r.version==='CURRENT').sort((a,b)=>b.length-a.length).slice(0,8).map(r=>({site:r.site,feeder:r.feeder,length:r.length,segments:r.segments,maxRatio:Math.max(...r.paths.map(p=>p.source.ratio??0))}))},null,2));
