import type {BenchmarkPackage} from './types';
import {rowObject} from './types';
import type {ScFaultResult,ScProfile} from '../../analysis/short-circuit';
type Row=Record<string,string|number|null>;
export type ScPartitionReason='SOURCE_PARTITION_MISMATCH'|'MISSING_MEMBERS'|'DUPLICATE_PF_MEMBERS'|'NOMINAL_BASE_MISMATCH'|'RESULT_CONFLICT'|'METHOD_MISMATCH';
const nativeKey=(r:Row)=>String(r.calculationBusKey||r.electricalBusKey||'');
const cache=new WeakMap<BenchmarkPackage,{physical:Map<string,Row[]>;groups:Map<string,Row[]>;electrical:Map<string,Row[]>}>();
function index(b:BenchmarkPackage){
  const old=cache.get(b);if(old)return old;
  const physical=new Map<string,Row[]>(),groups=new Map<string,Row[]>(),electrical=new Map<string,Row[]>();
  const add=(m:Map<string,Row[]>,k:string,r:Row)=>m.set(k,[...(m.get(k)??[]),r]);
  const t=b.groups.SC.tables.SC_BusResults_Raw;for(const v of t.rows){const r=rowObject(t,v);add(physical,String(r.physicalTerminalFid??''),r);add(groups,nativeKey(r),r);}
  const c=b.groups.SC.tables.SC_CalculationBus_Raw;for(const v of c?.rows??[])add(electrical,nativeKey(rowObject(c,v)),rowObject(c,v));
  const value={physical,groups,electrical};cache.set(b,value);return value;
}
/** Independent source gates, with no name, nearest-bus or partial-set fallback. */
export function auditScPartition(b:BenchmarkPackage,f:ScFaultResult,p:ScProfile,raw?:Row){
  const i=index(b),reasons=new Set<ScPartitionReason>(),members=f.physicalTerminalFids,rows=members.flatMap(fid=>i.physical.get(fid)??[]),keys=new Set(rows.map(nativeKey).filter(Boolean));
  const key=keys.size===1?[...keys][0]:'',pf=i.groups.get(key)??[],calc=i.electrical.get(key)??[],pfMembers=new Set(pf.map(r=>String(r.physicalTerminalFid??''))),gaMembers=new Set(members);
  if(members.length!==gaMembers.size||keys.size!==1||raw&&nativeKey(raw)!==key)reasons.add('SOURCE_PARTITION_MISMATCH');
  if(!members.length||members.some(fid=>!i.physical.has(fid))||[...pfMembers].some(fid=>!gaMembers.has(fid))||pfMembers.size!==gaMembers.size)reasons.add('MISSING_MEMBERS');
  if(members.some(fid=>(i.physical.get(fid)?.length??0)>1)||pf.length!==pfMembers.size||calc.length>1)reasons.add('DUPLICATE_PF_MEMBERS');
  for(const c of calc){if(c.physicalTerminalCount!==pfMembers.size)reasons.add('MISSING_MEMBERS');if(!pfMembers.has(String(c.representativePhysicalTerminalFid??'')))reasons.add('SOURCE_PARTITION_MISMATCH');}
  if(i.electrical.size&&!calc.length)reasons.add('MISSING_MEMBERS');
  const all=[...pf,...calc,...(raw?[raw]:[])];
  if(all.some(r=>typeof r.nominalKv!=='number'||f.nominalKv===null||Math.abs(r.nominalKv-f.nominalKv)>1e-6))reasons.add('NOMINAL_BASE_MISMATCH');
  if(all.some(r=>r.resultConflictFlag===1||r.resultConflictFlag==='1'||r.status&&r.status!=='OK'))reasons.add('RESULT_CONFLICT');
  if(!all.length||p.faultType!=='3PH'||all.some(r=>!['3PH','3-Phase Short-Circuit'].includes(String(r.faultType))||r.calculateMode!==p.calculateMode)||pf.some(r=>r.rfOhm!==p.rfOhm||r.xfOhm!==p.xfOhm)||!pf.length)reasons.add('METHOD_MISMATCH');
  // Aggregated electrical results must agree with every physical source cell.
  for(const c of calc)for(const r of pf)for(const metric of ['ikssKa','skssMva']){const a=c[metric],v=r[metric];if(typeof a==='number'&&typeof v==='number'&&Math.abs(a-v)>Math.max(1e-6,Math.abs(a)*1e-6))reasons.add('RESULT_CONFLICT');}
  return {matched:reasons.size===0,reasons:[...reasons],calculationBusKey:key,gaMembers:gaMembers.size,pfMembers:pfMembers.size,missingGaMembers:members.filter(fid=>!pfMembers.has(fid)).length,extraPfMembers:[...pfMembers].filter(fid=>!gaMembers.has(fid)).length,calculationBusRecords:calc.length};
}
