import en from '@/locales/en.json';

export const SITE_IMAGE_PATH = en.media.heroImage;
export const SITE_LOGO_PATH = en.media.logoImage;
export const ARTICLE_IMAGE_PATH = en.media.articleImage;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export function absoluteUrl(pathname: string): string {
  return `${SITE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}
