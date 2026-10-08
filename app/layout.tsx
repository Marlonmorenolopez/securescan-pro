import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { PageTransition } from '@/components/page-transition'
import { ParticlesProvider } from '@/components/particles-provider'
import { Sidebar } from '@/components/cyber/Sidebar'
import { ScanProvider } from '@/lib/scan-context'
import { FootprintProvider } from '@/lib/footprint-context'
import './globals.css'

// FIX: eliminadas Inter y JetBrains_Mono de next/font/google
// Kali no tiene acceso a fonts.googleapis.com → causa timeout de 184s en cada carga
// Se usan fuentes del sistema equivalentes vía CSS (ver globals.css si necesitas ajustar)

export const metadata: Metadata = {
  title: {
    default: 'PentaWark — Cybersecurity & Ethical Hacking Platform',
    template: '%s | PentaWark',
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

  authors: [{ name: 'PentaWark' }],
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
              {/* Un Provider por módulo, sin estado compartido entre ellos:
                  ScanProvider → Pentesting (/scanner),
                  FootprintProvider → Huella Digital (/footprint).
                  Viven a nivel de layout para que un análisis en curso
                  sobreviva a la navegación, pero cada uno solo lo consume su
                  propio módulo. */}
              <ScanProvider>
                <FootprintProvider>
                  <div className="lg:flex">
                    <Sidebar />
                    <div className="min-w-0 flex-1">
                      <PageTransition>{children}</PageTransition>
                    </div>
                  </div>
                </FootprintProvider>
              </ScanProvider>
            </ParticlesProvider>
            <Toaster position="bottom-right" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}