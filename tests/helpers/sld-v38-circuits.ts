import {sourceCircuit} from './sld-v32-circuits';
import {buildStationTopologyGraph} from '../../src/domain/model/station-topology';
import type {Switch} from '../../src/domain/model/network';
export function sourceLeafCircuit(){
 const f=sourceCircuit('isolator-breaker-isolator'),native=f.network.switches[0];
 f.network.buses=[...f.network.buses,{...f.network.buses.find(t=>t.id==='NODE2')!,id:'LEAF',sourceId:'LEAF'}];
 f.network.switches=[...f.network.switches,{...native,id:'LEAF_DS',sourceId:'LEAF_DS',from:'NODE2',to:'LEAF',closed:true}];
 f.source.terminals=[...f.source.terminals,{id:'LEAF',name:'LEAF',attributes:{fold_id:'F',iUsage:1}}];
 f.source.switches=[...f.source.switches,{id:'LEAF_DS',name:'LEAF_DS',sourceClass:'ElmCoup',attributes:{bus1:'LEAF_A',bus2:'LEAF_B',fold_id:'F',aUsage:'dct',on_off:1,outserv:0}}];
 f.source.cubicles=[...f.source.cubicles,{id:'LEAF_A',name:'A',attributes:{fold_id:'NODE2',obj_id:'LEAF_DS'}},{id:'LEAF_B',name:'B',attributes:{fold_id:'LEAF',obj_id:'LEAF_DS'}}];
 return {...f,graph:buildStationTopologyGraph(f.network,'S',f.source)};
}
export function sourceCubicleCircuit(){
 const f=sourceCircuit('hv-lv-corridor'),t=f.network.transformers[0],cub='TR_HV';
 f.source.transformers=[{id:t.id,name:t.name,sourceClass:'ElmTr2',attributes:{bushv:cub,buslv:'TR_LV'}}];
 f.source.cubicles=[...f.source.cubicles,{id:cub,name:cub,attributes:{fold_id:t.from,obj_id:t.id}},{id:'TR_LV',name:'LV',attributes:{fold_id:t.to,obj_id:t.id}}];
 f.network.switches=[...f.network.switches,{...f.network.switches[0],id:'CUB_DS',sourceId:'CUB_DS',sourceClass:'StaSwitch',from:t.from,to:t.from,cubicleId:cub,equipmentId:t.id,closed:false} as Switch];
 f.source.switches=[...f.source.switches,{id:'CUB_DS',name:'CUB_DS',sourceClass:'StaSwitch',attributes:{fold_id:cub,aUsage:'dct',on_off:0,outserv:0}}];
 return {...f,graph:buildStationTopologyGraph(f.network,'S',f.source)};
}
