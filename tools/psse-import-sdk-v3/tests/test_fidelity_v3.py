import copy
import cmath
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from synthetic import bridge, three_winding, rawx, raw
from ga_psse_sdk.canonical_mapper import map_bridge_to_canonical as project
from ga_psse_sdk.electrical import transformer_impedance, winding_ratio, magnetizing_admittance
from ga_psse_sdk.raw_parser import RawParser, _split_tokens
from ga_psse_sdk.rawx_parser import RawxParser
from ga_psse_sdk.validator import ModelValidator

ROOT = Path(__file__).resolve().parents[1]


class FidelityTests(unittest.TestCase):
    def setUp(self): self.b = bridge()
    def blocked(self, b): self.assertEqual(project(b)['capabilities']['powerFlow']['state'], 'BLOCKED')
    def changed(self, mutate):
        other=copy.deepcopy(self.b);mutate(other)
        r=ModelValidator().compare_networks('mutation',self.b,other)
        self.assertFalse(r['all_passed'],r)

    def test_01_active_slack(self):
        self.b['network']['generators'][0]['inService']=False;self.blocked(self.b)
    def test_02_each_island_requires_reference(self):
        self.b['network']['branches'][0]['inService']=False;self.blocked(self.b)
    def test_03_inactive_reference_bus(self):
        self.b['network']['buses'][0]['ide']=4;self.blocked(self.b)
    def test_04_all_bus_attached_classes_reject_orphans(self):
        for table in ('generators','loads','fixedShunts','switchedShunts'):
            with self.subTest(table=table):
                b=copy.deepcopy(self.b);b['network'][table][0]['ibus']=999
                n=project(b);self.assertEqual(n['capabilities']['powerFlow']['state'],'BLOCKED')
                for out in ('generators','loads','shunts'): self.assertFalse(any(e['bus']=='bus_999' for e in n[out]))
    def test_05_transformer_terminal_orphans(self):
        for field in ('fromBus','toBus','tertiaryBus'):
            b=three_winding();b['network']['transformers'][0][field]=999;self.blocked(b)
    def test_06_control_bus_orphans(self):
        for table,field in (('generators','remoteBus'),('switchedShunts','controlledBus'),('transformers','controlledBus')):
            b=copy.deepcopy(self.b);b['network'][table][0][field]=999;self.blocked(b)
        b=three_winding();b['network']['transformers'][0]['winding3']['controlledBus']=999;self.blocked(b)
    def test_07_all_object_duplicate_keys(self):
        for table,rows in self.b['network'].items():
            if rows:
                with self.subTest(table=table):
                    b=copy.deepcopy(self.b);b['network'][table].append(copy.deepcopy(rows[0]));self.blocked(b)
                    self.assertFalse(ModelValidator().compare_networks(table,self.b,b)['all_passed'])
    def test_08_reversed_branch_duplicate(self):
        b=self.b;row=copy.deepcopy(b['network']['branches'][0]);row['fromBus'],row['toBus']=row['toBus'],row['fromBus'];b['network']['branches'].append(row);self.blocked(b)
    def test_09_source_tuple_direction(self):
        self.changed(lambda b:b['network']['branches'][0].update(fromBus=2,toBus=1))
    def test_10_all_twelve_ratings(self):
        for idx in range(12):
            self.changed(lambda b:b['network']['branches'][0]['rateSet'].__setitem__(idx,12345.))
    def test_11_all_winding_ratings_and_taps(self):
        b=three_winding()
        for w in ('winding1','winding2','winding3'):
            for key in ('ratioPu','angleDeg'):
                c=copy.deepcopy(b);c['network']['transformers'][0][w][key]+=1
                self.assertFalse(ModelValidator().compare_networks(w,b,c)['all_passed'])
            for i in range(12):
                c=copy.deepcopy(b);c['network']['transformers'][0][w]['rateSet'][i]+=99
                self.assertFalse(ModelValidator().compare_networks(w,b,c)['all_passed'])
    def test_12_load_zip_all_components(self):
        for field in ('pMw','qMvar','pCurrentMw','qCurrentMvar','pAdmittanceMw','qAdmittanceMvar'):
            self.changed(lambda b:b['network']['loads'][0].__setitem__(field,12345.))
        self.b['network']['loads'][0]['pCurrentMw']=1;self.blocked(self.b)
    def test_13_generator_fields(self):
        for field in ('mbaseMva','pMinMw','pMaxMw','qMinMvar','qMaxMvar','vsPu','remoteBus','zrPu','zxPu'):
            self.changed(lambda b:b['network']['generators'][0].__setitem__(field,12345.))
    def test_14_nonfinite_and_none_are_distinct(self):
        for bad in (None,float('nan'),float('inf'),float('-inf')):
            self.changed(lambda b:b['network']['generators'][0].__setitem__('mbaseMva',bad))
        self.b['network']['generators'][0]['mbaseMva']=float('nan');self.blocked(self.b)
    def test_15_shunt_blocks(self):
        self.changed(lambda b:b['network']['switchedShunts'][0]['blocks'][0].update(numSteps=999))
        self.b['network']['switchedShunts'][0]['blocks'][0]['numSteps']=-1;self.blocked(self.b)
    def test_16_unsupported_physics_classes(self):
        for cls in ('TwoTerminalDcLine','VscDcLine','MultiTerminalDcLine','FactsDevice','InductionMachine','VoltageDroopControl','ImpedanceCorrectionTable'):
            b=copy.deepcopy(self.b);b['metadata']['unsupportedEquipment']=[{'sourceClass':cls,'count':1}];self.blocked(b)
    def test_17_reporting_metadata_is_distinguished(self):
        self.b['metadata']['unsupportedEquipment']=[{'sourceClass':'InterAreaTransfer','count':1}]
        self.assertEqual(project(self.b)['capabilities']['powerFlow']['state'],'PARTIAL')
    def test_18_nodes_are_not_invented_solver_buses(self):
        self.b['network']['substations']=[{'subNumber':1}]
        self.b['network']['substationNodes']=[{'subNumber':1,'nodeNumber':1,'electricalBus':1,'inService':True}]
        n=project(self.b);self.assertEqual(len(n['buses']),3);self.assertEqual(n['capabilities']['powerFlow']['state'],'BLOCKED')
        self.assertTrue(any('NODE_BREAKER_UNPROVEN' in r for r in n['warnings']))
    def test_19_switch_terminals_and_status(self):
        self.b['network']['substationSwitches']=[{'subNumber':1,'fromNode':1,'toNode':2,'circuitId':'S','isClosed':True}];self.blocked(self.b)
        self.changed(lambda b:b['network']['substationSwitches'][0].update(isClosed=False))
    def test_20_no_iec_readiness_from_sequence_boolean(self):
        self.b['network']['hasSequenceData']=True
        self.assertEqual(project(self.b)['capabilities']['shortCircuit3Phase']['state'],'BLOCKED')
    def test_21_unknown_solution_is_not_ready(self): self.assertEqual(project(self.b)['capabilities']['powerFlow']['state'],'PARTIAL')
    def test_22_two_winding_primitive_ybus(self):
        t=self.b['network']['transformers'][0];n=project(self.b);e=n['transformers'][0]
        z=complex(t['impedance']['r12Pu'],t['impedance']['x12Pu']);y=1/z
        t1=t['winding1']['ratioPu']*cmath.exp(1j*math.radians(t['winding1']['angleDeg']))
        t2=t['winding2']['ratioPu']*cmath.exp(1j*math.radians(t['winding2']['angleDeg']))
        source=(y/abs(t1)**2,-y/(t1.conjugate()*t2),-y/(t2.conjugate()*t1),y/abs(t2)**2)
        yy=1/complex(e['rPu'],e['xPu']);tap=e['tap']*cmath.exp(1j*e['phase'])
        target=(yy/abs(tap)**2,-yy/tap.conjugate(),-yy/tap,yy)
        for a,b in zip(source,target):self.assertAlmostEqual(abs(a-b),0.,places=12)
    def test_23_three_winding_star_pairs(self):
        b=three_winding();n=project(b);legs=[complex(e['rPu'],e['xPu']) for e in n['transformers']]
        self.assertEqual(len(legs),3);self.assertEqual(len(n['buses']),4)
        for (i,j),p in zip(((0,1),(1,2),(2,0)),('12','23','31')):
            z=complex(b['network']['transformers'][0]['impedance']['r'+p+'Pu'],b['network']['transformers'][0]['impedance']['x'+p+'Pu'])
            self.assertAlmostEqual(abs(legs[i]+legs[j]-z),0.,places=12)
    def test_24_cz_conversion_exactly_once(self):
        self.assertEqual(transformer_impedance(.01,.1,50.,1,100.),(.01,.1))
        self.assertEqual(transformer_impedance(.01,.1,50.,2,100.),(.02,.2))
        r,x=transformer_impedance(50000.,.1,50.,3,100.);self.assertAlmostEqual(r,.002);self.assertAlmostEqual(x,math.sqrt(.1**2-.001**2)*2)
        with self.assertRaises(ValueError):transformer_impedance(1e9,.001,1.,3,100.)
    def test_25_cw_three_encodings(self):
        self.assertAlmostEqual(winding_ratio(1.05,220,110,1),1.05)
        self.assertAlmostEqual(winding_ratio(115.5,110,110,2),1.05)
        self.assertAlmostEqual(winding_ratio(1.05,220,110,3),2.1)
        with self.assertRaises(ValueError):winding_ratio(1.,110,0.,2)
    def test_26_magnetizing_and_terminal_shunts_once(self):
        n=project(self.b);mag=[x for x in n['shunts'] if x['sourceClass']=='TransformerMagnetizingShunt'];self.assertEqual(len(mag),1)
        self.assertAlmostEqual(mag[0]['bPu'],-.002)
        self.assertEqual(len([x for x in n['shunts'] if x['sourceClass']=='LineTerminalShunt']),2)
        self.assertEqual(magnetizing_admittance(.001,-.002,1,100,100),(.001,-.002))
        g,b=magnetizing_admittance(1000.,.02,2,50.,100.,220.,110.)
        self.assertAlmostEqual(g,.0000025)
        self.assertAlmostEqual(b,-math.sqrt(.01**2-.00001**2)*.25)
    def test_27_no_voltage_or_base_fallback(self):
        self.b['network']['buses'][1]['baskv']=None;self.blocked(self.b)
        self.assertNotIn('bus_2',{b['id'] for b in project(self.b)['buses']})
        self.b['caseIdentification']['sbaseMva']=None;self.blocked(self.b)
    def test_28_source_refs_are_arrays(self):
        n=project(self.b)
        for table in ('buses','lines','transformers','loads','generators','shunts'):
            for row in n[table]:
                for refs in row['sourceRefs'].values():
                    self.assertIsInstance(refs,list)
                    for ref in refs:self.assertTrue({'sourceClass','sourceId','field'}<=ref.keys())
    def test_29_negative_taps_do_not_fallback(self):
        self.b['network']['transformers'][0]['winding2']['ratioPu']=0;self.blocked(self.b)
        self.assertFalse(project(self.b)['transformers'])
    def test_30_plain_synthetic_parity_passes(self):
        self.assertTrue(ModelValidator().compare_networks('synthetic',self.b,copy.deepcopy(self.b))['all_passed'])
    def test_31_rawx_parser_solution_and_schema(self):
        import jsonschema
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'synthetic.rawx';p.write_text(json.dumps(rawx()),encoding='utf-8');b=RawxParser(str(p)).to_bridge_dict()
        self.assertFalse(b['caseIdentification']['solutionStatus']['isSolved'])
        jsonschema.Draft202012Validator(json.loads((ROOT/'schemas/ga-psse-bridge-v1.schema.json').read_text())).validate(b)
        self.assertEqual(len(b['network']['buses']),2)
    def test_32_raw_missing_columns_rejected(self):
        data=rawx();data['network']['generator']['data'][0][9]=None
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'bad.rawx';p.write_text(json.dumps(data))
            with self.assertRaises(ValueError):RawxParser(str(p)).to_bridge_dict()
    def test_33_raw_truncation_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'bad.raw';p.write_text('0,100,36,0,0,50\nTITLE\n\n1,BUS\nQ\n')
            with self.assertRaises(ValueError):RawParser(str(p)).to_bridge_dict()
    def test_34_raw_numeric_name_and_empty_title(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'synth.raw';p.write_text(raw());b=RawParser(str(p)).to_bridge_dict()
        self.assertEqual(b['network']['branches'][0]['name'],'123')
        self.assertEqual(b['network']['branches'][0]['meteredBus'],1)
        self.assertEqual(b['network']['branches'][0]['lengthKm'],0.)
        self.assertFalse(b['caseIdentification']['solutionStatus']['isSolved'])
        self.assertEqual(_split_tokens("1,'x,y',,2 / comment"),['1','x,y','','2'])
    def test_35_cli_never_success_on_incomplete_physics(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'case.rawx';p.write_text(json.dumps(rawx()))
            r=subprocess.run([sys.executable,str(ROOT/'psse_convert.py'),'--input',str(p),'--output-dir',str(Path(tmp)/'out')],capture_output=True)
            m=json.loads((Path(tmp)/'out/case/case.manifest.json').read_text())
        self.assertEqual(r.returncode,2);self.assertEqual(m['status'],'PARTIAL');self.assertFalse(m['importAccepted'])
    def test_36_partial_winding_status_blocks(self):
        self.b=three_winding();self.b['network']['transformers'][0]['statusCode']=2;self.blocked(self.b)
    def test_37_slack_injection_is_counted_once(self):
        n=project(self.b)
        self.assertAlmostEqual(sum(g['pMw'] for g in n['generators']+n['externalGrids']),50.)
        self.assertAlmostEqual(sum(g['qMvar'] for g in n['generators']+n['externalGrids']),20.)
    def test_38_hash_tracks_electrical_edits_not_export_time(self):
        original=project(self.b)['modelHash']
        self.b['metadata']['timestampUtc']='2099-01-01T00:00:00Z'
        self.assertEqual(project(self.b)['modelHash'],original)
        self.b['network']['loads'][0]['pMw']+=1
        self.assertNotEqual(project(self.b)['modelHash'],original)
    def test_39_invalid_numbers_remain_distinct_in_json_evidence(self):
        from ga_psse_sdk.serialization import json_safe
        value=json.loads(json.dumps(json_safe([None,float('nan'),float('inf'),float('-inf')]),allow_nan=False))
        self.assertIsNone(value[0]);self.assertEqual(value[1]['numericState'],'NaN')
        self.assertEqual(value[2]['numericState'],'+Infinity');self.assertEqual(value[3]['numericState'],'-Infinity')


if __name__=='__main__':unittest.main()
