"""
Escaneos programados (SecureScan Pro).

Base para Celery Beat (ver PROMPT_MAESTRO sección 42). Un scan programado
NO es un sistema paralelo: cuando le toca ejecutarse, crea exactamente el
mismo tipo de Job que crea /api/scan (vía app._launch_scan_job), con
'created_by': 'scheduler' como único diferenciador.

Modelo de datos en Redis (misma instancia que ya usa app.py):

    schedule:<id>          -> hash con los campos de la programación
    schedules:all           -> set con todos los <id> existentes

Frecuencias soportadas: daily, weekly, monthly (ver sección 42).
Este módulo cubre el motor (crear/listar/pausar/reanudar/eliminar/
ejecutar-si-corresponde). Las rutas HTTP viven en app.py, al final,
como endpoints nuevos y aditivos (no tocan endpoints existentes).

IMPORTANTE: este módulo NO importa `app` a nivel de módulo (para no
crear un import circular con app.py, que sí importa `scheduler`).
`app` solo se importa de forma perezosa, dentro de cada función, en el
momento en que efectivamente se necesita.
"""

import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger('securescan.scheduler')

_SCHEDULE_KEY_PREFIX = 'schedule:'
_SCHEDULE_INDEX_KEY  = 'schedules:all'

_VALID_FREQUENCIES = {'daily', 'weekly', 'monthly'}


def _redis():
    import app as securescan_app
    return securescan_app.redis_client


def _key(schedule_id: str) -> str:
    return f"{_SCHEDULE_KEY_PREFIX}{schedule_id}"


def _compute_next_run(frequency: str, hour: int, minute: int,
                       day_of_week: Optional[int] = None,
                       day_of_month: Optional[int] = None,
                       after: Optional[datetime] = None) -> datetime:
    """Calcula la próxima ejecución en UTC a partir de 'after' (o ahora)."""
    now = after or datetime.utcnow()
    candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

    if frequency == 'daily':
        if candidate <= now:
            candidate += timedelta(days=1)
        return candidate

    if frequency == 'weekly':
        dow = day_of_week if day_of_week is not None else now.weekday()
        days_ahead = (dow - candidate.weekday()) % 7
        candidate += timedelta(days=days_ahead)
        if candidate <= now:
            candidate += timedelta(days=7)
        return candidate

    if frequency == 'monthly':
        dom = day_of_month or now.day
        year, month = now.year, now.month
        while True:
            try:
                candidate = candidate.replace(year=year, month=month, day=dom)
                break
            except ValueError:
                # Día inválido para ese mes (ej. 31 en febrero) -> siguiente mes
                month += 1
                if month > 12:
                    month = 1
                    year += 1
        if candidate <= now:
            month += 1
            if month > 12:
                month = 1
                year += 1
            candidate = candidate.replace(year=year, month=month, day=dom)
        return candidate

    raise ValueError(f"Frecuencia no soportada: {frequency}")


def create_schedule(target: str, options: dict, frequency: str, hour: int, minute: int,
                     day_of_week: Optional[int] = None, day_of_month: Optional[int] = None) -> dict:
    if frequency not in _VALID_FREQUENCIES:
        raise ValueError(f"Frecuencia inválida: {frequency}. Use: {sorted(_VALID_FREQUENCIES)}")

    schedule_id = str(uuid.uuid4())
    next_run = _compute_next_run(frequency, hour, minute, day_of_week, day_of_month)

    record = {
        'id':            schedule_id,
        'target':        target,
        'options':       json.dumps(options or {}),
        'frequency':     frequency,
        'hour':          hour,
        'minute':        minute,
        'day_of_week':   day_of_week if day_of_week is not None else '',
        'day_of_month':  day_of_month if day_of_month is not None else '',
        'active':        '1',
        'created_at':    datetime.utcnow().isoformat() + 'Z',
        'last_run_at':   '',
        'last_job_id':   '',
        'next_run_at':   next_run.isoformat() + 'Z',
    }

    r = _redis()
    r.hset(_key(schedule_id), mapping=record)
    r.sadd(_SCHEDULE_INDEX_KEY, schedule_id)
    logger.info("Programación creada %s para %s (%s)", schedule_id, target, frequency)
    return _deserialize(record)


def _deserialize(record: dict) -> dict:
    out = dict(record)
    out['options']  = json.loads(record.get('options') or '{}')
    out['active']   = record.get('active') == '1'
    out['hour']     = int(record['hour'])
    out['minute']   = int(record['minute'])
    out['day_of_week']  = int(record['day_of_week']) if record.get('day_of_week') not in (None, '') else None
    out['day_of_month'] = int(record['day_of_month']) if record.get('day_of_month') not in (None, '') else None
    return out


def get_schedule(schedule_id: str) -> Optional[dict]:
    r = _redis()
    record = r.hgetall(_key(schedule_id))
    if not record:
        return None
    return _deserialize(record)


def list_schedules() -> list:
    r = _redis()
    ids = r.smembers(_SCHEDULE_INDEX_KEY)
    out = []
    for sid in ids:
        s = get_schedule(sid)
        if s:
            out.append(s)
    return sorted(out, key=lambda s: s.get('created_at', ''))


def set_active(schedule_id: str, active: bool) -> Optional[dict]:
    r = _redis()
    if not r.exists(_key(schedule_id)):
        return None
    r.hset(_key(schedule_id), 'active', '1' if active else '0')
    return get_schedule(schedule_id)


def delete_schedule(schedule_id: str) -> bool:
    r = _redis()
    deleted = r.delete(_key(schedule_id))
    r.srem(_SCHEDULE_INDEX_KEY, schedule_id)
    return bool(deleted)


def run_due_schedules() -> int:
    """
    Revisa todas las programaciones activas y lanza un Job normal
    (app._launch_scan_job) para las que ya vencieron. Llamada por
    tasks.check_scheduled_scans cada SCHEDULER_POLL_SECONDS.

    Devuelve cuántas programaciones se ejecutaron en esta pasada.
    """
    import app as securescan_app

    now = datetime.utcnow()
    executed = 0

    for schedule in list_schedules():
        if not schedule['active']:
            continue
        next_run_at = schedule.get('next_run_at')
        if not next_run_at:
            continue
        try:
            next_run_dt = datetime.fromisoformat(next_run_at.replace('Z', ''))
        except ValueError:
            logger.warning("next_run_at inválido en schedule %s: %s", schedule['id'], next_run_at)
            continue

        if next_run_dt > now:
            continue

        try:
            job_id, _body, _status = securescan_app._launch_scan_job(
                target=schedule['target'],
                options=schedule['options'],
                created_by='scheduler',
            )
            logger.info("Schedule %s disparó job %s", schedule['id'], job_id)
        except Exception as e:
            logger.error("Fallo al ejecutar schedule %s: %s", schedule['id'], e)
            job_id = ''

        new_next_run = _compute_next_run(
            schedule['frequency'], schedule['hour'], schedule['minute'],
            schedule['day_of_week'], schedule['day_of_month'], after=now,
        )
        r = _redis()
        r.hset(_key(schedule['id']), mapping={
            'last_run_at': now.isoformat() + 'Z',
            'last_job_id': job_id,
            'next_run_at': new_next_run.isoformat() + 'Z',
        })
        executed += 1

    return executed
