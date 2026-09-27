export interface ReducedBranch { id:string; cls:string; a:number; b:number; r:number; x:number; bc?:number; tap?:number; }
export interface PvSetpoint { bus:number; setpoint:number; }
export interface PvUnit { id:string; cls:string; qMin:number|null; qMax:number|null; direct?:boolean; }
export interface PvLimit { bus:number; qMin:number|null; qMax:number|null; fixedQ:number; hasLimits:boolean; units?:PvUnit[]; }
export interface FastAcIsland { busIds:string[]; edges:ReducedBranch[]; injections:ReadonlyArray<readonly [number,number]>; shunts?:ArrayLike<number>; slack:number; pv?:PvSetpoint[]; pvLimits?:PvLimit[]; slackSetpoint?:number; baseMVA?:number; iterations?:number; threshold?:number; }
export interface FastAcResult { status:string; reason?:string; nrReason?:string; nrIterations?:number; misMW?:number; buses?:number; lines?:number; slackBus?:string; slackMW?:number; voltages?:Array<{id:string;pu:number;angle:number}>; branches?:Array<{id:string;cls:string;a:string;b:string;pf:number;qf:number;pt:number;qt:number}>; pvToPq?:string[]; unitQ?:Array<{id:string;cls:string;value:number;limitHit:boolean}>; warnings?:string[]; nrFallback?:boolean; [key:string]:unknown; }
