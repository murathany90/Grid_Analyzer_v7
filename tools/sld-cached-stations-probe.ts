import {readFile,writeFile} from 'node:fs/promises';
import {connectedStationLayout} from '../src/features/sld/physical-layout';
import {allVoltageBands} from '../src/domain/model/voltage-band';
const dir='local-benchmark-results/sld-all-stations',fixtures=JSON.parse(await readFile(dir+'/graphs-private.json','utf8'));
const previous=JSON.parse(await readFile(dir+'/layout-private.json','utf8'));
const failed=new Set(previous.filter((s:any)=>s.modes.some((m:any)=>m.status==='FAIL')).map((s:any)=>s.site));
const option=(name:string,fallback:string)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};const report=[];
for(const f of fixtures.slice(Number(option('--from','0')),Number(option('--to',String(fixtures.length))))){if(process.argv.includes('--failed')&&!failed.has(f.site.id))continue;if(process.argv.includes('--site')&&process.argv[process.argv.indexOf('--site')+1]!==f.site.id)continue;const modes=[];
 for(const labels of [false,true]){try{const l=connectedStationLayout(f.graph,allVoltageBands(),labels);if(l.routes.length!==f.graph.switches.length||l.feeders.length!==f.graph.feeders.length||l.sections.length!==f.graph.busSections.length)throw Error('SOURCE_INVENTORY_MISMATCH');modes.push({labels,status:'PASS',width:l.width,height:l.height});}catch(e){modes.push({labels,status:'FAIL',error:(e as Error).message,stack:(e as Error).stack});}}
 report.push({site:f.site.id,name:f.site.name,modes});if(modes.some(m=>m.status==='FAIL'))console.log(f.site.id,f.site.name,modes.filter(m=>m.error).map(m=>m.error).join('\n'));
}
await writeFile(dir+'/'+option('--report','cached-report-private.json'),JSON.stringify(report,null,2));console.log('stations',report.length,'fail',report.filter(s=>s.modes.some(m=>m.status==='FAIL')).length);
