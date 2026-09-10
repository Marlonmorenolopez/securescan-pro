"""
Source Fetcher
Obtiene el código a analizar de forma segura -- ya sea clonando un repo
de GitHub o extrayendo un archivo ZIP subido -- para el motor de
análisis de código ("Análisis de Código", Grupo 3).

Este módulo es el punto de entrada de datos NO CONFIABLES (una URL o un
archivo que manda el usuario), así que las protecciones acá importan
tanto como el análisis en sí:

  - Repos: solo se aceptan URLs https:// de hosts de git conocidos
    (GitHub, GitLab, Bitbucket), con forma de "usuario/repo" -- esto
    evita esquemas de git peligrosos (ext::, file://) y SSRF hacia
    infraestructura interna. El clone se ejecuta con subprocess usando
    una lista de argumentos (nunca shell=True) y "--" antes de la URL,
    para que una URL maliciosa no pueda inyectarse como flag de git.

  - ZIPs: se valida el conteo de archivos y el tamaño descomprimido
    ANTES de extraer (protección contra zip-bombs), y cada ruta interna
    se resuelve y se confirma que quede dentro del directorio destino
    antes de escribir nada (protección contra "zip-slip" / path
    traversal vía "../" en nombres de archivo dentro del ZIP).
"""

import logging
import re
import subprocess
import zipfile
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_ALLOWED_GIT_HOSTS = {'github.com', 'gitlab.com', 'bitbucket.org'}
_REPO_PATH_RE = re.compile(r'^/[\w.\-]+/[\w.\-]+?(\.git)?/?$')

_MAX_ZIP_FILES = 5000
_MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024  # 200 MB
_MAX_SINGLE_FILE_SIZE  = 50 * 1024 * 1024   # 50 MB -- una zip-bomb clásica es 1 archivo enorme


def validate_repo_url(url: str) -> Optional[str]:
    """Devuelve un mensaje de error si la URL no es válida/segura, o None si está OK."""
    if not url or not isinstance(url, str):
        return 'URL vacía'
    try:
        parsed = urlparse(url)
    except Exception:
        return 'URL inválida'
    if parsed.scheme != 'https':
        return 'Solo se aceptan URLs https:// (por seguridad, no se permiten otros esquemas de git)'
    if parsed.hostname not in _ALLOWED_GIT_HOSTS:
        return f'Solo se aceptan repos de: {", ".join(sorted(_ALLOWED_GIT_HOSTS))}'
    if not _REPO_PATH_RE.match(parsed.path):
        return 'La URL no tiene forma de repositorio (esperado: https://github.com/usuario/repo)'
    return None


def clone_repo(url: str, dest: str, timeout: int = 180) -> Tuple[bool, Optional[str]]:
    """
    Clona un repo público de forma segura (con TODO el historial de
    commits -- sin shell, con "--" antes de la URL para evitar
    inyección de argumentos).

    Nota: antes clonaba con --depth 1 (solo el último commit). Se quitó
    a propósito -- Gitleaks y TruffleHog escanean el historial completo
    para encontrar secretos que se subieron y después se borraron (su
    diferencial real frente a un scanner que solo mira el código actual,
    confirmado con una prueba real). El costo es que repos grandes
    tardan más en clonar -- de ahí el timeout más generoso que antes
    (180s en vez de 60s). Para repos muy grandes puede seguir sin
    alcanzar; se puede subir vía SCAN_TIMEOUT_CLONE.

    Returns:
        (éxito, mensaje_de_error_o_None)
    """
    error = validate_repo_url(url)
    if error:
        return False, error

    try:
        result = subprocess.run(
            ['git', 'clone', '--single-branch', '--', url, dest],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return False, f'Timeout clonando el repositorio (más de {timeout}s) -- probablemente es un repo grande, se puede subir el timeout con SCAN_TIMEOUT_CLONE'
    except FileNotFoundError:
        return False, 'git no está instalado en el servidor'
    except Exception as e:
        return False, f'Error inesperado clonando: {e}'

    if result.returncode != 0:
        logger.warning("clone_repo: git clone falló para %s — %s", url, result.stderr[:300])
        return False, f'git clone falló: {result.stderr.strip()[:300]}'

    return True, None


def extract_zip_safe(zip_path: str, dest: str) -> Tuple[bool, Optional[str]]:
    """
    Extrae un ZIP validando contra zip-bombs (demasiados archivos o
    tamaño descomprimido excesivo) y zip-slip (rutas que escapan del
    directorio destino vía "../").

    Returns:
        (éxito, mensaje_de_error_o_None)
    """
    dest_path = Path(dest).resolve()
    dest_path.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path) as zf:
            infos = zf.infolist()

            if len(infos) > _MAX_ZIP_FILES:
                return False, f'El ZIP tiene demasiados archivos ({len(infos)} > {_MAX_ZIP_FILES})'

            total_size = 0
            for info in infos:
                if info.file_size > _MAX_SINGLE_FILE_SIZE:
                    return False, f'"{info.filename}" descomprime a más de {_MAX_SINGLE_FILE_SIZE // (1024*1024)}MB — rechazado por seguridad'
                total_size += info.file_size
                if total_size > _MAX_UNCOMPRESSED_SIZE:
                    return False, f'El contenido descomprimido supera el límite de {_MAX_UNCOMPRESSED_SIZE // (1024*1024)}MB'

            # zip-slip: resolver cada ruta ANTES de extraer nada, y confirmar
            # que sigue dentro de dest_path.
            for info in infos:
                target = (dest_path / info.filename).resolve()
                if dest_path not in target.parents and target != dest_path:
                    return False, f'Ruta sospechosa dentro del ZIP (posible path traversal): {info.filename}'

            zf.extractall(dest_path)

    except zipfile.BadZipFile:
        return False, 'El archivo no es un ZIP válido'
    except OSError as e:
        return False, f'Error extrayendo el ZIP: {e}'

    return True, None
