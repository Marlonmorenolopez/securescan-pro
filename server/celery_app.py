"""
SecureScan Pro — Configuración de Celery.

Este módulo SOLO define la instancia de Celery y su configuración.
No contiene lógica de negocio: las tareas viven en tasks.py y ellas
mismas reutilizan las funciones ya existentes en app.py (run_scan,
run_code_scan, run_sherlock_scan, run_harvester_scan).

Broker y backend de resultados: el mismo Redis que ya usa la app para
persistir el estado de los Jobs (REDIS_URL). No se introduce una
infraestructura paralela.
"""

import os
from celery import Celery

REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# DB separada dentro del mismo Redis para broker/backend de Celery,
# para no mezclar las claves de Celery con las claves de scan:* que
# ya usa app.py (que viven en la DB 0 de REDIS_URL).
_CELERY_DB = os.environ.get('CELERY_REDIS_DB', '1')


def _with_db(url: str, db: str) -> str:
    """Reemplaza el número de DB al final de una URL redis://.../N."""
    if '/' not in url.rsplit('/', 1)[0]:
        return url
    base = url.rsplit('/', 1)[0]
    return f"{base}/{db}"


CELERY_BROKER_URL  = os.environ.get('CELERY_BROKER_URL')  or _with_db(REDIS_URL, _CELERY_DB)
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND') or CELERY_BROKER_URL

celery_app = Celery(
    'securescan_pro',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=['tasks'],
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone=os.environ.get('TZ', 'America/Bogota'),
    enable_utc=True,
    task_track_started=True,
    # Los scans pueden tardar hasta 1h (ver SCAN_TIMEOUT_* en docker-compose);
    # el worker no debe matar la tarea antes de que el propio orchestrator
    # aplique sus timeouts internos por herramienta.
    task_time_limit=int(os.environ.get('CELERY_TASK_TIME_LIMIT', '3600')),
    task_soft_time_limit=int(os.environ.get('CELERY_TASK_SOFT_TIME_LIMIT', '3540')),
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
    broker_connection_retry_on_startup=True,
    # FIX (auditoría): sin esto, un scan de ZAP de 10 min y un check de
    # username de 2s competían por el mismo worker/cola -- si el worker
    # estaba saturado con scans largos, hasta las consultas rápidas se
    # quedaban esperando. Se separan en dos colas: 'fast' (OSINT síncrono
    # ya resuelto vía HTTP, scheduler) y 'heavy' (scan/code_scan/sherlock/
    # harvester, que sí tardan minutos). Un mismo worker puede escuchar
    # ambas (ver docker-compose celery-worker command), pero quedan
    # aisladas para poder escalar cada una por separado si hace falta.
    task_routes={
        'tasks.run_scan_task':          {'queue': 'heavy'},
        'tasks.run_code_scan_task':     {'queue': 'heavy'},
        'tasks.run_sherlock_task':      {'queue': 'heavy'},
        'tasks.run_harvester_task':     {'queue': 'heavy'},
        'tasks.check_scheduled_scans':  {'queue': 'fast'},
    },
    task_default_queue='fast',
    # FIX (auditoría): si el worker moría a mitad de un scan largo (ej. el
    # host se queda sin memoria con ZAP+Metasploit corriendo), la tarea
    # jamás confirmaba (ack) y el Job quedaba en 'running' para siempre en
    # Redis -- nadie lo marcaba como failed. Con acks_late + reject_on_
    # worker_lost, Celery reencola la tarea a otro worker en vez de
    # perderla en silencio (y si no hay a quién reencolar, al menos no
    # queda marcada como falsamente exitosa).
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Beat: schedule dinámico leído desde Redis (ver scheduler.py). Se agrega
    # una entrada fija que revisa cada minuto si hay programaciones vencidas;
    # esa entrada crea Jobs normales (mismo sistema, sin flujo paralelo).
    beat_schedule={
        'check-scheduled-scans': {
            'task': 'tasks.check_scheduled_scans',
            'schedule': float(os.environ.get('SCHEDULER_POLL_SECONDS', '60')),
        },
    },
)
