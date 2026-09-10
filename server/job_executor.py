"""
Capa de ejecución de Jobs — abstrae threading.Thread vs Celery.

Objetivo (ver PROMPT_MAESTRO sección "MIGRACIÓN A CELERY"):

    API → crear Job → job_executor.submit(...) → Celery Worker (o thread
    de desarrollo) → SecurityOrchestrator / funciones run_* existentes
    → persistencia en Redis (sin cambios)

app.py NO debe importar `threading` ni `tasks` directamente para lanzar
trabajo: solo llama a `job_executor.submit(kind, *args)`. Así el resto
del código (rutas, frontend, formato de respuesta) no necesita saber
qué tecnología ejecuta el Job.

Modo de selección (env var JOB_BACKEND):
  - "celery" -> siempre encola en Celery. Si el broker no está disponible,
                la tarea falla igual que fallaría cualquier otra falla de
                infraestructura (no hay fallback silencioso en producción).
  - "thread" -> siempre usa threading.Thread (comportamiento actual, v5.0).
  - "auto" (default) -> intenta Celery; si el broker no responde (Redis de
                Celery caído/no configurado), cae a threading.Thread para
                no bloquear el desarrollo local sin Docker completo. Se
                loguea claramente cuál camino se tomó.

Esto conserva exactamente el mecanismo de fallback que ya existe en
get_scan_storage() (Redis vs scans_fallback en memoria), aplicado ahora
también a la ejecución del trabajo, no solo a su almacenamiento.
"""

import os
import logging
import threading
from typing import Callable, Sequence

logger = logging.getLogger('securescan.job_executor')

JOB_BACKEND = os.environ.get('JOB_BACKEND', 'auto').strip().lower()

# Nombre de tarea Celery -> se resuelve en tasks.py. Se importa perezosamente
# (dentro de la función) para que un entorno sin Celery instalado / sin
# broker disponible no rompa el arranque de app.py.
_TASK_NAMES = {
    'scan':        'tasks.run_scan_task',
    'code_scan':   'tasks.run_code_scan_task',
    'sherlock':    'tasks.run_sherlock_task',
    'harvester':   'tasks.run_harvester_task',
}


def _celery_broker_reachable() -> bool:
    try:
        from celery_app import celery_app
        conn = celery_app.connection()
        conn.ensure_connection(max_retries=1, timeout=1.5)
        conn.release()
        return True
    except Exception as e:
        logger.warning("Broker de Celery no disponible (%s). Se usará threading.Thread.", e)
        return False


def _submit_celery(kind: str, *args) -> str:
    from celery_app import celery_app
    task_name = _TASK_NAMES[kind]
    async_result = celery_app.send_task(task_name, args=list(args))
    return async_result.id


def _submit_thread(fn: Callable, *args) -> str:
    thread = threading.Thread(target=fn, args=args, daemon=False)
    thread.start()
    return thread.name


def submit_job(kind: str, fn: Callable, *args) -> dict:
    """
    Envía un trabajo (scan / code_scan / sherlock / harvester) al backend
    de ejecución configurado.

    - kind: clave en _TASK_NAMES, identifica qué tarea Celery correr.
    - fn:   la función Python real (run_scan, run_code_scan, ...) — se usa
            directamente en el modo thread, y sirve de referencia/doc en el
            modo celery (la tarea Celery en tasks.py llama a la misma fn).
    - args: argumentos posicionales de la función (job_id, target, options, ...).

    Devuelve un dict {'backend': 'celery'|'thread', 'ref': <id>} solo para
    logging/diagnóstico interno. El contrato HTTP de las rutas (jobId,
    status) NO cambia: el job_id sigue siendo el identificador que ya
    genera app.py y que ya se usa para consultar el estado en Redis.
    """
    if kind not in _TASK_NAMES:
        raise ValueError(f"kind de job desconocido: {kind}")

    backend = JOB_BACKEND
    if backend not in ('celery', 'thread', 'auto'):
        logger.warning("JOB_BACKEND=%r inválido, usando 'auto'.", backend)
        backend = 'auto'

    use_celery = False
    if backend == 'celery':
        use_celery = True
    elif backend == 'thread':
        use_celery = False
    else:  # auto
        use_celery = _celery_broker_reachable()

    if use_celery:
        try:
            ref = _submit_celery(kind, *args)
            logger.info("Job '%s' encolado en Celery (task_id=%s)", kind, ref)
            return {'backend': 'celery', 'ref': ref}
        except Exception as e:
            if backend == 'celery':
                # Modo explícito de producción: no hacer fallback silencioso.
                raise
            logger.warning("Fallo al encolar en Celery (%s), usando threading.Thread.", e)

    ref = _submit_thread(fn, *args)
    logger.info("Job '%s' ejecutado con threading.Thread (%s)", kind, ref)
    return {'backend': 'thread', 'ref': ref}
