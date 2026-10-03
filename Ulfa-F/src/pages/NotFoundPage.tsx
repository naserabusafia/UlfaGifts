import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-md space-y-6 pt-10 text-center animate-fadeIn">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
        <FileQuestion className="h-10 w-10" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-black text-foreground">{t('notFound.title')}</h1>
        <p className="text-xs text-muted-foreground">{t('notFound.subtitle')}</p>
      </div>

      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90"
      >
        <Home className="h-4 w-4" />
        <span>{t('notFound.backHome')}</span>
      </Link>
    </div>
  );
};
