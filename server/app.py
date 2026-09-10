"""
SecureScan Pro v5.0 - Backend API
Flask application with Redis for persistent storage

CORRECCIONES ACUMULADAS v5.0:
  1.  Race condition en run_scan() — resultados se persisten en Redis
      inmediatamente tras cada herramienta; el guardado final usa una
      copia fresca leída de Redis, no la variable local inicial.
  2.  CORS lee orígenes desde variable de entorno ALLOWED_ORIGINS.
  3.  get_scan_storage() cachea el estado de conexión (10s) para evitar
      ping a Redis en cada operación.
  4.  scans_fallback usa threading.Lock para acceso seguro multi-hilo.
  5.  FORBIDDEN_PATTERNS: eliminada excepción inconsistente en 10.x.x.x.
  6.  request.get_json() usa silent=True — sin crash con body malformado.
  7.  app.secret_key asignada desde SECRET_KEY con validación.
  8.  Autenticación por token (X-API-Token) en endpoints sensibles.
  9.  Rate limiting con flask-limiter para evitar abuso.
  10. Validación de scan_id como UUID v4 antes de cada operación.
  11. RESTRICT_TO_LAB_TARGETS leída desde variable de entorno.
  12. ZAP unificado en un solo paso usando run_zap_full() — elimina
      doble ejecución y el bug de Spider ID inválido (0).
  13. Numeración de pasos corregida en run_scan() (sin duplicados).
  14. Patator en Paso 3 — antes de Nuclei (Paso 8) para que la cookie
      esté disponible para todas las herramientas.
  15. Comentario incorrecto sobre tuplas de 2 corregido — son de 3
      (url, params, data).
  16. scans_fallback limitado a 200 entradas para evitar OOM sin Redis.
  17. Thread de escaneo daemon=False para sobrevivir al worker de gunicorn.
  18. Paso 9 integra run_injection_scan() (10 técnicas) con fallback
      a SQLMap si InjectionScanner no está instalado.
  19. inject_urls protegido con hasattr() en el paso de ZAP.
  20. Nombre de campo corregido: nuclei_findings (antes nikto_findings).
"""

import os
import re
import json
import socket
import uuid
import uuid as uuid_module
import time
import logging
import threading
import ipaddress
import tempfile
import shutil
from datetime import datetime
from functools import wraps
from typing import Dict, List, Optional
from urllib.parse import urlparse
from utils.i18n_backend import get_t, locale_from_request
import job_executor
import scheduler
import osint_cache
import notifications
import comparison

def _t(key: str, **kwargs) -> str:
    """Shorthand: traduce key al locale de la request actual."""
    return get_t(locale_from_request(request))(key, **kwargs)

from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import redis

try:
    from modules.orchestrator import SecurityOrchestrator
except ImportError as e:
    print(f"DEBUG: Error importando directamente: {e}")
    import importlib.util
    import sys
    spec   = importlib.util.spec_from_file_location("orchestrator", "/app/modules/orchestrator.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    SecurityOrchestrator = module.SecurityOrchestrator
    print("DEBUG: SecurityOrchestrator cargado vía fallback manual")

from utils.scoring  import calculate_security_score, calculate_score_from_findings, calculate_grade, get_risk_level
import findings as findings_module
from utils.reporter import generate_report

try:
    from modules.circuit_breaker import CircuitBreaker
except ImportError:
    import importlib.util as _ilu2
    _cbspec = _ilu2.spec_from_file_location("circuit_breaker", "/app/modules/circuit_breaker.py")
    _cbmod  = _ilu2.module_from_spec(_cbspec)
    _cbspec.loader.exec_module(_cbmod)
    CircuitBreaker = _cbmod.CircuitBreaker

try:
    from modules.code_analysis.orchestrator import CodeScanOrchestrator
    from modules.code_analysis.source_fetcher import clone_repo, extract_zip_safe, validate_repo_url
    from modules.code_analysis.trivy_scanner import validate_image_ref
    from modules.osint.breach_checker import BreachChecker
    from modules.osint.username_search import UsernameSearchScanner
    from modules.osint.sherlock_runner import SherlockRunner
    from modules.osint.theharvester_runner import TheHarvesterRunner
except ImportError as e:
    print(f"DEBUG: Error importando code_analysis directamente: {e}")
    import importlib.util as _ilu
    def _load(name, path):
        spec = _ilu.spec_from_file_location(name, path)
        mod  = _ilu.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    _fetcher = _load("source_fetcher", "/app/modules/code_analysis/source_fetcher.py")
    clone_repo, extract_zip_safe, validate_repo_url = _fetcher.clone_repo, _fetcher.extract_zip_safe, _fetcher.validate_repo_url
    _trivymod = _load("trivy_scanner", "/app/modules/code_analysis/trivy_scanner.py")
    validate_image_ref = _trivymod.validate_image_ref
    _codeorch = _load("code_orchestrator", "/app/modules/code_analysis/orchestrator.py")
    CodeScanOrchestrator = _codeorch.CodeScanOrchestrator
    _breach = _load("breach_checker", "/app/modules/osint/breach_checker.py")
    BreachChecker = _breach.BreachChecker
    _userscan = _load("username_search", "/app/modules/osint/username_search.py")
    UsernameSearchScanner = _userscan.UsernameSearchScanner
    _sherlock = _load("sherlock_runner", "/app/modules/osint/sherlock_runner.py")
    SherlockRunner = _sherlock.SherlockRunner
    _harvester = _load("theharvester_runner", "/app/modules/osint/theharvester_runner.py")
    TheHarvesterRunner = _harvester.TheHarvesterRunner
    print("DEBUG: CodeScanOrchestrator/OSINT cargados vía fallback manual")

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# ── Flask app ─────────────────────────────────────────────────────────────────
app = Flask(__name__)

# Límite duro de tamaño de request -- protege /api/code-scan (upload de ZIP)
# de que alguien mande un body gigante antes de que el endpoint alcance a
# revisar nada. Un poco por encima de CODE_SCAN_MAX_ZIP_MB para dejar margen
# al overhead de multipart/form-data.
app.config['MAX_CONTENT_LENGTH'] = int(os.environ.get('CODE_SCAN_MAX_ZIP_MB', 50)) * 1024 * 1024 + (5 * 1024 * 1024)

_secret_key = os.environ.get('SECRET_KEY', '')
if not _secret_key or 'CAMBIA' in _secret_key or 'change' in _secret_key.lower():
    if os.environ.get('FLASK_ENV') != 'development':
        raise RuntimeError(
            "SECRET_KEY debe ser una clave segura en producción. "
            "Genera una con: openssl rand -hex 32"
        )
    _secret_key = 'dev-only-insecure-key'
    logger.warning("Usando SECRET_KEY de desarrollo — NO usar en producción.")
app.secret_key = _secret_key

_allowed_origins = os.environ.get(
    'ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000',
).split(',')
CORS(app, origins=[o.strip() for o in _allowed_origins])

# ── Redis ─────────────────────────────────────────────────────────────────────
redis_url    = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
redis_client = redis.from_url(redis_url, decode_responses=True)
notifications.set_redis_client(redis_client)

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    storage_uri=redis_url,
    default_limits=["500 per day", "100 per hour"],
)

# ── Configuración ─────────────────────────────────────────────────────────────
ZAP_API_KEY  = os.environ.get('ZAP_API_KEY',  'securescan-dev-key-2024')
ZAP_API_URL  = os.environ.get('ZAP_API_URL',  'http://localhost:8080')
MSF_HOST     = os.environ.get('MSF_HOST',     '127.0.0.1')
MSF_PORT     = int(os.environ.get('MSF_PORT', '55553'))
MSF_PASSWORD = os.environ.get('MSF_PASSWORD', 'msf')

API_TOKEN = os.environ.get('API_TOKEN', '')
if not API_TOKEN:
    logger.warning(
        "API_TOKEN no configurado — todos los endpoints son accesibles sin autenticación. "
        "Configura API_TOKEN en .env para entornos expuestos."
    )

ALLOWED_LAB_TARGETS = os.environ.get(
    'ALLOWED_LAB_TARGETS',
    'juice-shop:3000,dvwa:80,webgoat:8080',
).split(',')

RESTRICT_TO_LAB = os.environ.get('RESTRICT_TO_LAB_TARGETS', 'false').lower() == 'true'

# ── Caché OSINT (Redis, TTL) ────────────────────────────────────────────────
OSINT_CACHE_TTL = int(os.environ.get('OSINT_CACHE_TTL_SECONDS', '3600'))

# NOTA: Se removieron los patrones de rangos privados (10.x, 192.168.x, 172.16-31.x)
# para permitir escanear redes domésticas/locales propias del usuario.
FORBIDDEN_PATTERNS = [
    r'^localhost',
    r'^0\.0\.0\.0',
    r'^::1',
]

# ── Circuit Breaker ───────────────────────────────────────────────────────────
# Antes: dict de Python en memoria (se perdía en cada reinicio del server).
# Ahora: respaldado en Redis vía modules.circuit_breaker.CircuitBreaker, para
# que el estado sobreviva reinicios y se comparta entre réplicas.
web_circuit_breaker = CircuitBreaker(redis_client, key_prefix='web-target', failure_threshold=3, recovery_timeout=60)


def _cb_is_open(target: str, cfg: dict) -> bool:
    if not cfg.get('enabled', True):
        return False
    return web_circuit_breaker.is_open(
        target,
        failure_threshold=cfg.get('failure_threshold', 3),
        recovery_timeout=cfg.get('recovery_timeout', 60),
    )


def _cb_record_failure(target: str) -> None:
    web_circuit_breaker.record_failure(target)


def _cb_record_success(target: str) -> None:
    web_circuit_breaker.record_success(target)


def _validate_target_reachability(target: str, cfg: dict) -> tuple:
    timeout = cfg.get('timeout', 10)
    try:
        parsed   = urlparse(target)
        hostname = parsed.hostname
        port     = parsed.port or (443 if parsed.scheme == 'https' else 80)
        if not hostname:
            return False, 'No se pudo extraer hostname del target'
        if cfg.get('check_dns', True):
            try:
                socket.getaddrinfo(hostname, None)
            except (socket.gaierror, socket.herror) as e:
                return False, f'DNS no resuelve para {hostname}: {e}'
        if cfg.get('check_reachability', True):
            try:
                with socket.create_connection((hostname, port), timeout=timeout):
                    pass
            except (socket.timeout, ConnectionRefusedError, OSError) as e:
                return False, f'Host no alcanzable {hostname}:{port}: {e}'
        return True, 'ok'
    except Exception as e:
        return False, f'Error en validación de target: {e}'


def _build_dry_run_scan(job_id: str, target: str, scan_data: dict) -> dict:
    mock = dict(scan_data)
    mock['status']  = 'completed'
    mock['endTime'] = datetime.utcnow().isoformat() + 'Z'
    mock['dry_run'] = True
    mock['technologies'] = [
        {'name': 'Nginx',  'version': '1.25.0', 'category': 'server',     'confidence': 100},
        {'name': 'jQuery', 'version': '3.7.1',  'category': 'javascript', 'confidence': 90},
    ]
    mock['ports'] = [
        {'port': 80,  'protocol': 'tcp', 'state': 'open', 'service': 'http',  'product': 'nginx'},
        {'port': 443, 'protocol': 'tcp', 'state': 'open', 'service': 'https', 'product': 'nginx'},
    ]
    mock['directories'] = [
        {'path': '/admin', 'status': 403, 'type': 'directory'},
        {'path': '/login', 'status': 200, 'type': 'page'},
        {'path': '/api',   'status': 200, 'type': 'directory'},
    ]
    mock['vulnerabilities'] = [
        {'name': '[DRY-RUN] X-Frame-Options header missing',
         'risk': 'medium', 'tool': 'zap',
         'description': 'Simulado — no se ejecutó ZAP real'},
    ]
    mock['score'] = {
        'total': 72, 'grade': 'C',
        'breakdown': {'critical': 0, 'high': 0, 'medium': 1, 'low': 0, 'info': 2},
        'riskLevel': 'MEDIUM',
    }
    for step in mock.get('steps', []):
        step['status']   = 'completed'
        step['progress'] = 100
    return mock


# ── Storage ───────────────────────────────────────────────────────────────────
scans_fallback: Dict[str, dict] = {}
_fallback_lock = threading.Lock()
_redis_ok_until: float = 0.0
_redis_last_state: str = 'memory'
_redis_status_lock = threading.Lock()
# FIX: límite para evitar OOM cuando Redis no está disponible
_FALLBACK_MAX_SCANS = 200

# ── Orchestrator ──────────────────────────────────────────────────────────────
orchestrator = SecurityOrchestrator(
    zap_api_key=ZAP_API_KEY,
    zap_api_url=ZAP_API_URL,
    msf_host=MSF_HOST,
    msf_port=MSF_PORT,
    msf_password=MSF_PASSWORD,
    redis_client=redis_client,
)

# ── Orchestrator de Análisis de Código (Grupo 3) ────────────────────────────────
code_orchestrator = CodeScanOrchestrator(
    gitleaks_timeout=int(os.environ.get('SCAN_TIMEOUT_GITLEAKS', 120)),
    trufflehog_timeout=int(os.environ.get('SCAN_TIMEOUT_TRUFFLEHOG', 120)),
    trufflehog_verify=os.environ.get('TRUFFLEHOG_VERIFY', 'true').lower() == 'true',
    semgrep_timeout=int(os.environ.get('SCAN_TIMEOUT_SEMGREP', 180)),
    trivy_timeout=int(os.environ.get('SCAN_TIMEOUT_TRIVY', 120)),
    trivy_image_timeout=int(os.environ.get('SCAN_TIMEOUT_TRIVY_IMAGE', 300)),
    dependency_check_timeout=int(os.environ.get('SCAN_TIMEOUT_DEPCHECK', 300)),
    nvd_api_key=os.environ.get('NVD_API_KEY'),
)
CODE_SCAN_MAX_ZIP_MB = int(os.environ.get('CODE_SCAN_MAX_ZIP_MB', 50))

# ── Herramientas OSINT (Grupo 2) — síncronas, sin job/polling ───────────────────
breach_checker    = BreachChecker(timeout=int(os.environ.get('SCAN_TIMEOUT_BREACH', 15)))
username_searcher = UsernameSearchScanner(timeout=int(os.environ.get('SCAN_TIMEOUT_USERNAME', 8)))
sherlock_runner    = SherlockRunner(
    timeout_per_site=int(os.environ.get('SHERLOCK_TIMEOUT_PER_SITE', 15)),
    overall_timeout=int(os.environ.get('SHERLOCK_OVERALL_TIMEOUT', 600)),
)
harvester_runner = TheHarvesterRunner(
    timeout=int(os.environ.get('THEHARVESTER_TIMEOUT', 90)),
    limit=int(os.environ.get('THEHARVESTER_LIMIT', 200)),
)

# ── Auth decorator ────────────────────────────────────────────────────────────
def require_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if API_TOKEN:
            token = (
                request.headers.get('X-API-Token')
                or request.args.get('api_token')
            )
            if token != API_TOKEN:
                logger.warning(
                    "Intento de acceso no autorizado a %s desde %s",
                    request.path, request.remote_addr,
                )
                return jsonify({'error': _t('errors.unauthorized')}), 401
        return f(*args, **kwargs)
    return decorated

# ── Validación ────────────────────────────────────────────────────────────────
def validate_scan_id(scan_id: str) -> bool:
    try:
        uuid_module.UUID(scan_id, version=4)
        return True
    except (ValueError, AttributeError):
        return False


def is_allowed_target(target: str) -> tuple:
    try:
        parsed   = urlparse(target if '://' in target else f'http://{target}')
        hostname = parsed.hostname or target
        if any(
            hostname == allowed or hostname.startswith(allowed.split(':')[0])
            for allowed in ALLOWED_LAB_TARGETS
        ):
            return True, "Lab target allowed"
        if RESTRICT_TO_LAB:
            return False, (
                "Solo se permiten targets de laboratorio en modo restringido. "
                f"Targets permitidos: {', '.join(ALLOWED_LAB_TARGETS)}"
            )
        if any(c in target for c in ['@', ' ', '\\', '\n', '\r']):
            return False, "Target contains invalid characters"
        for pattern in FORBIDDEN_PATTERNS:
            if re.match(pattern, hostname, re.IGNORECASE):
                return False, f"Target matches forbidden pattern: {pattern}"
        try:
            ip = ipaddress.ip_address(hostname)
            # NOTA: Se removió el bloqueo de IPs privadas para permitir escanear
            # redes domésticas/locales del usuario. Solo se bloquea loopback.
            if ip.is_loopback:
                return False, "Loopback IP addresses are not allowed"
        except ValueError:
            pass
        return True, "Target allowed"
    except Exception as e:
        return False, f"Target validation error: {e}"

# ── Storage helpers ───────────────────────────────────────────────────────────
def get_scan_storage() -> str:
    global _redis_ok_until, _redis_last_state
    with _redis_status_lock:
        now = time.time()
        if now < _redis_ok_until:
            return _redis_last_state
        try:
            redis_client.ping()
            _redis_last_state = 'redis'
        except Exception:
            _redis_last_state = 'memory'
        _redis_ok_until = now + 10.0
        return _redis_last_state


_TERMINAL_STATUSES = {'completed', 'error', 'failed', 'cancelled'}


def _notify_event_name(status: str) -> str:
    if status == 'cancelled':
        return 'job.cancelled'
    if status == 'completed':
        return 'job.completed'
    return 'job.failed'  # cubre 'error' y 'failed'


def _maybe_notify_once(scan_id: str, scan_data: dict, status: str) -> None:
    """
    Dispara la notificación de un Job exactamente una vez por Job, aunque
    save_scan() se llame varias veces (p. ej. dos escrituras seguidas en
    estado 'completed'). El flag de deduplicación vive en Redis con su
    propio TTL; en modo fallback (sin Redis) no hay deduplicación entre
    reinicios, pero tampoco la hay hoy para nada más en ese modo -- ver
    limitaciones ya documentadas de scans_fallback.
    """
    try:
        if get_scan_storage() == 'redis':
            already = not redis_client.set(f"notified:{scan_id}", '1', nx=True, ex=90000)
            if already:
                return
        notifications.dispatch(_notify_event_name(status), scan_data)
    except Exception as e:
        logger.warning("No se pudo evaluar/enviar notificación para %s: %s", scan_id, e)


def save_scan(scan_id: str, scan_data: dict) -> None:
    status = scan_data.get('status', 'running')
    ttl    = 86400 if status == 'completed' else 3600
    if get_scan_storage() == 'redis':
        try:
            redis_client.setex(f"scan:{scan_id}", ttl, json.dumps(scan_data))
            if status in _TERMINAL_STATUSES:
                _maybe_notify_once(scan_id, scan_data, status)
            return
        except Exception:
            pass
    with _fallback_lock:
        # FIX: evitar OOM — eliminar el scan más antiguo si se supera el límite
        if scan_id not in scans_fallback and len(scans_fallback) >= _FALLBACK_MAX_SCANS:
            oldest_key = next(iter(scans_fallback))
            del scans_fallback[oldest_key]
            logger.warning("Fallback storage lleno — eliminado scan más antiguo: %s", oldest_key)
        scans_fallback[scan_id] = scan_data
    if status in _TERMINAL_STATUSES:
        _maybe_notify_once(scan_id, scan_data, status)


def get_scan(scan_id: str) -> Optional[dict]:
    if get_scan_storage() == 'redis':
        try:
            data = redis_client.get(f"scan:{scan_id}")
            if data:
                return json.loads(data)
        except Exception:
            pass
    with _fallback_lock:
        return scans_fallback.get(scan_id)


def list_scans() -> List[dict]:
    if get_scan_storage() == 'redis':
        try:
            keys  = redis_client.keys("scan:*")
            scans = []
            for key in keys:
                data = redis_client.get(key)
                if data:
                    try:
                        scans.append(json.loads(data))
                    except json.JSONDecodeError:
                        pass
            return scans
        except Exception:
            pass
    with _fallback_lock:
        return list(scans_fallback.values())


def update_step(job_id: str, step_name: str, status: str, progress: int = 0) -> None:
    scan = get_scan(job_id)
    if not scan:
        return
    for step in scan.get('steps', []):
        if step['name'] == step_name:
            step['status']   = status
            step['progress'] = progress
            if status == 'running':
                step['startTime'] = int(time.time() * 1000)
            elif status in ('completed', 'error'):
                step['endTime'] = int(time.time() * 1000)
            break
    save_scan(job_id, scan)


def _persist_step_result(job_id: str, field: str, value) -> None:
    fresh = get_scan(job_id)
    if fresh:
        fresh[field] = value
        save_scan(job_id, fresh)

# ── run_scan ──────────────────────────────────────────────────────────────────
def run_scan(job_id: str, target: str, options: dict):
    """
    Pipeline completo de escaneo v5.0.

    ORDEN DE PASOS:
      1.  Wappalyzer
      2.  Nmap
      3.  Patator     ← brute force + extrae session_cookie
      4.  Metasploit
      5.  ffuf
      6.  Gobuster
      7.  ZAP Full Scan (spider + active)
      8.  Nuclei      ← recibe session_cookie de Paso 3
      9.  Injection Scanner (10 técnicas) / SQLMap fallback
      10. Searchsploit
      11. Scoring
    """
    try:
        tools = options.get('tools', {})

        # Normalizar: 'zap' del frontend activa el full scan unificado
        if tools.get('zap'):
            tools['zap_full'] = True

        # ── Huella Digital (Threat Intel) — arranca en paralelo desde ya ───────
        # No depende de session_cookie, CVEs ni nada del resto del pipeline,
        # así que no tiene que esperar su turno como las demás fases.
        threat_intel_thread = None
        if tools.get('threat_intel', True):
            update_step(job_id, 'Huella Digital', 'running')

            def _run_threat_intel():
                try:
                    enabled = tools.get('threat_intel_tools')  # None = todas (compat. con llamadas viejas)
                    result = orchestrator.run_threat_intel(target, enabled_tools=enabled)
                    _persist_step_result(job_id, 'threat_intel', result)
                    update_step(job_id, 'Huella Digital', 'completed', 100)
                except Exception as e:
                    logger.error("Huella Digital failed: %s", e)
                    update_step(job_id, 'Huella Digital', 'error', 0)

            threat_intel_thread = threading.Thread(target=_run_threat_intel, daemon=True)
            threat_intel_thread.start()
        else:
            update_step(job_id, 'Huella Digital', 'completed', 100)

        # Pre-inicializar variables
        technologies:        list = []
        ports:               list = []
        directories:         list = []
        vulnerabilities:     list = []
        exploits:            list = []
        msf_results:         list = []
        nuclei_findings:     list = []
        sqli_results:        list = []
        brute_force_results: list = []
        ffuf_endpoints:      list = []
        spider_results:      list = []

        # ── Auto-login: obtener cookie/token para labs conocidos ──────────────
        session_cookie  = None
        _auth_timestamp = time.time()   # Marca de tiempo del último login exitoso
        _SESSION_TTL    = 20 * 60       # Refrescar si han pasado >20 minutos

        def _refresh_session_if_needed(label: str = '') -> None:
            """
            Refresca la cookie si han pasado más de _SESSION_TTL segundos
            desde el último login. Actualiza session_cookie en el closure.
            Solo actúa para DVWA y WebGoat — Juice Shop usa JWT de 3h.
            """
            nonlocal session_cookie, _auth_timestamp
            t_lower = target.lower()
            # Juice Shop: JWT dura 3h, no necesita refresco
            if 'juice' in t_lower or '3001' in t_lower or '3000' in t_lower:
                return
            elapsed = time.time() - _auth_timestamp
            if elapsed < _SESSION_TTL:
                return
            logger.info(
                "Reautenticando para %s antes de %s (elapsed=%.0fs)",
                target, label, elapsed,
            )
            try:
                fresh = orchestrator._get_session_for_target(target)
                if fresh.get('cookie'):
                    session_cookie  = fresh['cookie']
                    _auth_timestamp = time.time()
                    logger.info("Reautenticación exitosa — nueva cookie obtenida")
                else:
                    logger.warning("Reautenticación fallida — usando cookie anterior")
            except Exception as _re:
                logger.warning("Error en reautenticación: %s", _re)

        auth_info = orchestrator._get_session_for_target(target)
        if auth_info.get('cookie'):
            session_cookie = auth_info['cookie']
            if auth_info.get('user_agent'):
                t = target.lower()
                if 'webgoat' in t or '3003' in t:
                    try:
                        orchestrator.zap.zap.core.set_option_default_user_agent(
                            auth_info['user_agent']
                        )
                        logger.info("ZAP User-Agent actualizado para WebGoat")
                    except Exception as e:
                        logger.debug("No se pudo actualizar UA en ZAP: %s", e)
            logger.info("Auto-login exitoso — cookie disponible para todas las herramientas")

        # ── Paso 1: Wappalyzer ────────────────────────────────────────────────
        if tools.get('wappalyzer', False):
            update_step(job_id, 'Wappalyzer', 'running')
            try:
                technologies = orchestrator.run_wappalyzer(target)
                _persist_step_result(job_id, 'technologies', technologies)
                update_step(job_id, 'Wappalyzer', 'completed', 100)
            except Exception as e:
                logger.error("Wappalyzer failed: %s", e)
                update_step(job_id, 'Wappalyzer', 'error', 0)
        else:
            update_step(job_id, 'Wappalyzer', 'completed', 100)

        # ── Paso 2: Nmap ──────────────────────────────────────────────────────
        if tools.get('nmap', False):
            update_step(job_id, 'Nmap', 'running')
            try:
                ports = orchestrator.run_nmap(target)
                _persist_step_result(job_id, 'ports', ports)
                update_step(job_id, 'Nmap', 'completed', 100)
            except Exception as e:
                logger.error("Nmap failed: %s", e)
                update_step(job_id, 'Nmap', 'error', 0)
        else:
            update_step(job_id, 'Nmap', 'completed', 100)

        # ── Paso 3: Patator — brute force + obtener cookie ────────────────────
        # Cookie disponible para pasos 4-10
        if tools.get('patator', False):
            update_step(job_id, 'Patator', 'running')
            try:
                patator_path        = options.get('login_path') or None
                brute_force_results = orchestrator.run_patator(
                    target, form_path=patator_path)
                _persist_step_result(job_id, 'brute_force_results', brute_force_results)
                for bf in brute_force_results:
                    if bf.get('success'):
                        for cred in bf.get('credentials', []):
                            if cred.get('session_cookie'):
                                session_cookie = cred['session_cookie']
                                logger.info("Cookie obtenida via Patator para %s", target)
                                break
                update_step(job_id, 'Patator', 'completed', 100)
            except Exception as e:
                logger.error("Patator failed: %s", e)
                update_step(job_id, 'Patator', 'error', 0)
        else:
            update_step(job_id, 'Patator', 'completed', 100)

        # ── Paso 4: Metasploit ────────────────────────────────────────────────
        if tools.get('metasploit', False):
            update_step(job_id, 'Metasploit', 'running')
            try:
                msf_results = orchestrator.run_metasploit(
                    target, ports=ports, technologies=technologies)
                _persist_step_result(job_id, 'metasploit', msf_results)
                update_step(job_id, 'Metasploit', 'completed', 100)
            except Exception as e:
                logger.error("Metasploit failed: %s", e)
                update_step(job_id, 'Metasploit', 'error', 0)
        else:
            update_step(job_id, 'Metasploit', 'completed', 100)

        # ── Paso 5: ffuf ──────────────────────────────────────────────────────
        if tools.get('ffuf', False):
            update_step(job_id, 'ffuf', 'running')
            try:
                t = target.lower()
                fuzz_path = '/WebGoat/FUZZ' if ('webgoat' in t or '8080' in t) else '/FUZZ'
                ffuf_endpoints = orchestrator.run_ffuf(
                    target, fuzz_path=fuzz_path, cookie=session_cookie)
                _persist_step_result(job_id, 'ffuf_endpoints', ffuf_endpoints)
                update_step(job_id, 'ffuf', 'completed', 100)
            except Exception as e:
                logger.error("ffuf failed: %s", e)
                update_step(job_id, 'ffuf', 'error', 0)
        else:
            update_step(job_id, 'ffuf', 'completed', 100)

        # ── Paso 6: Gobuster ──────────────────────────────────────────────────
        if tools.get('gobuster', False):
            update_step(job_id, 'Gobuster', 'running')
            try:
                t = target.lower()
                gobuster_target = (f"{target.rstrip('/')}/WebGoat"
                                   if ('webgoat' in t or '8080' in t) else target)
                directories = orchestrator.run_gobuster(
                    gobuster_target, cookie=session_cookie)
                _persist_step_result(job_id, 'directories', directories)
                update_step(job_id, 'Gobuster', 'completed', 100)
            except Exception as e:
                logger.error("Gobuster failed: %s", e)
                update_step(job_id, 'Gobuster', 'error', 0)
        else:
            update_step(job_id, 'Gobuster', 'completed', 100)

        # ── Paso 7: ZAP Full Scan ─────────────────────────────────────────────
        _refresh_session_if_needed('ZAP')   # ← reautentica si la sesión expiró
        if tools.get('zap', False) or tools.get('zap_full', False):
            update_step(job_id, 'ZAP Spider', 'running')
            update_step(job_id, 'ZAP', 'running')
            try:
                extra_urls = []
                for group in ffuf_endpoints:
                    for ep in group.get('endpoints', []):
                        u = ep.get('url', '')
                        if u: extra_urls.append(u)
                for d in directories:
                    path = d.get('path', '')
                    if path and not d.get('is_false_positive'):
                        extra_urls.append(f"{target.rstrip('/')}{path}")

                if extra_urls:
                    logger.info("Inyectando %d URLs en ZAP", len(extra_urls))
                    # FIX: protegido con hasattr()
                    if hasattr(orchestrator.zap, 'inject_urls'):
                        orchestrator.zap.inject_urls(extra_urls)
                    else:
                        import requests as _req
                        for _url in extra_urls[:50]:
                            try:
                                _req.get(
                                    f"{ZAP_API_URL}/JSON/core/action/accessUrl/",
                                    params={'apikey': ZAP_API_KEY, 'url': _url,
                                            'followRedirects': 'true'},
                                    timeout=5,
                                )
                            except Exception:
                                pass

                zap_result      = orchestrator.run_zap_full(target, cookie=session_cookie)
                spider_results  = [{'url': u} for u in zap_result.get('urls_descubiertas', [])]
                vulnerabilities = zap_result.get('vulnerabilidades', [])
                _persist_step_result(job_id, 'spider_results',  spider_results)
                _persist_step_result(job_id, 'vulnerabilities', vulnerabilities)
                update_step(job_id, 'ZAP Spider', 'completed', 100)
                update_step(job_id, 'ZAP',        'completed', 100)
                logger.info("ZAP completado: %d URLs, %d vulns",
                            len(spider_results), len(vulnerabilities))
            except Exception as e:
                logger.error("ZAP Full Scan failed: %s", e)
                update_step(job_id, 'ZAP Spider', 'error', 0)
                update_step(job_id, 'ZAP',        'error', 0)
        else:
            update_step(job_id, 'ZAP Spider', 'completed', 100)
            update_step(job_id, 'ZAP',        'completed', 100)

        # ── Paso 8: Nuclei ────────────────────────────────────────────────────
        # Cookie disponible desde Paso 3 (Patator o auto-login)
        _refresh_session_if_needed('Nuclei')   # ← reautentica si la sesión expiró
        if tools.get('nuclei', False):
            update_step(job_id, 'Nuclei', 'running')
            try:
                nuclei_findings = orchestrator.run_nuclei(
                    target, cookie=session_cookie)
                # FIX: nombre de campo correcto (antes: nikto_findings)
                _persist_step_result(job_id, 'nuclei_findings', nuclei_findings)
                update_step(job_id, 'Nuclei', 'completed', 100)
            except Exception as e:
                logger.error("Nuclei failed: %s", e)
                update_step(job_id, 'Nuclei', 'error', 0)
        else:
            update_step(job_id, 'Nuclei', 'completed', 100)

        # ── Paso 9: Injection Scanner / SQLMap ───────────────────────────────
        # InjectionScanner cubre 10 técnicas. Si no está instalado, usa SQLMap.
        _refresh_session_if_needed('InjectionScanner')   # ← reautentica si expiró
        if tools.get('sqlmap', False) or tools.get('injection', False):
            update_step(job_id, 'SQLMap', 'running')
            try:
                current = get_scan(job_id) or {}

                # Preferir cookie de Patator sobre auto-login
                patator_cookie = None
                for bf in current.get('brute_force_results', []):
                    if bf.get('success'):
                        for cred in bf.get('credentials', []):
                            if cred.get('session_cookie'):
                                patator_cookie = cred['session_cookie']
                                break
                if patator_cookie:
                    session_cookie = patator_cookie

                sqli_results = orchestrator.run_injection_scan(
                    target,
                    cookie=session_cookie,
                    techniques=options.get('injection_techniques', None),
                )
                _persist_step_result(job_id, 'sqli_results', sqli_results)
                update_step(job_id, 'SQLMap', 'completed', 100)
            except Exception as e:
                logger.error("Injection scan failed: %s", e)
                update_step(job_id, 'SQLMap', 'error', 0)
        else:
            update_step(job_id, 'SQLMap', 'completed', 100)

        # ── Paso 10: Searchsploit ─────────────────────────────────────────────
        if tools.get('searchsploit', False):
            update_step(job_id, 'Searchsploit', 'running')
            try:
                current = get_scan(job_id) or {}

                # Extraer CVEs desde nuclei_findings para correlación directa
                _nuclei_cves: List[str] = []
                for nf in current.get('nuclei_findings', []):
                    _tid = nf.get('template_id', '').lower()
                    if _tid.startswith('cve-') and len(_tid) >= 12:
                        _nuclei_cves.append(_tid.upper())

                exploits = orchestrator.search_exploits(
                    current.get('technologies', technologies),
                    current.get('ports', ports),
                    target=target,
                    known_cves=_nuclei_cves,
                )
                _persist_step_result(job_id, 'exploits', exploits)
                update_step(job_id, 'Searchsploit', 'completed', 100)
            except Exception as e:
                logger.error("Searchsploit failed: %s", e)
                update_step(job_id, 'Searchsploit', 'error', 0)
        else:
            update_step(job_id, 'Searchsploit', 'completed', 100)

        # ── Paso 11: Scoring ──────────────────────────────────────────────────
        update_step(job_id, 'Scoring', 'running')
        try:
            current = get_scan(job_id) or {}
            all_vulnerabilities = [
                v for v in (
                    current.get('vulnerabilities', vulnerabilities) +
                    current.get('sqli_results', []) +
                    current.get('nuclei_findings', []) +
                    current.get('metasploit', [])
                )
                if not v.get('simulated', False)
            ]
            score = calculate_security_score(
                all_vulnerabilities,
                current.get('exploits', exploits),
                brute_force_results=current.get('brute_force_results', []),
            )
            _persist_step_result(job_id, 'score', score)
            update_step(job_id, 'Scoring', 'completed', 100)
        except Exception as e:
            logger.error("Scoring failed: %s", e)
            update_step(job_id, 'Scoring', 'error', 0)

        # ── Esperar Huella Digital si todavía no terminó ────────────────────────
        if threat_intel_thread is not None:
            threat_intel_thread.join(timeout=orchestrator.TIMEOUTS['virustotal'] + 15)
            if threat_intel_thread.is_alive():
                logger.warning("Huella Digital no terminó a tiempo para %s", target[:80])
                update_step(job_id, 'Huella Digital', 'error', 0)

        # ── Finalizar ─────────────────────────────────────────────────────────
        final_scan            = get_scan(job_id) or {}
        final_scan['status']  = 'completed'
        final_scan['endTime'] = datetime.utcnow().isoformat()
        save_scan(job_id, final_scan)
        _cb_record_success(target)
        logger.info("Scan %s completed for target %s", job_id, target[:80])

    except Exception as e:
        logger.error("Critical scan failure for %s: %s", job_id, e)
        _cb_record_failure(target)
        failed_scan            = get_scan(job_id) or {}
        failed_scan['status']  = 'error'
        failed_scan['error']   = str(e)
        failed_scan['endTime'] = datetime.utcnow().isoformat()
        save_scan(job_id, failed_scan)


# ── run_code_scan (Grupo 3: Análisis de Código) ────────────────────────────────
def run_code_scan(job_id: str, source_type: str, source_value: str) -> None:
    """
    Pipeline de análisis de código: obtiene el código (clonando un repo
    o extrayendo un ZIP ya guardado en disco), corre los 6 scanners, y
    limpia el directorio temporal al terminar -- pase lo que pase. Para
    'image' es un camino aparte y mucho más corto: no hay código que
    clonar/extraer, Trivy escanea la imagen directo desde su registro.

    `source_type` es 'repo' (source_value = URL de GitHub), 'zip'
    (source_value = ruta al .zip ya guardado en disco por el endpoint),
    o 'image' (source_value = referencia de imagen Docker).
    """
    if source_type == 'image':
        update_step(job_id, 'Escaneando imagen', 'running')
        try:
            result = code_orchestrator.trivy.scan_image(source_value)
            _persist_step_result(job_id, 'trivy', result)
            summary = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'unknown': 0}
            for f in result.get('findings', []):
                sev = f.get('severity', 'unknown')
                summary[sev] = summary.get(sev, 0) + 1
            summary['total'] = sum(v for k, v in summary.items() if k != 'total')
            _persist_step_result(job_id, 'summary', summary)

            if result.get('error') and not result.get('findings'):
                update_step(job_id, 'Escaneando imagen', 'error', 0)
                failed = get_scan(job_id) or {}
                failed['status']  = 'error'
                failed['error']   = result['error']
                failed['endTime'] = datetime.utcnow().isoformat()
                save_scan(job_id, failed)
                return

            update_step(job_id, 'Escaneando imagen', 'completed', 100)
            final = get_scan(job_id) or {}
            final['status']  = 'completed'
            final['endTime'] = datetime.utcnow().isoformat()
            # Code Scan nunca tuvo score/grade -- ver server/findings.py y
            # utils.scoring.calculate_score_from_findings (auditoría: sin
            # esto, un scan con 40 hallazgos críticos y uno limpio se veían
            # "iguales" en el historial, ambos solo 'completed').
            final['score'] = calculate_score_from_findings(findings_module.dedupe_findings(findings_module.normalize_findings(final)))
            save_scan(job_id, final)
            logger.info("Image scan %s completado — %s", job_id, summary)
        except Exception as e:
            logger.error("Critical image scan failure for %s: %s", job_id, e)
            failed = get_scan(job_id) or {}
            failed['status']  = 'error'
            failed['error']   = str(e)
            failed['endTime'] = datetime.utcnow().isoformat()
            save_scan(job_id, failed)
        return

    workdir = tempfile.mkdtemp(prefix=f'codescan-{job_id[:8]}-')
    code_dir = os.path.join(workdir, 'code')

    try:
        # ── Paso 1: obtener el código ────────────────────────────────────────
        update_step(job_id, 'Obtener código', 'running')
        if source_type == 'repo':
            ok, error = clone_repo(source_value, code_dir, timeout=int(os.environ.get('SCAN_TIMEOUT_CLONE', 180)))
        else:
            ok, error = extract_zip_safe(source_value, code_dir)

        if not ok:
            logger.warning("run_code_scan %s: fallo obteniendo código — %s", job_id, error)
            update_step(job_id, 'Obtener código', 'error', 0)
            failed = get_scan(job_id) or {}
            failed['status']  = 'error'
            failed['error']   = error
            failed['endTime'] = datetime.utcnow().isoformat()
            save_scan(job_id, failed)
            return
        update_step(job_id, 'Obtener código', 'completed', 100)

        # ── Paso 2-7: los 6 scanners reales ──────────────────────────────────
        for step_name in ('Gitleaks', 'TruffleHog', 'Backdoors', 'Semgrep', 'Trivy', 'Dependency-Check'):
            update_step(job_id, step_name, 'running')

        result = code_orchestrator.scan_directory(code_dir)

        _persist_step_result(job_id, 'gitleaks', result['gitleaks'])
        _persist_step_result(job_id, 'trufflehog', result['trufflehog'])
        _persist_step_result(job_id, 'backdoors', result['backdoors'])
        _persist_step_result(job_id, 'semgrep', result['semgrep'])
        _persist_step_result(job_id, 'trivy', result['trivy'])
        _persist_step_result(job_id, 'dependency_check', result['dependency_check'])
        _persist_step_result(job_id, 'summary', result['summary'])

        for step_name in ('Gitleaks', 'TruffleHog', 'Backdoors', 'Semgrep', 'Trivy', 'Dependency-Check'):
            update_step(job_id, step_name, 'completed', 100)

        final_scan            = get_scan(job_id) or {}
        final_scan['status']  = 'completed'
        final_scan['endTime'] = datetime.utcnow().isoformat()
        final_scan['score']   = calculate_score_from_findings(findings_module.dedupe_findings(findings_module.normalize_findings(final_scan)))
        save_scan(job_id, final_scan)
        logger.info("Code scan %s completado — %s", job_id, result['summary'])

    except Exception as e:
        logger.error("Critical code scan failure for %s: %s", job_id, e)
        failed = get_scan(job_id) or {}
        failed['status']  = 'error'
        failed['error']   = str(e)
        failed['endTime'] = datetime.utcnow().isoformat()
        save_scan(job_id, failed)

    finally:
        # Limpieza SIEMPRE -- el código clonado/subido no debe quedar en disco
        shutil.rmtree(workdir, ignore_errors=True)


# ── run_sherlock_scan (Grupo 2: OSINT, búsqueda profunda) ──────────────────────
def run_sherlock_scan(job_id: str, username: str) -> None:
    """
    Corre Sherlock real (414 sitios) en segundo plano -- a diferencia de
    la búsqueda rápida (síncrona), esto puede tardar minutos, así que
    sigue el mismo patrón de job+polling que run_code_scan.
    """
    update_step(job_id, 'Buscando en 414 sitios', 'running')
    try:
        result = sherlock_runner.run(username)

        if result.get('error') and not result.get('checked_count'):
            update_step(job_id, 'Buscando en 414 sitios', 'error', 0)
            failed = get_scan(job_id) or {}
            failed['status']  = 'error'
            failed['error']   = result['error']
            failed['endTime'] = datetime.utcnow().isoformat()
            save_scan(job_id, failed)
            return

        _persist_step_result(job_id, 'found', result['found'])
        _persist_step_result(job_id, 'unknown_sites', result['unknown_sites'])
        _persist_step_result(job_id, 'checked_count', result['checked_count'])
        update_step(job_id, 'Buscando en 414 sitios', 'completed', 100)

        final_scan            = get_scan(job_id) or {}
        final_scan['status']  = 'completed'
        final_scan['endTime'] = datetime.utcnow().isoformat()
        final_scan['score']   = calculate_score_from_findings(findings_module.dedupe_findings(findings_module.normalize_findings(final_scan)))
        save_scan(job_id, final_scan)
        logger.info("Sherlock scan %s completado — %d encontrados", job_id, len(result['found']))

    except Exception as e:
        logger.error("Critical sherlock scan failure for %s: %s", job_id, e)
        failed = get_scan(job_id) or {}
        failed['status']  = 'error'
        failed['error']   = str(e)
        failed['endTime'] = datetime.utcnow().isoformat()
        save_scan(job_id, failed)


# ── run_harvester_scan (Grupo 2: OSINT, por dominio) ────────────────────────────
def run_harvester_scan(job_id: str, domain: str) -> None:
    """
    Corre theHarvester real en segundo plano -- puede tardar hasta el
    timeout configurado (varias fuentes externas secuenciales/paralelas),
    así que sigue el mismo patrón de job+polling que Sherlock.
    """
    update_step(job_id, 'Consultando fuentes OSINT', 'running')
    try:
        result = harvester_runner.run(domain)

        if result.get('error') and not result.get('available'):
            update_step(job_id, 'Consultando fuentes OSINT', 'error', 0)
            failed = get_scan(job_id) or {}
            failed['status']  = 'error'
            failed['error']   = result['error']
            failed['endTime'] = datetime.utcnow().isoformat()
            save_scan(job_id, failed)
            return

        _persist_step_result(job_id, 'emails', result['emails'])
        _persist_step_result(job_id, 'hosts', result['hosts'])
        _persist_step_result(job_id, 'ips', result['ips'])
        _persist_step_result(job_id, 'sources_used', result['sources_used'])
        update_step(job_id, 'Consultando fuentes OSINT', 'completed', 100)

        final_scan            = get_scan(job_id) or {}
        final_scan['status']  = 'completed'
        final_scan['endTime'] = datetime.utcnow().isoformat()
        if result.get('error'):
            final_scan['error'] = result['error']  # error parcial -- igual completó
        final_scan['score'] = calculate_score_from_findings(findings_module.dedupe_findings(findings_module.normalize_findings(final_scan)))
        save_scan(job_id, final_scan)
        logger.info("theHarvester scan %s completado — %d correos, %d hosts",
                    job_id, len(result['emails']), len(result['hosts']))

    except Exception as e:
        logger.error("Critical harvester scan failure for %s: %s", job_id, e)
        failed = get_scan(job_id) or {}
        failed['status']  = 'error'
        failed['error']   = str(e)
        failed['endTime'] = datetime.utcnow().isoformat()
        save_scan(job_id, failed)


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
@limiter.exempt
def health_check():
    storage_status = get_scan_storage()
    return jsonify({
        'status':         'healthy',
        'version':        '5.0.0',
        'storage':        'connected' if storage_status == 'redis' else 'fallback',
        'zap_configured': bool(ZAP_API_KEY),
        'tools': [
            'wappalyzer', 'nmap', 'gobuster', 'zap', 'searchsploit',
            'metasploit', 'nuclei', 'sqlmap', 'injection_scanner', 'patator', 'ffuf',
        ],
    })


@app.route('/api/openapi.yaml', methods=['GET'])
@limiter.exempt
def openapi_spec():
    """Documentación OpenAPI 3.0 de la API real (ver server/openapi.yaml)."""
    spec_path = os.path.join(os.path.dirname(__file__), 'openapi.yaml')
    return send_file(spec_path, mimetype='application/yaml')


@app.route('/api/scan', methods=['POST'])
@require_token
@limiter.limit("20 per hour")
def start_scan():
    """Inicia un escaneo de seguridad. Devuelve jobId inmediatamente."""
    data = request.get_json(silent=True)
    if not data:
        _t = get_t(locale_from_request(request))
        return jsonify({'error': _t('errors.invalidJson')}), 400

    target = data.get('target', '').strip()
    if not target:
        _t = get_t(locale_from_request(request))
        return jsonify({'error': _t('errors.targetRequired')}), 400

    options = data.get('options', {}) or {}

    if 'tools' not in options and 'tools' in data:
        options['tools'] = data['tools']
    if 'intensity' not in options and 'intensity' in data:
        options['intensity'] = data['intensity']

    dry_run   = bool(options.get('dry_run', False))
    cb_config = options.get('circuit_breaker', {}) or {}
    tv_config = options.get('target_validation', {}) or {}
    retry_cfg = options.get('retry_config', {}) or {}

    # Normalizar camelCase → snake_case
    if 'checkDns'          in tv_config: tv_config['check_dns']         = tv_config.pop('checkDns')
    if 'checkReachability' in tv_config: tv_config['check_reachability'] = tv_config.pop('checkReachability')
    if 'failureThreshold'  in cb_config: cb_config['failure_threshold']  = cb_config.pop('failureThreshold')
    if 'recoveryTimeout'   in cb_config: cb_config['recovery_timeout']   = cb_config.pop('recoveryTimeout')
    if 'maxRetries'        in retry_cfg: retry_cfg['max_retries']        = retry_cfg.pop('maxRetries')
    if 'backoffFactor'     in retry_cfg: retry_cfg['backoff_factor']     = retry_cfg.pop('backoffFactor')

    if _cb_is_open(target, cb_config):
        return jsonify({
            'error':  get_t(locale_from_request(request))('errors.circuitBreaker'),
            'reason': 'circuit_breaker_open',
        }), 429

    if not dry_run and (tv_config.get('check_dns', True) or tv_config.get('check_reachability', True)):
        ok, reason_tv = _validate_target_reachability(target, tv_config)
        if not ok:
            _cb_record_failure(target)
            return jsonify({
                'error':  get_t(locale_from_request(request))('errors.targetUnreachable', reason=reason_tv),
                'reason': 'target_unreachable',
            }), 422

    is_allowed, reason = is_allowed_target(target)
    if not is_allowed:
        return jsonify({
            'error':           'Target not allowed',
            'reason':          reason,
            'allowed_targets': ALLOWED_LAB_TARGETS,
        }), 403

    job_id, response_body, status_code = _launch_scan_job(
        target, options, dry_run, cb_config, tv_config, retry_cfg,
    )
    return jsonify(response_body), status_code


def _launch_scan_job(
    target: str,
    options: dict,
    dry_run: bool = False,
    cb_config: Optional[dict] = None,
    tv_config: Optional[dict] = None,
    retry_cfg: Optional[dict] = None,
    created_by: str = 'user',
) -> tuple:
    """
    Construye el Job de un scan normal, lo persiste y lo envía al backend
    de ejecución (Celery o threading.Thread, según job_executor).

    Extraído de start_scan() para que TAMBIÉN lo pueda usar scheduler.py
    al disparar un escaneo programado -- así un scan programado usa
    exactamente el mismo camino (mismo Job, mismo formato, misma
    persistencia) que uno lanzado manualmente desde el frontend, sin
    duplicar esta lógica ni crear un segundo sistema de scans.

    Devuelve (job_id, response_body_dict, http_status_code).
    """
    cb_config = cb_config or {}
    tv_config = tv_config or {}
    retry_cfg = retry_cfg or {}

    job_id    = str(uuid.uuid4())
    scan_data = {
        'id':        job_id,
        'target':    target,
        'options':   options,
        'status':    'running',
        'startTime': datetime.utcnow().isoformat() + 'Z',
        'endTime':   None,
        'created_by': created_by,
        'steps': [
            # Corre en paralelo desde el inicio — no depende de las demás fases
            {'name': 'Huella Digital', 'status': 'pending', 'progress': 0},
            {'name': 'Wappalyzer',   'status': 'pending', 'progress': 0},
            {'name': 'Nmap',         'status': 'pending', 'progress': 0},
            {'name': 'Patator',      'status': 'pending', 'progress': 0},
            {'name': 'Metasploit',   'status': 'pending', 'progress': 0},
            {'name': 'ffuf',         'status': 'pending', 'progress': 0},
            {'name': 'Gobuster',     'status': 'pending', 'progress': 0},
            {'name': 'ZAP Spider',   'status': 'pending', 'progress': 0},
            {'name': 'ZAP',          'status': 'pending', 'progress': 0},
            {'name': 'Nuclei',       'status': 'pending', 'progress': 0},
            {'name': 'SQLMap',       'status': 'pending', 'progress': 0},
            {'name': 'Searchsploit', 'status': 'pending', 'progress': 0},
            {'name': 'Scoring',      'status': 'pending', 'progress': 0},
        ],
        'technologies':        [],
        'ports':               [],
        'directories':         [],
        'spider_results':      [],
        'vulnerabilities':     [],
        'exploits':            [],
        'metasploit':          [],
        'nuclei_findings':     [],
        'sqli_results':        [],
        'brute_force_results': [],
        'ffuf_endpoints':      [],
        'threat_intel':        {},
        'score': {
            'total': 0, 'grade': 'A',
            'breakdown': {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0},
        },
        'dry_run':           dry_run,
        'circuit_breaker':   cb_config,
        'target_validation': tv_config,
        'retry_config':      retry_cfg,
    }

    save_scan(job_id, scan_data)

    if dry_run:
        mock_scan = _build_dry_run_scan(job_id, target, scan_data)
        save_scan(job_id, mock_scan)
        logger.info("Dry-run scan %s completado para %s", job_id, target[:80])
        return job_id, {'jobId': job_id, 'status': 'completed', 'dry_run': True}, 200

    job_executor.submit_job('scan', run_scan, job_id, target, options)

    logger.info("Started scan %s for target %s", job_id, target[:80])
    return job_id, {'jobId': job_id, 'status': 'running'}, 200


@app.route('/api/scan/<scan_id>/status', methods=['GET'])
@limiter.exempt
@require_token
def get_scan_status(scan_id: str):
    if not validate_scan_id(scan_id):
        return jsonify({'error': _t('errors.invalidFormat')}), 400
    scan = get_scan(scan_id)
    if not scan:
        return jsonify({'error': get_t(locale_from_request(request))('errors.scanNotFound')}), 404
    return jsonify(scan)


@app.route('/api/code-scan', methods=['POST'])
@require_token
@limiter.limit("10 per hour")
def start_code_scan():
    """
    Inicia un análisis de código (Grupo 3). Acepta:
      - multipart/form-data con un campo 'file' (.zip), o
      - application/json con {"repo_url": "https://github.com/user/repo"}
    Devuelve jobId inmediatamente, igual que /api/scan.
    """
    job_id = str(uuid.uuid4())

    if 'file' in request.files:
        upload = request.files['file']
        if not upload.filename:
            return jsonify({'error': 'No se seleccionó ningún archivo'}), 400
        if not upload.filename.lower().endswith('.zip'):
            return jsonify({'error': 'Solo se aceptan archivos .zip'}), 400

        # Guardar a disco antes de validar tamaño -- Flask ya limita el
        # tamaño total de request vía MAX_CONTENT_LENGTH a nivel de app.
        upload_dir = tempfile.mkdtemp(prefix=f'upload-{job_id[:8]}-')
        zip_path   = os.path.join(upload_dir, 'source.zip')
        upload.save(zip_path)

        size_mb = os.path.getsize(zip_path) / (1024 * 1024)
        if size_mb > CODE_SCAN_MAX_ZIP_MB:
            shutil.rmtree(upload_dir, ignore_errors=True)
            return jsonify({'error': f'El archivo pesa {size_mb:.1f}MB, el máximo es {CODE_SCAN_MAX_ZIP_MB}MB'}), 413

        source_type, source_value, source_label = 'zip', zip_path, upload.filename

    else:
        data = request.get_json(silent=True) or {}
        repo_url  = (data.get('repo_url') or '').strip()
        image_ref = (data.get('image_ref') or '').strip()

        if repo_url:
            validation_error = validate_repo_url(repo_url)
            if validation_error:
                return jsonify({'error': validation_error}), 400
            source_type, source_value, source_label = 'repo', repo_url, repo_url

        elif image_ref:
            validation_error = validate_image_ref(image_ref)
            if validation_error:
                return jsonify({'error': validation_error}), 400
            source_type, source_value, source_label = 'image', image_ref, image_ref

        else:
            return jsonify({'error': 'Falta "repo_url", "image_ref" (JSON) o un archivo .zip (multipart)'}), 400

    if source_type == 'image':
        # La imagen se escanea directo desde el registro -- no hay
        # archivos que clonar/extraer ni scanners de código que correr,
        # solo Trivy.
        steps = [{'name': 'Escaneando imagen', 'status': 'pending', 'progress': 0}]
    else:
        steps = [
            {'name': 'Obtener código',    'status': 'pending', 'progress': 0},
            {'name': 'Gitleaks',          'status': 'pending', 'progress': 0},
            {'name': 'TruffleHog',        'status': 'pending', 'progress': 0},
            {'name': 'Backdoors',         'status': 'pending', 'progress': 0},
            {'name': 'Semgrep',           'status': 'pending', 'progress': 0},
            {'name': 'Trivy',             'status': 'pending', 'progress': 0},
            {'name': 'Dependency-Check',  'status': 'pending', 'progress': 0},
        ]

    scan_data = {
        'id':          job_id,
        'scan_type':   'code',
        'source_type': source_type,
        'source':      source_label,
        'status':      'running',
        'startTime':   datetime.utcnow().isoformat() + 'Z',
        'endTime':     None,
        'steps':       steps,
        'gitleaks':         {},
        'trufflehog':       {},
        'backdoors':        {},
        'semgrep':          {},
        'trivy':            {},
        'dependency_check': {},
        'summary':          {},
    }
    save_scan(job_id, scan_data)

    job_executor.submit_job('code_scan', run_code_scan, job_id, source_type, source_value)

    logger.info("Started code scan %s (%s: %s)", job_id, source_type, source_label[:80])
    return jsonify({'jobId': job_id, 'status': 'running'})


@app.route('/api/code-scan/<scan_id>/status', methods=['GET'])
@limiter.exempt
@require_token
def get_code_scan_status(scan_id: str):
    if not validate_scan_id(scan_id):
        return jsonify({'error': _t('errors.invalidFormat')}), 400
    scan = get_scan(scan_id)
    if not scan or scan.get('scan_type') != 'code':
        return jsonify({'error': get_t(locale_from_request(request))('errors.scanNotFound')}), 404
    return jsonify(scan)


@app.route('/api/code-scan/history', methods=['GET'])
@require_token
def get_code_scan_history():
    """Historial de análisis de código (Grupo 3) — separado de /api/history
    porque los code-scans tienen una forma distinta (source/summary en vez
    de target/score) que rompería la página de Historial de escaneos web."""
    try:
        scan_list = list_scans()
        scan_list = [s for s in scan_list if s.get('scan_type') == 'code']
        scan_list.sort(key=lambda x: x.get('startTime', ''), reverse=True)
        return jsonify({'scans': scan_list[:100], 'total': len(scan_list)})
    except Exception as e:
        logger.error("Error retrieving code scan history: %s", e)
        return jsonify({'error': _t('errors.historyFailed')}), 500


@app.route('/api/osint/email-breach', methods=['POST'])
@require_token
@limiter.limit("20 per hour")
def osint_email_breach():
    """Grupo 2 (OSINT): verifica un correo contra brechas de datos conocidas (XposedOrNot).

    Cachea en Redis (TTL configurable) para no re-consultar el servicio
    externo por el mismo email repetidamente, y persiste el resultado como
    un Job 'osint-breach' para que aparezca en /api/osint/history y tenga
    reporte descargable vía /api/scan/<jobId>/report (mismo generador de
    reportes, ver utils/reporter.py).
    """
    data  = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip()
    if not email:
        return jsonify({'error': 'Falta "email"'}), 400

    cached = osint_cache.get(redis_client, 'breach', email)
    if cached is not None:
        response = dict(cached)
        response['cache'] = 'hit'
        return jsonify(response)

    result = breach_checker.check(email)

    osint_cache.set(redis_client, 'breach', email, result, OSINT_CACHE_TTL)

    job_id = str(uuid.uuid4())
    now_iso = datetime.utcnow().isoformat() + 'Z'
    scan_data = {
        'id': job_id, 'scan_type': 'osint-breach', 'email': email,
        'status': 'completed', 'startTime': now_iso, 'endTime': now_iso,
        **result,
    }
    scan_data['score'] = calculate_score_from_findings(findings_module.dedupe_findings(findings_module.normalize_findings(scan_data)))
    save_scan(job_id, scan_data)

    response = dict(result)
    response['jobId'] = job_id
    response['cache'] = 'miss'
    return jsonify(response)


@app.route('/api/osint/username-search', methods=['POST'])
@require_token
@limiter.limit("20 per hour")
def osint_username_search():
    """Grupo 2 (OSINT): busca un username en ~19 plataformas en paralelo.

    Mismo patrón de caché + persistencia que email-breach (ver arriba).
    """
    data     = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    if not username:
        return jsonify({'error': 'Falta "username"'}), 400

    cached = osint_cache.get(redis_client, 'username', username)
    if cached is not None:
        response = dict(cached)
        response['cache'] = 'hit'
        return jsonify(response)

    result = username_searcher.search(username)

    osint_cache.set(redis_client, 'username', username, result, OSINT_CACHE_TTL)

    job_id = str(uuid.uuid4())
    now_iso = datetime.utcnow().isoformat() + 'Z'
    scan_data = {
        'id': job_id, 'scan_type': 'osint-username', 'username': username,
        'status': 'completed', 'startTime': now_iso, 'endTime': now_iso,
        **result,
    }
    scan_data['score'] = calculate_score_from_findings(findings_module.dedupe_findings(findings_module.normalize_findings(scan_data)))
    save_scan(job_id, scan_data)

    response = dict(result)
    response['jobId'] = job_id
    response['cache'] = 'miss'
    return jsonify(response)


@app.route('/api/osint/username-deep', methods=['POST'])
@require_token
@limiter.limit("5 per hour")
def start_username_deep_search():
    """
    Grupo 2 (OSINT) — "búsqueda profunda": Sherlock real, 414 sitios.
    Tarda mucho más que /api/osint/username-search, así que corre como
    job en segundo plano con polling, igual que /api/code-scan.
    """
    data     = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    if not username:
        return jsonify({'error': 'Falta "username"'}), 400

    job_id = str(uuid.uuid4())
    scan_data = {
        'id':        job_id,
        'scan_type': 'osint-deep',
        'username':  username,
        'status':    'running',
        'startTime': datetime.utcnow().isoformat() + 'Z',
        'endTime':   None,
        'steps': [
            {'name': 'Buscando en 414 sitios', 'status': 'pending', 'progress': 0},
        ],
        'found':         [],
        'unknown_sites': [],
        'checked_count': 0,
    }
    save_scan(job_id, scan_data)

    job_executor.submit_job('sherlock', run_sherlock_scan, job_id, username)

    logger.info("Started deep username search %s (%s)", job_id, username)
    return jsonify({'jobId': job_id, 'status': 'running'})


@app.route('/api/osint/username-deep/<scan_id>/status', methods=['GET'])
@limiter.exempt
@require_token
def get_username_deep_status(scan_id: str):
    if not validate_scan_id(scan_id):
        return jsonify({'error': _t('errors.invalidFormat')}), 400
    scan = get_scan(scan_id)
    if not scan or scan.get('scan_type') != 'osint-deep':
        return jsonify({'error': get_t(locale_from_request(request))('errors.scanNotFound')}), 404
    return jsonify(scan)


@app.route('/api/osint/domain-harvest', methods=['POST'])
@require_token
@limiter.limit("10 per hour")
def start_domain_harvest():
    """
    Grupo 2 (OSINT) — theHarvester real: correos, subdominios e IPs a
    partir de un dominio. Corre como job en segundo plano (varias
    fuentes externas, puede tardar), igual que la búsqueda profunda.
    """
    data   = request.get_json(silent=True) or {}
    domain = (data.get('domain') or '').strip()
    if not domain:
        return jsonify({'error': 'Falta "domain"'}), 400

    job_id = str(uuid.uuid4())
    scan_data = {
        'id':        job_id,
        'scan_type': 'osint-harvest',
        'domain':    domain,
        'status':    'running',
        'startTime': datetime.utcnow().isoformat() + 'Z',
        'endTime':   None,
        'steps': [
            {'name': 'Consultando fuentes OSINT', 'status': 'pending', 'progress': 0},
        ],
        'emails':       [],
        'hosts':        [],
        'ips':          [],
        'sources_used': [],
    }
    save_scan(job_id, scan_data)

    job_executor.submit_job('harvester', run_harvester_scan, job_id, domain)

    logger.info("Started domain harvest %s (%s)", job_id, domain)
    return jsonify({'jobId': job_id, 'status': 'running'})


@app.route('/api/osint/domain-harvest/<scan_id>/status', methods=['GET'])
@limiter.exempt
@require_token
def get_domain_harvest_status(scan_id: str):
    if not validate_scan_id(scan_id):
        return jsonify({'error': _t('errors.invalidFormat')}), 400
    scan = get_scan(scan_id)
    if not scan or scan.get('scan_type') != 'osint-harvest':
        return jsonify({'error': get_t(locale_from_request(request))('errors.scanNotFound')}), 404
    return jsonify(scan)


@app.route('/api/scan/<scan_id>/report', methods=['GET'])
@limiter.exempt
@require_token
def get_report(scan_id: str):
    if not validate_scan_id(scan_id):
        return jsonify({'error': _t('errors.invalidFormat')}), 400
    scan = get_scan(scan_id)
    if not scan:
        return jsonify({'error': get_t(locale_from_request(request))('errors.scanNotFound')}), 404
    if scan.get('status') != 'completed':
        return jsonify({'error': _t('errors.scanNotCompleted'), 'status': scan.get('status')}), 400
    format_type     = request.args.get('format', 'html').lower()
    allowed_formats = ['html', 'json', 'pdf', 'csv']
    if format_type not in allowed_formats:
        return jsonify({'error': _t('errors.formatNotAllowed', formats=', '.join(allowed_formats))}), 400
    try:
        report_path = generate_report(scan, format_type, locale_from_request(request))
        if not report_path or not os.path.exists(report_path):
            return jsonify({'error': _t('errors.reportFailed')}), 500
        return send_file(
            report_path,
            as_attachment=True,
            download_name=f'security-report-{scan_id}.{format_type}',
        )
    except Exception as e:
        logger.error("Error generating report: %s", e)
        return jsonify({'error': str(e)}), 500


@app.route('/api/history', methods=['GET'])
@require_token
def get_scan_history():
    try:
        scan_list = list_scans()
        # /app/history/page.tsx asume la forma de un scan web (target, score).
        # En vez de excluir por nombre de scan_type (frágil -- hay que acordarse
        # de actualizar esta lista cada vez que se agrega un tipo de job nuevo,
        # que es justo el bug que causó esto la primera vez), se incluye solo
        # lo que tiene 'target' -- la forma real de un web-scan.
        scan_list = [s for s in scan_list if s.get('target') is not None]
        scan_list.sort(key=lambda x: x.get('startTime', ''), reverse=True)
        return jsonify({'scans': scan_list[:100], 'total': len(scan_list)})
    except Exception as e:
        logger.error("Error retrieving history: %s", e)
        return jsonify({'error': _t('errors.historyFailed')}), 500


@app.route('/api/scan/<scan_id>', methods=['DELETE'])
@require_token
def delete_scan(scan_id: str):
    if not validate_scan_id(scan_id):
        return jsonify({'error': _t('errors.invalidFormat')}), 400
    if get_scan_storage() == 'redis':
        redis_client.delete(f"scan:{scan_id}")
    else:
        with _fallback_lock:
            scans_fallback.pop(scan_id, None)
    return jsonify({'message': get_t(locale_from_request(request))('errors.scanDeleted')})


@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify({
        'version':         '5.0.0',
        'allowed_targets': ALLOWED_LAB_TARGETS,
        'restrict_to_lab': RESTRICT_TO_LAB,
        'available_tools': [
            'wappalyzer', 'nmap', 'gobuster', 'zap', 'searchsploit',
            'metasploit', 'nuclei', 'sqlmap', 'injection_scanner', 'patator', 'ffuf',
            # Huella Digital (Grupo 1)
            'virustotal', 'abuseipdb', 'shodan', 'crtsh', 'testssl', 'dnstwist', 'safebrowsing',
            # Análisis de Código (Grupo 3)
            'secrets_scanner', 'backdoor_scanner', 'dependency_scanner',
            # OSINT (Grupo 2)
            'breach_checker', 'username_search',
        ],
        'report_formats': ['html', 'json', 'pdf', 'csv'],
        'metasploit': {
            'enabled': True,
            'mode':    'simulation' if getattr(orchestrator.metasploit, '_simulation', True) else 'live',
            'host':    MSF_HOST,
            'port':    MSF_PORT,
        },
    })

# ── Lab endpoints ─────────────────────────────────────────────────────────────
try:
    import docker as docker_sdk  # type: ignore
    DOCKER_AVAILABLE = True
except ImportError:
    docker_sdk = None
    DOCKER_AVAILABLE = False


def _get_docker_client():
    if not DOCKER_AVAILABLE or docker_sdk is None:
        logger.error("Docker SDK no instalado")
        return None
    try:
        return docker_sdk.from_env()
    except Exception as e:
        logger.error("Docker client error: %s", e)
        return None


LAB_CONTAINERS = {
    'juice-shop': {'image': 'bkimminich/juice-shop:latest', 'ports': {'3000/tcp': 3001}},
    'dvwa':       {'image': 'ghcr.io/digininja/dvwa:latest', 'ports': {'80/tcp':   3002}},
    'webgoat':    {'image': 'webgoat/webgoat:latest',        'ports': {'8080/tcp': 3003}},
}


@app.route('/api/lab/status', methods=['GET'])
@limiter.exempt
def lab_status():
    """
    FIX: antes solo reportaba 'running'/'stopped'/'error' -- el frontend
    (app/lab/page.tsx) exige status === 'healthy' para habilitar el botón
    que abre cada lab en una pestaña nueva, así que ese botón quedaba
    permanentemente deshabilitado sin importar que el laboratorio
    estuviera perfectamente sano y respondiendo. Ahora sí se consulta el
    healthcheck real de Docker (ya definido en docker-compose.yml para
    juice-shop/dvwa/webgoat) vía container.attrs['State']['Health'].
    """
    client = _get_docker_client()
    if not client:
        return jsonify({'error': _t('errors.dockerUnavailable')}), 500
    result = {}
    for lab_id in LAB_CONTAINERS:
        try:
            container = client.containers.get(lab_id)
            if container.status != 'running':
                result[lab_id] = 'stopped'
                continue
            health = container.attrs.get('State', {}).get('Health', {}).get('Status')
            if health in (None, 'healthy'):
                # Sin healthcheck definido -> 'running' ya es suficiente para
                # considerarlo abrible. Con healthcheck en 'healthy' -> igual.
                result[lab_id] = 'healthy'
            else:
                # 'starting' o 'unhealthy' -- el proceso corre pero aún no
                # está listo para recibir requests; el frontend lo trata
                # igual que 'running' (deja ver/parar, pero no abrir todavía).
                result[lab_id] = 'running'
        except docker_sdk.errors.NotFound:
            result[lab_id] = 'stopped'
        except Exception:
            result[lab_id] = 'error'
    return jsonify(result)


@app.route('/api/lab/<lab_id>/start', methods=['POST'])
@limiter.exempt
def lab_start(lab_id: str):
    if lab_id not in LAB_CONTAINERS:
        return jsonify({'error': _t('errors.labNotFound')}), 404
    client = _get_docker_client()
    if not client:
        return jsonify({'error': _t('errors.dockerUnavailable')}), 500
    cfg = LAB_CONTAINERS[lab_id]
    try:
        try:
            container = client.containers.get(lab_id)
            if container.status != 'running':
                container.start()
            return jsonify({'status': 'running', 'lab': lab_id})
        except docker_sdk.errors.NotFound:
            pass
        client.containers.run(
            cfg['image'],
            name=lab_id,
            ports=cfg['ports'],
            detach=True,
            remove=False,
            network='securescan-net',
        )
        return jsonify({'status': 'starting', 'lab': lab_id})
    except Exception as e:
        logger.error("Lab start error %s: %s", lab_id, e)
        return jsonify({'error': str(e)}), 500


@app.route('/api/lab/<lab_id>/stop', methods=['POST'])
@limiter.exempt
def lab_stop(lab_id: str):
    if lab_id not in LAB_CONTAINERS:
        return jsonify({'error': _t('errors.labNotFound')}), 404
    client = _get_docker_client()
    if not client:
        return jsonify({'error': _t('errors.dockerUnavailable')}), 500
    try:
        container = client.containers.get(lab_id)
        container.stop(timeout=10)
        return jsonify({'status': 'stopped', 'lab': lab_id})
    except docker_sdk.errors.NotFound:
        return jsonify({'status': 'stopped', 'lab': lab_id})
    except Exception as e:
        logger.error("Lab stop error %s: %s", lab_id, e)
        return jsonify({'error': str(e)}), 500


# ── Escaneos programados (Celery Beat) ─────────────────────────────────────────
# Endpoints nuevos y aditivos: no modifican ninguna ruta existente. Un scan
# programado, al ejecutarse, crea un Job normal vía _launch_scan_job (mismo
# sistema que /api/scan) -- ver scheduler.py.

@app.route('/api/schedules', methods=['POST'])
@require_token
def create_schedule_route():
    data = request.get_json(silent=True) or {}
    target = (data.get('target') or '').strip()
    if not target:
        return jsonify({'error': 'Falta "target"'}), 400

    frequency = (data.get('frequency') or '').strip()
    try:
        hour   = int(data.get('hour', 0))
        minute = int(data.get('minute', 0))
    except (TypeError, ValueError):
        return jsonify({'error': '"hour" y "minute" deben ser numéricos'}), 400

    is_allowed, reason = is_allowed_target(target)
    if not is_allowed:
        return jsonify({'error': 'Target not allowed', 'reason': reason}), 403

    try:
        record = scheduler.create_schedule(
            target=target,
            options=data.get('options', {}) or {},
            frequency=frequency,
            hour=hour,
            minute=minute,
            day_of_week=data.get('day_of_week'),
            day_of_month=data.get('day_of_month'),
        )
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify(record), 201


@app.route('/api/schedules', methods=['GET'])
@require_token
def list_schedules_route():
    return jsonify({'schedules': scheduler.list_schedules()})


@app.route('/api/schedules/<schedule_id>', methods=['GET'])
@require_token
def get_schedule_route(schedule_id: str):
    record = scheduler.get_schedule(schedule_id)
    if not record:
        return jsonify({'error': 'Programación no encontrada'}), 404
    return jsonify(record)


@app.route('/api/schedules/<schedule_id>/pause', methods=['POST'])
@require_token
def pause_schedule_route(schedule_id: str):
    record = scheduler.set_active(schedule_id, False)
    if not record:
        return jsonify({'error': 'Programación no encontrada'}), 404
    return jsonify(record)


@app.route('/api/schedules/<schedule_id>/resume', methods=['POST'])
@require_token
def resume_schedule_route(schedule_id: str):
    record = scheduler.set_active(schedule_id, True)
    if not record:
        return jsonify({'error': 'Programación no encontrada'}), 404
    return jsonify(record)


@app.route('/api/schedules/<schedule_id>', methods=['DELETE'])
@require_token
def delete_schedule_route(schedule_id: str):
    ok = scheduler.delete_schedule(schedule_id)
    if not ok:
        return jsonify({'error': 'Programación no encontrada'}), 404
    return jsonify({'status': 'deleted'})


# ── Historial OSINT unificado ───────────────────────────────────────────────
# Igual patrón que /api/code-scan/history: los Jobs OSINT tienen una forma
# distinta (email/username/domain en vez de target) así que se listan aparte
# en vez de mezclarlos con /api/history (que asume la forma de un web scan).

@app.route('/api/osint/history', methods=['GET'])
@require_token
def get_osint_history():
    try:
        scan_list = list_scans()
        scan_list = [s for s in scan_list if (s.get('scan_type') or '').startswith('osint')]
        scan_list.sort(key=lambda x: x.get('startTime', ''), reverse=True)
        return jsonify({'scans': scan_list[:100], 'total': len(scan_list)})
    except Exception as e:
        logger.error("Error retrieving OSINT history: %s", e)
        return jsonify({'error': _t('errors.historyFailed')}), 500


# ── Comparación entre escaneos ──────────────────────────────────────────────
# Reutiliza get_scan() (ya existente) y comparison.py (nuevo, solo lectura de
# los datos ya persistidos). Funciona para cualquier par de Jobs de la MISMA
# familia (web-vs-web, code-vs-code, osint-vs-osint); comparar familias
# distintas simplemente no encontrará hallazgos en común, lo cual es
# correcto (no tiene sentido comparar un code-scan contra un web-scan).

@app.route('/api/scan/<scan_id>/compare/<other_scan_id>', methods=['GET'])
@require_token
def compare_scans_route(scan_id: str, other_scan_id: str):
    if not validate_scan_id(scan_id) or not validate_scan_id(other_scan_id):
        return jsonify({'error': _t('errors.invalidFormat')}), 400

    scan_a = get_scan(scan_id)
    scan_b = get_scan(other_scan_id)
    if not scan_a or not scan_b:
        return jsonify({'error': get_t(locale_from_request(request))('errors.scanNotFound')}), 404
    if scan_a.get('status') != 'completed' or scan_b.get('status') != 'completed':
        return jsonify({'error': _t('errors.scanNotCompleted')}), 400

    result = comparison.compare_scans(scan_a, scan_b)
    return jsonify(result)


# ── Configuración de notificaciones (runtime, sin credenciales) ─────────────
# Expone/edita SOLO destinatario de email, URL de webhook, y qué eventos
# están activos. Las credenciales SMTP (host/user/password) siguen viviendo
# exclusivamente en variables de entorno del servidor (ver notifications.py)
# y NUNCA se devuelven en esta respuesta.

@app.route('/api/settings/notifications', methods=['GET'])
@require_token
def get_notification_settings_route():
    return jsonify(notifications.get_settings(redis_client))


@app.route('/api/settings/notifications', methods=['POST'])
@require_token
def update_notification_settings_route():
    data = request.get_json(silent=True) or {}
    try:
        saved = notifications.save_settings(redis_client, data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(saved)


# ── Dashboard: estadísticas agregadas REALES ────────────────────────────────
# FIX (auditoría): app/page.tsx (portada) mostraba números fijos e
# inventados desde lib/home-mock-data.ts ("47 scans", "312 vulnerabilidades",
# siempre iguales sin importar el uso real). Este endpoint agrega datos
# reales de todos los Jobs persistidos -- ahora es barato de construir
# porque reutiliza findings.normalize_findings() (mismo modelo que ya usan
# comparison.py y scoring.py) en vez de tener que escribir una 4ta forma
# de recorrer vulnerabilities/gitleaks/breaches.

@app.route('/api/dashboard/stats', methods=['GET'])
@require_token
def dashboard_stats():
    all_scans = list_scans()
    completed = [s for s in all_scans if s.get('status') == 'completed']

    by_family = {'web': 0, 'code': 0, 'osint': 0}
    by_status = {'completed': 0, 'running': 0, 'error': 0, 'failed': 0, 'cancelled': 0}
    breakdown = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
    by_tool: Dict[str, int] = {}
    scores = []
    recent = []

    for s in all_scans:
        family = findings_module.detect_family(s)
        by_family[family] = by_family.get(family, 0) + 1
        status = s.get('status', 'running')
        by_status[status] = by_status.get(status, 0) + 1

    for s in completed:
        for f in findings_module.normalize_findings(s):
            sev = f.get('severity') or 'info'
            if sev not in breakdown:
                sev = 'info'
            breakdown[sev] += 1
            tool = f.get('tool') or 'unknown'
            by_tool[tool] = by_tool.get(tool, 0) + 1
        score = s.get('score')
        if isinstance(score, dict) and 'total' in score:
            scores.append(score['total'])

    recent = sorted(
        all_scans,
        key=lambda s: s.get('startTime', ''),
        reverse=True,
    )[:10]
    recent_light = [{
        'id': s.get('id'),
        'family': findings_module.detect_family(s),
        'target': s.get('target') or s.get('source') or s.get('domain') or s.get('username') or s.get('email'),
        'status': s.get('status'),
        'startTime': s.get('startTime'),
        'score': (s.get('score') or {}).get('total') if isinstance(s.get('score'), dict) else None,
    } for s in recent]

    average_score = round(sum(scores) / len(scores)) if scores else 100
    average_grade, _ = calculate_grade(average_score, breakdown, max_cvss=0.0)

    top_tools = sorted(
        [{'tool': tool, 'findings': count} for tool, count in by_tool.items()],
        key=lambda x: x['findings'], reverse=True,
    )[:10]

    return jsonify({
        'totalScans': len(all_scans),
        'totalFindings': sum(breakdown.values()),
        'totalVulnerabilities': sum(breakdown.values()),  # alias, mismo campo que SecurityOverviewMock espera
        'averageScore': average_score,
        'averageGrade': average_grade,
        'riskLevel': get_risk_level(average_score, breakdown['critical']),
        'byFamily': by_family,
        'byTool': top_tools,
        'byStatus': by_status,
        'breakdown': breakdown,
        'recentActivity': recent_light,
    })


# ── Métricas Prometheus (texto plano, sin autenticación -- estándar de scraping) ──
# FIX (auditoría): sin esto no había forma de saber, sin grepear logs a
# mano, cuántos scans corren por día o qué tan seguido falla cada
# herramienta. Formato de texto plano estándar de Prometheus -- cualquier
# Prometheus/Grafana puede scrapear esto directo, sin plugin adicional.

@app.route('/api/metrics', methods=['GET'])
@limiter.exempt
def prometheus_metrics():
    all_scans = list_scans()
    by_family = {'web': 0, 'code': 0, 'osint': 0}
    by_status = {'completed': 0, 'running': 0, 'error': 0, 'failed': 0, 'cancelled': 0}
    for s in all_scans:
        family = findings_module.detect_family(s)
        by_family[family] = by_family.get(family, 0) + 1
        status = s.get('status', 'running')
        by_status[status] = by_status.get(status, 0) + 1

    lines = [
        '# HELP securescan_jobs_total Total de Jobs persistidos, por familia',
        '# TYPE securescan_jobs_total gauge',
    ]
    for family, count in by_family.items():
        lines.append(f'securescan_jobs_total{{family="{family}"}} {count}')

    lines += [
        '# HELP securescan_jobs_by_status Jobs persistidos, por estado',
        '# TYPE securescan_jobs_by_status gauge',
    ]
    for status, count in by_status.items():
        lines.append(f'securescan_jobs_by_status{{status="{status}"}} {count}')

    lines += [
        '# HELP securescan_storage_backend 1 si Redis está activo, 0 si está en modo fallback en memoria',
        '# TYPE securescan_storage_backend gauge',
        f'securescan_storage_backend {1 if get_scan_storage() == "redis" else 0}',
    ]

    return Response('\n'.join(lines) + '\n', mimetype='text/plain; version=0.0.4')


# ── Timeline: evolución de un target a través del tiempo ────────────────────
# FIX (auditoría): la comparación existente (/api/scan/<a>/compare/<b>) solo
# compara DOS scans a la vez. Con varios scans del mismo target acumulados
# (ej. escaneos programados corriendo semana a semana), no había forma de
# ver la tendencia -- ¿el score va mejorando o empeorando con el tiempo?
# Este endpoint junta todos los scans completados de un mismo target/fuente,
# ordenados por fecha, para graficar la evolución. Reutiliza el campo
# 'score' que ya persiste cada scan (ver findings.py/scoring.py) -- no
# recalcula nada, solo los agrupa y ordena.

def _scan_identifier(scan: dict) -> str:
    """Mismo criterio usado en varias partes del proyecto para identificar
    'a qué apunta' un scan, sin importar su familia."""
    return (
        scan.get('target') or scan.get('source') or
        scan.get('domain') or scan.get('username') or scan.get('email') or ''
    )


@app.route('/api/timeline', methods=['GET'])
@require_token
def scan_timeline():
    target = (request.args.get('target') or '').strip()
    if not target:
        return jsonify({'error': _t('errors.invalidFormat')}), 400

    matching = [
        s for s in list_scans()
        if s.get('status') == 'completed' and _scan_identifier(s) == target
    ]
    matching.sort(key=lambda s: s.get('startTime', ''))

    points = [{
        'id': s.get('id'),
        'family': findings_module.detect_family(s),
        'startTime': s.get('startTime'),
        'score': (s.get('score') or {}).get('total') if isinstance(s.get('score'), dict) else None,
        'grade': (s.get('score') or {}).get('grade') if isinstance(s.get('score'), dict) else None,
        'breakdown': (s.get('score') or {}).get('breakdown') if isinstance(s.get('score'), dict) else None,
    } for s in matching]

    return jsonify({'target': target, 'points': points})


if __name__ == '__main__':
    port       = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug_mode)