"""
Trivy Scanner (real)
Corre el binario real de Trivy vía subprocess — dos modos: `fs`
(dependencias vulnerables del código fuente) e `image` (imágenes Docker
completas: vulnerabilidades del SO + dependencias + secretos +
configuración insegura, capa por capa).

Diferencia real con la versión anterior (dependency_scanner.py vía
OSV.dev): Trivy resuelve el árbol de dependencias completo (lockfiles:
package-lock.json, yarn.lock, poetry.lock, Pipfile.lock...), no solo lo
declarado directamente en package.json/requirements.txt.

Modo `image`: escanea una imagen Docker DIRECTO desde su registro (Docker
Hub, GHCR, un registro privado...) sin necesitar Docker instalado ni
socket de Docker montado -- Trivy trae su propio cliente de registro OCI.
Cubre vulnerabilidades de paquetes del sistema operativo (algo que `fs`
nunca ve, porque no hay imagen construida en un checkout de código
fuente), secretos horneados en las capas, y configuración insegura.

Dependencia operativa importante (no es un simple binario standalone):
Trivy necesita una base de datos de vulnerabilidades que descarga desde
un registro OCI (mirror.gcr.io) -- se pre-descarga en el build del
Dockerfile (`--cache-dir /opt/trivy-cache`) para no depender de internet
en cada arranque del contenedor, y este módulo apunta al mismo cache-dir.
"""

import json
import logging
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_BIN = 'trivy'
_CACHE_DIR = '/opt/trivy-cache'

# Validación básica de referencia de imagen -- rechaza banderas disfrazadas
# de nombre de imagen (ej. algo que empiece con "-") y caracteres que no
# tienen sentido en un nombre de imagen/tag/digest real.
_IMAGE_REF_RE = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_./:@-]{0,255}$')


def validate_image_ref(image_ref: str) -> Optional[str]:
    """Devuelve un mensaje de error si la referencia de imagen no es válida, o None si está OK."""
    if not image_ref or not isinstance(image_ref, str):
        return 'Referencia de imagen vacía'
    if not _IMAGE_REF_RE.match(image_ref):
        return 'Referencia de imagen inválida (ej. esperado: nginx:1.21, ghcr.io/usuario/app:tag)'
    return None


class TrivyScanner:
    """Wrapper del binario real de Trivy — dependencias (fs) e imágenes Docker completas (image)."""

    def __init__(self, timeout: int = 120, image_timeout: int = 300):
        self.timeout       = timeout
        self.image_timeout = image_timeout  # las imágenes tardan más: hay que descargar capas
        self.available      = shutil.which(_BIN) is not None
        if not self.available:
            logger.warning("Trivy: el binario '%s' no está instalado en el servidor.", _BIN)

    def _run(self, cmd: List[str], timeout: int) -> Dict[str, Any]:
        """Corre el comando de Trivy y devuelve el JSON parseado, o un dict de error."""
        try:
            result = subprocess.run(
                cmd,
                stdin=subprocess.DEVNULL,
                capture_output=True, text=True, timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            return {'_error': f'Trivy no terminó en {timeout}s'}
        except FileNotFoundError:
            return {'_error': 'Trivy no está instalado en el servidor'}

        if result.returncode != 0 and not result.stdout.strip():
            error_msg = (result.stderr or '').strip()[:300] or f'Trivy terminó con código {result.returncode}'
            logger.warning("Trivy: %s", error_msg)
            return {'_error': error_msg}

        try:
            return json.loads(result.stdout or '{}')
        except ValueError as e:
            return {'_error': f'Error parseando salida de Trivy: {e}'}

    def _extract_vulns(self, data: dict) -> List[Dict[str, Any]]:
        findings = []
        for target in data.get('Results', []) or []:
            for vuln in target.get('Vulnerabilities', []) or []:
                findings.append({
                    'kind':              'vuln',
                    'target':            target.get('Target'),
                    'package':           vuln.get('PkgName'),
                    'installed_version': vuln.get('InstalledVersion'),
                    'fixed_version':     vuln.get('FixedVersion'),
                    'severity':          (vuln.get('Severity') or 'UNKNOWN').lower(),
                    'vuln_id':           vuln.get('VulnerabilityID'),
                    'title':             vuln.get('Title') or (vuln.get('Description') or '')[:150],
                })
        return findings

    def _extract_secrets(self, data: dict) -> List[Dict[str, Any]]:
        findings = []
        for target in data.get('Results', []) or []:
            for secret in target.get('Secrets', []) or []:
                findings.append({
                    'kind':     'secret',
                    'target':   target.get('Target'),
                    'severity': (secret.get('Severity') or 'UNKNOWN').lower(),
                    'title':    secret.get('Title'),
                    'category': secret.get('Category'),
                    'line':     secret.get('StartLine'),
                })
        return findings

    def _extract_misconfigs(self, data: dict) -> List[Dict[str, Any]]:
        findings = []
        for target in data.get('Results', []) or []:
            for mc in target.get('Misconfigurations', []) or []:
                findings.append({
                    'kind':      'misconfig',
                    'target':    target.get('Target'),
                    'severity':  (mc.get('Severity') or 'UNKNOWN').lower(),
                    'vuln_id':   mc.get('ID'),
                    'title':     mc.get('Title'),
                    'message':   mc.get('Message'),
                    'resolution': mc.get('Resolution'),
                })
        return findings

    def scan(self, root_path: str) -> Dict[str, Any]:
        """
        Corre `trivy fs` contra `root_path` (dependencias vulnerables del código fuente).

        Returns:
            Dict con: findings (kind='vuln'), error.
        """
        root = Path(root_path)
        if not root.exists() or not root.is_dir():
            return {'findings': [], 'error': f'Directorio no encontrado: {root_path}'}

        if not self.available:
            return {'findings': [], 'error': 'Trivy no está instalado en el servidor'}

        data = self._run(
            # FIX (prueba real): sin --skip-db-update, Trivy intenta refrescar
            # la base de datos por red en CADA scan aunque ya esté horneada
            # en /opt/trivy-cache -- si esa red falla (mirror.gcr.io no
            # siempre alcanzable), el scan entero truena en vez de usar la
            # base ya disponible localmente. Confirmado en pruebas reales:
            # "failed to download vulnerability DB... mirror.gcr.io".
            [_BIN, 'fs', '--scanners', 'vuln', '--format', 'json',
             '--cache-dir', _CACHE_DIR, '--skip-db-update', '--quiet', str(root)],
            self.timeout,
        )
        if '_error' in data:
            return {'findings': [], 'error': data['_error']}

        return {'findings': self._extract_vulns(data), 'error': None}

    def scan_image(self, image_ref: str) -> Dict[str, Any]:
        """
        Corre `trivy image` contra una referencia de imagen Docker
        (Docker Hub, GHCR, registro privado...) -- directo desde el
        registro, sin necesitar Docker instalado.

        Returns:
            Dict con: image, findings (mezcla de kind='vuln'/'secret'/
            'misconfig'), vuln_count, secret_count, misconfig_count, error.
        """
        error = validate_image_ref(image_ref)
        if error:
            return {'image': image_ref, 'findings': [], 'vuln_count': 0, 'secret_count': 0, 'misconfig_count': 0, 'error': error}

        if not self.available:
            return {'image': image_ref, 'findings': [], 'vuln_count': 0, 'secret_count': 0, 'misconfig_count': 0, 'error': 'Trivy no está instalado en el servidor'}

        data = self._run(
            [
                _BIN, 'image',
                '--scanners', 'vuln,secret,misconfig',
                '--format', 'json',
                '--cache-dir', _CACHE_DIR,
                '--skip-db-update',  # ver nota en scan() -- misma razón
                '--quiet',
                image_ref,
            ],
            self.image_timeout,
        )
        if '_error' in data:
            return {'image': image_ref, 'findings': [], 'vuln_count': 0, 'secret_count': 0, 'misconfig_count': 0, 'error': data['_error']}

        vulns      = self._extract_vulns(data)
        secrets    = self._extract_secrets(data)
        misconfigs = self._extract_misconfigs(data)

        return {
            'image':           image_ref,
            'findings':        vulns + secrets + misconfigs,
            'vuln_count':      len(vulns),
            'secret_count':    len(secrets),
            'misconfig_count': len(misconfigs),
            'error':           None,
        }
