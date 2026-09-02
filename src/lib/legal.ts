import 'server-only';

import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';

export type LegalPageKey = 'about' | 'privacy' | 'terms' | 'copyright';
export type LegalSection = {title: string; body: string};

export async function getLegalCopy(key: LegalPageKey, locale?: string) {
  const t = locale ? await getTranslations({locale}) : await getTranslations();
  return {
    title: t(`legal.${key}.title`),
    intro: t(`legal.${key}.intro`),
    sections: t.raw(`legal.${key}.sections`) as LegalSection[],
    homeLabel: t('article.home'),
    breadcrumbLabel: t('accessibility.breadcrumb')
  };
}

export async function getLegalMetadata(key: LegalPageKey, pathname: string, locale: string): Promise<Metadata> {
  const t = await getTranslations({locale});
  return {
    title: t(`legal.${key}.metaTitle`),
    description: t(`legal.${key}.metaDescription`),
    alternates: {canonical: pathname}
  };
}
