type AdsterraBannerSize =
  | '160x300'
  | '160x600'
  | '300x250'
  | '320x50'
  | '468x60'
  | '728x90';

type AdsterraBannerProps = {
  adKey?: string;
  size: AdsterraBannerSize;
  title?: string;
};

type AdBannerProps = {
  adKey?: string;
  eager?: boolean;
  title?: string;
  type: `banner-${AdsterraBannerSize}`;
};

const bannerDimensions: Record<AdsterraBannerSize, {width: number; height: number}> = {
  '160x300': {width: 160, height: 300},
  '160x600': {width: 160, height: 600},
  '300x250': {width: 300, height: 250},
  '320x50': {width: 320, height: 50},
  '468x60': {width: 468, height: 60},
  '728x90': {width: 728, height: 90},
};

export function AdBanner({adKey, eager = false, title = 'Advertisement', type}: AdBannerProps) {
  if (!adKey?.trim()) return null;

  const size = type.replace('banner-', '') as AdsterraBannerSize;
  const {width, height} = bannerDimensions[size];

  return (
    <div className="flex w-full justify-center overflow-hidden">
      <iframe
        src={`/ads/banner-${size}.html?key=${encodeURIComponent(adKey.trim())}`}
        title={title}
        width={width}
        height={height}
        scrolling="no"
        loading={eager ? 'eager' : 'lazy'}
        style={{border: 'none'}}
      />
    </div>
  );
}

export function AdsterraBanner({adKey, size, title}: AdsterraBannerProps) {
  if (!adKey?.trim()) return null;

  return (
    <div className="mt-[42px]">
      <AdBanner adKey={adKey} type={`banner-${size}`} title={title} />
    </div>
  );
}
