import { zipSync,strToU8 } from 'fflate';
import { syntheticBenchmark,syntheticCase } from './benchmark';

export function syntheticBenchmarkPair(scOnly=false){
  const table=(Attributes:string[],Values:unknown[][])=>({Attributes,Values});
  const raw={
    IntCase:table(['FID','loc_name'],[['CASE',syntheticCase]]),
    ElmTerm:table(['FID','loc_name','fold_id','uknom','outserv','iUsage'],[['SYN-B0','Bara 0','G0',100,0,0],['SYN-B1','Bara 1','G1',100,0,0]]),
    StaCubic:table(['FID','fold_id','obj_id'],[['SYN-C0','SYN-B0','SYN-LINE'],['SYN-C1','SYN-B1','SYN-LINE'],['SYN-CX','SYN-B0','SYN-X']]),
    TypLne:table(['FID','loc_name','uline','sline','rline','xline','bline'],[['SYN-TYPE','Sentetik Hat Tipi',100,1,1,10,0]]),
    ElmLne:table(['FID','loc_name','fold_id','typ_id','bus1','bus2','dline','outserv','fline'],[['SYN-LINE','Sentetik Hat','G0','SYN-TYPE','SYN-C0','SYN-C1',1,0,1]]),
    ElmXnet:table(['FID','loc_name','fold_id','bus1','outserv','bustp','mode_inp','usetp','pgini','qgini'],scOnly?[]:[['SYN-X','Sentetik Kaynak','G0','SYN-CX',0,'SL','PQ',1,0,0]]),
    ElmVac:table(['FID','loc_name','bus1','outserv','r1','x1','usetp'],scOnly?[['VAC','Explicit impedance source','SYN-CX',0,1,10,1]]:[]),
  };
  const model=new File([zipSync({[syntheticCase+'.json']:strToU8(JSON.stringify(raw))})],syntheticCase+'.zip');
  const meta=(key:string,value:string)=>({kind:'meta',key,value});
  const benchmark=syntheticBenchmark(syntheticCase,undefined,{LF:{
    GA_Reference_Raw:[{kind:'bus',fid:'SYN-B0',physicalTerminalFid:'SYN-B0',calculationBusKey:'SYN-B0',electricalBusKey:'SYN-B0',name:'Bara 0',sourceClass:'ElmTerm',voltagePu:1,voltageKv:100,nominalKv:100,angleDeg:0,resultAvailable:1,isReferenceBus:1},{kind:'bus',fid:'SYN-B1',physicalTerminalFid:'SYN-B1',calculationBusKey:'SYN-B1',electricalBusKey:'SYN-B1',name:'Bara 1',sourceClass:'ElmTerm',voltagePu:1,voltageKv:100,nominalKv:100,angleDeg:0,resultAvailable:1},{kind:'line',fid:'SYN-LINE',name:'Sentetik Hat',sourceClass:'ElmLne',fromBusFid:'SYN-B0',toBusFid:'SYN-B1',pFromMw:0,qFromMvar:0,pToMw:0,qToMvar:0,resultAvailable:1}],
    ControlContext_Raw:[meta('schemaVersion','PF-GA-CONTROL-1.0'),meta('modelId',syntheticCase),meta('studyTimeLocal','2026-10-09 12:00:00'),meta('summary.elmLodCount','0'),meta('summary.elmStactrlCount','0'),meta('summary.stationControllerMemberCount','0'),meta('summary.elmStactrlPsymRefRows','0'),meta('summary.elmStactrlCvqqRows','0')],
  },N1:{N1_Cases_Raw:[{caseId:'SYN-CUT',outageClass:'ElmLne',outageFid:'SYN-LINE',outageName:'Sentetik Hat',casePostMaxLoadingPercent:0}],N1_CaseStatus_Raw:[{caseId:'SYN-CUT',caseStatus:'CAPABILITY_UNVERIFIED'}]},...scOnly?{SC:{SC_BusResults_Raw:[{physicalTerminalFid:'SYN-B0',nominalKv:100,calculationBusKey:'SYN-B0',faultType:'3-Phase Short-Circuit',calculateMode:'MAX',rfOhm:0,xfOhm:0,ikssKa:6},{physicalTerminalFid:'SYN-B1',nominalKv:100,calculationBusKey:'SYN-B1',faultType:'3-Phase Short-Circuit',calculateMode:'MAX',rfOhm:0,xfOhm:0,ikssKa:3}]}}:{}});
  return {model,benchmark,raw};
}
