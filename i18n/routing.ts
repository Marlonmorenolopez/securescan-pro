import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'en'] as const,
  defaultLocale: 'es',
  localePrefix: 'never',
})
