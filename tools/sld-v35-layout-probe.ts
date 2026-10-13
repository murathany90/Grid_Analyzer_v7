/** V3.5 layout probe: real source graphs, no DOM, no canonical mutation.
 *  Reproduces rail/width/hop/crossing metrics without a browser. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {connectedStationLayout} from '../src/features/sld/physical-layout';
import {feederCellWidth,feederCellDemandOf} from '../src/features/sld/feeder-packing';
import {wireCrossings} from '../src/features/sld/wire-crossings';
import {allVoltageBands} from '../src/domain/model/voltage-band';
import type {StationTopologyGraph} from '../src/domain/model/station-topology';

const data=JSON.parse(await readFile(resolve('local-benchmark-results/sld-v34/fixtures-private.json'),'utf8'));
const out=resolve('local-benchmark-results/sld-v35');await mkdir(out,{recursive:true});
const bands=allVoltageBands(),report:Record<string,unknown>={};
for(const f of data.fixtures as {site:{id:string;name:string};graph:StationTopologyGraph}[]){
 const g=f.graph;let l;try{l=connectedStationLayout(g,bands,false);}catch(e){console.log(`${f.site.id} FAILED: ${(e as Error).message}`);continue;}
 const rails=l.sections.map(s=>({fid:s.section.id,name:s.section.name,kv:s.section.voltageKv,x1:s.x1,x2:s.x2,length:s.x2-s.x1,y:s.y}));
 const conductors=[...l.routes.flatMap(r=>r.wires).map(w=>({terminalId:w.terminalId,points:w.points})),...l.equipment.flatMap(e=>e.ports.flatMap(p=>p.wires).map(w=>({terminalId:w.terminalId,points:w.points})))];
 const crossings=wireCrossings(conductors);
 let barHits=0;for(const c of conductors)for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i];if(a[0]!==b[0])continue;
  for(const r of l.sections){if(c.terminalId===r.section.id)continue;if(a[0]>r.x1+.1&&a[0]<r.x2-.1&&r.y>Math.min(a[1],b[1])+.1&&r.y<Math.max(a[1],b[1])-.1)barHits++;}}
 const barHop=crossings.filter(j=>l.sections.some(r=>Math.abs(r.y-j.y)<=7&&j.x>r.x1&&j.x<r.x2)).length;
 const cells=[...l.compartments.entries()].map(([id,c])=>{const fdr=g.feeders.find(x=>x.id===id)!;const d=feederCellDemandOf(g,fdr,new Set(g.busSections.map(b=>b.id)));
  return {kv:fdr.voltageKv,name:fdr.name,side:c.direction<0?'UP':'DOWN',x1:Math.round(c.x1),x2:Math.round(c.x2),axis:Math.round(c.axis),width:Math.round(c.x2-c.x1),label:Math.round(c.titleY),units:c.units,model:c.model,demand:d,cellWidth:feederCellWidth(l.slotMap.get(id)!,d)};});
 report[f.site.id]={name:f.site.name,width:Math.round(l.width),height:Math.round(l.height),rails,feeders:l.feeders.length,sourceFeeders:g.sourceFeederCount,switches:g.switches.length,conductors:conductors.length,hops:crossings.length,barHop,barHits,cells,hopSamples:crossings.slice(0,14).map(j=>({x:j.x,y:j.y,a:conductors[j.wire].terminalId,b:conductors[j.other].terminalId}))};
}
await writeFile(resolve(out,'layout-private.json'),JSON.stringify(report,null,2));
await writeFile(resolve(out,'bus-fid-rails.csv'),['station,busFID,busName,kV,x1,x2,length,railY,connectionAnchors,unusedRail',
 ...Object.entries(report).flatMap(([id,r])=>(r as any).rails.map((x:any)=>`${id},${x.fid},${x.name},${x.kv},${x.x1},${x.x2},${x.length},${x.y},${(r as any).cells.filter((c:any)=>c.x1<x.x2&&c.x2>x.x1).length},${Math.max(0,...(r as any).cells.filter((c:any)=>c.x1<x.x2&&c.x2>x.x1).map((c:any)=>Math.min(c.x2,x.x2)-Math.max(c.x1,x.x1)))===0}`))].join('\n'));
for(const [id,v]of Object.entries(report)){const r=v as any;
 console.log(`${id} ${r.name}: ${r.width}x${r.height} rails=${r.rails.length} maxRail=${Math.max(...r.rails.map((x:any)=>x.length))} feeders=${r.feeders} switches=${r.switches} hops=${r.hops} barHop=${r.barHop} barHits=${r.barHits}`);
 for(const rail of r.rails)console.log(`    ${rail.fid} ${rail.name} ${rail.kv}kV x1=${rail.x1} x2=${rail.x2} len=${rail.length} y=${rail.y}`);}
for(const id of process.argv.slice(2).filter(a=>report[a])){const r=report[id] as any;console.log('== cells '+id);for(const c of r.cells)console.log(`   ${c.kv}kV ${c.side} ${String(c.name).slice(0,38).padEnd(38)} x=${c.x1}-${c.x2} axis=${c.axis} cell=${c.cellWidth} anchors=${c.demand.barAnchors} roots=${c.demand.branchRoots} tr=${c.demand.parallelWindings} cir=${c.demand.circuitSwitches}`);}