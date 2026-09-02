import {Link} from '@/i18n/navigation';

type LegalPageProps = {
  title: string;
  intro: string;
  sections: Array<{title: string; body: string}>;
  homeLabel: string;
  breadcrumbLabel: string;
};

export function LegalPage({title, intro, sections, homeLabel, breadcrumbLabel}: LegalPageProps) {
  return (
    <main className="paper-page">
      <div className="shell legal-shell">
        <nav className="breadcrumbs" aria-label={breadcrumbLabel}>
          <Link href="/">{homeLabel}</Link><span>/</span><span>{title}</span>
        </nav>
        <article className="legal-copy">
          <h1>{title}</h1>
          <p className="lede">{intro}</p>
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
