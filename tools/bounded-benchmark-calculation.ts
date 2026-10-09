import {Worker} from 'node:worker_threads';
/** Local CLI hard budget. Termination interrupts synchronous WASM/NR/DC work. */
export function boundedBenchmarkCalculation<T>(payload:unknown,budgetMs:number):Promise<T>{
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./benchmark-calculation.worker.mjs',import.meta.url),{workerData:payload}),timer=setTimeout(()=>{void worker.terminate();reject(Error('WORKER_TIME_BUDGET'));},Math.max(1,budgetMs));
    worker.once('message',({value,error})=>{clearTimeout(timer);void worker.terminate();if(error)reject(Error(error));else resolve(value as T);});
    worker.once('error',error=>{clearTimeout(timer);void worker.terminate();reject(error);});
    worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(Error(`WORKER_EXIT_${code}`));});
  });
}
