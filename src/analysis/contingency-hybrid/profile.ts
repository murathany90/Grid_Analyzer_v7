import {stableJson} from '../../domain/calculation/identity';
import type {AnalysisSettings} from '../../domain/calculation/analysis-settings';
export type HybridStudyProfile='CURRENT_SETTINGS'|'GA_APPROX_STATION_OFF';
/** Only an explicit study-profile selection disables station control. Global LF settings stay intact. */
export function hybridStudySettings(settings:AnalysisSettings,profile:HybridStudyProfile):AnalysisSettings{
  const copy=structuredClone(settings);
  if(profile==='GA_APPROX_STATION_OFF')copy.powerFlow={...copy.powerFlow,profile:'CUSTOM',stationControlMode:'off'};
  return copy;
}
export function hybridStudyIsCurrent(hash:string,settings:AnalysisSettings,profile:HybridStudyProfile='CURRENT_SETTINGS'){
  return hash===stableJson(hybridStudySettings(settings,profile));
}
