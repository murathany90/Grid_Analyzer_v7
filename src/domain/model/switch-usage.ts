export type SourceSwitchKind='breaker'|'isolator'|'load-break-disconnector'|'load-switch'|'switch';
/** DIgSILENT DGS Documentation B.1.5 (local official PDF, p.60).
 * The usage field classifies the device; on_off only describes its position. */
export function sourceSwitchKind(usage:string):SourceSwitchKind {
 switch(usage.toLowerCase()){case 'cbk':return 'breaker';case 'dct':return 'isolator';case 'sdc':return 'load-break-disconnector';case 'swt':return 'load-switch';default:return 'switch';}
}
