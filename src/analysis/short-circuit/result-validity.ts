import {SC_ENGINE_REVISION, scProfileHash, scSourceContextHash, type ScResult} from './index';
import type {ScSourceContext} from './source-adapter';
/** Shared numerical admissibility for live selection, resume and persisted results. */
export function scResultIsAdmissible(r: ScResult | null | undefined, expected: {modelHash:string;scenarioHash:string;mode:'MAX'|'MIN';faultType:'3PH';sourceHash?:string;context?:ScSourceContext|null;verifyProfile?:boolean}): r is ScResult {
 if (!r?.profile || !r.identity || r.engineRevision !== SC_ENGINE_REVISION || r.identity.modelHash !== expected.modelHash || r.identity.scenarioHash !== expected.scenarioHash || r.profile.calculateMode !== expected.mode || r.profile.faultType !== expected.faultType) return false;
 if (expected.verifyProfile && r.identity.profileHash !== scProfileHash(r.profile)) return false;
 const method = r.profile.edition ? 'GA_IEC60909_2016_PREFLIGHT' : `GA_POSITIVE_SEQUENCE_3PH_${expected.mode}`;
 if (r.method !== method || expected.sourceHash && r.identity.sourceHash !== expected.sourceHash) return false;
 if (expected.context && (expected.context.modelHash !== expected.modelHash || expected.context.calculateMode && expected.context.calculateMode !== expected.mode || scSourceContextHash(expected.context) !== r.identity.sourceHash)) return false;
 return true;
}
