'use client'
// components/cyber/ToolTaxonomyStrip.tsx — SecureScan Pro v5.0
// Franja compacta que muestra la jerarquía Categoría → Grupo → Herramientas
// de una o varias NavSection (lib/nav-config.tsx). Puramente visual/informativa
// — no ejecuta nada, no toca lógica de scans. Se usa como cabecera de
// contexto en /scanner, /osint, /code-scan y /lab para que la jerarquía
// de herramientas sea legible de un vistazo.
// i18n: label de sección/grupo vía lib/nav-i18n.ts — nombres de tools no se traducen.

import { COLOR_VARS, type NavSection, type NavToolGroup } from '@/lib/nav-config'
import { useNavLabel, useGroupLabel } from '@/lib/nav-i18n'
import { cn } from '@/lib/utils'

interface ToolTaxonomyStripProps {
  sections: NavSection[]
  className?: string
}

function TaxonomyChip({ section, group }: { section: NavSection; group: NavToolGroup }) {
  const sectionLabel = useNavLabel(section)
  const groupLabel = useGroupLabel(section, group)
  const c = COLOR_VARS[section.color]
  const GroupIcon = group.icon

  return (
    <div
      className="flex items-center gap-2 rounded-full border px-3 py-1.5"
      style={{ borderColor: `rgba(${c.rgb},0.28)`, background: `rgba(${c.rgb},0.05)` }}
      title={`${sectionLabel} · ${groupLabel}`}
    >
      <GroupIcon className="h-3 w-3 shrink-0" style={{ color: c.fg }} />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider" style={{ color: c.fg }}>
        {groupLabel}
      </span>
      <span className="hidden text-[10px] text-muted-foreground sm:inline">
        {group.tools.join(' · ')}
      </span>
    </div>
  )
}

export function ToolTaxonomyStrip({ sections, className }: ToolTaxonomyStripProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {sections.flatMap((section) =>
        section.groups.map((group) => (
          <TaxonomyChip key={`${section.id}-${group.key}`} section={section} group={group} />
        ))
      )}
    </div>
  )
}
