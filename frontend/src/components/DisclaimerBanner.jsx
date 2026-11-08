import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function DisclaimerBanner() {
  const { t } = useLanguage();

  return (
    <footer
      style={{
        padding: '1.75rem 1rem 0.5rem 1rem',
        textAlign: 'center',
        borderTop: '1px solid var(--border)',
        marginTop: '1.5rem',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '0.9rem',
          color: 'var(--text-muted)',
          lineHeight: '1.5',
        }}
      >
        {t('common.disclaimer')}
      </p>
    </footer>
  );
}
