import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Lock,
  Loader2,
  PackageOpen,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Unlock,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  merchantOrderService,
  type MerchantOrder,
  type MerchantOrdersResponse,
} from '../features/orders/services/merchantOrderService';

type StatusFilter = '' | 'PENDING' | 'COMPLETED';

const initialResponse: MerchantOrdersResponse = {
  items: [],
  meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
  summary: { total: 0, pending: 0, completed: 0 },
};

export const MerchantOrdersManagementPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [response, setResponse] = useState(initialResponse);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<MerchantOrder | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

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

  const copyLink = async (linkId: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    window.setTimeout(() => setCopiedId(null), 1600);
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
  ) => {
    setUpdatingItemId(itemId);
    setError('');
    try {
      const updatedOrder = await merchantOrderService.updateItemLock(
        order.id,
        itemId,
        isLocked,
      );
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

  const statusBadge = (orderStatus: MerchantOrder['status']) =>
    orderStatus === 'COMPLETED' ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />{t('merchantOrders.completed', 'Completed')}</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-extrabold text-amber-700 dark:text-amber-300"><Clock3 className="h-3.5 w-3.5" />{t('merchantOrders.pending', 'Pending')}</span>
    );

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
                <thead className="bg-muted/50 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 text-start">{t('merchantOrders.order', 'Order')}</th><th className="px-5 py-3 text-start">{t('merchantOrders.customer', 'Customer')}</th><th className="px-5 py-3 text-start">{t('merchantOrders.items', 'NFC items')}</th><th className="px-5 py-3 text-start">{t('merchantOrders.status', 'Status')}</th><th className="px-5 py-3 text-start">{t('merchantOrders.date', 'Date')}</th><th className="px-5 py-3"></th></tr></thead>
                <tbody className="divide-y divide-border">{response.items.map((order) => <tr key={order.id} className="transition hover:bg-muted/30"><td className="px-5 py-4"><p className="font-mono text-xs font-bold text-foreground">#{order.id.slice(0, 8)}</p><p className="mt-1 text-[10px] text-muted-foreground">{order.externalOrderId || sourceLabel(order.source)}</p></td><td className="px-5 py-4"><p className="text-sm font-bold text-foreground">{order.customerName}</p><p dir="ltr" className="mt-1 text-start text-[10px] text-muted-foreground">{order.customerPhone || '—'}</p></td><td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary"><Link2 className="h-3.5 w-3.5" />{order.items.length}</span></td><td className="px-5 py-4"><select value={order.status} disabled={updatingOrderId === order.id} onChange={(event) => void handleStatusChange(order, event.target.value as MerchantOrder['status'])} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-extrabold text-foreground outline-none focus:border-primary disabled:opacity-50"><option value="PENDING">{t('merchantOrders.pending', 'Pending')}</option><option value="COMPLETED">{t('merchantOrders.completed', 'Completed')}</option></select></td><td className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-muted-foreground">{formatDate(order.createdAt)}</td><td className="px-5 py-4 text-end"><button type="button" onClick={() => void openDetails(order)} className="rounded-xl border border-border px-3 py-2 text-xs font-extrabold text-foreground transition hover:bg-muted">{t('merchantOrders.view', 'View')}</button></td></tr>)}</tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">{response.items.map((order) => <button key={order.id} type="button" onClick={() => void openDetails(order)} className="block w-full p-4 text-start transition hover:bg-muted/30"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-extrabold text-foreground">#{order.id.slice(0, 8)}</p><p className="mt-1 text-sm font-bold text-foreground">{order.customerName}</p><p dir="ltr" className="mt-1 text-start text-[10px] text-muted-foreground">{order.customerPhone || '—'}</p></div>{statusBadge(order.status)}</div><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />{t('merchantOrders.itemCount', '{{count}} NFC items', { count: order.items.length })}</span><span>{formatDate(order.createdAt)}</span></div></button>)}</div>
          </>
        )}

        {!isLoading && response.meta.total > 0 && <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-5"><p className="text-xs text-muted-foreground">{t('merchantOrders.pageInfo', 'Page {{page}} of {{totalPages}} · {{total}} orders', { page, totalPages, total: response.meta.total })}</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-border p-2 text-foreground disabled:opacity-35" aria-label={t('merchantOrders.previous', 'Previous')}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button><span className="min-w-7 text-center text-xs font-black text-foreground">{page}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-border p-2 text-foreground disabled:opacity-35" aria-label={t('merchantOrders.next', 'Next')}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button></div></div>}
      </div>

      {selectedOrder && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card/95 p-5 backdrop-blur sm:p-6"><div><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h2 className="text-xl font-black text-foreground">{t('merchantOrders.details', 'Order details')}</h2></div><p className="mt-1 font-mono text-[10px] text-muted-foreground">{selectedOrder.id}</p></div><button type="button" onClick={() => setSelectedOrder(null)} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted" aria-label={t('merchantOrders.close', 'Close')}><X className="h-4 w-4" /></button></div>
        {isLoadingDetails ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : <div className="space-y-5 p-5 sm:p-6"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-muted p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.customer', 'Customer')}</p><p className="mt-1 font-extrabold text-foreground">{selectedOrder.customerName}</p></div><div className="rounded-2xl bg-muted p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.customerPhone', 'Customer phone')}</p>{selectedOrder.customerPhone ? <a href={`tel:${selectedOrder.customerPhone}`} dir="ltr" className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-primary"><Phone className="h-3.5 w-3.5" />{selectedOrder.customerPhone}</a> : <p className="mt-1 text-sm font-bold text-foreground">—</p>}</div><div className="rounded-2xl bg-muted p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.status', 'Status')}</p><select value={selectedOrder.status} disabled={updatingOrderId === selectedOrder.id} onChange={(event) => void handleStatusChange(selectedOrder, event.target.value as MerchantOrder['status'])} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-extrabold text-foreground outline-none focus:border-primary disabled:opacity-50"><option value="PENDING">{t('merchantOrders.pending', 'Pending')}</option><option value="COMPLETED">{t('merchantOrders.completed', 'Completed')}</option></select></div><div className="rounded-2xl bg-muted p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.externalId', 'External order ID')}</p><p className="mt-1 text-sm font-bold text-foreground">{selectedOrder.externalOrderId || '—'}</p></div><div className="rounded-2xl bg-muted p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.source', 'Source')}</p><p className="mt-1 text-sm font-bold text-foreground">{sourceLabel(selectedOrder.source)}</p></div></div>
          <div><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-black text-foreground"><Link2 className="h-4 w-4 text-primary" />{t('merchantOrders.nfcLinks', 'NFC links')}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-extrabold text-muted-foreground">{selectedOrder.items.length}</span></div><div className="space-y-3">{selectedOrder.items.map((item) => <div key={item.id} className="rounded-2xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-extrabold text-foreground">{item.productName}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.isLocked ? t('merchantOrders.lockedHint', 'Setup editing is disabled') : t('merchantOrders.activeHint', 'Setup editing is enabled')}</p></div><button type="button" role="switch" aria-checked={item.isLocked} disabled={updatingItemId === item.id} onClick={() => void handleItemLockChange(selectedOrder, item.id, !item.isLocked)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold transition disabled:cursor-wait disabled:opacity-50 ${item.isLocked ? 'border-red-200 bg-red-500/10 text-red-600 dark:border-red-900' : 'border-emerald-200 bg-emerald-500/10 text-emerald-600 dark:border-emerald-900'}`}>{updatingItemId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : item.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}{item.isLocked ? t('merchantOrders.locked', 'Locked') : t('merchantOrders.active', 'Active')}</button></div><div className="mt-3 space-y-2"><div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.setupLink', 'Setup link')}</p><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2 font-mono text-[10px] text-muted-foreground">{item.setupUrl}</span><button type="button" onClick={() => void copyLink(`${item.id}-setup`, item.setupUrl)} className="rounded-xl border border-border p-2.5 text-foreground hover:bg-muted" aria-label={t('merchantOrders.copySetup', 'Copy setup link')}>{copiedId === `${item.id}-setup` ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button><a href={item.setupUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-2.5 text-foreground hover:bg-muted" aria-label={t('merchantOrders.openSetup', 'Open setup link')}><ExternalLink className="h-4 w-4" /></a></div></div><div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{t('merchantOrders.viewLink', 'View link')}</p><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate rounded-xl bg-blue-500/8 px-3 py-2 font-mono text-[10px] text-blue-700 dark:text-blue-300">{item.viewUrl}</span><button type="button" onClick={() => void copyLink(`${item.id}-view`, item.viewUrl)} className="rounded-xl border border-border p-2.5 text-foreground hover:bg-muted" aria-label={t('merchantOrders.copyView', 'Copy view link')}>{copiedId === `${item.id}-view` ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button><a href={item.viewUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-2.5 text-foreground hover:bg-muted" aria-label={t('merchantOrders.openView', 'Open view link')}><Eye className="h-4 w-4" /></a></div></div></div></div>)}</div></div>
        </div>}</div></div>}
    </div>
  );
};

export default MerchantOrdersManagementPage;
