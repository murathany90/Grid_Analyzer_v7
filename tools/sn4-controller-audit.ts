/** Reproducible generator-Q and station-state audit for a captured SN4 solve. */
import {readFile} from 'node:fs/promises';
import {inspectModelFile} from '../src/importers/model-file';
import {DgsModel} from '../src/importers/dgs/index';
import {mapCanonical} from '../src/importers/dgs/canonical';
import {parsePowerFactoryNumericCsv} from '../src/analysis/validation/pf-kpi-csv';

const positional=process.argv.slice(2).filter(arg=>!arg.startsWith('--'));
const capture=JSON.parse(await readFile(positional[0]??'.tmp/integrated-v3.json','utf8'));
const pfPath=positional[1]??'kontrol1/PowerFactory_LoadFlow_20261001_1500_SN4_TR0_20261003_224310.csv';
const modelPath=positional[2]??'kontrol1/20261001_1500_SN4_TR0.zip';
const file=new File([new Uint8Array(await readFile(modelPath))],modelPath.split(/[\\/]/).at(-1)!);
const archive=await inspectModelFile(file),entry=archive.entries[0],extracted=await archive.extract(entry);
const source=new DgsModel(JSON.parse(new TextDecoder().decode(await extracted.arrayBuffer()).replace(/^\uFEFF/,'')),entry.name,extracted.size);await source.build();
const network=mapCanonical(source,'audit');
const {rows}=parsePowerFactoryNumericCsv(await readFile(pfPath,'utf8'));
const pfQ=new Map(rows.filter(row=>row.kind==='generator'&&row.qResultMvar!=null).map(row=>[row.fid,row.qResultMvar!]));
const group=new Map<string,'zeroDroop'|'droop'>();
for(const controller of network.stationControllers.filter(row=>row.inService))for(const id of controller.unitIds)group.set(id,controller.droopModeRaw===1?'droop':'zeroDroop');
const errors={zeroDroop:[] as number[],droop:[] as number[],nonStation:[] as number[]};
const detailed:Array<{id:string;group:string;error:number;local:number;reference:number;controller:string;status:string}>=[];
const controllerByUnit=new Map(network.stationControllers.flatMap(controller=>controller.unitIds.map(id=>[id,controller.id] as const)));
const diagnosticByController=new Map((capture.result.diagnostics.stationControllerResults as Array<{id:string;status:string}>).map(row=>[row.id,row]));
for(const generator of capture.result.generators){const reference=pfQ.get(generator.id);if(reference==null||generator.qMvar==null)continue;const category=group.get(generator.id)??'nonStation',error=Math.abs(generator.qMvar-reference),controller=controllerByUnit.get(generator.id)??'';errors[category].push(error);detailed.push({id:generator.id,group:category,error,local:generator.qMvar,reference,controller,status:diagnosticByController.get(controller)?.status??''});}
const mae=(values:number[])=>({n:values.length,maeMvar:values.reduce((sum,value)=>sum+value,0)/values.length,maxMvar:Math.max(...values)});
const controllers=capture.result.diagnostics.stationControllerResults as Array<{status:string;supported:boolean;voltageResidualPu:number|null}>;
const active=controllers.filter(row=>row.supported&&row.status==='SATISFIED'),saturated=controllers.filter(row=>row.status==='SATURATED_QMIN'||row.status==='SATURATED_QMAX'),fixed=controllers.filter(row=>row.status==='NO_REACTIVE_HEADROOM');
const movableResidual=controllers.filter(row=>row.supported&&!['SATISFIED','SATURATED_QMIN','SATURATED_QMAX','NO_REACTIVE_HEADROOM'].includes(row.status)&&Math.abs(row.voltageResidualPu??0)>.002).length;
console.log(JSON.stringify({zeroDroop:mae(errors.zeroDroop),droop:mae(errors.droop),nonStation:mae(errors.nonStation),controllers:{active:active.length,qMin:saturated.filter(row=>row.status==='SATURATED_QMIN').length,qMax:saturated.filter(row=>row.status==='SATURATED_QMAX').length,fixed:fixed.length,movableResidual,saturatedResidual:saturated.filter(row=>Math.abs(row.voltageResidualPu??0)>.002).length},sl1:capture.result.diagnostics.externalGridResults.find((row:{id:string})=>row.id==='SL1'),runtimeMs:capture.result.elapsedMs,newton:capture.result.diagnostics.totalNewtonIterations,klu:capture.result.diagnostics.kluNewtonFactorizations,restarts:capture.result.diagnostics.stationControllerSummary.controlLimitRestarts,...(process.argv.includes('--top-errors')?{topErrors:detailed.sort((a,b)=>b.error-a.error).slice(0,30)}:{})},null,2));
