import { importPowerFactoryReferenceDocument, type PowerFactoryReference } from '../../analysis/validation/powerfactory-reference';
import { importPowerFactoryControlContext } from '../../analysis/validation/powerfactory-control-context';
import { rowObject, type BenchmarkPackage, type RawTable } from './types';

export function benchmarkLfReference(benchmark:BenchmarkPackage):PowerFactoryReference{
  const group=benchmark.groups.LF,table=group.tables.GA_Reference_Raw;
  return importPowerFactoryReferenceDocument(JSON.stringify({metadata:{...table.metadata,...group.identity,modelId:table.metadata.modelId||group.identity.studyCase,sourceFile:group.workbook.file},records:table.rows.map(row=>rowObject(table,row))}),group.workbook.file);
}
/** Internal compatibility adapter: source attributes only; never numeric PF results as solver guesses. */
export function benchmarkControlContext(benchmark:BenchmarkPackage){
  const table=benchmark.groups.LF.tables.ControlContext_Raw;
  const quote=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
  const meta=Object.entries(table.metadata).map(([key,value])=>table.headers.map(h=>h==='kind'?'meta':h==='key'?key:h==='value'?value:''));
  return importPowerFactoryControlContext([table.headers,...meta,...table.rows].map(row=>row.map(quote).join(';')).join('\n'));
}
export function benchmarkTableRecords(table:RawTable){return table.rows.map(row=>rowObject(table,row));}
