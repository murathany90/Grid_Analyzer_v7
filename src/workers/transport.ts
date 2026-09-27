import WorkerFactory from './computation.worker?worker&inline';
import type { WorkerRequest, WorkerResponse } from './protocol';
type RequestPayload=WorkerRequest extends infer T ? T extends WorkerRequest?Omit<T,'id'>:never:never;
export class WorkerTransport {
  private worker:Worker|null=null;private next=0;
  private pending=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void}>();
  constructor(private progress:(stage:string,detail?:Record<string,unknown>)=>void=()=>{}){}
  private connect():Worker{
    if(this.worker)return this.worker;
    this.worker=new WorkerFactory();this.worker.onmessage=({data}:MessageEvent<WorkerResponse>)=>{
      if(!this.pending.has(data.id))return;
      if(data.type==='PROGRESS'){this.progress(data.stage||'MODEL',data.detail);return;}
      const entry=this.pending.get(data.id);if(!entry)return;this.pending.delete(data.id);if(data.type==='ERROR')entry.reject(new Error(data.error||'Worker hatası'));else entry.resolve(data.value);
    };
    this.worker.onerror=e=>this.cancel(e.message||'Worker başlatılamadı.');return this.worker;
  }
  request<T>(payload:RequestPayload,transfer:Transferable[]=[]):Promise<T>{const id=++this.next;return new Promise<T>((resolve,reject)=>{this.pending.set(id,{resolve:v=>resolve(v as T),reject});try{this.connect().postMessage({...payload,id},transfer);}catch(error){this.pending.delete(id);reject(error);}});}
  cancel(message='CANCELLED'):void{this.worker?.terminate();this.worker=null;for(const p of this.pending.values())p.reject(new Error(message));this.pending.clear();}
}
