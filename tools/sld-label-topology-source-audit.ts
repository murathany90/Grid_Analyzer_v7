/** Raw DGS -> immutable canonical -> station projection -> emitted SVG contacts. */
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {SaxesParser} from 'saxes';
import {loadBenchmarkModel} from '../src/importers/powerfactory-benchmark/model';
const dir='local-benchmark-results/sld-label-topology',loaded=await loadBenchmarkModel(new File([await readFile('.local-fixtures/powerfactory/SN3/20261007_1400_SN3_TR0.zip')],'SN3.zip'));
const {network,source}=loaded,fixtures=JSON.parse(await readFile('local-benchmark-results/sld-v38/graphs-audited-private.json','utf8')),rows=[],ratings=[];
assert.equal(network.modelHash,JSON.parse(await readFile('local-benchmark-results/map-lightning-audit-SN3-cache-private.json','utf8')).network.modelHash);
for(const id of ['M922','M1055','M1837']){
 const f=fixtures.find((f:any)=>f.site.id===id),xml=await readFile(dir+'/AFTER-'+id+'-LF.svg','utf8'),parser=new SaxesParser(),nodes:Record<string,string>[]=[];
 parser.on('opentag',t=>nodes.push(t.attributes as Record<string,string>));parser.write(xml).close();
 for(const e of f.graph.equipment.filter((e:any)=>['ElmShnt','ElmScap','ElmSind'].includes(e.sourceClass))){
  const raw=source.get(e.sourceClass,e.id)!,fields=['bus1','bus2'].filter(k=>raw[k]!=null&&raw[k]!==''),cubicles=fields.map(k=>({field:k,fid:String(raw[k]),row:source.get('StaCubic',raw[k])})),ends=cubicles.map(c=>String(c.row?.fold_id??'')),canonical=e.sourceClass==='ElmShnt'?network.shunts.find(r=>r.id===e.id):network.seriesCompensators.find(r=>r.id===e.id),canonicalEnds=canonical?('bus'in canonical?[canonical.bus]:[canonical.from,canonical.to]):[],drawn=nodes.find(n=>n['data-equipment-center']&&n['data-id']===e.id&&n['data-class']===e.sourceClass),contacts=JSON.parse(drawn?.['data-source-contacts']??'[]');
  assert.deepEqual(e.terminals,ends,id+'/'+e.id+' raw -> graph');if(canonical)assert.deepEqual(canonicalEnds,ends,id+'/'+e.id+' raw -> canonical');assert.deepEqual(contacts.map((c:any)=>c.terminal),ends,id+'/'+e.id+' graph -> SVG');assert.equal(ends.length,e.sourceClass==='ElmShnt'?1:2);
  if(ends.length===2)assert.notDeepEqual(contacts[0].point,contacts[1].point);
  const bypass=f.graph.switches.filter((s:any)=>ends.length===2&&ends.includes(s.from)&&ends.includes(s.to)&&s.from!==s.to).map((s:any)=>{const r=source.get(s.sourceClass,s.sourceId)!,cubicles=['bus1','bus2'].map(k=>({fid:r[k],terminal:source.get('StaCubic',r[k])?.fold_id})),canonicalSwitch=network.switches.find(q=>q.id===s.id);assert.deepEqual(cubicles.map(c=>c.terminal),[s.from,s.to]);return {id:s.id,from:s.from,to:s.to,rawOnOff:r.on_off,rawOutserv:r.outserv,canonicalClosed:canonicalSwitch?.closed,cubicles,svgState:nodes.find(n=>n['data-id']===s.id&&n['data-physical-switch'])?.['data-state']};});
  rows.push({site:id,id:e.id,sourceClass:e.sourceClass,rawOutserv:raw.outserv,rawCubicles:cubicles.map(c=>({field:c.field,fid:c.fid,terminal:c.row?.fold_id,owner:c.row?.obj_id})),canonicalEnds,graphEnds:e.terminals,svgContacts:contacts,bypass,status:canonical?'PASS':'PARTIAL_DIAGRAM_ONLY'});
 }
 for(const e of f.graph.equipment.filter((e:any)=>e.sourceClass==='ElmTr2')){const raw=source.get('ElmTr2',e.id)!,type=source.get('TypTr2',raw.typ_id),tr=network.transformers.find(t=>t.id===e.id);if(tr?.ratingMva!=null)assert.equal(tr.ratingMva,Number(type?.strn));ratings.push({site:id,id:e.id,type:raw.typ_id,rawMva:type?.strn,canonicalMva:tr?.ratingMva??null});}
}
const report={modelHash:network.modelHash,snapshot:'20261007_1400_SN3_TR0.zip',referenceParity:'LAYOUT_ONLY_DIFFERENT_SNAPSHOT_AND_SCENARIO',rows,ratings,sourceIssueSites:fixtures.filter((f:any)=>f.graph.issues.length).length,sourceIssues:fixtures.reduce((n:number,f:any)=>n+f.graph.issues.length,0)};
assert.equal(report.sourceIssueSites,31);assert.equal(report.sourceIssues,60);
await writeFile(dir+'/SOURCE_CONTACT_AUDIT-private.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,ratings:undefined},null,2));
