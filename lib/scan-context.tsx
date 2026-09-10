'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import type {
  Technology,
  Port,
  Directory,
  Vulnerability,
  Exploit,
  MetasploitFinding,
  ScanStep,
  Grade,
  RiskLevel,
  SeverityBreakdown,
  SecurityScore,
} from './api-client'

export type {
  Technology,
  Port,
  Directory,
  Vulnerability,
  Exploit,
  MetasploitFinding,
  ScanStep,
  Grade,
  RiskLevel,
  SeverityBreakdown,
  SecurityScore,
}

export interface ScanResult {
  id: string
  target: string
  startTime: string
  endTime?: string
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
  steps: ScanStep[]
  technologies: Technology[]
  ports: Port[]
  directories: Directory[]
  spider_results?: { url: string }[]  // 🆕 NUEVO: Resultados del ZAP Spider
  vulnerabilities: Vulnerability[]
  exploits: Exploit[]
  metasploit: MetasploitFinding[]
  // Nuevas herramientas v3.0
  nuclei_findings: any[]        // Resultados de Nuclei
  sqli_results: any[]          // Resultados de SQLMap
  brute_force_results: any[]   // Resultados de Patator
  ffuf_endpoints: any[]        // Resultados de ffuf
  threat_intel?: Record<string, any>   // Huella Digital — VirusTotal, y próximamente más
  score: SecurityScore
}

export interface ScanOptions {
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
    // Huella Digital (Threat Intel) -- corre en paralelo, no es un "paso"
    // secuencial más. threat_intel es el switch maestro (todas o ninguna);
    // threat_intel_tools permite elegir cuáles de las 7 corren cuando el
    // maestro está activo. undefined = correr las 7 (comportamiento previo).
    threat_intel?: boolean
    threat_intel_tools?: string[]
  }
  parallel?: boolean
  dry_run?: boolean
  intensity?: 'light' | 'normal' | 'aggressive'
  sqlmap_url?: string
  sqlmap_cookie?: string
  hydra_form_path?: string
}

interface ScanContextType {
  currentScan: ScanResult | null
  scanHistory: ScanResult[]
  isScanning: boolean
  isLoading: boolean   // Alias para compatibilidad
  error: string | null
  startScan: (target: string, options?: ScanOptions) => Promise<void>
  cancelScan: () => void
  clearError: () => void
  clearHistory: () => void
  downloadReport: (scanId: string, format: 'html' | 'pdf' | 'json') => Promise<void>
  refreshHistory: () => Promise<void>
}

const ScanContext = createContext<ScanContextType | undefined>(undefined)

const API_BASE  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || ''
const AUTH_HEADER: Record<string, string> = API_TOKEN ? { 'X-API-Token': API_TOKEN } : {}

// 🆕 ACTUALIZADO: Steps con ZAP Spider y ZAP (Active) separados
const defaultSteps: ScanStep[] = [
  { name: 'Wappalyzer',   status: 'pending', progress: 0 },
  { name: 'Nmap',         status: 'pending', progress: 0 },
  { name: 'Patator',      status: 'pending', progress: 0 },
  { name: 'Metasploit',   status: 'pending', progress: 0 },
  { name: 'ffuf',         status: 'pending', progress: 0 },
  { name: 'Gobuster',     status: 'pending', progress: 0 },
  { name: 'ZAP Spider',   status: 'pending', progress: 0 },
  { name: 'ZAP',          status: 'pending', progress: 0 },
  { name: 'Nuclei',       status: 'pending', progress: 0 },
  { name: 'SQLMap',       status: 'pending', progress: 0 },
  { name: 'Searchsploit', status: 'pending', progress: 0 },
  { name: 'Scoring',      status: 'pending', progress: 0 },
]

export function ScanProvider({ children }: { children: ReactNode }) {
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null)
  const [scanHistory, setScanHistory]  = useState<ScanResult[]>([])
  const [isScanning, setIsScanning]    = useState(false)
  const [error, setError]              = useState<string | null>(null)

  const pollingIntervalRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef  = useRef<AbortController | null>(null)

  // FIX: Cleanup en desmontaje — evita memory leaks y peticiones huérfanas
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const startScan = useCallback(async (target: string, options?: ScanOptions) => {
    // Limpiar estado anterior
    setError(null)
    setIsScanning(true)
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current)
    }

    // 🆕 ACTUALIZADO: Score completo con todas las propiedades requeridas
    const initialScan: ScanResult = {
      id: '',
      target,
      startTime: new Date().toISOString(),
      status: 'running',
      steps: defaultSteps,
      technologies: [],
      ports: [],
      directories: [],
      spider_results: [],      // 🆕 NUEVO
      vulnerabilities: [],
      exploits: [],
      metasploit: [],
      nuclei_findings: [],
      sqli_results: [],
      brute_force_results: [],
      ffuf_endpoints: [],
      threat_intel: {},
      score: {
        total: 0,
        grade: 'A' as Grade,
        gradeDescription: 'Initializing scan...',
        breakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as SeverityBreakdown,
        percentages: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as SeverityBreakdown,
        exploitImpact: {
          totalExploits: 0,
          correlatedExploits: 0,
          penalty: 0
        },
        metrics: {
          totalVulnerabilities: 0,
          totalExploits: 0,
          maxCvss: 0,
          criticalCount: 0,
          highCount: 0
        },
        recommendations: [],
        riskLevel: 'PROTEGIDO' as RiskLevel
      },
    }
    setCurrentScan(initialScan)

    try {
      abortControllerRef.current = new AbortController()
      const response = await fetch(`${API_BASE}/api/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AUTH_HEADER,
        },
        body: JSON.stringify({
          target,
          options: {
            tools: {
              wappalyzer:   options?.tools?.wappalyzer   ?? true,
              nmap:         options?.tools?.nmap         ?? true,
              gobuster:     options?.tools?.gobuster     ?? true,
              zap:          options?.tools?.zap          ?? true,
              searchsploit: options?.tools?.searchsploit ?? true,
              metasploit:   options?.tools?.metasploit   ?? false,
              nuclei:       options?.tools?.nuclei       ?? true,
              sqlmap:       options?.tools?.sqlmap       ?? false,
              patator:      options?.tools?.patator      ?? false,
              ffuf:         options?.tools?.ffuf         ?? true,
            },
            parallel:          options?.parallel ?? true,
            dry_run:           options?.dry_run  ?? false,
            circuit_breaker: {
              enabled:           true,
              failure_threshold: 3,
              recovery_timeout:  60,
            },
            target_validation: {
              check_dns:          true,
              check_reachability: true,
              timeout:            10,
            },
            retry_config: {
              max_retries:   2,
              backoff_factor: 1.5,
              retry_on:      ['timeout', 'connection_error'],
            },
          },
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const jobId = data.jobId

      setCurrentScan(prev => prev ? { ...prev, id: jobId } : null)
      toast.success('Escaneo iniciado', {
        description: target,
      })

      // Polling
      const poll = async () => {
        try {
          const statusResponse = await fetch(
            `${API_BASE}/api/scan/${jobId}/status`,
            { headers: { ...AUTH_HEADER } },
          )

          if (!statusResponse.ok) {
            if (statusResponse.status === 404) {
              setError('Escaneo no encontrado. Puede haber expirado.')
              setIsScanning(false)
              return
            }
            pollingIntervalRef.current = setTimeout(poll, 3000)
            return
          }

          const scanData: ScanResult = await statusResponse.json()
          setCurrentScan(scanData)

          if (scanData.status === 'completed' || scanData.status === 'error') {
            // FIX: Limpiar AbortController al terminar
            if (abortControllerRef.current) {
              abortControllerRef.current = null
            }
            setIsScanning(false)
            if (scanData.status === 'completed') {
              setScanHistory(prev => [scanData, ...prev.filter(s => s.id !== scanData.id)].slice(0, 50))
              toast.success('Escaneo completado', {
                description: `${scanData.target} · Grade ${scanData.score?.grade ?? '—'}`,
              })
            }
            if (scanData.status === 'error') {
              setError(scanData.error || 'El escaneo encontró un error.')
              toast.error('El escaneo encontró un error', {
                description: scanData.error || scanData.target,
              })
            }
          } else {
            pollingIntervalRef.current = setTimeout(poll, 3000)
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            pollingIntervalRef.current = setTimeout(poll, 5000)
          }
        }
      }

      pollingIntervalRef.current = setTimeout(poll, 2000)

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error iniciando el escaneo.')
        setIsScanning(false)
        setCurrentScan(prev =>
          prev ? { ...prev, status: 'error', error: err.message } : null
        )
        toast.error('No se pudo iniciar el escaneo', {
          description: err.message || 'Error de conexión con el backend',
        })
      }
    }
  }, [])

  const cancelScan = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsScanning(false)
    setCurrentScan(prev =>
      prev && prev.status === 'running'
        ? { ...prev, status: 'error', endTime: new Date().toISOString(), error: 'Cancelado por el usuario' }
        : prev
    )
    toast.info('Escaneo cancelado')
  }, [])

  const clearHistory = useCallback(() => setScanHistory([]), [])

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/history`, {
        headers: { ...AUTH_HEADER },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.scans && Array.isArray(data.scans)) {
          setScanHistory(data.scans.slice(0, 50))
        }
      }
    } catch (err) {
      console.error('Error cargando historial:', err)
    }
  }, [])

  const downloadReport = useCallback(
    async (scanId: string, format: 'html' | 'pdf' | 'json') => {
      try {
        const response = await fetch(
          `${API_BASE}/api/scan/${scanId}/report?format=${format}`,
          {
            method: 'GET',
            headers: { ...AUTH_HEADER },
          }
        )
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }
        const blob = await response.blob()
        const url  = window.URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.style.display = 'none'
        a.href          = url
        a.download      = `security-report-${scanId}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } catch (err) {
        console.error('Download error:', err)
        setError(`Error descargando el reporte: ${(err as Error).message}`)
      }
    },
    [],
  )

  return (
    <ScanContext.Provider
      value={{
        currentScan,
        scanHistory,
        isScanning,
        isLoading: isScanning,
        error,
        startScan,
        cancelScan,
        clearError,
        clearHistory,
        downloadReport,
        refreshHistory,
      }}
    >
      {children}
    </ScanContext.Provider>
  )
}

export function useScan() {
  const context = useContext(ScanContext)
  if (context === undefined) {
    throw new Error('useScan must be used within a ScanProvider')
  }
  return context
}