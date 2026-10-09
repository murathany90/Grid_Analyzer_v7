import {parentPort,workerData} from 'node:worker_threads';
import {tsImport} from 'tsx/esm/api';
try {
  let value;
  const {kind,network,scenario,options,outage}=workerData;
  if(kind==='BASE'){
    const {BrowserJsPowerFlowEngine}=await tsImport('../src/analysis/api/browser-js-engine.ts',import.meta.url);
    const {identity}=await tsImport('../src/domain/calculation/identity.ts',import.meta.url);
    value=await new BrowserJsPowerFlowEngine().runPowerFlow({network,scenario,identity:identity(network.modelHash,scenario,'powerFlow'),analysisSettings:options?.analysisSettings});
  } else if(kind==='DC'){
    const {runN1Screen}=await tsImport('../src/domain/n1/index.ts',import.meta.url);
    value=await runN1Screen(network,scenario,options);
  } else if(kind==='AC'){
    const {validateAcOutages}=await tsImport('../src/analysis/contingency-ac/index.ts',import.meta.url);
    value=(await validateAcOutages(network,scenario,[outage],{...options,maxCases:1}))[0];
  } else throw Error('UNKNOWN_CALCULATION_KIND');
  parentPort.postMessage({value});
}catch(error){parentPort.postMessage({error:error instanceof Error?error.message:String(error)});}
