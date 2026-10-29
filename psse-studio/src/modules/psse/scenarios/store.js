export function deepFreeze(value, seen=new WeakSet()) {
  if(!value||typeof value!=='object'||seen.has(value)||ArrayBuffer.isView(value))return value;
  seen.add(value);for(const item of Object.values(value))deepFreeze(item,seen);return Object.freeze(value);
}
export class ScenarioStore {
  constructor(network,makeScenario,sourceSha) {
    this.network=network;this.make=makeScenario;this.sourceSha=sourceSha;
    this.items=new Map([['base',{id:'base',name:'Baz',operations:[],history:[[]],cursor:0}]]);this.selected='base';this.serial=0;
  }
  get current(){return this.make(this.network,this.items.get(this.selected).operations);}
  get item(){return this.items.get(this.selected);}
  create(name='Senaryo',operations=this.item.operations){
    this.make(this.network,operations);const id='s'+ ++this.serial,ops=structuredClone(operations);
    this.items.set(id,{id,name,operations:ops,history:[structuredClone(ops)],cursor:0});this.selected=id;return id;
  }
  select(id){if(!this.items.has(id))throw Error('SCENARIO_UNKNOWN');this.selected=id;return this.current;}
  replace(operations){
    const next=this.make(this.network,operations);
    if(next.hash===this.current.hash)return false;
    if(this.selected==='base')this.create('Senaryo '+(this.serial+1),[]);
    const item=this.item;item.operations=structuredClone(next.operations);
    item.history.splice(item.cursor+1);item.history.push(structuredClone(item.operations));item.cursor++;
    return true;
  }
  apply(operation){this.replace([...this.item.operations.filter(o=>!(o.equipmentId===operation.equipmentId&&o.action===operation.action)),operation]);}
  undo(){if(this.selected==='base'||this.item.cursor===0)return false;this.item.operations=structuredClone(this.item.history[--this.item.cursor]);return true;}
  redo(){if(this.item.cursor>=this.item.history.length-1)return false;this.item.operations=structuredClone(this.item.history[++this.item.cursor]);return true;}
  reset(){return this.replace([]);}
  serialize(){return JSON.stringify({schema:'ga.psse.scenario-book.v1',sourceSha256:this.sourceSha,networkHash:this.network.modelHash,selected:this.selected,items:[...this.items.values()].filter(x=>x.id!=='base').map(({id,name,operations,history,cursor})=>({id,name,operations,history,cursor}))},null,2);}
  restore(text){
    const book=JSON.parse(text);if(book.schema!=='ga.psse.scenario-book.v1'||book.sourceSha256!==this.sourceSha||book.networkHash!==this.network.modelHash||!Array.isArray(book.items))throw Error('SCENARIO_MODEL_MISMATCH');
    // Validate the entire book, including undo/redo snapshots, before committing.
    const next=new Map([['base',{id:'base',name:'Baz',operations:[],history:[[]],cursor:0}]]);let serial=0;
    for(const item of book.items){
      if(typeof item.name!=='string'||!/^s\d+$/.test(item.id)||next.has(item.id))throw Error('SCENARIO_NAME_OR_ID_INVALID');
      this.make(this.network,item.operations);const history=item.history??[item.operations],cursor=item.cursor??0;
      if(!Array.isArray(history)||!Number.isInteger(cursor)||cursor<0||cursor>=history.length)throw Error('SCENARIO_HISTORY_INVALID');
      for(const operations of history)this.make(this.network,operations);
      if(this.make(this.network,history[cursor]).hash!==this.make(this.network,item.operations).hash)throw Error('SCENARIO_HISTORY_MISMATCH');
      next.set(item.id,structuredClone({...item,history,cursor}));serial=Math.max(serial,Number(item.id.slice(1)));
    }
    if(!next.has(book.selected))throw Error('SCENARIO_SELECTION_INVALID');
    this.items=next;this.selected=book.selected;this.serial=serial;
    return this.current;
  }
}
