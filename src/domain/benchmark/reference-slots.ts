import type {CanonicalNetwork} from '../model/network';
import {rowObject,type BenchmarkAnalysis,type BenchmarkPackage} from './types';

export const referenceAnalyses:readonly BenchmarkAnalysis[]=['LF','N1','SC'];
export function hasReference(b:BenchmarkPackage|null,a:BenchmarkAnalysis):boolean{return !!b&&(!b.availableAnalyses||b.availableAnalyses.includes(a));}
/** Atomic attachment: exporter structural hashes are compared with exporter hashes,
 * never with GA's JSON byte hash. Study Case and native source membership bind to GA. */
export function mergeReferenceSlots(previous:BenchmarkPackage|null,incoming:BenchmarkPackage,network:CanonicalNetwork):BenchmarkPackage{
  const available=referenceAnalyses.filter(a=>hasReference(incoming,a)),first=incoming.groups[available[0]].identity;
  if((network.studyCase||network.name.replace(/\.(json|zip)$/i,''))!==first.studyCase)throw Error('BENCHMARK_IDENTITY_MISMATCH: active model StudyCase');
  for(const a of referenceAnalyses)if(hasReference(previous,a))for(const field of ['studyCase','studyTime','modelHash','scenarioHash','topologyHash','project','pfVersion'])if(previous!.groups[a].identity[field]!==first[field])throw Error(`BENCHMARK_IDENTITY_MISMATCH: reference slot ${field}`);
  const equipment=new Set([...network.lines,...network.transformers].map(e=>`${e.sourceClass}:${e.sourceId}`)),terminals=new Set(network.buses.map(b=>b.sourceId));
  for(const a of available){
    const table=incoming.groups[a].tables[a==='N1'?'N1_Cases_Raw':a==='SC'?'SC_BusResults_Raw':'GA_Reference_Raw'];
    for(const row of table.rows){const r=rowObject(table,row);if(a==='N1'&&['ElmLne','ElmTr2'].includes(String(r.outageClass))&&!equipment.has(`${r.outageClass}:${r.outageFid}`))throw Error('BENCHMARK_IDENTITY_MISMATCH: native outage FID');if(a==='SC'&&r.physicalTerminalFid&&!terminals.has(String(r.physicalTerminalFid)))throw Error('BENCHMARK_IDENTITY_MISMATCH: native fault FID');}
  }
  const groups={...previous?.groups,...incoming.groups};for(const a of referenceAnalyses)if(!hasReference(incoming,a)&&hasReference(previous,a))groups[a]=previous!.groups[a];
  return {...incoming,groups,availableAnalyses:referenceAnalyses.filter(a=>hasReference(incoming,a)||hasReference(previous,a)),sourceArchives:{...previous?.sourceArchives,...Object.fromEntries(available.map(a=>[a,incoming.archiveSha256]))}};
}
