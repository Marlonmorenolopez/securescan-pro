"""
Sherlock Runner ("búsqueda profunda")
Corre el paquete real `sherlock-project` (414 sitios, no ~19 como
UsernameSearchScanner) contra un username, vía subprocess.

Por qué subprocess y no una librería: sherlock-project está armado como
herramienta de línea de comandos, sin una API Python limpia para
importar directamente. Se invoca con --csv para obtener resultados
estructurados, en vez de parsear el texto coloreado de la terminal.

Advertencia de tiempo: Sherlock limita su propia concurrencia interna a
20 workers (ver sherlock_project.sherlock, "Limit number of workers to
20"), así que contra 414 sitios esto tarda bastante más que la búsqueda
rápida -- típicamente uno a varios minutos, no segundos. Por eso se
expone como un job en segundo plano con polling (ver server/app.py:
run_sherlock_scan), igual que Análisis de Código, y NO como respuesta
síncrona como la búsqueda rápida.

Valores reales de la columna "exists" que escribe Sherlock (ver
sherlock_project.result.QueryStatus en el paquete instalado):
  Claimed   -> el username existe en ese sitio (único que cuenta como hallazgo)
  Available -> se verificó y NO existe (señal confiable de "no existe")
  Unknown   -> error de red/timeout al verificar (inconcluso)
  Illegal   -> el username no cumple el formato permitido en ese sitio
  WAF       -> la consulta fue bloqueada por un firewall/anti-bots (inconcluso)
Solo "Unknown" y "WAF" se tratan como "no verificable" -- mismo criterio
que ya usaba UsernameSearchScanner, para no repetir ahí el error que
corregí antes (contar un bloqueo como "no existe").
"""

import csv
import logging
import os
import re
import shutil
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_USERNAME_RE = re.compile(r'^[A-Za-z0-9_.\-]{1,39}$')

_FOUND_STATUS   = 'Claimed'
_ERROR_STATUSES = {'Unknown', 'WAF'}  # inconcluso -- NO es "no existe"


class SherlockRunner:
    """Corre sherlock-project real (414 sitios) vía subprocess."""

    def __init__(self, timeout_per_site: int = 15, overall_timeout: int = 600):
        self.timeout_per_site = timeout_per_site  # timeout de Sherlock por sitio individual
        self.overall_timeout  = overall_timeout    # tope duro del proceso completo
        self.available = shutil.which('sherlock') is not None
        if not self.available:
            logger.warning("SherlockRunner: el comando 'sherlock' no está instalado en el servidor.")

    def run(self, username: str) -> Dict[str, Any]:
        """
        Corre Sherlock real contra `username` en los 414 sitios de su base.

        Returns:
            Dict con: username, available, found (lista de {site, url}),
            unknown_sites (Unknown/WAF -- no verificable, NO es "no
            existe"), checked_count, error.
        """
        username = (username or '').strip()
        if not username or not _USERNAME_RE.match(username):
            return self._result(username, error='Username inválido (solo letras, números, "_", "-" y ".")')

        if not self.available:
            return self._result(username, available=False, error='sherlock-project no está instalado en el servidor')

        workdir = tempfile.mkdtemp(prefix='sherlock-')
        try:
            try:
                subprocess.run(
                    [
                        'sherlock', username,
                        '--csv', '--print-all', '--no-color',
                        '--timeout', str(self.timeout_per_site),
                        '-fo', workdir,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=self.overall_timeout,
                )
            except subprocess.TimeoutExpired:
                return self._result(
                    username,
                    error=f'Sherlock no terminó en {self.overall_timeout}s -- probablemente varios sitios están respondiendo lento',
                )
            except FileNotFoundError:
                return self._result(username, available=False, error='sherlock-project no está instalado en el servidor')

            csv_path = os.path.join(workdir, f'{username}.csv')
            if not os.path.exists(csv_path):
                return self._result(username, error='Sherlock no generó resultados (revisa los logs del backend)')

            found: List[Dict[str, str]] = []
            unknown_sites: List[str] = []
            checked = 0

            with open(csv_path, newline='', encoding='utf-8') as f:
                for row in csv.DictReader(f):
                    checked += 1
                    status = (row.get('exists') or '').strip()
                    site   = row.get('name') or '?'
                    if status == _FOUND_STATUS:
                        found.append({'site': site, 'url': row.get('url_user') or ''})
                    elif status in _ERROR_STATUSES:
                        unknown_sites.append(site)
                    # 'Available' -> no existe, señal confiable, no se agrega a ningún lado.
                    # 'Illegal'   -> el username ni aplica a ese sitio, se ignora.

            return {
                'username':      username,
                'available':     True,
                'found':         sorted(found, key=lambda x: x['site']),
                'unknown_sites': sorted(unknown_sites),
                'checked_count': checked,
                'error':         None,
            }
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    def _result(self, username: str, available: bool = True, error: Optional[str] = None) -> Dict[str, Any]:
        return {
            'username': username, 'available': available,
            'found': [], 'unknown_sites': [], 'checked_count': 0,
            'error': error,
        }
