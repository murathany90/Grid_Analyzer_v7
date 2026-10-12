import {acNetwork} from './ac-network';
import {buildStationTopologyGraph,type StationSources} from '../../src/domain/model/station-topology';
import type {Bus,Switch,Transformer2W,Line} from '../../src/domain/model/network';
export function ytbsFixture(){
 const n={...acNetwork(2),lines:[] as Line[],loads:[],externalGrids:[],buses:[] as Bus[],transformers:[] as Transformer2W[],switches:[] as Switch[]},entity=(id:string,sourceClass:string)=>({id,sourceId:id,name:id,sourceClass,inService:true,siteIds:['S'],sourceRefs:{}});
 const source:StationSources={bays:[],terminals:[],switches:[],cubicles:[],substats:[]};
 const term=(id:string,kv:number,parent:string,bar=false)=>{n.buses.push({...entity(id,'ElmTerm'),vnKv:kv,parentId:parent} as Bus);source.terminals=[...source.terminals,{id,name:id,attributes:{fold_id:parent,iUsage:bar?0:1}}];};
 const bay=(id:string)=>{if(!source.bays.some(b=>b.id===id))source.bays=[...source.bays,{id,name:id,attributes:{}}];};
 const sw=(id:string,from:string,to:string,parent:string,kind='dct',closed=true)=>{bay(parent);n.switches.push({...entity(id,'ElmCoup'),from,to,closed} as Switch);source.switches=[...source.switches,{id,name:id,attributes:{fold_id:parent,aUsage:kind,on_off:Number(closed)}}];};
 for(const [id,kv]of [['H',400],['M',154],['M2',154],['L',33]] as const)term(id,kv,'G'+kv,true);
 for(const [id,kv,parent]of [['Ht',400,'FH'],['Mt',154,'FMI'],['Mp',154,'FMO'],['Lt',33,'FL']] as const){bay(parent);term(id,kv,parent);}
 sw('H_CB','H','Ht','FH','cbk');sw('M_IN','M','Mt','FMI');sw('M_OUT','M','Mp','FMO','cbk');sw('L_IN','L','Lt','FL');sw('COUPLER','M','M2','FC','cbk',false);
 const transformer={rPu:0.01,xPu:0.1,gPu:0,bPu:0,tap:1,phase:0,ratingMva:100,parallel:1,typeId:null,tapPosition:0};
 n.transformers=[{...transformer,...entity('T1','ElmTr2'),from:'Ht',to:'Mt',vnKv:400,lvKv:154},{...transformer,...entity('T2','ElmTr2'),from:'Mp',to:'Lt',vnKv:154,lvKv:33}];
 const line=(id:string,kv:number)=>{const b='F'+id,t='P'+id;bay(b);term(t,kv,b);sw('SW'+id,kv===400?'H':kv===154?'M':'L',t,b,'cbk');n.lines.push({...acNetwork(2).lines[0],...entity(id,'ElmLne'),from:t,to:'REMOTE',vnKv:kv});};
 const graph=()=>buildStationTopologyGraph(n,'S',source);
 return {n,source,term,bay,sw,line,graph};
}
