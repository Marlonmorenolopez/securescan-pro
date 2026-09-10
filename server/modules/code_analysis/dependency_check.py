"""
OWASP Dependency-Check Scanner (real)
Corre el binario real de OWASP Dependency-Check vía subprocess —
dependencias vulnerables, tercera fuente del Grupo 3 junto a Trivy
(OSV.dev ya no se usa, quedó reemplazado por estos dos).

ADVERTENCIA OPERATIVA IMPORTANTE, confirmada probando el binario real:
Dependency-Check necesita una base de datos NVD poblada para funcionar
-- ejecutarlo sin ella falla directo con "Autoupdate is disabled and the
database does not exist", incluso con --noupdate. La sincronización
inicial de esa base es lenta (puede tardar bastante) y sin una NVD API
Key (gratis, se pide en https://nvd.nist.gov/developers/request-an-api-key)
el rate limit de la API pública de NVD la hace todavía más lenta. Con
key configurada (NVD_API_KEY) es sensiblemente más rápido.

En la práctica: como Trivy YA cubre dependencias vulnerables (y es más
liviano, sin esta fricción de base de datos), Dependency-Check acá es
una SEGUNDA fuente para contrastar -- no la única. Si el tiempo de
arranque/sincronización no vale la pena para el proyecto, se puede
desactivar sin perder cobertura real (dependency_scanner.py + Trivy
siguen cubriendo el caso de uso principal).
"""

import json
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_BIN = 'dependency-check.sh'


class DependencyCheckScanner:
    """Wrapper del binario real de OWASP Dependency-Check."""

    def __init__(self, timeout: int = 300, nvd_api_key: Optional[str] = None):
        self.timeout     = timeout
        self.nvd_api_key = nvd_api_key or os.getenv('NVD_API_KEY')
        self.available   = shutil.which(_BIN) is not None
        if not self.available:
            logger.warning("Dependency-Check: el binario '%s' no está instalado en el servidor.", _BIN)
        if not self.nvd_api_key:
            logger.info("Dependency-Check: sin NVD_API_KEY configurada -- la sincronización de la base va a ser más lenta.")

    def scan(self, root_path: str) -> Dict[str, Any]:
        """
        Corre Dependency-Check contra `root_path`.

        Returns:
            Dict con: findings (lista con file, package, vuln_id,
            severity, description), error.
        """
        root = Path(root_path)
        if not root.exists() or not root.is_dir():
            return {'findings': [], 'error': f'Directorio no encontrado: {root_path}'}

        if not self.available:
            return {'findings': [], 'error': 'Dependency-Check no está instalado en el servidor'}

        out_dir = tempfile.mkdtemp(prefix='depcheck-')

        cmd = [
            _BIN,
            '-s', str(root),
            '-f', 'JSON',
            '-o', out_dir,
            '--project', 'securescan-pro',
            '--disableVersionCheck',
            # FIX (prueba real): sin esto, Dependency-Check intenta
            # sincronizar/verificar la base NVD en CADA scan, aunque ya
            # esté horneada en el build (ver Dockerfile). Con datasets
            # grandes eso solo puede comerse buena parte del timeout de
            # 300s, incluso teniendo NVD_API_KEY configurada. Igual patrón
            # que --skip-db-update en Trivy — usa la base ya lista.
            '--noupdate',
        ]
        if self.nvd_api_key:
            cmd += ['--nvdApiKey', self.nvd_api_key]

        try:
            try:
                result = subprocess.run(
                    cmd,
                    stdin=subprocess.DEVNULL,
                    capture_output=True, text=True, timeout=self.timeout,
                )
            except subprocess.TimeoutExpired:
                return {'findings': [], 'error': f'Dependency-Check no terminó en {self.timeout}s (la sincronización de la base NVD puede tardar bastante la primera vez)'}
            except FileNotFoundError:
                return {'findings': [], 'error': 'Dependency-Check no está instalado en el servidor'}

            report_path = Path(out_dir) / 'dependency-check-report.json'
            if not report_path.exists():
                error_msg = (result.stderr or result.stdout or '').strip()[-300:] or 'Dependency-Check no generó reporte'
                logger.warning("Dependency-Check: %s", error_msg)
                return {'findings': [], 'error': error_msg}

            try:
                data = json.loads(report_path.read_text(encoding='utf-8'))
            except ValueError as e:
                return {'findings': [], 'error': f'Error parseando reporte de Dependency-Check: {e}'}

            findings: List[Dict[str, Any]] = []
            for dep in data.get('dependencies', []) or []:
                for vuln in dep.get('vulnerabilities', []) or []:
                    cvss = vuln.get('cvssv3') or vuln.get('cvssv2') or {}
                    findings.append({
                        'file':        dep.get('fileName'),
                        'package':     (dep.get('packages') or [{}])[0].get('id') if dep.get('packages') else dep.get('fileName'),
                        'vuln_id':     vuln.get('name'),
                        'severity':    (vuln.get('severity') or 'UNKNOWN').lower(),
                        'cvss_score':  cvss.get('baseScore'),
                        'description': (vuln.get('description') or '')[:250],
                    })

            return {'findings': findings, 'error': None}

        finally:
            shutil.rmtree(out_dir, ignore_errors=True)
