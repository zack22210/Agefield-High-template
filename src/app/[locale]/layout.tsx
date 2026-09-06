import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {hasLocale, NextIntlClientProvider} from 'next-intl';
import {getMessages, getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
import {AdsterraBottomBanner} from '@/components/ads/AdsterraBottomBanner';
import {JsonLd} from '@/components/JsonLd';
import {CookieConsent} from '@/components/CookieConsent';
import {getAllContentGroups} from '@/lib/content';
import {formatArticleNavigationLabel} from '@/lib/content-label';
import {
  absoluteUrl,
  METADATA_BASE,
  SITE_IMAGE_PATH,
  SITE_LOGO_PATH,
  SITE_URL
} from '@/config/site';
import {localeUrl} from '@/lib/locale-url';
import {assertClientSerializable, withBuildContext} from '@/lib/server-context';

type Props = {
  children: ReactNode;
  params: Promise<{locale: string}>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({params}: Omit<Props, 'children'>): Promise<Metadata> {
  const {locale} = await params;
  return withBuildContext({area: 'url/metadata', stage: 'generate-locale-layout-metadata', locale, route: localePathForContext(locale)}, async () => {
    const t = await getTranslations({locale});
    const image = absoluteUrl(SITE_IMAGE_PATH);
    const siteName = t('site.name');
    const description = t('seo.defaultDescription');

    return {
      metadataBase: METADATA_BASE,
      title: siteName,
      description,
      manifest: '/manifest.webmanifest',
      icons: {
        icon: [{url: '/favicon.svg', type: 'image/svg+xml'}]
      },
      openGraph: {
        type: 'website',
        locale,
        siteName,
        url: localeUrl(locale, '/'),
        title: siteName,
        description,
        images: [{url: image, width: 1920, height: 1080, alt: t('media.heroAlt')}]
      },
      twitter: {
        card: 'summary_large_image',
        title: siteName,
        description,
        images: [image]
      }
    };
  });
}

function localePathForContext(locale: string): string {
  return `/${locale}`;
}

export default async function LocaleLayout({children, params}: Props) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  return withBuildContext({area: 'locale/data', stage: 'render-locale-layout', locale, route: localePathForContext(locale)}, async () => {
    const messages = await getMessages();
    const t = await getTranslations({locale});
    const navigationLabels = t.raw('nav') as Record<string, string>;
    const contentGroups = await getAllContentGroups(locale);
    const navigationGroups = contentGroups.map((group) => ({
      contentType: group.contentType,
      label: navigationLabels[group.contentType],
      count: group.articles.length,
      articles: group.articles.map(({slug, title}) => ({
        slug,
        title,
        navigationLabel: formatArticleNavigationLabel(slug)
      }))
    }));
    assertClientSerializable(messages, {stage: 'serialize-intl-messages', locale, route: localePathForContext(locale)});
    assertClientSerializable(navigationGroups, {stage: 'serialize-header-navigation', locale, route: localePathForContext(locale)});
    const organization = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: t('site.name'),
      url: SITE_URL,
      logo: absoluteUrl(SITE_LOGO_PATH),
      image: absoluteUrl(SITE_IMAGE_PATH)
    };

    return (
      <html lang={locale} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{__html: `(function(){try{var t=localStorage.getItem('game-wiki-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`}} />
        </head>
        <body>
          <NextIntlClientProvider messages={messages}>
            <JsonLd data={organization} context={{locale, route: localePathForContext(locale)}} />
            <SiteHeader groups={navigationGroups} />
            {children}
            <AdsterraBottomBanner />
            <SiteFooter />
            <CookieConsent />
          </NextIntlClientProvider>
        </body>
      </html>
    );
  });
}
