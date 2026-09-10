'use client'
 
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Github, Menu, X, Moon, Sun, Monitor, Bell } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from '@/components/language-switcher'
import { getHealth } from '@/lib/api-client'

type SystemStatus = 'checking' | 'online' | 'offline'

/**
 * Indicador "Sistema: Online/Offline" — polling silencioso contra
 * /api/health (vía getHealth(), timeout corto, sin reintentos).
 * No bloquea ni afecta el resto del Header si el backend está caído.
 */
function SystemStatusIndicator() {
  const t = useTranslations('nav')
  const [status, setStatus] = useState<SystemStatus>('checking')

  useEffect(() => {
    let active = true

    const check = async () => {
      const res = await getHealth()
      if (!active) return
      setStatus(res.data?.status === 'healthy' ? 'online' : 'offline')
    }

    check()
    const id = setInterval(check, 15000)
    return () => { active = false; clearInterval(id) }
  }, [])

  const config: Record<SystemStatus, { label: string; dot: string; text: string }> = {
    checking: { label: t('systemChecking'), dot: 'h-1.5 w-1.5 rounded-full bg-muted-foreground/50',          text: 'text-muted-foreground' },
    online:   { label: t('systemOnline'),   dot: 'status-dot bg-emerald-400',                                 text: 'text-emerald-400'      },
    offline:  { label: t('systemOffline'),  dot: 'h-1.5 w-1.5 rounded-full bg-red-400',                       text: 'text-red-400'          },
  }
  const cfg = config[status]

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-2.5 py-1 lg:flex"
      title={t('systemTooltip')}
    >
      <span className={cfg.dot} />
      <span className={cn('font-mono text-[10px] uppercase tracking-wider', cfg.text)}>
        {cfg.label}
      </span>
    </span>
  )
}
 
interface HeaderProps {}

export function Header({}: HeaderProps) {
  const t = useTranslations('nav')

  // navItems se construye dentro del componente para acceder a las traducciones
  const navItems = [
    { href: '/',         label: t('home')    },
    { href: '/dashboard', label: t('dashboard') },
    { href: '/scanner',  label: t('scanner') },
    { href: '/code-scan', label: t('codeScan') },
    { href: '/osint',    label: t('osint') },
    { href: '/history',  label: t('history') },
    { href: '/schedules', label: t('schedules') },
    { href: '/lab',      label: t('lab')     },
    { href: '/docs',     label: t('docs')    },
  ]

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { setTheme, resolvedTheme } = useTheme()
 
  // CRÍTICO: sin este guard, next-themes causa hydration mismatch
  // y el toggle queda congelado o muestra el ícono equivocado
  useEffect(() => {
    setMounted(true)
  }, [])
 
  // resolvedTheme resuelve 'system' al valor real ('light' | 'dark')
  const isDark = mounted && resolvedTheme === 'dark'
 
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border))]/60 bg-background/85 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden border border-[rgba(var(--cyber-accent-rgb),0.20)] bg-[rgba(var(--cyber-accent-rgb),0.06)] transition-all group-hover:border-[rgba(var(--cyber-accent-rgb),0.45)]">
            <img
              src={isDark ? '/icon-dark-100x100.png' : '/icon-light-100x100.png'}
              alt="SecureScan Pro"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
          </div>
          <div className="hidden flex-col sm:flex">
            <span className="font-mono text-sm font-semibold leading-tight">SecureScan Pro</span>
            <span className="font-mono text-[10px] text-[var(--cyber-accent)]">v5.0</span>
          </div>
        </Link>
 
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 font-mono text-xs font-medium uppercase tracking-wider transition-colors',
                'hover:bg-[rgba(var(--cyber-accent-rgb),0.08)] hover:text-[var(--cyber-accent)]',
                pathname === item.href
                  ? 'bg-[rgba(var(--cyber-accent-rgb),0.10)] text-[var(--cyber-accent)]'
                  : 'text-muted-foreground'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
 
        <div className="flex items-center gap-2">
          <SystemStatusIndicator />

          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
            <Link href="/settings/notifications">
              <Bell className="h-4 w-4" />
              <span className="sr-only">{t('settings')}</span>
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            {mounted ? (
              isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <Sun className="h-4 w-4 opacity-0" />
            )}
            <span className="sr-only">{t('toggleTheme')}</span>
          </Button>
 
          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
            <a
              href="https://github.com/Marlonmorenolopez/SecureScan"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
              <span className="sr-only">{t('github')}</span>
            </a>
          </Button>

          {/* Selector de idioma ES / EN */}
          <LanguageSwitcher />
 
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
 
      {mobileMenuOpen && (
        <nav className="border-t border-border bg-background md:hidden">
          <div className="container mx-auto flex flex-col gap-1 p-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2 font-mono text-xs font-medium uppercase tracking-wider transition-colors',
                  'hover:bg-[rgba(var(--cyber-accent-rgb),0.08)] hover:text-[var(--cyber-accent)]',
                  pathname === item.href
                    ? 'bg-[rgba(var(--cyber-accent-rgb),0.10)] text-[var(--cyber-accent)]'
                    : 'text-muted-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}