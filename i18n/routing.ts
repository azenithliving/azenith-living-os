import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['ar', 'en'],

  // Used when no locale matches
  defaultLocale: 'ar',

  // The locale prefix strategy
  localePrefix: 'as-needed'
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
