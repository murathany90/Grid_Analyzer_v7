import {decodePsse} from '../importers/psse/decode';
import type {PsseImportRequest,PsseImportResponse} from './psse-protocol';
const scope=self as unknown as {onmessage:((event:MessageEvent<PsseImportRequest>)=>void)|null;postMessage:(value:PsseImportResponse)=>void};
scope.onmessage=async({data})=>{try{const model=await decodePsse(await data.file.arrayBuffer(),data.file.name);scope.postMessage({id:data.id,type:'RESULT',model});}catch(error){scope.postMessage({id:data.id,type:'ERROR',error:error instanceof Error?error.message:String(error)});}};
