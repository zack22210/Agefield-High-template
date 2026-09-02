'use client';

import Image from 'next/image';
import {
  ArrowDown,
  ArrowUpRight,
  BookOpenText,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Monitor,
  ShieldCheck
} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useEffect, useRef} from 'react';
import {buttonVariants} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import {Link} from '@/i18n/navigation';

type ArticleTarget = {contentType: string; slug: string};
type StatusIcon = 'calendar' | 'clock' | 'monitor' | 'price';
type HeroAction = {
  label: string;
  kind: 'external' | 'contentType';
  linkKey?: string;
  contentType?: string;
  variant: 'primary' | 'outline';
  icon?: 'down' | 'external';
};
type ArticleAction = {label: string; article: ArticleTarget; icon?: 'external'};
type HomePageConfig = {
  hero: {
    enabled: boolean;
    label: string;
    title: string;
    description: string;
    image: {src: string; alt: string};
    actions: HeroAction[];
  };
  status: {
    enabled: boolean;
    ariaLabel: string;
    items: Array<{icon: StatusIcon; label: string; value: string}>;
  };
  facts: {enabled: boolean; label: string; items: Array<{label: string; value: string}>};
  story: {
    enabled: boolean;
    label: string;
    title: string;
    description: string;
    image: {src: string; alt: string};
    action: ArticleAction;
  };
  release: {
    enabled: boolean;
    label: string;
    title: string;
    description: string;
    actions: ArticleAction[];
  };
  index: {
    enabled: boolean;
    label: string;
    title: string;
    description: string;
    count: string;
    open: string;
  };
};
type HomeContentGroup = {
  contentType: string;
  label: string;
  overviewDescription: string;
  articles: Array<{
    slug: string;
    title: string;
    description: string;
    date: string;
    lastModified: string;
  }>;
};

const statusIcons = {
  calendar: CalendarClock,
  clock: Clock3,
  monitor: Monitor,
  price: CircleDollarSign
} satisfies Record<StatusIcon, typeof CalendarClock>;

function resolveArticleHref(target: ArticleTarget, groups: HomeContentGroup[]): string | undefined {
  const group = groups.find((item) => item.contentType === target.contentType);
  if (!group?.articles.some((article) => article.slug === target.slug)) return undefined;
  return `/${target.contentType}/${target.slug}`;
}

export function HomePageClient({groups}: {groups: HomeContentGroup[]}) {
  const heroRef = useRef<HTMLElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const t = useTranslations();
  const config = t.raw('home') as HomePageConfig;
  const links = t.raw('links') as Record<string, string>;

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  function moveHeroImage(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hero = heroRef.current;
    if (!hero) return;
    const bounds = hero.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;

    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(() => {
      hero.style.setProperty('--hero-shift-x', `${horizontal * -18}px`);
      hero.style.setProperty('--hero-shift-y', `${vertical * -12}px`);
      hero.classList.add('is-parallax-active');
    });
  }

  function resetHeroImage() {
    const hero = heroRef.current;
    if (!hero) return;
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    hero.style.setProperty('--hero-shift-x', '0px');
    hero.style.setProperty('--hero-shift-y', '0px');
    hero.classList.remove('is-parallax-active');
  }

  return (
    <main>
      {config.hero.enabled ? (
        <section ref={heroRef} className="home-hero" onPointerMove={moveHeroImage} onPointerLeave={resetHeroImage}>
          <Image src={config.hero.image.src} alt={config.hero.image.alt} fill priority sizes="100vw" className="hero-image" />
          <div className="hero-shade" />
          <div className="shell hero-copy">
            <p className="hero-label">{config.hero.label}</p>
            <h1>{config.hero.title}</h1>
            <p>{config.hero.description}</p>
            <div className="hero-actions">
              {config.hero.actions.map((action) => {
                const groupExists = action.contentType ? groups.some((group) => group.contentType === action.contentType) : false;
                const href = action.kind === 'external' && action.linkKey
                  ? links[action.linkKey]
                  : groupExists ? `/${action.contentType}` : undefined;
                const content = <>{action.label} {action.icon === 'down' ? <ArrowDown aria-hidden="true" /> : action.icon === 'external' ? <ArrowUpRight aria-hidden="true" /> : null}</>;
                const className = cn(buttonVariants({variant: action.variant, size: 'default'}));

                if (!href) return <span className="unlinked-action" key={action.label}>{action.label}</span>;
                if (action.kind === 'external') return <a href={href} target="_blank" rel="noreferrer" className={className} key={action.label}>{content}</a>;
                return <Link href={href} className={className} key={action.label}>{content}</Link>;
              })}
            </div>
          </div>
        </section>
      ) : null}

      {config.status.enabled ? (
        <section className="status-strip" aria-label={config.status.ariaLabel}>
          <div className="shell status-grid">
            {config.status.items.map((item) => {
              const Icon = statusIcons[item.icon];
              return <div key={item.label} className="status-item"><Icon aria-hidden="true" /><div><span>{item.label}</span><strong>{item.value}</strong></div></div>;
            })}
          </div>
        </section>
      ) : null}

      {config.facts.enabled ? (
        <section className="facts-band paper-surface">
          <div className="shell facts-layout">
            <div className="section-stamp"><ShieldCheck aria-hidden="true" /><span>{config.facts.label}</span></div>
            <div className="facts-grid">
              {config.facts.items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
            </div>
          </div>
        </section>
      ) : null}

      {config.story.enabled ? (
        <section className="feature-split paper-surface">
          <div className="feature-image-wrap">
            <Image src={config.story.image.src} alt={config.story.image.alt} fill sizes="(max-width: 900px) 100vw, 50vw" className="feature-image" />
          </div>
          <div className="feature-copy">
            <span>{config.story.label}</span>
            <h2>{config.story.title}</h2>
            <p>{config.story.description}</p>
            {resolveArticleHref(config.story.action.article, groups) ? (
              <Link href={resolveArticleHref(config.story.action.article, groups)!}>{config.story.action.label} <ArrowUpRight aria-hidden="true" /></Link>
            ) : <span className="unlinked-action">{config.story.action.label}</span>}
          </div>
        </section>
      ) : null}

      {config.release.enabled ? (
        <section className="release-callout">
          <div className="shell release-layout">
            <div className="release-date-block"><CalendarClock aria-hidden="true" /><span>{config.release.label}</span></div>
            <div><h2>{config.release.title}</h2><p>{config.release.description}</p></div>
            <div className="release-actions">
              {config.release.actions.map((action) => {
                const href = resolveArticleHref(action.article, groups);
                const content = <>{action.label} {action.icon === 'external' ? <ArrowUpRight aria-hidden="true" /> : null}</>;
                return href ? <Link href={href} key={action.label}>{content}</Link> : <span className="unlinked-action" key={action.label}>{content}</span>;
              })}
            </div>
          </div>
        </section>
      ) : null}

      {config.index.enabled ? groups.length > 0 ? groups.map((group, groupIndex) => (
          <section id={groupIndex === 0 ? 'coverage' : undefined} className="archive-section paper-surface" key={group.contentType}>
            <div className="shell">
              <div className="archive-heading">
                <div><span>{config.index.label}</span><h2>{group.label}</h2></div>
                <p>{group.overviewDescription}</p>
                <strong><BookOpenText aria-hidden="true" /> {t('home.index.count', {count: group.articles.length})}</strong>
              </div>
              {group.articles.length > 0 ? (
                <div className="archive-grid">
                  {group.articles.map((entry, index) => (
                    <Link href={`/${group.contentType}/${entry.slug}`} className="archive-entry" key={entry.slug}>
                      <span className="entry-number">{String(index + 1).padStart(2, '0')}</span>
                      <div><span className="entry-category">{group.label}</span><h3>{entry.title}</h3><p>{entry.description}</p><span className="entry-action">{config.index.open} <ArrowUpRight aria-hidden="true" /></span></div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="content-empty-state"><BookOpenText aria-hidden="true" /><h3>{t('list.emptyTitle')}</h3><p>{t('list.emptyDescription')}</p></div>
              )}
            </div>
          </section>
        )) : (
          <section id="coverage" className="archive-section paper-surface">
            <div className="shell">
              <div className="archive-heading">
                <div><span>{config.index.label}</span><h2>{config.index.title}</h2></div>
                <p>{config.index.description}</p>
                <strong><BookOpenText aria-hidden="true" /> {t('home.index.count', {count: 0})}</strong>
              </div>
              <div className="content-empty-state">
                <BookOpenText aria-hidden="true" />
                <h3>{t('list.emptyTitle')}</h3>
                <p>{t('list.emptyDescription')}</p>
              </div>
            </div>
          </section>
        ) : null}
    </main>
  );
}
