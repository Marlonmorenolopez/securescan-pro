// lib/home-mock-data.ts — SecureScan Pro · Home v3
//
// Datos de EJEMPLO (mock) para los bloques "Security Overview",
// "Results Dashboard Preview" y "Recent Activity" del Home.
//
// REGLA DE ORO: cada mock respeta EXACTAMENTE los tipos reales que ya
// devuelve el backend (ver lib/api-client.ts). Esto permite reemplazar
// estos mocks por llamadas reales (getScanHistory / getScanResults) sin
// tocar el JSX de los componentes que los consumen — solo se cambia el
// origen del dato, nunca su forma.
//
// Cuando conectes datos reales:
//   - Security Overview      → derivar de getScanHistory() (agregados)
//   - Results Dashboard Prev. → derivar de getScanResults(id) del último scan
//   - Recent Activity        → derivar de getScanHistory().scans

import type {
  SecurityScore,
  Vulnerability,
  ScanStatusResponse,
  SeverityBreakdown,
} from './api-client'

// ─── Security Overview — agregados tipo "dashboard SOC" ───────────────────────
// Forma honesta: estos NO son campos que getScanHistory() devuelva ya
// agregados (el backend no expone un endpoint de stats globales todavía),
// así que se modelan como una agregación simple sobre datos de ejemplo con
// la MISMA estructura que tendría una agregación real sobre ScanHistoryResponse.

export interface SecurityOverviewMock {
  totalScans: number
  totalVulnerabilities: number
  averageScore: number
  averageGrade: SecurityScore['grade']
  riskLevel: SecurityScore['riskLevel']
  breakdown: SeverityBreakdown
}

export const securityOverviewMock: SecurityOverviewMock = {
  totalScans: 47,
  totalVulnerabilities: 312,
  averageScore: 78,
  averageGrade: 'B',
  riskLevel: 'VULNERABLE',
  breakdown: {
    critical: 9,
    high: 41,
    medium: 96,
    low: 122,
    info: 44,
  },
}

// ─── Results Dashboard Preview — mismo shape que ScoreCard real ───────────────
// Idéntico a SecurityScore (lib/api-client.ts), usado hoy por
// components/results-dashboard.tsx → ScoreCard.

export const securityScoreMock: SecurityScore = {
  total: 78,
  grade: 'B',
  gradeDescription: 'Postura de seguridad aceptable, con hallazgos que requieren atención',
  breakdown: {
    critical: 2,
    high: 7,
    medium: 14,
    low: 19,
    info: 8,
  },
  percentages: {
    critical: 4,
    high: 14,
    medium: 28,
    low: 38,
    info: 16,
  },
  exploitImpact: {
    totalExploits: 5,
    correlatedExploits: 2,
    penalty: 12,
  },
  metrics: {
    totalVulnerabilities: 50,
    totalExploits: 5,
    maxCvss: 9.1,
    criticalCount: 2,
    highCount: 7,
  },
  recommendations: [
    'Actualizar el servidor web a la última versión estable',
    'Aplicar parches a las dependencias con CVE conocido',
    'Revisar configuración de cabeceras de seguridad (CSP, HSTS)',
  ],
  riskLevel: 'VULNERABLE',
}

// Top vulnerabilidades — mismo shape que Vulnerability (lib/api-client.ts)
export const topVulnerabilitiesMock: Vulnerability[] = [
  {
    id: 'vuln-001',
    name: 'SQL Injection en parámetro de búsqueda',
    tool: 'SQLMap',
    url: '/api/search?q=',
    risk: 'critical',
    cvss: 9.1,
    cweid: 'CWE-89',
  },
  {
    id: 'vuln-002',
    name: 'Cross-Site Scripting (XSS) reflejado',
    tool: 'OWASP ZAP',
    url: '/comments/new',
    risk: 'high',
    cvss: 7.4,
    cweid: 'CWE-79',
  },
  {
    id: 'vuln-003',
    name: 'Cabecera Content-Security-Policy ausente',
    tool: 'OWASP ZAP',
    url: '/',
    risk: 'medium',
    cvss: 5.3,
    cweid: 'CWE-1021',
  },
  {
    id: 'vuln-004',
    name: 'Versión de servidor expuesta en cabecera',
    tool: 'Nmap',
    url: '/',
    risk: 'low',
    cvss: 3.1,
    cweid: 'CWE-200',
  },
  {
    id: 'vuln-005',
    name: 'Directorio de administración accesible',
    tool: 'Gobuster',
    url: '/admin/',
    risk: 'high',
    cvss: 6.8,
    cweid: 'CWE-284',
  },
]

// ─── Security Metrics — hallazgos por herramienta ──────────────────────────────
// Mismos nombres de herramientas que TOOL_ORDER en components/scan-progress.tsx
// (las 12 fases reales del orchestrator). Solo se omite "Scoring" porque no
// produce hallazgos propios, sino que consolida los de las otras 11.

export interface ToolFindingCountMock {
  tool: string
  findings: number
}

export const findingsByToolMock: ToolFindingCountMock[] = [
  { tool: 'OWASP ZAP',    findings: 14 },
  { tool: 'Nuclei',       findings: 11 },
  { tool: 'SQLMap',       findings: 6  },
  { tool: 'Nmap',         findings: 9  },
  { tool: 'Gobuster',     findings: 5  },
  { tool: 'ffuf',         findings: 3  },
  { tool: 'Searchsploit', findings: 2  },
]

// ─── Recent Activity — mismo shape (recortado) que ScanStatusResponse ─────────
// Usado por app/history/page.tsx para listar escaneos. Se reutiliza el mismo
// tipo para que "Recent Activity" en el Home sea una vista resumida 1:1
// compatible con getScanHistory().scans.

export type RecentScanMock = Pick<
  ScanStatusResponse,
  'id' | 'target' | 'status' | 'startTime' | 'endTime' | 'score'
>

export const recentActivityMock: RecentScanMock[] = [
  {
    id: 'scan-9f31',
    target: 'demo.juice-shop.local',
    status: 'completed',
    startTime: '2026-06-19T14:02:00Z',
    endTime: '2026-06-19T14:11:32Z',
    score: { ...securityScoreMock, total: 64, grade: 'C', riskLevel: 'EXPUESTO' },
  },
  {
    id: 'scan-8a02',
    target: 'staging.dvwa.local',
    status: 'completed',
    startTime: '2026-06-19T09:40:00Z',
    endTime: '2026-06-19T09:52:18Z',
    score: { ...securityScoreMock, total: 81, grade: 'B', riskLevel: 'VULNERABLE' },
  },
  {
    id: 'scan-7c19',
    target: 'webgoat.local:3003',
    status: 'completed',
    startTime: '2026-06-18T20:15:00Z',
    endTime: '2026-06-18T20:24:47Z',
    score: { ...securityScoreMock, total: 92, grade: 'A', riskLevel: 'VULNERABLE' },
  },
  {
    id: 'scan-6b88',
    target: 'test.example.local',
    status: 'error',
    startTime: '2026-06-18T11:05:00Z',
    endTime: '2026-06-18T11:06:02Z',
    score: { ...securityScoreMock, total: 0, grade: 'F', riskLevel: 'COMPROMETIDO' },
  },
]
