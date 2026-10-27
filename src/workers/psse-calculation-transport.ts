import WorkerFactory from './psse-calculation.worker?worker&inline';
import type {PsseModel} from '../importers/psse/types';
import type {PsseBusBranchNetwork} from '../domain/psse/network';
import type {PsseScenario} from '../domain/psse/scenario';
import type {PsseCalculationResult} from '../domain/psse/results';
import type {PsseCalculationResponse,PsseMethod} from './psse-calculation-protocol';
export class PsseCalculationTransport{
 private worker:Worker|null=null;private next=0;private pending=new Map<number,{resolve:(result:PsseCalculationResult)=>void;reject:(error:Error)=>void;progress?:(value:{phase:string;iteration:number;residualPu:number|null})=>void}>();
 request(input:{model:PsseModel;network:PsseBusBranchNetwork;scenario:PsseScenario;method:PsseMethod;options?:Record<string,unknown>;progress?:(value:{phase:string;iteration:number;residualPu:number|null})=>void}):Promise<PsseCalculationResult>{const id=++this.next;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,progress:input.progress});try{if(!this.worker){this.worker=new WorkerFactory();this.worker.onmessage=({data}:MessageEvent<PsseCalculationResponse>)=>{const item=this.pending.get(data.id);if(!item)return;if(data.type==='PROGRESS'){item.progress?.({phase:data.phase,iteration:data.iteration,residualPu:data.residualPu});return;}this.pending.delete(data.id);if(data.type==='ERROR')item.reject(Error(data.error));else item.resolve(data.result);};this.worker.onerror=event=>this.cancel(event.message||'PSS/E calculation worker failed.');}this.worker.postMessage({id,type:'RUN',model:input.model,network:input.network,scenario:input.scenario,method:input.method,options:input.options??{}}); }catch(error){this.pending.delete(id);reject(error instanceof Error?error:Error(String(error)));}});}
 cancel(message='CANCELLED'){this.worker?.terminate();this.worker=null;for(const request of this.pending.values())request.reject(Error(message));this.pending.clear();}
 dispose(){this.cancel('DISPOSED');}
}
