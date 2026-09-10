# SecureScan Pro v3.0 - Security Tools

## Integrated Tools Overview

SecureScan Pro integrates 6 industry-standard security tools in an orchestrated 7-step pipeline.

---

## WhatWeb — Technology Detection

Identifies web technologies, frameworks, CMS platforms, and server configurations using 1,800+ plugins.

**Capabilities:** CMS detection (WordPress, Drupal), framework identification (React, Angular), server detection (Apache, Nginx), version enumeration, HTTP header analysis.

**Output format:**
```json
{ "technologies": [{ "name": "WordPress", "version": "6.4.2", "category": "cms", "confidence": 95 }] }
```

---

## Nmap — Network Scanner

Port scanning and service enumeration.

**Scan types:** Quick (top common ports), Common (1-1000), Full (1-65535), Web (80/443/8080/8443).

**Output format:**
```json
{ "ports": [{ "port": 443, "protocol": "tcp", "state": "open", "service": "https", "product": "nginx", "version": "1.24" }] }
```

---

## Gobuster — Directory Enumeration

Brute-force discovery of hidden directories, files, and endpoints.

**Wordlists used:** `/usr/share/wordlists/dirb/common.txt` (4,614 entries), with fallback to an internal minimal list.

**Output format:**
```json
{ "directories": [{ "path": "/admin", "status": 301, "size": 178, "type": "redirect" }] }
```

---

## OWASP ZAP — DAST Vulnerability Scanner

Active and passive scanning for web application vulnerabilities (Spider + Active Scan).

**Detection categories:** SQL Injection, XSS, CSRF, IDOR, Security Misconfigurations, Sensitive Data Exposure.

**Output format:**
```json
{ "vulnerabilities": [{ "name": "SQL Injection", "severity": "critical", "cvss": 9.8, "cweid": "89", "tool": "OWASP ZAP" }] }
```

---

## ExploitDB — Exploit Correlation

Correlates detected technologies with known exploits via `searchsploit`.

**Output format:**
```json
{ "exploits": [{ "id": "51193", "title": "Apache 2.4.49 - RCE", "cvss": 9.8, "matchedTerm": "Apache", "exploit_url": "https://exploit-db.com/exploits/51193" }] }
```

---

## Metasploit — Auxiliary Module Scanner *(opcional)*

Executes MSF auxiliary modules via `msfrpcd` RPC daemon. Falls back to simulation mode automatically if the daemon is unavailable.

**Activation:** Opt-in — enable in scan form advanced settings or use the "Agresivo" profile.

**Default modules:** `auxiliary/scanner/http/http_version`, `auxiliary/scanner/http/dir_listing`, `auxiliary/scanner/http/options`, `auxiliary/scanner/ssl/openssl_heartbleed`, `auxiliary/scanner/http/shellshock`.

**Starting the daemon:**
```bash
msfrpcd -P yourpassword -S -a 127.0.0.1 -p 55553
```

**Output format:**
```json
{ "metasploit": [{ "title": "MSF Http Version [Apache 2.4.51]", "severity": "info", "module": "auxiliary/scanner/http/http_version", "port": 80, "source": "metasploit" }] }
```

---

## Environment Variables

```bash
ZAP_API_URL=http://zap:8080
ZAP_API_KEY=your-zap-key
MSF_HOST=127.0.0.1
MSF_PORT=55553
MSF_PASSWORD=your-msf-password
```
