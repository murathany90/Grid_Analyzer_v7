import type {PsseBusBranchNetwork,PsseComplex} from '../../domain/psse/network';
export interface PsseAdmittance {rows:Map<number,PsseComplex>[];nnz:number}
const z=():PsseComplex=>({re:0,im:0});
function put(rows:Map<number,PsseComplex>[],i:number,j:number,y:PsseComplex){const old=rows[i].get(j)??z();rows[i].set(j,{re:old.re+y.re,im:old.im+y.im});}
export function buildPsseYbus(network:PsseBusBranchNetwork):PsseAdmittance{
 const rows=network.buses.map(()=>new Map<number,PsseComplex>());
 for(const branch of network.branches){if(branch.status!==1)continue;put(rows,branch.from,branch.from,branch.yff);put(rows,branch.from,branch.to,branch.yft);put(rows,branch.to,branch.from,branch.ytf);put(rows,branch.to,branch.to,branch.ytt);}
 for(const shunt of network.shunts){if(shunt.status!==1)continue;const old=rows[shunt.bus].get(shunt.bus)??z();rows[shunt.bus].set(shunt.bus,{re:old.re+shunt.gMw/network.baseMva,im:old.im+shunt.bMvar/network.baseMva});}
 return {rows,nnz:rows.reduce((sum,row)=>sum+row.size,0)};
}
