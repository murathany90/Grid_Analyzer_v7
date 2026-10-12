/** Source/diagram equivalence audit. Private model/SVGs stay local; no solver call. */
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SaxesParser} from 'saxes';
import {buildStationTopologyGraph,type StationSources} from '../src/domain/model/station-topology';
import {buildTopology} from '../src/topology/electrical-topology';
import type {CanonicalNetwork} from '../src/domain/model/network';
import type {CatalogRow} from '../src/app/contracts';
const [input,out='local-benchmark-results/sld-v2-20261013']=process.argv.slice(2);if(!input)throw Error('Usage: private-fixtures.json [output-dir]');
const data=JSON.parse(await readFile(input,'utf8')) as {network:CanonicalNetwork;fixtures:{site:{id:string};sources:StationSources;raw:Record<string,CatalogRow[]>}[]};
function nodes(xml:string){const rows:Record<string,string>[]=[];const p=new SaxesParser();p.on('opentag',tag=>{if(tag.name==='g'&&tag.attributes['data-id'])rows.push(tag.attributes as Record<string,string>);});p.write(xml).close();return rows;}
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');const baseline=buildTopology(data.network),report=[];
for(const id of ['M1583','M1301','M56']){
 const fixture=data.fixtures.find(f=>f.site.id===id)!;assert.ok(fixture);const graph=buildStationTopologyGraph(data.network,id,fixture.sources),before=nodes(await readFile(join(out,`BASELINE-${id}.svg`),'utf8')),after=nodes(await readFile(join(out,`CURRENT-${id}.svg`),'utf8'));
 const switches=after.filter(g=>g['data-physical-switch']),keys=switches.map(g=>g['data-physical-switch']);assert.equal(new Set(keys).size,keys.length);assert.equal(keys.length,graph.switches.length);
 for(const sw of graph.switches){const glyph=switches.find(g=>g['data-physical-switch']===`${sw.sourceClass}|${sw.sourceId}`)!;assert.ok(glyph);assert.equal(glyph['data-from'],sw.from);assert.equal(glyph['data-to'],sw.to);const source=(fixture.raw[sw.sourceClass]??[]).find(s=>s.id===sw.sourceId);assert.ok(source);if(sw.sourceClass==='ElmCoup')for(const [field,terminal]of [['bus1',sw.from],['bus2',sw.to]]){const cubicle:CatalogRow|undefined=fixture.raw.StaCubic.find(row=>row.id===String(source.attributes[field]));assert.equal(String(cubicle?.attributes.fold_id??''),terminal);}}
 const reconstructed={...data.network,switches:data.network.switches.map(sw=>{const glyph=switches.find(g=>g['data-physical-switch']===`${sw.sourceClass}|${sw.sourceId}`);return glyph?{...sw,from:glyph['data-from'],to:glyph['data-to'],closed:glyph['data-state']==='CLOSED',inService:glyph['data-state']!=='OUT_OF_SERVICE'}:sw;})};
 assert.deepEqual(buildTopology(reconstructed),baseline);const tr=after.filter(g=>g['data-class']==='ElmTr2');for(const g of tr){const native=data.network.transformers.find(t=>t.id===g['data-id'])!;assert.ok(native);assert.equal(g['data-hv-terminal'],native.from);assert.equal(g['data-lv-terminal'],native.to);const raw=fixture.raw.ElmTr2.find(t=>t.id===native.sourceId)!;assert.equal(fixture.raw.StaCubic.find(c=>c.id===String(raw.attributes.bushv))?.attributes.fold_id,native.from);assert.equal(fixture.raw.StaCubic.find(c=>c.id===String(raw.attributes.buslv))?.attributes.fold_id,native.to);}
 const duplicateBefore=before.filter(g=>['ElmCoup','StaSwitch'].includes(g['data-class'])).length-new Set(before.filter(g=>['ElmCoup','StaSwitch'].includes(g['data-class'])).map(g=>g['data-class']+'|'+g['data-id'])).size;
 report.push({station:id,physicalSwitches:keys.length,duplicateBefore,duplicateAfter:0,connections:graph.connections.length,counters:graph.counters,transformers:tr.map(g=>g['data-id']),topologyHash:digest(baseline.buses.map(b=>[b.id,b.terms])),equivalence:'PASS',nativeCubicleEndpoints:'PASS'});
}
const specific=['C96797','C96796','C97000','C69217','C69216','C109126','C69420'],m1301=nodes(await readFile(join(out,'CURRENT-M1301.svg'),'utf8'));for(const id of specific)assert.equal(m1301.filter(g=>g['data-physical-switch']===`ElmCoup|${id}`).length,1);
assert.ok(data.network.transformers.some(t=>t.siteIds.includes('M56')&&t.vnKv===400&&t.lvKv===154));await writeFile(join(out,'connectivity-private-proof.json'),JSON.stringify({report,sevenspecific:specific,status:'PASS',noCalculationExecuted:true},null,2));console.log(JSON.stringify(report));
