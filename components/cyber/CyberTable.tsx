'use client'
// components/cyber/CyberTable.tsx — SecureScan Pro v5.0
// Tabla de datos con:
//   - Header sticky con fondo semi-opaco
//   - Filas con hover cian suave
//   - Soporte de renderizado de celda personalizado (renderCell)
//   - Estado vacío configurable
//   - Scroll horizontal en móvil
//   - Sin dependencias externas

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import { Database } from 'lucide-react'

export interface CyberColumn<T> {
  key:       string
  header:    string
  width?:    string          // Clase Tailwind, ej. 'w-32'
  align?:    'left' | 'center' | 'right'
  render?:   (row: T) => ReactNode
}

interface CyberTableProps<T extends Record<string, unknown>> {
  columns:    CyberColumn<T>[]
  data:       T[]
  keyField:   keyof T
  emptyLabel?: string
  className?:  string
  /** Máximo de filas visibles antes del scroll vertical */
  maxRows?:    number
}

const alignClass = {
  left:   'text-left',
  center: 'text-center',
  right:  'text-right',
}

export function CyberTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyLabel = 'No hay datos disponibles',
  className,
  maxRows,
}: CyberTableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className={cn(maxRows && 'overflow-y-auto', maxRows && `max-h-[${maxRows * 44}px]`)}>
        <table className="w-full min-w-max text-sm">
          {/* Header */}
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground',
                    col.width,
                    alignClass[col.align ?? 'left']
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Database className="h-8 w-8 opacity-30" />
                    <span className="font-mono text-xs">{emptyLabel}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={String(row[keyField])}
                  className={cn(
                    'border-b border-[hsl(var(--border))]/50',
                    'transition-colors duration-150',
                    'hover:bg-[rgba(var(--cyber-accent-rgb),0.04)]',
                    i % 2 === 0 ? 'bg-transparent' : 'bg-[rgba(0,0,0,0.05)]'
                  )}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-foreground/85',
                        col.width,
                        alignClass[col.align ?? 'left']
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
