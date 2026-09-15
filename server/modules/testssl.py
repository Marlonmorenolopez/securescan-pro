"""
TLS/SSL Scanner Module (testssl.sh real)
Verificación TLS/SSL del target vía el binario real de testssl.sh —
quinta herramienta del grupo "Huella Digital" (Threat Intel).

Este SÍ es testssl.sh real (instalado en el Dockerfile vía git clone),
no el equivalente ligero en Python puro que había antes. La diferencia
que importa: este prueba vulnerabilidades con nombre propio (Heartbleed,
POODLE, BEAST, CRIME, FREAK, Logjam, ROBOT, Sweet32...) además de
protocolos y configuración del certificado -- el equivalente anterior
solo miraba el protocolo/cifrado negociado en una conexión, sin probar
ninguna vulnerabilidad específica.

Dependencias de sistema que testssl.sh necesita y que NO son obvias
(encontradas corriendo el binario real, no por documentación):
  - hexdump (paquete bsdmainutils)  -- error fatal sin esto
  - dig/host (paquete dnsutils)     -- error fatal sin esto
Ambas ya están en el Dockerfile.

Detalle crítico de invocación: testssl.sh se cuelga indefinidamente si
su stdin queda conectado a algo que no sea /dev/null en un entorno no
interactivo (confirmado empíricamente) -- por eso `stdin=subprocess.DEVNULL`
más abajo no es opcional.

Se usan las banderas -U (vulnerabilidades), -S (defaults del servidor +
certificado) y -p (protocolos) -- se omite -e/--each-cipher (prueba cada
cifrado local uno por uno contra el servidor) porque es, por lejos, la
parte más lenta y la que menos aporta para un dashboard de reconocimiento.

Igual que el equivalente anterior: esto se conecta DIRECTO al target, no
consulta ninguna base de datos externa -- por eso sí tiene sentido correr
esto contra labs internos como DVWA (127.0.0.1).
"""

import json
import logging
import os
import shutil
import signal
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

from modules.intel_common import extract_host, extract_port

logger = logging.getLogger(__name__)

_TESTSSL_BIN = 'testssl.sh'

# Severidades que testssl.sh puede reportar. Solo las que no son puramente
# informativas cuentan como "advertencia" en el panel.
_WARNING_SEVERITIES = {'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'WARN', 'FATAL'}


class TestSSLScanner:
    """Wrapper del testssl.sh real — protocolos, vulnerabilidades con nombre propio, certificado."""

    def __init__(self, timeout: int = 90):
        self.timeout   = timeout
        self.available = shutil.which(_TESTSSL_BIN) is not None
        if not self.available:
            logger.warning("TestSSL: el binario 'testssl.sh' no está instalado en el servidor.")

    def _empty(self, host: str, port: int, error: Optional[str] = None, simulated: bool = True) -> Dict[str, Any]:
        return {
            'host': host, 'port': port, 'available': self.available, 'simulated': simulated,
            'tls_enabled': False, 'protocols': [], 'vulnerabilities': [], 'server_defaults': [],
            'warnings': [], 'scan_time': None, 'error': error,
        }

    def _extract_section(self, host_block: dict, key: str) -> List[Dict[str, Any]]:
        return [
            {'id': item.get('id'), 'severity': item.get('severity'), 'finding': item.get('finding'),
             'cve': item.get('cve'), 'cwe': item.get('cwe')}
            for item in host_block.get(key, [])
        ]

    def scan(self, target: str) -> Dict[str, Any]:
        """
        Corre testssl.sh real contra el target.

        Returns:
            Dict con: host, port, available, simulated, tls_enabled,
            protocols, vulnerabilities (con CVE/CWE cuando aplica),
            server_defaults (incluye certificado), warnings (resumen de
            todo lo que no es informativo), scan_time, error.
        """
        host = extract_host(target)
        if not host:
            return self._empty(target, 443, error='No se pudo extraer un host válido del target')

        port = extract_port(target)

        if not self.available:
            return self._empty(host, port, error='testssl.sh no está instalado en el servidor')

        workdir   = tempfile.mkdtemp(prefix='testssl-')
        json_path = os.path.join(workdir, 'result.json')

        try:
            try:
                # FIX: mismo patrón que dependency_check.py -- testssl.sh es
                # un script de shell que lanza openssl por debajo. Sin esto,
                # un timeout solo mataba el script, dejando el proceso
                # openssl huérfano corriendo de fondo.
                proc = subprocess.Popen(
                    [
                        _TESTSSL_BIN,
                        '--quiet', '--warnings=off', '--color', '0',
                        '-U', '-S', '-p',
                        '--jsonfile-pretty', json_path,
                        f'{host}:{port}',
                    ],
                    stdin=subprocess.DEVNULL,  # sin esto, testssl.sh se cuelga indefinidamente
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    start_new_session=True,
                )
                try:
                    proc.communicate(timeout=self.timeout)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    proc.wait(timeout=5)
                    raise
            except subprocess.TimeoutExpired:
                return self._empty(host, port, error=f'testssl.sh no terminó en {self.timeout}s', simulated=False)
            except FileNotFoundError:
                return self._empty(host, port, error='testssl.sh no está instalado en el servidor')

            if not os.path.exists(json_path):
                return self._empty(host, port, error='testssl.sh no generó resultados (probablemente sin TLS en este puerto)', simulated=False)

            try:
                with open(json_path, encoding='utf-8') as f:
                    data = json.load(f)
            except (ValueError, OSError) as e:
                return self._empty(host, port, error=f'No se pudo leer el resultado de testssl.sh: {e}', simulated=False)

            # scanResult mezcla entradas sueltas (ej. DNS_HTTPS_rrecord) con el
            # bloque real del host, identificable porque trae "targetHost".
            host_block = next((e for e in data.get('scanResult', []) if 'targetHost' in e), None)

            if host_block is None:
                loose = [e for e in data.get('scanResult', []) if e.get('id') == 'scanProblem']
                error_msg = loose[0]['finding'] if loose else 'Sin TLS en este puerto o no se pudo conectar'
                logger.info("TestSSL: sin bloque de host para %s:%s — %s", host, port, error_msg)
                return self._empty(host, port, error=error_msg, simulated=False)

            protocols       = self._extract_section(host_block, 'protocols')
            vulnerabilities = self._extract_section(host_block, 'vulnerabilities')
            server_defaults = self._extract_section(host_block, 'serverDefaults')

            warnings = [
                f"{item['id']}: {item['finding']}"
                for section in (protocols, vulnerabilities, server_defaults)
                for item in section
                if item.get('severity') in _WARNING_SEVERITIES
            ]

            return {
                'host':            host,
                'port':            port,
                'available':       True,
                'simulated':       False,
                'tls_enabled':     True,
                'protocols':       protocols,
                'vulnerabilities': vulnerabilities,
                'server_defaults': server_defaults,
                'warnings':        warnings,
                'scan_time':       data.get('scanTime'),
                'error':           None,
            }
        finally:
            shutil.rmtree(workdir, ignore_errors=True)
