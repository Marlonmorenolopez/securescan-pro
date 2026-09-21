'use client'
// components/cyber/CategoryCard.tsx — SecureScan Pro v5.0
// Tarjeta grande de sección (Pentesting, OSINT, Huella Digital, etc.)
// Reutiliza CyberCard como base — extiende, no duplica.
// i18n: label/description/group label vienen de navCatalog (lib/nav-i18n.ts).

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CyberCard } from '@/components/cyber/CyberCard'
import { COLOR_VARS, type NavSection, type NavToolGroup } from '@/lib/nav-config'
import { useNavLabel, useNavDescription, useGroupLabel } from '@/lib/nav-i18n'
import { cn } from '@/lib/utils'

interface CategoryCardProps {
  section: NavSection
  className?: string
}

function GroupRow({ section, group }: { section: NavSection; group: NavToolGroup }) {
  const groupLabel = useGroupLabel(section, group)
  return (
    <Link
      href={section.href}
      className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[rgba(255,255,255,0.03)]"
    >
      <span className="text-foreground/90">{groupLabel}</span>
      <span className="truncate pl-3 text-right text-[10px] text-muted-foreground">
        {group.tools.join(', ')}
      </span>
    </Link>
  )
}

export function CategoryCard({ section, className }: CategoryCardProps) {
  const Icon = section.icon
  const c = COLOR_VARS[section.color]
  const label = useNavLabel(section)
  const description = useNavDescription(section)
  const tCommon = useTranslations('navCatalog.operationsPanel')

  return (
    <CyberCard
      variant="ghost"
      padding="p-5"
      className={cn('flex flex-col gap-4', className)}
      style={{ borderColor: `rgba(${c.rgb},0.25)`, background: `rgba(${c.rgb},0.045)` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
            style={{ color: c.fg, borderColor: `rgba(${c.rgb},0.35)`, background: `rgba(${c.rgb},0.10)` }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
            {label}
          </h3>
        </div>
        <Link
          href={section.href}
          className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors"
          style={{ color: c.fg, borderColor: `rgba(${c.rgb},0.35)` }}
        >
          {tCommon('quickAccess')} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>

      <div className="space-y-1.5">
        {section.groups.map((g) => (
          <GroupRow key={g.key} section={section} group={g} />
        ))}
      </div>
    </CyberCard>
  )
}
