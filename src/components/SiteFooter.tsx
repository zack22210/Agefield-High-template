import {BookOpenText, ExternalLink} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';

type FooterConfig = {
  navigationLabel: string;
  notice: string;
  links: Array<{label: string; kind: 'external' | 'internal'; href?: string; linkKey?: string}>;
};

export async function SiteFooter() {
  const t = await getTranslations();
  const config = t.raw('footer') as FooterConfig;
  const externalLinks = t.raw('links') as Record<string, string>;

  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <span className="brand-mark"><BookOpenText aria-hidden="true" /></span>
          <div>
            <strong>{t('site.name')}</strong>
            <p>{config.notice}</p>
          </div>
        </div>
        <nav aria-label={config.navigationLabel}>
          {config.links.map((item) => {
            const href = item.kind === 'external' && item.linkKey ? externalLinks[item.linkKey] : item.href;
            if (!href) return <span key={item.label}>{item.label}</span>;
            return item.kind === 'external' ? (
              <a href={href} target="_blank" rel="noreferrer" key={item.label}>
                {item.label} <ExternalLink aria-hidden="true" />
              </a>
            ) : (
              <Link href={href} key={item.label}>{item.label}</Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
