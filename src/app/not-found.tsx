import {FileQuestion} from 'lucide-react';
import {routing} from '@/i18n/routing';
import en from '@/locales/en.json';

export default function RootNotFound() {
  return (
    <html lang={routing.defaultLocale}>
      <body>
        <main className="paper-page not-found-page">
          <div className="not-found-panel">
            <FileQuestion aria-hidden="true" />
            <h1>{en.notFound.title}</h1>
            <p>{en.notFound.description}</p>
            <a href={`/${routing.defaultLocale}`}>{en.notFound.action}</a>
          </div>
        </main>
      </body>
    </html>
  );
}
