import type {AppContext} from '../../app/contracts';
import {metricRows,type BenchmarkMetricRow,type BenchmarkPreflight} from './comparison';
import {rowObject} from './types';
const cache=new WeakMap<AppContext,{refs:unknown[];key:string;rows:BenchmarkMetricRow[]}>();
/** One source-cell selection for PF map, tooltip, table and Lightning. This does not certify GA parity. */
export function pfScReferenceRows(ctx:AppContext):BenchmarkMetricRow[]{
 const table=ctx.benchmark?.groups.SC.tables.SC_BusResults_Raw;
 if(!table||!ctx.network)return [];
 const refs=[ctx.network,ctx.benchmark,table,table.rows],key=ctx.network.modelHash+'|'+table.fileSha256,old=cache.get(ctx);
 if(old?.key===key&&refs.every((r,i)=>r===old.refs[i]))return old.rows;
 // No comparison permission is issued by the reference viewer. Native FID/kV binding is checked by its consumer.
 const gate:BenchmarkPreflight={status:'NOT_COMPARABLE',reasons:['PF_REFERENCE_ONLY; GA_METHOD_NOT_VERIFIED'],lf:null,comparison:null};
 const partition=new Map<string,number>();
 for(const values of table.rows){const r=rowObject(table,values);if(!['3PH','3-Phase Short-Circuit'].includes(String(r.faultType))||r.calculateMode!=='MAX'||r.rfOhm!==0||r.xfOhm!==0)continue;const key=String(r.physicalTerminalFid??r.fid)+'|'+Number(r.nominalKv);partition.set(key,(partition.get(key)??0)+1);}
 // Reference-cell availability has no GA/SC comparison dependency. Method parity is a separate gate.
 const rows=metricRows(table,gate,'ikssKa').filter(r=>partition.get(r.fid+'|'+r.nominalKv)===1&&r.pf.value!==null&&Number.isFinite(r.pf.value)&&r.pf.availability!=='INVALID'&&!r.pf.qualityFlags.includes('SENTINEL_CANDIDATE')&&r.reason!=='NOT_RECORDED');
 cache.set(ctx,{refs,key,rows});return rows;
}
