"""
Secrets Scanner
Busca secretos hardcodeados en código fuente (API keys, contraseñas,
tokens, llaves privadas) — primera pieza del motor de análisis de código
("Análisis de Código", Grupo 3).

Mismo objetivo que Gitleaks, pero implementado con regex en Python puro
en vez de depender de instalar ese binario en la imagen Docker. Cubre
los proveedores más comunes (AWS, Google, GitHub, Slack, Stripe) más
patrones genéricos (password=, api_key=, llaves PEM).

No reproduce el secreto completo en los resultados -- lo enmascara,
para que un reporte de escaneo no se vuelva él mismo una fuente de
filtración de credenciales.
"""

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Pattern

logger = logging.getLogger(__name__)

# Carpetas que nunca tiene sentido escanear: dependencias de terceros,
# control de versiones, y artefactos de build.
_SKIP_DIRS = {
    '.git', 'node_modules', 'vendor', 'venv', '.venv', '__pycache__',
    'dist', 'build', '.next', 'target', '.tox', 'coverage',
}

# Extensiones de archivos de texto donde tiene sentido buscar secretos.
# Se evita binarios (imágenes, fuentes, etc.) para no perder tiempo ni
# generar falsos positivos con bytes aleatorios.
_TEXT_EXTENSIONS = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.php', '.rb', '.go', '.java',
    '.env', '.yml', '.yaml', '.json', '.xml', '.ini', '.cfg', '.conf',
    '.sh', '.bash', '.txt', '.md', '.properties', '.toml', '.pem', '.key',
}

_MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB -- los secretos no viven en archivos gigantes

# (nombre, patrón, severidad). Los patrones de proveedor específico van
# primero (más confiables, menos falsos positivos); los genéricos al final.
_PATTERNS: List[tuple] = [
    ('AWS Access Key ID',        re.compile(r'\bAKIA[0-9A-Z]{16}\b'), 'critical'),
    ('AWS Secret Access Key',    re.compile(r'(?i)aws_secret_access_key\s*[:=]\s*["\']?([A-Za-z0-9/+=]{40})["\']?'), 'critical'),
    ('Google API Key',           re.compile(r'\bAIza[0-9A-Za-z\-_]{35}\b'), 'critical'),
    ('GitHub Token',             re.compile(r'\bgh[pousr]_[0-9A-Za-z]{36,255}\b'), 'critical'),
    ('Slack Token',              re.compile(r'\bxox[baprs]-[0-9A-Za-z-]{10,72}\b'), 'critical'),
    ('Stripe Live Key',          re.compile(r'\b(sk|pk)_live_[0-9A-Za-z]{16,}\b'), 'critical'),
    ('Llave privada (PEM)',      re.compile(r'-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----'), 'critical'),
    ('JWT (JSON Web Token)',     re.compile(r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b'), 'medium'),
    ('Password hardcodeado',     re.compile(r'(?i)\b\w*(password|passwd|pwd)\w*\s*[:=]\s*["\']([^"\'\s]{6,})["\']'), 'high'),
    ('API key genérica',         re.compile(r'(?i)\w*(api[_-]?key|apikey|secret[_-]?key)\w*\s*[:=]\s*["\']([A-Za-z0-9_\-]{16,})["\']'), 'high'),
    ('Token genérico',           re.compile(r'(?i)\w*(access[_-]?token|auth[_-]?token|bearer[_-]?token)\w*\s*[:=]\s*["\']([A-Za-z0-9_\-.]{16,})["\']'), 'medium'),
]

# Valores que matchean el patrón genérico pero son casi siempre placeholders,
# no secretos reales -- se descartan para no llenar el reporte de ruido.
_PLACEHOLDER_VALUES = {
    'changeme', 'your_api_key', 'your_password', 'example', 'test',
    'placeholder', 'xxxxxxxx', 'todo', 'secret', 'password', 'dummy',
    'insert_here', 'replace_me', 'fake', 'sample',
}


def _mask(value: str) -> str:
    """Enmascara un secreto para el reporte -- deja los primeros/últimos
    4 caracteres visibles, el resto asteriscos, para poder identificarlo
    sin exponerlo completo."""
    if len(value) <= 8:
        return '*' * len(value)
    return f'{value[:4]}{"*" * (len(value) - 8)}{value[-4:]}'


def _iter_files(root: Path):
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in _TEXT_EXTENSIONS and path.name not in ('.env', 'Dockerfile'):
            continue
        try:
            if path.stat().st_size > _MAX_FILE_SIZE:
                continue
        except OSError:
            continue
        yield path


class SecretsScanner:
    """Busca secretos hardcodeados en un directorio de código fuente."""

    def scan(self, root_path: str) -> Dict[str, Any]:
        """
        Recorre `root_path` buscando secretos hardcodeados.

        Returns:
            Dict con: findings (lista de {file, line, type, severity,
            masked_value}), files_scanned, error.
        """
        root = Path(root_path)
        if not root.exists() or not root.is_dir():
            return {'findings': [], 'files_scanned': 0, 'error': f'Directorio no encontrado: {root_path}'}

        findings: List[Dict[str, Any]] = []
        files_scanned = 0

        for file_path in _iter_files(root):
            try:
                text = file_path.read_text(encoding='utf-8', errors='ignore')
            except OSError as e:
                logger.warning("SecretsScanner: no se pudo leer %s (%s)", file_path, e)
                continue

            files_scanned += 1
            relative = str(file_path.relative_to(root))

            for line_num, line in enumerate(text.splitlines(), start=1):
                for name, pattern, severity in _PATTERNS:
                    match = pattern.search(line)
                    if not match:
                        continue
                    # El grupo con el valor real es el último grupo capturado,
                    # o el match completo si el patrón no tiene grupos.
                    value = match.group(match.lastindex) if match.lastindex else match.group(0)
                    if value.strip().lower() in _PLACEHOLDER_VALUES:
                        continue
                    findings.append({
                        'file':          relative,
                        'line':          line_num,
                        'type':          name,
                        'severity':      severity,
                        'masked_value':  _mask(value),
                    })
                    break  # un match por línea es suficiente, evita ruido duplicado

        logger.info("SecretsScanner: %d archivo(s) analizados, %d hallazgo(s) en %s",
                    files_scanned, len(findings), root_path)

        return {
            'findings':       findings,
            'files_scanned':  files_scanned,
            'error':          None,
        }
