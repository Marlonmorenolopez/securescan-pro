"""
Searchsploit Module (ExploitDB CLI oficial)
Búsqueda de exploits localmente desde la base de datos ExploitDB — reemplaza exploitdb.py

Searchsploit es el CLI oficial de ExploitDB y viene preinstalado en Kali/Parrot.
Usa el repositorio local clonado de https://gitlab.com/exploit-database/exploitdb

Diferencias respecto al módulo anterior:
  - Usa directamente `searchsploit --json` (más limpio y robusto)
  - Incluye el path local del exploit para poder copiarlo
  - Enriquece los resultados con el tipo de exploit (local/remote/webapps/dos)
  - Detecta automáticamente la ruta del repositorio ExploitDB

CORRECCIÓN #15: todos los dicts de _simulate_search() incluyen 'simulated': True.
"""

import subprocess
import json
import logging
import re
import shutil
import os
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

_EXPLOITDB_PATHS = [
    '/opt/exploitdb',
    '/usr/share/exploitdb',
    os.path.expanduser('~/.local/share/exploitdb'),
]

_SKIP_TERMS = {
    'country', 'ip', 'title', 'html5', 'script', 'httponly', 'cookies',
    'redirectlocation', 'x-powered-by', 'x-frame-options', 'httpserver',
    'passwordfield', 'emailfield', 'uncommonheaders', 'bootstrap',
    'jquery', 'google-analytics', 'font-awesome',
    'java', 'python', 'ruby', 'javascript', 'typescript', 'css',
    'html', 'xml', 'json', 'http', 'https', 'tcp', 'udp', 'ssl', 'tls',
    'unix', 'linux', 'windows', 'macos',
    'debian', 'ubuntu', 'centos', 'redhat', 'fedora',
    'meta-generator', 'via-proxy', 'dvwa', 'email',
}


class SearchsploitSearcher:
    """Searchsploit wrapper — búsqueda local de exploits en ExploitDB."""

    def __init__(self, timeout: int = 30, max_results: int = 50):
        self.command = 'searchsploit'
        self.timeout = timeout
        self.max_results = max_results
        self._available = self._check_availability()
        self._db_path = self._find_db_path()

    def _check_availability(self) -> bool:
        if not shutil.which(self.command):
            logger.warning("searchsploit not found in PATH. Will use simulation mode.")
            return False
        return True

    def _find_db_path(self) -> Optional[str]:
        for path in _EXPLOITDB_PATHS:
            if os.path.isdir(path):
                logger.info("ExploitDB found at: %s", path)
                return path
        return None

    def _clean_terms(self, terms: List[str]) -> List[str]:
        """Sanitiza y deduplica términos de búsqueda."""
        seen = set()
        clean = []
        for t in terms:
            if not t:
                continue
            t = t.strip()
            t = re.sub(r'[;&|`$<>]', '', t)
            if len(t) < 2 or len(t) > 60:
                continue
            if t.lower() in _SKIP_TERMS:
                continue
            key = t.lower()
            if key not in seen:
                seen.add(key)
                clean.append(t)
        return clean

    def _search_term(self, term: str) -> List[Dict[str, Any]]:
        """Ejecuta searchsploit para un término y retorna resultados."""
        env = os.environ.copy()
        if self._db_path:
            env['EXPLOITDB_PATH'] = self._db_path

        cmd = [self.command, '--json', '--disable-colour', term]
        try:
            # CORRECCIÓN SIGPIPE: usar Popen + communicate() con timeout
            # subprocess.run deja vivo al proceso hijo en timeout → SIGPIPE → mata worker
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
            )
            try:
                stdout, _ = proc.communicate(timeout=self.timeout)
            except subprocess.TimeoutExpired:
                proc.kill()          # Mata el hijo explícitamente
                proc.communicate()   # Drena los pipes para evitar SIGPIPE
                logger.warning("searchsploit timeout for term '%s' — process killed cleanly", term)
                return []

            if proc.returncode not in (0, 1) or not stdout.strip():
                return []

            data = json.loads(stdout)
            exploits_raw = data.get('RESULTS_EXPLOIT', []) + data.get('RESULTS_SHELLCODE', [])
            exploits = []
            severity_map = {
                'remote': 'high',
                'webapps': 'high',
                'local': 'medium',
                'dos': 'medium',
                'shellcode': 'critical',
            }
            for item in exploits_raw:
                eid = str(item.get('EDB-ID', item.get('id', '')))
                title = item.get('Title', item.get('title', ''))
                date = item.get('Date', item.get('date', ''))
                author = item.get('Author', item.get('author', ''))
                exploit_type = item.get('Type', item.get('type', ''))
                platform = item.get('Platform', item.get('platform', ''))
                path = item.get('Path', item.get('path', ''))
                severity = severity_map.get(exploit_type.lower().strip(), 'medium')
                exploits.append({
                    'id': eid,
                    'title': title,
                    'date': date,
                    'author': author,
                    'type': exploit_type,
                    'platform': platform,
                    'path': path,
                    'severity': severity,
                    'url': f'https://www.exploit-db.com/exploits/{eid}',
                    'matchedTerm': term,
                    'tool': 'searchsploit',
                    'simulated': False,
                })
            return exploits

        except (json.JSONDecodeError, subprocess.TimeoutExpired, Exception) as e:
            logger.warning("searchsploit error for '%s': %s", term, e)
            return []

    def _simulate_search(
        self,
        terms: List[str],
        technologies: Optional[List[Dict]] = None,
        ports: Optional[List[Dict]] = None,
    ) -> List[Dict[str, Any]]:
        """Resultados simulados por tecnologías/puertos comunes."""
        tech_names = [t.get('name', '').lower() for t in (technologies or [])]
        port_services = [p.get('service', '').lower() for p in (ports or [])]
        all_context = tech_names + port_services
        results = []

        if any('apache' in c or 'tomcat' in c for c in all_context):
            results.append({
                'id': '51829', 'title': 'Apache Tomcat 9.0.x - AJP Request Injection (CVE-2020-1938)',
                'date': '2020-03-10', 'author': 'RedTeam', 'type': 'remote', 'platform': 'java',
                'path': '/opt/exploitdb/exploits/java/remote/51829.py', 'severity': 'critical',
                'url': 'https://www.exploit-db.com/exploits/51829',
                'matchedTerm': 'Apache Tomcat', 'tool': 'searchsploit', 'simulated': True,
            })
        if any('php' in c for c in all_context):
            results.append({
                'id': '49425', 'title': 'PHP 8.1.0-dev - Backdoor RCE',
                'date': '2021-04-10', 'author': 'flast101', 'type': 'remote', 'platform': 'php',
                'path': '/opt/exploitdb/exploits/php/remote/49425.py', 'severity': 'critical',
                'url': 'https://www.exploit-db.com/exploits/49425',
                'matchedTerm': 'PHP', 'tool': 'searchsploit', 'simulated': True,
            })
        if any('mysql' in c or 'mariadb' in c for c in all_context):
            results.append({
                'id': '47507', 'title': 'MySQL 5.7 - Remote Code Execution',
                'date': '2019-12-10', 'author': 'SecureLayer7', 'type': 'remote', 'platform': 'linux',
                'path': '/opt/exploitdb/exploits/linux/remote/47507.py', 'severity': 'high',
                'url': 'https://www.exploit-db.com/exploits/47507',
                'matchedTerm': 'MySQL', 'tool': 'searchsploit', 'simulated': True,
            })
        if any('node' in c or 'express' in c for c in all_context):
            results.append({
                'id': '50403', 'title': 'Node.js path-to-regexp - ReDoS',
                'date': '2022-01-10', 'author': 'Blaine Garrett', 'type': 'dos', 'platform': 'nodejs',
                'path': '/opt/exploitdb/exploits/nodejs/dos/50403.js', 'severity': 'medium',
                'url': 'https://www.exploit-db.com/exploits/50403',
                'matchedTerm': 'Node.js', 'tool': 'searchsploit', 'simulated': True,
            })
        if any('spring' in c or 'java' in c for c in all_context):
            results.append({
                'id': '50708', 'title': 'Spring Framework 5.3.17 - Remote Code Execution (Log4Shell)',
                'date': '2022-01-04', 'author': 'SunSec', 'type': 'remote', 'platform': 'java',
                'path': '/opt/exploitdb/exploits/java/remote/50708.py', 'severity': 'critical',
                'url': 'https://www.exploit-db.com/exploits/50708',
                'matchedTerm': 'Spring Framework', 'tool': 'searchsploit', 'simulated': True,
            })

        if not results:
            results.append({
                'id': '0', 'title': 'Sin exploits específicos encontrados (simulación)',
                'date': '', 'author': '', 'type': 'info', 'platform': '',
                'path': '', 'severity': 'info',
                'url': 'https://www.exploit-db.com',
                'matchedTerm': ', '.join(terms[:3]) if terms else 'unknown',
                'tool': 'searchsploit', 'simulated': True,
            })

        return results

    def search(
        self,
        terms: List[str],
        technologies: Optional[List[Dict]] = None,
        ports: Optional[List[Dict]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Busca exploits en ExploitDB para los términos dados.

        Args:
            terms       : Lista de términos (nombres de tecnologías y servicios)
            technologies: Lista de tecnologías detectadas por Wappalyzer
            ports       : Lista de puertos detectados por Nmap

        Returns:
            Lista de exploits encontrados, ordenados por severidad
        """
        clean = self._clean_terms(terms)
        if not clean:
            return []

        if not self._available:
            return self._simulate_search(clean, technologies, ports)

        all_exploits = []
        seen_ids: set = set()

        for term in clean[:10]:  # Máximo 10 búsquedas
            exploits = self._search_term(term)
            for e in exploits:
                if e['id'] and e['id'] not in seen_ids:
                    seen_ids.add(e['id'])
                    all_exploits.append(e)

        if not all_exploits:
            logger.info("No results from searchsploit, using simulation.")
            return self._simulate_search(clean, technologies, ports)

        sev_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4}
        all_exploits.sort(key=lambda x: (sev_order.get(x.get('severity', 'info'), 4), x.get('date', '')))

        logger.info("searchsploit found %d exploits", len(all_exploits))
        return all_exploits[:self.max_results]
