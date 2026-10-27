import type {PsseFinding} from '../../importers/psse/types';
import type {PsseBusBranchNetwork} from '../../domain/psse/network';
import type {PsseGeneratorResult} from '../../domain/psse/results';
import {psseQPlantAtBus,type PssePower,type PsseState} from './mismatch';

/** Return machine values only where the machine-level dispatch follows directly from the equations. */
export function psseGeneratorResults(network:PsseBusBranchNetwork,state:PsseState,power:PssePower,reactiveLimitsEnabled:boolean,findings:PsseFinding[]):PsseGeneratorResult[]{
 const activeByBus=new Map<number,typeof network.generators>();for(const g of network.generators)if(g.status===1){const list=activeByBus.get(g.bus)??[];list.push(g);activeByBus.set(g.bus,list);}
 const byId=new Map<string,PsseGeneratorResult>();
 for(const [bus,units]of activeByBus){
  const reference=state.busType[bus]===3,limited=state.qLimited.has(bus),totalP=(power.p[bus]+power.loadP[bus])*network.baseMva,totalQ=(power.q[bus]+power.loadQ[bus])*network.baseMva,plant=psseQPlantAtBus(network,bus),fixed=plant.fixedUnits,regulating=plant.regulatingUnits,fixedQ=plant.fixedQ;
  const unavailableRegulatorDispatch=regulating.length>1&&(reference||state.busType[bus]===2||limited);
  if(unavailableRegulatorDispatch)findings.push({severity:'WARNING',code:'PER_MACHINE_DISPATCH_UNAVAILABLE',message:`${regulating.length} regulating generators share bus ${network.buses[bus].id}; the supported bus equations determine their aggregate Q, not individual machine dispatch.`});
  for(const g of fixed){const p=reference?null:g.pMw;byId.set(g.id,{id:g.id,sourceEquipmentId:g.sourceEquipmentId,pMw:p,qMvar:g.qFixedMvar??g.qMaxMvar,limitState:'FIXED_Q'});}
  for(const g of regulating){let q:number|null=g.qMvar,limitState:PsseGeneratorResult['limitState']='FREE';
   if(reference){if(units.length===1)q=totalQ;else q=null;}
   else if(regulating.length===1&&(state.busType[bus]===2||limited))q=totalQ-fixedQ;
   else if(regulating.length>1&&(state.busType[bus]===2||limited))q=null;
   if(reactiveLimitsEnabled&&regulating.length===1){const activeState=state.qState.get(bus);if(activeState==='QMIN')limitState='QMIN';else if(activeState==='QMAX')limitState='QMAX';else if(limited&&q!==null){if(q<=g.qMinMvar+.02)limitState='QMIN';else if(q>=g.qMaxMvar-.02)limitState='QMAX';}}
   if(q===null)limitState='UNAVAILABLE';byId.set(g.id,{id:g.id,sourceEquipmentId:g.sourceEquipmentId,pMw:reference?(units.length===1?totalP:null):g.pMw,qMvar:q,limitState});
  }
 }
 return network.generators.map(g=>g.status===0?{id:g.id,sourceEquipmentId:g.sourceEquipmentId,pMw:null,qMvar:null,limitState:'UNAVAILABLE'}:byId.get(g.id)??{id:g.id,sourceEquipmentId:g.sourceEquipmentId,pMw:null,qMvar:null,limitState:'UNAVAILABLE'});
}
