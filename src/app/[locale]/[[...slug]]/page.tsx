import type {Metadata} from 'next';
import Image from 'next/image';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowUpRight, BookOpenText, CheckCircle2, ExternalLink} from 'lucide-react';
import {JsonLd} from '@/components/JsonLd';
import {ArticleToc} from '@/components/ArticleToc';
import {AdsterraFooterBanner} from '@/components/ads/AdsterraFooterBanner';
import {AdsterraSideBanners} from '@/components/ads/AdsterraSideBanners';
import {getAllContent, getAllContentGroups, getAllContentPaths, getContent, getContentTypes} from '@/lib/content';
import {routing} from '@/i18n/routing';
import {absoluteUrl, SITE_IMAGE_PATH, SITE_LOGO_PATH, SITE_URL} from '@/config/site';
import {EXTERNAL_LINKS} from '@/config/external-links';
import {Link} from '@/i18n/navigation';
import {localePath, localeUrl} from '@/lib/locale-url';
import {assertClientSerializable, withBuildContext} from '@/lib/server-context';
import {HomePageClient} from '../HomePageClient';

type Props = {
  params: Promise<{locale: string; slug?: string[]}>;
};

type ReferenceItem = {key: keyof typeof EXTERNAL_LINKS; title: string; meta: string};
type ContentTypeOverview = {overviewTitle: string; overviewDescription: string};

export const dynamicParams = false;

export async function generateStaticParams() {
  return withBuildContext({area: 'content/path', stage: 'generate-static-params'}, async () => {
    const [paths, contentTypes] = await Promise.all([getAllContentPaths('en'), getContentTypes('en')]);
    const listPaths = contentTypes.map((contentType) => ({slug: [contentType]}));
    const articlePaths = paths.map((item) => ({slug: item.pathSegments}));
    return routing.locales.flatMap((locale) => [
      {locale, slug: []},
      ...listPaths.map((entry) => ({locale, ...entry})),
      ...articlePaths.map((entry) => ({locale, ...entry}))
    ]);
  });
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale, slug = []} = await params;
  if (slug.length === 0) {
    return withBuildContext({area: 'url/metadata', stage: 'generate-home-metadata', locale, route: '/'}, async () => {
      const t = await getTranslations({locale});
      const title = t('seo.homeTitle');
      const description = t('seo.homeDescription');
      const url = localeUrl(locale, '/');
      return {
        title,
        description,
        keywords: t('seo.keywords'),
        alternates: {canonical: url},
        openGraph: {
          type: 'website',
          url,
          title,
          description,
          images: [{url: absoluteUrl(SITE_IMAGE_PATH), alt: t('media.heroAlt')}]
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [absoluteUrl(SITE_IMAGE_PATH)]
        }
      };
    });
  }
  const [contentType, ...articlePath] = slug;
  return withBuildContext({
    area: 'url/metadata',
    stage: 'generate-content-metadata',
    locale,
    category: contentType,
    slug: articlePath.join('/') || undefined,
    route: localePath(locale, `/${slug.join('/')}`)
  }, async () => {
    const t = await getTranslations({locale});
    const siteName = t('site.name');

    if (slug.length === 1) {
      const contentTypes = await getContentTypes(locale);
      if (!contentTypes.includes(contentType)) notFound();
      const category = (t.raw('contentTypes') as Record<string, ContentTypeOverview>)[contentType];
      const categoryName = category.overviewTitle;
      const title = `${categoryName} — ${siteName}`;
      const pathname = `/${contentType}`;
      return {
        title,
        description: category.overviewDescription,
        alternates: {
          canonical: localeUrl(locale, pathname),
          languages: Object.fromEntries(
            routing.locales.map((language) => [language, localeUrl(language, pathname)])
          )
        },
        openGraph: {
          type: 'website',
          title,
          description: category.overviewDescription,
          url: localeUrl(locale, pathname),
          images: [{url: absoluteUrl(SITE_IMAGE_PATH), alt: t('media.heroAlt')}]
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description: category.overviewDescription,
          images: [absoluteUrl(SITE_IMAGE_PATH)]
        }
      };
    }

    const articleSlug = articlePath.join('/');
    const content = await getContent(contentType, articleSlug, locale);
    if (!content) notFound();
    const pathname = `/${contentType}/${articleSlug}`;
    const image = absoluteUrl(content.image);
    const title = `${content.title} — ${siteName}`;

    return {
      title,
      description: content.description,
      alternates: {
        canonical: localeUrl(locale, pathname),
        languages: Object.fromEntries(
          routing.locales.map((language) => [language, localeUrl(language, pathname)])
        )
      },
      openGraph: {
        type: 'article',
        title,
        description: content.description,
        url: localeUrl(locale, pathname),
        publishedTime: content.date,
        modifiedTime: content.lastModified,
        images: [{url: image, alt: content.title}]
      },
      twitter: {card: 'summary_large_image', title, description: content.description, images: [image]}
    };
  });
}

async function NavigationPage({locale, contentType}: {locale: string; contentType: string}) {
  const contentTypes = await getContentTypes(locale);
  if (!contentTypes.includes(contentType)) notFound();
  const t = await getTranslations();
  const available = await getAllContent(contentType, locale);
  const category = (t.raw('contentTypes') as Record<string, ContentTypeOverview>)[contentType];
  const categoryLabel = category.overviewTitle;
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: categoryLabel,
    itemListElement: available.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.title,
      url: absoluteUrl(localePath(locale, `/${contentType}/${item.slug}`))
    }))
  };

  return (
    <main className="paper-page list-page relative">
      <JsonLd data={itemList} context={{locale, category: contentType, route: localePath(locale, `/${contentType}`)}} />
      <AdsterraSideBanners />
      <div className="shell">
        <nav className="breadcrumbs" aria-label={t('accessibility.breadcrumb')}>
          <Link href="/">{t('article.home')}</Link><span>/</span><span>{categoryLabel}</span>
        </nav>
        <header className="list-hero">
          <span>{t('list.label')}</span>
          <h1>{categoryLabel}</h1>
          <p>{category.overviewDescription}</p>
          <div className="list-count"><BookOpenText aria-hidden="true" /> {t('home.index.count', {count: available.length})}</div>
        </header>

        {available.length > 0 ? (
          <div className="navigation-list">
            {available.map((item, index) => (
              <Link className="navigation-row" href={`/${contentType}/${item.slug}`} key={item.slug}>
                <>
                  <span className="navigation-number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="navigation-copy">
                    <span>{categoryLabel}</span>
                    <h2>{item.title}</h2>
                    <p>{item.description}</p>
                  </div>
                  <div className="verification-state is-published">
                    <CheckCircle2 aria-hidden="true" />
                    <span>{t('list.available')}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </div>
                </>
              </Link>
            ))}
          </div>
        ) : (
          <div className="content-empty-state">
            <BookOpenText aria-hidden="true" />
            <h2>{t('list.emptyTitle')}</h2>
            <p>{t('list.emptyDescription')}</p>
          </div>
        )}
      </div>
      <AdsterraFooterBanner title={t('article.advertisement')} />
    </main>
  );
}

async function DetailPage({locale, contentType, articleSlug}: {locale: string; contentType: string; articleSlug: string}) {
  const t = await getTranslations();
  const content = await getContent(contentType, articleSlug, locale);
  if (!content) notFound();
  const categoryLabel = (t.raw('contentTypes') as Record<string, ContentTypeOverview>)[contentType].overviewTitle;
  const siteName = t('site.name');
  const referenceItems = t.raw('article.referenceItems') as ReferenceItem[];
  const related = (await getAllContent(contentType, locale))
    .filter((item) => item.slug !== articleSlug)
    .slice(0, 3);

  const pathname = `/${contentType}/${articleSlug}`;
  const url = absoluteUrl(localePath(locale, pathname));
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: content.title,
    description: content.description,
    image: absoluteUrl(content.image),
    datePublished: content.date,
    dateModified: content.lastModified,
    mainEntityOfPage: url,
    url,
    inLanguage: locale,
    author: {'@id': `${SITE_URL}/#organization`, '@type': 'Organization', name: siteName},
    publisher: {
      '@id': `${SITE_URL}/#organization`,
      '@type': 'Organization',
      name: siteName,
      logo: {'@type': 'ImageObject', url: absoluteUrl(SITE_LOGO_PATH)}
    }
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {'@type': 'ListItem', position: 1, name: t('article.home'), item: absoluteUrl(localePath(locale, '/'))},
      {'@type': 'ListItem', position: 2, name: categoryLabel, item: absoluteUrl(localePath(locale, `/${contentType}`))},
      {'@type': 'ListItem', position: 3, name: content.title, item: url}
    ]
  };

  return (
    <main className="paper-page article-page relative">
      <JsonLd data={[articleJsonLd, breadcrumbs]} context={{locale, category: contentType, slug: articleSlug, route: localePath(locale, pathname)}} />
      <AdsterraSideBanners />
      <div className="shell">
        <nav className="breadcrumbs" aria-label={t('accessibility.breadcrumb')}>
          <Link href="/">{t('article.home')}</Link><span>/</span>
          <Link href={`/${contentType}`}>{categoryLabel}</Link><span>/</span>
          <span>{content.title}</span>
        </nav>

        <header className="article-hero">
          <span>{categoryLabel}</span>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
          <div>{t('article.updated')} {content.lastModified} <i>/</i> {t('article.verified')}</div>
        </header>

        <div className="article-layout">
          <aside className="article-sidebar">
            <div className="facts-card">
              <Image src={content.image} alt={t('media.artworkAlt')} width={460} height={215} />
              <h2>{t('article.gameFacts')}</h2>
              <dl>
                <div><dt>{t('article.article')}</dt><dd>{categoryLabel}</dd></div>
                <div><dt>{t('article.updated')}</dt><dd>{content.lastModified}</dd></div>
                <div><dt>{t('article.lastVerified')}</dt><dd>{content.lastModified}</dd></div>
                <div><dt>{t('article.appliesTo')}</dt><dd>{t('article.appliesValue')}</dd></div>
              </dl>
            </div>
            <ArticleToc title={t('article.onThisPage')} headings={content.headings} />
          </aside>

          <article className="mdx-content">
            <content.MDXContent />
          </article>

          <aside className="references-panel">
            <h2>{t('article.references')}</h2>
            {referenceItems.map((item) => (
              <a key={item.key} href={EXTERNAL_LINKS[item.key]} target="_blank" rel="noreferrer">
                <strong>{item.title}</strong><span>{item.meta}</span>
                <ExternalLink aria-hidden="true" />
              </a>
            ))}
            <h2 className="related-title">{t('article.related')}</h2>
            {related.slice(0, 2).map((item) => (
              <Link className="pending-reference" key={item.slug} href={`/${contentType}/${item.slug}`}>
                {item.title}
              </Link>
            ))}
          </aside>
        </div>

        <AdsterraFooterBanner title={t('article.advertisement')} />

        <section className="related-entries" aria-labelledby="related-entries-title">
          <h2 id="related-entries-title">{t('article.related')}</h2>
          <div>
            {related.map((item) => (
              <Link key={item.slug} href={`/${contentType}/${item.slug}`}>
                <strong>{item.title}</strong><ArrowUpRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}

async function HomePage({locale}: {locale: string}) {
  return withBuildContext({area: 'locale/data', stage: 'render-home-page', locale, route: '/'}, async () => {
    const t = await getTranslations({locale});
    const contentTypeMessages = t.raw('contentTypes') as Record<string, ContentTypeOverview>;
    const contentGroups = (await getAllContentGroups(locale)).map((group) => ({
      contentType: group.contentType,
      label: contentTypeMessages[group.contentType].overviewTitle,
      overviewDescription: contentTypeMessages[group.contentType].overviewDescription,
      articles: group.articles.map(({slug, title, description, date, lastModified}) => ({
        slug,
        title,
        description,
        date,
        lastModified
      }))
    }));
    assertClientSerializable(contentGroups, {stage: 'serialize-home-content', locale, route: '/'});
    const website = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: t('site.name'),
      url: localeUrl(locale, '/'),
      publisher: {'@id': `${SITE_URL}/#organization`}
    };

    return (
      <>
        <JsonLd data={website} context={{locale, route: '/'}} />
        <HomePageClient groups={contentGroups} />
      </>
    );
  });
}

export default async function UnifiedContentPage({params}: Props) {
  const {locale, slug = []} = await params;
  setRequestLocale(locale);
  if (slug.length === 0) return <HomePage locale={locale} />;

  const [contentType, ...articlePath] = slug;
  const articleSlug = articlePath.join('/');
  return withBuildContext({
    area: 'content/path',
    stage: slug.length === 1 ? 'render-category-page' : 'render-article-page',
    locale,
    category: contentType,
    slug: articleSlug || undefined,
    route: localePath(locale, `/${slug.join('/')}`)
  }, async () => {
    if (slug.length === 1) return <NavigationPage locale={locale} contentType={contentType} />;
    return <DetailPage locale={locale} contentType={contentType} articleSlug={articleSlug} />;
  });
}
