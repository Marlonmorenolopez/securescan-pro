"""
SQLMap Enterprise Scanner Module
================================
Detección y explotación avanzada de SQL Injection con arquitectura empresarial.

Características:
- Integración nativa con sqlmapapi (REST API) para salida estructurada JSON
- Evasión de WAF/IPS mediante tamper scripts dinámicos y ofuscación avanzada
- Autentificación completa (NTLM, Basic, JWT, Bearer, cookies personalizadas)
- Tuning de rendimiento: threads, keep-alive, optimización de inyecciones ciegas
- Post-explotación controlada: enumeración selectiva de DB, usuarios, privilegios
"""

import subprocess
import json
import logging
import shutil
import os
import re
import tempfile
import time
import sqlite3
import requests
from typing import List, Dict, Any, Optional, Union, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum, auto
from urllib.parse import urlparse, urljoin
from pathlib import Path
from contextlib import contextmanager
import threading

logger = logging.getLogger(__name__)


class Severity(Enum):
    """Niveles de severidad para hallazgos."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class PostExploitLevel(Enum):
    """Niveles de post-explotación permitidos."""
    DETECT_ONLY = auto()      # Solo detección, sin enumeración
    BASIC_ENUM = auto()       # --current-user, --current-db
    FULL_ENUM = auto()        # --dbs, --tables (sin dump)
    DEEP_ENUM = auto()        # Incluye --dump parcial


class AuthType(Enum):
    """Tipos de autenticación soportados."""
    BASIC = "basic"
    DIGEST = "digest"
    NTLM = "ntlm"
    BEARER = "bearer"
    JWT = "jwt"


@dataclass
class SQLMapFinding:
    """Modelo de datos estructurado para hallazgos SQL Injection."""
    name: str
    description: str
    severity: Severity
    url: str
    parameter: Optional[str] = None
    injection_type: Optional[str] = None
    dbms: Optional[str] = None
    payload: Optional[str] = None
    title: Optional[str] = None
    place: Optional[str] = None  # GET, POST, Cookie, etc.
    os: Optional[str] = None
    is_dba: Optional[bool] = None
    current_user: Optional[str] = None
    current_db: Optional[str] = None
    databases: List[str] = field(default_factory=list)
    tables: Dict[str, List[str]] = field(default_factory=dict)
    tool: str = "sqlmap"
    task_id: Optional[str] = None
    scan_time: float = field(default_factory=time.time)
    
    def to_dict(self) -> Dict[str, Any]:
        """Serializa a diccionario con enums como strings."""
        data = asdict(self)
        data['severity'] = self.severity.value if isinstance(self.severity, Severity) else self.severity

        # Aliases para compatibilidad con el frontend
        data['params']          = [self.parameter] if self.parameter else []
        data['injection_types'] = [self.injection_type] if self.injection_type else []

        return data


@dataclass
class WAFProfile:
    """Perfil de evasión WAF preconfigurado."""
    name: str
    tamper_scripts: List[str]
    description: str
    techniques: Optional[str] = None  # B(oolean), E(rror), T(ime), U(nion), S(tacked)
    
    def get_tamper_string(self) -> str:
        return ",".join(self.tamper_scripts)


# Perfiles WAF predefinidos basados en investigación de evasión
WAF_PROFILES = {
    "cloudflare": WAFProfile(
        name="Cloudflare",
        tamper_scripts=["space2comment", "chardoubleencode", "randomcomments"],
        description="Evasión para Cloudflare WAF",
        techniques="BEUT"
    ),
    "aws_waf": WAFProfile(
        name="AWS WAF",
        tamper_scripts=["space2randomblank", "unionalltounion", "randomcase"],
        description="Evasión para AWS WAF",
        techniques="BEUT"
    ),
    "modsecurity": WAFProfile(
        name="ModSecurity",
        tamper_scripts=["space2comment", "charencode", "modsecurityversioned"],
        description="Evasión para ModSecurity CRS",
        techniques="BEUTS"
    ),
    "akamai": WAFProfile(
        name="Akamai",
        tamper_scripts=["space2comment", "apostrophemask", "randomcomments"],
        description="Evasión para Akamai Kona Site Defender",
        techniques="BETU"
    ),
    "aggressive": WAFProfile(
        name="Aggressive",
        tamper_scripts=["space2comment", "charencode", "charunicodeencode", "randomcase", "unionalltounion"],
        description="Cadena agresiva de ofuscación múltiple",
        techniques="BEUTS"
    ),
    "stealth": WAFProfile(
        name="Stealth",
        tamper_scripts=["space2mysqldash", "randomcomments"],
        description="Evasión ligera para detectar WAFs desconocidos",
        techniques="B"
    )
}


class SQLMapAPIClient:
        
    def __init__(self, host: str = "127.0.0.1", port: int = 8775,
                 username: Optional[str] = None, password: Optional[str] = None):
        import os
        # Usa la variable de entorno si existe, si no usa host/port
        self.base_url = os.getenv("SQLMAP_API_URL", f"http://{host}:{port}")
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

        if username and password:
            self.session.auth = (username, password)

        self._admin_id: Optional[str] = None
        self._lock = threading.Lock()
    
    def start_server(self, adapter: str = "wsgiref") -> subprocess.Popen:
        """
        Inicia el servidor sqlmapapi en un proceso separado.
        
        Returns:
            Proceso del servidor para gestión de ciclo de vida.
        """
        cmd = [
            "sqlmapapi.py",
            "-s",
            "-H", "127.0.0.1",
            "-p", "8775",
            "--adapter", adapter
        ]
        
        logger.info("Starting sqlmapapi server on %s", self.base_url)
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Esperar a que el servidor esté listo
        time.sleep(2)
        
        # Verificar conectividad
        for attempt in range(10):
            try:
                resp = self.session.get(f"{self.base_url}/task/new", timeout=5)
                if resp.status_code == 200:
                    logger.info("sqlmapapi server is ready")
                    return process
            except requests.exceptions.ConnectionError:
                time.sleep(1)
        
        raise RuntimeError("Failed to start sqlmapapi server")
    
    def create_task(self) -> str:
        """Crea una nueva tarea de escaneo y retorna el task_id."""
        try:
            resp = self.session.get(f"{self.base_url}/task/new", timeout=30)
            resp.raise_for_status()
            data = resp.json()
            
            if data.get("success"):
                task_id = data.get("taskid")
                logger.debug("Created sqlmap task: %s", task_id)
                return task_id
            else:
                raise RuntimeError(f"Failed to create task: {data}")
        except requests.exceptions.RequestException as e:
            logger.error("Error creating sqlmap task: %s", e)
            raise
    
    def delete_task(self, task_id: str) -> bool:
        """Elimina una tarea del servidor."""
        try:
            resp = self.session.get(f"{self.base_url}/task/{task_id}/delete", timeout=10)
            return resp.json().get("success", False)
        except Exception as e:
            logger.warning("Error deleting task %s: %s", task_id, e)
            return False
    
    def start_scan(self, task_id: str, options: Dict[str, Any]) -> bool:
        """
        Inicia el escaneo con las opciones especificadas.
        
        Args:
            task_id: ID de la tarea
            options: Diccionario de opciones de sqlmap (equivalente a argumentos CLI)
        """
        try:
            resp = self.session.post(
                f"{self.base_url}/scan/{task_id}/start",
                json=options,
                timeout=30
            )
            resp.raise_for_status()
            data = resp.json()
            
            if data.get("success"):
                logger.info("Started scan for task %s", task_id)
                return True
            else:
                logger.error("Failed to start scan: %s", data.get("message"))
                return False
        except requests.exceptions.RequestException as e:
            logger.error("Error starting scan: %s", e)
            return False
    
    def get_status(self, task_id: str) -> Dict[str, Any]:
        """Obtiene el estado actual del escaneo."""
        try:
            resp = self.session.get(f"{self.base_url}/scan/{task_id}/status", timeout=10)
            return resp.json()
        except Exception as e:
            logger.error("Error getting status for task %s: %s", task_id, e)
            return {"status": "error", "message": str(e)}
    
    def get_log(self, task_id: str) -> List[Dict[str, Any]]:
        """Obtiene el log del escaneo."""
        try:
            resp = self.session.get(f"{self.base_url}/scan/{task_id}/log", timeout=10)
            data = resp.json()
            return data.get("log", [])
        except Exception as e:
            logger.error("Error getting log for task %s: %s", task_id, e)
            return []
    
    def get_data(self, task_id: str) -> Dict[str, Any]:
        """
        Obtiene los datos estructurados del escaneo.
        Incluye injection points, DBMS, banners, etc.
        """
        try:
            resp = self.session.get(f"{self.base_url}/scan/{task_id}/data", timeout=10)
            return resp.json()
        except Exception as e:
            logger.error("Error getting data for task %s: %s", task_id, e)
            return {}
    
    def wait_for_completion(self, task_id: str, poll_interval: int = 2, 
                           timeout: int = 300) -> Dict[str, Any]:
        """
        Espera a que el escaneo termine y retorna los resultados.
        
        Args:
            task_id: ID de la tarea
            poll_interval: Segundos entre polls
            timeout: Timeout total en segundos
        
        Returns:
            Datos completos del escaneo
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            status = self.get_status(task_id)
            state = status.get("status")
            
            if state == "terminated":
                logger.info("Task %s completed", task_id)
                time.sleep(2) 
                return self.get_data(task_id)
            elif state == "error":
                logger.error("Task %s failed", task_id)
                return self.get_data(task_id)
            
            time.sleep(poll_interval)
        
        logger.warning("Task %s timed out", task_id)
        self.stop_scan(task_id)
        return self.get_data(task_id)
    
    def stop_scan(self, task_id: str) -> bool:
        """Detiene un escaneo en ejecución."""
        try:
            resp = self.session.get(f"{self.base_url}/scan/{task_id}/stop", timeout=10)
            return resp.json().get("success", False)
        except Exception as e:
            logger.error("Error stopping scan: %s", e)
            return False
    
    def list_tampers(self) -> List[str]:
        """
        Lista los tamper scripts disponibles en el sistema.
        Útil para validar perfiles WAF antes del escaneo.
        """
        # Los tampers se obtienen ejecutando sqlmap --list-tampers
        try:
            result = subprocess.run(
                ["sqlmap", "--list-tampers"],
                capture_output=True,
                text=True,
                timeout=30
            )
            # Parsear salida para extraer nombres de scripts
            tampers = []
            for line in result.stdout.splitlines():
                match = re.match(r"^\* (\w+)\.py", line.strip())
                if match:
                    tampers.append(match.group(1))
            return tampers
        except Exception as e:
            logger.warning("Could not list tamper scripts: %s", e)
            return list(WAF_PROFILES.keys())


class SQLMapEnterpriseScanner:
    """
    Scanner SQL Injection de grado empresarial con capacidades avanzadas.
    
    Features:
    - API REST nativa para resultados estructurados
    - Evasión WAF/IPS con tamper scripts
    - Autenticación completa (NTLM, Basic, JWT, Cookies)
    - Optimización de rendimiento (threads, keep-alive)
    - Post-explotación controlada
    """
    
    DEFAULT_TIMEOUT = 300
    DEFAULT_THREADS = 4
    API_PORT = 8775
    
    def __init__(
        self,
        timeout: int = DEFAULT_TIMEOUT,
        level: int = 2,
        risk: int = 2,
        threads: int = DEFAULT_THREADS,
        time_sec: int = 5,
        use_api: bool = True,
        api_host: str = None,
        api_port: int = API_PORT
    ):
        """
        Inicializa el scanner empresarial.
        
        Args:
            timeout: Timeout global en segundos
            level: Nivel de pruebas (1-5)
            risk: Riesgo de payloads (1-3)
            threads: Número de threads concurrentes
            time_sec: Segundos para delays en inyecciones ciegas
            use_api: Usar sqlmapapi en lugar de CLI directo
            api_host: Host del servidor sqlmapapi
            api_port: Puerto del servidor sqlmapapi
        """
        self.timeout = timeout
        self.level = level
        self.risk = risk
        self.threads = threads
        self.time_sec = time_sec
        self.use_api = use_api
        self.api_host = api_host or os.getenv("SQLMAP_API_HOST", "sqlmapapi")
        self.api_port = int(os.getenv("SQLMAP_API_PORT", api_port))
        
        self._api_client: Optional[SQLMapAPIClient] = None
        self._api_process: Optional[subprocess.Popen] = None
        self._available = self._check_sqlmap_availability()
        
        if self.use_api:
            # Inicializa el cliente API inmediatamente
             self._api_client = SQLMapAPIClient(self.api_host, self.api_port)

        # Configuración de autenticación
        self._auth_config: Dict[str, Any] = {}
        self._headers: Dict[str, str] = {}
        self._proxy: Optional[str] = None
        
        # Configuración WAF
        self._waf_profile: Optional[WAFProfile] = None
        self._custom_tampers: List[str] = []
        
        # Configuración de post-explotación
        self._post_exploit_level = PostExploitLevel.DETECT_ONLY
        
        logger.info("SQLMapEnterpriseScanner initialized (API mode: %s)", use_api)
    
    def _check_sqlmap_availability(self) -> bool:
        """Verifica que sqlmap y sqlmapapi estén disponibles."""
        sqlmap_ok = shutil.which("sqlmap") is not None
        # Buscar sqlmapapi con y sin extensión .py
        api_ok = bool(shutil.which("sqlmapapi.py") or shutil.which("sqlmapapi"))
        
        if not sqlmap_ok:
            logger.error("sqlmap not found in PATH")
        if not api_ok:
            logger.warning("sqlmapapi.py not found, falling back to CLI mode")
            self.use_api = False
        
        return sqlmap_ok
    
    def __enter__(self):
        """Context manager para iniciar API server si es necesario."""
        if self.use_api and self._available:
            try:
                self._api_client = SQLMapAPIClient(self.api_host, self.api_port)
                # Intentar conectar a servidor existente primero
                try:
                    self._api_client.create_task()
                    logger.info("Connected to existing sqlmapapi server")
                except requests.exceptions.ConnectionError:
                    # Iniciar servidor propio
                    self._api_process = self._api_client.start_server()
            except Exception as e:
                logger.warning("Failed to initialize API mode: %s. Falling back to CLI.", e)
                self.use_api = False
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Limpieza de recursos."""
        if self._api_client:
            # Aquí podríamos limpiar tareas pendientes
            pass
        
        if self._api_process:
            logger.info("Terminating sqlmapapi server")
            self._api_process.terminate()
            try:
                self._api_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._api_process.kill()
    
    def set_authentication(
        self,
        auth_type: AuthType,
        credentials: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        domain: Optional[str] = None
    ) -> 'SQLMapEnterpriseScanner':
        """
        Configura autenticación HTTP.
        
        Args:
            auth_type: Tipo de autenticación (BASIC, DIGEST, NTLM, BEARER, JWT)
            credentials: String "user:pass" para Basic/Digest/NTLM
            username: Usuario (alternativo a credentials)
            password: Contraseña (alternativo a credentials)
            domain: Dominio para NTLM
        """
        if credentials:
            username, password = credentials.split(":", 1)
        
        self._auth_config = {
            "type": auth_type,
            "username": username,
            "password": password,
            "domain": domain
        }
        
        # Para Bearer/JWT, se maneja como header personalizado
        if auth_type in (AuthType.BEARER, AuthType.JWT) and credentials:
            self._headers["Authorization"] = f"Bearer {credentials}"
        
        return self
    
    def set_headers(self, headers: Union[Dict[str, str], str]) -> 'SQLMapEnterpriseScanner':
        """
        Configura cabeceras HTTP personalizadas.
        
        Args:
            headers: Diccionario o string con formato "Header: Value\nHeader2: Value2"
        """
        if isinstance(headers, str):
            for line in headers.strip().split("\n"):
                if ":" in line:
                    key, value = line.split(":", 1)
                    self._headers[key.strip()] = value.strip()
        else:
            self._headers.update(headers)
        
        return self
    
    def set_proxy(self, proxy_url: str) -> 'SQLMapEnterpriseScanner':
        """
        Configura proxy HTTP/HTTPS para el tráfico.
        
        Args:
            proxy_url: URL del proxy (ej: http://127.0.0.1:8080)
        """
        self._proxy = proxy_url
        return self
    
    def set_waf_evasion(
        self, 
        profile: Optional[str] = None,
        custom_tampers: Optional[List[str]] = None,
        identify_waf: bool = False
    ) -> 'SQLMapEnterpriseScanner':
        """
        Configura evasión de WAF/IPS.
        
        Args:
            profile: Nombre del perfil predefinido (cloudflare, aws_waf, etc.)
            custom_tampers: Lista de scripts tamper personalizados
            identify_waf: Intentar identificar el WAF antes del escaneo
        """
        if profile and profile in WAF_PROFILES:
            self._waf_profile = WAF_PROFILES[profile]
            logger.info("WAF evasion profile loaded: %s", profile)
        
        if custom_tampers:
            self._custom_tampers = custom_tampers
        
        self._identify_waf = identify_waf
        return self
    
    def set_post_exploitation(self, level: PostExploitLevel) -> 'SQLMapEnterpriseScanner':
        """
        Configura nivel de post-explotación.
        
        Args:
            level: Nivel de enumeración post-detección
        """
        self._post_exploit_level = level
        return self
    
    def _build_base_options(self) -> Dict[str, Any]:
        """Construye opciones base para sqlmap."""
        options = {
            "batch": True,
            "level": self.level,
            "risk": self.risk,
            "threads": self.threads,
            "timeout": 15,
            "retries": 2,
            "randomAgent": True,
            "timeSec": self.time_sec,
        }
        
        # Autenticación HTTP (Basic, Digest, NTLM)
        if self._auth_config.get("type") in (AuthType.BASIC, AuthType.DIGEST, AuthType.NTLM):
            auth_type = self._auth_config["type"].value
            options["authType"] = auth_type
            user = self._auth_config.get("username", "")
            passwd = self._auth_config.get("password", "")
            options["authCred"] = f"{user}:{passwd}"
        
        # Cabeceras personalizadas
        if self._headers:
            headers_str = "\n".join([f"{k}: {v}" for k, v in self._headers.items()])
            options["headers"] = headers_str
        
        # Proxy
        if self._proxy:
            options["proxy"] = self._proxy
        
        # WAF Evasion
        tampers = []
        if self._waf_profile:
            tampers.extend(self._waf_profile.tamper_scripts)
        tampers.extend(self._custom_tampers)
        
        if tampers:
            options["tamper"] = ",".join(tampers)
        
        if getattr(self, '_identify_waf', False):
            options["identifyWaf"] = True
        
        return options
    
    def _add_post_exploit_options(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """Añade opciones de post-explotación según el nivel configurado."""
        level = self._post_exploit_level
        
        if level == PostExploitLevel.DETECT_ONLY:
            # Solo detección, sin enumeración adicional
            pass
        elif level == PostExploitLevel.BASIC_ENUM:
            options["currentUser"] = True
            options["currentDb"] = True
            options["isDba"] = True
        elif level == PostExploitLevel.FULL_ENUM:
            options["currentUser"] = True
            options["currentDb"] = True
            options["isDba"] = True
            options["getDbs"] = True
            options["getTables"] = True
        elif level == PostExploitLevel.DEEP_ENUM:
            options["currentUser"] = True
            options["currentDb"] = True
            options["isDba"] = True
            options["getDbs"] = True
            options["dump"] = True
            options["dumpTable"] = True
        
        return options
    
    def _parse_api_data(self, data: Dict[str, Any], target: str, task_id: str) -> List[SQLMapFinding]:
        findings = []
        
        if not data.get("success"):
            logger.warning("Scan did not complete successfully: %s", data.get("error", "Unknown error"))
            return findings
        
        injection_data = data.get("data", [])
        
        if not injection_data:
            findings.append(SQLMapFinding(
                name="Sin SQL Injection detectada",
                description=f"SQLMap analizó {target} sin encontrar parámetros vulnerables.",
                severity=Severity.INFO,
                url=target,
                task_id=task_id
            ))
            return findings
        
        for item in injection_data:
            if item.get("status") == 1 and item.get("type") == 1:
                value = item.get("value", [])
                
                # FIX: value viene como string de Python, no como JSON
                # usar ast.literal_eval para convertirlo a lista
                if isinstance(value, str):
                    try:
                        import ast
                        value = ast.literal_eval(value)
                    except Exception as e:
                        logger.warning("Error parseando value de SQLMap: %s", e)
                        continue
                
                if not isinstance(value, list):
                    continue
                    
                for injection in value:
                    finding = self._create_finding_from_injection(injection, target, task_id, data)
                    findings.append(finding)
        
        return findings
        
        # Procesar cada punto de inyección
        for item in injection_data:
            # type=1 son los injection points, type=0 es info de URL
            if item.get("status") == 1 and item.get("type") == 1:
                value = item.get("value", [])
                if not isinstance(value, list):
                    continue
                for injection in value:
                    finding = self._create_finding_from_injection(injection, target, task_id, data)
                    findings.append(finding)
        
        return findings
    
    def _create_finding_from_injection(
        self, 
        injection: Dict[str, Any], 
        target: str, 
        task_id: str,
        full_data: Dict[str, Any]
    ) -> SQLMapFinding:
        """Crea un objeto Finding desde datos de inyección de la API."""
        parameter = injection.get("parameter", "unknown")
        place = injection.get("place", "unknown")  # GET, POST, etc.
        dbms = injection.get("dbms", None)
        os_info = injection.get("os", None)
        # Extraer tipos de inyección del campo data
        data_field = injection.get("data", {})
        injection_types = []
        titles = []
        payloads = []
        if isinstance(data_field, dict):
            for k, v in data_field.items():
                if isinstance(v, dict):
                    if v.get("title"):
                        titles.append(v["title"])
                    if v.get("payload"):
                        payloads.append(v["payload"])
            injection_types = list(data_field.keys())
        injection_type = ", ".join(titles) if titles else "unknown"
        title = titles[0] if titles else "SQL Injection"
        payload = payloads[0] if payloads else ""
        
        # Extraer información del DBMS si está disponible
        dbms = None
        os_info = None
        for item in full_data.get("data", []):
            if item.get("type") == 1:  # Tipo banner/DBMS
                value = item.get("value", {})
                if isinstance(value, dict):
                    dbms = value.get("dbms")
                    os_info = value.get("os")
        
        # Datos de post-explotación
        current_user = None
        current_db = None
        is_dba = None
        databases = []
        
        for item in full_data.get("data", []):
            value = item.get("value", {})
            if not isinstance(value, dict):
                continue
            if "user" in value:
                current_user = value["user"]
            if "db" in value:
                current_db = value["db"]
            if "is_dba" in value:
                is_dba = value["is_dba"]
            if "databases" in value:
                databases = value["databases"]
        
        severity = Severity.CRITICAL if is_dba else Severity.HIGH
        
        description = (
            f"SQLMap detectó SQL Injection en el parámetro '{parameter}' "
            f"mediante {injection_type}. "
            f"Ubicación: {place}. "
        )
        
        if dbms:
            description += f"DBMS identificado: {dbms}. "
        if current_user:
            description += f"Usuario actual: {current_user}. "
        if is_dba:
            description += "El usuario tiene privilegios DBA. "
        
        return SQLMapFinding(
            name=f"SQL Injection - {parameter} ({place})",
            description=description,
            severity=severity,
            url=target,
            parameter=parameter,
            injection_type=injection_type,
            dbms=dbms,
            payload=payload,
            title=title,
            place=place,
            os=os_info,
            is_dba=is_dba,
            current_user=current_user,
            current_db=current_db,
            databases=databases,
            task_id=task_id
        )
    
    def _scan_api_mode(
        self, 
        target: str, 
        params: Optional[str] = None,
        data: Optional[str] = None,
        cookie: Optional[str] = None
    ) -> List[SQLMapFinding]:
        """
        Ejecuta escaneo utilizando la API REST de SQLMap.
        
        Args:
            target: URL objetivo
            params: Parámetros a testear
            data: Datos POST
            cookie: Cookie de sesión
        """
        if not self._api_client:
            raise RuntimeError("API client not initialized")
        
        # Crear tarea
        task_id = self._api_client.create_task()
        
        try:
            # Construir opciones
            options = self._build_base_options()
            options["url"] = target
            
            if params:
                options["testParameter"] = params
            if data:
                options["data"] = data
            if cookie:
                options["cookie"] = cookie
            
            # Añadir opciones de post-explotación
            options = self._add_post_exploit_options(options)
            
            # Iniciar escaneo
            if not self._api_client.start_scan(task_id, options):
                return []
            
            # Esperar resultados
            scan_data = self._api_client.wait_for_completion(
                task_id, 
                poll_interval=3, 
                timeout=self.timeout
            )
            
            # Parsear resultados estructurados
            return self._parse_api_data(scan_data, target, task_id)
            
        finally:
            # Limpieza
            self._api_client.delete_task(task_id)
    
    def _scan_cli_mode(
        self, 
        target: str, 
        params: Optional[str] = None,
        data: Optional[str] = None,
        cookie: Optional[str] = None
    ) -> List[SQLMapFinding]:
        """
        Fallback a modo CLI con parsing de SQLite/JSON del output-dir.
        Se usa cuando sqlmapapi no está disponible.
        """
        out_dir = tempfile.mkdtemp(prefix='sqlmap_enterprise_', dir='/tmp')
        
        try:
            cmd = self._build_cli_command(target, params, data, cookie, out_dir)
            
            logger.info("Running SQLMap CLI on %s", target)
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout
            )
            
            # Intentar leer resultados de la base de datos SQLite de sqlmap
            findings = self._parse_sqlite_results(out_dir, target)
            
            if not findings:
                # Fallback a parsing de stdout si no hay DB
                findings = self._parse_stdout_fallback(result.stdout, target)
            
            return findings
            
        except subprocess.TimeoutExpired:
            logger.warning("SQLMap timeout on %s", target)
            return [SQLMapFinding(
                name="SQLMap timeout",
                description=f"El escaneo excedió el tiempo límite de {self.timeout}s",
                severity=Severity.INFO,
                url=target
            )]
        except Exception as e:
            logger.error("SQLMap error on %s: %s", target, e)
            return []
        finally:
            shutil.rmtree(out_dir, ignore_errors=True)
    
    def _build_cli_command(
        self,
        target: str,
        params: Optional[str],
        data: Optional[str],
        cookie: Optional[str],
        out_dir: str
    ) -> List[str]:
        """Construye el comando CLI completo."""
        cmd = [
            "sqlmap",
            "-u", target,
            "--batch",
            "--level", str(self.level),
            "--risk", str(self.risk),
            "--output-dir", out_dir,
            "--threads", str(self.threads),
            "--time-sec", str(self.time_sec),
            "--timeout", "30",
            "--retries", "2",
            "--random-agent",
            "--answers", "extending=Y,skip=N,quit=N,keep=Y",
            "--technique", "BEUST",   # todas las tecnicas
            "--dump-format", "JSON",
            "--forms",
            "--crawl", "3",
            "--smart",
            "--ignore-redirects",
        ]
        
        # Autenticación
        if self._auth_config.get("type") in (AuthType.BASIC, AuthType.DIGEST, AuthType.NTLM):
            cmd.extend([
                "--auth-type", self._auth_config["type"].value,
                "--auth-cred", f"{self._auth_config['username']}:{self._auth_config['password']}"
            ])
        
        # Cabeceras
        if self._headers:
            headers_str = "\\n".join([f"{k}: {v}" for k, v in self._headers.items()])
            cmd.extend(["--headers", headers_str])
        
        # Proxy
        if self._proxy:
            cmd.extend(["--proxy", self._proxy])
        
        # WAF Evasion
        tampers = []
        if self._waf_profile:
            tampers.extend(self._waf_profile.tamper_scripts)
        tampers.extend(self._custom_tampers)
        if tampers:
            cmd.extend(["--tamper", ",".join(tampers)])
        
        if getattr(self, '_identify_waf', False):
            cmd.append("--identify-waf")
        
        # Parámetros específicos
        if params:
            cmd.extend(["-p", params])
            for flag in ("--crawl", "--forms", "--smart", "--ignore-redirects"):
                if flag == "--crawl" and flag in cmd:
                    idx = cmd.index(flag)
                    cmd.pop(idx)
                    cmd.pop(idx)
                elif flag in cmd:
                    cmd.remove(flag)
        if data:
            cmd.extend(["--data", data])
            # Con datos POST, anadir content-type si no esta en headers
            if "Content-Type" not in str(self._headers):
                cmd.extend(["--headers", "Content-Type: application/x-www-form-urlencoded"])
        if cookie:
            cmd.extend(["--cookie", cookie])
            cmd.extend(["--cookie-del", ";"])  # separador correcto
            cmd.append("--keep-alive")           # reusar sesion autenticada
        
        # Post-explotación
        if self._post_exploit_level == PostExploitLevel.BASIC_ENUM:
            cmd.extend(["--current-user", "--current-db", "--is-dba"])
        elif self._post_exploit_level == PostExploitLevel.FULL_ENUM:
            cmd.extend(["--current-user", "--current-db", "--is-dba", "--dbs", "--tables"])
        elif self._post_exploit_level == PostExploitLevel.DEEP_ENUM:
            cmd.extend(["--current-user", "--current-db", "--is-dba", "--dbs", "--dump"])
        
        return cmd
    
    def _parse_sqlite_results(self, out_dir: str, target: str) -> List[SQLMapFinding]:
        """
        Parsea resultados de sqlmap desde:
        1. Archivo 'log' de texto (más confiable, siempre existe)
        2. session.sqlite como fallback
        """
        findings = []

        # ── 1. Parsear archivo log de texto (formato estándar de sqlmap) ──────
        log_files = list(Path(out_dir).rglob("log"))
        for log_file in log_files:
            try:
                log_text = log_file.read_text(errors="ignore")
                findings.extend(self._parse_stdout_fallback(log_text, target))
                if findings:
                    logger.info("SQLMap: %d findings desde log file %s", len(findings), log_file)
                    return findings
            except Exception as e:
                logger.debug("Error leyendo log file %s: %s", log_file, e)

        # ── 2. Fallback: session.sqlite ───────────────────────────────────────
        sqlite_files = list(Path(out_dir).rglob("*.sqlite"))
        for db_file in sqlite_files:
            try:
                conn = sqlite3.connect(str(db_file))
                cursor = conn.cursor()

                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]
                logger.debug("SQLite tables en %s: %s", db_file.name, tables)

                # sqlmap moderno usa tabla 'kb' para almacenar resultados serializados
                if "kb" in tables:
                    cursor.execute("SELECT id, name, value FROM kb")
                    for row in cursor.fetchall():
                        name_val = str(row[1])
                        value_val = str(row[2])
                        if any(k in name_val.lower() for k in ("injection", "payload", "parameter")):
                            findings.append(SQLMapFinding(
                                name=f"SQL Injection detectada",
                                description=f"{name_val}: {value_val[:300]}",
                                severity=Severity.CRITICAL,
                                url=target,
                            ))

                # Intentar tabla legacy 'injection_points' (sqlmap < 1.7)
                if not findings and "injection_points" in tables:
                    cursor.execute(
                        "SELECT parameter, place, type, title, payload FROM injection_points"
                    )
                    for row in cursor.fetchall():
                        findings.append(SQLMapFinding(
                            name=f"SQL Injection - {row[0]} ({row[1]})",
                            description=f"Tipo: {row[2]}. Payload: {row[4]}",
                            severity=Severity.CRITICAL,
                            url=target,
                            parameter=row[0],
                            place=row[1],
                            injection_type=row[2],
                            title=row[3],
                            payload=row[4],
                        ))

                conn.close()
            except Exception as e:
                logger.debug("Error parsing SQLite %s: %s", db_file, e)

        return findings
    
    def _parse_stdout_fallback(self, output: str, target: str) -> List[SQLMapFinding]:
        """Parsea stdout/log de sqlmap. Maneja multiples Type/Payload por Parameter."""
        findings = []
        seen = set()

        # Extraer bloque entre --- delimitadores (formato estandar sqlmap)
        # Ejemplo:
        # ---
        # Parameter: q (GET)
        #     Type: boolean-based blind
        #     Title: AND boolean-based blind...
        #     Payload: q=test AND 1=1
        # ---
        blocks = re.findall(r"-{3,}(.*?)-{3,}", output, re.DOTALL)
        content = "\n".join(blocks) if blocks else output

        # Encontrar cada bloque de Parameter
        param_blocks = re.split(r"(?=^Parameter:)", content, flags=re.MULTILINE)

        for block in param_blocks:
            param_m = re.match(r"Parameter:\s+(?P<param>.+)", block.strip())
            if not param_m:
                continue
            param_name = re.sub(r"\s*\(.*?\)", "", param_m.group("param")).strip()

            # Cada triplete Type + Title + Payload dentro del bloque
            triplets = re.findall(
                r"Type:\s+(?P<type>[^\n]+)\n[^\n]*Title:\s+(?P<title>[^\n]+)\n[^\n]*Payload:\s+(?P<payload>[^\n]+)",
                block,
                re.IGNORECASE,
            )

            for inj_type, title, payload in triplets:
                inj_type = inj_type.strip()
                title    = title.strip()
                payload  = payload.strip()
                key = f"{param_name}:{inj_type}"
                if key in seen:
                    continue
                seen.add(key)
                findings.append(SQLMapFinding(
                    name=f"SQL Injection - {param_name} [{inj_type}]",
                    description=f"Parametro: {param_name} | Tipo: {inj_type} | Titulo: {title} | Payload: {payload}",
                    severity=Severity.CRITICAL,
                    url=target,
                    parameter=param_name,
                    injection_type=inj_type,
                    title=title,
                    payload=payload,
                ))

        if not findings and "does not seem to be injectable" in output:
            findings.append(SQLMapFinding(
                name="Sin SQL Injection detectada",
                description="sqlmap no encontro parametros vulnerables",
                severity=Severity.INFO,
                url=target,
            ))

        return findings


    def scan(
        self,
        target: str,
        params: Optional[str] = None,
        data: Optional[str] = None,
        cookie: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Ejecuta el escaneo completo contra el objetivo.
        
        Args:
            target: URL objetivo (http:// o https://)
            params: Parámetros específicos a testear
            data: Datos POST para solicitudes POST
            cookie: Cookie de sesión (string o diccionario)
        
        Returns:
            Lista de hallazgos como diccionarios
        """
        # Validación de target
        if not target or not isinstance(target, str):
            logger.error("Invalid target")
            return []
        
        if not target.startswith(('http://', 'https://')):
            target = f'http://{target}'
        
        try:
            parsed = urlparse(target)
            if not parsed.hostname:
                raise ValueError("Invalid URL format")
        except Exception as e:
            logger.error("URL parsing error: %s", e)
            return []
        
        if not self._available:
            logger.error("SQLMap not available")
            return []
        
        # Ejecutar escaneo según modo
        if self.use_api and self._api_client:
            findings = self._scan_api_mode(target, params, data, cookie)
        else:
            findings = self._scan_cli_mode(target, params, data, cookie)
        
        # Convertir a diccionarios para retorno
        return [f.to_dict() for f in findings]
    
    def get_available_tampers(self) -> List[str]:
        """Retorna lista de tamper scripts disponibles."""
        if self._api_client:
            return self._api_client.list_tampers()
        return []
    
    def test_connection(self, target: str) -> bool:
        """Prueba conectividad básica con el objetivo."""
        try:
            headers = self._headers.copy()
            if self._auth_config.get("type") == AuthType.BEARER:
                headers["Authorization"] = f"Bearer {self._auth_config.get('password', '')}"
            
            resp = requests.get(target, headers=headers, timeout=10, verify=False)
            return resp.status_code < 500
        except Exception as e:
            logger.error("Connection test failed: %s", e)
            return False


# ============================================================================
# FUNCIONES DE CONVENIENCIA Y EJEMPLOS DE USO
# ============================================================================

def create_scanner(
    level: int = 3,
    risk: int = 2,
    threads: int = 8,
    waf_profile: Optional[str] = None,
    post_exploit: PostExploitLevel = PostExploitLevel.BASIC_ENUM
) -> SQLMapEnterpriseScanner:
    """
    Factory function para crear un scanner configurado.
    
    Args:
        level: Nivel de pruebas (1-5, default 3)
        risk: Riesgo (1-3, default 2)
        threads: Threads concurrentes (default 8)
        waf_profile: Perfil WAF (cloudflare, aws_waf, modsecurity, etc.)
        post_exploit: Nivel de post-explotación
    
    Returns:
        Scanner configurado (usar como context manager)
    """
    scanner = SQLMapEnterpriseScanner(
        level=level,
        risk=risk,
        threads=threads,
        use_api=True
    )
    
    if waf_profile:
        scanner.set_waf_evasion(profile=waf_profile)
    
    scanner.set_post_exploitation(post_exploit)
    
    return scanner


# Ejemplo de uso avanzado
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Ejemplo 1: Escaneo básico con evasión de Cloudflare
    with create_scanner(
        level=3,
        risk=2,
        waf_profile="cloudflare",
        post_exploit=PostExploitLevel.BASIC_ENUM
    ) as scanner:
        
        # Configurar autenticación JWT
        scanner.set_authentication(
            auth_type=AuthType.JWT,
            credentials="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        )
        
        # Añadir cabeceras personalizadas
        scanner.set_headers({
            "X-Custom-Header": "value",
            "X-API-Version": "v2"
        })
        
        # Ejecutar escaneo
        results = scanner.scan(
            target="https://example.com/api/users?id=1",
            params="id"
        )
        
        print(json.dumps(results, indent=2, ensure_ascii=False))
    
    # Ejemplo 2: Escaneo con autenticación NTLM (entorno corporativo)
    with SQLMapEnterpriseScanner(
        level=4,
        risk=2,
        threads=4,
        use_api=False  # NTLM a veces funciona mejor en CLI
    ) as scanner:
        
        scanner.set_authentication(
            auth_type=AuthType.NTLM,
            username="DOMAIN\\usuario",
            password="contraseña"
        )
        
        results = scanner.scan("http://intranet.corp.com/app.aspx?view=1")
    
    # Ejemplo 3: Evasión agresiva con múltiples tampers personalizados
    with SQLMapEnterpriseScanner(level=5, risk=3) as scanner:
        scanner.set_waf_evasion(
            custom_tampers=["space2comment", "charencode", "randomcase"],
            identify_waf=True
        )
        scanner.set_proxy("http://127.0.0.1:8080")  # Burp Suite
        
        results = scanner.scan("https://protegido.com/search?q=test")