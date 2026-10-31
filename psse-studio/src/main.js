import {mount} from './modules/psse/index.js';
import {nativeIndex,savedFlows} from './modules/psse/ui/native-tables.js';
import '../../tools/psse-sld/studio_runtime.js';
export {mount};
// Only the standalone host publishes a handle; embedded mounts own their instance.
const sourceResults=new WeakMap();
window.GridAnalyzerPSSE={mount,getSavedResults(){
  const c=window.psseStudio?.controller,n=c?.psseNetwork,m=c?.psseInspection;if(!n||!m)return null;
  let result=sourceResults.get(n);if(!result){result={branchMap:savedFlows(nativeIndex(m,n)),busMap:new Map(n.buses.map(b=>[String(b.connectionKey),{vmPu:b.initialVm,vaDeg:b.initialVaDeg}]))};sourceResults.set(n,result);}return result;
}};
window.psseStudio=mount(document.getElementById('psse-host'));
