/** Evaluate the source equations at the published PF state without running Newton. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectModelFile} from '../src/importers/model-file';
import {DgsModel} from '../src/importers/dgs/index';
import {mapCanonical} from '../src/importers/dgs/canonical';
import {prepareModel} from '../src/analysis/power-flow/preparation';
import {buildY} from '../src/analysis/power-flow/js/ybus';
import {calcPQ} from '../src/analysis/power-flow/js/jacobian';
import {parsePowerFactoryNumericCsv} from '../src/analysis/validation/pf-kpi-csv';
import {applyPowerFactoryControlContext,importPowerFactoryControlContext} from '../src/analysis/validation/powerfactory-control-context';

const positional=process.argv.slice(2).filter(arg=>!arg.startsWith('--'));
const modelPath=positional[0]??'kontrol1/20261001_1500_SN4_TR0.zip';
const contextPath=positional[1]??'kontrol1/PowerFactory_ControlContext_20261001_1500_SN4_TR0_20261003_224310.csv';
const pfPath=positional[2]??'kontrol1/PowerFactory_LoadFlow_20261001_1500_SN4_TR0_20261003_224310.csv';
const file=new File([new Uint8Array(await readFile(modelPath))],modelPath.split(/[\\/]/).at(-1)!);
const archive=await inspectModelFile(file),entry=archive.entries[0],extracted=await archive.extract(entry),bytes=new Uint8Array(await extracted.arrayBuffer());
const source=new DgsModel(JSON.parse(new TextDecoder().decode(bytes).replace(/^\uFEFF/,'')),entry.name,extracted.size);await source.build();
const network=applyPowerFactoryControlContext(mapCanonical(source,createHash('sha256').update(bytes).digest('hex')),importPowerFactoryControlContext(await readFile(contextPath,'utf8')));
const prepared=prepareModel(network),islands=[prepared,...(prepared.additionalIslands??[])];
const {rows}=parsePowerFactoryNumericCsv(await readFile(pfPath,'utf8'));
const byKind=(kind:string)=>new Map(rows.filter(row=>row.kind===kind).map(row=>[row.fid,row]));
const pfBus=byKind('bus'),pfLine=byKind('line'),pfTransformer=byKind('transformer'),pfGenerator=byKind('generator'),pfExternal=byKind('externalGrid');
type Acc={sum:number;den:number;n:number};const acc=():Acc=>({sum:0,den:0,n:0});
const metrics={lineP:acc(),lineQ:acc(),transformerP:acc(),transformerQ:acc(),busQ:{sum:0,n:0}};
const add=(a:Acc,actual:number,reference:number)=>{if(!Number.isFinite(actual)||!Number.isFinite(reference))return;a.sum+=Math.abs(Math.abs(actual)-Math.abs(reference));a.den+=Math.abs(reference);a.n++;};
let mapped=0,missing=0;
for(const part of islands){
 const model=part.model,Vm=new Float64Array(model.n),Va=new Float64Array(model.n),Y=buildY(model),P=new Float64Array(model.n),Q=new Float64Array(model.n);
 for(let i=0;i<model.n;i++){
  const bus=part.buses[i],row=bus.terms.map(id=>pfBus.get(id)).find(row=>row?.voltageKv!=null&&row.angleDeg!=null);
  if(!row||!(bus.vnKv>0)){missing++;Vm[i]=1;continue;}
  Vm[i]=row.voltageKv!/bus.vnKv;Va[i]=row.angleDeg!*Math.PI/180;mapped++;
 }
 if(missing)throw Error(`Missing PF bus states: ${missing}`);
 calcPQ(Y,Vm,Va,P,Q);
 const qExpected=Float64Array.from(model.qSpec);
 for(const gen of part.generators){const pf=pfGenerator.get(gen.id);if(pf?.qResultMvar!=null)qExpected[gen.index]+=pf.qResultMvar-gen.qMvar;}
 for(const source of part.externalGrids??[]){const pf=pfExternal.get(source.id);if(pf?.qResultMvar!=null)qExpected[source.index]+=pf.qResultMvar-source.qMvar;}
 for(let i=0;i<model.n;i++){metrics.busQ.sum+=Math.abs(qExpected[i]-Q[i]*model.baseMVA);metrics.busQ.n++;}
 for(let index=0;index<model.branches.length;index++){
  const e=model.branches[index],meta=part.branches[index],reference=meta.sourceClass==='ElmTr2'?pfTransformer.get(meta.id):pfLine.get(meta.id);
  if(!reference||reference.resultAvailable!=='1'||meta.vnKv<66)continue;
  const {i,j,r,x}=e,bc=e.bch??0,t=e.tap,ph=e.phase,den=r*r+x*x,g=r/den,b=-x/den,c=Math.cos(Va[i]-Va[j]-ph),s=Math.sin(Va[i]-Va[j]-ph),vi=Vm[i],vj=Vm[j],base=model.baseMVA;
  const pf=(vi*vi*g/(t*t)-vi*vj/t*(g*c+b*s)+vi*vi*(e.gMagPu||0))*base;
  const qf=(-vi*vi*(b+bc/2)/(t*t)-vi*vj/t*(g*s-b*c)-vi*vi*(e.bMagPu||0))*base;
  const pt=(vj*vj*g-vi*vj/t*(g*c-b*s))*base;
  const qt=(-vj*vj*(b+bc/2)+vi*vj/t*(g*s+b*c))*base;
  if(meta.sourceClass==='ElmTr2'){
   if(reference.pHvMw!=null&&reference.pLvMw!=null){add(metrics.transformerP,pf,reference.pHvMw);add(metrics.transformerP,pt,reference.pLvMw);}
   if(reference.qHvMvar!=null&&reference.qLvMvar!=null){add(metrics.transformerQ,qf,reference.qHvMvar);add(metrics.transformerQ,qt,reference.qLvMvar);}
  }else{
   if(reference.pFromMw!=null&&reference.pToMw!=null){add(metrics.lineP,pf,reference.pFromMw);add(metrics.lineP,pt,reference.pToMw);}
   if(reference.qFromMvar!=null&&reference.qToMvar!=null){add(metrics.lineQ,qf,reference.qFromMvar);add(metrics.lineQ,qt,reference.qToMvar);}
  }
 }
}
const scored=(a:Acc)=>({percent:100*a.sum/a.den,observations:a.n});
console.log(JSON.stringify({mappedBuses:mapped,lineP:scored(metrics.lineP),lineQ:scored(metrics.lineQ),transformerP:scored(metrics.transformerP),transformerQ:scored(metrics.transformerQ),busQMaeMvar:metrics.busQ.sum/metrics.busQ.n},null,2));
