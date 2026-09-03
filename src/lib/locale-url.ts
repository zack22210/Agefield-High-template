import {absoluteUrl} from '@/config/site';

export function localePath(locale: string, pathname: string): string {
  const path = `/${pathname.replace(/^\/+/, '')}`;
  if (path === '/') return `/${locale}`;
  return `/${locale}${path}`.replace(/\/{2,}/g, '/');
}

export function localeUrl(locale: string, pathname: string): string {
  return absoluteUrl(localePath(locale, pathname));
}
