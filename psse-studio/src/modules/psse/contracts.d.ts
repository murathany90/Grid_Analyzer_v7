export type ResultStatus='CONVERGED'|'PARTIAL'|'APPROXIMATE'|'BLOCKED'|'NOT_RUN';
export type Method='NR_POLAR'|'FDNS_XB'|'LOSSLESS_DC';
export type AcSolverOptions=import('./calculations/solver-options.js').AcSolverOptions;
export type PsseSolverOptions=import('./calculations/solver-options.js').PsseSolverOptions;
export interface PsseSnapshot {mode:'NONE'|'PSSE';view:string;busy:boolean;status:string;modelHash?:string;scenarioHash?:string;resultId?:string;resultStatus:ResultStatus;rateIndex:number;}
export interface PsseHostAdapter {
  /** Host supplies a PSS/E-specific namespace; DGS settings must use a separate keyspace. */
  storage?:Pick<Storage,'getItem'|'setItem'>;
  onStateChange?(snapshot:PsseSnapshot):void;
  onModelLoaded?(snapshot:PsseSnapshot):void;
  onNavigate?(route:string):void;
  onError?(error:Error):void;
}
export interface PsseModule {
  readonly version:string;readonly mode:'PSSE';
  navigate(route:'model'|'map'|'sld'|'analysis'|'compare'|'settings'|'help',section?:string):void;
  loadFiles(files:File[]):Promise<void>;
  calculate(method:Method,options?:Partial<AcSolverOptions>|Partial<PsseSolverOptions['dc']>):Promise<void>;
  getState():PsseSnapshot;
  getMetrics():Array<{action:string;ms:number;[key:string]:unknown}>;
  unmount():void;
}
export declare function mount(container:HTMLElement,host?:PsseHostAdapter):PsseModule;
