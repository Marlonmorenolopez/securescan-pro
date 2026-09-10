"""
AbuseIPDB Scanner Module
Reputación de IP vía la API pública de AbuseIPDB v2 — segunda herramienta
del grupo "Huella Digital" (Threat Intel).

Diferencia clave con VirusTotal: AbuseIPDB solo acepta IPs, no dominios.
Si el target es un dominio (ej. testphp.vulnweb.com), este módulo primero
resuelve su IP vía DNS y consulta la reputación de esa IP — el reporte
describe la IP resuelta, no el dominio en sí. Si el target ya es una IP
(pública o de un entorno en desarrollo/staging), se consulta directo,
sin pasos intermedios.

Requiere la variable de entorno ABUSEIPDB_API_KEY (capa gratuita:
https://www.abuseipdb.com/register). Sin ella, cae a modo simulación —
mismo patrón que VirusTotalScanner.
"""

import logging
import os
import time
from typing import Any, Dict, Optional

import requests

from modules.intel_common import extract_host, is_internal, resolve_ip

logger = logging.getLogger(__name__)

_API_URL = 'https://api.abuseipdb.com/api/v2/check'


class AbuseIPDBScanner:
    """Wrapper de la API pública de AbuseIPDB — reputación de IP."""

    def __init__(self, api_key: Optional[str] = None, timeout: int = 30, max_age_days: int = 90):
        self.api_key      = api_key or os.getenv('ABUSEIPDB_API_KEY')
        self.timeout      = timeout
        self.max_age_days = max_age_days
        self.available    = bool(self.api_key)

        if self.available:
            logger.info("AbuseIPDB: API key configurada.")
        else:
            logger.warning(
                "AbuseIPDB: ABUSEIPDB_API_KEY no configurada — usando simulación.")

    # ── Helpers ────────────────────────────────────────────────────────────

    def _permalink(self, ip: str) -> str:
        return f'https://www.abuseipdb.com/check/{ip}'

    def _simulate(self, host: str, ip: Optional[str] = None, error: Optional[str] = None) -> Dict[str, Any]:
        """
        Resultado simulado para labs internos, hosts sin DNS público, o
        cuando no hay API key configurada.
        """
        time.sleep(0.3)
        resolved = ip or host
        return {
            'host':                  host,
            'ip':                    resolved,
            'available':             self.available,
            'simulated':             True,
            'abuse_confidence_score': 0,
            'total_reports':         0,
            'num_distinct_users':    0,
            'country_code':          None,
            'isp':                   None,
            'usage_type':            None,
            'is_whitelisted':        None,
            'last_reported_at':      None,
            'permalink':             self._permalink(resolved),
            'error':                 error or (None if self.available else 'ABUSEIPDB_API_KEY no configurada'),
        }

    # ── Scan ───────────────────────────────────────────────────────────────

    def scan(self, target: str) -> Dict[str, Any]:
        """
        Consulta la reputación de la IP del target en AbuseIPDB. Si el
        target es un dominio, lo resuelve a IP primero. Si ya es una IP
        (incluida una de un entorno en desarrollo con IP pública propia),
        se consulta directamente.

        Returns:
            Dict con: host, ip, available, simulated, abuse_confidence_score
            (0-100), total_reports, num_distinct_users, country_code, isp,
            usage_type, is_whitelisted, last_reported_at, permalink, error.
        """
        host = extract_host(target)
        if not host:
            return self._simulate(target, error='No se pudo extraer un host válido del target')

        if is_internal(host):
            logger.info("AbuseIPDB: %s es un host interno/lab — se omite consulta real.", host)
            return self._simulate(host)

        ip = resolve_ip(host)
        if not ip:
            return self._simulate(host, error=f'No se pudo resolver {host} a una IP')

        if is_internal(ip):
            logger.info("AbuseIPDB: %s resuelve a IP interna (%s) — se omite consulta real.", host, ip)
            return self._simulate(host, ip)

        if not self.available:
            return self._simulate(host, ip)

        try:
            resp = requests.get(
                _API_URL,
                headers={'Key': self.api_key, 'Accept': 'application/json'},
                params={'ipAddress': ip, 'maxAgeInDays': self.max_age_days},
                timeout=self.timeout,
            )
        except requests.RequestException as e:
            logger.warning("AbuseIPDB: error de red consultando %s — %s", ip, e)
            return self._simulate(host, ip, error=f'Error de red: {e}')

        if resp.status_code == 401:
            logger.error("AbuseIPDB: API key inválida o expirada.")
            return self._simulate(host, ip, error='API key inválida o expirada')

        if resp.status_code == 429:
            logger.warning("AbuseIPDB: rate limit alcanzado.")
            return self._simulate(host, ip, error='Rate limit de AbuseIPDB alcanzado — intenta más tarde')

        if resp.status_code != 200:
            logger.warning("AbuseIPDB: respuesta inesperada %s para %s", resp.status_code, ip)
            return self._simulate(host, ip, error=f'AbuseIPDB respondió con status {resp.status_code}')

        try:
            data = resp.json().get('data', {})
            return {
                'host':                   host,
                'ip':                     ip,
                'available':              True,
                'simulated':              False,
                'abuse_confidence_score': data.get('abuseConfidenceScore', 0),
                'total_reports':          data.get('totalReports', 0),
                'num_distinct_users':     data.get('numDistinctUsers', 0),
                'country_code':           data.get('countryCode'),
                'isp':                    data.get('isp'),
                'usage_type':             data.get('usageType'),
                'is_whitelisted':         data.get('isWhitelisted'),
                'last_reported_at':       data.get('lastReportedAt'),
                'permalink':              self._permalink(ip),
                'error':                  None,
            }
        except (ValueError, KeyError) as e:
            logger.error("AbuseIPDB: error parseando respuesta para %s — %s", ip, e)
            return self._simulate(host, ip, error=f'Error parseando respuesta: {e}')
