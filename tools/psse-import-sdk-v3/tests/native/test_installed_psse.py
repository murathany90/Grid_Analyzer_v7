"""Explicit Windows/native suite; not collected by the portable test command."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from ga_psse_sdk.caspy_adapter import CaspyAdapter
from ga_psse_sdk.canonical_mapper import map_bridge_to_canonical
from ga_psse_sdk.rawx_parser import RawxParser
from ga_psse_sdk.raw_parser import RawParser
from ga_psse_sdk.validator import ModelValidator
from ga_psse_sdk.official_export import export_case

EXAMPLES=Path(os.environ.get('GA_PSSE_DIR',r'C:\Program Files\PTI\PSSE36\36.5'))/'EXAMPLE'
CONTROL=EXAMPLES.parent/'control1'


class InstalledPsseTests(unittest.TestCase):
    def test_01_savnw_native_counts_and_unknown_solution(self):
        b=CaspyAdapter(str(EXAMPLES/'savnw.sav')).to_bridge_dict()
        self.assertEqual(len(b['network']['buses']),23)
        self.assertEqual(len(b['network']['branches']),23)
        self.assertEqual(len(b['network']['transformers']),11)
        self.assertFalse(b['caseIdentification']['solutionStatus']['isSolved'])
        self.assertEqual(b['caseIdentification']['solutionStatus']['state'],'UNKNOWN')
    def test_02_shunt_native_pu_to_mvar(self):
        a=CaspyAdapter(str(EXAMPLES/'sample.sav'));b=a.to_bridge_dict();source=a.case.psswsh
        for i,row in enumerate(b['network']['switchedShunts']):
            self.assertAlmostEqual(row['bInitMvar'],source['BINIT'][i]*b['caseIdentification']['sbaseMva'])
    def test_03_controls_and_second_rating_native(self):
        a=CaspyAdapter(str(EXAMPLES/'savnw.sav'));rows=a.get_transformers()
        for i,row in enumerate(rows):
            self.assertEqual(row['controlMode'],a.case.castrn['CNTL'][i][0])
            source=a.case.castrn['RATINGS'][i][1]
            # In 2W native cases a scalar 0 marks an inapplicable second rating block.
            self.assertEqual(row['winding2']['rateSet'],source if isinstance(source,(list,tuple)) else [0.]*12)
    def test_04_node_breaker_native_is_blocked(self):
        b=CaspyAdapter(str(EXAMPLES/'sample_nb.sav')).to_bridge_dict()
        self.assertGreater(len(b['network']['substationNodes']),0)
        n=map_bridge_to_canonical(b)
        self.assertEqual(n['capabilities']['powerFlow']['state'],'BLOCKED')
        self.assertFalse(any(x['id'].startswith('node_') for x in n['buses']))
    def test_05_required_real_saved_cases_extract(self):
        for stem in ('savnw','sample','sample_nb','savnw_nb','sample_zils_nb','bench','fault_calc_3wdg_auto_neutral_current','iec60909_testnetwork_50Hz'):
            with self.subTest(case=stem):
                b=CaspyAdapter(str(EXAMPLES/(stem+'.sav'))).to_bridge_dict()
                self.assertGreater(len(b['network']['buses']),0)
                json.dumps(b,allow_nan=False)
    def test_06_small_case_official_reference(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=export_case(str(EXAMPLES/'savnw.sav'),tmp)
            self.assertTrue(out['ok'],out)
            ref=RawxParser(str(Path(tmp)/'savnw.rawx')).to_bridge_dict()
            b=CaspyAdapter(str(EXAMPLES/'savnw.sav')).to_bridge_dict()
            # Official writer rounds dispatch to 0.001 MW/MVAr; native is float32.
            result=ModelValidator(tolerance=.001).compare_networks('native-official',ref,b)
            self.assertTrue(result['all_passed'],result['failure_reasons'])
    def test_07_control1_sav_and_raw_real(self):
        sav=next(CONTROL.glob('*.sav'));raw=sav.with_suffix('.raw')
        a=CaspyAdapter(str(sav)).to_bridge_dict();b=RawParser(str(raw)).to_bridge_dict()
        self.assertEqual(len(a['network']['generators']),len(b['network']['generators']))
        self.assertGreater(len(a['network']['buses']),6000)
        for source in (a,b):
            n=map_bridge_to_canonical(source)
            self.assertNotEqual(n['capabilities']['powerFlow']['state'],'READY')
            self.assertEqual(n['capabilities']['shortCircuit3Phase']['state'],'BLOCKED')
    def test_08_unverified_native_writers_are_rejected(self):
        a=CaspyAdapter(str(EXAMPLES/'savnw.sav'))
        with self.assertRaises(NotImplementedError):a.to_rawx_dict()
        with self.assertRaises(NotImplementedError):a.to_raw_string()


if __name__=='__main__':unittest.main()
