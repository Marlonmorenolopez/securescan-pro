"""
dnstwist Scanner Module (real, vía la librería dnstwist)
Detección de dominios de typosquatting/phishing parecidos al target —
sexta herramienta del grupo "Huella Digital" (Threat Intel).

Este SÍ es el dnstwist real (paquete `dnstwist` de PyPI), no un
generador propio. Usa su Fuzzer real -- 14 técnicas, incluyendo
homoglyphs (letras que se ven casi iguales, ej. cirílico "а" en vez de
latina "a") y bitsquatting, que el generador anterior no tenía -- y su
Scanner real para resolver cuáles variantes están efectivamente
registradas.

Nota de escala: dnstwist genera CIENTOS o MILES de variantes por
dominio (ej. ~2965 para "google.com"). Resolverlas todas por DNS puede
tardar varios minutos incluso en paralelo -- se aplica un tope
(`max_candidates`) para mantener esto dentro de lo razonable para un
batch de Huella Digital que corre junto a otras 6 herramientas. El tope
prioriza mantener TODAS las técnicas representadas en vez de agotarlo
en una sola.

El typosquatting es un concepto de NOMBRES, así que no aplica directo a
una IP. Si el target es una IP pública, este módulo intenta primero un
DNS reverso (PTR) para encontrarle un hostname y generar variantes de
ESE dominio. Si no tiene PTR record, se informa con claridad.
"""

import logging
import queue as queue_module
import time
from typing import Any, Dict, List, Optional

import dnstwist as dnstwist_lib

from modules.intel_common import extract_host, is_ip, is_internal, reverse_dns

logger = logging.getLogger(__name__)

_SERVFAIL_MARKER = '!ServFail'


class DnstwistScanner:
    """Genera variantes de typosquatting reales (dnstwist) y verifica cuáles están registradas."""

    def __init__(self, max_candidates: int = 500, max_workers: int = 40, dns_timeout: float = 1.5):
        self.max_candidates = max_candidates  # tope para no volar el tiempo del batch paralelo
        self.max_workers    = max_workers
        self.dns_timeout    = dns_timeout
        self.available      = True  # sin API key, resolución DNS directa

    # ── Generación de variantes (dnstwist.Fuzzer real) ──────────────────────

    def _generate(self, domain: str) -> List[Dict[str, str]]:
        fuzzer = dnstwist_lib.Fuzzer(domain)
        fuzzer.generate()
        permutations = fuzzer.permutations()
        # El primero suele ser '*original' (el propio dominio) -- se excluye.
        permutations = [p for p in permutations if p.get('fuzzer') != '*original']

        if len(permutations) <= self.max_candidates:
            return permutations

        # Priorizar diversidad de técnicas en vez de agotar el tope en una
        # sola (ej. no llenarlo todo de "addition" y dejar sin cupo a
        # "homoglyph", que es la técnica más relevante para phishing real).
        by_technique: Dict[str, List[Dict]] = {}
        for p in permutations:
            by_technique.setdefault(p['fuzzer'], []).append(p)

        capped: List[Dict[str, str]] = []
        techniques = list(by_technique.keys())
        i = 0
        while len(capped) < self.max_candidates and any(by_technique.values()):
            technique = techniques[i % len(techniques)]
            if by_technique[technique]:
                capped.append(by_technique[technique].pop(0))
            i += 1
        return capped

    # ── Resolución (dnstwist.Scanner real) ──────────────────────────────────

    def _resolve_batch(self, permutations: List[Dict[str, str]]) -> List[Dict[str, str]]:
        if not permutations:
            return []

        jobs: "queue_module.Queue" = queue_module.Queue()
        for p in permutations:
            jobs.put(p)

        threads = []
        for _ in range(min(self.max_workers, len(permutations))):
            worker = dnstwist_lib.Scanner(jobs)
            worker.option_extdns = True  # activa la resolución DNS real (NS/A/AAAA)
            worker.daemon = True
            worker.start()
            threads.append(worker)

        jobs.join()
        for worker in threads:
            worker.stop()

        registered = []
        for p in permutations:
            dns_a = p.get('dns_a')
            if not dns_a or dns_a == [_SERVFAIL_MARKER]:
                continue  # sin registro A real, o error de resolución -- no cuenta
            registered.append({
                'domain':    p['domain'],
                'technique': p['fuzzer'],
                'ip':        dns_a[0],
            })
        return sorted(registered, key=lambda r: r['domain'])

    # ── Helpers de resultado ──────────────────────────────────────────────

    def _empty(self, host: str, error: Optional[str] = None, simulated: bool = True,
               resolved_from_ip: Optional[str] = None) -> Dict[str, Any]:
        if simulated:
            time.sleep(0.2)
        return {
            'host': host, 'domain': host, 'available': self.available, 'simulated': simulated,
            'candidates_checked': 0, 'registered_variants': [], 'permalink': None,
            'resolved_from_ip': resolved_from_ip, 'error': error,
        }

    # ── Scan ───────────────────────────────────────────────────────────────

    def scan(self, target: str) -> Dict[str, Any]:
        """
        Genera variantes REALES de typosquatting (dnstwist) del dominio
        del target y verifica cuáles ya están registradas. Si el target
        es una IP pública, primero intenta resolverla a un hostname vía
        DNS reverso.

        Returns:
            Dict con: host, domain, available, simulated, candidates_checked,
            registered_variants (lista de {domain, technique, ip}),
            permalink, resolved_from_ip, error.
        """
        host = extract_host(target)
        if not host:
            return self._empty(target, error='No se pudo extraer un host válido del target')

        if is_internal(host):
            logger.info("dnstwist: %s es un host interno/lab — se omite.", host)
            return self._empty(host)

        resolved_from_ip = None
        if is_ip(host):
            original_ip = host
            resolved = reverse_dns(original_ip)
            if not resolved:
                logger.info("dnstwist: %s es una IP pública sin PTR record — nada que generar.", original_ip)
                return self._empty(
                    original_ip,
                    error='Esta IP no tiene un hostname asociado (sin registro PTR) — dnstwist genera variantes de nombres de dominio, no aplica sin uno',
                )
            logger.info("dnstwist: %s resuelve por DNS reverso a %s — se generan variantes de ese dominio.", original_ip, resolved)
            host = resolved
            resolved_from_ip = original_ip

        try:
            candidates = self._generate(host)
        except Exception as e:
            logger.error("dnstwist: error generando variantes para %s — %s", host, e)
            return self._empty(host, error=f'Error generando variantes: {e}', resolved_from_ip=resolved_from_ip)

        try:
            registered = self._resolve_batch(candidates)
        except Exception as e:
            logger.error("dnstwist: error resolviendo variantes para %s — %s", host, e)
            return self._empty(host, error=f'Error resolviendo DNS: {e}', resolved_from_ip=resolved_from_ip)

        return {
            'host':                host,
            'domain':              host,
            'available':           True,
            'simulated':           False,
            'candidates_checked':  len(candidates),
            'registered_variants': registered,
            'permalink':           None,
            'resolved_from_ip':    resolved_from_ip,
            'error':               None,
        }
