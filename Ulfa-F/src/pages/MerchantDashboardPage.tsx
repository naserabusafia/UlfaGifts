import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useMerchantDashboard, type MerchantDashboardProps } from '../features/dashboard';
import {
  merchantOrderService,
  orderGiftCount,
  orderSetupProgress,
  type MerchantOrder,
  type MerchantOrdersResponse,
} from '../features/orders/services/merchantOrderService';
import { formatDay, formatRelative } from '../features/dashboard/format';
import '../features/dashboard/portal.css';
import { ArrowRight, BellRing, Gift, Inbox, Infinity as InfinityIcon, Nfc, Phone, Plus, RefreshCw } from 'lucide-react';

const TICKS = 40;
const RECENT_LIMIT = 5;
const NEW_LIMIT = 5;
const LOW_SHARE = 0.15;

interface RecentRow {
  key: string;
  label: string;
  customerName: string;
  customerPhone?: string;
  done: boolean;
  cancelled?: boolean;
  createdAt?: string;
  cards?: number;
  gift?: ReturnType<typeof orderSetupProgress>;
  /** Opens the order's details on the orders page. */
  to?: string;
}

const toRow = (order: MerchantOrder): RecentRow => ({
  key: order.id,
  label: `#${order.orderNumber}`,
  customerName: order.customerName,
  customerPhone: order.customerPhone,
  done: order.status === 'COMPLETED',
  cancelled: order.status === 'CANCELLED',
  createdAt: order.createdAt,
  cards: orderGiftCount(order.items),
  gift: orderSetupProgress(order),
  to: `/merchant/orders?order=${order.id}`,
});

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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data } = useMerchantDashboard(initialData);
  const lang = i18n.language;

  // Store / company name (API profile companyName, name, or storeName)
  const storeName =
    initialData?.storeName ||
    data.storeName ||
    user?.companyName ||
    user?.name ||
    user?.email?.split('@')[0] ||
    t('merchant.defaultStoreName', 'Al Baraka Store');

  // Quota: props first, then initialData, the dashboard hook, then the user profile
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
      : totalQuota === 'unlimited' || directAvailable === 'unlimited';

  const usedLinks = usedLinksProp ?? initialData?.usedLinks ?? data.usedLinks ?? user?.usedLinks ?? 0;

  // Available = totalQuota - usedLinks when the quota is limited
  let availableLinks = 0;
  if (typeof directAvailable === 'number') {
    availableLinks = directAvailable;
  } else if (typeof totalQuota === 'number') {
    availableLinks = Math.max(0, totalQuota - usedLinks);
  }
  const quotaTotal = typeof totalQuota === 'number' ? totalQuota : availableLinks + usedLinks;
  const share = quotaTotal > 0 ? availableLinks / quotaTotal : 0;
  const isLow = !isUnlimited && share <= LOW_SHARE;
  const litTicks = isUnlimited ? TICKS : Math.round(share * TICKS);

  // Recent orders: passed in, or loaded from the merchant orders API
  const providedOrders = recentOrdersProp ?? initialData?.recentOrders;
  const [orders, setOrders] = useState<MerchantOrdersResponse | null>(null);
  const [newOrders, setNewOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(!providedOrders);
  const [loadError, setLoadError] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const [recent, pendingOrders] = await Promise.all([
        merchantOrderService.getOrders({ page: 1, limit: RECENT_LIMIT }),
        merchantOrderService.getOrders({ page: 1, limit: NEW_LIMIT, status: 'PENDING' }),
      ]);
      setOrders(recent);
      setNewOrders(pendingOrders.items);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadOrders = () => {
    setLoading(true);
    setLoadError(false);
    fetchOrders();
  };

  useEffect(() => {
    if (!providedOrders) fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchOrders]);

  const rows: RecentRow[] = providedOrders
    ? providedOrders.map((order) => ({
        key: order.id,
        label: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        done: order.status === 'Completed',
        createdAt: order.date,
      }))
    : (orders?.items ?? []).map(toRow);

  const summary = orders?.summary;
  const totalOrders = totalOrdersProp ?? initialData?.totalOrders ?? data.totalOrders ?? summary?.total ?? 0;
  const pending = summary?.pending;
  const completed = summary?.completed;

  const giftLabel = (gift: NonNullable<RecentRow['gift']>) => {
    if (gift.total > 1) return t('portal.merchant.giftReadyOf', { ready: gift.ready, total: gift.total });
    if (gift.ready) return t('merchantOrders.setupReady');
    if (gift.started) return t('merchantOrders.setupInProgress');
    return t('merchantOrders.setupNotStarted');
  };

  const renderRow = (row: RecentRow) => {
    const content = (
      <>
        <span className="pt-row__no">{row.label}</span>
        <div className="pt-row__main">
          <b>{row.customerName}</b>
          <div className="pt-row__sub">
            {row.createdAt && <span>{formatRelative(row.createdAt, lang)}</span>}
            {row.cards !== undefined && (
              <span>
                <Nfc />
                {t('portal.merchant.cards', { count: row.cards })}
              </span>
            )}
            {!row.cancelled && row.gift?.known && row.gift.total > 0 && (
              <span className={row.gift.ready === row.gift.total ? 'pt-gift is-ready' : 'pt-gift'}>
                <Gift />
                {giftLabel(row.gift)}
              </span>
            )}
            {row.customerPhone && (
              <span dir="ltr">
                <Phone />
                {row.customerPhone}
              </span>
            )}
          </div>
        </div>
        <div className="pt-row__end">
          {row.cancelled ? (
            <span className="pt-pill pt-pill--off">{t('merchantOrders.cancelled')}</span>
          ) : (
            <span className={`pt-pill ${row.done ? 'pt-pill--done' : 'pt-pill--wait'}`}>
              {row.done ? t('merchantOrders.completed') : t('merchantOrders.pending')}
            </span>
          )}
        </div>
      </>
    );
    return (
      <li key={row.key}>
        {row.to ? (
          <Link to={row.to} className="pt-row pt-row--link">{content}</Link>
        ) : (
          <div className="pt-row">{content}</div>
        )}
      </li>
    );
  };

  const addOrder = () => (onAddNewOrder ? onAddNewOrder() : navigate('/merchant/orders/new'));

  const lede = () => {
    if (pending === undefined) return t('portal.merchant.ledeDefault');
    if (totalOrders === 0) return t('portal.merchant.ledeFirst');
    if (pending === 0) return t('portal.merchant.ledeAllDone');
    return (
      <>
        {t('portal.merchant.ledePendingBefore')} <b>{pending}</b> {t('portal.merchant.ledePendingAfter')}
      </>
    );
  };

  return (
    <div className="pt">
      <header className="pt-hero pt-rise">
        <div>
          <p className="pt-eyebrow">{formatDay(new Date(), lang)}</p>
          <h1 className="pt-title">
            {t('portal.merchant.greeting')} <em>{storeName}</em>
          </h1>
          <p className="pt-lede">{lede()}</p>
        </div>
        <div className="pt-hero__actions">
          <button type="button" onClick={addOrder} className="pt-btn pt-btn--wax">
            <Plus strokeWidth={2.4} />
            <span>{t('portal.merchant.newOrder')}</span>
          </button>
        </div>
      </header>

      <div className="pt-grid pt-grid--top pt-rise">
        <section className={`pt-card${isLow ? ' is-low' : ''}`} aria-label={t('merchant.availableLinks', 'Available Links')}>
          <div className="pt-card__top">
            <span className="pt-card__label">{t('portal.merchant.remainingLinks')}</span>
            <span className="pt-card__chip">
              <Nfc />
              {isUnlimited
                ? t('portal.merchant.unlimited')
                : availableLinks === 0
                  ? t('portal.merchant.emptyChip')
                  : isLow
                    ? t('portal.merchant.lowChip')
                    : t('portal.merchant.okChip')}
            </span>
          </div>

          <div className="pt-card__figure">
            {isUnlimited ? (
              <InfinityIcon className="pt-infinity" aria-label={t('merchant.unlimited', 'Unlimited')} />
            ) : (
              <span className="pt-num">{availableLinks}</span>
            )}
            <span>
              {isUnlimited
                ? t('portal.merchant.unlimitedHint')
                : t('portal.merchant.ofTotal', { total: quotaTotal })}
            </span>
          </div>

          <div>
            <div
              className="pt-ticks"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={isUnlimited ? TICKS : quotaTotal}
              aria-valuenow={isUnlimited ? TICKS : availableLinks}
            >
              {Array.from({ length: TICKS }, (_, i) => (
                <i key={i} className={i < litTicks ? 'on' : undefined} style={{ '--i': i } as React.CSSProperties} />
              ))}
            </div>
            <div className="pt-card__meta" style={{ marginTop: 10 }}>
              <span>
                {t('portal.merchant.usedLinks')} <b>{usedLinks}</b>
                {data.usedPercentageChange !== undefined && ` · +${data.usedPercentageChange}%`}
              </span>
              {!isUnlimited && (
                <Link to="/merchant/quota" className="pt-link">
                  {isLow ? t('portal.merchant.lowHint') : t('portal.merchant.requestMore')}
                  <ArrowRight className="pt-flip" />
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="pt-sheet">
          <div className="pt-sheet__head">
            <h2 className="pt-h2">{t('portal.merchant.ordersTitle')}</h2>
          </div>
          <div className="pt-facts">
            <div className="pt-fact">
              <span>{t('merchant.totalOrders', 'Total Orders')}</span>
              <b className="pt-num">{!providedOrders && (loading || loadError) && totalOrdersProp === undefined ? '–' : totalOrders}</b>
            </div>
            <Link to="/merchant/orders?status=PENDING" className="pt-fact pt-fact--wax pt-fact--link">
              <span>{t('merchantOrders.pending')}</span>
              <b className="pt-num">{pending ?? '–'}</b>
            </Link>
            <div className="pt-fact">
              <span>{t('merchantOrders.completed')}</span>
              <b className="pt-num">{completed ?? '–'}</b>
            </div>
            {summary && summary.total > 0 && (
              <div>
                <div className="pt-split" aria-hidden="true">
                  <i style={{ width: `${(summary.completed / summary.total) * 100}%` }} />
                  <i style={{ width: `${(summary.pending / summary.total) * 100}%` }} />
                </div>
                <div className="pt-legend">
                  <span>{t('merchantOrders.completed')}</span>
                  <span>{t('merchantOrders.pending')}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {!providedOrders && newOrders.length > 0 && (
        <section className="pt-sheet pt-sheet--new pt-rise" aria-labelledby="pt-new-orders">
          <div className="pt-sheet__head">
            <h2 id="pt-new-orders" className="pt-h2">
              <BellRing className="pt-h2__icon" />
              {t('portal.merchant.newRequests')}
              <span className="pt-count">{pending ?? newOrders.length}</span>
            </h2>
            <Link to="/merchant/orders?status=PENDING" className="pt-link">
              {t('portal.merchant.allNewRequests')}
              <ArrowRight className="pt-flip" />
            </Link>
          </div>
          <ul className="pt-list">{newOrders.map((order) => renderRow(toRow(order)))}</ul>
        </section>
      )}

      <section className="pt-sheet pt-rise">
        <div className="pt-sheet__head">
          <h2 className="pt-h2">{t('merchant.recentOrders', 'Recent Orders')}</h2>
          <Link to="/merchant/orders" className="pt-link">
            {t('portal.merchant.allOrders')}
            <ArrowRight className="pt-flip" />
          </Link>
        </div>

        {loadError && (
          <div className="pt-error" role="alert">
            <span>{t('merchantOrders.loadError')}</span>
            <button type="button" className="pt-btn pt-btn--ghost pt-btn--sm" onClick={reloadOrders}>
              <RefreshCw />
              {t('merchantOrders.refresh')}
            </button>
          </div>
        )}

        {loading ? (
          <ul className="pt-list" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="pt-row">
                <span className="pt-skel" style={{ width: 48, height: 16 }} />
                <span className="pt-skel" style={{ width: '60%', height: 16 }} />
                <span className="pt-skel" style={{ width: 70, height: 22, borderRadius: 999 }} />
              </li>
            ))}
          </ul>
        ) : rows.length > 0 ? (
          <ul className="pt-list">
            {rows.map(renderRow)}
          </ul>
        ) : (
          !loadError && (
            <div className="pt-empty">
              <Inbox />
              <p>{t('merchantOrders.emptyFirst')}</p>
              <button type="button" onClick={addOrder} className="pt-btn pt-btn--ghost pt-btn--sm">
                <Plus />
                {t('portal.merchant.newOrder')}
              </button>
            </div>
          )
        )}
      </section>
    </div>
  );
};

export default MerchantDashboardPage;
