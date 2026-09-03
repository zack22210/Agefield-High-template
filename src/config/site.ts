import en from '@/locales/en.json';
import {resolveSiteUrlEnvironment} from './site-url';

export const SITE_IMAGE_PATH = en.media.heroImage;
export const SITE_LOGO_PATH = en.media.logoImage;
export const ARTICLE_IMAGE_PATH = en.media.articleImage;

export const SITE_URL_RESOLUTION = resolveSiteUrlEnvironment(process.env);
export const SITE_URL = SITE_URL_RESOLUTION.url;
export const METADATA_BASE = new URL(SITE_URL);

export function absoluteUrl(pathname: string): string {
  const normalizedPath = `/${String(pathname ?? '').trim().replace(/^\/+/, '')}`;
  return normalizedPath === '/' ? `${SITE_URL}/` : `${SITE_URL}${normalizedPath}`;
}
