import {AdBanner} from '@/components/ads/AdsterraBanner';
import {getBannerConfig} from '@/lib/ad-config';

export function AdsterraFooterBanner({title = 'Advertisement'}: {title?: string}) {
  if (!getBannerConfig('728x90')) return null;

  return (
    <div className="mx-auto hidden max-w-4xl justify-center px-2 py-8 min-[760px]:flex sm:px-5">
      <AdBanner eager type="banner-728x90" title={title} />
    </div>
  );
}
