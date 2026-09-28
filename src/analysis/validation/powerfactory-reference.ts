import type { CalculationResult } from '../../domain/results/types';
import { voltageBand, type VoltageBand } from '../../domain/model/voltage-band';

export type ReferenceKind='bus'|'line'|'transformer';
export interface PowerFactoryReferenceRecord {
  kind:ReferenceKind; fid?:string; name:string; nominalKv?:number; voltageKv?:number; voltagePu?:number; angleDeg?:number;
  pFromMw?:number; qFromMvar?:number; pToMw?:number; qToMvar?:number; pHvMw?:number; qHvMvar?:number;
  pLvMw?:number; qLvMvar?:number; loadingPercent?:number;
}
type Metric=Exclude<keyof PowerFactoryReferenceRecord,'kind'|'fid'|'name'>;
type ComparisonMetric=Metric|'alignedAngleDeg';
interface ActualRecord {kind:ReferenceKind;ids:string[];name:string;nominalKv:number;islandId?:string;values:Partial<Record<Metric,number>>}
export interface MetricError {kind:ReferenceKind;metric:ComparisonMetric;count:number;mae:number;maxAbsoluteError:number;p95AbsoluteError:number;meanBias:number}
export interface MatchIssue {kind:ReferenceKind;fid?:string;name:string;reason:'UNMATCHED'|'AMBIGUOUS'}
export interface PowerFactoryComparison {
 matched:Record<ReferenceKind,number>;unmatchedActual:Record<ReferenceKind,number>;unmatched:MatchIssue[];ambiguous:MatchIssue[];
 summary:{matchedTotal:number;unmatchedReference:number;ambiguousReference:number;unmatchedActualTotal:number};
 metrics:MetricError[];voltageBands:(MetricError&{band:VoltageBand})[];
 angleAlignment:{method:'REFERENCE_BUS'|'MEDIAN'|'PER_ISLAND'|'NONE';offsetDeg:number|null;matchedBusCount:number;islands:{islandId:string;method:'REFERENCE_BUS'|'MEDIAN';offsetDeg:number;matchedBusCount:number}[]};
 quality:'AVAILABLE_NOT_ACCEPTED'|'BENCHMARKED_PARTIAL';
}

const aliases:Record<string,keyof PowerFactoryReferenceRecord>={
 kind:'kind',type:'kind',class:'kind',objecttype:'kind',elementtype:'kind',fid:'fid',id:'fid',loc_name:'name',name:'name',objectname:'name',
 uknom:'nominalKv',nominalkv:'nominalKv',ratedvoltagekv:'nominalKv',ukv:'nominalKv',voltagekv:'voltageKv',u_kv:'voltageKv',voltagepu:'voltagePu',vm:'voltagePu',vm_pu:'voltagePu',angle:'angleDeg',angledeg:'angleDeg',va:'angleDeg',
 pfrommw:'pFromMw',pf:'pFromMw',p_from:'pFromMw',qfrommvar:'qFromMvar',qf:'qFromMvar',q_from:'qFromMvar',ptomw:'pToMw',pt:'pToMw',p_to:'pToMw',qtomvar:'qToMvar',qt:'qToMvar',q_to:'qToMvar',
 phvmw:'pHvMw',phv:'pHvMw',qhvmvar:'qHvMvar',qhv:'qHvMvar',plvmw:'pLvMw',plv:'pLvMw',qlvmvar:'qLvMvar',qlv:'qLvMvar',loading:'loadingPercent',loadingpercent:'loadingPercent',loading_pct:'loadingPercent',
};
const normalizeKey=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_]/g,'');
const parseKind=(value:unknown):ReferenceKind|undefined=>{const s=String(value??'').toLowerCase();if(s.includes('bus')||s.includes('term')||s==='elmterm')return'bus';if(s.includes('tr')||s.includes('transformer'))return'transformer';if(s.includes('line')||s==='elmlne')return'line';return;};
function parseNumber(value:unknown):number|undefined{if(typeof value==='number')return Number.isFinite(value)?value:undefined;if(typeof value!=='string'||!value.trim())return;const n=Number(value.trim().replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:undefined;}
function normalizeRow(row:Record<string,unknown>,implicitKind?:ReferenceKind):PowerFactoryReferenceRecord|undefined{
 const v:Record<string,unknown>={};for(const[k,value]of Object.entries(row)){const key=aliases[normalizeKey(k)];if(key)v[key]=value;}
 const kind=parseKind(v.kind)||implicitKind,name=String(v.name??'').trim();if(!kind||!name)return;
 const out:Record<string,unknown>={kind,name};if(v.fid!=null&&String(v.fid).trim())out.fid=String(v.fid).trim();
 for(const key of Object.keys(v) as (keyof PowerFactoryReferenceRecord)[])if(key!=='kind'&&key!=='name'&&key!=='fid'){const n=parseNumber(v[key]);if(n!==undefined)out[key]=n;}
 return out as unknown as PowerFactoryReferenceRecord;
}
function parseCsv(text:string):Record<string,string>[]{
 const source=text.replace(/^\uFEFF/,'').replace(/^sep=([^\r\n]+)\r?\n/i,'');const first=source.split(/\r?\n/,1)[0]||'';const delimiter=(first.match(/;/g)?.length||0)>(first.match(/,/g)?.length||0)?';':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 const headers=(rows.shift()||[]).map(x=>x.replace(/^\uFEFF/, '').trim());return rows.map(cells=>Object.fromEntries(headers.map((h,i)=>[h,cells[i]??''])));
}
export function importPowerFactoryReference(text:string):PowerFactoryReferenceRecord[]{
 const clean=text.replace(/^\uFEFF/,'').trim();if(!clean)throw new Error('PowerFactory reference is empty.');let roots:unknown;
 if(clean[0]==='{'||clean[0]==='['){try{roots=JSON.parse(clean);}catch{throw new Error('PowerFactory reference JSON is invalid.');}}else return parseCsv(clean).map(r=>normalizeRow(r)).filter((r):r is PowerFactoryReferenceRecord=>!!r);
 const records:PowerFactoryReferenceRecord[]=[];const add=(values:unknown,kind?:ReferenceKind)=>{if(Array.isArray(values)){for(const row of values)if(row&&typeof row==='object'){const parsed=normalizeRow(row as Record<string,unknown>,kind);if(parsed)records.push(parsed);}}};
 if(Array.isArray(roots))add(roots);else if(roots&&typeof roots==='object'){const obj=roots as Record<string,unknown>;add(obj.buses,'bus');add(obj.lines,'line');add(obj.transformers,'transformer');add(obj.trafos,'transformer');add(obj.records);}
 return records;
}
function actualRecords(result:CalculationResult):ActualRecord[]{
 const buses:ActualRecord[]=result.buses.map(b=>({kind:'bus',ids:[b.id,...b.terms],name:b.name,nominalKv:b.vnKv,islandId:b.islandId,values:{nominalKv:b.vnKv,voltageKv:b.vmPu*b.vnKv,voltagePu:b.vmPu,angleDeg:b.angleRad*180/Math.PI}}));
 const voltageByTerm=new Map<string,number>();for(const b of result.buses)for(const id of [b.id,...b.terms])voltageByTerm.set(id,b.vnKv);
 const branches:ActualRecord[]=result.branches.map(b=>{const tr=b.sourceClass.toLowerCase().includes('tr'),common:ActualRecord={kind:tr?'transformer':'line',ids:[b.id],name:b.name,nominalKv:b.vnKv,values:{loadingPercent:b.loading??undefined}};
  if(tr){const fromKv=voltageByTerm.get(b.from)??b.vnKv,toKv=voltageByTerm.get(b.to)??b.vnKv;const fromHigh=fromKv>=toKv;Object.assign(common.values,fromHigh?{pHvMw:b.pf,qHvMvar:b.qf,pLvMw:b.pt,qLvMvar:b.qt}:{pHvMw:b.pt,qHvMvar:b.qt,pLvMw:b.pf,qLvMvar:b.qf});}
  else Object.assign(common.values,{pFromMw:b.pf,qFromMvar:b.qf,pToMw:b.pt,qToMvar:b.qt});return common;});return [...buses,...branches];
}
function metricKeys(kind:ReferenceKind):Metric[]{return kind==='bus'?['nominalKv','voltageKv','voltagePu','angleDeg']:kind==='line'?['pFromMw','qFromMvar','pToMw','qToMvar','loadingPercent']:['pHvMw','qHvMvar','pLvMw','qLvMvar','loadingPercent'];}
export function comparePowerFactoryReference(reference:readonly PowerFactoryReferenceRecord[],result:CalculationResult):PowerFactoryComparison{
 const actual=actualRecords(result),matched:Record<ReferenceKind,number>={bus:0,line:0,transformer:0},unmatched:MatchIssue[]=[],ambiguous:MatchIssue[]=[],used=new Set<ActualRecord>();
 const errors=new Map<string,{kind:ReferenceKind;metric:ComparisonMetric;band:VoltageBand|null;values:number[]}>();
 const anglePairs:{target:ActualRecord;expected:number;observed:number;band:VoltageBand|null}[]=[];
 const addError=(kind:ReferenceKind,metric:ComparisonMetric,difference:number,band:VoltageBand|null)=>{for(const scope of ['all','band'] as const){if(scope==='band'&&!band)continue;const key=`${scope}:${band??''}:${kind}:${metric}`,entry=errors.get(key)||{kind,metric,band:scope==='band'?band:null,values:[]};entry.values.push(difference);errors.set(key,entry);}};
 for(const ref of reference){const candidates=actual.filter(a=>a.kind===ref.kind);let hits=ref.fid?candidates.filter(a=>a.ids.includes(ref.fid!)):[];
  if(hits.length!==1){if(hits.length>1){ambiguous.push({kind:ref.kind,fid:ref.fid,name:ref.name,reason:'AMBIGUOUS'});continue;}const nameHits=candidates.filter(a=>a.name===ref.name);if(nameHits.length!==1){(nameHits.length?ambiguous:unmatched).push({kind:ref.kind,fid:ref.fid,name:ref.name,reason:nameHits.length?'AMBIGUOUS':'UNMATCHED'});continue;}hits=nameHits;}
  const target=hits[0];if(used.has(target)){ambiguous.push({kind:ref.kind,fid:ref.fid,name:ref.name,reason:'AMBIGUOUS'});continue;}used.add(target);matched[ref.kind]++;
  const band=voltageBand(target.nominalKv);for(const metric of metricKeys(ref.kind)){const expected=ref[metric],observed=target.values[metric];if(typeof expected!=='number'||typeof observed!=='number'||!Number.isFinite(observed))continue;addError(ref.kind,metric,observed-expected,band);}
  if(ref.kind==='bus'&&typeof ref.angleDeg==='number'&&typeof target.values.angleDeg==='number')anglePairs.push({target,expected:ref.angleDeg,observed:target.values.angleDeg,band});
 }
 const referenceId=result.diagnostics.referenceBusId,referenceName=result.diagnostics.referenceBusName;
 const byIsland=new Map<string,typeof anglePairs>();for(const pair of anglePairs){const id=pair.target.islandId||'default',group=byIsland.get(id)||[];group.push(pair);byIsland.set(id,group);}
 const alignments:{islandId:string;method:'REFERENCE_BUS'|'MEDIAN';offsetDeg:number;matchedBusCount:number}[]=[];
 for(const[islandId,pairs]of byIsland){const slackPair=pairs.find(p=>typeof referenceId==='string'&&p.target.ids.includes(referenceId))||pairs.find(p=>typeof referenceName==='string'&&p.target.name===referenceName);
  const offsets=pairs.map(p=>p.expected-p.observed).sort((a,b)=>a-b),middle=Math.floor(offsets.length/2),offsetDeg=slackPair?slackPair.expected-slackPair.observed:offsets.length%2?offsets[middle]:(offsets[middle-1]+offsets[middle])/2;
  alignments.push({islandId,method:slackPair?'REFERENCE_BUS':'MEDIAN',offsetDeg,matchedBusCount:pairs.length});
  for(const pair of pairs)addError('bus','alignedAngleDeg',pair.observed+offsetDeg-pair.expected,pair.band);
 }
 const angleAlignment={method:alignments.length>1?'PER_ISLAND' as const:alignments[0]?.method||'NONE' as const,offsetDeg:alignments.length===1?alignments[0].offsetDeg:null,matchedBusCount:anglePairs.length,islands:alignments};
 const percentile=(values:number[],fraction:number)=>{const sorted=values.map(Math.abs).sort((a,b)=>a-b),index=(sorted.length-1)*fraction,lo=Math.floor(index),hi=Math.ceil(index);return sorted[lo]+(sorted[hi]-sorted[lo])*(index-lo);};
 const summarize=(e:{kind:ReferenceKind;metric:ComparisonMetric;values:number[]}):MetricError=>({kind:e.kind,metric:e.metric,count:e.values.length,mae:e.values.reduce((a,b)=>a+Math.abs(b),0)/e.values.length,maxAbsoluteError:Math.max(...e.values.map(Math.abs)),p95AbsoluteError:percentile(e.values,.95),meanBias:e.values.reduce((a,b)=>a+b,0)/e.values.length});
 const metrics:MetricError[]=[],voltageBands:(MetricError&{band:VoltageBand})[]=[];for(const entry of errors.values()){if(entry.band)voltageBands.push({...summarize(entry),band:entry.band});else metrics.push(summarize(entry));}
 const unmatchedActual:Record<ReferenceKind,number>={bus:0,line:0,transformer:0};for(const row of actual)if(!used.has(row))unmatchedActual[row.kind]++;
 return{matched,unmatchedActual,unmatched,ambiguous,summary:{matchedTotal:matched.bus+matched.line+matched.transformer,unmatchedReference:unmatched.length,ambiguousReference:ambiguous.length,unmatchedActualTotal:unmatchedActual.bus+unmatchedActual.line+unmatchedActual.transformer},metrics,voltageBands,angleAlignment,quality:result.converged?'BENCHMARKED_PARTIAL':'AVAILABLE_NOT_ACCEPTED'};
}
