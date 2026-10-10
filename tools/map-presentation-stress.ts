import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {mapScaleFixture} from '../tests/helpers/map-scale';import {representativeStationBus} from '../src/map/layer-policy';import {voltageMatches} from '../src/domain/model/voltage-band';
const measurements=[];
for(const [physical,solved] of [[49275,4077],[48898,4088]]){
  const {ctx,network,result}=mapScaleFixture(physical,solved);global.gc?.();const initial=process.memoryUsage().heapUsed;
  const old=(id:string)=>{const nominals=network.buses.filter(b=>b.siteIds.includes(id)&&voltageMatches(b.vnKv,ctx.filters.voltages)).map(b=>b.vnKv),nominal=Math.max(...nominals),terms=new Map(network.buses.map(b=>[b.id,b])),rows=result.buses.filter(b=>b.siteIds.includes(id)&&b.vnKv===nominal&&b.terms.every(id=>terms.get(id)?.vnKv===nominal));return {nominal,bus:rows.sort((a,b)=>b.vmPu-a.vmPu||a.id.localeCompare(b.id))[0]??null,count:rows.length};};
  let start=performance.now();const before=network.sites.slice(0,100).map(s=>old(s.id)),old100Ms=performance.now()-start,oldHeapGrowth=process.memoryUsage().heapUsed-initial;global.gc?.();const beforeIndex=process.memoryUsage().heapUsed;
  start=performance.now();const cold=network.sites.map(s=>representativeStationBus(ctx,s.id,result)),coldAllMs=performance.now()-start;assert.deepEqual(cold.slice(0,100),before);const indexHeapGrowth=process.memoryUsage().heapUsed-beforeIndex;
  start=performance.now();const warm=network.sites.map(s=>representativeStationBus(ctx,s.id,result)),warmAllMs=performance.now()-start;assert.deepEqual(cold,warm);
  measurements.push({physical,solved,sites:1619,oldMeasuredSites:100,old100Ms,oldAllLinearEstimateMs:old100Ms*16.19,coldAllMs,warmAllMs,oldHeapGrowth,indexHeapGrowth,exact:true});
}
const output={method:'Anonymous Node microbenchmark. Old path measured for 100 sites; extrapolation is not measured full-map timing. Heap deltas are process samples, not peak allocations.',gcAvailable:!!global.gc,measurements};console.log(JSON.stringify(output,null,2));if(process.argv.includes('--save'))writeFileSync('local-benchmark-results/map-freeze-stress.json',JSON.stringify(output,null,2));
