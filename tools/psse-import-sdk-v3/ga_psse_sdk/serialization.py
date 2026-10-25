"""Strict JSON evidence: distinguish invalid numbers from missing/null data."""
import math


def json_safe(value):
    if isinstance(value, float) and not math.isfinite(value):
        return {"numericState": "NaN" if math.isnan(value) else "+Infinity" if value > 0 else "-Infinity"}
    if isinstance(value, dict): return {str(k): json_safe(v) for k,v in value.items()}
    if isinstance(value, (list, tuple)): return [json_safe(v) for v in value]
    return value
