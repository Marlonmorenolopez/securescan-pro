"""
theHarvester Runner (real)
Corre theHarvester real (correos, subdominios, IPs a partir de un
dominio) — herramienta del grupo OSINT ("Grupo 2") que descubre datos a
partir de un DOMINIO, complementando a BreachChecker (necesita un
correo) y a UsernameSearchScanner/SherlockRunner (necesitan un username).

Corre vía subprocess porque theHarvester es una herramienta CLI, sin API
Python limpia para importar. Se instala en un venv Python 3.12 aislado
(ver server/Dockerfile) porque necesita una versión de Python más nueva
que la 3.11 del resto del proyecto -- el paquete "theHarvester" que
aparece en PyPI está abandonado (v0.0.1), así que se instala directo
desde el repo de GitHub.

Fuentes usadas: solo las que NO requieren API key (crt.sh, otx,
rapiddns, hackertarget, urlscan, certspotter, threatcrowd,
subdomaincenter, bufferoverun). Si en el futuro se configuran claves
para fuentes de pago (Shodan, SecurityTrails...), se pueden sumar a
_FREE_SOURCES.

Detalle de formato: el JSON que exporta theHarvester omite las claves
para las que no encontró nada (ej. si no hay correos, la clave "emails"
ni aparece) -- por eso todo el parseo abajo usa .get(clave, []).
"""

import json
import logging
import os
import shutil
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_BIN = 'theHarvester'

_FREE_SOURCES = [
    # FIX: theHarvester 5.0.0 quitó "threatcrowd" de sus motores soportados
    # ("The following engines are not supported: {'threatcrowd'}") -- como
    # "-b" se manda como un solo lote, una sola fuente inválida invalida
    # TODO el comando y no corre nada. Confirmado corriendo el binario real
    # dentro del contenedor.
    'crtsh', 'otx', 'rapiddns', 'hackertarget', 'urlscan',
    'certspotter', 'subdomaincenter', 'bufferoverun',
]


class TheHarvesterRunner:
    """Wrapper de theHarvester real — correos, subdominios e IPs a partir de un dominio."""

    def __init__(self, timeout: int = 90, limit: int = 200):
        self.timeout   = timeout
        self.limit     = limit
        self.available = shutil.which(_BIN) is not None
        if not self.available:
            logger.warning("theHarvester: el comando '%s' no está instalado en el servidor.", _BIN)

    def _empty(self, domain: str, available: bool = True, error: Optional[str] = None, simulated: bool = True) -> Dict[str, Any]:
        return {
            'domain': domain, 'available': available, 'simulated': simulated,
            'emails': [], 'hosts': [], 'ips': [], 'sources_used': [], 'error': error,
        }

    def run(self, domain: str) -> Dict[str, Any]:
        """
        Corre theHarvester contra `domain` usando solo fuentes gratuitas.

        Returns:
            Dict con: domain, available, simulated, emails, hosts
            (subdominios), ips, sources_used, error.
        """
        domain = (domain or '').strip().lower()
        if not domain:
            return self._empty(domain, error='Falta el dominio')

        if not self.available:
            return self._empty(domain, available=False, error='theHarvester no está instalado en el servidor')

        workdir    = tempfile.mkdtemp(prefix='theharvester-')
        out_prefix = os.path.join(workdir, 'result')

        try:
            try:
                result = subprocess.run(
                    [
                        _BIN,
                        '-d', domain,
                        '-l', str(self.limit),
                        '-b', ','.join(_FREE_SOURCES),
                        '-f', out_prefix,
                        '-q',
                    ],
                    stdin=subprocess.DEVNULL,  # mismo detalle que testssl.sh -- evita cuelgues
                    capture_output=True,
                    text=True,
                    timeout=self.timeout,
                )
            except subprocess.TimeoutExpired:
                return self._empty(domain, error=f'theHarvester no terminó en {self.timeout}s', simulated=False)
            except FileNotFoundError:
                return self._empty(domain, available=False, error='theHarvester no está instalado en el servidor')

            json_path = f'{out_prefix}.json'
            if not os.path.exists(json_path):
                # FIX: antes se descartaba stdout/stderr/returncode acá --
                # "no generó resultados" sin ninguna pista de la causa real
                # (CLI cambiada entre versiones mayores, fuente caída, etc.)
                diag = (result.stderr or result.stdout or '').strip()
                diag = diag[-800:] if diag else '(sin salida del proceso)'
                logger.warning(
                    "theHarvester no generó %s para %s (returncode=%s). Salida: %s",
                    json_path, domain, result.returncode, diag,
                )
                return self._empty(
                    domain,
                    error=f'theHarvester no generó resultados (código {result.returncode}): {diag}',
                    simulated=False,
                )

            try:
                with open(json_path, encoding='utf-8') as f:
                    data = json.load(f)
            except (ValueError, OSError) as e:
                return self._empty(domain, error=f'No se pudo leer el resultado de theHarvester: {e}', simulated=False)

            return {
                'domain':       domain,
                'available':    True,
                'simulated':    False,
                'emails':       sorted(set(data.get('emails', []))),
                'hosts':        sorted(set(data.get('hosts', []))),
                'ips':          sorted(set(data.get('ips', []))),
                'sources_used': _FREE_SOURCES,
                'error':        None,
            }
        finally:
            shutil.rmtree(workdir, ignore_errors=True)
