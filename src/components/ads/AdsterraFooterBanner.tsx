'use client';

import {useEffect, useRef, useState} from 'react';
import {AdBanner} from '@/components/ads/AdsterraBanner';
import {ADSTERRA_ADS} from '@/config/ads';

export function AdsterraFooterBanner({title = 'Advertisement'}: {title?: string}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const adKey = ADSTERRA_ADS.banner728x90;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => setContainerWidth(container.clientWidth);
    const resizeObserver = new ResizeObserver(updateWidth);

    updateWidth();
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  if (!adKey) return null;

  const scale = Math.min(1, containerWidth / 728);

  return (
    <div className="mx-auto max-w-4xl px-2 py-8 sm:px-5">
      <div
        ref={containerRef}
        className="mx-auto w-full max-w-[728px] overflow-hidden"
        style={{height: containerWidth ? 90 * scale : 0}}
      >
        <div
          className="h-[90px] w-[728px] origin-top-left"
          style={{transform: `scale(${scale})`}}
        >
          <AdBanner adKey={adKey} type="banner-728x90" title={title} />
        </div>
      </div>
    </div>
  );
}
