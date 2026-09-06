'use client';

import {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import {AdBanner} from '@/components/ads/AdsterraBanner';

type Side = 'left' | 'right';

function DismissibleSideBanner({adKey, side}: {adKey: string; side: Side}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !adKey.trim()) return null;

  const position = side === 'left'
    ? {left: 'max(0px, calc(50% - 876px))'}
    : {right: 'max(0px, calc(50% - 876px))'};

  return (
    <aside
      className="absolute inset-y-0 hidden w-[160px] pt-48 min-[1760px]:block"
      style={position}
      aria-label="Advertisement"
    >
      <div className="sticky top-20 z-20 py-2">
        <div className="relative">
          <AdBanner type="banner-160x300" adKey={adKey} eager />
          <button
            type="button"
            aria-label="Close advertisement"
            onClick={() => setDismissed(true)}
            className="absolute right-0 top-0 z-10 flex size-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function AdsterraSideBanners() {
  const [isWideDesktop, setIsWideDesktop] = useState(false);
  const adKey = process.env.NEXT_PUBLIC_ADSTERRA_BANNER_160X300_KEY?.trim() ?? '';

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1760px)');
    const updateVisibility = () => setIsWideDesktop(mediaQuery.matches);

    updateVisibility();
    mediaQuery.addEventListener('change', updateVisibility);

    return () => mediaQuery.removeEventListener('change', updateVisibility);
  }, []);

  if (!isWideDesktop || !adKey) return null;

  return (
    <>
      <DismissibleSideBanner adKey={adKey} side="left" />
      <DismissibleSideBanner adKey={adKey} side="right" />
    </>
  );
}
