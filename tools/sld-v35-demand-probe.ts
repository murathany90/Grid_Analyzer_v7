/** V3.5 measurement: how much horizontal room each real feeder bay actually needs. */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {feederDrawingPath} from '../src/features/sld/feeder-drawing-graph';
import type {StationTopologyGraph} from '../src/domain/model/station-topology';

const data=JSON.parse(await readFile(resolve('local-benchmark-results/sld-v34/fixtures-private.json'),'utf8'));
for(const f of data.fixtures as {site:{id:string;name:string};graph:StationTopologyGraph}[]){
 const g=f.graph,sections=new Set(g.busSections.map(b=>b.id));
 console.log('==== '+f.site.id+' '+f.site.name);
 const agg=new Map<string,{n:number;bars:number;branchRoots:number;branchSw:number;eq:number;role:string}>();
 for(const fd of g.feeders){
  const main=feederDrawingPath(g,fd);if(!main){console.log('  NO PATH '+fd.name);continue;}
  const nodes=main.terminals.filter(id=>!sections.has(id)),placed=new Set(nodes);
  const internal=g.switches.filter(s=>fd.switchIds.includes(s.id)&&s.from!==s.to&&!sections.has(s.from)&&!sections.has(s.to));
  let roots=0;for(const node of nodes)for(const e of internal){const next=e.from===node?e.to:e.to===node?e.from:null;if(next&&!placed.has(next)){roots++;placed.add(next);}}
  const barEdges=g.switches.filter(s=>fd.switchIds.includes(s.id)&&sections.has(s.from)!==sections.has(s.to)).length;
  const trs=fd.equipmentKeys.filter(k=>k.startsWith('ElmTr')).length;
  const key=fd.voltageKv+'|bars='+fd.busSectionIds.length+'|barEdges='+barEdges+'|roots='+roots+'|brSw='+main.branchSwitchIds.length+'|tr='+trs;
  const prev=agg.get(key);if(prev)prev.n++;else agg.set(key,{n:1,bars:fd.busSectionIds.length,branchRoots:roots,branchSw:main.branchSwitchIds.length,eq:trs,role:fd.sourceFunction??''});
 }
 for(const [k,v]of [...agg].sort())console.log('  x'+String(v.n).padStart(3)+'  '+k+'   '+(v.role||'').slice(0,40));
}