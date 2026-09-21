'use client'
// app/page.tsx — SecureScan Pro v5.0 · Cyber Security Command Center Entry

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import {
  Shield, Scan, FileText, Server, Bug, ChevronRight,
  Lock, Zap, Target, Layers, Database, Skull, Search,
  Network, Wind, Key, Terminal, Activity, GitBranch,
  AlertTriangle, Radar, ArrowRight, CheckCircle2,
} from 'lucide-react'
import {
  WappalyzerIcon, NmapIcon, GobusterIcon, FfufIcon,
  ZapIcon as ZapToolIcon, NucleiIcon, SqlmapIcon,
  SearchsploitIcon, MetasploitIcon, PatatorIcon,
} from '@/components/tool-icons'
import { Header } from '@/components/header'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberButton } from '@/components/cyber/CyberButton'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { HoloPanel } from '@/components/cyber/HoloPanel'
import { HoloDigitalInfrastructure } from '@/components/cyber/HoloDigitalInfrastructure'
import { HeroParticles } from '@/components/cyber/HeroParticles'
import { ThreatMap } from '@/components/cyber/ThreatMap'
import { ResultsDashboardPreview } from '@/components/cyber/ResultsDashboardPreview'
import { SecurityMetrics } from '@/components/cyber/SecurityMetrics'
import { SecurityToolkit } from '@/components/cyber/SecurityToolkit'
import {
  securityScoreMock,
  topVulnerabilitiesMock,
  findingsByToolMock,
} from '@/lib/home-mock-data'
import { getDashboardStats, type DashboardStats } from '@/lib/api-client'
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

type Tool = {
  name: string
  description: string
  step: number
  icon: React.FC<{ className?: string }>
  accentColor: string
  bgColor: string
  details: string
}

type TFunc = ReturnType<typeof useTranslations>

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

export default function HomePage() {
  const t = useTranslations()
  const router = useRouter()
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [quickTarget, setQuickTarget] = useState('')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const prefersReduced = useReducedMotion() ?? false

  const sv = (v: Parameters<typeof getVariants>[0]) => getVariants(v, prefersReduced)

  const features      = getFeatures(t)
  const tools         = getTools(t)
  const workflowSteps = getWorkflowSteps(t)
  const labApps       = getLabApps(t)

  // Cargar estadísticas reales agregadas desde el backend si existen
  useEffect(() => {
    let active = true
    getDashboardStats().then((res) => {
      if (active && res.data) {
        setStats(res.data)
      }
    })
    return () => { active = false }
  }, [])

  const handleQuickScan = (e: React.FormEvent) => {
    e.preventDefault()
    if (quickTarget.trim()) {
      router.push(`/scanner?target=${encodeURIComponent(quickTarget.trim())}`)
    } else {
      router.push('/scanner')
    }
  }

  return (
    <motion.div
      className="flex min-h-screen flex-col bg-background"
      variants={sv(fadeIn)}
      initial="hidden"
      animate="visible"
    >
      <Header />

      <main className="flex-1">
        {/* ── 1. HERO CYBER SECURITY COMMAND CENTER ── */}
        <section className="relative overflow-hidden border-b border-[rgba(var(--cyber-accent-rgb),0.18)] py-16 md:py-24 bg-[radial-gradient(ellipse_100%_70%_at_50%_-20%,rgba(0,240,255,0.08),transparent)]">
          <div className="cyber-grid-bg pointer-events-none absolute inset-0 -z-10 opacity-30" />
          <HeroParticles className="pointer-events-none absolute inset-0 -z-10" />

          <div className="container mx-auto px-4">
            <div className="grid items-center gap-12 lg:grid-cols-12">

              {/* Columna Izquierda — Comando & Lanzador (7 cols) */}
              <motion.div
                className="lg:col-span-7"
                variants={sv(slideInUp)}
                initial="hidden"
                animate="visible"
              >
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--cyber-accent-rgb),0.30)] bg-[rgba(0,240,255,0.06)] px-3.5 py-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--cyber-accent)] status-dot" />
                  <span className="font-mono text-xs tracking-widest text-[var(--cyber-accent)] uppercase font-semibold">
                    CYBER SECURITY COMMAND CENTER v5.0
                  </span>
                </div>

                <h1 className="mb-4 text-balance text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
                  SECURESCAN <span className="gradient-cyber">PRO</span>
                </h1>

                <p className="font-mono text-sm uppercase tracking-widest text-[var(--cyber-accent)] mb-4">
                  Automated Web Security Platform
                </p>

                <p className="mb-8 text-pretty text-base text-muted-foreground md:text-lg max-w-xl leading-relaxed">
                  Centralized vulnerability assessment, offensive security automation & tactical threat surface analysis.
                </p>

                {/* Lanzador de Objetivo Táctico Rápido */}
                <form onSubmit={handleQuickScan} className="mb-6 flex flex-col sm:flex-row gap-2 max-w-lg">
                  <div className="relative flex-1">
                    <Target className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--cyber-accent)]" />
                    <input
                      type="text"
                      value={quickTarget}
                      onChange={(e) => setQuickTarget(e.target.value)}
                      placeholder="http://localhost:3001 o https://empresa.com"
                      className="w-full rounded-md border border-[rgba(var(--cyber-accent-rgb),0.25)] bg-[rgba(8,14,26,0.85)] pl-10 pr-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:border-[var(--cyber-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--cyber-accent)]"
                    />
                  </div>
                  <CyberButton type="submit" variant="primary" size="md" icon={<Scan className="h-4 w-4" />}>
                    {t('landing.ctaStartScan')}
                  </CyberButton>
                </form>

                {/* Acciones Secundarias */}
                <div className="flex flex-wrap items-center gap-4">
                  <Link href="/lab">
                    <CyberButton variant="ghost" size="md" icon={<Terminal className="h-4 w-4" />}>
                      EXPLORE CYBER LABS
                    </CyberButton>
                  </Link>
                  <Link href="/docs">
                    <span className="font-mono text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      Security Architecture <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </div>

                {/* Métricas de Plataforma (Datos Reales o Estado del Clúster) */}
                <div className="mt-10 pt-6 border-t border-[rgba(255,255,255,0.06)] grid grid-cols-3 gap-4 max-w-lg">
                  <div>
                    <div className="font-mono text-lg font-bold text-foreground">
                      {stats && stats.totalScans > 0 ? stats.totalScans : '10'}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                      {stats && stats.totalScans > 0 ? 'Auditorías Ejecutadas' : 'Motores Tácticos'}
                    </div>
                  </div>

                  <div>
                    <div className="font-mono text-lg font-bold text-[var(--cyber-accent)]">
                      {stats && stats.totalFindings > 0 ? stats.totalFindings : '0%'}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                      {stats && stats.totalFindings > 0 ? 'Vulnerabilidades' : 'Falsos Positivos'}
                    </div>
                  </div>

                  <div>
                    <div className="font-mono text-lg font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      {stats && stats.averageScore > 0 ? `${stats.averageScore}/100` : 'ONLINE'}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                      {stats && stats.averageScore > 0 ? 'Score Promedio' : 'Clúster Operativo'}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Columna Derecha — Representación Holográfica 3D (5 cols) */}
              <motion.div
                className="lg:col-span-5"
                variants={sv(scaleIn)}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.2 }}
              >
                <HoloDigitalInfrastructure targetName={quickTarget || 'INFRASTRUCTURE::PERIMETER'} />
              </motion.div>

            </div>
          </div>
        </section>

        {/* ── 2. PREVISUALIZACIÓN DE CENTRO DE RESULTADOS ── */}
        <section className="border-b border-[rgba(var(--cyber-accent-rgb),0.15)] py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-[var(--cyber-accent)]">
                  RESULTS COMMAND CENTER
                </p>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Evaluación Táctica de Vulnerabilidades
                </h2>
              </div>
            </div>
            <motion.div variants={sv(staggerContainer)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}>
              <ResultsDashboardPreview score={securityScoreMock} vulnerabilities={topVulnerabilitiesMock} />
            </motion.div>
          </div>
        </section>

        {/* ── 3. TOPOLOGÍA DE AMENAZAS & ACTIVIDAD ── */}
        <section className="border-b border-[rgba(var(--cyber-accent-rgb),0.15)] bg-[rgba(8,14,26,0.30)] py-16">
          <div className="container mx-auto px-4">
            <HoloPanel moduleId="MOD::SURFACE_TOPOLOGY" title="Vulnerability Surface Topology" timestamp="UTC::ACTIVE">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold tracking-tight">Superficie de Exposición de Amenazas</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Mapeo estructural de activos y vectores perimetrales del objetivo.
                </p>
              </div>
              <div className="max-w-4xl mx-auto">
                <ThreatMap />
              </div>
            </HoloPanel>
          </div>
        </section>

        {/* ── 4. ARSENAL DE SEGURIDAD (TOOL MATRIX) ── */}
        <section className="border-b border-[rgba(var(--cyber-accent-rgb),0.15)] py-20">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--cyber-accent)]">
                {t('landing.toolsEyebrow')}
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t('landing.toolsTitle')}
              </h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
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

            {/* Capacidades Técnicas de la Plataforma */}
            <div className="mt-16 border-t border-[rgba(255,255,255,0.06)] pt-12">
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
                    <CyberCard glow className="h-full">
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

          {/* Modal de Detalle de Herramienta */}
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

        {/* ── 5. PIPELINE DE AUDITORÍA (WORKFLOW STEPS) ── */}
        <section className="border-b border-[rgba(var(--cyber-accent-rgb),0.15)] bg-[rgba(8,14,26,0.30)] py-20">
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
                    'flex flex-col items-center gap-2 rounded-lg border bg-[hsl(var(--card))] p-3 text-center holo-depth-1',
                    'min-w-[92px] transition-colors duration-200 hover:border-[var(--cyber-accent)]/40',
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

        {/* ── 6. CYBER RANGE (LABORATORIOS VIRTUALES) ── */}
        <section className="border-b border-[rgba(var(--cyber-accent-rgb),0.15)] py-20">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono text-xs text-emerald-400 uppercase tracking-widest font-semibold">
                  {t('landing.labsEyebrow')}
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t('landing.labsTitle')}
              </h2>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
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
                        <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-400 font-semibold">
                          {app.badge}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold text-foreground">{app.name}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{app.desc}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-[rgba(255,255,255,0.06)]">
                      <Activity className="h-3 w-3 text-emerald-400" />
                      <span className="font-mono text-[10px] text-emerald-400 font-semibold">{app.difficulty}</span>
                    </div>
                  </CyberCard>
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-10 text-center">
              <Link href="/lab">
                <CyberButton variant="ghost" size="md" icon={<Target className="h-4 w-4" />}>
                  {t('landing.labConfigureBtn')}
                </CyberButton>
              </Link>
            </div>
          </div>
        </section>

        {/* ── 7. CTA FINAL ── */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <motion.div
              className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl p-px"
              variants={sv(scaleIn)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
            >
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-[var(--cyber-accent)] via-[var(--cyber-purple)] to-[var(--cyber-accent)] opacity-30" />
              <div className="glass relative rounded-2xl px-8 py-12 text-center md:px-14 holo-depth-2">
                <div className="relative">
                  <div className="mb-5 flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(var(--cyber-accent-rgb),0.35)] bg-[rgba(0,240,255,0.08)] shadow-[0_0_20px_rgba(0,240,255,0.2)]">
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

      {/* ── FOOTER ── */}
      <footer className="border-t border-[rgba(var(--cyber-accent-rgb),0.15)] bg-[#03060B] py-8">
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
