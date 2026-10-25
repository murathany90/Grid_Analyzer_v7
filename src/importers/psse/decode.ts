import {decodeRaw,decodeRawx} from './raw';
import {decodeSav} from './sav';
import {validatePsse} from './common';
import type {PsseModel} from './types';
/** Shared pure decoder; no backend, fetch, native library, or platform API. */
export async function decodePsse(buffer:ArrayBuffer,name:string):Promise<PsseModel>{
 const start=performance.now();if(buffer.byteLength>512*1024*1024)throw Error('MODEL_SIZE_LIMIT_512_MIB');if(!buffer.byteLength)throw Error('EMPTY_MODEL');
 const bytes=new Uint8Array(buffer),extension=name.split('.').pop()?.toLowerCase();
 const model=extension==='sav'?decodeSav(bytes,name):extension==='raw'?decodeRaw(bytes,name):extension==='rawx'?decodeRawx(bytes,name):null;
 if(!model)throw Error('UNSUPPORTED_MODEL_FORMAT');validatePsse(model);model.timing.decodeMs=performance.now()-start;return model;
}
