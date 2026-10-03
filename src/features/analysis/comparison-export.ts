import type {CanonicalNetwork} from '../../domain/model/network';
import type {CalculationResult} from '../../domain/results/types';
import type {PowerFactoryComparison,PowerFactoryReference} from '../../analysis/validation/powerfactory-reference';
import type {ReferencePreflight} from '../../analysis/validation/powerfactory-preflight';
import {csvDocument,downloadText} from '../../ui/components/dom';
import {buildWorkbook,type Cell,type WorkbookSheet} from './xlsx-export';

const value=(v:unknown):Cell=>typeof v==='string'||typeof v==='number'?v:null;
const pairColumns=['Grid Analyzer','PowerFactory','Delta','Absolute Delta','Delta Percent','Unit','Comparable','Semantics'];
function metricRows(report:PowerFactoryComparison,kind:'bus'|'line'|'transformer'|'generator'):Cell[][]{
  return [['YTM','TM','Voltage kV','Equipment','GA FID','PF FID','Match status','Match method','Metric',...pairColumns],
    ...report.rows.filter(row=>row.kind===kind).flatMap(row=>Object.entries(row.metrics).map(([metric,pair])=>[
      row.hierarchy.ytm,row.hierarchy.tm,row.hierarchy.voltageKv,row.gridAnalyzerName||row.powerFactoryName,row.gridAnalyzerId,row.powerFactoryFid,
      row.status,row.matchMethod,metric,pair?.gridAnalyzer,pair?.powerFactory,pair?.delta,pair?.absoluteDelta,pair?.deltaPercent,pair?.unit,
      pair?.comparable?'yes':'no',pair?.semantics
    ] as Cell[]))];
}
export function comparisonSheets(report:PowerFactoryComparison,preflight:ReferencePreflight,network:CanonicalNetwork,result:CalculationResult,reference:PowerFactoryReference):WorkbookSheet[]{
  const summary:Cell[][]=[['Metric','Value'],['Compatibility',preflight.status],['Comparison quality',report.quality],['Matched',report.summary.matchedTotal],['Unmatched PF',report.summary.unmatchedReference],['Unmatched GA',report.summary.unmatchedActualTotal],['Ambiguous PF',report.summary.ambiguousReference],['Angle alignment',report.angleAlignment.method],['Reference conflicts',report.referenceValueConflicts.length]];
  for(const row of report.metrics)summary.push([`${row.kind} ${row.metric} MAE`,row.mae],[`${row.kind} ${row.metric} P95`,row.p95AbsoluteError],[`${row.kind} ${row.metric} max`,row.maxAbsoluteError]);
  const unmatched:Cell[][]=[['Status','Kind','GA FID','PF FID','GA name','PF name','YTM','TM'],...report.rows.filter(row=>row.status!=='MATCHED').map(row=>[row.status,row.kind,row.gridAnalyzerId,row.powerFactoryFid,row.gridAnalyzerName,row.powerFactoryName,row.hierarchy.ytm,row.hierarchy.tm])];
  const topology:Cell[][]=[['Check','Value'],['Status',preflight.status],['Physical terminals checked',preflight.topology.physicalTerminalsChecked],['Electrical buses checked',preflight.topology.electricalBusesChecked],['Branch endpoints checked',preflight.topology.branchEndpointsChecked],['Missing terminals',preflight.topology.missingTerminals],['Inactive stub terminals',preflight.topology.inactiveStubTerminals],['Bus partition conflicts',preflight.topology.busPartitionConflicts],['Missing branches',preflight.topology.missingBranches],['Branch endpoint conflicts',preflight.topology.branchEndpointConflicts]];
  for(const reason of preflight.reasons)topology.push(['Block reason',reason]);
  topology.push(['Kind','GA FID','PF FID','GA from','GA to','PF from','PF to']);
  for(const row of report.rows.filter(row=>row.kind==='line'||row.kind==='transformer'))topology.push([row.kind,row.gridAnalyzerId,row.powerFactoryFid,row.topology.from,row.topology.to,row.topology.powerFactoryFrom,row.topology.powerFactoryTo]);
  let calculationOptions:Record<string,unknown>={};try{calculationOptions=JSON.parse(result.identity.optionsHash) as Record<string,unknown>;}catch{/* Legacy result identity. */}
  const meta:Cell[][]=[['Field','Value'],['modelName',network.name],['modelHash',network.modelHash],['studyCase',preflight.context.studyCase],['studyTime',preflight.context.studyTime],['sourceFile',reference.metadata.sourceFile],['controlContextHash',String(calculationOptions.controlContextHash??'unavailable')],['analysisSettingsHash',String(calculationOptions.analysisSettingsHash??'unavailable')],['scenarioHash',result.identity.scenarioHash],['engine',result.identity.engine],['engineVersion',result.identity.engineVersion],['converged',String(result.converged)],['capacityMode',String(result.diagnostics.capacityMode??'unknown')],['exportedAt',new Date().toISOString()]];
  return [{name:'Ozet',rows:summary},{name:'Gerilim_Aci',rows:metricRows(report,'bus')},{name:'Hatlar',rows:metricRows(report,'line')},{name:'Trafolar',rows:metricRows(report,'transformer')},{name:'Ureticiler',rows:metricRows(report,'generator')},{name:'Eslesmeyenler',rows:unmatched},{name:'Topoloji',rows:topology},{name:'Meta',rows:meta}];
}
export function downloadComparisonWorkbook(sheets:WorkbookSheet[]):void{
  const bytes=buildWorkbook(sheets),url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link=document.createElement('a');link.href=url;link.download='GridAnalyzer_PowerFactory_Comparison.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function downloadComparisonCsv(sheets:WorkbookSheet[]):void{
  const sections=sheets.flatMap(sheet=>[[sheet.name],...sheet.rows,[]]);
  downloadText(csvDocument(sections),'GridAnalyzer_PowerFactory_Comparison.csv','text/csv;charset=utf-8');
}
