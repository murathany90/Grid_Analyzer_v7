import type {AppContext} from '../src/app/contracts';
import type {PsseBus,PsseBusBranchNetwork,PsseBranch} from '../src/domain/psse/network';
import type {PsseModel,PsseEquipment} from '../src/importers/psse/types';
import {decodePsse} from '../src/importers/psse/decode';
import {normalizePsseBusBranch} from '../src/domain/psse/network';
import {createPsseScenario} from '../src/domain/psse/scenario';
import {solvePsseNewton} from '../src/analysis/psse/newton';
import {createPsseMapView} from '../src/features/psse/map-view';
import {createPsseSldView} from '../src/features/psse/sld-view';
import '../src/styles/tokens.css';
import '../src/styles/psse.css';

const response=await fetch('/.tmp/psse-synthetic/three-winding.rawx');if(!response.ok)throw Error('Synthetic RAWX could not be loaded.');const rawx=await response.arrayBuffer(),model=await decodePsse(rawx,'three-winding.rawx'),base=normalizePsseBusBranch(model),scenario=createPsseScenario(base),calculation=solvePsseNewton({model,network:base,scenario});
const ctx={modelMode:'PSSE',psseInspection:model,psseNetwork:base,psseScenario:scenario,psseCalculation:calculation,subscribe:()=>()=>{},notify(){}} as unknown as AppContext;
const map=createPsseMapView(ctx),sld=createPsseSldView(ctx),host=document.getElementById('diagram-app')!;host.style.cssText='max-width:1700px;margin:auto;padding:12px';
const bar=document.createElement('nav');bar.style.cssText='display:flex;gap:8px;padding:8px;position:sticky;top:0;background:#091322;z-index:9';
const button=(label:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;return b;};const show=(feature:typeof map)=>{host.replaceChildren(bar,feature.element);feature.render();};
function expandTo6851(seedModel:PsseModel,seedNetwork:PsseBusBranchNetwork){const bigModel=structuredClone(seedModel),network=structuredClone(seedNetwork),sourceBuses=network.buses.filter(bus=>bus.source),existing=new Set(sourceBuses.map(bus=>bus.externalNumber).filter((value):value is number=>value!==null));const templateBus=sourceBuses[0],templateBranch=network.branches.find(branch=>branch.kind==='line')!;let last=sourceBuses[sourceBuses.length-1],sourceCount=sourceBuses.length;
 while(sourceCount<6851){let number=existing.size+1;while(existing.has(number))number++;existing.add(number);const id=`bus:${number}`,baseKv=sourceCount===6850?null:templateBus.baseKv,fields={...bigModel.equipment.find(e=>e.id===templateBus.sourceEquipmentId)!.fields,ibus:number,connectionKey:String(number),name:`Searchable Bus ${number}`,baskv:baseKv,ide:1,vm:1,va:0,area:1,zone:1,owner:1},equipment:PsseEquipment={id,kind:'bus',name:`Searchable Bus ${number}`,buses:[number],status:1,nominalKv:baseKv,fields,operating:{vm:{value:1,provenance:'SOURCE_INPUT',field:'BUS.vm',unit:'pu'},va:{value:0,provenance:'SOURCE_INPUT',field:'BUS.va',unit:'deg'}}};bigModel.equipment.push(equipment);const index=network.buses.length,bus:PsseBus={...templateBus,id,connectionKey:String(number),externalNumber:number,section:null,sourceEquipmentId:id,baseKv,type:1,status:1,initialVm:1,initialVaDeg:0,source:true,fieldMap:templateBus.fieldMap.map(field=>({...field,sourceEquipmentId:id}))};network.buses.push(bus);network.sourceToNumerical[id]=[`bus:${number}`];
  const idBranch=`line:${last.externalNumber}:${number}:1`,branch:PsseBranch={...templateBranch,id:idBranch,sourceEquipmentId:idBranch,windingId:'1',from:network.buses.indexOf(last),to:index,fromKey:last.connectionKey,toKey:bus.connectionKey,terminalFrom:last.connectionKey,terminalTo:bus.connectionKey,status:1,fieldMap:templateBranch.fieldMap.map(field=>({...field,sourceEquipmentId:idBranch}))};network.branches.push(branch);network.sourceToNumerical[idBranch]=[idBranch];bigModel.equipment.push({id:idBranch,kind:'line',name:`Synthetic search line ${number}`,buses:[last.externalNumber??0,number],status:1,nominalKv:templateBus.baseKv,fields:{ibus:last.externalNumber,jbus:number,ckt:'1',name:`Synthetic search line ${number}`,area:1,zone:1,owner:1,stat:1},operating:{}});last=bus;sourceCount++;
 }
 const expandedScenario=createPsseScenario(network);return{model:bigModel,network,scenario:expandedScenario};}
const expanded=expandTo6851(model,base);bar.append(button('Şematik harita',()=>show(map)),button('Tek hat · üç sargılı',()=>show(sld)),button('6851 baralı arama',()=>{ctx.psseInspection=expanded.model;ctx.psseNetwork=expanded.network;ctx.psseScenario=expanded.scenario;ctx.psseCalculation=null;show(map);const input=host.querySelector<HTMLInputElement>('input[type=search]');if(input){input.value='6851';input.dispatchEvent(new Event('input',{bubbles:true}));}}));show(sld);

declare global{interface Window{psseDiagramHarness:{model:PsseModel;network:PsseBusBranchNetwork;scenario:ReturnType<typeof createPsseScenario>;calculation:ReturnType<typeof solvePsseNewton>;expanded:ReturnType<typeof expandTo6851>}}}
window.psseDiagramHarness={model,network:base,scenario,calculation,expanded};
