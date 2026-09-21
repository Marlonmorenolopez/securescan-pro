'use client'
// components/cyber/ToolDetailDrawer.tsx — SecureScan Pro v5.0
//
// Vista de detalle de UNA herramienta (punto 18 del documento original:
// icono+nombre, descripción, target, estado, resultados). Reutiliza la
// metadata real ya existente en lib/tool-docs.ts (extraída de /docs, no
// inventada) + el estado/resultado real que ya calcula cada página
// (ToolStatus, resultLabel, target del scan actual).
//
// IMPORTANTE — por qué no hay botón "Ejecutar" aquí: en la arquitectura
// real, las herramientas de Pentesting NO se ejecutan individualmente —
// corren todas juntas como un único Web Scan orquestado por
// SecurityOrchestrator (ver ScanForm/scan-context). Agregar un botón de
// ejecución individual sería inventar una capacidad de backend que no
// existe. En su lugar, se explica esto y se enlaza al formulario real.

import { useEffect } from 'react'
import { X, ExternalLink, Terminal, ListChecks, Activity } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ToolDoc } from '@/lib/tool-docs'
import type { ToolStatus } from '@/components/cyber/ToolCard'
import { COLOR_VARS, type CyberColor } from '@/lib/nav-config'
import { cn } from '@/lib/utils'

interface ToolDetailDrawerProps {
  open: boolean
  onClose: () => void
  doc: ToolDoc | undefined
  /** Nombre real mostrado aunque no haya ToolDoc (ej. Injection Scanner, ZAP Spider) */
  name: string
  color?: CyberColor
  status: ToolStatus
  resultLabel?: string
  target?: string
  /** Sustituye la nota de ejecución por defecto (ej. las fuentes de Huella Digital
   *  corren en la fase paralela del análisis, no en el pipeline de Pentesting). */
  executionNote?: string
  /** Sustituye el texto de estado genérico (ej. "Sin datos reales") */
  statusLabel?: string
}

const STATUS_TEXT: Record<ToolStatus, string> = {
  idle: 'idle', running: 'running', completed: 'completed', error: 'error', skipped: 'skipped',
}

export function ToolDetailDrawer({
  open, onClose, doc, name, color = 'cyan', status, resultLabel, target, executionNote, statusLabel,
}: ToolDetailDrawerProps) {
  const t = useTranslations('toolDetail')
  const c = COLOR_VARS[color]
  const statusText = statusLabel ?? t(`status.${STATUS_TEXT[status]}`)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={name}
    >
      <div
        className="glass-surface depth-3 holo-edge relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border"
        style={{ borderColor: `rgba(${c.rgb},0.3)` }}
      >
        {/* Cabecera */}
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
              style={{ color: c.fg, borderColor: `rgba(${c.rgb},0.35)`, background: `rgba(${c.rgb},0.10)` }}
            >
              {doc ? <doc.icon className="h-5 w-5" /> : <Terminal className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="font-mono text-sm font-bold text-foreground">{name}</h2>
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: c.fg }}>
                {statusText}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[hsl(var(--secondary))] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Target + estado + resultado — datos reales del scan actual */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {target && (
              <div className="rounded-lg border border-[hsl(var(--border))] p-2.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{t('target')}</div>
                <div className="truncate font-mono text-xs text-foreground">{target}</div>
              </div>
            )}
            <div className="rounded-lg border border-[hsl(var(--border))] p-2.5">
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{t('statusLabel')}</div>
              <div className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                <Activity className="h-3 w-3" style={{ color: c.fg }} />
                {statusText}
              </div>
            </div>
            {resultLabel && (
              <div className="rounded-lg border border-[hsl(var(--border))] p-2.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{t('result')}</div>
                <div className="font-mono text-xs font-bold text-foreground">{resultLabel}</div>
              </div>
            )}
          </div>

          {doc ? (
            <>
              {/* Descripción real (misma fuente que /docs) */}
              <p className="text-sm leading-relaxed text-muted-foreground">{doc.description}</p>

              {/* Features */}
              {doc.features?.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <ListChecks className="h-3 w-3" /> {t('features')}
                  </div>
                  <ul className="space-y-1">
                    {doc.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: c.fg }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Uso real (comando/API real de la herramienta) */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Terminal className="h-3 w-3" /> {t('usage')}
                </div>
                <pre className="overflow-x-auto rounded-lg border border-[hsl(var(--border))] bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
                  {doc.usage}
                </pre>
              </div>

              <a
                href={doc.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]"
                style={{ color: c.fg }}
              >
                {t('officialDocs')} <ExternalLink className="h-3 w-3" />
              </a>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{t('noDocs')}</p>
          )}

          {/* Nota honesta sobre el modelo de ejecución real */}
          <div
            className={cn('rounded-lg border p-3 text-xs leading-relaxed text-muted-foreground')}
            style={{ borderColor: `rgba(${c.rgb},0.2)`, background: `rgba(${c.rgb},0.04)` }}
          >
            {executionNote ?? t('executionNote')}
          </div>
        </div>
      </div>
    </div>
  )
}
