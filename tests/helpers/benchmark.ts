import { zipSync, strToU8 } from 'fflate';
import { createHash } from 'node:crypto';
import { buildWorkbook, type Cell } from '../../src/features/analysis/xlsx-export';
import { RAW_SCHEMA } from '../../src/importers/powerfactory-benchmark/schema';
import type { BenchmarkAnalysis } from '../../src/domain/benchmark/types';

export const syntheticCase='20261009_1200_SYNTHETIC';
export function syntheticBenchmark(caseName=syntheticCase,change?:(files:Record<string,Uint8Array>)=>void,overrides?:Partial<Record<BenchmarkAnalysis,Record<string,Record<string,Cell>[]>>>):File{
  const files:Record<string,Uint8Array>={};
  for(const analysis of ['LF','N1','SC'] as BenchmarkAnalysis[]){
    const id={addonVersion:'SYNTHETIC_'+analysis,studyCase:caseName,studyTime:'2026-10-09 12:00:00',project:'SYNTHETIC',modelHash:'sha256:synthetic-model',scenarioHash:'sha256:synthetic-scenario',topologyHash:'sha256:synthetic-topology',pfVersion:'SYNTHETIC',requestedMethod:analysis==='LF'?'AC_BALANCED':analysis==='N1'?'SCREENING_AC':'IEC 60909',effectiveMethod:analysis==='LF'?'AC_BALANCED':analysis==='N1'?'SCREENING_AC':'IEC 60909',methodVerificationStatus:'VERIFIED_EXACT'};
    const sheets=Object.entries(RAW_SCHEMA[analysis]).map(([name,headers])=>{
      const records:Record<string,Cell>[]=[];
      if(name==='Analysis_Manifest_Raw')records.push({...id,analysisType:({LF:'LOAD_FLOW',N1:'N1_CONTINGENCY',SC:'SHORT_CIRCUIT'})[analysis]});
      if(name==='GA_Reference_Raw')records.push({kind:'bus',fid:'SYNTHETIC-B1',sourceClass:'ElmTerm',name:'Sentetik Bara',voltagePu:0,angleDeg:null,resultAvailable:1});
      if(name==='SC_BusResults_Raw')records.push({physicalTerminalFid:'SYNTHETIC-B1',ikssKa:0,ipKa:null});
      return {name,rows:[['Synthetic heading'],[],[...headers],...(overrides?.[analysis]?.[name]??records).map(row=>headers.map(h=>row[h]??null))]};
    });
    const workbook=buildWorkbook(sheets),name=`${analysis}.xlsx`;files[name]=workbook;
    files[`${analysis}.json`]=strToU8(JSON.stringify({schemaVersion:'PF-GA-REF-1.0',analysisType:analysis,identity:id,workbook:{file:name,sizeBytes:workbook.byteLength,sha256:createHash('sha256').update(workbook).digest('hex')}}));
    files[`${analysis}.log`]=strToU8(`GUI_EVENT | ${analysis==='LF'?'RUN_STARTED':analysis+'_RUN_STARTED'}\nGUI_INFO | Project=SYNTHETIC StudyCase=${caseName} StudyTime=2026-10-09 12:00:00 PF=SYNTHETIC\n`);
  }
  change?.(files);return new File([zipSync(files)],'benchmark.zip');
}
