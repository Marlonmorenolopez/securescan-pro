'use client'
// app/docs/page.tsx — SecureScan Pro v5.0
// Pestaña "Proyecto de Grado" con visor Markdown completo integrado

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  BookOpen, Code2, Layers, Network, Search, Zap, Database, Skull,
  FileText, ChevronRight, ExternalLink, Shield, Wind, Key, Target,
  X, GraduationCap, ScrollText, Scale, Rocket, Presentation,
  ChevronDown, ChevronUp, BookMarked, ArrowLeft, Loader2,
  AlertTriangle, List,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header }      from '@/components/header'
import { CyberCard }   from '@/components/cyber/CyberCard'
import { CyberPanel }  from '@/components/cyber/CyberPanel'
import { CyberButton } from '@/components/cyber/CyberButton'
import { CyberBadge }  from '@/components/cyber/CyberBadge'
import { cn } from '@/lib/utils'
import { fadeIn, slideInUp, staggerContainer, staggerItem, getVariants } from '@/lib/motion'

type TFunc = ReturnType<typeof useTranslations>

// ─── Parser Markdown liviano (sin dependencias externas) ─────────────────────
// Convierte Markdown a HTML de forma segura para mostrar en el visor.

function parseMarkdown(md: string): string {
  let html = md
    // Escapar caracteres HTML peligrosos primero
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Bloques de código (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="md-pre"><code class="md-code${lang ? ` lang-${lang}` : ''}">${code.trim()}</code></pre>`
  )

  // Código inline (`...`)
  html = html.replace(/`([^`\n]+)`/g,
    '<code class="md-inline-code">$1</code>'
  )

  // Tablas — detectar bloques de tabla completos
  html = html.replace(
    /((?:\|[^\n]+\|\n)+)/g,
    (block) => {
      const rows = block.trim().split('\n').filter(r => r.trim())
      if (rows.length < 2) return block
      const isSep = (r: string) => /^\|[\s\-:|]+\|/.test(r)
      let result = '<div class="md-table-wrap"><table class="md-table">'
      let inBody = false
      rows.forEach((row, i) => {
        if (isSep(row)) { inBody = true; return }
        const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1)
        const tag = (!inBody && i === 0) ? 'th' : 'td'
        const tr = cells.map(c => `<${tag} class="md-td">${c.trim()}</${tag}>`).join('')
        if (!inBody && i === 0) result += `<thead><tr>${tr}</tr></thead><tbody>`
        else result += `<tr>${tr}</tr>`
      })
      result += '</tbody></table></div>'
      return result
    }
  )

  // Separadores ---
  html = html.replace(/^---+$/gm, '<hr class="md-hr" />')

  // Encabezados (H1–H4)
  html = html.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')

  // Blockquotes (> ...)
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')

  // Listas no ordenadas
  html = html.replace(/((?:^[-*+] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n')
      .map(l => l.replace(/^[-*+] /, '').trim())
      .filter(Boolean)
      .map(l => `<li class="md-li">${l}</li>`)
      .join('')
    return `<ul class="md-ul">${items}</ul>`
  })

  // Listas ordenadas
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n')
      .map(l => l.replace(/^\d+\. /, '').trim())
      .filter(Boolean)
      .map(l => `<li class="md-li">${l}</li>`)
      .join('')
    return `<ol class="md-ol">${items}</ol>`
  })

  // Negrita y cursiva
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="md-strong">$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em class="md-em">$1</em>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a class="md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  )

  // Emojis en bloques de notas (> ⚠️ ... y > 💡 ...)
  // ya cubiertos por blockquote arriba

  // Párrafos — líneas sueltas que no son tags
  html = html.replace(/^(?!<[a-z]|#{1,4} |- |\d+\. |\s*$)(.+)$/gm,
    '<p class="md-p">$1</p>'
  )

  return html
}

// ─── Estilos CSS para el visor Markdown ──────────────────────────────────────

const MARKDOWN_STYLES = `
  .md-h1 { font-size: 1.6rem; font-weight: 800; color: var(--cyber-accent); margin: 2rem 0 1rem; font-family: monospace; line-height: 1.3; }
  .md-h2 { font-size: 1.25rem; font-weight: 700; color: hsl(var(--foreground)); margin: 1.75rem 0 0.75rem; font-family: monospace; padding-bottom: 0.4rem; border-bottom: 1px solid hsl(var(--border)); }
  .md-h3 { font-size: 1.05rem; font-weight: 700; color: var(--cyber-accent); margin: 1.5rem 0 0.5rem; font-family: monospace; }
  .md-h4 { font-size: 0.95rem; font-weight: 600; color: hsl(var(--foreground)); margin: 1.25rem 0 0.4rem; font-family: monospace; }
  .md-p  { color: hsl(var(--muted-foreground)); line-height: 1.75; margin: 0.5rem 0; font-size: 0.9rem; }
  .md-strong { color: hsl(var(--foreground)); font-weight: 700; }
  .md-em { color: hsl(var(--muted-foreground)); font-style: italic; }
  .md-hr { border: none; border-top: 1px solid hsl(var(--border)); margin: 1.5rem 0; }
  .md-pre {
    background: hsl(var(--muted) / 0.4);
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    padding: 1rem;
    overflow-x: auto;
    margin: 1rem 0;
  }
  .md-code { font-family: monospace; font-size: 0.8rem; color: hsl(var(--foreground)); white-space: pre; }
  .md-inline-code {
    background: rgba(var(--cyber-accent-rgb), 0.12);
    color: var(--cyber-accent);
    font-family: monospace;
    font-size: 0.8rem;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
  }
  .md-blockquote {
    border-left: 3px solid var(--cyber-accent);
    background: rgba(var(--cyber-accent-rgb), 0.05);
    color: hsl(var(--muted-foreground));
    padding: 0.6rem 1rem;
    margin: 0.75rem 0;
    border-radius: 0 0.4rem 0.4rem 0;
    font-size: 0.88rem;
    line-height: 1.6;
  }
  .md-ul { list-style: none; padding-left: 1rem; margin: 0.5rem 0; }
  .md-ol { padding-left: 1.5rem; margin: 0.5rem 0; }
  .md-li { color: hsl(var(--muted-foreground)); font-size: 0.875rem; line-height: 1.75; position: relative; padding-left: 0.5rem; }
  .md-ul .md-li::before { content: "▸"; color: var(--cyber-accent); position: absolute; left: -0.75rem; font-size: 0.7rem; top: 0.35rem; }
  .md-link { color: var(--cyber-accent); text-decoration: underline; text-underline-offset: 2px; font-size: 0.875rem; word-break: break-all; }
  .md-link:hover { opacity: 0.8; }
  .md-table-wrap { overflow-x: auto; margin: 1rem 0; border-radius: 0.5rem; border: 1px solid hsl(var(--border)); }
  .md-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .md-table thead { background: rgba(var(--cyber-accent-rgb), 0.08); }
  .md-table thead th { color: var(--cyber-accent); font-family: monospace; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; }
  .md-td { padding: 0.6rem 0.85rem; border-bottom: 1px solid hsl(var(--border)); color: hsl(var(--muted-foreground)); vertical-align: top; }
  .md-table tbody tr:last-child td { border-bottom: none; }
  .md-table tbody tr:hover { background: rgba(var(--cyber-accent-rgb), 0.03); }
`

// ─── Metadatos de los 4 documentos ──────────────────────────────────────────

const PROJECT_DOCS = [
  {
    id:       'technical',
    file:     'DOCUMENTACION_TECNICA_COMPLETA.md',
    icon:     BookMarked,
    color:    '#00e5a0',
    badge:    'Técnico',
    title:    'Documentación Técnica Completa',
    subtitle: 'Arquitectura · Módulos · API · Stack tecnológico',
    description:
      'Arquitectura en 3 capas, pipeline de 11 pasos, los 11 módulos de seguridad, API REST, infraestructura Docker, sistema de puntuación y las ~24.000 líneas de código del proyecto.',
    stats: [
      { label: 'Secciones',     value: '18'     },
      { label: 'Líneas código', value: '23.902' },
      { label: 'Herramientas',  value: '11'     },
      { label: 'Servicios',     value: '10'     },
    ],
  },
  {
    id:       'ethics',
    file:     'ETICA_Y_LEGALIDAD.md',
    icon:     Scale,
    color:    '#3b9fff',
    badge:    'Legal',
    title:    'Ética y Legalidad',
    subtitle: 'Marco legal colombiano · Uso responsable',
    description:
      'Ley 1273 de 2009, controles técnicos programados en el código, usos autorizados y no autorizados, divulgación responsable y estándares internacionales EC-Council, (ISC)², OWASP y NIST.',
    stats: [
      { label: 'Secciones',      value: '14'  },
      { label: 'Arts. legales',  value: '8+'  },
      { label: 'Controles',      value: '12'  },
      { label: 'Estándares',     value: '6'   },
    ],
  },
  {
    id:       'deployment',
    file:     'GUIA_DESPLIEGUE_SECURESCAN_PRO_v5.md',
    icon:     Rocket,
    color:    '#ffb800',
    badge:    'Despliegue',
    title:    'Guía de Despliegue Completa',
    subtitle: 'Linux · Windows 11 · Paso a paso',
    description:
      'Instalación paso a paso en Kali Linux, Ubuntu y Windows 11. Incluye configuración del .env, instalación automática con start.sh y solución a los 10 problemas más frecuentes.',
    stats: [
      { label: 'Secciones',  value: '18'  },
      { label: 'SOs',        value: '5'   },
      { label: 'Bugs doc.',  value: '35+' },
      { label: 'Comandos',   value: '60+' },
    ],
  },
  {
    id:       'presentation',
    file:     'PRESENTACION_PROYECTO_GRADO.md',
    icon:     Presentation,
    color:    '#ff6b2b',
    badge:    'Grado',
    title:    'Presentación del Proyecto de Grado',
    subtitle: '19 diapositivas · Notas del orador · 25-30 min',
    description:
      'Material completo para la sustentación ante el evaluador SENA. 19 diapositivas con contenido de pantalla y notas del orador, más 7 preguntas frecuentes del evaluador con respuestas.',
    stats: [
      { label: 'Diapositivas', value: '19'      },
      { label: 'Duración',     value: '25-30m'  },
      { label: 'Preguntas',    value: '7'       },
      { label: 'Competencias', value: '9'       },
    ],
  },
]

// ─── Visor de documento Markdown ─────────────────────────────────────────────

function MarkdownViewer({
  doc,
  onClose,
}: {
  doc: typeof PROJECT_DOCS[0]
  onClose: () => void
}) {
  const [content,  setContent]  = useState<string>('')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showToc,  setShowToc]  = useState(false)
  const [toc,      setToc]      = useState<{ level: number; text: string; id: string }[]>([])
  const Icon = doc.icon

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/docs/${doc.file}`)
      .then(r => {
        if (!r.ok) throw new Error(`No se pudo cargar el documento (${r.status})`)
        return r.text()
      })
      .then(text => {
        // Extraer índice de encabezados para el TOC
        const headings: typeof toc = []
        text.split('\n').forEach(line => {
          const m = line.match(/^(#{1,3}) (.+)$/)
          if (m) {
            const id = m[2].toLowerCase().replace(/[^a-z0-9áéíóúüñ ]/g, '').replace(/\s+/g, '-')
            headings.push({ level: m[1].length, text: m[2], id })
          }
        })
        setToc(headings)
        setContent(text)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [doc.file])

  const html = useMemo(() => (content ? parseMarkdown(content) : ''), [content])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4"
    >
      {/* Estilos del visor */}
      <style>{MARKDOWN_STYLES}</style>

      {/* Barra superior del visor */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-[var(--cyber-accent)] hover:text-[var(--cyber-accent)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${doc.color}18`, border: `1px solid ${doc.color}40` }}
        >
          <Icon className="h-5 w-5" style={{ color: doc.color }} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-sm font-bold text-foreground truncate">{doc.title}</h2>
          <p className="font-mono text-[11px] text-muted-foreground">{doc.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{ background: `${doc.color}18`, color: doc.color }}
          >
            {doc.badge}
          </span>

          {toc.length > 0 && (
            <button
              onClick={() => setShowToc(v => !v)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors',
                showToc
                  ? 'border-[var(--cyber-accent)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]'
                  : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[var(--cyber-accent)] hover:text-[var(--cyber-accent)]'
              )}
            >
              <List className="h-3.5 w-3.5" />
              Índice
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {/* TOC lateral (solo desktop) */}
        <AnimatePresence>
          {showToc && toc.length > 0 && (
            <motion.aside
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 240 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden shrink-0 overflow-hidden lg:block"
            >
              <div className="sticky top-20 max-h-[80vh] overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                <p className="mb-2 px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Índice
                </p>
                {toc.map((h, i) => (
                  <a
                    key={i}
                    href={`#${h.id}`}
                    className={cn(
                      'block truncate rounded px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-[var(--cyber-accent)]',
                      h.level === 1 && 'font-bold text-foreground',
                      h.level === 2 && 'pl-3',
                      h.level === 3 && 'pl-5 text-[11px]',
                    )}
                    onClick={() => {
                      const el = document.getElementById(h.id)
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    {h.level > 1 && <span className="mr-1 text-[var(--cyber-accent)]">›</span>}
                    {h.text}
                  </a>
                ))}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Contenido del documento */}
        <div className="min-w-0 flex-1">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-24">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--cyber-accent)]" />
              <p className="font-mono text-sm text-muted-foreground">Cargando documento…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 py-16">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="font-mono text-sm text-red-400">{error}</p>
              <p className="font-mono text-xs text-muted-foreground">
                Asegúrate de que el archivo{' '}
                <code className="text-[var(--cyber-accent)]">/public/docs/{doc.file}</code>{' '}
                existe en el proyecto.
              </p>
            </div>
          )}

          {!loading && !error && (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 lg:p-8">
              <div
                dangerouslySetInnerHTML={{ __html: html }}
                className="max-w-none"
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Tarjeta de documento (lista) ────────────────────────────────────────────

function DocCard({
  doc,
  onOpen,
  variants,
}: {
  doc: typeof PROJECT_DOCS[0]
  onOpen: () => void
  variants: import('framer-motion').Variants
}) {
  const Icon = doc.icon

  return (
    <motion.div variants={variants}>
      <CyberCard
        glow
        className="group flex h-full cursor-pointer flex-col overflow-hidden transition-all duration-300 hover:border-[var(--cyber-accent)]/60"
        onClick={onOpen}
      >
        {/* Barra de color */}
        <div className="mb-4 h-1 w-full rounded-full opacity-80" style={{ background: doc.color }} />

        {/* Encabezado */}
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
            style={{ background: `${doc.color}18`, border: `1px solid ${doc.color}40` }}
          >
            <Icon className="h-5 w-5" style={{ color: doc.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest"
              style={{ background: `${doc.color}18`, color: doc.color }}
            >
              {doc.badge}
            </span>
            <h3 className="mt-1 font-mono text-[0.92rem] font-bold leading-tight text-foreground">
              {doc.title}
            </h3>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{doc.subtitle}</p>
          </div>
        </div>

        {/* Descripción */}
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {doc.description}
        </p>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {doc.stats.map((s) => (
            <div
              key={s.label}
              className="rounded-lg p-2 text-center"
              style={{ background: `${doc.color}0d`, border: `1px solid ${doc.color}20` }}
            >
              <p className="font-mono text-base font-bold" style={{ color: doc.color }}>{s.value}</p>
              <p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Botón abrir */}
        <div className="mt-4 flex items-center justify-between border-t border-[hsl(var(--border))] pt-3">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <ScrollText className="h-3.5 w-3.5" />
            <code className="text-[var(--cyber-accent)]">/public/docs/{doc.file}</code>
          </span>
          <span
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition-colors"
            style={{ background: `${doc.color}18`, color: doc.color }}
          >
            Leer
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </CyberCard>
    </motion.div>
  )
}

// ─── Datos de herramientas / API / arquitectura (sin cambios) ────────────────

function getTools(t: TFunc) {
  return [
    { id: 'wappalyzer', name: 'Wappalyzer', icon: Layers, description: t('docs.tool1Desc'),
      usage: `# Wappalyzer via librería Python\nfrom Wappalyzer import Wappalyzer, WebPage\nwappalyzer = Wappalyzer.latest()\nwebpage = WebPage.new_from_url('https://target.com')\ntechs = wappalyzer.analyze_with_versions(webpage)`,
      features: [t('docs.tool1Feature1'), t('docs.tool1Feature2'), t('docs.tool1Feature3'), t('docs.tool1Feature4'), t('docs.tool1Feature5')],
      documentation: 'https://github.com/wappalyzer/wappalyzer' },
    { id: 'nmap', name: 'Nmap', icon: Network, description: t('docs.tool2Desc'),
      usage: `# Escaneo de puertos comunes\nnmap -sV -sC target.com\n\n# Escaneo agresivo\nnmap -A -T4 target.com\n\n# Scripts NSE de vulnerabilidades\nnmap --script vuln target.com`,
      features: [t('docs.tool2Feature1'), t('docs.tool2Feature2'), t('docs.tool2Feature3'), t('docs.tool2Feature4'), t('docs.tool2Feature5')],
      documentation: 'https://nmap.org/book/man.html' },
    { id: 'patator', name: 'Patator', icon: Key, description: t('docs.tool3Desc'),
      usage: `# Fuerza bruta HTTP POST\npatator http_fuzz url=https://target.com/login method=POST \\\n  body='user=FILE0&pass=FILE1' 0=users.txt 1=passwords.txt`,
      features: [t('docs.tool3Feature1'), t('docs.tool3Feature2'), t('docs.tool3Feature3'), t('docs.tool3Feature4'), t('docs.tool3Feature5')],
      documentation: 'https://github.com/lanjelot/patator' },
    { id: 'metasploit', name: 'Metasploit', icon: Skull, description: t('docs.tool4Desc'),
      usage: `# Iniciar msfconsole\nmsfconsole\n\n# Usar módulo auxiliar (solo scanners)\nmsf> use auxiliary/scanner/http/http_version\nmsf> set RHOSTS target.com\nmsf> run`,
      features: [t('docs.tool4Feature1'), t('docs.tool4Feature2'), t('docs.tool4Feature3'), t('docs.tool4Feature4'), t('docs.tool4Feature5')],
      documentation: 'https://docs.metasploit.com/' },
    { id: 'ffuf', name: 'ffuf', icon: Wind, description: t('docs.tool5Desc'),
      usage: `# Fuerza bruta de directorios\nffuf -u https://target.com/FUZZ -w wordlist.txt\n\n# Fuzzing de parámetros GET\nffuf -u https://target.com/page?FUZZ=value -w params.txt`,
      features: [t('docs.tool5Feature1'), t('docs.tool5Feature2'), t('docs.tool5Feature3'), t('docs.tool5Feature4'), t('docs.tool5Feature5')],
      documentation: 'https://github.com/ffuf/ffuf' },
    { id: 'gobuster', name: 'Gobuster', icon: Search, description: t('docs.tool6Desc'),
      usage: `# Fuerza bruta de directorios\ngobuster dir -u https://target.com -w wordlist.txt\n\n# Descubrimiento DNS\ngobuster dns -d target.com -w subdomains.txt`,
      features: [t('docs.tool6Feature1'), t('docs.tool6Feature2'), t('docs.tool6Feature3'), t('docs.tool6Feature4'), t('docs.tool6Feature5')],
      documentation: 'https://github.com/OJ/gobuster' },
    { id: 'zap', name: 'OWASP ZAP', icon: Zap, description: t('docs.tool7Desc'),
      usage: `# API - Spider\ncurl "http://localhost:8080/JSON/spider/action/scan/?url=https://target.com"\n\n# API - Active Scan\ncurl "http://localhost:8080/JSON/ascan/action/scan/?url=https://target.com"`,
      features: [t('docs.tool7Feature1'), t('docs.tool7Feature2'), t('docs.tool7Feature3'), t('docs.tool7Feature4'), t('docs.tool7Feature5')],
      documentation: 'https://www.zaproxy.org/docs/' },
    { id: 'nuclei', name: 'Nuclei', icon: Target, description: t('docs.tool8Desc'),
      usage: `# Escaneo con todas las plantillas\nnuclei -u https://target.com\n\n# Por severidad\nnuclei -u https://target.com -severity critical,high\n\n# Con cookie\nnuclei -u https://target.com -H "Cookie: session=abc"`,
      features: [t('docs.tool8Feature1'), t('docs.tool8Feature2'), t('docs.tool8Feature3'), t('docs.tool8Feature4'), t('docs.tool8Feature5')],
      documentation: 'https://docs.projectdiscovery.io/tools/nuclei' },
    { id: 'sqlmap', name: 'SQLMap', icon: Database, description: t('docs.tool9Desc'),
      usage: `# URL con parámetro\nsqlmap -u "https://target.com/page?id=1"\n\n# Con cookie de sesión\nsqlmap -u "https://target.com/page?id=1" --cookie="session=abc"\n\n# Formulario POST\nsqlmap -u "https://target.com/login" --data="user=admin&pass=test"`,
      features: [t('docs.tool9Feature1'), t('docs.tool9Feature2'), t('docs.tool9Feature3'), t('docs.tool9Feature4'), t('docs.tool9Feature5')],
      documentation: 'https://sqlmap.org/' },
    { id: 'searchsploit', name: 'Searchsploit', icon: FileText, description: t('docs.tool10Desc'),
      usage: `# Buscar por servicio y versión\nsearchsploit apache 2.4\n\n# Formato JSON\nsearchsploit -j wordpress 5.8\n\n# Búsqueda exacta\nsearchsploit -e "Apache 2.4.49"`,
      features: [t('docs.tool10Feature1'), t('docs.tool10Feature2'), t('docs.tool10Feature3'), t('docs.tool10Feature4'), t('docs.tool10Feature5')],
      documentation: 'https://www.exploit-db.com/searchsploit' },
  ]
}

function getApiEndpoints(t: TFunc) {
  return [
    { method: 'POST', endpoint: '/api/scan', description: t('docs.endpoint1Desc'),
      body: '{ "target": "https://example.com", "options": { "tools": {...} } }' },
    { method: 'GET', endpoint: '/api/scan/:jobId/status', description: t('docs.endpoint2Desc'),
      response: '{ "status": "running", "steps": [...], "progress": 45 }' },
    { method: 'GET', endpoint: '/api/scan/:scanId/report', description: t('docs.endpoint3Desc'),
      params: 'format=html|pdf|json|csv' },
    { method: 'GET', endpoint: '/api/history', description: t('docs.endpoint4Desc'),
      response: '{ "scans": [...], "total": 25 }' },
  ]
}

function getArchSteps(t: TFunc) {
  return [
    { step: 1, name: 'Wappalyzer', desc: t('docs.archStep1') },
    { step: 2, name: 'Nmap',       desc: t('docs.archStep2') },
    { step: 3, name: 'Patator',    desc: t('docs.archStep3') },
    { step: 4, name: 'Metasploit', desc: t('docs.archStep4') },
    { step: 5, name: 'ffuf',       desc: t('docs.archStep5') },
    { step: 6, name: 'Gobuster',   desc: t('docs.archStep6') },
    { step: 7, name: 'OWASP ZAP',  desc: t('docs.archStep7') },
    { step: 8, name: 'Nuclei',     desc: t('docs.archStep8') },
    { step: 9, name: 'SQLMap',     desc: t('docs.archStep9') },
    { step: 10, name: 'Searchsploit', desc: t('docs.archStep10') },
  ]
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DocsPage() {
  const t = useTranslations()
  const tools        = getTools(t)
  const apiEndpoints = getApiEndpoints(t)
  const archSteps    = getArchSteps(t)
  const prefersReduced = useReducedMotion() ?? false
  const sv = (v: Parameters<typeof getVariants>[0]) => getVariants(v, prefersReduced)

  const [search,      setSearch]      = useState('')
  const [activeDoc,   setActiveDoc]   = useState<typeof PROJECT_DOCS[0] | null>(null)

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tools
    return tools.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.features.some(f => f.toLowerCase().includes(q))
    )
  }, [tools, search])

  // Cerrar visor al presionar ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveDoc(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto space-y-8 px-4">

          <motion.div variants={sv(slideInUp)} initial="hidden" animate="visible">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <BookOpen className="h-6 w-6 text-[var(--cyber-accent)]" />
              {t('docs.pageTitle')}
            </h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {t('docs.pageSubtitle')}
            </p>
          </motion.div>

          <Tabs defaultValue="tools" className="space-y-6">
            <TabsList className="h-auto flex-wrap gap-2 bg-transparent p-0">
              {[
                { value: 'tools',        icon: Code2,          label: t('docs.tabTools') },
                { value: 'api',          icon: FileText,       label: t('docs.tabApi') },
                { value: 'architecture', icon: Layers,         label: t('docs.tabArchitecture') },
                { value: 'project',      icon: GraduationCap,  label: 'Proyecto de Grado' },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 font-mono text-sm data-[state=active]:border-[var(--cyber-accent)] data-[state=active]:bg-[rgba(var(--cyber-accent-rgb),0.08)] data-[state=active]:text-[var(--cyber-accent)] data-[state=active]:shadow-cyber-sm"
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── TAB: Herramientas ─────────────────────────────────────── */}
            <TabsContent value="tools" className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
                <motion.aside variants={sv(fadeIn)} initial="hidden" animate="visible" className="hidden lg:block">
                  <div className="sticky top-20 space-y-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                    <p className="mb-2 px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Índice</p>
                    {tools.map(tool => (
                      <a key={tool.id} href={`#${tool.id}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-[rgba(var(--cyber-accent-rgb),0.08)] hover:text-[var(--cyber-accent)]">
                        <tool.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{tool.name}</span>
                      </a>
                    ))}
                  </div>
                </motion.aside>

                <div className="space-y-6">
                  <motion.div variants={sv(fadeIn)} initial="hidden" animate="visible" className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder={t('docs.searchPlaceholder')}
                      className="border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-9 font-mono text-sm" />
                    {search && (
                      <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {search && <p className="mt-2 font-mono text-xs text-muted-foreground">{filteredTools.length} de {tools.length} herramientas</p>}
                  </motion.div>

                  {filteredTools.length === 0 ? (
                    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-12 text-center">
                      <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">{t('docs.searchNoResults', { query: search })}</p>
                    </div>
                  ) : (
                    <motion.div className="space-y-6" variants={sv(staggerContainer)} initial="hidden" animate="visible">
                      {filteredTools.map((tool) => (
                        <motion.div key={tool.id} variants={sv(staggerItem)}>
                          <CyberCard glow id={tool.id} className="scroll-mt-20">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(var(--cyber-accent-rgb),0.10)]">
                                  <tool.icon className="h-5 w-5 text-[var(--cyber-accent)]" />
                                </div>
                                <div>
                                  <p className="font-mono text-base font-bold text-foreground">{tool.name}</p>
                                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                                </div>
                              </div>
                              <CyberButton variant="ghost" size="sm" asChild>
                                <a href={tool.documentation} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </CyberButton>
                            </div>
                            <div className="mt-4 space-y-4">
                              <div>
                                <h4 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('docs.featuresLabel')}</h4>
                                <ul className="space-y-1">
                                  {tool.features.map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <ChevronRight className="h-3 w-3 shrink-0 text-[var(--cyber-accent)]" />{f}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <h4 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('docs.usageLabel')}</h4>
                                <pre className="overflow-x-auto rounded-lg bg-[hsl(var(--muted))]/40 p-4 font-mono text-sm text-foreground">{tool.usage}</pre>
                              </div>
                            </div>
                          </CyberCard>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── TAB: API ─────────────────────────────────────────────── */}
            <TabsContent value="api" className="space-y-6">
              <motion.div variants={sv(fadeIn)} initial="hidden" animate="visible">
                <CyberPanel title={t('docs.apiTitle')} subtitle={t('docs.apiSubtitle')}>
                  <div className="space-y-4">
                    {apiEndpoints.map((ep, i) => (
                      <div key={i} className="rounded-lg border border-[hsl(var(--border))] p-4">
                        <div className="flex items-center gap-2">
                          <span className={cn('rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide',
                            ep.method === 'POST'
                              ? 'bg-[rgba(var(--cyber-accent-rgb),0.15)] text-[var(--cyber-accent)]'
                              : 'bg-[hsl(var(--muted))]/60 text-muted-foreground')}>
                            {ep.method}
                          </span>
                          <code className="font-mono text-sm text-foreground">{ep.endpoint}</code>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{ep.description}</p>
                        {ep.body     && <pre className="mt-2 overflow-x-auto rounded bg-[hsl(var(--muted))]/40 p-2 font-mono text-xs text-muted-foreground">{t('docs.bodyLabel')}: {ep.body}</pre>}
                        {ep.response && <pre className="mt-2 overflow-x-auto rounded bg-[hsl(var(--muted))]/40 p-2 font-mono text-xs text-muted-foreground">{t('docs.responseLabel')}: {ep.response}</pre>}
                        {ep.params   && <pre className="mt-2 overflow-x-auto rounded bg-[hsl(var(--muted))]/40 p-2 font-mono text-xs text-muted-foreground">{t('docs.paramsLabel')}: {ep.params}</pre>}
                      </div>
                    ))}
                  </div>
                </CyberPanel>
              </motion.div>
              <motion.div variants={sv(fadeIn)} initial="hidden" animate="visible">
                <CyberPanel title={t('docs.exampleTitle')} subtitle={t('docs.exampleSubtitle')}>
                  <pre className="overflow-x-auto rounded-lg bg-[hsl(var(--muted))]/40 p-4 font-mono text-sm text-foreground">
{`const response = await fetch('/api/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    target: 'https://example.com',
    options: { tools: { wappalyzer: true, nmap: true, zap: true, nuclei: true } }
  })
});
const { jobId } = await response.json();

// Polling cada 2 segundos
const poll = async () => {
  const res = await fetch(\`/api/scan/\${jobId}/status\`);
  return res.json();
};`}
                  </pre>
                </CyberPanel>
              </motion.div>
            </TabsContent>

            {/* ── TAB: Arquitectura ────────────────────────────────────── */}
            <TabsContent value="architecture" className="space-y-6">
              <motion.div variants={sv(fadeIn)} initial="hidden" animate="visible">
                <CyberPanel title={t('docs.archTitle')} subtitle={t('docs.archSubtitle')}>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {archSteps.map((item, index, arr) => (
                        <div key={item.step} className="flex items-center gap-2">
                          <div className="flex flex-col items-center rounded-lg border border-[hsl(var(--border))] p-4 text-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(var(--cyber-accent-rgb),0.15)] font-mono text-sm font-bold text-[var(--cyber-accent)]">{item.step}</div>
                            <span className="mt-2 font-mono text-sm font-medium text-foreground">{item.name}</span>
                            <span className="text-xs text-muted-foreground">{item.desc}</span>
                          </div>
                          {index < arr.length - 1 && <ChevronRight className="hidden h-5 w-5 text-muted-foreground lg:block" />}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-[hsl(var(--border))] p-4">
                      <h4 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('docs.stackTitle')}</h4>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <span className="font-mono text-sm font-medium text-foreground">{t('docs.stackFrontend')}</span>
                          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                            <li>Next.js 16 + TypeScript 5.4</li>
                            <li>Tailwind CSS + shadcn/ui</li>
                            <li>React 19 + TanStack Query</li>
                          </ul>
                        </div>
                        <div>
                          <span className="font-mono text-sm font-medium text-foreground">{t('docs.stackBackend')}</span>
                          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                            <li>Python 3.11 + Flask + Gunicorn</li>
                            <li>Redis 7 para resultados</li>
                            <li>10 servicios Docker</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </CyberPanel>
              </motion.div>
              <motion.div variants={sv(fadeIn)} initial="hidden" animate="visible">
                <CyberPanel title={t('docs.fileStructureTitle')}>
                  <pre className="overflow-x-auto rounded-lg bg-[hsl(var(--muted))]/40 p-4 font-mono text-sm text-foreground">
{`securescan-pro/
├── app/                    # Next.js 16 App Router
│   ├── scanner/           # Scanner principal
│   ├── history/           # Historial de scans
│   ├── lab/               # Laboratorio Docker
│   └── docs/              # Documentación
├── server/                # Backend Python
│   ├── app.py            # Flask API (1.068 líneas)
│   ├── modules/          # 11 herramientas
│   │   ├── orchestrator.py    (1.234 líneas)
│   │   ├── injection_scanner.py (1.720 líneas)
│   │   └── ...
│   └── utils/
│       ├── scoring.py    # Puntuación 0-100
│       └── reporter.py   # HTML/PDF/JSON/CSV
└── docker-compose.yml     # 10 servicios`}
                  </pre>
                </CyberPanel>
              </motion.div>
            </TabsContent>

            {/* ── TAB: Proyecto de Grado (con visor Markdown) ──────────── */}
            <TabsContent value="project" className="space-y-6">
              <AnimatePresence mode="wait">
                {activeDoc ? (
                  /* Visor de documento abierto */
                  <MarkdownViewer
                    key={activeDoc.id}
                    doc={activeDoc}
                    onClose={() => setActiveDoc(null)}
                  />
                ) : (
                  /* Lista de documentos */
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Banner */}
                    <div className="relative overflow-hidden rounded-xl border border-[var(--cyber-accent)]/30 bg-[rgba(var(--cyber-accent-rgb),0.05)] p-6">
                      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #00e5a0, transparent)' }} />
                      <div className="relative flex flex-wrap items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[rgba(var(--cyber-accent-rgb),0.15)]">
                          <GraduationCap className="h-7 w-7 text-[var(--cyber-accent)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-mono text-lg font-bold text-foreground">
                            Documentación del Proyecto de Grado
                          </h2>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            SENA · Técnico en Seguridad de Aplicaciones Web · Colombia, 2026
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <CyberBadge type="info" label="4 documentos" size="sm" />
                          <CyberBadge type="low"  label="v5.0.0"       size="sm" />
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          { label: 'Líneas de código', value: '23.902', color: '#00e5a0' },
                          { label: 'Herramientas',     value: '11',     color: '#3b9fff' },
                          { label: 'Bugs resueltos',   value: '35+',    color: '#ffb800' },
                          { label: 'Servicios Docker', value: '10',     color: '#ff6b2b' },
                        ].map(s => (
                          <div key={s.label} className="rounded-lg border p-3 text-center"
                            style={{ borderColor: `${s.color}30`, background: `${s.color}0a` }}>
                            <p className="font-mono text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Nota sobre los archivos */}
                    <div className="flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                      <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cyber-accent)]" />
                      <div>
                        <p className="font-mono text-sm font-medium text-foreground">
                          Documentos disponibles en el repositorio
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Haz clic en cualquier tarjeta para leer el documento completo aquí mismo.
                          Los archivos Markdown se sirven desde{' '}
                          <code className="rounded bg-[hsl(var(--muted))]/60 px-1.5 py-0.5 font-mono text-xs text-[var(--cyber-accent)]">
                            /public/docs/
                          </code>
                        </p>
                      </div>
                    </div>

                    {/* Tarjetas de documentos */}
                    <motion.div
                      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
                      variants={sv(staggerContainer)}
                      initial="hidden"
                      animate="visible"
                    >
                      {PROJECT_DOCS.map((doc) => (
                        <DocCard
                          key={doc.id}
                          doc={doc}
                          onOpen={() => setActiveDoc(doc)}
                          variants={sv(staggerItem)}
                        />
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>

          <motion.div className="flex items-center justify-center gap-4 py-8"
            variants={sv(fadeIn)} initial="hidden" animate="visible">
            <CyberButton variant="primary" asChild icon={<Shield className="h-4 w-4" />}>
              <Link href="/scanner">{t('docs.goToScanner')}</Link>
            </CyberButton>
            <CyberButton variant="outline" asChild>
              <Link href="/lab">{t('docs.configureLab')}</Link>
            </CyberButton>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
