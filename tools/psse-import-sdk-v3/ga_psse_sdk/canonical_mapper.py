"""Gated AC projection into GA's actual CanonicalNetwork. Bridge is the source handoff."""
import hashlib
import json
import math
from collections import defaultdict
from .electrical import finite
from .integrity import structural_errors, identity

METADATA_CLASSES = {'MultiSectionLine', 'InterAreaTransfer', 'Interface'}


def map_bridge_to_canonical(bridge_dict):
    meta = bridge_dict.get('metadata', {})
    case = bridge_dict.get('caseIdentification', {})
    net = bridge_dict.get('network', {})
    errors = structural_errors(bridge_dict)
    partial, diagnostics = [], []
    dropped = defaultdict(list)
    sbase = case.get('sbaseMva')
    valid_base = finite(sbase) and sbase > 0
    if not valid_base: errors.append('Missing/invalid MVA base; no substitute applied')
    if meta.get('extractionMethod') == 'standalone-decoder' or meta.get('sourceFidelity') in ('EXPERIMENTAL', 'DIAGNOSTIC_ONLY'):
        errors.append('DIAGNOSTIC_ONLY: binary inventory is not an electrical model')

    def entity(eid, cls, sid, row, refs):
        return dict(id=eid, name=row.get('name') or eid, sourceClass=cls, sourceId=str(sid),
                    inService=row.get('inService', True), siteIds=[],
                    sourceRefs={out: [dict(sourceClass=cls, sourceId=str(sid), field=src)] for out, src in refs.items()})

    def unique(table):
        seen = set()
        for r in net.get(table, []):
            key = identity(table, r)
            if key not in seen:
                seen.add(key)
                yield r

    def required(r, fields, label, positive=()):
        bad = [f for f in fields if not finite(r.get(f)) or (f in positive and r[f] <= 0)]
        errors.extend(f'{label}: invalid/missing {f}; no substitute applied' for f in bad)
        return not bad

    buses, bm = [], {}
    for b in unique('buses'):
        if not required(b, ('ibus', 'baskv', 'ide'), 'Bus', ('baskv',)):
            dropped['buses'].append(str(b.get('ibus'))); continue
        bm[b['ibus']] = b
        out = entity(f"bus_{b['ibus']}", 'Bus', b['ibus'], b, {'vnKv': 'baskv'})
        out.update(vnKv=b['baskv'], parentId='', usage=0, inService=b['ide'] != 4)
        buses.append(out)
    lines, transformers, generators, external, loads, shunts = [], [], [], [], [], []

    def terminals(r, table):
        keys = ('fromBus', 'toBus') if table in ('branches', 'transformers') else ('ibus',)
        if table == 'transformers' and r.get('isThreeWinding'): keys += ('tertiaryBus',)
        if any(r.get(k) not in bm for k in keys):
            label = str(identity(table, r)); dropped[table].append(label)
            errors.append(f'Topological disconnection: {table} {label} invalid terminal')
            return False
        return True

    for br in unique('branches'):
        if not terminals(br, 'branches') or not valid_base: continue
        sid = f"{br['fromBus']}_{br['toBus']}_{br['circuitId']}"
        if not required(br, ('rPu', 'xPu', 'bPu', 'lengthKm'), sid):
            dropped['branches'].append(sid); continue
        if br.get('inService', True) and br['xPu'] <= 0: errors.append(f'{sid}: GA line preparation cannot represent X<=0')
        if br.get('isBypassed'): errors.append(f'{sid}: bypass semantics unimplemented')
        z = bm[br['fromBus']]['baskv'] ** 2 / sbase
        out = entity('line_'+sid, 'Line', sid, br, {'rOhm':'rPu', 'xOhm':'xPu', 'bSiemens':'bPu', 'ratingMva':'rateSet[0]'})
        out.update({'from':f"bus_{br['fromBus']}", 'to':f"bus_{br['toBus']}", 'vnKv':bm[br['fromBus']]['baskv'],
                    'lengthKm':br['lengthKm'], 'rOhm':br['rPu']*z, 'xOhm':br['xPu']*z, 'bSiemens':br['bPu']/z,
                    'ratingMva':br.get('rateMva'), 'coordinates':[], 'sections':1})
        lines.append(out)
        for end, bus in (('from', br['fromBus']), ('to', br['toBus'])):
            g, b = br.get(end+'ShuntGpu'), br.get(end+'ShuntBpu')
            if not finite(g) or not finite(b): errors.append(f'{sid}: missing terminal admittance'); continue
            if g or b:
                sh = entity(f'line_shunt_{sid}_{end}', 'LineTerminalShunt', sid, br, {'gPu':end+'ShuntGpu','bPu':end+'ShuntBpu'})
                sh.update(bus=f'bus_{bus}', gPu=g, bPu=b); shunts.append(sh)

    for tr in unique('transformers'):
        if not terminals(tr, 'transformers') or not valid_base: continue
        sid = '_'.join(str(tr.get(k)) for k in ('fromBus','toBus','tertiaryBus','circuitId'))
        is3 = bool(tr.get('isThreeWinding'))
        ws = [tr.get('winding'+str(i)) for i in range(1, 4 if is3 else 3)]
        if any(not isinstance(w,dict) or not required(w, ('ratioPu','angleDeg'), sid, ('ratioPu',)) for w in ws):
            dropped['transformers'].append(sid); continue
        imp=tr.get('impedance',{}); pairs=('12','23','31') if is3 else ('12',)
        if not required(imp, tuple(v+p+'Pu' for p in pairs for v in ('r','x')), sid):
            dropped['transformers'].append(sid); continue
        zs=[complex(imp['r'+p+'Pu'],imp['x'+p+'Pu']) for p in pairs]
        if tr.get('statusCode',1 if tr.get('inService',True) else 0) not in (0,1): errors.append(f'{sid}: partial winding disconnection unimplemented')
        if tr.get('controlMode',0): partial.append(f'{sid}: automatic tap/phase control retained in Bridge only')
        mag=tr.get('magnetizing',{})
        if not required(mag, ('gPu','bPu'), sid):
            errors.append(f'{sid}: missing magnetizing admittance')
        elif mag['gPu'] or mag['bPu']:
            sh=entity('tx_mag_'+sid,'TransformerMagnetizingShunt',sid,tr,{'gPu':'magnetizing.gPu','bPu':'magnetizing.bPu'})
            sh.update(bus=f"bus_{tr['fromBus']}",gPu=mag['gPu'],bPu=mag['bPu']); shunts.append(sh)
        for w in ws:
            if w.get('controlMode'): partial.append(f'{sid}: automatic winding control unsupported in projection')
            if w.get('impedanceTable'): errors.append(f'{sid}: impedance correction table is not evaluated')
        for i,w in enumerate(ws):
            nominal=w.get('nominalKv',0)
            terminal=tr['fromBus'] if i==0 else tr['toBus'] if i==1 else tr['tertiaryBus']
            if nominal and abs(nominal-bm[terminal]['baskv'])>1e-3:
                errors.append(f'{sid}: nominal winding/bus kV bases differ; impedance voltage-base equivalence unverified')
        if is3:
            star=tr.get('starBus'); starid=f'bus_{star}' if star in bm else f'bus_star_{sid}'
            star_kv=bm[star]['baskv'] if star in bm else bm[tr['fromBus']]['baskv']
            if star not in bm:
                out=entity(starid,'TransformerStar',sid,tr,{'vnKv':'fromBus.baskv'})
                out.update(vnKv=star_kv,parentId='',usage=0); buses.append(out)
            legs=[(zs[0]+zs[2]-zs[1])/2,(zs[0]+zs[1]-zs[2])/2,(zs[1]+zs[2]-zs[0])/2]
            bs=[tr['fromBus'],tr['toBus'],tr['tertiaryBus']]
            ends=[(f'bus_{b}',starid,bm[b]['baskv'],star_kv) for b in bs]
            taps=[w['ratioPu'] for w in ws]; phases=[math.radians(w['angleDeg']) for w in ws]
        else:
            # Convert the two ideal ratios to one single-tap primitive.
            # z'=z*t2^2, t'=t1/t2; this preserves the two-port Y matrix.
            legs=[zs[0]*ws[1]['ratioPu']**2]
            ends=[(f"bus_{tr['fromBus']}",f"bus_{tr['toBus']}",bm[tr['fromBus']]['baskv'],bm[tr['toBus']]['baskv'])]
            taps=[ws[0]['ratioPu']/ws[1]['ratioPu']]
            phases=[math.radians(ws[0]['angleDeg']-ws[1]['angleDeg'])]
        for i,(z,end,tap,phase) in enumerate(zip(legs,ends,taps,phases)):
            tid=f"tr3w_{tr['fromBus']}_{tr['toBus']}_{tr['tertiaryBus']}_{tr['circuitId']}_w{i+1}" if is3 else f"tr2w_{tr['fromBus']}_{tr['toBus']}_{tr['circuitId']}"
            if abs(z)<1e-12: errors.append(f'{tid}: zero transformer leg impedance')
            rate=ws[i].get('rateMva')
            if rate is None and ws[i].get('rateSet') and ws[i]['rateSet'][0] == 0: rate = 0.0  # explicit source unlimited rating
            if rate is None:
                dropped['transformers'].append(tid); errors.append(f'{tid}: missing thermal limit cannot be represented by GA Transformer2W'); continue
            out=entity(tid,'Transformer2W',sid,tr,{'tap':f'winding{i+1}.ratioPu','rPu':'impedance','phase':f'winding{i+1}.angleDeg'})
            out.update({'from':end[0],'to':end[1],'vnKv':end[2],'lvKv':end[3],'rPu':z.real,'xPu':z.imag,'tap':tap,'phase':phase,
                        'ratingMva':rate,'tapPosition':0,'gPu':0.0,'bPu':0.0,'tapResolution':'SOURCE_RESOLVED'})
            if is3:
                status=tr.get('statusCode',1)
                out['inService']=status!=0 and not ((status==2 and i==1) or (status==3 and i==2) or (status==4 and i==0))
            transformers.append(out)

    missing_q=0
    for g in unique('generators'):
        if not terminals(g,'generators'): continue
        sid=f"{g['ibus']}_{g['machid']}"
        if not required(g,('pMw','qMvar','vsPu','mbaseMva'),sid,('vsPu','mbaseMva')):
            dropped['generators'].append(sid); continue
        if g.get('windMode',0) and g.get('inService',True): errors.append(f'{sid}: wind-generator reactive control mode unimplemented')
        qmin,qmax=g.get('qMinMvar'),g.get('qMaxMvar')
        if not finite(qmin) or not finite(qmax): missing_q+=1; partial.append(f'{sid}: missing Q limits')
        elif qmin>qmax: errors.append(f'{sid}: inverted Q limits')
        if g.get('remoteBus',0) not in (0,g['ibus']) and g.get('inService',True): errors.append(f'{sid}: remote voltage control unimplemented')
        out=entity('gen_'+sid,'Generator',sid,g,{'pMw':'pMw','qMvar':'qMvar','vmSet':'vsPu','qMin':'qMinMvar','qMax':'qMaxMvar'})
        out.update(bus=f"bus_{g['ibus']}",pMw=g['pMw'],qMvar=g['qMvar'],pDispatchMw=g['pMw'],qDispatchMvar=g['qMvar'],
                   vmSet=g['vsPu'],voltageControl=bm[g['ibus']]['ide'] in (2,3),qMin=qmin,qMax=qmax)
        if bm[g['ibus']]['ide'] != 3:
            generators.append(out)
        if bm[g['ibus']]['ide']==3:
            e=entity('extgrid_'+sid,'ExternalGrid',sid,g,{'bus':'ibus','vmSet':'vsPu'})
            e.update(bus=out['bus'],pMw=g['pMw'],qMvar=g['qMvar'],vmSet=g['vsPu'],pMin=g.get('pMinMw'),pMax=g.get('pMaxMw'),
                     qMin=qmin,qMax=qmax,bustpRaw='SL',modeInputRaw='Swing / Reference'); external.append(e)
    for l in unique('loads'):
        if not terminals(l,'loads'): continue
        sid=f"{l['ibus']}_{l['loadid']}"
        if not required(l,('pMw','qMvar','pCurrentMw','qCurrentMvar','pAdmittanceMw','qAdmittanceMvar'),sid):
            dropped['loads'].append(sid); continue
        if l.get('inService',True) and any(l[k] for k in ('pCurrentMw','qCurrentMvar','pAdmittanceMw','qAdmittanceMvar')): errors.append(f'{sid}: voltage-dependent ZIP cannot be represented by GA constant PQ')
        out=entity('load_'+sid,'Load',sid,l,{'pMw':'pMw','qMvar':'qMvar'})
        out.update(bus=f"bus_{l['ibus']}",pMw=l['pMw'],qMvar=l['qMvar'],activeBalanceEligibility=l.get('isScalable',True),activeBalanceEligibilitySource='native-scale'); loads.append(out)
    invalid_steps=0
    for table in ('fixedShunts','switchedShunts'):
        for s in unique(table):
            if not terminals(s,table) or not valid_base: continue
            switched=table=='switchedShunts'; fields=('bInitMvar',) if switched else ('gMw','bMvar'); sid=f"{s['ibus']}_{s['shuntId']}"
            if not required(s,fields,sid): dropped[table].append(sid); continue
            if switched:
                for block in s.get('blocks',[]):
                    if not finite(block.get('numSteps')) or block['numSteps']<0 or not finite(block.get('stepBMvar')):
                        invalid_steps+=1; errors.append(f'{sid}: invalid shunt block')
                if s.get('inService',True) and s.get('controlMode',0): partial.append(f'{sid}: automatic shunt control retained in Bridge only')
            out=entity(('swshunt_' if switched else 'fshunt_')+sid,'Shunt',sid,s,{'bPu':fields[-1]})
            b=s['bInitMvar'] if switched else s['bMvar']
            out.update(bus=f"bus_{s['ibus']}",gPu=0.0 if switched else s['gMw']/sbase,bPu=b/sbase,nominalQMvar=b); shunts.append(out)

    for u in meta.get('unsupportedEquipment',[]):
        cls=u.get('sourceClass','UNKNOWN') if isinstance(u,dict) else str(u)
        if cls not in METADATA_CLASSES: errors.append(f'UNSUPPORTED_AC_PHYSICS: {cls}; source retained, missing GA equations')
        else: diagnostics.append(dict(code='REPORTING_METADATA_ONLY',message=cls,severity='INFO'))
    nb=bool(net.get('substationNodes') or net.get('substationSwitches'))
    if nb: errors.append('NODE_BREAKER_UNPROVEN: terminal/cubicle and switch-state equivalence unverified; physical nodes retained in Bridge, excluded from solver buses')
    enabled={b['id'] for b in buses if b['inService']}; edges=defaultdict(set)
    for e in lines+transformers:
        if e['inService'] and e['from'] in enabled and e['to'] in enabled:
            edges[e['from']].add(e['to']); edges[e['to']].add(e['from'])
    slack={e['bus'] for e in external if e['inService'] and e['bus'] in enabled}
    seen=set()
    for root in sorted(enabled):
        if root in seen: continue
        comp={root}; stack=[root]; seen.add(root)
        while stack:
            for v in edges[stack.pop()]:
                if v not in seen: seen.add(v); comp.add(v); stack.append(v)
        if not comp & slack: errors.append(f'ISLAND_NO_ACTIVE_SLACK: {root}, buses={len(comp)}')
    if not enabled: errors.append('No active electrical buses')
    if case.get('solutionStatus',{}).get('state')!='VERIFIED': partial.append('Source convergence and GA solver equivalence unverified; saved method/voltage is not proof')
    if meta.get('sourceFidelity')=='PARTIAL' and not meta.get('unsupportedEquipment'): partial.append('Source extractor reports PARTIAL fidelity')
    errors=list(dict.fromkeys(errors)); partial=list(dict.fromkeys(partial))
    for sev,msgs in (('ERROR',errors),('WARNING',partial)):
        diagnostics.extend(dict(code='PSSE_FIDELITY_GATE',message=m,severity=sev) for m in msgs)
    pf='BLOCKED' if errors else 'PARTIAL' if partial else 'READY'
    caps={'powerFlow':dict(state=pf,reasons=errors+partial,scope='Fixed-control AC projection; no convergence claim'),
          'n1':dict(state='BLOCKED' if errors else 'PARTIAL',reasons=errors+partial+['All ratings retained in Bridge; seasonal rating policy unbound'],scope='Not approved for contingency assessment'),
          'shortCircuit3Phase':dict(state='BLOCKED',reasons=errors+['Sequence sources and IEC 60909 are not independently validated'],scope='NOT_IEC_VERIFIED'),
          'switchingManeuvers':dict(state='BLOCKED',reasons=['Requires validated physical node-breaker processor'])}
    sites=[]
    for s in unique('substations'):
        out=entity(f"site_sub_{s['subNumber']}",'Site',s['subNumber'],s,{})
        out.update(lat=s.get('latitude'),lon=s.get('longitude'),areaId='',areaName='',voltages=[]); sites.append(out)
    fidelity=dict(transformerTapFallbackCount=0,transformerTapFallbackIds=[],droppedBranchCount=len(dropped['branches']),droppedBranchIds=dropped['branches'],
                  droppedTransformerCount=len(dropped['transformers']),droppedTransformerIds=dropped['transformers'],droppedEquipmentCount=sum(map(len,dropped.values())),
                  droppedEquipment=dict(dropped),generatorMissingQLimitCount=missing_q,invalidShuntStepCount=invalid_steps,
                  unresolvedSwitchCount=len(net.get('substationSwitches',[])) if nb else 0,fidelity='PARTIAL' if errors or partial else 'SOURCE_EXACT')
    tables=dict(buses=buses,lines=lines,transformers=transformers,generators=generators,externalGrids=external,loads=loads,shunts=shunts,sites=sites,
                switches=[],seriesCompensators=[],internationalConnections=[],stationControllers=[],secondaryControllers=[],boundaries=[])
    counts={k:len(v) for k,v in tables.items()}; records=sum(counts.values())
    digest=hashlib.sha256(json.dumps({'network':net,'case':case,'sourceSha256':meta.get('sourceSha256'),'projectionPolicy':'v3-1.1'},sort_keys=True,default=str).encode()).hexdigest()
    return dict(schemaVersion=1,modelHash=digest,name=meta.get('sourceFile','PSS/E'),studyCase=case.get('titleLine1',''),
                baseMva=sbase,size=records,records=records,classCounts=counts,warnings=errors+partial,diagnostics=diagnostics,capabilities=caps,sourceFidelity=fidelity,**tables)
