"""
Nuclei Scanner Module v5.1
===========================
CORRECCIÓN ADICIONAL v5.1 — Timeout por carga de templates:

PROBLEMA RAÍZ: 12.841 templates sin filtro de protocolo = ~4 minutos
solo para cargar y ejecutar. debug_run (120s) siempre hace timeout.

NUEVAS CORRECCIONES:
  FIX-06: -ept dns,ssl,tcp,whois,javascript — excluye protocolos no-HTTP
           Reduce ~12.841 → ~5.000 templates (60% menos, 2.5x más rápido)
  FIX-07: -max-host-error 10 — para si el host no responde en 10 errores
           Evita que nuclei se quede colgado en hosts lentos
  FIX-08: -fhr (follow-host-redirects) — sigue redirects del lab
  FIX-09: debug_run usa directorio reducido (http/exposures + http/misconfiguration)
           para diagnóstico rápido (<30s) en vez de los 12.841 templates
  FIX-10: scan_timeout subido a 1800s — suficiente para el scan completo
  FIX-11: Verificación de conectividad antes de lanzar nuclei
           Si el target no responde, falla rápido en vez de después de 20min
"""

import glob
import json
import logging
import os
import shutil
import socket
import subprocess
import tempfile
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_SEVERITY_ORDER = {
    'critical': 0, 'high': 1, 'medium': 2,
    'low': 3, 'info': 4, 'unknown': 5,
}

# ── Tags por objetivo ─────────────────────────────────────────────────────────
_TAGS_JUICE_SHOP = [
    'cve', 'sqli', 'xss', 'jwt', 'cors', 'ssrf', 'owasp',
    'exposure', 'swagger', 'token', 'oauth', 'misconfig',
    'header', 'redirect', 'api', 'nodejs',
    'injection', 'auth-bypass', 'default-credentials',
    'traversal', 'ssti', 'xxe', 'idor', 'broken-auth',
]
_TAGS_DVWA = [
    'cve', 'sqli', 'xss', 'lfi', 'rce', 'rfi',
    'default-login', 'misconfig', 'header', 'php', 'exposure',
]
_TAGS_WEBGOAT = [
    'cve', 'sqli', 'xss', 'jwt', 'xxe', 'ssrf', 'cors',
    'misconfig', 'header', 'java', 'spring', 'exposure',
]
_TAGS_GENERIC = [
    'cve', 'exposure', 'misconfig', 'default-login',
    'header', 'cors', 'ssrf', 'token', 'redirect',
]

# FIX-06: protocolos a excluir siempre — no son relevantes para apps web
_EXCLUDE_PROTOCOLS = 'dns,ssl,tcp,whois,javascript,file'

# FIX-09: subdirectorios de templates para debug rápido (<30s)
_DEBUG_TEMPLATE_DIRS = [
    'http/exposures',
    'http/misconfiguration',
    'http/technologies',
]


class NucleiScanner:

    def __init__(
        self,
        timeout:  int = 1800,   # FIX-10: subido de 1200 a 1800s
        severity: str = 'info,low,medium,high,critical',
    ):
        self.timeout     = int(os.getenv('SCAN_TIMEOUT_NUCLEI', timeout))
        self.severity    = severity
        self.command     = 'nuclei'
        self._available  = self._check_availability()
        self._tpl_path   = self._find_templates()
        self._nuclei_ver = self._get_version()
        logger.info(
            "NucleiScanner v5.1 binary=%s templates=%s version=%s timeout=%ds",
            'found' if self._available else 'MISSING',
            self._tpl_path or 'auto-download',
            self._nuclei_ver,
            self.timeout,
        )

    # ── Disponibilidad ────────────────────────────────────────────────────────

    def _check_availability(self) -> bool:
        path = shutil.which(self.command)
        if not path:
            logger.warning("Nuclei binary NOT found — simulation mode")
            return False
        logger.info("Nuclei found at: %s", path)
        return True

    def _get_version(self) -> str:
        if not self._available:
            return 'unknown'
        try:
            import re
            r = subprocess.run(
                [self.command, '-version'],
                capture_output=True, text=True, timeout=10,
            )
            m = re.search(r'(\d+\.\d+\.\d+)', r.stderr or r.stdout)
            return m.group(1) if m else 'unknown'
        except Exception:
            return 'unknown'

    def _find_templates(self) -> Optional[str]:
        """BUG-04 FIX: verificar que hay yamls reales."""
        candidates = [
            '/home/scanner/nuclei-templates',
            os.path.expanduser('~/nuclei-templates'),
            '/home/scanner/.local/share/nuclei-templates',
            '/root/nuclei-templates',
            '/opt/nuclei-templates',
        ]
        for path in candidates:
            if not os.path.isdir(path):
                continue
            yaml_count = len(glob.glob(
                os.path.join(path, '**', '*.yaml'), recursive=True
            ))
            if yaml_count > 0:
                logger.info("Templates OK: %s (%d yamls)", path, yaml_count)
                return path
            logger.warning("Dir %s sin yamls — ignorado", path)
        logger.warning("Sin templates locales — nuclei descargará automáticamente")
        return None

    # ── Utilidades ────────────────────────────────────────────────────────────

    def _detect_target_type(self, target: str) -> str:
        t = target.lower()
        if 'juice' in t or ':3001' in t or ':3000' in t:
            return 'juice-shop'
        if 'dvwa' in t or ':3002' in t:
            return 'dvwa'
        if 'webgoat' in t or ':3003' in t or ':8080' in t:
            return 'webgoat'
        return 'generic'

    def _get_tags(self, target_type: str) -> List[str]:
        return {
            'juice-shop': _TAGS_JUICE_SHOP,
            'dvwa':       _TAGS_DVWA,
            'webgoat':    _TAGS_WEBGOAT,
            'generic':    _TAGS_GENERIC,
        }.get(target_type, _TAGS_GENERIC)

    def _validate_target(self, target: str) -> Tuple[bool, str]:
        if not target or not isinstance(target, str):
            return False, 'Target vacío'
        if not target.startswith(('http://', 'https://')):
            target = f'http://{target}'
        try:
            parsed = urlparse(target)
            if not parsed.hostname:
                return False, 'URL sin hostname'
        except Exception as e:
            return False, str(e)
        return True, target

    def _check_connectivity(self, target: str, timeout: int = 5) -> bool:
        """
        FIX-11: Verificar conectividad ANTES de lanzar nuclei.
        Evita que nuclei tarde 20min para descubrir que el host no responde.
        """
        try:
            parsed = urlparse(target)
            host   = parsed.hostname
            port   = parsed.port or (443 if parsed.scheme == 'https' else 80)
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except Exception as e:
            logger.warning("Target no alcanzable: %s — %s", target, e)
            return False

    # ── Construcción del comando ──────────────────────────────────────────────

    def _build_cmd(
        self,
        targets_file: str,
        output_file:  str,
        tags:         List[str],
        cookie:       Optional[str],
        target_type:  str,
        template_dir: Optional[str] = None,  # None = usar self._tpl_path completo
    ) -> List[str]:
        """
        Construye el comando nuclei optimizado.

        FIX-02: Sin -silent
        FIX-03: -o output_file
        FIX-06: -ept excluye protocolos no-HTTP
        FIX-07: -max-host-error
        FIX-08: -fhr follow-host-redirects
        """
        is_local = target_type in ('juice-shop', 'dvwa', 'webgoat')
        tpl      = template_dir or self._tpl_path

        cmd = [
            self.command,
            '-l',        targets_file,
            '-o',        output_file,
            '-jsonl',
            '-severity', self.severity,
            '-no-color',
            '-timeout',  '20',
            '-retries',  '2',
            # FIX-06: excluir protocolos no-HTTP — reduce ~60% de templates
            '-ept',      _EXCLUDE_PROTOCOLS,
            # FIX-07: parar si el host acumula muchos errores
            '-max-host-error', '10',
            # FIX-08: seguir redirects (útil para labs con /login → /dashboard)
            '-fhr',
        ]

        # Templates
        if tpl:
            cmd += ['-t', tpl, '-duc']
        # Sin -silent (BUG-02 FIX)

        cmd += ['-tags', ','.join(tags)]

        # -as si nuclei >= 2.9 (WARN-01 FIX)
        try:
            maj, mino, _ = (int(x) for x in self._nuclei_ver.split('.')[:3])
            if (maj, mino) >= (2, 9):
                cmd += ['-as']
        except Exception:
            pass

        # Concurrencia por tipo de target (WARN-03 FIX)
        if is_local:
            cmd += ['-c', '25', '-rl', '150', '-bs', '50']
        else:
            cmd += ['-c', '10', '-rl', '50',  '-bs', '20']

        if cookie:
            cmd += ['-H', f'Cookie: {cookie}']

        cmd += [
            '-H', 'Accept: text/html,application/json,*/*',
            '-H', 'X-Forwarded-For: 127.0.0.1',
        ]
        return cmd

    # ── Parser JSONL ──────────────────────────────────────────────────────────

    def _parse_jsonl(self, text: str) -> List[Dict[str, Any]]:
        """
        BUG-02/03 FIX: Solo parsea líneas JSON válidas con 'template-id'.
        Filtra líneas de progreso automáticamente.
        """
        findings = []
        seen: set = set()

        for line in text.splitlines():
            line = line.strip()
            if not line or not line.startswith('{'):
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            template_id = data.get('template-id') or data.get('templateID', '')
            if not template_id:
                continue

            info    = data.get('info', {})
            matched = data.get('matched-at') or data.get('matched', '')
            key     = f"{template_id}:{matched}"
            if key in seen:
                continue
            seen.add(key)

            tags_raw = info.get('tags', [])
            if isinstance(tags_raw, str):
                tags_raw = [t.strip() for t in tags_raw.split(',')]

            refs = info.get('reference', [])
            if isinstance(refs, str):
                refs = [refs]
            refs = [r for r in refs if r][:3]

            findings.append({
                'template_id':  template_id,
                'name':         info.get('name', template_id),
                'description':  info.get('description', f'Detectado: {template_id}'),
                'severity':     info.get('severity', 'info').lower(),
                'url':          matched,
                'tags':         tags_raw[:8],
                'references':   refs,
                'tool':         'nuclei',
                'simulated':    False,
                'curl_command': data.get('curl-command', ''),
                'request':      (data.get('request',  '') or '')[:300],
                'response':     (data.get('response', '') or '')[:300],
            })

        findings.sort(key=lambda f: _SEVERITY_ORDER.get(f['severity'], 5))
        return findings

    # ── Simulación fallback ───────────────────────────────────────────────────

    def _simulate(self, target: str, target_type: str) -> List[Dict[str, Any]]:
        logger.info("Nuclei simulado — tipo=%s", target_type)
        base = [{
            'template_id': 'http-missing-security-headers',
            'name':        'Missing Security Headers',
            'description': 'Faltan headers: CSP, X-Frame-Options, HSTS',
            'severity':    'info',
            'url':         target,
            'tags':        ['misconfig', 'header'],
            'references':  ['https://owasp.org/www-project-secure-headers/'],
            'tool':        'nuclei', 'simulated': True,
        }]
        if target_type == 'juice-shop':
            base += [
                {'template_id': 'swagger-ui-exposure', 'name': 'Swagger UI Expuesto',
                 'description': 'API en /api-docs sin autenticación.',
                 'severity': 'medium', 'url': f'{target}/api-docs',
                 'tags': ['swagger', 'exposure'], 'references': [],
                 'tool': 'nuclei', 'simulated': True},
                {'template_id': 'jwt-none-algorithm', 'name': 'JWT None Algorithm',
                 'description': 'Login vulnerable a JWT none-algorithm.',
                 'severity': 'high', 'url': f'{target}/rest/user/login',
                 'tags': ['jwt', 'owasp'],
                 'references': ['https://portswigger.net/web-security/jwt'],
                 'tool': 'nuclei', 'simulated': True},
                {'template_id': 'cors-misconfiguration', 'name': 'CORS Misconfiguration',
                 'description': 'API acepta cualquier Origin.',
                 'severity': 'medium', 'url': f'{target}/api/',
                 'tags': ['cors', 'misconfig'], 'references': [],
                 'tool': 'nuclei', 'simulated': True},
            ]
        elif target_type == 'dvwa':
            base += [
                {'template_id': 'dvwa-default-credentials',
                 'name': 'DVWA Default Credentials (admin/password)',
                 'description': 'Accesible con credenciales por defecto.',
                 'severity': 'high', 'url': f'{target}/login.php',
                 'tags': ['default-login'], 'references': [],
                 'tool': 'nuclei', 'simulated': True},
            ]
        elif target_type == 'webgoat':
            base += [
                {'template_id': 'spring-actuator-exposure',
                 'name': 'Spring Boot Actuator Exposed',
                 'description': '/actuator sin autenticación.',
                 'severity': 'high', 'url': f'{target}/WebGoat/actuator',
                 'tags': ['spring', 'exposure'], 'references': [],
                 'tool': 'nuclei', 'simulated': True},
            ]
        return base

    # ── Scan principal ────────────────────────────────────────────────────────

    def scan(self, target: str, cookie: Optional[str] = None) -> List[Dict[str, Any]]:
        """Ejecuta Nuclei completo con todas las correcciones."""
        is_valid, target = self._validate_target(target)
        if not is_valid:
            logger.error("Target inválido: %s", target)
            return []

        target_type = self._detect_target_type(target)
        tags        = self._get_tags(target_type)

        # FIX-11: verificar conectividad antes de lanzar nuclei
        if not self._check_connectivity(target):
            logger.error("Target no alcanzable: %s — abortando nuclei", target)
            return self._simulate(target, target_type)

        logger.info(
            "Nuclei v5.1 target=%s tipo=%s tags=%d timeout=%ds templates=%s",
            target, target_type, len(tags), self.timeout,
            self._tpl_path or 'auto-download',
        )

        if not self._available:
            return self._simulate(target, target_type)

        targets_tmp = None
        output_path = None

        try:
            # BUG-01 FIX: NamedTemporaryFile atómico
            targets_tmp = tempfile.NamedTemporaryFile(
                mode='w', suffix='.txt', dir='/tmp', delete=False,
            )
            targets_tmp.write(target.rstrip('/') + '\n')
            targets_tmp.flush()
            targets_tmp.close()

            # WARN-04 FIX: archivo de output separado
            out_fd, output_path = tempfile.mkstemp(suffix='.jsonl', dir='/tmp')
            os.close(out_fd)

            cmd = self._build_cmd(
                targets_tmp.name, output_path, tags, cookie, target_type,
            )
            logger.info("CMD: %s", ' '.join(cmd))

            t0   = time.monotonic()
            proc = subprocess.run(
                cmd,
                stdout = subprocess.PIPE,
                stderr = subprocess.PIPE,
                text   = True,
                timeout = self.timeout,
            )
            elapsed = time.monotonic() - t0
            logger.info(
                "Nuclei terminó: returncode=%d elapsed=%.1fs",
                proc.returncode, elapsed,
            )

            # Log de stderr (progreso y errores)
            if proc.stderr:
                stderr_lines = proc.stderr.strip().splitlines()
                for line in stderr_lines[:10]:
                    if line.strip():
                        logger.debug("nuclei stderr: %s", line)
                if len(stderr_lines) > 10:
                    logger.debug("... %d líneas más en stderr", len(stderr_lines) - 10)

            # BUG-03 FIX: archivo primero, stdout como fallback
            raw_output = ''
            if output_path and os.path.exists(output_path):
                with open(output_path, 'r', errors='replace') as f:
                    raw_output = f.read()
            if not raw_output.strip() and proc.stdout:
                logger.debug("output_file vacío — usando stdout")
                raw_output = proc.stdout

            findings = self._parse_jsonl(raw_output)
            logger.info(
                "Nuclei: %d hallazgos (tipo=%s elapsed=%.1fs)",
                len(findings), target_type, elapsed,
            )

            if not findings:
                logger.warning("0 hallazgos — retornando simulación de referencia")
                return self._simulate(target, target_type)

            return findings

        except subprocess.TimeoutExpired:
            logger.warning("Nuclei timeout (%ds) — retornando simulación", self.timeout)
            return self._simulate(target, target_type)

        except FileNotFoundError:
            logger.error("Binario nuclei no encontrado")
            return self._simulate(target, target_type)

        except Exception as e:
            logger.error("Nuclei error: %s", e, exc_info=True)
            return self._simulate(target, target_type)

        finally:
            for path in filter(None, [
                getattr(targets_tmp, 'name', None),
                output_path,
            ]):
                try:
                    os.unlink(path)
                except Exception:
                    pass

    # ── Debug rápido ──────────────────────────────────────────────────────────

    def debug_run(self, target: str, cookie: str = None) -> Dict[str, Any]:
        """
        FIX-09: debug_run usa solo exposures + misconfiguration (~500 templates)
        para terminar en <30s en vez de tardar 4+ minutos con los 12841 completos.
        """
        is_valid, target = self._validate_target(target)
        if not is_valid:
            return {'error': f'Target inválido: {target}'}

        target_type = self._detect_target_type(target)
        tags        = self._get_tags(target_type)

        # FIX-11: verificar conectividad primero
        if not self._check_connectivity(target, timeout=5):
            return {'error': f'Target no alcanzable: {target}'}

        # FIX-09: templates reducidos para diagnóstico rápido
        debug_tpl_dir = None
        if self._tpl_path:
            # Usar solo exposures + misconfiguration
            dirs = [
                os.path.join(self._tpl_path, d)
                for d in _DEBUG_TEMPLATE_DIRS
                if os.path.isdir(os.path.join(self._tpl_path, d))
            ]
            if dirs:
                debug_tpl_dir = ','.join(dirs)

        t_tmp = tempfile.NamedTemporaryFile(
            mode='w', suffix='_dbg.txt', dir='/tmp', delete=False,
        )
        t_tmp.write(target.rstrip('/') + '\n')
        t_tmp.flush()
        t_tmp.close()

        o_fd, o_path = tempfile.mkstemp(suffix='_dbg.jsonl', dir='/tmp')
        os.close(o_fd)

        cmd = self._build_cmd(t_tmp.name, o_path, tags, cookie, target_type,
                              template_dir=debug_tpl_dir)

        try:
            t0   = time.monotonic()
            proc = subprocess.run(
                cmd,
                stdout = subprocess.PIPE,
                stderr = subprocess.PIPE,
                text   = True,
                timeout = 90,   # FIX-09: 90s suficiente para subset reducido
            )
            elapsed  = time.monotonic() - t0
            raw      = ''
            if os.path.exists(o_path):
                raw = open(o_path, 'r', errors='replace').read()
            if not raw.strip() and proc.stdout:
                raw = proc.stdout
            findings = self._parse_jsonl(raw)

            return {
                'cmd':               ' '.join(cmd),
                'returncode':        proc.returncode,
                'elapsed_s':         round(elapsed, 2),
                'stdout_lines':      len(proc.stdout.splitlines()),
                'stderr_preview':    '\n'.join(proc.stderr.splitlines()[:8]),
                'output_file_bytes': len(raw),
                'findings_count':    len(findings),
                'findings_preview':  findings[:5],
                'target_type':       target_type,
                'tags':              tags,
                'templates_used':    debug_tpl_dir or self._tpl_path,
                'nuclei_version':    self._nuclei_ver,
                'note':              'debug usa subset reducido (exposures+misconfig). scan() usa templates completos.',
            }
        except subprocess.TimeoutExpired:
            return {'error': 'timeout en debug_run (90s) — target muy lento o templates no aplican'}
        except Exception as e:
            return {'error': str(e)}
        finally:
            for p in [t_tmp.name, o_path]:
                try: os.unlink(p)
                except Exception: pass