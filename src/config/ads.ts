import {AD_NATIVE_BANNER_KEY, AD_NATIVE_BANNER_SCRIPT, getBannerConfig} from '@/lib/ad-config';

/** @deprecated Keys live in public/ads HTML and NEXT_PUBLIC_AD_* env vars. Kept for compatibility. */
export const ADSTERRA_ADS = {
  banner320x50: getBannerConfig('320x50')?.key ?? '',
  banner160x300: getBannerConfig('160x300')?.key ?? '',
  banner728x90: getBannerConfig('728x90')?.key ?? '',
  native: {
    key: AD_NATIVE_BANNER_KEY,
    scriptSrc: AD_NATIVE_BANNER_SCRIPT
  }
} as const;
