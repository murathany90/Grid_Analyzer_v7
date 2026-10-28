import type {PsseFinding} from '../../importers/psse/types';
const severityOrder:Record<PsseFinding['severity'],number>={ERROR:0,WARNING:1,INFO:2};
/** Pure finding presentation policy, independent of DOM and stylesheet loading. */
export function summarizePsseFindings(findings:readonly PsseFinding[],visibleLimit=24){
 const ordered=[...findings].sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]),counts={ERROR:0,WARNING:0,INFO:0};
 for(const finding of findings)counts[finding.severity]++;
 return {ordered,visible:ordered.slice(0,Math.max(0,Math.trunc(visibleLimit))),counts};
}
