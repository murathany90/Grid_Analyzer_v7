/** @typedef {'NR_POLAR'|'FDNS_XB'|'LOSSLESS_DC'} PsseMethod */
/** @typedef {{tolerancePu:number,maxIterations:number,maxQLimitRounds:number,reactiveLimitsEnabled:boolean,initialVoltagePolicy:'FLAT'|'SOURCE_SAVED',minVoltagePu:number,maxVoltagePu:number,loadModelProfile:'PSSE_SOURCE'|'GENERIC_ZIP',automaticAdjustments:boolean,maxAdjustmentRounds:number,remoteRegulation:boolean,remoteChasing:boolean,maxRemoteRounds:number,sourceUnits:'MVA_MVAR_DEG_PER_UNIT'}} AcSolverOptions */
/** @typedef {{method:PsseMethod,ac:AcSolverOptions,dc:{voltageMagnitudePu:1,loadVoltagePolicy:'UNITY'|'SOURCE_SAVED',includeRealShuntConsumption:boolean,realShuntVoltagePolicy:'UNITY'|'SOURCE_SAVED',referenceAnglePolicy:'FLAT_REFERENCE'|'SOURCE_REFERENCE_ANGLE',tapPolicy:'PSSE36_DCLF_COMPAT'|'TAP_AWARE_LOSSLESS'}}} PsseSolverOptions */
export const DEFAULT_SOLVER_OPTIONS=Object.freeze({method:'NR_POLAR',ac:Object.freeze({tolerancePu:1e-6,maxIterations:40,maxQLimitRounds:8,reactiveLimitsEnabled:true,initialVoltagePolicy:'SOURCE_SAVED',minVoltagePu:.001,maxVoltagePu:8,loadModelProfile:'PSSE_SOURCE',automaticAdjustments:false,maxAdjustmentRounds:10,remoteRegulation:false,remoteChasing:false,maxRemoteRounds:15,sourceUnits:'MVA_MVAR_DEG_PER_UNIT'}),dc:Object.freeze({voltageMagnitudePu:1,loadVoltagePolicy:'SOURCE_SAVED',includeRealShuntConsumption:true,realShuntVoltagePolicy:'SOURCE_SAVED',referenceAnglePolicy:'FLAT_REFERENCE',tapPolicy:'PSSE36_DCLF_COMPAT'})});
export function normalizeSolverOptions(method,patch={}){
  if(!['NR_POLAR','FDNS_XB','LOSSLESS_DC'].includes(method))throw Error('PSSE_METHOD_UNSUPPORTED');
  const defaults=method==='LOSSLESS_DC'?DEFAULT_SOLVER_OPTIONS.dc:DEFAULT_SOLVER_OPTIONS.ac,options={...defaults,...patch};
  for(const key of Object.keys(patch))if(!(key in defaults))throw Error('PSSE_OPTION_UNSUPPORTED:'+key);
  for(const [key,value]of Object.entries(options)){const base=defaults[key];if(typeof value!==typeof base||typeof value==='number'&&!Number.isFinite(value))throw Error('PSSE_OPTION_INVALID:'+key);}
  if(method!=='LOSSLESS_DC'){
    if(options.sourceUnits!=='MVA_MVAR_DEG_PER_UNIT'||!['FLAT','SOURCE_SAVED'].includes(options.initialVoltagePolicy)||!['PSSE_SOURCE','GENERIC_ZIP'].includes(options.loadModelProfile))throw Error('PSSE_OPTION_ENUM');
    if(options.tolerancePu<=0||options.tolerancePu>.01||options.minVoltagePu<=0||options.maxVoltagePu<=options.minVoltagePu)throw Error('PSSE_OPTION_RANGE');
    for(const k of ['maxIterations','maxQLimitRounds','maxAdjustmentRounds','maxRemoteRounds'])if(!Number.isInteger(options[k])||options[k]<1||options[k]>1000)throw Error('PSSE_OPTION_RANGE:'+k);
  }else if(options.voltageMagnitudePu!==1||!['UNITY','SOURCE_SAVED'].includes(options.loadVoltagePolicy)||!['UNITY','SOURCE_SAVED'].includes(options.realShuntVoltagePolicy)||!['FLAT_REFERENCE','SOURCE_REFERENCE_ANGLE'].includes(options.referenceAnglePolicy)||!['PSSE36_DCLF_COMPAT','TAP_AWARE_LOSSLESS'].includes(options.tapPolicy))throw Error('PSSE_DC_OPTION_ENUM');
  return options;
}
