from pathlib import Path
import json
import openpyxl
import sys
p=Path(sys.argv[1]) if len(sys.argv)>1 else Path('psse_modu/20261014_1200_SN3_TR0_sav_cozumu.xlsx')
w=openpyxl.load_workbook(p,read_only=True,data_only=True)
out={}
for s in w:
 rows=list(s.values)
 out[s.title]={'headers':list(rows[0]),'rows':[list(row) for row in rows[1:] if any(v is not None for v in row)]}
 print(s.title, len(out[s.title]['rows']))
Path('.local').mkdir(exist_ok=True)
Path('.local/native-excel.json').write_text(json.dumps(out,ensure_ascii=False,default=str),encoding='utf-8')
