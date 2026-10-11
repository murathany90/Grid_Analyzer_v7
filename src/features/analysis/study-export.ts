import type {studyResultRows} from './study-result-rows';
import type {Cell} from './xlsx-export';
/** Case totals occur once; element rows never inherit an aggregate load. */
export function studyExportRows(study:ReturnType<typeof studyResultRows>,caseId:string):Cell[][]{
  const rows:Cell[][]=[['dataLevel','caseId','class','FID','TM','name','PRE','POST','DELTA','unit','GA_Ikss_kA','PF_Ikss_kA_MAX','GA_Skss_MVA','PF_Skss_MVA_MAX','unsuppliedLoadMW','status','reason']];
  if(caseId)rows.push(['CASE_TOTAL',caseId,null,null,null,null,null,null,null,'MW',null,null,null,null,study.caseUnsuppliedLoadMw,null,null]);
  for(const r of study.rows)rows.push(['ELEMENT',caseId,r.cls,r.fid,r.tm,r.name,r.pre,r.post,r.delta,r.unit,r.ikss,r.pfIkss,r.skss,r.pfSkss,r.unsupplied,r.status,r.reason]);
  return rows;
}
