"""
Email Breach Checker (XposedOrNot)
Verifica si un correo aparece en brechas de datos conocidas — primera
herramienta del grupo OSINT ("Grupo 2"), en su propia página porque el
input es un CORREO, no un target web/IP como en Huella Digital.

Usa la API pública y gratuita de XposedOrNot (https://xposedornot.com).
NO es Have I Been Pwned: HIBP dejó de tener API gratuita hace un tiempo
(arranca en ~$4.39/mes); XposedOrNot cubre el mismo caso de uso (miles
de millones de registros de brechas conocidas) sin costo y sin API key.

Rate limit del lado de XposedOrNot para este endpoint: 2 consultas/seg,
25/hora, 100/día por IP — de sobra para uso interactivo, uno a la vez.
"""

import logging
import re
import time
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

_API_URL  = 'https://api.xposedornot.com/v1/breach-analytics'
_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


class BreachChecker:
    """Wrapper de la API pública de XposedOrNot — brechas de datos por correo."""

    def __init__(self, timeout: int = 15):
        self.timeout   = timeout
        self.available = True  # sin API key para el nivel gratuito

    def _empty(self, email: str, error: Optional[str] = None, simulated: bool = True) -> Dict[str, Any]:
        if simulated:
            time.sleep(0.3)
        return {
            'email':        email,
            'available':    self.available,
            'simulated':    simulated,
            'breached':     False,
            'breach_count': 0,
            'breaches':     [],
            'risk_score':   None,
            'risk_label':   None,
            'error':        error,
        }

    def check(self, email: str) -> Dict[str, Any]:
        """
        Consulta si `email` aparece en brechas de datos conocidas.

        Returns:
            Dict con: email, available, simulated, breached, breach_count,
            breaches (lista de {name, domain, description, industry,
            exposed_data, exposed_records, breach_date, password_risk}),
            risk_score (0-10), risk_label ('Low'/'Medium'/'High'), error.
        """
        email = (email or '').strip().lower()
        if not email or not _EMAIL_RE.match(email):
            return self._empty(email, error='Correo inválido')

        try:
            resp = requests.get(_API_URL, params={'email': email}, timeout=self.timeout)
        except requests.RequestException as e:
            logger.warning("BreachChecker: error de red consultando %s — %s", email, e)
            return self._empty(email, error=f'Error de red: {e}')

        if resp.status_code == 429:
            return self._empty(email, error='Rate limit de XposedOrNot alcanzado — intenta más tarde')

        if resp.status_code != 200:
            return self._empty(email, error=f'XposedOrNot respondió con status {resp.status_code}')

        try:
            data = resp.json()
        except ValueError as e:
            return self._empty(email, error=f'Error parseando respuesta: {e}')

        exposed = data.get('ExposedBreaches')
        if not exposed or not exposed.get('breaches_details'):
            return {
                'email': email, 'available': True, 'simulated': False,
                'breached': False, 'breach_count': 0, 'breaches': [],
                'risk_score': None, 'risk_label': None, 'error': None,
            }

        breaches = []
        for b in exposed['breaches_details']:
            breaches.append({
                'name':            b.get('breach'),
                'domain':          b.get('domain'),
                'description':     (b.get('details') or '')[:300],
                'industry':        b.get('industry'),
                'exposed_data':    [d for d in (b.get('xposed_data') or '').split(';') if d],
                'exposed_records': b.get('xposed_records'),
                'breach_date':     b.get('xposed_date'),
                'password_risk':   b.get('password_risk'),
            })

        risk_list = (data.get('BreachMetrics') or {}).get('risk') or [{}]
        risk = risk_list[0] if risk_list else {}

        return {
            'email':        email,
            'available':    True,
            'simulated':    False,
            'breached':     True,
            'breach_count': len(breaches),
            'breaches':     breaches,
            'risk_score':   risk.get('risk_score'),
            'risk_label':   risk.get('risk_label'),
            'error':        None,
        }
