"""
Semgrep Scanner (real)
Corre el binario real de Semgrep vía subprocess — SAST (Static
Application Security Testing) real, cuarta pieza de detección del Grupo
3 junto a Gitleaks/TruffleHog (secretos) y Trivy/Dependency-Check
(dependencias).

Diferencia real con BackdoorScanner (mi heurística propia): Semgrep usa
~280 reglas reales mantenidas por la comunidad (semgrep-rules en GitHub)
que entienden la SINTAXIS del lenguaje, no solo texto -- detecta SQLi,
XSS, path traversal, SSRF, deserialización insegura, y mucho más que los
pocos patrones de webshell que cubre mi heurística. BackdoorScanner
sigue teniendo su lugar: es más rápido y apunta específicamente a
webshells/backdoors ya insertados, mientras que Semgrep apunta a
vulnerabilidades en código legítimo que un atacante podría explotar.

Nota de instalación: el registro de reglas de semgrep.dev puede estar
bloqueado en redes con egress restringido -- por eso este proyecto NO
usa `--config auto` ni `--config p/...` (ambos requieren red en el
momento del escaneo). En su lugar, el Dockerfile clona el repo público
de reglas y las consolida en /opt/semgrep-rules en el build, así que
esto corre 100% offline en runtime.

Costo de arranque real (confirmado en pruebas): cargar ~280 reglas
toma un tiempo fijo notable (decenas de segundos) independiente del
tamaño del código escaneado -- por diseño, el timeout por defecto de
este módulo es generoso.
"""

import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

_BIN = 'semgrep'
_RULES_DIR = '/opt/semgrep-rules'

_SEMGREP_SEVERITY = {'ERROR': 'high', 'WARNING': 'medium', 'INFO': 'low'}


class SemgrepScanner:
    """Wrapper del binario real de Semgrep — SAST con reglas reales de la comunidad."""

    def __init__(self, timeout: int = 180):
        self.timeout       = timeout
        self.rules_present = Path(_RULES_DIR).is_dir() and any(Path(_RULES_DIR).iterdir())
        self.available      = shutil.which(_BIN) is not None and self.rules_present
        if not shutil.which(_BIN):
            logger.warning("Semgrep: el binario '%s' no está instalado en el servidor.", _BIN)
        elif not self.rules_present:
            logger.warning("Semgrep: no hay reglas consolidadas en %s -- revisar el build del Dockerfile.", _RULES_DIR)

    def scan(self, root_path: str) -> Dict[str, Any]:
        """
        Corre Semgrep contra `root_path` con las reglas consolidadas.

        Returns:
            Dict con: findings (lista con file, line, rule_id, message,
            severity, cwe, owasp), error.
        """
        root = Path(root_path)
        if not root.exists() or not root.is_dir():
            return {'findings': [], 'error': f'Directorio no encontrado: {root_path}'}

        if not self.available:
            reason = 'Semgrep no está instalado en el servidor' if not shutil.which(_BIN) \
                else f'Sin reglas consolidadas en {_RULES_DIR} (revisar build)'
            return {'findings': [], 'error': reason}

        report_path = f'{root}.semgrep-report.json'

        try:
            try:
                subprocess.run(
                    [
                        _BIN, 'scan',
                        '--config', _RULES_DIR,
                        '--json',
                        '--output', report_path,
                        '--quiet',
                        '--disable-version-check',
                        '--metrics', 'off',  # no mandar telemetría a semgrep.dev
                        str(root),
                    ],
                    stdin=subprocess.DEVNULL,
                    capture_output=True, text=True, timeout=self.timeout,
                )
            except subprocess.TimeoutExpired:
                return {'findings': [], 'error': f'Semgrep no terminó en {self.timeout}s'}
            except FileNotFoundError:
                return {'findings': [], 'error': 'Semgrep no está instalado en el servidor'}

            report_file = Path(report_path)
            if not report_file.exists():
                return {'findings': [], 'error': 'Semgrep no generó reporte'}

            try:
                data = json.loads(report_file.read_text(encoding='utf-8') or '{}')
            except ValueError as e:
                return {'findings': [], 'error': f'Error parseando reporte de Semgrep: {e}'}

            findings: List[Dict[str, Any]] = []
            for item in data.get('results', []):
                extra    = item.get('extra', {})
                metadata = extra.get('metadata', {})
                findings.append({
                    'file':     item.get('path'),
                    'line':     (item.get('start') or {}).get('line'),
                    'rule_id':  item.get('check_id'),
                    'message':  extra.get('message'),
                    'severity': _SEMGREP_SEVERITY.get(extra.get('severity'), 'medium'),
                    'cwe':      metadata.get('cwe'),
                    'owasp':    metadata.get('owasp'),
                })

            errors = data.get('errors', [])
            error_msg = f'{len(errors)} regla(s) fallaron al cargar' if errors else None

            return {'findings': findings, 'error': error_msg}

        finally:
            Path(report_path).unlink(missing_ok=True)
