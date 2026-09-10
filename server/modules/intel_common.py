"""
Helpers compartidos por los 6 módulos del grupo "Huella Digital" (Threat
Intel): virustotal.py, abuseipdb.py, shodan.py, crtsh.py, testssl.py,
dnstwist.py.

Antes cada módulo tenía su propia copia de extract_host/is_ip/is_internal
-- factorizado acá para que un cambio se haga en un solo lugar. De paso
corrige un bug real que tenía la versión duplicada: detectaba IP privada
comparando contra una lista de prefijos de texto ('172.16.', '172.17.',
'172.18.') que NO cubría todo el rango RFC 1918 172.16.0.0/12 -- una IP
como 172.20.5.10 (perfectamente privada) se colaba como si fuera pública,
y las herramientas le habrían pegado a VirusTotal/AbuseIPDB/Shodan con
una IP interna real, sin sentido. Acá se usa el módulo `ipaddress` de la
librería estándar, que conoce los rangos privados completos sin
necesidad de mantenerlos a mano.
"""

import ipaddress
import logging
import socket
from typing import Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


def extract_host(target: str) -> Optional[str]:
    """Extrae el hostname/IP del target, con o sin esquema."""
    if not target or not isinstance(target, str):
        return None
    candidate = target if '://' in target else f'http://{target}'
    try:
        return urlparse(candidate).hostname
    except Exception as e:
        logger.warning("intel_common: no se pudo parsear target %s (%s)", target, e)
        return None


def extract_port(target: str, default: int = 443) -> int:
    """Extrae el puerto explícito del target, o `default` si no hay uno."""
    candidate = target if '://' in target else f'http://{target}'
    try:
        parsed = urlparse(candidate)
        if parsed.port:
            return parsed.port
    except Exception:
        pass
    return default


def is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def is_internal(host: str) -> bool:
    """
    True si no tiene sentido consultar este host contra bases de datos
    públicas externas: IP privada/loopback/link-local (RFC 1918 completo,
    vía `ipaddress`), localhost, o dominio .local (mDNS).
    """
    if host in ('localhost',):
        return True
    if host.endswith('.local'):
        return True
    try:
        addr = ipaddress.ip_address(host)
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except ValueError:
        return False  # no es una IP -- es un dominio, no aplica este chequeo


def resolve_ip(host: str) -> Optional[str]:
    """Resuelve un hostname a su IP. Si `host` ya es una IP, la devuelve tal cual."""
    if is_ip(host):
        return host
    try:
        return socket.gethostbyname(host)
    except socket.gaierror as e:
        logger.warning("intel_common: no se pudo resolver %s — %s", host, e)
        return None


def reverse_dns(ip: str, timeout: float = 3.0) -> Optional[str]:
    """
    Busca el hostname asociado a una IP vía registro PTR (DNS reverso).

    Sirve para que herramientas que solo tienen sentido para dominios
    (crt.sh, dnstwist) puedan aportar algo cuando el target es una IP
    pública sin dominio conocido de antemano -- típico en un entorno de
    desarrollo/staging que todavía no tiene DNS apuntando a él.

    Devuelve None si no hay PTR record -- es MUY común (la mayoría de
    las IPs no tienen uno configurado), no se trata como error.
    """
    try:
        socket.setdefaulttimeout(timeout)
        hostname, _, _ = socket.gethostbyaddr(ip)
        return hostname
    except (socket.herror, socket.gaierror, socket.timeout, OSError):
        return None
    finally:
        socket.setdefaulttimeout(None)
