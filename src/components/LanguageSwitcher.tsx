'use client';

import {Languages} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';
import {routing, type Locale} from '@/i18n/routing';
import {cn} from '@/lib/utils';

export function LanguageSwitcher({className}: {className?: string}) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const languageName = useTranslations('languages');
  const ui = useTranslations('navigationUi');

  if (routing.locales.length < 2) return null;

  function changeLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.replace(pathname, {locale: nextLocale});
  }

  return (
    <label className={cn('language-switcher', className)}>
      <Languages aria-hidden="true" />
      <span className="sr-only">{ui('selectLanguage')}</span>
      <select
        aria-label={ui('selectLanguage')}
        value={locale}
        onChange={(event) => changeLocale(event.target.value as Locale)}
      >
        {routing.locales.map((item) => (
          <option value={item} key={item}>{languageName(item)}</option>
        ))}
      </select>
    </label>
  );
}
