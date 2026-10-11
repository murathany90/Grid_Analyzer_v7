export const n1RiskColors=['#43b874','#e4c84f','#e34848'] as const;
/** Visual warning is independent of the physical 100% limit and DC promotion policy. */
export function n1RiskColor(loading:number|null|undefined,warning=80):string|null{
  return loading==null||!Number.isFinite(loading)?null:loading>=100?n1RiskColors[2]:loading>=warning?n1RiskColors[1]:n1RiskColors[0];
}
