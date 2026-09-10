import { getRequestConfig } from 'next-intl/server'
import { headers } from 'next/headers'

const SUPPORTED = ['es', 'en']
const DEFAULT   = 'es'

export default getRequestConfig(async () => {
  const headersList = await headers()
  const fromHeader  = headersList.get('x-next-intl-locale') ?? ''
  const locale      = SUPPORTED.includes(fromHeader) ? fromHeader : DEFAULT

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
