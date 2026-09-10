"""
Username Search (equivalente ligero a Sherlock)
Busca un nombre de usuario en varias plataformas — segunda herramienta
del grupo OSINT ("Grupo 2").

No es el proyecto Sherlock real (ese mantiene una base de +400 sitios
con reglas de detección específicas por cada uno, y bastante
mantenimiento para que sigan funcionando cuando las plataformas cambian
su HTML). Acá uso un subconjunto curado de ~20 sitios donde un chequeo
simple -- status code, o un mensaje de "no encontrado" en el HTML -- es
razonablemente confiable, corridos todos en paralelo.

Ojo importante: varias plataformas grandes (Instagram, X/Twitter,
Facebook, LinkedIn) bloquean activamente requests automatizados con
CAPTCHA o detección de bots. Para esas, un resultado "no encontrado"
puede en realidad significar "la plataforma bloqueó la consulta", no
que el usuario no exista -- por eso esos casos se marcan como
'unknown_sites' en vez de mezclarse con los "no encontrados" reales.
"""

import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    ),
}

_USERNAME_RE = re.compile(r'^[A-Za-z0-9_.\-]{1,39}$')

# Algunos sitios (PyPI vía Fastly, otros vía Cloudflare) devuelven un 200
# con una página de "verificación anti-bots" en vez del perfil real,
# exista o no el usuario -- sin esto, esos casos se contarían como falsos
# positivos de "encontrado".
_BOT_CHALLENGE_MARKERS = ('client challenge', 'just a moment', 'attention required', 'captcha')


def _looks_like_bot_challenge(text: str) -> bool:
    lowered = text[:2000].lower()
    return any(marker in lowered for marker in _BOT_CHALLENGE_MARKERS)

# (nombre, url_template, error_type, needle)
# error_type='status' -> 200 = existe, cualquier otra cosa = no existe.
# error_type='message' -> si el 200 contiene `needle`, NO existe.
_SITES: List[Tuple[str, str, str, Optional[str]]] = [
    ('GitHub',        'https://github.com/{}',                    'status',  None),
    ('GitLab',        'https://gitlab.com/{}',                     'status',  None),
    ('Docker Hub',    'https://hub.docker.com/v2/users/{}/',       'status',  None),
    ('PyPI',          'https://pypi.org/user/{}/',                 'status',  None),
    ('npm',           'https://www.npmjs.com/~{}',                 'status',  None),
    ('Reddit',        'https://www.reddit.com/user/{}/about.json', 'status',  None),
    ('Hacker News',   'https://news.ycombinator.com/user?id={}',   'message', 'No such user'),
    ('Keybase',       'https://keybase.io/{}',                     'status',  None),
    ('DEV Community', 'https://dev.to/{}',                         'status',  None),
    ('Product Hunt',  'https://www.producthunt.com/@{}',           'status',  None),
    ('CodePen',       'https://codepen.io/{}',                     'status',  None),
    ('Replit',        'https://replit.com/@{}',                    'status',  None),
    ('SoundCloud',    'https://soundcloud.com/{}',                 'status',  None),
    ('Steam',         'https://steamcommunity.com/id/{}',          'message', 'The specified profile could not be found'),
    ('Twitch',        'https://www.twitch.tv/{}',                  'status',  None),
    ('Instagram',     'https://www.instagram.com/{}/',             'status',  None),
    ('Medium',        'https://medium.com/@{}',                    'status',  None),
    ('Pinterest',     'https://www.pinterest.com/{}/',             'status',  None),
    ('HackerOne',     'https://hackerone.com/{}',                  'status',  None),
]


class UsernameSearchScanner:
    """Busca un username en ~20 plataformas en paralelo."""

    def __init__(self, timeout: int = 8, max_workers: int = 12):
        self.timeout     = timeout
        self.max_workers = max_workers
        self.available   = True

    def _check_site(self, name: str, url_template: str, error_type: str,
                     needle: Optional[str], username: str) -> Dict[str, str]:
        url = url_template.format(username)
        try:
            resp = requests.get(url, headers=_HEADERS, timeout=self.timeout, allow_redirects=True)
        except requests.RequestException:
            return {'site': name, 'url': url, 'status': 'unknown'}

        if resp.status_code == 429:
            return {'site': name, 'url': url, 'status': 'unknown'}

        # Solo 200 y 404 son señales confiables de "existe" / "no existe".
        # Cualquier otro código (401, 403, 5xx...) puede ser bloqueo de bots
        # o un proxy de red devolviendo su propio error -- mejor marcarlo
        # "unknown" que arriesgar un falso "no existe".
        if resp.status_code not in (200, 404):
            return {'site': name, 'url': url, 'status': 'unknown'}

        if resp.status_code == 200 and _looks_like_bot_challenge(resp.text):
            return {'site': name, 'url': url, 'status': 'unknown'}

        if error_type == 'status':
            exists = resp.status_code == 200
        else:  # 'message'
            exists = resp.status_code == 200 and (needle not in resp.text if needle else True)

        return {'site': name, 'url': url, 'status': 'found' if exists else 'not_found'}

    def search(self, username: str) -> Dict[str, Any]:
        """
        Busca `username` en las plataformas soportadas, todas en paralelo.

        Returns:
            Dict con: username, available, simulated, found (lista de
            {site, url} donde sí existe), unknown_sites (plataformas que
            bloquearon/fallaron la consulta -- no cuentan como "no
            encontrado"), checked_count, error.
        """
        username = (username or '').strip()
        if not username or not _USERNAME_RE.match(username):
            time.sleep(0.2)
            return {
                'username': username, 'available': self.available, 'simulated': True,
                'found': [], 'unknown_sites': [], 'checked_count': 0,
                'error': 'Username inválido (solo letras, números, "_", "-" y ".")',
            }

        results: List[Dict[str, str]] = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {
                executor.submit(self._check_site, name, url, etype, needle, username): name
                for name, url, etype, needle in _SITES
            }
            for future in as_completed(futures):
                results.append(future.result())

        found         = sorted([r for r in results if r['status'] == 'found'], key=lambda r: r['site'])
        unknown_sites = sorted(r['site'] for r in results if r['status'] == 'unknown')

        return {
            'username':      username,
            'available':     True,
            'simulated':     False,
            'found':         [{'site': r['site'], 'url': r['url']} for r in found],
            'unknown_sites': unknown_sites,
            'checked_count': len(_SITES),
            'error':         None,
        }
