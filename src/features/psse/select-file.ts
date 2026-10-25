import {inspectModelFile,type ModelEntry} from '../../importers/model-file';
import {element,button} from '../../ui/components/dom';
/** The selected ZIP member is decoded from its bytes, never from a JSON cache. */
export async function selectPsseFile(file:File,host:HTMLElement,signal?:AbortSignal):Promise<File|null>{
 const archive=await inspectModelFile(file,{extensions:['sav','raw','rawx']});
 if(signal?.aborted)return null;
 if(archive.entries.length===1)return archive.extract(archive.entries[0]);
 const entry=await new Promise<ModelEntry|null>(resolve=>{const dialog=element('dialog','ga-record-dialog ga-psse-zip-select'),select=element('select');let settled=false;dialog.setAttribute('aria-label','ZIP içinden PSS/E modeli seç');select.setAttribute('aria-label','ZIP PSS/E modeli');archive.entries.forEach((entry,i)=>select.append(new Option(`${entry.name} · ${(entry.size/1024**2).toFixed(2)} MiB`,String(i))));const abort=()=>finish(null),finish=(entry:ModelEntry|null)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);dialog.close();dialog.remove();resolve(entry);};dialog.append(element('h3','','ZIP içinden PSS/E modeli seç'),select,button('Seçilen modeli aç',()=>finish(archive.entries[Number(select.value)])),button('Vazgeç',()=>finish(null)));dialog.oncancel=event=>{event.preventDefault();finish(null);};signal?.addEventListener('abort',abort,{once:true});host.append(dialog);dialog.showModal();});
 return entry?archive.extract(entry):null;
}
