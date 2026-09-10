// lib/api-client.ts
//
// CORRECCIONES APLICADAS:
//   1. SecurityScore: interface completa con todos los campos que devuelve
//      scoring.py (gradeDescription, percentages, exploitImpact, metrics,
//      recommendations, riskLevel). Ya no se pierden datos del backend.
//   2. Grade: tipo expandido para incluir A+, A-, B+, B-, C+, C-, D+.
//   3. RiskLevel: tipo nuevo exportado.
//   4. getScanResults(): el comentario aclaraba que llama a /status; ahora
//      también se exporta el tipo correcto de retorno.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
const API_TOKEN   = process.env.NEXT_PUBLIC_API_TOKEN || ''

// Configuración de retries
const DEFAULT_RETRIES = 3
const RETRY_DELAY = 1000 // ms

interface ApiError {
  error: string
  reason?: string
  allowed_targets?: string[]
}

interface ApiResponse<T> {
  data?: T
  error?: ApiError
}

// ── Tipos de Scan ──────────────────────────────────────────────────────────

// FIX: Tipos completos para circuit_breaker, dry_run, target_validation, retry_config
interface CircuitBreakerConfig {
  enabled?: boolean
  failure_threshold?: number   // fallos antes de abrir el circuito (default 3)
  recovery_timeout?: number    // segundos antes de reintentar (default 60)
}

interface TargetValidationConfig {
  check_dns?: boolean          // verificar resolución DNS (default true)
  check_reachability?: boolean // verificar que el host responde (default true)
  timeout?: number             // segundos para el check (default 10)
}

interface RetryConfig {
  max_retries?: number         // reintentos por herramienta (default 2)
  backoff_factor?: number      // multiplicador de espera entre reintentos (default 1.5)
  retry_on?: string[]          // tipos de error que activan reintento
}

interface ScanStartRequest {
  target: string
  options?: {
    tools?: {
      wappalyzer?: boolean
      nmap?: boolean
      gobuster?: boolean
      zap?: boolean
      searchsploit?: boolean
      metasploit?: boolean
      nuclei?: boolean
      sqlmap?: boolean
      patator?: boolean
      ffuf?: boolean
    }
    parallel?: boolean
    dry_run?: boolean              // simular sin ejecutar herramientas reales
    circuit_breaker?: CircuitBreakerConfig
    target_validation?: TargetValidationConfig
    retry_config?: RetryConfig
  }
}

interface ScanStartResponse {
  jobId: string
  status: 'running' | 'pending'
}

interface ScanStep {
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress: number
  startTime?: number
  endTime?: number
}

// CORRECCIÓN #2: Grade expandido con todas las variantes que devuelve
// calculate_grade() en scoring.py.
type Grade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'F'

// CORRECCIÓN #3: RiskLevel nuevo, alineado con get_risk_level() en scoring.py.
type RiskLevel = 'COMPROMETIDO' | 'EXPUESTO' | 'VULNERABLE' | 'PROTEGIDO' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL'

type SeverityBreakdown = {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

// CORRECCIÓN #1: SecurityScore con todos los campos del backend.
interface SecurityScore {
  total: number
  grade: Grade
  gradeDescription: string
  breakdown: SeverityBreakdown
  percentages: SeverityBreakdown
  exploitImpact: {
    totalExploits: number
    correlatedExploits: number
    penalty: number
  }
  metrics: {
    totalVulnerabilities: number
    totalExploits: number
    maxCvss: number
    criticalCount: number
    highCount: number
  }
  recommendations: string[]
  riskLevel: RiskLevel
}

interface Technology {
  name: string
  version?: string
  category?: string
  confidence?: number
  error?: string
}

interface Port {
  port?: number
  protocol?: string
  state?: string
  service?: string
  product?: string
  version?: string
  extrainfo?: string
  cpe?: string
  error?: string
}

interface Directory {
  path: string
  status: number
  size?: number
  type?: string
  error?: string
}

interface Vulnerability {
  id?: string
  name: string
  tool?: string
  url?: string
  risk?: 'critical' | 'high' | 'medium' | 'low' | 'info'
  severity?: string
  description?: string
  solution?: string
  cweid?: string
  evidence?: string
  cvss?: number
  error?: string
}

interface Exploit {
  id?: string | number
  type?: string
  platform?: string
  path?: string
  cve?: string
  title?: string
  severity?: string
  cvss?: number
  matchedTerm?: string
  exploit_url?: string
  error?: string
}

interface MetasploitFinding {
  title?: string
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info'
  cvss?: number
  description?: string
  module?: string
  host?: string
  port?: number
  protocol?: string
  source?: 'metasploit'
  matchedTerm?: string
  error?: string
}

interface ScanStatusResponse {
  id: string
  target: string
  status: 'running' | 'completed' | 'error'
  startTime: string
  endTime?: string
  error?: string
  steps: ScanStep[]
  technologies: Technology[]
  ports: Port[]
  directories: Directory[]
  vulnerabilities: Vulnerability[]
  exploits: Exploit[]
  metasploit: MetasploitFinding[]
  score: SecurityScore
}

interface ScanHistoryResponse {
  scans: ScanStatusResponse[]
  total: number
}

interface ConfigResponse {
  version: string
  allowed_targets: string[]
  available_tools: string[]
  report_formats: string[]
  metasploit?: {
    enabled: boolean
    mode: 'live' | 'simulation'
    host: string
    port: number
  }
}

interface HealthResponse {
  status: string
  version: string
  storage: 'connected' | 'fallback'
  zap_configured: boolean
  tools: string[]
}

// ── Error personalizado ────────────────────────────────────────────────────

export class ApiException extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: ApiError
  ) {
    super(message)
    this.name = 'ApiException'
  }
}

// ── Helpers internos ───────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retries: number = DEFAULT_RETRIES
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 s timeout

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(API_TOKEN ? { 'X-API-Token': API_TOKEN } : {}),
          ...options.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`
        }))

        // No reintentar en errores 4xx (cliente)
        if (response.status >= 400 && response.status < 500) {
          return { error: errorData }
        }

        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      return { data }

    } catch (err) {
      const isLastAttempt = attempt === retries

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          if (isLastAttempt) return { error: { error: 'Request timeout' } }
        } else if (isLastAttempt) {
          return { error: { error: err.message } }
        }
      }

      // Backoff exponencial antes de reintentar
      if (!isLastAttempt) {
        await sleep(RETRY_DELAY * Math.pow(2, attempt))
      }
    }
  }

  return { error: { error: 'Max retries exceeded' } }
}

// ── Funciones públicas de la API ───────────────────────────────────────────

/**
 * Obtiene la configuración pública y los targets permitidos.
 */
export async function getConfig(): Promise<ApiResponse<ConfigResponse>> {
  return apiRequest<ConfigResponse>('/api/config')
}

/**
 * Health-check liviano para indicadores de UI (ej. Header "Sistema: Online").
 * A diferencia de apiRequest(), usa timeout corto (4s) y SIN reintentos —
 * un polling cada pocos segundos no debe acumular llamadas colgadas ni
 * backoff exponencial si el backend está caído. Nunca lanza: devuelve
 * { data: undefined } en cualquier error de red/timeout.
 */
export async function getHealth(): Promise<ApiResponse<HealthResponse>> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!response.ok) return { error: { error: `HTTP ${response.status}` } }
    const data = await response.json()
    return { data }
  } catch (err) {
    return { error: { error: err instanceof Error ? err.message : 'unreachable' } }
  }
}

/**
 * Inicia un nuevo escaneo de seguridad.
 */
export async function startScan(
  target: string,
  options: ScanStartRequest['options'] = {}
): Promise<ApiResponse<ScanStartResponse>> {
  if (!target.trim()) {
    return { error: { error: 'Target URL is required' } }
  }

  // FIX: Defaults explícitos para los 4 campos nuevos — evita KeyError en backend
  return apiRequest<ScanStartResponse>('/api/scan', {
    method: 'POST',
    body: JSON.stringify({
      target,
      options: {
        tools: {
          wappalyzer: true,
          nmap: true,
          gobuster: true,
          zap: true,
          searchsploit: true,
          metasploit: false,
          nuclei: true,
          sqlmap: false,
          patator: false,
          ffuf: true,
          ...options?.tools,
        },
        parallel: options?.parallel ?? true,
        dry_run: options?.dry_run ?? false,
        circuit_breaker: {
          enabled: true,
          failure_threshold: 3,
          recovery_timeout: 60,
          ...options?.circuit_breaker,
        },
        target_validation: {
          check_dns: true,
          check_reachability: true,
          timeout: 10,
          ...options?.target_validation,
        },
        retry_config: {
          max_retries: 2,
          backoff_factor: 1.5,
          retry_on: ['timeout', 'connection_error'],
          ...options?.retry_config,
        },
      },
    }),
  })
}

/**
 * Obtiene el estado y resultados de un escaneo por su ID.
 */
export async function getScanStatus(
  scanId: string
): Promise<ApiResponse<ScanStatusResponse>> {
  if (!scanId) {
    return { error: { error: 'Scan ID is required' } }
  }

  return apiRequest<ScanStatusResponse>(`/api/scan/${scanId}/status`)
}

/**
 * Alias para compatibilidad — el backend no tiene /results, usa /status.
 */
export async function getScanResults(
  scanId: string
): Promise<ApiResponse<ScanStatusResponse>> {
  return getScanStatus(scanId)
}

/**
 * Obtiene el historial de todos los escaneos.
 */
export async function getScanHistory(): Promise<ApiResponse<ScanHistoryResponse>> {
  return apiRequest<ScanHistoryResponse>('/api/history')
}

/**
 * Elimina un escaneo del historial.
 */
export async function deleteScan(
  scanId: string
): Promise<ApiResponse<{ message: string }>> {
  return apiRequest<{ message: string }>(`/api/scan/${scanId}`, {
    method: 'DELETE',
  })
}

/**
 * Descarga el reporte de un escaneo.
 * El endpoint devuelve un archivo binario, no JSON.
 * Funciona para CUALQUIER tipo de Job (web, code, osint) — el endpoint
 * backend ya es genérico por scanId (ver server/app.py get_report()).
 */
export async function downloadReport(
  scanId: string,
  format: 'html' | 'json' | 'pdf' | 'csv' = 'html'
): Promise<{ blob?: Blob; error?: ApiError; filename?: string }> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/scan/${scanId}/report?format=${format}`,
      {
        method: 'GET',
        headers: {
          ...(API_TOKEN ? { 'X-API-Token': API_TOKEN } : {}),
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Failed to generate report'
      }))
      return { error: errorData }
    }

    const blob = await response.blob()
    const filename = `security-report-${scanId}.${format}`

    return { blob, filename }

  } catch (err) {
    return {
      error: {
        error: err instanceof Error ? err.message : 'Network error'
      }
    }
  }
}

/**
 * Dispara la descarga del reporte en el navegador.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

// ── OSINT (Grupo 2) ──────────────────────────────────────────────────────────

interface BreachDetail {
  name: string
  domain: string
  description: string
  industry: string
  exposed_data: string[]
  exposed_records: number
  breach_date: string
  password_risk: string
}

interface EmailBreachResponse {
  email: string
  available: boolean
  simulated: boolean
  breached: boolean
  breach_count: number
  breaches: BreachDetail[]
  risk_score: number | null
  risk_label: string | null
  error: string | null
}

interface UsernameFinding {
  site: string
  url: string
}

interface UsernameSearchResponse {
  username: string
  available: boolean
  simulated: boolean
  found: UsernameFinding[]
  unknown_sites: string[]
  checked_count: number
  error: string | null
}

/**
 * Historial unificado de OSINT (breach, username, username-deep, domain-harvest).
 * Backend: GET /api/osint/history (ver server/app.py).
 */
export interface OsintHistoryItem {
  id: string
  scan_type: string
  status: string
  startTime?: string
  endTime?: string | null
  email?: string
  username?: string
  domain?: string
  [key: string]: unknown
}

export async function getOsintHistory(): Promise<ApiResponse<{ scans: OsintHistoryItem[]; total: number }>> {
  return apiRequest<{ scans: OsintHistoryItem[]; total: number }>('/api/osint/history')
}

/** Verifica un correo contra brechas de datos conocidas (XposedOrNot). Síncrono, sin polling. */
export async function checkEmailBreach(email: string): Promise<ApiResponse<EmailBreachResponse>> {
  if (!email.trim()) {
    return { error: { error: 'El correo es requerido' } }
  }
  return apiRequest<EmailBreachResponse>('/api/osint/email-breach', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

/** Busca un username en ~19 plataformas en paralelo. Síncrono, sin polling. */
export async function searchUsername(username: string): Promise<ApiResponse<UsernameSearchResponse>> {
  if (!username.trim()) {
    return { error: { error: 'El username es requerido' } }
  }
  return apiRequest<UsernameSearchResponse>('/api/osint/username-search', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

/** Inicia la "búsqueda profunda" (Sherlock real, 414 sitios) como job en segundo plano. */
export async function startDeepUsernameSearch(username: string): Promise<ApiResponse<CodeScanStartResponse>> {
  if (!username.trim()) {
    return { error: { error: 'El username es requerido' } }
  }
  return apiRequest<CodeScanStartResponse>('/api/osint/username-deep', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

export interface DeepUsernameSearchStatus {
  id: string
  scan_type: 'osint-deep'
  username: string
  status: 'running' | 'completed' | 'error'
  startTime: string
  endTime: string | null
  error?: string
  steps: ScanStep[]
  found: UsernameFinding[]
  unknown_sites: string[]
  checked_count: number
}

/** Obtiene el estado/resultados de una búsqueda profunda por su ID. */
export async function getDeepUsernameSearchStatus(
  scanId: string
): Promise<ApiResponse<DeepUsernameSearchStatus>> {
  if (!scanId) {
    return { error: { error: 'Scan ID is required' } }
  }
  return apiRequest<DeepUsernameSearchStatus>(`/api/osint/username-deep/${scanId}/status`)
}

export interface DomainHarvestStatus {
  id: string
  scan_type: 'osint-harvest'
  domain: string
  status: 'running' | 'completed' | 'error'
  startTime: string
  endTime: string | null
  error?: string
  steps: ScanStep[]
  emails: string[]
  hosts: string[]
  ips: string[]
  sources_used: string[]
}

/** Inicia una búsqueda por dominio con theHarvester real (correos/subdominios/IPs). */
export async function startDomainHarvest(domain: string): Promise<ApiResponse<CodeScanStartResponse>> {
  if (!domain.trim()) {
    return { error: { error: 'El dominio es requerido' } }
  }
  return apiRequest<CodeScanStartResponse>('/api/osint/domain-harvest', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  })
}

/** Obtiene el estado/resultados de una búsqueda por dominio. */
export async function getDomainHarvestStatus(
  scanId: string
): Promise<ApiResponse<DomainHarvestStatus>> {
  if (!scanId) {
    return { error: { error: 'Scan ID is required' } }
  }
  return apiRequest<DomainHarvestStatus>(`/api/osint/domain-harvest/${scanId}/status`)
}

// ── Análisis de Código (Grupo 3) ────────────────────────────────────────────

interface CodeScanStartResponse {
  jobId: string
  status: 'running' | 'pending'
}

interface CodeFinding {
  file?: string
  line?: number
  type?: string
  severity: string
  masked_value?: string
  category?: string
  snippet?: string
}

interface DependencyFinding {
  package: string
  version: string
  ecosystem: string
  vuln_id: string
  summary: string
  severity: string
}

interface CodeScanSummary {
  critical: number
  high: number
  medium: number
  low: number
  unknown: number
  total: number
}

interface GitleaksFinding {
  file?: string
  line?: number
  rule_id?: string
  description?: string
  secret_masked?: string
  entropy?: number
  severity: string
  commit?: string | null
  author?: string | null
  date?: string | null
}

interface TruffleHogFinding {
  file?: string
  line?: number
  detector?: string
  description?: string
  verified: boolean
  secret_masked?: string
  severity: string
  commit?: string | null
  author?: string | null
  date?: string | null
}

interface TrivyFinding {
  kind: 'vuln' | 'secret' | 'misconfig'
  target?: string
  package?: string
  installed_version?: string
  fixed_version?: string
  severity: string
  vuln_id?: string
  title?: string
  category?: string
  line?: number
  message?: string
  resolution?: string
}

interface DependencyCheckFinding {
  file?: string
  package?: string
  vuln_id?: string
  severity: string
  cvss_score?: number
  description?: string
}

interface SemgrepFinding {
  file?: string
  line?: number
  rule_id?: string
  message?: string
  severity: string
  cwe?: string[]
  owasp?: string[]
}

interface CodeScanStatusResponse {
  id: string
  scan_type: 'code'
  source_type: 'repo' | 'zip' | 'image'
  source: string
  status: 'running' | 'completed' | 'error'
  startTime: string
  endTime: string | null
  error?: string
  steps: ScanStep[]
  gitleaks: { findings: GitleaksFinding[]; scanned_git_history: boolean; error: string | null }
  trufflehog: { findings: TruffleHogFinding[]; scanned_git_history: boolean; error: string | null }
  backdoors: { findings: CodeFinding[]; files_scanned: number; error: string | null }
  semgrep: { findings: SemgrepFinding[]; error: string | null }
  trivy: { findings: TrivyFinding[]; error: string | null }
  dependency_check: { findings: DependencyCheckFinding[]; error: string | null }
  summary: CodeScanSummary
}

/**
 * Inicia un análisis de código a partir de una URL de repo (GitHub,
 * GitLab o Bitbucket, público).
 */
export async function startCodeScanFromRepo(
  repoUrl: string
): Promise<ApiResponse<CodeScanStartResponse>> {
  if (!repoUrl.trim()) {
    return { error: { error: 'La URL del repositorio es requerida' } }
  }
  return apiRequest<CodeScanStartResponse>('/api/code-scan', {
    method: 'POST',
    body: JSON.stringify({ repo_url: repoUrl }),
  })
}

/**
 * Inicia un análisis de código a partir de un archivo .zip subido.
 * No usa apiRequest() porque necesita FormData (el navegador debe fijar
 * su propio Content-Type con el boundary del multipart, no 'application/json').
 */
export async function startCodeScanFromFile(
  file: File
): Promise<ApiResponse<CodeScanStartResponse>> {
  if (!file) {
    return { error: { error: 'El archivo es requerido' } }
  }
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return { error: { error: 'Solo se aceptan archivos .zip' } }
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s -- el upload puede tardar más que un JSON

    const response = await fetch(`${API_BASE_URL}/api/code-scan`, {
      method: 'POST',
      headers: {
        ...(API_TOKEN ? { 'X-API-Token': API_TOKEN } : {}),
        // Sin 'Content-Type' a propósito -- el navegador lo arma con el boundary correcto
      },
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }))
      return { error: errorData }
    }

    const data = await response.json()
    return { data }
  } catch (err) {
    return { error: { error: err instanceof Error ? err.message : 'Error subiendo el archivo' } }
  }
}

/**
 * Inicia un análisis de una imagen Docker (escaneada directo desde su
 * registro, sin necesitar Docker instalado).
 */
export async function startCodeScanFromImage(
  imageRef: string
): Promise<ApiResponse<CodeScanStartResponse>> {
  if (!imageRef.trim()) {
    return { error: { error: 'La referencia de la imagen es requerida' } }
  }
  return apiRequest<CodeScanStartResponse>('/api/code-scan', {
    method: 'POST',
    body: JSON.stringify({ image_ref: imageRef }),
  })
}

/**
 * Obtiene el estado/resultados de un análisis de código por su ID.
 */
export async function getCodeScanStatus(
  scanId: string
): Promise<ApiResponse<CodeScanStatusResponse>> {
  if (!scanId) {
    return { error: { error: 'Scan ID is required' } }
  }
  return apiRequest<CodeScanStatusResponse>(`/api/code-scan/${scanId}/status`)
}

/**
 * Obtiene el historial de análisis de código (Grupo 3) — separado del
 * historial de escaneos web porque tienen forma distinta.
 */
export async function getCodeScanHistory(): Promise<ApiResponse<{ scans: CodeScanStatusResponse[]; total: number }>> {
  return apiRequest<{ scans: CodeScanStatusResponse[]; total: number }>('/api/code-scan/history')
}

// ── Comparación entre escaneos ──────────────────────────────────────────────
// Backend: GET /api/scan/<id>/compare/<id2> (ver server/comparison.py).

export interface ComparisonFinding {
  tool: string
  title: string
  severity?: string
  raw?: unknown
}

export interface ComparisonResult {
  scan_a_id: string
  scan_b_id: string
  summary: { new: number; resolved: number; persistent: number; modified: number }
  new: ComparisonFinding[]
  resolved: ComparisonFinding[]
  persistent: ComparisonFinding[]
  modified: { before: ComparisonFinding; after: ComparisonFinding }[]
}

export async function compareScans(
  scanIdA: string,
  scanIdB: string
): Promise<ApiResponse<ComparisonResult>> {
  return apiRequest<ComparisonResult>(`/api/scan/${scanIdA}/compare/${scanIdB}`)
}

// ── Escaneos programados (Scheduler / Celery Beat) ──────────────────────────
// Backend: /api/schedules (ver server/scheduler.py + server/app.py).

export interface ScheduleOptions {
  tools?: Record<string, boolean>
  [key: string]: unknown
}

export interface Schedule {
  id: string
  target: string
  options: ScheduleOptions
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  day_of_week?: number | null
  day_of_month?: number | null
  active: boolean
  created_at: string
  last_run_at: string | null
  last_job_id: string | null
  next_run_at: string
}

export interface CreateScheduleRequest {
  target: string
  options?: ScheduleOptions
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  day_of_week?: number
  day_of_month?: number
}

export async function listSchedules(): Promise<ApiResponse<{ schedules: Schedule[] }>> {
  return apiRequest<{ schedules: Schedule[] }>('/api/schedules')
}

export async function createSchedule(req: CreateScheduleRequest): Promise<ApiResponse<Schedule>> {
  return apiRequest<Schedule>('/api/schedules', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function getSchedule(id: string): Promise<ApiResponse<Schedule>> {
  return apiRequest<Schedule>(`/api/schedules/${id}`)
}

export async function pauseSchedule(id: string): Promise<ApiResponse<Schedule>> {
  return apiRequest<Schedule>(`/api/schedules/${id}/pause`, { method: 'POST' })
}

export async function resumeSchedule(id: string): Promise<ApiResponse<Schedule>> {
  return apiRequest<Schedule>(`/api/schedules/${id}/resume`, { method: 'POST' })
}

export async function deleteSchedule(id: string): Promise<ApiResponse<{ status: string }>> {
  return apiRequest<{ status: string }>(`/api/schedules/${id}`, { method: 'DELETE' })
}

// ── Configuración de notificaciones (Email / Webhook) ───────────────────────
// Backend: /api/settings/notifications (ver server/app.py). Solo expone
// destinatario/URL/eventos activados — NUNCA credenciales (SMTP host/user/
// password quedan exclusivamente en variables de entorno del servidor).

export interface NotificationSettings {
  email_enabled: boolean
  email_to: string
  webhook_enabled: boolean
  webhook_url: string
  min_severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  events: {
    job_completed: boolean
    job_failed: boolean
    job_cancelled: boolean
  }
}

export async function getNotificationSettings(): Promise<ApiResponse<NotificationSettings>> {
  return apiRequest<NotificationSettings>('/api/settings/notifications')
}

export async function updateNotificationSettings(
  settings: NotificationSettings
): Promise<ApiResponse<NotificationSettings>> {
  return apiRequest<NotificationSettings>('/api/settings/notifications', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

// ── Exports de tipos ───────────────────────────────────────────────────────

// ── Dashboard: estadísticas agregadas reales ────────────────────────────────
// Backend: GET /api/dashboard/stats (ver server/app.py). Reemplaza los
// datos de ejemplo que usaba app/page.tsx (lib/home-mock-data.ts).

export interface DashboardRecentScan {
  id: string
  family: 'web' | 'code' | 'osint'
  target: string
  status: string
  startTime?: string
  score: number | null
}

export interface DashboardToolCount {
  tool: string
  findings: number
}

export interface DashboardStats {
  totalScans: number
  totalFindings: number
  totalVulnerabilities: number
  averageScore: number
  averageGrade: string
  riskLevel: string
  byFamily: { web: number; code: number; osint: number }
  byTool: DashboardToolCount[]
  byStatus: Record<string, number>
  breakdown: { critical: number; high: number; medium: number; low: number; info: number }
  recentActivity: DashboardRecentScan[]
}

export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  return apiRequest<DashboardStats>('/api/dashboard/stats')
}

// ── Timeline: evolución de un target a través del tiempo ────────────────────
// Backend: GET /api/timeline?target=... (ver server/app.py).

export interface TimelinePoint {
  id: string
  family: 'web' | 'code' | 'osint'
  startTime?: string
  score: number | null
  grade: string | null
  breakdown: { critical: number; high: number; medium: number; low: number; info: number } | null
}

export interface TimelineResponse {
  target: string
  points: TimelinePoint[]
}

export async function getScanTimeline(target: string): Promise<ApiResponse<TimelineResponse>> {
  return apiRequest<TimelineResponse>(`/api/timeline?target=${encodeURIComponent(target)}`)
}

export type {
  Grade,
  RiskLevel,
  SeverityBreakdown,
  CircuitBreakerConfig,
  TargetValidationConfig,
  RetryConfig,
  ScanStartRequest,
  ScanStartResponse,
  ScanStatusResponse,
  ScanStep,
  SecurityScore,
  Technology,
  Port,
  Directory,
  Vulnerability,
  Exploit,
  MetasploitFinding,
  ScanHistoryResponse,
  ConfigResponse,
  HealthResponse,
  CodeScanStartResponse,
  CodeScanStatusResponse,
  CodeFinding,
  DependencyFinding,
  GitleaksFinding,
  TruffleHogFinding,
  SemgrepFinding,
  TrivyFinding,
  DependencyCheckFinding,
  CodeScanSummary,
  BreachDetail,
  EmailBreachResponse,
  UsernameFinding,
  UsernameSearchResponse,
}