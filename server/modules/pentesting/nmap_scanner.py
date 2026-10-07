"""
Nmap Scanner Module
Port scanning and service detection

CORRECCIÓN #15: todos los dicts devueltos por _simulate_scan() incluyen
'simulated': True para que la UI pueda mostrar un banner de advertencia
al usuario cuando los resultados son inventados y no reales.
"""

import subprocess
import xml.etree.ElementTree as ET
import logging
import shutil
import re
import time
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class NmapScanner:
    """Nmap wrapper for port and service scanning"""

    PORT_RANGES = {
        'quick': '21,22,23,25,53,80,110,143,443,445,993,995,3306,3389,5432,8080,8443',
        'common': '1-1000',
        'full': '1-65535',
        'web': '80,443,8080,8443,3000,8000,9000'
    }

    def __init__(self, timing: str = 'T4', timeout: int = 300):
        self.timing = timing if timing in ['T0', 'T1', 'T2', 'T3', 'T4', 'T5'] else 'T4'
        self.timeout = timeout
        self.command = 'nmap'
        self._check_availability()

    def _check_availability(self) -> bool:
        if not shutil.which(self.command):
            logger.warning("Nmap not found in PATH. Will use simulation mode.")
            return False
        return True

    def _validate_target(self, target: str) -> tuple[bool, str]:
        if not target or not isinstance(target, str):
            return False, "Target must be a non-empty string"

        if target.startswith(('http://', 'https://')):
            parsed = urlparse(target)
            target = parsed.hostname or target

        if '/' in target:
            return False, "CIDR ranges not allowed for security reasons"

        # FIX: solo rechazar si parece un rango IP (ej. 192.168.1.1-254)
        # Los hostnames con guion como "juice-shop" son válidos y no deben rechazarse
        import re as _re
        if _re.search(r'\d+-\d+', target):
            return False, "IP ranges not allowed for security reasons"

        ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        ipv6_pattern = r'^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$'
        hostname_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'

        is_ip = re.match(ip_pattern, target) is not None
        is_ipv6 = re.match(ipv6_pattern, target) is not None
        is_hostname = re.match(hostname_pattern, target) is not None

        if not (is_ip or is_ipv6 or is_hostname):
            return False, f"Invalid target format: {target}"

        if is_ip:
            octets = target.split('.')
            for octet in octets:
                if int(octet) > 255:
                    return False, f"Invalid IP address: {target}"

        return True, target

    def scan(
        self,
        target: str,
        ports: str = '1-1000',
        scripts: bool = False,
        os_detection: bool = False
    ) -> List[Dict[str, Any]]:
        start_time = time.time()

        is_valid, result = self._validate_target(target)
        if not is_valid:
            logger.error(result)
            return []

        target = result

        if ports in self.PORT_RANGES:
            ports = self.PORT_RANGES[ports]
            logger.info(f"Using predefined port range: {ports}")

        try:
            cmd = [
                self.command,
                f'-{self.timing}',
                '-sV',
                '-oX', '-',
                f'-p{ports}',
                '--open',
                target
            ]

            if scripts:
                cmd.insert(2, '-sC')

            if os_detection:
                cmd.insert(2, '-O')

            logger.info(f"Starting Nmap scan on {target} (ports: {ports}, timing: {self.timing})")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout
            )

            if result.returncode != 0:
                if 'You requested a scan type which requires root privileges' in result.stderr:
                    logger.warning("Nmap requires root for some options, retrying with safe options...")
                    return self._scan_safe_mode(target, ports, scripts)
                elif 'Name or service not known' in result.stderr:
                    logger.error(f"Could not resolve hostname: {target}")
                    return self._simulate_scan(target, "host_not_found")
                else:
                    logger.warning(f"Nmap warning: {result.stderr}")

            if not result.stdout:
                logger.warning("Nmap returned empty output")
                return self._simulate_scan(target)

            ports_found = self._parse_output(result.stdout)

            elapsed = time.time() - start_time
            logger.info(f"Nmap scan completed in {elapsed:.1f}s, found {len(ports_found)} open ports")

            if not ports_found:
                return self._simulate_scan(target, "no_ports")

            return ports_found

        except FileNotFoundError:
            logger.warning("Nmap not installed, using simulated data")
            return self._simulate_scan(target)
        except subprocess.TimeoutExpired:
            logger.error(f"Nmap scan timed out after {self.timeout}s")
            return self._simulate_scan(target, "timeout")
        except Exception as e:
            logger.error(f"Nmap unexpected error: {str(e)}")
            return self._simulate_scan(target)

    def _scan_safe_mode(self, target: str, ports: str, scripts: bool) -> List[Dict[str, Any]]:
        try:
            cmd = [
                self.command,
                '-sT',
                '-sV',
                '-oX', '-',
                f'-p{ports}',
                '--open',
                target
            ]

            if scripts:
                cmd.insert(2, '-sC')

            logger.info(f"Running Nmap in safe mode on {target}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout
            )

            if result.stdout:
                return self._parse_output(result.stdout)
            return self._simulate_scan(target)

        except Exception as e:
            logger.error(f"Safe mode scan failed: {e}")
            return self._simulate_scan(target)

    def _parse_output(self, xml_output: str) -> List[Dict[str, Any]]:
        ports = []

        try:
            root = ET.fromstring(xml_output)

            for host in root.findall('.//host'):
                status = host.find('status')
                if status is not None and status.get('state') != 'up':
                    continue

                for port in host.findall('.//port'):
                    state_elem = port.find('state')

                    if state_elem is None or state_elem.get('state') != 'open':
                        continue

                    service = port.find('service')

                    port_data = {
                        'port':      int(port.get('portid', 0)),
                        'state':     'open',
                        'protocol':  port.get('protocol', 'tcp'),
                        'service':   service.get('name', 'unknown') if service is not None else 'unknown',
                        'product':   service.get('product', '')    if service is not None else '',
                        'version':   service.get('version', '')    if service is not None else '',
                        'extrainfo': service.get('extrainfo', '')  if service is not None else '',
                        'cpe':       service.get('cpe', '')        if service is not None else ''
                    }
                    ports.append(port_data)

        except ET.ParseError as e:
            logger.error(f"Error parsing Nmap XML: {str(e)}")
            return []

        return ports

    def ping_scan(self, target: str) -> Dict[str, Any]:
        try:
            cmd = [self.command, '-sn', '-oX', '-', target]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            is_up = 'host is up' in result.stdout.lower() or 'up' in result.stdout.lower()
            return {'target': target, 'is_up': is_up, 'raw_output': result.stdout}
        except Exception as e:
            logger.error(f"Ping scan error: {e}")
            return {'target': target, 'is_up': False, 'error': str(e)}

    def _simulate_scan(self, target: str, scenario: str = "default") -> List[Dict[str, Any]]:
        """
        Simulate scan results for demo/testing.
        CORRECCIÓN #15: todos los resultados incluyen 'simulated': True.
        """
        time.sleep(2)

        target_lower = target.lower()

        if 'juice' in target_lower or '3001' in target or scenario == "juice_shop":
            return [
                {
                    'port': 3000, 'state': 'open', 'protocol': 'tcp',
                    'service': 'http', 'product': 'Node.js', 'version': '18.17.0',
                    'extrainfo': 'Express framework', 'cpe': 'cpe:/a:nodejs:node.js:18.17.0',
                    'simulated': True
                }
            ]

        if 'dvwa' in target_lower or '3002' in target or scenario == "dvwa":
            return [
                {
                    'port': 80, 'state': 'open', 'protocol': 'tcp',
                    'service': 'http', 'product': 'Apache httpd', 'version': '2.4.54',
                    'extrainfo': 'Debian', 'cpe': 'cpe:/a:apache:http_server:2.4.54',
                    'simulated': True
                },
                {
                    'port': 3306, 'state': 'open', 'protocol': 'tcp',
                    'service': 'mysql', 'product': 'MySQL', 'version': '8.0.31',
                    'extrainfo': '', 'cpe': 'cpe:/a:mysql:mysql:8.0.31',
                    'simulated': True
                }
            ]

        if 'webgoat' in target_lower or '3003' in target or scenario == "webgoat":
            return [
                {
                    'port': 8080, 'state': 'open', 'protocol': 'tcp',
                    'service': 'http', 'product': 'Apache Tomcat', 'version': '9.0.68',
                    'extrainfo': 'Java', 'cpe': 'cpe:/a:apache:tomcat:9.0.68',
                    'simulated': True
                },
                {
                    'port': 9001, 'state': 'open', 'protocol': 'tcp',
                    'service': 'tcpwrapped', 'product': '', 'version': '',
                    'extrainfo': '', 'cpe': '',
                    'simulated': True
                }
            ]

        if scenario == "host_not_found":
            return []

        if scenario == "timeout":
            return [
                {
                    'port': 0, 'state': 'filtered', 'protocol': 'tcp',
                    'service': 'unknown', 'product': '', 'version': '',
                    'extrainfo': 'Scan timeout - port status unknown', 'cpe': '',
                    'simulated': True
                }
            ]

        # Default genérico
        return [
            {
                'port': 22, 'state': 'open', 'protocol': 'tcp',
                'service': 'ssh', 'product': 'OpenSSH', 'version': '8.9p1',
                'extrainfo': 'Ubuntu-3ubuntu0.1', 'cpe': 'cpe:/a:openssh:openssh:8.9p1',
                'simulated': True
            },
            {
                'port': 80, 'state': 'open', 'protocol': 'tcp',
                'service': 'http', 'product': 'Apache httpd', 'version': '2.4.52',
                'extrainfo': '', 'cpe': 'cpe:/a:apache:http_server:2.4.52',
                'simulated': True
            },
            {
                'port': 443, 'state': 'open', 'protocol': 'tcp',
                'service': 'https', 'product': 'Apache httpd', 'version': '2.4.52',
                'extrainfo': 'SSL/TLS', 'cpe': 'cpe:/a:apache:http_server:2.4.52',
                'simulated': True
            },
            {
                'port': 3306, 'state': 'open', 'protocol': 'tcp',
                'service': 'mysql', 'product': 'MySQL', 'version': '8.0.32',
                'extrainfo': '', 'cpe': 'cpe:/a:mysql:mysql:8.0.32',
                'simulated': True
            }
        ]

    def quick_scan(self, target: str) -> List[Dict[str, Any]]:
        return self.scan(target, ports='quick', scripts=False)

    def web_scan(self, target: str) -> List[Dict[str, Any]]:
        return self.scan(target, ports='web', scripts=True)

    def full_scan(self, target: str, scripts: bool = True) -> List[Dict[str, Any]]:
        return self.scan(target, ports='full', scripts=scripts, os_detection=False)

    def get_version_info(self) -> Dict[str, str]:
        try:
            result = subprocess.run(
                [self.command, '--version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            lines = result.stdout.strip().split('\n')
            version_line = lines[0] if lines else 'Unknown'
            return {
                'installed': 'True',
                'version': version_line,
                'path': shutil.which(self.command) or 'Not found'
            }
        except Exception as e:
            return {
                'installed': 'False',
                'version': 'N/A',
                'error': str(e)
            }