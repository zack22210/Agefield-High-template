import type {MetadataRoute} from 'next';
import {getAllContentPaths} from '@/lib/content';
import {CONTENT_TYPES} from '@/config/navigation';
import {routing} from '@/i18n/routing';
import {absoluteUrl} from '@/config/site';
import {withBuildContext} from '@/lib/server-context';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return withBuildContext({area: 'url/metadata', stage: 'generate-sitemap', route: '/sitemap.xml'}, async () => {
    const contentPaths = await getAllContentPaths('en');
    const staticPaths = ['', ...CONTENT_TYPES.map((type) => `/${type}`), '/privacy-policy', '/terms-of-service', '/copyright', '/about'];
    const articlePaths = new Map(
      contentPaths.map((entry) => [`/${entry.pathSegments.join('/')}`, entry.lastModified])
    );

    return routing.locales.flatMap((locale) =>
      [...staticPaths, ...articlePaths.keys()].map((pathname) => {
        const prefix = `/${locale}`;
        const isArticle = articlePaths.has(pathname);
        return {
          url: absoluteUrl(`${prefix}${pathname}`),
          lastModified: isArticle ? new Date(articlePaths.get(pathname)!) : new Date(),
          changeFrequency: isArticle ? 'weekly' as const : 'monthly' as const,
          priority: pathname === '' ? 1 : pathname.split('/').filter(Boolean).length === 1 ? 0.8 : 0.7
        };
      })
    );
  });
}
