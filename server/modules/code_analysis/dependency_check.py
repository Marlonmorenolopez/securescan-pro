"""
OWASP Dependency-Check Scanner (real)
Corre el binario real de OWASP Dependency-Check vía subprocess —
dependencias vulnerables, tercera fuente del Grupo 3 junto a Trivy
(OSV.dev ya no se usa, quedó reemplazado por estos dos).

ADVERTENCIA OPERATIVA IMPORTANTE, confirmada probando el binario real:
Dependency-Check necesita una base de datos NVD poblada para funcionar
-- ejecutarlo sin ella falla directo con "Autoupdate is disabled and the
database does not exist", incluso con --noupdate. La sincronización
inicial de esa base es lenta (puede tardar bastante) y sin una NVD API
Key (gratis, se pide en https://nvd.nist.gov/developers/request-an-api-key)
el rate limit de la API pública de NVD la hace todavía más lenta. Con
key configurada (NVD_API_KEY) es sensiblemente más rápido.

En la práctica: como Trivy YA cubre dependencias vulnerables (y es más
liviano, sin esta fricción de base de datos), Dependency-Check acá es
una SEGUNDA fuente para contrastar -- no la única. Si el tiempo de
arranque/sincronización no vale la pena para el proyecto, se puede
desactivar sin perder cobertura real (dependency_scanner.py + Trivy
siguen cubriendo el caso de uso principal).
"""

import json
import logging
import os
import shutil
import signal
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_BIN = 'dependency-check.sh'


class DependencyCheckScanner:
    """Wrapper del binario real de OWASP Dependency-Check."""

    def __init__(self, timeout: int = 10800, nvd_api_key: Optional[str] = None):
        self.timeout     = 10800  # Forzado a 10800s (300 minutos)
        self.nvd_api_key = nvd_api_key or os.getenv('NVD_API_KEY')
        self.available   = shutil.which(_BIN) is not None
        if not self.available:
            logger.warning("Dependency-Check: el binario '%s' no está instalado en el servidor.", _BIN)
        if not self.nvd_api_key:
            logger.info("Dependency-Check: sin NVD_API_KEY configurada -- la sincronización de la base va a ser más lenta.")

    def scan(self, root_path: str) -> Dict[str, Any]:
        """
        Corre Dependency-Check contra `root_path`.

        Returns:
            Dict con: findings (lista con file, package, vuln_id,
            severity, description), error.
        """
        root = Path(root_path)
        if not root.exists() or not root.is_dir():
            return {'findings': [], 'error': f'Directorio no encontrado: {root_path}'}

        if not self.available:
            return {'findings': [], 'error': 'Dependency-Check no está instalado en el servidor'}

        out_dir = tempfile.mkdtemp(prefix='depcheck-')

        cmd = [
            _BIN,
            '-s', str(root),
            '-f', 'JSON',
            '-o', out_dir,
            '--project', 'securescan-pro',
            '--disableVersionCheck',
            # FIX (prueba real): sin esto, Dependency-Check intenta
            # sincronizar/verificar la base NVD en CADA scan, aunque ya
            # esté horneada en el build (ver Dockerfile). Con datasets
            # grandes eso solo puede comerse buena parte del timeout de
            # 300s, incluso teniendo NVD_API_KEY configurada. Igual patrón
            # que --skip-db-update en Trivy — usa la base ya lista.
            # '--noupdate',
            # FIX (prueba real, ronda 2): --noupdate solo evita sincronizar
            # la base NVD -- pero varios analizadores de Dependency-Check
            # hacen SUS PROPIAS llamadas de red, sin importar --noupdate:
            # Node Audit Analyzer consulta la API de npm por CADA paquete
            # del árbol de dependencias (con un proyecto Node.js real, de
            # cientos de paquetes, esto solo ya se come el timeout
            # completo), Retire.js y OSS Index hacen lo mismo por su lado.
            # Como Trivy ya cubre dependencias vulnerables como fuente
            # principal (ver docstring de este archivo), acá se desactivan
            # estos analizadores online y se deja Dependency-Check
            # trabajando SOLO contra la base NVD ya horneada localmente.
            '--disableNodeAudit',
            '--disableRetireJs',
            '--disableOssIndex',
            '--disableCentral',
            # FIX (prueba real, ronda 3): incluso con --noupdate y los 4
            # analizadores online de arriba desactivados, Dependency-Check
            # 12.x sigue intentando descargar por su cuenta el archivo de
            # "Hosted Suppressions" (lista de falsos positivos conocidos)
            # -- esto NO lo cubre --noupdate, es un mecanismo separado.
            # Confirmado en pruebas reales: el scan seguía agotando el
            # timeout completo (642s) después de desactivar los 4
            # analizadores anteriores, señal de que quedaba una llamada de
            # red más colgándose contra un host bloqueado/lento.
            '--disableHostedSuppressions',
            # FIX (prueba real, ronda 4): equivalente a --disableNodeAudit
            # pero para el analizador de Yarn -- si el repo trae yarn.lock
            # en vez de package-lock.json, este analizador corre POR SU
            # CUENTA y hace su propia llamada de red, sin importar que
            # Node Audit ya esté desactivado. Confirmado en pruebas reales:
            # el timeout se repitió IDÉNTICO (600s) con un repo distinto,
            # lo que descarta "árbol de dependencias grande" como causa y
            # apunta de nuevo a una llamada de red sin bloquear.
            '--disableYarnAudit',
        ]
        if self.nvd_api_key:
            cmd += ['--nvdApiKey', self.nvd_api_key]

        try:
            try:
                # FIX (prueba real, ronda 5 -- causa raíz encontrada): antes se
                # usaba subprocess.run(cmd, timeout=...) directo. "dependency-
                # check.sh" es un script de shell que a su vez lanza su PROPIO
                # proceso Java por debajo -- cuando Python mataba por timeout,
                # solo mataba el script envoltorio, NO el proceso Java hijo,
                # que quedaba huérfano corriendo para siempre. Ese proceso
                # zombi mantenía tomado el candado exclusivo de la base de
                # datos local (H2) de Dependency-Check, así que CUALQUIER
                # intento posterior (sin importar el repo, sin importar qué
                # analizadores estuvieran desactivados) se quedaba esperando
                # ese candado indefinidamente. Confirmado en el log real:
                # "Sleeping thread main ... because an exclusive lock on the
                # database could not be obtained".
                #
                # Ahora se lanza el proceso en su PROPIO grupo de procesos
                # (start_new_session=True) y, si se agota el timeout, se mata
                # el grupo COMPLETO (proceso shell + proceso Java hijo) con
                # una señal, no solo el proceso de arriba.
                proc = subprocess.Popen(
                    cmd,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    start_new_session=True,
                )
                try:
                    stdout, stderr = proc.communicate(timeout=self.timeout)
                    result = subprocess.CompletedProcess(cmd, proc.returncode, stdout, stderr)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                    except ProcessLookupError:
                        pass  # ya había terminado justo al filo del timeout
                    proc.wait(timeout=5)
                    raise
            except subprocess.TimeoutExpired:
                return {'findings': [], 'error': f'Dependency-Check no terminó en {self.timeout}s (la sincronización de la base NVD puede tardar bastante la primera vez)'}
            except FileNotFoundError:
                return {'findings': [], 'error': 'Dependency-Check no está instalado en el servidor'}

            report_path = Path(out_dir) / 'dependency-check-report.json'
            if not report_path.exists():
                error_msg = (result.stderr or result.stdout or '').strip()[-300:] or 'Dependency-Check no generó reporte'
                logger.warning("Dependency-Check: %s", error_msg)
                return {'findings': [], 'error': error_msg}

            try:
                data = json.loads(report_path.read_text(encoding='utf-8'))
            except ValueError as e:
                return {'findings': [], 'error': f'Error parseando reporte de Dependency-Check: {e}'}

            findings: List[Dict[str, Any]] = []
            for dep in data.get('dependencies', []) or []:
                for vuln in dep.get('vulnerabilities', []) or []:
                    cvss = vuln.get('cvssv3') or vuln.get('cvssv2') or {}
                    findings.append({
                        'file':        dep.get('fileName'),
                        'package':     (dep.get('packages') or [{}])[0].get('id') if dep.get('packages') else dep.get('fileName'),
                        'vuln_id':     vuln.get('name'),
                        'severity':    (vuln.get('severity') or 'UNKNOWN').lower(),
                        'cvss_score':  cvss.get('baseScore'),
                        'description': (vuln.get('description') or '')[:250],
                    })

            return {'findings': findings, 'error': None}

        finally:
            shutil.rmtree(out_dir, ignore_errors=True)
