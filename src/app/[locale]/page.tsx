import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {HomePageClient} from './HomePageClient';
import {getAllContentGroups} from '@/lib/content';
import {JsonLd} from '@/components/JsonLd';
import {absoluteUrl, SITE_IMAGE_PATH, SITE_URL} from '@/config/site';

type Props = {params: Promise<{locale: string}>};
type ContentTypeOverview = {overviewTitle: string; overviewDescription: string};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale});
  const title = t('seo.homeTitle');
  const description = t('seo.homeDescription');
  return {
    title,
    description,
    keywords: t('seo.keywords'),
    alternates: {canonical: '/'},
    openGraph: {
      type: 'website',
      url: SITE_URL,
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
}

export default async function HomePage({params}: Props) {
  const {locale} = await params;
  setRequestLocale(locale);
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
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: t('site.name'),
    url: SITE_URL,
    publisher: {'@id': `${SITE_URL}/#organization`}
  };

  return (
    <>
      <JsonLd data={website} />
      <HomePageClient groups={contentGroups} />
    </>
  );
}
