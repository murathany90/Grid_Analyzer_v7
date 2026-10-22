/** Private native input inventory. No reference result is used as a solver input. */
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {loadBenchmarkModel} from '../src/importers/powerfactory-benchmark/model';
import {loadBenchmark} from '../src/importers/powerfactory-benchmark';
import {buildTopology} from '../src/topology/electrical-topology';
import {buildN1CandidateCatalog,filterN1CatalogCandidates} from '../src/domain/n1/catalog';
import {emptyScenario} from '../src/domain/scenario/overlay';
import {adaptShortCircuitSources} from '../src/importers/powerfactory-benchmark/short-circuit-source';
import {calculateThreePhase,clearScPreparationCache} from '../src/analysis/short-circuit';
export const outputDir='local-benchmark-results/n1-sc-20261022';
export async function filesUnder(dir:string):Promise<string[]>{return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?filesUnder(join(dir,e.name)):Promise.resolve([join(dir,e.name)])))).flat();}
export async function inventory(path:string,referencePath?:string){
 const start=performance.now(),bytes=await readFile(path),loaded=await loadBenchmarkModel(new File([bytes],basename(path))),network=loaded.network,siteAreas=new Map(network.sites.map(s=>[s.id,s.areaId])),scenario=emptyScenario(),topology=buildTopology(network),catalog=buildN1CandidateCatalog(network,scenario,{includeAllVoltages:true});
 const context=adaptShortCircuitSources(loaded.raw,network),areas=[...new Set(network.sites.map(s=>s.areaId).filter(Boolean))].map(id=>({id,name:network.sites.find(s=>s.areaId===id)!.areaName,candidates:filterN1CatalogCandidates(catalog.candidates,{ytmIds:[id],endpointScope:'BOTH'}).length,terminals:network.buses.filter(b=>b.siteIds.some(id2=>siteAreas.get(id2)===id)).length})).sort((a,b)=>a.candidates-b.candidates);
 const reference=referencePath?await loadBenchmark(new File([await readFile(referencePath)],basename(referencePath))):null;
 const rawTables=Object.fromEntries(Object.entries(loaded.raw).filter(([,v])=>v&&typeof v==='object'&&'Attributes'in v).map(([cls,v])=>{const t=v as {Attributes:string[];Values:unknown[][]},idx=t.Attributes.indexOf('outserv');return [cls,{count:t.Values.length,active:idx<0?null:t.Values.filter(r=>r[idx]===0).length,attributes:t.Attributes}];}));
 const sample=network.buses.find(b=>b.inService&&topology.terminalToBus.has(b.sourceId))!.sourceId;
 const baseline=await calculateThreePhase(network,scenario,context,[sample],{faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'INVENTORY_BASELINE',edition:null,rfOhm:0,xfOhm:0,maxFaults:1,timeBudgetMs:30000});clearScPreparationCache();
 const proof={model:basename(path),modelHash:network.modelHash,studyCase:network.studyCase,importAndInventoryMs:performance.now()-start,rawTables,physicalTerminals:network.buses.length,electricalBuses:topology.buses.length,canonical:Object.fromEntries(['lines','transformers','generators','externalGrids','switches','sites'].map(k=>[k,((network as unknown as Record<string,{inService:boolean}[]>)[k]??[]).length])),catalog:catalog.counts,areas,scSourceCounts:context.sources.reduce<Record<string,number>>((c,s)=>{const key=s.sourceClass+':'+(s.inService?'active:':'inactive:')+(s.parameterStatus??'UNKNOWN');c[key]=(c[key]??0)+1;return c;},{}),invalidBranches:context.invalidBranches,baseline:baseline.faults,referenceIdentity:reference?Object.fromEntries(Object.entries(reference.groups).map(([k,g])=>[k,{identity:g.identity,tables:Object.fromEntries(Object.entries(g.tables).map(([k,t])=>[k,{rows:t.rows.length,columns:t.headers}]))}])):null};
 await mkdir(outputDir,{recursive:true});await writeFile(join(outputDir,network.studyCase+'-inventory-private.json'),JSON.stringify(proof,null,2));
 return {loaded,network,reference,proof};
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/n1-sc-inventory.ts')){
 const files=await filesUnder('kontrol1');for(const tag of ['SN3','SN4']){const model=files.find(f=>f.includes(tag)&&basename(f).includes('_TR0.zip'))!,reference=files.find(f=>f.includes(tag)&&!basename(f).includes('_TR0.zip'));const {proof}=await inventory(model,reference);console.log(JSON.stringify({tag,physical:proof.physicalTerminals,electrical:proof.electricalBuses,catalog:proof.catalog,areas:proof.areas,sources:proof.scSourceCounts,invalidBranches:proof.invalidBranches.length,baseline:proof.baseline.map(b=>({status:b.status,reasons:b.reasons})),reference:proof.referenceIdentity}));}
}

