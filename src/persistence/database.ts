export class BrowserDatabase {
  private db:Promise<IDBDatabase>|null=null;
  private open():Promise<IDBDatabase>{
    return this.db??=new Promise((resolve,reject)=>{const request=indexedDB.open('grid-analyzer-v7',1);request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  }
  async get<T>(key:string):Promise<T|undefined>{const db=await this.open();return new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get(key);r.onsuccess=()=>resolve(r.result as T|undefined);r.onerror=()=>reject(r.error);});}
  async put(key:string,value:unknown):Promise<void>{const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
  async resetScenario(modelHash:string,book:unknown,baseKey:string,baseResults:readonly (readonly [string,unknown])[]=[]):Promise<void>{
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('data','readwrite'),store=tx.objectStore('data'),preserved=new Set<string>();
      store.put(book,'scenario-book:'+modelHash);store.delete('scenario:'+modelHash);
      // Empty overlays used to share cache keys. Preserve only verified base results, never an old scenario at that key.
      for(const [type,result] of baseResults){const key='lf:'+baseKey+':'+type;preserved.add(key);store.put(result,key);}
      const request=store.openKeyCursor();
      request.onsuccess=()=>{
        const cursor=request.result;if(!cursor)return;const key=String(cursor.key);
        const workspace=(key.startsWith('workspace:')||key.startsWith('lf:'))&&key.includes('"model":'+JSON.stringify(modelHash));
        const detail=key.startsWith('hybrid-detail:')&&key.includes('"modelHash":'+JSON.stringify(modelHash));
        if((workspace||detail)&&!preserved.has(key))store.delete(cursor.key);cursor.continue();
      };
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }
}
