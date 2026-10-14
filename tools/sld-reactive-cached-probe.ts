import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {shuntSymbol,seriesSymbol} from '../src/domain/model/reactive-symbol';
import type {CanonicalNetwork} from '../src/domain/model/network';
import type {StationTopologyGraph} from '../src/domain/model/station-topology';
import {connectedStationLayout} from '../src/features/sld/physical-layout';
import {allVoltageBands} from '../src/domain/model/voltage-band';
// Reuse the verified source graphs. Only presentation metadata is refreshed;
// original FIDs, topology, model inputs and physics remain byte-for-byte intact.
const dir='local-benchmark-results/sld-all-stations';
const {network}:{network:CanonicalNetwork}=JSON.parse(await readFile('local-benchmark-results/sld-v36-kayas-pilot/fixtures-private.json','utf8'));
const fixtures:{site:{id:string;name:string};graph:StationTopologyGraph}[]=JSON.parse(await readFile(dir+'/graphs-private.json','utf8'));
const shunts=new Map(network.shunts.map(e=>[e.id,e])),series=new Map(network.seriesCompensators.map(e=>[e.id,e]));
const report=[];
for(const f of fixtures){const original=f.graph.connections.map(c=>JSON.stringify(c));for(const e of f.graph.equipment){const shunt=e.kind==='shunt'?shunts.get(e.id):null,sc=e.kind==='seriesCompensator'?series.get(e.id):null;
 if(shunt){e.reactiveSymbol=shuntSymbol(shunt);e.typeEvidence=`${e.sourceClass}|${e.id} · ${shunt.stepProvenance??'canonical bPu'} · Q=${shunt.nominalQMvar??shunt.bPu}`;}
 if(sc){e.reactiveSymbol=seriesSymbol(sc);e.typeEvidence=`${e.sourceClass}|${e.id} · canonical xOhm=${sc.xOhm}`;}
}assert.deepEqual(f.graph.connections.map(c=>JSON.stringify(c)),original);
if(!f.graph.equipment.some(e=>e.reactiveSymbol))continue;
for(const labels of [false,true]){try{const layout=connectedStationLayout(f.graph,allVoltageBands(),labels);const elements=layout.equipment.filter(e=>e.equipment.reactiveSymbol);for(const e of elements){assert.equal(e.ports.length,e.nativePorts.length);if(e.equipment.kind==='seriesCompensator'&&e.ports.length===2){assert.notDeepEqual(e.ports[0].point,e.ports[1].point);assert.equal(Math.abs(e.ports[0].point[1]-e.ports[1].point[1]),36);}for(const p of e.ports)assert.deepEqual(p.wires[0].points.at(-1),p.point);}report.push({site:f.site.id,name:f.site.name,labels,status:'PASS',elements:elements.map(e=>({id:e.equipment.id,type:e.equipment.reactiveSymbol,ports:e.ports.map(p=>({terminal:p.terminalId,point:p.point}))}))});}catch(error){report.push({site:f.site.id,labels,status:'FAIL',error:String(error)});}}
}
await writeFile(dir+'/graphs-private.json',JSON.stringify(fixtures));await writeFile(dir+'/reactive-layout-private.json',JSON.stringify(report,null,2));console.log(JSON.stringify({rows:report.length,failures:report.filter(r=>r.status==='FAIL')},null,2));
