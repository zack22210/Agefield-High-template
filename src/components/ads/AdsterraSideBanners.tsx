'use client';

import {useEffect, useState} from 'react';
import {X} from 'lucide-react';
import {AdBanner} from '@/components/ads/AdsterraBanner';
import {getBannerConfig} from '@/lib/ad-config';

type Side = 'left' | 'right';

const SHELL_MAX_WIDTH = 1320;
const BANNER_WIDTH = 160;
const GUTTER = 8;
const MIN_VIEWPORT = SHELL_MAX_WIDTH + (BANNER_WIDTH + GUTTER) * 2;

function DismissibleSideBanner({side}: {side: Side}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !getBannerConfig('160x300')) return null;

  return (
    <aside
      className={`absolute inset-y-0 hidden w-[160px] pt-48 min-[1640px]:block ${
        side === 'left' ? 'left-2' : 'right-2'
      }`}
      aria-label="Advertisement"
    >
      <div className="sticky top-20 z-20 py-2">
        <div className="relative">
          <AdBanner type="banner-160x300" eager />
          <button
            type="button"
            aria-label="关闭广告"
            onClick={() => setDismissed(true)}
            className={`absolute top-0 z-10 flex size-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              side === 'left' ? 'left-0' : 'right-0'
            }`}
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
  const hasSidebarAd = Boolean(getBannerConfig('160x300'));

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${MIN_VIEWPORT}px)`);
    const updateVisibility = () => setIsWideDesktop(mediaQuery.matches);

    updateVisibility();
    mediaQuery.addEventListener('change', updateVisibility);

    return () => mediaQuery.removeEventListener('change', updateVisibility);
  }, []);

  if (!isWideDesktop || !hasSidebarAd) return null;

  return (
    <>
      <DismissibleSideBanner side="left" />
      <DismissibleSideBanner side="right" />
    </>
  );
}
