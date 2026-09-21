'use client'
// components/cyber/HolographicTerminal.tsx — SecureScan Pro v5.0 · Tactical CLI HUD Terminal

import { useState, useRef, useEffect } from 'react'
import { Terminal, Copy, Check, ArrowDown, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TerminalLine {
  id?: string | number
  text: string
  timestamp?: string
  level?: 'info' | 'success' | 'warn' | 'error' | 'debug'
}

export interface HolographicTerminalProps {
  title?: string
  lines?: string[] | TerminalLine[]
  maxHeight?: string
  autoScroll?: boolean
  className?: string
}

export function HolographicTerminal({
  title = 'TACTICAL ENGINE TELEMETRY',
  lines = [],
  maxHeight = '280px',
  autoScroll = true,
  className,
}: HolographicTerminalProps) {
  const [copied, setCopied] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(autoScroll)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Parse strings to formatted line
  const parsedLines: TerminalLine[] = lines.map((l, i) => {
    if (typeof l === 'string') {
      let level: TerminalLine['level'] = 'info'
      if (l.includes('[+]') || l.toLowerCase().includes('success') || l.toLowerCase().includes('completed')) level = 'success'
      if (l.includes('[-]') || l.toLowerCase().includes('error') || l.toLowerCase().includes('fail') || l.toLowerCase().includes('critical')) level = 'error'
      if (l.includes('[!]') || l.toLowerCase().includes('warn') || l.toLowerCase().includes('alert')) level = 'warn'
      return { id: i, text: l, level }
    }
    return l
  })

  useEffect(() => {
    if (shouldAutoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, shouldAutoScroll])

  const copyToClipboard = () => {
    const rawText = parsedLines.map((l) => l.text).join('\n')
    navigator.clipboard.writeText(rawText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        'relative rounded-lg border border-[rgba(var(--cyber-accent-rgb),0.20)] bg-[#03060B] font-mono text-xs shadow-2xl',
        fullscreen ? 'fixed inset-4 z-50 flex flex-col' : '',
        className
      )}
    >
      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[rgba(8,14,26,0.85)] px-3 py-1.5 text-[11px] select-none">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="h-3.5 w-3.5 text-[var(--cyber-accent)]" />
          <span className="font-semibold text-foreground/80 tracking-wider text-[10px] uppercase">
            {title}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShouldAutoScroll(!shouldAutoScroll)}
            title={shouldAutoScroll ? 'Desactivar auto-scroll' : 'Activar auto-scroll'}
            className={cn(
              'p-1 rounded hover:bg-slate-800 text-muted-foreground transition-colors',
              shouldAutoScroll && 'text-[var(--cyber-accent)]'
            )}
          >
            <ArrowDown className="h-3 w-3" />
          </button>

          <button
            onClick={copyToClipboard}
            title="Copiar log"
            className="p-1 rounded hover:bg-slate-800 text-muted-foreground transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>

          <button
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? 'Restaurar' : 'Pantalla completa'}
            className="p-1 rounded hover:bg-slate-800 text-muted-foreground transition-colors"
          >
            {fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={scrollRef}
        className={cn(
          'overflow-y-auto p-3 font-mono space-y-1 text-slate-300 leading-relaxed scanline',
          fullscreen ? 'flex-1 max-h-none' : ''
        )}
        style={{ maxHeight: fullscreen ? 'none' : maxHeight }}
      >
        {parsedLines.length === 0 ? (
          <div className="text-muted-foreground/50 py-4 text-center italic">
            Esperando telemetría del motor de escaneo...
          </div>
        ) : (
          parsedLines.map((line, idx) => {
            let colorClass = 'text-slate-300'
            if (line.level === 'success') colorClass = 'text-emerald-400 font-medium'
            if (line.level === 'error') colorClass = 'text-red-400 font-medium'
            if (line.level === 'warn') colorClass = 'text-amber-400'
            if (line.level === 'debug') colorClass = 'text-muted-foreground/60'

            return (
              <div key={line.id ?? idx} className="flex items-start gap-2 group hover:bg-slate-900/40 px-1 rounded">
                <span className="text-muted-foreground/40 select-none text-[10px] w-6 shrink-0 text-right">
                  {idx + 1}
                </span>
                <span className={cn('break-all text-[11.5px]', colorClass)}>
                  {line.text}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
