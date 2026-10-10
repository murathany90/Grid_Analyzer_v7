import {acNetwork} from './ac-network';
import type {CalculationResult,BusResult} from '../../src/domain/results/types';
import type {AppContext} from '../../src/app/contracts';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
export function mapScaleFixture(physical=48898,solved=4088,siteCount=1619){
  const base=acNetwork(),sites=Array.from({length:siteCount},(_,i)=>({...base.buses[0],id:'SITE'+i,sourceId:'SITE'+i,sourceClass:'ElmSite',name:'Synthetic station '+i,siteIds:['SITE'+i],lat:39+i%20*.01,lon:32+i%30*.01,areaId:'AREA',areaName:'Synthetic area',voltages:[400,154,33]})),buses=Array.from({length:physical},(_,i)=>({...base.buses[0],id:'TERM'+i,sourceId:'TERM'+i,name:'Synthetic terminal '+i,vnKv:i%3===0?400:i%3===1?154:33,siteIds:['SITE'+i%siteCount]})),network={...base,modelHash:'synthetic-scale-'+physical+'-'+solved,sites,buses};
  const rows:BusResult[]=Array.from({length:solved},(_,i)=>({id:'BUS'+i,name:'Synthetic solved '+i,terms:['TERM'+i],siteIds:buses[i].siteIds,vnKv:buses[i].vnKv,vmPu:i%11===0?0:.94+i%7*.01,angleRad:i%13*.01,pMw:0,qMvar:0,islandId:'island-1'}));
  const result={identity:{modelHash:network.modelHash,scenarioHash:'B0',analysisType:'powerFlow',engine:'synthetic',engineVersion:'test',optionsHash:'{}'},buses:rows,branches:[],generators:[],diagnostics:{islands:[{islandId:'island-1',referenceSource:'test',status:'CONVERGED'}]},converged:true} as unknown as CalculationResult;
  const ctx={network,filters:{voltages:allVoltageBands()}} as unknown as AppContext;return {ctx,network,result};
}
