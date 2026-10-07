"""
Circuit Breaker (Redis-backed)
Protege contra fallar repetido contra un mismo target o una misma
herramienta -- si algo falla muchas veces seguidas, deja de intentarlo
por un rato en vez de seguir golpeando un servicio caído o con rate
limit activo.

Antes esto vivía como funciones sueltas en server/app.py, con el estado
en un dict de Python en memoria (`_circuit_state`). Eso significa que el
estado se perdía en cada reinicio del servidor, y no se compartía si en
algún momento corre más de una réplica del backend al mismo tiempo. Acá
usa Redis (que ya está disponible en todo el proyecto para el storage de
scans), así que el estado sobrevive reinicios y se comparte entre
réplicas.

Diseño "fail-open": si Redis no está disponible, is_open() siempre
devuelve False (no bloquea nada) en vez de fallar cerrado -- mismo
criterio que el resto del proyecto, que ya cae a un modo degradado en
vez de tumbar el escaneo cuando Redis no responde.
"""

import json
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)


class CircuitBreaker:
    """
    Circuit breaker genérico con estado en Redis. Se instancia una vez
    por "dominio" de uso (ej. uno para targets del pipeline web, otro
    para herramientas de Huella Digital) vía `key_prefix`, para que sus
    contadores no se mezclen entre sí.
    """

    def __init__(self, redis_client, key_prefix: str, failure_threshold: int = 3,
                 recovery_timeout: int = 60, ttl: int = 3600):
        self.redis             = redis_client
        self.key_prefix        = key_prefix
        self.failure_threshold = failure_threshold
        self.recovery_timeout  = recovery_timeout
        self.ttl                = ttl  # las claves viejas se limpian solas vía TTL de Redis

    def _key(self, name: str) -> str:
        return f'circuit:{self.key_prefix}:{name}'

    def is_open(self, name: str, failure_threshold: Optional[int] = None,
                recovery_timeout: Optional[int] = None) -> bool:
        """True si el breaker está abierto (bloqueando) para `name` ahora mismo."""
        if self.redis is None:
            return False

        threshold = failure_threshold if failure_threshold is not None else self.failure_threshold
        recovery  = recovery_timeout if recovery_timeout is not None else self.recovery_timeout

        try:
            raw = self.redis.get(self._key(name))
        except Exception as e:
            logger.warning("CircuitBreaker(%s): Redis no disponible al leer -- %s", self.key_prefix, e)
            return False

        if not raw:
            return False
        try:
            state = json.loads(raw)
        except ValueError:
            return False

        if state.get('failures', 0) >= threshold:
            if time.time() - state.get('opened_at', 0) < recovery:
                return True
            self.record_success(name)  # pasó la ventana de recuperación -- resetear
        return False

    def record_failure(self, name: str) -> None:
        if self.redis is None:
            return
        try:
            raw   = self.redis.get(self._key(name))
            state = json.loads(raw) if raw else {'failures': 0, 'opened_at': 0}
            state['failures']  = state.get('failures', 0) + 1
            state['opened_at'] = time.time()
            self.redis.set(self._key(name), json.dumps(state), ex=self.ttl)
            logger.warning("CircuitBreaker(%s): %d fallo(s) consecutivos para %s",
                            self.key_prefix, state['failures'], name[:80])
        except Exception as e:
            logger.warning("CircuitBreaker(%s): Redis no disponible al escribir -- %s", self.key_prefix, e)

    def record_success(self, name: str) -> None:
        if self.redis is None:
            return
        try:
            self.redis.delete(self._key(name))
        except Exception as e:
            logger.warning("CircuitBreaker(%s): Redis no disponible al limpiar -- %s", self.key_prefix, e)
