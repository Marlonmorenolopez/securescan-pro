"""
Security Scan Orchestrator — SecureScan Pro v5.1
Pipeline secuencial de 12 fases donde cada herramienta alimenta a la siguiente.

CORRECCIONES v5.1:
  - FIX CRÍTICO: search_exploits() — firma partida (self, suelto en el cuerpo).
        Reemplazado por firma correcta con parámetro known_cves opcional.
  - FIX: run_exploits_module() — propaga known_cves desde Nuclei a search_exploits().
  - FIX: execute_scan() — Nuclei corre ANTES de run_exploits_module() para que
        los CVEs detectados alimenten a Searchsploit.
  - FIX: Fase 10 en run_parallel_scans — extrae CVEs de nuclei_findings y los
        pasa a search_exploits() via known_cves.

CORRECCIONES v5.0 (acumuladas):
  - FIX: execute_scan() — run_nuclei() tenía firma incorrecta (technologies
         era interpretado como dry_run=True). Corregido a dry_run=False, cookie=None.
  - FIX: execute_scan() — run_zap() no existe; reemplazado por run_zap_full().
  - FIX: Indentación rota en __init__ — comentario mal indentado desconectaba
         self.searchsploit = SearchsploitSearcher(...) del método.
  - FIX: Typo crítico en WebGoat auto-login: 'securesacan' → 'securescan'.
  - FIX: Patator movido a Fase 3 en run_parallel_scans (antes era Fase 9).
         Nuclei y SQLMap necesitan la cookie que obtiene Patator.
  - FIX: zap.inject_urls() protegido con hasattr() — falla silenciosamente
         si el método no existe en la versión de ZAP conectada.
  - FIX: session_cookie disponible para todas las fases (3-10) en
         run_parallel_scans gracias al nuevo orden.
  - NUEVO: run_injection_scan() integra InjectionScanner (10 técnicas).
  - NUEVO: Import de InjectionScanner con fallback si no está instalado.
  - FIX DVWA: security.php requiere su propio CSRF token (user_token)
         antes de aceptar el cambio de nivel. Sin él, DVWA mantiene
         'impossible' y bloquea SQLMap y Nuclei.
  - FIX: nikto_findings renombrado a nuclei_findings en dict results.
  - OPT: Timeouts configurables via variables de entorno.
"""

import logging
import threading
import time
import os
import urllib.request
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse, parse_qs
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing                import Optional
from modules.wappalyzer    import WappalyzerScanner
from modules.nmap_scanner  import NmapScanner
from modules.gobuster      import GobusterEnterpriseScanner as GobusterScanner
from modules.zap_scanner   import ZapScanner
from modules.searchsploit  import SearchsploitSearcher
from modules.metasploit    import MetasploitScanner
from modules.nuclei        import NucleiScanner
from modules.sqlmap        import SQLMapEnterpriseScanner as SQLMapScanner
from modules.patator       import PatatorScanner
from modules.ffuf          import FfufScanner
from modules.virustotal    import VirusTotalScanner
from modules.abuseipdb     import AbuseIPDBScanner
from modules.shodan        import ShodanScanner
from modules.crtsh         import CrtShScanner
from modules.testssl       import TestSSLScanner
from modules.dnstwist      import DnstwistScanner
from modules.safebrowsing  import SafeBrowsingScanner
from modules.circuit_breaker import CircuitBreaker

# InjectionScanner — opcional, fallback si no está instalado
try:
    from modules.injection_scanner import InjectionScanner
    _INJECTION_SCANNER_AVAILABLE = True
except ImportError:
    _INJECTION_SCANNER_AVAILABLE = False
    InjectionScanner = None

logger = logging.getLogger(__name__)

_SKIP_EXPLOIT_TERMS = {
    'country', 'ip', 'title', 'html5', 'script', 'httponly', 'cookies',
    'redirectlocation', 'x-powered-by', 'x-frame-options', 'httpserver',
    'passwordfield', 'emailfield', 'uncommonheaders', 'html-meta-author',
    'meta-generator', 'via-proxy', 'dvwa', 'email', 'bootstrap',
    'jquery', 'google-analytics', 'font-awesome',
    'java', 'python', 'ruby', 'javascript', 'typescript', 'css',
    'html', 'xml', 'json', 'http', 'https', 'tcp', 'udp', 'ssl',
    'tls', 'unix', 'linux', 'windows', 'macos',
    'debian', 'ubuntu', 'centos', 'redhat', 'fedora',
}

_LOGIN_PATHS = [
    '/login.php', '/login', '/signin', '/sign-in',
    '/admin/login', '/admin/login.php', '/user/login',
    '/users/login', '/users/sign_in', '/account/login',
    '/auth/login', '/wp-login.php', '/WebGoat/login',
    '/session/new', '/portal/login', '/panel/login',
]


class ScanTimeoutError(Exception):
    pass


def run_with_timeout(func, args=(), kwargs=None, seconds=300, default=None):
    """Timeout seguro con threading.Event."""
    if kwargs is None:
        kwargs = {}
    result_container    = [default]
    exception_container = [None]
    finished = threading.Event()

    def target():
        try:
            result_container[0] = func(*args, **kwargs)
        except Exception as e:
            exception_container[0] = e
        finally:
            finished.set()

    t = threading.Thread(target=target, daemon=True)
    t.start()
    finished.wait(timeout=seconds)

    if not finished.is_set():
        logger.warning("Function %s timed out after %ds", func.__name__, seconds)
        raise ScanTimeoutError(f"Scan exceeded {seconds} seconds")
    if exception_container[0] is not None:
        raise exception_container[0]
    return result_container[0]


class SecurityOrchestrator:
    """Orquesta el pipeline completo de 12 fases de pentesting."""

    TIMEOUTS = {
        'wappalyzer':   int(os.getenv('SCAN_TIMEOUT_WAPPALYZER', 60)),
        'nmap':         int(os.getenv('SCAN_TIMEOUT_NMAP', 300)),
        'ffuf':         int(os.getenv('SCAN_TIMEOUT_FFUF', 300)),
        'gobuster':     int(os.getenv('SCAN_TIMEOUT_GOBUSTER', 300)),
        'zap':          int(os.getenv('SCAN_TIMEOUT_ZAP', 1200)),
        'nuclei':       int(os.getenv('SCAN_TIMEOUT_NUCLEI', 1200)),
        'searchsploit': int(os.getenv('SCAN_TIMEOUT_SEARCHSPLOIT', 120)),
        'metasploit':   int(os.getenv('SCAN_TIMEOUT_METASPLOIT', 900)),
        'sqlmap':       int(os.getenv('SCAN_TIMEOUT_SQLMAP', 600)),
        'patator':      int(os.getenv('SCAN_TIMEOUT_PATATOR', 180)),
        'injection':    int(os.getenv('SCAN_TIMEOUT_INJECTION', 600)),
        'virustotal':   int(os.getenv('SCAN_TIMEOUT_VIRUSTOTAL', 30)),
        'abuseipdb':    int(os.getenv('SCAN_TIMEOUT_ABUSEIPDB', 30)),
        'shodan':       int(os.getenv('SCAN_TIMEOUT_SHODAN', 20)),
        'crtsh':        int(os.getenv('SCAN_TIMEOUT_CRTSH', 25)),
        'testssl':      int(os.getenv('SCAN_TIMEOUT_TESTSSL', 120)),
        'dnstwist':     int(os.getenv('SCAN_TIMEOUT_DNSTWIST', 3)),
        'safebrowsing': int(os.getenv('SCAN_TIMEOUT_SAFEBROWSING', 15)),
    }

    def __init__(
        self,
        zap_api_key: Optional[str] = None,
        zap_api_url: str = 'http://localhost:8080',
        max_workers: int = 3,
        msf_host: str = os.getenv('MSF_HOST', 'msfrpcd'),
        msf_port: int = int(os.getenv('MSF_PORT', 55553)),
        msf_password: str = os.getenv('MSF_PASSWORD', 'msf'),
        redis_client=None,
    ):
        self.wappalyzer = WappalyzerScanner()
        self.nmap       = NmapScanner()

        gobuster_timeout = self.TIMEOUTS['gobuster']
        gobuster_threads = int(os.getenv('GOBUSTER_THREADS', 20))
        gobuster_delay   = int(os.getenv('GOBUSTER_DELAY_MS', 0))

        self.gobuster = GobusterScanner(
            threads=gobuster_threads,
            initial_delay_ms=gobuster_delay,
            timeout=gobuster_timeout,
        )

        self.zap = ZapScanner(
            api_key=zap_api_key,
            api_url=zap_api_url,
            timeout=self.TIMEOUTS['zap'],
            spider_max_children=int(os.getenv('ZAP_SPIDER_MAX_CHILDREN', 50)),
        )

        self.searchsploit = SearchsploitSearcher(timeout=30, max_results=50)

        try:
            self.metasploit = MetasploitScanner(
                host=msf_host, port=msf_port, password=msf_password,
            )
        except Exception as e:
            logger.warning("Metasploit no disponible en inicialización: %s", e)
            self.metasploit = None

        self.nuclei  = NucleiScanner(timeout=self.TIMEOUTS['nuclei'])
        self.sqlmap  = SQLMapScanner(
            timeout=self.TIMEOUTS['sqlmap'],
            level=int(os.getenv('SQLMAP_LEVEL', 3)),
            risk=int(os.getenv('SQLMAP_RISK', 2)),
            threads=int(os.getenv('SQLMAP_THREADS', 5)),
        )
        self.patator = PatatorScanner(timeout=self.TIMEOUTS['patator'])
        self.ffuf    = FfufScanner(timeout=self.TIMEOUTS['ffuf'])

        # InjectionScanner — disponible si el módulo está instalado
        if _INJECTION_SCANNER_AVAILABLE:
            self.injection_scanner = InjectionScanner(
                timeout=self.TIMEOUTS['injection']
            )
            logger.info("InjectionScanner disponible (10 técnicas)")
        else:
            self.injection_scanner = None
            logger.info("InjectionScanner no disponible — usando solo SQLMap")

        # ── Grupo "Huella Digital" (Threat Intel) ──────────────────────────
        # No dependen de otras fases — corren en paralelo, ver run_threat_intel()
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

        self.max_workers = max_workers
        self._cb_state: Dict[str, Dict] = {}
        self._cb_lock = threading.Lock()

        logger.info("Orchestrator v5.1 initialized — ZAP at %s", zap_api_url)

    # ── Circuit breaker ───────────────────────────────────────────────────────

    def _cb_check(self, target: str, cfg: Dict) -> bool:
        if not cfg.get('enabled', True):
            return False
        threshold = cfg.get('failure_threshold', 3)
        recovery  = cfg.get('recovery_timeout', 60)
        with self._cb_lock:
            state = self._cb_state.get(target, {})
            if state.get('failures', 0) >= threshold:
                if time.time() - state.get('opened_at', 0) < recovery:
                    return True
                self._cb_state[target] = {'failures': 0, 'opened_at': 0}
        return False

    def _cb_fail(self, target: str) -> None:
        with self._cb_lock:
            s = self._cb_state.setdefault(target, {'failures': 0, 'opened_at': 0})
            s['failures'] += 1
            s['opened_at'] = time.time()

    def _cb_success(self, target: str) -> None:
        with self._cb_lock:
            self._cb_state.pop(target, None)

    # ── Retry con backoff ─────────────────────────────────────────────────────

    def _run_with_retry(self, func, args=(), kwargs=None, tool_name='',
                        timeout=120, default=None, retry_cfg=None):
        cfg         = retry_cfg or {}
        max_retries = cfg.get('max_retries', 1)
        backoff     = cfg.get('backoff_factor', 1.5)
        retry_on    = set(cfg.get('retry_on', ['timeout', 'connection_error']))
        last_exc    = None

        for attempt in range(max_retries + 1):
            try:
                return run_with_timeout(func, args=args, kwargs=kwargs or {},
                                        seconds=timeout, default=default)
            except ScanTimeoutError as e:
                last_exc = e
                if 'timeout' not in retry_on or attempt == max_retries:
                    raise
                wait = backoff ** attempt
                logger.warning("%s timeout (intento %d/%d) — reintentando en %.1fs",
                               tool_name, attempt + 1, max_retries + 1, wait)
                time.sleep(wait)
            except Exception as e:
                last_exc = e
                err_str  = str(e).lower()
                is_conn  = any(k in err_str for k in
                               ['connection', 'refused', 'reset', 'broken', 'unreachable'])
                if (not is_conn or 'connection_error' not in retry_on) or attempt == max_retries:
                    raise
                wait = backoff ** attempt
                logger.warning("%s error (intento %d/%d) — reintentando en %.1fs: %s",
                               tool_name, attempt + 1, max_retries + 1, wait, e)
                time.sleep(wait)
        raise last_exc

    # ── Mock data ─────────────────────────────────────────────────────────────

    def _mock_technologies(self) -> List[Dict]:
        return [
            {'name': 'Nginx',  'version': '1.25.0', 'category': 'server',     'simulated': True},
            {'name': 'jQuery', 'version': '3.7.1',  'category': 'javascript', 'simulated': True},
            {'name': 'React',  'version': '18.2.0', 'category': 'framework',  'simulated': True},
        ]

    def _mock_ports(self) -> List[Dict]:
        return [
            {'port': 80,  'protocol': 'tcp', 'state': 'open', 'service': 'http',  'simulated': True},
            {'port': 443, 'protocol': 'tcp', 'state': 'open', 'service': 'https', 'simulated': True},
        ]

    def _mock_directories(self) -> List[Dict]:
        return [
            {'path': '/admin',  'status': 403, 'simulated': True},
            {'path': '/login',  'status': 200, 'simulated': True},
            {'path': '/api/v1', 'status': 200, 'simulated': True},
        ]

    def _mock_vulnerabilities(self) -> List[Dict]:
        return [{'name': '[DRY-RUN] Missing security headers',
                 'risk': 'medium', 'tool': 'zap', 'simulated': True}]

    # ── Validación de alcanzabilidad ──────────────────────────────────────────

    def validate_target(self, target: str, cfg: Optional[Dict] = None) -> tuple:
        import socket
        cfg     = cfg or {}
        timeout = cfg.get('timeout', 5)
        try:
            parsed   = urlparse(target)
            hostname = parsed.hostname
            port     = parsed.port or (443 if parsed.scheme == 'https' else 80)
            if not hostname:
                return False, 'No se pudo extraer hostname'
            if cfg.get('check_dns', True):
                try:
                    socket.getaddrinfo(hostname, None)
                except socket.gaierror as e:
                    return False, f'DNS no resuelve: {e}'
            if cfg.get('check_reachability', True):
                try:
                    with socket.create_connection((hostname, port), timeout=timeout):
                        pass
                except (socket.timeout, ConnectionRefusedError, OSError) as e:
                    return False, f'No alcanzable {hostname}:{port}: {e}'
            return True, 'ok'
        except Exception as e:
            return False, str(e)

    # ── Detección de login form ───────────────────────────────────────────────

    def _detect_login_path(self, target: str) -> str:
        parsed = urlparse(target)
        base   = f"{parsed.scheme}://{parsed.hostname}"
        if parsed.port:
            base += f":{parsed.port}"
        for path in _LOGIN_PATHS:
            url = f"{base}{path}"
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status not in (200, 302, 301):
                        continue
                    content = resp.read(8192).decode('utf-8', errors='ignore').lower()
                    if 'type="password"' in content or "type='password'" in content:
                        logger.info("Login form detected at: %s%s", base, path)
                        return path
            except Exception:
                continue
        logger.info("No login form detected, using default /login")
        return '/login'

    def _detect_fail_string(self, target: str, login_path: str) -> str:
        parsed = urlparse(target)
        base   = f"{parsed.scheme}://{parsed.hostname}"
        if parsed.port:
            base += f":{parsed.port}"
        url = f"{base}{login_path}"
        fail_candidates = [
            'Login failed', 'Invalid credentials', 'Invalid password',
            'Incorrect password', 'Wrong password', 'Authentication failed',
            'Invalid username', 'User not found', 'Access denied',
            'Login incorrect', 'Bad credentials', 'Unauthorized',
        ]
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                content = resp.read(16384).decode('utf-8', errors='ignore')
                for candidate in fail_candidates:
                    if candidate.lower() in content.lower():
                        return candidate
        except Exception:
            pass
        return 'Login failed'

    # ── Helpers de interconexión ──────────────────────────────────────────────

    def _extract_session_cookie(self, brute_force_results: List[Dict]) -> Optional[str]:
        for bf in brute_force_results:
            if not bf.get('success'):
                continue
            for cred in bf.get('credentials', []):
                cookie = cred.get('session_cookie', '')
                if cookie:
                    logger.info("Session cookie extracted from Patator: %s", cookie[:50])
                    return cookie
        return None

    def _extract_login_form(self, vulnerabilities: List[Dict],
                            directories: List[Dict]) -> Optional[str]:
        login_paths = ['/login', '/login.php', '/signin', '/admin/login',
                       '/wp-login.php', '/user/login', '/WebGoat/login']
        found_paths = {d.get('path', '').lower() for d in directories}
        for lp in login_paths:
            if lp.lower() in found_paths or lp.rstrip('.php').lower() in found_paths:
                return lp
        for vuln in vulnerabilities:
            url = vuln.get('url', '')
            for lp in login_paths:
                if lp in url:
                    return lp
        return None

    def _get_sqlmap_targets(self, target: str, vulnerabilities: List[Dict],
                            directories: List[Dict],
                            ffuf_endpoints: List[Dict]) -> List[tuple]:
        SQLI_PARAMS = {
            'id','q','query','search','s','keyword','item','product',
            'user','username','login','pass','email','name','cat',
            'category','page','p','order','sort','filter','key',
            'value','data','input','text','field','term','type',
            'code','ref','from','to','where','limit','offset',
        }
        SKIP_PARAMS = {
            'url','uri','redirect','next','callback','webhook',
            'dns','name','domain','host','ip','dest','target',
            'utm_source','utm_medium','ref','token','csrf','_',
            'eio','transport','sid','t','j','b64',
        }
        SKIP_PATHS = {
            '/render','/dns-query','/redirect','/callback',
            '/webhook','/oauth','/saml','/asset','/static',
            '/favicon','/robots','/sitemap','/manifest',
            '/socket.io','/sockjs','/ws','/websocket',
        }

        def _score(url: str) -> int:
            parsed = urlparse(url)
            path   = parsed.path.lower()
            params = set(parse_qs(parsed.query).keys())
            score  = 0
            if any(path.startswith(sp) for sp in SKIP_PATHS):
                return -100
            if params and params.issubset(SKIP_PARAMS):
                return -50
            score += len(params & SQLI_PARAMS) * 20
            for kw in ('search','query','product','item','user','login',
                       'sqli','rest','api','view','detail','get','fetch'):
                if kw in path:
                    score += 10
                    break
            score += len(params) * 5
            return score

        def _extract_params(url: str):
            qs   = parse_qs(urlparse(url).query)
            good = [k for k in qs.keys() if k.lower() not in SKIP_PARAMS]
            return ','.join(good) if good else ','.join(qs.keys()) if qs else None

        def _is_polluted(url: str) -> bool:
            import urllib.parse
            parsed  = urllib.parse.urlparse(url)
            qs      = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
            values  = ' '.join(v for vals in qs.values() for v in vals).lower()
            decoded = urllib.parse.unquote(values)
            SIGNS   = [
                '<script', 'alert(', 'onerror=', 'onload=', 'javascript:',
                'union select', 'sleep(', 'waitfor delay',
                '../', '</', 'prompt(', 'confirm(',
                "'(", "')", "' ", "'--", "'or", "'and",
            ]
            return any(s in decoded for s in SIGNS)

        candidates = []
        seen       = set()
        t          = target.lower()

        if 'dvwa' in t or '3002' in t:
            for ep, param in [
                ('/vulnerabilities/sqli/?id=1&Submit=Submit',       'id'),
                ('/vulnerabilities/sqli_blind/?id=1&Submit=Submit', 'id'),
            ]:
                url = f"{target.rstrip('/')}{ep}"
                candidates.append((url, param, None)); seen.add(url)
        elif 'webgoat' in t or '3003' in t:
            logger.info("WebGoat: agregando endpoints conocidos + URLs de ZAP para SQLMap")
            base = target.rstrip('/')
            for ep, param in [
                ('/WebGoat/SqlInjection/assignment5a',     'account'),
                ('/WebGoat/SqlInjectionAdvanced/attack6a', 'userid'),
                ('/WebGoat/login',                         'username'),
            ]:
                url = f"{base}{ep}"
                if url not in seen:
                    candidates.append((url, param, None))
                    seen.add(url)
            for vuln in vulnerabilities:
                url = vuln.get('url', '')
                if url and url not in seen and not _is_polluted(url):
                    if parse_qs(urlparse(url).query):
                        seen.add(url)
                        candidates.append((url, _extract_params(url), None))
        elif 'juice' in t or '3001' in t or '3000' in t:
            for ep, param in [
                ('/rest/products/search?q=test', 'q'),
                ('/rest/user/login',             None),
            ]:
                url = (f"{target.rstrip('/')}{ep}"
                       if not ep.startswith('http') else ep)
                if url not in seen:
                    candidates.append((url, param, None)); seen.add(url)

        for vuln in vulnerabilities:
            url = vuln.get('url', '')
            if url and url not in seen and not _is_polluted(url):
                if parse_qs(urlparse(url).query):
                    seen.add(url)
                    candidates.append((url, _extract_params(url), None))

        for group in ffuf_endpoints:
            for ep in group.get('endpoints', []):
                url = ep.get('url', '')
                if url and url not in seen:
                    if urlparse(url).query:
                        seen.add(url)
                        candidates.append((url, _extract_params(url), None))

        for d in directories:
            path = d.get('path', '')
            if any(x in path.lower() for x in ['login','sqli','search','query','id=']):
                url = f"{target.rstrip('/')}/{path.lstrip('/')}"
                if url not in seen:
                    seen.add(url)
                    candidates.append((url, None, None))

        candidates = [(u, p, d) for u, p, d in candidates if _score(u) >= 0]
        candidates.sort(key=lambda x: _score(x[0]), reverse=True)
        logger.debug("SQLMap candidates: %s", [(u, _score(u)) for u, p, d in candidates[:5]])
        if not candidates:
            candidates.append((target, None, None))
        return candidates[:5]

    # ── Auto-login ────────────────────────────────────────────────────────────

    def _get_session_for_target(self, target: str) -> dict:
        """
        Intenta login automático usando credenciales conocidas.

        FIX v4.3 DVWA: security.php requiere su propio CSRF token (user_token)
        antes de aceptar el cambio de nivel de seguridad.
        FIX v5.0 WebGoat: corregido typo 'securesacan' → 'securescan'.
        """
        import requests
        import re
        result = {'cookie': None, 'token': None, 'auth_header': None}

        try:
            # ── Juice Shop — REST API + JWT ───────────────────────────────────
            if 'juice-shop' in target or '3001' in target or '3000' in target:
                resp = requests.post(
                    f"{target.rstrip('/')}/rest/user/login",
                    json={'email': 'admin@juice-sh.op', 'password': 'admin123'},
                    headers={'Content-Type': 'application/json'},
                    timeout=10,
                )
                if resp.status_code == 200:
                    token = resp.json().get('authentication', {}).get('token', '')
                    if token:
                        result['token']       = token
                        result['auth_header'] = f'Bearer {token}'
                        result['cookie']      = f'token={token}'
                        logger.info("Juice Shop auth OK — JWT obtenido")

            # ── DVWA — formulario HTML + cookie ──────────────────────────────
            elif 'dvwa' in target or '3002' in target:
                session = requests.Session()

                # Paso 1: CSRF token del formulario de login
                resp    = session.get(f"{target.rstrip('/')}/login.php", timeout=10)
                token_m = re.search(r"name='user_token' value='([^']+)'", resp.text)
                token   = token_m.group(1) if token_m else ''

                # Paso 2: Login
                session.post(
                    f"{target.rstrip('/')}/login.php",
                    data={
                        'username':   'admin',
                        'password':   'password',
                        'Login':      'Login',
                        'user_token': token,
                    },
                    allow_redirects=True,
                    timeout=10,
                )

                # Paso 3 FIX: CSRF token propio de security.php
                sec_page    = session.get(f"{target.rstrip('/')}/security.php", timeout=10)
                sec_token_m = re.search(r"name='user_token' value='([^']+)'", sec_page.text)
                sec_token   = sec_token_m.group(1) if sec_token_m else ''

                # Paso 4: cambiar nivel a 'low' con el token correcto
                session.post(
                    f"{target.rstrip('/')}/security.php",
                    data={
                        'Security':      'low',
                        'seclev_submit': 'Submit',
                        'user_token':    sec_token,
                    },
                    allow_redirects=True,
                    timeout=10,
                )

                # Paso 5: forzar security=low en la cookie
                cookies_dict             = dict(session.cookies)
                cookies_dict['security'] = 'low'
                cookie = '; '.join([f'{k}={v}' for k, v in cookies_dict.items()])
                if cookie:
                    result['cookie'] = cookie
                    logger.info("DVWA auth OK — cookie obtenida (security=low forzado)")

            # ── WebGoat — formulario Spring Security ─────────────────────────
            elif 'webgoat' in target or '3003' in target:
                UA      = 'Mozilla/5.0 (compatible; SecureScan/5.0)'
                WG_USER = 'securescan'
                WG_PASS = 'Password1'
                base    = target.rstrip('/')
                session = requests.Session()
                session.headers.update({'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml'})
                # Paso 1: GET inicial — Spring Security necesita JSESSIONID
                session.get(f"{base}/WebGoat/login", timeout=10)
                # Paso 2: registro con allow_redirects=False — captura cookie del 302
                r_reg = session.post(
                    f"{base}/WebGoat/register.mvc",
                    data={'username': WG_USER, 'password': WG_PASS,
                          'matchingPassword': WG_PASS, 'agree': 'agree'},
                    allow_redirects=False, timeout=10,
                )
                logger.info("WebGoat register status=%d location=%s",
                            r_reg.status_code, r_reg.headers.get('Location', ''))
                # Paso 3: seguir el redirect manualmente — queda autenticado
                if r_reg.status_code == 302:
                    location = r_reg.headers.get('Location', f"{base}/WebGoat/attack?username={WG_USER}")
                    r_attack = session.get(location, timeout=10)
                    _WG_SESSION_MARKERS = [
                        'webgoat', 'logout', 'sign out',
                        'lesson', 'attack', 'module', 'welcome',
                        'start.mvc', 'menu',
                    ]
                    auth_ok = (
                        r_attack.status_code == 200
                        and 'Login Page' not in r_attack.text
                        and any(
                            m in r_attack.text.lower()
                            for m in _WG_SESSION_MARKERS
                        )
                    )
                elif r_reg.status_code == 200 and 'already exists' in r_reg.text.lower():
                    # Usuario ya existe — intentar login directo
                    r_login  = session.post(f"{base}/WebGoat/login",
                                            data={'username': WG_USER, 'password': WG_PASS},
                                            allow_redirects=True, timeout=10)
                    _WG_SESSION_MARKERS = [
                        'webgoat', 'logout', 'sign out',
                        'lesson', 'attack', 'module', 'welcome',
                        'start.mvc', 'menu',
                    ]
                    auth_ok = (
                        r_login.status_code == 200
                        and 'Login Page' not in r_login.text
                        and any(
                            m in r_login.text.lower()
                            for m in _WG_SESSION_MARKERS
                        )
                    )
                else:
                    auth_ok = False
                cookie = '; '.join([f'{k}={v}' for k, v in session.cookies.items()])
                if cookie and auth_ok:
                    result['cookie']     = cookie
                    result['user_agent'] = UA
                    logger.info("WebGoat auth OK — '%s' autenticado, cookie=%s", WG_USER, cookie[:40])
                else:
                    logger.warning("WebGoat auth fallido (status=%d, auth_ok=%s)",
                                   r_reg.status_code, auth_ok)

            # ── Testfire — formulario ─────────────────────────────────────────
            elif 'testfire' in target:
                session = requests.Session()
                session.post(
                    'https://demo.testfire.net/bank/login',
                    data={'uid': 'jsmith', 'passw': 'demo1234'},
                    allow_redirects=True,
                    timeout=15,
                    verify=False,
                )
                cookie = '; '.join([f'{k}={v}' for k, v in session.cookies.items()])
                if cookie:
                    result['cookie'] = cookie
                    logger.info("Testfire auth OK — cookie obtenida")

        except Exception as e:
            logger.warning("Auto-login fallido para %s: %s", target, e)

        return result

    # ── Métodos de herramientas ───────────────────────────────────────────────

    def run_wappalyzer(self, target: str, dry_run=False, retry_cfg=None) -> List[Dict]:
        if dry_run: return self._mock_technologies()
        logger.info("Wappalyzer → %s", target)
        try:
            return self._run_with_retry(
                self.wappalyzer.scan, args=(target,),
                tool_name='wappalyzer', timeout=self.TIMEOUTS['wappalyzer'],
                default=[], retry_cfg=retry_cfg,
            )
        except ScanTimeoutError:
            return [{'error': f"Wappalyzer timeout after {self.TIMEOUTS['wappalyzer']}s"}]
        except Exception as e:
            logger.error("Wappalyzer error: %s", e); return [{'error': str(e)}]

    def run_nmap(self, target: str, dry_run=False, retry_cfg=None) -> List[Dict]:
        if dry_run: return self._mock_ports()
        logger.info("Nmap → %s", target)
        try:
            parsed   = urlparse(target)
            hostname = parsed.hostname or target
            url_port = parsed.port or (443 if parsed.scheme == 'https' else 80)
            ports    = '1-1000' if url_port in range(1, 1001) else f'1-1000,{url_port}'
            return self._run_with_retry(
                self.nmap.scan, args=(hostname,), kwargs={'ports': ports},
                tool_name='nmap', timeout=self.TIMEOUTS['nmap'],
                default=[], retry_cfg=retry_cfg,
            )
        except ScanTimeoutError:
            return [{'port': 'timeout', 'error': f"Nmap timeout after {self.TIMEOUTS['nmap']}s"}]
        except Exception as e:
            logger.error("Nmap error: %s", e); return [{'error': str(e)}]

    def run_ffuf(self, target: str, fuzz_path: str = '/FUZZ',
                 cookie: str = None) -> List[Dict]:
        logger.info("ffuf → %s%s", target, fuzz_path)
        try:
            return run_with_timeout(
                self.ffuf.scan, args=(target,),
                kwargs={'fuzz_path': fuzz_path,
                        'custom_headers': {'Cookie': cookie} if cookie else None},
                seconds=self.TIMEOUTS['ffuf'],
                default=[{'error': 'timeout', 'tool': 'ffuf'}],
            )
        except ScanTimeoutError:
            return [{'error': f"ffuf timeout after {self.TIMEOUTS['ffuf']}s", 'tool': 'ffuf'}]
        except Exception as e:
            logger.error("ffuf error: %s", e); return [{'error': str(e), 'tool': 'ffuf'}]

    def run_gobuster(self, target: str, dry_run=False,
                     retry_cfg=None, cookie: str = None) -> List[Dict]:
        if dry_run: return self._mock_directories()
        logger.info("Gobuster → %s", target)
        try:
            is_slow           = any(x in target for x in ['testfire', 'demo', 'juice'])
            effective_timeout = self.TIMEOUTS['gobuster'] * (2 if is_slow else 1)
            self.gobuster.timeout = effective_timeout
            if cookie:
                self.gobuster._headers = getattr(self.gobuster, '_headers', {}) or {}
                self.gobuster._headers['Cookie'] = cookie
            raw = self._run_with_retry(
                self.gobuster.scan, args=(target,),
                tool_name='gobuster', timeout=effective_timeout + 30,
                default=[], retry_cfg={'max_retries': 0, 'backoff_factor': 1.0},
            )
            return [d for d in raw if not d.get('is_false_positive') and not d.get('skipped')]
        except ScanTimeoutError:
            logger.warning("Gobuster timeout — continuando sin directorios")
            return [{'path': '/timeout', 'status': 0, 'error': 'Gobuster timeout', 'skipped': True}]
        except Exception as e:
            logger.error("Gobuster error: %s", e); return [{'error': str(e), 'skipped': True}]

    def run_zap_full(self, target: str, policy: str = 'Default Policy',
                     cookie: str = None) -> Dict[str, Any]:
        t = target.lower()
        if   'dvwa'    in t or '3002' in t: policy = 'Dev Standard'
        elif 'webgoat' in t or '3003' in t: policy = 'Dev Standard'
        elif 'juice'   in t or '3001' in t or '3000' in t: policy = 'Dev CICD'
        elif 'testfire' in t: policy = 'Dev Full'
        logger.info("ZAP Full Scan → %s (policy: %s)", target, policy)
        try:
            vulns = run_with_timeout(
                self.zap.scan, args=(target,),
                kwargs={'scan_policy': policy, 'cookie': cookie},
                seconds=self.TIMEOUTS['zap'], default=[],
            )
            urls = list(set([v.get('url', '') for v in vulns if v.get('url')]))
            logger.info("ZAP completado — %d URLs, %d vulns", len(urls), len(vulns))
            return {'urls_descubiertas': urls, 'vulnerabilidades': vulns,
                    'tool': 'zap_full', 'success': True}
        except ScanTimeoutError:
            logger.warning("ZAP timeout después de %ds", self.TIMEOUTS['zap'])
            return {'urls_descubiertas': [target],
                    'vulnerabilidades': [{'error': 'ZAP timeout', 'risk': 'info', 'tool': 'zap'}],
                    'tool': 'zap_full', 'success': False, 'timeout': True}
        except Exception as e:
            logger.error("ZAP error: %s", e)
            return {'urls_descubiertas': [],
                    'vulnerabilidades': [{'error': str(e), 'tool': 'zap'}],
                    'tool': 'zap_full', 'success': False}

    def run_zap_spider(self, target: str, max_children: int = 50) -> List[Dict]:
        logger.warning("run_zap_spider() deprecated — usar run_zap_full()")
        return [{'url': target, 'tool': 'zap_spider', 'deprecated': True}]

    def run_zap_active(self, target: str, policy: str = 'Default Policy') -> List[Dict]:
        logger.warning("run_zap_active() deprecated — usar run_zap_full()")
        return self.run_zap_full(target, policy).get('vulnerabilidades', [])

    def access_target(self, target: str, **kwargs) -> bool:
        ok, _ = self.validate_target(target, {'check_reachability': True, 'timeout': 5})
        return ok

    def run_nuclei(self, target: str, dry_run=False,
                   retry_cfg=None, cookie: str = None) -> List[Dict]:
        if dry_run:
            return [{'name': '[DRY-RUN] Nuclei mock', 'severity': 'info', 'simulated': True}]
        logger.info("Nuclei → %s (cookie=%s)", target, "sí" if cookie else "no")
        try:
            return self._run_with_retry(
                self.nuclei.scan, args=(target,),
                kwargs={'cookie': cookie},
                tool_name='nuclei', timeout=self.TIMEOUTS['nuclei'],
                default=[{'error': 'timeout', 'tool': 'nuclei'}],
                retry_cfg={'max_retries': 0},
            )
        except ScanTimeoutError:
            return [{'error': f"Nuclei timeout after {self.TIMEOUTS['nuclei']}s", 'tool': 'nuclei'}]
        except Exception as e:
            logger.error("Nuclei error: %s", e); return [{'error': str(e), 'tool': 'nuclei'}]

    def run_sqlmap(self, target: str, params=None, cookie=None, data=None) -> List[Dict]:
        logger.info("SQLMap → %s (data=%s)", target, bool(data))
        try:
            with SQLMapScanner(
                timeout=self.TIMEOUTS['sqlmap'],
                level=int(os.getenv('SQLMAP_LEVEL', 3)),
                risk=int(os.getenv('SQLMAP_RISK', 2)),
                threads=int(os.getenv('SQLMAP_THREADS', 5)),
            ) as scanner:
                return run_with_timeout(
                    scanner.scan, args=(target,),
                    kwargs={'params': params, 'cookie': cookie, 'data': data},
                    seconds=self.TIMEOUTS['sqlmap'],
                    default=[{'error': 'timeout', 'tool': 'sqlmap'}],
                )
        except ScanTimeoutError:
            return [{'error': f"SQLMap timeout after {self.TIMEOUTS['sqlmap']}s", 'tool': 'sqlmap'}]
        except Exception as e:
            logger.error("SQLMap error: %s", e); return [{'error': str(e), 'tool': 'sqlmap'}]

    def run_injection_scan(self, target: str, cookie: str = None,
                           techniques: list = None) -> List[Dict]:
        """
        Ejecuta InjectionScanner — 10 técnicas de inyección activa.
        Si el módulo no está disponible, cae en run_sqlmap() como fallback.
        """
        if self.injection_scanner is None:
            logger.warning("InjectionScanner no disponible — usando SQLMap como fallback")
            sqlmap_targets = self._get_sqlmap_targets(target, [], [], [])
            results = []
            for sq_url, sq_params, sq_data in sqlmap_targets:
                results.extend(self.run_sqlmap(sq_url, params=sq_params,
                                               cookie=cookie, data=sq_data))
            return results

        logger.info("InjectionScanner → %s (techniques=%s)", target, techniques or 'todas')
        try:
            return run_with_timeout(
                self.injection_scanner.scan,
                args=(target,),
                kwargs={'cookie': cookie, 'techniques': techniques},
                seconds=self.TIMEOUTS['injection'],
                default=[{'error': 'timeout', 'tool': 'injection_scanner'}],
            )
        except ScanTimeoutError:
            return [{'error': 'Injection scan timeout', 'tool': 'injection_scanner'}]
        except Exception as e:
            logger.error("InjectionScanner error: %s", e)
            return [{'error': str(e), 'tool': 'injection_scanner'}]

    def run_patator(self, target: str, form_path=None) -> List[Dict]:
        if not form_path:
            form_path = self._detect_login_path(target)
        t = target.lower()
        if 'webgoat' in t or '3003' in t:
            fail_string = 'Invalid username and password.'
        elif 'dvwa' in t or '3002' in t:
            fail_string = 'Login failed'
        elif 'juice' in t or '3000' in t or '3001' in t:
            fail_string = 'Invalid email or password'
        else:
            fail_string = self._detect_fail_string(target, form_path)
        logger.info("Patator → %s%s (fail_string: '%s')", target, form_path, fail_string)
        try:
            return run_with_timeout(
                self.patator.scan, args=(target,),
                kwargs={'form_path': form_path, 'fail_string': fail_string},
                seconds=self.TIMEOUTS['patator'],
                default=[{'error': 'timeout', 'tool': 'patator'}],
            )
        except ScanTimeoutError:
            return [{'error': f"Patator timeout after {self.TIMEOUTS['patator']}s", 'tool': 'patator'}]
        except Exception as e:
            logger.error("Patator error: %s", e); return [{'error': str(e), 'tool': 'patator'}]

    def run_metasploit(self, target: str, ports=None, technologies=None) -> List[Dict]:
        logger.info("Metasploit → %s", target)
        try:
            if self.metasploit is None:
                try:
                    self.metasploit = MetasploitScanner(
                        host=os.getenv('MSF_HOST', 'msfrpcd'),
                        port=int(os.getenv('MSF_PORT', 55553)),
                        password=os.getenv('MSF_PASSWORD', 'msf'),
                    )
                    logger.info("Metasploit reconectado en caliente")
                except Exception as e:
                    logger.warning("Metasploit sigue no disponible: %s", e)
                    return [{'name': 'Metasploit simulation mode',
                            'description': 'Scanner no disponible', 'simulated': True, 'findings': []}]
            try:
                is_connected = getattr(self.metasploit, 'is_connected', lambda: False)()
            except Exception:
                is_connected = False
            if not is_connected:
                return [{'name': 'Metasploit simulation mode',
                        'description': 'msfrpcd not available', 'simulated': True, 'findings': []}]
            return run_with_timeout(
                self.metasploit.scan, args=(target,),
                kwargs={'ports': ports or [], 'technologies': technologies or []},
                seconds=self.TIMEOUTS['metasploit'],
                default=[{'error': 'timeout', 'source': 'metasploit'}],
            )
        except ScanTimeoutError:
            return [{'error': f"Metasploit timeout after {self.TIMEOUTS['metasploit']}s",
                    'source': 'metasploit'}]
        except Exception as e:
            logger.error("Metasploit error: %s", e)
            return [{'error': str(e), 'source': 'metasploit', 'simulated': True}]

    # FIX v5.1: firma corregida — known_cves agregado como parámetro opcional.
    # El bloque "self, technologies, ports, target, known_cves" que quedaba
    # suelto en el cuerpo del método ha sido eliminado.
    def search_exploits(
        self,
        technologies: List[Dict],
        ports: List[Dict],
        target: str = '',
        known_cves: Optional[List[str]] = None,
    ) -> List[Dict]:
        logger.info("Searchsploit search")
        try:
            search_terms = set()

            # Términos desde tecnologías (Wappalyzer)
            for tech in technologies:
                name    = tech.get('name', '')
                version = tech.get('version', '')
                if not name or name.lower() in _SKIP_EXPLOIT_TERMS:
                    continue
                if 'error' in str(name).lower():
                    continue
                search_terms.add(f"{name} {version}".strip() if version else name)

            # Términos desde puertos (Nmap)
            for port in ports:
                product = port.get('product', '')
                version = port.get('version', '')
                service = port.get('service', '')
                if product:
                    search_terms.add(f"{product} {version}".strip() if version else product)
                elif service and service not in _SKIP_EXPLOIT_TERMS:
                    search_terms.add(service)

            # CVEs directos desde Nuclei (correlación exacta)
            if known_cves:
                valid_cves = [
                    c for c in known_cves
                    if isinstance(c, str) and c.upper().startswith('CVE-')
                ][:5]
                if valid_cves:
                    search_terms.update(valid_cves)
                    logger.info("Searchsploit: CVEs de Nuclei agregados: %s", valid_cves)

            # Fallback por lab si no hay términos
            if not search_terms:
                t = target.lower()
                if 'webgoat' in t or '3003' in t or '8080' in t:
                    search_terms = {'spring', 'java spring', 'tomcat', 'OWASP WebGoat'}
                elif 'dvwa' in t or '3002' in t:
                    search_terms = {'php', 'mysql', 'dvwa'}
                elif 'juice' in t or '3001' in t or '3000' in t:
                    search_terms = {'node.js', 'express', 'angular'}
                else:
                    logger.info("Searchsploit: sin términos para buscar")
                    return []

            return run_with_timeout(
                self.searchsploit.search,
                args=(list(search_terms)[:10],),
                kwargs={'technologies': technologies, 'ports': ports},
                seconds=self.TIMEOUTS['searchsploit'],
                default=[],
            )
        except ScanTimeoutError:
            return [{'error': 'searchsploit timeout'}]
        except Exception as e:
            logger.error("Searchsploit error: %s", e)
            return [{'error': str(e)}]

    # FIX v5.1: known_cves propagado desde el caller para correlacionar CVEs de Nuclei.
    def run_exploits_module(
        self,
        technologies: List[Dict],
        ports: List[Dict],
        known_cves: Optional[List[str]] = None,
    ) -> List[Dict]:
        """Ejecuta búsqueda en Exploit-DB y formatea la salida."""
        exploits = self.search_exploits(technologies, ports, known_cves=known_cves)
        if not exploits:
            return []
        formatted = []
        for e in exploits:
            eid      = e.get('id') or e.get('EDB-ID') or 'N/A'
            title    = e.get('title', 'Sin título')
            severity = e.get('severity', 'unknown')
            cve      = e.get('codes') or e.get('Codes') or e.get('cve') or ''
            url      = e.get('url') or (
                f"https://www.exploit-db.com/exploits/{eid}" if eid != 'N/A'
                else 'https://www.exploit-db.com'
            )
            formatted.append({
                'id': eid, 'title': title, 'cve': cve,
                'severity': severity, 'url': url, 'raw': e,
            })
        return formatted

    def execute_scan(self, target: str) -> Dict:
        """
        Orquesta un escaneo completo del objetivo.

        FIX v5.1:
          - Nuclei corre ANTES de run_exploits_module() para que los CVEs
            detectados alimenten a Searchsploit via known_cves.
          - run_exploits_module() recibe known_cves extraídos de nuclei_results.

        FIX v5.0:
          - run_nuclei() firma corregida: dry_run=False, cookie=None.
          - run_zap() no existe → reemplazado por run_zap_full().
        """
        logger.info("execute_scan → %s", target)

        technologies    = self.run_wappalyzer(target)
        ports           = self.run_nmap(target)

        # FIX v5.1: Nuclei antes de Searchsploit para propagar CVEs
        nuclei_results  = self.run_nuclei(target, dry_run=False, cookie=None)

        known_cves = [
            f.get('cve_id') for f in nuclei_results
            if f.get('cve_id')
        ]
        exploits        = self.run_exploits_module(technologies, ports, known_cves=known_cves)

        zap_result      = self.run_zap_full(target)
        zap_results     = zap_result.get('vulnerabilidades', [])
        msf_results     = self.run_metasploit(target, ports=ports, technologies=technologies)

        return {
            'target':       target,
            'technologies': technologies,
            'ports':        ports,
            'exploits':     exploits,
            'nuclei':       nuclei_results,
            'zap':          zap_results,
            'metasploit':   msf_results,
        }

    # ── Huella Digital / Threat Intel ───────────────────────────────────────
    # A diferencia del pipeline de 12 fases, estas herramientas consultan
    # reputación/exposición externa del target y no dependen de resultados
    # de otras fases (no necesitan cookie, CVEs, ni nada del resto del
    # pipeline) — por eso corren en paralelo entre sí, no en cadena.
    #
    # Para agregar una herramienta nueva a este grupo (AbuseIPDB, Shodan,
    # crt.sh, testssl, dnstwist): instanciarla en __init__ y sumar una
    # línea a `intel_tasks` — no hay que tocar el resto de este método.
    # ── Huella Digital / Threat Intel ───────────────────────────────────────
    # Circuit breaker POR HERRAMIENTA (no por target, a diferencia del pipeline
    # web) -- si VirusTotal empieza a fallar repetido (caído, rate limit), deja
    # de intentarlo por un rato para TODOS los targets, en vez de que cada
    # escaneo nuevo lo siga golpeando igual. Sin redis_client, self.intel_circuit_breaker
    # queda en None y simplemente no hay protección (no rompe nada).

    def run_threat_intel(self, target: str, enabled_tools: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Ejecuta las herramientas de la pestaña "Huella Digital" en paralelo.
        No participa del pipeline secuencial de run_parallel_scans().

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

    # ── Pipeline principal ────────────────────────────────────────────────────

    def run_parallel_scans(self, target: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Pipeline de 12 fases. Cada fase alimenta a la siguiente.

        ORDEN CORREGIDO v5.0 / v5.1:
          Fase 1  — Wappalyzer
          Fase 2  — Nmap
          Fase 3  — Patator  ← cookie disponible para fases 4-10
          Fase 4  — Metasploit
          Fase 5  — ffuf
          Fase 6  — Gobuster
          Fase 7  — ZAP Full Scan
          Fase 8  — Nuclei   ← recibe cookie de Fase 3
          Fase 9  — Injection Scanner (SQLi + 9 técnicas adicionales)
                    fallback a SQLMap si InjectionScanner no está instalado
          Fase 10 — Searchsploit ← recibe CVEs de Nuclei (Fase 8) via known_cves
        """
        results = {
            'technologies':        [],
            'ports':               [],
            'directories':         [],
            'vulnerabilities':     [],
            'exploits':            [],
            'metasploit':          [],
            'nuclei_findings':     [],
            'sqli_results':        [],
            'brute_force_results': [],
            'ffuf_endpoints':      [],
            'spider_results':      [],
        }

        tools     = options.get('tools', {})
        dry_run   = options.get('_dry_run', False)
        retry_cfg = options.get('_retry_cfg', {})

        # ── Fase 1: Wappalyzer ────────────────────────────────────────────────
        if tools.get('wappalyzer', False):
            logger.info("── Fase 1: Wappalyzer ──")
            results['technologies'] = self.run_wappalyzer(
                target, dry_run=dry_run, retry_cfg=retry_cfg)

        # ── Fase 2: Nmap ──────────────────────────────────────────────────────
        if tools.get('nmap', False):
            logger.info("── Fase 2: Nmap ──")
            results['ports'] = self.run_nmap(
                target, dry_run=dry_run, retry_cfg=retry_cfg)

        # ── Fase 3: Patator — brute force + obtener cookie ───────────────────
        session_cookie = self._get_session_for_target(target).get('cookie')

        if tools.get('patator', False):
            logger.info("── Fase 3: Patator ── (brute force + cookie para fases siguientes)")
            form_path = (
                options.get('login_path') or
                self._extract_login_form(
                    results.get('vulnerabilities', []),
                    results.get('directories', []))
            )
            results['brute_force_results'] = self.run_patator(target, form_path=form_path)
            patator_cookie = self._extract_session_cookie(results['brute_force_results'])
            if patator_cookie:
                session_cookie = patator_cookie
                logger.info("Cookie de Patator disponible para fases 4-10")

        # ── Fase 4: Metasploit ────────────────────────────────────────────────
        if tools.get('metasploit', False):
            logger.info("── Fase 4: Metasploit ──")
            results['metasploit'] = self.run_metasploit(
                target, ports=results.get('ports', []),
                technologies=results.get('technologies', []))

        # ── Fase 5: ffuf ──────────────────────────────────────────────────────
        if tools.get('ffuf', False):
            logger.info("── Fase 5: ffuf ──")
            t = target.lower()
            fuzz_path = '/WebGoat/FUZZ' if ('webgoat' in t or '8080' in t) else '/FUZZ'
            results['ffuf_endpoints'] = self.run_ffuf(
                target, fuzz_path=fuzz_path, cookie=session_cookie)

        # ── Fase 6: Gobuster ──────────────────────────────────────────────────
        if tools.get('gobuster', False):
            logger.info("── Fase 6: Gobuster ──")
            t = target.lower()
            gobuster_target = (f"{target.rstrip('/')}/WebGoat"
                               if ('webgoat' in t or '8080' in t) else target)
            results['directories'] = self.run_gobuster(
                gobuster_target, dry_run=dry_run,
                retry_cfg=retry_cfg, cookie=session_cookie)

        # ── Fase 7: ZAP Full Scan ─────────────────────────────────────────────
        if tools.get('zap', False):
            logger.info("── Fase 7: ZAP Full Scan ──")
            extra_urls = []
            for group in results.get('ffuf_endpoints', []):
                for ep in group.get('endpoints', []):
                    u = ep.get('url', '')
                    if u: extra_urls.append(u)
            for d in results.get('directories', []):
                path = d.get('path', '')
                if path and not d.get('is_false_positive'):
                    extra_urls.append(f"{target.rstrip('/')}{path}")

            if extra_urls:
                logger.info("Inyectando %d URLs en ZAP", len(extra_urls))
                if hasattr(self.zap, 'inject_urls'):
                    self.zap.inject_urls(extra_urls)

            zap_result = self.run_zap_full(target, cookie=session_cookie)
            results['spider_results']  = [{'url': u} for u in zap_result.get('urls_descubiertas', [])]
            results['vulnerabilities'] = zap_result.get('vulnerabilidades', [])

        # ── Fase 8: Nuclei ────────────────────────────────────────────────────
        if tools.get('nuclei', False):
            logger.info("── Fase 8: Nuclei ── (cookie: %s)", "sí" if session_cookie else "no")
            results['nuclei_findings'] = self.run_nuclei(
                target, dry_run=dry_run, cookie=session_cookie,
                retry_cfg={'max_retries': 0})

        # ── Fase 9: Injection Scanner (10 técnicas) / SQLMap fallback ────────
        if tools.get('sqlmap', False) or tools.get('injection', False):
            logger.info("── Fase 9: Injection Scanner ──")
            results['sqli_results'] = self.run_injection_scan(
                target,
                cookie=session_cookie,
                techniques=options.get('injection_techniques', None),
            )

        # ── Fase 10: Searchsploit ─────────────────────────────────────────────
        # FIX v5.1: CVEs de Nuclei (Fase 8) propagados a search_exploits()
        if tools.get('searchsploit', False):
            logger.info("── Fase 10: Searchsploit ──")
            known_cves = [
                f.get('cve_id') for f in results.get('nuclei_findings', [])
                if f.get('cve_id')
            ]
            results['exploits'] = self.search_exploits(
                results.get('technologies', []),
                results.get('ports', []),
                target=target,
                known_cves=known_cves or None,
            )

        return results

    def _run_sequential(self, target: str, options: Dict[str, Any]) -> Dict[str, Any]:
        return self.run_parallel_scans(target, options)

    def run_full_scan(self, target: str, options: Dict[str, Any]) -> Dict[str, Any]:
        dry_run   = bool(options.get('dry_run', False))
        cb_cfg    = options.get('circuit_breaker', {}) or {}
        tv_cfg    = options.get('target_validation', {}) or {}
        retry_cfg = options.get('retry_config', {}) or {}

        if not dry_run and (tv_cfg.get('check_dns') or tv_cfg.get('check_reachability')):
            ok, reason = self.validate_target(target, tv_cfg)
            if not ok:
                logger.warning("Orchestrator: target inválido — %s", reason)
                return {'error': f'Target inválido: {reason}', 'aborted': True}

        if self._cb_check(target, cb_cfg):
            logger.warning("Orchestrator CB abierto para %s", target[:80])
            return {'error': 'Circuit breaker abierto', 'aborted': True}

        options['_dry_run']   = dry_run
        options['_retry_cfg'] = retry_cfg
        options['_cb_cfg']    = cb_cfg

        try:
            result = self.run_parallel_scans(target, options)
            self._cb_success(target)
            return result
        except Exception:
            self._cb_fail(target)
            raise