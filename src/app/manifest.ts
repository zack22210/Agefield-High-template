import type {MetadataRoute} from 'next';
import en from '@/locales/en.json';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: en.site.name,
    short_name: en.site.shortName,
    description: en.seo.defaultDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#e9edf5',
    theme_color: '#0d1020',
    icons: [
      {src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable'}
    ]
  };
}
