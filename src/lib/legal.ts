import 'server-only';

import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {localeUrl} from '@/lib/locale-url';
import {withBuildContext} from '@/lib/server-context';

export type LegalPageKey = 'about' | 'privacy' | 'terms' | 'copyright';
export type LegalSection = {title: string; body: string};

export async function getLegalCopy(key: LegalPageKey, locale?: string) {
  if (locale) setRequestLocale(locale);
  return withBuildContext({area: 'locale/data', stage: 'load-legal-copy', locale, route: key}, async () => {
    const t = locale ? await getTranslations({locale}) : await getTranslations();
    return {
      title: t(`legal.${key}.title`),
      intro: t(`legal.${key}.intro`),
      sections: t.raw(`legal.${key}.sections`) as LegalSection[],
      homeLabel: t('article.home'),
      breadcrumbLabel: t('accessibility.breadcrumb')
    };
  });
}

export async function getLegalMetadata(key: LegalPageKey, pathname: string, locale: string): Promise<Metadata> {
  setRequestLocale(locale);
  return withBuildContext({area: 'url/metadata', stage: 'generate-legal-metadata', locale, route: pathname}, async () => {
    const t = await getTranslations({locale});
    return {
      title: t(`legal.${key}.metaTitle`),
      description: t(`legal.${key}.metaDescription`),
      alternates: {canonical: localeUrl(locale, pathname)}
    };
  });
}
