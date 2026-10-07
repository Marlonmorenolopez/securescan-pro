"""
Backdoor / Webshell Pattern Scanner
Busca firmas de código malicioso conocidas (webshells, backdoors,
deserialización insegura) — segunda pieza del motor de análisis de
código ("Análisis de Código", Grupo 3).

Esto es detección POR PATRONES, no un sandbox de ejecución ni un motor
de análisis semántico -- encuentra las técnicas más comunes que aparecen
en webshells y backdoors reales (eval+base64 encadenado, exec/system con
input del usuario, deserialización insegura), pero un atacante que se
tome el trabajo de ofuscar más puede evadirlo. Sirve como primera línea
de revisión, no como veredicto final.

Los patrones están agrupados por lenguaje porque las técnicas de
backdoor son distintas en PHP, Python y JavaScript/Node.
"""

import logging
import re
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

_SKIP_DIRS = {
    '.git', 'node_modules', 'vendor', 'venv', '.venv', '__pycache__',
    'dist', 'build', '.next', 'target', '.tox', 'coverage',
}

_MAX_FILE_SIZE = 2 * 1024 * 1024

# (nombre, patrón, severidad, categoría). Los patrones "encadenados"
# (varias funciones peligrosas juntas) son casi siempre maliciosos de
# verdad -> critical. Las funciones peligrosas usadas solas pueden tener
# usos legítimos -> medium, para revisión manual en vez de alarma directa.
_PHP_PATTERNS = [
    ('Webshell: eval + base64/gzinflate encadenado',
     re.compile(r'eval\s*\(\s*(gzinflate|gzuncompress|str_rot13|base64_decode)\s*\('), 'critical', 'webshell'),
    ('Ejecución de comandos con input directo del usuario',
     re.compile(r'\b(system|exec|passthru|shell_exec|proc_open)\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)'), 'critical', 'rce'),
    ('Backdoor clásico: assert/eval sobre input del usuario',
     re.compile(r'\b(assert|eval|create_function)\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)'), 'critical', 'webshell'),
    ('preg_replace con modificador /e (RCE en PHP < 7)',
     re.compile(r'preg_replace\s*\(\s*["\'][^"\']*\/e["\']'), 'high', 'rce'),
    ('eval() genérico',
     re.compile(r'\beval\s*\('), 'medium', 'obfuscation'),
    ('Ejecución de comandos del sistema',
     re.compile(r'\b(system|exec|passthru|shell_exec|proc_open)\s*\('), 'medium', 'rce'),
]

_PYTHON_PATTERNS = [
    ('eval/exec sobre input externo',
     re.compile(r'\b(eval|exec)\s*\(\s*(request\.|input\(|os\.environ)'), 'critical', 'rce'),
    ('Deserialización insegura (pickle)',
     re.compile(r'\bpickle\.loads?\s*\('), 'high', 'deserialization'),
    ('os.system/subprocess con shell=True',
     re.compile(r'subprocess\.\w+\([^)]*shell\s*=\s*True'), 'high', 'rce'),
    ('eval/exec genérico',
     re.compile(r'\b(eval|exec)\s*\('), 'medium', 'obfuscation'),
    ('__import__ dinámico',
     re.compile(r'__import__\s*\('), 'low', 'obfuscation'),
]

_JS_PATTERNS = [
    ('eval sobre contenido decodificado (atob)',
     re.compile(r'eval\s*\(\s*atob\s*\('), 'critical', 'obfuscation'),
    ('child_process.exec con input dinámico',
     re.compile(r'child_process\.\w*exec\w*\s*\('), 'high', 'rce'),
    ('new Function() con string dinámico (eval disfrazado)',
     re.compile(r'new\s+Function\s*\('), 'medium', 'obfuscation'),
    ('eval() genérico',
     re.compile(r'\beval\s*\('), 'medium', 'obfuscation'),
]

_PATTERNS_BY_EXT = {
    '.php': _PHP_PATTERNS,
    '.phtml': _PHP_PATTERNS,
    '.py': _PYTHON_PATTERNS,
    '.js': _JS_PATTERNS,
    '.jsx': _JS_PATTERNS,
    '.ts': _JS_PATTERNS,
    '.tsx': _JS_PATTERNS,
}


def _iter_files(root: Path):
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in _PATTERNS_BY_EXT:
            continue
        try:
            if path.stat().st_size > _MAX_FILE_SIZE:
                continue
        except OSError:
            continue
        yield path


class BackdoorScanner:
    """Busca patrones de webshells/backdoors/deserialización insegura en el código."""

    def scan(self, root_path: str) -> Dict[str, Any]:
        """
        Recorre `root_path` buscando firmas de backdoors conocidas.

        Returns:
            Dict con: findings (lista de {file, line, type, severity,
            category, snippet}), files_scanned, error.
        """
        root = Path(root_path)
        if not root.exists() or not root.is_dir():
            return {'findings': [], 'files_scanned': 0, 'error': f'Directorio no encontrado: {root_path}'}

        findings: List[Dict[str, Any]] = []
        files_scanned = 0

        for file_path in _iter_files(root):
            patterns = _PATTERNS_BY_EXT[file_path.suffix.lower()]
            try:
                text = file_path.read_text(encoding='utf-8', errors='ignore')
            except OSError as e:
                logger.warning("BackdoorScanner: no se pudo leer %s (%s)", file_path, e)
                continue

            files_scanned += 1
            relative = str(file_path.relative_to(root))
            matched_lines = set()  # evita reportar la misma línea 2 veces con distintos patrones

            for line_num, line in enumerate(text.splitlines(), start=1):
                if line_num in matched_lines:
                    continue
                for name, pattern, severity, category in patterns:
                    if pattern.search(line):
                        findings.append({
                            'file':     relative,
                            'line':     line_num,
                            'type':     name,
                            'severity': severity,
                            'category': category,
                            'snippet':  line.strip()[:160],
                        })
                        matched_lines.add(line_num)
                        break  # el patrón más específico de la lista ya matcheó, no seguir

        logger.info("BackdoorScanner: %d archivo(s) analizados, %d hallazgo(s) en %s",
                    files_scanned, len(findings), root_path)

        return {
            'findings':      findings,
            'files_scanned': files_scanned,
            'error':         None,
        }
