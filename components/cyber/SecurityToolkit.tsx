'use client'
// components/cyber/SecurityToolkit.tsx — SecureScan Pro · Home v3
//
// Grid de las herramientas reales del orchestrator. No mantiene su propia
// lista de datos: recibe `tools` desde app/page.tsx (función getTools()),
// que ya es la única fuente de verdad de nombres/iconos/orden, también usada
// por el modal de detalle y por components/scan-progress.tsx (TOOL_ORDER).
// Así se evita tener dos listas de "las mismas 10 herramientas" en el Home.

import { cn } from '@/lib/utils'

export interface ToolkitItem {
  name: string
  description: string
  step: number
  icon: React.FC<{ className?: string }>
  accentColor: string
  bgColor: string
  details: string
}

interface SecurityToolkitProps {
  tools: ToolkitItem[]
  onSelect?: (tool: ToolkitItem) => void
  className?: string
}

export function SecurityToolkit({ tools, onSelect, className }: SecurityToolkitProps) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5', className)}>
      {tools.map(tool => (
        <button
          key={tool.name}
          type="button"
          onClick={() => onSelect?.(tool)}
          className={cn(
            'group relative flex flex-col items-start gap-3 rounded-lg border p-4 text-left',
            'transition-shadow duration-200 hover:shadow-cyber-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]',
            'bg-[hsl(var(--card))]',
            tool.bgColor,
          )}
        >
          <span className="absolute right-3 top-3 font-mono text-[10px] text-muted-foreground/50">
            #{tool.step.toString().padStart(2, '0')}
          </span>
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--background))]/60">
              <tool.icon className={cn('h-5 w-5', tool.accentColor)} />
            </div>
          </div>
          <div className="min-w-0 pr-4">
            <p className={cn('font-mono text-sm font-semibold', tool.accentColor)}>
              {tool.name}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {tool.description}
            </p>
          </div>
          <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 status-dot" />
            Active
          </span>
        </button>
      ))}
    </div>
  )
}
