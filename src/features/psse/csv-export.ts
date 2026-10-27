import {pssePublicationMessage,pssePublicationStatus,type PsseCalculationResult} from '../../domain/psse/results';

export type PsseResultTable='buses'|'branches'|'generators';
const csvCell=(value:unknown)=>{if(value===null||value===undefined)return'';const text=String(value);return/[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;};
const identityFields=(result:PsseCalculationResult)=>[result.id,result.source,result.method,result.identity.engineVersion,result.identity.modelHash,result.identity.topologyHash,result.identity.scenarioHash,result.identity.optionsHash,result.status,pssePublicationStatus(result),result.physicsCoverage,pssePublicationMessage(result)];
const identityHeaders=['Calculation ID','Source category','Solver','Engine version','Model SHA-256','Topology SHA-256','Scenario SHA-256','Options SHA-256','Numerical status','Publication status','Physics coverage','Profile note'];

/** RFC 4180 CSV in UTF-8, with units, result provenance and the complete calculation identity. */
export function exportPsseResultCsv(result:PsseCalculationResult,table:PsseResultTable):string{
 if(result.status!=='CONVERGED')throw Error('CALCULATED_RESULT_UNAVAILABLE');
 let headers:string[],rows:(string|number|null|undefined)[][];
 if(table==='buses'){headers=[...identityHeaders,'Bus ID','Connection key',result.method==='LOSSLESS_DC'?'Vm (pu; not solved by LOSSLESS_DC)':'Vm (pu)','Va (deg)','P generation (MW)','Q generation (Mvar)','Source equipment ID'];rows=result.busResults.map(bus=>[...identityFields(result),bus.id,bus.connectionKey,bus.vmPu,bus.vaDeg,bus.pGenerationMw,bus.qGenerationMvar,bus.sourceEquipmentId]);}
 else if(table==='generators'){headers=[...identityHeaders,'Generator ID','P (MW)','Q (Mvar)','Q limit state','Source equipment ID'];rows=result.generatorResults.map(generator=>[...identityFields(result),generator.id,generator.pMw,generator.qMvar,generator.limitState,generator.sourceEquipmentId]);}
 else{const ratings=Array.from({length:12},(_,index)=>[`RATE${index+1} from (MVA-eq)`,`RATE${index+1} to (MVA-eq)`]).flat();headers=[...identityHeaders,'Branch ID','Terminal from','Terminal to','P from (MW)','Q from (Mvar)','P to (MW)','Q to (Mvar)','S from (MVA)','S to (MVA)','I from (A)','I to (A)','Loading from (%)','Loading to (%)','Rating basis','Loading basis',...ratings,'Source equipment ID'];rows=result.branchResults.map(branch=>[...identityFields(result),branch.id,branch.terminalFrom,branch.terminalTo,branch.pFromMw,branch.qFromMvar,branch.pToMw,branch.qToMvar,branch.sFromMva,branch.sToMva,branch.iFromA,branch.iToA,branch.loadingFromPct,branch.loadingToPct,branch.ratingBasis,branch.loadingBasis,...Array.from({length:12},(_,index)=>[branch.ratingsFromSource?.[index],branch.ratingsToSource?.[index]]).flat(),branch.sourceEquipmentId]);}
 const csv=[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');return`\uFEFF${csv}\r\n`;
}
