"""
i18n_backend.py — Carga de traducciones para el backend Flask.
"""
import json
import logging
import os
from typing import Any, Dict

logger = logging.getLogger(__name__)

_LOCALES_DIR    = os.path.join(os.path.dirname(__file__), '..', 'locales')
_DEFAULT_LOCALE = 'es'
_SUPPORTED      = {'es', 'en'}
_cache: Dict[str, Dict] = {}


def _load(locale: str) -> Dict:
    if locale not in _cache:
        path = os.path.join(_LOCALES_DIR, f'{locale}.json')
        try:
            with open(path, encoding='utf-8') as f:
                _cache[locale] = json.load(f)
        except FileNotFoundError:
            logger.warning("i18n: no encontrado: %s", path)
            if locale != _DEFAULT_LOCALE:
                return _load(_DEFAULT_LOCALE)
            _cache[locale] = {}
        except json.JSONDecodeError as e:
            logger.error("i18n: JSON inválido en %s: %s", path, e)
            _cache[locale] = {}
    return _cache[locale]


class T:
    def __init__(self, locale: str):
        self._data = _load(locale)

    def __call__(self, key: str, **kwargs: Any) -> str:
        parts = key.split('.')
        val: Any = self._data
        for part in parts:
            if isinstance(val, dict):
                val = val.get(part)
                if val is None:
                    return key
            else:
                return key
        if not isinstance(val, str):
            return key
        if kwargs:
            try:
                val = val.format(**kwargs)
            except (KeyError, ValueError):
                pass
        return val


def get_t(locale: str = _DEFAULT_LOCALE) -> T:
    if locale not in _SUPPORTED:
        locale = _DEFAULT_LOCALE
    return T(locale)


def locale_from_request(flask_request) -> str:
    lang = (flask_request.args.get('lang') or '').lower()[:2]
    if lang in _SUPPORTED:
        return lang
    accept = flask_request.headers.get('Accept-Language', '')
    for segment in accept.split(','):
        code = segment.strip().split(';')[0].strip()[:2].lower()
        if code in _SUPPORTED:
            return code
    return _DEFAULT_LOCALE