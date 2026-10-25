import type {AppContext} from '../../app/contracts';
import {metricRows,preflightBenchmark,type BenchmarkMetricRow} from './comparison';
import {scenarioSignature} from '../scenario/overlay';
import {rowObject} from './types';
const cache=new WeakMap<AppContext,{refs:unknown[];key:string;rows:BenchmarkMetricRow[]}>();
/** One source-cell selection for PF map, tooltip, table and Lightning. This does not certify GA parity. */
export function pfScReferenceRows(ctx:AppContext):BenchmarkMetricRow[]{
 const table=ctx.benchmark?.groups.SC.tables.SC_BusResults_Raw;
 if(!table||!ctx.network)return [];
 const lf=ctx.resultStore?.get?.('base','powerFlow'),refs=[ctx.network,ctx.benchmark,lf,ctx.scResult],key=scenarioSignature(ctx.scenario.current),old=cache.get(ctx);
 if(old?.key===key&&refs.every((r,i)=>r===old.refs[i]))return old.rows;
 const gate=preflightBenchmark(ctx.benchmark!,ctx.network,lf,ctx.powerFactoryControlContextNumericFile);
 const partition=new Map<string,number>();
 for(const values of table.rows){const r=rowObject(table,values);if(!['3PH','3-Phase Short-Circuit'].includes(String(r.faultType))||r.calculateMode!=='MAX'||r.rfOhm!==0||r.xfOhm!==0)continue;const key=String(r.physicalTerminalFid??r.fid)+'|'+Number(r.nominalKv);partition.set(key,(partition.get(key)??0)+1);}
 const rows=metricRows(table,gate,'ikssKa',{network:ctx.network,lfResult:lf,scenario:ctx.scenario.current,settings:ctx.analysisSettings?.value,sc:ctx.scResult,benchmark:ctx.benchmark}).filter(r=>partition.get(r.fid+'|'+r.nominalKv)===1&&r.pf.value!==null&&Number.isFinite(r.pf.value)&&r.pf.availability!=='INVALID'&&!r.pf.qualityFlags.includes('SENTINEL_CANDIDATE')&&r.reason!=='NOT_RECORDED');
 cache.set(ctx,{refs,key,rows});return rows;
}
