"""Local PSS(R)E environment bootstrap.

Nothing from the Siemens installation is copied; DLL/PYD files are loaded from the
user's own licensed installation at runtime only.
"""
import ctypes
import os
import sys

DEFAULT_PSSE_DIR = r"C:\Program Files\PTI\PSSE36\36.5"
_DEPS = ["libifcoremd.dll", "libmmd.dll", "svml_dispmd.dll", "ptiutils.dll",
         "ziparchive.dll", "usrcas.dll"]
_done = {}


def psse_dirs(root=None):
    root = root or os.environ.get("GA_PSSE_DIR", DEFAULT_PSSE_DIR)
    pyver = "PSSPY%d%d" % sys.version_info[:2]
    return root, os.path.join(root, "PSSBIN"), os.path.join(root, pyver)


def init_dll_paths(root=None):
    root, binp, pyp = psse_dirs(root)
    if "paths" in _done:
        return root, binp, pyp
    if not os.path.isdir(binp) or not os.path.isdir(pyp):
        raise FileNotFoundError(
            "PSSE install not found: %s (needs PSSBIN and %s for this Python)" % (root, os.path.basename(pyp)))
    _done["dll_handles"] = [os.add_dll_directory(binp), os.add_dll_directory(pyp)]
    os.environ["PATH"] = binp + os.pathsep + os.environ["PATH"]
    for n in _DEPS:
        p = os.path.join(binp, n)
        if os.path.exists(p):
            _done.setdefault("libraries", []).append(ctypes.CDLL(p))
    if pyp not in sys.path:
        sys.path.insert(0, pyp)
    _done["paths"] = True
    return root, binp, pyp


def import_caspy(root=None):
    init_dll_paths(root)
    import caspy
    return caspy


def import_psspy(root=None):
    init_dll_paths(root)
    import psse36  # noqa: F401  (sets up psspy path)
    import psspy
    return psspy
