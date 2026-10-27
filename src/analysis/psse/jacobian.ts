import type {PsseBusBranchNetwork} from '../../domain/psse/network';
import {loadAtVoltage,type PssePower,type PsseState} from './mismatch';
import type {PsseAdmittance} from './ybus';
import {csrFromRows} from './sparse';
export interface PsseJacobianLayout {matrix:ReturnType<typeof csrFromRows>;pRow:Int32Array;qRow:Int32Array;angleColumn:Int32Array;vmColumn:Int32Array;angleBuses:number[];vmBuses:number[]}
export function buildPsseJacobian(network:PsseBusBranchNetwork,ybus:PsseAdmittance,state:PsseState,power:PssePower,refs:Set<number>):PsseJacobianLayout{
 const n=network.buses.length,pRow=new Int32Array(n).fill(-1),qRow=new Int32Array(n).fill(-1),angleColumn=new Int32Array(n).fill(-1),vmColumn=new Int32Array(n).fill(-1),angleBuses:number[]=[],vmBuses:number[]=[],rows:Map<number,number>[]=[];
 for(let i=0;i<n;i++)if(state.busType[i]!==4&&network.buses[i].status===1&&!refs.has(i)){angleColumn[i]=angleBuses.length;angleBuses.push(i);}
 for(let i=0;i<n;i++)if(state.busType[i]===1&&network.buses[i].status===1){vmColumn[i]=angleBuses.length+vmBuses.length;vmBuses.push(i);}
 const dimension=angleBuses.length+vmBuses.length;for(const i of angleBuses){pRow[i]=rows.length;rows.push(new Map());}for(const i of vmBuses){qRow[i]=rows.length;rows.push(new Map());}
 if(rows.length!==dimension)throw Error('PSSE_JACOBIAN_DIMENSION_MISMATCH');
 const add=(row:number,col:number,value:number)=>{if(row<0||col<0)return;rows[row].set(col,(rows[row].get(col)??0)+value);};
 const loadDerivatives=network.loads.filter(x=>x.status===1).reduce((map,load)=>{const old=map.get(load.bus)??{dp:0,dq:0};const d=loadAtVoltage(load,state.vm[load.bus],network.baseMva);old.dp+=d.dp;old.dq+=d.dq;map.set(load.bus,old);return map;},new Map<number,{dp:number;dq:number}>());
 for(let i=0;i<n;i++){
  const rowp=pRow[i],rowq=qRow[i];if(rowp<0&&rowq<0)continue;const vi=state.vm[i],pi=power.p[i],qi=power.q[i],yii=ybus.rows[i].get(i)??{re:0,im:0},diagAngleP=-qi-yii.im*vi*vi,diagAngleQ=pi-yii.re*vi*vi,diagVmP=pi/vi+yii.re*vi+(loadDerivatives.get(i)?.dp??0),diagVmQ=qi/vi-yii.im*vi+(loadDerivatives.get(i)?.dq??0);
  for(const [j,yij]of ybus.rows[i]){if(i===j)continue;const vj=state.vm[j],d=state.va[i]-state.va[j],c=Math.cos(d),s=Math.sin(d),g=yij.re,b=yij.im;
   add(rowp,angleColumn[j],vi*vj*(g*s-b*c));add(rowp,vmColumn[j],vi*(g*c+b*s));
   add(rowq,angleColumn[j],-vi*vj*(g*c+b*s));add(rowq,vmColumn[j],vi*(g*s-b*c));
  }
  add(rowp,angleColumn[i],diagAngleP);add(rowq,angleColumn[i],diagAngleQ);add(rowp,vmColumn[i],diagVmP);add(rowq,vmColumn[i],diagVmQ);
 }
 return {matrix:csrFromRows(rows),pRow,qRow,angleColumn,vmColumn,angleBuses,vmBuses};
}
