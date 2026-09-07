import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeDetection: false,
  localeCookie: false
});

export type Locale = (typeof routing.locales)[number];
