"""
Dependency Vulnerability Scanner
Lee los manifiestos de dependencias del proyecto (package.json,
requirements.txt, composer.json) y consulta cada paquete contra OSV.dev
— tercera pieza del motor de análisis de código ("Análisis de Código",
Grupo 3).

OSV (Open Source Vulnerabilities, mantenido por Google/OpenSSF) es una
base de datos pública de vulnerabilidades por paquete+versión, con API
gratuita y sin necesidad de API key -- mismo espíritu que crt.sh o
InternetDB en el grupo de Huella Digital.

No resuelve el árbol de dependencias transitivas completo (eso
requeriría instalar cada gestor de paquetes) -- solo consulta las
dependencias declaradas directamente en el manifiesto, lo cual ya cubre
la gran mayoría de los casos de interés en una revisión rápida.
"""

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

_OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch'
_BATCH_SIZE = 100  # límite práctico por request a la API


def _parse_package_json(path: Path) -> List[Tuple[str, str]]:
    """Devuelve [(nombre, versión), ...] de dependencies + devDependencies."""
    try:
        data = json.loads(path.read_text(encoding='utf-8', errors='ignore'))
    except (ValueError, OSError):
        return []
    deps = {}
    deps.update(data.get('dependencies', {}) or {})
    deps.update(data.get('devDependencies', {}) or {})
    out = []
    for name, version_spec in deps.items():
        version = re.sub(r'^[\^~>=<\s]+', '', str(version_spec))  # quitar ^, ~, >=, etc.
        if version and version[0].isdigit():
            out.append((name, version))
    return out


def _parse_requirements_txt(path: Path) -> List[Tuple[str, str]]:
    """Devuelve [(nombre, versión), ...] de un requirements.txt (solo pins exactos con ==)."""
    out = []
    try:
        for line in path.read_text(encoding='utf-8', errors='ignore').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('-'):
                continue
            match = re.match(r'^([A-Za-z0-9_.\-]+)\s*==\s*([A-Za-z0-9_.\-]+)', line)
            if match:
                out.append((match.group(1), match.group(2)))
    except OSError:
        pass
    return out


def _parse_composer_json(path: Path) -> List[Tuple[str, str]]:
    try:
        data = json.loads(path.read_text(encoding='utf-8', errors='ignore'))
    except (ValueError, OSError):
        return []
    deps = data.get('require', {}) or {}
    out = []
    for name, version_spec in deps.items():
        if name == 'php':  # no es un paquete de Packagist, es la versión del intérprete
            continue
        version = re.sub(r'^[\^~>=<\s]+', '', str(version_spec))
        if version and version[0].isdigit():
            out.append((name, version))
    return out


# (nombre de archivo, parser, ecosistema OSV)
_MANIFESTS = [
    ('package.json',      _parse_package_json,      'npm'),
    ('requirements.txt',  _parse_requirements_txt,  'PyPI'),
    ('composer.json',     _parse_composer_json,     'Packagist'),
]


class DependencyScanner:
    """Consulta OSV.dev por vulnerabilidades conocidas en las dependencias declaradas del proyecto."""

    def __init__(self, timeout: int = 20):
        self.timeout = timeout

    def _find_manifests(self, root: Path) -> List[Tuple[Path, Any, str]]:
        found = []
        for filename, parser, ecosystem in _MANIFESTS:
            # Busca en la raíz y un nivel de subcarpetas (monorepos simples,
            # ej. /backend/requirements.txt, /frontend/package.json)
            for path in list(root.glob(filename)) + list(root.glob(f'*/{filename}')):
                if 'node_modules' in path.parts or 'vendor' in path.parts:
                    continue
                found.append((path, parser, ecosystem))
        return found

    def _query_osv_batch(self, packages: List[Tuple[str, str, str]]) -> Dict[Tuple[str, str], List[Dict]]:
        """packages: [(nombre, versión, ecosistema), ...]. Devuelve {(nombre,versión): [vulns]}."""
        if not packages:
            return {}

        queries = [
            {'package': {'name': name, 'ecosystem': eco}, 'version': version}
            for name, version, eco in packages
        ]

        results: Dict[Tuple[str, str], List[Dict]] = {}
        for i in range(0, len(queries), _BATCH_SIZE):
            batch = queries[i:i + _BATCH_SIZE]
            batch_packages = packages[i:i + _BATCH_SIZE]
            try:
                resp = requests.post(_OSV_BATCH_URL, json={'queries': batch}, timeout=self.timeout)
                resp.raise_for_status()
                data = resp.json()
            except requests.RequestException as e:
                logger.warning("DependencyScanner: error consultando OSV.dev — %s", e)
                continue
            except ValueError as e:
                logger.warning("DependencyScanner: respuesta no-JSON de OSV.dev — %s", e)
                continue

            for (name, version, _eco), result in zip(batch_packages, data.get('results', [])):
                vulns = result.get('vulns', [])
                if vulns:
                    results[(name, version)] = vulns
        return results

    def scan(self, root_path: str) -> Dict[str, Any]:
        """
        Busca manifiestos de dependencias en `root_path` y consulta cada
        paquete contra OSV.dev.

        Returns:
            Dict con: findings (lista de {package, version, ecosystem,
            vuln_id, summary, severity}), manifests_found, packages_checked, error.
        """
        root = Path(root_path)
        if not root.exists() or not root.is_dir():
            return {'findings': [], 'manifests_found': [], 'packages_checked': 0, 'error': f'Directorio no encontrado: {root_path}'}

        manifests = self._find_manifests(root)
        if not manifests:
            return {'findings': [], 'manifests_found': [], 'packages_checked': 0, 'error': None}

        all_packages: List[Tuple[str, str, str]] = []
        manifest_names = []
        for path, parser, ecosystem in manifests:
            pkgs = parser(path)
            manifest_names.append(str(path.relative_to(root)))
            for name, version in pkgs:
                all_packages.append((name, version, ecosystem))

        # dedupe -- un monorepo puede repetir la misma dependencia en varios manifiestos
        all_packages = sorted(set(all_packages))

        vuln_map = self._query_osv_batch(all_packages)

        findings = []
        for (name, version, ecosystem), vulns in vuln_map.items():
            for vuln in vulns:
                findings.append({
                    'package':   name,
                    'version':   version,
                    'ecosystem': ecosystem,
                    'vuln_id':   vuln.get('id'),
                    'summary':   (vuln.get('summary') or vuln.get('details') or '')[:200],
                    'severity':  self._extract_severity(vuln),
                })

        logger.info("DependencyScanner: %d paquete(s) verificados, %d hallazgo(s) en %s",
                    len(all_packages), len(findings), root_path)

        return {
            'findings':          findings,
            'manifests_found':   manifest_names,
            'packages_checked':  len(all_packages),
            'error':             None,
        }

    def _extract_severity(self, vuln: Dict) -> str:
        """OSV no siempre trae severidad estructurada -- se infiere del campo
        'severity' (CVSS) si está, si no se deja como 'unknown'."""
        severities = vuln.get('severity', [])
        for s in severities:
            score = s.get('score', '')
            if isinstance(score, str) and '/' not in score:
                try:
                    val = float(score)
                    if val >= 9.0:
                        return 'critical'
                    if val >= 7.0:
                        return 'high'
                    if val >= 4.0:
                        return 'medium'
                    return 'low'
                except ValueError:
                    pass
        return 'unknown'
