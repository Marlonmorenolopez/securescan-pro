/** @type {import('next').NextConfig} */
import createNextIntlPlugin from 'next-intl/plugin'

// next-intl lee la configuración de request desde i18n/request.ts
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Ocultar header X-Powered-By por seguridad

  // Configuración de imágenes
  images: {
    unoptimized: true, // Necesario para Docker/static export
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Variables de entorno públicas (seguras para el browser)
  env: {
    NEXT_PUBLIC_APP_NAME: 'SecureScan Pro',
    NEXT_PUBLIC_APP_VERSION: '3.0.0',
    NEXT_PUBLIC_API_TIMEOUT: '30000',
  },

  // Rewrites para proxy al backend Python
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000'

    return [
      // IMPORTANTE: Tus endpoints reales del backend son:
      // GET  /api/health          -> Health check
      // POST /api/scan            -> Iniciar scan
      // GET  /api/scan/:id/status -> Estado del scan
      // GET  /api/history         -> Historial
      // GET  /api/config          -> Configuración
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },

  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // CORRECCIÓN: header duplicado eliminado — solo una declaración de X-Content-Type-Options
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js requiere 'unsafe-inline' para sus scripts de hidratación
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com",
              // Tailwind/shadcn requieren unsafe-inline; Google Fonts requiere el dominio
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https:",
              // Google Fonts descarga los archivos de fuente desde gstatic.com
              "font-src 'self' data: https://fonts.gstatic.com",
              `connect-src 'self' ${process.env.BACKEND_URL || 'http://localhost:5000'} http://localhost:5000 https://va.vercel-scripts.com`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      // CORS solo para rutas de API (no para todo el sitio)
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            // CORRECCIÓN: en producción usa FRONTEND_URL; nunca wildcard en producción.
            // Asegúrate de definir FRONTEND_URL en tu .env de producción.
            value: process.env.NODE_ENV === 'development'
              ? 'http://localhost:3000'
              : process.env.FRONTEND_URL || 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-API-Token',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
        ],
      },
    ]
  },

  // Optimizaciones de compilación
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn', 'info'],
    } : false,
  },

  // Standalone para Docker
  output: 'standalone',
  distDir: '.next',

  // Configuración experimental (opcional)
  experimental: {
    // Optimizar imports de librerías grandes
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
}

export default withNextIntl(nextConfig)
