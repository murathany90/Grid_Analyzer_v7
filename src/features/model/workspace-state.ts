import type {AppContext} from '../../app/contracts';
export type ModelTab='summary'|'inventory'|'operating'|'quality';
export const isModelWorkspace=(view:string)=>['model','inventory','operating'].includes(view);
export const modelTab=(ctx:Pick<AppContext,'view'|'networkModelTab'>):ModelTab=>ctx.view==='inventory'?'inventory':ctx.view==='operating'?'operating':ctx.networkModelTab==='quality'?'quality':'summary';
export function modelRoute(view:string):{view:string;tab?:ModelTab}{
 if(view==='inventory'||view==='operating')return {view,tab:view};
 if(view==='model:quality')return {view:'model',tab:'quality'};
 if(view==='model'||view==='model:summary')return {view:'model',tab:'summary'};
 return {view};
}
