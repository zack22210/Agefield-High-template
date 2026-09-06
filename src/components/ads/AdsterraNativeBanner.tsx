'use client';

import {useEffect, useRef, useState} from 'react';

type AdsterraNativeBannerProps = {
  adKey?: string;
  scriptSrc?: string;
};

export function AdsterraNativeBanner({adKey, scriptSrc}: AdsterraNativeBannerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const normalizedKey = adKey?.trim() ?? '';
  const normalizedScriptSrc = scriptSrc?.trim() ?? '';

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const updateVisibility = () => setIsDesktop(mediaQuery.matches);

    updateVisibility();
    mediaQuery.addEventListener('change', updateVisibility);

    return () => mediaQuery.removeEventListener('change', updateVisibility);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const container = containerRef.current;
    if (!isDesktop || !host || !container || !normalizedKey || !normalizedScriptSrc) return;

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = normalizedScriptSrc;
    host.insertBefore(script, container);

    return () => {
      script.remove();
      container.replaceChildren();
    };
  }, [isDesktop, normalizedKey, normalizedScriptSrc]);

  if (!isDesktop || !normalizedKey || !normalizedScriptSrc) return null;

  return (
    <div ref={hostRef} className="w-full min-w-0 overflow-hidden" aria-label="Advertisement">
      <div ref={containerRef} id={`container-${normalizedKey}`} />
    </div>
  );
}
