import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Key, CheckCircle, Mail, Hash } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, token } = useAuth();

  const displayName = user?.name || user?.email || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-6 animate-fadeIn max-w-3xl mx-auto">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-4 border-b border-border pb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary text-2xl font-bold">
            {initial}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Mail className="h-3.5 w-3.5" />
              <span>{user?.email}</span>
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary capitalize">
              <Shield className="h-3.5 w-3.5" />
              <span>{user?.role ? (t(`app.${user.role}`) || user.role) : ''}</span>
            </div>
          </div>
        </div>

        {/* User Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-background p-4 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Hash className="h-3 w-3" />
              <span>User ID</span>
            </span>
            <p className="font-mono text-xs font-semibold text-foreground">{user?.id}</p>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Key className="h-3 w-3" />
              <span>{t('profile.sessionToken')}</span>
            </span>
            <p className="font-mono text-xs text-muted-foreground truncate">{token}</p>
          </div>
        </div>

        {/* Permissions Granted Box */}
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span>{t('profile.rolePermissions')}</span>
          </h3>

          <ul className="text-xs space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Manage Personal Profile (<code className="text-primary font-mono">/profile</code>)</span>
            </li>
            {user?.role === 'SUPER_ADMIN' || user?.role === 'admin' ? (
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Super Admin Portal (<code className="text-emerald-500 font-mono">/super-admin/dashboard</code>)</span>
              </li>
            ) : null}
            {user?.role === 'MERCHANT' || user?.role === 'manager' || user?.role === 'user' ? (
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                <span>Merchant Portal (<code className="text-teal-500 font-mono">/merchant/dashboard</code>)</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
};
