// components/cyber/EmptyState.tsx — SecureScan Pro
//
// Estado vacío reutilizable, consistente para todas las tabs de
// results-dashboard.tsx (y cualquier otra sección sin datos). Antes, cada
// tab tenía su propio nivel de cuidado: algunas solo texto plano, otras
// ícono+título+detalle — esto unifica todas a un mismo patrón visual.

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  /** Detalle opcional — explica brevemente por qué está vacío o cómo activar
   * la herramienta correspondiente (ej. "Activa SQLMap en la configuración…") */
  detail?: string
  /** Tamaño compacto para tabs con poco espacio (Nuclei, Patator, ffuf antes
   * solo tenían un <p> de una línea) vs. el tamaño estándar con ícono grande. */
  size?: 'compact' | 'default'
  className?: string
}

export function EmptyState({ icon: Icon, title, detail, size = 'default', className }: EmptyStateProps) {
  if (size === 'compact') {
    return (
      <div className={cn('flex flex-col items-center gap-2 py-8 text-center', className)}>
        <Icon className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{title}</p>
        {detail && <p className="max-w-sm text-xs text-muted-foreground/80">{detail}</p>}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center gap-3 py-12 text-center', className)}>
      <Icon className="h-10 w-10 text-muted-foreground/30" />
      <p className="font-medium text-muted-foreground">{title}</p>
      {detail && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{detail}</p>}
    </div>
  )
}
