import {Link} from '@/i18n/navigation';
import {FileQuestion} from 'lucide-react';
import {getTranslations} from 'next-intl/server';

export default async function NotFoundPage() {
  const t = await getTranslations('notFound');
  return (
    <main className="paper-page not-found-page">
      <div className="not-found-panel">
        <FileQuestion aria-hidden="true" />
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
        <Link href="/">{t('action')}</Link>
      </div>
    </main>
  );
}
