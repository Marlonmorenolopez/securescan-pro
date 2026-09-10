"""
Tareas Celery de SecureScan Pro.

REGLA DE ORO: estas tareas NO reimplementan ningún scanner ni orchestrator.
Cada tarea es una envoltura delgada que:
  1. Importa `app` (donde ya viven run_scan, run_code_scan, run_sherlock_scan,
     run_harvester_scan, SecurityOrchestrator, save_scan, get_scan, etc.)
  2. Llama directamente a la función correspondiente.
  3. Deja que esa función siga actualizando el estado del Job en Redis
     exactamente como lo hace hoy con threading.Thread.

La importación de `app` es perezosa (dentro de cada tarea) a propósito:
- Evita import circular (app.py puede llamar a job_executor, que a su vez
  puede llamar a tasks.py).
- El worker de Celery importa `app` una sola vez por proceso (Python cachea
  el módulo), así que el costo de inicialización (Flask, Redis, orchestrator)
  ocurre una vez por worker, igual que ocurriría al arrancar un proceso
  gunicorn.
"""

import logging

from celery_app import celery_app

logger = logging.getLogger('securescan.tasks')


@celery_app.task(name='tasks.run_scan_task', bind=True, max_retries=0)
def run_scan_task(self, job_id: str, target: str, options: dict):
    import app as securescan_app
    logger.info("[celery] run_scan_task job=%s target=%s", job_id, target[:80])
    securescan_app.run_scan(job_id, target, options)


@celery_app.task(name='tasks.run_code_scan_task', bind=True, max_retries=0)
def run_code_scan_task(self, job_id: str, source_type: str, source_value: str):
    import app as securescan_app
    logger.info("[celery] run_code_scan_task job=%s source_type=%s", job_id, source_type)
    securescan_app.run_code_scan(job_id, source_type, source_value)


@celery_app.task(name='tasks.run_sherlock_task', bind=True, max_retries=0)
def run_sherlock_task(self, job_id: str, username: str):
    import app as securescan_app
    logger.info("[celery] run_sherlock_task job=%s", job_id)
    securescan_app.run_sherlock_scan(job_id, username)


@celery_app.task(name='tasks.run_harvester_task', bind=True, max_retries=0)
def run_harvester_task(self, job_id: str, domain: str):
    import app as securescan_app
    logger.info("[celery] run_harvester_task job=%s domain=%s", job_id, domain)
    securescan_app.run_harvester_scan(job_id, domain)


@celery_app.task(name='tasks.check_scheduled_scans')
def check_scheduled_scans():
    """
    Tarea periódica de Celery Beat (ver celery_app.py: beat_schedule).

    Delegada por completo en scheduler.py: esta tarea NO decide nada por
    sí misma, solo dispara el chequeo. scheduler.py reutiliza job_executor
    y las mismas rutas de creación de Job que ya existen — un scan
    programado termina siendo un Job normal, indistinguible en Redis de
    uno creado manualmente desde el frontend salvo por un campo
    'created_by': 'scheduler'.
    """
    import scheduler
    scheduler.run_due_schedules()
