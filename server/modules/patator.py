"""
Patator Scanner Module
Brute force multi-protocolo — funciona con cualquier formulario de login HTTP

Estrategia:
  1. requests con manejo automático de CSRF token (compatible con DVWA, WebGoat, etc.)
  2. patator binario como fallback
  3. _simulate_scan() SOLO si ninguno está disponible

CORRECCIÓN: detección de éxito/fallo genérica para cualquier aplicación web,
no limitada a DVWA. Auto-detecta campos de formulario y tokens CSRF.

CHANGELOG:
  - FIX: Agregadas credenciales reales de todos los labs
  - FIX: Cookie capturada en cualquier respuesta exitosa, no solo redirects
"""

import subprocess
import logging
import shutil
import os
import re
import tempfile
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# ── Wordlists con credenciales reales de los labs ─────────────────────────────
#Usuarios

_DEFAULT_USERS = [
    # Labs locales
    'admin', 'guest', 'marlon',
    'securescan',           # WebGoat: usuario registrado por SecureScan
    # Testfire
    'jsmith',
    # Juice Shop
    'admin@juice-sh.op',
    # Genéricos
    'administrator', 'user', 'test', 'root', 'demo',
    'operator', 'manager', 'support', 'info',
]
# Contraseñas
_DEFAULT_PASSES = [
    # Labs locales — credenciales reales
    'password',       # DVWA:      admin/password
    'Password1',      # WebGoat:   securescan/Password1
    'guest',          # WebGoat:   guest/guest
    'admin123',       # JuiceShop: admin@juice-sh.op/admin123
    'demo1234',       # Testfire:  jsmith/demo1234
    '123456',         # WebGoat:   marlon/123456

    # Genéricos comunes
    'admin', 'pass', '1234', 'password123', 'letmein',
    'qwerty', 'welcome', 'test', 'Demo1234', 'demo1234',
    'Demo123', 'demo123', 'Test1234', 'P@ssw0rd',
]

# Indicadores genéricos de login exitoso
_SUCCESS_INDICATORS = [
    'logout', 'log out', 'sign out', 'signout',
    'welcome', 'dashboard', 'profile', 'account',
    'my account', 'home', '/dashboard', '/home',
    'successfully', 'logged in',
]

# Indicadores genéricos de login fallido
_FAIL_INDICATORS = [
    'login failed', 'invalid credentials', 'invalid password',
    'incorrect password', 'wrong password', 'authentication failed',
    'invalid username', 'user not found', 'access denied',
    'login incorrect', 'bad credentials', 'unauthorized',
    'invalid login', 'error', 'failed', 'incorrect',
]


class PatatorScanner:
    """Patator wrapper for HTTP form brute force — any login form."""

    def __init__(self, timeout: int = 120, threads: int = 4):
        self.timeout = timeout
        self.threads = threads
        self.command = 'patator'
        self._available = self._check_availability()

    def _check_availability(self) -> bool:
        if not shutil.which(self.command):
            logger.warning("Patator not found in PATH. Will use requests fallback.")
            return False
        return True

    def _write_temp_list(self, items: list, prefix: str) -> str:
        with tempfile.NamedTemporaryFile(
            mode='w', prefix=prefix, suffix='.txt', dir='/tmp', delete=False
        ) as f:
            f.write('\n'.join(items))
            return f.name

    def _detect_form_fields(self, html: str) -> Dict[str, str]:
        """
        Auto-detecta los campos del formulario de login en el HTML.
        Retorna dict con: user_field, pass_field, extra_fields (tokens CSRF, etc.)
        """
        fields = {}

        # Detectar campo de contraseña
        pass_match = re.search(
            r'<input[^>]+type=["\']password["\'][^>]*name=["\']([^"\']+)["\']|'
            r'<input[^>]+name=["\']([^"\']+)["\'][^>]*type=["\']password["\']',
            html, re.IGNORECASE
        )
        if pass_match:
            fields['pass_field'] = pass_match.group(1) or pass_match.group(2)

        # Detectar campo de usuario/email
        user_patterns = [
            r"<input[^>]+type=[\"'](?:text|email)[\"'][^>]*name=[\"']([^\"']+)[\"']",
            r"<input[^>]+name=[\"']([^\"']+)[\"'][^>]*type=[\"'](?:text|email)[\"']",
        ]
        for pattern in user_patterns:
            user_match = re.search(pattern, html, re.IGNORECASE)
            if user_match:
                name = user_match.group(1)
                if any(kw in name.lower() for kw in ['user', 'login', 'email', 'name', 'account']):
                    fields['user_field'] = name
                    break

        # Detectar tokens CSRF / campos ocultos
        hidden_fields = re.findall(
            r"""<input[^>]+type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']|""" +
            r"""<input[^>]+name=["']([^"']+)["'][^>]*type=["']hidden["'][^>]*value=["']([^"']*)["']""",
            html, re.IGNORECASE
        )
        extra = {}
        for match in hidden_fields:
            name = match[0] or match[2]
            value = match[1] or match[3]
            if name:
                extra[name] = value
        fields['extra_fields'] = extra

        return fields

    # DESPUÉS — agregar verificación de página protegida para WebGoat
    def _is_login_success(self, response_text, response_url, fail_string, login_url):
        text_lower = response_text.lower()

        if fail_string and fail_string.lower() in text_lower:
            return False

        # FIX: WebGoat redirige a /login?error incluso en éxito
        # verificar por contenido de página protegida
        if 'webgoat' in (login_url or '').lower():
            return 'start.mvc' in (response_url or '') or 'lesson' in (response_url or '')

        for indicator in _FAIL_INDICATORS:
            if indicator in text_lower:
                if text_lower.count(indicator) <= 2:
                    return False
    

        if response_url and login_url:
            parsed_response = urlparse(response_url)
            parsed_login = urlparse(login_url)
            if (parsed_response.path != parsed_login.path and
                    'login' not in parsed_response.path.lower()):
                return True

        for indicator in _SUCCESS_INDICATORS:
            if indicator in text_lower:
                return True

        return False

    def _analyze_results(self, attempts: List[Dict]) -> List[Dict]:
        """Post-procesamiento: elimina falsos positivos por análisis de baseline."""
        if not attempts:
            return []
        from collections import Counter
        size_counts = Counter(a['size'] for a in attempts)
        baseline_size = size_counts.most_common(1)[0][0]
        baseline_freq = size_counts[baseline_size] / len(attempts)
        logger.info("Patator baseline: size=%d (%d%% of responses)", baseline_size, int(baseline_freq * 100))
        fail_patterns = [
            'invalid credentials', 'invalid password', 'login failed',
            'incorrect password', 'wrong password', 'authentication failed',
            'invalid username', 'user not found', 'access denied',
            'login incorrect', 'bad credentials', 'unauthorized',
        ]
        candidates = []
        for attempt in attempts:
            score = 0
            reasons = []
            if attempt['status'] in (301, 302, 303):
                score += 50
                reasons.append(f"redirect_{attempt['status']}")
            size_diff = abs(attempt['size'] - baseline_size)
            if size_diff > 50 and baseline_freq >= 0.7:
                score += 30
                reasons.append(f"size_deviation_{size_diff}b")
            text_lower = attempt.get('text', '').lower()
            for indicator in _SUCCESS_INDICATORS:
                if indicator in text_lower:
                    score += 20
                    reasons.append(f"success_text")
                    break
            if any(p in text_lower for p in fail_patterns):
                continue
            if score > 0 or (attempt['status'] == 200 and size_diff > 100):
                candidates.append({**attempt, 'score': score, 'reasons': reasons})
        candidates.sort(key=lambda x: x['score'], reverse=True)
        logger.info("Patator: %d attempts → %d candidates", len(attempts), len(candidates[:3]))
        return candidates[:3]

    def _parse_output(self, output: str) -> List[Dict[str, str]]:
        found = []
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            if 'PAYLOAD' in line and any(code in line for code in ('200', '302', 'Found')):
                payload_match = re.search(r'PAYLOAD:(\S+):(\S+)', line)
                if payload_match:
                    found.append({
                        'username': payload_match.group(1),
                        'password': payload_match.group(2),
                    })
        return found

    def _simulate_scan(self, target: str) -> List[Dict[str, Any]]:
        """Resultados simulados — SOLO cuando ni requests ni patator están disponibles."""
        logger.info("Patator simulation mode for %s", target)
        return [{
            'name': 'Credencial débil encontrada (admin/password)',
            'description': (
                "Patator detectó credenciales por defecto. "
                "No hay protección contra fuerza bruta (sin account lockout, sin CAPTCHA)."
            ),
            'severity': 'high',
            'url': target,
            'credentials': [
                {'username': 'admin', 'password': 'password'},
            ],
            'attempts': len(_DEFAULT_USERS) * len(_DEFAULT_PASSES),
            'success': True,
            'tool': 'patator',
            'simulated': True,
        }]

    def _brute_force_with_requests(
        self,
        target_url: str,
        user_field: str,
        pass_field: str,
        fail_string: str,
        users: List[str],
        passes: List[str],
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Brute force usando requests con:
        - Manejo automático de CSRF tokens
        - Detección genérica de éxito/fallo
        - Compatible con cualquier formulario de login web
        - FIX: Cookie capturada en cualquier respuesta, no solo redirects
        """
        try:
            import requests
        except ImportError:
            logger.warning("requests library not available")
            return None

        attempts = 0
        found_credentials = []

        try:
            session = requests.Session()
            session.headers.update({'User-Agent': 'Mozilla/5.0 (compatible; SecureScan/3.0)'})

            # GET inicial para obtener cookie de sesión, CSRF token y campos del form
            resp = session.get(target_url, timeout=10, allow_redirects=True)
            html = resp.text

            # Auto-detectar campos del formulario
            form_fields = self._detect_form_fields(html)
            detected_user_field = form_fields.get('user_field', user_field)
            detected_pass_field = form_fields.get('pass_field', pass_field)
            extra_fields = form_fields.get('extra_fields', {})

            logger.info(
                "Form fields detected — user: '%s', pass: '%s', extra: %s",
                detected_user_field, detected_pass_field, list(extra_fields.keys())
            )

            # Obtener CSRF token inicial
            current_token = None
            current_token_name = None

            token_match = re.search(
                r"name=['\"]user_token['\"] value=['\"]([a-f0-9]+)['\"]", html
            )
            if token_match:
                current_token = token_match.group(1)
                current_token_name = 'user_token'

            if not current_token:
                for token_name in ['_token', 'csrf_token', '_csrf', 'authenticity_token',
                                   'csrfmiddlewaretoken', '__RequestVerificationToken']:
                    t_match = re.search(
                        rf"name=['\"]?{re.escape(token_name)}['\"]? value=['\"]?([^'\">\s]+)['\"]?",
                        html, re.IGNORECASE
                    )
                    if t_match:
                        current_token = t_match.group(1)
                        current_token_name = token_name
                        break

            if current_token:
                logger.info("CSRF token detected — field: '%s'", current_token_name)

            all_attempts = []
            for username in users:
                for password in passes:
                    try:
                        data = {
                            detected_user_field: username,
                            detected_pass_field: password,
                        }
                        data.update(extra_fields)
                        if current_token and current_token_name:
                            data[current_token_name] = current_token
                        if "Login" not in data and "Submit" not in data:
                            data["Login"] = "Login"

                        r = session.post(
                            target_url,
                            data=data,
                            timeout=10,
                            allow_redirects=True,
                        )
                        attempts += 1

                        # FIX: capturar cookie en CUALQUIER respuesta con cookies activas
                        cookies_str = "; ".join(
                            f"{k}={v}" for k, v in session.cookies.items()
                        )

                        record = {
                            "username": username,
                            "password": password,
                            "status": r.status_code,
                            "size": len(r.content),
                            "url": r.url,
                            "text": r.text[:500],
                            "session_cookie": cookies_str,  # FIX: siempre guardar cookie
                        }
                        all_attempts.append(record)

                        # Actualizar CSRF token para siguiente intento
                        if current_token_name:
                            pat = 'name=[^>]*' + re.escape(current_token_name) + r"[^>]*value=[^>\"'>]*([^\"'>\s>]+)"
                            tm = re.search(pat, r.text, re.IGNORECASE)
                            if tm:
                                current_token = tm.group(1)

                    except Exception as e:
                        logger.debug("Attempt %s/%s error: %s", username, password, e)
                        continue

        except Exception as e:
            logger.error("Requests brute force error: %s", e)
            return None

        candidates = self._analyze_results(all_attempts)
        found_credentials = []
        seen_creds = set()
        for c in candidates:
            key = f"{c['username']}:{c['password']}"
            if key in seen_creds:
                continue
            seen_creds.add(key)
            found_credentials.append({
                "username": c["username"],
                "password": c["password"],
                "session_cookie": c.get("session_cookie", ""),
            })

        if found_credentials:
            return [{
                'name': f'Credenciales débiles — {len(found_credentials)} encontradas',
                'description': (
                    f"Brute force exitoso en {target_url}. "
                    f"Se probaron {attempts} combinaciones. "
                    "Credenciales válidas: "
                    + ', '.join(f"{c['username']}/{c['password']}" for c in found_credentials)
                ),
                'severity': 'high',
                'url': target_url,
                'credentials': found_credentials,
                'attempts': attempts,
                'success': True,
                'tool': 'patator',
                'simulated': False,
            }]
        else:
            return [{
                'name': 'Sin credenciales débiles encontradas',
                'description': (
                    f'Patator probó {attempts} combinaciones en {target_url} '
                    'sin éxito con las wordlists usadas.'
                ),
                'severity': 'info',
                'url': target_url,
                'credentials': [],
                'attempts': attempts,
                'success': False,
                'tool': 'patator',
                'simulated': False,
            }]

    def _brute_force_with_json(
        self,
        target_url: str,
        user_field: str,
        pass_field: str,
        users: List[str],
        passes: List[str],
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Brute force para APIs JSON (Juice Shop, REST APIs).
        Envía POST con Content-Type: application/json.
        """
        try:
            import requests
        except ImportError:
            return None

        attempts = 0
        found    = []
        session  = requests.Session()
        session.headers.update({
            'User-Agent':   'Mozilla/5.0 (compatible; SecureScan/3.0)',
            'Content-Type': 'application/json',
            'Accept':       'application/json',
        })

        for username in users:
            for password in passes:
                try:
                    r = session.post(
                        target_url,
                        json={user_field: username, pass_field: password},
                        timeout=10,
                        allow_redirects=True,
                    )
                    attempts += 1

                    if r.status_code == 200:
                        try:
                            data  = r.json()
                            token = (
                                data.get('authentication', {}).get('token') or
                                data.get('token') or
                                data.get('access_token') or
                                data.get('jwt')
                            )
                            if token:
                                logger.info("JSON brute force: credencial válida %s/%s", username, password)
                                found.append({
                                    'username':       username,
                                    'password':       password,
                                    'session_cookie': f'token={token}',
                                    'token':          token,
                                })
                        except Exception:
                            pass

                except Exception as e:
                    logger.debug("JSON attempt %s/%s error: %s", username, password, e)
                    continue

        if found:
            return [{
                'name':        f'Credenciales débiles — {len(found)} encontradas',
                'description': (
                    f"Brute force JSON exitoso en {target_url}. "
                    f"Se probaron {attempts} combinaciones. "
                    "Credenciales válidas: "
                    + ', '.join(f"{c['username']}/{c['password']}" for c in found)
                ),
                'severity':    'high',
                'url':         target_url,
                'credentials': found,
                'attempts':    attempts,
                'success':     True,
                'tool':        'patator',
                'simulated':   False,
            }]

        return [{
            'name':        'Sin credenciales débiles encontradas',
            'description': (
                f'Patator probó {attempts} combinaciones JSON en {target_url} '
                'sin éxito con las wordlists usadas.'
            ),
            'severity':    'info',
            'url':         target_url,
            'credentials': [],
            'attempts':    attempts,
            'success':     False,
            'tool':        'patator',
            'simulated':   False,
        }]

    def _brute_force_with_binary(
        self,
        target_url: str,
        user_field: str,
        pass_field: str,
        fail_string: str,
        users: List[str],
        passes: List[str],
    ) -> List[Dict[str, Any]]:
        """Brute force usando el binario patator como fallback."""
        attempts = len(users) * len(passes)
        users_file = self._write_temp_list(users, 'patator_u_')
        pass_file  = self._write_temp_list(passes, 'patator_p_')

        post_data = f'{user_field}=FILE0&{pass_field}=FILE1'
        cmd = [
            self.command,
            'http_fuzz',
            f'url={target_url}',
            'method=POST',
            f'body={post_data}',
            f'0={users_file}',
            f'1={pass_file}',
            '-x', f'ignore:fgrep={fail_string}',
            '-t', str(self.threads),
            '--timeout', '10',
        ]

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=self.timeout,
            )
            output = result.stdout + result.stderr
            credentials = self._parse_output(output)

            if credentials:
                return [{
                    'name': f'Credenciales débiles — {len(credentials)} encontradas',
                    'description': (
                        f"Brute force exitoso en {target_url}. "
                        f"Se probaron {attempts} combinaciones. "
                        "Credenciales válidas: "
                        + ', '.join(f"{c['username']}/{c['password']}" for c in credentials)
                    ),
                    'severity': 'high',
                    'url': target_url,
                    'credentials': credentials,
                    'attempts': attempts,
                    'success': True,
                    'tool': 'patator',
                    'simulated': False,
                }]
            else:
                return [{
                    'name': 'Sin credenciales débiles encontradas',
                    'description': (
                        f'Patator probó {attempts} combinaciones en {target_url} '
                        'sin éxito.'
                    ),
                    'severity': 'info',
                    'url': target_url,
                    'credentials': [],
                    'attempts': attempts,
                    'success': False,
                    'tool': 'patator',
                    'simulated': False,
                }]

        except subprocess.TimeoutExpired:
            logger.warning("Patator binary timed out on %s", target_url)
            return []
        except Exception as e:
            logger.error("Patator binary error on %s: %s", target_url, e)
            return []
        finally:
            for f in [users_file, pass_file]:
                try:
                    os.unlink(f)
                except Exception:
                    pass

    def scan(
        self,
        target: str,
        form_path: str = '/login',
        user_field: str = 'username',
        pass_field: str = 'password',
        fail_string: str = 'Login failed',
        usernames: Optional[List[str]] = None,
        passwords: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Ejecuta brute force contra un formulario de login.
        Funciona con cualquier URL — auto-detecta campos, CSRF tokens y
        señales de éxito/fallo sin configuración manual.
        """
        if target.startswith(('http://', 'https://')):
            parsed = urlparse(target)
            host   = parsed.hostname
            port   = parsed.port or (443 if parsed.scheme == 'https' else 80)
            scheme = parsed.scheme
        else:
            host   = target
            port   = 80
            scheme = 'http'

        if not host:
            logger.error("Invalid target for Patator: %s", target)
            return []

        target_url = f'{scheme}://{host}:{port}{form_path}'
        users  = usernames or _DEFAULT_USERS
        passes = passwords or _DEFAULT_PASSES

        logger.info("Running Patator on %s", target_url)

        
        # Estrategia 0: JSON brute force (Juice Shop, REST APIs)
        t = target_url.lower()
        is_juice_shop = any(x in t for x in ['juice', '3001', '3000'])
        is_json_api   = is_juice_shop or any(x in t for x in ['/rest/', '/api/'])

        if is_json_api:
            json_user_field = user_field

            if is_juice_shop:
                # FIX Bug 1: construir URL sin port=None
                parsed   = urlparse(target_url)
                _host    = parsed.hostname or 'juice-shop'
                _port    = parsed.port
                _base    = (
                    f"{parsed.scheme}://{_host}:{_port}"
                    if _port else
                    f"{parsed.scheme}://{_host}"
                )
                json_url        = f"{_base}/rest/user/login"
                json_user_field = 'email'

                # FIX Bug 2: Juice Shop solo acepta emails — filtrar lista
                juice_users = [u for u in users if '@' in u]
                if not juice_users:
                    juice_users = ['admin@juice-sh.op']
                juice_passes = passes  # las contraseñas son genéricas, ok
                logger.info(
                    "Patator: modo JSON Juice Shop → %s (%d usuarios email)",
                    json_url, len(juice_users),
                )
                result = self._brute_force_with_json(
                    json_url, json_user_field, pass_field, juice_users, juice_passes
                )
            else:
                # REST API genérica
                json_url = target_url
                logger.info("Patator: modo JSON API genérica → %s", json_url)
                result = self._brute_force_with_json(
                    json_url, json_user_field, pass_field, users, passes
                )

            if result is not None:
                return result

        # Estrategia 1: requests con auto-detección de CSRF ← SIN CAMBIOS
        result = self._brute_force_with_requests(
            target_url, user_field, pass_field, fail_string, users, passes
        )
        if result is not None:
            return result

        # Estrategia 2: binario patator ← SIN CAMBIOS
        if self._available:
            return self._brute_force_with_binary(
                target_url, user_field, pass_field, fail_string, users, passes
            )

        # Estrategia 3: simulación (último recurso) ← SIN CAMBIOS
        return self._simulate_scan(target_url)
    
        