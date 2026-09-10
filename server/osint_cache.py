"""
Caché OSINT (Redis) — XposedOrNot (breach-check) y Username Search rápida.

Objetivo: evitar re-consultar servicios externos para el mismo objetivo
dentro de un TTL, sin tocar la lógica de los scanners (breach_checker.py,
username_search.py) ni crear un sistema de caché paralelo -- se apoya en
el mismo redis_client que ya usa app.py para todo lo demás.

Garantía de aislamiento: la clave de caché depende SIEMPRE del objetivo
normalizado (y del tipo de operación), nunca de un identificador global,
así que nunca se puede devolver el resultado de un objetivo distinto al
solicitado.
"""

import hashlib
import json
import logging
from typing import Optional

logger = logging.getLogger('securescan.osint_cache')

_PREFIX = 'osint-cache'


def _norm_key(kind: str, value: str) -> str:
    normalized = (value or '').strip().lower()
    digest = hashlib.sha256(normalized.encode('utf-8')).hexdigest()
    return f"{_PREFIX}:{kind}:{digest}"


def get(redis_client, kind: str, value: str) -> Optional[dict]:
    """Devuelve el resultado cacheado para (kind, value) o None si no hay hit."""
    try:
        raw = redis_client.get(_norm_key(kind, value))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as e:
        logger.warning("Fallo leyendo caché OSINT (%s): %s", kind, e)
        return None


def set(redis_client, kind: str, value: str, result: dict, ttl_seconds: int) -> None:
    try:
        redis_client.setex(_norm_key(kind, value), ttl_seconds, json.dumps(result, default=str))
    except Exception as e:
        logger.warning("Fallo escribiendo caché OSINT (%s): %s", kind, e)


def invalidate(redis_client, kind: str, value: str) -> None:
    try:
        redis_client.delete(_norm_key(kind, value))
    except Exception as e:
        logger.warning("Fallo invalidando caché OSINT (%s): %s", kind, e)
