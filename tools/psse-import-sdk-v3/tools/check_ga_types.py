"""Prepare a strict typecheck against the real GA checkout without editing it."""
import argparse
import os
from pathlib import Path

ap=argparse.ArgumentParser();ap.add_argument('--ga-root',required=True);a=ap.parse_args()
root=Path(__file__).resolve().parents[1];out=root/'runtime';out.mkdir(exist_ok=True)
target=Path(a.ga_root).resolve()/'src/domain/model/network'
if not target.with_suffix('.ts').is_file():raise FileNotFoundError(target)
relative=os.path.relpath(target,out).replace('\\','/')
if not relative.startswith('.'):relative='./'+relative
source=(root/'integration/canonical-guard.ts').read_text(encoding='utf-8').replace("'./ga-network-types'",repr(relative))
(out/'canonical-guard.native.ts').write_text(source,encoding='utf-8')
print('Prepared',out/'canonical-guard.native.ts')
