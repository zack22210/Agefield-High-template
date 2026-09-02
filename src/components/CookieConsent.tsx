'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';

export function CookieConsent() {
  const t = useTranslations('privacyChoices');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem('game-wiki-privacy-choice') === null);
  }, []);

  function choose(value: 'essential' | 'analytics') {
    localStorage.setItem('game-wiki-privacy-choice', value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section className="privacy-bar" aria-label={t('title')}>
      <div>
        <strong>{t('title')}</strong>
        <p>{t('description')}</p>
      </div>
      <div className="privacy-actions">
        <button type="button" onClick={() => choose('essential')}>{t('essential')}</button>
        <button className="privacy-allow" type="button" onClick={() => choose('analytics')}>{t('allow')}</button>
      </div>
    </section>
  );
}
