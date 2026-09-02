'use client';

import {useState} from 'react';
import {BookOpenText, Menu, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {ThemeToggle} from '@/components/ThemeToggle';
import {LanguageSwitcher} from '@/components/LanguageSwitcher';
import {Link} from '@/i18n/navigation';
import {routing} from '@/i18n/routing';

export type HeaderNavigationGroup = {
  contentType: string;
  label: string;
  count: number;
  articles: Array<{slug: string; title: string; navigationLabel: string}>;
};

export function SiteHeader({groups}: {groups: HeaderNavigationGroup[]}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const hasMobileNavigation = groups.length > 0 || routing.locales.length > 1;
  const navigationItems = groups.flatMap((group) => [
    {key: group.contentType, path: `/${group.contentType}`, label: group.label, accessibleLabel: undefined, isGroup: true},
    ...group.articles.map((article) => ({
      key: `${group.contentType}/${article.slug}`,
      path: `/${group.contentType}/${article.slug}`,
      label: article.navigationLabel,
      accessibleLabel: article.title,
      isGroup: false
    }))
  ]);
  const primary = navigationItems.slice(0, 4);
  const secondary = navigationItems.slice(4);

  return (
    <header className="site-header">
      <div className="header-main shell">
        <Link href="/" className="brand-lockup" aria-label={t('site.name')}>
          <span className="brand-mark"><BookOpenText aria-hidden="true" /></span>
          <span>
            <strong>{t('site.name')}</strong>
            <small>{t('site.tagline')}</small>
          </span>
        </Link>

        <nav className="primary-nav" aria-label={t('accessibility.primaryNavigation')}>
          {primary.map((item) => {
            return (
              <Link key={item.key} href={item.path} aria-label={item.isGroup ? undefined : item.accessibleLabel} title={item.isGroup ? undefined : item.accessibleLabel}>
                {item.isGroup ? <BookOpenText aria-hidden="true" /> : null}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <LanguageSwitcher className="desktop-language-switcher" />

        <ThemeToggle />

        {hasMobileNavigation ? (
          <Button
            className="mobile-menu-button"
            size="sm"
            variant="outline"
            aria-label={open ? t('navigationUi.close') : t('navigationUi.menu')}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        ) : null}
      </div>

      {secondary.length > 0 ? (
        <div className="secondary-nav-wrap">
          <nav className="secondary-nav" aria-label={t('accessibility.guideNavigation')}>
            {secondary.map((item) => (
              <Link key={item.key} href={item.path} aria-label={item.isGroup ? undefined : item.accessibleLabel} title={item.isGroup ? undefined : item.accessibleLabel}>{item.label}</Link>
            ))}
          </nav>
        </div>
      ) : null}

      {open && hasMobileNavigation ? (
        <nav className="mobile-nav" aria-label={t('accessibility.mobileNavigation')}>
          <LanguageSwitcher className="mobile-language-switcher" />
          {groups.map((group) => (
            <section className="mobile-nav-group" key={group.contentType}>
              <Link className="mobile-nav-heading" href={`/${group.contentType}`} onClick={() => setOpen(false)}>
                <BookOpenText aria-hidden="true" />
                <span>{group.label}<small>{t('home.index.count', {count: group.count})}</small></span>
              </Link>
              {group.articles.map((article) => (
                <Link key={article.slug} href={`/${group.contentType}/${article.slug}`} onClick={() => setOpen(false)}>
                  {article.navigationLabel}
                </Link>
              ))}
            </section>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
