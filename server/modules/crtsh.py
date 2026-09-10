"""
crt.sh Scanner Module
Descubrimiento de subdominios vía Certificate Transparency logs — cuarta
herramienta del grupo "Huella Digital" (Threat Intel).

Desde 2018, toda autoridad certificadora pública debe registrar los
certificados SSL/TLS que emite en logs de Certificate Transparency. Cada
certificado lista los hostnames para los que fue emitido (Subject
Alternative Names) -- eso permite descubrir subdominios que nunca
aparecerían en un escaneo activo, incluso subdominios viejos que ya no
resuelven a nada pero siguen filtrando información (ej. "staging.",
"admin-old.", "vpn-legacy.").

100% gratuito, sin API key -- es un servicio público sin fines de lucro,
así que este módulo agrega un User-Agent identificable y no reintenta
agresivo ante errores, para ser buen vecino del servicio.

Los certificados se emiten para HOSTNAMES, no para IPs -- así que si el
target ya es una IP pública, este módulo primero intenta un DNS reverso
(PTR) para encontrarle un hostname y buscar ese dominio en su lugar. Si
la IP no tiene PTR record (común en labs/entornos sin DNS configurado),
se informa claramente en vez de forzar un resultado sin sentido.
"""

import logging
import time
from typing import Any, Dict, List, Optional

import requests

from modules.intel_common import extract_host, is_ip, is_internal, reverse_dns

logger = logging.getLogger(__name__)

_API_URL = 'https://crt.sh/'


class CrtShScanner:
    """Wrapper de crt.sh — descubrimiento de subdominios vía Certificate Transparency."""

    def __init__(self, timeout: int = 25):
        self.timeout   = timeout
        self.available = True  # servicio público, sin key
        logger.info("crt.sh: servicio público, sin API key requerida.")

    # ── Helpers ────────────────────────────────────────────────────────────

    def _root_domain(self, host: str) -> str:
        """
        Simplifica a un dominio razonable para buscar en crt.sh. No hace
        parsing de Public Suffix List (ccTLDs compuestos como .co.uk
        quedarían mal recortados) -- suficiente para el caso de uso de
        escanear un solo target a la vez.
        """
        parts = host.split('.')
        if len(parts) <= 2:
            return host
        return '.'.join(parts[-2:])

    def _permalink(self, domain: str) -> str:
        return f'https://crt.sh/?q=%25.{domain}'

    def _simulate(self, host: str, domain: Optional[str] = None, error: Optional[str] = None,
                   resolved_from_ip: Optional[str] = None) -> Dict[str, Any]:
        """Resultado simulado para labs internos, IPs sin PTR, o cuando crt.sh no responde."""
        time.sleep(0.3)
        return {
            'host':              host,
            'domain':            domain or host,
            'available':         self.available,
            'simulated':         True,
            'subdomains':        [],
            'certificate_count': 0,
            'permalink':         self._permalink(domain or host),
            'resolved_from_ip':  resolved_from_ip,
            'error':             error,
        }

    # ── Scan ───────────────────────────────────────────────────────────────

    def scan(self, target: str) -> Dict[str, Any]:
        """
        Busca en crt.sh todos los certificados emitidos para el dominio
        del target, y extrae los subdominios listados en ellos. Si el
        target es una IP pública, primero intenta resolverla a un
        hostname vía DNS reverso.

        Returns:
            Dict con: host, domain, available, simulated, subdomains
            (lista ordenada, deduplicada), certificate_count, permalink,
            resolved_from_ip (IP original si se usó DNS reverso), error.
        """
        host = extract_host(target)
        if not host:
            return self._simulate(target, error='No se pudo extraer un host válido del target')

        if is_internal(host):
            logger.info("crt.sh: %s es un host interno/lab — se omite consulta real.", host)
            return self._simulate(host, host)

        resolved_from_ip = None
        if is_ip(host):
            original_ip = host
            resolved = reverse_dns(original_ip)
            if not resolved:
                logger.info("crt.sh: %s es una IP pública sin PTR record — nada que buscar.", original_ip)
                return self._simulate(
                    original_ip,
                    error='Esta IP no tiene un hostname asociado (sin registro PTR) — crt.sh indexa certificados por dominio, no por IP',
                )
            logger.info("crt.sh: %s resuelve por DNS reverso a %s — se busca ese dominio.", original_ip, resolved)
            host = resolved
            resolved_from_ip = original_ip

        domain = self._root_domain(host)

        try:
            resp = requests.get(
                _API_URL,
                params={'q': f'%.{domain}', 'output': 'json'},
                timeout=self.timeout,
                headers={'User-Agent': 'SecureScanPro/5.1 (+huella-digital)'},
            )
        except requests.RequestException as e:
            logger.warning("crt.sh: error de red consultando %s — %s", domain, e)
            return self._simulate(host, domain, error=f'Error de red: {e}', resolved_from_ip=resolved_from_ip)

        if resp.status_code == 429:
            logger.warning("crt.sh: rate limit alcanzado.")
            return self._simulate(host, domain, error='Rate limit de crt.sh alcanzado — intenta más tarde', resolved_from_ip=resolved_from_ip)

        if resp.status_code != 200:
            logger.warning("crt.sh: respuesta inesperada %s para %s", resp.status_code, domain)
            return self._simulate(host, domain, error=f'crt.sh respondió con status {resp.status_code}', resolved_from_ip=resolved_from_ip)

        try:
            entries: List[Dict] = resp.json()
        except ValueError:
            # crt.sh a veces devuelve un body vacío/no-JSON cuando no hay
            # resultados, en vez de "[]" -- se trata como 0 resultados, no error.
            logger.info("crt.sh: respuesta no-JSON para %s, se asume sin resultados.", domain)
            entries = []

        subdomains = set()
        for entry in entries:
            for name in entry.get('name_value', '').split('\n'):
                name = name.strip().lower()
                if name:
                    subdomains.add(name)

        return {
            'host':              host,
            'domain':            domain,
            'available':         True,
            'simulated':         False,
            'subdomains':        sorted(subdomains),
            'certificate_count': len(entries),
            'permalink':         self._permalink(domain),
            'resolved_from_ip':  resolved_from_ip,
            'error':             None,
        }
