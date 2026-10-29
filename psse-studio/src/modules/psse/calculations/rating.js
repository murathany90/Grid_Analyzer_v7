const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function loadingAtTerminals(branch,row,index=0){
  if(!branch||!row||branch.status!==1)return {from:null,to:null};
  const basis=String(branch.ratingBasis??'MVA').toUpperCase();
  function at(side){
    const ratings=side==='From'?branch.ratingsFromSource:branch.ratingsToSource,rate=ratings?.[index];if(!finite(rate)||rate<=0)return null;
    let actual=null;
    if(basis.includes('AMP')||basis==='A')actual=row[`i${side}A`];
    else if(basis.includes('MVA')||basis==='S'){const p=row[`p${side}Mw`],q=row[`q${side}Mvar`];if(finite(p)&&finite(q))actual=Math.hypot(p,q);}
    return finite(actual)?100*Math.abs(actual)/rate:null;
  }
  return {from:at('From'),to:at('To')};
}
const cache=new WeakMap();
export function ratePresentation(result,network,index=0){
  if(!result||!network)return result;
  let item=cache.get(result);if(item&&item.network===network&&item.index===index)return item.value;
  const branches=new Map(network.branches.map(branch=>[branch.id,branch]));
  const value={...result,presentation:{...result.presentation,rateIndex:index,rateLabel:index<3?'RATE '+['A','B','C'][index]:'RATE '+(index+1)},branchResults:result.branchResults.map(row=>{const pct=loadingAtTerminals(branches.get(row.id),row,index);return {...row,loadingFromPct:pct.from,loadingToPct:pct.to};})};
  cache.set(result,{network,index,value});return value;
}
