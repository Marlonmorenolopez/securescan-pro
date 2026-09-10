"""
Shodan Scanner Module (InternetDB)
Huella de exposición externa vía InternetDB — tercera herramienta del
grupo "Huella Digital" (Threat Intel).

Ojo: a diferencia de VirusTotal y AbuseIPDB, este módulo NO usa la API
completa de Shodan (esa requiere una membresía paga desde USD 49, pago
único). Usa InternetDB (https://internetdb.shodan.io), el único endpoint
de Shodan que es 100% gratuito y sin registro para uso no comercial —
por eso no hay SHODAN_API_KEY en ningún lado de este módulo, a propósito.

A cambio da menos datos que la API completa: solo puertos abiertos,
hostnames, CPEs (identificadores de software), tags (ej. "cdn", "vpn",
"tor", "compromised") y CVEs conocidos por firma de banner — sin banners
crudos ni detalle de servicio, y se actualiza una vez por semana, no en
tiempo real.

Como AbuseIPDB, solo acepta IPs — si el target es un dominio, se
resuelve a IP por DNS antes de consultar. Si el target ya es una IP
(incluida una de un entorno en desarrollo con IP pública propia), se
consulta directamente.
"""

import logging
import time
from typing import Any, Dict, Optional

import requests

from modules.intel_common import extract_host, is_internal, resolve_ip

logger = logging.getLogger(__name__)

_API_URL = 'https://internetdb.shodan.io'


class ShodanScanner:
    """Wrapper de Shodan InternetDB — huella de exposición externa por IP, sin API key."""

    def __init__(self, timeout: int = 20):
        self.timeout   = timeout
        self.available = True  # InternetDB no requiere key ni cuenta
        logger.info("Shodan (InternetDB): sin API key requerida, listo para consultar.")

    # ── Helpers ────────────────────────────────────────────────────────────

    def _permalink(self, ip: str) -> str:
        return f'https://www.shodan.io/host/{ip}'

    def _simulate(self, host: str, ip: Optional[str] = None, error: Optional[str] = None) -> Dict[str, Any]:
        """Resultado simulado para labs internos o cuando InternetDB no responde."""
        time.sleep(0.3)
        resolved = ip or host
        return {
            'host': host, 'ip': resolved, 'available': self.available, 'simulated': True,
            'ports': [], 'hostnames': [], 'cpes': [], 'tags': [], 'vulns': [],
            'permalink': self._permalink(resolved), 'error': error,
        }

    # ── Scan ───────────────────────────────────────────────────────────────

    def scan(self, target: str) -> Dict[str, Any]:
        """
        Consulta InternetDB para la IP del target. Si el target es un
        dominio, lo resuelve a IP primero.

        Returns:
            Dict con: host, ip, available, simulated, ports, hostnames,
            cpes, tags, vulns (CVEs), permalink, error.
        """
        host = extract_host(target)
        if not host:
            return self._simulate(target, error='No se pudo extraer un host válido del target')

        if is_internal(host):
            logger.info("Shodan: %s es un host interno/lab — se omite consulta real.", host)
            return self._simulate(host)

        ip = resolve_ip(host)
        if not ip:
            return self._simulate(host, error=f'No se pudo resolver {host} a una IP')

        if is_internal(ip):
            logger.info("Shodan: %s resuelve a IP interna (%s) — se omite consulta real.", host, ip)
            return self._simulate(host, ip)

        try:
            resp = requests.get(f'{_API_URL}/{ip}', timeout=self.timeout)
        except requests.RequestException as e:
            logger.warning("Shodan: error de red consultando %s — %s", ip, e)
            return self._simulate(host, ip, error=f'Error de red: {e}')

        if resp.status_code == 404:
            # InternetDB no tiene registro de esta IP -- no está en su índice,
            # no que esté "limpia". Se distingue de un error real.
            logger.info("Shodan: %s sin registro en InternetDB.", ip)
            return {
                'host': host, 'ip': ip, 'available': True, 'simulated': False,
                'ports': [], 'hostnames': [], 'cpes': [], 'tags': [], 'vulns': [],
                'permalink': self._permalink(ip), 'error': None,
            }

        if resp.status_code == 429:
            logger.warning("Shodan: rate limit de InternetDB alcanzado.")
            return self._simulate(host, ip, error='Rate limit de InternetDB alcanzado — intenta más tarde')

        if resp.status_code != 200:
            logger.warning("Shodan: respuesta inesperada %s para %s", resp.status_code, ip)
            return self._simulate(host, ip, error=f'InternetDB respondió con status {resp.status_code}')

        try:
            data = resp.json()
            return {
                'host':      host,
                'ip':        ip,
                'available': True,
                'simulated': False,
                'ports':     sorted(data.get('ports', [])),
                'hostnames': data.get('hostnames', []),
                'cpes':      data.get('cpes', []),
                'tags':      data.get('tags', []),
                'vulns':     sorted(data.get('vulns', [])),
                'permalink': self._permalink(ip),
                'error':     None,
            }
        except ValueError as e:
            logger.error("Shodan: error parseando respuesta para %s — %s", ip, e)
            return self._simulate(host, ip, error=f'Error parseando respuesta: {e}')
