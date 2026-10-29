import source from './workbook.worker.js?worker-source';
import {makeWorkbook} from './workbook.js';
export function workbookJob(sheets,win=window){
  let worker,url,timer,cancel=()=>{};
  const promise=new Promise((resolve,reject)=>{
    const finish=()=>{worker?.terminate();if(timer)win.clearTimeout(timer);if(url)URL.revokeObjectURL(url);};
    cancel=()=>{finish();reject(Error('Excel işlemi iptal edildi.'));};
    if(!win.Worker){timer=win.setTimeout(()=>{try{resolve(makeWorkbook(sheets));}catch(e){reject(e);}},0);return;}
    try{url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new win.Worker(url);worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(new Blob([data.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));};worker.onerror=event=>{finish();reject(Error(event.message||'Excel worker hatası'));};worker.postMessage({sheets});}catch(error){finish();reject(error);}
  });return {promise,cancel};
}
