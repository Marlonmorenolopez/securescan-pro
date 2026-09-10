"""
Gobuster Enterprise Scanner Module
===================================
Enumeración avanzada de directorios con capacidades empresariales.

Características:
- Detección dinámica de wordlists basada en tecnología
- Rate limiting adaptativo con detección de 429/503
- Filtrado por tamaño de respuesta (--exclude-length)
- Soporte para certificados SSL auto-firmados (-k)
- Captura de URLs de redirección (Location header)

CORRECCIONES:
  - FIX: _check_availability usa shutil.which en lugar de path hardcodeado
  - FIX: FALLBACK_CHAIN prioriza /app/wordlist-common.txt (existe en contenedor)
  - FIX: Extensiones desactivadas para Node.js/SPA (evita saturación)
  - FIX: __enter__/__exit__ duplicados eliminados
"""

import subprocess
import logging
import os
import shutil
import time
import re
import requests
import threading
from typing import List, Dict, Any, Optional, Union, Tuple, Set
from dataclasses import dataclass, field, asdict
from enum import Enum, auto
from urllib.parse import urlparse, urljoin
from pathlib import Path

logger = logging.getLogger(__name__)


class TechFingerprint(Enum):
    """Huellas digitales de tecnologías para selección de wordlists."""
    WORDPRESS = "wordpress"
    APACHE    = "apache"
    NGINX     = "nginx"
    IIS       = "iis"
    NODEJS    = "nodejs"
    DJANGO    = "django"
    LARAVEL   = "laravel"
    SPRING    = "spring"
    API_REST  = "api_rest"
    GENERIC   = "generic"


@dataclass
class WordlistProfile:
    """Perfil de wordlist para una tecnología específica."""
    name: str
    primary: str
    secondary: Optional[str] = None
    extensions: List[str] = field(default_factory=list)
    description: str = ""

    def get_paths(self) -> List[str]:
        """Retorna lista de paths de wordlists que EXISTEN en disco."""
        paths = []
        for wlist in [self.primary, self.secondary]:
            if wlist and os.path.exists(wlist):
                paths.append(wlist)
        return paths


@dataclass
class ScanResult:
    """Resultado estructurado de enumeración."""
    path: str
    status: int
    size: int
    type: str
    redirect_url: Optional[str] = None
    is_false_positive: bool = False
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# Wordlists por tecnología
WORDLIST_CATALOG = {
    TechFingerprint.WORDPRESS: WordlistProfile(
        name="WordPress",
        primary="/usr/share/wordlists/seclists/Discovery/Web-Content/CMS/wordpress.fuzz.txt",
        secondary="/usr/share/wordlists/dirb/common.txt",
        extensions=["php", "txt", "zip", "bak", "old", "orig"],
        description="WordPress specific paths including plugins, themes, and config files",
    ),
    TechFingerprint.APACHE: WordlistProfile(
        name="Apache / DVWA",
        primary="/app/wordlists/dvwa_wordlist.txt",
        secondary="/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt",
        extensions=["php", "txt", "bak", "old", "orig", "inc"],
        description="DVWA + Apache — rutas nativas del lab y extensiones PHP",
    ),
    TechFingerprint.NGINX: WordlistProfile(
        name="Nginx",
        primary="/usr/share/wordlists/dirbuster/directory-list-2.3-small.txt",
        secondary="/usr/share/wordlists/dirb/common.txt",
        extensions=["html", "php", "js", "css", "json"],
        description="Nginx optimized with static content focus",
    ),
    TechFingerprint.IIS: WordlistProfile(
        name="IIS",
        primary="/usr/share/wordlists/seclists/Discovery/Web-Content/IIS.fuzz.txt",
        secondary="/usr/share/wordlists/dirb/common.txt",
        extensions=["aspx", "asp", "config", "dll", "svc"],
        description="Microsoft IIS specific including ASPX and config files",
    ),
    TechFingerprint.NODEJS: WordlistProfile(
        name="Node.js",
        primary="/usr/share/wordlists/seclists/Discovery/Web-Content/NodeJS.fuzz.txt",
        secondary="/usr/share/wordlists/dirb/common.txt",
        extensions=[],  # FIX: sin extensiones para Node.js — evita saturación
        description="Node.js applications including API endpoints and source maps",
    ),
    TechFingerprint.DJANGO: WordlistProfile(
        name="Django",
        primary="/usr/share/wordlists/seclists/Discovery/Web-Content/django.txt",
        secondary="/usr/share/wordlists/dirb/common.txt",
        extensions=["py", "txt", "html", "json"],
        description="Django framework specific paths",
    ),
    TechFingerprint.LARAVEL: WordlistProfile(
        name="Laravel",
        primary="/usr/share/wordlists/seclists/Discovery/Web-Content/laravel.txt",
        secondary="/usr/share/wordlists/dirb/common.txt",
        extensions=["php", "env", "json", "xml"],
        description="PHP Laravel framework including env files",
    ),
    TechFingerprint.SPRING: WordlistProfile(
        name="Spring Boot / WebGoat",
        primary="/app/wordlists/webgoat_wordlist.txt",
        secondary="/usr/share/wordlists/seclists/Discovery/Web-Content/spring-boot.txt",
        extensions=["json", "xml", "yml", "properties", "mvc", "do"],
        description="WebGoat + Spring Boot actuator endpoints y configuración",
    ),
    TechFingerprint.API_REST: WordlistProfile(
        name="API REST",
        primary="/usr/share/wordlists/seclists/Discovery/Web-Content/api/api-endpoints.txt",
        secondary="/usr/share/wordlists/dirb/common.txt",
        extensions=[],  # FIX: sin extensiones para APIs — evita saturación
        description="REST API endpoints and documentation paths",
    ),
    TechFingerprint.GENERIC: WordlistProfile(
        name="Generic",
        primary="/usr/share/wordlists/dirb/common.txt",
        secondary="/usr/share/wordlists/dirbuster/directory-list-2.3-small.txt",
        extensions=["php", "html", "txt", "js", "css"],
        description="Generic web application enumeration",
    ),
}


class AdaptiveRateLimiter:
    """
    Limitador de tasa adaptativo que detecta 429/503 y ajusta dinámicamente.
    Implementa patrón de retroceso exponencial con jitter.
    """

    def __init__(self, initial_delay_ms: int = 0, max_delay_ms: int = 10000):
        self.current_delay_ms    = initial_delay_ms
        self.max_delay_ms        = max_delay_ms
        self.error_count         = 0
        self.success_count       = 0
        self._lock               = threading.Lock()
        self._consecutive_errors = 0

    def record_success(self):
        with self._lock:
            self.success_count += 1
            self._consecutive_errors = 0
            if self.success_count % 10 == 0 and self.current_delay_ms > 100:
                self.current_delay_ms = max(0, self.current_delay_ms - 100)
                logger.debug("Rate limiter: reduced delay to %dms", self.current_delay_ms)

    def record_rate_limit(self, status_code: int):
        with self._lock:
            self.error_count += 1
            self._consecutive_errors += 1
            import random
            base_delay = min(
                self.current_delay_ms * 2 + random.randint(50, 200),
                self.max_delay_ms,
            )
            self.current_delay_ms = base_delay
            logger.warning(
                "Rate limit detected (HTTP %d). Backing off: delay=%dms, consecutive=%d",
                status_code, self.current_delay_ms, self._consecutive_errors,
            )

    def get_delay(self) -> str:
        return f"{self.current_delay_ms}ms"

    def should_pause(self) -> bool:
        return self._consecutive_errors >= 5


class GobusterEnterpriseScanner:
    """
    Scanner empresarial de directorios con capacidades avanzadas.

    Features:
    - Detección automática de tecnología y selección de wordlist
    - Rate limiting adaptativo (anti-429/503)
    - Filtrado por tamaño de respuesta
    - Soporte SSL auto-firmado
    - Parsing completo de redirecciones
    """

    DEFAULT_TIMEOUT = 400
    DEFAULT_THREADS = 20
    MAX_RETRIES     = 2

    def __init__(
        self,
        threads: int          = DEFAULT_THREADS,
        timeout: int          = DEFAULT_TIMEOUT,
        initial_delay_ms: int = 0,
        skip_ssl_verify: bool = False,
        follow_redirects: bool = False,
        auto_tech_detect: bool = True,
    ):
        self.threads          = max(1, min(threads, 50))
        self.timeout          = timeout
        self.skip_ssl_verify  = skip_ssl_verify
        self.follow_redirects = follow_redirects
        self.auto_tech_detect = auto_tech_detect

        self._rate_limiter = AdaptiveRateLimiter(initial_delay_ms)
        self._headers: dict = {}
        self._command       = 'gobuster'

        # FIX: usar shutil.which — busca en todo el PATH incluyendo /go/bin
        self._available = self._check_availability()

        self._exclude_lengths:       Set[int]            = set()
        self._exclude_length_ranges: List[Tuple[int,int]] = []

        self._tech_fingerprint: TechFingerprint = TechFingerprint.GENERIC
        self._baseline_size:   Optional[int]    = None
        self._server_header:   Optional[str]    = None

    # ── Disponibilidad ────────────────────────────────────────────────────────

    def _check_availability(self) -> bool:
        """
        FIX: usa shutil.which en lugar de path hardcodeado /usr/bin/gobuster.
        Go instala en /go/bin/ que está en PATH pero no en /usr/bin/.
        """
        path = shutil.which(self._command)
        if not path:
            logger.warning("Gobuster not found in PATH")
            return False
        logger.info("Gobuster found at: %s", path)
        return True

    # ── Probe inicial ─────────────────────────────────────────────────────────

    def _probe_target(self, target: str) -> Dict[str, Any]:
        probe_data = {
            'tech': TechFingerprint.GENERIC,
            'baseline_size': None,
            'server': None,
            'wildcard': False,
            'is_spa': False,
        }

        try:
            headers = {
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection':      'keep-alive',
            }
            verify_ssl = not self.skip_ssl_verify

            resp_valid = requests.get(
                target, headers=headers, timeout=10,
                verify=verify_ssl, allow_redirects=self.follow_redirects,
            )

            server     = resp_valid.headers.get('Server', '').lower()
            powered_by = resp_valid.headers.get('X-Powered-By', '').lower()
            probe_data['server'] = server

            if 'wordpress' in resp_valid.text.lower() or 'wp-content' in resp_valid.text:
                probe_data['tech'] = TechFingerprint.WORDPRESS
            elif 'django' in powered_by or 'csrftoken' in resp_valid.text.lower():
                probe_data['tech'] = TechFingerprint.DJANGO
            elif 'laravel' in powered_by or 'laravel_session' in resp_valid.cookies:
                probe_data['tech'] = TechFingerprint.LARAVEL
            elif 'iis' in server or 'microsoft' in server:
                probe_data['tech'] = TechFingerprint.IIS
            elif 'nginx' in server:
                probe_data['tech'] = TechFingerprint.NGINX
            elif 'apache' in server:
                probe_data['tech'] = TechFingerprint.APACHE
            elif 'express' in powered_by or 'node' in powered_by:
                probe_data['tech'] = TechFingerprint.NODEJS
            elif 'spring' in powered_by or 'x-application-context' in resp_valid.headers:
                probe_data['tech'] = TechFingerprint.SPRING
            elif '/api/' in target or 'swagger' in resp_valid.text.lower():
                probe_data['tech'] = TechFingerprint.API_REST

            import uuid
            for _ in range(2):
                random_path = str(uuid.uuid4()).replace('-', '')[:20]
                resp_random = requests.get(
                    f"{target}/{random_path}", headers=headers, timeout=10,
                    verify=verify_ssl, allow_redirects=self.follow_redirects,
                )
                if resp_random.status_code == 200:
                    probe_data['wildcard']      = True
                    probe_data['is_spa']        = True
                    probe_data['baseline_size'] = len(resp_random.content)
                    logger.info("SPA/Wildcard detected, baseline size: %d", probe_data['baseline_size'])
                    break
                elif resp_random.status_code == 404:
                    probe_data['baseline_size'] = len(resp_random.content)

            if probe_data['baseline_size']:
                logger.info("Consistent baseline size: %d", probe_data['baseline_size'])

        except requests.exceptions.SSLError as e:
            logger.warning("SSL Error during probe: %s", e)
        except Exception as e:
            logger.debug("Probe error (non-critical): %s", e)

        return probe_data

    # ── Selección de wordlist ─────────────────────────────────────────────────

    def _select_wordlist(self, tech: TechFingerprint) -> WordlistProfile:
        profile         = WORDLIST_CATALOG.get(tech, WORDLIST_CATALOG[TechFingerprint.GENERIC])
        available_paths = profile.get_paths()
        if not available_paths:
            logger.warning("Wordlist for %s not found, falling back to generic", tech.value)
            return WORDLIST_CATALOG[TechFingerprint.GENERIC]
        logger.info("Selected wordlist profile: %s", profile.name)
        return profile

    # ── Exclude-length ────────────────────────────────────────────────────────

    def set_exclude_lengths(self, lengths: Union[int, List[int], str]):
        self._exclude_lengths.clear()
        self._exclude_length_ranges.clear()

        if isinstance(lengths, int):
            self._exclude_lengths.add(lengths)
        elif isinstance(lengths, list):
            self._exclude_lengths.update(lengths)
        elif isinstance(lengths, str):
            for part in lengths.split(','):
                part = part.strip()
                if '-' in part:
                    start, end = part.split('-', 1)
                    self._exclude_length_ranges.append((int(start), int(end)))
                else:
                    self._exclude_lengths.add(int(part))

        logger.info("Excluding lengths: %s, ranges: %s",
                    self._exclude_lengths, self._exclude_length_ranges)

    def _build_exclude_length_flag(self) -> Optional[str]:
        parts = [str(l) for l in self._exclude_lengths]
        parts += [f"{s}-{e}" for s, e in self._exclude_length_ranges]
        return ','.join(parts) if parts else None

    # ── Validación ────────────────────────────────────────────────────────────

    def _validate_target(self, target: str) -> Tuple[bool, str]:
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
        return True, target.rstrip('/')

    # ── Parser output ─────────────────────────────────────────────────────────

    def _parse_output(self, output: str) -> List[ScanResult]:
        results    = []
        seen       = set()
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

        patterns = [
            r'^(?P<path>\S+)\s+\(Status:\s*(?P<status>\d+)\)\s+\[Size:\s*(?P<size>\d+)\](?:\s+\[-->\s*(?P<redirect>[^\]]+)\])?$',
            r'^(?P<path>\S+)\s+\[Status:\s*(?P<status>\d+)(?:,\s*Size:\s*(?P<size>\d+))?(?:[^\]]*)\]$',
        ]

        WIN_DEVICES = {
            "com1","com2","com3","com4","com5","com6","com7","com8","com9",
            "lpt1","lpt2","lpt3","lpt4","lpt5","lpt6","lpt7","lpt8","lpt9",
            "con","nul","prn","aux",
        }

        for line in output.strip().split('\n'):
            line = ansi_escape.sub('', line).strip()
            if not line or line.startswith('=') or 'Gobuster' in line:
                continue

            for pattern in patterns:
                match = re.match(pattern, line)
                if match:
                    try:
                        path     = match.group('path')
                        status   = int(match.group('status'))
                        size     = int(match.group('size') or 0)
                        redirect = (match.group('redirect').strip()
                                    if 'redirect' in match.groupdict() and match.group('redirect')
                                    else None)

                        if path in seen:
                            continue
                        seen.add(path)

                        is_fp = self._is_false_positive_by_size(size)

                        spa_baseline = getattr(self, '_spa_baseline', None)
                        if spa_baseline and size == spa_baseline:
                            is_fp = True

                        if path.strip('/').lower() in WIN_DEVICES:
                            is_fp = True

                        results.append(ScanResult(
                            path=path, status=status, size=size,
                            type=self._classify_result(path, status),
                            redirect_url=redirect,
                            is_false_positive=is_fp,
                        ))
                        break
                    except (ValueError, IndexError) as e:
                        logger.debug("Parse error for line: %s — %s", line, e)
                        continue

        return results

    def _classify_result(self, path: str, status: int) -> str:
        if status in [301, 302, 307, 308]:
            return 'redirect'
        elif status == 403:
            return 'forbidden'
        elif status == 401:
            return 'protected'
        elif status == 404:
            return 'not_found'
        elif status >= 500:
            return 'error'
        elif path.endswith(('.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl')):
            return 'script'
        elif path.endswith(('.html', '.htm')):
            return 'html'
        elif path.endswith(('.js', '.css', '.png', '.jpg', '.gif', '.ico', '.svg')):
            return 'static'
        elif '.' not in path.split('/')[-1]:
            return 'directory'
        else:
            return 'file'

    def _is_false_positive_by_size(self, size: int) -> bool:
        if size in self._exclude_lengths:
            return True
        for start, end in self._exclude_length_ranges:
            if start <= size <= end:
                return True
        return False

    # ── Construcción del comando ──────────────────────────────────────────────

    def _build_command(self, target: str, wordlist: str,
                       extensions: Optional[List[str]] = None) -> List[str]:
        import tempfile
        self._output_file = tempfile.mktemp(suffix='.txt', prefix='gobuster_')

        cmd = [
            self._command, 'dir',
            '-u', target,
            '-w', wordlist,
            '-t', str(self.threads),
            '-q',
            '--no-progress',
            '--no-error',
            '--timeout', '30s',
            '-o', self._output_file,
        ]

        if self.skip_ssl_verify:
            cmd.append('-k')

        if self.follow_redirects:
            cmd.append('-r')

        delay = self._rate_limiter.get_delay()
        if delay != '0ms':
            cmd.extend(['--delay', delay])

        exclude_length = self._build_exclude_length_flag()
        if exclude_length:
            cmd.extend(['--exclude-length', exclude_length])
        else:
            # FIX: excluir size=0 por defecto — evita error con redirects vacíos
            cmd.extend(['--exclude-length', '0'])

        if extensions:
            clean_exts = [ext.lstrip('.') for ext in extensions if ext]
            if clean_exts:
                cmd.extend(['-x', ','.join(clean_exts)])

        return cmd

    # ── Ejecución con reintentos ──────────────────────────────────────────────

    def _execute_with_retry(self, cmd: List[str],
                             timeout: int) -> Tuple[bool, str, str]:
        for attempt in range(self.MAX_RETRIES):
            try:
                logger.debug("Executing (attempt %d): %s", attempt + 1, ' '.join(cmd))

                result = subprocess.run(
                    cmd, capture_output=True, text=True, timeout=timeout,
                )

                output_combined = result.stdout + result.stderr

                if '429' in output_combined or 'Too Many Requests' in output_combined:
                    self._rate_limiter.record_rate_limit(429)
                    if self._rate_limiter.should_pause():
                        logger.warning("Too many rate limit errors, pausing scan")
                        time.sleep(5)
                    continue

                if '503' in output_combined or 'Service Unavailable' in output_combined:
                    self._rate_limiter.record_rate_limit(503)
                    continue

                if result.returncode == 0 or result.stdout.strip():
                    return True, result.stdout, result.stderr

                return False, result.stdout, result.stderr

            except subprocess.TimeoutExpired:
                logger.warning("Gobuster timeout en intento %d — leyendo resultados parciales",
                               attempt + 1)
                output_file = getattr(self, '_output_file', None)
                if output_file and os.path.exists(output_file):
                    partial = Path(output_file).read_text(errors='ignore')
                    if partial.strip():
                        logger.info("Resultados parciales: %d bytes", len(partial))
                        return True, partial, 'partial_timeout'
                continue

        return False, '', 'Max retries exceeded'

    # ── Scan principal ────────────────────────────────────────────────────────

    def scan(
        self,
        target: str,
        wordlist: Optional[str] = None,
        extensions: Optional[List[str]] = None,
        custom_headers: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        start_time = time.time()

        is_valid, result = self._validate_target(target)
        if not is_valid:
            logger.error(result)
            return []
        target = result

        if not self._available:
            logger.error("Gobuster not available")
            return []

        # Probe inicial
        probe_data = {}
        if self.auto_tech_detect:
            logger.info("Probing target: %s", target)
            probe_data             = self._probe_target(target)
            self._tech_fingerprint = probe_data.get('tech', TechFingerprint.GENERIC)
            self._baseline_size    = probe_data.get('baseline_size')
            self._server_header    = probe_data.get('server')

            if self._baseline_size and not self._exclude_lengths:
                if probe_data.get('wildcard') or probe_data.get('is_spa'):
                    self._spa_mode     = True
                    self._spa_baseline = self._baseline_size
                    b = self._baseline_size
                    self.set_exclude_lengths(f"{max(0, b-5)}-{b+5}")
                    logger.info("SPA/Wildcard — excluyendo rango %d-%d", max(0, b-5), b+5)
                else:
                    self._spa_mode = False
                    self.set_exclude_lengths(self._baseline_size)
                    logger.info("Auto-configured exclude-length: %d", self._baseline_size)

        # Seleccionar wordlist
        if wordlist:
            wordlist_path = wordlist
        else:
            profile = self._select_wordlist(self._tech_fingerprint)
            paths   = profile.get_paths()
            wordlist_path = paths[0] if paths else '/app/wordlist-common.txt'

            # FIX: no agregar extensiones para Node.js/SPA/API — evita saturación
            is_spa_or_node = (
                probe_data.get('wildcard') or
                probe_data.get('is_spa') or
                self._tech_fingerprint in (TechFingerprint.NODEJS, TechFingerprint.API_REST)
            )
            if not extensions and profile.extensions and not is_spa_or_node:
                extensions = profile.extensions

        # FIX: FALLBACK_CHAIN prioriza rutas que existen en el contenedor
        FALLBACK_CHAIN = [
            '/app/wordlist-common.txt',                                       # ✅ existe
            '/usr/share/wordlists/dirb/common.txt',                           # symlink a SecLists
            wordlist_path,
            '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt',
            '/usr/share/wordlists/dirbuster/directory-list-2.3-small.txt',
            '/usr/share/wordlists/seclists/Discovery/Web-Content/common.txt',
        ]
        resolved = next((w for w in FALLBACK_CHAIN if os.path.exists(w)), None)
        if not resolved:
            logger.error("No wordlist disponible en ninguna ruta conocida")
            return []
        if resolved != wordlist_path:
            logger.warning("Wordlist no encontrada: %s — usando fallback: %s",
                           wordlist_path, resolved)
        wordlist_path = resolved

        # Construir y ejecutar
        cmd = self._build_command(target, wordlist_path, extensions)

        if custom_headers:
            for key, value in custom_headers.items():
                cmd.extend(['-H', f"{key}: {value}"])

        logger.info("Starting scan: %s | Tech: %s | Threads: %d | Delay: %s",
                    target, self._tech_fingerprint.value,
                    self.threads, self._rate_limiter.get_delay())

        success, stdout, stderr = self._execute_with_retry(cmd, self.timeout)

        # Leer output file
        output_text = ''
        output_file = getattr(self, '_output_file', None)
        if output_file and os.path.exists(output_file):
            try:
                output_text = Path(output_file).read_text(errors='ignore')
                os.unlink(output_file)
                logger.debug("Gobuster output file: %d bytes", len(output_text))
            except Exception as e:
                logger.debug("Error leyendo output file: %s", e)

        if not output_text.strip():
            output_text = stdout

        if not success and not output_text.strip():
            logger.error("Scan failed: %s", stderr)
            return []

        results = self._parse_output(output_text)

        if self.follow_redirects:
            for r in results:
                if r.redirect_url and not r.redirect_url.startswith('http'):
                    r.redirect_url = urljoin(target, r.redirect_url)

        elapsed = time.time() - start_time
        logger.info("Scan completed in %.1fs | Found: %d items | Rate limit errors: %d",
                    elapsed, len(results), self._rate_limiter.error_count)

        return [r.to_dict() for r in results]

    # ── Métodos auxiliares ────────────────────────────────────────────────────

    def quick_scan(self, target: str) -> List[Dict[str, Any]]:
        original_threads = self.threads
        original_delay   = self._rate_limiter.current_delay_ms
        self.threads = 20
        self._rate_limiter.current_delay_ms = 0
        try:
            profile = WORDLIST_CATALOG[TechFingerprint.GENERIC]
            wl      = profile.get_paths()
            return self.scan(target, wordlist=wl[0] if wl else '/app/wordlist-common.txt')
        finally:
            self.threads = original_threads
            self._rate_limiter.current_delay_ms = original_delay

    def deep_scan(self, target: str) -> List[Dict[str, Any]]:
        all_results = []
        seen_paths  = set()

        probe_data = self._probe_target(target)
        tech       = probe_data.get('tech', TechFingerprint.GENERIC)
        profile    = self._select_wordlist(tech)
        paths      = profile.get_paths()

        if not paths:
            logger.warning("deep_scan: no wordlist disponible")
            return []

        for r in self.scan(target, wordlist=paths[0], extensions=profile.extensions):
            if r['path'] not in seen_paths:
                seen_paths.add(r['path'])
                all_results.append(r)

        if profile.secondary and os.path.exists(profile.secondary):
            logger.info("Running secondary wordlist pass")
            for r in self.scan(target, wordlist=profile.secondary, extensions=profile.extensions):
                if r['path'] not in seen_paths:
                    seen_paths.add(r['path'])
                    all_results.append(r)

        return all_results

    def get_tech_fingerprint(self) -> str:
        return self._tech_fingerprint.value

    def get_rate_limit_stats(self) -> Dict[str, Any]:
        return {
            'current_delay_ms':   self._rate_limiter.current_delay_ms,
            'error_count':        self._rate_limiter.error_count,
            'success_count':      self._rate_limiter.success_count,
            'consecutive_errors': self._rate_limiter._consecutive_errors,
        }

    # FIX: __enter__/__exit__ sin duplicados
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False


# ── Funciones de conveniencia ─────────────────────────────────────────────────

def create_scanner(
    skip_ssl: bool    = False,
    auto_detect: bool = True,
    threads: int      = 10,
) -> GobusterEnterpriseScanner:
    return GobusterEnterpriseScanner(
        threads=threads,
        skip_ssl_verify=skip_ssl,
        auto_tech_detect=auto_detect,
    )


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)

    with create_scanner(skip_ssl=True) as scanner:
        results = scanner.scan('http://juice-shop:3000')
        for r in results:
            print(f"{r['path']} - {r['status']} - {r['type']}")
            if r.get('redirect_url'):
                print(f"  -> {r['redirect_url']}")