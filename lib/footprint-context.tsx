'use client'

// lib/footprint-context.tsx — PentaWark
//
// Estado de dominio EXCLUSIVO de Huella Digital (Threat Intel).
//
// Antes, Huella Digital vivía dentro de ScanProvider (lib/scan-context.tsx) y
// compartía con Pentesting `currentScan`, `scanHistory`, `isScanning` y
// `error`. Ahora cada módulo tiene su propio Provider:
//
//   Pentesting     → ScanProvider      (lib/scan-context.tsx)
//   Huella Digital → FootprintProvider (este archivo)
//
// Este archivo NO importa nada de scan-context y scan-context NO importa nada
// de este archivo: ningún estado viaja de un módulo al otro.
//
// Ejecución: POST /api/footprint es SÍNCRONO (la respuesta ya llega con
// status 'completed'), por eso aquí no hay polling.
// Historial: GET /api/history?module=footprint (el backend separa por módulo).

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

import type { ScanStep } from './api-client'

/** Resultado de un análisis de Huella Digital (contrato real de /api/footprint). */
export interface FootprintScan {
  id: string
  target: string
  startTime: string
  endTime?: string
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
  steps: ScanStep[]
  /** Resultados de las fuentes de Threat Intel — ver lib/scan-extractors.ts */
  threat_intel: Record<string, any>
  /** Opciones tal cual las devolvió el backend (scan_data['options']). */
  options?: Record<string, unknown>
}

interface FootprintContextType {
  currentScan: FootprintScan | null
  scanHistory: FootprintScan[]
  isScanning: boolean
  error: string | null
  startFootprintScan: (target: string, enabledTools?: string[]) => Promise<void>
  clearError: () => void
  refreshHistory: () => Promise<void>
}

const FootprintContext = createContext<FootprintContextType | undefined>(undefined)

const API_BASE  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || ''
const AUTH_HEADER: Record<string, string> = API_TOKEN ? { 'X-API-Token': API_TOKEN } : {}

const FOOTPRINT_STEP = 'Huella Digital'

export function FootprintProvider({ children }: { children: ReactNode }) {
  const [currentScan, setCurrentScan]   = useState<FootprintScan | null>(null)
  const [scanHistory, setScanHistory]   = useState<FootprintScan[]>([])
  const [isScanning, setIsScanning]     = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup en desmontaje — evita peticiones huérfanas
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const startFootprintScan = useCallback(async (target: string, enabledTools?: string[]) => {
    setError(null)
    setIsScanning(true)

    const initialScan: FootprintScan = {
      id: '',
      target,
      startTime: new Date().toISOString(),
      status: 'running',
      steps: [{ name: FOOTPRINT_STEP, status: 'running', progress: 0 }],
      threat_intel: {},
    }
    setCurrentScan(initialScan)

    try {
      abortControllerRef.current = new AbortController()
      const response = await fetch(`${API_BASE}/api/footprint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AUTH_HEADER,
        },
        body: JSON.stringify({
          target,
          options: enabledTools !== undefined ? { tools: enabledTools } : {},
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const base = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(errorData.reason ? `${base} (${errorData.reason})` : base)
      }

      const data = await response.json()

      const completedScan: FootprintScan = {
        ...initialScan,
        id: data.id ?? '',
        target: data.target ?? target,
        startTime: data.startTime ?? initialScan.startTime,
        endTime: data.endTime,
        status: 'completed',
        steps: [{ name: FOOTPRINT_STEP, status: 'completed', progress: 100 }],
        threat_intel: data.threat_intel ?? {},
        options: data.options,
      }

      setCurrentScan(completedScan)
      setScanHistory(prev => [completedScan, ...prev.filter(s => s.id !== completedScan.id)].slice(0, 50))
      setIsScanning(false)
      abortControllerRef.current = null
      toast.success('Huella Digital completada', {
        description: target,
      })
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error ejecutando Huella Digital.')
        setIsScanning(false)
        setCurrentScan(prev =>
          prev ? { ...prev, status: 'error', error: err.message } : null
        )
        toast.error('No se pudo completar Huella Digital', {
          description: err.message || 'Error de conexión con el backend',
        })
      }
    }
  }, [])

  // Historial PROPIO: el backend filtra por módulo, no es un filtro visual.
  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/history?module=footprint`, {
        headers: { ...AUTH_HEADER },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.scans && Array.isArray(data.scans)) {
          setScanHistory(data.scans.slice(0, 50))
        }
      }
    } catch (err) {
      console.error('Error cargando historial de Huella Digital:', err)
    }
  }, [])

  return (
    <FootprintContext.Provider
      value={{
        currentScan,
        scanHistory,
        isScanning,
        error,
        startFootprintScan,
        clearError,
        refreshHistory,
      }}
    >
      {children}
    </FootprintContext.Provider>
  )
}

export function useFootprint() {
  const context = useContext(FootprintContext)
  if (context === undefined) {
    throw new Error('useFootprint must be used within a FootprintProvider')
  }
  return context
}
