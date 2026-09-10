"""
Modelo unificado de Findings (SecureScan Pro).

Problema que resuelve: cada familia de scan (web/code/osint) guarda sus
resultados en una forma distinta (vulnerabilities[] vs gitleaks.findings[]
vs breaches[]). Antes de este módulo, comparison.py tenía 3 extractores
separados con lógica de fingerprint duplicada, y ni scoring.py ni
reporter.py podían recorrer "todos los hallazgos de un scan" de forma
genérica.

Este módulo NO reemplaza los campos existentes en el dict de scan (no
rompe nada que ya lea directamente 'vulnerabilities', 'gitleaks', etc.)
-- es una capa de traducción adicional: normalize_findings(scan) produce
una lista de Finding con un schema común, que comparison.py, scoring.py
y reporter.py pueden consumir sin conocer los detalles de cada scanner.

Schema de un Finding (dict, no dataclass a propósito -- json-serializable
directo, igual convención que el resto del proyecto):
    {
        'id':        str,   # fingerprint estable (16 hex, mismo algoritmo que ya usaba comparison.py)
        'tool':      str,   # 'zap' | 'nuclei' | 'gitleaks' | 'semgrep' | 'xposedornot' | ...
        'family':    str,   # 'web' | 'code' | 'osint'
        'title':     str,
        'severity':  str,   # 'critical'|'high'|'medium'|'low'|'info'|'' (vacío si la herramienta no la reporta)
        'target':    str,   # host/URL/archivo/email según corresponda
        'evidence':  str,   # descripción corta o snippet, lo que haya
        'cve':       str,   # '' si no aplica
        'raw':       Any,   # objeto original completo, por si el consumidor necesita más detalle
    }
"""

import hashlib
from typing import Any, Dict, List


def _fp(*parts: str) -> str:
    normalized = '|'.join((p or '').strip().lower() for p in parts)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:16]


def _norm_severity(sev: str) -> str:
    sev = (sev or '').strip().lower()
    return sev if sev in ('critical', 'high', 'medium', 'low', 'info') else (sev or '')


def _finding(fid: str, tool: str, family: str, title: str, severity: str = '',
             target: str = '', evidence: str = '', cve: str = '', raw: Any = None) -> Dict[str, Any]:
    return {
        'id': fid, 'tool': tool, 'family': family, 'title': title or 'Finding',
        'severity': _norm_severity(severity), 'target': target,
        'evidence': evidence, 'cve': cve or '', 'raw': raw,
    }


# ── Web Scan ─────────────────────────────────────────────────────────────────

def _from_web(scan: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    for v in scan.get('vulnerabilities', []) or []:
        out.append(_finding(
            _fp(v.get('tool', 'zap'), v.get('name', ''), v.get('url', '')),
            v.get('tool', 'zap'), 'web', v.get('name', 'Finding'), v.get('severity', ''),
            target=v.get('url', ''), evidence=v.get('description', ''), raw=v,
        ))
    for n in scan.get('nuclei_findings', []) or []:
        out.append(_finding(
            _fp('nuclei', n.get('template', n.get('name', '')), n.get('url', n.get('host', ''))),
            'nuclei', 'web', n.get('name') or n.get('template', 'Finding'), n.get('severity', ''),
            target=n.get('url', n.get('host', '')), raw=n,
        ))
    for e in scan.get('exploits', []) or []:
        out.append(_finding(
            _fp('searchsploit', e.get('title', '')),
            'searchsploit', 'web', e.get('title', 'Exploit'), evidence=e.get('type', ''), raw=e,
        ))
    for m in scan.get('metasploit', []) or []:
        out.append(_finding(
            _fp('metasploit', m.get('module', ''), m.get('host', '')),
            'metasploit', 'web', m.get('title') or m.get('module', 'Finding'), m.get('severity', ''),
            target=m.get('host', ''), raw=m,
        ))
    for s in scan.get('sqli_results', []) or []:
        out.append(_finding(
            _fp('sqlmap', s.get('url', ''), s.get('parameter', '')),
            'sqlmap', 'web', f"SQL Injection: {s.get('parameter', '')}", s.get('severity', 'high'),
            target=s.get('url', ''), raw=s,
        ))
    return out


# ── Code Scan ────────────────────────────────────────────────────────────────

_CODE_TOOLS = ('gitleaks', 'trufflehog', 'backdoors', 'semgrep', 'trivy', 'dependency_check')


def _from_code(scan: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    for tool in _CODE_TOOLS:
        section = scan.get(tool) or {}
        for f in section.get('findings', []) or []:
            title = f.get('rule') or f.get('title') or 'Finding'
            out.append(_finding(
                _fp(tool, title, f.get('file', ''), str(f.get('line', ''))),
                tool, 'code', title, f.get('severity', ''),
                target=f.get('file', ''),
                evidence=f.get('description') or f.get('message', ''),
                cve=f.get('cve', ''), raw=f,
            ))
    return out


# ── OSINT ────────────────────────────────────────────────────────────────────

def _from_osint(scan: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    for b in scan.get('breaches', []) or []:
        out.append(_finding(
            _fp('breach', b.get('name', b.get('source', ''))),
            'xposedornot', 'osint', b.get('name') or b.get('source', 'Breach'),
            'medium', target=scan.get('email', ''), evidence=b.get('date', ''), raw=b,
        ))
    for r in scan.get('found', []) or []:
        out.append(_finding(
            _fp('username_match', r.get('site', ''), r.get('url', '')),
            'username_search', 'osint', r.get('site', 'Match'),
            target=scan.get('username', ''), evidence=r.get('url', ''), raw=r,
        ))
    for e in scan.get('emails', []) or []:
        out.append(_finding(_fp('harvester_email', e), 'theharvester', 'osint', e, target=scan.get('domain', ''), raw=e))
    for h in scan.get('hosts', []) or []:
        out.append(_finding(_fp('harvester_host', h), 'theharvester', 'osint', h, target=scan.get('domain', ''), raw=h))
    return out


def detect_family(scan: Dict[str, Any]) -> str:
    scan_type = (scan.get('scan_type') or '').strip()
    if scan_type == 'code':
        return 'code'
    if scan_type.startswith('osint'):
        return 'osint'
    return 'web'


def normalize_findings(scan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Punto de entrada único: detecta la familia y devuelve Findings normalizados."""
    family = detect_family(scan)
    if family == 'code':
        return _from_code(scan)
    if family == 'osint':
        return _from_osint(scan)
    return _from_web(scan)


def dedupe_findings(findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deduplicación básica dentro de un mismo scan: si dos herramientas
    distintas reportan el mismo CVE contra el mismo target (ej. Nuclei Y
    ZAP encuentran el mismo CVE en la misma URL), se fusiona en un solo
    Finding con ambas herramientas listadas -- en vez de contarlo dos
    veces en el score o mostrarlo duplicado en el reporte.

    Deliberadamente conservador: solo fusiona por (cve, target) cuando
    AMBOS están presentes -- nunca fusiona por título/nombre solo, para
    no esconder hallazgos legítimamente distintos que casualmente se
    llamen parecido.
    """
    merged: Dict[str, Dict[str, Any]] = {}
    passthrough: List[Dict[str, Any]] = []

    for f in findings:
        if f['cve'] and f['target']:
            key = _fp(f['cve'], f['target'])
            if key in merged:
                existing = merged[key]
                tools = set(existing.get('_merged_tools', [existing['tool']]))
                tools.add(f['tool'])
                existing['_merged_tools'] = sorted(tools)
                existing['tool'] = ' + '.join(sorted(tools))
                # Se conserva la severidad más alta reportada entre las fusionadas.
                sev_order = {'critical': 5, 'high': 4, 'medium': 3, 'low': 2, 'info': 1, '': 0}
                if sev_order.get(f['severity'], 0) > sev_order.get(existing['severity'], 0):
                    existing['severity'] = f['severity']
                continue
            merged[key] = dict(f)
        else:
            passthrough.append(f)

    return list(merged.values()) + passthrough
