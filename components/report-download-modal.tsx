'use client'

/**
 * ReportDownloadModal — SecureScan Pro v5.0
 *
 * Modal de descarga de reportes con selección de formato,
 * nombre automático con fecha/hora y diálogo "Guardar como...".
 *
 * Integración:
 *   1. Copiar este archivo a components/report-download-modal.tsx
 *   2. En results-dashboard.tsx reemplazar los botones de descarga
 *      por <ReportDownloadModal scanId={currentScan.id} />
 */

import { useState, useCallback } from 'react'
import { Download, FileText, Terminal, Loader2, CheckCircle2, XCircle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── Tipos ─────────────────────────────────────────────────────────────────

type Format = 'pdf' | 'html' | 'json'
type DownloadState = 'idle' | 'loading' | 'success' | 'error'

interface FormatOption {
  id: Format
  label: string
  description: string
  icon: React.ReactNode
  badge: string
  badgeVariant: 'default' | 'secondary' | 'outline'
}

interface ReportDownloadModalProps {
  scanId: string
}

// ── Configuración de formatos ──────────────────────────────────────────────

// FORMAT_OPTIONS movido dentro de ReportDownloadModal — ver B3-c

// ── Utilidades ────────────────────────────────────────────────────────────

function getTimestampedFilename(format: Format): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`
  return `reporte_${date}_${time}.${format}`
}

function getMimeType(format: Format): string {
  return {
    pdf: 'application/pdf',
    html: 'text/html',
    json: 'application/json',
  }[format]
}

// ── Componente principal ──────────────────────────────────────────────────

export function ReportDownloadModal({ scanId }: ReportDownloadModalProps) {
  const t = useTranslations('report')

  const FORMAT_OPTIONS: FormatOption[] = [
    {
      id: 'pdf',
      label: 'PDF',
      description: t('pdfDesc'),
      icon: <FileText className="h-5 w-5" />,
      badge: t('recommended'),
      badgeVariant: 'default',
    },
    {
      id: 'html',
      label: 'HTML',
      description: t('htmlDesc'),
      icon: <FileText className="h-5 w-5" />,
      badge: t('interactive'),
      badgeVariant: 'secondary',
    },
    {
      id: 'json',
      label: 'JSON',
      description: t('jsonDesc'),
      icon: <Terminal className="h-5 w-5" />,
      badge: t('rawData'),
      badgeVariant: 'outline',
    },
  ]

  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Format>('pdf')
  const [state, setState] = useState<DownloadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
  const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || ''

  const handleDownload = useCallback(async () => {
    setState('loading')
    setErrorMsg('')

    try {
      const url = `${API_BASE}/api/scan/${scanId}/report?format=${selected}&api_token=${API_TOKEN}`
      const response = await fetch(url, {
        headers: API_TOKEN ? { 'X-API-Token': API_TOKEN } : {},
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      const filename = getTimestampedFilename(selected)
      const mimeType = getMimeType(selected)

      // Intentar File System Access API (muestra "Guardar como..." nativo)
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [
              {
                description: `Archivo ${selected.toUpperCase()}`,
                accept: { [mimeType]: [`.${selected}`] },
              },
            ],
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          setState('success')
          setTimeout(() => { setState('idle'); setOpen(false) }, 1500)
          return
        } catch (err: any) {
          // Usuario canceló el diálogo → no es error real
          if (err?.name === 'AbortError') {
            setState('idle')
            return
          }
          // Fallback a método clásico si falla la API
        }
      }

      // Fallback: enlace invisible con atributo download
      const objectUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }))
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)

      setState('success')
      setTimeout(() => { setState('idle'); setOpen(false) }, 1500)

    } catch (err: any) {
      setErrorMsg(err?.message || 'Error desconocido al generar el reporte')
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }, [scanId, selected, API_BASE, API_TOKEN])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Botón disparador */}
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" />
        {t('button')}
      </Button>

      {/* Overlay + Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-border bg-background shadow-2xl"
            style={{ margin: '1rem' }}
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t('subtitle')}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="ml-4 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Opciones de formato */}
            <div className="flex flex-col gap-2 p-5">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelected(opt.id)}
                  className={cn(
                    'w-full rounded-lg border p-4 text-left transition-all',
                    selected === opt.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border hover:border-border/80 hover:bg-accent/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Selector circular */}
                    <div className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      selected === opt.id
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/40'
                    )}>
                      {selected === opt.id && (
                        <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">{opt.label}</span>
                        <Badge variant={opt.badgeVariant} className="text-xs py-0">
                          {opt.badge}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-normal whitespace-normal break-words">
                        {opt.description}
                      </p>
                      <p className="mt-1.5 font-mono text-xs text-muted-foreground/70 whitespace-normal break-all">
                        {getTimestampedFilename(opt.id)}
                      </p>
                    </div>

                    <div className={cn(
                      'shrink-0 transition-colors self-start',
                      selected === opt.id ? 'text-primary' : 'text-muted-foreground/50'
                    )}>
                      {opt.icon}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Feedback de error */}
            {state === 'error' && errorMsg && (
              <div className="mx-5 mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Pie del modal */}
            <div className="flex items-center justify-end gap-2 border-t border-border p-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={state === 'loading'}>
                {t('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={state === 'loading' || state === 'success'}
                className="min-w-[130px]"
              >
                {state === 'loading' && (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('generating')}
                  </>
                )}
                {state === 'success' && (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t('downloaded')}
                  </>
                )}
                {(state === 'idle' || state === 'error') && (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {t('saveAs')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}