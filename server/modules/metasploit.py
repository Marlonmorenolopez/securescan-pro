"""
Metasploit Module — SecureScan Pro v3.0
Selección inteligente de módulos via Console RPC.
"""
import logging, re, time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

try:
    from pymetasploit3.msfrpc import MsfRpcClient
    _HAS_MSFRPC = True
except ImportError:
    _HAS_MSFRPC = False

MetasploitFinding = Dict[str, Any]

_BASE_WEB: List[Tuple] = [
    ("auxiliary/scanner/http/http_version", {"THREADS": 5}, "info",   30),
    ("auxiliary/scanner/http/options",      {"THREADS": 5}, "medium", 30),
    ("auxiliary/scanner/http/dir_listing",  {"THREADS": 5}, "medium", 45),
    ("auxiliary/scanner/http/robots_txt",   {},              "info",   30),
]

_SSL: List[Tuple] = [
    ("auxiliary/scanner/ssl/openssl_heartbleed", {"THREADS": 5}, "critical", 60),
    ("auxiliary/scanner/ssl/ssl_version",        {"THREADS": 5}, "info",     30),
]

_CRITICAL_CHECKS: List[Tuple] = [
    ("auxiliary/scanner/http/shellshock",        {"THREADS": 5}, "critical", 60),
    ("auxiliary/scanner/http/ms15_034_http_sys_memory_dump", {"THREADS": 5}, "critical", 45),
]

_BY_TECH: Dict[str, List[Tuple]] = {
    "apache tomcat": [
        ("auxiliary/scanner/http/tomcat_mgr_login", {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120),
        ("auxiliary/scanner/http/tomcat_enum",       {"THREADS": 3}, "high", 60),
    ],
    "apache": [
        ("auxiliary/scanner/http/apache_optionsbleed", {"THREADS": 3}, "high", 60),
    ],
    "php": [
        ("auxiliary/scanner/http/php_cgi_arg_injection", {"THREADS": 3}, "critical", 60),
        ("auxiliary/scanner/http/phpinfo",               {"THREADS": 5}, "medium",   30),
    ],
    "wordpress": [
        ("auxiliary/scanner/http/wordpress_login_enum",   {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120),
        ("auxiliary/scanner/http/wordpress_xmlrpc_login", {"THREADS": 3, "STOP_ON_SUCCESS": True}, "high",     120),
    ],
    "joomla": [
        ("auxiliary/scanner/http/joomla_version",          {}, "info", 30),
        ("auxiliary/scanner/http/joomla_bruteforce_login", {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120),
    ],
    "jenkins": [
        ("auxiliary/scanner/http/jenkins_enum",  {}, "high", 60),
        ("auxiliary/scanner/http/jenkins_login", {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120),
    ],
    "phpmyadmin": [
        ("auxiliary/scanner/http/phpmyadmin_login", {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120),
    ],
    "iis": [
        ("auxiliary/scanner/http/iis_internal_ip",  {}, "medium", 30),
        ("auxiliary/scanner/http/webdav_scanner",   {"THREADS": 5}, "medium", 60),
    ],
    "drupal": [
        ("auxiliary/scanner/http/drupal_views_user_enum", {"THREADS": 3}, "medium", 60),
    ],
    "spring": [
        ("auxiliary/scanner/http/springboot_actuator", {}, "high", 60),
    ],
    "node.js": [
        ("auxiliary/scanner/http/http_header",         {"THREADS": 5}, "info",   30),
        ("auxiliary/scanner/http/options",             {"THREADS": 5}, "medium", 30),
        ("auxiliary/scanner/http/dir_listing",         {"THREADS": 5}, "medium", 45),
    ],
    "express": [
        ("auxiliary/scanner/http/http_header",         {"THREADS": 5}, "info",   30),
        ("auxiliary/scanner/http/options",             {"THREADS": 5}, "medium", 30),
    ],
    "angular": [
        ("auxiliary/scanner/http/cors_origin",         {"THREADS": 5}, "medium", 30),
        ("auxiliary/scanner/http/http_header",         {"THREADS": 5}, "info",   30),
    ],
}

_BY_PORT: Dict[str, List[Tuple]] = {
    "21":    [("auxiliary/scanner/ftp/ftp_version",    {"THREADS": 5}, "info",     30),
              ("auxiliary/scanner/ftp/anonymous",       {"THREADS": 5}, "high",     45),
              ("auxiliary/scanner/ftp/ftp_login",       {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120)],
    "22":    [("auxiliary/scanner/ssh/ssh_version",    {"THREADS": 5}, "info",     30),
              ("auxiliary/scanner/ssh/ssh_enumusers",  {"THREADS": 3}, "medium",   60)],
    "23":    [("auxiliary/scanner/telnet/telnet_version", {"THREADS": 5}, "info",  30),
              ("auxiliary/scanner/telnet/telnet_login",   {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120)],
    "25":    [("auxiliary/scanner/smtp/smtp_version",  {"THREADS": 5}, "info",     30),
              ("auxiliary/scanner/smtp/smtp_enum",     {"THREADS": 5}, "medium",   60)],
    "139":   [("auxiliary/scanner/smb/smb_version",   {"THREADS": 5}, "info",     30),
              ("auxiliary/scanner/smb/smb_ms17_010",  {"THREADS": 5}, "critical", 60)],
    "445":   [("auxiliary/scanner/smb/smb_version",   {"THREADS": 5}, "info",     30),
              ("auxiliary/scanner/smb/smb_ms17_010",  {"THREADS": 5}, "critical", 60),
              ("auxiliary/scanner/smb/smb_enumshares",{"THREADS": 5}, "medium",   60)],
    "3306":  [("auxiliary/scanner/mysql/mysql_version",{"THREADS": 5}, "info",    30),
              ("auxiliary/scanner/mysql/mysql_login",  {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120)],
    "5432":  [("auxiliary/scanner/postgres/postgres_version", {"THREADS": 5}, "info", 30),
              ("auxiliary/scanner/postgres/postgres_login",   {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120)],
    "1433":  [("auxiliary/scanner/mssql/mssql_ping",  {"THREADS": 5}, "info",     30),
              ("auxiliary/scanner/mssql/mssql_login", {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120)],
    "27017": [("auxiliary/scanner/mongodb/mongodb_login", {"THREADS": 3}, "critical", 120)],
    "6379":  [("auxiliary/scanner/redis/redis_server", {}, "high", 30),
              ("auxiliary/scanner/redis/redis_login",  {"THREADS": 3}, "critical", 120)],
    "5900":  [("auxiliary/scanner/vnc/vnc_none_auth",  {"THREADS": 5}, "critical", 45),
              ("auxiliary/scanner/vnc/vnc_login",      {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120)],
    "3389":  [("auxiliary/scanner/rdp/rdp_scanner",   {"THREADS": 5}, "info",     30),
              ("auxiliary/scanner/rdp/ms12_020_check",{"THREADS": 5}, "high",     45)],
    "161":   [("auxiliary/scanner/snmp/snmp_version", {"THREADS": 5}, "info",     30),
              ("auxiliary/scanner/snmp/snmp_login",   {"THREADS": 5}, "medium",   60)],
    "8080":  [("auxiliary/scanner/http/tomcat_mgr_login", {"THREADS": 3, "STOP_ON_SUCCESS": True}, "critical", 120),
              ("auxiliary/scanner/http/jenkins_enum",     {}, "high", 60)],
    "8443":  [("auxiliary/scanner/ssl/openssl_heartbleed", {"THREADS": 5}, "critical", 60)],
    "9200":  [("auxiliary/scanner/elasticsearch/indices_enum", {}, "high", 45)],
    "2375":  [("auxiliary/scanner/http/docker_version", {}, "critical", 30)],
    "3000":  [("auxiliary/scanner/http/http_version",   {"THREADS": 5}, "info",   30),
              ("auxiliary/scanner/http/options",         {"THREADS": 5}, "medium", 30),
              ("auxiliary/scanner/http/http_header",     {"THREADS": 5}, "info",   30)],
    "3001":  [("auxiliary/scanner/http/http_version",   {"THREADS": 5}, "info",   30),
              ("auxiliary/scanner/http/options",         {"THREADS": 5}, "medium", 30)],
}

_POSITIVE_PATTERNS: List[Tuple[str, str]] = [
    (r'\[\+\]\s*(.+)',                           "high"),
    (r'\[!\]\s*(.+)',                            "critical"),
    (r'VULNERABLE[:\s]+(.+)',                    "critical"),
    (r'Login Successful[:\s]+(.+)',              "critical"),
    (r'No Auth(?:entication)?[:\s]+(.+)',        "critical"),
    (r'Anonymous(?:\s+Login)?[:\s]+(.+)',        "high"),
    (r'(?i)found\s+(?:valid|working)[:\s]+(.+)', "high"),
]

_SEVERITY_CVSS = {"critical": 9.8, "high": 7.5, "medium": 5.0, "low": 3.0, "info": 0.0}


class MetasploitScanner:

    def __init__(self, host="127.0.0.1", port=55553, password="msf", ssl=False, timeout=120):
        self.host     = host
        self.port     = port
        self.password = password
        self.ssl      = ssl
        self.timeout  = timeout
        self._client: Optional[Any] = None
        self._simulation = not _HAS_MSFRPC
        if not self._simulation and not self._connect():
            self._simulation = True

    def _try_reconnect(self) -> bool:
        """Reintenta conexión si estaba en simulación por inicio tardío de msfrpcd."""
        if not _HAS_MSFRPC:
            return False
        if self._connect():
            self._simulation = False
            logger.info("Reconexión exitosa a msfrpcd %s:%s", self.host, self.port)
            return True
        return False

    def _connect(self) -> bool:
        try:
            self._client = MsfRpcClient(self.password, server=self.host, port=self.port, ssl=self.ssl, timeout=self.timeout)
            # Verificar conexión sin llamar como función
            _ = self._client.core.version
            logger.info("Connected to msfrpcd at %s:%s", self.host, self.port)
            return True
        except Exception as exc:
            logger.warning("Cannot connect to msfrpcd: %s", exc)
            return False

    def _ensure_connection(self) -> bool:
        if self._client is None:
            return self._connect()
        try:
            _ = self._client.core.version
            return True
        except Exception:
            self._client = None
            return self._connect()

    def is_connected(self) -> bool:
        """Verifica si hay conexión activa con msfrpcd"""
        if self._simulation:
            return False
        return self._ensure_connection()

    def scan(self, target, ports=None, technologies=None):
        if self._simulation:
            self._try_reconnect()
        if self._simulation:
            return self._simulate_scan(target)
        if not self._ensure_connection():
            return self._simulate_scan(target)
        return self._real_scan(target, ports or [], technologies or [])

    def _select_modules(self, ports, technologies, target=""):
        open_ports = {str(p.get("port", "")) for p in ports if p.get("state") == "open"}
        tech_names = {t.get("name", "").lower() for t in technologies}
        has_ssl    = bool({"443", "8443"} & open_ports)
        _web_ports = {
            "80", "443", "8080", "8443", "8000", "8888",
            "3000", "3001", "4000", "4848", "5000",
            "9000", "9090", "9200", "9443",
            "7001", "7002", "7070", "7080",
            "10000", "10443",
        }
        # Agregar dinámicamente el puerto de la URL del target
        try:
            from urllib.parse import urlparse as _up
            _parsed = _up(target if "://" in target else f"http://{target}")
            if _parsed.port:
                _web_ports.add(str(_parsed.port))
        except Exception:
            pass
        is_web = bool(_web_ports & open_ports) or not open_ports
        selected, seen = [], set()

        def add(mods):
            for m in mods:
                if m[0] not in seen:
                    seen.add(m[0]); selected.append(m)

        if is_web:
            add(_BASE_WEB); add(_CRITICAL_CHECKS)
        if has_ssl:
            add(_SSL)
        for tech_key, mods in _BY_TECH.items():
            if any(tech_key in t for t in tech_names):
                add(mods)
        for port_str, mods in _BY_PORT.items():
            if port_str in open_ports:
                add(mods)
        # Limitar a 6 módulos para evitar timeout
        selected = selected[:6]
        logger.info("MSF modules selected: %d", len(selected))
        return selected

    def _real_scan(self, target, ports, technologies):
        parsed = urlparse(target if "://" in target else f"http://{target}")
        rhosts = parsed.hostname or target
        rport  = parsed.port or (443 if parsed.scheme == "https" else 80)
        findings = []
        for mod_path, options, default_sev, mod_timeout in self._select_modules(ports, technologies, target):
            logger.info("MSF → %s on %s:%s", mod_path, rhosts, rport)
            t = max(mod_timeout, self.timeout) if "login" in mod_path else mod_timeout
            output = self._run_via_console(mod_path, rhosts, rport, options, t)
            findings.extend(self._parse_output(output, mod_path, rhosts, rport, default_sev))
        return findings

    def _run_via_console(self, module, rhosts, rport, options, timeout):
        cid = None
        try:
            console = self._client.consoles.console()
            cid     = console.cid
            cmds    = [f"use {module}", f"set RHOSTS {rhosts}", f"set RPORT {rport}", "set VERBOSE false"]
            for k, v in options.items():
                cmds.append(f"set {k} {v}")
            cmds.append("run -z")
            self._client.consoles.console(cid).write("\n".join(cmds) + "\n")
            output, deadline, idle = "", time.time() + timeout, 0
            while time.time() < deadline:
                time.sleep(2)
                data   = self._client.consoles.console(cid).read()
                output += data.get("data", "")
                idle    = 0 if data.get("busy", True) else idle + 1
                if idle >= 3: break
            return output
        except Exception as exc:
            logger.error("Console RPC error for %s: %s", module, exc)
            return ""
        finally:
            if cid:
                try: self._client.consoles.destroy(cid)
                except Exception: pass

    def _parse_output(self, output, module, host, port, default_sev):
        mod_name = module.split("/")[-1].replace("_", " ").title()
        findings, found = [], False
        for pattern, severity in _POSITIVE_PATTERNS:
            for match in re.finditer(pattern, output, re.IGNORECASE | re.MULTILINE):
                text = match.group(1).strip()[:150]
                if len(text) > 3:
                    findings.append(self._make(f"MSF {mod_name} — {text}", severity, f"Host: {host} | Port: {port}/tcp | {text}", module, host, port))
                    found = True
        if not found:
            info_lines = re.findall(r'\[\*\]\s*(.+)', output)
            summary    = info_lines[-1].strip()[:150] if info_lines else "Module completed — no issues found"
            findings.append(self._make(f"MSF {mod_name}", default_sev, f"Host: {host} | Port: {port}/tcp | {summary}", module, host, port))
        return findings

    def _make(self, title, severity, description, module, host, port):
        return {"title": title, "severity": severity, "cvss": _SEVERITY_CVSS.get(severity, 0.0),
                "description": description, "module": module, "host": host, "port": port,
                "protocol": "tcp", "source": "metasploit", "simulated": False}

    def _simulate_scan(self, target):
        logger.info("MetasploitScanner simulation for %s", target)
        return [self._make("MSF Http Version", "info",
                f"Host: {target} | Port: 80/tcp | Simulation mode — msfrpcd not available",
                "auxiliary/scanner/http/http_version", target, 80)]
