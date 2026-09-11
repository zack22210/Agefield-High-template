export type BannerFormat = "728x90" | "300x250" | "468x60" | "160x600" | "160x300" | "320x50";

export interface BannerConfig {
  key: string;
  width: number;
  height: number;
  htmlPath: string;
}

const BANNER_SPECS: Record<
  BannerFormat,
  { width: number; height: number; htmlPath: string; fallbackKey: string; envKey: string | undefined }
> = {
  "728x90": {
    width: 728,
    height: 90,
    htmlPath: "/ads/banner-728x90",
    fallbackKey: "",
    envKey: process.env.NEXT_PUBLIC_AD_BANNER_728X90,
  },
  "300x250": {
    width: 300,
    height: 250,
    htmlPath: "/ads/banner-300x250",
    fallbackKey: "",
    envKey: process.env.NEXT_PUBLIC_AD_BANNER_300X250,
  },
  "468x60": {
    width: 468,
    height: 60,
    htmlPath: "/ads/banner-468x60",
    fallbackKey: "",
    envKey: process.env.NEXT_PUBLIC_AD_BANNER_468X60,
  },
  "160x600": {
    width: 160,
    height: 600,
    htmlPath: "/ads/banner-160x600",
    fallbackKey: "",
    envKey: process.env.NEXT_PUBLIC_AD_SIDEBAR_160X600,
  },
  "160x300": {
    width: 160,
    height: 300,
    htmlPath: "/ads/banner-160x300",
    fallbackKey: "",
    envKey: process.env.NEXT_PUBLIC_AD_SIDEBAR_160X300,
  },
  "320x50": {
    width: 320,
    height: 50,
    htmlPath: "/ads/banner-320x50",
    fallbackKey: "",
    envKey: process.env.NEXT_PUBLIC_AD_MOBILE_320X50,
  },
};

export const GOOGLE_ADSENSE_ID = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;
export const AD_NATIVE_BANNER_KEY = process.env.NEXT_PUBLIC_AD_NATIVE_BANNER?.trim() || "";
export const AD_NATIVE_BANNER_SCRIPT = process.env.NEXT_PUBLIC_AD_NATIVE_SCRIPT?.trim() || "";

export function getBannerConfig(format: BannerFormat): BannerConfig | null {
  const spec = BANNER_SPECS[format];
  const key = spec.envKey?.trim() || spec.fallbackKey;
  if (!key) return null;
  return { key, width: spec.width, height: spec.height, htmlPath: spec.htmlPath };
}
