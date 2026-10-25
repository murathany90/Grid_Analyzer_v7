import type {PsseModel} from '../importers/psse/types';
export interface PsseImportRequest {id:number;file:File}
export type PsseImportResponse={id:number;type:'RESULT';model:PsseModel}|{id:number;type:'ERROR';error:string};
