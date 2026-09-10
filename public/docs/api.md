# SecureScan Pro v3.0 - API Reference

## Base URL

```
Development: http://localhost:5000
Docker:      http://api:5000
```

All routes are also proxied through the Next.js frontend at `/api/*`.

---

## POST /api/scan — Start Scan

Initiates a new security scan. Returns a `jobId` for polling.

### Request Body
```json
{
  "target": "http://juice-shop:3000",
  "options": {
    "tools": {
      "whatweb":    true,
      "nmap":       true,
      "gobuster":   true,
      "zap":        true,
      "exploitdb":  true,
      "metasploit": false
    },
    "parallel": true
  }
}
```

### Response `200`
```json
{ "jobId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301", "status": "running" }
```

### Error `403` — Target not allowed
```json
{ "error": "Target not allowed", "reason": "...", "allowed_targets": ["juice-shop:3000"] }
```

---

## GET /api/scan/:jobId/status — Poll Scan

Returns the current state of a running or completed scan.

### Response
```json
{
  "id": "3f2504e0-...",
  "target": "http://juice-shop:3000",
  "status": "running",
  "startTime": "2026-03-24T10:30:00",
  "endTime": null,
  "steps": [
    { "name": "WhatWeb",    "status": "completed", "progress": 100 },
    { "name": "Nmap",       "status": "running",   "progress": 0   },
    { "name": "Gobuster",   "status": "pending",   "progress": 0   },
    { "name": "OWASP ZAP",  "status": "pending",   "progress": 0   },
    { "name": "ExploitDB",  "status": "pending",   "progress": 0   },
    { "name": "Metasploit", "status": "pending",   "progress": 0   },
    { "name": "Scoring",    "status": "pending",   "progress": 0   }
  ],
  "technologies": [...],
  "ports":         [...],
  "directories":   [...],
  "vulnerabilities":[...],
  "exploits":      [...],
  "metasploit":    [...],
  "score": {
    "total": 72, "grade": "B", "gradeDescription": "...",
    "breakdown": { "critical": 0, "high": 2, "medium": 5, "low": 12, "info": 28 },
    "percentages": {...},
    "exploitImpact": { "totalExploits": 3, "correlatedExploits": 1, "penalty": 11.0 },
    "metrics": { "totalVulnerabilities": 47, "maxCvss": 9.8, "criticalCount": 0, "highCount": 2 },
    "recommendations": ["..."],
    "riskLevel": "MEDIUM"
  }
}
```

---

## GET /api/scan/:scanId/report?format=html — Download Report

Generates and downloads a report. Available formats: `html`, `json`, `pdf`.

Returns a binary file attachment.

---

## GET /api/history — Scan History

Returns the last 100 scans sorted by date descending.

### Response
```json
{ "scans": [...], "total": 12 }
```

---

## DELETE /api/scan/:scanId — Delete Scan

Removes a scan from storage.

### Response
```json
{ "message": "Scan deleted successfully" }
```

---

## GET /api/health — Health Check

```json
{
  "status": "healthy",
  "version": "3.0.0",
  "timestamp": "2026-03-24T10:30:00",
  "storage": "connected",
  "zap_configured": true
}
```

---

## GET /api/config — Public Configuration

```json
{
  "version": "3.0.0",
  "allowed_targets": ["juice-shop:3000", "dvwa:80", "webgoat:8080"],
  "available_tools": ["whatweb", "nmap", "gobuster", "zap", "exploitdb", "metasploit"],
  "report_formats": ["html", "json", "pdf"],
  "metasploit": { "enabled": true, "mode": "simulation", "host": "127.0.0.1", "port": 55553 }
}
```

---

## Error Format

```json
{ "error": "Description of the error", "reason": "Optional detail" }
```

| HTTP Status | Meaning                        |
|-------------|--------------------------------|
| 400         | Missing or invalid input       |
| 403         | Target not in allowed list     |
| 404         | Scan ID not found              |
| 500         | Internal server error          |
