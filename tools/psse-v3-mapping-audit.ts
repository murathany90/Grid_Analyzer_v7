/** Read-only aggregate YTBS/coordinate audit. Never exports physical bus or station inventories. */
import fs from 'node:fs';
import path from 'node:path';
import {decodePsse} from '../src/importers/psse/decode';
import {normalizePsseBusBranch} from '../src/domain/psse/network';
import {buildGeoSnapshot} from '../src/features/psse/geography';
import {projectWgs84} from '../src/map/projection';

const [source,output]=process.argv.slice(2);
if(!source||!output)throw Error('Usage: node --import tsx tools/psse-v3-mapping-audit.ts SOURCE.sav OUTPUT.json');
const model=await decodePsse(Uint8Array.from(fs.readFileSync(source)).buffer,path.basename(source));
const network=normalizePsseBusBranch(model),geo=buildGeoSnapshot(model,network);
const areas=['','TRAKYA','KUZEYBATI','BATIANADOLU','ORTAANADOLU','BATIAKDENIZ','ORTAKARADENI','DOGUANADOLU','GUNEYDOGU','DOGUAKDENIZ','SANAL'];
const regions=['IST TRAKYA','BURSA','IZMIR','IST ANADOLU','SAKARYA','KUTAHYA','ISPARTA','ANKARA','KONYA','SAMSUN','KAYSERI','GAZIANTEP','ELAZIG','TRABZON','ERZURUM','BATMAN','VAN','ADANA','ANTALYA','EDIRNE','DENIZLI','KASTAMONU','YURTDISI'];
const zones:Record<number,string>={1:'400KV',2:'154KV',3:'66KV',4:'33KV',7:'GENERATOR'};
const buses=model.equipment.filter(e=>e.kind==='bus');
const count=(key:string)=>Object.entries(buses.reduce<Record<string,number>>((result,b)=>{const v=String(b.fields[key]??'UNKNOWN');result[v]=(result[v]??0)+1;return result;},{})).map(([code,count])=>({code:Number(code),count})).sort((a,b)=>a.code-b.code);
const areaCounts=count('area'),zoneCounts=count('zone'),ownerCounts=count('owner');
const dictionary=(codes:string,names:string,expected:(code:number)=>string|null)=>{
 const ids=model.binaryArrays?.[codes]?.values??[],text=(model.binaryArrays?.[names]?.values??[]).join('');
 return ids.map((code,i)=>({code:Number(code),sourceName:text.slice(i*12,(i+1)*12).trim(),expectedName:expected(Number(code))}));
};
const dictionaries={area:dictionary('Numare','Arnam',c=>areas[c]??null),zone:dictionary('Numzon','Zoname',c=>zones[c]??null),owner:dictionary('Numown','Owname',c=>regions[c-701]??null)};
const mismatch=buses.filter(b=>{const zone=Number(b.fields.zone),kv=b.nominalKv;if(zone===7||kv===null)return false;const expected=({1:400,2:154,3:66,4:33} as Record<number,number>)[zone];return expected!==undefined&&Math.abs(kv-expected)>.01;});
const classMismatch=buses.filter(b=>{const zone=Number(b.fields.zone),kv=b.nominalKv;if(zone===7||kv===null)return false;return zone===4?kv>36:zone===1?Math.abs(kv-400)>.01&&Math.abs(kv-220)>.01:zone===2?Math.abs(kv-154)>.01:zone===3?Math.abs(kv-66)>.01:true;});
const lowVoltages=[...new Set(buses.map(b=>b.nominalKv).filter((kv):kv is number=>kv!==null&&kv<=36))].sort((a,b)=>a-b);
const projected=geo.stations.map(s=>projectWgs84(s.longitude,s.latitude));
const bounds=projected.length?{minX:Math.min(...projected.map(p=>p[0])),maxX:Math.max(...projected.map(p=>p[0])),minY:Math.min(...projected.map(p=>p[1])),maxY:Math.max(...projected.map(p=>p[1]))}:null;
const countsByReason=Object.fromEntries([...new Set(geo.unmatched.map(b=>b.reason))].map(reason=>[reason,geo.unmatched.filter(b=>b.reason===reason).length]));
const report={schema:'ga.psse.ytbs-geo-audit.v3',sourceSha256:model.source.sha256,busCount:buses.length,reference:'YTBS 01.06.2026 pp15-18; source values decoded natively',area:areaCounts.map(r=>({...r,expectedName:areas[r.code]??null})),zone:zoneCounts.map(r=>({...r,expectedName:zones[r.code]??null})),busOwner:ownerCounts.map(r=>({...r,expectedName:regions[r.code-701]??null})),sourceDictionaries:dictionaries,zoneNominalKvDisagreements:mismatch.length,zoneVoltageClassDisagreements:classMismatch.length,zoneVoltageClassPolicy:'ZONE7 is generator; ZONE4 includes <=36kV; source ZONE1 also contains220kV. Exact nominal differences are not model errors.',lowVoltage:{inclusiveMaximumKv:36,count:buses.filter(b=>b.nominalKv!==null&&b.nominalKv<=36).length,physicalLevelsKv:lowVoltages},geography:{...geo.counts,unmatchedReasons:countsByReason,projection:'Shared DGS projectWgs84(lon,lat), standard parallel39N',projectedSourceBounds:bounds},semantics:{Bus_AREA:'YTM',Bus_ZONE:'voltage class',Bus_OWNER:'regional directorate701-723',Transformer_O2:'regional directorate',Generator_O1_O2_O3_O4:'organization/source/basin/province',Branch_O1_O2_O3:'line class; never regional directorate'}};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,sourceSha256:report.sourceSha256,busCount:report.busCount,geography:report.geography,zoneNominalKvDisagreements:report.zoneNominalKvDisagreements}));
