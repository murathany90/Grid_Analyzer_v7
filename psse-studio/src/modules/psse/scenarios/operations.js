export const isExtendedAction=action=>action==='SHUNT_B'||action==='TAP_RATIO';
export function validateExtendedOperation(network,operation){
  const {equipmentId,action,value}=operation;
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('SCENARIO_VALUE_INVALID');
  if(action==='SHUNT_B'){
    const shunts=network.shunts.filter(s=>s.sourceEquipmentId===equipmentId);
    // Discrete switched blocks use STATUS until a supported block table is present.
    if(shunts.length!==1||shunts[0].selection!=='FIXED')throw Error('SHUNT_CONTINUOUS_CONTROL_UNAVAILABLE');
    if(Math.abs(value)>network.baseMva*100)throw Error('SHUNT_B_RANGE');
  }else if(action==='TAP_RATIO'){
    const branches=network.branches.filter(b=>b.sourceEquipmentId===equipmentId),branch=branches[0],control=branch?.tapControl;
    if(branches.length!==1||branch.kind!=='transformer'||!control||!(control.tapStepPu>0))throw Error('TAP_SOURCE_LIMITS_UNAVAILABLE');
    if(value<control.tapMinPu-1e-8||value>control.tapMaxPu+1e-8)throw Error('TAP_SOURCE_RANGE');
    const steps=(value-control.tapMinPu)/control.tapStepPu;
    if(Math.abs(steps-Math.round(steps))>1e-5)throw Error('TAP_STEP_INVALID');
  }else throw Error('SCENARIO_ACTION_UNSUPPORTED');
}
export function applyExtendedOperation(network,operation){
  validateExtendedOperation(network,operation);
  if(operation.action==='SHUNT_B'){network.shunts.find(s=>s.sourceEquipmentId===operation.equipmentId).bMvar=operation.value;return;}
  const branch=network.branches.find(b=>b.sourceEquipmentId===operation.equipmentId),factor=branch.tapFrom/operation.value;
  const denominator=branch.rPu**2+branch.xPu**2;
  if(!(denominator>0))throw Error('TAP_ZERO_IMPEDANCE');
  const series={re:branch.rPu/denominator,im:-branch.xPu/denominator},oldSquared=branch.tapFrom**2,newSquared=operation.value**2;
  branch.yff={re:branch.yff.re+series.re*(1/newSquared-1/oldSquared),im:branch.yff.im+series.im*(1/newSquared-1/oldSquared)};
  for(const key of ['yft','ytf'])branch[key]={re:branch[key].re*factor,im:branch[key].im*factor};
  branch.tapFrom=operation.value;
}
