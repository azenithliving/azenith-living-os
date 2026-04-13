import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

const locales = ['ar', 'en'];

export default getRequestConfig(async ({ locale }) => {
  const validLocale = locale || 'ar';
  if (!locales.includes(validLocale as any)) notFound();

  return {
    locale: validLocale,
    messages: (await import(`./messages/${validLocale}.json`)).default
  };
});
