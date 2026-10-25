import WorkerFactory from './psse-import.worker?worker&inline';
import type {PsseModel} from '../importers/psse/types';
import type {PsseImportResponse} from './psse-protocol';
/** A separate worker never prepares the DGS calculation engine. */
export class PsseTransport {
 private worker:Worker|null=null;private next=0;private pending=new Map<number,{resolve:(model:PsseModel)=>void;reject:(error:Error)=>void}>();
 request(file:File):Promise<PsseModel>{const id=++this.next;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});try{if(!this.worker){this.worker=new WorkerFactory();this.worker.onmessage=({data}:MessageEvent<PsseImportResponse>)=>{const entry=this.pending.get(data.id);if(!entry)return;this.pending.delete(data.id);if(data.type==='ERROR')entry.reject(Error(data.error));else entry.resolve(data.model);};this.worker.onerror=event=>this.cancel(event.message||'PSS/E worker başlatılamadı.');}this.worker.postMessage({id,file});}catch(error){this.pending.delete(id);reject(error);}});}
 cancel(message='CANCELLED'){this.worker?.terminate();this.worker=null;for(const request of this.pending.values())request.reject(Error(message));this.pending.clear();}
}
