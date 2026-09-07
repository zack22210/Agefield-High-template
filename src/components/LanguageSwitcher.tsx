'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {Check, ChevronDown, Languages} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';
import {routing, type Locale} from '@/i18n/routing';
import {cn} from '@/lib/utils';

export function LanguageSwitcher({className}: {className?: string}) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const languageName = useTranslations('languages');
  const ui = useTranslations('navigationUi');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  useEffect(() => {
    if (open) root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  if (routing.locales.length < 2) return null;

  function changeLocale(nextLocale: Locale) {
    setOpen(false);
    trigger.current?.focus();
    if (nextLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.replace(`${pathname}${window.location.search}${window.location.hash}`, {locale: nextLocale});
  }

  return (
    <div ref={root} className={cn('language-switcher', className)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      }}>
      <button ref={trigger} type="button" className="language-trigger"
        aria-label={`${ui('selectLanguage')}: ${languageName(locale)}`}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
        }}>
        <Languages aria-hidden="true" /><span>{languageName(locale)}</span><ChevronDown className="language-chevron" aria-hidden="true" />
      </button>
      {open && <div id={menuId} role="menu" aria-label={ui('selectLanguage')} className="language-menu"
        onKeyDown={(event) => {
          const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); items[next].focus(); }
        }}>
        {routing.locales.map((item) => <button type="button" role="menuitemradio" aria-checked={item === locale}
          className="language-option" key={item} onClick={() => changeLocale(item)}>
          <span lang={item}>{languageName(item)}</span><span className="language-code" aria-hidden="true">{item.toUpperCase()}</span>
          {item === locale && <Check aria-hidden="true" />}
        </button>)}
      </div>}
    </div>
  );
}
