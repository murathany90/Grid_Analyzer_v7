import type {AppContext} from '../../app/contracts';
import {rowObject,readCell,type RawTable} from './types';
import {emptyScenario,scenarioSignature} from '../scenario/overlay';

const terminals=new WeakMap<NonNullable<AppContext['network']>,Map<string,number>>();
const indices=new WeakMap<RawTable,Map<string,number[]>>();
/** PF MAX fields are independent of GA availability and never become GA solver inputs. */
export function pfFaultReference(ctx:AppContext,fid:string,nominalKv:number|null){
  const n=ctx.network,b=ctx.benchmark,table=b?.groups.SC.tables.SC_BusResults_Raw;
  const absent={ikss:null as number|null,skss:null as number|null,status:'PF_NOT_RECORDED',reason:''};
  if(!n||!b||!table||nominalKv===null)return absent;
  if(scenarioSignature(ctx.scenario.current)!==scenarioSignature(emptyScenario()))return {...absent,reason:'PF_SCENARIO_IDENTITY_UNVERIFIED'};
  // A PF reference column does not require a GA solve or matching electrical partition.
  // Those stronger conditions belong exclusively to GA/PF subtraction.
  if(b.groups.SC.identity.studyCase!==(n.studyCase||n.name.replace(/\.(json|zip)$/i,'')))return {...absent,reason:'PF_MODEL_IDENTITY_UNVERIFIED'};
  let physical=terminals.get(n);if(!physical){physical=new Map(n.buses.map(t=>[t.sourceId,t.vnKv]));terminals.set(n,physical);}if(physical.get(fid)!==nominalKv)return {...absent,reason:'PF_NOMINAL_OR_TERMINAL_MISMATCH'};
  let index=indices.get(table);if(!index){index=new Map();for(let i=0;i<table.rows.length;i++){const row=rowObject(table,table.rows[i]);if(!['3PH','3-Phase Short-Circuit'].includes(String(row.faultType))||row.calculateMode!=='MAX')continue;const key=String(row.physicalTerminalFid??row.fid)+'|'+Number(row.nominalKv),entries=index.get(key)??[];entries.push(i);index.set(key,entries);}indices.set(table,index);}
  const entries=index.get(fid+'|'+nominalKv);if(entries?.length!==1)return {...absent,reason:entries?.length?'PF_DUPLICATE_FAULT':'PF_NOT_RECORDED'};
  const read=(field:string)=>{const cell=readCell(table,entries[0],field);return cell.availability!=='INVALID'&&!cell.qualityFlags.includes('SENTINEL_CANDIDATE')?cell.value:null;};
  return {ikss:read('ikssKa'),skss:read('skssMva'),status:'PF_REFERENCE_ONLY · 3PH MAX',reason:'GA/PF partition and method parity require separate evidence'};
}
