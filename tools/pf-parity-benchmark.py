"""Exploratory PF/GA metrics after the TypeScript topology preflight passes.

Usage: python tools/pf-parity-benchmark.py model.zip pf.csv result.json label [control-context.csv]

Each run checks model, study time, source hash and base scenario. The application
preflight separately checks topology and the calculation-settings gate. These
metrics alone do not establish PowerFactory parity.
"""
import csv
import hashlib
import json
import math
import os
import re
import statistics
import sys
import zipfile
from collections import defaultdict


def number(value):
    if value is None or value == '':
        return None
    try:
        result = float(str(value).replace(',', '.'))
        return result if math.isfinite(result) else None
    except ValueError:
        return None


def stats(values):
    if not values:
        return None
    signed = [value[0] - value[1] for value in values]
    absolute = sorted(map(abs, signed))
    at = (len(absolute) - 1) * .95
    lo, hi = math.floor(at), math.ceil(at)
    return {'n': len(signed), 'mae': sum(absolute) / len(absolute),
            'p95': absolute[lo] + (absolute[hi] - absolute[lo]) * (at - lo),
            'max': absolute[-1], 'bias': sum(signed) / len(signed)}


def control_context_stats(path, model_id, expected_time, numeric_path):
    with open(path, encoding='utf-8-sig', newline='') as stream:
        next(stream)
        rows = list(csv.DictReader(stream, delimiter=';'))
    meta = {row['key']: row['value'] for row in rows if row['kind'] == 'meta'}
    assert meta.get('schemaVersion') == 'PF-GA-CONTROL-1.0'
    assert (meta.get('modelId'), meta.get('studyTimeLocal')) == (model_id, expected_time)
    assert re.split(r'[\\/]+', meta.get('numericBenchmarkFile', ''))[-1] == os.path.basename(numeric_path), 'ControlContext numeric benchmark file differs'
    loads = defaultdict(dict)
    for row in rows:
        if row['ownerClass'] == 'ElmLod':
            key = (row['kind'], row['key'])
            assert key not in loads[row['ownerFid']], f'duplicate load field {row["ownerFid"]} {key}'
            assert row['status'] == 'OK', f'load field unavailable {row["ownerFid"]} {key}'
            loads[row['ownerFid']][key] = row['value']
    assert len(loads) == int(meta['summary.elmLodCount'])
    initial_p = final_p = initial_q = final_q = 0.
    ratios = []
    eligible = 0
    for fid, fields in loads.items():
        scale = number(fields[('attribute', 'i_scale')])
        assert scale in (0, 1), f'unknown i_scale {fid}'
        eligible += scale == 1
        p0, p1 = number(fields[('attribute', 'plini')]), number(fields[('result', 'm:P:bus1')])
        q0, q1 = number(fields[('attribute', 'qlini')]), number(fields[('result', 'm:Q:bus1')])
        assert all(value is not None for value in (p0, p1, q0, q1))
        initial_p += p0
        final_p += p1
        initial_q += q0
        final_q += q1
        if abs(p0) > 1e-9:
            ratios.append((p1 - p0) / abs(p0))
    return {'loadCount': len(loads), 'eligibleLoadCount': eligible,
            'initialPMw': initial_p, 'finalPMw': final_p, 'deltaPMw': final_p - initial_p,
            'initialQMvar': initial_q, 'finalQMvar': final_q, 'deltaQMvar': final_q - initial_q,
            'nonzeroLoadPDeltaRatioMedian': statistics.median(ratios) if ratios else None,
            'nonzeroLoadPDeltaRatioRange': [min(ratios), max(ratios)] if ratios else None}


def main(zip_path, pf_path, result_path, label, control_path=None):
    with zipfile.ZipFile(zip_path) as archive:
        entry = next(name for name in archive.namelist() if name.endswith('.json'))
        raw = archive.read(entry)
    model_id = entry.rsplit('/', 1)[-1].removesuffix('.json')
    model_hash = hashlib.sha256(raw).hexdigest()
    expected_time = f'{model_id[:4]}-{model_id[4:6]}-{model_id[6:8]} {model_id[9:11]}:{model_id[11:13]}:00'
    with open(result_path, encoding='utf-8') as stream:
        ga = json.load(stream)
    with open(pf_path, encoding='utf-8-sig', newline='') as stream:
        next(stream)
        rows = list(csv.DictReader(stream, delimiter=';'))
    meta = {r['metaKey']: r['metaValue'] for r in rows if r['kind'] == 'meta'}
    assert (meta.get('modelId'), meta.get('studyCase'), meta.get('studyTimeLocal')) == (model_id, model_id, expected_time), 'model/study/time mismatch'
    assert ga['identity']['modelHash'] == model_hash, 'model SHA-256 mismatch'
    scenario_items = json.loads(ga['identity']['scenarioHash'])
    assert isinstance(scenario_items, list) and all(not value for _, value in scenario_items), 'scenario mismatch'
    result_bus_rows = [r for r in rows if r['kind'] == 'bus' and r['resultAvailable'] == '1']
    grouped = defaultdict(list)
    for row in result_bus_rows:
        if row['electricalBusKey']:
            grouped[row['electricalBusKey']].append(row)
    buses = ga['buses']
    bus_by_alias = {alias: bus for bus in buses for alias in [bus['id'], *bus['terms']]}
    branch_by_fid = {row['id']: row for row in ga['branches']}
    gen_by_fid = {row['id']: row for row in ga['generators']}
    metrics = defaultdict(list)
    bus_matches = 0
    angles_by_island = defaultdict(list)
    conflicts = defaultdict(int)
    for key, physical in grouped.items():
        bus = bus_by_alias.get(key)
        if bus is None:
            continue
        bus_matches += 1
        for field, metric, observed in [('voltagePu', 'bus.voltagePu', bus['vmPu']),
                                         ('voltageKv', 'bus.voltageKv', bus['vmPu'] * bus['vnKv'])]:
            refs = [number(r[field]) for r in physical if number(r[field]) is not None]
            if refs and max(refs) - min(refs) <= (1e-8 if field == 'voltagePu' else 1e-5):
                metrics[metric].append((observed, refs[0]))
            elif refs:
                conflicts[field] += 1
        angles = [number(r['angleDeg']) for r in physical if number(r['angleDeg']) is not None]
        if angles and max(angles) - min(angles) <= 1e-6:
            angles_by_island[bus.get('islandId') or 'unknown'].append((bus, angles[0], any(r['isReferenceBus'] == '1' for r in physical)))
        elif angles:
            conflicts['angleDeg'] += 1
    for group in angles_by_island.values():
        reference = next((pair for pair in group if pair[2]), None)
        offsets = sorted(ref_angle - bus['angleRad'] * 180 / math.pi for bus, ref_angle, _ in group)
        offset = reference[1] - reference[0]['angleRad'] * 180 / math.pi if reference else offsets[len(offsets) // 2]
        for bus, ref_angle, _ in group:
            metrics['bus.alignedAngleDeg'].append((bus['angleRad'] * 180 / math.pi + offset, ref_angle))
    controlled_ids = {uid for row in ga.get('diagnostics', {}).get('stationControllerResults', []) for uid in row.get('unitIds', [])}
    pf_losses = {'p': 0., 'q': 0.}
    ga_losses = {'p': 0., 'q': 0.}
    row_counts = defaultdict(int)
    for ref in rows:
        kind = ref['kind']
        if kind not in ('line', 'transformer', 'generator') or ref['resultAvailable'] != '1':
            continue
        row_counts[kind] += 1
        if kind == 'generator':
            actual = gen_by_fid.get(ref['fid'])
            if actual is None:
                continue
            for metric, ga_key, pf_key in [('pMw', 'pMw', 'pResultMw'), ('qMvar', 'qMvar', 'qResultMvar')]:
                observed, reference = number(actual.get(ga_key)), number(ref[pf_key])
                if observed is not None and reference is not None:
                    metrics[f'generator.{metric}'].append((observed, reference))
                    if metric == 'qMvar' and ref['fid'] in controlled_ids:
                        metrics['controlledGenerator.qMvar'].append((observed, reference))
            continue
        actual = branch_by_fid.get(ref['fid'])
        if actual is None:
            continue
        pairs = [('pFromMw', 'pf', 'pFromMw'), ('qFromMvar', 'qf', 'qFromMvar'),
                 ('pToMw', 'pt', 'pToMw'), ('qToMvar', 'qt', 'qToMvar')]
        if kind == 'transformer':
            pairs = [('pHvMw', 'pf', 'pHvMw'), ('qHvMvar', 'qf', 'qHvMvar'),
                     ('pLvMw', 'pt', 'pLvMw'), ('qLvMvar', 'qt', 'qLvMvar')]
        for metric, ga_key, pf_key in pairs:
            observed, reference = number(actual.get(ga_key)), number(ref[pf_key])
            if observed is not None and reference is not None:
                metrics[f'{kind}.{metric}'].append((observed, reference))
        currents = [('currentHvA', 'ifA', 'iHvA'), ('currentLvA', 'itA', 'iLvA')] if kind == 'transformer' else [('currentFromA', 'ifA', 'iFromA'), ('currentToA', 'itA', 'iToA')]
        for metric, ga_key, pf_key in currents:
            observed, reference = number(actual.get(ga_key)), number(ref[pf_key])
            if observed is not None and reference is not None:
                metrics[f'{kind}.{metric}'].append((observed, reference))
        from_pf = number(ref['ratedCurrentHvA'] if kind == 'transformer' else ref['ratedCurrentFromA'])
        to_pf = number(ref['ratedCurrentLvA'] if kind == 'transformer' else ref['ratedCurrentToA'])
        from_ga, to_ga = number(actual.get('ratedCurrentFromA')), number(actual.get('ratedCurrentToA'))
        pf_loading, pf_derived, ga_loading = number(ref['loadingPercent']), number(ref['loadingCalculatedFromCurrentPercent']), number(actual.get('currentLoadingPercent'))
        if (all(x is not None and x > 0 for x in (from_pf, to_pf, from_ga, to_ga)) and
            abs(from_ga / from_pf - 1) <= .001 and abs(to_ga / to_pf - 1) <= .001 and
            pf_loading is not None and pf_derived is not None and ga_loading is not None and
            abs(pf_loading - pf_derived) <= .1):
            metrics[f'{kind}.verifiedCurrentLoadingPercent'].append((ga_loading, pf_loading))
        for stem in ('p', 'q'):
            pf_value = number(ref['pLossMw' if stem == 'p' else 'qLossMvar'])
            ga_value = number(actual['pLoss' if stem == 'p' else 'qLoss'])
            if pf_value is not None and ga_value is not None:
                pf_losses[stem] += pf_value
                ga_losses[stem] += ga_value
    external = next((r for r in rows if r['kind'] == 'externalGrid' and r['resultAvailable'] == '1'), None)
    ref_fid = meta.get('referenceBusFid')
    ref_bus = bus_by_alias.get(ref_fid)
    grid_results = ga.get('diagnostics', {}).get('externalGridResults')
    external_ga = next((x for x in grid_results if x.get('id') == external['fid']), None) if external and isinstance(grid_results, list) else None
    result = {'label': label, 'context': {'status': 'MODEL_STUDY_TIME_HASH_VERIFIED_TOPOLOGY_PREFLIGHT_SEPARATE',
              'modelId': model_id, 'modelHash': model_hash, 'studyTime': expected_time,
              'pfVersion': meta.get('powerFactoryVersion')},
              'coverage': {'physicalTerminals': sum(r['kind'] == 'bus' for r in rows),
                           'resultPhysicalTerminals': len(result_bus_rows),
                           'uniquePfElectricalBuses': len(grouped), 'matchedGaElectricalBuses': bus_matches,
                           'pfRows': dict(row_counts), 'gaBuses': len(buses), 'gaBranches': len(branch_by_fid), 'gaGenerators': len(gen_by_fid),
                           'excludedConflictedBusGroups': dict(conflicts)},
              'solver': {'status': ga['status'], 'converged': ga['converged'], 'innerIterationsTotal': ga['iterations'],
                         'outerRounds': ga['rounds'], 'maxMismatchMw': ga.get('maxMismatchMw'),
                         'diagnostics': {'stationControllerSummary': ga.get('diagnostics', {}).get('stationControllerSummary'),
                                         'externalGridResults': grid_results}},
              'metrics': {key: stats(value) for key, value in sorted(metrics.items())},
              'systemLosses': {'gaPMw': ga_losses['p'], 'pfPMw': pf_losses['p'], 'deltaPMw': ga_losses['p'] - pf_losses['p'],
                               'gaQMvar': ga_losses['q'], 'pfQMvar': pf_losses['q'], 'deltaQMvar': ga_losses['q'] - pf_losses['q']},
              'externalGrid': {'fid': external['fid'] if external else None,
                               'gaPmw': external_ga.get('pMw') if external_ga else None,
                               'pfPmw': number(external['pResultMw']) if external else None,
                               'gaQMvar': external_ga.get('qMvar') if external_ga else None,
                               'pfQMvar': number(external['qResultMvar']) if external else None,
                               'gaReferenceVoltagePu': ref_bus['vmPu'] if ref_bus else None,
                               'pfReferenceVoltagePu': next((number(r['voltagePu']) for r in result_bus_rows if r['fid'] == ref_fid), None)} }
    if control_path:
        pf_loads = control_context_stats(control_path, model_id, expected_time, pf_path)
        islands = ga.get('diagnostics', {}).get('activeBalancing', {}).get('islands', [])
        ga_delta = sum(row.get('loadAdjustmentMw', 0) for island in islands for row in island.get('adjustments', []))
        result['loadBalancing'] = {'powerFactory': pf_loads, 'gridAnalyzerDeltaPMw': ga_delta,
                                   'deltaVsPowerFactoryMw': ga_delta - pf_loads['deltaPMw'],
                                   'activeBalanceFidelity': ga.get('diagnostics', {}).get('activeBalancing', {}).get('activeBalanceFidelity')}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main(*sys.argv[1:6])
