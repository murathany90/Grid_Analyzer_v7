import type {AppContext} from '../../src/app/contracts';
import type {BenchmarkPackage,RawTable} from '../../src/domain/benchmark/types';
import type {ScResult,ScFaultResult} from '../../src/analysis/short-circuit';
import {acNetwork} from './ac-network';
import {ScenarioStore,scenarioSignature} from '../../src/domain/scenario/overlay';
import {ResultStore} from '../../src/domain/results/store';
import {AnalysisSettingsStore} from '../../src/domain/calculation/analysis-settings';
import {initialResultView} from '../../src/domain/results/workspace';
import {defaultSettings} from '../../src/persistence/settings';
import {allVoltageBands} from '../../src/domain/model/voltage-band';

export function scAuditFixture(count=3){
  const base=acNetwork(),site={...base.buses[0],id:'STATION',sourceId:'STATION',sourceClass:'ElmSite',name:'Test TM',areaId:'A',areaName:'Test YTM',lat:39,lon:32,voltages:[100]},network={...base,modelHash:'sc-audit-'+count,name:'synthetic',sites:[site],buses:Array.from({length:count},(_,i)=>({...base.buses[0],id:'B'+i,sourceId:'B'+i,name:'Terminal '+i,siteIds:[site.id]}))},scenario=new ScenarioStore(network.modelHash),analysisSettings=new AnalysisSettingsStore();
  const headers=['physicalTerminalFid','physicalTerminalName','nominalKv','faultType','calculateMode','ikssKa','skssMva'],table:RawTable={name:'SC_BusResults_Raw',headers,rows:Array.from({length:count},(_,i)=>['B'+i,'Terminal '+i,100,'3PH','MAX',i===1?0:6+i,Math.sqrt(3)*100*(i===1?0:6+i)]),rowNumbers:Array.from({length:count},(_,i)=>i+2),metadata:{},fileSha256:'synthetic',analysis:'SC',headerRow:1};
  const group=(analysis:'LF'|'N1'|'SC')=>({analysis,identity:{studyCase:'synthetic'},tables:analysis==='SC'?{SC_BusResults_Raw:table}:{},workbook:{file:'synthetic',sha256:'synthetic',sizeBytes:0},log:{file:'synthetic',sha256:'synthetic',text:''},sidecarSha256:'synthetic'});
  const benchmark={groups:{LF:group('LF'),N1:group('N1'),SC:group('SC')}} as unknown as BenchmarkPackage;
  const ctx={network,benchmark,scenario,analysisSettings,resultStore:new ResultStore(),settings:{value:defaultSettings()},filters:{areaId:'',siteId:'',voltages:allVoltageBands(),search:''},resultView:{...initialResultView(),analysis:'SC',faultId:'B0',metric:'ikssKa',phase:'POST'},scResult:null,scCatalog:null,n1AcResults:[],hybridResult:null,n1Result:null,busy:false,view:'map'} as unknown as AppContext;
  const fault=(i:number,status:ScFaultResult['status']='BLOCKED'):ScFaultResult=>({physicalTerminalFid:'B'+i,physicalTerminalFids:['B'+i],electricalBusId:'E'+i,nominalKv:100,componentId:0,status,reasons:status==='BLOCKED'?['MISSING_IEC_FACTOR']:[],ikssKa:status==='CALCULATED_NETWORK_APPROXIMATION'?i: null,skssMva:status==='CALCULATED_NETWORK_APPROXIMATION'?Math.sqrt(3)*100*i:null,zkkOhm:null,ipKa:null,ibKa:null,ithKa:null,residual:null});
  const result=(faults:ScFaultResult[]):ScResult=>({identity:{modelHash:network.modelHash,scenarioHash:scenarioSignature(scenario.current),profileHash:'PROFILE',sourceHash:'SOURCE'},method:'GA_POSITIVE_SEQUENCE_3PH_MAX',profile:{faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'TEST_APPROXIMATION',edition:null,rfOhm:0,xfOhm:0,maxFaults:10,timeBudgetMs:1000},faults,counts:{},componentEvidence:[],assumptions:[],factorizations:0,rhsCount:0,dimensions:[],elapsedMs:0});
  return {ctx,network,benchmark,table,fault,result};
}
