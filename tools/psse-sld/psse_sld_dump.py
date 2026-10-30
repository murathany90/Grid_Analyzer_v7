# Runs INSIDE the licensed PSS(R)E 36.5 GUI (embedded Python, sliderPy). Official API only.
# Dumps the active Slider diagram to "ga-sld-v1" JSON. Params via GA_SLD_OUT env-like globals set by the driver wrapper.
import sliderPy, json, traceback, os, sys
OUT = GA_OUT          # noqa: F821  (injected by wrapper line)
DONE = OUT + '.done'

def g(o, m, default=None):
    try:
        return getattr(o, m)()
    except Exception:
        return default

def pt(p):
    if p is None: return None
    try: return [round(p.GetX(), 6), round(p.GetY(), 6)]
    except Exception: return None

def rect(r):
    if r is None: return None
    try:
        a = r.GetTopLeft(); b = r.GetBottomRight()
        return [round(a.GetX(), 6), round(a.GetY(), 6), round(b.GetX(), 6), round(b.GetY(), 6)]
    except Exception: return None

def ptype(c):
    return str(g(c, 'GetComponentType', ''))

def appdata(c):
    r = g(c, 'GetAppDataStrings', None)
    try: return [str(x) for x in r] if r else []
    except Exception: return []

try:
    doc = sliderPy.GetActiveDocument(); d = doc.GetDiagram()
    res = {'format': 'ga-sld-v1', 'psseVersion': sliderPy.GetAppVersion(), 'fileVersion': str(g(doc, 'GetFileVersion')),
           'title': g(doc, 'GetTitle'), 'path': g(doc, 'GetFilePath'), 'diagramType': str(g(d, 'GetType')), 'name': g(d, 'GetName'),
           'extent': rect(g(d, 'GetExtent')), 'bg': g(d, 'GetBgColor')}
    res['layers'] = []
    for item in d.GetLayers():
        n, l = item[0], item[1]
        res['layers'].append({'n': int(n), 'desc': g(l, 'GetDescription'), 'vis': str(g(l, 'GetVisibility')),
                              'minZ': g(l, 'GetMinZoomLevel'), 'maxZ': g(l, 'GetMaxZoomLevel')})
    sdefs = d.GetSymbolDefs(); sdi = {}
    res['symbolDefs'] = []
    for item in sdefs:
        s = item[1] if isinstance(item, tuple) else item
        sid = g(s, 'GetIntegerID')
        res['symbolDefs'].append({'id': sid, 'desc': g(s, 'GetDescription'), 'psse': str(g(s, 'GetPsseEnumID')), 'type': str(g(s, 'GetType')),
                                  'ports': g(s, 'GetPortCount'), 'labels': g(s, 'GetLabelCount'), 'bbox': rect(g(s, 'GetBoundingBox')),
                                  'scale': g(s, 'GetScaleFactor'), 'custom': g(s, 'IsCustom')})
    comps = d.GetComponents()
    out = []
    portkey = {}   # (symbolId, idx) lookup by position
    syms = {}
    for c in comps:
        t = ptype(c); cid = g(c, 'GetID')
        e = {'id': cid, 't': t, 'layer': g(c, 'GetLayerNumber'), 'map': g(c, 'GetMapString'), 'pos': pt(g(c, 'GetPosition')),
             'rot': g(c, 'GetRotation'), 'color': g(c, 'GetColor'), 'bbox': rect(g(c, 'GetBoundingBox')), 'vis': g(c, 'IsVisible')}
        ad = appdata(c)
        if ad: e['appdata'] = ad
        grp = g(c, 'GetGroup')
        if grp is not None:
            gn = g(grp, 'GetName')
            if gn: e['group'] = gn
        if t == 'Symbol':
            cv = c
            try: cv = c.SldSymbol()
            except Exception: pass
            sd = g(cv, 'GetSymbolDef')
            _st = str(g(sd, 'GetType')) if sd is not None else ''
            for _conv in {'Busbar': 'SldBusbar', 'Branch': 'SldBranch', 'Node': 'SldNode', 'Radial': 'SldRadial', 'Floater': 'SldFloater'}.get(_st, ''),:
                if _conv:
                    try: cv = getattr(cv, _conv)()
                    except Exception: pass
            e['cls'] = type(cv).__name__
            if sd is not None:
                e['sdef'] = g(sd, 'GetIntegerID'); e['sdesc'] = g(sd, 'GetDescription'); e['psse'] = str(g(sd, 'GetPsseEnumID'))
            e['stype'] = str(g(cv, 'GetSymbolType'))
            e['bg'] = g(cv, 'GetBgColor')
            ep = g(cv, 'GetEndPoints')
            if ep:
                try: e['ends'] = [pt(x) for x in ep]
                except Exception: pass
            for m, k in (('GetLength', 'len'), ('GetWidth', 'width'), ('GetFromDirection', 'fromDir'), ('GetToDirection', 'toDir'),
                         ('GetFromLength', 'fromLen'), ('GetToLength', 'toLen'), ('GetFilled', 'filled'), ('GetAutoRotate', 'autoRot')):
                v = g(cv, m)
                if v is not None: e[k] = v if isinstance(v, (int, float, bool)) else str(v)
            ports = g(cv, 'GetPorts') or []
            e['ports'] = []
            for i, p in enumerate(ports):
                lk = g(p, 'GetLink')
                e['ports'].append({'pos': pt(g(p, 'GetPosition')), 'number': g(p, 'GetNumber'), 'link': (g(lk, 'GetID') if lk is not None else None)})
            syms[cid] = e
        elif t == 'Label':
            cv = c
            try: cv = c.SldLabel()
            except Exception: pass
            for m, k in (('GetText', 'text'), ('GetFontName', 'font'), ('GetFontHeight', 'fh'), ('GetFontWeight', 'fw'), ('GetAlignment', 'align'), ('GetLabelPosition', 'lpos')):
                v = g(cv, m)
                if v is not None: e[k] = v if isinstance(v, (int, float, bool)) else str(v)
            ow = g(cv, 'GetOwner')
            if ow is not None: e['owner'] = g(ow, 'GetID')
        elif t == 'Link':
            cv = c
            try: cv = c.SldLink()
            except Exception: pass
            for m, k in (('GetLineStyle', 'lstyle'), ('GetLineWidth', 'lwidth')):
                v = g(cv, m)
                if v is not None: e[k] = v if isinstance(v, (int, float)) else str(v)
            for pm, k in (('GetPort1', 'p1'), ('GetPort2', 'p2')):
                p = g(cv, pm)
                if p is not None:
                    s = g(p, 'GetSymbol')
                    e[k] = {'sym': (g(s, 'GetID') if s is not None else None), 'pos': pt(g(p, 'GetPosition')), 'idx': g(p, 'GetNumber')}
            kp = g(cv, 'GetKneePointPositions')
            if kp:
                try: e['knees'] = [pt(x) for x in kp]
                except Exception: pass
        out.append(e)
    # resolve port index for links
    for e in out:
        if e['t'] == 'Link':
            for k in ('p1', 'p2'):
                pp = e.get(k)
                if pp and pp.get('sym') in syms:
                    for i, sp in enumerate(syms[pp['sym']]['ports']):
                        if sp['pos'] == pp['pos'] and sp.get('link') == e['id']:
                            if pp.get('idx') is None: pp['idx'] = sp.get('number') if sp.get('number') is not None else i
                            break
    res['components'] = out
    try:
        res['savedViews'] = [{'name': g(v, 'GetName'), 'center': pt(g(v, 'GetCenterPoint')), 'zoom': g(v, 'GetZoomLevel')} for v in d.GetSavedViews()]
    except Exception: pass
    from collections import Counter
    res['stats'] = dict(Counter(e['t'] + ('/' + e['psse'] if e.get('psse') else '') for e in out))
    json.dump(res, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    open(DONE, 'w').write('ok ' + str(len(out)))
except Exception:
    open(OUT + '.err', 'w').write(traceback.format_exc())
    open(DONE, 'w').write('error')
