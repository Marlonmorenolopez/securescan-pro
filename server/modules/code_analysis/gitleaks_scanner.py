"""
Gitleaks Scanner (real)
Corre el binario real de Gitleaks vía subprocess — reemplaza al detector
de secretos basado en regex propio que había antes.

Diferencia real con la versión anterior: Gitleaks mantiene un set de
reglas curado y actualizado por la comunidad (con ~150 tipos de
credenciales conocidas), y de paso trae un allowlist de valores que
sabe que son placeholders/ejemplos oficiales de documentación (ej. la
AWS access key de ejemplo "AKIAIOSFODNN7EXAMPLE" que aparece en los
docs oficiales de AWS) -- confirmado en pruebas: mi regex la marcaba
como hallazgo, Gitleaks correctamente la ignora.

Escaneo de historial de git (confirmado con una prueba real): si
`root_path` tiene una carpeta `.git` (viene de clonar un repo, no de un
ZIP subido), este módulo corre Gitleaks SIN `--no-git` -- es decir,
escanea todo el historial de commits, no solo el árbol de archivos
actual. Probé esto con un secreto real que se subió en un commit y se
borró en el siguiente: en modo --no-git (solo archivos actuales) daba 0
hallazgos; en modo con historial lo encontró, con el commit, autor,
email y fecha exactos de cuando se subió. Para un ZIP subido no hay
historial que escanear, así que ahí sigue usando --no-git.
"""

import json
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

_BIN = 'gitleaks'


class GitleaksScanner:
    """Wrapper del binario real de Gitleaks — detección de secretos hardcodeados."""

    def __init__(self, timeout: int = 120):
        self.timeout   = timeout
        self.available = shutil.which(_BIN) is not None
        if not self.available:
            logger.warning("Gitleaks: el binario '%s' no está instalado en el servidor.", _BIN)

    def scan(self, root_path: str) -> Dict[str, Any]:
        """
        Corre Gitleaks contra `root_path`. Si hay una carpeta .git (repo
        clonado), escanea todo el historial de commits -- si no (ZIP
        subido), escanea solo el árbol de archivos actual.

        Returns:
            Dict con: findings (lista con file, line, rule_id,
            description, secret_masked, entropy, commit, author, date),
            scanned_git_history (bool), error.
        """
        root = Path(root_path)
        if not root.exists() or not root.is_dir():
            return {'findings': [], 'scanned_git_history': False, 'error': f'Directorio no encontrado: {root_path}'}

        if not self.available:
            return {'findings': [], 'scanned_git_history': False, 'error': 'Gitleaks no está instalado en el servidor'}

        has_git = (root / '.git').is_dir()
        report_path = tempfile.mktemp(suffix='.json', prefix='gitleaks-')

        cmd = [
            _BIN, 'detect',
            '--source', str(root),
            '--report-format', 'json',
            '--report-path', report_path,
            '--exit-code', '0',  # no fallar el proceso solo porque encontró secretos
            '--no-banner',
        ]
        if not has_git:
            cmd.append('--no-git')

        try:
            try:
                subprocess.run(
                    cmd,
                    stdin=subprocess.DEVNULL,
                    capture_output=True, text=True, timeout=self.timeout,
                )
            except subprocess.TimeoutExpired:
                return {'findings': [], 'scanned_git_history': has_git, 'error': f'Gitleaks no terminó en {self.timeout}s'}
            except FileNotFoundError:
                return {'findings': [], 'scanned_git_history': has_git, 'error': 'Gitleaks no está instalado en el servidor'}

            report_file = Path(report_path)
            if not report_file.exists():
                return {'findings': [], 'scanned_git_history': has_git, 'error': None}  # sin hallazgos, gitleaks a veces no escribe el archivo si está vacío

            try:
                raw_findings = json.loads(report_file.read_text(encoding='utf-8') or '[]')
            except ValueError as e:
                return {'findings': [], 'scanned_git_history': has_git, 'error': f'Error parseando reporte de Gitleaks: {e}'}

            findings: List[Dict[str, Any]] = []
            for item in raw_findings:
                secret = item.get('Secret', '')
                masked = f'{secret[:4]}{"*" * max(len(secret) - 8, 0)}{secret[-4:]}' if len(secret) > 8 else '*' * len(secret)
                findings.append({
                    'file':          item.get('File'),
                    'line':          item.get('StartLine'),
                    'rule_id':       item.get('RuleID'),
                    'description':   item.get('Description'),
                    'secret_masked': masked,
                    'entropy':       item.get('Entropy'),
                    'severity':      'high',  # Gitleaks no reporta severidad -- cualquier secreto real hallado es grave de por sí
                    'commit':        item.get('Commit') or None,
                    'author':        item.get('Author') or None,
                    'date':          item.get('Date') or None,
                })

            return {'findings': findings, 'scanned_git_history': has_git, 'error': None}

        finally:
            Path(report_path).unlink(missing_ok=True)
