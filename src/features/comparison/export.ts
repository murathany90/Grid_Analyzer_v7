import type { BenchmarkMetricRow } from '../../domain/benchmark/comparison';
import { rowObject, type RawTable } from '../../domain/benchmark/types';
import { csvDocument } from '../../ui/components/dom';
import { buildWorkbook, type Cell } from '../analysis/xlsx-export';

export const metricHeaders=['analysis','table','sourceClass','FID','name','caseId','side','metric','PF','GA','delta','absoluteDelta','deltaPercent','unit','status','reason','method','availability','rawText','qualityFlags','sourceSha256','sheet','row','column','diagnosticDelta','sourceCellKey','identityMatched'];
export function metricExportRows(rows:readonly BenchmarkMetricRow[]):Cell[][]{
  return [metricHeaders,...rows.map(r=>[r.analysis,r.table,r.sourceClass,r.fid,r.name,r.caseId,r.side,r.metric,r.pf.value,r.ga,r.delta,r.absoluteDelta,r.deltaPercent,r.pf.unit,r.status,r.reason,r.method,r.pf.availability,r.pf.rawText,r.pf.qualityFlags.join(';'),r.pf.source.fileSha256,r.pf.source.sheet,r.pf.source.row,r.pf.source.column,r.diagnosticDelta??null,r.sourceCellKey??null,String(r.identityMatched??false)])];
}
export function benchmarkCsv(rows:readonly BenchmarkMetricRow[]):string{return csvDocument(metricExportRows(rows));}
export function benchmarkWorkbook(rows:readonly BenchmarkMetricRow[]):Uint8Array{return buildWorkbook([{name:'Comparison',rows:metricExportRows(rows)}]);}
export function rawExportRows(table:RawTable):Cell[][]{return [[...table.headers,'sourceSha256','sourceSheet','sourceRow'],...table.rows.map((row,i)=>[...row,table.fileSha256,table.name,table.rowNumbers[i]])];}
export function rawExportJson(table:RawTable):string{return JSON.stringify({analysis:table.analysis,table:table.name,metadata:table.metadata,rows:table.rows.map((row,i)=>({...rowObject(table,row),source:{fileSha256:table.fileSha256,sheet:table.name,row:table.rowNumbers[i]}}))},null,2);}
