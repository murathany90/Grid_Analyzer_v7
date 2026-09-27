export class BrowserDatabase {
  private db:Promise<IDBDatabase>|null=null;
  private open():Promise<IDBDatabase>{
    return this.db??=new Promise((resolve,reject)=>{const request=indexedDB.open('grid-analyzer-v7',1);request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  }
  async get<T>(key:string):Promise<T|undefined>{const db=await this.open();return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get(key);r.onsuccess=()=>resolve(r.result as T|undefined);r.onerror=()=>reject(r.error);});}
  async put(key:string,value:unknown):Promise<void>{const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
}
