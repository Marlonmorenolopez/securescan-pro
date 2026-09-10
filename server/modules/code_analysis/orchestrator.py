"""
Code Scan Orchestrator
Junta los scanners del motor de análisis de código ("Análisis de
Código", Grupo 3) y corre contra un directorio local ya preparado
(clonado desde GitHub, o extraído de un archivo subido).

Corre 6 scanners en secuencia: Gitleaks + TruffleHog (secretos),
BackdoorScanner (heurística propia de webshells), Semgrep (SAST real --
SQLi, XSS, path traversal, etc.), y Trivy + Dependency-Check
(dependencias vulnerables). Todos operan sobre el mismo árbol de
archivos en disco.

A diferencia del orchestrator de Huella Digital (target remoto en vivo),
acá no hay llamadas de red que valga la pena paralelizar entre sí --
cada herramienta ya es rápida por su cuenta, salvo Semgrep (costo fijo
de cargar reglas) y Dependency-Check (depende de su base NVD).
"""

import logging
from typing import Any, Dict

from modules.code_analysis.backdoor_scanner import BackdoorScanner
from modules.code_analysis.gitleaks_scanner import GitleaksScanner
from modules.code_analysis.trufflehog_scanner import TruffleHogScanner
from modules.code_analysis.trivy_scanner import TrivyScanner
from modules.code_analysis.dependency_check import DependencyCheckScanner
from modules.code_analysis.semgrep_scanner import SemgrepScanner

logger = logging.getLogger(__name__)


class CodeScanOrchestrator:
    """Corre los scanners reales de análisis de código contra un directorio local."""

    def __init__(
        self,
        gitleaks_timeout: int = 120,
        trufflehog_timeout: int = 120,
        trufflehog_verify: bool = True,
        semgrep_timeout: int = 180,
        trivy_timeout: int = 120,
        trivy_image_timeout: int = 300,
        dependency_check_timeout: int = 300,
        nvd_api_key: str = None,
    ):
        self.gitleaks         = GitleaksScanner(timeout=gitleaks_timeout)
        self.trufflehog       = TruffleHogScanner(timeout=trufflehog_timeout, verify=trufflehog_verify)
        self.backdoors        = BackdoorScanner()
        self.semgrep          = SemgrepScanner(timeout=semgrep_timeout)
        self.trivy             = TrivyScanner(timeout=trivy_timeout, image_timeout=trivy_image_timeout)
        self.dependency_check = DependencyCheckScanner(timeout=dependency_check_timeout, nvd_api_key=nvd_api_key)

    def scan_directory(self, path: str) -> Dict[str, Any]:
        """
        Corre los 6 scanners contra `path` y arma un resumen agregado.

        Returns:
            Dict con: gitleaks, trufflehog, backdoors, semgrep, trivy,
            dependency_check (resultado de cada uno) y un resumen con
            conteos por severidad.
        """
        logger.info("CodeScanOrchestrator: iniciando análisis de %s", path)

        gitleaks_result         = self.gitleaks.scan(path)
        trufflehog_result       = self.trufflehog.scan(path)
        backdoors_result        = self.backdoors.scan(path)
        semgrep_result           = self.semgrep.scan(path)
        trivy_result             = self.trivy.scan(path)
        dependency_check_result = self.dependency_check.scan(path)

        summary = self._build_summary(
            gitleaks_result, trufflehog_result, backdoors_result,
            semgrep_result, trivy_result, dependency_check_result,
        )

        logger.info("CodeScanOrchestrator: análisis completo — %s", summary)

        return {
            'gitleaks':         gitleaks_result,
            'trufflehog':       trufflehog_result,
            'backdoors':        backdoors_result,
            'semgrep':          semgrep_result,
            'trivy':            trivy_result,
            'dependency_check': dependency_check_result,
            'summary':          summary,
        }

    def _build_summary(self, *results: Dict) -> Dict[str, int]:
        counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'unknown': 0}
        for result in results:
            for finding in result.get('findings', []):
                sev = finding.get('severity', 'unknown')
                counts[sev] = counts.get(sev, 0) + 1
        counts['total'] = sum(v for k, v in counts.items() if k != 'total')
        return counts
