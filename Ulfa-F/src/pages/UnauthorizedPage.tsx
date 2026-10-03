import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UnauthorizedPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-6 animate-fadeIn">
      <div className="rounded-3xl border border-destructive/30 bg-card p-8 shadow-xl text-center space-y-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-destructive/10 blur-2xl pointer-events-none" />

        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10 text-destructive ring-8 ring-destructive/5">
          <ShieldAlert className="h-10 w-10" />
        </div>

        <div className="space-y-2">
          <span className="inline-block rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
            HTTP 403 Forbidden
          </span>
          <h1 className="text-2xl font-black text-foreground sm:text-3xl">
            {t('unauthorized.title')}
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed sm:text-sm">
            {t('unauthorized.subtitle')}
          </p>
        </div>

        {/* Current Context Card */}
        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-start space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-semibold">{t('unauthorized.currentRole')}</span>
            <span className="font-bold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded">
              {user ? user.role : 'visitor'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t('unauthorized.reason')}</p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 shadow-md"
          >
            <Home className="h-4 w-4" />
            <span>{t('unauthorized.backHome')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
