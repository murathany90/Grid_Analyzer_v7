import type { CanonicalNetwork } from '../../src/domain/model/network';
export function acNetwork(count=3):CanonicalNetwork{
  const entity=(id:string,sourceClass:string)=>({id,name:id,sourceId:id,sourceClass,inService:true,siteIds:[],sourceRefs:{}});
  const buses=Array.from({length:count},(_,i)=>({...entity(`B${i}`,'ElmTerm'),vnKv:100,parentId:`G${i}`}));
  const lines=Array.from({length:count-1},(_,i)=>({...entity(`L${i}`,'ElmLne'),from:`B${i}`,to:`B${i+1}`,vnKv:100,lengthKm:1,rOhm:0,xOhm:10,bSiemens:0,ratingMva:null,coordinates:[],sections:0}));
  lines.push({...lines[0],...entity('BYPASS','ElmLne'),from:'B0',to:`B${count-1}`});
  return {schemaVersion:1,modelHash:'synthetic-ac-network',name:'synthetic',size:0,baseMva:100,buses,lines,transformers:[],generators:[],loads:[{...entity('LOAD','ElmLod'),bus:`B${count-1}`,pMw:30,qMvar:10,activeBalanceEligibility:false}],externalGrids:[{...entity('SLACK','ElmXnet'),bus:'B0',pMw:0,qMvar:0,vmSet:1}],internationalConnections:[],shunts:[],seriesCompensators:[],switches:[],stationControllers:[],secondaryControllers:[],boundaries:[],sites:[],classCounts:{},records:count,warnings:[],capabilities:{powerFlow:{state:'READY',reasons:[]},n1:{state:'READY',reasons:[]},shortCircuit3Phase:{state:'BLOCKED',reasons:[]},shortCircuitGround:{state:'BLOCKED',reasons:[]}}} as CanonicalNetwork;
}
