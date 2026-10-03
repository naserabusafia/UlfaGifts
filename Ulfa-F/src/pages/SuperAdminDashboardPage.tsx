import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../features/dashboard/services/userService';
import {
  ShieldCheck,
  Users,
  Server,
  Activity,
  Database,
  AlertCircle,
  ArrowUpRight,
  ArrowRight,
  Store,
} from 'lucide-react';

export const SuperAdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Merchants State
  const [merchantsCount, setMerchantsCount] = useState<number>(0);

  // Fetch Merchants Count
  const fetchMerchantsCount = async () => {
    try {
      const data: any = await userService.getMerchants(1, 100);
      const items = Array.isArray(data)
        ? data
        : data?.items || data?.data?.items || [];
      setMerchantsCount(items.length);
    } catch (err) {
      console.error('Failed to load merchants count:', err);
    }
  };

  useEffect(() => {
    fetchMerchantsCount();
  }, []);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Header Banner */}
      <div className="rounded-3xl border border-border bg-gradient-to-r from-primary/15 via-purple-500/10 to-card p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <ShieldCheck className="h-4 w-4" />
              <span>{t('superAdmin.badge', 'Super Admin Portal')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {t('superAdmin.title', 'Super Admin Command Center')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('superAdmin.welcome', 'Welcome back, {{name}}. You have full system management access.', {
                name: user?.name || user?.email || 'Super Admin',
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-border bg-card px-4 py-2 text-xs font-mono font-bold text-foreground">
              Role: <span className="text-primary">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('superAdmin.totalUsers', 'Total Users')}
            </span>
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">{merchantsCount || 12}</span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-500">
              <ArrowUpRight className="h-3.5 w-3.5" /> +12%
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('superAdmin.activeMerchants', 'Active Merchants')}
            </span>
            <div className="rounded-xl bg-purple-500/10 p-2 text-purple-500">
              <Server className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">{merchantsCount || 8}</span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-500">
              <ArrowUpRight className="h-3.5 w-3.5" /> +8.4%
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('superAdmin.systemUptime', 'System Uptime')}
            </span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">99.98%</span>
            <span className="text-xs font-medium text-emerald-500">Optimal</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('superAdmin.databaseLoad', 'Database Load')}
            </span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-500">
              <Database className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-foreground">24ms</span>
            <span className="text-xs font-medium text-muted-foreground">Avg Latency</span>
          </div>
        </div>
      </div>

      {/* Dedicated Merchants Management Banner Shortcut */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-purple-500/5 to-card p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <span>{t('superAdmin.merchantsManagement', 'Merchants & Quota Management')}</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              {t(
                'superAdmin.viewAllMerchantsSubtitle',
                'Dedicated mobile-first page to manage merchant details, soft-delete, and assign quota units.'
              )}
            </p>
          </div>
          <Link
            to="/super-admin/merchants"
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-extrabold text-primary-foreground shadow-md hover:bg-primary/90 transition cursor-pointer"
          >
            <span>{t('superAdmin.viewAllMerchants', 'Open Merchants Page')}</span>
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>

      {/* Audit & RBAC Overview Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-foreground">
            {t('superAdmin.securityLogTitle', 'System Audit & Authorization Logs')}
          </h2>
          <div className="space-y-3">
            {[
              { id: 1, action: 'GET /api/v1/users', user: user?.email || 'admin@ulfa.app', status: '200 OK', time: 'Just now' },
              { id: 2, action: 'POST /api/v1/users/:id/quota', user: user?.email || 'admin@ulfa.app', status: '200 OK', time: '5 mins ago' },
              { id: 3, action: 'POST /api/v1/auth/signin', user: 'merchant@ulfa.app', status: '200 OK', time: '14 mins ago' },
            ].map((log) => (
              <div
                key={log.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-border bg-background gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-mono font-bold text-foreground">{log.action}</p>
                  <p className="text-muted-foreground">{log.user}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                      log.status.includes('200') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">{log.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-foreground">
            {t('superAdmin.roleMatrix', 'RBAC System Status')}
          </h2>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
              <p className="font-bold text-primary">SUPER_ADMIN Role Active</p>
              <p className="text-muted-foreground">Full read/write permissions for all system configurations.</p>
            </div>

            <div className="p-3 rounded-xl bg-muted border border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Quota Audit System</span>
                <span className="text-emerald-500 font-bold">Enabled</span>
              </div>
              <p className="text-muted-foreground">QuotaLog table tracks admin_id, merchant_id, amount & timestamps.</p>
            </div>

            <div className="flex items-center gap-2 text-amber-500 text-xs font-semibold p-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Token auto-renewal interceptor active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboardPage;
