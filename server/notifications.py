"""
Notificaciones de Jobs (SecureScan Pro).

Eventos: job.completed, job.failed, job.cancelled.
Canales: EMAIL (SMTP) y WEBHOOK (HTTP POST).

Se dispara desde app.py (save_scan(), al detectar una transición a un
estado terminal) en un hilo daemon de "fire and forget" -- exactamente el
mismo patrón que ya usa el proyecto para el hilo de Huella Digital -- así
que NO bloquea la escritura del resultado del Job ni el hilo/tarea que
lo generó.

Configuración 100% por variables de entorno (nunca hardcodeada):

  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_USE_TLS
  NOTIFY_EMAIL_TO           (destinatario por defecto; se puede
                             sobreescribir por Job vía
                             options.notifications.email_to)
  WEBHOOK_URL               (destino por defecto; también se puede
                             sobreescribir por Job vía
                             options.notifications.webhook_url)
  WEBHOOK_TIMEOUT_SECONDS   (default 5)
  WEBHOOK_MAX_RETRIES       (default 2)
"""

import os
import ipaddress
import json
import logging
import smtplib
import socket
import threading
import time
from email.mime.text import MIMEText
from typing import Optional
from urllib.parse import urlparse

import findings as findings_module

logger = logging.getLogger('securescan.notifications')

# ── Email ────────────────────────────────────────────────────────────────────
SMTP_HOST     = os.environ.get('SMTP_HOST', '')
SMTP_PORT     = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER     = os.environ.get('SMTP_USER', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SMTP_FROM     = os.environ.get('SMTP_FROM', SMTP_USER)
SMTP_USE_TLS  = os.environ.get('SMTP_USE_TLS', 'true').lower() == 'true'
NOTIFY_EMAIL_TO_DEFAULT = os.environ.get('NOTIFY_EMAIL_TO', '')

# ── Webhook ──────────────────────────────────────────────────────────────────
WEBHOOK_URL_DEFAULT   = os.environ.get('WEBHOOK_URL', '')
WEBHOOK_TIMEOUT       = float(os.environ.get('WEBHOOK_TIMEOUT_SECONDS', '5'))
WEBHOOK_MAX_RETRIES   = int(os.environ.get('WEBHOOK_MAX_RETRIES', '2'))
WEBHOOK_BACKOFF_BASE  = float(os.environ.get('WEBHOOK_BACKOFF_BASE_SECONDS', '1.5'))

_BLOCKED_HOSTNAMES = {'localhost', 'metadata.google.internal'}
_METADATA_IPS = {'169.254.169.254'}  # AWS/GCP/Azure metadata endpoint


def _is_blocked_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # no se pudo parsear -> bloquear por seguridad
    if ip_str in _METADATA_IPS:
        return True
    return (
        ip.is_private or ip.is_loopback or ip.is_link_local or
        ip.is_reserved or ip.is_multicast or ip.is_unspecified
    )


def _validate_webhook_url(url: str) -> Optional[str]:
    """Devuelve un mensaje de error si la URL no es segura para SSRF, o None si es válida."""
    if not url:
        return 'URL vacía'
    try:
        parsed = urlparse(url)
    except Exception:
        return 'URL inválida'

    if parsed.scheme not in ('http', 'https'):
        return f'Esquema no permitido: {parsed.scheme}'

    hostname = parsed.hostname
    if not hostname:
        return 'No se pudo determinar el host'
    if hostname.lower() in _BLOCKED_HOSTNAMES:
        return f'Host bloqueado: {hostname}'

    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return f'No se pudo resolver el host: {hostname}'

    for info in infos:
        ip_str = info[4][0]
        if _is_blocked_ip(ip_str):
            return f'IP no permitida para webhooks: {ip_str} (rango privado/loopback/metadata)'

    return None


def _send_webhook(url: str, payload: dict) -> None:
    import requests  # import perezoso -- ya es dependencia del proyecto

    error = _validate_webhook_url(url)
    if error:
        logger.warning("Webhook rechazado (SSRF guard): %s — %s", url, error)
        return

    body = json.dumps(payload, default=str)
    attempt = 0
    while attempt <= WEBHOOK_MAX_RETRIES:
        try:
            resp = requests.post(
                url,
                data=body,
                headers={'Content-Type': 'application/json', 'User-Agent': 'SecureScanPro-Webhook/1.0'},
                timeout=WEBHOOK_TIMEOUT,
                allow_redirects=False,  # evita redirecciones hacia destinos no validados
            )
            if resp.status_code in (301, 302, 303, 307, 308):
                logger.warning("Webhook a %s devolvió redirect (%s) — no se sigue por seguridad.", url, resp.status_code)
                return
            if resp.ok:
                logger.info("Webhook entregado a %s (status=%s)", url, resp.status_code)
                return
            logger.warning("Webhook a %s respondió %s (intento %d/%d)", url, resp.status_code, attempt + 1, WEBHOOK_MAX_RETRIES + 1)
        except Exception as e:
            logger.warning("Error enviando webhook a %s (intento %d/%d): %s", url, attempt + 1, WEBHOOK_MAX_RETRIES + 1, e)

        attempt += 1
        if attempt <= WEBHOOK_MAX_RETRIES:
            time.sleep(WEBHOOK_BACKOFF_BASE * (2 ** (attempt - 1)))


def _send_email(to_addr: str, subject: str, body: str) -> None:
    if not SMTP_HOST or not to_addr:
        return
    try:
        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = subject
        msg['From']    = SMTP_FROM or 'securescan-pro@localhost'
        msg['To']      = to_addr

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(msg['From'], [to_addr], msg.as_string())
        logger.info("Email de notificación enviado a %s", to_addr)
    except Exception as e:
        logger.warning("Error enviando email de notificación a %s: %s", to_addr, e)


# ── Configuración runtime (Redis) ────────────────────────────────────────────
# Complementa las variables de entorno: SMTP_HOST/WEBHOOK_URL de arriba son
# los valores por defecto de INFRAESTRUCTURA (dónde vive el SMTP, etc, nunca
# secretos gestionables desde el frontend). Lo que SÍ se puede activar/editar
# desde la UI (Settings) es: destinatario de email, URL de webhook, qué
# canales están activos y qué eventos disparan cada uno -- eso vive en Redis
# bajo 'settings:notifications', gestionado por app.py
# (/api/settings/notifications) y leído acá en cada dispatch.

_SETTINGS_KEY = 'settings:notifications'

_DEFAULT_SETTINGS = {
    'email_enabled':   bool(NOTIFY_EMAIL_TO_DEFAULT),
    'email_to':        NOTIFY_EMAIL_TO_DEFAULT,
    'webhook_enabled': bool(WEBHOOK_URL_DEFAULT),
    'webhook_url':     WEBHOOK_URL_DEFAULT,
    'events': {'job_completed': True, 'job_failed': True, 'job_cancelled': True},
    # FIX (auditoría): antes se notificaba SIEMPRE que un Job terminara,
    # sin importar si encontró algo grave o si el scan salió completamente
    # limpio -- con volumen real (schedules corriendo a diario) eso es
    # ruido puro. 'info' = notificar siempre (comportamiento anterior,
    # default para no romper nada). Solo aplica a 'job.completed' -- fallos
    # y cancelaciones de Job siempre avisan, no son sobre severidad de
    # hallazgos sino sobre salud del propio Job.
    'min_severity': 'info',
}

_SEVERITY_ORDER = {'info': 0, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4}


def get_settings(redis_client=None) -> dict:
    """Devuelve la configuración runtime, con fallback a los defaults de entorno."""
    if redis_client is not None:
        try:
            raw = redis_client.get(_SETTINGS_KEY)
            if raw:
                stored = json.loads(raw)
                merged = dict(_DEFAULT_SETTINGS)
                merged.update({k: v for k, v in stored.items() if k != 'events'})
                merged['events'] = {**_DEFAULT_SETTINGS['events'], **stored.get('events', {})}
                return merged
        except Exception as e:
            logger.warning("No se pudo leer settings:notifications (%s), usando defaults.", e)
    return dict(_DEFAULT_SETTINGS)


def save_settings(redis_client, settings: dict) -> dict:
    min_severity = (settings.get('min_severity') or 'info').strip().lower()
    if min_severity not in _SEVERITY_ORDER:
        raise ValueError(f"min_severity inválida: {min_severity}. Use: {sorted(_SEVERITY_ORDER)}")

    clean = {
        'email_enabled':   bool(settings.get('email_enabled')),
        'email_to':        (settings.get('email_to') or '').strip(),
        'webhook_enabled': bool(settings.get('webhook_enabled')),
        'webhook_url':     (settings.get('webhook_url') or '').strip(),
        'min_severity':    min_severity,
        'events': {
            'job_completed': bool((settings.get('events') or {}).get('job_completed', True)),
            'job_failed':    bool((settings.get('events') or {}).get('job_failed', True)),
            'job_cancelled': bool((settings.get('events') or {}).get('job_cancelled', True)),
        },
    }
    if clean['webhook_enabled'] and clean['webhook_url']:
        error = _validate_webhook_url(clean['webhook_url'])
        if error:
            raise ValueError(f"URL de webhook inválida: {error}")
    redis_client.set(_SETTINGS_KEY, json.dumps(clean))
    return clean


def _build_payload(event: str, scan: dict) -> dict:
    return {
        'event':     event,
        'jobId':     scan.get('id'),
        'scanType':  scan.get('scan_type', 'web'),
        'target':    scan.get('target') or scan.get('source') or scan.get('domain') or scan.get('username') or scan.get('email'),
        'status':    scan.get('status'),
        'startTime': scan.get('startTime'),
        'endTime':   scan.get('endTime'),
        'error':     scan.get('error'),
    }


def _dispatch_sync(event: str, scan: dict) -> None:
    payload = _build_payload(event, scan)
    options = scan.get('options') if isinstance(scan.get('options'), dict) else {}
    notif_cfg = options.get('notifications', {}) if isinstance(options, dict) else {}
    if not isinstance(notif_cfg, dict):
        notif_cfg = {}

    settings = get_settings(_redis_client_ref[0])
    event_key = {'job.completed': 'job_completed', 'job.failed': 'job_failed', 'job.cancelled': 'job_cancelled'}[event]
    if not settings['events'].get(event_key, True):
        logger.info("Evento %s deshabilitado en settings:notifications — no se envía nada.", event)
        return

    # Umbral de severidad: solo aplica a 'job.completed' -- un job.failed/
    # cancelled es sobre la salud del propio Job, no sobre qué tan grave
    # fue lo que encontró, así que siempre se avisa igual.
    if event == 'job.completed':
        min_sev = settings.get('min_severity', 'info')
        try:
            findings = findings_module.normalize_findings(scan)
            max_sev_rank = max(
                (_SEVERITY_ORDER.get((f.get('severity') or 'info'), 0) for f in findings),
                default=0,
            )
        except Exception as e:
            logger.warning("No se pudo calcular severidad máxima para %s (%s) — se notifica igual.", scan.get('id'), e)
            max_sev_rank = 999  # ante la duda, no silenciar la notificación
        if max_sev_rank < _SEVERITY_ORDER.get(min_sev, 0):
            logger.info(
                "Job %s completado por debajo del umbral de severidad (%s) — no se notifica.",
                scan.get('id'), min_sev,
            )
            return

    email_to = notif_cfg.get('email_to') or (settings['email_to'] if settings['email_enabled'] else '') or NOTIFY_EMAIL_TO_DEFAULT
    if email_to:
        subject = f"SecureScan Pro — {event} ({payload['target']})"
        body = (
            f"Evento: {event}\n"
            f"Job ID: {payload['jobId']}\n"
            f"Tipo: {payload['scanType']}\n"
            f"Objetivo: {payload['target']}\n"
            f"Estado: {payload['status']}\n"
            f"Inicio: {payload['startTime']}\n"
            f"Fin: {payload['endTime']}\n"
            + (f"Error: {payload['error']}\n" if payload.get('error') else "")
        )
        _send_email(email_to, subject, body)

    webhook_url = notif_cfg.get('webhook_url') or (settings['webhook_url'] if settings['webhook_enabled'] else '') or WEBHOOK_URL_DEFAULT
    if webhook_url:
        _send_webhook(webhook_url, payload)


# Referencia mutable al redis_client de app.py, inyectada por app.py al
# arrancar (ver app.py: notifications.set_redis_client(redis_client)).
# Se usa una lista de 1 elemento como "caja" para poder mutarla desde afuera
# sin necesitar 'global' ni un import circular a nivel de módulo.
_redis_client_ref = [None]


def set_redis_client(redis_client) -> None:
    _redis_client_ref[0] = redis_client


def _has_any_channel_configured(scan: dict) -> bool:
    if SMTP_HOST or WEBHOOK_URL_DEFAULT:
        return True
    options = scan.get('options') if isinstance(scan.get('options'), dict) else {}
    notif_cfg = options.get('notifications') if isinstance(options, dict) else None
    if notif_cfg:
        return True
    settings = get_settings(_redis_client_ref[0])
    return bool(
        (settings['email_enabled'] and settings['email_to']) or
        (settings['webhook_enabled'] and settings['webhook_url'])
    )


def dispatch(event: str, scan: dict) -> None:
    """
    Punto de entrada usado por app.py. No bloquea: lanza un hilo daemon
    de fire-and-forget (igual patrón que el hilo de Huella Digital en
    run_scan) y retorna inmediatamente.
    """
    if event not in ('job.completed', 'job.failed', 'job.cancelled'):
        logger.warning("Evento de notificación desconocido: %s", event)
        return
    if not _has_any_channel_configured(scan):
        return
    threading.Thread(target=_dispatch_sync, args=(event, scan), daemon=True).start()
