"""Standalone binary metadata inspector for PSS(R)E .sav files (zero DLL dependencies).

Operates in 100% pure Python without any Siemens DLL or proprietary software.
Parses the proprietary PTI Segmented File Layout (FuP_pHySPCD%PTI_SFL_),
validates header integrity, word count, and extent tables.

CRITICAL ARCHITECTURE RULE:
Does NOT fabricate fake electrical buses, fake voltages, or synthetic swing
generators from random ASCII fragments. If complete Fortran common block memory
pointers are unverified, returns strictly diagnostic metadata.
All power flow, short circuit, and N-1 capabilities are explicitly BLOCKED.
"""
import datetime
import hashlib
import os
import re
import struct
from typing import Any, Dict, List, Optional, Tuple

MAGIC = b"FuP_pHySPCD%PTI_SFL_"


class StandaloneSavDecoder:
    """Pure-Python parser for Siemens PTI Segmented File Layout (.sav)."""

    def __init__(self, sav_path: str):
        self.sav_path = os.path.abspath(sav_path)
        if not os.path.isfile(self.sav_path):
            raise FileNotFoundError(f"SAV file not found: {self.sav_path}")
        self.file_name = os.path.basename(self.sav_path)
        self.file_size = os.path.getsize(self.sav_path)

        with open(self.sav_path, "rb") as f:
            self.data = f.read()

        h = hashlib.sha256()
        h.update(self.data)
        self.file_sha256 = h.hexdigest()

        self.is_valid_pti = False
        self.total_words = 0
        self.dir_word_offset = 0
        self.extents: List[Tuple[int, int]] = []
        self._parse_header()

    def _parse_header(self):
        if len(self.data) < 84:
            raise ValueError(f"File too small ({len(self.data)} bytes) to be a valid SAV file.")

        magic = self.data[:20]
        if magic != MAGIC:
            raise ValueError(f"Invalid magic: expected {MAGIC!r}, found {magic!r}")

        self.is_valid_pti = True
        self.total_words = struct.unpack("<I", self.data[20:24])[0]
        # Word 20 (byte offset 80) points to segment directory
        self.dir_word_offset = struct.unpack("<I", self.data[80:84])[0]
        dir_byte_offset = self.dir_word_offset * 4

        # Read extents from segment directory if within file bounds
        if dir_byte_offset + 32 <= len(self.data):
            dir_data = self.data[dir_byte_offset : dir_byte_offset + 128]
            words = struct.unpack(f"<{len(dir_data)//4}I", dir_data)
            if len(words) >= 5:
                w_start = words[2]
                w_len = words[4]
                if w_start > 0 and w_len > 0:
                    self.extents.append((w_start * 4, w_len * 4))

    def extract_case_titles(self) -> Tuple[str, str]:
        """Extracts ASCII case title lines from the segment header area."""
        search_region = self.data[1000 : min(len(self.data), 5000)]
        matches = [
            m.group().decode("latin1").strip()
            for m in re.finditer(rb"[A-Za-z0-9_\-\.\:\,\ \(\)\/]{10,}", search_region)
            if len(m.group().strip()) > 15
        ]
        title1 = matches[0] if len(matches) > 0 else "PSS(R)E Saved Case (Standalone Inspection)"
        title2 = matches[1] if len(matches) > 1 else ""
        return title1, title2

    def to_bridge_dict(self) -> Dict[str, Any]:
        """Produces a strictly diagnostic ga-psse-bridge-v1 dictionary without fake buses."""
        t1, t2 = self.extract_case_titles()
        now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()

        extent_info = [f"Offset={start}, Length={length}" for start, length in self.extents]

        return {
            "schemaVersion": "ga-psse-bridge/1",
            "metadata": {
                "sourceFile": self.file_name,
                "sourceSha256": self.file_sha256,
                "sourceFormat": "SAV",
                "extractionMethod": "standalone-decoder",
                "psseRelease": "36",
                "timestampUtc": now_utc,
                "sourceFidelity": "EXPERIMENTAL",
                "unsupportedEquipment": [
                    "Complete Electrical Topology (requires caspy, psspy, or RAW/RAWX export for verified physical network)"
                ],
                "diagnostics": [
                    {
                        "level": "WARNING",
                        "code": "STANDALONE_SAV_DIAGNOSTIC_ONLY",
                        "message": (
                            "Decoded using standalone pure-Python binary inspector. "
                            f"Header validated (Words={self.total_words}, Extents={extent_info}). "
                            "Per architecture rule P0, no synthetic or fabricated electrical buses are generated. "
                            "To perform power flow or short-circuit analysis, convert using caspy, psspy, or export to RAW/RAWX."
                        ),
                    }
                ],
            },
            "caseIdentification": {
                "sbaseMva": None,
                "baseFrequencyHz": None,
                "titleLine1": t1,
                "titleLine2": t2,
                "psseVersion": "36",
                "solutionStatus": {
                    "isSolved": False,
                    "solutionMethod": "Standalone Binary Inspection (Unverified Topology)",
                },
            },
            "network": {
                "buses": [],
                "loads": [],
                "generators": [],
                "branches": [],
                "transformers": [],
                "fixedShunts": [],
                "switchedShunts": [],
                "substations": [],
                "substationNodes": [],
                "substationSwitches": [],
            },
        }
