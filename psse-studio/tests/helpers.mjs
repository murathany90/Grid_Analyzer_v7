import fs from 'node:fs/promises';
import vm from 'node:vm';
import {build} from 'esbuild';
import {workerPlugin} from '../scripts/worker-plugin.mjs';
import {pathToFileURL} from 'node:url';
await fs.mkdir('evidence',{recursive:true});
// Each node:test process owns its bundle; parallel suites must not import a half-written file.
const output=process.cwd()+`/evidence/test-engine-${process.pid}.mjs`;
await build({entryPoints:['src/modules/psse/engine-runtime.js'],outfile:output,bundle:true,format:'esm',platform:'node',plugins:[workerPlugin],loader:{'.txt':'text','.b64':'text'},logLevel:'silent'});
const {createRuntime}=await import(pathToFileURL(output));
export const engine=createRuntime({window:{localStorage:{getItem(){return null;},setItem(){}},matchMedia(){return {matches:false};}},document:{}});
export async function worker(name) {
  const result=await build({entryPoints:[`src/modules/psse/${name==='parser'?'importers/parser':'calculations/solver'}.worker.js`],write:false,bundle:true,format:'iife',loader:{'.txt':'text','.b64':'text'},logLevel:'silent'});
  let response;const self={postMessage(value){if(value.type!=='PROGRESS')response=value;}};
  vm.runInNewContext(result.outputFiles[0].text,{self,TextEncoder,TextDecoder,performance,crypto,atob,btoa,structuredClone,WebAssembly,console,Blob,File,Uint8Array,ArrayBuffer,DataView,setTimeout,clearTimeout});
  return async request=>{response=null;await self.onmessage({data:{id:1,...request}});if(response?.type==='ERROR')throw Error(response.error);return response?.model??response?.result;};
}
export const modelPath='control1/20261014_1200_SN3_TR0.sav';
export async function readModel(path=modelPath){const parse=await worker('parser');return parse({file:new File([await fs.readFile(path)],path.split(/[\\/]/).at(-1))});}
export async function saveEvidence(name,value){await fs.writeFile(`evidence/${name}.json`,JSON.stringify(value,null,2));}
