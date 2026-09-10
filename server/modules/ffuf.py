"""
ffuf Scanner Module
Fuzzing de endpoints y rutas — funciona con cualquier URL

ffuf (Fuzz Faster U Fool) es un fuzzer web rápido escrito en Go.
Se usa para descubrir endpoints, rutas y archivos no documentados.

Estrategia:
  1. ffuf (binario Go, instalado en /usr/local/bin)
  2. _simulate_scan() SOLO si ffuf no está disponible en PATH

CORRECCIÓN: ya no hace fallback a simulación cuando ffuf corre pero
no encuentra nada — 0 resultados reales es un resultado válido.
Wordlist genérica usada para cualquier URL, no solo Juice Shop / DVWA.
"""

import subprocess
import json
import logging
import shutil
import os
import tempfile
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Wordlist genérica de rutas/endpoints comunes (aplicaciones web en general)
_COMMON_WORDS = [
    # Auth y usuarios
    'login', 'logout', 'signin', 'signup', 'register', 'auth', 'session',
    'password', 'reset', 'forgot', 'verify', 'activate',
    # API
    'api', 'v1', 'v2', 'v3', 'rest', 'graphql', 'rpc', 'ws',
    # Admin
    'admin', 'administrator', 'panel', 'dashboard', 'console', 'manage',
    'manager', 'backend', 'control', 'cp', 'wp-admin', 'phpmyadmin',
    # Usuarios y cuentas
    'user', 'users', 'profile', 'account', 'accounts', 'me', 'whoami',
    # Archivos sensibles
    '.env', '.git', '.htaccess', '.htpasswd', 'robots.txt', 'sitemap.xml',
    'config', 'config.php', 'config.json', 'settings', 'web.config',
    'wp-config.php', 'database.yml', 'secrets', 'credentials',
    # Debug y desarrollo
    'debug', 'test', 'dev', 'staging', 'demo', 'phpinfo.php', 'info.php',
    'server-status', 'server-info', 'status', 'health', 'ping', 'metrics',
    # Docs y APIs
    'docs', 'swagger', 'swagger-ui', 'openapi', 'api-docs', 'redoc',
    # Archivos
    'upload', 'uploads', 'files', 'images', 'media', 'static', 'assets',
    'backup', 'backups', 'dump', 'export', 'import', 'data',
    # Juice Shop específico
    'rest', 'basket', 'products', 'challenges', 'feedback', 'complaint',
    'track-order', 'wallet', 'memories', 'chatbot', 'data-export',
    'b2b', 'metrics', 'accounting', 'recycle',
    # DVWA específico
    'vulnerabilities', 'setup.php', 'phpinfo.php', 'dvwa',
    # WebGoat específico
    'WebGoat', 'actuator', 'jolokia',
    # Paths comunes adicionales
    'about', 'contact', 'help', 'support', 'terms', 'privacy',
    'search', 'feed', 'rss', 'blog', 'news', 'shop', 'store', 'cart',
]


class FfufScanner:
    """ffuf wrapper for web fuzzing and endpoint discovery — any URL."""

    def __init__(self, timeout: int = 120, threads: int = 40, rate: int = 100):
        self.timeout = timeout
        self.threads = threads
        self.rate = rate
        self.command = 'ffuf'
        self._available = self._check_availability()

    def _check_availability(self) -> bool:
        if not shutil.which(self.command):
            logger.warning("ffuf not found in PATH. Will use simulation mode.")
            return False
        return True

    def _validate_target(self, target: str) -> tuple:
        if not target or not isinstance(target, str):
            return False, "Target must be a non-empty string"
        if not target.startswith(('http://', 'https://')):
            target = f'http://{target}'
        try:
            parsed = urlparse(target)
            if not parsed.hostname:
                return False, "Invalid URL format"
        except Exception as e:
            return False, f"URL parsing error: {e}"
        return True, target

    def _write_wordlist(self, words: list, prefix: str) -> str:
        with tempfile.NamedTemporaryFile(
            mode='w', prefix=prefix, suffix='.txt', dir='/tmp', delete=False
        ) as f:
            f.write('\n'.join(words))
            return f.name

    def _find_system_wordlist(self) -> Optional[str]:
        """Busca wordlist disponible en el sistema."""
        candidates = [
            '/app/wordlist-common.txt',
            '/usr/share/wordlists/dirb/common.txt',
            '/usr/share/seclists/Discovery/Web-Content/common.txt',
            '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt',
            '/usr/share/wordlists/dirb/big.txt',
        ]
        for path in candidates:
            if os.path.isfile(path):
                logger.info("Using system wordlist: %s", path)
                return path
        return None

    def _parse_json_output(self, output: str) -> List[Dict[str, Any]]:
        """Parsea el output JSON de ffuf (-of json)."""
        endpoints = []
        try:
            data = json.loads(output)
            results = data.get('results', [])
            for r in results:
                status = r.get('status', 0)
                if status in (200, 201, 301, 302, 401, 403):
                    endpoints.append({
                        'endpoint': r.get('input', {}).get('FUZZ', r.get('url', '')),
                        'url': r.get('url', ''),
                        'status': status,
                        'length': r.get('length', 0),
                        'words': r.get('words', 0),
                    })
        except (json.JSONDecodeError, Exception) as e:
            logger.warning("ffuf JSON parse error: %s", e)
        return endpoints

    def _simulate_scan(self, target: str) -> List[Dict[str, Any]]:
        """Resultados simulados — SOLO cuando ffuf no está instalado."""
        logger.info("ffuf simulation mode for %s", target)
        t = target.lower()

        if 'juice' in t or '3001' in t:
            return [{
                'name': 'Endpoints API Juice Shop — 8 descubiertos',
                'description': 'ffuf descubrió endpoints API expuestos en Juice Shop.',
                'severity': 'high',
                'url': target,
                'endpoints': [
                    {'endpoint': '/rest/user/login', 'status': 200, 'length': 512},
                    {'endpoint': '/rest/products/search', 'status': 200, 'length': 4096},
                    {'endpoint': '/api/Challenges', 'status': 200, 'length': 8192},
                    {'endpoint': '/api/Users', 'status': 401, 'length': 64},
                    {'endpoint': '/rest/basket/1', 'status': 200, 'length': 256},
                    {'endpoint': '/metrics', 'status': 200, 'length': 1024},
                    {'endpoint': '/b2b/v2', 'status': 200, 'length': 128},
                    {'endpoint': '/rest/admin/application-configuration', 'status': 200, 'length': 2048},
                ],
                'tool': 'ffuf',
                'simulated': True,
            }]

        if 'dvwa' in t or '3002' in t:
            return [{
                'name': 'Directorios DVWA — 6 descubiertos',
                'description': 'ffuf descubrió directorios accesibles en DVWA.',
                'severity': 'medium',
                'url': target,
                'endpoints': [
                    {'endpoint': '/vulnerabilities/sqli', 'status': 302, 'length': 0},
                    {'endpoint': '/vulnerabilities/xss_r', 'status': 302, 'length': 0},
                    {'endpoint': '/setup.php', 'status': 200, 'length': 4096},
                    {'endpoint': '/phpinfo.php', 'status': 200, 'length': 75000},
                    {'endpoint': '/config', 'status': 403, 'length': 0},
                    {'endpoint': '/vulnerabilities/upload', 'status': 302, 'length': 0},
                ],
                'tool': 'ffuf',
                'simulated': True,
            }]

        return [{
            'name': 'ffuf no disponible — instalar en el contenedor',
            'description': 'ffuf no encontrado en PATH. Verificar instalación en el Dockerfile.',
            'severity': 'info',
            'url': target,
            'endpoints': [],
            'tool': 'ffuf',
            'simulated': True,
        }]

    def scan(
        self,
        target: str,
        fuzz_path: str = '/FUZZ',
        custom_headers: dict = None,
        cookie: str = None,
    ) -> List[Dict[str, Any]]:
        """
        Ejecuta ffuf para descubrir endpoints y rutas en cualquier URL.
        Usa wordlist genérica que cubre rutas comunes de cualquier aplicación web.

        Args:
            target    : URL base del objetivo (cualquier URL HTTP/HTTPS)
            fuzz_path : Path con FUZZ placeholder (default: /FUZZ)
        """
        is_valid, target = self._validate_target(target)
        if not is_valid:
            logger.error("Invalid target for ffuf: %s", target)
            return []

        if not self._available:
            return self._simulate_scan(target)

        # Usar wordlist del sistema si existe, sino la interna genérica
        system_wordlist = self._find_system_wordlist()
        wordlist_file = None
        out_file = tempfile.mktemp(suffix='.json', prefix='ffuf_out_', dir='/tmp')

        try:
            if system_wordlist:
                wordlist_path = system_wordlist
            else:
                wordlist_file = self._write_wordlist(_COMMON_WORDS, 'ffuf_words_')
                wordlist_path = wordlist_file

            fuzz_url = f"{target.rstrip('/')}{fuzz_path}"
            cmd = [
                self.command,
                '-u', fuzz_url,
                '-w', wordlist_path,
                '-of', 'json',
                '-o', out_file,
                '-t', str(self.threads),
                '-rate', str(self.rate),
                '-timeout', '5',
                '-mc', '200,201,301,302,401,403',
                '-fc', '404',
                '-s',                   # Modo silencioso
            ]

            logger.info("Running ffuf on %s", fuzz_url)
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )

            endpoints = []
            if os.path.exists(out_file):
                with open(out_file, 'r') as f:
                    json_output = f.read()
                endpoints = self._parse_json_output(json_output)

            logger.info("ffuf found %d endpoints on %s", len(endpoints), target)

            if endpoints:
                severity = 'high' if len(endpoints) > 5 else 'medium'
                return [{
                    'name': f'Endpoints descubiertos — {len(endpoints)} rutas',
                    'description': (
                        f"ffuf descubrió {len(endpoints)} rutas/endpoints en {target}. "
                        "Revisar si alguno expone información sensible o funcionalidad no intencionada."
                    ),
                    'severity': severity,
                    'url': target,
                    'endpoints': endpoints,
                    'tool': 'ffuf',
                    'simulated': False,
                }]
            else:
                # 0 resultados reales — no simular
                return [{
                    'name': 'Sin endpoints relevantes encontrados',
                    'description': (
                        f'ffuf no encontró rutas expuestas en {target} '
                        'con la wordlist usada.'
                    ),
                    'severity': 'info',
                    'url': target,
                    'endpoints': [],
                    'tool': 'ffuf',
                    'simulated': False,
                }]

        except subprocess.TimeoutExpired:
            logger.warning("ffuf timed out on %s", target)
            return [{
                'name': 'ffuf timeout',
                'description': f'ffuf superó el tiempo límite en {target}.',
                'severity': 'info',
                'url': target,
                'endpoints': [],
                'tool': 'ffuf',
                'simulated': False,
            }]
        except Exception as e:
            logger.error("ffuf error on %s: %s", target, e)
            return []
        finally:
            for f in [out_file, wordlist_file]:
                if f:
                    try:
                        os.unlink(f)
                    except Exception:
                        pass
