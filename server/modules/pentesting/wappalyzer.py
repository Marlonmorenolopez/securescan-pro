"""
Wappalyzer Scanner Module
Web technology fingerprinting — reemplaza WhatWeb

Wappalyzer identifica tecnologías web (CMS, frameworks, servidores, etc.)
usando la librería python-Wappalyzer o el CLI wappalyzer-cli.

Estrategia de detección (en orden de prioridad):
  1. python-Wappalyzer (librería Python, sin proceso externo)
  2. wappalyzer-cli (Node.js, requiere npm install -g wappalyzer)
  3. _simulate_scan() con datos por lab cuando ninguno está disponible

CORRECCIÓN #15: todos los dicts de _simulate_scan() incluyen 'simulated': True.
"""

import subprocess
import json
import logging
import shutil
import time
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Intento importar python-Wappalyzer
try:
    from Wappalyzer import Wappalyzer, WebPage
    _WAPPALYZER_LIB = True
except ImportError:
    _WAPPALYZER_LIB = False
    logger.info("python-Wappalyzer no disponible, intentando CLI o simulación.")


class WappalyzerScanner:
    """Wappalyzer wrapper — fingerprinting de tecnologías web."""

    _CATEGORY_MAP = {
        'CMS': 'cms',
        'Ecommerce': 'cms',
        'JavaScript frameworks': 'framework',
        'Web frameworks': 'framework',
        'Programming languages': 'language',
        'Web servers': 'server',
        'Databases': 'database',
        'CDN': 'cdn',
        'Security': 'security',
        'Analytics': 'analytics',
        'JavaScript graphics': 'javascript',
        'UI frameworks': 'css',
        'Operating systems': 'server',
        'Paas': 'server',
        'Cache': 'database',
    }

    def __init__(self, timeout: int = 60):
        self.timeout = timeout
        self.command = 'wappalyzer'
        self._cli_available = bool(shutil.which(self.command))
        self._lib_available = _WAPPALYZER_LIB
        self._wappalyzer_instance: Any = None

        if self._lib_available:
            logger.info("Wappalyzer: usando python-Wappalyzer (librería).")
        elif self._cli_available:
            logger.info("Wappalyzer: usando wappalyzer CLI.")
        else:
            logger.warning("Wappalyzer no disponible. Se usará simulación.")

    def _validate_target(self, target: str) -> tuple:
        if not target or not isinstance(target, str):
            return False, "Target must be a non-empty string"
        if not target.startswith(('http://', 'https://')):
            target = f'http://{target}'
        try:
            parsed = urlparse(target)
            if not parsed.hostname:
                return False, "Invalid URL format"
        except Exception as e:
            return False, f"URL parsing error: {e}"
        return True, target

    def _map_category(self, categories: Any) -> str:
        if isinstance(categories, list):
            for cat in categories:
                mapped = self._CATEGORY_MAP.get(cat)
                if mapped:
                    return mapped
        elif isinstance(categories, str):
            return self._CATEGORY_MAP.get(categories, 'other')
        return 'other'

    def _scan_with_lib(self, target: str) -> List[Dict[str, Any]]:
        try:
            if self._wappalyzer_instance is None:
                self._wappalyzer_instance = Wappalyzer.latest()
            webpage = WebPage.new_from_url(target, timeout=self.timeout)
            matches = self._wappalyzer_instance.analyze_with_categories(webpage)
            technologies = []
            seen = set()
            for name, data in matches.items():
                key = name.lower()
                if key in seen:
                    continue
                seen.add(key)
                categories = list(data.get('categories', []))
                version = data.get('version', '') or ''
                technologies.append({
                    'name': name,
                    'version': version,
                    'category': self._map_category(categories),
                    'confidence': data.get('confidence', 100),
                    'description': f"Detectado por Wappalyzer — categoría: {', '.join(categories) or 'other'}",
                    'simulated': False,
                })
            logger.info("Wappalyzer (lib) detectó %d tecnologías en %s", len(technologies), target)
            return technologies if technologies else self._simulate_scan(target)
        except Exception as e:
            logger.warning("Wappalyzer lib error: %s — usando CLI/simulación.", e)
            return []

    def _scan_with_cli(self, target: str) -> List[Dict[str, Any]]:
        cmd = [self.command, target, '--pretty', '--recursive=false']
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )
            if result.returncode not in (0, 1) or not result.stdout.strip():
                return []
            data = json.loads(result.stdout)
            technologies = []
            seen = set()
            urls_data = data.get('urls', {})
            for _url, url_data in urls_data.items():
                for tech in url_data.get('technologies', []):
                    name = tech.get('name', '')
                    if not name or name.lower() in seen:
                        continue
                    seen.add(name.lower())
                    categories = [c.get('name', '') for c in tech.get('categories', [])]
                    technologies.append({
                        'name': name,
                        'version': tech.get('version', '') or '',
                        'category': self._map_category(categories),
                        'confidence': tech.get('confidence', 100),
                        'description': f"Detectado por Wappalyzer CLI — {', '.join(categories) or 'other'}",
                        'simulated': False,
                    })
            logger.info("Wappalyzer CLI detectó %d tecnologías en %s", len(technologies), target)
            return technologies
        except (json.JSONDecodeError, subprocess.TimeoutExpired, Exception) as e:
            logger.warning("Wappalyzer CLI error: %s", e)
            return []

    def _simulate_scan(self, target: str) -> List[Dict[str, Any]]:
        """Resultados simulados por lab cuando Wappalyzer no está disponible."""
        time.sleep(0.5)
        t = target.lower()
        if 'juice' in t or '3001' in t:
            return [
                {'name': 'Node.js', 'version': '18.17.0', 'category': 'language', 'confidence': 100, 'description': 'Runtime JS del servidor', 'simulated': True},
                {'name': 'Express', 'version': '4.18.2', 'category': 'framework', 'confidence': 95, 'description': 'Framework HTTP minimalista', 'simulated': True},
                {'name': 'Angular', 'version': '15.0.0', 'category': 'framework', 'confidence': 90, 'description': 'SPA frontend', 'simulated': True},
                {'name': 'SQLite', 'version': '3.40', 'category': 'database', 'confidence': 85, 'description': 'Base de datos embebida', 'simulated': True},
                {'name': 'Bootstrap', 'version': '5.2.3', 'category': 'css', 'confidence': 100, 'description': 'Framework CSS', 'simulated': True},
            ]
        if 'dvwa' in t or '3002' in t:
            return [
                {'name': 'Apache', 'version': '2.4.54', 'category': 'server', 'confidence': 100, 'description': 'Servidor HTTP Apache', 'simulated': True},
                {'name': 'PHP', 'version': '8.1.12', 'category': 'language', 'confidence': 100, 'description': 'Lenguaje de scripting del servidor', 'simulated': True},
                {'name': 'MySQL', 'version': '8.0.31', 'category': 'database', 'confidence': 90, 'description': 'RDBMS relacional', 'simulated': True},
                {'name': 'jQuery', 'version': '3.7.1', 'category': 'javascript', 'confidence': 95, 'description': 'Librería JS', 'simulated': True},
            ]
        if 'webgoat' in t or '3003' in t:
            return [
                {'name': 'Apache Tomcat', 'version': '9.0.68', 'category': 'server', 'confidence': 100, 'description': 'Servidor de aplicaciones Java', 'simulated': True},
                {'name': 'Java', 'version': '17', 'category': 'language', 'confidence': 95, 'description': 'Lenguaje JVM', 'simulated': True},
                {'name': 'Spring Framework', 'version': '5.3', 'category': 'framework', 'confidence': 90, 'description': 'Framework Java empresarial', 'simulated': True},
                {'name': 'Thymeleaf', 'version': '3.1', 'category': 'framework', 'confidence': 85, 'description': 'Motor de plantillas Java', 'simulated': True},
            ]
        return [
            {'name': 'Nginx', 'version': '1.24.0', 'category': 'server', 'confidence': 100, 'description': 'Servidor HTTP/proxy', 'simulated': True},
            {'name': 'PHP', 'version': '8.2.5', 'category': 'language', 'confidence': 95, 'description': 'Lenguaje de scripting', 'simulated': True},
            {'name': 'WordPress', 'version': '6.4.3', 'category': 'cms', 'confidence': 100, 'description': 'CMS popular', 'simulated': True},
            {'name': 'MySQL', 'version': '8.0.33', 'category': 'database', 'confidence': 80, 'description': 'RDBMS', 'simulated': True},
        ]

    def scan(self, target: str) -> List[Dict[str, Any]]:
        """
        Detecta tecnologías web del target con Wappalyzer.

        Returns:
            Lista de tecnologías con: name, version, category, confidence,
            description, simulated
        """
        is_valid, target = self._validate_target(target)
        if not is_valid:
            logger.error("Invalid target for Wappalyzer: %s", target)
            return []

        # Prioridad 1: librería Python
        if self._lib_available:
            result = self._scan_with_lib(target)
            if result:
                return result

        # Prioridad 2: CLI Node.js
        if self._cli_available:
            result = self._scan_with_cli(target)
            if result:
                return result

        # Fallback: simulación
        return self._simulate_scan(target)

    def get_version_info(self) -> Dict[str, str]:
        if self._lib_available:
            return {'backend': 'python-Wappalyzer', 'installed': 'True'}
        if self._cli_available:
            try:
                r = subprocess.run([self.command, '--version'], capture_output=True, text=True, timeout=5)
                return {'backend': 'wappalyzer-cli', 'installed': 'True', 'version': r.stdout.strip()}
            except Exception:
                pass
        return {'backend': 'simulation', 'installed': 'False'}
