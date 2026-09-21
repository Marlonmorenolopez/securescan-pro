'use client'
// components/footprint/FootprintSources.tsx — SecureScan Pro v5.0
//
// Cobertura de las 7 fuentes de Huella Digital (ToolCard + ToolDetailDrawer)
// y detalle completo por fuente reutilizando los paneles existentes de
// components/results/intel/*. Las fuentes salen del Skill Registry.

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { CyberPanel } from '@/components/cyber/CyberPanel'
import { ToolCard, type ToolStatus } from '@/components/cyber/ToolCard'
import { ToolDetailDrawer } from '@/components/cyber/ToolDetailDrawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HUELLA_DIGITAL } from '@/lib/nav-config'
import { useGroupLabel } from '@/lib/nav-i18n'
import { getToolDocs, getSkillSvgIcon } from '@/lib/tool-docs'
import { staggerContainer, staggerItem } from '@/lib/motion'
import type { FootprintModel, FootprintSourceView, SourceState } from '@/lib/scan-extractors'
import { VirusTotalPanel } from '@/components/results/intel/VirusTotalPanel'
import { AbuseIPDBPanel } from '@/components/results/intel/AbuseIPDBPanel'
import { ShodanPanel } from '@/components/results/intel/ShodanPanel'
import { CrtShPanel } from '@/components/results/intel/CrtShPanel'
import { TestSSLPanel } from '@/components/results/intel/TestSSLPanel'
import { DnstwistPanel } from '@/components/results/intel/DnstwistPanel'
import { SafeBrowsingPanel } from '@/components/results/intel/SafeBrowsingPanel'

const STATE_TO_TOOL_STATUS: Record<SourceState, ToolStatus> = {
  data: 'completed', noData: 'skipped', error: 'error', notRun: 'idle',
}

/** Etiqueta de resultado con el dato real más representativo de la fuente. */
function useResultLabel() {
  const t = useTranslations('footprint')
  return (view: FootprintSourceView): string => {
    if (view.state !== 'data') return t(`state.${view.state}.short`)
    const d = view.raw
    switch (view.skill.id) {
      case 'crtsh':        return t('result.crtsh', { count: d.subdomains.length })
      case 'dnstwist':     return t('result.dnstwist', { count: d.registered_variants.length })
      case 'shodan':       return t('result.shodan', { ports: d.ports.length, cves: d.vulns.length })
      case 'virustotal':   return t('result.virustotal', { count: d.malicious + d.suspicious })
      case 'abuseipdb':    return t('result.abuseipdb', { score: d.abuse_confidence_score })
      case 'safebrowsing': return d.flagged ? t('result.safebrowsingFlagged') : t('result.safebrowsingClean')
      case 'testssl':      return t('result.testssl', { count: d.warnings?.length ?? 0 })
      default:             return ''
    }
  }
}

function DetailPanel({ view }: { view: FootprintSourceView }) {
  const d = view.raw
  switch (view.skill.id) {
    case 'crtsh':        return <CrtShPanel data={d} />
    case 'dnstwist':     return <DnstwistPanel data={d} />
    case 'shodan':       return <ShodanPanel data={d} />
    case 'virustotal':   return <VirusTotalPanel data={d} />
    case 'abuseipdb':    return <AbuseIPDBPanel data={d} />
    case 'safebrowsing': return <SafeBrowsingPanel data={d} />
    case 'testssl':      return <TestSSLPanel data={d} />
    default:             return null
  }
}

function GroupTabTrigger({ groupKey }: { groupKey: string }) {
  const group = HUELLA_DIGITAL.groups.find(g => g.key === groupKey)!
  const label = useGroupLabel(HUELLA_DIGITAL, group)
  const Icon = group.icon
  return (
    <TabsTrigger value={groupKey} className="gap-1.5 font-mono text-xs">
      <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {label}
    </TabsTrigger>
  )
}

export function FootprintSources({ model, target }: { model: FootprintModel; target?: string }) {
  const t = useTranslations('footprint')
  const tSkills = useTranslations('skills')
  const tDocs = useTranslations()
  const toolDocs = useMemo(() => getToolDocs(tDocs), [tDocs])
  const resultLabel = useResultLabel()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = model.sources.find(s => s.skill.id === selectedId)

  return (
    <div className="space-y-6">
      {/* Cobertura */}
      <CyberPanel title={t('sources.title')} subtitle={t('sources.subtitle')}>
        <motion.div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          variants={staggerContainer} initial="hidden" animate="visible"
        >
          {model.sources.map(view => (
            <motion.div key={view.skill.id} variants={staggerItem}>
              <ToolCard
                name={view.skill.name}
                icon={view.skill.icon}
                svgIcon={getSkillSvgIcon(view.skill.id)}
                color="emerald"
                description={tSkills(`${view.skill.id}.short`)}
                status={STATE_TO_TOOL_STATUS[view.state]}
                statusLabel={t(`state.${view.state}.title`)}
                resultLabel={resultLabel(view)}
                onClick={() => setSelectedId(view.skill.id)}
                className="h-full"
              />
            </motion.div>
          ))}
        </motion.div>
      </CyberPanel>

      {/* Detalle por fuente (paneles completos) */}
      <CyberPanel title={t('detail.title')} subtitle={t('detail.subtitle')}>
        <Tabs defaultValue={model.groups[0]?.key} className="w-full">
          <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
            {model.groups.map(g => <GroupTabTrigger key={g.key} groupKey={g.key} />)}
          </TabsList>
          {model.groups.map(g => (
            <TabsContent key={g.key} value={g.key} className="space-y-6">
              {g.sources.map(view => (
                <section key={view.skill.id} aria-label={view.skill.name} className="min-w-0">
                  {g.sources.length > 1 && (
                    <h3 className="mb-3 flex items-center gap-2 border-b border-[hsl(var(--border))] pb-2 font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                      <view.skill.icon aria-hidden="true" className="h-3.5 w-3.5" /> {view.skill.name}
                    </h3>
                  )}
                  <div className="overflow-x-auto"><DetailPanel view={view} /></div>
                </section>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </CyberPanel>

      <ToolDetailDrawer
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        doc={toolDocs.find(d => d.id === selectedId)}
        name={selected?.skill.name ?? selectedId ?? ''}
        color="emerald"
        status={selected ? STATE_TO_TOOL_STATUS[selected.state] : 'idle'}
        resultLabel={selected && selected.state === 'data' ? resultLabel(selected) : undefined}
        target={target}
        statusLabel={selected ? t(`state.${selected.state}.title`) : undefined}
        executionNote={t('executionNote')}
      />
    </div>
  )
}
