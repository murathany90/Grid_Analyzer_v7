"""PSS/E unit conversions. Bridge impedances are ALWAYS on system MVA base."""
import math


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def transformer_impedance(r, x, winding_mva, cz, system_mva):
    if not all(finite(v) for v in (r, x, system_mva)) or system_mva <= 0:
        raise ValueError("Missing/non-finite transformer impedance or system base")
    if cz == 1:
        return r, x
    if cz not in (2, 3) or not finite(winding_mva) or winding_mva <= 0:
        raise ValueError("Unsupported CZ or invalid winding MVA base")
    scale = system_mva / winding_mva
    if cz == 2:
        return r * scale, x * scale
    r_wdg = r / (winding_mva * 1e6)
    if x < 0 or x * x < r_wdg * r_wdg:
        raise ValueError("CZ=3 impedance magnitude smaller than load-loss resistance")
    return r_wdg * scale, math.sqrt(x * x - r_wdg * r_wdg) * scale


def winding_ratio(windv, nominal_kv, bus_kv, cw):
    if not finite(windv) or windv <= 0:
        raise ValueError("Invalid winding ratio")
    if cw == 1:
        return windv
    if not finite(bus_kv) or bus_kv <= 0:
        raise ValueError("Invalid bus voltage base for CW=2/3")
    if cw == 2:
        return windv / bus_kv
    if cw == 3:
        # NOMV=0 explicitly means the terminal bus base in the PSS/E format.
        return windv * (nominal_kv if nominal_kv else bus_kv) / bus_kv
    raise ValueError("Unsupported transformer CW")


def magnetizing_admittance(mag1, mag2, cm, winding_mva, system_mva, nominal_kv=0, bus_kv=None):
    if cm == 1:
        return mag1, mag2
    if cm != 2 or winding_mva <= 0 or system_mva <= 0:
        raise ValueError("Unsupported CM or magnetizing base")
    g = mag1 / (system_mva * 1e6)
    y = mag2 * winding_mva / system_mva
    if y < 0 or y * y < g * g:
        raise ValueError("Invalid CM=2 no-load loss/exciting current")
    voltage_factor = (bus_kv / nominal_kv) ** 2 if nominal_kv and bus_kv else 1.0
    return g * voltage_factor, -math.sqrt(y * y - g * g) * voltage_factor
