"""
Google Safe Browsing Scanner Module
Verifica si la URL del target ya está marcada por Google como sitio
comprometido/malicioso — séptima herramienta del grupo "Huella Digital"
(Threat Intel).

Esta es la MISMA base de datos que usan Chrome y Firefox para mostrar la
pantalla roja de "Sitio engañoso/peligroso por delante". Si el target
aparece acá, significa que Google ya lo detectó sirviendo malware,
phishing, o software no deseado, y los navegadores lo están bloqueando
activamente para los visitantes reales -- justo el caso que preguntaste:
"si ya está en producción, que lo detecte".

Requiere la variable de entorno GOOGLE_SAFE_BROWSING_API_KEY (capa
gratuita: 10,000 consultas/día; se obtiene habilitando la "Safe Browsing
API" en Google Cloud Console). Sin ella, cae a modo simulación -- mismo
patrón que los otros 6 módulos de este grupo.
"""

import logging
import os
import time
from typing import Any, Dict, Optional

import requests

from modules.intel_common import extract_host, is_internal

logger = logging.getLogger(__name__)

_API_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find'

_THREAT_LABELS = {
    'MALWARE':                          'Malware',
    'SOCIAL_ENGINEERING':               'Phishing / Ingeniería social',
    'UNWANTED_SOFTWARE':                'Software no deseado',
    'POTENTIALLY_HARMFUL_APPLICATION':  'Aplicación potencialmente dañina',
}


class SafeBrowsingScanner:
    """Wrapper de la API pública de Google Safe Browsing v4."""

    def __init__(self, api_key: Optional[str] = None, timeout: int = 15):
        self.api_key   = api_key or os.getenv('GOOGLE_SAFE_BROWSING_API_KEY')
        self.timeout   = timeout
        self.available = bool(self.api_key)

        if self.available:
            logger.info("Safe Browsing: API key configurada.")
        else:
            logger.warning(
                "Safe Browsing: GOOGLE_SAFE_BROWSING_API_KEY no configurada — usando simulación.")

    # ── Helpers ────────────────────────────────────────────────────────────

    def _target_url(self, target: str) -> str:
        """Safe Browsing evalúa URLs completas, no solo hosts."""
        return target if '://' in target else f'https://{target}/'

    def _simulate(self, host: str, url: str, error: Optional[str] = None) -> Dict[str, Any]:
        """Resultado simulado para labs internos o cuando no hay API key configurada."""
        time.sleep(0.3)
        return {
            'host':      host,
            'url':       url,
            'available': self.available,
            'simulated': True,
            'flagged':   False,
            'threats':   [],
            'error':     error or (None if self.available else 'GOOGLE_SAFE_BROWSING_API_KEY no configurada'),
        }

    # ── Scan ───────────────────────────────────────────────────────────────

    def scan(self, target: str) -> Dict[str, Any]:
        """
        Consulta si la URL del target está en las listas de amenazas de
        Google Safe Browsing (malware, phishing, software no deseado,
        apps potencialmente dañinas).

        Returns:
            Dict con: host, url, available, simulated, flagged, threats
            (lista de tipos de amenaza detectados, en español), error.
        """
        host = extract_host(target)
        if not host:
            return self._simulate(target, target, error='No se pudo extraer un host válido del target')

        url = self._target_url(target)

        if is_internal(host):
            logger.info("Safe Browsing: %s es un host interno/lab — se omite consulta real.", host)
            return self._simulate(host, url)

        if not self.available:
            return self._simulate(host, url)

        payload = {
            'client': {'clientId': 'securescan-pro', 'clientVersion': '5.1'},
            'threatInfo': {
                'threatTypes':      list(_THREAT_LABELS.keys()),
                'platformTypes':    ['ANY_PLATFORM'],
                'threatEntryTypes': ['URL'],
                'threatEntries':    [{'url': url}],
            },
        }

        try:
            resp = requests.post(_API_URL, params={'key': self.api_key}, json=payload, timeout=self.timeout)
        except requests.RequestException as e:
            logger.warning("Safe Browsing: error de red consultando %s — %s", url, e)
            return self._simulate(host, url, error=f'Error de red: {e}')

        if resp.status_code == 400:
            logger.error("Safe Browsing: request inválido (API key mal configurada o API no habilitada).")
            return self._simulate(host, url, error='API key inválida o la Safe Browsing API no está habilitada en el proyecto de Google Cloud')

        if resp.status_code == 429:
            logger.warning("Safe Browsing: rate limit alcanzado.")
            return self._simulate(host, url, error='Rate limit de Safe Browsing alcanzado — intenta más tarde')

        if resp.status_code != 200:
            logger.warning("Safe Browsing: respuesta inesperada %s para %s", resp.status_code, url)
            return self._simulate(host, url, error=f'Safe Browsing respondió con status {resp.status_code}')

        try:
            data = resp.json()
            matches = data.get('matches', [])
            threats = sorted({_THREAT_LABELS.get(m.get('threatType'), m.get('threatType')) for m in matches})
            return {
                'host':      host,
                'url':       url,
                'available': True,
                'simulated': False,
                'flagged':   len(matches) > 0,
                'threats':   threats,
                'error':     None,
            }
        except ValueError as e:
            logger.error("Safe Browsing: error parseando respuesta para %s — %s", url, e)
            return self._simulate(host, url, error=f'Error parseando respuesta: {e}')
