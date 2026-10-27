import type {PsseBusBranchNetwork,PsseComplex,PsseZipLoad} from '../../domain/psse/network';
import type {PsseAdmittance} from './ybus';
export interface PsseState {vm:Float64Array;va:Float64Array;busType:Int8Array;qLimited:Map<number,number>;qState:Map<number,'QMIN'|'QMAX'>}
export interface PssePower {p:Float64Array;q:Float64Array;loadP:Float64Array;loadQ:Float64Array;specP:Float64Array;specQ:Float64Array;f:number[];maxP:number;maxQ:number;norm:number}
export interface PsseQPlant {units:PsseBusBranchNetwork['generators'];fixedUnits:PsseBusBranchNetwork['generators'];regulatingUnits:PsseBusBranchNetwork['generators'];fixedQ:number;minimumQ:number;maximumQ:number;specifiedQ:number}
/** Conventional WMOD=0 units with QT=QB have a fixed Q output; all other units remain regulating candidates. */
export function psseQPlantAtBus(network:PsseBusBranchNetwork,bus:number):PsseQPlant{
 const units=network.generators.filter(g=>g.status===1&&g.bus===bus),fixedQRuleApplies=network.buses[bus]?.type===2,fixedUnits=fixedQRuleApplies?units.filter(g=>g.qControl==='FIXED_Q'):[],regulatingUnits=units.filter(g=>!fixedQRuleApplies||g.qControl!=='FIXED_Q'),fixedQ=fixedUnits.reduce((sum,g)=>sum+(g.qFixedMvar??g.qMaxMvar),0),minimumQ=fixedQ+regulatingUnits.reduce((sum,g)=>sum+g.qMinMvar,0),maximumQ=fixedQ+regulatingUnits.reduce((sum,g)=>sum+g.qMaxMvar,0),specifiedQ=fixedQ+regulatingUnits.reduce((sum,g)=>sum+g.qMvar,0);
 return {units,fixedUnits,regulatingUnits,fixedQ,minimumQ,maximumQ,specifiedQ};
}
export function loadAtVoltage(load:PsseZipLoad,v:number,baseMva:number){return {p:(load.pMw+load.ipMw*v+load.ypMw*v*v)/baseMva,q:(load.qMvar+load.iqMvar*v+load.yqMvar*v*v)/baseMva,dp:(load.ipMw+2*load.ypMw*v)/baseMva,dq:(load.iqMvar+2*load.yqMvar*v)/baseMva};}
export function lowVoltageLoadFindings(network:PsseBusBranchNetwork,state:PsseState,profile:'PSSE_SOURCE'|'GENERIC_ZIP'){
 const findings:import('../../importers/psse/types').PsseFinding[]=[];for(const load of network.loads){if(load.status!==1)continue;const vm=state.vm[load.bus],constantP=Math.abs(load.pMw)>1e-9||Math.abs(load.qMvar)>1e-9,constantI=Math.abs(load.ipMw)>1e-9||Math.abs(load.iqMvar)>1e-9,breakpoint=constantP&&vm<.7||constantI&&vm<.5;if(breakpoint)findings.push({severity:profile==='PSSE_SOURCE'?'ERROR':'WARNING',code:profile==='PSSE_SOURCE'?'PSSE_LOW_VOLTAGE_LOAD_CURVE_UNSUPPORTED':'GENERIC_ZIP_BELOW_PSSE_BREAKPOINT',message:`Load ${load.id} at ${vm.toFixed(4)} pu crosses a PSS/E low-voltage load characteristic breakpoint; this solver retains the polynomial ZIP law.`,equipment:load.sourceEquipmentId});}return findings;
}
export function calculatePssePower(network:PsseBusBranchNetwork,ybus:PsseAdmittance,state:PsseState,refBuses:Set<number>):PssePower{
 const n=network.buses.length,p=new Float64Array(n),q=new Float64Array(n),loadP=new Float64Array(n),loadQ=new Float64Array(n),specP=new Float64Array(n),specQ=new Float64Array(n),base=network.baseMva;
 const vr=new Float64Array(n),vi=new Float64Array(n);for(let i=0;i<n;i++){vr[i]=state.vm[i]*Math.cos(state.va[i]);vi[i]=state.vm[i]*Math.sin(state.va[i]);}
 for(let i=0;i<n;i++){let ir=0,ii=0;for(const [j,y]of ybus.rows[i]){ir+=y.re*vr[j]-y.im*vi[j];ii+=y.im*vr[j]+y.re*vi[j];}p[i]=vr[i]*ir+vi[i]*ii;q[i]=vi[i]*ir-vr[i]*ii;}
 for(const load of network.loads)if(load.status===1){const v=state.vm[load.bus],value=loadAtVoltage(load,v,base);loadP[load.bus]+=value.p;loadQ[load.bus]+=value.q;}
 for(const generator of network.generators)if(generator.status===1)specP[generator.bus]+=generator.pMw/base;
 for(let i=0;i<n;i++){specP[i]-=loadP[i];const plant=psseQPlantAtBus(network,i);specQ[i]=(state.qLimited.get(i)??plant.specifiedQ/base)-loadQ[i];}
 const f:number[]=[];let maxP=0,maxQ=0,sum=0;for(let i=0;i<n;i++)if(state.busType[i]!==4&&network.buses[i].status===1&&!refBuses.has(i)){const m=p[i]-specP[i];f.push(m);maxP=Math.max(maxP,Math.abs(m));sum+=m*m;}
 for(let i=0;i<n;i++)if(state.busType[i]===1&&network.buses[i].status===1){const m=q[i]-specQ[i];f.push(m);maxQ=Math.max(maxQ,Math.abs(m));sum+=m*m;}
 return {p,q,loadP,loadQ,specP,specQ,f,maxP,maxQ,norm:Math.sqrt(sum)};
}
