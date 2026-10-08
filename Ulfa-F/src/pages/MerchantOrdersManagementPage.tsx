import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Ban,
  Clock3,
  RotateCcw,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Gift,
  Link2,
  Lock,
  Loader2,
  PackageOpen,
  PenLine,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  TriangleAlert,
  Unlock,
  X,
} from 'lucide-react';
import type { AxiosError } from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  merchantOrderService,
  type MerchantOrder,
  type MerchantOrdersResponse,
  type SetupState,
  orderGiftCount,
  orderSetupProgress,
} from '../features/orders/services/merchantOrderService';
import { GiftPieces } from '../features/orders/components/GiftPieces';

type StatusFilter = '' | 'PENDING' | 'COMPLETED' | 'CANCELLED';

// Matches the backend default (CANCELLED_CONTENT_RETENTION_HOURS); once an
// order is cancelled the page shows the exact time the server sends instead.
const CONTENT_RETENTION_HOURS = 72;

const initialResponse: MerchantOrdersResponse = {
  items: [],
  meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
  summary: { total: 0, pending: 0, completed: 0 },
};

export const MerchantOrdersManagementPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { refetchProfile } = useAuth();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // Status a cancelled order would go back to, while its restore is being confirmed.
  const [restoreTarget, setRestoreTarget] = useState<'PENDING' | 'COMPLETED' | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [response, setResponse] = useState(initialResponse);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // The dashboard links here with ?status=PENDING or ?order=<id>.
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<StatusFilter>(() => {
    const fromUrl = searchParams.get('status');
    return fromUrl === 'PENDING' || fromUrl === 'COMPLETED' || fromUrl === 'CANCELLED' ? fromUrl : '';
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<MerchantOrder | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  // Item whose lock form is open, and the optional reason being typed.
  const [lockingItemId, setLockingItemId] = useState<string | null>(null);
  const [lockReason, setLockReason] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await merchantOrderService.getOrders({
        page,
        limit: 10,
        search: search || undefined,
        status: status || undefined,
      });
      setResponse(data);
    } catch {
      setError(t('merchantOrders.loadError', 'Could not load your orders. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, status, t]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const openDetails = async (order: MerchantOrder) => {
    setConfirmingCancel(false);
    setRestoreTarget(null);
    setSelectedOrder(order);
    setIsLoadingDetails(true);
    try {
      setSelectedOrder(await merchantOrderService.getOrder(order.id));
    } catch {
      setError(t('merchantOrders.detailsError', 'Could not load order details.'));
      setSelectedOrder(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const linkedOrderId = searchParams.get('order');
  useEffect(() => {
    if (!linkedOrderId) return;
    setSearchParams((params) => {
      params.delete('order');
      return params;
    }, { replace: true });
    // The details open once the order has loaded.
    merchantOrderService
      .getOrder(linkedOrderId)
      .then(setSelectedOrder)
      .catch(() => setError(t('merchantOrders.detailsError', 'Could not load order details.')));
  }, [linkedOrderId, setSearchParams, t]);

  const copyLink = async (linkId: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  const requestStatusChange = (order: MerchantOrder, newStatus: MerchantOrder['status']) => {
    if (order.status === newStatus) return;
    if (newStatus !== 'CANCELLED' && order.status !== 'CANCELLED') {
      void handleStatusChange(order, newStatus);
      return;
    }
    if (selectedOrder?.id !== order.id) void openDetails(order);
    if (newStatus === 'CANCELLED') {
      setRestoreTarget(null);
      setConfirmingCancel(true);
    } else {
      setConfirmingCancel(false);
      setRestoreTarget(newStatus);
    }
  };

  const handleStatusChange = async (
    order: MerchantOrder,
    newStatus: MerchantOrder['status'],
  ) => {
    if (order.status === newStatus) return;
    setUpdatingOrderId(order.id);
    setError('');
    try {
      const updatedOrder = await merchantOrderService.updateOrderStatus(
        order.id,
        newStatus,
      );
      setSelectedOrder((current) =>
        current?.id === updatedOrder.id ? updatedOrder : current,
      );
      await loadOrders();
    } catch {
      setError(t('merchantOrders.statusError', 'Could not update the order status.'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleItemLockChange = async (
    order: MerchantOrder,
    itemId: string,
    isLocked: boolean,
    reason?: string,
  ) => {
    setUpdatingItemId(itemId);
    setError('');
    try {
      const updatedOrder = await merchantOrderService.updateItemLock(
        order.id,
        itemId,
        isLocked,
        reason?.trim() || undefined,
      );
      setLockingItemId(null);
      setLockReason('');
      setSelectedOrder(updatedOrder);
      setResponse((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === updatedOrder.id ? updatedOrder : item,
        ),
      }));
    } catch {
      setError(t('merchantOrders.lockError', 'Could not update the NFC item state.'));
    } finally {
      setUpdatingItemId(null);
    }
  };

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-PS' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));

  const formatDateTime = (date: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-PS' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(date));

  const handleCancelOrder = async (order: MerchantOrder) => {
    setIsCancelling(true);
    setError('');
    try {
      const updated = await merchantOrderService.updateOrderStatus(order.id, 'CANCELLED');
      setSelectedOrder(updated);
      setConfirmingCancel(false);
      await loadOrders();
      // The refunded links show up in the quota everywhere.
      await refetchProfile();
    } catch {
      setError(t('merchantOrders.cancelError', 'The order could not be cancelled. Please try again.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRestoreOrder = async (order: MerchantOrder, target: 'PENDING' | 'COMPLETED') => {
    setIsCancelling(true);
    setError('');
    try {
      const updated = await merchantOrderService.updateOrderStatus(order.id, target);
      setSelectedOrder(updated);
      setRestoreTarget(null);
      await loadOrders();
      // The links are charged again, so the quota changes everywhere.
      await refetchProfile();
    } catch (err) {
      const body = (err as AxiosError<{ code?: string; available?: number; requested?: number }>).response?.data;
      setError(
        body?.code === 'NFC_QUOTA_EXCEEDED'
          ? t('merchantOrders.restoreQuotaError', 'Not enough quota to restore this order: it needs {{requested}} link(s) and you have {{available}}.', { requested: body.requested ?? 0, available: body.available ?? 0 })
          : body?.code === 'RESTORE_WINDOW_PASSED'
            ? t('merchantOrders.restoreWindowPassed', "This order can no longer be restored: the customer's content has been deleted.")
            : t('merchantOrders.restoreError', 'The order could not be restored. Please try again.'),
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // The server has the last word: past the window it answers RESTORE_WINDOW_PASSED.
  const canRestore = (order: MerchantOrder) =>
    order.status === 'CANCELLED' && !order.contentPurgedAt && !!order.contentDeletesAt;

  const statusSelect = (order: MerchantOrder, className: string) => (
    <select
      value={order.status}
      disabled={updatingOrderId === order.id || (order.status === 'CANCELLED' && !canRestore(order))}
      onChange={(event) => requestStatusChange(order, event.target.value as MerchantOrder['status'])}
      className={className}
    >
      <option value="PENDING">{t('merchantOrders.pending', 'Pending')}</option>
      <option value="COMPLETED">{t('merchantOrders.completed', 'Completed')}</option>
      <option value="CANCELLED">{t('merchantOrders.cancelled', 'Cancelled')}</option>
    </select>
  );

  const statusBadge = (orderStatus: MerchantOrder['status']) =>
    orderStatus === 'CANCELLED' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-extrabold text-red-700 dark:text-red-300"><Ban className="h-3.5 w-3.5" />{t('merchantOrders.cancelled', 'Cancelled')}</span>
    ) : orderStatus === 'COMPLETED' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />{t('merchantOrders.completed', 'Completed')}</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-extrabold text-amber-700 dark:text-amber-300"><Clock3 className="h-3.5 w-3.5" />{t('merchantOrders.pending', 'Pending')}</span>
    );

  const setupBadge = (state?: SetupState) => {
    if (!state) return null;
    const styles: Record<SetupState, string> = {
      READY: 'bg-primary text-primary-foreground',
      IN_PROGRESS: 'bg-amber-500/12 text-amber-800 dark:text-amber-300',
      NOT_STARTED: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
    };
    const labels: Record<SetupState, string> = {
      READY: t('merchantOrders.setupReady', 'Gift ready'),
      IN_PROGRESS: t('merchantOrders.setupInProgress', 'Customer is preparing'),
      NOT_STARTED: t('merchantOrders.setupNotStarted', 'Not started yet'),
    };
    const Icon = state === 'READY' ? Gift : state === 'IN_PROGRESS' ? PenLine : Clock3;
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold ${styles[state]}`}>
        <Icon className="h-3.5 w-3.5" />
        {labels[state]}
      </span>
    );
  };

  /** One badge for single-link orders, plus "x of y ready" when an order has several links. */
  const orderSetupBadge = (order: MerchantOrder) => {
    const progress = orderSetupProgress(order);
    if (!progress.known || progress.total === 0) return <span className="text-xs text-muted-foreground">—</span>;
    if (progress.total === 1) return setupBadge(order.items[0].setupState);
    const state: SetupState =
      progress.ready === progress.total ? 'READY' : progress.ready + progress.started > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
    return (
      <span className="inline-flex flex-col items-start gap-1">
        {setupBadge(state)}
        <span className="text-[10px] font-semibold text-muted-foreground">
          {t('merchantOrders.readyOf', '{{ready}} of {{total}} ready', { ready: progress.ready, total: progress.total })}
        </span>
      </span>
    );
  };

  const sourceLabel = (source: MerchantOrder['source']) => {
    if (source === 'EXTERNAL_API') return t('merchantOrders.websiteApi', 'Website API');
    if (source === 'ADMIN') return t('merchantOrders.admin', 'Admin');
    return t('merchantOrders.portal', 'Merchant portal');
  };

  const totalPages = Math.max(1, response.meta.totalPages);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">{t('merchantOrders.eyebrow', 'Merchant operations')}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">{t('merchantOrders.title', 'Orders Management')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('merchantOrders.subtitle', 'Search your orders and manage every generated NFC setup link.')}</p>
        </div>
        <Link to="/merchant/orders/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground shadow-md shadow-primary/20 transition hover:brightness-105"><Plus className="h-4 w-4" />{t('merchantOrders.newOrder', 'Create new order')}</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold text-muted-foreground">{t('merchantOrders.total', 'Total orders')}</p><ShoppingBag className="h-4 w-4 text-primary" /></div><p className="mt-3 text-3xl font-black text-foreground">{response.summary.total}</p></div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold text-muted-foreground">{t('merchantOrders.pending', 'Pending')}</p><Clock3 className="h-4 w-4 text-amber-500" /></div><p className="mt-3 text-3xl font-black text-foreground">{response.summary.pending}</p></div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold text-muted-foreground">{t('merchantOrders.completed', 'Completed')}</p><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div><p className="mt-3 text-3xl font-black text-foreground">{response.summary.completed}</p></div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[1fr_190px_auto] sm:p-5">
          <label className="relative block"><Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t('merchantOrders.search', 'Search by customer or order ID...')} className="w-full rounded-xl border border-input bg-background py-3 pe-4 ps-10 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>
          <select value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }} className="rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-bold text-foreground outline-none focus:border-primary">
            <option value="">{t('merchantOrders.allStatuses', 'All statuses')}</option>
            <option value="PENDING">{t('merchantOrders.pending', 'Pending')}</option>
            <option value="COMPLETED">{t('merchantOrders.completed', 'Completed')}</option>
            <option value="CANCELLED">{t('merchantOrders.cancelled', 'Cancelled')}</option>
          </select>
          <button type="button" onClick={() => void loadOrders()} disabled={isLoading} className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-3 text-foreground transition hover:bg-muted disabled:opacity-50" aria-label={t('merchantOrders.refresh', 'Refresh')}><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></button>
        </div>

        {error && <div role="alert" className="m-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

        {isLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-7 w-7 animate-spin text-primary" /><p className="text-sm font-semibold">{t('merchantOrders.loading', 'Loading orders...')}</p></div>
        ) : response.items.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><PackageOpen className="h-7 w-7" /></div><h2 className="mt-4 font-extrabold text-foreground">{t('merchantOrders.emptyTitle', 'No orders found')}</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">{search || status ? t('merchantOrders.emptyFiltered', 'Try changing your search or status filter.') : t('merchantOrders.emptyFirst', 'Create your first order to generate NFC setup links.')}</p>{!search && !status && <Link to="/merchant/orders/new" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground"><Plus className="h-4 w-4" />{t('merchantOrders.newOrder', 'Create new order')}</Link>}</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-start">
                <thead className="bg-muted/50 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 text-start">{t('merchantOrders.order', 'Order')}</th><th className="px-5 py-3 text-start">{t('merchantOrders.customer', 'Customer')}</th><th className="px-5 py-3 text-start">{t('merchantOrders.items', 'NFC items')}</th><th className="px-5 py-3 text-start">{t('merchantOrders.giftColumn', 'Gift')}</th><th className="px-5 py-3 text-start">{t('merchantOrders.status', 'Status')}</th><th className="px-5 py-3 text-start">{t('merchantOrders.date', 'Date')}</th><th className="px-5 py-3"></th></tr></thead>
                <tbody className="divide-y divide-border">{response.items.map((order) => <tr key={order.id} className="transition hover:bg-muted/30"><td className="px-5 py-4"><p className="font-mono text-xs font-bold text-foreground">#{order.orderNumber}</p><p className="mt-1 text-[10px] text-muted-foreground">{order.externalOrderId || sourceLabel(order.source)}</p></td><td className="px-5 py-4"><p className="text-sm font-bold text-foreground">{order.customerName}</p><p dir="ltr" className="mt-1 text-start text-[10px] text-muted-foreground">{order.customerPhone || '—'}</p></td><td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary"><Gift className="h-3.5 w-3.5" />{orderGiftCount(order.items)}</span>{orderGiftCount(order.items) > order.items.length && <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{t('merchantOrders.linkCount', { count: order.items.length })}</p>}</td><td className="px-5 py-4">{orderSetupBadge(order)}</td><td className="px-5 py-4">{statusSelect(order, `rounded-xl border bg-background px-3 py-2 text-xs font-extrabold outline-none focus:border-primary disabled:opacity-60 ${order.status === 'CANCELLED' ? 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-300' : 'border-input text-foreground'}`)}</td><td className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-muted-foreground">{formatDate(order.createdAt)}</td><td className="px-5 py-4 text-end"><button type="button" onClick={() => void openDetails(order)} className="rounded-xl border border-border px-3 py-2 text-xs font-extrabold text-foreground transition hover:bg-muted">{t('merchantOrders.view', 'View')}</button></td></tr>)}</tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">{response.items.map((order) => <button key={order.id} type="button" onClick={() => void openDetails(order)} className="block w-full p-4 text-start transition hover:bg-muted/30"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-extrabold text-foreground">#{order.orderNumber}</p><p className="mt-1 text-sm font-bold text-foreground">{order.customerName}</p><p dir="ltr" className="mt-1 text-start text-[10px] text-muted-foreground">{order.customerPhone || '—'}</p></div>{statusBadge(order.status)}</div><div className="mt-3">{orderSetupBadge(order)}</div><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />{t('merchantOrders.itemCount', '{{count}} NFC items', { count: orderGiftCount(order.items) })}</span><span>{formatDate(order.createdAt)}</span></div></button>)}</div>
          </>
        )}

        {!isLoading && response.meta.total > 0 && <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-5"><p className="text-xs text-muted-foreground">{t('merchantOrders.pageInfo', 'Page {{page}} of {{totalPages}} · {{total}} orders', { page, totalPages, total: response.meta.total })}</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-border p-2 text-foreground disabled:opacity-35" aria-label={t('merchantOrders.previous', 'Previous')}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button><span className="min-w-7 text-center text-xs font-black text-foreground">{page}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-border p-2 text-foreground disabled:opacity-35" aria-label={t('merchantOrders.next', 'Next')}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button></div></div>}
      </div>

      {selectedOrder && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) { setSelectedOrder(null); setLockingItemId(null); setConfirmingCancel(false); setRestoreTarget(null); } }}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card/95 p-5 backdrop-blur sm:p-6"><div><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h2 className="text-xl font-black text-foreground">{t('merchantOrders.details', 'Order details')}</h2></div><p className="mt-1 font-mono text-[10px] text-muted-foreground">{selectedOrder.id}</p></div><button type="button" onClick={() => { setSelectedOrder(null); setLockingItemId(null); setConfirmingCancel(false); setRestoreTarget(null); }} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted" aria-label={t('merchantOrders.close', 'Close')}><X className="h-4 w-4" /></button></div>
        {isLoadingDetails ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : <div className="space-y-5 p-5 sm:p-6"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-muted p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.customer', 'Customer')}</p><p className="mt-1 font-extrabold text-foreground">{selectedOrder.customerName}</p></div><div className="rounded-2xl bg-muted p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.customerPhone', 'Customer phone')}</p>{selectedOrder.customerPhone ? <a href={`tel:${selectedOrder.customerPhone}`} dir="ltr" className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-primary"><Phone className="h-3.5 w-3.5" />{selectedOrder.customerPhone}</a> : <p className="mt-1 text-sm font-bold text-foreground">—</p>}</div><div className="rounded-2xl bg-muted p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.status', 'Status')}</p>{statusSelect(selectedOrder, `mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-extrabold outline-none focus:border-primary disabled:opacity-60 ${selectedOrder.status === 'CANCELLED' ? 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-300' : 'border-input text-foreground'}`)}</div><div className="rounded-2xl bg-muted p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.externalId', 'External order ID')}</p><p className="mt-1 text-sm font-bold text-foreground">{selectedOrder.externalOrderId || '—'}</p></div><div className="rounded-2xl bg-muted p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.source', 'Source')}</p><p className="mt-1 text-sm font-bold text-foreground">{sourceLabel(selectedOrder.source)}</p></div></div>
          {selectedOrder.status === 'CANCELLED' ? (
            <div className="rounded-2xl border border-red-200/70 bg-red-500/5 p-4 text-sm dark:border-red-900">
              <p className="flex items-center gap-2 font-extrabold text-red-700 dark:text-red-300"><Ban className="h-4 w-4" />{t('merchantOrders.cancelledTitle', 'This order is cancelled')}</p>
              <p className="mt-1.5 text-muted-foreground">
                {selectedOrder.cancelledAt && <>{t('merchantOrders.cancelledOn', 'Cancelled on {{date}}.', { date: formatDateTime(selectedOrder.cancelledAt) })} </>}
                {selectedOrder.contentPurgedAt
                  ? t('merchantOrders.contentDeleted', "The customer's photos and messages have been deleted.")
                  : selectedOrder.contentDeletesAt
                    ? t('merchantOrders.contentDeletesOn', "The customer's photos and messages will be deleted on {{date}}.", { date: formatDateTime(selectedOrder.contentDeletesAt) })
                    : null}
              </p>
              {restoreTarget ? (
                <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-3.5" role="alertdialog" aria-labelledby="restore-order-title">
                  <p id="restore-order-title" className="flex items-center gap-2 text-sm font-black text-foreground"><RotateCcw className="h-4 w-4" />{t('merchantOrders.restoreConfirmTitle', 'Restore order #{{number}}?', { number: selectedOrder.orderNumber })}</p>
                  <ul className="list-disc space-y-1 ps-5 text-xs leading-relaxed text-foreground">
                    <li>{t('merchantOrders.restoreEffectStatus', 'Its status becomes "{{status}}".', { status: restoreTarget === 'COMPLETED' ? t('merchantOrders.completed', 'Completed') : t('merchantOrders.pending', 'Pending') })}</li>
                    <li>{t('merchantOrders.restoreEffectLinks', 'Its links work again, except the ones you locked yourself.')}</li>
                    <li>{t('merchantOrders.restoreEffectQuota', '{{count}} link(s) are taken from your quota again.', { count: selectedOrder.items.filter((item) => item.quotaCharged !== false).length })}</li>
                    <li>{t('merchantOrders.restoreEffectDelete', "The scheduled deletion of the customer's content is called off.")}</li>
                  </ul>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setRestoreTarget(null)} disabled={isCancelling} className="rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-50">{t('merchantOrders.keepCancelled', 'Keep cancelled')}</button>
                    <button type="button" onClick={() => void handleRestoreOrder(selectedOrder, restoreTarget)} disabled={isCancelling} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-primary-foreground hover:brightness-110 disabled:opacity-50">{isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}{t('merchantOrders.confirmRestore', 'Restore order')}</button>
                  </div>
                </div>
              ) : canRestore(selectedOrder) ? (
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={() => setRestoreTarget('PENDING')} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-extrabold text-foreground hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" />{t('merchantOrders.restoreOrder', 'Restore order')}</button>
                </div>
              ) : null}
            </div>
          ) : confirmingCancel ? (
            <div className="space-y-3 rounded-2xl border border-red-200 bg-red-500/5 p-4 dark:border-red-900" role="alertdialog" aria-labelledby="cancel-order-title">
              <p id="cancel-order-title" className="flex items-center gap-2 text-sm font-black text-red-700 dark:text-red-300"><TriangleAlert className="h-4 w-4" />{t('merchantOrders.cancelConfirmTitle', 'Cancel order #{{number}}?', { number: selectedOrder.orderNumber })}</p>
              <ul className="list-disc space-y-1 ps-5 text-xs leading-relaxed text-foreground">
                <li>{t('merchantOrders.cancelEffectLinks', 'Its {{count}} link(s) stop working for the customer and the recipient.', { count: selectedOrder.items.length })}</li>
                <li>{t('merchantOrders.cancelEffectRefund', '{{count}} link(s) go back to your quota.', { count: selectedOrder.items.filter((item) => item.quotaCharged !== false).length })}</li>
                <li>{t('merchantOrders.cancelEffectDelete', "The customer's photos and messages are deleted for good after {{hours}} hours.", { hours: CONTENT_RETENTION_HOURS })}</li>
                {selectedOrder.items.some((item) => item.setupState === 'READY' || item.setupState === 'IN_PROGRESS') && <li className="font-bold text-red-700 dark:text-red-300">{t('merchantOrders.cancelEffectStarted', 'The customer has already started preparing this gift.')}</li>}
              </ul>
              <p className="text-xs font-bold text-foreground">{t('merchantOrders.cancelFinal', 'You can restore the order within {{hours}} hours. After that its content is deleted for good.', { hours: CONTENT_RETENTION_HOURS })}</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setConfirmingCancel(false)} disabled={isCancelling} className="rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-50">{t('merchantOrders.keepOrder', 'Keep order')}</button>
                <button type="button" onClick={() => void handleCancelOrder(selectedOrder)} disabled={isCancelling} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-red-700 disabled:opacity-50">{isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}{t('merchantOrders.confirmCancel', 'Cancel order')}</button>
              </div>
            </div>
          ) : null}
          <div><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-black text-foreground"><Link2 className="h-4 w-4 text-primary" />{t('merchantOrders.nfcLinks', 'NFC links')}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-extrabold text-muted-foreground">{selectedOrder.items.length}</span></div><div className="space-y-3">{selectedOrder.items.map((item) => <div key={item.id} className="rounded-2xl border border-border p-4"><div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <GiftPieces item={item} />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {setupBadge(item.setupState)}
                      {(item.giftCount ?? 1) > 1 && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground"><Link2 className="h-3.5 w-3.5" />{t('merchantOrders.sharedLink', 'One link for {{count}} gifts', { count: item.giftCount })}</span>}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">{item.isLocked ? t('merchantOrders.lockedHint', 'Setup editing is disabled') : t('merchantOrders.activeHint', 'Setup editing is enabled')}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.isLocked}
                    aria-expanded={!item.isLocked ? lockingItemId === item.id : undefined}
                    disabled={updatingItemId === item.id || selectedOrder.status === 'CANCELLED'}
                    onClick={() => {
                      // Unlocking is immediate; locking first asks for an optional reason.
                      if (item.isLocked) {
                        void handleItemLockChange(selectedOrder, item.id, false);
                      } else {
                        setLockReason('');
                        setLockingItemId(lockingItemId === item.id ? null : item.id);
                      }
                    }}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold transition disabled:cursor-wait disabled:opacity-50 ${item.isLocked ? 'border-red-200 bg-red-500/10 text-red-600 dark:border-red-900' : 'border-emerald-200 bg-emerald-500/10 text-emerald-600 dark:border-emerald-900'}`}
                  >
                    {updatingItemId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : item.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    {item.isLocked ? t('merchantOrders.locked', 'Locked') : t('merchantOrders.active', 'Active')}
                  </button>
                </div>
                {item.isLocked && item.lockReason && (
                  <div className="mt-3 rounded-xl border border-red-200/70 bg-red-500/5 px-3 py-2.5 dark:border-red-900">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-red-700 dark:text-red-300">{t('merchantOrders.lockReasonShown', 'Reason shown to the customer and recipient')}</p>
                    <p className="mt-1 whitespace-pre-line break-words text-sm text-foreground">{item.lockReason}</p>
                  </div>
                )}
                {!item.isLocked && lockingItemId === item.id && (
                  <form
                    className="mt-3 space-y-2.5 rounded-xl border border-border bg-muted/40 p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleItemLockChange(selectedOrder, item.id, true, lockReason);
                    }}
                  >
                    <label htmlFor={`lock-reason-${item.id}`} className="block text-xs font-extrabold text-foreground">
                      {t('merchantOrders.lockReasonLabel', 'Reason for locking')} <span className="font-medium text-muted-foreground">({t('createOrder.optional', 'optional')})</span>
                    </label>
                    <textarea
                      id={`lock-reason-${item.id}`}
                      autoFocus
                      rows={2}
                      maxLength={200}
                      value={lockReason}
                      onChange={(event) => setLockReason(event.target.value)}
                      placeholder={t('merchantOrders.lockReasonPlaceholder', 'e.g. The gift will be available after delivery')}
                      className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{t('merchantOrders.lockReasonWarning', 'This text is shown to the customer on the setup page and to the recipient when they open the gift.')}</span>
                      <span dir="ltr" className="ms-auto shrink-0 text-muted-foreground">{lockReason.length}/200</span>
                    </p>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setLockingItemId(null)} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted">{t('superAdmin.cancel', 'Cancel')}</button>
                      <button type="submit" disabled={updatingItemId === item.id} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-red-700 disabled:opacity-50">
                        {updatingItemId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                        {t('merchantOrders.confirmLock', 'Lock gift')}
                      </button>
                    </div>
                  </form>
                )}
                <div className="mt-3 space-y-2"><div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.setupLink', 'Setup link')}</p><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2 font-mono text-[10px] text-muted-foreground">{item.setupUrl}</span><button type="button" onClick={() => void copyLink(`${item.id}-setup`, item.setupUrl)} className="rounded-xl border border-border p-2.5 text-foreground hover:bg-muted" aria-label={t('merchantOrders.copySetup', 'Copy setup link')}>{copiedId === `${item.id}-setup` ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button><a href={item.setupUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-2.5 text-foreground hover:bg-muted" aria-label={t('merchantOrders.openSetup', 'Open setup link')}><ExternalLink className="h-4 w-4" /></a></div></div><div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.viewLink', 'View link')}</p><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate rounded-xl bg-blue-500/8 px-3 py-2 font-mono text-[10px] text-blue-700 dark:text-blue-300">{item.viewUrl}</span><button type="button" onClick={() => void copyLink(`${item.id}-view`, item.viewUrl)} className="rounded-xl border border-border p-2.5 text-foreground hover:bg-muted" aria-label={t('merchantOrders.copyView', 'Copy view link')}>{copiedId === `${item.id}-view` ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button><a href={item.viewUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-2.5 text-foreground hover:bg-muted" aria-label={t('merchantOrders.openView', 'Open view link')}><Eye className="h-4 w-4" /></a></div></div></div></div>)}</div></div>
          {selectedOrder.status !== 'CANCELLED' && !confirmingCancel && (
            <div className="flex justify-end border-t border-border pt-4">
              <button type="button" onClick={() => setConfirmingCancel(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3.5 py-2 text-xs font-extrabold text-red-700 transition hover:bg-red-500/10 dark:border-red-900 dark:text-red-300"><Ban className="h-3.5 w-3.5" />{t('merchantOrders.cancelOrder', 'Cancel order')}</button>
            </div>
          )}
        </div>}</div></div>}
    </div>
  );
};

export default MerchantOrdersManagementPage;
