"""Compare two ga-sld-v1 dumps (original vs. PSS(R)E-saved rebuilt file). Usage: sld_compare.py a.json b.json"""
import json, sys
from collections import Counter
a = json.load(open(sys.argv[1], encoding='utf-8-sig')); b = json.load(open(sys.argv[2], encoding='utf-8-sig'))
def sig(d):
    syms = {}; links = []; labels = []
    for e in d['components']:
        if e['t'] == 'Symbol':
            syms[(e.get('map'), tuple(e['pos']))] = (e.get('stype'), e.get('sdef'), round(e.get('rot') or 0, 3), e.get('len') and round(e['len'], 3), e['layer'], e.get('color'))
        elif e['t'] == 'Label':
            labels.append((e.get('text'), tuple(e['pos']), e['layer']))
    idmap = {e['id']: (e.get('map'), tuple(e['pos'])) for e in d['components'] if e['t'] == 'Symbol'}
    for e in d['components']:
        if e['t'] == 'Link' and e.get('p1') and e.get('p2'):
            links.append(tuple(sorted([(idmap.get(e['p1']['sym']), tuple(e['p1']['pos'])), (idmap.get(e['p2']['sym']), tuple(e['p2']['pos']))], key=str)) + (len(e.get('knees') or []),))
    return syms, Counter(links), Counter(labels)
sa, la, ba = sig(a); sb, lb, bb = sig(b)
print('stats a', a['stats']); print('stats b', b['stats'])
print('symbols  : a=%d b=%d  same-key=%d  attr-equal=%d' % (len(sa), len(sb), len(set(sa) & set(sb)), sum(1 for k in sa if k in sb and sa[k] == sb[k])))
print('links    : a=%d b=%d  common=%d' % (sum(la.values()), sum(lb.values()), sum((la & lb).values())))
print('labels   : a=%d b=%d  common=%d' % (sum(ba.values()), sum(bb.values()), sum((ba & bb).values())))
miss = [k for k in sa if k not in sb][:5]; print('sample symbols missing in b:', miss)
print('layers equal:', [(l['n'], l['desc']) for l in a['layers']] == [(l['n'], l['desc']) for l in b['layers']])

