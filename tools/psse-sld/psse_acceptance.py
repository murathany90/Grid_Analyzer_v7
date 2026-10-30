"""One GUI event-loop step per native document; call again after the queued close."""
import json
from pathlib import Path
import psspy
import sliderPy
root = Path(GA_EVIDENCE)
source = Path(sliderPy.GetActiveDocument().GetFilePath())
name = source.stem
if name not in ['kayseri_endpoint','ankara_endpoint','konya_endpoint','sincan_edited','owner708_edited']:
    raise RuntimeError('Unexpected active document: ' + name)
target = root / (name + '_psse.json')
scope = {'GA_OUT': str(target)}
exec(compile(Path(__file__).with_name('psse_sld_dump.py').read_text(encoding='utf-8'), 'psse_dump', 'exec'), scope)
data = json.loads(target.read_text(encoding='utf-8'))
status_file = root / 'native_gui_results.json'
results = json.loads(status_file.read_text(encoding='utf-8')) if status_file.exists() else []
results = [r for r in results if r['name'] != name]
results.append({'name':name,'activePath':str(source),'counts':data.get('stats'),'ok':bool(data.get('components')) and not data.get('error')})
status_file.write_text(json.dumps(results,indent=2),encoding='utf-8')
psspy.closediagfile()

