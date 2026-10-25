/** Public RAW/RAWX record field vocabulary; source order retained independently of presentation. */
const words=(x:string)=>x.split(' ');
export const rates=Array.from({length:12},(_,i)=>`rate${i+1}`);
export const ownerFields=words('o1 f1 o2 f2 o3 f3 o4 f4');
export const windingFields=(i:number)=>[...words('windv nomv ang').map(k=>k+i),...rates.map(k=>`wdg${i}${k}`),...words('cod cont node rma rmi vma vmi ntp tab cr cx cnxa').map(k=>k+i)];
export const rawFields:Record<string,string[]>={
 BUS:words('ibus name baskv ide area zone owner vm va nvhi nvlo evhi evlo'),
 LOAD:words('ibus loadid stat area zone pl ql ip iq yp yq owner scale intrpt dgenp dgenq dgenm loadtype name'),
 FIXED_SHUNT:words('ibus shntid stat gl bl name'),
 VOLTAGE_DROOP_CONTROL:words('name status regbus qdb qmin qmax vdblow vdbhigh vlow vhigh'),
 GENERATOR:[...words('ibus machid pg qg qt qb vs ireg nreg mbase zr zx rt xt gtap stat rmpct pt pb baslod'),...ownerFields,...words('wmod wpf droopname name')],
 SWITCHING_DEVICE_RATING_SET:[...words('rsetnam desc'),...rates],
 BRANCH:[...words('ibus jbus ckt rpu xpu bpu name'),...rates,...words('gi bi gj bj stat bp met len'),...ownerFields],
 SYSTEM_SWITCHING_DEVICE:words('ibus jbus ckt xpu rsetnam stat nstat met stype name'),
 TRANSFORMER:[...words('ibus jbus kbus ckt cw cz cm mag1 mag2 nmet name stat'),...ownerFields,...words('vecgrp zcod')],
 AREA:words('iarea isw pdes ptol arname'),ZONE:words('izone zoname'),OWNER:words('iowner owname'),
 FACTS_DEVICE:words('name ibus jbus mode pdes qdes vset shmx trmx vtmn vtmx vsmx imx linx rmpct owner set1 set2 vsref fcreg nreg mname'),
 SWITCHED_SHUNT:[...words('ibus shntid modsw adjm stat vswhi vswlo swreg nreg rmpct rmidnt binit name'),...Array.from({length:8},(_,i)=>[`s${i+1}`,`n${i+1}`,`b${i+1}`]).flat()],
 SUBSTATION:words('isub name lati long srg'),SUBSTATION_NODE:words('inode name ibus stat vm va'),
 SUBSTATION_SWITCHING_DEVICE:words('inode jnode swdid name type stat nstat xpu rsetnam'),
 SUBSTATION_TERMINAL:words('ibus inode type jbus kbus eqid'),
};
export const rawxSection:Record<string,string>={bus:'BUS',load:'LOAD',fixshunt:'FIXED_SHUNT',voltagedroop:'VOLTAGE_DROOP_CONTROL',generator:'GENERATOR',swdratset:'SWITCHING_DEVICE_RATING_SET',acline:'BRANCH',sysswd:'SYSTEM_SWITCHING_DEVICE',transformer:'TRANSFORMER',area:'AREA',zone:'ZONE',owner:'OWNER',facts:'FACTS_DEVICE',swshunt:'SWITCHED_SHUNT',sub:'SUBSTATION',subnode:'SUBSTATION_NODE',subswd:'SUBSTATION_SWITCHING_DEVICE',subterm:'SUBSTATION_TERMINAL',twotermdc:'TWO_TERMINAL_DC',vscdc:'VSC_DC_LINE',ntermdc:'MULTI_TERMINAL_DC'};
