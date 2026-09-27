export type Level='DEBUG'|'INFO'|'WARN'|'ERROR';
export interface LogEntry { time:string;level:Level;feature:string;message:string;detail?:unknown }
export class Logger {
  readonly entries:LogEntry[]=[];developerMode=false;
  log(level:Level,feature:string,message:string,detail?:unknown):void{
    this.entries.push({time:new Date().toISOString(),level,feature,message,detail});if(this.entries.length>200)this.entries.shift();
    if(this.developerMode||level==='ERROR')console[level==='ERROR'?'error':level==='WARN'?'warn':'debug'](`[${feature}] ${message}`,detail??'');
  }
}
export const logger=new Logger();
