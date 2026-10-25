"""Real HTTP upload checks; use with the local UI server's QA session file."""
import argparse
import http.cookiejar
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request

ap=argparse.ArgumentParser();ap.add_argument('--session',required=True);ap.add_argument('--directory',default=r'C:\Program Files\PTI\PSSE36\36.5\control1');ap.add_argument('--output',default='evidence/v3_ui_uploads.json');a=ap.parse_args()
s=json.loads(Path(a.session).read_text());jar=http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));opener.open(s['url']).read()
base='http://127.0.0.1:'+str(s['port']);checks=[]
for p in sorted(Path(a.directory).glob('*')):
    if p.suffix.lower() not in ('.sav','.raw','.rawx'):continue
    started=time.monotonic()
    req=urllib.request.Request(base+'/api/upload?name='+urllib.parse.quote(p.name),data=p.read_bytes(),headers={'Content-Type':'application/octet-stream','Origin':base})
    with opener.open(req,timeout=180) as r:data=json.load(r)
    b=data['bridge'];c=data['canonical'];m=data['manifest']
    assert b['network']['buses']
    assert m['importAccepted'] is False and m['status'] in ('PARTIAL','BLOCKED')
    assert c['capabilities']['powerFlow']['state']!='READY'
    assert c['capabilities']['shortCircuit3Phase']['state']=='BLOCKED'
    checks.append({'file':p.name,'engine':m['actualEngine'],'status':m['status'],'accepted':m['importAccepted'],
                   'sourceSha256':b['metadata']['sourceSha256'],'counts':{k:len(v) for k,v in b['network'].items() if isinstance(v,list)},
                   'http':200,'converterExitCode':data['converterExitCode'],'seconds':round(time.monotonic()-started,3)})
Path(a.output).write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
print(f'{len(checks)} real file uploads inspected; false SUCCESS/READY = 0')
