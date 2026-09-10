"""
VirusTotal Scanner Module
Reputación de dominio/IP vía la API pública de VirusTotal v3 — primera
herramienta del grupo "Huella Digital" (Threat Intel).

A diferencia de Nmap/Nuclei/SQLMap, este módulo NO escanea el target
activamente: consulta el reporte que YA existe en VirusTotal (68+ motores
antivirus/URL scanners) sobre el dominio o la IP. Por eso no depende de
ninguna otra fase del pipeline y puede correr en paralelo desde el primer
segundo del escaneo.

Requiere la variable de entorno VIRUSTOTAL_API_KEY (capa gratuita:
https://www.virustotal.com/gui/join-us). Sin ella, cae a modo simulación
— mismo patrón que WappalyzerScanner y MetasploitScanner cuando la
herramienta/credencial real no está disponible.
"""

import logging
import os
import time
from typing import Any, Dict, Optional

import requests

from modules.intel_common import extract_host, is_ip, is_internal

logger = logging.getLogger(__name__)

_API_BASE = 'https://www.virustotal.com/api/v3'


class VirusTotalScanner:
    """Wrapper de la API pública de VirusTotal — reputación de dominio/IP."""

    def __init__(self, api_key: Optional[str] = None, timeout: int = 30):
        self.api_key  = api_key or os.getenv('VIRUSTOTAL_API_KEY')
        self.timeout  = timeout
        self.available = bool(self.api_key)

        if self.available:
            logger.info("VirusTotal: API key configurada.")
        else:
            logger.warning(
                "VirusTotal: VIRUSTOTAL_API_KEY no configurada — usando simulación.")

    # ── Helpers ────────────────────────────────────────────────────────────

    def _permalink(self, host: str, host_is_ip: bool) -> str:
        kind = 'ip-address' if host_is_ip else 'domain'
        return f'https://www.virustotal.com/gui/{kind}/{host}'

    def _simulate(self, host: str, host_is_ip: bool = False, error: Optional[str] = None) -> Dict[str, Any]:
        """
        Resultado simulado para labs internos (127.0.0.1, redes privadas)
        o cuando no hay API key configurada — VirusTotal nunca tendría
        un reporte real para esos hosts de todas formas.
        """
        time.sleep(0.3)
        return {
            'host':            host,
            'available':       self.available,
            'simulated':       True,
            'malicious':       0,
            'suspicious':      0,
            'undetected':      0,
            'harmless':        68,
            'reputation':      0,
            'categories':      {},
            'engines_flagged': [],
            'permalink':       self._permalink(host, host_is_ip),
            'error':           error or (None if self.available else 'VIRUSTOTAL_API_KEY no configurada'),
        }

    # ── Scan ───────────────────────────────────────────────────────────────

    def scan(self, target: str) -> Dict[str, Any]:
        """
        Consulta la reputación del dominio/IP del target en VirusTotal.
        Funciona igual de directo para dominios que para IPs -- a
        diferencia de crt.sh/dnstwist, VirusTotal sí indexa IPs
        directamente, sin necesitar DNS reverso.

        Returns:
            Dict con: host, available, simulated, malicious, suspicious,
            undetected, harmless, reputation, categories, engines_flagged
            (motores que marcaron el host como malicious/suspicious),
            permalink, error.
        """
        host = extract_host(target)
        if not host:
            return self._simulate(target, error='No se pudo extraer un host válido del target')

        host_is_ip = is_ip(host)

        if is_internal(host):
            logger.info("VirusTotal: %s es un host interno/lab — se omite consulta real.", host)
            return self._simulate(host, host_is_ip)

        if not self.available:
            return self._simulate(host, host_is_ip)

        endpoint = 'ip_addresses' if host_is_ip else 'domains'
        url = f'{_API_BASE}/{endpoint}/{host}'

        try:
            resp = requests.get(url, headers={'x-apikey': self.api_key}, timeout=self.timeout)
        except requests.RequestException as e:
            logger.warning("VirusTotal: error de red consultando %s — %s", host, e)
            return self._simulate(host, host_is_ip, error=f'Error de red: {e}')

        if resp.status_code == 404:
            logger.info("VirusTotal: %s sin reporte previo en VT.", host)
            return {
                'host': host, 'available': True, 'simulated': False,
                'malicious': 0, 'suspicious': 0, 'undetected': 0, 'harmless': 0,
                'reputation': 0, 'categories': {}, 'engines_flagged': [],
                'permalink': self._permalink(host, host_is_ip), 'error': None,
            }

        if resp.status_code == 401:
            logger.error("VirusTotal: API key inválida o expirada.")
            return self._simulate(host, host_is_ip, error='API key inválida o expirada')

        if resp.status_code == 429:
            logger.warning("VirusTotal: rate limit alcanzado.")
            return self._simulate(host, host_is_ip, error='Rate limit de VirusTotal alcanzado — intenta más tarde')

        if resp.status_code != 200:
            logger.warning("VirusTotal: respuesta inesperada %s para %s", resp.status_code, host)
            return self._simulate(host, host_is_ip, error=f'VirusTotal respondió con status {resp.status_code}')

        try:
            data  = resp.json().get('data', {})
            attrs = data.get('attributes', {})
            stats = attrs.get('last_analysis_stats', {})
            results_by_engine = attrs.get('last_analysis_results', {})

            engines_flagged = [
                {'engine': name, 'category': info.get('category'), 'result': info.get('result')}
                for name, info in results_by_engine.items()
                if info.get('category') in ('malicious', 'suspicious')
            ]

            return {
                'host':            host,
                'available':       True,
                'simulated':       False,
                'malicious':       stats.get('malicious', 0),
                'suspicious':      stats.get('suspicious', 0),
                'undetected':      stats.get('undetected', 0),
                'harmless':        stats.get('harmless', 0),
                'reputation':      attrs.get('reputation', 0),
                'categories':      attrs.get('categories', {}),
                'engines_flagged': engines_flagged,
                'permalink':       self._permalink(host, host_is_ip),
                'error':           None,
            }
        except (ValueError, KeyError) as e:
            logger.error("VirusTotal: error parseando respuesta para %s — %s", host, e)
            return self._simulate(host, host_is_ip, error=f'Error parseando respuesta: {e}')
