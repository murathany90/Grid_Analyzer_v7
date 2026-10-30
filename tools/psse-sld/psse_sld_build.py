# Runs INSIDE the licensed PSS(R)E 36.5 GUI.
# Applies "ga-sld-v1" JSON to the ACTIVE diagram using official sliderPy calls:
# - In-place + delta mode (when active document shares component IDs with JSON, e.g. editing an existing .sld)
# - Clean build mode (when GA_CLEAN=True or starting from a blank/template .sld for newly drawn diagrams)
# Uses CreateSymbol for Busbar/Node, CreateBranchSymbol for Branch/Transformer/SwitchingDev,
# and CreateRadialSymbol for Machine/Load/Shunt so CArchive port/link invariants are 100% satisfied.
import sliderPy, json, traceback

SRC = GA_IN      # noqa: F821
RES = GA_OUT     # noqa: F821
CLEAN = bool(globals().get('GA_CLEAN', False))

log = {'mode': 'clean' if CLEAN else 'auto', 'updated': {}, 'created': {}, 'deleted': 0, 'errors': [], 'warnings': []}

def err(where, e):
    if len(log['errors']) < 60:
        log['errors'].append(where + ': ' + str(e)[:160])
    log['created']['err_' + where] = log['created'].get('err_' + where, 0) + 1

def P(x, y):
    p = sliderPy.SldPoint()
    p.Set(float(x), float(y))
    return p

def ok(bucket, k):
    log[bucket][k] = log[bucket].get(k, 0) + 1

conv = {'Busbar': 'SldBusbar', 'Branch': 'SldBranch', 'Node': 'SldNode', 'Radial': 'SldRadial', 'Floater': 'SldFloater'}

def upcast_sym(sym, st=None):
    cv = sym
    try:
        cv = sym.SldSymbol()
    except Exception:
        pass
    if not st:
        try:
            sd = cv.GetSymbolDef()
            st = str(sd.GetType()) if sd is not None else str(cv.GetSymbolType())
        except Exception:
            st = ''
    if st in conv:
        try:
            cv = getattr(cv, conv[st])()
        except Exception:
            pass
    return cv, st

try:
    S = json.load(open(SRC, encoding='utf-8'))
    doc = sliderPy.GetActiveDocument()
    d = doc.GetDiagram()

    # Sync layers
    try:
        lyr = dict((int(n), l) for n, l in d.GetLayers())
        for L in S.get('layers', []):
            l = lyr.get(int(L['n']))
            if l is None and L.get('desc'):
                try:
                    l = d.CreateLayer(str(L['desc']))
                except Exception as ex:
                    err('layerCreate', ex)
                    continue
            if l is not None and L.get('desc') is not None:
                try:
                    l.SetDescription(str(L['desc']))
                except Exception:
                    pass
    except Exception as ex:
        err('layers', ex)

    sdefs = {}
    default_sdef_by_type = {
        'BusNode': 0, 'Node': 0,
        'Busbar': 1, 'Bus': 1,
        'Load': 2,
        'SwitchingDev': 3,
        'Machine': 4, 'Generator': 4,
        'FixedShunt': 5,
        'Transformer': 10,
        'TWTransformer': 11,
        'SwitchedShunt': 13,
        'Branch': 32,
    }
    for item in d.GetSymbolDefs():
        s = item[1] if isinstance(item, tuple) else item
        sid = s.GetIntegerID()
        sdefs[sid] = s
        st = str(s.GetType())
        psse_enum = str(s.GetPsseEnumID())
        default_sdef_by_type.setdefault(st, sid)
        default_sdef_by_type.setdefault(psse_enum, sid)

    def tolayer(c, n):
        if n is None:
            return
        try:
            d.AssignComponentToLayer(c, int(n))
        except Exception:
            pass

    existing = {}
    if CLEAN:
        d.DeleteAllComponents()
    else:
        for c in d.GetComponents():
            try:
                existing[c.GetID()] = c
            except Exception:
                pass

    target_ids = set(e.get('id') for e in S.get('components', []) if e.get('id') is not None)
    overlap = len(target_ids.intersection(existing.keys()))
    use_inplace = (not CLEAN) and (overlap > 0)
    log['mode'] = 'inplace' if use_inplace else 'clean'
    log['overlap'] = overlap

    if not use_inplace and not CLEAN and len(existing) > 0:
        d.DeleteAllComponents()
        existing.clear()

    if use_inplace:
        for cid, c in list(existing.items()):
            if cid not in target_ids:
                t = str(c.GetComponentType())
                if t in ('Symbol', 'Link'):
                    try:
                        d.DeleteComponent(c)
                        log['deleted'] += 1
                        del existing[cid]
                    except Exception as ex:
                        err('del_' + t, ex)
                elif t == 'Label':
                    try:
                        lb = c.SldLabel()
                        if lb.GetOwner() is None:
                            d.DeleteComponent(c)
                            log['deleted'] += 1
                            del existing[cid]
                    except Exception:
                        pass

    comp = {}   # json id -> upcast symbol object
    objs = {}   # json id -> raw SldSymbol / SldComponent

    def apply_sym_props(raw, cv, st, e):
        try:
            cv.SetAutoRotate(False)
        except Exception:
            pass
        if st == 'Busbar':
            min_len = 0.0
            if not use_inplace:
                deg = len(links_by_sym.get(e.get('id'), []))
                min_len = max(2.5, deg * 0.45 + 1.5)
            if e.get('len') is not None or min_len > 0:
                try:
                    cv.SetLength(max(float(e.get('len') or 3.0), min_len))
                except Exception as ex:
                    err('busLen', ex)
            if e.get('width') is not None:
                try:
                    cv.SetWidth(float(e['width']))
                except Exception as ex:
                    err('busWid', ex)
        if e.get('pos'):
            try:
                cv.SetPosition(P(*e['pos']))
            except Exception as ex:
                err('setpos', ex)
        if e.get('rot') is not None:
            try:
                cv.SetRotation(float(e.get('rot') or 0.0))
            except Exception as ex:
                err('setrot', ex)
        if e.get('map') is not None:
            try:
                cv.SetMapString(str(e['map']))
            except Exception as ex:
                err('setmap', ex)
        if e.get('color') is not None:
            try:
                cv.SetColor(int(e['color']))
            except Exception:
                pass
        if e.get('bg') is not None:
            try:
                cv.SetBgColor(int(e['bg']))
            except Exception:
                pass
        tolayer(raw, e.get('layer', 1))

    def resolve_sdef(e, st):
        sdef_id = e.get('sdef')
        if sdef_id in sdefs:
            return int(sdef_id)
        for key in (e.get('psse'), st, 'Busbar'):
            if key in default_sdef_by_type and default_sdef_by_type[key] in sdefs:
                return int(default_sdef_by_type[key])
        return next(iter(sdefs.keys()))

    # Index links by endpoint symbol IDs for new Branch/Radial creation
    links_by_sym = {}
    for e in S.get('components', []):
        if e.get('t') != 'Link':
            continue
        p1, p2 = e.get('p1') or {}, e.get('p2') or {}
        for side, other in ((p1, p2), (p2, p1)):
            sid = side.get('sym')
            if sid is not None:
                links_by_sym.setdefault(sid, []).append((e, side, other))

    handled_links = set()
    used_ports = {}

    def get_bus_or_node_port(other_spec, fallback_pos, layer=1):
        sym_id = other_spec.get('sym') if other_spec else None
        pos = (other_spec.get('pos') if other_spec else None) or fallback_pos
        c = comp.get(sym_id)
        if c is not None:
            used_set = used_ports.setdefault(sym_id, set())
            ports = list(c.GetPorts() or [])
            best_p = None
            best_idx = None
            best_d2 = 1e18
            for idx, p in enumerate(ports):
                if idx in used_set:
                    continue
                try:
                    if p.GetLink() is not None:
                        used_set.add(idx)
                        continue
                    pp = p.GetPosition()
                    d2 = (pp.GetX() - float(pos[0])) ** 2 + (pp.GetY() - float(pos[1])) ** 2
                    if d2 < best_d2:
                        best_d2 = d2
                        best_p = p
                        best_idx = idx
                except Exception:
                    continue
            if best_p is not None:
                used_set.add(best_idx)
                return best_p
        # Create an anchor BusNode at fallback_pos so Branch/Radial port invariant is satisfied
        anchor = d.CreateSymbol(0)
        acv, _ = upcast_sym(anchor, 'Node')
        try:
            acv.SetPosition(P(*pos))
            tolayer(anchor, layer)
        except Exception:
            pass
        return acv.GetClosestUnlinkedPort(P(*pos))

    def style_link(lk, e):
        if lk is None or not e:
            return
        for k in e.get('knees', []) or []:
            try:
                d.CreateKneePoint(P(*k), lk)
            except Exception as ex:
                err('knee', ex)
        for m, key in (('SetColor', 'color'), ('SetLineWidth', 'lwidth')):
            if e.get(key) is not None:
                try:
                    getattr(lk, m)(int(e[key]) if key != 'lwidth' else float(e[key]))
                except Exception:
                    pass
        tolayer(lk, e.get('layer', 2))

    # Pass 1A: All existing symbols (in-place update) + new Busbar / Node symbols
    deferred_symbols = []
    for e in S.get('components', []):
        if e.get('t') != 'Symbol':
            continue
        jid = e.get('id')
        st = e.get('stype') or 'Node'
        if use_inplace and jid in existing:
            try:
                raw = existing[jid]
                cv, st = upcast_sym(raw, st)
                apply_sym_props(raw, cv, st, e)
                comp[jid] = cv
                objs[jid] = raw
                ok('updated', 'symbol/' + str(st))
            except Exception as ex:
                err('sym_upd', ex)
        elif st in ('Busbar', 'Node'):
            try:
                sdef_id = resolve_sdef(e, st)
                raw = d.CreateSymbol(sdef_id)
                cv, st = upcast_sym(raw, st)
                apply_sym_props(raw, cv, st, e)
                comp[jid] = cv
                objs[jid] = raw
                ok('created', 'symbol/' + str(st))
            except Exception as ex:
                err('sym_busnode', ex)
        else:
            deferred_symbols.append(e)

    # Pass 1B: New Branch and Radial symbols (created via CreateBranchSymbol / CreateRadialSymbol)
    for e in deferred_symbols:
        jid = e.get('id')
        st = e.get('stype') or 'Branch'
        pos = e.get('pos') or [0.0, 0.0]
        layer = e.get('layer', 1)
        sdef_id = resolve_sdef(e, st)
        sym_links = links_by_sym.get(jid, [])
        try:
            if st == 'Radial':
                lk_entry = sym_links[0] if sym_links else None
                other_spec = lk_entry[2] if lk_entry else None
                p1 = get_bus_or_node_port(other_spec, [pos[0], pos[1] - 2.0], layer)
                raw = d.CreateRadialSymbol(sdef_id, p1)
                cv, st = upcast_sym(raw, 'Radial')
                apply_sym_props(raw, cv, st, e)
                if lk_entry:
                    handled_links.add(lk_entry[0].get('id'))
                    ports = cv.GetPorts() or []
                    if ports:
                        style_link(ports[0].GetLink(), lk_entry[0])
                        ok('created', 'link')
                comp[jid] = cv
                objs[jid] = raw
                ok('created', 'symbol/Radial')
            else:
                # Sort by port idx if present
                sym_links_sorted = sorted(sym_links, key=lambda x: x[1].get('idx') if x[1].get('idx') is not None else 99)
                lk1 = sym_links_sorted[0] if len(sym_links_sorted) > 0 else None
                lk2 = sym_links_sorted[1] if len(sym_links_sorted) > 1 else None
                p1 = get_bus_or_node_port(lk1[2] if lk1 else None, [pos[0], pos[1] + 2.0], layer)
                p2 = get_bus_or_node_port(lk2[2] if lk2 else None, [pos[0], pos[1] - 2.0], layer)
                raw = d.CreateBranchSymbol(sdef_id, p1, p2)
                cv, st = upcast_sym(raw, 'Branch')
                apply_sym_props(raw, cv, st, e)
                ports = cv.GetPorts() or []
                for idx_l, lk_entry in enumerate((lk1, lk2)):
                    if lk_entry:
                        handled_links.add(lk_entry[0].get('id'))
                        if idx_l < len(ports):
                            style_link(ports[idx_l].GetLink(), lk_entry[0])
                            ok('created', 'link')
                comp[jid] = cv
                objs[jid] = raw
                ok('created', 'symbol/Branch')
        except Exception as ex:
            err('sym_def_' + str(st), ex)

    # Pass 2: Remaining Links (in-place updates or direct Busbar-to-Busbar/Node links)
    def port_for(spec):
        if not spec:
            return None
        c = comp.get(spec.get('sym'))
        if c is None:
            return None
        ports = c.GetPorts() or []
        idx = spec.get('idx')
        if idx is not None and 0 <= int(idx) < len(ports):
            return ports[int(idx)]
        if spec.get('pos'):
            try:
                return c.GetClosestUnlinkedPort(P(*spec['pos']))
            except Exception:
                pass
        for p in ports:
            try:
                if p.GetLink() is None:
                    return p
            except Exception:
                pass
        return ports[0] if ports else None

    for e in S.get('components', []):
        if e.get('t') != 'Link':
            continue
        jid = e.get('id')
        if jid in handled_links:
            continue
        try:
            if use_inplace and jid in existing:
                lk = existing[jid].SldLink()
                if e.get('knees') is not None:
                    try:
                        old_knees = list(lk.GetKneePoints() or [])
                        new_knees = e.get('knees') or []
                        if len(old_knees) == len(new_knees):
                            for kp_obj, kp_xy in zip(old_knees, new_knees):
                                kp_obj.SetPosition(P(*kp_xy))
                        else:
                            for kp_obj in old_knees:
                                try:
                                    d.DeleteComponent(kp_obj)
                                except Exception:
                                    pass
                            for kp_xy in new_knees:
                                d.CreateKneePoint(P(*kp_xy), lk)
                    except Exception as ex:
                        err('knee_upd', ex)
                for m, key in (('SetColor', 'color'), ('SetLineWidth', 'lwidth')):
                    if e.get(key) is not None:
                        try:
                            getattr(lk, m)(int(e[key]) if key != 'lwidth' else float(e[key]))
                        except Exception:
                            pass
                tolayer(existing[jid], e.get('layer', 2))
                ok('updated', 'link')
                continue

            if not e.get('p1') or not e.get('p2'):
                continue
            p1 = port_for(e['p1'])
            p2 = port_for(e['p2'])
            if p1 is None or p2 is None:
                continue
            lk = d.CreateLink(p1, p2, False)
            style_link(lk, e)
            ok('created', 'link')
        except Exception as ex:
            err('link', ex)

    # Pass 3: Labels
    owned = {}
    used = {}
    for jid, raw in objs.items():
        if not (use_inplace and jid in existing):
            try:
                owned[jid] = list(raw.GetOwnedLabels() or [])
            except Exception:
                owned[jid] = []

    for e in S.get('components', []):
        if e.get('t') != 'Label':
            continue
        jid = e.get('id')
        owner_id = e.get('owner')
        try:
            lab = None
            bucket = 'created'
            if use_inplace and jid in existing:
                lab = existing[jid].SldLabel()
                bucket = 'updated'
            elif owner_id in owned and used.get(owner_id, 0) < len(owned[owner_id]):
                idx = used.get(owner_id, 0)
                used[owner_id] = idx + 1
                lab = owned[owner_id][idx]
                try:
                    lab = lab.SldLabel()
                except Exception:
                    pass
                bucket = 'created'
            else:
                lab = d.CreateLabel()
                bucket = 'created'

            for m, key, cast in (
                ('SetText', 'text', str),
                ('SetFontName', 'font', str),
                ('SetFontHeight', 'fh', int),
                ('SetFontWeight', 'fw', int),
                ('SetColor', 'color', int),
            ):
                if e.get(key) is not None:
                    try:
                        getattr(lab, m)(cast(e[key]))
                    except Exception:
                        pass
            try:
                lab.SetAutoPosition(False)
            except Exception:
                pass
            if e.get('pos'):
                try:
                    lab.SetPosition(P(*e['pos']))
                except Exception as ex:
                    err('lblpos', ex)
            if e.get('rot') is not None:
                try:
                    lab.SetRotation(float(e.get('rot') or 0.0))
                except Exception:
                    pass
            if e.get('vis') is not None:
                try:
                    lab.SetVisible(bool(e['vis']))
                except Exception:
                    pass
            tolayer(lab, e.get('layer', 1))
            ok(bucket, 'label')
        except Exception as ex:
            err('label', ex)

    for owner_id, labs in owned.items():
        for l in labs[used.get(owner_id, 0):]:
            try:
                lb = l.SldLabel()
                lb.SetText('')
                lb.SetVisible(False)
            except Exception:
                pass

except Exception:
    log['fatal'] = traceback.format_exc()

json.dump(log, open(RES, 'w', encoding='utf-8'), indent=1)
open(RES + '.done', 'w').write('ok')
