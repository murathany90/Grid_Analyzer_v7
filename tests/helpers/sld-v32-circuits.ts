import {acNetwork} from './ac-network';
import type {Bus,CanonicalNetwork,Switch,Line,Transformer2W} from '../../src/domain/model/network';
import {buildStationTopologyGraph,type StationSources} from '../../src/domain/model/station-topology';

export const circuitNames=['breaker-line','isolator-breaker','isolator-breaker-isolator','double-bar','coupler','transfer','bypass','open-isolator','open-breaker','closed-breaker','unknown-order','hv-lv-corridor','branched-series'] as const;
export type CircuitName=typeof circuitNames[number];
type MutableNetwork={-readonly [K in keyof CanonicalNetwork]:CanonicalNetwork[K]};
/** Small source fixtures: the expected order below is authored with the circuit,
 * rather than derived from a renderer or layout helper. */
export function sourceCircuit(name:CircuitName){
 const source:StationSources={bays:[{id:'F',name:'Source feeder',attributes:{}}],terminals:[],switches:[],cubicles:[],substats:[]},entity=(id:string,sourceClass:string)=>({id,sourceId:id,name:id,sourceClass,inService:true,siteIds:['S'],sourceRefs:{}});
 const n:MutableNetwork={...acNetwork(2),modelHash:'PUBLIC_SLD32_'+name,buses:[],lines:[],transformers:[],switches:[],generators:[],loads:[],shunts:[],externalGrids:[],sites:[{...entity('S','ElmSite'),areaId:'A',areaName:'A',voltages:[400,154,33],lat:null,lon:null}]};
 const term=(id:string,kv=400,bar=false)=>{(n.buses as Bus[]).push({...entity(id,'ElmTerm'),vnKv:kv,parentId:bar?'G'+kv:'F'});source.terminals=[...source.terminals,{id,name:id,attributes:{fold_id:bar?'G'+kv:'F',iUsage:bar?0:1}}];};
 const edge=(id:string,usage:string,from:string,to:string,closed=true,cls='ElmCoup')=>{(n.switches as Switch[]).push({...entity(id,cls),from,to,closed});source.switches=[...source.switches,{id,name:id,attributes:{fold_id:'F',aUsage:usage,on_off:Number(closed)}}];return {id,usage,sourceClass:cls,from,to};};
 term('BAR',400,true);const main:ReturnType<typeof edge>[]=[],branches:ReturnType<typeof edge>[]=[];
 const sequence=name==='isolator-breaker'||name==='open-isolator'?['dct','cbk']:['isolator-breaker-isolator','double-bar','transfer','bypass','branched-series'].includes(name)?['dct','cbk','dct']:['cbk'];
 let previous='BAR';for(const [i,usage]of sequence.entries()){const t='NODE'+i;term(t);main.push(edge('SW'+i,usage,previous,t,!(name==='open-isolator'&&i===0||name==='open-breaker'&&usage==='cbk')));previous=t;}
 if(name==='double-bar'||name==='transfer'||name==='bypass'){term('BAR2',400,true);branches.push(edge('ALTERNATE','dct','BAR2',name==='double-bar'?'NODE0':previous,false));}
 if(name==='branched-series')for(const id of ['A','B']){term('BRANCH'+id+'0');term('BRANCH'+id+'1');branches.push(edge('DS'+id+'0','dct',previous,'BRANCH'+id+'0'),edge('DS'+id+'1','dct','BRANCH'+id+'0','BRANCH'+id+'1'));}
 if(name==='coupler'){term('BAR2',400,true);branches.push(edge('END','dct',previous,'BAR2'));}
 else if(name==='hv-lv-corridor'){
  term('MIDDLE',154,true);term('LV',33,true);term('LT',33);source.bays=[...source.bays,{id:'FL',name:'Secondary feeder',attributes:{}}];n.buses=(n.buses as Bus[]).map(t=>t.id==='LT'?{...t,parentId:'FL'}:t);source.terminals=source.terminals.map(t=>t.id==='LT'?{...t,attributes:{...t.attributes,fold_id:'FL'}}:t);
  edge('LVSW','cbk','LV','LT');source.switches=source.switches.map(s=>s.id==='LVSW'?{...s,attributes:{...s.attributes,fold_id:'FL'}}:s);
  (n.transformers as Transformer2W[]).push({...entity('TR','ElmTr2'),from:previous,to:'LT',vnKv:400,lvKv:33,rPu:.01,xPu:.1,gPu:0,bPu:0,tap:1,phase:0,ratingMva:100,tapPosition:0});
 }else{
  (n.buses as Bus[]).push({...entity('REMOTE','ElmTerm'),siteIds:['OTHER'],vnKv:400,parentId:'REMOTE_GROUP'});
  (n.lines as Line[]).push({...acNetwork(2).lines[0],...entity('LINE','ElmLne'),from:previous,to:'REMOTE',vnKv:400});
  if(name==='unknown-order'){const cub='CU';source.cubicles=[{id:cub,name:cub,attributes:{fold_id:previous,obj_id:'LINE'}}];for(const [i,usage]of ['cbk','dct'].entries()){const e=edge('UNKNOWN'+i,usage,previous,previous,true,'StaSwitch');n.switches=(n.switches as Switch[]).map(s=>s.id===e.id?{...s,cubicleId:cub,equipmentId:'LINE'}:s);source.switches=source.switches.map(s=>s.id===e.id?{...s,attributes:{...s.attributes,fold_id:cub,iorder:i+1}}:s);}}
 }
 n.classCounts={ElmBay:source.bays.length,ElmTerm:n.buses.length,ElmCoup:n.switches.filter(s=>s.sourceClass==='ElmCoup').length,StaSwitch:n.switches.filter(s=>s.sourceClass==='StaSwitch').length,StaCubic:source.cubicles.length,ElmLne:n.lines.length,ElmTr2:n.transformers.length};
 return {network:n,source,main,branches,graph:buildStationTopologyGraph(n,'S',source)};
}
