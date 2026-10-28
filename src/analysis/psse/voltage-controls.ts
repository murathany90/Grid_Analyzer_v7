import type {PsseModel,PsseFinding} from '../../importers/psse/types';
import type {PsseBusBranchNetwork,PsseGenerator,PsseBranch} from '../../domain/psse/network';
import type {PsseState} from './mismatch';
import {calculatePssePower} from './mismatch';
import {buildPsseJacobian} from './jacobian';
import {csrFromRows,solvePssERealSparse} from './sparse';
import type {PsseAcOptions,PsseSolveInput} from './newton';
import type {buildPsseYbus} from './ybus';

interface Plant {units:PsseGenerator[];weight:number;sourceBus:number}
export interface PsseDroopCurve {name:string;qmin:number;qmax:number;qdb:number;vlow:number;vdblow:number;vdbhigh:number;vhigh:number}
interface ControlledUnit extends PsseGenerator {controlTarget:number;curve?:PsseDroopCurve}
interface Group {target:number;vs:number;plants:Plant[];q:number;minimum:number;maximum:number;limited:boolean;bound?:number;curve?:PsseDroopCurve;edges?:PsseBranch[]}
export interface PsseVoltageControls {groups:Group[];findings:PsseFinding[];controlledIds:Set<string>}
/** Plant RMPCT is counted once; co-located unit sharing follows active PGEN, not MBASE.
 * These are independently observed PSS/E tiny-case rules, with explicit bound redistribution. */
export function preparePsseVoltageControls(model:PsseModel,original:PsseBusBranchNetwork,fixed:PsseBusBranchNetwork){
 const equipment=new Map(model.equipment.map(e=>[e.id,e])),curves=model.equipment.filter(e=>e.kind==='other'&&e.status===1&&(String(e.fields.subtype??'').toLowerCase()==='voltage-droop'||String(e.fields.sourceTable??'').toUpperCase()==='VOLTAGE_DROOP_CONTROL'));
 const eligible:ControlledUnit[]=[];
 for(const g of original.generators){if(g.status!==1||g.qControl!=='REGULATING'||original.buses[g.bus].type!==2||g.vsPu===null)continue;
  const source=equipment.get(g.sourceEquipmentId),named=String(source?.fields.droopname??'').trim(),index=Number(source?.fields.voltageDroopIndex??0),record=curves.find(e=>named!==''&&String(e.name).trim()===named||index>0&&Number(e.fields.savIndex)===index);
  const unit:ControlledUnit={...g,controlTarget:g.remoteBus!==null&&g.remoteBus>=0?g.remoteBus:g.bus};
  if(record){const f=record.fields,reg=Number(f.regbus??0),key=String(f.regConnectionKey??reg),target=original.buses.findIndex(b=>b.connectionKey===key||b.externalNumber===reg);if(reg!==0&&target>=0)unit.controlTarget=target;
   const curve={name:record.name,qmin:Number(f.qmin),qmax:Number(f.qmax),qdb:Number(f.qdb),vlow:Number(f.vlow),vdblow:Number(f.vdblow),vdbhigh:Number(f.vdbhigh),vhigh:Number(f.vhigh)};
   if(Object.values(curve).filter(v=>typeof v==='number').every(Number.isFinite)&&curve.vlow<curve.vdblow&&curve.vdblow<=curve.vdbhigh&&curve.vdbhigh<curve.vhigh&&curve.qmin<curve.qdb&&curve.qdb<curve.qmax)unit.curve=curve;
   else continue;
  }
  eligible.push(unit);
 }
 const ids=new Set(eligible.map(g=>g.id)),sourceById=new Map(eligible.map(g=>[g.id,g]));
 for(const g of fixed.generators)if(ids.has(g.id)){const source=sourceById.get(g.id)!;g.qControl='FIXED_Q';g.qFixedMvar=source.qMvar;g.qMinMvar=source.qMinMvar;g.qMaxMvar=source.qMaxMvar;}
 return {eligible,ids};
}
export function remapPsseVoltageControls(eligible:ControlledUnit[],network:PsseBusBranchNetwork,busToNode:Int32Array):PsseVoltageControls{
 const groups=new Map<string,Group>(),findings:PsseFinding[]=[],byId=new Map(network.generators.map(g=>[g.id,g]));
 for(const source of eligible){const target=busToNode[source.controlTarget],key=target+'|'+(source.curve?.name??'VS'),g=byId.get(source.id)!;let group=groups.get(key);
  if(!group){group={target,vs:source.vsPu!,plants:[],q:0,minimum:0,maximum:0,limited:false,curve:source.curve};groups.set(key,group);}
  if(!group.curve&&Math.abs(group.vs-source.vsPu!)>1e-5)findings.push({severity:'ERROR',code:'VOLTAGE_CONTROL_CONFLICTING_SETPOINTS',message:'Controllers assigned to the same numerical regulated bus have incompatible VS setpoints.'});
  let plant=group.plants.find(p=>p.sourceBus===source.bus);
  if(!plant){plant={units:[],weight:Math.max(source.participation,0),sourceBus:source.bus};group.plants.push(plant);}else if(Math.abs(plant.weight-Math.max(source.participation,0))>1e-6)findings.push({severity:'ERROR',code:'VOLTAGE_CONTROL_CONFLICTING_PLANT_RMPCT',message:'Machines in one source plant specify inconsistent plant participation values.'});plant.units.push(g);group.q+=source.qMvar/network.baseMva;group.minimum+=source.qMinMvar/network.baseMva;group.maximum+=source.qMaxMvar/network.baseMva;
 }
 const accepted:Group[]=[];
 for(const group of groups.values()){
  const units=group.plants.flatMap(p=>p.units),ids=new Set(units.map(g=>g.id));let valid=network.buses[group.target]?.status===1&&network.buses[group.target]?.type!==3;
  if(group.curve){
   if([...groups.values()].some(other=>other!==group&&other.target===group.target))valid=false;
   const plantNodes=new Set<number>(),queue=units.map(g=>g.bus).filter(b=>b!==group.target);
   while(queue.length){const node=queue.pop()!;if(plantNodes.has(node)||node===group.target)continue;plantNodes.add(node);for(const b of network.branches)if(b.status===1){if(b.from===node&&b.to!==group.target)queue.push(b.to);else if(b.to===node&&b.from!==group.target)queue.push(b.from);}}
   if(network.generators.some(g=>g.status===1&&plantNodes.has(g.bus)&&!ids.has(g.id)))valid=false;
   group.edges=network.branches.filter(b=>b.status===1&&(b.from===group.target&&plantNodes.has(b.to)||b.to===group.target&&plantNodes.has(b.from)));
   if(units.some(g=>g.bus!==group.target)&&!group.edges.length)valid=false;
  }
  if(valid)accepted.push(group);else findings.push({severity:'WARNING',code:'VOLTAGE_CONTROL_TOPOLOGY_UNSUPPORTED',message:'A voltage controller has incompatible setpoint/reference or non-radial PCC boundaries; its source Q is held explicitly.'});
 }
 return {groups:accepted,findings,controlledIds:new Set(accepted.flatMap(g=>g.plants.flatMap(p=>p.units.map(u=>u.id))))};
}
/** Source Q is defined at the PCC, including feeder losses, rather than at machine terminals. */
export function psseDroopAtVoltage(curve:PsseDroopCurve,v:number){
 if(v<=curve.vlow)return{q:curve.qmax,slope:0};if(v<curve.vdblow){const slope=(curve.qdb-curve.qmax)/(curve.vdblow-curve.vlow);return{q:curve.qmax+slope*(v-curve.vlow),slope};}
 if(v<=curve.vdbhigh)return{q:curve.qdb,slope:0};if(v<curve.vhigh){const slope=(curve.qmin-curve.qdb)/(curve.vhigh-curve.vdbhigh);return{q:curve.qdb+slope*(v-curve.vdbhigh),slope};}return{q:curve.qmin,slope:0};
}
function pccReactive(group:Group,state:PsseState,base:number){
 const derivatives=new Map<number,{angle:number;vm:number}>(),add=(i:number,angle:number,vm:number)=>{const old=derivatives.get(i)??{angle:0,vm:0};old.angle+=angle;old.vm+=vm;derivatives.set(i,old);};let q=0;
 for(const b of group.edges??[]){const from=b.from===group.target,i=group.target,j=from?b.to:b.from,y=from?b.yff:b.ytt,yij=from?b.yft:b.ytf,vi=state.vm[i],vj=state.vm[j],d=state.va[i]-state.va[j],term=yij.re*Math.sin(d)-yij.im*Math.cos(d),angle=vi*vj*(yij.re*Math.cos(d)+yij.im*Math.sin(d));q+=y.im*vi*vi-vi*vj*term;add(i,-angle,2*y.im*vi-vj*term);add(j,angle,-vi*term);}
 for(const plant of group.plants)for(const unit of plant.units)if(unit.bus===group.target)q+=(unit.qFixedMvar??unit.qMvar)/base;
 return{q,derivatives};
}
function controlError(group:Group,state:PsseState,base:number){return group.curve?pccReactive(group,state,base).q-psseDroopAtVoltage(group.curve,state.vm[group.target]).q/base:state.vm[group.target]-group.vs;}
/** Piecewise affine bounded sharing, returning exact active-set derivatives. */
function share(total:number,items:{weight:number;min:number;max:number}[]){
 const values=new Array<number>(items.length).fill(0),derivatives=new Array<number>(items.length).fill(0),free=items.map((_,i)=>i);let remaining=total;
 for(let round=0;round<=items.length&&free.length;round++){
  const weight=free.reduce((s,i)=>s+items[i].weight,0),weights=free.map(i=>weight>0?items[i].weight/weight:1/free.length),clamped:number[]=[];
  const pending=remaining;free.forEach((i,k)=>{const candidate=pending*weights[k],value=Math.min(items[i].max,Math.max(items[i].min,candidate));if(Math.abs(value-candidate)>1e-10){values[i]=value;remaining-=value;clamped.push(i);}});
  if(!clamped.length){free.forEach((i,k)=>{values[i]=remaining*weights[k];derivatives[i]=weights[k];});break;}
  for(const i of clamped)free.splice(free.indexOf(i),1);
 }
 return {values,derivatives};
}
function assign(group:Group,base:number,enforceLimits=true){
 const plant=share(group.q*base,group.plants.map(p=>({weight:p.weight,min:enforceLimits?p.units.reduce((s,g)=>s+g.qMinMvar,0):-Infinity,max:enforceLimits?p.units.reduce((s,g)=>s+g.qMaxMvar,0):Infinity}))),derivatives=new Map<number,number>();
 group.plants.forEach((p,i)=>{const units=share(plant.values[i],p.units.map(g=>({weight:Math.max(g.pMw,0),min:enforceLimits?g.qMinMvar:-Infinity,max:enforceLimits?g.qMaxMvar:Infinity})));p.units.forEach((g,j)=>{g.qFixedMvar=units.values[j];derivatives.set(g.bus,(derivatives.get(g.bus)??0)+plant.derivatives[i]*units.derivatives[j]);});});
 return derivatives;
}
export function psseVoltageControlSummary(controls:PsseVoltageControls,state:PsseState){return {formulation:'AUGMENTED_NEWTON_IREG_RMPCT',groups:controls.groups.length,limitedGroups:controls.groups.filter(g=>g.limited).length,droopGroups:controls.groups.filter(g=>!!g.curve).length,maxUnconstrainedVoltageErrorPu:Math.max(0,...controls.groups.filter(g=>!g.limited&&!g.curve).map(g=>Math.abs(state.vm[g.target]-g.vs))),maxVoltageErrorPu:Math.max(0,...controls.groups.filter(g=>!g.curve).map(g=>Math.abs(state.vm[g.target]-g.vs)))};}
export function runPsseControlledNewton(input:PsseSolveInput,network:PsseBusBranchNetwork,state:PsseState,ybus:ReturnType<typeof buildPsseYbus>,refs:Set<number>,settings:PsseAcOptions,offset:number,controls:PsseVoltageControls){
 const groups=controls.groups;let iteration=0,linearDiagnostics:unknown=null,lineSearchReductions=0;
 const residual=(switchModes=false)=>{const derivatives=groups.map(g=>assign(g,network.baseMva,settings.reactiveLimitsEnabled!==false)),power=calculatePssePower(network,ybus,state,refs),extra=groups.map(g=>{const e=controlError(g,state,network.baseMva);if(switchModes){g.limited=settings.reactiveLimitsEnabled!==false&&((g.q>=g.maximum-1e-10&&e<0)||g.q>g.maximum+1e-10||(g.q<=g.minimum+1e-10&&e>0)||g.q<g.minimum-1e-10);g.bound=g.q>=g.maximum-1e-10?g.maximum:g.minimum;}return g.limited?g.q-g.bound!:e;}),f=[...power.f,...extra];return{power,derivatives,f,norm:Math.hypot(...f),max:Math.max(power.maxP,power.maxQ,...extra.map(Math.abs))};};
 let current=residual(true);
 for(;iteration<settings.maxIterations!;iteration++){
  if(input.cancelled?.())return{status:'CANCELLED' as const,power:current.power,iteration,linearDiagnostics,lineSearchReductions};
  current=residual(true);
  input.progress?.({phase:'NR_IREG_RMPCT',iteration:offset+iteration,residualPu:current.max});
  if(current.max<=settings.tolerancePu!)return{status:'CONVERGED' as const,power:current.power,iteration,linearDiagnostics,lineSearchReductions};
  const layout=buildPsseJacobian(network,ybus,state,current.power,refs),n=layout.matrix.N,rows:Map<number,number>[]=[];
  for(let i=0;i<n;i++){const row=new Map<number,number>();for(let p=layout.matrix.rowPtr[i];p<layout.matrix.rowPtr[i+1];p++)row.set(layout.matrix.colIdx[p],layout.matrix.values[p]);rows.push(row);}
  groups.forEach((group,k)=>{for(const [bus,dq]of current.derivatives[k])if(layout.qRow[bus]>=0)rows[layout.qRow[bus]].set(n+k,-dq);const row=new Map<number,number>();if(group.limited)row.set(n+k,1);else if(group.curve){const pcc=pccReactive(group,state,network.baseMva);for(const [bus,d]of pcc.derivatives){if(layout.angleColumn[bus]>=0)row.set(layout.angleColumn[bus],(row.get(layout.angleColumn[bus])??0)+d.angle);if(layout.vmColumn[bus]>=0)row.set(layout.vmColumn[bus],(row.get(layout.vmColumn[bus])??0)+d.vm);}const col=layout.vmColumn[group.target];if(col>=0)row.set(col,(row.get(col)??0)-psseDroopAtVoltage(group.curve,state.vm[group.target]).slope/network.baseMva);const local=current.derivatives[k].get(group.target)??0;if(local)row.set(n+k,local);}else if(layout.vmColumn[group.target]>=0)row.set(layout.vmColumn[group.target],1);rows.push(row);});
  let solved;try{solved=solvePssERealSparse(csrFromRows(rows),Float64Array.from(current.f,x=>-x));}catch(error){return{status:'NON_CONVERGED' as const,power:current.power,iteration,linearDiagnostics:{error:String(error),dimension:rows.length},lineSearchReductions};}
  linearDiagnostics=solved.diagnostics;if(!solved.x||solved.relativeResidual===null||solved.relativeResidual>1e-6)return{status:'NON_CONVERGED' as const,power:current.power,iteration,linearDiagnostics,lineSearchReductions};
  const oldVm=Float64Array.from(state.vm),oldVa=Float64Array.from(state.va),oldQ=groups.map(g=>g.q),dx=solved.x,oldNorm=current.norm;let accepted=false;
  for(let alpha=1;alpha>=1/128;alpha/=2){state.vm.set(oldVm);state.va.set(oldVa);for(const bus of layout.angleBuses)state.va[bus]+=alpha*dx[layout.angleColumn[bus]];for(const bus of layout.vmBuses)state.vm[bus]+=alpha*dx[layout.vmColumn[bus]];groups.forEach((g,k)=>{g.q=oldQ[k]+alpha*dx[n+k];});
   if(state.vm.every(v=>Number.isFinite(v)&&v>=settings.minVoltagePu!&&v<=settings.maxVoltagePu!)&&state.va.every(Number.isFinite)){const candidate=residual();if(candidate.norm<oldNorm*(1-1e-5*alpha)||candidate.max<=settings.tolerancePu!){current=candidate;accepted=true;if(alpha<1)lineSearchReductions++;break;}}
  }
  if(!accepted){state.vm.set(oldVm);state.va.set(oldVa);groups.forEach((g,k)=>g.q=oldQ[k]);current=residual();return{status:'NON_CONVERGED' as const,power:current.power,iteration:iteration+1,linearDiagnostics,lineSearchReductions};}
 }
 return{status:current.max<=settings.tolerancePu!?'CONVERGED' as const:'NON_CONVERGED' as const,power:current.power,iteration,linearDiagnostics,lineSearchReductions};
}
