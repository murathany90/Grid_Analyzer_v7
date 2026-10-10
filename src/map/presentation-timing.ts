/** Keep one sample per owned stage; pointer/render history must not grow forever. */
export function beginPresentationTiming(stage:string){performance.clearMarks(stage+'.start');performance.mark(stage+'.start');}
export function endPresentationTiming(stage:string){performance.clearMeasures(stage);performance.measure(stage,stage+'.start');performance.clearMarks(stage+'.start');}
