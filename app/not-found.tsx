'use client'
// app/not-found.tsx — SecureScan Pro
//
// Página 404 personalizada. Hereda automáticamente NextIntlClientProvider,
// ThemeProvider y ParticlesProvider del layout raíz (app/layout.tsx), ya que
// Next.js renderiza not-found.tsx como children dentro de ese layout — no
// hace falta volver a montarlos aquí.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { Search, Home, Scan, History, Beaker, BookOpen } from 'lucide-react'
import { Header } from '@/components/header'
import { CyberCard }   from '@/components/cyber/CyberCard'
import { CyberButton } from '@/components/cyber/CyberButton'
import { scaleIn, slideInUp, staggerContainer, staggerItem, getVariants } from '@/lib/motion'

export default function NotFound() {
  const t = useTranslations('notFound')
  const pathname = usePathname()
  const prefersReduced = useReducedMotion() ?? false
  const sv = (v: Parameters<typeof getVariants>[0]) => getVariants(v, prefersReduced)

  const quickLinks = [
    { href: '/',         label: 'Home',    icon: Home     },
    { href: '/scanner',  label: 'Scanner', icon: Scan     },
    { href: '/history',  label: 'History', icon: History  },
    { href: '/lab',      label: 'Lab',     icon: Beaker   },
    { href: '/docs',     label: 'Docs',    icon: BookOpen },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="cyber-grid-bg pointer-events-none fixed inset-0 -z-10 opacity-40" />

        <motion.div
          className="w-full max-w-lg"
          variants={sv(scaleIn)}
          initial="hidden"
          animate="visible"
        >
          <CyberCard glow className="text-center">
            <motion.div variants={sv(slideInUp)} initial="hidden" animate="visible">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <Search className="h-8 w-8 text-red-400" />
              </div>

              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/[0.06] px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-red-400">
                {t('badge')}
              </span>

              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {t('title')}
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                {t('subtitle')}
              </p>

              {pathname && (
                <div className="mx-auto mt-5 max-w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-4 py-2.5">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t('searchedPath')}
                  </p>
                  <code className="mt-0.5 block truncate font-mono text-sm text-red-400">
                    {pathname}
                  </code>
                </div>
              )}

              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/">
                  <CyberButton variant="primary" icon={<Home className="h-4 w-4" />}>
                    {t('goHome')}
                  </CyberButton>
                </Link>
                <Link href="/scanner">
                  <CyberButton variant="outline" icon={<Scan className="h-4 w-4" />}>
                    {t('goScanner')}
                  </CyberButton>
                </Link>
              </div>
            </motion.div>

            <div className="mt-8 border-t border-[hsl(var(--border))] pt-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {t('quickLinksTitle')}
              </p>
              <motion.div
                className="flex flex-wrap items-center justify-center gap-2"
                variants={sv(staggerContainer)}
                initial="hidden"
                animate="visible"
              >
                {quickLinks.map(link => (
                  <motion.div key={link.href} variants={sv(staggerItem)}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-[rgba(var(--cyber-accent-rgb),0.40)] hover:text-[var(--cyber-accent)]"
                    >
                      <link.icon className="h-3.5 w-3.5" />
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </CyberCard>
        </motion.div>
      </main>
    </div>
  )
}
