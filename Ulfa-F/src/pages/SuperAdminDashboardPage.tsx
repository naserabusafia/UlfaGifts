import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../features/dashboard/services/userService';
import type { MerchantUser } from '../features/dashboard/types';
import { orderService } from '../features/orders/services/orderService';
import type { OrdersSummary } from '../features/orders/types';
import { formatCount, formatDay, formatRelative } from '../features/dashboard/format';
import '../features/dashboard/portal.css';
import { ArrowRight, Infinity as InfinityIcon, RefreshCw, ShoppingCart, Store, UserRoundPlus } from 'lucide-react';

const MERCHANTS_LIMIT = 100;
const LOW_SHARE = 0.15;
const LIST_SIZE = 5;

// The users endpoint has answered with a bare list, { items }, and { data: { items } }.
type MerchantsPayload =
  | MerchantUser[]
  | { items?: MerchantUser[]; data?: { items?: MerchantUser[] }; meta?: { total?: number } };

type MerchantState = 'active' | 'pending' | 'inactive';

const merchantState = (m: MerchantUser): MerchantState => {
  if (m.status === 'PENDING_PASSWORD_SET') return 'pending';
  if (m.status === 'INACTIVE' || m.isActive === false) return 'inactive';
  return 'active';
};

const remainingOf = (m: MerchantUser) => Math.max(0, (m.totalQuota ?? 0) - (m.usedLinks ?? 0));

export const SuperAdminDashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const lang = i18n.language;

  const [merchants, setMerchants] = useState<MerchantUser[]>([]);
  const [merchantsTotal, setMerchantsTotal] = useState(0);
  const [ordersSummary, setOrdersSummary] = useState<OrdersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = (await userService.getMerchants(1, MERCHANTS_LIMIT)) as unknown as MerchantsPayload;
      const items: MerchantUser[] = Array.isArray(data) ? data : data?.items || data?.data?.items || [];
      setMerchants(items);
      setMerchantsTotal(Array.isArray(data) ? items.length : (data?.meta?.total ?? items.length));
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load merchants:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }

    // Order totals only when the orders page reads the real API, never the temporary mock.
    if (!orderService.isMockMode) {
      try {
        const res = await orderService.getOrders({ page: 1, limit: 1 });
        setOrdersSummary(res.summary);
      } catch {
        setOrdersSummary(null);
      }
    }
  }, []);

  const reload = () => {
    setLoading(true);
    setLoadError(false);
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const active = merchants.filter((m) => merchantState(m) === 'active');
    const pending = merchants.filter((m) => merchantState(m) === 'pending');
    const inactive = merchants.filter((m) => merchantState(m) === 'inactive');
    const usedLinks = merchants.reduce((sum, m) => sum + (m.usedLinks ?? 0), 0);
    const limited = active.filter((m) => !m.isUnlimitedQuota);
    const low = limited
      .filter((m) => {
        const total = m.totalQuota ?? 0;
        return total <= 0 || remainingOf(m) / total <= LOW_SHARE;
      })
      .sort((a, b) => remainingOf(a) - remainingOf(b));
    const busiest = [...merchants]
      .filter((m) => (m.usedLinks ?? 0) > 0)
      .sort((a, b) => (b.usedLinks ?? 0) - (a.usedLinks ?? 0))
      .slice(0, LIST_SIZE);
    return { active, pending, inactive, usedLinks, low, busiest };
  }, [merchants]);

  const name = (m: MerchantUser) => m.companyName || m.email;
  const busiestMax = stats.busiest[0]?.usedLinks || 1;
  // Unknown numbers show a dash, never a misleading zero.
  const unknown = loading || loadError;
  const dash = unknown ? '–' : null;

  const lede = () => {
    if (loading) return t('portal.admin.ledeLoading');
    if (loadError) return t('portal.admin.ledeError');
    if (merchants.length === 0) return t('portal.admin.ledeEmpty');
    if (stats.low.length === 0 && stats.pending.length === 0) return t('portal.admin.ledeCalm');
    return (
      <>
        {stats.low.length > 0 && (
          <>
            <b>{stats.low.length}</b> {t('portal.admin.ledeLow')}
          </>
        )}
        {stats.low.length > 0 && stats.pending.length > 0 && t('portal.admin.ledeAnd')}
        {stats.pending.length > 0 && (
          <>
            <b>{stats.pending.length}</b> {t('portal.admin.ledePending')}
          </>
        )}
      </>
    );
  };

  return (
    <div className="pt">
      <header className="pt-hero pt-rise">
        <div>
          <p className="pt-eyebrow">{formatDay(new Date(), lang)}</p>
          <h1 className="pt-title">
            {t('portal.admin.greeting')} <em>{user?.name || user?.email?.split('@')[0] || ''}</em>
          </h1>
          <p className="pt-lede">{lede()}</p>
        </div>
        <div className="pt-hero__actions">
          <Link to="/super-admin/orders" className="pt-btn pt-btn--ghost">
            <ShoppingCart />
            <span>{t('nav.ordersManagement')}</span>
          </Link>
          <Link to="/super-admin/merchants" className="pt-btn pt-btn--ink">
            <Store />
            <span>{t('portal.admin.manageMerchants')}</span>
          </Link>
        </div>
      </header>

      {loadError && (
        <div className="pt-sheet pt-rise" style={{ paddingTop: 18 }}>
          <div className="pt-error" role="alert">
            <span>{t('portal.admin.loadError')}</span>
            <button type="button" className="pt-btn pt-btn--ghost pt-btn--sm" onClick={reload}>
              <RefreshCw />
              {t('merchantOrders.refresh')}
            </button>
          </div>
        </div>
      )}

      <section className="pt-sheet pt-strip pt-rise" aria-busy={loading}>
        <div>
          <span>{t('portal.admin.merchants')}</span>
          <b className="pt-num">{dash ?? formatCount(merchantsTotal, lang)}</b>
          <small>{unknown ? ' ' : t('portal.admin.activeCount', { count: stats.active.length })}</small>
        </div>
        <div>
          <span>{t('portal.admin.awaiting')}</span>
          <b className="pt-num">{dash ?? stats.pending.length}</b>
          <small>
            {stats.inactive.length > 0
              ? t('portal.admin.inactiveCount', { count: stats.inactive.length })
              : t('portal.admin.awaitingHint')}
          </small>
        </div>
        <div>
          <span>{ordersSummary ? t('merchant.totalOrders', 'Total Orders') : t('portal.admin.usedLinks')}</span>
          <b className="pt-num">
            {dash ?? formatCount(ordersSummary ? ordersSummary.total : stats.usedLinks, lang)}
          </b>
          <small>
            {ordersSummary
              ? t('portal.admin.ordersPending', { count: ordersSummary.pending })
              : t('portal.admin.usedLinksHint')}
          </small>
        </div>
        <div>
          <span>{t('portal.admin.lowQuota')}</span>
          <b className="pt-num" style={stats.low.length ? { color: 'var(--wax)' } : undefined}>
            {dash ?? stats.low.length}
          </b>
          <small className={stats.low.length ? 'is-wax' : undefined}>{t('portal.admin.lowQuotaHint')}</small>
        </div>
      </section>

      <div className="pt-grid pt-grid--split">
        <div className="pt-grid">
          <section className="pt-sheet pt-rise">
            <div className="pt-sheet__head">
              <h2 className="pt-h2">{t('portal.admin.lowTitle')}</h2>
              <Link to="/super-admin/merchants" className="pt-link">
                {t('portal.admin.openMerchants')}
                <ArrowRight className="pt-flip" />
              </Link>
            </div>
            {loading ? (
              <SkeletonRows />
            ) : stats.low.length > 0 ? (
              <ul className="pt-list">
                {stats.low.slice(0, LIST_SIZE).map((m) => {
                  const total = m.totalQuota ?? 0;
                  const used = total > 0 ? Math.min(1, (m.usedLinks ?? 0) / total) : 1;
                  return (
                    <li key={m.id} className="pt-mrow">
                      <div className="pt-mrow__name">
                        <b>{name(m)}</b>
                        <small>
                          {total > 0
                            ? t('portal.admin.remainingOf', { remaining: remainingOf(m), total })
                            : t('portal.admin.noQuota')}
                        </small>
                      </div>
                      <div className="pt-meter is-low" aria-hidden="true">
                        <i style={{ width: `${used * 100}%` }} />
                      </div>
                      <span className="pt-mrow__value" style={{ color: 'var(--wax)' }}>
                        {remainingOf(m)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              !loadError && <p className="pt-note">{t('portal.admin.lowNone')}</p>
            )}
          </section>

          <section className="pt-sheet pt-rise">
            <div className="pt-sheet__head">
              <h2 className="pt-h2">{t('portal.admin.pendingTitle')}</h2>
              <small>{unknown ? '' : stats.pending.length}</small>
            </div>
            {loading ? (
              <SkeletonRows count={2} />
            ) : stats.pending.length > 0 ? (
              <ul className="pt-list">
                {stats.pending.slice(0, LIST_SIZE).map((m) => (
                  <li key={m.id} className="pt-row">
                    <span className="pt-row__no" aria-hidden="true">
                      <UserRoundPlus size={18} />
                    </span>
                    <div className="pt-row__main">
                      <b>{name(m)}</b>
                      <div className="pt-row__sub">
                        <span>{m.email}</span>
                        {m.createdAt && <span>{formatRelative(m.createdAt, lang)}</span>}
                      </div>
                    </div>
                    <span className="pt-pill pt-pill--off">{t('superAdmin.pendingPasswordSet')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              !loadError && <p className="pt-note">{t('portal.admin.pendingNone')}</p>
            )}
          </section>
        </div>

        <section className="pt-sheet pt-rise">
          <div className="pt-sheet__head">
            <h2 className="pt-h2">{t('portal.admin.busiestTitle')}</h2>
            <small>{t('portal.admin.busiestHint')}</small>
          </div>
          {loading ? (
            <SkeletonRows count={4} />
          ) : stats.busiest.length > 0 ? (
            <ul className="pt-list">
              {stats.busiest.map((m) => (
                <li key={m.id} className="pt-mrow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                  <div className="pt-mrow__name">
                    <b>{name(m)}</b>
                    <small>
                      {m.isUnlimitedQuota ? (
                        <>
                          <InfinityIcon size={12} style={{ verticalAlign: '-2px' }} /> {t('merchant.unlimited', 'Unlimited')}
                        </>
                      ) : (
                        t('portal.admin.remainingOf', { remaining: remainingOf(m), total: m.totalQuota ?? 0 })
                      )}
                    </small>
                  </div>
                  <span className="pt-mrow__value">{formatCount(m.usedLinks ?? 0, lang)}</span>
                  <div className="pt-meter" aria-hidden="true" style={{ gridColumn: '1 / -1' }}>
                    <i style={{ width: `${((m.usedLinks ?? 0) / busiestMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            !loadError && <p className="pt-note">{t('portal.admin.busiestNone')}</p>
          )}
        </section>
      </div>
    </div>
  );
};

const SkeletonRows: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <ul className="pt-list" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <li key={i} className="pt-mrow">
        <span className="pt-skel" style={{ width: '70%', height: 16 }} />
        <span className="pt-skel" style={{ height: 6 }} />
        <span className="pt-skel" style={{ width: 32, height: 16 }} />
      </li>
    ))}
  </ul>
);

export default SuperAdminDashboardPage;
