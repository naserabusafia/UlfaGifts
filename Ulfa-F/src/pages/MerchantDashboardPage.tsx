import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useMerchantDashboard, type MerchantDashboardProps } from '../features/dashboard';
import {
  TrendingUp,
  Plus,
  PackageOpen
} from 'lucide-react';

export const MerchantDashboardPage: React.FC<MerchantDashboardProps> = ({
  initialData,
  isUnlimitedQuota: isUnlimitedQuotaProp,
  totalQuota: totalQuotaProp,
  availableLinks: availableLinksProp,
  usedLinks: usedLinksProp,
  totalOrders: totalOrdersProp,
  recentOrders: recentOrdersProp,
  onAddNewOrder,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useMerchantDashboard(initialData);

  // 1. Store / Company Name (reads from API user profile companyName or name or storeName)
  const storeName =
    initialData?.storeName ||
    data.storeName ||
    user?.companyName ||
    user?.name ||
    user?.email?.split('@')[0] ||
    t('merchant.defaultStoreName', 'Al Baraka Store');

  // 2. Derive isUnlimitedQuota explicitly from props, initialData, data hook, or user profile
  const isUnlimitedExplicitProp =
    isUnlimitedQuotaProp ??
    initialData?.isUnlimitedQuota ??
    data.isUnlimitedQuota ??
    user?.isUnlimitedQuota;

  const totalQuota = totalQuotaProp ?? initialData?.totalQuota ?? data.totalQuota ?? user?.totalQuota;
  const directAvailable = availableLinksProp ?? initialData?.availableLinks ?? data.availableLinks ?? user?.availableLinks;

  const isUnlimited =
    typeof isUnlimitedExplicitProp === 'boolean'
      ? isUnlimitedExplicitProp
      : (totalQuota as any) === 'unlimited' || (directAvailable as any) === 'unlimited';

  // 3. Used Links & Total Orders from props/user
  const usedLinks = usedLinksProp ?? initialData?.usedLinks ?? data.usedLinks ?? user?.usedLinks ?? 0;
  const totalOrders = totalOrdersProp ?? initialData?.totalOrders ?? data.totalOrders ?? 0;
  const recentOrders = recentOrdersProp ?? initialData?.recentOrders ?? data.recentOrders ?? [];

  // 4. Calculate Available Links = totalQuota - usedLinks (when isUnlimited is false)
  let calculatedAvailableLinks: number = 0;
  if (typeof directAvailable === 'number') {
    calculatedAvailableLinks = directAvailable;
  } else if (typeof totalQuota === 'number') {
    calculatedAvailableLinks = Math.max(0, totalQuota - usedLinks);
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 font-sans text-slate-800 dark:text-slate-100 transition-colors pb-8">
      {/* 1. Header Banner Card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs dark:border-border dark:bg-card transition-all">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground">
          {t('merchant.welcomePrefix', 'Welcome back,')}{' '}
          <span className="text-blue-700 font-extrabold dark:text-blue-400">
            {storeName}
          </span>
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-muted-foreground">
          {t('merchant.welcomeSub', "Here's a quick look at your store's performance today.")}
        </p>
      </div>

      {/* 2. Responsive 3-Column Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Available Links Card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-xs dark:border-border dark:bg-card transition-all flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground">
              {t('merchant.availableLinks', 'Available Links')}
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            {isUnlimited ? (
              /* When Unlimited: Display ∞ (Infinity Symbol) directly as the main value */
              <span className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400 leading-none">
                ∞
              </span>
            ) : (
              /* When Limited: Display calculated available links count (totalQuota - usedLinks) */
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-foreground tracking-tight">
                {calculatedAvailableLinks}
              </span>
            )}
          </div>
        </div>

        {/* Used Links Card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-xs dark:border-border dark:bg-card transition-all flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground">
              {t('merchant.used', 'Used Links')}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-foreground tracking-tight">
              {usedLinks}
            </div>
            {data.usedPercentageChange !== undefined && (
              <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>
                  +{data.usedPercentageChange}% {t('merchant.fromYesterday', 'from yesterday')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Total Orders Card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-xs dark:border-border dark:bg-card transition-all flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-muted-foreground">
              {t('merchant.totalOrders', 'Total Orders')}
            </span>
          </div>

          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-foreground tracking-tight">
              {totalOrders}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Single Add New Order Button */}
      <button
        onClick={() => onAddNewOrder ? onAddNewOrder() : navigate('/merchant/orders/new')}
        className="w-full rounded-xl bg-blue-700 hover:bg-blue-800 active:scale-[0.99] text-white py-3.5 px-4 font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-700/20 transition-all cursor-pointer"
      >
        <Plus className="h-4.5 w-4.5 stroke-[3]" />
        <span>{t('merchant.addNewOrder', 'Add New Order')}</span>
      </button>

      {/* 4. Recent Orders Card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-xs dark:border-border dark:bg-card transition-all space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-foreground tracking-tight">
            {t('merchant.recentOrders', 'Recent Orders')}
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            {recentOrders.length} {t('merchant.ordersCount', 'Orders')}
          </span>
        </div>

        {recentOrders.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-border">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0"
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-slate-900 dark:text-foreground">
                    {order.id}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-muted-foreground">
                    {order.customerName}
                  </div>
                  {order.customerPhone && (
                    <div dir="ltr" className="mt-0.5 text-start text-[10px] text-slate-400 dark:text-muted-foreground">
                      {order.customerPhone}
                    </div>
                  )}
                </div>
                <div>
                  {order.status === 'Completed' ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {t('merchant.completed', 'Completed')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      {t('merchant.processing', 'Processing')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
            <PackageOpen className="h-10 w-10 stroke-[1.5] text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-medium">لا توجد طلبات حالية</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantDashboardPage;
