import {solvePsseNewton} from '../analysis/psse/newton';
import {solvePsseFdns} from '../analysis/psse/fdns';
import {solvePsseDc} from '../analysis/psse/dc';
import type {PsseCalculationRequest,PsseCalculationResponse} from './psse-calculation-protocol';
const scope=self as unknown as {onmessage:((event:MessageEvent<PsseCalculationRequest>)=>void)|null;postMessage:(value:PsseCalculationResponse)=>void};
scope.onmessage=({data})=>{try{const progress=(event:{phase:string;iteration:number;residualPu:number|null})=>scope.postMessage({id:data.id,type:'PROGRESS',...event}),input={model:data.model,network:data.network,scenario:data.scenario,options:data.options as never};const result=data.method==='NR_POLAR'?solvePsseNewton({...input,progress}):data.method==='FDNS_XB'?solvePsseFdns({...input,progress}):solvePsseDc(input);scope.postMessage({id:data.id,type:'RESULT',result});}catch(error){scope.postMessage({id:data.id,type:'ERROR',error:error instanceof Error?error.message:String(error)});}};
