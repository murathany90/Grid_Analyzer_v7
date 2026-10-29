import parserSource from '../importers/parser.worker.js?worker-source';
import solverSource from '../calculations/solver.worker.js?worker-source';
export function define(ctx) {
  class WorkerClient {
    constructor(source,parser=false){this.source=source;this.parser=parser;this.worker=null;this.pending=new Map();this.next=0;this.url=null;}
    connect(){
      if(this.worker)return;
      this.url=URL.createObjectURL(new Blob([this.source],{type:'text/javascript'}));
      this.worker=new Worker(this.url,{name:this.parser?'PSSE parser':'PSSE solver'});
      this.worker.onmessage=({data})=>{
        if(this.url){URL.revokeObjectURL(this.url);this.url=null;}
        const pending=this.pending.get(data.id);if(!pending)return;
        if(data.type==='PROGRESS'){pending.progress?.(data);return;}
        this.pending.delete(data.id);
        if(data.type==='ERROR')pending.reject(Object.assign(new Error(data.error),{phase:data.phase,method:data.method,workerStack:data.stack}));
        else pending.resolve(this.parser?data.model:data.result);
      };
      this.worker.onerror=e=>this.cancel(e.message||'WORKER_RUNTIME');
      this.worker.onmessageerror=()=>this.cancel('WORKER_DESERIALIZATION');
    }
    request(input){
      return new Promise((resolve,reject)=>{
        const id=++this.next;this.pending.set(id,{resolve,reject,progress:input.progress});
        try{this.connect();this.worker.postMessage(this.parser?{id,file:input}:{id,type:'RUN',model:input.model,network:input.network,scenario:input.scenario,method:input.method,options:input.options??{}});}catch(e){this.pending.delete(id);reject(e);}
      });
    }
    cancel(message='CANCELLED'){this.worker?.terminate();this.worker=null;if(this.url)URL.revokeObjectURL(this.url);this.url=null;for(const p of this.pending.values())p.reject(Error(message));this.pending.clear();}
    dispose(){this.cancel('DISPOSED');}
  }
  ctx.fo=class extends WorkerClient{constructor(){super(parserSource,true);}};
  ctx._o=class extends WorkerClient{constructor(){super(solverSource);}};
  ctx.vo=value=>{if(value==null||value==='')return null;const n=typeof value==='number'?value:Number(value);return Number.isFinite(n)?n:null;};
  ctx.yo=value=>Array.from(ctx.z(new TextEncoder().encode(JSON.stringify(value))),b=>b.toString(16).padStart(2,'0')).join('');
}
export const initializers=[];
