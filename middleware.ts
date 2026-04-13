import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';

const locales = ['ar', 'en'];
const defaultLocale = 'ar';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed'
});

export default function middleware(request: NextRequest) {
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
