import React from 'react';
import { useTranslation } from 'react-i18next';

export const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="w-full border-t border-border bg-card py-6">
      <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted-foreground sm:px-6 lg:px-8 space-y-1">
        <p>&copy; {new Date().getFullYear()} {t('app.title')}. {t('footer.rights')}</p>
        <p className="text-[11px] text-muted-foreground/70">{t('footer.tagline')}</p>
      </div>
    </footer>
  );
};
