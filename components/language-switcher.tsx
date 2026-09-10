'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'

/**
 * LanguageSwitcher — SecureScan Pro
 *
 * Botón compacto ES / EN en el header.
 * Al hacer clic guarda el nuevo locale en la cookie NEXT_LOCALE
 * y refresca la página para que el middleware lo detecte.
 *
 * No requiere recarga completa — router.refresh() re-renderiza
 * los Server Components con el nuevo locale.
 */
export function LanguageSwitcher() {
  const t                          = useTranslations('language')
  const locale                     = useLocale()
  const router                     = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    const next = locale === 'es' ? 'en' : 'es'

    // Guardar en cookie — el middleware la lee en la siguiente request
    // max-age: 1 año; SameSite: Lax para compatibilidad con navegadores modernos
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 w-9 font-mono text-sm font-semibold"
      onClick={handleToggle}
      disabled={isPending}
      title={t('switchTo')}
      aria-label={t('switchTo')}
    >
      {isPending ? (
        // Spinner mínimo durante el refresh
        <span className="animate-pulse">{t('current')}</span>
      ) : (
        t('current')
      )}
    </Button>
  )
}