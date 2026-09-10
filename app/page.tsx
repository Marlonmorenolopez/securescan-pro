'use client'
// app/page.tsx — SecureScan Pro v5.0 · Landing Page Premium
// Semana 5: Framer Motion. Migración i18n: 100% de los textos visibles
// ahora usan t('landing.xxx') vía next-intl — sin strings hardcodeados.
//
// Los arrays de datos (features, tools, workflowSteps, labApps) se generan
// dentro de funciones get*() que reciben `t`, porque su contenido textual
// depende del idioma activo. Iconos, colores y estructura permanecen
// estáticos — solo el texto se resuelve por idioma.

import Link from 'next/link'
import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import {
  Shield, Scan, FileText, Server, Bug, ChevronRight,
  Lock, Zap, Target, Layers, Database, Skull, Search,
  Network, Wind, Key, Terminal, Activity, GitBranch,
  AlertTriangle, Radar,
} from 'lucide-react'
import {
  WappalyzerIcon, NmapIcon, GobusterIcon, FfufIcon,
  ZapIcon as ZapToolIcon, NucleiIcon, SqlmapIcon,
  SearchsploitIcon, MetasploitIcon, PatatorIcon,
} from '@/components/tool-icons'
import { Header } from '@/components/header'
import { CyberCard }   from '@/components/cyber/CyberCard'
import { CyberButton } from '@/components/cyber/CyberButton'
import { CyberBadge }  from '@/components/cyber/CyberBadge'
import { HeroParticles } from '@/components/cyber/HeroParticles'
import { SecurityOverview } from '@/components/cyber/SecurityOverview'
import { ThreatMap } from '@/components/cyber/ThreatMap'
import { ResultsDashboardPreview } from '@/components/cyber/ResultsDashboardPreview'
import { SecurityMetrics } from '@/components/cyber/SecurityMetrics'
import { SecurityToolkit } from '@/components/cyber/SecurityToolkit'
import { RecentActivity } from '@/components/cyber/RecentActivity'
import {
  securityOverviewMock,
  securityScoreMock,
  topVulnerabilitiesMock,
  findingsByToolMock,
  recentActivityMock,
} from '@/lib/home-mock-data'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  fadeIn, slideInUp, staggerContainer, staggerItem,
  scaleIn, glowHover, glowTap, getVariants,
} from '@/lib/motion'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tool = {
  name:        string
  description: string
  step:        number
  icon:        React.FC<{ className?: string }>
  accentColor: string
  bgColor:     string
  details:     string
}

type TFunc = ReturnType<typeof useTranslations>

// ─── Generadores de datos (dependen del idioma vía `t`) ───────────────────────
// Iconos/colores son fijos; el texto se resuelve con t('landing.xxx').

function getFeatures(t: TFunc) {
  return [
    { icon: Scan,      title: t('landing.feature1Title'), description: t('landing.feature1Desc'), color: 'text-[var(--cyber-accent)]', bg: 'bg-[rgba(var(--cyber-accent-rgb),0.08)]' },
    { icon: Bug,       title: t('landing.feature2Title'), description: t('landing.feature2Desc'), color: 'text-red-400',     bg: 'bg-red-500/10'     },
    { icon: Server,    title: t('landing.feature3Title'), description: t('landing.feature3Desc'), color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: Database,  title: t('landing.feature4Title'), description: t('landing.feature4Desc'), color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
    { icon: GitBranch, title: t('landing.feature5Title'), description: t('landing.feature5Desc'), color: 'text-violet-400',  bg: 'bg-violet-500/10'  },
    { icon: FileText,  title: t('landing.feature6Title'), description: t('landing.feature6Desc'), color: 'text-orange-400',  bg: 'bg-orange-500/10'  },
  ]
}

function getTools(t: TFunc): Tool[] {
  return [
    { name: 'Wappalyzer',  step: 1,  description: t('landing.tool1Desc'),  accentColor: 'text-blue-400',   bgColor: 'bg-blue-500/10 border-blue-500/20',     icon: WappalyzerIcon,   details: t('landing.tool1Details')  },
    { name: 'Nmap',        step: 2,  description: t('landing.tool2Desc'),  accentColor: 'text-cyan-400',   bgColor: 'bg-cyan-500/10 border-cyan-500/20',     icon: NmapIcon,         details: t('landing.tool2Details')  },
    { name: 'Patator',     step: 3,  description: t('landing.tool3Desc'),  accentColor: 'text-lime-400',   bgColor: 'bg-lime-500/10 border-lime-500/20',     icon: PatatorIcon,      details: t('landing.tool3Details')  },
    { name: 'Metasploit',  step: 4,  description: t('landing.tool4Desc'),  accentColor: 'text-violet-400', bgColor: 'bg-violet-500/10 border-violet-500/20', icon: MetasploitIcon,   details: t('landing.tool4Details')  },
    { name: 'ffuf',        step: 5,  description: t('landing.tool5Desc'),  accentColor: 'text-sky-400',    bgColor: 'bg-sky-500/10 border-sky-500/20',       icon: FfufIcon,         details: t('landing.tool5Details')  },
    { name: 'Gobuster',    step: 6,  description: t('landing.tool6Desc'),  accentColor: 'text-teal-400',   bgColor: 'bg-teal-500/10 border-teal-500/20',     icon: GobusterIcon,     details: t('landing.tool6Details')  },
    { name: 'OWASP ZAP',   step: 7,  description: t('landing.tool7Desc'),  accentColor: 'text-blue-400',   bgColor: 'bg-blue-500/10 border-blue-500/20',     icon: ZapToolIcon,      details: t('landing.tool7Details')  },
    { name: 'Nuclei',      step: 8,  description: t('landing.tool8Desc'),  accentColor: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20', icon: NucleiIcon,       details: t('landing.tool8Details')  },
    { name: 'SQLMap',      step: 9,  description: t('landing.tool9Desc'),  accentColor: 'text-red-400',    bgColor: 'bg-red-500/10 border-red-500/20',       icon: SqlmapIcon,       details: t('landing.tool9Details')  },
    { name: 'Searchsploit', step: 10, description: t('landing.tool10Desc'), accentColor: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20',  icon: SearchsploitIcon, details: t('landing.tool10Details') },
  ]
}

function getWorkflowSteps(t: TFunc) {
  return [
    { step: 1,  title: t('landing.step1Title'),  tool: 'Wappalyzer',  icon: Layers,   color: 'border-blue-500/40   text-blue-400'   },
    { step: 2,  title: t('landing.step2Title'),  tool: 'Nmap',         icon: Network,  color: 'border-cyan-500/40   text-cyan-400'   },
    { step: 3,  title: t('landing.step3Title'),  tool: 'Patator',      icon: Key,      color: 'border-lime-500/40   text-lime-400'   },
    { step: 4,  title: t('landing.step4Title'),  tool: 'Metasploit',   icon: Skull,    color: 'border-violet-500/40 text-violet-400' },
    { step: 5,  title: t('landing.step5Title'),  tool: 'ffuf',         icon: Wind,     color: 'border-sky-500/40    text-sky-400'    },
    { step: 6,  title: t('landing.step6Title'),  tool: 'Gobuster',     icon: Search,   color: 'border-teal-500/40   text-teal-400'   },
    { step: 7,  title: t('landing.step7Title'),  tool: 'OWASP ZAP',    icon: Zap,      color: 'border-blue-500/40   text-blue-400'   },
    { step: 8,  title: t('landing.step8Title'),  tool: 'Nuclei',       icon: Target,   color: 'border-purple-500/40 text-purple-400' },
    { step: 9,  title: t('landing.step9Title'),  tool: 'SQLMap',       icon: Database, color: 'border-red-500/40    text-red-400'    },
    { step: 10, title: t('landing.step10Title'), tool: 'Searchsploit', icon: FileText, color: 'border-amber-500/40  text-amber-400'  },
  ]
}

function getLabApps(t: TFunc) {
  return [
    { name: 'OWASP Juice Shop', port: 3001, difficulty: t('landing.lab1Difficulty'), desc: t('landing.lab1Desc'), icon: '🥤', badge: t('landing.lab1Badge') },
    { name: 'DVWA',             port: 3002, difficulty: t('landing.lab2Difficulty'), desc: t('landing.lab2Desc'), icon: '⚠️', badge: t('landing.lab2Badge') },
    { name: 'WebGoat',          port: 3003, difficulty: t('landing.lab3Difficulty'), desc: t('landing.lab3Desc'), icon: '🎯', badge: t('landing.lab3Badge') },
  ]
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const t = useTranslations()
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const prefersReduced = useReducedMotion() ?? false

  const sv = (v: Parameters<typeof getVariants>[0]) => getVariants(v, prefersReduced)

  const features       = getFeatures(t)
  const tools           = getTools(t)
  const workflowSteps = getWorkflowSteps(t)
  const labApps         = getLabApps(t)

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background"
      variants={sv(fadeIn)}
      initial="hidden"
      animate="visible"
    >
      <Header />

      <main className="flex-1">

        {/* ── 1. HERO SOC ── */}
        <section className="relative overflow-hidden border-b border-[hsl(var(--border))] py-20 md:py-28">
          <div className="cyber-grid-bg pointer-events-none absolute inset-0 -z-10 opacity-70" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(var(--cyber-accent-rgb),0.12),transparent)]" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_40%_40%_at_80%_60%,rgba(124,58,237,0.08),transparent)]" />
          <HeroParticles className="pointer-events-none absolute inset-0 -z-10" />

          <div className="container mx-auto px-4">
            <div className="grid items-center gap-12 lg:grid-cols-2">

              {/* Columna izquierda — mensaje + CTA */}
              <motion.div
                variants={sv(slideInUp)}
                initial="hidden"
                animate="visible"
              >
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--cyber-accent-rgb),0.25)] bg-[rgba(var(--cyber-accent-rgb),0.06)] px-4 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--cyber-accent)] animate-[cyber-pulse_2s_ease-in-out_infinite]" />
                  <span className="font-mono text-xs tracking-widest text-[var(--cyber-accent)] uppercase">
                    {t('landing.badge')}
                  </span>
                </div>

                <h1 className="mb-6 text-balance text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                  {t('landing.heroTitle1')}{' '}
                  <span className="gradient-cyber cyber-glow-text">{t('landing.heroTitle2')}</span>
                </h1>

                <p className="mb-10 text-pretty text-lg text-muted-foreground md:text-xl">
                  {t('landing.heroSubtitle')}
                </p>

                <div className="flex flex-col items-start gap-3 sm:flex-row">
                  <Link href="/scanner">
                    <motion.div whileHover={prefersReduced ? undefined : glowHover} whileTap={prefersReduced ? undefined : glowTap}>
                      <CyberButton variant="primary" size="lg" icon={<Scan className="h-4 w-4" />}>
                        {t('landing.ctaStartScan')}
                      </CyberButton>
                    </motion.div>
                  </Link>
                  <Link href="/lab">
                    <motion.div whileHover={prefersReduced ? undefined : glowHover} whileTap={prefersReduced ? undefined : glowTap}>
                      <CyberButton variant="ghost" size="lg" icon={<Terminal className="h-4 w-4" />}>
                        {t('landing.ctaViewLabs')}
                      </CyberButton>
                    </motion.div>
                  </Link>
                </div>

                <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
                  {[
                    { icon: Radar,  label: t('landing.feature1Title') },
                    { icon: Shield, label: t('landing.feature2Title') },
                    { icon: FileText, label: t('landing.feature6Title') },
                  ].map(item => (
                    <span key={item.label} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <item.icon className="h-3.5 w-3.5 text-[var(--cyber-accent)]" />
                      {item.label}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Columna derecha — panel SOC en vivo (terminal + mini overview) */}
              <motion.div
                variants={sv(scaleIn)}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.2 }}
                className="relative"
              >
                <CyberCard padding="p-0" glow className="overflow-hidden text-left">
                  <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground tracking-wider">
                      {t('landing.terminalWindowTitle')}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 status-dot" />
                      Live
                    </span>
                  </div>
                  <div className="space-y-1.5 px-4 py-4 font-mono text-xs">
                    <motion.p className="text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                      <span className="text-[var(--cyber-green)]">✓</span> Wappalyzer
                      <span className="text-[var(--cyber-accent)]"> → </span>
                      {t('landing.terminalLine1')}
                    </motion.p>
                    <motion.p className="text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
                      <span className="text-[var(--cyber-green)]">✓</span> Nmap
                      <span className="text-[var(--cyber-accent)]"> → </span>
                      {t('landing.terminalLine2')}
                    </motion.p>
                    <motion.p className="text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                      <span className="text-[var(--cyber-green)]">✓</span> OWASP ZAP
                      <span className="text-[var(--cyber-accent)]"> → </span>
                      {t('landing.terminalLine3')}
                    </motion.p>
                    <motion.p className="text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 }}>
                      <span className="text-amber-400">!</span>  Nuclei
                      <span className="text-[var(--cyber-accent)]"> → </span>
                      {t('landing.terminalLine4')}
                    </motion.p>
                    <p>
                      <span className="text-[var(--cyber-accent)] animate-[terminal-blink_1s_step-end_infinite]">█</span>
                    </p>
                  </div>

                  {/* Mini footer estilo SOC: grade + risk del último scan de ejemplo */}
                  <div className="flex items-center justify-between gap-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/40 px-4 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Último scan · ejemplo
                    </span>
                    <div className="flex items-center gap-2">
                      <CyberBadge type="medium" label={securityScoreMock.riskLevel} size="sm" />
                      <span className="font-mono text-sm font-bold text-blue-400">{securityScoreMock.grade}</span>
                    </div>
                  </div>
                </CyberCard>
              </motion.div>

            </div>
          </div>
        </section>

        {/* ── 2. SECURITY OVERVIEW ── */}
        <section className="border-b border-[hsl(var(--border))] py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--cyber-accent)]">
                  Security Overview
                </p>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Postura de seguridad agregada
                </h2>
              </div>
              <span className="hidden rounded border border-[hsl(var(--border))] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline-block">
                Datos de ejemplo
              </span>
            </div>
            <motion.div variants={sv(staggerContainer)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}>
              <SecurityOverview data={securityOverviewMock} />
            </motion.div>
          </div>
        </section>

        {/* ── 3. THREAT INTELLIGENCE MAP ── */}
        <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 text-center">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--cyber-accent)]">
                Threat Intelligence
              </p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Global Threat Landscape
              </h2>
              <p className="mt-3 text-muted-foreground">
                Visualización conceptual — SecureScan aún no integra geolocalización ni feeds de threat intel.
              </p>
            </div>
            <motion.div
              variants={sv(scaleIn)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mx-auto max-w-4xl"
            >
              <ThreatMap />
            </motion.div>
          </div>
        </section>

        {/* ── 4. RESULTS DASHBOARD PREVIEW ── */}
        <section className="border-b border-[hsl(var(--border))] py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--cyber-accent)]">
                  Results Dashboard
                </p>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Así se ve un reporte real de SecureScan
                </h2>
              </div>
            </div>
            <motion.div variants={sv(staggerContainer)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}>
              <ResultsDashboardPreview score={securityScoreMock} vulnerabilities={topVulnerabilitiesMock} />
            </motion.div>
          </div>
        </section>

        {/* ── 5. SECURITY METRICS ── */}
        <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 text-center">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--cyber-accent)]">
                Security Metrics
              </p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Hallazgos en perspectiva
              </h2>
            </div>
            <motion.div variants={sv(staggerContainer)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}>
              <SecurityMetrics breakdown={securityScoreMock.breakdown} byTool={findingsByToolMock} />
            </motion.div>
          </div>
        </section>


        {/* ── 6. SECURITY TOOLKIT (incluye capacidades de la plataforma) ── */}
        <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 py-20">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--cyber-accent)]">
                {t('landing.toolsEyebrow')}
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t('landing.toolsTitle')}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {t('landing.toolsSubtitle')}
              </p>
            </div>

            <motion.div
              variants={sv(staggerContainer)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
            >
              <SecurityToolkit tools={tools} onSelect={setSelectedTool} />
            </motion.div>

            {/* Capacidades de la plataforma — antes "Features", ahora como cierre de contexto del toolkit */}
            <div className="mt-16 border-t border-[hsl(var(--border))] pt-12">
              <div className="mb-10 text-center">
                <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--cyber-accent)]">
                  {t('landing.featuresEyebrow')}
                </p>
                <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {t('landing.featuresTitle')}
                </h3>
              </div>
              <motion.div
                className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
                variants={sv(staggerContainer)}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
              >
                {features.map((f) => (
                  <motion.div key={f.title} variants={sv(staggerItem)} whileHover={prefersReduced ? undefined : { y: -3 }}>
                    <CyberCard glow>
                      <div className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-lg', f.bg)}>
                        <f.icon className={cn('h-5 w-5', f.color)} />
                      </div>
                      <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                    </CyberCard>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* Modal accesible con Dialog de Radix — detalle de herramienta */}
          <Dialog open={!!selectedTool} onOpenChange={(open) => !open && setSelectedTool(null)}>
            {selectedTool && (
              <DialogContent className="max-w-md border-[rgba(var(--cyber-accent-rgb),0.25)] bg-[hsl(var(--card))] p-0">
                <div className="flex items-center gap-4 border-b border-[hsl(var(--border))] p-5">
                  <div className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
                    selectedTool.bgColor
                  )}>
                    <selectedTool.icon className={cn('h-6 w-6', selectedTool.accentColor)} />
                  </div>
                  <DialogHeader className="flex-1 min-w-0 space-y-0.5">
                    <DialogTitle className={cn('font-mono text-base', selectedTool.accentColor)}>
                      {selectedTool.name}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      {selectedTool.description}
                    </DialogDescription>
                  </DialogHeader>
                  <CyberBadge type="info" label={`#${selectedTool.step}`} size="sm" />
                </div>
                <div className="p-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selectedTool.details}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-5 py-4">
                  <span className="font-mono text-xs text-muted-foreground">
                    {t('landing.toolStepOf', { step: selectedTool.step, total: tools.length })}
                  </span>
                  <CyberButton variant="primary" size="sm" onClick={() => setSelectedTool(null)}>
                    {t('landing.toolModalConfirm')}
                  </CyberButton>
                </div>
              </DialogContent>
            )}
          </Dialog>
        </section>

        {/* ── 7. RECENT ACTIVITY ── */}
        <section className="border-b border-[hsl(var(--border))] py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--cyber-accent)]">
                Recent Activity
              </p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Últimos escaneos en la plataforma
              </h2>
            </div>
            <motion.div variants={sv(scaleIn)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}>
              <RecentActivity scans={recentActivityMock} />
            </motion.div>
          </div>
        </section>

        {/* ── 8. WORKFLOW ── */}
        <section className="border-b border-[hsl(var(--border))] py-20">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--cyber-accent)]">
                {t('landing.workflowEyebrow')}
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t('landing.workflowTitle')}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {t('landing.workflowSubtitle')}
              </p>
            </div>

            <motion.div
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center lg:justify-center lg:gap-2"
              variants={sv(staggerContainer)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
            >
              {workflowSteps.map((item, index) => (
                <motion.div key={item.step} variants={sv(staggerItem)} className="flex items-center gap-2">
                  <div className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border bg-[hsl(var(--card))] p-3 text-center',
                    'min-w-[88px] transition-colors duration-200 hover:bg-[rgba(var(--cyber-accent-rgb),0.04)]',
                    item.color.split(' ')[0],
                  )}>
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs font-bold',
                      item.color,
                    )}>
                      {item.step}
                    </div>
                    <item.icon className={cn('h-4 w-4', item.color.split(' ')[1])} />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-foreground leading-tight">
                      {item.title}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{item.tool}</span>
                  </div>
                  {index < workflowSteps.length - 1 && (
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/40 lg:block" />
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── 9. LABS PREVIEW ── */}
        <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 py-20">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest">
                  {t('landing.labsEyebrow')}
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t('landing.labsTitle')}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {t('landing.labsSubtitle')}
              </p>
            </div>

            <motion.div
              className="mx-auto grid max-w-4xl gap-5 md:grid-cols-3"
              variants={sv(staggerContainer)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
            >
              {labApps.map((app) => (
                <motion.div key={app.name} variants={sv(staggerItem)} whileHover={prefersReduced ? undefined : { y: -3 }}>
                  <CyberCard glow variant="success" className="flex h-full flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{app.icon}</span>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono text-[10px] text-muted-foreground">:{app.port}</span>
                        <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-400">
                          {app.badge}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold text-foreground">{app.name}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{app.desc}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-auto">
                      <Activity className="h-3 w-3 text-emerald-400" />
                      <span className="font-mono text-[10px] text-emerald-400">{app.difficulty}</span>
                    </div>
                  </CyberCard>
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-8 text-center">
              <Link href="/lab">
                <CyberButton variant="ghost" size="md" icon={<Target className="h-4 w-4" />}>
                  {t('landing.labConfigureBtn')}
                </CyberButton>
              </Link>
            </div>
          </div>
        </section>

        {/* ── 10. CTA FINAL ── */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <motion.div
              className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl p-px"
              variants={sv(scaleIn)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
            >
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-[var(--cyber-accent)] via-[var(--cyber-purple)] to-[var(--cyber-accent)] opacity-40" />
              <div className="glass relative rounded-2xl px-8 py-12 text-center md:px-14">
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(var(--cyber-accent-rgb),0.08),transparent)]" />
                <div className="relative">
                  <div className="mb-5 flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(var(--cyber-accent-rgb),0.30)] bg-[rgba(var(--cyber-accent-rgb),0.08)]">
                      <Shield className="h-7 w-7 text-[var(--cyber-accent)]" />
                    </div>
                  </div>
                  <h2 className="mb-4 text-2xl font-bold tracking-tight md:text-3xl">
                    {t('landing.ctaFinalTitle')}
                  </h2>
                  <p className="mb-8 text-muted-foreground">
                    {t('landing.ctaFinalSubtitle')}
                  </p>
                  <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link href="/scanner">
                      <CyberButton variant="primary" size="lg" icon={<Scan className="h-4 w-4" />}>
                        {t('landing.ctaNewScan')}
                      </CyberButton>
                    </Link>
                    <Link href="/history">
                      <CyberButton variant="outline" size="lg">
                        {t('landing.ctaViewReports')}
                      </CyberButton>
                    </Link>
                  </div>
                  <p className="mt-6 font-mono text-xs text-muted-foreground/60">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    {t('landing.legalNotice')}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

      </main>

      {/* ── 11. FOOTER ── */}
      <footer className="border-t border-[hsl(var(--border))] py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-4 w-4 text-[var(--cyber-accent)]" />
            <span className="font-mono text-sm font-semibold">SecureScan Pro v5.0</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('landing.footerTagline')}
          </p>
        </div>
      </footer>
    </motion.div>
  )
}
