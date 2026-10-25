"""Package only tracked SDK files, explicit Git evidence and local UI proof."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);a=ap.parse_args()
root=Path(__file__).resolve().parents[1]
selected=set(subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().strip('\0').split('\0'))
extras=['DELIVERY_GIT.json','patches/psse_fidelity_v3.patch','SDK_HISTORY.bundle','evidence/ui/control1_sav_summary.png']
for name in extras:
    if not (root/name).is_file():raise FileNotFoundError(name)
    selected.add(name)
for name in selected:
    p=Path(name)
    if p.suffix.lower() in {'.dll','.pyd','.so','.dylib','.exe','.sav','.raw','.rawx','.seq','.lic','.key'}:
        raise ValueError('Prohibited package file: '+name)
    if any(x in p.parts for x in ('.git','__pycache__','node_modules','runtime','fixtures','caspy')):
        raise ValueError('Prohibited package directory: '+name)
data={name:(root/name).read_bytes() for name in sorted(selected)}
manifest=''.join(hashlib.sha256(content).hexdigest()+'  '+name+'\n' for name,content in data.items())
data['SHA256SUMS.txt']=manifest.encode()
output=Path(a.output);output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name,content in data.items():z.writestr('GA_PSSE_IMPORT_SDK_V3_FIXED/'+name,content)
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None
    for name,content in data.items():assert z.read('GA_PSSE_IMPORT_SDK_V3_FIXED/'+name)==content
summary={'zip':str(output),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'files':len(data),
         'prohibited_binaries_or_models':0,'crc_and_content_check':'PASS'}
output.with_suffix('.sha256').write_text(summary['sha256']+'  '+output.name+'\n',encoding='ascii')
print(json.dumps(summary,indent=2))
