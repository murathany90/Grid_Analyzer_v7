/** V3.6 evidence: which real bar-attachment conductors leave their own bay corridor.
 *  Source FID + native terminal + measured path, independent of the renderer. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {connectedStationLayout} from '../src/features/sld/physical-layout';
import {allVoltageBands} from '../src/domain/model/voltage-band';
import type {StationTopologyGraph} from '../src/domain/model/station-topology';

const data=JSON.parse(await readFile(resolve('local-benchmark-results/sld-v34/fixtures-private.json'),'utf8'));
const out=resolve('local-benchmark-results/sld-v36');await mkdir(out,{recursive:true});
const bands=allVoltageBands(),rows:Record<string,unknown>[]=[];
for(const f of data.fixtures as {site:{id:string;name:string};graph:StationTopologyGraph}[]){
 const g=f.graph;let l;try{l=connectedStationLayout(g,bands,false);}catch(e){console.log(f.site.id,'FAILED',(e as Error).message);continue;}
 const barIds=new Set(g.busSections.map(b=>b.id)),rails=new Map(l.sections.map(s=>[s.section.id,s]));
 const corridorOf=(x:number)=>[...l.compartments.values()].find(c=>x>=c.x1&&x<c.x2)??null;
 const routeConductors=l.routes.flatMap(r=>r.wires.map(w=>({owner:`${r.sw.sourceClass}|${r.sw.id}`,bay:r.sw.bayId??'',from:r.sw.from,to:r.sw.to,...w})));
 const equipmentConductors=l.equipment.flatMap(e=>e.ports.flatMap(p=>p.wires.map(w=>({owner:`${e.equipment.sourceClass}|${e.equipment.id}`,bay:e.equipment.id,from:p.terminalId,to:p.terminalId,...w}))));
 for(const c of [...routeConductors,...equipmentConductors]){
  if(!barIds.has(c.terminalId))continue;
  const rail=rails.get(c.terminalId)!;
  const xs=c.points.map(p=>p[0]),ys=c.points.map(p=>p[1]);
  const manhattan=Math.abs((xs.at(-1) as number)-xs[0])+Math.abs((ys.at(-1) as number)-ys[0]);
  const len=c.points.slice(1).reduce((n,p,i)=>n+Math.abs(p[0]-c.points[i][0])+Math.abs(p[1]-c.points[i][1]),0);
  const reachesEnd=xs.some(x=>Math.abs(x-rail.x1)<2||Math.abs(x-rail.x2)<2);
  const leavesCorridor=corridorOf(xs[0])==null||corridorOf(xs.at(-1) as number)==null;
  rows.push({station:f.site.id,owner:c.owner,bay:c.bay,terminal:c.terminalId,from:c.from,to:c.to,railY:rail.y,railX1:rail.x1,railX2:rail.x2,
   startX:xs[0],startY:ys[0],endX:xs.at(-1),endY:ys.at(-1),turns:c.points.length-2,len,manhattan,
   ratio:manhattan?+(len/manhattan).toFixed(2):0,reachesEnd,leavesCorridor,detour:len>6*Math.max(manhattan,1),points:JSON.stringify(c.points)});}}
const envelope=rows.filter(r=>r.detour||r.reachesEnd);
const header='station,owner,bay,nativeTerminal,from,to,railY,railX1,railX2,startX,startY,endX,endY,turns,pathLength,manhattan,ratio,reachesRailEnd,leavesBayCorridor,detour,points';
const body=rows.map(r=>[r.station,r.owner,r.bay,r.terminal,r.from,r.to,r.railY,r.railX1,r.railX2,r.startX,r.startY,r.endX,r.endY,r.turns,r.len,r.manhattan,r.ratio,r.reachesEnd,r.leavesCorridor,r.detour,r.points].join(','));
await writeFile(resolve(out,'bar-connection-wire-evidence.csv'),[header,...body].join('\n'));
await writeFile(resolve(out,'bar-connection-wire-evidence.json'),JSON.stringify(rows,null,2));
console.log('bar-connection conductors:',rows.length,'detour/envelope:',envelope.length);
for(const r of envelope.slice(0,10))console.log(`  ${r.station} ${r.owner} bay=${r.bay} bar=${r.terminal} len=${r.len} manh=${r.manhattan} ratio=${r.ratio} turns=${r.turns} reachesEnd=${r.reachesEnd} leaves=${r.leavesCorridor}`);
const byStation=new Map<string,number>();for(const r of envelope)byStation.set(r.station as string,(byStation.get(r.station as string)??0)+1);
console.log(JSON.stringify(Object.fromEntries(byStation)));