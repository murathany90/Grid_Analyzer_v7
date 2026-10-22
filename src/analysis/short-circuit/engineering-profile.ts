import type {ScAdapterOptions} from './source-adapter';
import type {ScProfile} from './index';
import type {EngineeringAssumption} from '../../domain/results/quality';
export type ScComputationProfile='FAST_3PH'|'ENGINEERING_EXTENDED'|'IEC_REFERENCE_VERIFIED';
export const SC_ENGINEERING_ASSUMPTIONS:EngineeringAssumption[]=[
 {id:'FAULT_VOLTAGE',value:'MAX 1.1; MIN 1.0',unit:'pu',source:'Visible engineering preset; not normative voltage factors',affects:['Ikss','Skss'],reason:'Scenario sensitivity; temperature/source availability extrema unverified'},
 {id:'MISSING_MACHINE_XDSS',value:.2,unit:'pu on native machine MVA/kV/ngnum base',source:'ABB Electrical Installation Handbook 1SDC010001D0204, generator subtransient range 5–20%; engineering selection .2',affects:['Zkk','Ikss','Skss'],reason:'Only missing xdss; no calibration against PF result values'},
 {id:'MISSING_MACHINE_R',value:.01,unit:'pu on native machine base',source:'GA configurable engineering R/X=0.05 at xdss=.2; no manufacturer evidence',affects:['Zkk','Ikss','Skss'],reason:'Only missing rstr; estimated damping; not a duty or peak-current model'},
 {id:'IBR_PHASE',value:-90,unit:'degrees',source:'Positive-sequence ideal reactive current-source approximation; DIgSILENT FAQ on full-size converters',affects:['Ikss','Skss'],reason:'Native terminal Ikss3PF magnitude retained; phase assumed; MIN contribution excluded by visible preset'},
 {id:'SOURCE_OMISSION',value:'Only unmodelled sources; listed per component',unit:'source FID',source:'ENGINEERING_PARTIAL policy',affects:['Zkk','Ikss','Skss'],reason:'Unknown bias; neither safe lower nor upper bound; invalid branch data still prevents solution'},
];
export function engineeringSourceOptions(mode:'MAX'|'MIN',extended=true):ScAdapterOptions{
 return {mode,sourcePolicy:'ENGINEERING_PARTIAL',externalGridFactor:{value:mode==='MAX'?1.1:1,provenance:'GA_ENGINEERING_VOLTAGE_PRESET; NOT_IEC_VERIFIED'},...(extended?{missingMachineXdssPu:.2,missingMachineRPu:.01,converterAngleDeg:-90,converterTerminalBasis:true}:{}),provenance:'GA_ENGINEERING_PROFILE_V1; see SC_ENGINEERING_ASSUMPTIONS; NOT_IEC_OR_PF_VALIDATED'};
}
export function engineeringScProfile(mode:'MAX'|'MIN',profile:ScComputationProfile='ENGINEERING_EXTENDED',timeBudgetMs=30000):ScProfile{
 return {schemaVersion:2,faultType:'3PH',calculateMode:mode,voltageFactor:mode==='MAX'?1.1:1,factorProvenance:'GA_ENGINEERING_VOLTAGE_PRESET; NOT_IEC_VERIFIED',edition:profile==='IEC_REFERENCE_VERIFIED'?'IEC60909-0:2016':null,frequencyHz:50,rfOhm:0,xfOhm:0,maxFaults:10000,timeBudgetMs};
}
