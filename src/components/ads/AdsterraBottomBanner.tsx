'use client';

import {useState} from 'react';
import {X} from 'lucide-react';
import {AdBanner} from '@/components/ads/AdsterraBanner';
import {getBannerConfig} from '@/lib/ad-config';

export function AdsterraBottomBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !getBannerConfig('320x50')) return null;

  return (
    <>
      <div className="h-[66px]" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 py-2">
        <div className="mx-auto max-w-4xl">
          <div className="pointer-events-auto relative mx-auto w-fit max-w-full">
            <AdBanner type="banner-320x50" eager />
            <button
              type="button"
              aria-label="关闭广告"
              onClick={() => setDismissed(true)}
              className="absolute right-0 top-0 z-10 flex size-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
