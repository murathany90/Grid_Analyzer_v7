/** Normalized switch links participate in equations but remain switching equipment. */
export function equipmentKindLabel(source){return source?.kind==='switch'?'Anahtarlama':source?.kind==='line'?'Hat':source?.kind==='transformer'?'Trafo':'Dal';}
