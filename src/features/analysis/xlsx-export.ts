import {strToU8,zipSync} from 'fflate';
import type {CanonicalNetwork} from '../../domain/model/network';
import type {CalculationResult} from '../../domain/results/types';
import type {PowerFactoryComparison} from '../../analysis/validation/powerfactory-reference';

export type Cell=string|number|null|undefined;
export interface WorkbookSheet {name:string;rows:Cell[][]}
const esc=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function column(index:number):string {let n=index+1,out='';while(n){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26);}return out;}
function sheet(rows:readonly (readonly Cell[])[]):string {
  const body=rows.map((row,r)=>`<row r="${r+1}">${row.map((value,c)=>{
    const ref=`${column(c)}${r+1}`;if(value==null||typeof value==='number'&&!Number.isFinite(value))return `<c r="${ref}"/>`;
    if(typeof value==='number')return `<c r="${ref}"><v>${value}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value.slice(0,32767))}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}
export function buildResultWorkbook(result:CalculationResult,network:CanonicalNetwork,reference?:PowerFactoryComparison):Uint8Array {
  const generatorById=new Map(network.generators.map(g=>[g.id,g]));
  const buses:Cell[][]=[['id','name','vnKv','Vpu','VkV','angleDeg','Pmw','Qmvar','islandId'],...result.buses.map(b=>[b.id,b.name,b.vnKv,b.vmPu,b.vmPu*b.vnKv,b.angleRad*180/Math.PI,b.pMw,b.qMvar,b.islandId])];
  const branches:Cell[][]=[['id','name','class','from','to','vnKv','Pf','Qf','Pt','Qt','P_loss','Q_loss','loading'],...result.branches.map(b=>[b.id,b.name,b.sourceClass,b.from,b.to,b.vnKv,b.pf,b.qf,b.pt,b.qt,b.pLoss,b.qLoss,b.loading])];
  const generators:Cell[][]=[['id','name','bus','P','Q','Q state','Qmin','Qmax'],...result.generators.map(g=>[g.id,g.name,g.bus,g.pMw,g.qMvar,g.qState,generatorById.get(g.id)?.qMin,generatorById.get(g.id)?.qMax])];
  let identityOptions:Record<string,unknown>={};try{identityOptions=JSON.parse(result.identity.optionsHash) as Record<string,unknown>;}catch{/* retain the original identity options below */}
  const analysisSettings=identityOptions.analysisSettings&&typeof identityOptions.analysisSettings==='object'?identityOptions.analysisSettings as Record<string,unknown>:{},activeSettings=analysisSettings[result.identity.analysisType]&&typeof analysisSettings[result.identity.analysisType]==='object'?analysisSettings[result.identity.analysisType] as Record<string,unknown>:{},analysisProfile=String(activeSettings.profile??(result.identity.analysisType==='fastAc'?'FAST_AC_PARAMETRIC':result.identity.analysisType==='dc'?'DC_PARAMETRIC':'UNKNOWN'));
  const settingsRows:Cell[][]=[];const flatten=(value:unknown,path:string)=>{if(!value||typeof value!=='object'||Array.isArray(value)){settingsRows.push([`analysisSettings.${path}`,String(value)]);return;}for(const[key,item]of Object.entries(value))flatten(item,path?`${path}.${key}`:key);};flatten(analysisSettings,'');
  const diagnostics:Cell[][]=[['key','value'],['engine',result.identity.analysisType],['analysis profile',analysisProfile],['analysis settings hash',String(identityOptions.analysisSettingsHash??'unavailable')],['control context hash',String(identityOptions.controlContextHash??'unavailable')],...settingsRows,['model hash',result.identity.modelHash],['scenario hash',result.identity.scenarioHash],['study case',network.studyCase??''],['solver',`${result.identity.engine} ${result.identity.engineVersion}`],['status',result.status],['converged',String(result.converged)],['iterations',result.iterations],['Q-limit rounds',result.rounds],['outer control rounds',Number(result.diagnostics.outerControlRounds??0)],['reference comparison',reference?.quality??String(result.diagnostics.referenceValidation??result.quality.referenceValidation)],['warnings',result.warnings.join(' | ')]];
  const station=result.diagnostics.stationControllerSummary;if(station&&typeof station==='object')for(const[key,value]of Object.entries(station))if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')diagnostics.push([`station.${key}`,String(value)]);
  const islands=result.diagnostics.islands;if(Array.isArray(islands))for(const row of islands){if(!row||typeof row!=='object')continue;const item=row as Record<string,unknown>,id=String(item.islandId??'unknown');for(const[key,value]of Object.entries(item))if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')diagnostics.push([`island.${id}.${key}`,String(value)]);}
  return buildWorkbook([{name:'Buses',rows:buses},{name:'Branches',rows:branches},{name:'Generators',rows:generators},{name:'Diagnostics',rows:diagnostics}]);
}
export function buildWorkbook(sheets:WorkbookSheet[]):Uint8Array {
  const names=sheets.map(sheet=>sheet.name);
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name,i)=>`<sheet name="${name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
  const contentTypes=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const bookRels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`;
  const files:Record<string,Uint8Array>={'[Content_Types].xml':strToU8(contentTypes),'_rels/.rels':strToU8(rels),'xl/workbook.xml':strToU8(workbook),'xl/_rels/workbook.xml.rels':strToU8(bookRels)};
  sheets.forEach(({rows},i)=>{files[`xl/worksheets/sheet${i+1}.xml`]=strToU8(sheet(rows));});
  return zipSync(files,{level:6});
}
export function downloadResultWorkbook(result:CalculationResult,network:CanonicalNetwork,reference?:PowerFactoryComparison):void {
  const bytes=buildResultWorkbook(result,network,reference),url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link=document.createElement('a');link.href=url;link.download='GridAnalyzer_FullNR_Results.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
