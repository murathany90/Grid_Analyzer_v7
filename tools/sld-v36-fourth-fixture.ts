import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadBenchmarkModel} from '../src/importers/powerfactory-benchmark/model';
import {buildStationTopologyGraph} from '../src/domain/model/station-topology';
const data=JSON.parse(await readFile('local-benchmark-results/sld-v34/fixtures-private.json','utf8'));
const {network,source}=await loadBenchmarkModel(new File([await readFile('.local-fixtures/powerfactory/SN3/20261007_1400_SN3_TR0.zip')],'SN3.zip'));
assert.equal(network.modelHash,data.network.modelHash);
const id='M1555',classes=['ElmBay','ElmTerm','StaCubic','ElmCoup','StaSwitch','ElmSubstat','ElmTr2','ElmTr3','ElmSym','ElmGenStat','ElmLne','ElmShnt','ElmLod'];
const raw=Object.fromEntries(classes.map(cls=>[cls,source.getEquipmentForSite(id,cls).map(r=>({id:String(r.FID),name:String(r.loc_name??r.FID),siteIds:[id],attributes:source.get(cls,r.FID)??r}))]));
const seen=new Set(raw.StaCubic.map(r=>r.id));for(const r of [...raw.ElmCoup,...raw.StaSwitch,...raw.ElmTr2,...raw.ElmTr3])for(const field of ['bus1','bus2','bushv','busmv','buslv','fold_id']){const cid=String(r.attributes[field]??''),cub=source.get('StaCubic',cid);if(cub&&!seen.has(cid)){raw.StaCubic.push({id:cid,name:String(cub.loc_name??cid),siteIds:[id],attributes:cub});seen.add(cid);}}
const sources={bays:raw.ElmBay,terminals:raw.ElmTerm,cubicles:raw.StaCubic,switches:[...raw.ElmCoup,...raw.StaSwitch],substats:raw.ElmSubstat,transformers:raw.ElmTr2,unsupportedEquipment:raw.ElmTr3.map(r=>({...r,sourceClass:'ElmTr3'}))};
const graph=buildStationTopologyGraph(network,id,sources);data.fixtures.push({site:network.sites.find(s=>s.id===id),raw,sources,graph});
await writeFile('local-benchmark-results/sld-v36-kayas-pilot/fixtures-private.json',JSON.stringify(data));console.log({site:id,bays:graph.sourceFeederCount,switches:graph.switches.length});
