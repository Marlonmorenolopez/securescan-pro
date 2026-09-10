import { NextRequest, NextResponse } from 'next/server'

const SUPPORTED_LOCALES = ['es', 'en']
const DEFAULT_LOCALE    = 'es'
const COOKIE_NAME       = 'NEXT_LOCALE'

export function proxy(request: NextRequest) {
  let locale = request.cookies.get(COOKIE_NAME)?.value ?? ''

  if (!SUPPORTED_LOCALES.includes(locale)) {
    const accept = request.headers.get('Accept-Language') ?? ''
    for (const segment of accept.split(',')) {
      const code = segment.trim().slice(0, 2).toLowerCase()
      if (SUPPORTED_LOCALES.includes(code)) {
        locale = code
        break
      }
    }
  }

  if (!SUPPORTED_LOCALES.includes(locale)) {
    locale = DEFAULT_LOCALE
  }

  const response = NextResponse.next()
  response.headers.set('x-next-intl-locale', locale)

  if (!SUPPORTED_LOCALES.includes(request.cookies.get(COOKIE_NAME)?.value ?? '')) {
    response.cookies.set(COOKIE_NAME, locale, {
      path:     '/',
      maxAge:   60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|favicon\\.ico|.*\\..*).*)'],
}
