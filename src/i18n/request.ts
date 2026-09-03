import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {routing} from './routing';
import {contextualBuildError} from '@/lib/server-context';

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  let messages: Record<string, unknown>;

  try {
    const module = await import(`../locales/${locale}.json`);
    messages = module.default as Record<string, unknown>;
  } catch (error) {
    throw contextualBuildError(
      {area: 'locale/data', stage: 'load-locale-messages', locale, file: `src/locales/${locale}.json`},
      error
    );
  }

  return {
    locale,
    messages
  };
});
