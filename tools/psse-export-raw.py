"""Licensed development-only SAV-to-RAW replication, with source/options cache identity."""
from pathlib import Path
import argparse
import hashlib
import json
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('case', type=Path)
parser.add_argument('--version', default='36')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
source = args.case.resolve(strict=True)
sha = lambda data: hashlib.sha256(data).hexdigest()
spec = {'api': 'writerawversion', 'version': args.version, 'out': 0, 'startingState': 'SOURCE_SAVED', 'harnessVersion': 1}
source_hash, options_hash = sha(source.read_bytes()), sha(json.dumps(spec, sort_keys=True).encode())
directory = repo / 'private-re' / 'raw-export' / f'{source_hash}-{options_hash}'
output, evidence = directory / (source.stem + '.raw'), directory / 'export.json'
if evidence.exists() and output.exists():
    record = json.loads(evidence.read_text(encoding='utf-8'))
    if record['output']['sha256'] == sha(output.read_bytes()):
        print(json.dumps({'cache': 'HIT', 'record': str(evidence), **record}))
        sys.exit(0)
directory.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, r'C:\Program Files\PTI\PSSE36\36.5\PSSPY314')
import psse36
import psspy
if psspy.psseinit(20000):
    raise RuntimeError('PSS/E initialization failed')
for name in ['report_output', 'progress_output', 'alert_output', 'prompt_output']:
    getattr(psspy, name)(2, str(directory / (name + '.log')), [0, 0])
load_error = psspy.case(str(source))
if load_error:
    raise RuntimeError(f'Source load failed: {load_error}')
before = {field: psspy.abusint(-1, 2, field) for field in ['NUMBER', 'TYPE']}
error = psspy.writerawversion(args.version, 0, str(output))
if error:
    raise RuntimeError(f'RAW replication failed: {error}')
record = {'schema': 'ga.psse.raw-export.v1', 'source': {'name': source.name, 'sha256': source_hash}, 'spec': spec,
          'optionsHash': options_hash, 'psseVersion': psspy.psseversion(), 'loadError': load_error, 'ierr': error,
          'powerFlowSolves': 0, 'sourceBusCount': len(before['NUMBER'][1][0]),
          'output': {'name': output.name, 'path': str(output), 'sha256': sha(output.read_bytes()), 'bytes': output.stat().st_size}}
evidence.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
(directory / 'loaded-bus-types.json').write_text(json.dumps(before), encoding='utf-8')
psspy.pssehalt_2()
print(json.dumps({'cache': 'MISS', 'record': str(evidence), **record}))
