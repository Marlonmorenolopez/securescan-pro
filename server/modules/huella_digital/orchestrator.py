"""
Huella Digital Orchestrator — SecureScan Pro v5.1

Extraído de modules/pentesting/orchestrator.py (SecurityOrchestrator) durante
la migración de separación de categorías. Comportamiento preservado 1:1 —
solo se movió el código, no se reescribió ninguna herramienta ni se cambió
ningún default.

Responsable únicamente de las 7 fuentes de "Huella Digital" (Threat Intel):
VirusTotal, AbuseIPDB, Shodan, crt.sh, testssl.sh, dnstwist, Safe Browsing.
No depende de Pentesting ni de ninguna otra categoría — cada fuente consulta
reputación/exposición externa del target de forma independiente y corren en
paralelo entre sí (ThreadPoolExecutor), no en cadena.

Circuit breaker POR HERRAMIENTA (no por target, a diferencia del pipeline de
Pentesting) -- si VirusTotal empieza a fallar repetido (caído, rate limit),
deja de intentarlo por un rato para TODOS los targets. Sin redis_client,
self.intel_circuit_breaker queda en None y simplemente no hay protección.
"""

import logging
import os
from typing import Any, Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from modules.huella_digital.virustotal import VirusTotalScanner
from modules.huella_digital.abuseipdb import AbuseIPDBScanner
from modules.huella_digital.shodan import ShodanScanner
from modules.huella_digital.crtsh import CrtShScanner
from modules.huella_digital.testssl import TestSSLScanner
from modules.huella_digital.dnstwist import DnstwistScanner
from modules.huella_digital.safebrowsing import SafeBrowsingScanner
from modules.common.circuit_breaker import CircuitBreaker

logger = logging.getLogger(__name__)


class HuellaDigitalOrchestrator:
    """Orquesta las 7 fuentes de Huella Digital (Threat Intel), en paralelo."""

    TIMEOUTS = {
        'virustotal':   int(os.getenv('SCAN_TIMEOUT_VIRUSTOTAL', 30)),
        'abuseipdb':    int(os.getenv('SCAN_TIMEOUT_ABUSEIPDB', 30)),
        'shodan':       int(os.getenv('SCAN_TIMEOUT_SHODAN', 20)),
        'crtsh':        int(os.getenv('SCAN_TIMEOUT_CRTSH', 25)),
        'testssl':      int(os.getenv('SCAN_TIMEOUT_TESTSSL', 600)),
        'dnstwist':     int(os.getenv('SCAN_TIMEOUT_DNSTWIST', 3)),
        'safebrowsing': int(os.getenv('SCAN_TIMEOUT_SAFEBROWSING', 15)),
    }

    def __init__(self, redis_client=None):
        self.virustotal = VirusTotalScanner(
            api_key=os.getenv('VIRUSTOTAL_API_KEY'),
            timeout=self.TIMEOUTS['virustotal'],
        )
        self.abuseipdb = AbuseIPDBScanner(
            api_key=os.getenv('ABUSEIPDB_API_KEY'),
            timeout=self.TIMEOUTS['abuseipdb'],
        )
        self.shodan = ShodanScanner(
            timeout=self.TIMEOUTS['shodan'],
        )
        self.crtsh = CrtShScanner(
            timeout=self.TIMEOUTS['crtsh'],
        )
        self.testssl = TestSSLScanner(
            timeout=self.TIMEOUTS['testssl'],
        )
        self.dnstwist = DnstwistScanner(
            max_candidates=int(os.getenv('DNSTWIST_MAX_CANDIDATES', 300)),
            max_workers=int(os.getenv('DNSTWIST_MAX_WORKERS', 30)),
            dns_timeout=self.TIMEOUTS['dnstwist'],
        )
        self.safebrowsing = SafeBrowsingScanner(
            api_key=os.getenv('GOOGLE_SAFE_BROWSING_API_KEY'),
            timeout=self.TIMEOUTS['safebrowsing'],
        )

        self.intel_circuit_breaker = CircuitBreaker(
            redis_client, key_prefix='intel-tool',
            failure_threshold=int(os.getenv('INTEL_CB_FAILURE_THRESHOLD', 5)),
            recovery_timeout=int(os.getenv('INTEL_CB_RECOVERY_TIMEOUT', 300)),
        ) if redis_client is not None else None

        logger.info("HuellaDigitalOrchestrator initialized")

    def run_threat_intel(self, target: str, enabled_tools: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Ejecuta las herramientas de la pestaña "Huella Digital" en paralelo.

        Cada herramienta pasa primero por su propio circuit breaker: si
        lleva varios fallos seguidos, se omite (se marca como "abierto"
        en vez de intentar la llamada real) hasta que pase la ventana de
        recuperación.

        Args:
            enabled_tools: lista de claves a correr (ej. ['virustotal', 'crtsh']).
                None (default) = correr las 7, comportamiento de siempre.
                Lista vacía = no correr ninguna (se devuelve {} de una vez).

        Returns:
            Dict con una clave por herramienta, ej: {'virustotal': {...}}
        """
        intel_tasks = {
            'virustotal': lambda: self.virustotal.scan(target),
            'abuseipdb':  lambda: self.abuseipdb.scan(target),
            'shodan':     lambda: self.shodan.scan(target),
            'crtsh':      lambda: self.crtsh.scan(target),
            'testssl':    lambda: self.testssl.scan(target),
            'dnstwist':   lambda: self.dnstwist.scan(target),
            'safebrowsing': lambda: self.safebrowsing.scan(target),
        }

        if enabled_tools is not None:
            unknown = set(enabled_tools) - set(intel_tasks)
            if unknown:
                logger.warning("Huella Digital: se ignoran herramientas desconocidas: %s", unknown)
            intel_tasks = {name: fn for name, fn in intel_tasks.items() if name in enabled_tools}

        if not intel_tasks:
            return {}

        def _run_protected(tool_name: str, fn):
            cb = self.intel_circuit_breaker
            if cb and cb.is_open(tool_name):
                logger.warning("Huella Digital: breaker abierto para %s -- se omite esta corrida", tool_name)
                return {'available': False, 'simulated': True, 'error': f'{tool_name} tuvo varios fallos seguidos recientemente -- en pausa temporal'}
            try:
                result = fn()
            except Exception as e:
                if cb:
                    cb.record_failure(tool_name)
                raise
            # Se cuenta como fallo del breaker solo si la herramienta
            # estaba disponible (tenía key / no la necesita) pero igual
            # falló -- no cuando simplemente no hay API key configurada
            # o el target es un host interno (eso no es una falla real).
            if cb:
                if result.get('available') and result.get('simulated') and result.get('error'):
                    cb.record_failure(tool_name)
                else:
                    cb.record_success(tool_name)
            return result

        results: Dict[str, Any] = {}
        with ThreadPoolExecutor(max_workers=len(intel_tasks) or 1) as executor:
            future_to_name = {executor.submit(_run_protected, name, fn): name for name, fn in intel_tasks.items()}
            for future in as_completed(future_to_name):
                name = future_to_name[future]
                try:
                    results[name] = future.result()
                except Exception as e:
                    logger.error("Threat intel — %s falló: %s", name, e)
                    results[name] = {'available': False, 'simulated': True, 'error': str(e)}

        logger.info("run_threat_intel completado para %s → %s", target, list(results.keys()))
        return results
