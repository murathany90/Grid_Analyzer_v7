export interface DcIslandEdge { id:string; cls:string; a:number; b:number; x:number; }
export interface DcIsland { busIds:string[]; slack:number; baseMVA?:number; injections:ReadonlyArray<ReadonlyArray<number>>; edges:DcIslandEdge[]; }
export interface DcIslandResult { status:string; id?:string; x?:number; n?:number; iterations?:number; residualPU?:number; slackBus?:string; angles?:Array<{id:string;angleRad:number}>; branches?:Array<{id:string;cls:string;from:string;to:string;pMW:number}>; remarks?:string; }
