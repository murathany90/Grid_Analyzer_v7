import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {loadBenchmarkModel} from '../src/importers/powerfactory-benchmark/model';
import {buildStationTopologyGraph,type StationSources} from '../src/domain/model/station-topology';
import {connectedStationLayout} from '../src/features/sld/physical-layout';
import {allVoltageBands} from '../src/domain/model/voltage-band';
const {network,source}=await loadBenchmarkModel(new File([await readFile('.local-fixtures/powerfactory/SN3/20261007_1400_SN3_TR0.zip')],'SN3.zip'),(phase,info)=>console.log(phase,info));
const classes=['ElmBay','ElmTerm','StaCubic','ElmCoup','StaSwitch','ElmSubstat','ElmTr2','ElmTr3'];
const report=[];const selected=[];const graphs=[];
for(const site of network.sites){
 const raw=Object.fromEntries(classes.map(cls=>[cls,source.getEquipmentForSite(site.id,cls).map(r=>({id:String(r.FID),name:String(r.loc_name??r.FID),attributes:source.get(cls,r.FID)??r}))]));
 if(!raw.ElmTerm.length)continue;
 const seen=new Set(raw.StaCubic.map(r=>r.id));for(const r of [...raw.ElmCoup,...raw.StaSwitch,...raw.ElmTr2,...raw.ElmTr3])for(const field of ['bus1','bus2','bushv','busmv','buslv','fold_id']){const cid=String(r.attributes[field]??''),cub=source.get('StaCubic',cid);if(cub&&!seen.has(cid)){raw.StaCubic.push({id:cid,name:String(cub.loc_name??cid),attributes:cub});seen.add(cid);}}
 const sources:StationSources={bays:raw.ElmBay,terminals:raw.ElmTerm,cubicles:raw.StaCubic,switches:[...raw.ElmCoup,...raw.StaSwitch],substats:raw.ElmSubstat,transformers:raw.ElmTr2,unsupportedEquipment:raw.ElmTr3.map(r=>({...r,sourceClass:'ElmTr3'}))};
 const graph=buildStationTopologyGraph(network,site.id,sources),modes=[];
 graphs.push({site,graph});
 if(process.argv.includes('--graphs-only'))continue;
 console.log('station',site.id,site.name,graph.switches.length);
 for(const labels of [false,true]){try{const l=connectedStationLayout(graph,allVoltageBands(),labels);modes.push({labels,status:'PASS',width:l.width,height:l.height,devices:l.routes.length,equipment:l.equipment.length});}catch(e){modes.push({labels,status:'FAIL',error:(e as Error).message});}}
 report.push({site:site.id,name:site.name,bars:graph.busSections.length,feeders:graph.sourceFeederCount,switches:graph.switches.length,equipment:graph.equipment.length,issues:graph.counters,modes});
 if(/ANADOLU|KAYAS|TEMELLI|KARAPINAR/i.test(site.name)||modes.some(m=>m.status==='FAIL')&&selected.length<12)selected.push({site,raw,sources,graph});
 if(report.length%100===0)console.log('scanned',report.length,'failed',report.filter(r=>r.modes.some(m=>m.status==='FAIL')).length);
}
const out='local-benchmark-results/sld-all-stations';await mkdir(out,{recursive:true});await writeFile(out+'/graphs-private.json',JSON.stringify(graphs));if(process.argv.includes('--graphs-only'))process.exit(0);await writeFile(out+'/layout-private.json',JSON.stringify(report,null,2));await writeFile(out+'/fixtures-private.json',JSON.stringify({network,fixtures:selected}));
console.log(JSON.stringify({stations:report.length,passed:report.filter(r=>r.modes.every(m=>m.status==='PASS')).length,failures:report.filter(r=>r.modes.some(m=>m.status==='FAIL')).map(r=>({id:r.site,name:r.name,errors:r.modes.filter(m=>m.status==='FAIL').map(m=>m.error)}))},null,2));
