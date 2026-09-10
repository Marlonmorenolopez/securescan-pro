import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { PageTransition } from '@/components/page-transition'
import { ParticlesProvider } from '@/components/particles-provider'
import './globals.css'

// FIX: eliminadas Inter y JetBrains_Mono de next/font/google
// Kali no tiene acceso a fonts.googleapis.com → causa timeout de 184s en cada carga
// Se usan fuentes del sistema equivalentes vía CSS (ver globals.css si necesitas ajustar)

export const metadata: Metadata = {
  title: {
    default: 'SecureScan Pro v5.0 - Plataforma de Analisis de Seguridad',
    template: '%s | SecureScan Pro',
  },
  description:
    'Plataforma automatizada de analisis de vulnerabilidades y pentesting profesional.',
  keywords: [
    'seguridad',
    'pentesting',
    'vulnerabilidades',
    'ciberseguridad',
    'nmap',
    'owasp',
    'zap',
  ],

  authors: [{ name: 'SecureScan Pro Team' }],
  icons: {
    icon: [
      { url: '/icon-light-100x100.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-100x100.png',  media: '(prefers-color-scheme: dark)'  },
      { url: '/icon.png',               type: 'image/png'                      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Leer locale y mensajes desde next-intl (resueltos por el middleware)
  const locale   = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {/* NextIntlClientProvider expone las traducciones a todos los Client Components */}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <ParticlesProvider>
              <PageTransition>{children}</PageTransition>
            </ParticlesProvider>
            <Toaster position="bottom-right" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}