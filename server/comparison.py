"""
Comparación entre escaneos (SecureScan Pro).

Compara dos Jobs ya completados y clasifica sus hallazgos en:
  - nuevos        (aparecen solo en el scan B)
  - resueltos     (aparecían en A, ya no están en B)
  - persistentes  (misma identidad y mismo contenido en A y B)
  - modificados   (misma identidad, contenido distinto -- ej. cambió la
                    severidad o la evidencia del mismo hallazgo)

Reutiliza findings.normalize_findings() como única fuente de verdad para
"qué es un hallazgo" -- antes este módulo tenía sus propios 3 extractores
(web/code/osint) duplicando exactamente la misma lógica que reporter.py
y, ahora, scoring.py necesitan. Un solo lugar, tres consumidores.
"""

import hashlib
from typing import Any, Dict, List

import findings as findings_module


def _content_hash(f: Dict[str, Any]) -> str:
    """Hash del contenido 'mutable' de un finding (lo que cambia si se re-escanea
    lo mismo pero algo se actualizó: severidad o evidencia)."""
    raw = f"{f.get('severity', '')}|{f.get('evidence', '')}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]


def compare_scans(scan_a: Dict[str, Any], scan_b: Dict[str, Any]) -> dict:
    """
    scan_a: escaneo anterior (baseline)
    scan_b: escaneo nuevo
    """
    findings_a = {f['id']: f for f in findings_module.normalize_findings(scan_a)}
    findings_b = {f['id']: f for f in findings_module.normalize_findings(scan_b)}

    ids_a, ids_b = set(findings_a), set(findings_b)

    new_ids        = ids_b - ids_a
    resolved_ids   = ids_a - ids_b
    common_ids     = ids_a & ids_b

    persistent_ids = {i for i in common_ids if _content_hash(findings_a[i]) == _content_hash(findings_b[i])}
    modified_ids   = common_ids - persistent_ids

    def _strip(f: dict) -> dict:
        return {'tool': f['tool'], 'title': f['title'], 'severity': f['severity'], 'raw': f['raw']}

    return {
        'scan_a_id': scan_a.get('id'),
        'scan_b_id': scan_b.get('id'),
        'summary': {
            'new':        len(new_ids),
            'resolved':   len(resolved_ids),
            'persistent': len(persistent_ids),
            'modified':   len(modified_ids),
        },
        'new':        [_strip(findings_b[i]) for i in new_ids],
        'resolved':   [_strip(findings_a[i]) for i in resolved_ids],
        'persistent': [_strip(findings_b[i]) for i in persistent_ids],
        'modified':   [
            {'before': _strip(findings_a[i]), 'after': _strip(findings_b[i])}
            for i in modified_ids
        ],
    }
